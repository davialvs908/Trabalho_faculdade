const BASE = "https://api.jikan.moe/v4";

// A Jikan pede no máximo cerca de 3 requisições por segundo.
const MIN_GAP_MS = 400;
const ATTEMPT_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2;
const RETRY_WAIT_CAP_MS = 2000;
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const ALLOWED_STATUS = {
  anime: new Set(["airing", "complete", "upcoming"]),
  manga: new Set(["publishing", "complete"]),
};

let chain = Promise.resolve();
let lastStart = 0;

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(asError(signal.reason, "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(asError(signal.reason, "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function asError(reason, name) {
  if (reason instanceof Error) return reason;
  return new DOMException(name === "TimeoutError" ? "timeout" : "aborted", name);
}

function failure(message, kind, extra = {}) {
  const error = new Error(message);
  error.kind = kind;
  Object.assign(error, extra);
  return error;
}

function invalidPayload() {
  return failure("A resposta do serviço veio em um formato inválido.", "parse");
}

export function enqueue(task) {
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastStart);
    if (wait > 0) await delay(wait);
    lastStart = Date.now();
    return task();
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function timeoutSignal(ms) {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), ms);
  return controller.signal;
}

export function combineSignals(signals) {
  const active = signals.filter(Boolean);
  if (typeof AbortSignal.any === "function") return AbortSignal.any(active);
  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw asError(signal.reason, "AbortError");
}

function catalogType(type) {
  if (type === "anime" || type === "manga") return type;
  throw failure("Tipo de busca inválido.", "input");
}

export function buildSearchUrl(type, { q, genre, status }) {
  const params = new URLSearchParams();
  params.set("sfw", "true");
  params.set("limit", "24");
  const query = (q || "").trim().slice(0, 100);
  if (query) {
    params.set("q", query);
  } else {
    params.set("order_by", "popularity");
    params.set("sort", "asc");
  }
  if (/^\d+$/.test(genre || "")) params.set("genres", genre);
  if (ALLOWED_STATUS[catalogType(type)].has(status)) params.set("status", status);
  return `${BASE}/${type}?${params.toString()}`;
}

export function buildGenresUrl(type) {
  const params = new URLSearchParams();
  params.set("filter", "genres");
  return `${BASE}/genres/${catalogType(type)}?${params.toString()}`;
}

export function readCatalog(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) throw invalidPayload();
  const items = payload.data.filter((item) => {
    return item && typeof item === "object" && Number.isInteger(item.mal_id) && typeof item.title === "string" && item.title.trim();
  });
  if (payload.data.length > 0 && items.length === 0) throw invalidPayload();
  return items;
}

export function readGenres(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) throw invalidPayload();
  return payload.data.filter((genre) => {
    return genre && Number.isInteger(genre.mal_id) && typeof genre.name === "string" && genre.name.trim();
  });
}

function retryAfterMs(response) {
  const raw = response.headers.get("retry-after");
  if (!raw) return MIN_GAP_MS;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const when = Date.parse(raw);
  if (Number.isNaN(when)) return MIN_GAP_MS;
  return when - Date.now();
}

function canRetry(error) {
  if (!error || error.name === "AbortError") return false;
  if (error.name === "TimeoutError" || error.kind === "network" || error.kind === "parse") return true;
  return error.kind === "http" && RETRYABLE_STATUS.has(error.status);
}

async function requestOnce(url, signal) {
  throwIfAborted(signal);
  let response;
  try {
    response = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") throw error;
    throw failure("Não foi possível conectar ao serviço de dados.", "network");
  }

  throwIfAborted(signal);

  if (!response.ok) {
    throw failure(
      response.status === 429
        ? "O serviço limitou as consultas. Espere um instante e tente de novo."
        : `O serviço respondeu com erro (HTTP ${response.status}).`,
      "http",
      { status: response.status, retryAfterMs: retryAfterMs(response) },
    );
  }

  try {
    return await response.json();
  } catch {
    throw invalidPayload();
  }
}

// GET de busca não altera dados: uma segunda tentativa cobre queda e HTTP 429/502/503/504.
// Cancelamento do usuário não dispara essa tentativa. O teto é duas chamadas por consulta.
export async function fetchJson(url, signal) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    throwIfAborted(signal);
    const attemptSignal = combineSignals([signal, timeoutSignal(ATTEMPT_TIMEOUT_MS)]);
    try {
      return await requestOnce(url, attemptSignal);
    } catch (error) {
      if (signal?.aborted) throwIfAborted(signal);
      lastError = error;
      if (!canRetry(error) || attempt === MAX_ATTEMPTS) throw error;
      const wait = Math.min(Math.max(error.retryAfterMs || MIN_GAP_MS, MIN_GAP_MS), RETRY_WAIT_CAP_MS);
      await delay(wait, signal);
    }
  }
  throw lastError;
}

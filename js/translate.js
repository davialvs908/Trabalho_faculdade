const ENDPOINT = "https://api.mymemory.translated.net/get";
const MAX_BYTES = 450;
const CACHE_PREFIX = "sinopse-pt:";
const encoder = new TextEncoder();

function bytes(text) {
  return encoder.encode(text).length;
}

export function readCachedSynopsis(malId) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${malId}`);
    if (!raw) return "";
    const data = JSON.parse(raw);
    return typeof data?.text === "string" ? data.text.trim() : "";
  } catch {
    return "";
  }
}

export function rememberSynopsis(malId, text) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${malId}`, JSON.stringify({ text }));
  } catch {
    /* o navegador pode recusar o armazenamento */
  }
}

export function splitParagraph(paragraph) {
  const words = paragraph.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks = [];
  let current = "";
  for (const word of words) {
    if (bytes(word) > MAX_BYTES) return null;
    const next = current ? `${current} ${word}` : word;
    if (bytes(next) > MAX_BYTES) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function blocked(text) {
  return /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR/i.test(text || "");
}

function attemptSignal(signal) {
  const timeout = AbortSignal.timeout(10000);
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout].filter(Boolean));
  return signal || timeout;
}

async function translateChunk(chunk, signal) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(chunk)}&langpair=en|pt-BR`;
  const response = await fetch(url, {
    signal: attemptSignal(signal),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return { ok: false, stop: response.status === 429 || response.status === 403 };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, stop: false };
  }
  const text = payload?.responseData?.translatedText;
  const quota = payload?.quotaFinished === true || payload?.quotaFinished === "true";
  if (quota || blocked(text) || Number(payload?.responseStatus) !== 200 || typeof text !== "string" || !text.trim()) {
    return { ok: false, stop: quota || blocked(text) };
  }
  return { ok: true, text: text.trim() };
}

export async function translateSynopsis(text, signal) {
  const paragraphs = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length === 0) return { ok: false, stop: false };
  const translated = [];
  for (const paragraph of paragraphs) {
    const chunks = splitParagraph(paragraph);
    if (!chunks) return { ok: false, stop: false };
    const parts = [];
    for (const chunk of chunks) {
      if (signal?.aborted) return { ok: false, stop: false, aborted: true };
      try {
        const result = await translateChunk(chunk, signal);
        if (!result.ok) return result;
        parts.push(result.text);
      } catch {
        if (signal?.aborted) return { ok: false, stop: false, aborted: true };
        return { ok: false, stop: true };
      }
    }
    translated.push(parts.join(" "));
  }
  return { ok: true, text: translated.join("\n\n") };
}

import { buildGenresUrl, buildSearchUrl, enqueue, fetchJson, readCatalog, readGenres } from "./api.js";
import { FALLBACK_GENRES, STATUS_OPTIONS, translateGenre, visibleGenres } from "./labels.js";
import { clearError, renderCards, renderGenres, renderStatusOptions, setLoading, setStatus, showError, showSynopsis } from "./render.js";
import { readCachedSynopsis, rememberSynopsis, translateSynopsis } from "./translate.js";

const SEARCH_DEBOUNCE_MS = 400;

const state = {
  type: "anime",
  q: "",
  genre: "",
  status: "",
  requestId: 0,
  controller: null,
  items: new Map(),
  genres: { anime: null, manga: null },
};

const form = document.querySelector("#search-form");
let debounceTimer = 0;
let translationController = null;

const STATUS_VALUES = {
  anime: new Set(STATUS_OPTIONS.anime.map(([value]) => value)),
  manga: new Set(STATUS_OPTIONS.manga.map(([value]) => value)),
};

function readForm() {
  const data = new FormData(form);
  state.q = String(data.get("q") || "");
  state.type = data.get("type") === "manga" ? "manga" : "anime";
  state.genre = String(data.get("genre") || "");
  state.status = String(data.get("status") || "");
}

function searchParamsFromState() {
  const params = new URLSearchParams();
  const query = state.q.trim().slice(0, 100);
  if (query) params.set("q", query);
  if (state.type === "manga") params.set("tipo", "manga");
  if (/^\d+$/.test(state.genre)) params.set("genero", state.genre);
  if (STATUS_VALUES[state.type].has(state.status)) params.set("status", state.status);
  return params;
}

function rememberReturn() {
  const params = searchParamsFromState();
  const search = params.toString();
  const next = search ? `${location.pathname}?${search}` : location.pathname;
  if (`${location.pathname}${location.search}` !== next) history.replaceState(null, "", next);
  try {
    sessionStorage.setItem("catalogo-retorno", search ? `?${search}` : "");
  } catch {
    /* o navegador pode recusar o armazenamento */
  }
}

function readQuery() {
  const params = new URLSearchParams(location.search);
  const type = params.get("tipo") === "manga" ? "manga" : "anime";
  const query = (params.get("q") || "").slice(0, 100);
  const genre = /^\d+$/.test(params.get("genero") || "") ? params.get("genero") : "";
  const status = STATUS_VALUES[type].has(params.get("status") || "") ? params.get("status") : "";
  form.querySelector("#q").value = query;
  const radio = form.querySelector(`input[name="type"][value="${type}"]`);
  if (radio) radio.checked = true;
  state.q = query;
  state.type = type;
  state.genre = genre;
  state.status = renderStatusOptions(type, status);
}

async function loadGenres(type) {
  if (state.genres[type]) {
    if (state.type === type) state.genre = renderGenres(state.genres[type], state.genre);
    return;
  }
  try {
    const payload = await enqueue(() => fetchJson(buildGenresUrl(type)));
    const list = visibleGenres(readGenres(payload)).map((genre) => ({
      id: String(genre.mal_id),
      name: translateGenre(genre.name),
    }));
    state.genres[type] = list.length ? list : FALLBACK_GENRES;
  } catch {
    state.genres[type] = FALLBACK_GENRES;
  }
  if (state.type === type) {
    state.genre = renderGenres(state.genres[type], state.genre);
    rememberReturn();
  }
}

async function runSearch() {
  const id = state.requestId + 1;
  state.requestId = id;
  rememberReturn();
  state.controller?.abort();
  translationController?.abort();
  const controller = new AbortController();
  state.controller = controller;
  setLoading(true);

  try {
    const payload = await enqueue(() => fetchJson(buildSearchUrl(state.type, state), controller.signal));
    if (id !== state.requestId) return;
    const items = readCatalog(payload);
    if (items.length === 0) {
      state.items = new Map();
      showError("Nenhum título encontrado para essa busca. Tente outro termo ou outro filtro.");
      return;
    }
    state.items = new Map(items.map((item) => [String(item.mal_id), item]));
    clearError();
    renderCards(items, state.type);
    const label = items.length === 1 ? "1 título encontrado." : `${items.length} títulos encontrados.`;
    setStatus(label);
    translateList(items, id);
  } catch (error) {
    if (id !== state.requestId) return;
    if (error?.name === "AbortError") {
      showError("A consulta foi interrompida antes de terminar. Tente novamente.");
      return;
    }
    state.items = new Map();
    if (error?.name === "TimeoutError") {
      showError("A consulta demorou demais e foi cancelada. Tente novamente.");
      return;
    }
    showError(error?.message || "Não foi possível carregar o catálogo.");
  } finally {
    if (id === state.requestId) setLoading(false);
  }
}

function synopsisSource(text) {
  return (text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function translateList(items, searchId) {
  translationController?.abort();
  const controller = new AbortController();
  translationController = controller;
  void (async () => {
    let stop = false;
    for (const item of items) {
      if (searchId !== state.requestId || controller.signal.aborted) return;
      const malId = String(item.mal_id);
      const source = synopsisSource(item.synopsis);
      if (!source || readCachedSynopsis(malId)) continue;
      if (stop) {
        showSynopsis(malId, source, true);
        continue;
      }
      const result = await translateSynopsis(source, controller.signal);
      if (searchId !== state.requestId || result.aborted || controller.signal.aborted) return;
      if (result.ok) {
        rememberSynopsis(malId, result.text);
        showSynopsis(malId, result.text, false);
      } else {
        showSynopsis(malId, source, true);
        if (result.stop) stop = true;
      }
    }
  })();
}

function scheduleSearch(immediate = false) {
  window.clearTimeout(debounceTimer);
  if (immediate) {
    void runSearch();
    return;
  }
  debounceTimer = window.setTimeout(() => {
    void runSearch();
  }, SEARCH_DEBOUNCE_MS);
}

function onTypeChange() {
  readForm();
  state.genre = "";
  state.status = renderStatusOptions(state.type, "");
  if (state.genres[state.type]) renderGenres(state.genres[state.type], "");
  else {
    renderGenres([], "");
    void loadGenres(state.type);
  }
  scheduleSearch(false);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  readForm();
  scheduleSearch(true);
});

form.querySelector("#q").addEventListener("input", () => {
  readForm();
  scheduleSearch(false);
});

form.querySelector("#genre").addEventListener("change", () => {
  readForm();
  scheduleSearch(false);
});

form.querySelector("#status").addEventListener("change", () => {
  readForm();
  scheduleSearch(false);
});

for (const radio of form.querySelectorAll('input[name="type"]')) {
  radio.addEventListener("change", onTypeChange);
}

document.querySelector("#retry").addEventListener("click", () => {
  scheduleSearch(true);
});

if (location.protocol === "file:") {
  showError("Abra este catálogo por um servidor HTTP. Os módulos JavaScript não funcionam em um arquivo local.");
} else {
  readQuery();
  void runSearch();
  void loadGenres(state.type);
}

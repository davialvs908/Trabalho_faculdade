import { buildGenresUrl, buildSearchUrl, enqueue, fetchJson, readCatalog, readGenres } from "./api.js";
import { FALLBACK_GENRES, translateGenre, visibleGenres } from "./labels.js";
import { clearError, fillModal, renderCards, renderGenres, renderStatusOptions, setLoading, setStatus, showError } from "./render.js";

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

const dialog = document.querySelector("#details");
const form = document.querySelector("#search-form");
let debounceTimer = 0;
let returnFocus = null;

function readForm() {
  const data = new FormData(form);
  state.q = String(data.get("q") || "");
  state.type = data.get("type") === "manga" ? "manga" : "anime";
  state.genre = String(data.get("genre") || "");
  state.status = String(data.get("status") || "");
}

function focusable(root) {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return [...root.querySelectorAll(selector)].filter((element) => {
    if (element.hasAttribute("hidden") || element.closest("[hidden]")) return false;
    return element.getClientRects().length > 0;
  });
}

function trapFocus(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    dialog.close();
    return;
  }
  if (event.key !== "Tab") return;
  const items = focusable(dialog);
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const outside = !dialog.contains(active);
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

function openDetails(item, trigger) {
  returnFocus = trigger;
  fillModal(item, state.type);
  if (!dialog.open) dialog.showModal();
  document.querySelector("#modal-close").focus();
}

function restoreFocus() {
  const target = returnFocus;
  returnFocus = null;
  if (target && typeof target.focus === "function") target.focus();
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
  if (state.type === type) state.genre = renderGenres(state.genres[type], state.genre);
}

async function runSearch() {
  const id = state.requestId + 1;
  state.requestId = id;
  state.controller?.abort();
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

document.querySelector("#catalog").addEventListener("click", (event) => {
  const button = event.target.closest(".card-open");
  if (!button) return;
  const item = state.items.get(button.dataset.id);
  if (!item) return;
  openDetails(item, button);
});

document.querySelector("#retry").addEventListener("click", () => {
  scheduleSearch(true);
});

document.querySelector("#modal-close").addEventListener("click", () => {
  dialog.close();
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener("keydown", trapFocus);
dialog.addEventListener("close", restoreFocus);

if (location.protocol === "file:") {
  showError("Abra este catálogo por um servidor HTTP. Os módulos JavaScript não funcionam em um arquivo local.");
} else {
  state.status = renderStatusOptions("anime", "");
  void runSearch();
  void loadGenres("anime");
}

import {
  buildCharactersUrl,
  buildDetailUrl,
  buildRecommendationsUrl,
  enqueue,
  fetchJson,
  readCharacters,
  readDetail,
  readRecommendations,
} from "./api.js";
import {
  authorLines,
  countLabel,
  coverUrl,
  demographicNames,
  formatCount,
  formatPeriod,
  formatPlace,
  genreNames,
  namedList,
  personName,
  scoreLabel,
  seasonLabel,
  themeNames,
  trailerUrl,
  translateDuration,
  translateRating,
  translateSource,
  translateStatus,
  translateType,
} from "./labels.js";
import { readCachedSynopsis, rememberSynopsis, translateSynopsis } from "./translate.js";

const main = document.querySelector("#ficha");
const loading = document.querySelector("#detail-loading");
const missing = document.querySelector("#detail-missing");
const errorBox = document.querySelector("#detail-error");
const errorMessage = document.querySelector("#detail-error-message");
const article = document.querySelector("#detail");
const status = document.querySelector("#detail-status");

let requestId = 0;
let controller = null;

function catalogHref() {
  let search = "";
  try {
    search = sessionStorage.getItem("catalogo-retorno") || "";
  } catch {
    search = "";
  }
  if (!search) return "index.html";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const clean = new URLSearchParams();
  const query = (params.get("q") || "").trim().slice(0, 100);
  if (query) clean.set("q", query);
  if (params.get("tipo") === "manga") clean.set("tipo", "manga");
  if (/^\d+$/.test(params.get("genero") || "")) clean.set("genero", params.get("genero"));
  const allowed = new Set(["airing", "complete", "upcoming", "publishing"]);
  if (allowed.has(params.get("status") || "")) clean.set("status", params.get("status"));
  const built = clean.toString();
  return built ? `index.html?${built}` : "index.html";
}

function setBusy(isBusy, message) {
  main.setAttribute("aria-busy", isBusy ? "true" : "false");
  status.textContent = message || "";
}

function hideAll() {
  loading.hidden = true;
  missing.hidden = true;
  errorBox.hidden = true;
  article.hidden = true;
}

function showMissing() {
  hideAll();
  missing.hidden = false;
  document.title = "Título não encontrado · Catálogo";
  setBusy(false, "Título não encontrado.");
  missing.querySelector("h1").focus();
}

function showFailure(message) {
  hideAll();
  errorMessage.textContent = message;
  errorBox.hidden = false;
  document.title = "Ficha indisponível · Catálogo";
  setBusy(false, message);
  document.querySelector("#detail-retry").focus();
}

function readRoute() {
  const params = new URLSearchParams(location.search);
  const type = params.get("tipo");
  const id = params.get("id") || "";
  if ((type !== "anime" && type !== "manga") || !/^\d{1,10}$/.test(id)) return null;
  return { type, id };
}

function paragraphs(container, text, empty) {
  container.replaceChildren();
  const clean = (text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const parts = clean ? clean.split(/\n+/).map((part) => part.trim()).filter(Boolean) : [];
  if (parts.length === 0) {
    const paragraph = document.createElement("p");
    paragraph.textContent = empty;
    container.append(paragraph);
    return;
  }
  for (const part of parts) {
    const paragraph = document.createElement("p");
    paragraph.textContent = part;
    container.append(paragraph);
  }
}

function fact(label, value) {
  if (!value) return null;
  const wrap = document.createElement("div");
  const term = document.createElement("dt");
  const detail = document.createElement("dd");
  term.textContent = label;
  detail.textContent = value;
  wrap.append(term, detail);
  return wrap;
}

function setAnchor(anchor, href) {
  if (!href) {
    anchor.hidden = true;
    anchor.removeAttribute("href");
    return;
  }
  anchor.hidden = false;
  anchor.href = href;
}

function paintCover(item) {
  const image = document.querySelector("#detail-cover");
  const title = item.title;
  const src = coverUrl(item);
  image.referrerPolicy = "no-referrer";
  image.alt = src ? `Capa de ${title}` : `Capa indisponível de ${title}`;
  image.classList.toggle("is-missing", !src);
  image.onerror = () => {
    image.classList.add("is-missing");
    image.alt = `Capa indisponível de ${title}`;
  };
  if (src) image.src = src;
  else image.removeAttribute("src");
}

function paintTitles(item) {
  const list = document.querySelector("#detail-titles");
  list.replaceChildren();
  const rows = [
    ["Japonês", item.title_japanese],
    ["Inglês", item.title_english],
  ];
  for (const [label, value] of rows) {
    if (!value || value === item.title) continue;
    const itemNode = document.createElement("li");
    itemNode.textContent = `${label}: ${value}`;
    list.append(itemNode);
  }
  const synonyms = (item.title_synonyms || []).map((name) => String(name || "").trim()).filter((name) => name && name !== item.title);
  if (synonyms.length) {
    const itemNode = document.createElement("li");
    itemNode.textContent = `Também conhecido como ${synonyms.join(", ")}`;
    list.append(itemNode);
  }
}

function paintFacts(item, type) {
  const list = document.querySelector("#detail-facts");
  const period = formatPeriod(type === "manga" ? item.published : item.aired);
  const season = type === "anime" ? seasonLabel(item) : "";
  const people = type === "manga" ? authorLines(item).join(", ") : namedList(item.studios).join(", ");
  const themes = themeNames(item).join(", ");
  const audience = demographicNames(item).join(", ");
  const magazine = namedList(item.serializations).join(", ");
  const votes = formatCount(item.scored_by);
  const scoreNumber = item.score == null || Number.isNaN(Number(item.score))
    ? ""
    : Number(item.score).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const score = scoreNumber ? (votes ? `${scoreNumber} · ${votes} votos` : scoreNumber) : "Sem nota";
  const rows = [
    fact("Nota", score),
    fact("Rank", formatPlace(item.rank) || "Não informado"),
    fact("Popularidade", formatPlace(item.popularity) || "Não informado"),
    fact("Membros", formatCount(item.members) || "Não informado"),
    fact("Favoritos", formatCount(item.favorites) || "Não informado"),
    fact("Status", translateStatus(item.status)),
    fact("Formato", translateType(item.type) || "Não informado"),
    fact(type === "manga" ? "Capítulos" : "Episódios", countLabel(item, type)),
    type === "manga" ? fact("Volumes", item.volumes == null ? "Não informado" : formatCount(item.volumes)) : fact("Duração", translateDuration(item.duration) || "Não informada"),
    fact("Classificação", translateRating(item.rating)),
    fact(type === "manga" ? "Publicação" : "Temporada", type === "manga" ? period : season),
    type === "manga" ? null : fact("Exibição", period),
    fact(type === "manga" ? "Autores" : "Estúdio", people || "Não informado"),
    fact("Origem", translateSource(item.source)),
    fact("Revista", magazine),
    fact("Público", audience),
    fact("Temas", themes),
    fact("Gêneros", genreNames(item)),
  ].filter(Boolean);
  list.replaceChildren(...rows);
  for (const node of list.querySelectorAll("div")) {
    const label = node.querySelector("dt")?.textContent;
    if (["Gêneros", "Temas", "Autores", "Exibição", "Publicação", "Revista"].includes(label)) {
      node.classList.add("fact-wide");
    }
  }
}

function paintCharacters(rows, failed) {
  const note = document.querySelector("#detail-characters-note");
  const list = document.querySelector("#detail-characters");
  document.querySelector("#detail-characters-section").hidden = false;
  list.replaceChildren();
  if (failed) {
    note.hidden = false;
    note.textContent = "Os personagens não carregaram.";
    return;
  }
  const mains = rows.filter((row) => row.role === "Main").slice(0, 12);
  if (mains.length === 0) {
    note.hidden = false;
    note.textContent = "Nenhum personagem principal informado.";
    return;
  }
  note.hidden = true;
  for (const row of mains) {
    const name = personName(row.character.name);
    const item = document.createElement("li");
    const image = document.createElement("img");
    const caption = document.createElement("p");
    const src = row.character.images?.jpg?.image_url || row.character.images?.webp?.image_url || "";
    image.alt = `Retrato de ${name}`;
    image.width = 160;
    image.height = 220;
    image.referrerPolicy = "no-referrer";
    image.loading = "lazy";
    if (src) {
      image.src = src;
      image.addEventListener("error", () => {
        image.removeAttribute("src");
        image.alt = `Retrato indisponível de ${name}`;
        image.classList.add("is-missing");
      });
    } else {
      image.alt = `Retrato indisponível de ${name}`;
      image.classList.add("is-missing");
    }
    caption.textContent = name;
    item.append(image, caption);
    list.append(item);
  }
}

function paintRecommendations(rows, type, failed) {
  const note = document.querySelector("#detail-recommendations-note");
  const list = document.querySelector("#detail-recommendations");
  document.querySelector("#detail-recommendations-section").hidden = false;
  list.replaceChildren();
  if (failed) {
    note.hidden = false;
    note.textContent = "As recomendações não carregaram.";
    return;
  }
  const picks = [...rows].sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 8);
  if (picks.length === 0) {
    note.hidden = false;
    note.textContent = "Nenhuma recomendação informada.";
    return;
  }
  note.hidden = true;
  for (const row of picks) {
    const title = row.entry.title;
    const item = document.createElement("li");
    const link = document.createElement("a");
    const image = document.createElement("img");
    const caption = document.createElement("p");
    const votes = document.createElement("p");
    const src = coverUrl(row.entry);
    link.href = `detalhe.html?tipo=${encodeURIComponent(type)}&id=${row.entry.mal_id}`;
    link.className = "rec-link";
    image.alt = "";
    image.width = 160;
    image.height = 220;
    image.referrerPolicy = "no-referrer";
    image.loading = "lazy";
    if (src) {
      image.src = src;
      image.addEventListener("error", () => {
        image.removeAttribute("src");
        image.classList.add("is-missing");
      });
    } else {
      image.classList.add("is-missing");
    }
    caption.textContent = title;
    const count = Number(row.votes);
    votes.textContent = Number.isFinite(count) ? (count === 1 ? "1 voto" : `${formatCount(count)} votos`) : "";
    votes.className = "rec-votes";
    link.append(image, caption, votes);
    item.append(link);
    list.append(item);
  }
}

function paint(item, type) {
  const title = item.title.trim();
  document.title = `${title} · Catálogo`;
  document.querySelector("#detail-kicker").textContent = [translateType(item.type), type === "manga" ? "Mangá" : "Anime"].filter((part, index, all) => part && all.indexOf(part) === index).join(" · ");
  const heading = document.querySelector("#detail-title");
  heading.textContent = title;
  paintTitles(item);
  paintCover(item);
  document.querySelector("#detail-score").textContent = scoreLabel(item.score);
  const source = synopsisText(item.synopsis);
  const cached = readCachedSynopsis(item.mal_id);
  paragraphs(document.querySelector("#detail-synopsis"), cached || source, "Sinopse não disponível.");
  document.querySelector("#detail-origin").hidden = true;
  setAnchor(document.querySelector("#detail-trailer"), trailerUrl(item));
  setAnchor(document.querySelector("#detail-mal"), typeof item.url === "string" ? item.url : "");
  paintFacts(item, type);
  const background = (item.background || "").trim();
  const backgroundSection = document.querySelector("#detail-background-section");
  backgroundSection.hidden = !background;
  if (background) paragraphs(document.querySelector("#detail-background"), background, "");
  document.querySelector("#detail-characters-section").hidden = true;
  document.querySelector("#detail-recommendations-section").hidden = true;
  hideAll();
  article.hidden = false;
  setBusy(false, `Ficha de ${title}.`);
  return source;
}

function synopsisText(text) {
  return (text || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n*\[Written by [^\]]+\]\s*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function loadExtra(url, read, signal) {
  try {
    const payload = await enqueue(() => fetchJson(url, signal));
    return { ok: true, rows: read(payload) };
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") throw error;
    return { ok: false, rows: [] };
  }
}

async function translateAfter(item, source, signal) {
  if (!source || signal.aborted) return;
  const cached = readCachedSynopsis(item.mal_id);
  if (cached) return;
  const result = await translateSynopsis(source, signal);
  if (signal.aborted || result.aborted) return;
  if (result.ok) {
    rememberSynopsis(item.mal_id, result.text);
    paragraphs(document.querySelector("#detail-synopsis"), result.text, "Sinopse não disponível.");
    document.querySelector("#detail-origin").hidden = true;
    return;
  }
  paragraphs(document.querySelector("#detail-synopsis"), source, "Sinopse não disponível.");
  document.querySelector("#detail-origin").hidden = !source;
}

async function load() {
  const route = readRoute();
  document.querySelector("#back").href = catalogHref();
  const id = requestId + 1;
  requestId = id;
  controller?.abort();
  controller = new AbortController();
  hideAll();
  loading.hidden = false;
  document.title = "Carregando ficha · Catálogo";
  setBusy(true, "Carregando ficha…");
  if (!route) {
    showMissing();
    return;
  }

  try {
    const payload = await enqueue(() => fetchJson(buildDetailUrl(route.type, route.id), controller.signal));
    if (id !== requestId) return;
    const item = readDetail(payload);
    const source = paint(item, route.type);
    const [characters, recommendations] = await Promise.all([
      loadExtra(buildCharactersUrl(route.type, route.id), readCharacters, controller.signal),
      loadExtra(buildRecommendationsUrl(route.type, route.id), readRecommendations, controller.signal),
    ]);
    if (id !== requestId) return;
    paintCharacters(characters.rows, !characters.ok);
    paintRecommendations(recommendations.rows, route.type, !recommendations.ok);
    void translateAfter(item, source, controller.signal);
  } catch (error) {
    if (id !== requestId || error?.name === "AbortError") return;
    if (error?.kind === "http" && error.status === 404) {
      showMissing();
      return;
    }
    if (error?.kind === "input") {
      showMissing();
      return;
    }
    if (error?.name === "TimeoutError") {
      showFailure("A consulta demorou demais e foi cancelada. Tente novamente.");
      return;
    }
    showFailure(error?.message || "Não foi possível carregar a ficha.");
  }
}

document.querySelector("#detail-retry").addEventListener("click", () => {
  void load();
});

if (location.protocol === "file:") {
  showFailure("Abra esta ficha por um servidor HTTP. Os módulos JavaScript não funcionam em um arquivo local.");
} else {
  void load();
}

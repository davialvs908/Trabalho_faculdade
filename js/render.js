import { STATUS_OPTIONS, scoreLabel, countLabel, yearOf, coverUrl, trailerUrl, genreNames, translateStatus } from "./labels.js";
import { readCachedSynopsis } from "./translate.js";

const catalog = () => document.querySelector("#catalog");
const statusText = () => document.querySelector("#status-text");
const errorBox = () => document.querySelector("#error");
const errorMessage = () => document.querySelector("#error-message");
const results = () => document.querySelector("#resultados");

function option(value, label, selected) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  node.selected = value === selected;
  return node;
}

export function setStatus(message) {
  statusText().textContent = message;
}

export function setLoading(isLoading) {
  const section = results();
  section.setAttribute("aria-busy", isLoading ? "true" : "false");
  const list = catalog();
  if (!isLoading) {
    if (list.querySelector(".skeleton")) list.replaceChildren();
    return;
  }
  errorBox().hidden = true;
  setStatus("Carregando catálogo…");
  list.replaceChildren();
  const template = document.querySelector("#skeleton-template");
  for (let index = 0; index < 8; index += 1) {
    list.append(template.content.cloneNode(true));
  }
}

export function showError(message) {
  catalog().replaceChildren();
  errorMessage().textContent = message;
  errorBox().hidden = false;
  setStatus("");
  results().setAttribute("aria-busy", "false");
}

export function clearError() {
  errorBox().hidden = true;
}

export function renderStatusOptions(type, selected = "") {
  const select = document.querySelector("#status");
  const choices = STATUS_OPTIONS[type] || STATUS_OPTIONS.anime;
  const current = choices.some(([value]) => value === selected) ? selected : "";
  select.replaceChildren(...choices.map(([value, label]) => option(value, label, current)));
  return current;
}

export function renderGenres(genres, selected = "") {
  const select = document.querySelector("#genre");
  const exists = genres.some((genre) => genre.id === selected);
  const current = exists ? selected : "";
  const nodes = [option("", "Todos", current)];
  for (const genre of genres) {
    nodes.push(option(genre.id, genre.name, current));
  }
  select.replaceChildren(...nodes);
  select.disabled = false;
  return current;
}

export function renderCards(items, type) {
  const list = catalog();
  const template = document.querySelector("#card-template");
  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const node = template.content.cloneNode(true);
    const image = node.querySelector("img");
    const button = node.querySelector(".card-open");
    const score = node.querySelector(".score");
    const synopsis = node.querySelector(".synopsis");
    const count = node.querySelector(".count");
    const title = item.title || "Título não informado";
    const src = coverUrl(item);

    button.dataset.id = String(item.mal_id);
    button.textContent = title;
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-label", `Ver detalhes de ${title}`);

    image.alt = `Capa de ${title}`;
    image.referrerPolicy = "no-referrer";
    if (src) {
      image.src = src;
      image.addEventListener("error", () => {
        image.removeAttribute("src");
        image.alt = `Capa indisponível de ${title}`;
        image.classList.add("is-missing");
      });
    } else {
      image.alt = `Capa indisponível de ${title}`;
      image.classList.add("is-missing");
    }

    score.textContent = scoreLabel(item.score);
    const summary = synopsisSource(item.synopsis);
    const cached = readCachedSynopsis(item.mal_id);
    synopsis.textContent = (cached || summary) ? truncate(cached || summary, 180) : "Sinopse não disponível.";
    node.querySelector(".origin-note").hidden = true;
    count.textContent = countLabel(item, type);
    fragment.append(node);
  }

  list.replaceChildren(fragment);
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 80 ? cut.slice(0, lastSpace) : cut;
  return `${base}…`;
}

function setLink(anchor, href, label) {
  if (!href) {
    anchor.hidden = true;
    anchor.removeAttribute("href");
    return;
  }
  anchor.hidden = false;
  anchor.href = href;
  anchor.textContent = label;
}

function synopsisSource(text) {
  return (text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function showSynopsis(malId, text, original) {
  const id = String(malId);
  const button = /^\d+$/.test(id) ? document.querySelector(`.card-open[data-id="${id}"]`) : null;
  const card = button?.closest("article");
  if (card) {
    const synopsis = card.querySelector(".synopsis");
    const note = card.querySelector(".origin-note");
    synopsis.textContent = text ? truncate(text, 180) : "Sinopse não disponível.";
    if (note) note.hidden = !original;
  }
  const dialog = document.querySelector("#details");
  if (dialog?.open && dialog.dataset.id === id) {
    fillSynopsis(document.querySelector("#modal-synopsis"), text);
    document.querySelector("#modal-origin").hidden = !original;
  }
}

function fillSynopsis(container, text) {
  container.replaceChildren();
  const clean = (text || "").trim();
  if (!clean) {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Sinopse não disponível.";
    container.append(paragraph);
    return;
  }
  for (const part of clean.split(/\n+/)) {
    const paragraph = document.createElement("p");
    paragraph.textContent = part.trim();
    if (paragraph.textContent) container.append(paragraph);
  }
}

export function fillModal(item, type) {
  const title = item.title || "Título não informado";
  const english = item.title_english && item.title_english !== title ? item.title_english : "";
  document.querySelector("#modal-title").textContent = title;
  const subtitle = document.querySelector("#modal-subtitle");
  subtitle.hidden = !english;
  subtitle.textContent = english;

  const image = document.querySelector("#modal-cover");
  const src = coverUrl(item);
  image.alt = `Capa de ${title}`;
  image.referrerPolicy = "no-referrer";
  image.classList.toggle("is-missing", !src);
  image.onerror = () => {
    image.classList.add("is-missing");
    image.alt = `Capa indisponível de ${title}`;
  };
  if (src) image.src = src;
  else image.removeAttribute("src");

  document.querySelector("#modal-score").textContent = scoreLabel(item.score);
  document.querySelector("#modal-count").textContent = countLabel(item, type);
  document.querySelector("#modal-status").textContent = translateStatus(item.status);
  document.querySelector("#modal-genres").textContent = genreNames(item);
  const year = yearOf(item, type);
  document.querySelector("#modal-year").textContent = year ? String(year) : "Não informado";
  document.querySelector("#modal-count-label").textContent = type === "manga" ? "Capítulos" : "Episódios";

  const dialog = document.querySelector("#details");
  dialog.dataset.id = String(item.mal_id);
  const cached = readCachedSynopsis(item.mal_id);
  fillSynopsis(document.querySelector("#modal-synopsis"), cached || item.synopsis);
  const cardNote = document.querySelector(`.card-open[data-id="${dialog.dataset.id}"]`)?.closest("article")?.querySelector(".origin-note");
  document.querySelector("#modal-origin").hidden = cardNote ? cardNote.hidden : true;
  setLink(document.querySelector("#modal-trailer"), trailerUrl(item), "Assistir trailer");
  setLink(document.querySelector("#modal-mal"), item.url || "", "Ver no MyAnimeList");
}

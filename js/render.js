import { STATUS_OPTIONS, scoreLabel, countLabel, coverUrl } from "./labels.js";
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
    button.href = `detalhe.html?tipo=${encodeURIComponent(type)}&id=${item.mal_id}`;

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
}

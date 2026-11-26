const GENRE_PT = {
  Action: "Ação",
  Adventure: "Aventura",
  "Avant Garde": "Vanguarda",
  "Award Winning": "Premiado",
  "Boys Love": "Boys Love",
  Comedy: "Comédia",
  Drama: "Drama",
  Fantasy: "Fantasia",
  "Girls Love": "Girls Love",
  Gourmet: "Gastronomia",
  Horror: "Horror",
  Mystery: "Mistério",
  Romance: "Romance",
  "Sci-Fi": "Ficção científica",
  "Slice of Life": "Cotidiano",
  Sports: "Esportes",
  Supernatural: "Sobrenatural",
  Suspense: "Suspense",
  Historical: "Histórico",
  Isekai: "Isekai",
  Magical: "Mágico",
  Mecha: "Mecha",
  Military: "Militar",
  Music: "Música",
  Parody: "Paródia",
  Psychological: "Psicológico",
  School: "Escolar",
  Space: "Espaço",
  Vampire: "Vampiros",
  Work: "Trabalho",
};

const HIDDEN_GENRES = new Set(["Hentai", "Erotica", "Ecchi", "Adult"]);

const STATUS_PT = {
  "Finished Airing": "Finalizado",
  "Currently Airing": "Em exibição",
  "Not yet aired": "Em breve",
  Finished: "Finalizado",
  Publishing: "Em publicação",
  "On Hiatus": "Em hiato",
  Discontinued: "Cancelado",
  "Not yet published": "Em breve",
};

export const STATUS_OPTIONS = {
  anime: [
    ["", "Todos"],
    ["airing", "Em exibição"],
    ["complete", "Finalizado"],
    ["upcoming", "Em breve"],
  ],
  manga: [
    ["", "Todos"],
    ["publishing", "Em publicação"],
    ["complete", "Finalizado"],
  ],
};

export const FALLBACK_GENRES = [
  ["1", "Ação"],
  ["2", "Aventura"],
  ["4", "Comédia"],
  ["8", "Drama"],
  ["10", "Fantasia"],
  ["14", "Horror"],
  ["7", "Mistério"],
  ["22", "Romance"],
  ["24", "Ficção científica"],
  ["36", "Cotidiano"],
  ["30", "Esportes"],
  ["37", "Sobrenatural"],
  ["41", "Suspense"],
].map(([id, name]) => ({ id, name }));

export function translateGenre(name) {
  return GENRE_PT[name] || name;
}

export function visibleGenres(list) {
  return (list || []).filter((genre) => genre?.name && !HIDDEN_GENRES.has(genre.name));
}

export function translateStatus(status) {
  if (!status) return "Não informado";
  return STATUS_PT[status] || status;
}

export function scoreLabel(score) {
  if (score == null || Number.isNaN(Number(score))) return "Sem nota";
  const formatted = Number(score).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Nota ${formatted}`;
}

export function countLabel(item, type) {
  if (type === "manga") {
    if (item.chapters == null) return "Capítulos não informados";
    return item.chapters === 1 ? "1 capítulo" : `${item.chapters} capítulos`;
  }
  if (item.episodes == null) return "Episódios não informados";
  return item.episodes === 1 ? "1 episódio" : `${item.episodes} episódios`;
}

export function yearOf(item, type) {
  if (type === "anime") {
    return item.year || item.aired?.prop?.from?.year || null;
  }
  return item.published?.prop?.from?.year || null;
}

export function coverUrl(item) {
  const jpg = item.images?.jpg || {};
  const webp = item.images?.webp || {};
  return jpg.large_image_url || jpg.image_url || webp.large_image_url || webp.image_url || "";
}

export function trailerUrl(item) {
  const trailer = item.trailer;
  if (!trailer) return "";
  if (typeof trailer.url === "string" && trailer.url.trim()) return trailer.url.trim();
  if (trailer.youtube_id) return `https://www.youtube.com/watch?v=${trailer.youtube_id}`;
  return "";
}

export function genreNames(item) {
  const names = visibleGenres(item.genres).map((genre) => translateGenre(genre.name));
  return names.length ? names.join(", ") : "Não informado";
}

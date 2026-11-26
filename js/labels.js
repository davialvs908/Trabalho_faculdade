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

const SEASON_PT = {
  winter: "Inverno",
  spring: "Primavera",
  summer: "Verão",
  fall: "Outono",
};

const TYPE_PT = {
  TV: "Série",
  Movie: "Filme",
  OVA: "OVA",
  ONA: "ONA",
  Special: "Especial",
  Music: "Música",
  Manga: "Mangá",
  Novel: "Novel",
  "Light Novel": "Light novel",
  "One-shot": "One-shot",
  Doujinshi: "Doujinshi",
  Manhwa: "Manhwa",
  Manhua: "Manhua",
};

const RATING_PT = {
  "G - All Ages": "Livre",
  "PG - Children": "Infantil",
  "PG-13 - Teens 13 or older": "13 anos",
  "R - 17+ (violence & profanity)": "17 anos",
  "R+ - Mild Nudity": "17 anos, nudez leve",
  "Rx - Hentai": "Adulto",
};

const SOURCE_PT = {
  Original: "Original",
  Manga: "Mangá",
  "Light novel": "Light novel",
  "4-koma manga": "Mangá 4-koma",
  Novel: "Novel",
  "Visual novel": "Visual novel",
  Game: "Jogo",
  "Web manga": "Web mangá",
  Other: "Outra",
  "Picture book": "Livro ilustrado",
  "Mixed media": "Mídia mista",
  "Card game": "Jogo de cartas",
  Book: "Livro",
  Radio: "Rádio",
  Music: "Música",
};

const DEMOGRAPHIC_PT = {
  Shounen: "Shounen",
  Shoujo: "Shoujo",
  Seinen: "Seinen",
  Josei: "Josei",
  Kids: "Infantil",
};

const AUTHOR_ROLE_PT = {
  "Story & Art": "Roteiro e arte",
  Story: "Roteiro",
  Art: "Arte",
};

export function personName(name) {
  const text = (name || "").trim();
  const comma = text.indexOf(",");
  if (comma <= 0 || comma !== text.lastIndexOf(",")) return text;
  const family = text.slice(0, comma).trim();
  const given = text.slice(comma + 1).trim();
  if (!family || !given) return text;
  return `${given} ${family}`;
}

export function formatCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Math.round(number).toLocaleString("pt-BR");
}

export function formatPlace(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return "";
  return `${number.toLocaleString("pt-BR")}º`;
}

export function formatCalendarDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatPeriod(range) {
  const from = formatCalendarDate(range?.from);
  const to = formatCalendarDate(range?.to);
  if (from && to) return `${from} a ${to}`;
  if (from) return `desde ${from}`;
  if (to) return `até ${to}`;
  return "";
}

export function seasonLabel(item) {
  const season = SEASON_PT[String(item?.season || "").toLowerCase()];
  const year = item?.year || item?.aired?.prop?.from?.year || null;
  if (season && year) return `${season} de ${year}`;
  if (year) return String(year);
  return season || "";
}

export function translateType(value) {
  if (!value) return "";
  return TYPE_PT[value] || value;
}

export function translateRating(value) {
  if (!value) return "";
  return RATING_PT[value] || value;
}

export function translateSource(value) {
  if (!value) return "";
  return SOURCE_PT[value] || value;
}

export function translateDuration(value) {
  if (!value || /^unknown$/i.test(value)) return "";
  return value.replace(/(\d+)\s*hr\b/gi, "$1 h").replace(/\bper ep\b/gi, "por episódio");
}

export function namedList(entries) {
  return (entries || [])
    .map((entry) => (typeof entry?.name === "string" ? entry.name.trim() : ""))
    .filter(Boolean);
}

export function demographicNames(item) {
  return namedList(item?.demographics).map((name) => DEMOGRAPHIC_PT[name] || name);
}

const THEME_PT = {
  "Martial Arts": "Artes marciais",
  "Super Power": "Superpoder",
  School: "Escola",
  "Love Polygon": "Triângulo amoroso",
  "Time Travel": "Viagem no tempo",
  "Organized Crime": "Crime organizado",
  "Adult Cast": "Elenco adulto",
  "Combat Sports": "Esporte de combate",
  "Team Sports": "Esporte coletivo",
  Reincarnation: "Reencarnação",
  "Video Game": "Videogame",
  Survival: "Sobrevivência",
  "Performing Arts": "Artes cênicas",
  "Visual Arts": "Artes visuais",
  "Strategy Game": "Jogo de estratégia",
  "High Stakes Game": "Jogo de alto risco",
  "Idols (Female)": "Idols femininas",
  "Idols (Male)": "Idols masculinos",
  Racing: "Corrida",
  "Romantic Subtext": "Subtexto romântico",
  Detective: "Detetive",
  "Gag Humor": "Humor pastelão",
  Historical: "Histórico",
  Medical: "Medicina",
  Military: "Militar",
  Music: "Música",
  Mythology: "Mitologia",
  Parody: "Paródia",
  Psychological: "Psicológico",
  Vampire: "Vampiros",
  Mecha: "Mecha",
  Isekai: "Isekai",
  Space: "Espaço",
};

export function themeNames(item) {
  return namedList(item?.themes).map((name) => THEME_PT[name] || name);
}

export function authorLines(item) {
  return (item?.authors || [])
    .map((author) => {
      const name = personName(author?.name);
      if (!name) return "";
      const role = AUTHOR_ROLE_PT[author.role] || author.role;
      return role ? `${name} (${role})` : name;
    })
    .filter(Boolean);
}

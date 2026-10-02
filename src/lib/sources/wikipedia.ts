import { getJson, type SourceDef } from "./common";

export interface WikipediaData {
  article: string | null;
  monthly: { month: string; views: number }[];
  change12: number | null;
}

export const wikipedia: SourceDef<WikipediaData> = {
  id: "wikipedia",
  label: "Wikipedia (intérêt pour la catégorie)",
  modes: ["ecommerce", "occasion"],
  browser: false,
  timeoutMs: 20_000,
  async run({ keywords }) {
    const topic = keywords.category || keywords.short;
    const s = await getJson<{ query: { search: { title: string }[] } }>(
      `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=5`,
    );
    // L'article doit partager au moins un mot significatif avec le sujet (sinon : hors sujet, ex. « Kitesurf »)
    const words = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const topicWords = new Set(words(topic));
    const article = s.query.search.map((x) => x.title).find((t) => words(t).some((w) => topicWords.has(w))) ?? null;
    if (!article) return { data: { article: null, monthly: [], change12: null }, urls: [], empty: true };
    const end = new Date();
    const start = new Date(end.getFullYear() - 2, end.getMonth(), 1);
    const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}01`;
    const pv = await getJson<{ items: { timestamp: string; views: number }[] }>(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia/all-access/user/${encodeURIComponent(article.replace(/ /g, "_"))}/monthly/${fmt(start)}/${fmt(end)}`,
      { "user-agent": "product-scout/1.0 (outil local d'analyse produit)" },
    );
    const monthly = pv.items.map((i) => ({ month: `${i.timestamp.slice(0, 4)}-${i.timestamp.slice(4, 6)}`, views: i.views }));
    const last = monthly.slice(-12).reduce((s, x) => s + x.views, 0);
    const prev = monthly.slice(-24, -12).reduce((s, x) => s + x.views, 0);
    return {
      data: { article, monthly, change12: prev > 0 ? Math.round(((last - prev) / prev) * 100) : null },
      urls: [`https://fr.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g, "_"))}`],
      empty: monthly.length === 0,
    };
  },
};

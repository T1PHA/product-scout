import { getContext } from "../browser";
import { analyzeTrend, type TrendAnalysis } from "../stats";
import type { SourceDef } from "./common";

export interface TrendsData {
  keyword: string;
  points: { date: string; value: number }[];
  analysis: TrendAnalysis;
  related: { top: string[]; rising: string[] };
}

const strip = (t: string) => JSON.parse(t.replace(/^\)\]\}',?\n?/, ""));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ouvre la vraie page « Explorer » de Google Trends et récupère les données que la page charge elle-même.
 * Plus fiable que d'appeler l'API directement (Google limite fortement les appels hors page : 429).
 */
export const trends: SourceDef<TrendsData> = {
  id: "trends",
  label: "Google Trends (France, 5 ans)",
  modes: ["ecommerce", "occasion"],
  browser: true,
  timeoutMs: 120_000,
  async run({ keywords }) {
    const keyword = keywords.short;
    const url = `https://trends.google.com/trends/explore?geo=FR&date=today%205-y&q=${encodeURIComponent(keyword)}&hl=fr`;
    const ctx = await getContext();
    const page = await ctx.newPage();
    let multiline: string | null = null;
    let related: string | null = null;
    let lastStatus = 0;
    page.on("response", async (res) => {
      const u = res.url();
      if (!/\/trends\/api\/widgetdata\/(multiline|relatedsearches)/.test(u)) return;
      lastStatus = res.status();
      if (!res.ok()) return;
      const body = await res.text().catch(() => "");
      if (u.includes("/multiline")) multiline ??= body;
      else if (!related) related = body; // premier bloc « requêtes associées »
    });
    try {
      for (let attempt = 0; attempt < 3 && !multiline; attempt++) {
        if (attempt) await sleep(6000 * attempt);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => {});
        for (let i = 0; i < 25 && !multiline; i++) await sleep(1000);
      }
      if (multiline) for (let i = 0; i < 6 && !related; i++) await sleep(1000);
    } finally {
      await page.close().catch(() => {});
    }
    if (!multiline) throw new Error(`Google Trends n'a pas renvoyé de courbe${lastStatus ? ` (HTTP ${lastStatus})` : ""}`);

    const timeline = strip(multiline).default.timelineData as { time: string; value: number[] }[];
    const points = timeline.map((t) => ({ date: new Date(parseInt(t.time, 10) * 1000).toISOString().slice(0, 10), value: t.value[0] ?? 0 }));
    let rel = { top: [] as string[], rising: [] as string[] };
    if (related) {
      try {
        const lists = strip(related).default.rankedList as { rankedKeyword: { query?: string; topic?: { title: string } }[] }[];
        const name = (k: { query?: string; topic?: { title: string } }) => k.query ?? k.topic?.title ?? "";
        rel = { top: (lists[0]?.rankedKeyword ?? []).slice(0, 10).map(name).filter(Boolean), rising: (lists[1]?.rankedKeyword ?? []).slice(0, 10).map(name).filter(Boolean) };
      } catch {
        /* facultatif */
      }
    }
    const nonZero = points.filter((p) => p.value > 0).length;
    return {
      data: { keyword, points, analysis: analyzeTrend(points), related: rel },
      urls: [url],
      empty: points.length === 0 || nonZero < 5,
    };
  },
};

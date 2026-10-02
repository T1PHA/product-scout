import { withPage } from "../browser";
import type { SourceDef } from "./common";

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchData {
  queries: { query: string; results: WebResult[] }[];
}

/** Recherche dans le navigateur de l'outil (les appels HTTP directs sont limités ou faussés par DuckDuckGo et Bing). */
async function ddg(query: string): Promise<WebResult[]> {
  return withPage(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&kl=fr-fr`,
    (p) =>
      p.evaluate(() =>
        Array.from(document.querySelectorAll("article[data-testid=result]"))
          .slice(0, 8)
          .map((a) => ({
            title: (a.querySelector("h2") as HTMLElement | null)?.innerText ?? "",
            url: (a.querySelector("a[data-testid=result-title-a]") as HTMLAnchorElement | null)?.href ?? "",
            snippet: (a.querySelector("[data-result=snippet]") as HTMLElement | null)?.innerText ?? "",
          }))
          .filter((r) => r.url),
      ),
    { wait: 2500 },
  );
}

async function bing(query: string): Promise<WebResult[]> {
  const raw = await withPage(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=fr&cc=FR`,
    (p) =>
      p.evaluate(() =>
        Array.from(document.querySelectorAll("li.b_algo"))
          .slice(0, 8)
          .map((li) => ({
            title: (li.querySelector("h2") as HTMLElement | null)?.innerText ?? "",
            url: (li.querySelector("h2 a") as HTMLAnchorElement | null)?.href ?? "",
            snippet: (li.querySelector(".b_caption p, p") as HTMLElement | null)?.innerText ?? "",
          })),
      ),
    { wait: 2500 },
  );
  return raw.map((r) => {
    const u = r.url.match(/[?&]u=a1([^&]+)/)?.[1];
    let url = r.url;
    if (u) {
      try {
        url = Buffer.from(u.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      } catch {
        /* lien Bing conservé */
      }
    }
    return { ...r, url };
  });
}

async function search(query: string): Promise<WebResult[]> {
  const r = await ddg(query).catch(() => [] as WebResult[]);
  return r.length ? r : bing(query).catch(() => []);
}

export const websearch: SourceDef<WebSearchData> = {
  id: "websearch",
  label: "Recherche web (avis, douleurs, concurrents)",
  modes: ["ecommerce", "occasion"],
  browser: true,
  timeoutMs: 75_000,
  async run({ keywords, inputs }) {
    const qs =
      inputs.mode === "ecommerce"
        ? [`${keywords.fr} avis`, `${keywords.fr} problème inconvénient`, `meilleur ${keywords.fr} boutique`]
        : [`${keywords.fr} cote prix occasion`, `revendre ${keywords.fr}`, `${keywords.fr} reconnaître faux authentique`];
    const queries: WebSearchData["queries"] = [];
    for (const q of qs) queries.push({ query: q, results: await search(q) });
    return {
      data: { queries },
      urls: qs.map((q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`),
      empty: queries.every((q) => !q.results.length),
    };
  },
};

import { withPage } from "../browser";
import { median, parsePrice, quantile, round, trimOutliers } from "../stats";
import type { SourceDef } from "./common";

export interface VintedItem {
  title: string;
  brand: string | null;
  condition: string | null;
  price: number | null;
  favourites: number | null;
  url: string;
}

export interface VintedData {
  query: string;
  items: VintedItem[];
  count: number;
  medianPrice: number | null;
  p25: number | null;
  p75: number | null;
  topBrands: { brand: string; count: number }[];
  conditions: { condition: string; count: number }[];
  avgFavourites: number | null;
}

export const vinted: SourceDef<VintedData> = {
  id: "vinted",
  label: "Vinted (annonces et prix)",
  modes: ["ecommerce", "occasion"],
  browser: true,
  timeoutMs: 70_000,
  async run({ keywords }) {
    const query = keywords.fr;
    const url = `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(query)}&order=relevance`;
    const raw = await withPage(
      url,
      async (p) => {
        await p.mouse.wheel(0, 3000);
        await p.waitForTimeout(1500);
        return p.evaluate(() => {
          const seen = new Set<string>();
          const out: { title: string; href: string; card: string }[] = [];
          for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/items/"][title]'))) {
            const href = a.getAttribute("href")!.split("?")[0];
            if (seen.has(href)) continue;
            seen.add(href);
            const card = (a.closest('[data-testid*="grid-item"]') ?? a.parentElement)?.textContent ?? "";
            out.push({ title: a.getAttribute("title") ?? "", href, card });
          }
          return out.slice(0, 96);
        });
      },
      { wait: 3500 },
    );
    const items: VintedItem[] = raw.map((r) => {
      const parts = r.title.split(/,\s(?=[A-ZÉ][\wé ]+:|\d+[.,]\d{2}\s?€)/);
      const get = (k: string) => parts.find((x) => x.startsWith(`${k}:`))?.slice(k.length + 1).trim() ?? null;
      const price = parsePrice(r.title.match(/(\d+[.,]\d{2})\s?€/)?.[1]);
      const fav = r.card.match(/(?:^|\D)(\d{1,4})\s*$/)?.[1];
      return {
        title: parts[0]?.slice(0, 140) ?? r.title,
        brand: get("Marque"),
        condition: get("État"),
        price,
        favourites: fav ? parseInt(fav, 10) : null,
        url: `https://www.vinted.fr${r.href}`,
      };
    });
    const prices = trimOutliers(items.map((i) => i.price).filter((x): x is number => x != null));
    const tally = (xs: (string | null)[]) => {
      const m = new Map<string, number>();
      for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const favs = items.map((i) => i.favourites).filter((x): x is number => x != null);
    return {
      data: {
        query,
        items,
        count: items.length,
        medianPrice: round(median(prices)),
        p25: round(quantile(prices, 0.25)),
        p75: round(quantile(prices, 0.75)),
        topBrands: tally(items.map((i) => i.brand)).slice(0, 8).map(([brand, count]) => ({ brand, count })),
        conditions: tally(items.map((i) => i.condition)).map(([condition, count]) => ({ condition, count })),
        avgFavourites: favs.length ? round(favs.reduce((s, x) => s + x, 0) / favs.length, 1) : null,
      },
      urls: [url],
      empty: items.length === 0,
    };
  },
};

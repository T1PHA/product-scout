import { withPage } from "../browser";
import { median, parseCount, parsePrice, round, trimOutliers } from "../stats";
import type { SourceDef } from "./common";

export interface AliItem {
  title: string;
  price: number | null;
  sold: number | null;
  rating: number | null;
  url: string;
}

export interface AliData {
  query: string;
  items: AliItem[];
  medianPrice: number | null;
  lowPrice: number | null;
  totalSold: number;
  topSold: number | null;
}

export const aliexpress: SourceDef<AliData> = {
  id: "aliexpress",
  label: "AliExpress (prix fournisseur)",
  modes: ["ecommerce"],
  browser: true,
  timeoutMs: 80_000,
  async run({ keywords }) {
    const query = keywords.fr;
    const slug = query.trim().replace(/\s+/g, "-");
    const url = `https://fr.aliexpress.com/w/wholesale-${encodeURIComponent(slug)}.html`;
    const raw = await withPage(
      url,
      async (p) => {
        for (let i = 0; i < 3; i++) {
          await p.mouse.wheel(0, 2500);
          await p.waitForTimeout(1200);
        }
        return p.evaluate(() => {
          const seen = new Set<string>();
          const out: { text: string; href: string }[] = [];
          for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/item/"]'))) {
            const id = a.href.match(/item\/(\d+)/)?.[1];
            if (!id || seen.has(id)) continue;
            const text = a.innerText.replace(/\s+/g, " ").trim();
            if (text.length < 20) continue;
            seen.add(id);
            out.push({ text, href: `https://fr.aliexpress.com/item/${id}.html` });
          }
          return out.slice(0, 40);
        });
      },
      { wait: 6000 },
    );
    const items: AliItem[] = raw.map(({ text, href }) => {
      const priceStr = text.match(/(\d+[.,]\d{2})\s?€/)?.[1] ?? null;
      const soldStr = text.match(/\+?\s?([\d\s .,]+k?)\s*vendus?/i)?.[1] ?? null;
      const rating = text.match(/\b([1-5][.,]\d)\b(?=\s)/)?.[1];
      const iPrice = priceStr ? text.indexOf(priceStr) : -1;
      return {
        title: (iPrice > 0 ? text.slice(0, iPrice) : text).trim().slice(0, 160),
        price: parsePrice(priceStr),
        sold: parseCount(soldStr),
        rating: rating ? parseFloat(rating.replace(",", ".")) : null,
        url: href,
      };
    });
    const prices = trimOutliers(items.map((i) => i.price).filter((x): x is number => x != null));
    const sold = items.map((i) => i.sold ?? 0);
    return {
      data: {
        query,
        items,
        medianPrice: round(median(prices)),
        lowPrice: prices.length ? Math.min(...prices) : null,
        totalSold: sold.reduce((s, x) => s + x, 0),
        topSold: sold.length ? Math.max(...sold) : null,
      },
      urls: [url],
      empty: items.length === 0,
    };
  },
};

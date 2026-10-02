import { withPage } from "../browser";
import { median, parseCount, parsePrice, round, trimOutliers } from "../stats";
import type { SourceDef } from "./common";

export interface EbayItem {
  title: string;
  price: number | null;
  condition: string | null;
  soldDate?: string | null;
}

export interface EbayData {
  query: string;
  activeCount: number | null;
  activeItems: EbayItem[];
  activeMedian: number | null;
  soldAvailable: boolean;
  soldCount: number | null;
  soldItems: EbayItem[];
  soldMedian: number | null;
  sellThrough: number | null; // vendus (90 j) / annonces actives
}

type RawItem = { text: string; title: string; price: string | null };

async function scrape(url: string) {
  return withPage(
    url,
    (p) =>
      p.evaluate(() => {
        const title = document.title;
        const count = document.querySelector(".srp-controls__count-heading")?.textContent ?? null;
        const items = Array.from(document.querySelectorAll("li.s-item, li.s-card")).map((li) => {
          const el = li as HTMLElement;
          return {
            text: el.innerText.replace(/\s+/g, " "),
            title: (li.querySelector(".s-item__title, .s-card__title")?.textContent ?? "").trim(),
            price: li.querySelector(".s-item__price, .s-card__price")?.textContent ?? null,
          };
        });
        return { title, count, items };
      }),
    { wait: 2500 },
  );
}

function toItems(raw: RawItem[]): EbayItem[] {
  return raw
    .filter((r) => r.title && !/^Shop on eBay|^Achetez sur eBay/i.test(r.title))
    .slice(0, 60)
    .map((r) => ({
      title: r.title.replace(/La page s'ouvre.*$/i, "").trim().slice(0, 160),
      price: parsePrice(r.price),
      condition: r.text.match(/\b(Neuf|Occasion|Reconditionné|Pièces détachées)\b/)?.[1] ?? null,
      soldDate: r.text.match(/Vendu le\s+([^|]+?\d{4})/)?.[1]?.trim() ?? null,
    }));
}

export const ebay: SourceDef<EbayData> = {
  id: "ebay",
  label: "eBay.fr (annonces + ventes conclues)",
  modes: ["ecommerce", "occasion"],
  browser: true,
  timeoutMs: 90_000,
  async run({ keywords, inputs }) {
    const query = keywords.fr;
    const cond = inputs.mode === "occasion" ? "&LH_ItemCondition=3000" : "";
    const activeUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(query)}${cond}`;
    const soldUrl = `${activeUrl}&LH_Sold=1&LH_Complete=1`;

    const active = await scrape(activeUrl);
    const activeItems = toItems(active.items);
    const sold = await scrape(soldUrl);
    const soldAvailable = !/Se connecter|Sign in/i.test(sold.title);
    const soldItems = soldAvailable ? toItems(sold.items) : [];
    const activeCount = parseCount(active.count);
    const soldCount = soldAvailable ? parseCount(sold.count) : null;
    const ap = trimOutliers(activeItems.map((i) => i.price).filter((x): x is number => x != null));
    const sp = trimOutliers(soldItems.map((i) => i.price).filter((x): x is number => x != null));
    return {
      data: {
        query,
        activeCount,
        activeItems,
        activeMedian: round(median(ap)),
        soldAvailable,
        soldCount,
        soldItems,
        soldMedian: round(median(sp)),
        sellThrough: soldCount != null && activeCount ? round(soldCount / activeCount, 2) : null,
      },
      urls: soldAvailable ? [activeUrl, soldUrl] : [activeUrl],
      empty: !activeItems.length && !soldItems.length,
    };
  },
};

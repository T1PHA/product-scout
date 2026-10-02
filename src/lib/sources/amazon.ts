import { withPage } from "../browser";
import { median, parseCount, parsePrice, round, trimOutliers } from "../stats";
import type { SourceDef } from "./common";

export interface AmazonItem {
  title: string;
  price: number | null;
  rating: number | null;
  reviews: number | null;
  boughtLastMonth: number | null;
  sponsored: boolean;
  url: string | null;
}

export interface AmazonData {
  query: string;
  items: AmazonItem[];
  medianPrice: number | null;
  p25: number | null;
  p75: number | null;
  totalReviews: number;
  boughtLastMonthSum: number;
  itemsWithBoughtBadge: number;
  sponsoredShare: number;
}

export const amazon: SourceDef<AmazonData> = {
  id: "amazon",
  label: "Amazon.fr (prix, avis, ventes du mois)",
  modes: ["ecommerce", "occasion"],
  browser: true,
  timeoutMs: 70_000,
  async run({ keywords }) {
    const query = keywords.fr;
    const url = `https://www.amazon.fr/s?k=${encodeURIComponent(query)}`;
    const raw = await withPage(
      url,
      (p) =>
        p.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('[data-component-type="s-search-result"]'));
          return cards.slice(0, 48).map((c) => {
            const t = (c as HTMLElement).innerText;
            const title = c.querySelector("h2")?.textContent?.trim() ?? "";
            const price = c.querySelector(".a-price .a-offscreen")?.textContent ?? null;
            const ratingLabel = c.querySelector('[aria-label*="sur 5"]')?.getAttribute("aria-label") ?? null;
            const reviewsEl = c.querySelector('a[href*="customerReviews"] span, [aria-label$="évaluations"], [aria-label$="notes"]');
            const reviews = reviewsEl?.getAttribute("aria-label") ?? reviewsEl?.textContent ?? null;
            const bought = t.match(/([\d\s .,]+\s?k?\+?)\s*achetés?\s+(?:au cours du|le) mois dernier/i)?.[1] ?? null;
            const href = c.querySelector("h2 a, a.a-link-normal[href*='/dp/']")?.getAttribute("href") ?? null;
            return { asin: c.getAttribute("data-asin") ?? title, title, price, ratingLabel, reviews, bought, sponsored: /Sponsorisé/.test(t), href };
          });
        }),
      { wait: 2500 },
    );
    if (!raw.length) throw new Error("Amazon n'a renvoyé aucun résultat (captcha probable)");
    // Un même produit apparaît souvent deux fois (sponsorisé + organique)
    const seen = new Set<string>();
    const unique = raw.filter((r) => (seen.has(r.asin) ? false : (seen.add(r.asin), true)));
    const items: AmazonItem[] = unique.map((r) => ({
      title: r.title.slice(0, 160),
      price: parsePrice(r.price),
      rating: r.ratingLabel ? parseFloat(r.ratingLabel.replace(",", ".")) : null,
      reviews: parseCount(r.reviews),
      boughtLastMonth: parseCount(r.bought),
      sponsored: r.sponsored,
      url: r.asin && /^[A-Z0-9]{10}$/.test(r.asin) ? `https://www.amazon.fr/dp/${r.asin}` : r.href ? `https://www.amazon.fr${r.href.split("?")[0]}` : null,
    }));
    const prices = trimOutliers(items.map((i) => i.price).filter((x): x is number => x != null));
    const sorted = [...prices].sort((a, b) => a - b);
    return {
      data: {
        query,
        items,
        medianPrice: round(median(prices)),
        p25: sorted.length ? sorted[Math.floor(sorted.length * 0.25)] : null,
        p75: sorted.length ? sorted[Math.floor(sorted.length * 0.75)] : null,
        totalReviews: items.reduce((s, i) => s + (i.reviews ?? 0), 0),
        boughtLastMonthSum: items.reduce((s, i) => s + (i.boughtLastMonth ?? 0), 0),
        itemsWithBoughtBadge: items.filter((i) => i.boughtLastMonth).length,
        sponsoredShare: round(items.filter((i) => i.sponsored).length / items.length, 2) ?? 0,
      },
      urls: [url],
    };
  },
};

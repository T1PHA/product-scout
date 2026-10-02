import { withPage } from "../browser";
import { median, parsePrice, round } from "../stats";
import type { SourceDef } from "./common";

export interface AlibabaData {
  query: string;
  offers: { title: string; priceLow: number | null; priceHigh: number | null; moq: string | null }[];
  medianLow: number | null;
  currency: string;
}

const PRICE_RE = /^\s*(?:US\s?\$|\$)?\s?(\d+(?:[.,]\d+)?)(?:\s?-\s?(?:US\s?\$|\$)?\s?(\d+(?:[.,]\d+)?))?\s?(€)?\s*$/;

export const alibaba: SourceDef<AlibabaData> = {
  id: "alibaba",
  label: "Alibaba (prix de gros, MOQ)",
  modes: ["ecommerce"],
  browser: true,
  timeoutMs: 70_000,
  async run({ keywords }) {
    const query = keywords.en;
    const url = `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(query)}`;
    const cards = await withPage(
      url,
      async (p) => {
        await p.mouse.wheel(0, 2500);
        await p.waitForTimeout(1500);
        return p.evaluate(() => {
          const priceLike = /^\s*(US\s?\$|\$)?\s?\d+([.,]\d+)?(\s?-\s?(US\s?\$|\$)?\s?\d+([.,]\d+)?)?\s?€?\s*$/;
          const seen = new Set<Element>();
          const out: { price: string; text: string }[] = [];
          for (const el of Array.from(document.querySelectorAll("body *"))) {
            if (el.children.length) continue;
            const t = el.textContent ?? "";
            if (!/[€$]/.test(t) || !priceLike.test(t)) continue;
            // Remonte jusqu'à la carte produit (bloc qui contient aussi un titre)
            let card: HTMLElement | null = el.parentElement;
            while (card && card.innerText.length < 60) card = card.parentElement;
            if (!card || seen.has(card) || card.innerText.length > 2000) continue;
            seen.add(card);
            out.push({ price: t.trim(), text: card.innerText });
            if (out.length >= 40) break;
          }
          return out;
        });
      },
      { wait: 5000 },
    );
    let currency = "USD";
    const offers: AlibabaData["offers"] = [];
    for (const c of cards) {
      const m = c.price.match(PRICE_RE);
      if (!m) continue;
      if (m[3] || c.price.includes("€")) currency = "EUR";
      const lines = c.text.split("\n").map((l) => l.trim()).filter(Boolean);
      const title = lines.filter((l) => !/[€$]/.test(l) && l.length > 20).sort((a, b) => b.length - a.length)[0] ?? "";
      const moq = lines.find((l) => /min\.?\s?(order|commande)|commande min|\bMOQ\b|pi[eè]ces?\b|pieces?\b|unités?/i.test(l) && /\d/.test(l)) ?? null;
      offers.push({ title: title.slice(0, 140), priceLow: parsePrice(m[1]), priceHigh: parsePrice(m[2] ?? m[1]), moq });
    }
    return {
      data: { query, offers, medianLow: round(median(offers.map((o) => o.priceLow).filter((x): x is number => x != null))), currency },
      urls: [url],
      empty: offers.length === 0,
    };
  },
};

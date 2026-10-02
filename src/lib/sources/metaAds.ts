import { withPage } from "../browser";
import { daysSince, parseFrDate, type SourceDef } from "./common";

export interface MetaAd {
  advertiser: string;
  startDate: string | null;
  days: number | null;
  domain: string | null;
  text: string;
  variants: number | null;
}

export interface MetaAdsData {
  query: string;
  total: number | null;
  totalLabel: string | null;
  ads: MetaAd[];
  longRunning: number; // pubs actives depuis 30 jours et plus
  veryLongRunning: number; // 90 jours et plus
  advertisers: number;
  topDomains: { domain: string; count: number }[];
}

export const metaAds: SourceDef<MetaAdsData> = {
  id: "metaAds",
  label: "Meta Ad Library (pubs actives FR)",
  modes: ["ecommerce"],
  browser: true,
  timeoutMs: 90_000,
  async run({ keywords }) {
    const query = keywords.fr;
    const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=FR&q=${encodeURIComponent(query)}&search_type=keyword_unordered&media_type=all`;
    const text = await withPage(
      url,
      async (p) => {
        for (let i = 0; i < 4; i++) {
          await p.mouse.wheel(0, 3000);
          await p.waitForTimeout(1500);
        }
        return p.evaluate(() => document.body.innerText);
      },
      { wait: 8000 },
    );
    const totalMatch = text.match(/((?:plus de\s*|~\s*)?[\d  \s.,]+(?:\s?k)?)\s*résultats?/i);
    let total: number | null = null;
    if (totalMatch) {
      const n = totalMatch[1].replace(/plus de|~/gi, "").replace(/[\s  .]/g, "").replace(",", ".");
      total = /k$/i.test(n) ? Math.round(parseFloat(n) * 1000) : parseInt(n, 10);
      if (!Number.isFinite(total)) total = null;
    }
    if (/aucun résultat|(?:^|\s)0 résultat/i.test(text)) total = 0;

    const blocks = text.split(/ID dans la bibliothèque\s*:/).slice(1);
    const ads: MetaAd[] = blocks.slice(0, 40).map((b) => {
      const start = b.match(/Début de diffusion le ([^\n]+)/)?.[1] ?? null;
      const d = start ? parseFrDate(start) : null;
      const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
      const iDetails = lines.findIndex((l) => /Voir les détails de la publicité|Voir le résumé/.test(l));
      const advertiser = iDetails >= 0 ? lines[iDetails + 1] ?? "" : "";
      const iSpons = lines.findIndex((l) => l === "Sponsorisé");
      const body = iSpons >= 0 ? lines.slice(iSpons + 1, iSpons + 4).join(" ") : "";
      const domain = lines.find((l) => /^[A-Z0-9][A-Z0-9.-]+\.[A-Z]{2,}$/.test(l)) ?? null;
      const variants = b.match(/(\d+)\s+publicités? utilisent ce contenu/)?.[1];
      return {
        advertiser,
        startDate: d ? d.toISOString().slice(0, 10) : null,
        days: d ? daysSince(d) : null,
        domain: domain ? domain.toLowerCase() : null,
        text: body.slice(0, 300),
        variants: variants ? parseInt(variants, 10) : null,
      };
    });
    const domainCount = new Map<string, number>();
    for (const a of ads) if (a.domain) domainCount.set(a.domain, (domainCount.get(a.domain) ?? 0) + 1);
    return {
      data: {
        query,
        total,
        totalLabel: totalMatch?.[0]?.trim() ?? null,
        ads,
        longRunning: ads.filter((a) => (a.days ?? 0) >= 30).length,
        veryLongRunning: ads.filter((a) => (a.days ?? 0) >= 90).length,
        advertisers: new Set(ads.map((a) => a.advertiser).filter(Boolean)).size,
        topDomains: [...domainCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([domain, count]) => ({ domain, count })),
      },
      urls: [url],
      empty: total === 0 || (total == null && ads.length === 0),
    };
  },
};

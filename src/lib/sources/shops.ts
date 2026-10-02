import { median, quantile, round } from "../stats";
import { UA, type SourceDef } from "./common";
import type { MetaAdsData } from "./metaAds";

export interface ShopProduct {
  shop: string;
  title: string;
  price: number;
  compareAt: number | null;
  url: string;
}

export interface ShopsData {
  checked: string[];
  shopify: string[];
  products: ShopProduct[];
  medianPrice: number | null;
  p25: number | null;
  p75: number | null;
  discountShare: number | null; // part des produits affichés avec un prix barré
}

const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const words = (x: string) => norm(x).split(/[^a-z0-9]+/).filter((w) => w.length > 3);

interface ShopifyJson {
  products: { title: string; handle: string; variants: { price: string; compare_at_price: string | null }[] }[];
}

async function fetchShop(domain: string, kw: Set<string>): Promise<ShopProduct[] | null> {
  const host = domain.replace(/^www\./, "");
  for (const base of [`https://${host}`, `https://www.${host}`]) {
    try {
      const ctrl = AbortSignal.timeout(12_000);
      const r = await fetch(`${base}/products.json?limit=250`, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctrl });
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) continue;
      const j = (await r.json()) as ShopifyJson;
      if (!Array.isArray(j.products)) continue;
      const all = j.products
        .map((p) => {
          const v = p.variants?.[0];
          const price = v ? parseFloat(v.price) : NaN;
          const cmp = v?.compare_at_price ? parseFloat(v.compare_at_price) : null;
          return { shop: host, title: p.title, price, compareAt: cmp && cmp > price ? cmp : null, url: `${base}/products/${p.handle}` };
        })
        .filter((p) => Number.isFinite(p.price) && p.price > 0);
      // Produits qui correspondent à la recherche ; sinon la boutique est mono-produit, on garde les 3 premiers
      // On garde les produits qui partagent le plus de mots avec la recherche (« chien » seul ne suffit pas)
      const scored = all.map((p) => ({ p, n: words(p.title).filter((w) => kw.has(w)).length }));
      const best = Math.max(0, ...scored.map((x) => x.n));
      if (best === 0 || (kw.size >= 2 && best < 2)) return all.length <= 3 ? all : null; // boutique hors sujet, sauf mono-produit
      const threshold = Math.max(1, Math.ceil(best * 0.6));
      return scored.filter((x) => x.n >= threshold).map((x) => x.p).slice(0, 10);
    } catch {
      /* domaine suivant */
    }
  }
  return null;
}

export const shops: SourceDef<ShopsData> = {
  id: "shops",
  label: "Boutiques concurrentes (prix pratiqués)",
  modes: ["ecommerce"],
  browser: false,
  timeoutMs: 60_000,
  after: ["metaAds"],
  async run({ keywords, previous }) {
    const meta = previous?.metaAds?.status === "ok" ? (previous.metaAds.data as MetaAdsData) : null;
    if (!meta) throw new Error("Pas de boutiques à analyser (Meta Ad Library indisponible)");
    const domains = [...new Set(meta.topDomains.map((d) => d.domain).concat(meta.ads.map((a) => a.domain ?? "")).filter(Boolean))].slice(0, 10);
    const kw = new Set([...words(keywords.fr), ...words(keywords.en)]);
    const results = await Promise.all(domains.map(async (d) => [d, await fetchShop(d, kw)] as const));
    const shopify = results.filter(([, p]) => p).map(([d]) => d);
    const products = results.flatMap(([, p]) => p ?? []);
    // Un prix par boutique (médiane de ses produits correspondants) pour ne pas sur-pondérer les gros catalogues
    const perShop = shopify.map((d) => median(products.filter((p) => p.shop === d.replace(/^www\./, "")).map((p) => p.price))).filter((x): x is number => x != null);
    return {
      data: {
        checked: domains,
        shopify,
        products,
        medianPrice: round(median(perShop)),
        p25: round(quantile(perShop, 0.25)),
        p75: round(quantile(perShop, 0.75)),
        discountShare: products.length ? round(products.filter((p) => p.compareAt).length / products.length, 2) : null,
      },
      urls: shopify.map((d) => `https://${d.replace(/^www\./, "")}`),
      empty: products.length === 0,
    };
  },
};

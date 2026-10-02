import { getJson, type SourceDef } from "./common";

export interface FeeRule {
  platform: string;
  pct: number; // % du prix de vente
  fixed: number; // € par vente
  note: string;
}

// Barèmes FR pour vendeur pro (oct. 2026), recoupés lors de l'étude Tests Produits. À vérifier dans chaque interface.
export const FR_FEES: Record<string, FeeRule> = {
  shopify: { platform: "Boutique Shopify (paiement CB UE)", pct: 1.5, fixed: 0.25, note: "Shopify Payments, cartes européennes, forfait Basic" },
  ebay: { platform: "eBay pro", pct: 11, fixed: 0.35, note: "9 % maison/jouets/musique à 12 % mode/montres + 0,35 € par commande" },
  vinted: { platform: "Vinted Pro", pct: 5, fixed: 0.3, note: "Sources contradictoires (0 % ou 5 % + 0,30 €) : hypothèse prudente" },
  amazon: { platform: "Amazon.fr", pct: 15, fixed: 0, note: "Commission de référence la plus courante (8 à 15 % selon catégorie)" },
  selency: { platform: "Selency pro", pct: 13, fixed: 0, note: "Environ 12-15 % HT" },
  etsy: { platform: "Etsy", pct: 10.5, fixed: 0.2, note: "6,5 % transaction + ~4 % paiement + 0,20 € de mise en ligne" },
  leboncoin: { platform: "Leboncoin (main propre)", pct: 0, fixed: 0, note: "Gratuit en remise en main propre" },
};

export interface FxFeesData {
  rates: { USD: number; CNY: number; date: string }; // 1 unité -> EUR
  fees: FeeRule[];
  reference: { platform: string; summary: string; lastReviewed: string }[];
  attribution: string;
}

interface SellersCalc {
  platform: string;
  lastReviewed: string;
  fees: { label: string; type: string; value: number; payer: string }[];
}

export const fxfees: SourceDef<FxFeesData> = {
  id: "fxfees",
  label: "Taux de change + frais plateformes",
  modes: ["ecommerce", "occasion"],
  browser: false,
  timeoutMs: 20_000,
  async run() {
    const fx = await getJson<{ date: string; rates: { EUR: number } }>("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
    const cny = await getJson<{ rates: { EUR: number } }>("https://api.frankfurter.dev/v1/latest?base=CNY&symbols=EUR");
    const reference: FxFeesData["reference"] = [];
    for (const id of ["etsy", "tiktok-shop", "vinted", "ebay"]) {
      try {
        const j = await getJson<SellersCalc>(`https://www.sellerscalc.com/data/fees/${id}.json`);
        reference.push({
          platform: j.platform,
          summary: j.fees.filter((f) => f.payer === "seller").map((f) => `${f.label} ${f.value}${f.type === "percent" ? " %" : " $"}`).join(", ") || "aucun frais vendeur",
          lastReviewed: j.lastReviewed,
        });
      } catch {
        /* référence facultative */
      }
    }
    return {
      data: {
        rates: { USD: fx.rates.EUR, CNY: cny.rates.EUR, date: fx.date },
        fees: Object.values(FR_FEES),
        reference,
        attribution: "Taux : Frankfurter (BCE). Barèmes US de référence : SellersCalc (CC BY 4.0).",
      },
      urls: ["https://www.frankfurter.dev", "https://www.sellerscalc.com/data"],
    };
  },
};

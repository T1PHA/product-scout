import type { AiReport, AnalysisInputs, Criterion, MarginBreakdown, Rating, Report, SourceResult, Verdict } from "../types";
import type { AmazonData, EbayData, MetaAdsData, ShopsData, TrendsData, VintedData, YoutubeData } from "../sources";

const RATING_VALUE: Record<Rating, number | null> = { ok: 1, moyen: 0.5, not_ok: 0, na: null };

function ok<T>(s: SourceResult | undefined): T | undefined {
  return s && s.status === "ok" ? (s.data as T) : undefined;
}

const fmt = (n: number | null | undefined, unit = "") => (n == null ? "?" : `${Math.round(n * 100) / 100}${unit}`);

// Critères jugés par l'IA (définitions envoyées à Gemini)
export const JUDGED_ECOMMERCE: Record<string, { label: string; question: string; weight: number }> = {
  understand3s: { label: "Compris en 3 secondes", question: "Le bénéfice principal se comprend-il en 3 secondes ?", weight: 7 },
  demo: { label: "Démontrable en vidéo", question: "Facile à montrer en vidéo, avec un effet visuel ou un avant/après ?", weight: 8 },
  logistics: { label: "Logistique simple", question: "Léger, peu encombrant, non fragile, peu de retours ?", weight: 8 },
  range: { label: "Potentiel de gamme", question: "Peut-on ajouter des produits complémentaires et bâtir une marque ?", weight: 5 },
  angle: { label: "Angle libre", question: "Existe-t-il un angle ou une audience que les concurrents n'exploitent pas ?", weight: 7 },
};

export const JUDGED_OCCASION: Record<string, { label: string; question: string; weight: number }> = {
  supply: { label: "Approvisionnement", question: "Peut-on en trouver souvent et très peu cher (vide-greniers, Emmaüs, lots) ?", weight: 10 },
  liquidity: { label: "Liquidité", question: "Ça part en 3 jours ou en 4 mois ?", weight: 10 },
  work: { label: "Travail", question: "Combien de temps pour acheter, préparer et vendre une pièce ?", weight: 8 },
  logistics: { label: "Logistique", question: "Ça tient dans une enveloppe ou ça nécessite un camion ?", weight: 8 },
  expertise: { label: "Expertise", question: "Peut-on apprendre rapidement à reconnaître une affaire ?", weight: 7 },
  scalability: { label: "Scalabilité", question: "Peut-on en acheter 100 d'un coup ?", weight: 7 },
  b2b: { label: "Sortie B2B", question: "Un professionnel peut-il reprendre tout le stock ?", weight: 8 },
};

function judged(ai: AiReport | null, id: string, def: { label: string; question: string; weight: number }, extra = ""): Criterion {
  const j = ai?.judged?.[id];
  return {
    id,
    label: def.label,
    question: def.question,
    rating: j?.rating ?? "na",
    detail: j ? `${j.detail}${extra ? ` ${extra}` : ""}` : `Non évalué (analyse IA indisponible).${extra ? ` ${extra}` : ""}`,
    source: "Analyse IA (Gemini) sur les données collectées",
    weight: def.weight,
  };
}

function trendCriterion(trends: TrendsData | undefined, weight: number): Criterion {
  const base = { id: "trend", label: "Tendance", question: "L'intérêt monte, stagne ou baisse ? (Google Trends FR)", weight, source: "Google Trends" };
  if (!trends) return { ...base, rating: "na", detail: "Pas de données Google Trends (volume trop faible ou source bloquée)." };
  const a = trends.analysis;
  let rating: Rating = a.direction === "hausse" ? "ok" : a.direction === "baisse" ? "not_ok" : "moyen";
  let detail = `12 derniers mois vs 12 précédents : ${a.change12 != null ? `${a.change12 > 0 ? "+" : ""}${a.change12} %` : "?"} (${a.direction}). Intérêt moyen ${a.avg12}/100.`;
  if (a.seasonality >= 0.35 && a.peakMonth) detail += ` Saisonnier : pic en ${a.peakMonth}.`;
  if (a.avg5y < 3) {
    rating = rating === "ok" ? "moyen" : rating;
    detail += " Volume de recherche très faible.";
  }
  return { ...base, rating, detail };
}

export function buildCriteria(
  inputs: AnalysisInputs,
  sources: Record<string, SourceResult>,
  margin: MarginBreakdown,
  ai: AiReport | null,
): Criterion[] {
  const trends = ok<TrendsData>(sources.trends);
  const meta = ok<MetaAdsData>(sources.metaAds);
  const amazon = ok<AmazonData>(sources.amazon);
  const ebay = ok<EbayData>(sources.ebay);
  const vinted = ok<VintedData>(sources.vinted);
  const yt = ok<YoutubeData>(sources.youtube);
  const shops = ok<ShopsData>(sources.shops);
  const out: Criterion[] = [];

  if (inputs.mode === "ecommerce") {
    const banned = ai?.banned;
    out.push({
      id: "banned",
      label: "Produit à bannir (éliminatoire)",
      question: "Marque/licence, peau ou ingestion, lourd/fragile, électronique complexe ?",
      rating: banned ? (banned.flagged ? "not_ok" : "ok") : "na",
      detail: banned ? (banned.flagged ? banned.reasons.join(" ; ") : "Aucun motif d'exclusion détecté.") : "Non évalué (analyse IA indisponible).",
      source: "Analyse IA + règles de la méthode",
      weight: 0,
      eliminatory: true,
    });

    const p = margin.sellPrice;
    out.push({
      id: "price",
      label: "Prix de vente ≥ 40 €",
      question: "Le panier moyen atteint-il 40 € ?",
      rating: p == null ? "na" : p >= 40 ? "ok" : p >= 25 ? "moyen" : "not_ok",
      detail: p == null ? "Prix de vente inconnu." : `${fmt(p, " €")} (${margin.sellPriceSource}).${p < 40 ? " Possible de remonter le panier avec un pack ou un lot." : ""}`,
      source: margin.sellPriceSource,
      weight: 10,
    });

    const n = margin.net;
    out.push({
      id: "margin",
      label: "Marge nette ≥ 25 €",
      question: "Reste-t-il 25 à 30 € après achat, livraison, frais et pub ?",
      rating: n == null ? "na" : n >= 25 ? "ok" : n >= 12 ? "moyen" : "not_ok",
      detail:
        n == null
          ? "Impossible à calculer (prix d'achat ou de vente manquant)."
          : `${fmt(n, " €")} nets = ${fmt(margin.sellPrice, " €")} − achat ${fmt(margin.buyPrice, " €")} − livraison ${fmt(margin.shipping, " €")} − frais ${fmt(margin.fees, " €")} − pub ${fmt(margin.adCost, " €")}.`,
      source: `${margin.buyPriceSource} / ${margin.sellPriceSource}`,
      weight: 20,
    });

    const signals: string[] = [];
    let demandPts = 0;
    if (meta?.total != null) {
      signals.push(`${meta.total} pubs Meta actives`);
      demandPts += meta.total >= 50 ? 2 : meta.total >= 5 ? 1 : 0;
    }
    if (amazon) {
      signals.push(`${amazon.totalReviews} avis cumulés sur Amazon`);
      if (amazon.boughtLastMonthSum) signals.push(`≥ ${amazon.boughtLastMonthSum} achats le mois dernier (badges Amazon)`);
      demandPts += amazon.boughtLastMonthSum >= 500 || amazon.totalReviews >= 5000 ? 2 : amazon.totalReviews >= 500 ? 1 : 0;
    }
    if (ebay?.activeCount != null) signals.push(`${ebay.activeCount} annonces eBay`);
    if (shops?.shopify.length) signals.push(`${shops.shopify.length} boutiques Shopify concurrentes (prix médian ${shops.medianPrice} €)`);
    out.push({
      id: "demand",
      label: "Demande prouvée",
      question: "Des concurrents vendent-ils déjà (preuve qu'un marché existe) ?",
      rating: !signals.length ? "na" : demandPts >= 3 ? "ok" : demandPts >= 1 ? "moyen" : "not_ok",
      detail: signals.length ? `${signals.join(", ")}.` : "Aucune source de demande disponible.",
      source: "Meta Ad Library, Amazon.fr, eBay",
      weight: 15,
    });

    out.push({
      id: "proven",
      label: "Rentabilité prouvée (pubs longues)",
      question: "Des pubs tournent-elles depuis plus de 30 jours ?",
      rating: !meta ? "na" : meta.longRunning >= 3 ? "ok" : meta.longRunning >= 1 ? "moyen" : "not_ok",
      detail: meta
        ? `${meta.longRunning} pubs actives depuis 30 jours ou plus (dont ${meta.veryLongRunning} depuis 90 jours ou plus) sur ${meta.ads.length} analysées, ${meta.advertisers} annonceurs différents.`
        : "Meta Ad Library indisponible.",
      source: "Meta Ad Library",
      weight: 10,
    });

    out.push(trendCriterion(trends, 10));

    for (const [id, def] of Object.entries(JUDGED_ECOMMERCE)) {
      let extra = "";
      if (id === "demo" && yt) extra = `(${yt.videos.length} vidéos YouTube trouvées, médiane ${fmt(yt.medianViews)} vues.)`;
      if (id === "angle" && meta?.total != null) extra = `(${meta.total} pubs actives : ${meta.total > 1000 ? "marché saturé, l'angle fera la différence" : "concurrence gérable"}.)`;
      out.push(judged(ai, id, def, extra));
    }
  } else {
    // Mode occasion : grille Tests Produits
    out.push(judged(ai, "supply", JUDGED_OCCASION.supply));

    const sig: string[] = [];
    let pts = 0;
    if (vinted) {
      sig.push(`${vinted.count} annonces Vinted sur la 1re page${vinted.avgFavourites != null ? ` (moy. ${vinted.avgFavourites} favoris)` : ""}`);
      pts += vinted.count >= 48 ? 1 : 0;
    }
    if (ebay) {
      sig.push(`${ebay.activeCount ?? "?"} annonces eBay`);
      pts += (ebay.activeCount ?? 0) >= 100 ? 1 : 0;
      if (ebay.soldAvailable && ebay.soldCount != null) {
        sig.push(`${ebay.soldCount} ventes conclues eBay (90 j)`);
        pts += ebay.soldCount >= 50 ? 2 : ebay.soldCount >= 10 ? 1 : 0;
      }
    }
    if (trends) {
      sig.push(`tendance ${trends.analysis.direction}`);
      pts += trends.analysis.direction === "hausse" ? 1 : trends.analysis.direction === "baisse" ? -1 : 0;
    }
    out.push({
      id: "demand",
      label: "Demande",
      question: "Est-ce que ça se vend régulièrement ?",
      rating: !sig.length ? "na" : pts >= 2 ? "ok" : pts >= 1 ? "moyen" : "not_ok",
      detail: sig.length ? `${sig.join(", ")}.` : "Aucune donnée de demande.",
      source: "Vinted, eBay, Google Trends",
      weight: 15,
    });

    const mult = margin.multiple;
    out.push({
      id: "margin",
      label: "Marge",
      question: "Peut-on raisonnablement faire +30/50/100 % ?",
      rating: mult == null ? "na" : mult >= 2 ? "ok" : mult >= 1.4 ? "moyen" : "not_ok",
      detail:
        mult == null
          ? "Prix d'achat ou de revente inconnu."
          : `Revente ${fmt(margin.sellPrice, " €")} pour un achat ${fmt(margin.buyPrice, " €")} : x${mult} (${margin.marginPct ?? "?"} % de marge nette). ${margin.buyPriceSource}.`,
      source: `${margin.sellPriceSource} / ${margin.buyPriceSource}`,
      weight: 15,
    });

    const n = margin.net;
    out.push({
      id: "basket",
      label: "Panier",
      question: "20 € de marge ou 300 € ?",
      rating: n == null ? "na" : n >= 50 ? "ok" : n >= 15 ? "moyen" : "not_ok",
      detail: n == null ? "Marge en € inconnue." : `${fmt(n, " €")} nets par vente après frais (${margin.feesLabel}).`,
      source: margin.sellPriceSource,
      weight: 12,
    });

    const liq = judged(ai, "liquidity", JUDGED_OCCASION.liquidity);
    if (ebay?.sellThrough != null) {
      const st = ebay.sellThrough;
      liq.rating = st >= 0.6 ? "ok" : st >= 0.25 ? "moyen" : "not_ok";
      liq.detail = `Taux d'écoulement eBay : ${Math.round(st * 100)} % (ventes conclues / annonces actives). ${ai?.judged?.liquidity?.detail ?? ""}`.trim();
      liq.source = "eBay ventes conclues";
    }
    out.push(liq);
    for (const id of ["work", "logistics", "expertise", "scalability", "b2b"]) out.push(judged(ai, id, JUDGED_OCCASION[id]));
  }
  return out;
}

export function scoreCriteria(criteria: Criterion[]): number {
  let num = 0;
  let den = 0;
  for (const c of criteria) {
    const v = RATING_VALUE[c.rating];
    if (v == null || c.weight === 0) continue;
    num += v * c.weight;
    den += c.weight;
  }
  return den ? Math.round((num / den) * 100) : 0;
}

export function computeConfidence(
  sources: Record<string, SourceResult>,
  criteria: Criterion[],
  hasAi: boolean,
): { confidence: Report["confidence"]; detail: string } {
  const all = Object.values(sources);
  const okCount = all.filter((s) => s.status === "ok").length;
  const rated = criteria.filter((c) => c.rating !== "na" && c.weight > 0).length;
  const total = criteria.filter((c) => c.weight > 0).length;
  const ratio = (okCount / Math.max(all.length, 1)) * 0.5 + (rated / Math.max(total, 1)) * 0.5;
  let confidence: Report["confidence"] = ratio >= 0.75 ? "elevee" : ratio >= 0.5 ? "moyenne" : "faible";
  if (!hasAi && confidence === "elevee") confidence = "moyenne";
  return {
    confidence,
    detail: `${okCount}/${all.length} sources ont répondu, ${rated}/${total} critères évalués${hasAi ? "" : ", sans analyse IA"}.`,
  };
}

export function decideVerdict(score: number, criteria: Criterion[], confidence: Report["confidence"]): Verdict {
  if (criteria.some((c) => c.eliminatory && c.rating === "not_ok")) return "abandonner";
  // Trop peu de critères évalués : on ne condamne pas un produit faute de données
  const weighted = criteria.filter((c) => c.weight > 0);
  const ratedWeight = weighted.filter((c) => c.rating !== "na").reduce((s, c) => s + c.weight, 0);
  const totalWeight = weighted.reduce((s, c) => s + c.weight, 0);
  if (totalWeight && ratedWeight / totalWeight < 0.5) return "creuser";
  // Critère non négociable de la méthode : pas de test sans une marge « Ok »
  const marginOk = criteria.find((c) => c.id === "margin")?.rating === "ok";
  if (score >= 70 && marginOk && confidence !== "faible") return "tester";
  if (score >= 50) return "creuser";
  return "abandonner";
}

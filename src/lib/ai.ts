import { geminiJson, hasGemini } from "./gemini";
import type { AiReport, AnalysisInputs, Keywords, MarginBreakdown, SourceResult } from "./types";
import { JUDGED_ECOMMERCE, JUDGED_OCCASION } from "./scoring/criteria";
import type { AliData, AlibabaData, AmazonData, EbayData, MetaAdsData, ShopsData, TrendsData, VintedData, WebSearchData, WikipediaData, YoutubeData } from "./sources";

export async function translateFallback(text: string): Promise<string> {
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fr|en`);
    const j = (await r.json()) as { responseData?: { translatedText?: string } };
    return j.responseData?.translatedText || text;
  } catch {
    return text;
  }
}

export async function buildKeywords(inputs: AnalysisInputs): Promise<Keywords> {
  const product = inputs.product.trim();
  if (hasGemini()) {
    try {
      const k = await geminiJson<Keywords>(
        `Tu prépares des recherches de marché pour ce produit : "${product}" (mode : ${inputs.mode === "ecommerce" ? "e-commerce produit neuf" : "achat-revente d'occasion"}).
Renvoie un JSON {"fr": string, "en": string, "short": string, "category": string} :
- fr : la requête de recherche française la plus utilisée par les acheteurs (2 à 5 mots, sans marque si le produit n'en a pas)
- en : la même requête en anglais, telle qu'on la taperait sur Alibaba
- short : 1 à 3 mots, le terme que les gens tapent sur Google (pour Google Trends)
- category : le nom de la catégorie générale en français, tel qu'un titre d'article Wikipédia (ex. "Harnais (équitation)" non, plutôt "Harnais pour chien" ou "Appareil photographique argentique")`,
        { temperature: 0.2 },
      );
      if (k.fr && k.en) return { fr: k.fr, en: k.en, short: k.short || k.fr, category: k.category || k.fr };
    } catch {
      /* on retombe sur la traduction gratuite */
    }
  }
  const en = await translateFallback(product);
  return { fr: product, en, short: product.split(/\s+/).slice(0, 3).join(" "), category: product };
}

function ok<T>(s: SourceResult | undefined): T | undefined {
  return s && s.status === "ok" ? (s.data as T) : undefined;
}

/** Résumé compact des données pour le prompt (on n'envoie pas tout le brut). */
export function digest(sources: Record<string, SourceResult>): string {
  const lines: string[] = [];
  const t = ok<TrendsData>(sources.trends);
  if (t) {
    const a = t.analysis;
    lines.push(`GOOGLE TRENDS FR (5 ans, "${t.keyword}") : moyenne 12 mois ${a.avg12}/100, variation vs année précédente ${a.change12 ?? "?"} %, direction ${a.direction}, saisonnalité ${a.seasonality}${a.peakMonth ? `, pic en ${a.peakMonth}` : ""}. Requêtes associées : ${t.related.top.join(", ") || "-"} ; en hausse : ${t.related.rising.join(", ") || "-"}.`);
  }
  const m = ok<MetaAdsData>(sources.metaAds);
  if (m) {
    lines.push(`META AD LIBRARY FR : ${m.totalLabel ?? m.total} pubs actives. ${m.longRunning} pubs >30 j, ${m.veryLongRunning} >90 j sur ${m.ads.length} analysées. Domaines : ${m.topDomains.map((d) => d.domain).join(", ") || "-"}.`);
    for (const ad of m.ads.slice(0, 12)) lines.push(`  - [${ad.days ?? "?"} j] ${ad.advertiser} (${ad.domain ?? "?"}) : ${ad.text.slice(0, 220)}`);
  }
  const sh = ok<ShopsData>(sources.shops);
  if (sh) {
    lines.push(`BOUTIQUES QUI FONT DE LA PUB (Shopify) : ${sh.shopify.join(", ")}. Prix médian ${sh.medianPrice} € (P25 ${sh.p25}, P75 ${sh.p75}), ${Math.round((sh.discountShare ?? 0) * 100)} % avec prix barré.`);
    for (const p of sh.products.slice(0, 10)) lines.push(`  - ${p.shop} : ${p.price} €${p.compareAt ? ` (barré ${p.compareAt} €)` : ""} | ${p.title.slice(0, 90)}`);
  }
  const ali = ok<AliData>(sources.aliexpress);
  if (ali) {
    lines.push(`ALIEXPRESS : prix médian ${ali.medianPrice} €, plus bas ${ali.lowPrice} €, ventes cumulées affichées ${ali.totalSold}.`);
    for (const i of ali.items.slice(0, 8)) lines.push(`  - ${i.price} € | ${i.sold ?? "?"} vendus | ${i.title.slice(0, 110)}`);
  }
  const ab = ok<AlibabaData>(sources.alibaba);
  if (ab) lines.push(`ALIBABA : prix bas médian ${ab.medianLow} ${ab.currency}. MOQ exemples : ${ab.offers.slice(0, 5).map((o) => o.moq).filter(Boolean).join(" / ") || "-"}.`);
  const az = ok<AmazonData>(sources.amazon);
  if (az) {
    lines.push(`AMAZON.FR : prix médian ${az.medianPrice} € (P25 ${az.p25}, P75 ${az.p75}), ${az.totalReviews} avis cumulés, ≥${az.boughtLastMonthSum} achats le mois dernier sur ${az.itemsWithBoughtBadge} fiches, ${Math.round(az.sponsoredShare * 100)} % de résultats sponsorisés.`);
    for (const i of az.items.slice(0, 10)) lines.push(`  - ${i.price ?? "?"} € | ${i.rating ?? "?"}★ (${i.reviews ?? 0} avis) | ${i.boughtLastMonth ? `${i.boughtLastMonth}+ achetés/mois | ` : ""}${i.title.slice(0, 110)}`);
  }
  const eb = ok<EbayData>(sources.ebay);
  if (eb) {
    lines.push(`EBAY.FR : ${eb.activeCount ?? "?"} annonces, médiane ${eb.activeMedian} €. Ventes conclues : ${eb.soldAvailable ? `${eb.soldCount} vendus, médiane ${eb.soldMedian} €, écoulement ${eb.sellThrough}` : "indisponibles (connexion eBay requise)"}.`);
    for (const i of (eb.soldItems.length ? eb.soldItems : eb.activeItems).slice(0, 8)) lines.push(`  - ${i.price ?? "?"} € | ${i.condition ?? ""} | ${i.title.slice(0, 100)}`);
  }
  const v = ok<VintedData>(sources.vinted);
  if (v) {
    lines.push(`VINTED : ${v.count} annonces 1re page, médiane ${v.medianPrice} € (P25 ${v.p25}, P75 ${v.p75}), marques : ${v.topBrands.map((b) => `${b.brand} (${b.count})`).join(", ") || "-"}, états : ${v.conditions.map((c) => `${c.condition} (${c.count})`).join(", ")}.`);
  }
  const yt = ok<YoutubeData>(sources.youtube);
  if (yt) {
    lines.push(`YOUTUBE : ${yt.videos.length} vidéos, médiane ${yt.medianViews} vues, ${yt.shorts} shorts.`);
    for (const x of yt.videos.slice(0, 6)) lines.push(`  - ${x.views ?? "?"} vues | ${x.title}`);
  }
  const w = ok<WebSearchData>(sources.websearch);
  if (w) {
    for (const q of w.queries) {
      lines.push(`WEB "${q.query}" :`);
      for (const r of q.results.slice(0, 5)) lines.push(`  - ${r.title} — ${r.snippet.slice(0, 200)}`);
    }
  }
  const wk = ok<WikipediaData>(sources.wikipedia);
  if (wk?.article) lines.push(`WIKIPEDIA "${wk.article}" : variation des vues sur 12 mois ${wk.change12 ?? "?"} %.`);
  const failed = Object.values(sources).filter((s) => s.status !== "ok").map((s) => `${s.label} (${s.status}${s.error ? ` : ${s.error.slice(0, 80)}` : ""})`);
  if (failed.length) lines.push(`SOURCES MANQUANTES : ${failed.join(" ; ")}`);
  return lines.join("\n");
}

const METHOD = `MÉTHODE (Nath Debaque, « produit gagnant 2026 ») :
- Le succès = bon produit + bonne offre + message adapté (angle, cible, présentation). Aucun produit magique.
- Le client achète avec l'émotion, rationalise ensuite. Vendre la transformation, pas le produit.
- 8 leviers : Douleur (le plus puissant), Désir, Peur/aversion à la perte, Statut & identité, Sécurité, Paresse & confort, Nouveauté, et l'effet miroir (décrire la situation exacte du client).
- Accroche émotionnelle dans les 2-3 premières secondes.
- Critères : bénéfice compris en 3 s, demande prouvée (des concurrents vendent), panier ≥ 40 €, marge nette ≥ 25-30 € après pub, démontrable en vidéo, logistique simple, potentiel de gamme.
- À bannir : marques/licences, produits pour la peau ou ingérés, lourd/volumineux/fragile, électronique complexe.
- Ce n'est pas le produit qui est saturé, c'est l'angle : chercher une audience inexploitée. Mécanisme unique = le « pourquoi ça marche ».
- Test organique : TikTok/Reels, hook 0-3 s + démonstration + CTA, 5 vidéos/jour pendant 3 semaines (~100 vidéos) avant de conclure.`;

const METHOD_OCCASION = `MÉTHODE ACHAT-REVENTE D'OCCASION (France) :
- Sourcing : vide-greniers, Emmaüs, ressourceries, successions, lots Leboncoin, enchères (Interenchères).
- Revente : Vinted, eBay, Leboncoin, Selency, Etsy, site propre, marchés. L'équipe dispose d'un studio photo (avantage sur les catégories où la présentation fait le prix).
- Légal : registre des revendeurs d'objets mobiliers + livre de police, micro-entreprise BIC, comptes pro, DAC7, garantie légale pour un pro, risque de recel (tech, outillage), contrefaçons.`;

export async function buildAiReport(
  inputs: AnalysisInputs,
  keywords: Keywords,
  sources: Record<string, SourceResult>,
  margin: MarginBreakdown,
): Promise<AiReport> {
  const judgedDefs = inputs.mode === "ecommerce" ? JUDGED_ECOMMERCE : JUDGED_OCCASION;
  const judgedSpec = Object.entries(judgedDefs)
    .map(([id, d]) => `    "${id}": {"rating": "ok"|"moyen"|"not_ok", "detail": string}  // ${d.label} : ${d.question}`)
    .join(",\n");
  const prompt = `Tu es un analyste e-commerce et achat-revente francais, exigeant et honnete. Tu évalues la viabilité de ce produit pour deux indépendants basés dans l'Hérault qui veulent savoir s'il vaut la peine d'y consacrer du temps de test.

PRODUIT : "${inputs.product}" (requête : ${keywords.fr} / ${keywords.en})
MODE : ${inputs.mode === "ecommerce" ? "E-COMMERCE produit neuf (fournisseur Chine, boutique + pubs Meta/TikTok)" : "ACHAT-REVENTE D'OCCASION (chine locale, revente plateformes)"}
${inputs.notes ? `NOTES DE L'UTILISATEUR : ${inputs.notes}\n` : ""}
${inputs.mode === "ecommerce" ? METHOD : METHOD_OCCASION}

MARGE CALCULÉE : vente ${margin.sellPrice ?? "?"} € (${margin.sellPriceSource}), achat ${margin.buyPrice ?? "?"} € (${margin.buyPriceSource}), livraison ${margin.shipping} €, frais ${margin.fees} € (${margin.feesLabel}), pub ${margin.adCost} € => net ${margin.net ?? "?"} €.

DONNÉES COLLECTÉES AUJOURD'HUI :
${digest(sources)}

RÈGLES :
- Écris en français, phrases courtes, sans emoji ni tiret cadratin.
- N'invente aucun chiffre : cite uniquement ceux des données ci-dessus. Si une donnée manque, dis-le.
- Sois franc : si le produit est mauvais, dis-le clairement.
- Les détails de critères tiennent en 1 à 2 phrases et s'appuient sur les données.

Renvoie UNIQUEMENT ce JSON :
{
  "summary": string,            // 3 phrases : ce que disent les données, l'opportunité, le risque principal
  "verdictReason": string,      // 1 phrase : pourquoi tester ou non
  "judged": {
${judgedSpec}
  },
  "banned": {"flagged": boolean, "reasons": string[]},   // motifs d'exclusion de la méthode (marque/licence, peau/ingestion, lourd/fragile, électronique complexe, contrefaçon). flagged=false si aucun
  "psychology": {
    "mainLever": string,        // un des 8 leviers + pourquoi
    "secondaryLevers": string[],
    "pain": string,             // la douleur ou le problème concret
    "transformation": string,   // ce que le client achète vraiment
    "mirrorPhrases": string[],  // 3 phrases effet miroir, très concrètes ("Tu ...")
    "uniqueMechanism": string   // mécanisme unique possible
  },
  "angles": [{"name": string, "audience": string, "message": string, "untapped": boolean}],   // 3 à 5 angles ; untapped=true si les pubs/annonces observées ne l'utilisent pas
  "hooks": string[],            // 5 accroches vidéo pour les 3 premières secondes
  "range": string[],            // 3 à 6 produits complémentaires pour une gamme
  "risks": string[],            // risques business et légaux concrets
  "testPlan": {"budget": string, "steps": string[], "continueIf": string, "stopIf": string},
  "sourcing": string[],         // où acheter concrètement (fournisseurs, lieux de chine, mots-clés)
  "buyPriceEstimate": number|null   // mode occasion uniquement : prix d'achat typique en chine en €, sinon null
}`;
  return geminiJson<AiReport>(prompt, { temperature: 0.5 });
}

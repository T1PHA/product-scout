import type { AnalysisInputs, MarginBreakdown, SourceResult } from "../types";
import type { AliData, AlibabaData, AmazonData, EbayData, FxFeesData, ShopsData, VintedData } from "../sources";
import { FR_FEES } from "../sources/fxfees";
import { median, round } from "../stats";

export interface MarginDefaults {
  adCost: number;
  shipping: number;
}

function ok<T>(s: SourceResult | undefined): T | undefined {
  return s && s.status === "ok" ? (s.data as T) : undefined;
}

export function computeMargin(
  inputs: AnalysisInputs,
  sources: Record<string, SourceResult>,
  defaults: MarginDefaults,
  aiBuyEstimate?: number | null,
): MarginBreakdown {
  const amazon = ok<AmazonData>(sources.amazon);
  const ebay = ok<EbayData>(sources.ebay);
  const vinted = ok<VintedData>(sources.vinted);
  const ali = ok<AliData>(sources.aliexpress);
  const alibaba = ok<AlibabaData>(sources.alibaba);
  const fx = ok<FxFeesData>(sources.fxfees);
  const shops = ok<ShopsData>(sources.shops);

  let sellPrice: number | null = null;
  let sellPriceSource = "inconnu";
  let buyPrice: number | null = null;
  let buyPriceSource = "inconnu";
  let shipping: number;
  let fee = FR_FEES.shopify;
  let adCost = 0;

  if (inputs.mode === "ecommerce") {
    if (inputs.sellPrice) [sellPrice, sellPriceSource] = [inputs.sellPrice, "prix visé saisi"];
    else if (shops?.medianPrice) [sellPrice, sellPriceSource] = [shops.medianPrice, `prix médian de ${shops.shopify.length} boutiques qui font de la pub`];
    else if (amazon?.medianPrice) [sellPrice, sellPriceSource] = [amazon.medianPrice, "prix médian Amazon.fr"];
    else if (ebay?.activeMedian) [sellPrice, sellPriceSource] = [ebay.activeMedian, "prix médian eBay"];

    if (inputs.buyPrice) [buyPrice, buyPriceSource] = [inputs.buyPrice, "prix d'achat saisi"];
    else if (ali?.medianPrice) [buyPrice, buyPriceSource] = [ali.medianPrice, "prix médian AliExpress (à l'unité)"];
    else if (alibaba?.medianLow) {
      const rate = alibaba.currency === "EUR" ? 1 : fx?.rates.USD ?? 0.86;
      [buyPrice, buyPriceSource] = [round(alibaba.medianLow * rate), "prix bas médian Alibaba (gros)"];
    }
    shipping = inputs.shippingCost ?? defaults.shipping;
    adCost = inputs.adCost ?? defaults.adCost;
  } else {
    fee = FR_FEES.vinted;
    if (inputs.sellPrice) [sellPrice, sellPriceSource] = [inputs.sellPrice, "prix visé saisi"];
    else if (ebay?.soldMedian) [sellPrice, sellPriceSource] = [ebay.soldMedian, "prix médian vendu eBay"];
    else {
      const candidates = [vinted?.medianPrice, ebay?.activeMedian].filter((x): x is number => x != null);
      if (candidates.length) [sellPrice, sellPriceSource] = [round(median(candidates)), "médiane des prix demandés Vinted/eBay"];
    }
    if (inputs.buyPrice) [buyPrice, buyPriceSource] = [inputs.buyPrice, "prix d'achat saisi"];
    else if (aiBuyEstimate) [buyPrice, buyPriceSource] = [aiBuyEstimate, "estimation IA du prix en chine (à vérifier)"];
    shipping = inputs.shippingCost ?? 0; // sur Vinted l'acheteur paie le port
  }

  const fees = sellPrice != null ? round((sellPrice * fee.pct) / 100 + fee.fixed) ?? 0 : 0;
  const net = sellPrice != null && buyPrice != null ? round(sellPrice - buyPrice - shipping - fees - adCost) : null;
  return {
    sellPrice,
    sellPriceSource,
    buyPrice,
    buyPriceSource,
    shipping,
    fees,
    feesLabel: `${fee.platform} : ${fee.pct} % + ${fee.fixed} €`,
    adCost,
    net,
    marginPct: net != null && sellPrice ? round((net / sellPrice) * 100, 0) : null,
    multiple: sellPrice && buyPrice ? round(sellPrice / buyPrice, 1) : null,
  };
}

import type { Mode } from "../types";
import type { SourceDef } from "./common";
import { trends } from "./trends";
import { metaAds } from "./metaAds";
import { aliexpress } from "./aliexpress";
import { alibaba } from "./alibaba";
import { amazon } from "./amazon";
import { ebay } from "./ebay";
import { vinted } from "./vinted";
import { youtube } from "./youtube";
import { websearch } from "./websearch";
import { fxfees } from "./fxfees";
import { wikipedia } from "./wikipedia";
import { shops } from "./shops";

export const ALL_SOURCES: SourceDef[] = [
  fxfees,
  trends,
  metaAds,
  shops,
  aliexpress,
  alibaba,
  amazon,
  ebay,
  vinted,
  youtube,
  websearch,
  wikipedia,
] as SourceDef[];

export function sourcesFor(mode: Mode): SourceDef[] {
  return ALL_SOURCES.filter((s) => s.modes.includes(mode));
}

export type { TrendsData } from "./trends";
export type { MetaAdsData } from "./metaAds";
export type { AliData } from "./aliexpress";
export type { AlibabaData } from "./alibaba";
export type { AmazonData } from "./amazon";
export type { EbayData } from "./ebay";
export type { VintedData } from "./vinted";
export type { YoutubeData } from "./youtube";
export type { WebSearchData } from "./websearch";
export type { FxFeesData } from "./fxfees";
export type { WikipediaData } from "./wikipedia";
export type { ShopsData } from "./shops";

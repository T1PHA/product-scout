import type { AnalysisInputs, Keywords, Mode, SourceResult } from "../types";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

export interface SourceCtx {
  inputs: AnalysisInputs;
  keywords: Keywords;
  previous?: Record<string, SourceResult>; // résultats déjà collectés (sources dépendantes)
}

export interface SourceOutput<T> {
  data: T;
  urls: string[];
  empty?: boolean;
}

export interface SourceDef<T = unknown> {
  id: string;
  label: string;
  modes: Mode[];
  browser: boolean; // utilise le navigateur partagé
  timeoutMs: number;
  after?: string[]; // ids des sources à attendre avant de lancer celle-ci
  run: (ctx: SourceCtx) => Promise<SourceOutput<T>>;
}

export async function getText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "fr-FR,fr;q=0.9", ...headers } });
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${new URL(url).hostname}`);
  return r.text();
}

export async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  return JSON.parse(await getText(url, headers)) as T;
}

const MONTHS_FR: Record<string, number> = {
  janv: 0, janvier: 0, févr: 1, fevr: 1, février: 1, fevrier: 1, mars: 2, avr: 3, avril: 3, mai: 4, juin: 5,
  juil: 6, juillet: 6, août: 7, aout: 7, sept: 8, septembre: 8, oct: 9, octobre: 9, nov: 10, novembre: 10, déc: 11, dec: 11, décembre: 11, decembre: 11,
};

/** "12 août 2026" / "3 sept. 2026" -> Date */
export function parseFrDate(s: string): Date | null {
  const m = s.toLowerCase().match(/(\d{1,2})\s+([a-zéûô]+)\.?\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS_FR[m[2]] ?? MONTHS_FR[m[2].slice(0, 4)] ?? MONTHS_FR[m[2].slice(0, 3)];
  if (month == null) return null;
  return new Date(Date.UTC(parseInt(m[3], 10), month, parseInt(m[1], 10)));
}

export function daysSince(d: Date): number {
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

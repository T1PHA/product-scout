export function parsePrice(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/ | /g, " ").match(/(\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  let n = m[1].replace(/ /g, "");
  // "1.234,56" ou "1 234,56" -> 1234.56 ; "12.99" -> 12.99
  if (/,\d{1,2}$/.test(n)) n = n.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}$/.test(n)) n = n.replace(/\./g, "");
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : null;
}

export function parseCount(s: string | null | undefined): number | null {
  if (!s) return null;
  // "4 000" / "4.000" -> "4000" ; "1,2 k" -> 1200
  const t = s
    .replace(/ | /g, " ")
    .toLowerCase()
    .replace(/(\d)[ .](?=\d{3}\b)/g, "$1");
  const m = t.match(/(\d+(?:,\d+)?)\s*(k|m|mio|million)?\b/);
  if (!m) return null;
  let v = parseFloat(m[1].replace(",", "."));
  if (m[2] === "k") v *= 1000;
  if (m[2] && m[2].startsWith("m")) v *= 1_000_000;
  return Math.round(v);
}

export function median(xs: number[]): number | null {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export function quantile(xs: number[], q: number): number | null {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

/** Retire les valeurs aberrantes (méthode IQR). */
export function trimOutliers(xs: number[]): number[] {
  if (xs.length < 5) return xs;
  const q1 = quantile(xs, 0.25)!;
  const q3 = quantile(xs, 0.75)!;
  const iqr = q3 - q1;
  return xs.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}

export function round(n: number | null | undefined, d = 2): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export interface TrendAnalysis {
  avg12: number;
  avgPrev12: number;
  change12: number | null; // variation % 12 derniers mois vs 12 précédents
  avg5y: number;
  peakMonth: string | null;
  seasonality: number; // coefficient de variation des moyennes mensuelles (0 = plat)
  direction: "hausse" | "stable" | "baisse" | "inconnue";
}

/** points : valeurs hebdomadaires Google Trends (0-100) avec date ISO. */
export function analyzeTrend(points: { date: string; value: number }[]): TrendAnalysis {
  const vals = points.map((p) => p.value);
  const last = vals.slice(-52);
  const prev = vals.slice(-104, -52);
  const avg12 = mean(last) ?? 0;
  const avgPrev12 = mean(prev) ?? 0;
  const change12 = avgPrev12 > 0 ? ((avg12 - avgPrev12) / avgPrev12) * 100 : null;
  const byMonth = new Map<number, number[]>();
  for (const p of points) {
    const m = new Date(p.date).getMonth();
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(p.value);
  }
  const monthAvgs = [...byMonth.entries()].map(([m, v]) => ({ m, v: mean(v) ?? 0 }));
  const mAvg = mean(monthAvgs.map((x) => x.v)) ?? 0;
  const sd = Math.sqrt(mean(monthAvgs.map((x) => (x.v - mAvg) ** 2)) ?? 0);
  const peak = monthAvgs.sort((a, b) => b.v - a.v)[0];
  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  let direction: TrendAnalysis["direction"] = "inconnue";
  if (change12 != null) direction = change12 >= 10 ? "hausse" : change12 <= -15 ? "baisse" : "stable";
  return {
    avg12: round(avg12, 1) ?? 0,
    avgPrev12: round(avgPrev12, 1) ?? 0,
    change12: round(change12, 0),
    avg5y: round(mean(vals) ?? 0, 1) ?? 0,
    peakMonth: peak && mAvg > 0 ? MONTHS[peak.m] : null,
    seasonality: mAvg > 0 ? round(sd / mAvg, 2) ?? 0 : 0,
    direction,
  };
}

"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ points }: { points: { date: string; value: number }[] }) {
  const data = points.map((p) => ({ ...p, label: new Date(p.date).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f5bea" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2f5bea" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ece8df" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b6f78" }} interval={Math.max(1, Math.floor(data.length / 8))} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b6f78" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3dfd6" }} formatter={(v) => [`${v}/100`, "Intérêt"]} labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ""} />
          <Area type="monotone" dataKey="value" stroke="#2f5bea" strokeWidth={1.75} fill="url(#tg)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Histogramme des prix observés par source. */
export function PriceHistogram({ series }: { series: { name: string; color: string; prices: number[] }[] }) {
  const all = series.flatMap((s) => s.prices).filter((p) => p > 0);
  if (all.length < 3) return <p className="text-sm text-muted">Pas assez de prix pour un histogramme.</p>;
  const sorted = [...all].sort((a, b) => a - b);
  const max = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  const bins = 12;
  const step = Math.max(max / bins, 0.5);
  const data = Array.from({ length: bins }, (_, i) => {
    const lo = i * step;
    const hi = (i + 1) * step;
    const row: Record<string, number | string> = { label: `${Math.round(lo)}-${Math.round(hi)} €` };
    for (const s of series) row[s.name] = s.prices.filter((p) => p >= lo && (i === bins - 1 ? true : p < hi)).length;
    return row;
  });
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#ece8df" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b6f78" }} tickLine={false} axisLine={false} interval={1} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b6f78" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3dfd6" }} />
          {series.map((s) => (
            <Bar key={s.name} dataKey={s.name} stackId="a" fill={s.color} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

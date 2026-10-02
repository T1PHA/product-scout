"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RATING, VerdictPill, euro } from "@/components/ui";
import type { Mode, Rating, Verdict } from "@/lib/types";

interface Row {
  id: string;
  product: string;
  mode: Mode;
  verdict: Verdict | null;
  score: number | null;
  confidence: string | null;
  net: number | null;
  sellPrice: number | null;
  createdAt: string;
  criteria: { id: string; label: string; rating: Rating }[];
}

export default function Comparer() {
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<Mode>("ecommerce");

  useEffect(() => {
    fetch("/api/analyses").then((r) => r.json()).then((list: Row[]) => {
      setRows(list);
      if (list.length && !list.some((x) => x.mode === "ecommerce")) setMode("occasion");
    });
  }, []);

  const list = useMemo(() => rows.filter((r) => r.mode === mode && r.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [rows, mode]);
  const cols = list[0]?.criteria ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Comparateur</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Tous les produits analysés, classés par score</h1>
        </div>
        <div className="inline-flex rounded-lg border border-line p-1 bg-card text-sm">
          {(["ecommerce", "occasion"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 rounded-md ${mode === m ? "bg-ink text-white font-semibold" : "text-muted"}`}>
              {m === "ecommerce" ? "E-commerce" : "Occasion"}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-muted mt-8">Aucune analyse terminée dans ce mode. <Link href="/" className="text-accent">Lancer une analyse</Link></p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="text-left font-medium p-3 sticky left-0 bg-card min-w-[220px]">Produit</th>
                <th className="font-medium p-3">Score</th>
                <th className="font-medium p-3">Verdict</th>
                <th className="font-medium p-3 whitespace-nowrap">Marge nette</th>
                <th className="font-medium p-3 whitespace-nowrap">Prix vente</th>
                {cols.map((c) => (
                  <th key={c.id} className="font-medium p-2 min-w-[86px] leading-tight">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                  <td className="p-3 sticky left-0 bg-card">
                    <Link href={`/analyse/${r.id}`} className="font-medium hover:underline">{r.product}</Link>
                    <div className="text-[11px] text-muted">confiance {r.confidence} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}</div>
                  </td>
                  <td className="p-3 text-center num text-lg font-semibold">{r.score}</td>
                  <td className="p-3 text-center">{r.verdict && <VerdictPill verdict={r.verdict} />}</td>
                  <td className="p-3 text-center num">{euro(r.net)}</td>
                  <td className="p-3 text-center num">{euro(r.sellPrice)}</td>
                  {cols.map((c) => {
                    const rating = r.criteria.find((x) => x.id === c.id)?.rating ?? "na";
                    return (
                      <td key={c.id} className="p-1.5 text-center">
                        <span className={`inline-block w-full rounded px-1.5 py-1 text-[11px] font-semibold ${RATING[rating].cls}`}>{RATING[rating].label}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

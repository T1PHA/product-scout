import type { ReactNode } from "react";
import type { Rating, Report, SourceStatus, Verdict } from "@/lib/types";

export const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  tester: { label: "À tester", cls: "bg-ok text-white" },
  creuser: { label: "À creuser", cls: "bg-mid text-white" },
  abandonner: { label: "À abandonner", cls: "bg-bad text-white" },
};

export const RATING: Record<Rating, { label: string; cls: string; dot: string }> = {
  ok: { label: "Ok", cls: "bg-ok-bg text-ok", dot: "bg-ok" },
  moyen: { label: "Moyen", cls: "bg-mid-bg text-mid", dot: "bg-mid" },
  not_ok: { label: "Not ok", cls: "bg-bad-bg text-bad", dot: "bg-bad" },
  na: { label: "N/A", cls: "bg-na-bg text-na", dot: "bg-na" },
};

export const CONFIDENCE: Record<Report["confidence"], string> = { elevee: "élevée", moyenne: "moyenne", faible: "faible" };

export const SOURCE_STATUS: Record<SourceStatus, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "text-na" },
  running: { label: "En cours", cls: "text-accent" },
  ok: { label: "OK", cls: "text-ok" },
  empty: { label: "Aucun résultat", cls: "text-mid" },
  error: { label: "Échec", cls: "text-bad" },
  skipped: { label: "Ignorée", cls: "text-na" },
};

export function VerdictPill({ verdict, big }: { verdict: Verdict; big?: boolean }) {
  const v = VERDICT[verdict];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold ${v.cls} ${big ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"}`}>{v.label}</span>;
}

export function RatingBadge({ rating }: { rating: Rating }) {
  const r = RATING[rating];
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${r.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />{r.label}</span>;
}

export function Section({ title, kicker, children, right }: { title: string; kicker?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          {kicker && <div className="text-[11px] uppercase tracking-[0.14em] text-muted mb-1">{kicker}</div>}
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-xl font-semibold mt-0.5">{value}</div>
      {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

export const euro = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`);
export const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("fr-FR"));

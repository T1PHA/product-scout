"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { VerdictPill, euro } from "@/components/ui";
import type { Mode, Verdict } from "@/lib/types";

interface Row {
  id: string;
  createdAt: string;
  status: string;
  product: string;
  mode: Mode;
  verdict: Verdict | null;
  score: number | null;
  net: number | null;
}

const EXAMPLES: Record<Mode, string[]> = {
  ecommerce: ["harnais anti-traction chien", "legging sculptant", "feuilles de lessive écologiques", "lampe de lecture tour de cou"],
  occasion: ["appareil photo argentique compact", "lot Playmobil vintage", "céramique Vallauris", "poussette Yoyo"],
};

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ecommerce");
  const [product, setProduct] = useState("");
  const [more, setMore] = useState(false);
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [adCost, setAdCost] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    fetch("/api/analyses").then((r) => r.json()).then(setRows).catch(() => {});
    fetch("/api/settings").then((r) => r.json()).then((s) => setHasKey(s.hasKey)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (product.trim().length < 2) return;
    setBusy(true);
    setError("");
    const r = await fetch("/api/analyses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product, mode, buyPrice, sellPrice, adCost, shippingCost, notes }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "Erreur");
      setBusy(false);
      return;
    }
    router.push(`/analyse/${j.id}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Validation produit</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">Une idée de produit ? On vérifie si elle vaut ton temps.</h1>
        <p className="text-muted mt-3 max-w-2xl">
          Tendances Google, pubs Meta actives, prix AliExpress, Amazon, eBay et Vinted, marge nette calculée, puis une analyse rédigée :
          leviers émotionnels, angles, accroches et plan de test.
        </p>
      </div>

      {!hasKey && (
        <div className="mt-6 rounded-lg border border-mid/30 bg-mid-bg px-4 py-3 text-sm text-ink max-w-3xl">
          Pas encore de clé Gemini : l&apos;analyse marche, mais sans angles, accroches ni critères qualitatifs.{" "}
          <Link href="/reglages" className="font-semibold underline">Ajouter la clé gratuite</Link>
        </div>
      )}

      <form onSubmit={submit} className="mt-8 rounded-2xl border border-line bg-card p-5 md:p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <div className="inline-flex rounded-lg border border-line p-1 bg-paper text-sm">
          {(["ecommerce", "occasion"] as Mode[]).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md transition ${mode === m ? "bg-card shadow-sm font-semibold" : "text-muted hover:text-ink"}`}
            >
              {m === "ecommerce" ? "E-commerce (produit neuf)" : "Achat-revente (occasion)"}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col md:flex-row gap-3">
          <input
            autoFocus
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder={mode === "ecommerce" ? "Ex. harnais anti-traction pour chien" : "Ex. appareil photo argentique compact"}
            className="flex-1 rounded-lg border border-line bg-paper/50 px-4 py-3 text-lg outline-none focus:border-accent focus:bg-card"
          />
          <button
            disabled={busy || product.trim().length < 2}
            className="rounded-lg bg-ink text-white px-6 py-3 font-semibold disabled:opacity-40 hover:bg-black transition"
          >
            {busy ? "Lancement…" : "Analyser"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {EXAMPLES[mode].map((ex) => (
            <button type="button" key={ex} onClick={() => setProduct(ex)} className="rounded-full border border-line px-3 py-1 text-muted hover:text-ink hover:border-ink/30">
              {ex}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => setMore((v) => !v)} className="mt-4 text-sm text-accent font-medium">
          {more ? "Masquer les options" : "Je connais déjà des prix (facultatif)"}
        </button>
        {more && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label={mode === "ecommerce" ? "Prix fournisseur (€)" : "Prix d'achat en chine (€)"} value={buyPrice} onChange={setBuyPrice} />
            <Field label="Prix de vente visé (€)" value={sellPrice} onChange={setSellPrice} />
            {mode === "ecommerce" && <Field label="Coût pub par vente (€)" value={adCost} onChange={setAdCost} placeholder="15" />}
            <Field label={mode === "ecommerce" ? "Livraison fournisseur (€)" : "Frais d'envoi à ta charge (€)"} value={shippingCost} onChange={setShippingCost} />
            <label className="col-span-2 md:col-span-4 text-xs text-muted">
              Notes (cible, idée d&apos;angle, contraintes)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
            </label>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </form>

      <div className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Analyses récentes</h2>
          {rows.length > 1 && <Link href="/comparer" className="text-sm text-accent">Comparer</Link>}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted mt-3">Aucune analyse pour l&apos;instant. Lance la première ci-dessus.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {rows.map((r) => (
              <Link key={r.id} href={`/analyse/${r.id}`} className="flex items-center gap-4 rounded-lg border border-line bg-card px-4 py-3 hover:border-ink/25 transition">
                <div className="num w-12 text-right text-lg font-semibold">{r.score ?? "…"}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.product}</div>
                  <div className="text-xs text-muted">
                    {r.mode === "ecommerce" ? "E-commerce" : "Occasion"} · {new Date(r.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    {r.net != null && ` · marge nette ${euro(r.net)}`}
                  </div>
                </div>
                {r.verdict ? <VerdictPill verdict={r.verdict} /> : <span className="text-xs text-accent pulse">{r.status === "error" ? "Erreur" : "En cours"}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-xs text-muted">
      {label}
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        className="num mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
    </label>
  );
}

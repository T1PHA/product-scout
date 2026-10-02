"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui";

interface S {
  geminiKey: string;
  geminiModel: string;
  defaultAdCost: number;
  defaultShipping: number;
  hasKey: boolean;
  models?: string[];
}

export default function Reglages() {
  const [s, setS] = useState<S | null>(null);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [browserMsg, setBrowserMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((x: S) => {
      setS(x);
      setKey(x.geminiKey);
    });
  }, []);

  async function save(patch: Partial<S>) {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(j.error);
    setS(j);
    setKey(j.geminiKey);
    setMsg("Enregistré.");
  }

  async function browser(action: "login" | "close") {
    setBrowserMsg(action === "login" ? "Ouverture de la fenêtre…" : "Fermeture…");
    const r = await fetch("/api/browser", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }).then((x) => x.json());
    setBrowserMsg(r.ok ? (action === "login" ? "Fenêtre ouverte : connecte-toi à eBay (et Facebook si tu veux), puis clique sur « J'ai terminé »." : "Connexions enregistrées. Les prochaines analyses les utiliseront.") : `Erreur : ${r.error}`);
  }

  if (!s) return <div className="mx-auto max-w-3xl px-4 py-16 text-muted">Chargement…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>

      <Section kicker="Analyse rédigée" title="Clé Gemini (gratuite)">
        <ol className="text-sm text-muted list-decimal pl-5 space-y-1 mb-4">
          <li>Va sur <a className="text-accent underline" href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> avec ton compte Google.</li>
          <li>Clique sur « Create API key », copie-la et colle-la ici. Aucune carte bancaire n&apos;est demandée.</li>
          <li>Le palier gratuit suffit pour plusieurs analyses par jour. Google peut utiliser ces échanges pour améliorer ses modèles.</li>
        </ol>
        <div className="flex gap-2">
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…" className="num flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent" />
          <button disabled={busy} onClick={() => save({ geminiKey: key })} className="rounded-lg bg-ink text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">{busy ? "Vérification…" : "Enregistrer"}</button>
        </div>
        {s.hasKey && (
          <div className="mt-4 text-sm">
            <label className="text-xs text-muted">Modèle utilisé</label>
            <select value={s.geminiModel} onChange={(e) => save({ geminiModel: e.target.value })} className="mt-1 block w-full rounded-lg border border-line px-3 py-2 bg-card">
              {[s.geminiModel, ...(s.models ?? [])].filter((v, i, a) => v && a.indexOf(v) === i).map((m) => <option key={m}>{m}</option>)}
            </select>
            {!s.models && <button onClick={() => save({})} className="text-xs text-accent mt-1">Charger la liste des modèles</button>}
          </div>
        )}
        {msg && <p className="text-sm mt-3">{msg}</p>}
      </Section>

      <Section kicker="Hypothèses" title="Valeurs par défaut du calcul de marge">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">Coût pub par vente, e-commerce (€)
            <input type="number" defaultValue={s.defaultAdCost} onBlur={(e) => save({ defaultAdCost: Number(e.target.value) })} className="num mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" />
          </label>
          <label className="text-xs text-muted">Livraison fournisseur par défaut (€)
            <input type="number" defaultValue={s.defaultShipping} onBlur={(e) => save({ defaultShipping: Number(e.target.value) })} className="num mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" />
          </label>
        </div>
        <p className="text-xs text-muted mt-3">15 € de pub par vente est une hypothèse courante pour un premier test Meta. Ajuste-la avec tes vrais chiffres dès que tu en as.</p>
      </Section>

      <Section kicker="Données" title="Connecter mes comptes">
        <p className="text-sm text-muted">
          eBay cache les ventes conclues aux visiteurs non connectés. Ouvre la fenêtre de l&apos;outil, connecte-toi une seule fois : la connexion est gardée dans son profil de navigateur
          (dossier <code className="text-xs">~/.product-scout</code>), sur ton PC uniquement.
        </p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => browser("login")} className="rounded-lg bg-ink text-white px-4 py-2 text-sm font-semibold">Ouvrir la fenêtre de connexion</button>
          <button onClick={() => browser("close")} className="rounded-lg border border-line px-4 py-2 text-sm">J&apos;ai terminé</button>
        </div>
        {browserMsg && <p className="text-sm mt-3">{browserMsg}</p>}
      </Section>

      <Section kicker="Méthode" title="Ce que l'outil vérifie">
        <ul className="text-sm text-muted list-disc pl-5 space-y-1">
          <li>E-commerce : bénéfice compris en 3 s, demande prouvée, panier ≥ 40 €, marge nette ≥ 25 € après pub, pubs actives depuis plus de 30 jours, démontrable en vidéo, logistique simple, potentiel de gamme, produits à bannir, angle libre.</li>
          <li>Occasion : la grille Tests Produits (approvisionnement, demande, marge, panier, liquidité, travail, logistique, expertise, scalabilité, sortie B2B).</li>
          <li>Sources : Google Trends, Meta Ad Library, AliExpress, Alibaba, Amazon.fr, eBay.fr, Vinted, YouTube, DuckDuckGo, Wikipedia, Frankfurter, SellersCalc.</li>
        </ul>
      </Section>
    </div>
  );
}

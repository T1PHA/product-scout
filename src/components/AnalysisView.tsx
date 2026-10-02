"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIDENCE, RATING, RatingBadge, SOURCE_STATUS, Section, Stat, VerdictPill, euro, int } from "./ui";
import { PriceHistogram, TrendChart } from "./charts";
import type { Analysis } from "@/lib/types";
import type { AliData, AlibabaData, AmazonData, EbayData, MetaAdsData, ShopsData, TrendsData, VintedData, WebSearchData, WikipediaData, YoutubeData } from "@/lib/sources";
import { toMarkdown } from "@/lib/markdown";

function useAnalysis(id: string) {
  const [a, setA] = useState<Analysis | null>(null);
  const [notFound, setNotFound] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/analyses/${id}`, { cache: "no-store" });
    if (r.status === 404) return setNotFound(true);
    setA(await r.json());
  }, [id]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/analyses/${id}`, { cache: "no-store" }).then(async (r) => {
      if (!alive) return;
      if (r.status === 404) setNotFound(true);
      else setA(await r.json());
    });
    return () => {
      alive = false;
    };
  }, [id]);
  useEffect(() => {
    if (a?.status !== "running") return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [a?.status, load]);
  return { a, setA, load, notFound };
}

function data<T>(a: Analysis, id: string): T | undefined {
  const s = a.sources[id];
  return s?.status === "ok" ? (s.data as T) : undefined;
}

export default function AnalysisView({ id }: { id: string }) {
  const router = useRouter();
  const { a, setA, load, notFound } = useAnalysis(id);
  const [sheetMsg, setSheetMsg] = useState("");

  if (notFound) return <div className="mx-auto max-w-6xl px-4 py-16">Analyse introuvable. <Link className="text-accent" href="/">Retour</Link></div>;
  if (!a) return <div className="mx-auto max-w-6xl px-4 py-16 text-muted">Chargement…</div>;

  const r = a.report;
  const running = a.status === "running";

  async function rerun(sources?: string[]) {
    await fetch(`/api/analyses/${id}/rerun`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sources }) });
    await load();
  }
  async function remove() {
    if (!window.confirm("Supprimer cette analyse ?")) return;
    await fetch(`/api/analyses/${id}`, { method: "DELETE" });
    router.push("/");
  }
  async function toSheet() {
    setSheetMsg("Envoi…");
    const res = await fetch(`/api/analyses/${id}/sheet`, { method: "POST" }).then((x) => x.json());
    setSheetMsg(res.ok ? `Ajouté en colonne ${res.column}` : `Échec : ${res.error}`);
  }
  function exportMd() {
    const blob = new Blob([toMarkdown(a!)], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `analyse-${a!.inputs.product.replace(/[^\w-]+/g, "-").toLowerCase()}.md`;
    link.click();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10 space-y-5">
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
            {a.inputs.mode === "ecommerce" ? "E-commerce, produit neuf" : "Achat-revente, occasion"} · {new Date(a.createdAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">{a.inputs.product}</h1>
          {a.keywords && (
            <div className="text-xs text-muted mt-1">
              Requêtes : <span className="text-ink">{a.keywords.fr}</span> · EN <span className="text-ink">{a.keywords.en}</span> · Trends <span className="text-ink">{a.keywords.short}</span>
            </div>
          )}
        </div>
        <div className="no-print flex flex-wrap gap-2 text-sm">
          <button disabled={running} onClick={() => rerun()} className="rounded-lg border border-line bg-card px-3 py-1.5 hover:border-ink/30 disabled:opacity-40">Relancer tout</button>
          {r && <button onClick={exportMd} className="rounded-lg border border-line bg-card px-3 py-1.5 hover:border-ink/30">Markdown</button>}
          {r && <button onClick={() => window.print()} className="rounded-lg border border-line bg-card px-3 py-1.5 hover:border-ink/30">PDF</button>}
          {r && <button onClick={toSheet} className="rounded-lg bg-ink text-white px-3 py-1.5 hover:bg-black">Envoyer vers Tests Produits</button>}
          <button onClick={remove} className="rounded-lg px-3 py-1.5 text-bad hover:bg-bad-bg">Supprimer</button>
        </div>
      </div>
      {sheetMsg && <p className="no-print text-sm text-muted text-right">{sheetMsg}</p>}

      {(running || !r) && <Progress a={a} />}
      {a.status === "error" && <div className="rounded-lg bg-bad-bg text-bad px-4 py-3 text-sm">Erreur : {a.error}</div>}

      {r && (
        <>
          <VerdictBlock a={a} />
          <CriteriaBlock a={a} />
          <MarginBlock a={a} onChange={setA} />
          <MarketBlock a={a} />
          {a.inputs.mode === "ecommerce" ? <CompetitionBlock a={a} /> : <ResaleBlock a={a} />}
          {a.inputs.mode === "ecommerce" && <SupplierBlock a={a} />}
          <AiBlocks a={a} />
          <ContentBlock a={a} />
          <SourcesBlock a={a} onRerun={rerun} running={running} />
        </>
      )}
    </div>
  );
}

function Progress({ a }: { a: Analysis }) {
  const list = Object.values(a.sources);
  const done = list.filter((s) => !["pending", "running"].includes(s.status)).length;
  return (
    <Section kicker="Collecte en direct" title={a.status === "running" ? `Analyse en cours : ${done}/${list.length} sources` : "Sources"}>
      <div className="h-1.5 rounded-full bg-paper overflow-hidden mb-4">
        <div className="h-full bg-accent transition-all" style={{ width: `${(done / Math.max(list.length, 1)) * 100}%` }} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {list.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
            <span className="truncate pr-2">{s.label}</span>
            <span className={`text-xs font-medium shrink-0 ${SOURCE_STATUS[s.status].cls} ${s.status === "running" ? "pulse" : ""}`}>{SOURCE_STATUS[s.status].label}</span>
          </div>
        ))}
      </div>
      {done === list.length && a.status === "running" && <p className="text-sm text-muted mt-4 pulse">Calcul des scores et rédaction de l&apos;analyse…</p>}
    </Section>
  );
}

function VerdictBlock({ a }: { a: Analysis }) {
  const r = a.report!;
  return (
    <section className="rounded-xl border border-line bg-card p-5 md:p-6 grid md:grid-cols-[220px_1fr] gap-6">
      <div className="flex md:flex-col items-center md:items-start gap-4">
        <div>
          <div className="num text-6xl font-semibold leading-none">{r.score}<span className="text-xl text-muted">/100</span></div>
          <div className="mt-3"><VerdictPill verdict={r.verdict} big /></div>
        </div>
        <div className="text-xs text-muted md:mt-2">
          Confiance <span className="font-semibold text-ink">{CONFIDENCE[r.confidence]}</span>
          <br />
          {r.confidenceDetail}
        </div>
      </div>
      <div>
        {r.ai ? (
          <>
            <p className="text-[15px] leading-relaxed">{r.ai.summary}</p>
            <p className="mt-3 text-sm font-medium">{r.ai.verdictReason}</p>
          </>
        ) : (
          <p className="text-sm text-muted">Résumé rédigé indisponible.</p>
        )}
        {r.aiError && <p className="mt-3 text-xs text-mid bg-mid-bg rounded-md px-3 py-2">{r.aiError}</p>}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {r.criteria.map((c) => (
            <span key={c.id} title={c.detail} className={`text-[11px] rounded px-2 py-0.5 ${RATING[c.rating].cls}`}>{c.label}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CriteriaBlock({ a }: { a: Analysis }) {
  const r = a.report!;
  return (
    <Section kicker="Grille de validation" title={a.inputs.mode === "ecommerce" ? "Critères de la méthode produit gagnant" : "Grille Tests Produits"}>
      <div className="divide-y divide-line">
        {r.criteria.map((c) => (
          <div key={c.id} className="grid md:grid-cols-[230px_90px_1fr] gap-x-4 gap-y-1 py-3">
            <div>
              <div className="font-medium text-sm">{c.label}{c.eliminatory && <span className="ml-1 text-[10px] uppercase text-bad">éliminatoire</span>}</div>
              <div className="text-xs text-muted">{c.question}</div>
            </div>
            <div><RatingBadge rating={c.rating} /></div>
            <div className="text-sm">
              {c.detail}
              <div className="text-[11px] text-muted mt-0.5">Source : {c.source}{c.weight ? ` · poids ${c.weight}` : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function MarginBlock({ a, onChange }: { a: Analysis; onChange: (a: Analysis) => void }) {
  const m = a.report!.margin;
  const eco = a.inputs.mode === "ecommerce";
  const [vals, setVals] = useState({
    buyPrice: a.inputs.buyPrice?.toString() ?? "",
    sellPrice: a.inputs.sellPrice?.toString() ?? "",
    adCost: a.inputs.adCost?.toString() ?? "",
    shippingCost: a.inputs.shippingCost?.toString() ?? "",
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function set(k: keyof typeof vals, v: string) {
    const next = { ...vals, [k]: v.replace(",", ".") };
    setVals(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/analyses/${a.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      if (res.ok) onChange(await res.json());
    }, 500);
  }
  const rows: [string, number | null, string][] = [
    ["Prix de vente", m.sellPrice, m.sellPriceSource],
    ["− Prix d'achat", m.buyPrice, m.buyPriceSource],
    [eco ? "− Livraison fournisseur" : "− Envoi à ta charge", m.shipping, ""],
    ["− Frais plateforme et paiement", m.fees, m.feesLabel],
  ];
  if (eco) rows.push(["− Coût pub par vente", m.adCost, "hypothèse modifiable"]);
  return (
    <Section kicker="Calculateur" title="Marge nette par vente" right={<div className={`num text-2xl font-semibold ${m.net == null ? "text-na" : m.net >= (eco ? 25 : 15) ? "text-ok" : m.net > 0 ? "text-mid" : "text-bad"}`}>{euro(m.net)}</div>}>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-1.5 text-sm">
          {rows.map(([l, v, src]) => (
            <div key={l} className="flex items-baseline justify-between gap-3 border-b border-dashed border-line pb-1.5">
              <span>{l}<span className="block text-[11px] text-muted">{src}</span></span>
              <span className="num">{euro(v)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-1 font-semibold"><span>= Marge nette</span><span className="num">{euro(m.net)}</span></div>
          <div className="flex gap-4 text-xs text-muted pt-1">
            <span>Taux de marge <b className="num text-ink">{m.marginPct ?? "—"} %</b></span>
            <span>Multiple <b className="num text-ink">{m.multiple ? `x${m.multiple}` : "—"}</b></span>
          </div>
        </div>
        <div className="no-print">
          <p className="text-xs text-muted mb-2">Remplace les valeurs automatiques par les tiennes : tout se recalcule (critères, score, verdict).</p>
          <div className="grid grid-cols-2 gap-3">
            <In label="Prix d'achat (€)" v={vals.buyPrice} on={(v) => set("buyPrice", v)} ph={m.buyPrice?.toString()} />
            <In label="Prix de vente (€)" v={vals.sellPrice} on={(v) => set("sellPrice", v)} ph={m.sellPrice?.toString()} />
            {eco && <In label="Pub par vente (€)" v={vals.adCost} on={(v) => set("adCost", v)} ph={m.adCost.toString()} />}
            <In label={eco ? "Livraison (€)" : "Envoi (€)"} v={vals.shippingCost} on={(v) => set("shippingCost", v)} ph={m.shipping.toString()} />
          </div>
        </div>
      </div>
    </Section>
  );
}

function In({ label, v, on, ph }: { label: string; v: string; on: (v: string) => void; ph?: string }) {
  return (
    <label className="text-xs text-muted">
      {label}
      <input inputMode="decimal" value={v} placeholder={ph ? `auto : ${ph}` : "auto"} onChange={(e) => on(e.target.value)} className="num mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
    </label>
  );
}

function MarketBlock({ a }: { a: Analysis }) {
  const t = data<TrendsData>(a, "trends");
  const az = data<AmazonData>(a, "amazon");
  const eb = data<EbayData>(a, "ebay");
  const vi = data<VintedData>(a, "vinted");
  const ali = data<AliData>(a, "aliexpress");
  const wk = data<WikipediaData>(a, "wikipedia");
  const sh = data<ShopsData>(a, "shops");
  const series = [
    sh && { name: "Boutiques pub", color: "#7c3aed", prices: sh.products.map((p) => p.price) },
    az && { name: "Amazon", color: "#16181d", prices: az.items.map((i) => i.price ?? 0) },
    eb && { name: eb.soldItems.length ? "eBay vendus" : "eBay", color: "#2f5bea", prices: (eb.soldItems.length ? eb.soldItems : eb.activeItems).map((i) => i.price ?? 0) },
    vi && { name: "Vinted", color: "#0f9d8a", prices: vi.items.map((i) => i.price ?? 0) },
    ali && { name: "AliExpress", color: "#e8672b", prices: ali.items.map((i) => i.price ?? 0) },
  ].filter(Boolean) as { name: string; color: string; prices: number[] }[];
  return (
    <Section kicker="Marché" title="Tendance et prix">
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-medium mb-2">Google Trends France, 5 ans {t && <span className="text-muted font-normal">« {t.keyword} »</span>}</div>
          {t ? (
            <>
              <TrendChart points={t.points} />
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Stat label="Variation 12 mois" value={t.analysis.change12 != null ? `${t.analysis.change12 > 0 ? "+" : ""}${t.analysis.change12} %` : "—"} hint={t.analysis.direction} />
                <Stat label="Intérêt moyen" value={`${t.analysis.avg12}/100`} hint="12 derniers mois" />
                <Stat label="Saisonnalité" value={t.analysis.seasonality >= 0.35 ? "Forte" : t.analysis.seasonality >= 0.18 ? "Moyenne" : "Faible"} hint={t.analysis.peakMonth ? `pic : ${t.analysis.peakMonth}` : undefined} />
              </div>
              {(t.related.rising.length > 0 || t.related.top.length > 0) && (
                <div className="mt-3 text-xs">
                  {t.related.rising.length > 0 && <p><span className="text-muted">En hausse :</span> {t.related.rising.join(" · ")}</p>}
                  {t.related.top.length > 0 && <p className="mt-1"><span className="text-muted">Associées :</span> {t.related.top.join(" · ")}</p>}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">Pas de données Trends (volume trop faible ou source bloquée).</p>
          )}
          {wk?.article && <p className="text-xs text-muted mt-3">Wikipedia « {wk.article} » : {wk.change12 != null ? `${wk.change12 > 0 ? "+" : ""}${wk.change12} % de vues sur 12 mois` : "vues indisponibles"}.</p>}
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Répartition des prix observés</div>
          <PriceHistogram series={series} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {sh && <Stat label="Boutiques médian" value={euro(sh.medianPrice)} hint={`${sh.shopify.length} boutiques Shopify`} />}
            {az && <Stat label="Amazon médian" value={euro(az.medianPrice)} hint={`${az.items.length} fiches`} />}
            {eb && <Stat label={eb.soldAvailable ? "eBay vendu médian" : "eBay médian"} value={euro(eb.soldAvailable ? eb.soldMedian : eb.activeMedian)} hint={`${int(eb.activeCount)} annonces`} />}
            {vi && <Stat label="Vinted médian" value={euro(vi.medianPrice)} hint={`${vi.count} annonces`} />}
            {ali && <Stat label="AliExpress médian" value={euro(ali.medianPrice)} hint={`${int(ali.totalSold)} ventes affichées`} />}
          </div>
        </div>
      </div>
    </Section>
  );
}

function CompetitionBlock({ a }: { a: Analysis }) {
  const m = data<MetaAdsData>(a, "metaAds");
  const az = data<AmazonData>(a, "amazon");
  const sh = data<ShopsData>(a, "shops");
  // Une même créa est souvent déclinée en plusieurs pubs : on les regroupe à l'affichage
  const grouped = new Map<string, MetaAdsData["ads"][number] & { copies: number }>();
  for (const ad of m?.ads ?? []) {
    const key = `${ad.advertiser}|${ad.text.slice(0, 80)}`;
    const g = grouped.get(key);
    if (g) {
      g.copies++;
      g.days = Math.max(g.days ?? 0, ad.days ?? 0);
    } else grouped.set(key, { ...ad, copies: 1 });
  }
  const ads = [...grouped.values()].sort((x, y) => (y.days ?? 0) - (x.days ?? 0));
  return (
    <Section kicker="Concurrence" title="Qui vend déjà, et depuis quand">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <Stat label="Pubs Meta actives (FR)" value={m ? int(m.total) : "—"} hint={m?.totalLabel ?? undefined} />
        <Stat label="Pubs ≥ 30 jours" value={m ? m.longRunning : "—"} hint={m ? `sur ${m.ads.length} analysées` : undefined} />
        <Stat label="Annonceurs distincts" value={m ? m.advertisers : "—"} />
        <Stat label="Achats Amazon (mois dernier)" value={az ? `≥ ${int(az.boughtLastMonthSum)}` : "—"} hint={az ? `${int(az.totalReviews)} avis cumulés` : undefined} />
      </div>
      {ads.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-medium mb-2">Pubs actives, des plus anciennes aux plus récentes</div>
          <div className="grid md:grid-cols-2 gap-2">
            {ads.slice(0, 12).map((ad, i) => (
              <div key={i} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium truncate">{ad.advertiser || "Annonceur"}{ad.copies > 1 && <span className="text-xs text-muted font-normal"> · {ad.copies} déclinaisons</span>}</span>
                  <span className={`num text-xs shrink-0 ${(ad.days ?? 0) >= 30 ? "text-ok font-semibold" : "text-muted"}`}>{ad.days != null ? `${ad.days} j` : "?"}</span>
                </div>
                {ad.domain && <div className="text-xs text-accent">{ad.domain}</div>}
                <p className="text-xs text-muted mt-1 line-clamp-3">{ad.text}</p>
              </div>
            ))}
          </div>
          {m && m.topDomains.length > 0 && <p className="text-xs text-muted mt-2">Boutiques les plus présentes : {m.topDomains.map((d) => `${d.domain} (${d.count})`).join(", ")}</p>}
        </div>
      )}
      {sh && sh.products.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-medium mb-1">Prix des boutiques qui font de la pub</div>
          <p className="text-xs text-muted mb-2">
            {sh.shopify.length} boutiques Shopify lues sur {sh.checked.length} domaines, prix médian {euro(sh.medianPrice)} (P25 {euro(sh.p25)}, P75 {euro(sh.p75)})
            {sh.discountShare != null && `, ${Math.round(sh.discountShare * 100)} % affichent un prix barré`}.
          </p>
          <ItemTable
            head={["Produit", "Boutique", "Prix", "Barré"]}
            rows={sh.products.slice(0, 12).map((p) => [<a key="t" href={p.url} target="_blank" className="hover:underline">{p.title}</a>, p.shop, euro(p.price), p.compareAt ? euro(p.compareAt) : "—"])}
          />
        </div>
      )}
      {az && (
        <div>
          <div className="text-sm font-medium mb-2">Amazon.fr, premiers résultats</div>
          <ItemTable
            head={["Produit", "Prix", "Note", "Avis", "Achats/mois"]}
            rows={az.items.slice(0, 12).map((i) => [
              <a key="t" href={i.url ?? "#"} target="_blank" className="hover:underline">{i.sponsored && <span className="text-[10px] text-muted mr-1">SPONSO</span>}{i.title}</a>,
              euro(i.price),
              i.rating ? `${i.rating}★` : "—",
              int(i.reviews),
              i.boughtLastMonth ? `${int(i.boughtLastMonth)}+` : "—",
            ])}
          />
        </div>
      )}
    </Section>
  );
}

function SupplierBlock({ a }: { a: Analysis }) {
  const ali = data<AliData>(a, "aliexpress");
  const ab = data<AlibabaData>(a, "alibaba");
  if (!ali && !ab) return null;
  return (
    <Section kicker="Fournisseurs" title="Prix d'achat en Chine">
      {ali && (
        <ItemTable
          head={["AliExpress (unité)", "Prix", "Vendus", "Note"]}
          rows={ali.items.slice(0, 10).map((i) => [<a key="t" href={i.url} target="_blank" className="hover:underline">{i.title}</a>, euro(i.price), int(i.sold), i.rating ?? "—"])}
        />
      )}
      {ab && ab.offers.length > 0 && (
        <div className="mt-5">
          <ItemTable
            head={["Alibaba (gros)", "Prix bas", "Prix haut", "MOQ"]}
            rows={ab.offers.slice(0, 8).map((o) => [o.title || "Offre", `${o.priceLow ?? "—"} ${ab.currency}`, `${o.priceHigh ?? "—"} ${ab.currency}`, o.moq ?? "—"])}
          />
        </div>
      )}
    </Section>
  );
}

function ResaleBlock({ a }: { a: Analysis }) {
  const vi = data<VintedData>(a, "vinted");
  const eb = data<EbayData>(a, "ebay");
  return (
    <Section kicker="Revente" title="Ce qui se vend, à quel prix">
      {eb && !eb.soldAvailable && (
        <p className="text-xs text-mid bg-mid-bg rounded-md px-3 py-2 mb-4">
          Ventes conclues eBay indisponibles : eBay demande une connexion. Va dans Réglages, « Connecter mes comptes », connecte-toi une fois, puis relance la source eBay.
        </p>
      )}
      <div className="grid lg:grid-cols-2 gap-6">
        {vi && (
          <div>
            <div className="text-sm font-medium mb-2">Vinted ({vi.count} annonces, P25 {euro(vi.p25)} à P75 {euro(vi.p75)})</div>
            {vi.topBrands.length > 0 && <p className="text-xs text-muted mb-2">Marques : {vi.topBrands.map((b) => `${b.brand} (${b.count})`).join(", ")}</p>}
            <ItemTable head={["Annonce", "Prix", "État"]} rows={vi.items.slice(0, 12).map((i) => [<a key="t" href={i.url} target="_blank" className="hover:underline">{i.title}</a>, euro(i.price), i.condition ?? "—"])} />
          </div>
        )}
        {eb && (
          <div>
            <div className="text-sm font-medium mb-2">{eb.soldAvailable ? `eBay ventes conclues (${int(eb.soldCount)})` : `eBay annonces (${int(eb.activeCount)})`}</div>
            <ItemTable
              head={["Annonce", "Prix", eb.soldAvailable ? "Vendu le" : "État"]}
              rows={(eb.soldAvailable ? eb.soldItems : eb.activeItems).slice(0, 12).map((i) => [i.title, euro(i.price), (eb.soldAvailable ? i.soldDate : i.condition) ?? "—"])}
            />
          </div>
        )}
      </div>
    </Section>
  );
}

function AiBlocks({ a }: { a: Analysis }) {
  const ai = a.report!.ai;
  if (!ai) return null;
  const ps = ai.psychology;
  return (
    <>
      <Section kicker="Psychologie d'achat" title="Pourquoi les gens achèteraient">
        <div className="grid md:grid-cols-2 gap-5 text-sm">
          <div className="space-y-3">
            <KV k="Levier principal" v={ps.mainLever} />
            {ps.secondaryLevers?.length > 0 && <KV k="Leviers secondaires" v={ps.secondaryLevers.join(" · ")} />}
            <KV k="Douleur visée" v={ps.pain} />
            <KV k="Transformation vendue" v={ps.transformation} />
            <KV k="Mécanisme unique possible" v={ps.uniqueMechanism} />
          </div>
          <div>
            <div className="text-xs text-muted mb-2">Effet miroir</div>
            <ul className="space-y-2">
              {ps.mirrorPhrases.map((p, i) => (
                <li key={i} className="rounded-lg bg-paper px-3 py-2 italic">« {p} »</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section kicker="Marketing" title="Angles et accroches">
        <div className="grid md:grid-cols-2 gap-3">
          {ai.angles.map((g, i) => (
            <div key={i} className="rounded-lg border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">{g.name}</div>
                {g.untapped && <span className="text-[10px] uppercase tracking-wide rounded bg-ok-bg text-ok px-1.5 py-0.5 font-semibold">Inexploité</span>}
              </div>
              <div className="text-xs text-muted mt-1">Audience : {g.audience}</div>
              <p className="text-sm mt-2">{g.message}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <div className="text-sm font-medium mb-2">Accroches pour les 3 premières secondes</div>
          <ol className="space-y-1.5 text-sm list-decimal pl-5">
            {ai.hooks.map((h, i) => <li key={i}>{h}</li>)}
          </ol>
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-5">
        <Section kicker="Marque" title="Potentiel de gamme">
          <ul className="text-sm space-y-1.5 list-disc pl-5">{ai.range.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Section>
        <Section kicker="Prudence" title="Risques et légal">
          <ul className="text-sm space-y-1.5 list-disc pl-5">{ai.risks.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Section>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Section kicker="Action" title="Plan de test">
          <p className="text-sm"><span className="text-muted">Budget :</span> {ai.testPlan.budget}</p>
          <ol className="text-sm space-y-1.5 list-decimal pl-5 mt-3">{ai.testPlan.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
          <div className="grid grid-cols-1 gap-2 mt-4 text-sm">
            <p className="rounded-lg bg-ok-bg px-3 py-2"><b>On continue si</b> {ai.testPlan.continueIf}</p>
            <p className="rounded-lg bg-bad-bg px-3 py-2"><b>On arrête si</b> {ai.testPlan.stopIf}</p>
          </div>
        </Section>
        <Section kicker="Approvisionnement" title="Où acheter">
          <ul className="text-sm space-y-1.5 list-disc pl-5">{ai.sourcing.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Section>
      </div>
    </>
  );
}

function ContentBlock({ a }: { a: Analysis }) {
  const yt = data<YoutubeData>(a, "youtube");
  const w = data<WebSearchData>(a, "websearch");
  if (!yt && !w) return null;
  return (
    <Section kicker="Contenus" title="Vidéos et ce qu'en dit le web">
      <div className="grid lg:grid-cols-2 gap-6">
        {yt && (
          <div>
            <div className="text-sm font-medium mb-2">YouTube ({yt.videos.length} vidéos, médiane {int(yt.medianViews)} vues)</div>
            <ul className="space-y-1.5 text-sm">
              {yt.videos.slice(0, 8).map((v) => (
                <li key={v.url} className="flex justify-between gap-3">
                  <a href={v.url} target="_blank" className="truncate hover:underline">{v.title}</a>
                  <span className="num text-xs text-muted shrink-0">{int(v.views)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {w && (
          <div className="space-y-4">
            {w.queries.map((q) => (
              <div key={q.query}>
                <div className="text-sm font-medium">« {q.query} »</div>
                <ul className="mt-1 space-y-1.5">
                  {q.results.slice(0, 4).map((r) => (
                    <li key={r.url} className="text-xs">
                      <a href={r.url} target="_blank" className="text-accent hover:underline">{r.title}</a>
                      <span className="text-muted"> {r.snippet.slice(0, 160)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function SourcesBlock({ a, onRerun, running }: { a: Analysis; onRerun: (s?: string[]) => void; running: boolean }) {
  const failed = Object.values(a.sources).filter((s) => s.status === "error" || s.status === "empty").map((s) => s.id);
  return (
    <Section
      kicker="Traçabilité"
      title="Sources et liens"
      right={failed.length > 0 ? <button disabled={running} onClick={() => onRerun(failed)} className="no-print text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30 disabled:opacity-40">Relancer les sources en échec ({failed.length})</button> : undefined}
    >
      <div className="divide-y divide-line text-sm">
        {Object.values(a.sources).map((s) => (
          <div key={s.id} className="py-2 grid md:grid-cols-[260px_110px_1fr] gap-2">
            <span>{s.label}</span>
            <span className={`text-xs font-medium ${SOURCE_STATUS[s.status].cls}`}>{SOURCE_STATUS[s.status].label}{s.durationMs ? ` · ${Math.round(s.durationMs / 1000)} s` : ""}</span>
            <span className="text-xs text-muted break-all">
              {s.error && <span className="text-bad">{s.error} </span>}
              {s.urls?.map((u) => <a key={u} href={u} target="_blank" className="text-accent hover:underline mr-2">{new URL(u).hostname}</a>)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted mt-3">Collecte du {new Date(a.report!.generatedAt).toLocaleString("fr-FR")}. Les prix Vinted, Amazon et eBay hors ventes conclues sont des prix demandés, pas des prix de vente.</p>
    </Section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{k}</div>
      <div>{v}</div>
    </div>
  );
}

function ItemTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted border-b border-line">
            {head.map((h, i) => <th key={h} className={`py-1.5 font-medium ${i ? "text-right pl-3 whitespace-nowrap" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {r.map((c, j) => <td key={j} className={`py-1.5 align-top ${j ? "num text-right pl-3 whitespace-nowrap" : "pr-2"}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

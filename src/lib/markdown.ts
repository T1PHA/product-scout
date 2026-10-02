import type { Analysis, Rating } from "./types";

const R: Record<Rating, string> = { ok: "Ok", moyen: "Moyen", not_ok: "Not ok", na: "N/A" };
const V = { tester: "À tester", creuser: "À creuser", abandonner: "À abandonner" } as const;
const e = (n: number | null | undefined) => (n == null ? "?" : `${n} €`);

export function toMarkdown(a: Analysis): string {
  const r = a.report!;
  const L: string[] = [];
  L.push(`# ${a.inputs.product}`);
  L.push(`${a.inputs.mode === "ecommerce" ? "E-commerce" : "Achat-revente"} · ${new Date(a.createdAt).toLocaleString("fr-FR")}`);
  L.push("");
  L.push(`**Verdict : ${V[r.verdict]}** · score ${r.score}/100 · confiance ${r.confidence} (${r.confidenceDetail})`);
  if (r.ai) L.push("", r.ai.summary, "", `> ${r.ai.verdictReason}`);
  L.push("", "## Critères", "", "| Critère | Note | Détail |", "|---|---|---|");
  for (const c of r.criteria) L.push(`| ${c.label} | ${R[c.rating]} | ${c.detail.replace(/\|/g, "/")} |`);
  const m = r.margin;
  L.push("", "## Marge", "");
  L.push(`- Prix de vente : ${e(m.sellPrice)} (${m.sellPriceSource})`);
  L.push(`- Prix d'achat : ${e(m.buyPrice)} (${m.buyPriceSource})`);
  L.push(`- Livraison : ${e(m.shipping)} · Frais : ${e(m.fees)} (${m.feesLabel}) · Pub : ${e(m.adCost)}`);
  L.push(`- **Marge nette : ${e(m.net)}** (${m.marginPct ?? "?"} %, x${m.multiple ?? "?"})`);
  if (r.ai) {
    const p = r.ai.psychology;
    L.push("", "## Psychologie d'achat", "", `- Levier principal : ${p.mainLever}`, `- Douleur : ${p.pain}`, `- Transformation : ${p.transformation}`, `- Mécanisme unique : ${p.uniqueMechanism}`);
    L.push("", "Effet miroir :", ...p.mirrorPhrases.map((x) => `- « ${x} »`));
    L.push("", "## Angles", "", ...r.ai.angles.map((g) => `- **${g.name}**${g.untapped ? " (inexploité)" : ""} : ${g.message} _(audience : ${g.audience})_`));
    L.push("", "## Accroches 0-3 s", "", ...r.ai.hooks.map((h, i) => `${i + 1}. ${h}`));
    L.push("", "## Gamme", "", ...r.ai.range.map((x) => `- ${x}`));
    L.push("", "## Risques", "", ...r.ai.risks.map((x) => `- ${x}`));
    L.push("", "## Plan de test", "", `Budget : ${r.ai.testPlan.budget}`, "", ...r.ai.testPlan.steps.map((x, i) => `${i + 1}. ${x}`), "", `- On continue si : ${r.ai.testPlan.continueIf}`, `- On arrête si : ${r.ai.testPlan.stopIf}`);
    L.push("", "## Où acheter", "", ...r.ai.sourcing.map((x) => `- ${x}`));
  }
  L.push("", "## Sources", "");
  for (const s of Object.values(a.sources)) L.push(`- ${s.label} : ${s.status}${s.urls?.length ? ` (${s.urls.join(", ")})` : ""}${s.error ? ` — ${s.error}` : ""}`);
  return L.join("\n");
}

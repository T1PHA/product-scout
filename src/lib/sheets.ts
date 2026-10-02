import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Analysis, Rating } from "./types";

const VERDICT_LABEL = { tester: "À tester", creuser: "À creuser", abandonner: "À abandonner" } as const;
const RATING_LABEL: Record<Rating, string> = { ok: "Ok", moyen: "Moyen", not_ok: "Not ok", na: "?" };

// Libellé de ligne de la feuille -> id de critère, selon le mode
const ROW_MAP: Record<string, Record<string, string>> = {
  occasion: {
    Approvisionnement: "supply", Demande: "demand", Marge: "margin", Panier: "basket", "Liquidité": "liquidity",
    Travail: "work", Logistique: "logistics", Expertise: "expertise", "Scalabilité": "scalability", "Sortie B2B": "b2b",
  },
  ecommerce: { Demande: "demand", Marge: "margin", Panier: "price", "Liquidité": "proven", Logistique: "logistics", "Scalabilité": "range" },
};

export function buildSheetPayload(a: Analysis) {
  const r = a.report!;
  const cells: Record<string, { value: string; rating: Rating | null }> = {};
  for (const [row, cid] of Object.entries(ROW_MAP[a.inputs.mode])) {
    const c = r.criteria.find((x) => x.id === cid);
    if (c) cells[row] = { value: `${RATING_LABEL[c.rating]} — ${c.detail}`, rating: c.rating };
  }
  const m = r.margin;
  cells["Prix d'achat typique"] = { value: m.buyPrice != null ? `${m.buyPrice} € (${m.buyPriceSource})` : "Inconnu", rating: null };
  cells["Prix de revente constaté"] = { value: m.sellPrice != null ? `${m.sellPrice} € (${m.sellPriceSource})` : "Inconnu", rating: null };
  if (r.ai) {
    cells["Où acheter"] = { value: r.ai.sourcing.join(" ; "), rating: null };
    cells["Risques et légal"] = { value: r.ai.risks.join(" ; "), rating: null };
    cells["Verdict"] = { value: `${VERDICT_LABEL[r.verdict]} — ${r.ai.verdictReason}`, rating: null };
  } else {
    cells["Verdict"] = { value: VERDICT_LABEL[r.verdict], rating: null };
  }
  cells["Score /10"] = { value: String(Math.round(r.score) / 10), rating: null };
  cells["Sources"] = { value: Object.values(a.sources).flatMap((s) => (s.status === "ok" ? s.urls ?? [] : [])).join("\n"), rating: null };
  return { header: `${a.inputs.product} (${a.inputs.mode === "ecommerce" ? "e-commerce" : "occasion"}, outil ${a.createdAt.slice(0, 10)})`, cells };
}

export function exportToSheet(a: Analysis): Promise<{ ok: boolean; column?: string; url?: string; error?: string }> {
  const tmp = path.join(os.tmpdir(), `ps-sheet-${a.id}.json`);
  fs.writeFileSync(tmp, JSON.stringify(buildSheetPayload(a)), "utf-8");
  const script = path.join(process.cwd(), "scripts", "sheet_export.py");
  return new Promise((resolve) => {
    execFile("python", [script, tmp], { timeout: 60_000, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }, (err, stdout, stderr) => {
      fs.rmSync(tmp, { force: true });
      if (err) return resolve({ ok: false, error: (stderr || err.message).split("\n").filter(Boolean).slice(-2).join(" ") });
      try {
        resolve(JSON.parse(stdout.trim().split("\n").pop()!));
      } catch {
        resolve({ ok: false, error: stdout.slice(0, 200) });
      }
    });
  });
}

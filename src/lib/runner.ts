import { randomUUID } from "node:crypto";
import { getAnalysis, getSettings, saveAnalysis } from "./db";
import { buildAiReport, buildKeywords } from "./ai";
import { hasGemini } from "./gemini";
import { sourcesFor } from "./sources";
import type { SourceDef } from "./sources/common";
import { computeMargin } from "./scoring/margin";
import { buildCriteria, computeConfidence, decideVerdict, scoreCriteria } from "./scoring/criteria";
import type { AiReport, Analysis, AnalysisInputs, Report, SourceResult } from "./types";

const g = globalThis as unknown as { __psRunning?: Set<string> };
g.__psRunning ??= new Set();

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} : délai dépassé (${Math.round(ms / 1000)} s)`)), ms))]);
}

/** Limite le nombre d'onglets navigateur ouverts en même temps. */
async function runPool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

export function createAnalysis(inputs: AnalysisInputs): Analysis {
  const a: Analysis = {
    id: randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    status: "running",
    inputs,
    sources: Object.fromEntries(sourcesFor(inputs.mode).map((s) => [s.id, { id: s.id, label: s.label, status: "pending" } as SourceResult])),
  };
  saveAnalysis(a);
  void runAnalysis(a.id);
  return a;
}

export function rerunAnalysis(id: string, onlySources?: string[]): Analysis | null {
  const a = getAnalysis(id);
  if (!a || g.__psRunning!.has(id)) return a;
  a.status = "running";
  a.report = undefined;
  for (const s of sourcesFor(a.inputs.mode)) {
    if (!onlySources || onlySources.includes(s.id)) a.sources[s.id] = { id: s.id, label: s.label, status: "pending" };
  }
  saveAnalysis(a);
  void runAnalysis(id, onlySources);
  return a;
}

async function runAnalysis(id: string, onlySources?: string[]) {
  if (g.__psRunning!.has(id)) return;
  g.__psRunning!.add(id);
  const a = getAnalysis(id)!;
  const update = (patch: (x: Analysis) => void) => {
    patch(a);
    saveAnalysis(a);
  };
  try {
    if (!a.keywords || !onlySources) update((x) => (x.keywords = undefined));
    const keywords = a.keywords ?? (await buildKeywords(a.inputs));
    update((x) => (x.keywords = keywords));

    const defs = sourcesFor(a.inputs.mode).filter((s) => !onlySources || onlySources.includes(s.id));
    const exec = async (def: SourceDef) => {
      const t0 = Date.now();
      update((x) => (x.sources[def.id] = { id: def.id, label: def.label, status: "running" }));
      try {
        const out = await withTimeout(def.run({ inputs: a.inputs, keywords, previous: a.sources }), def.timeoutMs, def.label);
        update(
          (x) =>
            (x.sources[def.id] = {
              id: def.id,
              label: def.label,
              status: out.empty ? "empty" : "ok",
              data: out.data,
              urls: out.urls,
              durationMs: Date.now() - t0,
            }),
        );
      } catch (e) {
        update(
          (x) =>
            (x.sources[def.id] = {
              id: def.id,
              label: def.label,
              status: "error",
              error: (e as Error).message.slice(0, 300),
              durationMs: Date.now() - t0,
            }),
        );
      }
    };
    // Phase 1 : sources indépendantes (HTTP en parallèle, navigateur 3 par 3). Phase 2 : sources qui dépendent des premières.
    const phase1 = defs.filter((d) => !d.after?.length);
    const phase2 = defs.filter((d) => d.after?.length);
    await Promise.all([runPool(phase1.filter((d) => !d.browser), 4, exec), runPool(phase1.filter((d) => d.browser), 3, exec)]);
    await runPool(phase2, 2, exec);

    const settings = getSettings();
    const defaults = { adCost: settings.defaultAdCost, shipping: settings.defaultShipping };
    let margin = computeMargin(a.inputs, a.sources, defaults);
    let ai: AiReport | null = null;
    let aiError: string | undefined;
    if (hasGemini()) {
      try {
        ai = await buildAiReport(a.inputs, keywords, a.sources, margin);
        if (a.inputs.mode === "occasion" && !a.inputs.buyPrice && ai.buyPriceEstimate) {
          margin = computeMargin(a.inputs, a.sources, defaults, ai.buyPriceEstimate);
        }
      } catch (e) {
        aiError = (e as Error).message;
      }
    } else {
      aiError = "Pas de clé Gemini : ajoute-la dans Réglages pour les critères qualitatifs, angles et accroches.";
    }
    const criteria = buildCriteria(a.inputs, a.sources, margin, ai);
    const score = scoreCriteria(criteria);
    const conf = computeConfidence(a.sources, criteria, Boolean(ai));
    const report: Report = {
      verdict: decideVerdict(score, criteria, conf.confidence),
      score,
      confidence: conf.confidence,
      confidenceDetail: conf.detail,
      criteria,
      margin,
      ai,
      aiError,
      generatedAt: new Date().toISOString(),
    };
    update((x) => {
      x.report = report;
      x.status = "done";
    });
  } catch (e) {
    update((x) => {
      x.status = "error";
      x.error = (e as Error).message;
    });
  } finally {
    g.__psRunning!.delete(id);
  }
}

/** Recalcule le rapport (sans recollecte) quand l'utilisateur modifie les prix. */
export function recomputeReport(a: Analysis): Analysis {
  if (!a.report) return a;
  const settings = getSettings();
  const margin = computeMargin(a.inputs, a.sources, { adCost: settings.defaultAdCost, shipping: settings.defaultShipping }, a.report.ai?.buyPriceEstimate);
  const criteria = buildCriteria(a.inputs, a.sources, margin, a.report.ai);
  const score = scoreCriteria(criteria);
  const conf = computeConfidence(a.sources, criteria, Boolean(a.report.ai));
  a.report = { ...a.report, margin, criteria, score, confidence: conf.confidence, confidenceDetail: conf.detail, verdict: decideVerdict(score, criteria, conf.confidence) };
  saveAnalysis(a);
  return a;
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
const expect = (v: unknown) => ({
  toBe: (e: unknown) => assert.equal(v, e),
  toBeNull: () => assert.equal(v, null),
  toMatch: (r: RegExp) => assert.match(String(v), r),
  not: { toContain: (e: unknown) => assert.ok(!(v as unknown[]).includes(e)) },
});
import { analyzeTrend, median, parseCount, parsePrice, trimOutliers } from "../stats";
import { computeMargin } from "../scoring/margin";
import { buildCriteria, decideVerdict, scoreCriteria } from "../scoring/criteria";
import { parseFrDate } from "../sources/common";
import { rankModels } from "../gemini";
import type { AiReport, Criterion, SourceResult } from "../types";

describe("parsing", () => {
  it("lit les prix français", () => {
    expect(parsePrice("8,29€")).toBe(8.29);
    expect(parsePrice("1 234,56 €")).toBe(1234.56);
    expect(parsePrice("20,43 EUR")).toBe(20.43);
    expect(parsePrice("12.99")).toBe(12.99);
    expect(parsePrice(null)).toBeNull();
  });
  it("lit les volumes", () => {
    expect(parseCount("+ 4 000 vendus")).toBe(4000);
    expect(parseCount("1,2 k")).toBe(1200);
    expect(parseCount("93 vendus")).toBe(93);
    expect(parseCount("164 résultats")).toBe(164);
  });
  it("lit les dates Meta", () => {
    expect(parseFrDate("12 août 2026")?.toISOString().slice(0, 10)).toBe("2026-08-12");
    expect(parseFrDate("3 sept. 2026")?.toISOString().slice(0, 10)).toBe("2026-09-03");
  });
  it("médiane et valeurs aberrantes", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(trimOutliers([10, 11, 12, 13, 12, 500])).not.toContain(500);
  });
});

describe("tendance", () => {
  it("détecte une hausse", () => {
    const pts = Array.from({ length: 104 }, (_, i) => ({ date: new Date(2024, 0, 1 + i * 7).toISOString(), value: i < 52 ? 20 : 40 }));
    const a = analyzeTrend(pts);
    expect(a.direction).toBe("hausse");
    expect(a.change12).toBe(100);
  });
});

describe("marge e-commerce", () => {
  const sources: Record<string, SourceResult> = {
    amazon: { id: "amazon", label: "", status: "ok", data: { medianPrice: 45 } },
    aliexpress: { id: "aliexpress", label: "", status: "ok", data: { medianPrice: 8 } },
  };
  it("calcule la marge nette avec pub et frais", () => {
    const m = computeMargin({ product: "x", mode: "ecommerce" }, sources, { adCost: 15, shipping: 3 });
    // 45 - 8 - 3 - (45*1.5% + 0.25 = 0.93) - 15 = 18.07
    expect(m.net).toBe(18.07);
    expect(m.sellPriceSource).toMatch(/Amazon/);
  });
  it("les prix saisis priment", () => {
    const m = computeMargin({ product: "x", mode: "ecommerce", sellPrice: 60, buyPrice: 10, adCost: 12 }, sources, { adCost: 15, shipping: 3 });
    expect(m.sellPrice).toBe(60);
    expect(m.net).toBe(60 - 10 - 3 - 1.15 - 12);
  });
});

describe("marge occasion", () => {
  it("utilise l'estimation IA si pas de prix d'achat", () => {
    const m = computeMargin(
      { product: "x", mode: "occasion" },
      { vinted: { id: "vinted", label: "", status: "ok", data: { medianPrice: 40 } } },
      { adCost: 15, shipping: 3 },
      8,
    );
    expect(m.buyPrice).toBe(8);
    expect(m.adCost).toBe(0);
    expect(m.multiple).toBe(5);
  });
});

describe("verdict", () => {
  const c = (id: string, rating: Criterion["rating"], weight = 10, eliminatory = false): Criterion => ({ id, label: id, question: "", rating, detail: "", source: "", weight, eliminatory });
  it("score pondéré, N/A exclus", () => {
    expect(scoreCriteria([c("a", "ok"), c("b", "not_ok"), c("c", "na")])).toBe(50);
  });
  it("données insuffisantes = creuser, pas abandonner", () => {
    expect(decideVerdict(0, [c("demand", "not_ok"), c("a", "na"), c("b", "na")], "faible")).toBe("creuser");
  });
  it("éliminatoire = abandonner", () => {
    expect(decideVerdict(90, [c("banned", "not_ok", 0, true)], "elevee")).toBe("abandonner");
  });
  it("marge Not ok empêche « tester »", () => {
    expect(decideVerdict(80, [c("margin", "not_ok")], "elevee")).toBe("creuser");
    expect(decideVerdict(80, [c("margin", "ok")], "elevee")).toBe("tester");
    expect(decideVerdict(80, [c("margin", "ok")], "faible")).toBe("creuser");
    expect(decideVerdict(80, [c("margin", "moyen")], "elevee")).toBe("creuser");
  });
  it("construit les critères e-commerce sans IA", () => {
    const margin = computeMargin({ product: "x", mode: "ecommerce", sellPrice: 50, buyPrice: 5 }, {}, { adCost: 15, shipping: 3 });
    const crit = buildCriteria({ product: "x", mode: "ecommerce" }, {}, margin, null as AiReport | null);
    expect(crit.find((x) => x.id === "price")?.rating).toBe("ok");
    expect(crit.find((x) => x.id === "margin")?.rating).toBe("ok");
    expect(crit.find((x) => x.id === "demo")?.rating).toBe("na");
  });
});

describe("modèles Gemini", () => {
  it("préfère le Flash stable le plus récent", () => {
    expect(rankModels(["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-3-flash-preview"])[0]).toBe("gemini-2.5-flash");
  });
});

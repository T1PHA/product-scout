export type Mode = "ecommerce" | "occasion";

export type SourceStatus = "pending" | "running" | "ok" | "empty" | "error" | "skipped";

export interface SourceResult<T = unknown> {
  id: string;
  label: string;
  status: SourceStatus;
  data?: T;
  error?: string;
  urls?: string[];
  durationMs?: number;
}

export type Rating = "ok" | "moyen" | "not_ok" | "na";

export interface Criterion {
  id: string;
  label: string;
  question: string;
  rating: Rating;
  detail: string;
  source: string;
  weight: number;
  eliminatory?: boolean;
}

export interface AnalysisInputs {
  product: string;
  mode: Mode;
  buyPrice?: number | null; // prix d'achat connu (€)
  sellPrice?: number | null; // prix de vente visé (€)
  adCost?: number | null; // coût pub par vente (€), e-commerce
  shippingCost?: number | null; // livraison fournisseur ou envoi (€)
  notes?: string;
}

export interface Keywords {
  fr: string;
  en: string;
  short: string; // version courte pour Trends
  category: string;
}

export interface MarginBreakdown {
  sellPrice: number | null;
  sellPriceSource: string;
  buyPrice: number | null;
  buyPriceSource: string;
  shipping: number;
  fees: number;
  feesLabel: string;
  adCost: number;
  net: number | null;
  marginPct: number | null;
  multiple: number | null;
}

export interface AiReport {
  summary: string;
  verdictReason: string;
  judged: Record<string, { rating: Rating; detail: string }>;
  banned: { flagged: boolean; reasons: string[] };
  psychology: {
    mainLever: string;
    secondaryLevers: string[];
    pain: string;
    transformation: string;
    mirrorPhrases: string[];
    uniqueMechanism: string;
  };
  angles: { name: string; audience: string; message: string; untapped: boolean }[];
  hooks: string[];
  range: string[];
  risks: string[];
  testPlan: { budget: string; steps: string[]; continueIf: string; stopIf: string };
  sourcing: string[];
  buyPriceEstimate?: number | null;
}

export type Verdict = "tester" | "creuser" | "abandonner";

export interface Report {
  verdict: Verdict;
  score: number;
  confidence: "elevee" | "moyenne" | "faible";
  confidenceDetail: string;
  criteria: Criterion[];
  margin: MarginBreakdown;
  ai: AiReport | null;
  aiError?: string;
  generatedAt: string;
}

export interface Analysis {
  id: string;
  createdAt: string;
  status: "running" | "done" | "error";
  inputs: AnalysisInputs;
  keywords?: Keywords;
  sources: Record<string, SourceResult>;
  report?: Report;
  error?: string;
}

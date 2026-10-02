import { z } from "zod";
import { listAnalyses } from "@/lib/db";
import { createAnalysis } from "@/lib/runner";

export const dynamic = "force-dynamic";

const optNum = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().positive().nullable().optional());

const Body = z.object({
  product: z.string().trim().min(2).max(200),
  mode: z.enum(["ecommerce", "occasion"]),
  buyPrice: optNum,
  sellPrice: optNum,
  adCost: optNum,
  shippingCost: optNum,
  notes: z.string().max(1000).optional(),
});

export async function GET() {
  const list = listAnalyses().map((a) => ({
    id: a.id,
    createdAt: a.createdAt,
    status: a.status,
    product: a.inputs.product,
    mode: a.inputs.mode,
    verdict: a.report?.verdict ?? null,
    score: a.report?.score ?? null,
    confidence: a.report?.confidence ?? null,
    net: a.report?.margin.net ?? null,
    sellPrice: a.report?.margin.sellPrice ?? null,
    criteria: a.report?.criteria.map((c) => ({ id: c.id, label: c.label, rating: c.rating })) ?? [],
  }));
  return Response.json(list);
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Données invalides", issues: parsed.error.issues }, { status: 400 });
  const a = createAnalysis(parsed.data);
  return Response.json({ id: a.id });
}

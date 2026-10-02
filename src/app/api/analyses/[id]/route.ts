import { deleteAnalysis, getAnalysis, saveAnalysis } from "@/lib/db";
import { recomputeReport } from "@/lib/runner";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/analyses/[id]">) {
  const { id } = await ctx.params;
  const a = getAnalysis(id);
  return a ? Response.json(a) : Response.json({ error: "Analyse introuvable" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/analyses/[id]">) {
  const { id } = await ctx.params;
  deleteAnalysis(id);
  return Response.json({ ok: true });
}

/** Modifie les prix saisis et recalcule marge, critères et verdict sans recollecter. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/analyses/[id]">) {
  const { id } = await ctx.params;
  const a = getAnalysis(id);
  if (!a) return Response.json({ error: "Analyse introuvable" }, { status: 404 });
  const body = (await req.json()) as Record<string, unknown>;
  const num = (v: unknown) => (v === "" || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  for (const k of ["buyPrice", "sellPrice", "adCost", "shippingCost"] as const) {
    if (k in body) a.inputs[k] = num(body[k]);
  }
  saveAnalysis(a);
  return Response.json(recomputeReport(a));
}

import { getAnalysis } from "@/lib/db";
import { exportToSheet } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: RouteContext<"/api/analyses/[id]/sheet">) {
  const { id } = await ctx.params;
  const a = getAnalysis(id);
  if (!a?.report) return Response.json({ ok: false, error: "Analyse non terminée" }, { status: 400 });
  return Response.json(await exportToSheet(a));
}

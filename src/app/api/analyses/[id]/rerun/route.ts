import { rerunAnalysis } from "@/lib/runner";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/analyses/[id]/rerun">) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { sources?: string[] };
  const a = rerunAnalysis(id, body.sources?.length ? body.sources : undefined);
  return a ? Response.json({ ok: true }) : Response.json({ error: "Analyse introuvable" }, { status: 404 });
}

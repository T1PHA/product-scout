import { getSettings, saveSettings } from "@/lib/db";
import { listModels } from "@/lib/gemini";

export const dynamic = "force-dynamic";

function publicSettings() {
  const s = getSettings();
  return { ...s, geminiKey: s.geminiKey ? `${s.geminiKey.slice(0, 6)}…${s.geminiKey.slice(-4)}` : "", hasKey: Boolean(s.geminiKey) };
}

export async function GET() {
  return Response.json(publicSettings());
}

export async function POST(req: Request) {
  const body = (await req.json()) as { geminiKey?: string; geminiModel?: string; defaultAdCost?: number; defaultShipping?: number };
  const patch: Record<string, unknown> = {};
  if (body.geminiKey !== undefined && !body.geminiKey.includes("…")) {
    const key = body.geminiKey.trim();
    if (key) {
      try {
        const models = await listModels(key);
        patch.geminiKey = key;
        patch.geminiModel = models[0] ?? "";
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    } else {
      patch.geminiKey = "";
    }
  }
  if (body.geminiModel !== undefined && patch.geminiModel === undefined) patch.geminiModel = body.geminiModel;
  if (body.defaultAdCost != null) patch.defaultAdCost = Number(body.defaultAdCost);
  if (body.defaultShipping != null) patch.defaultShipping = Number(body.defaultShipping);
  saveSettings(patch);
  let models: string[] = [];
  const key = getSettings().geminiKey;
  if (key) models = await listModels(key).catch(() => []);
  return Response.json({ ...publicSettings(), models });
}

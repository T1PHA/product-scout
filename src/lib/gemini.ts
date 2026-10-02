import { getSettings, saveSettings } from "./db";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

interface ModelInfo {
  name: string;
  supportedGenerationMethods?: string[];
}

/** Classe les modèles Flash disponibles : version la plus haute, stable avant preview, lite en dernier. */
export function rankModels(names: string[]): string[] {
  const score = (n: string) => {
    const v = parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? "0");
    let s = v * 100;
    if (/lite/.test(n)) s -= 50;
    if (/preview|exp/.test(n)) s -= 100; // stable d'abord : les previews ont des quotas gratuits plus serrés
    if (/pro/.test(n)) s -= 5; // pro : quotas gratuits très faibles
    return s;
  };
  return names
    .filter((n) => /gemini-\d/.test(n) && /flash|pro/.test(n) && !/image|tts|audio|live|embedding|thinking/.test(n))
    .sort((a, b) => score(b) - score(a));
}

export async function listModels(key: string): Promise<string[]> {
  const r = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}&pageSize=200`);
  if (!r.ok) throw new Error(`Clé Gemini refusée (${r.status}) : ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { models?: ModelInfo[] };
  const names = (j.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
  return rankModels(names);
}

export function hasGemini(): boolean {
  return Boolean(getSettings().geminiKey);
}

async function candidateModels(key: string): Promise<string[]> {
  const s = getSettings();
  if (s.geminiModel) return [s.geminiModel, "gemini-2.5-flash", "gemini-2.0-flash"].filter((v, i, a) => a.indexOf(v) === i);
  try {
    const ranked = await listModels(key);
    if (ranked[0]) saveSettings({ geminiModel: ranked[0] });
    return ranked.slice(0, 3);
  } catch {
    return ["gemini-2.5-flash", "gemini-2.0-flash"];
  }
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error("Réponse Gemini illisible (JSON invalide)");
  }
}

/** Appelle Gemini et renvoie un objet JSON. Réessaie sur quota/surcharge, bascule de modèle si besoin. */
export async function geminiJson<T>(prompt: string, opts: { temperature?: number } = {}): Promise<T> {
  const key = getSettings().geminiKey;
  if (!key) throw new Error("Clé Gemini manquante (Réglages)");
  const models = await candidateModels(key);
  let lastErr = "";
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: opts.temperature ?? 0.4 },
        }),
      });
      if (r.ok) {
        const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (!text) {
          lastErr = `${model} : réponse vide`;
          break;
        }
        return extractJson(text) as T;
      }
      lastErr = `${model} : ${r.status} ${(await r.text()).slice(0, 200)}`;
      if (r.status === 429 || r.status >= 500) {
        await new Promise((res) => setTimeout(res, 4000 * (attempt + 1)));
        continue;
      }
      break; // 400/404 : on passe au modèle suivant
    }
  }
  throw new Error(`Gemini indisponible. ${lastErr}`);
}

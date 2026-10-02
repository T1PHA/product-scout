// Résolution des imports TypeScript sans extension pour node --test (type stripping natif).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "..", "..");

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  if ((specifier.startsWith(".") || specifier.startsWith("file:")) && !path.extname(specifier)) {
    const base = specifier.startsWith("file:") ? fileURLToPath(specifier) : fileURLToPath(new URL(specifier, context.parentURL));
    for (const c of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(base + c)) return next(pathToFileURL(base + c).href, context);
    }
  }
  return next(specifier, context);
}

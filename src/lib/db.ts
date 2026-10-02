import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const g = globalThis as unknown as { __psDb?: DatabaseSync };

function db(): DatabaseSync {
  if (!g.__psDb) {
    const d = new DatabaseSync(path.join(DATA_DIR, "product-scout.db"));
    d.exec(`
      CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    g.__psDb = d;
  }
  return g.__psDb;
}

export function saveAnalysis(a: Analysis) {
  db()
    .prepare("INSERT INTO analyses (id, created_at, json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json")
    .run(a.id, a.createdAt, JSON.stringify(a));
}

export function getAnalysis(id: string): Analysis | null {
  const row = db().prepare("SELECT json FROM analyses WHERE id = ?").get(id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as Analysis) : null;
}

export function listAnalyses(): Analysis[] {
  const rows = db().prepare("SELECT json FROM analyses ORDER BY created_at DESC").all() as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as Analysis);
}

export function deleteAnalysis(id: string) {
  db().prepare("DELETE FROM analyses WHERE id = ?").run(id);
}

export interface Settings {
  geminiKey: string;
  geminiModel: string;
  defaultAdCost: number;
  defaultShipping: number;
  sheetExportEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: "",
  defaultAdCost: 15,
  defaultShipping: 3,
  sheetExportEnabled: true,
};

export function getSettings(): Settings {
  const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = JSON.parse(r.value);
  if (!s.geminiKey && process.env.GEMINI_API_KEY) s.geminiKey = process.env.GEMINI_API_KEY;
  return s as unknown as Settings;
}

export function saveSettings(patch: Partial<Settings>) {
  const stmt = db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) stmt.run(k, JSON.stringify(v));
  }
}

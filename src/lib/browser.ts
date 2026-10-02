import { chromium, type BrowserContext, type Page } from "playwright-core";
import path from "node:path";
import os from "node:os";

// Profil persistant : les connexions faites une fois (eBay, Facebook...) sont conservées.
export const PROFILE_DIR = path.join(os.homedir(), ".product-scout", "browser-profile");

const g = globalThis as unknown as { __psCtx?: Promise<BrowserContext>; __psVisible?: boolean };

const ARGS_HIDDEN = ["--window-position=-32000,-32000", "--disable-blink-features=AutomationControlled"];

async function launch(visible: boolean): Promise<BrowserContext> {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: process.env.PS_BROWSER_CHANNEL || "msedge",
    // Fenêtre réelle placée hors écran : beaucoup moins bloquée que le mode headless.
    headless: false,
    locale: "fr-FR",
    viewport: visible ? null : { width: 1366, height: 900 },
    args: visible ? ["--disable-blink-features=AutomationControlled", "--start-maximized"] : ARGS_HIDDEN,
  });
  ctx.on("close", () => {
    g.__psCtx = undefined;
  });
  return ctx;
}

export async function getContext(): Promise<BrowserContext> {
  if (!g.__psCtx) {
    g.__psVisible = false;
    g.__psCtx = launch(false).catch((e) => {
      g.__psCtx = undefined;
      throw e;
    });
  }
  return g.__psCtx;
}

/** Ouvre une fenêtre visible pour que l'utilisateur se connecte à ses comptes. */
export async function openLoginWindow(urls: string[]) {
  if (g.__psCtx) {
    const old = await g.__psCtx.catch(() => null);
    await old?.close().catch(() => {});
    g.__psCtx = undefined;
  }
  g.__psVisible = true;
  const ctx = await launch(true);
  g.__psCtx = Promise.resolve(ctx);
  const first = ctx.pages()[0] ?? (await ctx.newPage());
  await first.goto(urls[0]).catch(() => {});
  for (const u of urls.slice(1)) {
    const p = await ctx.newPage();
    await p.goto(u).catch(() => {});
  }
}

export async function closeBrowser() {
  const ctx = await g.__psCtx?.catch(() => null);
  await ctx?.close().catch(() => {});
  g.__psCtx = undefined;
}

export async function withPage<T>(url: string, fn: (p: Page) => Promise<T>, opts: { wait?: number; timeout?: number } = {}): Promise<T> {
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts.timeout ?? 45000 });
    if (opts.wait) await page.waitForTimeout(opts.wait);
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

import { chromium } from "playwright-core";
const out = process.env.SHOTS;
const b = await chromium.launch({ channel: "msedge", headless: true });
for (const [name, url, w] of [["home", "/", 1366], ["report", "/analyse/" + process.argv[2], 1366], ["report-mobile", "/analyse/" + process.argv[2], 390], ["compare", "/comparer", 1366], ["settings", "/reglages", 1366]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto("http://localhost:3077" + url, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  await p.close();
}
await b.close();

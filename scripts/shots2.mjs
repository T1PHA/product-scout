import { chromium } from "playwright-core";
const [id, w = "1366"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "msedge", headless: true });
const p = await b.newPage({ viewport: { width: +w, height: 1000 } });
await p.goto("http://localhost:3077/analyse/" + id, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const h = await p.evaluate(() => document.body.scrollHeight);
let i = 0;
for (let y = 0; y < h && i < 12; y += 1000, i++) {
  await p.screenshot({ path: `${process.env.SHOTS}/r${w}-${i}.png`, clip: { x: 0, y, width: +w, height: Math.min(1000, h - y) }, fullPage: true });
}
console.log("height", h, "shots", i);
await b.close();

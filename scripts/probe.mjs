// Sonde rapide des sources : node scripts/probe.mjs "harnais anti traction chien"
import { chromium } from "playwright-core";

const q = process.argv[2] || "harnais anti traction chien";
const enc = encodeURIComponent(q);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

async function http(name, url, opts = {}) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, ...(opts.headers || {}) } });
    const t = await r.text();
    console.log(`[${name}] ${r.status} len=${t.length} :: ${t.slice(0, opts.peek ?? 200).replace(/\s+/g, " ")}`);
  } catch (e) {
    console.log(`[${name}] ERR ${e.message}`);
  }
}

await http("frankfurter", "https://api.frankfurter.dev/v1/latest?base=CNY&symbols=EUR,USD");
await http("wikipedia-search", `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc}&format=json&srlimit=3`);
await http("reddit", `https://www.reddit.com/search.json?q=${enc}&limit=5`);
await http("sellerscalc", "https://www.sellerscalc.com/data", { peek: 400 });
await http("youtube", `https://www.youtube.com/results?search_query=${enc}&hl=fr`, { peek: 80 });
await http("amazon-fetch", `https://www.amazon.fr/s?k=${enc}`, { peek: 120 });
await http("ebay-fetch", `https://www.ebay.fr/sch/i.html?_nkw=${enc}&LH_Sold=1&LH_Complete=1`, { peek: 120 });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ locale: "fr-FR", userAgent: UA, viewport: { width: 1366, height: 900 } });

async function page(name, url, fn) {
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForTimeout(4000);
    const out = await fn(p);
    console.log(`[${name}] ${JSON.stringify(out).slice(0, 400)}`);
  } catch (e) {
    console.log(`[${name}] ERR ${e.message.split("\n")[0]}`);
  } finally {
    await p.close();
  }
}

await page("trends", "https://trends.google.com/trends/?geo=FR", async (p) => {
  const req = JSON.stringify({ comparisonItem: [{ keyword: q, geo: "FR", time: "today 5-y" }], category: 0, property: "" });
  return p.evaluate(async (req) => {
    const r = await fetch(`/trends/api/explore?hl=fr&tz=-120&req=${encodeURIComponent(req)}`);
    const t = await r.text();
    return { status: r.status, body: t.slice(0, 300) };
  }, req);
});

await page("vinted", "https://www.vinted.fr/", async (p) =>
  p.evaluate(async (enc) => {
    const r = await fetch(`/api/v2/catalog/items?search_text=${enc}&per_page=20`);
    const t = await r.text();
    return { status: r.status, body: t.slice(0, 300) };
  }, enc),
);

await page("ebay-sold", `https://www.ebay.fr/sch/i.html?_nkw=${enc}&LH_Sold=1&LH_Complete=1`, async (p) =>
  p.evaluate(() => ({
    title: document.title,
    count: document.querySelector(".srp-controls__count-heading")?.textContent,
    items: [...document.querySelectorAll("li.s-item, li.s-card")].slice(0, 3).map((e) => e.innerText.slice(0, 120)),
  })),
);

await page("amazon", `https://www.amazon.fr/s?k=${enc}`, async (p) =>
  p.evaluate(() => ({
    title: document.title,
    n: document.querySelectorAll('[data-component-type="s-search-result"]').length,
    first: document.querySelector('[data-component-type="s-search-result"]')?.innerText.slice(0, 200),
  })),
);

await page("aliexpress", `https://fr.aliexpress.com/w/wholesale-${q.replace(/\s+/g, "-")}.html`, async (p) =>
  p.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 300) })),
);

await page("alibaba", `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent("dog no pull harness")}`, async (p) =>
  p.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 300) })),
);

await page(
  "meta-ads",
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=FR&q=${enc}&search_type=keyword_unordered&media_type=all`,
  async (p) => {
    await p.waitForTimeout(4000);
    return p.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 500) }));
  },
);

await page("tiktok-cc", "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/fr", async (p) =>
  p.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 300) })),
);

await page("etsy", `https://www.etsy.com/fr/search?q=${enc}`, async (p) =>
  p.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 200) })),
);

await browser.close();

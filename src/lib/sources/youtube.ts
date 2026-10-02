import { median, parseCount } from "../stats";
import { getText, type SourceDef } from "./common";

export interface YtVideo {
  title: string;
  channel: string;
  views: number | null;
  published: string | null;
  url: string;
  isShort: boolean;
}

export interface YoutubeData {
  query: string;
  videos: YtVideo[];
  medianViews: number | null;
  totalViews: number;
  shorts: number;
}

type Json = Record<string, unknown>;

function findAll(node: unknown, key: string, out: Json[] = []): Json[] {
  if (Array.isArray(node)) for (const n of node) findAll(n, key, out);
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Json)) {
      if (k === key) out.push(v as Json);
      else findAll(v, key, out);
    }
  }
  return out;
}

const txt = (o: unknown): string => {
  const j = o as { simpleText?: string; runs?: { text: string }[] } | undefined;
  return j?.simpleText ?? j?.runs?.map((r) => r.text).join("") ?? "";
};

export const youtube: SourceDef<YoutubeData> = {
  id: "youtube",
  label: "YouTube (vidéos de démonstration)",
  modes: ["ecommerce", "occasion"],
  browser: false,
  timeoutMs: 30_000,
  async run({ keywords }) {
    const query = keywords.fr;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=fr&gl=FR`;
    const html = await getText(url);
    const m = html.match(/var ytInitialData = (\{[\s\S]+?\});<\/script>/);
    if (!m) throw new Error("Structure YouTube inattendue");
    const data = JSON.parse(m[1]);
    const videos: YtVideo[] = findAll(data, "videoRenderer")
      .slice(0, 25)
      .map((v) => {
        const id = v.videoId as string;
        return {
          title: txt(v.title).slice(0, 160),
          channel: txt(v.ownerText),
          views: parseCount(txt(v.viewCountText)),
          published: txt(v.publishedTimeText) || null,
          url: `https://www.youtube.com/watch?v=${id}`,
          isShort: false,
        };
      });
    const shorts = findAll(data, "reelItemRenderer").length + findAll(data, "shortsLockupViewModel").length;
    const views = videos.map((v) => v.views ?? 0);
    return {
      data: { query, videos, medianViews: median(views), totalViews: views.reduce((s, x) => s + x, 0), shorts },
      urls: [url],
      empty: videos.length === 0,
    };
  },
};

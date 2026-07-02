import Anthropic from "@anthropic-ai/sdk";
import { createBrandHistoryEntry, findRecentSimilarBrandEvent, getSetting, listDistinctBrands, setSetting } from "./queries";

const EVENT_TYPES = ["New CMO", "Brand Refresh / Rebrand", "Major ATL Campaign"] as const;
type EventType = (typeof EVENT_TYPES)[number];

// Same underlying story covered by several outlets in one week should
// produce one Brand Histories entry, not five.
const DEDUP_WINDOW_DAYS = 21;

// NewsData.io's free tier caps out at 200 requests/day AND throttles to
// 30 requests per 15 minutes (~1 every 30s) — with 600+ distinct brands in
// this dataset, one request per brand per day isn't possible on this plan.
// Instead we pace requests safely under that throttle and only scan a
// rotating slice of the brand list each run (see nextBrandBatch below), so
// every brand gets checked every few days rather than daily, for free.
export const MIN_REQUEST_INTERVAL_MS = 34_000;
export const DAILY_SCAN_BATCH_SIZE = 180; // safely under the 200/day cap
export const MANUAL_SCAN_BATCH_SIZE = 10; // small enough to wait on (~6 min)

const CURSOR_KEY = "brand_scan_cursor";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Picks the next `batchSize` brands starting where the last run (manual or
// scheduled) left off, wrapping around the full alphabetical list. The
// cursor only advances once a batch has actually been scanned.
function nextBrandBatch(batchSize: number): { batch: string[]; allBrands: string[] } {
  const allBrands = listDistinctBrands();
  if (allBrands.length === 0) return { batch: [], allBrands };
  const cursorRaw = getSetting(CURSOR_KEY);
  const cursor = cursorRaw ? Number(cursorRaw) % allBrands.length : 0;
  const size = Math.min(batchSize, allBrands.length);
  const batch = Array.from({ length: size }, (_, i) => allBrands[(cursor + i) % allBrands.length]);
  return { batch, allBrands };
}

function advanceCursor(count: number, totalBrands: number) {
  if (totalBrands === 0) return;
  const cursorRaw = getSetting(CURSOR_KEY);
  const cursor = cursorRaw ? Number(cursorRaw) % totalBrands : 0;
  setSetting(CURSOR_KEY, String((cursor + count) % totalBrands));
}

interface NewsHeadline {
  title: string;
  description: string | null;
  url: string | null;
  pubDate: string | null;
}

async function fetchNewsForBrand(brand: string, apiKey: string): Promise<NewsHeadline[]> {
  const url = new URL("https://newsdata.io/api/1/latest");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("q", brand);
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`NewsData.io request failed (${res.status})`);
  }
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((r: Record<string, unknown>) => ({
    title: typeof r.title === "string" ? r.title : "",
    description: typeof r.description === "string" ? r.description : null,
    url: typeof r.link === "string" ? r.link : null,
    pubDate: typeof r.pubDate === "string" ? r.pubDate : null,
  }));
}

interface Classification {
  index: number;
  relevant: boolean;
  eventType: EventType | null;
  reason: string;
}

async function classifyHeadlines(brand: string, headlines: NewsHeadline[]): Promise<Classification[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on this deployment.");
  const client = new Anthropic({ apiKey });

  const list = headlines
    .map((h, i) => `${i}. "${h.title}"${h.description ? ` — ${h.description}` : ""}`)
    .join("\n");

  const prompt = `We're monitoring news coverage of the brand "${brand}" for our outreach tracker. For each numbered headline below, decide:
1. Is this genuinely about "${brand}" the brand/company (not an unrelated use of the same word)?
2. If relevant, does it report one of exactly these three event types: "New CMO" (a new chief marketing officer or senior marketing leader appointed), "Brand Refresh / Rebrand" (a rebrand, new visual identity, or brand refresh), or "Major ATL Campaign" (a new major above-the-line advertising campaign launch)?

Headlines:
${list}

Reply with ONLY a JSON array, one object per headline, in this exact shape, no other text:
[{"index": 0, "relevant": true, "eventType": "New CMO", "reason": "one short sentence"}]

Use eventType: null and relevant: false for anything that doesn't clearly match one of the three types.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  try {
    const match = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => typeof p.index === "number")
      .map((p) => ({
        index: p.index,
        relevant: !!p.relevant,
        eventType: EVENT_TYPES.includes(p.eventType) ? p.eventType : null,
        reason: typeof p.reason === "string" ? p.reason : "",
      }));
  } catch {
    return [];
  }
}

export interface ScanResult {
  brandsScanned: number;
  totalBrands: number;
  newEntries: number;
  errors: string[];
}

export async function scanBrandNews(batchSize: number): Promise<ScanResult> {
  const newsApiKey = process.env.NEWSDATA_API_KEY;
  if (!newsApiKey) {
    throw new Error("NEWSDATA_API_KEY is not configured on this deployment.");
  }

  const { batch, allBrands } = nextBrandBatch(batchSize);
  const errors: string[] = [];
  let newEntries = 0;

  const sinceDate = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < batch.length; i++) {
    const brand = batch[i];
    try {
      const headlines = await fetchNewsForBrand(brand, newsApiKey);
      if (headlines.length > 0) {
        const classifications = await classifyHeadlines(brand, headlines);
        for (const c of classifications) {
          if (!c.relevant || !c.eventType) continue;
          const headline = headlines[c.index];
          if (!headline) continue;

          const existing = findRecentSimilarBrandEvent(brand, c.eventType, sinceDate);
          if (existing) continue;

          createBrandHistoryEntry({
            brand,
            eventType: c.eventType,
            date: today,
            note: headline.title,
            source: "news_api",
            articleUrl: headline.url,
            status: "pending",
          });
          newEntries++;
        }
      }
    } catch (e) {
      errors.push(`${brand}: ${(e as Error).message}`);
    }

    // Stay comfortably under NewsData.io's 30-requests-per-15-minutes throttle.
    if (i < batch.length - 1) await sleep(MIN_REQUEST_INTERVAL_MS);
  }

  advanceCursor(batch.length, allBrands.length);

  return { brandsScanned: batch.length, totalBrands: allBrands.length, newEntries, errors };
}

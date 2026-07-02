import Anthropic from "@anthropic-ai/sdk";
import { createBrandHistoryEntry, findRecentSimilarBrandEvent, listDistinctBrands } from "./queries";

const EVENT_TYPES = ["New CMO", "Brand Refresh / Rebrand", "Major ATL Campaign"] as const;
type EventType = (typeof EVENT_TYPES)[number];

// Same underlying story covered by several outlets in one week should
// produce one Brand Histories entry, not five.
const DEDUP_WINDOW_DAYS = 21;

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
  newEntries: number;
  errors: string[];
}

export async function scanBrandNews(): Promise<ScanResult> {
  const newsApiKey = process.env.NEWSDATA_API_KEY;
  if (!newsApiKey) {
    throw new Error("NEWSDATA_API_KEY is not configured on this deployment.");
  }

  const brands = listDistinctBrands();
  const errors: string[] = [];
  let newEntries = 0;

  const sinceDate = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  for (const brand of brands) {
    try {
      const headlines = await fetchNewsForBrand(brand, newsApiKey);
      if (headlines.length === 0) continue;

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
    } catch (e) {
      errors.push(`${brand}: ${(e as Error).message}`);
    }
  }

  return { brandsScanned: brands.length, newEntries, errors };
}

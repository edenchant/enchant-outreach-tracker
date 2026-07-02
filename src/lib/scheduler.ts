import { getSetting, setSetting } from "./queries";
import { scanBrandNews, DAILY_SCAN_BATCH_SIZE, type ScanResult } from "./brand-news";

// Render's persistent disk can only be mounted on one service, so a separate
// Render "Cron Job" resource couldn't share this SQLite file. Instead, the
// one always-on web service checks hourly whether a day has passed since the
// last *scheduled* scan, and runs it in-process if so.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LAST_RUN_KEY = "brand_scan_last_run";
const LAST_SCHEDULED_RUN_KEY = "brand_scan_last_scheduled_run";
const LAST_RESULT_KEY = "brand_scan_last_result";

let started = false;

export function startBrandNewsScheduler() {
  if (started) return;
  started = true;
  runIfDue().catch(() => {});
  setInterval(() => {
    runIfDue().catch(() => {});
  }, CHECK_INTERVAL_MS);
}

async function runIfDue() {
  if (!process.env.NEWSDATA_API_KEY) return;
  const last = getSetting(LAST_SCHEDULED_RUN_KEY);
  const lastRun = last ? new Date(last).getTime() : 0;
  if (Date.now() - lastRun < SCAN_INTERVAL_MS) return;
  await runScanNow(DAILY_SCAN_BATCH_SIZE, "scheduled");
}

export async function runScanNow(batchSize: number, source: "scheduled" | "manual" = "manual"): Promise<ScanResult> {
  // Recorded before the scan runs so a slow scan can't overlap with the next
  // hourly check. Manual spot-checks deliberately don't reset the scheduled
  // daily clock — only a "scheduled" run does — so clicking the button
  // doesn't delay that day's full rotation batch.
  const now = new Date().toISOString();
  setSetting(LAST_RUN_KEY, now);
  if (source === "scheduled") setSetting(LAST_SCHEDULED_RUN_KEY, now);
  try {
    const result = await scanBrandNews(batchSize);
    setSetting(LAST_RESULT_KEY, JSON.stringify({ ...result, finishedAt: new Date().toISOString(), ok: true }));
    return result;
  } catch (e) {
    setSetting(LAST_RESULT_KEY, JSON.stringify({ error: (e as Error).message, finishedAt: new Date().toISOString(), ok: false }));
    throw e;
  }
}

export interface LastScanSummary {
  lastRunAt: string | null;
  brandsScanned?: number;
  totalBrands?: number;
  newEntries?: number;
  errors?: string[];
  error?: string;
  ok?: boolean;
}

export function getLastScanSummary(): LastScanSummary {
  const lastRunAt = getSetting(LAST_RUN_KEY);
  const resultRaw = getSetting(LAST_RESULT_KEY);
  if (!resultRaw) return { lastRunAt };
  try {
    return { lastRunAt, ...JSON.parse(resultRaw) };
  } catch {
    return { lastRunAt };
  }
}

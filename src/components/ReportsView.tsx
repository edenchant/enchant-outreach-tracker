import Link from "next/link";
import type { BrandEngagementRow, Segment, WeeklyReportRow } from "@/lib/types";
import SegmentTabs from "./SegmentTabs";
import Waveform from "./Waveform";
import BrandEngagementChart from "./BrandEngagementChart";

// A "very simple" heat map: how far each week sits from that column's own
// average, bucketed into two steps per side so the shading reads at a
// glance rather than as a precise gradient. Diffs under 0.5 are treated as
// "about average" (neutral) rather than red/green — otherwise a column
// that's mostly zeros with one busy week paints almost every cell red.
function heatClass(value: number, columnValues: number[]): string {
  const mean = columnValues.reduce((sum, v) => sum + v, 0) / columnValues.length;
  const diff = value - mean;
  if (Math.abs(diff) < 0.5) return "";
  const maxAbsDiff = Math.max(...columnValues.map((v) => Math.abs(v - mean)), 1);
  const strong = Math.abs(diff) / maxAbsDiff > 0.5;
  return diff > 0 ? (strong ? "heat-pos-strong" : "heat-pos-light") : strong ? "heat-neg-strong" : "heat-neg-light";
}

export default function ReportsView({
  segments,
  weeks,
  brandEngagement,
  minContacts,
}: {
  segments: Segment[];
  weeks: WeeklyReportRow[];
  brandEngagement: { top: BrandEngagementRow[]; bottom: BrandEngagementRow[] };
  minContacts: number;
}) {
  const thisWeek = weeks[0];
  const totalEmails = weeks.reduce((sum, w) => sum + w.emails, 0);
  const totalLinkedinAdds = weeks.reduce((sum, w) => sum + w.linkedinAdds, 0);
  const emailValues = weeks.map((w) => w.emails);
  const linkedinValues = weeks.map((w) => w.linkedinAdds);
  const totalValues = weeks.map((w) => w.total);

  return (
    <div className="wrap">
      <SegmentTabs segments={segments} activeSlug="" />

      <header className="top">
        <div>
          <p className="eyebrow">Enchant · reports</p>
          <h1>Weekly Outreach Report</h1>
        </div>
        <div className="top-actions">
          <Link href="/linkedin-queue" className="btn">
            LinkedIn queue
          </Link>
          <Link href="/brand-histories" className="btn">
            Brand histories
          </Link>
          <Link href="/" className="btn">
            ← Back to queue
          </Link>
        </div>
        <Waveform />
      </header>

      <div className="stats">
        <div className="stat total">
          <div className="num">{thisWeek.emails}</div>
          <div className="label">Emails this week</div>
        </div>
        <div className="stat total">
          <div className="num">{thisWeek.linkedinAdds}</div>
          <div className="label">LinkedIn adds this week</div>
        </div>
        <div className="stat total">
          <div className="num">{totalEmails}</div>
          <div className="label">Emails, last {weeks.length} weeks</div>
        </div>
        <div className="stat total">
          <div className="num">{totalLinkedinAdds}</div>
          <div className="label">LinkedIn adds, last {weeks.length} weeks</div>
        </div>
      </div>

      <table className="settings-table heat-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Emails</th>
            <th>LinkedIn adds</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart}>
              <td>{w.weekLabel}</td>
              <td className={heatClass(w.emails, emailValues)}>{w.emails}</td>
              <td className={heatClass(w.linkedinAdds, linkedinValues)}>{w.linkedinAdds}</td>
              <td className={heatClass(w.total, totalValues)}>{w.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="heat-legend">
        <span className="heat-legend-label">Below average</span>
        <span className="heat-swatch heat-neg-strong" />
        <span className="heat-swatch heat-neg-light" />
        <span className="heat-swatch" />
        <span className="heat-swatch heat-pos-light" />
        <span className="heat-swatch heat-pos-strong" />
        <span className="heat-legend-label">Above average</span>
      </div>

      <div className="footnote">
        Weeks run Monday–Sunday. &quot;LinkedIn adds&quot; counts each contact&apos;s very first outreach touch,
        matching the weekly allowance tracked on the LinkedIn queue page. &quot;Emails&quot; counts every other time a
        contact was marked contacted — the app doesn&apos;t record channel separately, so this assumes all outreach
        after the initial LinkedIn add happens by email. Shading compares each week to that column&apos;s own average
        across the {weeks.length} weeks shown.
      </div>

      <BrandEngagementChart
        segments={segments}
        initialTop={brandEngagement.top}
        initialBottom={brandEngagement.bottom}
        minContacts={minContacts}
      />
    </div>
  );
}

import Link from "next/link";
import type { Segment, WeeklyReportRow } from "@/lib/types";
import SegmentTabs from "./SegmentTabs";
import Waveform from "./Waveform";

export default function ReportsView({ segments, weeks }: { segments: Segment[]; weeks: WeeklyReportRow[] }) {
  const thisWeek = weeks[0];
  const totalEmails = weeks.reduce((sum, w) => sum + w.emails, 0);
  const totalLinkedinAdds = weeks.reduce((sum, w) => sum + w.linkedinAdds, 0);

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

      <table className="settings-table">
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
              <td>{w.emails}</td>
              <td>{w.linkedinAdds}</td>
              <td>{w.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="footnote">
        Weeks run Monday–Sunday. &quot;LinkedIn adds&quot; counts each contact&apos;s very first outreach touch,
        matching the weekly allowance tracked on the LinkedIn queue page. &quot;Emails&quot; counts every other time a
        contact was marked contacted — the app doesn&apos;t record channel separately, so this assumes all outreach
        after the initial LinkedIn add happens by email.
      </div>
    </div>
  );
}

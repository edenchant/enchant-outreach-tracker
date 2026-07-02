// Small level-meter under a stat tile's number — bar count lit is the real
// value's share of the total, not decoration standing in for data.
export default function StatMeter({ value, total, bars = 8 }: { value: number; total: number; bars?: number }) {
  const lit = total > 0 ? Math.max(value > 0 ? 1 : 0, Math.round((value / total) * bars)) : 0;
  return (
    <div className="meter" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className={i < lit ? "lit" : ""} />
      ))}
    </div>
  );
}

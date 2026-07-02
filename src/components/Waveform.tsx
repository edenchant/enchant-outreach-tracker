// Deterministic bar heights (no Math.random) so server and client render
// identically — this sits inside header.top purely as decoration.
export default function Waveform({ bars = 72 }: { bars?: number }) {
  const heights = Array.from({ length: bars }, (_, i) => {
    return 5 + Math.round(Math.abs(Math.sin(i * 0.45)) * 20 + Math.abs(Math.sin(i * 1.7)) * 9);
  });

  return (
    <div className="waveform" aria-hidden="true">
      {heights.map((h, i) => (
        <span key={i} style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

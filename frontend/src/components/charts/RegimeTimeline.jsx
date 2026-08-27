import { K, REGIME_COLORS, REGIME_LABELS } from "../common/theme.js";

// Groups consecutive same-regime entries in regimeSeries into segments —
// a trivial O(n) scan over data already fetched for the Integration
// Speed and Regime Distribution panels, not a second calculation.
function buildSegments(rs) {
  const segs = [];
  let cur = null;
  for (const p of rs) {
    if (!cur || cur.regime !== p.regime) {
      if (cur) segs.push(cur);
      cur = { regime: p.regime, start: p.day, end: p.day };
    } else {
      cur.end = p.day;
    }
  }
  if (cur) segs.push(cur);
  return segs;
}

// A horizontal strip of colored segments, one per contiguous run of the
// same regime across the run — gives the regime its own "history" visual
// distinct from the per-day Integration Speed line beneath it.
function RegimeTimeline({ regimeSeries }) {
  if (!regimeSeries || regimeSeries.length === 0) return null;
  const segs = buildSegments(regimeSeries);
  const first = regimeSeries[0].day, last = regimeSeries[regimeSeries.length - 1].day;
  const span = Math.max(1, last - first);
  const H = 34;
  return (
    <div>
      <svg viewBox={`0 0 1000 ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
        {segs.map((s, i) => {
          const x = ((s.start - first) / span) * 1000;
          const w = Math.max(2, ((s.end - s.start) / span) * 1000);
          return (
            <rect key={i} x={x} y={0} width={w} height={H} fill={REGIME_COLORS[s.regime] || K.textMuted} fillOpacity={0.85}>
              <title>{`${REGIME_LABELS[s.regime] || s.regime} · day ${s.start}–${s.end}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: K.textMuted, marginTop: 4, fontFamily: K.fontMono }}>
        <span>day {first}</span>
        <span>day {last}</span>
      </div>
    </div>
  );
}

export { RegimeTimeline };

import { useMemo } from "react";
import { K, SP } from "../common/theme.js";

// A single simulated equity curve, trending up — reads as "the strategy
// is profitable" rather than a generic progress bar. `pct` reveals the
// line left-to-right via a clip rect, driven directly by the real boot
// progress passed down from App.jsx; nothing here loops independently
// of actual progress.
const W = 400;
const H = 110;
const PAD = 10;
const STEPS = 36;
const DRIFT = 0.55; // avg % gain per step
const NOISE = 1.8; // % noise band per step

function buildSeries() {
  const vals = [100];
  for (let i = 1; i <= STEPS; i++) {
    const step = DRIFT + (Math.random() - 0.5) * NOISE;
    vals.push(vals[i - 1] * (1 + step / 100));
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pts = vals.map((v, i) => {
    const x = (i / STEPS) * W;
    const y = PAD + (1 - (v - min) / (max - min || 1)) * (H - 2 * PAD);
    return [x, y];
  });
  const gainPct = (vals[vals.length - 1] / vals[0] - 1) * 100;
  return { pts, gainPct };
}

function valueAtX(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= x) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return pts[pts.length - 1][1];
}

function toPoints(pts) {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function Loading({ phase, pct }) {
  const { pts, gainPct } = useMemo(buildSeries, []);
  const revealX = Math.max(0, Math.min(W, (pct / 100) * W));
  const markerY = valueAtX(pts, revealX);
  const runningGain = gainPct * (pct / 100);
  const areaPath = `M0,${H} L${toPoints(pts)} L${W},${H} Z`;

  return (
    <div style={{ minHeight: "100vh", background: K.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: K.fontUI, padding: SP.xl }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: SP.xxl }}>
        <img src="/favicon.svg" alt="" width={20} height={20} style={{ display: "block", borderRadius: 4 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: K.text }}>NEPSEQuant</div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 400, display: "block", overflow: "visible" }}>
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={K.border} strokeWidth="1" />

        <clipPath id="reveal-clip">
          <rect x="0" y="0" width={revealX} height={H} />
        </clipPath>

        <g clipPath="url(#reveal-clip)">
          <path d={areaPath} fill={K.positive} fillOpacity="0.08" stroke="none" />
          <polyline points={toPoints(pts)} fill="none" stroke={K.positive} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        </g>

        <circle cx={revealX} cy={markerY} r="3" fill={K.positive} className="loading-marker-dot" />
        <text x={Math.min(revealX + 8, W - 4)} y={Math.max(markerY - 8, 10)} textAnchor={revealX > W - 60 ? "end" : "start"} fontFamily={K.fontMono} fontSize="11" fill={K.positive}>
          {runningGain >= 0 ? "+" : ""}{runningGain.toFixed(1)}%
        </text>
      </svg>

      <div style={{ display: "flex", alignItems: "baseline", gap: SP.md, width: "100%", maxWidth: 400, marginTop: SP.lg }}>
        <div style={{ fontSize: 12, color: K.textMuted, fontFamily: K.fontMono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{phase}</div>
        <div style={{ fontSize: 12, color: K.textSecondary, fontFamily: K.fontMono, marginLeft: "auto", flexShrink: 0 }}>{Math.round(pct)}%</div>
      </div>
    </div>
  );
}

export { Loading };
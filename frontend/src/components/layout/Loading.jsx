import { useEffect, useMemo, useRef, useState } from "react";
import { K, SP } from "../common/theme.js";

// A single simulated equity curve, trending up — reads as "the strategy
// is profitable" rather than a generic progress bar. The line reveal is
// still ultimately driven by the real boot progress App.jsx sends down
// as `pct` — but App.jsx only reports a handful of discrete milestones
// (10 → 20 → 30 → 45 → 60 → 100), each held for however long that real
// step takes. Drawn literally, that means the line jumps then freezes
// dead for the length of the slowest step (regime detection, in
// practice). `display` below eases toward each new `pct` instead of
// snapping to it, and — this is the part that actually fixes the
// "stuck" feeling — keeps creeping slowly forward even while `pct`
// itself hasn't moved, capped a few points ahead so it never overtakes
// the next real milestone or implies false completion.
const W = 400;
const H = 110;
const PAD = 10;
const STEPS = 36;
const DRIFT = 0.55; // avg % gain per step
const NOISE = 1.8; // % noise band per step

const CATCH_UP_SPEED = 5; // higher = snappier ease toward a new real pct
const TRICKLE_PER_SEC = 0.6; // %/sec crawl while waiting on the same pct
const TRICKLE_MAX_LEAD = 8; // never crawl more than this far past real pct
const TRICKLE_CEILING = 98; // never crawl to 100 on our own — only a real pct of 100 does that

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

// Eases toward the latest real `pct`, then trickles slowly past it
// (capped) whenever the real value hasn't advanced in a while — so the
// line is always visibly, slowly moving instead of freezing between
// App.jsx's milestone updates.
function useTrickledPct(pct) {
  const targetRef = useRef(pct);
  const [display, setDisplay] = useState(pct);
  useEffect(() => { targetRef.current = pct; }, [pct]);

  useEffect(() => {
    let raf, last = performance.now();
    function tick(now) {
      const dt = Math.min(0.1, (now - last) / 1000); // clamp in case of a tab throttle/hiccup
      last = now;
      setDisplay(d => {
        const target = targetRef.current;
        if (target >= 100) return 100;
        if (d < target) return d + (target - d) * Math.min(1, dt * CATCH_UP_SPEED);
        const cap = Math.min(target + TRICKLE_MAX_LEAD, TRICKLE_CEILING);
        return Math.min(d + TRICKLE_PER_SEC * dt, cap);
      });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return display;
}

function Loading({ phase, pct }) {
  const { pts, gainPct } = useMemo(buildSeries, []);
  const display = useTrickledPct(pct);
  const revealX = Math.max(0, Math.min(W, (display / 100) * W));
  const markerY = valueAtX(pts, revealX);
  const runningGain = gainPct * (display / 100);
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
        <div style={{ fontSize: 12, color: K.textSecondary, fontFamily: K.fontMono, marginLeft: "auto", flexShrink: 0 }}>{Math.round(display)}%</div>
      </div>
    </div>
  );
}

export { Loading };
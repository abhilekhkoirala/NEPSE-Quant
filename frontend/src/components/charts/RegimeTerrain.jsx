import { useMemo } from "react";
import { K, SP, REGIME_COLORS, REGIME_LABELS, FALLBACK_SEC_NAMES, buildSecColors } from "../common/theme.js";
import { Panel } from "../layout/Panel.jsx";

// The one signature visual in the app — a live embedding of the current
// correlation structure (classical MDS on correlation distance) with a
// local-density field behind it. It carries its visual weight from the
// primary accent, not a separate decorative color, so it reads as part
// of the same analytical system as everything else rather than a
// special "AI" flourish.
//
// The point cloud + density field are computed once per backtest run on
// the backend (backend/src/quant/regime.js) and arrive ready-to-draw as
// result.terrain. This component only still computes one thing locally:
// which point pairs fall within the current epsilon threshold to draw as
// edges — a simple filter over the correlation matrix already shipped
// for the Heatmap chart, not a modeling calculation.
function RegimeTerrain({ result }) {
  const n = result.tickers.length;
  const secNames = result.sectorNames || FALLBACK_SEC_NAMES, secColors = buildSecColors(secNames);
  const sectorByTicker = useMemo(() => Object.fromEntries(result.signalData.map(d => [d.ticker, d.sector])), [result.signalData]);
  const points = result.terrain?.points || [];
  const W = 460, H = 300, PAD = 22;
  const { grid = [], max = 1, cols = 22, rows = 14 } = result.terrain?.density || {};
  const innerW = W - PAD * 2, innerH = H - PAD * 2, cw = innerW / cols, ch = innerH / rows;
  const last = result.regimeSeries[result.regimeSeries.length - 1] || {};
  const eps = last.intEps ?? 0.9;
  const homo = result.homoData || [];
  const nearestHomo = homo.reduce((best, p) => (best == null || Math.abs(p.eps - eps) < Math.abs(best.eps - eps)) ? p : best, null) || { β1: 0 };
  const wByTicker = useMemo(() => Object.fromEntries(result.signalData.map(d => [d.ticker, d.weight])), [result.signalData]);
  const edges = useMemo(() => {
    const es = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.sqrt(Math.max(0, 2 * (1 - result.corr[i * n + j])));
      if (d <= eps) es.push([i, j]);
    }
    return es;
  }, [result.corr, n, eps]);
  const bands = [0.14, 0.30, 0.48, 0.68];
  const opacities = [0.05, 0.11, 0.19, 0.29, 0.42];
  const topByWeight = [...result.signalData].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 5).map(d => d.ticker);
  const regimeCol = REGIME_COLORS[last.regime] || K.textMuted;
  const regimeLabel = REGIME_LABELS[last.regime] || "—";

  if (n < 2) {
    return (<Panel style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: `${SP.md}px ${SP.lg}px 0` }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: K.text, marginBottom: 3 }}>Regime Terrain</div>
      </div>
      <div style={{ padding: `${SP.xl}px ${SP.lg}px`, fontSize: 13, color: K.textSecondary }}>Not enough active tickers to render a regime terrain (need at least 2 after filtering) — currently {n}.</div>
    </Panel>);
  }

  return (<Panel style={{ padding: 0, overflow: "hidden" }}>
    <div style={{ padding: `${SP.md}px ${SP.lg}px 0` }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: K.text, marginBottom: 3 }}>Regime Terrain</div>
      <div style={{ fontSize: 11, color: K.textMuted }}>Point cloud: MDS on correlation distance · field: local density</div>
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", marginTop: SP.xs }}>
      {Array.from({ length: rows }).flatMap((_, gy) => Array.from({ length: cols }).map((_, gx) => {
        const d = grid[gy * cols + gx] / max;
        let op = 0;
        for (let b = 0; b < bands.length; b++) { if (d <= bands[b]) { op = b === 0 ? 0 : opacities[b - 1]; break; } if (b === bands.length - 1) op = opacities[opacities.length - 1]; }
        if (op <= 0) return null;
        return <rect key={`${gx}-${gy}`} x={PAD + gx * cw} y={PAD + gy * ch} width={cw + 0.5} height={ch + 0.5} fill={K.accent} fillOpacity={op} />;
      }))}
      {edges.map(([i, j], k) => (
        <line key={k} x1={PAD + points[i].x * innerW} y1={PAD + points[i].y * innerH} x2={PAD + points[j].x * innerW} y2={PAD + points[j].y * innerH} stroke={K.textSecondary} strokeOpacity={0.14} strokeWidth={1} />
      ))}
      {result.tickers.map((t, i) => {
        const p = points[i]; if (!p) return null;
        const w = Math.abs(wByTicker[t] || 0);
        const r = 1.8 + Math.sqrt(w) * 18;
        const secIdx = secNames.indexOf(sectorByTicker[t]);
        const col = secColors[secIdx === -1 ? 0 : secIdx] ?? K.textMuted;
        const cx = PAD + p.x * innerW, cy = PAD + p.y * innerH;
        return (<g key={t}>
          <circle cx={cx} cy={cy} r={r} fill={col} fillOpacity={0.9} stroke={K.bg} strokeWidth={1} />
          {topByWeight.includes(t) && <text x={cx + r + 3} y={cy + 3} fontSize={9} fontFamily={K.fontMono} fill={K.textSecondary}>{t}</text>}
        </g>);
      })}
      <g>
        <rect x={PAD - 4} y={PAD - 17} width={regimeLabel.length * 7 + 24} height={20} fill={K.bg} fillOpacity={0.8} rx={3} />
        <circle cx={PAD + 6} cy={PAD - 7} r={4} fill={regimeCol} />
        <text x={PAD + 16} y={PAD - 3} fontSize={12} fontFamily={K.fontUI} fontWeight="600" fill={regimeCol}>{regimeLabel}</text>
      </g>
    </svg>
    <div style={{ display: "flex", flexWrap: "wrap", gap: SP.md, padding: `${SP.sm}px ${SP.lg}px ${SP.md}px`, borderTop: `1px solid ${K.border}`, marginTop: SP.xs }}>
      <div style={{ fontSize: 11, color: K.textMuted }}>ε <span style={{ fontFamily: K.fontMono, color: K.text, marginLeft: 4 }}>{eps.toFixed(2)}</span></div>
      <div style={{ fontSize: 11, color: K.textMuted }}>β1 <span style={{ fontFamily: K.fontMono, color: K.text, marginLeft: 4 }}>{nearestHomo.β1 ?? "—"}</span></div>
      <div style={{ fontSize: 11, color: K.textMuted }}>avg ρ <span style={{ fontFamily: K.fontMono, color: K.text, marginLeft: 4 }}>{last.avgCorr != null ? last.avgCorr.toFixed(2) : "—"}</span></div>
      <div style={{ fontSize: 11, color: K.textMuted }}>{n}n / {edges.length}e</div>
    </div>
  </Panel>);
}

export { RegimeTerrain };

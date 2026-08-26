import { useMemo } from "react";
import { K, SP, REGIME_COLORS, REGIME_LABELS } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";

// Terminal-style regime-transition event log, derived by diffing the
// already-computed regimeSeries for display grouping — a trivial O(n)
// scan, not a modeling calculation, so it's kept client-side (same as the
// original). Moved verbatim from src/App.jsx.
function detectRegimeTransitions(regimeSeries) {
  const out = [];
  for (let i = 1; i < regimeSeries.length; i++) {
    const prev = regimeSeries[i - 1], cur = regimeSeries[i];
    if (cur.regime !== prev.regime) out.push({ day: cur.day, from: prev.regime, to: cur.regime, prev, cur });
  }
  return out;
}
function RegimeAlerts({ result }) {
  const transitions = useMemo(() => detectRegimeTransitions(result.regimeSeries).reverse(), [result.regimeSeries]);
  return (<Panel style={{ padding: 0 }}>
    <div style={{ padding: `${SP.lg}px ${SP.lg}px 0` }}><SL right={`${transitions.length} transitions · β1 model`}>Regime Change Log</SL></div>
    <div style={{ maxHeight: 280, overflowY: "auto", marginTop: SP.xs }}>
      {transitions.length === 0 && <div style={{ padding: `${SP.sm}px ${SP.lg}px ${SP.lg}px`, fontSize: 13, color: K.textSecondary }}>No regime transitions in this run — the regime held constant throughout.</div>}
      {transitions.map((t, i) => {
        const dCorr = t.cur.avgCorr - t.prev.avgCorr, dEps = t.cur.intEps - t.prev.intEps, dVol = t.cur.realisedVol - t.prev.realisedVol;
        return (
          <div key={i} style={{ padding: `${SP.sm}px ${SP.lg}px`, borderTop: `1px solid ${K.border}` }}>
            <div style={{ display: "flex", gap: SP.sm + 2, alignItems: "baseline" }}>
              <span style={{ color: K.textMuted, fontSize: 12, fontFamily: K.fontMono }}>day {t.day}</span>
              <span style={{ color: REGIME_COLORS[t.from], fontSize: 13, fontWeight: 500 }}>{REGIME_LABELS[t.from]}</span>
              <span style={{ color: K.textMuted, fontSize: 13 }}>→</span>
              <span style={{ color: REGIME_COLORS[t.to], fontSize: 13, fontWeight: 500 }}>{REGIME_LABELS[t.to]}</span>
            </div>
            <div style={{ fontSize: 11.5, color: K.textMuted, marginTop: 4, fontFamily: K.fontMono }}>
              avg ρ {t.prev.avgCorr.toFixed(2)}→{t.cur.avgCorr.toFixed(2)} ({dCorr >= 0 ? "+" : ""}{dCorr.toFixed(2)}) · ε {t.prev.intEps.toFixed(2)}→{t.cur.intEps.toFixed(2)} · vol {(t.prev.realisedVol * 100).toFixed(0)}%→{(t.cur.realisedVol * 100).toFixed(0)}% ({dVol >= 0 ? "+" : ""}{(dVol * 100).toFixed(0)}pp)
            </div>
          </div>
        );
      })}
    </div>
  </Panel>);
}

export { RegimeAlerts, detectRegimeTransitions };

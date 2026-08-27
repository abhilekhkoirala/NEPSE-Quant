import { useMemo } from "react";
import { K, SP, ROW, REGIME_COLORS, REGIME_LABELS, regimeDescriptor } from "../../components/common/theme.js";
import { SL } from "../../components/layout/Panel.jsx";
import { Params } from "../backtests/Params.jsx";
import { BacktestResults } from "../backtests/BacktestResults.jsx";
import { TaxCostBreakdown } from "../backtests/TaxCostBreakdown.jsx";
import { Watchlist } from "../regime/Watchlist.jsx";

// The primary research dashboard: configure → run → read the result,
// top to bottom, in one page scroll. Market → Strategy → Performance →
// Risk → Signals → Portfolio is the intended reading order across the
// whole app; Overview covers Strategy through the top of Market, then
// Signals/Regime/Portfolio get their own pages for the detail views.
function Overview({ result, params, setParams, onRun, running }) {
  const last = result.regimeSeries[result.regimeSeries.length - 1] || {};
  const regimeCol = REGIME_COLORS[last.regime] || K.textMuted;
  const regimeLabel = REGIME_LABELS[last.regime] || "—";

  // Breadth uses the same 60-day change definition Watchlist's own 60D
  // column shows (last/first of the precomputed sparkline path) — not a
  // second, divergent calculation of the same thing.
  const breadth = useMemo(() => {
    let up = 0, down = 0;
    result.signalData.forEach(d => {
      const p = d.sparkline60;
      if (!p || p.length < 2) return;
      if (p[p.length - 1] >= p[0]) up++; else down++;
    });
    return { up, down };
  }, [result.signalData]);

  const ns = result.newsSentiment || { scale: 1, label: "neutral", negFrac: 0 };
  const nsCol = ns.label === "crisis" ? K.negative : ns.label === "stress" ? K.warning : ns.label === "insufficient" ? K.textMuted : K.positive;
  const nsLabel = { crisis: "Crisis", stress: "Stress", positive: "Positive", neutral: "Neutral", insufficient: "Insufficient data" }[ns.label] || ns.label;

  const regimeSidePanel = (
    <div>
      <SL>Current Regime</SL>
      <div style={{ fontSize: 20, fontWeight: 600, color: regimeCol, marginBottom: 4 }}>{regimeLabel}</div>
      <div style={{ fontSize: 12, color: K.textMuted, marginBottom: SP.md, lineHeight: 1.5 }}>{regimeDescriptor(last.regime, last.avgCorr, last.realisedVol)}</div>
      <div style={ROW}><span style={{ color: K.textSecondary }}>Correlation</span><span style={{ fontFamily: K.fontMono, color: K.text }}>{last.avgCorr != null ? last.avgCorr.toFixed(2) : "—"}</span></div>
      <div style={{ ...ROW, borderBottom: "none" }}><span style={{ color: K.textSecondary }}>Volatility</span><span style={{ fontFamily: K.fontMono, color: K.text }}>{last.realisedVol != null ? `${(last.realisedVol * 100).toFixed(1)}%` : "—"}</span></div>
    </div>
  );

  return (<div>
    <Params params={params} setParams={setParams} onRun={onRun} running={running} />

    <hr className="divider" />
    <SL right={`Last run ${new Date(result.computedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}>Performance</SL>
    <BacktestResults result={result} sidePanel={regimeSidePanel} />

    <hr className="divider" />
    <TaxCostBreakdown result={result} />

    <hr className="divider" />
    <SL>Market</SL>
    <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: SP.xl }}>
      <div style={{ minWidth: 0 }}>
        <Watchlist result={result} />
      </div>
      <div>
        <SL>Market Snapshot</SL>
        <div style={ROW}>
          <span style={{ color: K.textSecondary }}>Sentiment</span>
          <span style={{ fontFamily: K.fontMono, color: nsCol, fontWeight: 600 }}>{nsLabel}</span>
        </div>
        <div style={ROW}>
          <span style={{ color: K.textSecondary }}>Breadth</span>
          <span style={{ fontFamily: K.fontMono, color: K.text }}>
            <span style={{ color: K.positive }}>{breadth.up}↑</span> / <span style={{ color: K.negative }}>{breadth.down}↓</span>
          </span>
        </div>
        <div style={{ ...ROW, borderBottom: "none" }}>
          <span style={{ color: K.textSecondary }}>Universe</span>
          <span style={{ fontFamily: K.fontMono, color: K.text }}>{result.tickers.length} stocks</span>
        </div>
      </div>
    </div>
  </div>);
}

export { Overview };

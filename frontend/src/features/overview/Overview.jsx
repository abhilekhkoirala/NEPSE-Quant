import { K, SP, RADIUS } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { Heatmap } from "../../components/charts/Heatmap.jsx";
import { BacktestResults } from "../backtests/BacktestResults.jsx";
import { TaxCostBreakdown } from "../backtests/TaxCostBreakdown.jsx";

function Overview({ result }) {
  const n = result.tickers.length;
  let corrSum = 0, corrCount = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { corrSum += result.corr[i * n + j]; corrCount++; }
  const avgCorr = corrCount > 0 ? +(corrSum / corrCount).toFixed(3) : 0;
  const corrAlert = avgCorr > 0.7;
  return (<div style={{ display: "flex", flexDirection: "column", gap: SP.lg }}>
    <BacktestResults result={result} />
    <TaxCostBreakdown result={result} />
    <Panel>
      <SL right="Graph basis for the regime terrain">Correlation Matrix</SL>
      <Heatmap corr={result.corr} n={result.tickers.length} />
      {corrAlert && (
        <div style={{ marginTop: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.negative}1A`, border: `1px solid ${K.negative}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.negative }}>
          Average pairwise correlation is {avgCorr} — diversification has nearly collapsed.
        </div>
      )}
      {!corrAlert && (
        <div style={{ marginTop: SP.sm, fontSize: 12.5, color: K.textMuted }}>Average pairwise correlation: <span style={{ color: avgCorr > 0.5 ? K.warning : K.positive, fontFamily: K.fontMono }}>{avgCorr}</span>{avgCorr > 0.5 ? " — elevated" : " — healthy"}</div>
      )}
    </Panel>
  </div>);
}

export { Overview };

import { K, SP, ROW } from "../../components/common/theme.js";
import { SL } from "../../components/layout/Panel.jsx";

// Flat data-grid summary of current holdings + top-level performance/risk
// stats. Moved verbatim from src/App.jsx — purely presentational, reads
// only from the composed `result` (signalData + metrics), no calculation.
function PortfolioSnapshot({ result }) {
  const held = result.signalData.filter(d => d.weight > 0.001).sort((a, b) => b.weight - a.weight);
  const holdings = held.slice(0, 8);
  const shown = holdings.reduce((a, d) => a + d.weight, 0);
  const restCount = held.length - holdings.length;
  return (<>
    <SL>Current Holdings</SL>
    <div style={{ marginBottom: SP.lg }}>
      {holdings.map(h => (
        <div key={h.ticker} style={ROW}>
          <span style={{ fontFamily: K.fontMono, fontWeight: 600, color: K.text }}>{h.ticker}</span>
          <span style={{ fontFamily: K.fontMono, color: K.textSecondary }}>{(h.weight * 100).toFixed(1)}%</span>
        </div>
      ))}
      {holdings.length === 0 && <div style={{ fontSize: 13, color: K.textSecondary, padding: "8px 0" }}>No active positions</div>}
      {restCount > 0 && <div style={{ fontSize: 12, color: K.textMuted, padding: "8px 0" }}>+ {restCount} more · {((1 - shown) * 100).toFixed(1)}% remaining</div>}
    </div>
    <SL>Performance &amp; Risk</SL>
    <div>
      <div style={ROW}><span style={{ color: K.textSecondary }}>Total Return</span><span style={{ fontFamily: K.fontMono, color: result.m.totRet > 0 ? K.positive : K.negative }}>{result.m.totRet}%</span></div>
      <div style={ROW}><span style={{ color: K.textSecondary }}>Sharpe</span><span style={{ fontFamily: K.fontMono, color: result.m.sharpe > 0.5 ? K.positive : K.text }}>{result.m.sharpe}</span></div>
      <div style={ROW}><span style={{ color: K.textSecondary }}>Annualized Vol</span><span style={{ fontFamily: K.fontMono, color: K.text }}>{result.m.annVol}%</span></div>
      <div style={{ ...ROW, borderBottom: "none" }}><span style={{ color: K.textSecondary }}>Max Drawdown</span><span style={{ fontFamily: K.fontMono, color: result.m.maxDD > -15 ? K.text : K.negative }}>{result.m.maxDD}%</span></div>
    </div>
  </>);
}

export { PortfolioSnapshot };

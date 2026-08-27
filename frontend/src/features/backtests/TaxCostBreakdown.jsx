import { K, SP, REGIME_COLORS, REGIME_LABELS } from "../../components/common/theme.js";
import { SL } from "../../components/layout/Panel.jsx";
import { MetricRow } from "../../components/common/MetricCard.jsx";

// Gross/net/CGT breakdown per rebalance period. The per-period
// net/cgt/netOfTax figures and the compounded totals are computed once
// on the backend (backend/src/api/backtests.js withTaxBreakdown) and
// arrive already attached to result.periods / result.periodTotals.
function TaxCostBreakdown({ result }) {
  const rows = result.periods || [];
  const totals = result.periodTotals;
  const cgtRate = result.cgtShortTermRate;

  if (rows.length === 0) return (<div><SL>Tax &amp; Transaction Cost Breakdown</SL><div style={{ fontSize: 13, color: K.textSecondary }}>No rebalance periods recorded for this run.</div></div>);

  return (<div>
    <SL right={`${rows.length} rebalance periods · CGT modeled at ${(cgtRate * 100).toFixed(1)}% short-term`}>Tax &amp; Transaction Cost Breakdown</SL>
    <MetricRow columns={4} items={[
      { label: "Gross Return", value: `${totals.gross.toFixed(2)}%` },
      { label: "Transaction Cost", value: `${totals.totalTxCost.toFixed(2)}%`, tone: "warning" },
      { label: "Modeled CGT", value: `${totals.totalCGT.toFixed(2)}%`, tone: "warning" },
      { label: "Net of Tax", value: `${totals.netOfTax.toFixed(2)}%`, tone: totals.netOfTax > 0 ? "positive" : "negative" },
    ]} />
    <div className="data-table-scroll" style={{ maxHeight: 300, overflowY: "auto", marginTop: SP.lg }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Regime</th>
            <th className="num" data-align="right">Gross</th>
            <th className="num" data-align="right">Txn Cost</th>
            <th className="num" data-align="right">Net</th>
            <th className="num" data-align="right">Est. CGT</th>
            <th className="num" data-align="right">Net of Tax</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice().reverse().map((r, i) => {
            const regimeColor = REGIME_COLORS[r.regime] || K.textMuted;
            const regimeLabel = REGIME_LABELS[r.regime] || r.regime;
            // startDate/endDate are real calendar dates computed server-side
            // (see backend/src/api/backtests.js withTaxBreakdown); fall back
            // to the raw day-indices only if a run somehow has no dates.
            const period = r.startDate
              ? (r.startDate === r.endDate ? r.startDate : `${r.startDate} – ${r.endDate}`)
              : `${r.startDay}–${r.endDay}`;
            return (
              <tr key={i}>
                <td style={{ fontFamily: K.fontMono, color: K.text }}>{period}</td>
                <td style={{ color: regimeColor, fontSize: 12 }}>{regimeLabel}</td>
                <td className="num" data-align="right" style={{ color: K.textSecondary }}>{r.grossRet.toFixed(2)}%</td>
                <td className="num" data-align="right" style={{ color: K.warning }}>−{(r.txCostFrac * 100).toFixed(2)}%</td>
                <td className="num" data-align="right" style={{ color: r.net >= 0 ? K.positive : K.negative }}>{r.net.toFixed(2)}%</td>
                <td className="num" data-align="right" style={{ color: K.warning }}>{r.cgt > 0 ? `−${r.cgt.toFixed(2)}%` : "—"}</td>
                <td className="num" data-align="right" style={{ color: r.netOfTax >= 0 ? K.positive : K.negative, fontWeight: 600 }}>{r.netOfTax.toFixed(2)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <div style={{ marginTop: SP.md, fontSize: 12, color: K.textMuted, lineHeight: 1.6 }}>
      Transaction cost is the modeled per-rebalance charge actually applied in the walk-forward run. CGT is an illustrative overlay ({(cgtRate * 100).toFixed(1)}% short-term, sellers-only-on-profit) — not itself deducted from the reported backtest equity curve above.
    </div>
  </div>);
}

export { TaxCostBreakdown };

import { K, SP } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { MetricRow } from "../../components/common/MetricCard.jsx";

// Gross/net/CGT breakdown per rebalance period. The per-period
// net/cgt/netOfTax figures and the compounded totals are computed once
// on the backend (backend/src/api/backtests.js withTaxBreakdown) and
// arrive already attached to result.periods / result.periodTotals.
function TaxCostBreakdown({ result }) {
  const rows = result.periods || [];
  const totals = result.periodTotals;
  const cgtRate = result.cgtShortTermRate;

  if (rows.length === 0) return (<Panel><SL>Tax &amp; Transaction Cost Breakdown</SL><div style={{ fontSize: 13, color: K.textSecondary }}>No rebalance periods recorded for this run.</div></Panel>);

  return (<Panel style={{ padding: 0 }}>
    <div style={{ padding: `${SP.lg}px ${SP.lg}px 0` }}>
      <SL right={`${rows.length} rebalance periods · CGT modeled at ${(cgtRate * 100).toFixed(1)}% short-term`}>Tax &amp; Transaction Cost Breakdown</SL>
    </div>
    <div style={{ padding: `0 ${SP.lg}px ${SP.lg}px` }}>
      <MetricRow columns={4} items={[
        { label: "Gross Return", value: `${totals.gross.toFixed(2)}%` },
        { label: "Transaction Cost", value: `${totals.totalTxCost.toFixed(2)}%`, tone: "warning" },
        { label: "Modeled CGT", value: `${totals.totalCGT.toFixed(2)}%`, tone: "warning" },
        { label: "Net of Tax", value: `${totals.netOfTax.toFixed(2)}%`, tone: totals.netOfTax > 0 ? "positive" : "negative" },
      ]} />
    </div>
    <div className="grid-table-scroll" style={{ maxHeight: 300, overflowY: "auto", borderTop: `1px solid ${K.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 620 }}>
        <thead>
          <tr style={{ textAlign: "left", color: K.textMuted, fontSize: 11, position: "sticky", top: 0, background: K.surfaceElevated }}>
            <th style={{ padding: `${SP.sm}px ${SP.lg}px`, fontWeight: 500 }}>Period</th>
            <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500 }}>Regime</th>
            <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500, textAlign: "right" }}>Gross</th>
            <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500, textAlign: "right" }}>Txn Cost</th>
            <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500, textAlign: "right" }}>Net</th>
            <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500, textAlign: "right" }}>Est. CGT</th>
            <th style={{ padding: `${SP.sm}px ${SP.lg}px`, fontWeight: 500, textAlign: "right" }}>Net of Tax</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice().reverse().map((r, i) => {
            const regimeColor = { calm: K.positive, stress: K.warning, crisis: K.negative, fragmented: "#9089B0" }[r.regime] || K.textMuted;
            const regimeLabel = { calm: "Calm", stress: "Stress", crisis: "Crisis", fragmented: "Fragmented" }[r.regime] || r.regime;
            return (
              <tr key={i} className="table-row" style={{ borderTop: `1px solid ${K.border}` }}>
                <td style={{ padding: `${SP.xs + 2}px ${SP.lg}px`, fontFamily: K.fontMono, color: K.text }}>{r.startDay}–{r.endDay}</td>
                <td style={{ padding: `${SP.xs + 2}px ${SP.sm}px`, color: regimeColor, fontSize: 12 }}>{regimeLabel}</td>
                <td style={{ padding: `${SP.xs + 2}px ${SP.sm}px`, textAlign: "right", fontFamily: K.fontMono, color: K.textSecondary }}>{r.grossRet.toFixed(2)}%</td>
                <td style={{ padding: `${SP.xs + 2}px ${SP.sm}px`, textAlign: "right", fontFamily: K.fontMono, color: K.warning }}>−{(r.txCostFrac * 100).toFixed(2)}%</td>
                <td style={{ padding: `${SP.xs + 2}px ${SP.sm}px`, textAlign: "right", fontFamily: K.fontMono, color: r.net >= 0 ? K.positive : K.negative }}>{r.net.toFixed(2)}%</td>
                <td style={{ padding: `${SP.xs + 2}px ${SP.sm}px`, textAlign: "right", fontFamily: K.fontMono, color: K.warning }}>{r.cgt > 0 ? `−${r.cgt.toFixed(2)}%` : "—"}</td>
                <td style={{ padding: `${SP.xs + 2}px ${SP.lg}px`, textAlign: "right", fontFamily: K.fontMono, color: r.netOfTax >= 0 ? K.positive : K.negative, fontWeight: 600 }}>{r.netOfTax.toFixed(2)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <div style={{ padding: `${SP.md}px ${SP.lg}px`, fontSize: 12, color: K.textMuted, borderTop: `1px solid ${K.border}`, lineHeight: 1.6 }}>
      Transaction cost is the modeled per-rebalance charge actually applied in the walk-forward run. CGT is an illustrative overlay ({(cgtRate * 100).toFixed(1)}% short-term, sellers-only-on-profit) — not itself deducted from the reported backtest equity curve above.
    </div>
  </Panel>);
}

export { TaxCostBreakdown };

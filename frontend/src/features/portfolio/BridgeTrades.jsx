import { useState, useEffect } from "react";
import { K, SP, RADIUS } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import portfolioApi from "../../lib/api/portfolio.js";

const COLS = "70px 65px 65px 50px 58px 90px";

// Diffing the user's holdings against the model's target weights, and the
// merolagani price-fallback fetch for tickers missing from the CSV, both
// used to run in the browser (direct fetch(merolagani.com), subject to
// CORS). Both now happen server-side in one request —
// GET /api/portfolio/bridge-trades — see
// backend/src/quant/portfolioTools.js:buildBridgeTrades and
// backend/src/services/portfolioService.js:getBridgeTrades. Because the
// fallback fetch is resolved before the response comes back, there's no
// "fetching…" transient state to show anymore — a stock is either priced
// (csv or merolagani) or listed in missingFromPrices.
function BridgeTrades({ result, userPortfolioCount, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    portfolioApi.getBridgeTrades().then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [result.id, refreshKey]);

  if (userPortfolioCount === 0) {
    return (<Panel>
      <SL>Bridge Trades · Aligning to Model Target</SL>
      <EmptyState
        title="No portfolio loaded"
        description={<>Upload your portfolio CSV above (columns: <span style={{ fontFamily: K.fontMono, color: K.text }}>Scrip</span>, <span style={{ fontFamily: K.fontMono, color: K.text }}>Current Balance</span>) to see current weights and bridge trades.</>}
      />
    </Panel>);
  }
  if (loading) return <Panel><div style={{ padding: SP.md, fontSize: 13, color: K.textSecondary }}>Resolving prices and building bridge trades…</div></Panel>;
  if (error) return <Panel><div style={{ padding: SP.md, fontSize: 13, color: K.negative }}>{error.message}</div></Panel>;

  const { bridge, missingFromPrices, pricedValue, hasPriceData, totalEstCost, currentCoveragePct, targetCoveragePct, orphanCount } = data;
  const orphanRows = bridge.filter(b => b.noSignal);

  return (<div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.lg }}>
    <Panel>
      <SL>Bridge Trades · Aligning to Model Target</SL>
      {missingFromPrices.length > 0 && (
        <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Could not price {missingFromPrices.length} holding{missingFromPrices.length > 1 ? "s" : ""} — excluded from current % and value:</div>
          <div style={{ color: K.textMuted }}>{missingFromPrices.join(", ")}</div>
        </div>
      )}
      {orphanCount > 0 && (
        <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.negative}14`, border: `1px solid ${K.negative}33`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.negative }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{orphanCount} holding{orphanCount > 1 ? "s" : ""} not covered by the model — shown as Sell:</div>
          <div style={{ color: K.textMuted }}>{orphanRows.map(r => r.ticker).join(", ")}</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: COLS, fontSize: 11, color: K.textMuted, marginBottom: SP.sm, borderBottom: `1px solid ${K.border}`, paddingBottom: SP.sm }}>
        <span>Symbol</span><span>Cur %</span><span>Tgt %</span><span>Action</span><span>Units</span><span>Est. Cost (Rs.)</span>
      </div>
      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {bridge.map(b => {
          const { costData } = b;
          return (
            <div key={b.ticker} className="table-row" style={{ display: "grid", gridTemplateColumns: COLS, fontSize: 13, padding: `${SP.xs + 2}px 0`, borderBottom: `1px solid ${K.border}`, opacity: b.missingPrice ? 0.5 : 1 }}>
              <span style={{ color: b.noSignal ? K.warning : K.text, fontFamily: K.fontMono, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                {b.ticker}{b.noSignal ? " *" : ""}
              </span>
              <span style={{ color: K.textSecondary, fontFamily: K.fontMono, fontSize: 12.5 }}>
                {b.missingPrice ? "N/A" : `${(b.currentWeight * 100).toFixed(1)}%`}
                {b.priceSource === "merolagani" && <span style={{ fontSize: 9, color: K.accent, marginLeft: 3 }}>ML</span>}
              </span>
              <span style={{ color: K.text, fontFamily: K.fontMono, fontSize: 12.5 }}>{b.noSignal ? "—" : `${(b.targetWeight * 100).toFixed(1)}%`}</span>
              <span style={{ color: b.action === "BUY" ? K.positive : b.action === "SELL" ? K.negative : K.textMuted, fontSize: 12 }}>{b.action}</span>
              <span style={{ fontFamily: K.fontMono, color: b.units === null ? K.textMuted : b.units === 0 ? K.warning : K.text }}>
                {b.units === null ? (b.missingPrice ? "N/A" : "—") : b.units === 0 ? "< 1 unit" : Math.abs(b.units)}
              </span>
              <span style={{ color: costData ? (b.action === "SELL" ? K.negative : K.warning) : K.textMuted, fontSize: 12.5, fontFamily: K.fontMono }}>
                {costData ? `Rs. ${Math.round(costData.total).toLocaleString()}` : "—"}
                {b.action === "SELL" && costData && <span style={{ fontSize: 10, color: K.textMuted, display: "block" }}>+CGT if profit</span>}
              </span>
            </div>
          );
        })}
      </div>
      {bridge.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: COLS, fontSize: 13, padding: `${SP.sm}px 0`, borderTop: `1px solid ${K.borderStrong}`, marginTop: SP.xs, fontWeight: 600 }}>
          <span style={{ color: K.textMuted, fontSize: 11 }}>Total</span>
          <span style={{ color: K.text, fontFamily: K.fontMono }}>{hasPriceData ? `${currentCoveragePct.toFixed(1)}%` : "—"}</span>
          <span style={{ color: K.text, fontFamily: K.fontMono }}>{targetCoveragePct.toFixed(1)}%</span>
          <span /><span />
          <span style={{ color: K.warning, fontFamily: K.fontMono }}>{totalEstCost > 0 ? `Rs. ${Math.round(totalEstCost).toLocaleString()}` : "—"}</span>
        </div>
      )}
      {orphanCount > 0 && <div style={{ fontSize: 11, color: K.textMuted, marginTop: SP.sm }}>* Not covered by the model. Consider reviewing or exiting.</div>}
    </Panel>
    <Panel><SL>Portfolio Summary</SL>
      {missingFromPrices.length > 0 && hasPriceData && (
        <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
          Portfolio value is partial — {missingFromPrices.length} holding{missingFromPrices.length > 1 ? "s" : ""} could not be priced.
        </div>
      )}
      {!hasPriceData && (
        <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
          Price data unavailable for all holdings — portfolio value cannot be calculated.
        </div>
      )}
      <div style={{ padding: SP.xl, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.md, textAlign: "center", marginBottom: SP.lg }}>
        <div style={{ fontSize: 12, color: K.textSecondary, marginBottom: SP.sm }}>
          Estimated portfolio value{missingFromPrices.length > 0 ? " (partial)" : ""}
        </div>
        <div style={{ fontSize: 26, color: hasPriceData ? K.text : K.textMuted, fontFamily: K.fontMono }}>
          {hasPriceData ? `Rs. ${pricedValue.toLocaleString()}` : "—"}
        </div>
        {hasPriceData && (
          <div style={{ fontSize: 11, color: K.textMuted, marginTop: SP.xs }}>
            Current % based on Rs.{pricedValue.toLocaleString()} total
          </div>
        )}
      </div>

      {hasPriceData && (() => {
        const tradesWithCost = bridge
          .filter(b => b.action !== "HOLD" && b.units !== null && b.units !== 0 && b.costData)
          .map(b => ({ ...b, turnover: b.price * Math.abs(b.units), cost: b.costData }));

        if (tradesWithCost.length === 0) return null;

        const totalTurnover = tradesWithCost.reduce((s, t) => s + t.turnover, 0);
        const totalBroker = tradesWithCost.reduce((s, t) => s + t.cost.broker, 0);
        const totalSEBON = tradesWithCost.reduce((s, t) => s + t.cost.sebon, 0);
        const totalNEPSE = tradesWithCost.reduce((s, t) => s + t.cost.nepse, 0);
        const totalDP = tradesWithCost.reduce((s, t) => s + t.cost.dp, 0);
        const totalAllFees = totalBroker + totalSEBON + totalNEPSE + totalDP;
        const effectiveRate = totalTurnover > 0 ? (totalAllFees / totalTurnover * 100) : 0;

        const feeRow = (label, value, color = K.textSecondary, note = "") => (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${SP.xs + 1}px 0`, borderBottom: `1px solid ${K.border}`, fontSize: 13 }}>
            <span style={{ color: K.textSecondary, fontSize: 12.5 }}>{label}{note && <span style={{ color: K.textMuted, fontSize: 11, marginLeft: 4 }}>{note}</span>}</span>
            <span style={{ color, fontFamily: K.fontMono }}>{typeof value === "string" ? value : `Rs. ${Math.round(value).toLocaleString()}`}</span>
          </div>
        );

        return (
          <div style={{ marginTop: SP.lg, padding: `${SP.md + 2}px ${SP.lg}px`, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.md }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: K.text, marginBottom: SP.md }}>NEPSE Transaction Costs · May 2024 Rates</div>
            {feeRow("Total Turnover", totalTurnover, K.text)}
            {feeRow("Broker Commission", totalBroker, K.text, "(0.24–0.36% tiered)")}
            {feeRow("SEBON Fee", totalSEBON, K.textSecondary, "(0.015%)")}
            {feeRow("NEPSE Fee", totalNEPSE, K.textSecondary, "(20% of broker)")}
            {feeRow("DP Charge", totalDP, K.textSecondary, `(Rs. 25 × ${tradesWithCost.length} trades)`)}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${SP.sm}px 0`, marginTop: SP.xs, borderTop: `1px solid ${K.borderStrong}`, fontSize: 14, fontWeight: 600 }}>
              <span style={{ color: K.text }}>Total fees (excl. CGT)</span>
              <span style={{ color: K.text, fontFamily: K.fontMono }}>{`Rs. ${Math.round(totalAllFees).toLocaleString()}`}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: K.textMuted, marginTop: SP.xs }}>
              <span>Effective fee rate</span>
              <span style={{ color: K.textSecondary, fontFamily: K.fontMono }}>{effectiveRate.toFixed(3)}% of turnover</span>
            </div>
            {tradesWithCost.some(t => t.action === "SELL") && (
              <div style={{ marginTop: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.negative}14`, border: `1px solid ${K.negative}33`, borderRadius: RADIUS.sm, fontSize: 12, color: K.textSecondary, lineHeight: 1.7 }}>
                <span style={{ color: K.negative, fontWeight: 600 }}>Capital gains tax (sellers)</span><br />
                Individual investors: <span style={{ color: K.text }}>5%</span> if held &gt;365 days · <span style={{ color: K.text }}>7.5%</span> if held ≤365 days<br />
                CGT is on <em>net profit</em>, not turnover — enter buy prices to calculate.
              </div>
            )}
            <div style={{ marginTop: SP.sm, fontSize: 11, color: K.textMuted, lineHeight: 1.6 }}>
              Rates per SEBON circular, effective May 14 2024. DP charge Rs. 25/transaction.<br />
              These are estimates — verify with your broker before executing.
            </div>
          </div>
        );
      })()}
    </Panel>
  </div>);
}

export { BridgeTrades };

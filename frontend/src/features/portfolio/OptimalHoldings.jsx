import { useState, useEffect } from "react";
import { K, SP, RADIUS, REGIME_COLORS, REGIME_LABELS, FALLBACK_SEC_NAMES, buildSecColors } from "../../components/common/theme.js";
import { SL } from "../../components/layout/Panel.jsx";
import { MetricRow } from "../../components/common/MetricCard.jsx";
import { ProjectionChart } from "../../components/charts/ProjectionChart.jsx";
import portfolioApi from "../../lib/api/portfolio.js";

// The target-allocation math (resolve portfolio value, floor units,
// build the sector breakdown, run the 5-year Monte Carlo projection) all
// used to run in this component on every render, against the full raw
// returns matrix. It's now GET /api/portfolio/optimal-holdings — see
// backend/src/quant/portfolioTools.js:buildOptimalHoldings +
// backend/src/services/portfolioService.js. This component just displays
// whatever comes back.
function OptimalHoldings({ result, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    portfolioApi.getOptimalHoldings().then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [result.id, refreshKey]);

  if (error) return <div style={{ padding: SP.md, fontSize: 13, color: K.negative }}>{error.message}</div>;
  if (!data) return <div style={{ padding: SP.md, fontSize: 13, color: K.textSecondary }}>Loading optimal holdings…</div>;

  const { pricedValue, hasPriceData, optimalHoldings, closedStocks, totalWeight, totalValue, sectorData, projection } = data;
  const STALE_WINDOW = 30;
  const secNames = data.sectorNames || result.sectorNames || FALLBACK_SEC_NAMES;
  const secColors = buildSecColors(secNames);
  const regimeColor = REGIME_COLORS[result.lastRegime] || K.text;
  const regimeLabel = REGIME_LABELS[result.lastRegime] || "Calm";

  return (
    <div>
      <MetricRow columns={4} items={[
        { label: "Portfolio Value", value: hasPriceData ? `Rs. ${Math.round(pricedValue).toLocaleString()}` : "—", tone: "accent", hint: !hasPriceData ? "Upload portfolio CSV above" : null },
        { label: "Optimal Positions", value: optimalHoldings.length, tone: "positive" },
        { label: "Capital Deployed", value: `${(totalWeight * 100).toFixed(1)}%`, tone: "accent" },
        { label: "Regime", value: regimeLabel, color: regimeColor },
      ]} />

      <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: SP.xl, alignItems: "start", marginTop: SP.xl }}>
        <div style={{ minWidth: 0 }}>
          <SL right={`Target allocation from Rs.${hasPriceData ? Math.round(pricedValue).toLocaleString() : "—"}`}>Optimal Holdings</SL>
          {!hasPriceData && (
            <div style={{ marginBottom: SP.md, padding: `${SP.sm + 2}px ${SP.md + 2}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
              No portfolio value detected — upload a portfolio CSV (columns: <span style={{ fontFamily: K.fontMono, color: K.text }}>Scrip</span>, <span style={{ fontFamily: K.fontMono, color: K.text }}>Current Balance</span>) to compute unit counts and target values.
            </div>
          )}
          {closedStocks.length > 0 && (
            <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.negative}14`, border: `1px solid ${K.negative}33`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.negative, display: "flex", justifyContent: "space-between", alignItems: "center", gap: SP.sm, flexWrap: "wrap" }}>
              <span><strong>{closedStocks.length} closed/halted stock{closedStocks.length > 1 ? "s" : ""} excluded</strong> — no price movement in the last {STALE_WINDOW} sessions</span>
              <span style={{ color: K.textMuted, fontSize: 11.5 }}>{closedStocks.join(", ")}</span>
            </div>
          )}
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="num" data-align="right">#</th>
                  <th>Ticker · Sector</th>
                  <th className="num" data-align="right">Weight</th>
                  <th className="num" data-align="right">Signal</th>
                  <th className="num" data-align="right">Target Value</th>
                  <th className="num" data-align="right">Price</th>
                  <th className="num" data-align="right">Units to Hold</th>
                </tr>
              </thead>
              <tbody>
                {optimalHoldings.map((h, i) => {
                  const sIdx = secNames.indexOf(h.sector);
                  const sColor = sIdx !== -1 ? secColors[sIdx] : K.textMuted;
                  return (
                    <tr key={h.ticker}>
                      <td className="num" data-align="right" style={{ color: K.textMuted }}>{i + 1}</td>
                      <td>
                        <span style={{ color: K.text, fontFamily: K.fontMono, fontWeight: 600 }}>{h.ticker}</span>
                        <span style={{ fontSize: 11, color: sColor, marginLeft: SP.xs + 2 }}>{h.sector}</span>
                      </td>
                      <td data-align="right">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                          <div style={{ width: Math.max(2, (h.weight / (optimalHoldings[0]?.weight || 1)) * 46), height: 5, background: K.positive, borderRadius: 2 }} />
                          <span className="num" style={{ color: K.positive, fontSize: 11.5 }}>{(h.weight * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="num" data-align="right" style={{ color: h.signal > 0 ? K.positive : K.negative }}>{h.signal.toFixed(4)}</td>
                      <td className="num" data-align="right" style={{ color: K.text }}>{hasPriceData ? `Rs. ${Math.round(h.targetValue).toLocaleString()}` : "—"}</td>
                      <td className="num" data-align="right" style={{ color: K.textSecondary }}>{h.price ? `Rs. ${h.price.toLocaleString()}` : "—"}</td>
                      <td className="num" data-align="right" style={{ color: h.units !== null && h.units > 0 ? K.text : h.units === 0 ? K.warning : K.textMuted, fontWeight: h.units > 0 ? 600 : 400 }}>
                        {h.units === null ? "—" : h.units === 0 ? "< 1 unit" : h.units.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 600 }}>
                  <td colSpan={2} style={{ color: K.textMuted, fontSize: 11, borderBottom: "none" }}>Total</td>
                  <td className="num" data-align="right" style={{ color: K.positive, borderBottom: "none" }}>{(totalWeight * 100).toFixed(1)}%</td>
                  <td style={{ borderBottom: "none" }} />
                  <td className="num" data-align="right" style={{ color: K.text, borderBottom: "none" }}>{hasPriceData ? `Rs. ${Math.round(totalValue).toLocaleString()}` : "—"}</td>
                  <td style={{ borderBottom: "none" }} /><td style={{ borderBottom: "none" }} />
                </tr>
              </tfoot>
            </table>
          </div>
          {optimalHoldings.some(h => h.units === 0 && hasPriceData) && (
            <div style={{ marginTop: SP.sm, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
              <strong>"&lt; 1 unit"</strong> means your portfolio value × this stock's weight is less than one share's price. You'd need a larger portfolio (or higher weight) to hold even a single share.
            </div>
          )}
        </div>

        <div>
          <SL>Sector Allocation</SL>
          {sectorData.map((s) => {
            const sIdx = secNames.indexOf(s.sector);
            const sColor = sIdx !== -1 ? secColors[sIdx] : K.textMuted;
            return (
              <div key={s.sector} style={{ marginBottom: SP.md + 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: sColor }}>{s.sector}</span>
                  <span style={{ fontSize: 13, color: K.text, fontFamily: K.fontMono }}>{s.weight.toFixed(1)}%</span>
                </div>
                <div style={{ height: 5, background: K.surfaceElevated, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (s.weight / (sectorData[0]?.weight || 1)) * 100)}%`, background: sColor, borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
                {hasPriceData && (
                  <div style={{ fontSize: 11, color: K.textMuted, marginTop: 3 }}>
                    Rs. {Math.round(pricedValue * s.weight / 100).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ marginTop: SP.lg, padding: `${SP.md}px ${SP.md + 2}px`, background: K.surfaceElevated, borderRadius: RADIUS.sm, border: `1px solid ${K.border}` }}>
            <div style={{ fontSize: 11, color: K.textMuted, marginBottom: SP.xs }}>Cash / Undeployed</div>
            <div style={{ fontSize: 18, color: K.warning, fontFamily: K.fontMono }}>
              {(Math.max(0, 1 - totalWeight) * 100).toFixed(1)}%
            </div>
            {hasPriceData && (
              <div style={{ fontSize: 12, color: K.textMuted, marginTop: 4 }}>
                Rs. {Math.round(pricedValue * Math.max(0, 1 - totalWeight)).toLocaleString()}
              </div>
            )}
          </div>
          <div style={{ marginTop: SP.md, fontSize: 11.5, color: K.textMuted, lineHeight: 1.7 }}>
            Weights are regime-adjusted ({regimeLabel} mode). Units are floored to whole shares. Always verify prices before trading.
          </div>
        </div>
      </div>

      <hr className="divider" />
      <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
        Monte Carlo simulation based on historical statistics — not a financial forecast.
      </div>
      {hasPriceData && projection ? (
        <ProjectionChart data={projection} color={K.positive} title={`5-Year Projection · Optimal Holdings · Base: Rs. ${Math.round(pricedValue).toLocaleString()}`} initialValue={pricedValue} />
      ) : (
        <div style={{ padding: SP.xl, textAlign: "center", color: K.textSecondary, fontSize: 13 }}>
          Upload a portfolio CSV with priced holdings to generate a 5-year projection.
        </div>
      )}
    </div>
  );
}

export { OptimalHoldings };

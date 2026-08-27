import { useState, useEffect } from "react";
import { K, SP, RADIUS, FALLBACK_SEC_NAMES, buildSecColors } from "../../components/common/theme.js";
import { SL } from "../../components/layout/Panel.jsx";
import { MetricRow } from "../../components/common/MetricCard.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { ProjectionChart } from "../../components/charts/ProjectionChart.jsx";
import portfolioApi from "../../lib/api/portfolio.js";

// Holdings resolution + the equal-weight 5-year projection both used to
// run in this component. Now GET /api/portfolio/holdings — see
// backend/src/services/portfolioService.js:getHoldings.
function PortfolioTab({ result, userPortfolioCount, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    portfolioApi.getHoldings().then(d => { if (!cancelled) setData(d); }).catch(err => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [result.id, refreshKey]);

  if (userPortfolioCount === 0) {
    return (
      <EmptyState
        title="No portfolio loaded"
        description={<>Upload your portfolio CSV above (columns: <span style={{ color: K.text, fontFamily: K.fontMono }}>Scrip</span>, <span style={{ color: K.text, fontFamily: K.fontMono }}>Current Balance</span>) to view holdings and projections.</>}
      />
    );
  }
  if (error) return <div style={{ padding: SP.md, fontSize: 13, color: K.negative }}>{error.message}</div>;
  if (!data) return <div style={{ padding: SP.md, fontSize: 13, color: K.textSecondary }}>Loading holdings…</div>;

  const { holdings: resolved, count, pricedCount, pricedValue: totalValue, hasPriceData, projection: projData } = data;
  const priced = resolved.filter(e => e.value !== null);
  const unpriced = resolved.filter(e => e.value === null);
  const secNames = result.sectorNames || FALLBACK_SEC_NAMES;
  const secColors = buildSecColors(secNames);

  const sectorMap = {};
  priced.forEach(e => { sectorMap[e.sector] = (sectorMap[e.sector] || 0) + e.value; });
  const sectorData = Object.entries(sectorMap).map(([s, v]) => ({ sector: s, value: v, pct: totalValue > 0 ? v / totalValue * 100 : 0 })).sort((a, b) => b.value - a.value);

  return (
    <div>
      <MetricRow columns={4} items={[
        { label: "Portfolio Value", value: hasPriceData ? `Rs. ${Math.round(totalValue).toLocaleString()}` : "—", tone: "accent" },
        { label: "Holdings", value: count, tone: "neutral" },
        { label: "Priced", value: `${pricedCount} / ${count}`, tone: "positive" },
        { label: "Unpriced", value: unpriced.length, tone: unpriced.length > 0 ? "warning" : "neutral" },
      ]} />

      <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: SP.xl, alignItems: "start", marginTop: SP.xl }}>
        <div style={{ minWidth: 0 }}>
          <SL>Holdings · Current Positions</SL>
          <div className="data-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="num" data-align="right">#</th>
                  <th>Ticker · Sector</th>
                  <th className="num" data-align="right">Units</th>
                  <th className="num" data-align="right">Price</th>
                  <th className="num" data-align="right">Value</th>
                  <th className="num" data-align="right">Weight</th>
                  <th className="num" data-align="right">Signal</th>
                </tr>
              </thead>
              <tbody>
                {[...resolved].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((e, i) => {
                  const sIdx = secNames.indexOf(e.sector);
                  const sColor = sIdx !== -1 ? secColors[sIdx] : K.textMuted;
                  const weight = hasPriceData && e.value ? e.value / totalValue : 0;
                  return (
                    <tr key={e.symbol}>
                      <td className="num" data-align="right" style={{ color: K.textMuted }}>{i + 1}</td>
                      <td>
                        <span style={{ color: K.text, fontFamily: K.fontMono, fontWeight: 600 }}>{e.symbol}</span>
                        <span style={{ fontSize: 11, color: sColor, marginLeft: SP.xs + 2 }}>{e.sector}</span>
                      </td>
                      <td className="num" data-align="right" style={{ color: K.text }}>{e.quantity.toLocaleString()}</td>
                      <td className="num" data-align="right" style={{ color: K.textSecondary }}>{e.price ? e.price.toLocaleString() : "—"}</td>
                      <td className="num" data-align="right" style={{ color: K.text, fontWeight: 600 }}>{e.value ? Math.round(e.value).toLocaleString() : "—"}</td>
                      <td data-align="right">
                        {hasPriceData && e.value ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: SP.xs }}>
                            <div style={{ width: Math.max(2, weight * 90), height: 5, background: sColor, borderRadius: 2 }} />
                            <span className="num" style={{ color: sColor, fontSize: 11.5 }}>{(weight * 100).toFixed(1)}%</span>
                          </div>
                        ) : <span style={{ color: K.textMuted }}>—</span>}
                      </td>
                      <td className="num" data-align="right" style={{ color: e.signal === null ? K.textMuted : e.signal > 0 ? K.positive : K.negative }}>
                        {e.signal !== null ? e.signal.toFixed(4) : "N/A"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 600 }}>
                  <td colSpan={4} style={{ color: K.textMuted, fontSize: 11, borderBottom: "none" }}>Total</td>
                  <td className="num" data-align="right" style={{ color: K.text, borderBottom: "none" }}>{hasPriceData ? Math.round(totalValue).toLocaleString() : "—"}</td>
                  <td className="num" data-align="right" style={{ color: K.positive, borderBottom: "none" }}>100%</td>
                  <td style={{ borderBottom: "none" }} />
                </tr>
              </tfoot>
            </table>
          </div>
          {unpriced.length > 0 && (
            <div style={{ marginTop: SP.sm, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
              {unpriced.length} holding{unpriced.length > 1 ? "s" : ""} could not be priced from available data: {unpriced.map(e => e.symbol).join(", ")}
            </div>
          )}
        </div>

        <div>
          <SL>Sector Exposure</SL>
          {sectorData.length === 0 ? (
            <div style={{ color: K.textSecondary, fontSize: 13 }}>Upload a portfolio to see the sector breakdown.</div>
          ) : sectorData.map(s => {
            const sIdx = secNames.indexOf(s.sector);
            const sColor = sIdx !== -1 ? secColors[sIdx] : K.textMuted;
            return (
              <div key={s.sector} style={{ marginBottom: SP.md + 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: sColor }}>{s.sector}</span>
                  <span style={{ fontSize: 13, color: K.text, fontFamily: K.fontMono }}>{s.pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 5, background: K.surfaceElevated, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, s.pct)}%`, background: sColor, borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: 11, color: K.textMuted, marginTop: 3 }}>Rs. {Math.round(s.value).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="divider" />
      <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning, lineHeight: 1.6 }}>
        Projection is a Monte Carlo simulation based on historical return statistics. It is not a forecast — past performance does not guarantee future results.
      </div>
      {hasPriceData && projData ? (
        <ProjectionChart
          data={projData}
          color={K.accent}
          title={`5-Year Projection · Current Holdings Held Unchanged · Base: Rs. ${Math.round(totalValue).toLocaleString()}`}
          initialValue={totalValue}
        />
      ) : (
        <div style={{ padding: SP.xxl, textAlign: "center", color: K.textSecondary, fontSize: 13 }}>
          Portfolio value unavailable — upload a portfolio CSV with priced holdings to generate the projection.
        </div>
      )}
    </div>
  );
}

export { PortfolioTab };

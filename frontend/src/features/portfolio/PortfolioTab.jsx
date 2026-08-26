import { useState, useEffect } from "react";
import { K, SP, RADIUS, FALLBACK_SEC_NAMES, buildSecColors } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { MetricRow } from "../../components/common/MetricCard.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { ProjectionChart } from "../../components/charts/ProjectionChart.jsx";
import portfolioApi from "../../lib/api/portfolio.js";

const COLS = "60px 1fr 80px 80px 90px 80px 70px";

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
      <Panel>
        <EmptyState
          title="No portfolio loaded"
          description={<>Upload your portfolio CSV above (columns: <span style={{ color: K.text, fontFamily: K.fontMono }}>Scrip</span>, <span style={{ color: K.text, fontFamily: K.fontMono }}>Current Balance</span>) to view holdings and projections.</>}
        />
      </Panel>
    );
  }
  if (error) return <Panel><div style={{ padding: SP.md, fontSize: 13, color: K.negative }}>{error.message}</div></Panel>;
  if (!data) return <Panel><div style={{ padding: SP.md, fontSize: 13, color: K.textSecondary }}>Loading holdings…</div></Panel>;

  const { holdings: resolved, count, pricedCount, pricedValue: totalValue, hasPriceData, projection: projData } = data;
  const priced = resolved.filter(e => e.value !== null);
  const unpriced = resolved.filter(e => e.value === null);
  const secNames = result.sectorNames || FALLBACK_SEC_NAMES;
  const secColors = buildSecColors(secNames);

  const sectorMap = {};
  priced.forEach(e => { sectorMap[e.sector] = (sectorMap[e.sector] || 0) + e.value; });
  const sectorData = Object.entries(sectorMap).map(([s, v]) => ({ sector: s, value: v, pct: totalValue > 0 ? v / totalValue * 100 : 0 })).sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.lg }}>
      <MetricRow columns={4} items={[
        { label: "Portfolio Value", value: hasPriceData ? `Rs. ${Math.round(totalValue).toLocaleString()}` : "—", tone: "accent" },
        { label: "Holdings", value: count, tone: "neutral" },
        { label: "Priced", value: `${pricedCount} / ${count}`, tone: "positive" },
        { label: "Unpriced", value: unpriced.length, tone: unpriced.length > 0 ? "warning" : "neutral" },
      ]} />

      <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: SP.lg, alignItems: "start" }}>
        <Panel>
          <SL>Holdings · Current Positions</SL>
          <div style={{ display: "grid", gridTemplateColumns: COLS, fontSize: 11, color: K.textMuted, marginBottom: SP.sm, borderBottom: `1px solid ${K.border}`, paddingBottom: SP.sm }}>
            <span>#</span><span>Ticker · Sector</span><span>Units</span><span>Price (Rs.)</span><span>Value (Rs.)</span><span>Weight</span><span>Signal</span>
          </div>
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {[...resolved].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((e, i) => {
              const sIdx = secNames.indexOf(e.sector);
              const sColor = sIdx !== -1 ? secColors[sIdx] : K.textMuted;
              const weight = hasPriceData && e.value ? e.value / totalValue : 0;
              return (
                <div key={e.symbol} className="table-row" style={{ display: "grid", gridTemplateColumns: COLS, fontSize: 13, padding: `${SP.xs + 3}px 0`, borderBottom: `1px solid ${K.border}`, alignItems: "center" }}>
                  <span style={{ color: K.textMuted, fontSize: 11.5 }}>#{i + 1}</span>
                  <div>
                    <span style={{ color: K.text, fontFamily: K.fontMono, fontWeight: 600 }}>{e.symbol}</span>
                    <span style={{ fontSize: 11, color: sColor, marginLeft: SP.xs + 2 }}>{e.sector}</span>
                  </div>
                  <span style={{ fontFamily: K.fontMono, color: K.text }}>{e.quantity.toLocaleString()}</span>
                  <span style={{ fontFamily: K.fontMono, color: K.textSecondary, fontSize: 12.5 }}>{e.price ? e.price.toLocaleString() : "—"}</span>
                  <span style={{ fontFamily: K.fontMono, color: K.text, fontWeight: 600 }}>{e.value ? Math.round(e.value).toLocaleString() : "—"}</span>
                  <span>
                    {hasPriceData && e.value ? (
                      <div style={{ display: "flex", alignItems: "center", gap: SP.xs }}>
                        <div style={{ width: Math.max(2, weight * 220), height: 5, background: sColor, borderRadius: 2 }} />
                        <span style={{ color: sColor, fontSize: 11.5, fontFamily: K.fontMono }}>{(weight * 100).toFixed(1)}%</span>
                      </div>
                    ) : <span style={{ color: K.textMuted }}>—</span>}
                  </span>
                  <span style={{ fontFamily: K.fontMono, color: e.signal === null ? K.textMuted : e.signal > 0 ? K.positive : K.negative, fontSize: 12.5 }}>
                    {e.signal !== null ? e.signal.toFixed(4) : "N/A"}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: COLS, fontSize: 13, padding: `${SP.sm}px 0`, borderTop: `1px solid ${K.borderStrong}`, marginTop: SP.xs, fontWeight: 600 }}>
            <span style={{ color: K.textMuted, fontSize: 11 }}>Total</span>
            <span /><span /><span />
            <span style={{ color: K.text, fontFamily: K.fontMono }}>{hasPriceData ? Math.round(totalValue).toLocaleString() : "—"}</span>
            <span style={{ color: K.positive, fontFamily: K.fontMono }}>100%</span><span />
          </div>
          {unpriced.length > 0 && (
            <div style={{ marginTop: SP.sm, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
              {unpriced.length} holding{unpriced.length > 1 ? "s" : ""} could not be priced from available data: {unpriced.map(e => e.symbol).join(", ")}
            </div>
          )}
        </Panel>

        <Panel>
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
        </Panel>
      </div>

      <Panel>
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
      </Panel>
    </div>
  );
}

export { PortfolioTab };

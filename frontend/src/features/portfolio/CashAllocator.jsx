import { useState } from "react";
import { K, SP, RADIUS, REGIME_COLORS, REGIME_LABELS, FALLBACK_SEC_NAMES, buildSecColors } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { Slider } from "../../components/forms/Slider.jsx";
import { MetricRow } from "../../components/common/MetricCard.jsx";
import { ProjectionChart } from "../../components/charts/ProjectionChart.jsx";
import portfolioApi from "../../lib/api/portfolio.js";

const RISK_CONCENTRATION = { aggressive: 0.30, balanced: 0.22, conservative: 0.15 };
const modeLabels = { aggressive: "Aggressive", balanced: "Balanced", conservative: "Conservative" };
const modeHints = {
  aggressive: "Higher signal boost, up to 30% per stock — max-return focus",
  balanced: "Standard allocation, up to 22% per stock — signal-driven",
  conservative: "Lower concentration, up to 15% per stock — reduced risk",
};

// The scoring (signal + momentum blend), position-cap iteration, and
// leftover-cash redistribution all used to run in this component against
// the full raw returns matrix. It's now POST /api/portfolio/cash-allocation
// — see backend/src/quant/portfolioTools.js:buildCashAllocation. This
// component just collects the three inputs (cash, max positions, risk
// profile) and displays the response; JSX/layout unchanged from the
// original.
function CashAllocator({ result }) {
  const [cashInput, setCashInput] = useState("");
  const [allocated, setAllocated] = useState(null);
  const [topN, setTopN] = useState(10);
  const [riskMode, setRiskMode] = useState("balanced");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const secNames = result.sectorNames || FALLBACK_SEC_NAMES;
  const secColors = buildSecColors(secNames);
  const regimeLabel = REGIME_LABELS[result.lastRegime] || "Calm";
  const regimeColor = REGIME_COLORS[result.lastRegime] || K.text;

  const buildAllocation = async () => {
    const cash = parseFloat(cashInput.replace(/,/g, ""));
    if (!cash || cash <= 0) return;
    setLoading(true); setError(null);
    try {
      const data = await portfolioApi.getCashAllocation(cash, topN, riskMode);
      setAllocated(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.lg }}>
      <Panel>
        <SL>Cash Allocator · Maximum Return Deployment</SL>
        <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: SP.xl, marginBottom: SP.xl }}>
          <div>
            <div style={{ fontSize: 12, color: K.textSecondary, marginBottom: SP.sm }}>Investment amount (Rs.)</div>
            <input
              type="text"
              className="input"
              value={cashInput}
              onChange={e => setCashInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && buildAllocation()}
              placeholder="e.g. 500000"
              style={{ width: "100%", fontSize: 14, fontFamily: K.fontMono, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <Slider label="Max positions" min={3} max={Math.min(15, result.signalData.filter(d => d.weight > 0).length)} step={1} value={topN} onChange={setTopN} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: K.textSecondary, marginBottom: SP.sm }}>Risk profile</div>
            <div style={{ display: "flex" }}>
              {["conservative", "balanced", "aggressive"].map((m, i) => (
                <button key={m} onClick={() => setRiskMode(m)} className={`btn-segment${riskMode === m ? " active" : ""}`} style={{ flex: 1, borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : 0, marginLeft: i > 0 ? -1 : 0 }}>
                  {modeLabels[m]}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: K.textMuted, marginTop: SP.sm, lineHeight: 1.5 }}>{modeHints[riskMode]}</div>
          </div>
        </div>
        <button onClick={buildAllocation} disabled={loading} className="btn btn-primary">
          {loading ? "Computing…" : "Compute Allocation"}
        </button>
        {error && <div style={{ marginTop: SP.sm, fontSize: 13, color: K.negative }}>{error.message}</div>}
      </Panel>

      {allocated && (
        <>
          <MetricRow columns={4} items={[
            { label: "Cash Input", value: `Rs. ${Math.round(allocated.cash).toLocaleString()}`, tone: "accent" },
            { label: "Capital Deployed", value: `Rs. ${Math.round(allocated.deployed).toLocaleString()}`, tone: "positive" },
            { label: "Remaining Cash", value: `Rs. ${Math.round(allocated.leftover).toLocaleString()}`, tone: allocated.leftover > 0 ? "warning" : "positive" },
            { label: "Positions", value: allocated.rows.length, tone: "accent" },
          ]} />

          <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: SP.lg, alignItems: "start" }}>
            <Panel>
              <SL right={<span>Regime: <span style={{ color: regimeColor }}>{regimeLabel}</span></span>}>Optimal Deployment · {modeLabels[riskMode]} Profile</SL>
              {allocated.rows.length === 0 ? (
                <div style={{ padding: SP.xl, textAlign: "center", color: K.textSecondary, fontSize: 13 }}>No eligible positions found.</div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 70px 72px 110px 80px 90px", fontSize: 11, color: K.textMuted, marginBottom: SP.sm, borderBottom: `1px solid ${K.border}`, paddingBottom: SP.sm }}>
                    <span>#</span><span>Ticker · Sector</span><span>Weight</span><span>Signal</span><span>Allocate</span><span>Price</span><span>Units to Buy</span>
                  </div>
                  <div style={{ maxHeight: 520, overflowY: "auto" }}>
                    {allocated.rows.map((h, i) => {
                      const sIdx = secNames.indexOf(h.sector);
                      const sColor = sIdx !== -1 ? secColors[sIdx] : K.textMuted;
                      const pct = (h.allocWeight * 100).toFixed(1);
                      const barW = Math.max(2, (h.allocWeight / (allocated.rows[0]?.allocWeight || 1)) * 50);
                      return (
                        <div key={h.ticker} className="table-row" style={{ display: "grid", gridTemplateColumns: "36px 1fr 70px 72px 110px 80px 90px", fontSize: 13, padding: `${SP.sm}px 0`, borderBottom: `1px solid ${K.border}`, alignItems: "center" }}>
                          <span style={{ color: K.textMuted, fontSize: 11.5 }}>#{i + 1}</span>
                          <div>
                            <span style={{ color: K.text, fontFamily: K.fontMono, fontWeight: 600 }}>{h.ticker}</span>
                            <span style={{ fontSize: 11, color: sColor, marginLeft: SP.xs + 2 }}>{h.sector}</span>
                            {h.momentum > 0.05 && <span style={{ fontSize: 10, color: K.positive, marginLeft: SP.xs }}>↑ mom</span>}
                          </div>
                          <span>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: barW, height: 5, background: K.accent, borderRadius: 2 }} />
                              <span style={{ color: K.accent, fontSize: 11.5, fontFamily: K.fontMono }}>{pct}%</span>
                            </div>
                          </span>
                          <span style={{ color: h.signal > 0 ? K.positive : K.negative, fontSize: 12.5, fontFamily: K.fontMono }}>{h.signal.toFixed(4)}</span>
                          <span style={{ color: K.text, fontFamily: K.fontMono, fontWeight: 600 }}>Rs. {Math.round(h.actualAlloc ?? h.alloc).toLocaleString()}</span>
                          <span style={{ color: K.textSecondary, fontSize: 12.5, fontFamily: K.fontMono }}>{h.price ? `Rs. ${h.price.toLocaleString()}` : "—"}</span>
                          <span style={{ fontFamily: K.fontMono, color: h.units > 0 ? K.text : K.textMuted, fontWeight: h.units > 0 ? 600 : 400 }}>
                            {h.units !== null ? (h.units > 0 ? h.units.toLocaleString() : "< 1 unit") : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 70px 72px 110px 80px 90px", fontSize: 13, padding: `${SP.sm}px 0`, borderTop: `1px solid ${K.borderStrong}`, marginTop: SP.xs, fontWeight: 600 }}>
                    <span style={{ color: K.textMuted, fontSize: 11 }}>Total</span><span />
                    <span style={{ color: K.accent, fontFamily: K.fontMono }}>{(allocated.rows.reduce((s, r) => s + r.allocWeight, 0) * 100).toFixed(1)}%</span>
                    <span />
                    <span style={{ color: K.positive, fontFamily: K.fontMono }}>Rs. {Math.round(allocated.deployed).toLocaleString()}</span>
                    <span /><span />
                  </div>
                  {allocated.leftover > 0 && (
                    <div style={{ marginTop: SP.sm, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
                      Rs. {Math.round(allocated.leftover).toLocaleString()} undeployed — fractional units floored to whole shares. Hold as cash or increase positions.
                    </div>
                  )}
                </>
              )}
            </Panel>

            <Panel>
              <SL>Sector Breakdown</SL>
              {(() => {
                const sMap = {};
                allocated.rows.forEach(h => { sMap[h.sector] = (sMap[h.sector] || 0) + h.allocWeight; });
                const sData = Object.entries(sMap).map(([sec, w]) => ({ sec, w })).sort((a, b) => b.w - a.w);
                const maxW = sData[0]?.w || 1;
                return sData.map(({ sec, w }) => {
                  const sIdx = secNames.indexOf(sec);
                  const sColor = sIdx !== -1 ? secColors[sIdx] : K.textMuted;
                  return (
                    <div key={sec} style={{ marginBottom: SP.md + 2 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: sColor }}>{sec}</span>
                        <span style={{ fontSize: 13, color: K.text, fontFamily: K.fontMono }}>{(w * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 5, background: K.surfaceElevated, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(w / maxW) * 100}%`, background: sColor, borderRadius: 2, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ fontSize: 11, color: K.textMuted, marginTop: 3 }}>
                        Rs. {Math.round(w * allocated.cash).toLocaleString()}
                      </div>
                    </div>
                  );
                });
              })()}
              <div style={{ marginTop: SP.lg, padding: `${SP.md}px ${SP.md + 2}px`, background: K.surfaceElevated, borderRadius: RADIUS.sm, border: `1px solid ${K.border}`, fontSize: 12, color: K.textMuted, lineHeight: 1.7 }}>
                <div style={{ color: K.textSecondary, fontWeight: 600, marginBottom: SP.xs }}>Scoring method</div>
                Signal (topological + ensemble) with a 40% momentum blend, capped at {(RISK_CONCENTRATION[riskMode] * 100).toFixed(0)}% per stock ({modeLabels[riskMode]} mode). Units floored to whole shares. Verify live prices before executing.
              </div>
            </Panel>
          </div>

          <Panel>
            <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
              Monte Carlo simulation based on historical statistics — not a financial forecast.
            </div>
            {allocated.projection && (
              <ProjectionChart data={allocated.projection} color={K.accent} title={`5-Year Projection · ${modeLabels[riskMode]} Profile · Base: Rs. ${Math.round(allocated.cash).toLocaleString()}`} initialValue={allocated.cash} />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

export { CashAllocator };

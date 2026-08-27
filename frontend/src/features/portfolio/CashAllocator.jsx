import { useState } from "react";
import { K, SP, RADIUS, REGIME_COLORS, REGIME_LABELS, FALLBACK_SEC_NAMES, buildSecColors } from "../../components/common/theme.js";
import { SL } from "../../components/layout/Panel.jsx";
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
// profile) and displays the response.
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
    <div>
      <SL>Deploy New Cash</SL>
      <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: SP.xl, marginBottom: SP.lg }}>
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

      {allocated && (<>
        <hr className="divider" />
        <MetricRow columns={4} items={[
          { label: "Cash Input", value: `Rs. ${Math.round(allocated.cash).toLocaleString()}`, tone: "accent" },
          { label: "Capital Deployed", value: `Rs. ${Math.round(allocated.deployed).toLocaleString()}`, tone: "positive" },
          { label: "Remaining Cash", value: `Rs. ${Math.round(allocated.leftover).toLocaleString()}`, tone: allocated.leftover > 0 ? "warning" : "positive" },
          { label: "Positions", value: allocated.rows.length, tone: "accent" },
        ]} />

        <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: SP.xl, alignItems: "start", marginTop: SP.xl }}>
          <div style={{ minWidth: 0 }}>
            <SL right={<span>Regime <span style={{ color: regimeColor }}>{regimeLabel}</span></span>}>Optimal Deployment · {modeLabels[riskMode]}</SL>
            {allocated.rows.length === 0 ? (
              <div style={{ padding: SP.xl, textAlign: "center", color: K.textSecondary, fontSize: 13 }}>No eligible positions found.</div>
            ) : (
              <>
                <div className="data-table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="num" data-align="right">#</th>
                        <th>Ticker · Sector</th>
                        <th className="num" data-align="right">Weight</th>
                        <th className="num" data-align="right">Signal</th>
                        <th className="num" data-align="right">Allocate</th>
                        <th className="num" data-align="right">Price</th>
                        <th className="num" data-align="right">Units to Buy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocated.rows.map((h, i) => {
                        const sIdx = secNames.indexOf(h.sector);
                        const sColor = sIdx !== -1 ? secColors[sIdx] : K.textMuted;
                        const pct = (h.allocWeight * 100).toFixed(1);
                        const barW = Math.max(2, (h.allocWeight / (allocated.rows[0]?.allocWeight || 1)) * 50);
                        return (
                          <tr key={h.ticker}>
                            <td className="num" data-align="right" style={{ color: K.textMuted }}>{i + 1}</td>
                            <td>
                              <span style={{ color: K.text, fontFamily: K.fontMono, fontWeight: 600 }}>{h.ticker}</span>
                              <span style={{ fontSize: 11, color: sColor, marginLeft: SP.xs + 2 }}>{h.sector}</span>
                              {h.momentum > 0.05 && <span style={{ fontSize: 10, color: K.positive, marginLeft: SP.xs }}>↑ mom</span>}
                            </td>
                            <td data-align="right">
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                <div style={{ width: barW, height: 5, background: K.accent, borderRadius: 2 }} />
                                <span className="num" style={{ color: K.accent, fontSize: 11.5 }}>{pct}%</span>
                              </div>
                            </td>
                            <td className="num" data-align="right" style={{ color: h.signal > 0 ? K.positive : K.negative }}>{h.signal.toFixed(4)}</td>
                            <td className="num" data-align="right" style={{ color: K.text, fontWeight: 600 }}>Rs. {Math.round(h.actualAlloc ?? h.alloc).toLocaleString()}</td>
                            <td className="num" data-align="right" style={{ color: K.textSecondary }}>{h.price ? `Rs. ${h.price.toLocaleString()}` : "—"}</td>
                            <td className="num" data-align="right" style={{ color: h.units > 0 ? K.text : K.textMuted, fontWeight: h.units > 0 ? 600 : 400 }}>
                              {h.units !== null ? (h.units > 0 ? h.units.toLocaleString() : "< 1 unit") : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 600 }}>
                        <td colSpan={2} style={{ color: K.textMuted, fontSize: 11, borderBottom: "none" }}>Total</td>
                        <td className="num" data-align="right" style={{ color: K.accent, borderBottom: "none" }}>{(allocated.rows.reduce((s, r) => s + r.allocWeight, 0) * 100).toFixed(1)}%</td>
                        <td style={{ borderBottom: "none" }} />
                        <td className="num" data-align="right" style={{ color: K.positive, borderBottom: "none" }}>Rs. {Math.round(allocated.deployed).toLocaleString()}</td>
                        <td style={{ borderBottom: "none" }} /><td style={{ borderBottom: "none" }} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {allocated.leftover > 0 && (
                  <div style={{ marginTop: SP.sm, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
                    Rs. {Math.round(allocated.leftover).toLocaleString()} undeployed — fractional units floored to whole shares. Hold as cash or increase positions.
                  </div>
                )}
              </>
            )}
          </div>

          <div>
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
          </div>
        </div>

        <hr className="divider" />
        <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.warning}1A`, border: `1px solid ${K.warning}4D`, borderRadius: RADIUS.sm, fontSize: 12.5, color: K.warning }}>
          Monte Carlo simulation based on historical statistics — not a financial forecast.
        </div>
        {allocated.projection && (
          <ProjectionChart data={allocated.projection} color={K.accent} title={`5-Year Projection · ${modeLabels[riskMode]} Profile · Base: Rs. ${Math.round(allocated.cash).toLocaleString()}`} initialValue={allocated.cash} />
        )}
      </>)}
    </div>
  );
}

export { CashAllocator };

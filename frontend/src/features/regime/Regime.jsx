import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { K, SP, RADIUS, TTP, REGIME_COLORS, REGIME_LABELS, regimeDescriptor } from "../../components/common/theme.js";
import { SL } from "../../components/layout/Panel.jsx";
import { MetricRow } from "../../components/common/MetricCard.jsx";
import { RegimeTerrain } from "../../components/charts/RegimeTerrain.jsx";
import { Heatmap } from "../../components/charts/Heatmap.jsx";
import { RegimeTimeline } from "../../components/charts/RegimeTimeline.jsx";
import { RegimeAlerts } from "./RegimeAlerts.jsx";

// Market structure, read top to bottom as one analytical conclusion:
// current state → what it's built on (correlation structure) → how it
// got here (history) → the numbers behind it → the news filter that can
// override it → the full transition log for anyone who wants the detail.
function Regime({ result, newsData = [] }) {
  const rs = result.regimeSeries;
  const counts = rs.reduce((g, p) => ({ ...g, [p.regime]: (g[p.regime] || 0) + 1 }), {});
  const last = rs[rs.length - 1] || {};
  const regimeCol = REGIME_COLORS[last.regime] || K.textMuted;
  const regimeLabel = REGIME_LABELS[last.regime] || "—";

  const ns = result.newsSentiment || { scale: 1, label: "neutral", negFrac: 0 };
  const nsCol = ns.label === "crisis" ? K.negative : ns.label === "stress" ? K.warning : ns.label === "insufficient" ? K.textMuted : K.positive;
  const nsLabel = { crisis: "Crisis", stress: "Stress", positive: "Positive", neutral: "Neutral", insufficient: "Insufficient data" }[ns.label] || ns.label;

  // Same average-pairwise-correlation scan the old Overview page used to
  // run beside the Heatmap — moved here since correlation structure is a
  // regime concern, not a backtest-performance one.
  const n = result.tickers.length;
  let corrSum = 0, corrCount = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { corrSum += result.corr[i * n + j]; corrCount++; }
  const avgCorrAll = corrCount > 0 ? +(corrSum / corrCount).toFixed(3) : 0;
  const corrAlert = avgCorrAll > 0.7;

  // Same nearest-epsilon homology lookup RegimeTerrain uses for its own
  // β1 footer stat — repeated here (not imported) since it's a two-line
  // pure function, not worth a shared module for.
  const eps = last.intEps ?? 0.9;
  const homo = result.homoData || [];
  const nearestHomo = homo.reduce((best, p) => (best == null || Math.abs(p.eps - eps) < Math.abs(best.eps - eps)) ? p : best, null) || { β1: 0 };

  return (<div>
    <div className="section-eyebrow" style={{ marginBottom: SP.sm }}>Market Regime</div>
    <div style={{ fontSize: 32, fontWeight: 600, color: regimeCol, lineHeight: 1.1 }}>{regimeLabel}</div>
    <div style={{ fontSize: 13, color: K.textSecondary, marginTop: 6 }}>{regimeDescriptor(last.regime, last.avgCorr, last.realisedVol)}</div>

    <hr className="divider" />
    <SL right="Point cloud: MDS on correlation distance · field: local density">Correlation Structure</SL>
    <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: SP.xl }}>
      <RegimeTerrain result={result} />
      <div>
        <div style={{ fontSize: 12, color: K.textMuted, marginBottom: SP.sm }}>Correlation matrix</div>
        <Heatmap corr={result.corr} n={n} />
        {corrAlert ? (
          <div style={{ marginTop: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: `${K.negative}1A`, border: `1px solid ${K.negative}4D`, borderRadius: RADIUS.sm, fontSize: 12, color: K.negative }}>
            Avg pairwise correlation {avgCorrAll} — diversification has nearly collapsed.
          </div>
        ) : (
          <div style={{ marginTop: SP.sm, fontSize: 12, color: K.textMuted }}>
            Avg pairwise correlation <span style={{ fontFamily: K.fontMono, color: avgCorrAll > 0.5 ? K.warning : K.positive }}>{avgCorrAll}</span>{avgCorrAll > 0.5 ? " — elevated" : " — healthy"}
          </div>
        )}
      </div>
    </div>

    <hr className="divider" />
    <SL right={`${rs.length} periods`}>Regime History</SL>
    <RegimeTimeline regimeSeries={rs} />
    <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xl, marginTop: SP.xl }}>
      <div>
        <SL>Integration Speed (ε)</SL>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={rs} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs><linearGradient id="ig" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={K.accent} stopOpacity={0.3} /><stop offset="95%" stopColor={K.accent} stopOpacity={0} /></linearGradient></defs>
            <XAxis dataKey="day" stroke={K.border} tick={{ fontSize: 11, fill: K.textMuted, fontFamily: K.fontUI }} />
            <YAxis stroke={K.border} tick={{ fontSize: 11, fill: K.textMuted, fontFamily: K.fontUI }} />
            <Tooltip {...TTP} />
            <Area type="monotone" dataKey="intEps" stroke={K.accent} fill="url(#ig)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div>
        <SL>Regime Distribution</SL>
        {["calm", "stress", "crisis", "fragmented"].map(reg => (
          <div key={reg} style={{ marginBottom: SP.sm + 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, color: K.textSecondary }}>{REGIME_LABELS[reg]}</span>
              <span style={{ fontSize: 12.5, fontFamily: K.fontMono, color: K.text }}>{(((counts[reg] || 0) / rs.length) * 100).toFixed(0)}%</span>
            </div>
            <div style={{ height: 5, background: K.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(counts[reg] || 0) / rs.length * 100}%`, background: REGIME_COLORS[reg] }} />
            </div>
          </div>
        ))}
      </div>
    </div>

    <hr className="divider" />
    <SL>Market Conditions</SL>
    <MetricRow columns={4} items={[
      { label: "Correlation", value: last.avgCorr != null ? last.avgCorr.toFixed(2) : "—" },
      { label: "Volatility", value: last.realisedVol != null ? `${(last.realisedVol * 100).toFixed(1)}%` : "—" },
      { label: "Integration", value: last.intEps != null ? last.intEps.toFixed(2) : "—" },
      { label: "β1", value: nearestHomo.β1 ?? "—" },
    ]} />

    <hr className="divider" />
    <SL>News Sentiment Filter</SL>
    {newsData.length === 0 ? (
      <div style={{ fontSize: 12.5, color: K.textSecondary, lineHeight: 1.8 }}>
        No news data — run <code style={{ fontFamily: K.fontMono, fontSize: 11.5, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.sm, padding: "1px 6px", color: K.text }}>scrape_news.py</code> to enable this filter.<br />
        When active, heavy negative news flow triggers stress/crisis-like position scaling.
      </div>
    ) : (<div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.xl }}>
      <div>
        {(() => {
          const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
          const recent = newsData.filter(n => !n.date || n.date >= cutoff);
          const pos = recent.filter(n => n.sentiment_hint === "positive").length;
          const neg = recent.filter(n => n.sentiment_hint === "negative").length;
          const neu = recent.filter(n => n.sentiment_hint === "neutral").length;
          const total = recent.length || 1;
          return (<>
            <div style={{ fontSize: 11, color: K.textMuted, marginBottom: SP.sm }}>Last 3-day news flow · {recent.length} items</div>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: SP.sm, gap: 1 }}>
              <div style={{ width: `${pos / total * 100}%`, background: K.positive }} />
              <div style={{ width: `${neg / total * 100}%`, background: K.negative }} />
              <div style={{ width: `${neu / total * 100}%`, background: K.border }} />
            </div>
            <div style={{ display: "flex", gap: SP.md, fontSize: 12 }}>
              <span style={{ color: K.positive }}>{pos} positive ({(pos / total * 100).toFixed(0)}%)</span>
              <span style={{ color: K.negative }}>{neg} negative ({(neg / total * 100).toFixed(0)}%)</span>
              <span style={{ color: K.textMuted }}>{neu} neutral</span>
            </div>
          </>);
        })()}
      </div>
      <div>
        <div style={{ padding: `${SP.md}px ${SP.md + 2}px`, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderLeft: `2px solid ${nsCol}`, borderRadius: RADIUS.sm }}>
          <div style={{ fontSize: 11, color: K.textMuted, marginBottom: 4 }}>News filter state</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: nsCol, marginBottom: SP.xs }}>{nsLabel}</div>
          <div style={{ fontSize: 12, color: K.textSecondary, lineHeight: 1.6 }}>
            {ns.label === "crisis" && `${(ns.negFrac * 100).toFixed(0)}% negative — positions scaled to ${(ns.scale * 100).toFixed(0)}% (crisis filter)`}
            {ns.label === "stress" && `${(ns.negFrac * 100).toFixed(0)}% negative — positions scaled to ${(ns.scale * 100).toFixed(0)}% (stress filter)`}
            {ns.label === "positive" && "News flow healthy — no scaling applied"}
            {ns.label === "neutral" && "News flow neutral — no scaling applied"}
            {ns.label === "insufficient" && "Too few recent items — filter inactive (need at least 3)"}
          </div>
        </div>
        <div style={{ marginTop: SP.sm, fontSize: 11, color: K.textMuted, lineHeight: 1.6 }}>
          Thresholds: &gt;40% negative {"\u2192"} stress (×0.75) · &gt;60% {"\u2192"} crisis (×0.45)<br />
          Combined with the quant regime scale — computed server-side per run.
        </div>
      </div>
    </div>)}

    <hr className="divider" />
    <RegimeAlerts result={result} />
  </div>);
}

export { Regime };

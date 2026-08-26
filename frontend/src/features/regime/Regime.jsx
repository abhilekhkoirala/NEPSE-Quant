import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { K, SP, RADIUS, TTP, REGIME_COLORS, REGIME_LABELS } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { RegimeAlerts } from "./RegimeAlerts.jsx";

function Regime({ result, newsData = [] }) {
  const rs = result.regimeSeries, counts = rs.reduce((g, p) => ({ ...g, [p.regime]: (g[p.regime] || 0) + 1 }), {}), last = rs[rs.length - 1] || {};
  const ns = result.newsSentiment || { scale: 1, label: "neutral", negFrac: 0 };
  const nsCol = ns.label === "crisis" ? K.negative : ns.label === "stress" ? K.warning : ns.label === "insufficient" ? K.textMuted : K.positive;
  const nsLabel = { crisis: "Crisis", stress: "Stress", positive: "Positive", neutral: "Neutral", insufficient: "Insufficient data" }[ns.label] || ns.label;
  return (<div style={{ display: "flex", flexDirection: "column", gap: SP.lg }}>
    <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: SP.lg }}>
      <Panel>
        <SL>Integration Speed (ε)</SL>
        <ResponsiveContainer width="100%" height={155}>
          <AreaChart data={rs} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs><linearGradient id="ig" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={K.accent} stopOpacity={0.3} /><stop offset="95%" stopColor={K.accent} stopOpacity={0} /></linearGradient></defs>
            <XAxis dataKey="day" stroke={K.border} tick={{ fontSize: 11, fill: K.textMuted, fontFamily: K.fontUI }} />
            <YAxis stroke={K.border} tick={{ fontSize: 11, fill: K.textMuted, fontFamily: K.fontUI }} />
            <Tooltip {...TTP} />
            <Area type="monotone" dataKey="intEps" stroke={K.accent} fill="url(#ig)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel>
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
        <div style={{ marginTop: SP.md, padding: `${SP.sm + 2}px ${SP.md}px`, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderLeft: `2px solid ${REGIME_COLORS[last.regime] || K.textMuted}`, borderRadius: RADIUS.sm }}>
          <div style={{ fontSize: 11, color: K.textMuted, marginBottom: 5 }}>Current regime (t)</div>
          <span style={{ color: REGIME_COLORS[last.regime] || K.textMuted, fontSize: 14, fontWeight: 600 }}>{REGIME_LABELS[last.regime] || "—"}</span>
        </div>
      </Panel>

      <Panel>
        <SL>News Sentiment Filter</SL>
        {newsData.length === 0 ? (
          <div style={{ fontSize: 12.5, color: K.textSecondary, lineHeight: 1.8 }}>
            No news data — run <code style={{ fontFamily: K.fontMono, fontSize: 11.5, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.sm, padding: "1px 6px", color: K.text }}>scrape_news.py</code> to enable this filter.<br />
            When active, heavy negative news flow triggers stress/crisis-like position scaling.
          </div>
        ) : (<>
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
              <div style={{ display: "flex", gap: SP.md, marginBottom: SP.lg, fontSize: 12 }}>
                <span style={{ color: K.positive }}>{pos} positive ({(pos / total * 100).toFixed(0)}%)</span>
                <span style={{ color: K.negative }}>{neg} negative ({(neg / total * 100).toFixed(0)}%)</span>
                <span style={{ color: K.textMuted }}>{neu} neutral</span>
              </div>
            </>);
          })()}
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
        </>)}
      </Panel>
    </div>
    <RegimeAlerts result={result} />
  </div>);
}

export { Regime };

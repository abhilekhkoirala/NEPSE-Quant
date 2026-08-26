import { useState } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { K, SP, RADIUS, TTP } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { FundamentalsPanel } from "./FundamentalsPanel.jsx";

// Moved verbatim from src/App.jsx — reads only from the composed
// result/newsData props, no calculation of its own.
function Signals({ result, newsData = [] }) {
  const [search, setSearch] = useState("");
  const [selectedTicker, setSelectedTicker] = useState(null);
  const filtered = result.signalData.filter(d =>
    d.ticker.toLowerCase().includes(search.toLowerCase()) ||
    d.sector.toLowerCase().includes(search.toLowerCase())
  );
  const chartData = [...result.signalData].sort((a, b) => Math.abs(b.signal) - Math.abs(a.signal)).slice(0, 50);
  const chartHeight = Math.max(500, chartData.length * 14);

  const tickerSentiment = {};
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  for (const item of newsData) {
    if (!item.tickers_mentioned?.length) continue;
    if (item.date && item.date < cutoff) continue;
    for (const t of item.tickers_mentioned) {
      if (!tickerSentiment[t]) tickerSentiment[t] = { pos: 0, neg: 0 };
      if (item.sentiment_hint === "positive") tickerSentiment[t].pos++;
      if (item.sentiment_hint === "negative") tickerSentiment[t].neg++;
    }
  }

  const colHead = "70px 1fr 70px 70px 50px 36px 52px";

  return (<div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.lg, alignItems: "start" }}>
    <Panel>
      <SL right="Mispricing estimate, news-adjusted">Top 50 Signals</SL>
      <div style={{ overflowY: "auto", maxHeight: 620 }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 14, bottom: 0, left: 48 }}>
            <XAxis type="number" stroke={K.border} tick={{ fontSize: 11, fill: K.textMuted, fontFamily: K.fontUI }} />
            <YAxis type="category" dataKey="ticker" stroke={K.border} tick={{ fontSize: 11, fill: K.text, fontFamily: K.fontMono }} width={48} />
            <Tooltip {...TTP} formatter={v => [v.toFixed(5), "Signal (news-adjusted)"]} />
            <Bar dataKey="signal" radius={[0, 2, 2, 0]}>
              {chartData.map(e => <Cell key={e.ticker} fill={e.signal > 0 ? K.positive : K.negative} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SP.md, gap: SP.md }}>
        <div>
          <SL style={{ marginBottom: 0 }}>Signal Table · {filtered.length} / {result.signalData.length} tickers</SL>
          <div style={{ fontSize: 11.5, color: K.textMuted, marginTop: 4 }}>
            <span style={{ color: K.positive }}>Low-cap bias active</span>
            {" · "}Click any row for P/E &amp; ROE fundamentals
          </div>
        </div>
        <input
          className="input"
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filter ticker / sector"
          style={{ width: 170, fontSize: 12.5 }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: colHead, fontSize: 11, color: K.textMuted, marginBottom: SP.sm, borderBottom: `1px solid ${K.border}`, paddingBottom: SP.sm }}>
        <span>Ticker</span><span>Sector</span><span>Signal</span><span>Weight</span><span>Side</span><span title="News sentiment">News</span><span title="Signal change since last run">Δ Sig</span>
      </div>
      <div style={{ overflowY: "auto", maxHeight: 580 }}>
        {filtered.map(d => {
          const ns = tickerSentiment[d.ticker];
          const sentBadge = ns
            ? ns.neg > ns.pos
              ? <span title={`${ns.neg} negative, ${ns.pos} positive headlines`} style={{ fontSize: 11, color: K.negative }}>▼</span>
              : ns.pos > ns.neg
                ? <span title={`${ns.pos} positive, ${ns.neg} negative headlines`} style={{ fontSize: 11, color: K.positive }}>▲</span>
                : <span title="Mixed news" style={{ fontSize: 11, color: K.textMuted }}>●</span>
            : <span style={{ fontSize: 11, color: K.textMuted }}>—</span>;
          const prev = result.prevSignals?.[d.ticker];
          const delta = prev != null ? d.signal - prev : null;
          const deltaEl = delta == null
            ? <span style={{ fontSize: 11, color: K.textMuted }}>—</span>
            : Math.abs(delta) < 0.00001
              ? <span style={{ fontSize: 11, color: K.textMuted }}>≈0</span>
              : <span title={`Was ${prev?.toFixed(5)}`} style={{ fontSize: 11, color: delta > 0 ? K.positive : K.negative }}>{delta > 0 ? "+" : ""}{delta.toFixed(4)}</span>;
          const lastPrice = result.lastPriceByTicker?.[d.ticker] ?? null;
          const isSelected = selectedTicker === d.ticker;
          return (
            <div key={d.ticker}>
              <div
                className="table-row table-row-clickable"
                onClick={() => setSelectedTicker(isSelected ? null : d.ticker)}
                style={{ display: "grid", gridTemplateColumns: colHead, fontSize: 12.5, padding: `${SP.xs + 2}px 0`, borderBottom: `1px solid ${K.border}`, background: isSelected ? K.accentSoft : "transparent", borderRadius: RADIUS.sm }}>
                <span style={{ fontFamily: K.fontMono, color: K.text, fontWeight: 600 }}>{d.ticker}</span>
                <span style={{ color: K.textMuted, fontSize: 11.5 }}>{d.sector}</span>
                <span style={{ fontFamily: K.fontMono, color: d.signal > 0 ? K.positive : K.negative }}>{d.signal.toFixed(5)}</span>
                <span style={{ fontFamily: K.fontMono, color: K.text }}>{d.weight.toFixed(3)}</span>
                <span style={{ fontSize: 11, color: d.weight > 0 ? K.positive : K.textMuted }}>{d.weight > 0 ? "Long" : "—"}</span>
                <span>{sentBadge}</span>
                <span>{deltaEl}</span>
              </div>
              {isSelected && <FundamentalsPanel ticker={d.ticker} price={lastPrice} />}
            </div>
          );
        })}
      </div>
      {newsData.length === 0 && (
        <div style={{ marginTop: SP.sm, fontSize: 11.5, color: K.textMuted, fontStyle: "italic" }}>
          Run scrape_news.py to enable per-ticker sentiment badges
        </div>
      )}
    </Panel>
  </div>);
}

export { Signals };

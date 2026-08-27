import { useState, useMemo, Fragment } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { K, SP, TTP } from "../../components/common/theme.js";
import { SL } from "../../components/layout/Panel.jsx";
import { FundamentalsPanel } from "./FundamentalsPanel.jsx";

// Reads only from the composed result/newsData props, no calculation of
// its own beyond trivial client-side scans (news-sentiment tally,
// signal-delta) that were already here before the redesign.
function Signals({ result, newsData = [] }) {
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("all");
  const [selectedTicker, setSelectedTicker] = useState(null);

  // signalData arrives pre-sorted by signal desc (backend/src/services/
  // pipelineService.js) — rank is just that order's index, not a
  // separately computed ranking.
  const ranked = useMemo(() => result.signalData.map((d, i) => ({ ...d, rank: i + 1 })), [result.signalData]);
  const sectors = useMemo(() => Array.from(new Set(result.signalData.map(d => d.sector))).sort(), [result.signalData]);

  const filtered = ranked.filter(d =>
    (sector === "all" || d.sector === sector) &&
    (d.ticker.toLowerCase().includes(search.toLowerCase()) || d.sector.toLowerCase().includes(search.toLowerCase()))
  );

  const chartData = [...result.signalData].sort((a, b) => Math.abs(b.signal) - Math.abs(a.signal)).slice(0, 50);
  const chartHeight = Math.max(420, chartData.length * 13);

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

  return (<div>
    <div className="filter-bar">
      <div className="filter-bar-group">
        <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ticker or sector…" style={{ width: 220 }} />
        <select className="input" value={sector} onChange={e => setSector(e.target.value)} style={{ width: 160 }}>
          <option value="all">All sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <span style={{ fontSize: 12, color: K.textMuted }}>{filtered.length === ranked.length ? `${ranked.length} stocks` : `${filtered.length} of ${ranked.length} stocks`}</span>
    </div>

    <div className="data-table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th className="num" data-align="right">Rank</th>
            <th>Ticker</th>
            <th>Sector</th>
            <th className="num" data-align="right">Price</th>
            <th className="num" data-align="right" title="Mispricing estimate, news-adjusted">Signal</th>
            <th className="num" data-align="right">Weight</th>
            <th>Side</th>
            <th title="7-day news sentiment">News</th>
            <th className="num" data-align="right" title="Signal change since last run">Δ Sig</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(d => {
            const ns = tickerSentiment[d.ticker];
            const sentBadge = ns
              ? ns.neg > ns.pos
                ? <span title={`${ns.neg} negative, ${ns.pos} positive headlines`} style={{ color: K.negative }}>▼</span>
                : ns.pos > ns.neg
                  ? <span title={`${ns.pos} positive, ${ns.neg} negative headlines`} style={{ color: K.positive }}>▲</span>
                  : <span title="Mixed news" style={{ color: K.textMuted }}>●</span>
              : <span style={{ color: K.textMuted }}>—</span>;
            const prev = result.prevSignals?.[d.ticker];
            const delta = prev != null ? d.signal - prev : null;
            const deltaEl = delta == null
              ? <span style={{ color: K.textMuted }}>—</span>
              : Math.abs(delta) < 0.00001
                ? <span style={{ color: K.textMuted }}>≈0</span>
                : <span title={`Was ${prev?.toFixed(5)}`} style={{ color: delta > 0 ? K.positive : K.negative }}>{delta > 0 ? "+" : ""}{delta.toFixed(4)}</span>;
            const lastPrice = result.lastPriceByTicker?.[d.ticker] ?? null;
            const isSelected = selectedTicker === d.ticker;
            return (
              <Fragment key={d.ticker}>
                <tr className={`clickable${isSelected ? " selected" : ""}`} onClick={() => setSelectedTicker(isSelected ? null : d.ticker)}>
                  <td className="num" data-align="right" style={{ color: K.textMuted }}>{d.rank}</td>
                  <td style={{ fontFamily: K.fontMono, color: K.text, fontWeight: 600 }}>{d.ticker}</td>
                  <td style={{ color: K.textMuted, fontSize: 12.5 }}>{d.sector}</td>
                  <td className="num" data-align="right" style={{ color: K.textSecondary }}>{lastPrice ? lastPrice.toFixed(2) : "—"}</td>
                  <td className="num" data-align="right" style={{ color: d.signal > 0 ? K.positive : K.negative }}>{d.signal.toFixed(5)}</td>
                  <td className="num" data-align="right" style={{ color: K.text }}>{d.weight.toFixed(3)}</td>
                  <td style={{ fontSize: 12, color: d.weight > 0 ? K.positive : K.textMuted }}>{d.weight > 0 ? "Long" : "—"}</td>
                  <td>{sentBadge}</td>
                  <td className="num" data-align="right">{deltaEl}</td>
                </tr>
                {isSelected && (
                  <tr>
                    <td colSpan={9} style={{ padding: 0, borderBottom: `1px solid ${K.border}` }}>
                      <FundamentalsPanel ticker={d.ticker} price={lastPrice} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    {newsData.length === 0 && (
      <div style={{ marginTop: SP.sm, fontSize: 11.5, color: K.textMuted, fontStyle: "italic" }}>
        Run scrape_news.py to enable per-ticker sentiment badges
      </div>
    )}

    <hr className="divider" />
    <SL right="Top 50 by absolute signal strength">Signal Strength</SL>
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
  </div>);
}

export { Signals };

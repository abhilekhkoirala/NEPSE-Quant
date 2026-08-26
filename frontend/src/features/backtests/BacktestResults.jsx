import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { K, SP, TTP } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { MetricRow } from "../../components/common/MetricCard.jsx";
import backtestsApi from "../../lib/api/backtests.js";

// The bootstrap risk band (resampled percentile band around the realized
// curve) is computed server-side (backend/src/quant/backtest.js, exposed
// at GET /api/backtests/current/risk-band) and merged with the curve here
// for the chart — no modeling happens in this component.
function BacktestResults({ result }) {
  const m = result.m;
  const weights = result.signalData.map(d => d.weight).filter(w => w > 0);
  const hhi = +(weights.reduce((a, w) => a + w * w, 0) * 10000).toFixed(0);
  const effN = hhi > 0 ? +(10000 / hhi).toFixed(1) : weights.length;

  const [band, setBand] = useState([]);
  useEffect(() => {
    let cancelled = false;
    backtestsApi.getRiskBand().then(r => { if (!cancelled) setBand(r.band); }).catch(() => {});
    return () => { cancelled = true; };
  }, [result.id]);

  const dayIndex = useMemo(() => { const map = new Map(); result.curve.forEach(c => map.set(c.day, c)); return map; }, [result.curve]);
  const chartData = useMemo(() => band.map(b => {
    const c = dayIndex.get(b.day);
    if (!c) return null;
    return { day: b.day, p10: b.p10, p25: b.p25, p50: b.p50, p75: b.p75, p90: b.p90, equity: c.equity, benchmark: c.benchmark };
  }).filter(Boolean), [band, dayIndex]);

  const riskMetrics = [
    { label: "Max Drawdown", value: `${m.maxDD}%`, warn: m.maxDD <= -15 },
    { label: "Sharpe Ratio", value: m.sharpe, good: m.sharpe > 0.5 },
    { label: "Annualized Vol", value: `${m.annVol}%` },
    { label: "CVaR 5%", value: `${m.cvar5}%`, warn: m.cvar5 <= -3 },
    { label: "Calmar", value: m.calmar, good: m.calmar > 0.5 },
    { label: "Hit Rate", value: `${m.hitRate}%`, good: m.hitRate > 50 },
    { label: "HHI (concentration)", value: `${hhi} bps`, warn: hhi >= 1500 },
    { label: "Effective N", value: effN },
  ];

  return (
    <Panel style={{ padding: 0 }}>
      <div style={{ padding: `${SP.lg}px ${SP.lg}px 0` }}>
        <SL>Backtest Performance</SL>
      </div>
      <div style={{ padding: `0 ${SP.lg}px` }}>
        <MetricRow columns={3} items={[
          { label: "Total Return", value: `${m.totRet}%`, tone: m.totRet > 0 ? "positive" : "negative" },
          { label: "Benchmark Return", value: `${m.benRet}%`, tone: "neutral" },
          { label: "Annualized Return", value: `${m.annRet}%`, tone: m.annRet > 0 ? "positive" : "negative" },
        ]} />
      </div>

      <div style={{ padding: `${SP.xl}px ${SP.lg}px 0` }}>
        <SL right="Bootstrap band — resampled from realized daily returns">Equity vs Benchmark</SL>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="bqband90" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={K.textMuted} stopOpacity={0.14} /><stop offset="100%" stopColor={K.textMuted} stopOpacity={0} /></linearGradient>
              <linearGradient id="bqband75" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={K.textMuted} stopOpacity={0.22} /><stop offset="100%" stopColor={K.textMuted} stopOpacity={0} /></linearGradient>
            </defs>
            <XAxis dataKey="day" stroke={K.border} tick={{ fontSize: 11, fill: K.textMuted, fontFamily: K.fontUI }} />
            <YAxis stroke={K.border} tick={{ fontSize: 11, fill: K.textMuted, fontFamily: K.fontUI }} domain={["auto", "auto"]} />
            <Tooltip {...TTP} />
            <ReferenceLine y={1} stroke={K.border} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="p90" stroke="none" fill="url(#bqband90)" dot={false} name="90th pct" />
            <Area type="monotone" dataKey="p75" stroke="none" fill="url(#bqband75)" dot={false} name="75th pct" />
            <Area type="monotone" dataKey="p25" stroke="none" fill="url(#bqband90)" dot={false} fillOpacity={0} name="25th pct" />
            <Line type="monotone" dataKey="p90" stroke={K.textMuted} strokeDasharray="3 2" strokeWidth={1} dot={false} name="90th" />
            <Line type="monotone" dataKey="p10" stroke={K.textMuted} strokeDasharray="3 2" strokeWidth={1} dot={false} name="10th" />
            <Line type="monotone" dataKey="p50" stroke={K.textMuted} strokeWidth={1} dot={false} name="Bootstrap median" />
            <Line type="monotone" dataKey="benchmark" stroke={K.textSecondary} strokeDasharray="2 2" strokeWidth={1.3} dot={false} name="Benchmark" />
            <Line type="monotone" dataKey="equity" stroke={K.positive} strokeWidth={2.2} dot={false} name="Strategy" />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: SP.md, marginTop: SP.xs, marginBottom: SP.xl, fontSize: 11, color: K.textMuted, flexWrap: "wrap" }}>
          <span style={{ color: K.positive }}>— Strategy</span>
          <span>- - Benchmark</span>
          <span style={{ opacity: 0.8 }}>— Bootstrap median</span>
          <span style={{ opacity: 0.6 }}>10th–90th pct band</span>
        </div>
      </div>

      <div style={{ padding: `0 ${SP.lg}px ${SP.lg}px`, borderTop: `1px solid ${K.border}`, marginTop: SP.xs }}>
        <div style={{ paddingTop: SP.lg }}>
          <SL>Risk Metrics</SL>
        </div>
        <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", columnGap: SP.lg, rowGap: SP.sm }}>
          {riskMetrics.map(r => (
            <div key={r.label} style={{ padding: "8px 0", borderBottom: `1px solid ${K.border}` }}>
              <div style={{ fontSize: 12, color: K.textSecondary, marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: 15, fontFamily: K.fontMono, color: r.warn ? K.negative : r.good ? K.positive : K.text }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export { BacktestResults };

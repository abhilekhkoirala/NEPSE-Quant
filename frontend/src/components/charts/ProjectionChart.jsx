import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { K, SP, TTP } from "../common/theme.js";
import { SL } from "../layout/Panel.jsx";

// Renders a Monte-Carlo percentile fan (p10/p25/p50/p75/p90) for a 5-year
// portfolio-value projection. The simulation itself (build5YearProjection)
// runs on the backend (backend/src/quant/projections.js) — this
// component only ever receives the finished { label, p10..p90 }[] series
// to plot, whatever it's for (Optimal Holdings, Cash Allocator, or the
// Portfolio tab).
function ProjectionChart({ data, color = K.positive, title, initialValue }) {
  if (!data || data.length === 0) return null;
  const finalP50 = data[data.length - 1]?.p50 ?? initialValue;
  const gain = initialValue > 0 ? ((finalP50 / initialValue - 1) * 100).toFixed(1) : "\u2014";
  const gainColor = finalP50 >= initialValue ? K.positive : K.negative;
  const gid = color.replace("#", "");
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: SP.sm }}>
        <SL style={{ marginBottom: 0 }}>{title}</SL>
        <span style={{ fontSize: 12, color: gainColor, fontFamily: K.fontMono }}>
          Median 5Y: {gain}% {"\u00b7"} Rs.{finalP50.toLocaleString()}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`pg90_${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.08} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`pg75_${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" stroke={K.border} tick={{ fontSize: 11, fill: K.textMuted, fontFamily: K.fontUI }} interval={5} />
          <YAxis stroke={K.border} tick={{ fontSize: 11, fill: K.textMuted, fontFamily: K.fontUI }} tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}k`} domain={["auto", "auto"]} />
          <Tooltip {...TTP} formatter={(v) => [`Rs. ${Math.round(v).toLocaleString()}`, ""]} />
          <Area type="monotone" dataKey="p90" stroke="none" fill={`url(#pg90_${gid})`} name="90th pct" dot={false} />
          <Area type="monotone" dataKey="p75" stroke="none" fill={`url(#pg75_${gid})`} name="75th pct" dot={false} />
          <Area type="monotone" dataKey="p25" stroke="none" fill={`url(#pg90_${gid})`} name="25th pct" dot={false} fillOpacity={0} />
          <Line type="monotone" dataKey="p90" stroke={color} strokeDasharray="3 2" strokeWidth={1} dot={false} name="90th" />
          <Line type="monotone" dataKey="p75" stroke={color} strokeWidth={1} dot={false} name="75th" />
          <Line type="monotone" dataKey="p50" stroke={color} strokeWidth={2.5} dot={false} name="Median" />
          <Line type="monotone" dataKey="p25" stroke={color} strokeWidth={1} dot={false} name="25th" />
          <Line type="monotone" dataKey="p10" stroke={color} strokeDasharray="3 2" strokeWidth={1} dot={false} name="10th" />
          <ReferenceLine y={initialValue} stroke={K.border} strokeDasharray="4 3" />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: SP.md, marginTop: SP.xs, fontSize: 11, color: K.textMuted, flexWrap: "wrap" }}>
        <span style={{ color }}>{"\u2014"} Median (50th)</span>
        <span style={{ color, opacity: 0.7 }}>{"\u2014"} 25th/75th</span>
        <span style={{ color, opacity: 0.4 }}>- - 10th/90th</span>
        <span style={{ color: K.textMuted }}>{"\u2014"} Break-even</span>
      </div>
    </div>
  );
}

export { ProjectionChart };

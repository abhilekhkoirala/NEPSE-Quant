import { K, SP, RADIUS } from "./theme.js";

// Reusable financial metric primitive — replaces the metric-card markup
// that used to be hand-duplicated in every portfolio/IPO tab. Keeps
// label/value hierarchy and tone consistent everywhere it's used.
const TONE_COLOR = { positive: K.positive, negative: K.negative, warning: K.warning, accent: K.accent, neutral: K.text, muted: K.textMuted };

function MetricCard({ label, value, tone = "neutral", hint = null, color = null }) {
  return (
    <div style={{ padding: `${SP.md}px ${SP.lg}px`, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.md }}>
      <div style={{ fontSize: 12, color: K.textSecondary, marginBottom: SP.xs }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: K.fontMono, fontWeight: 500, color: color || TONE_COLOR[tone] || K.text }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: K.textMuted, marginTop: SP.xs }}>{hint}</div>}
    </div>
  );
}

// Responsive row of MetricCards — `columns` controls the desktop grid;
// collapses to one column on mobile via the shared .grid-responsive rule.
function MetricRow({ items, columns = 4 }) {
  return (
    <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: SP.md }}>
      {items.map((it, i) => <MetricCard key={it.label ?? i} {...it} />)}
    </div>
  );
}

export { MetricCard, MetricRow };

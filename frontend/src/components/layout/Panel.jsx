import { K, SP, RADIUS } from "../common/theme.js";

// Base surface card. Used selectively now — not every section needs to
// be boxed; hierarchy mostly comes from spacing and typography instead.
function Panel({ children, style = {}, accent = null }) {
  return (
    <div className="panel-card" style={{ padding: SP.lg, borderTop: accent ? `2px solid ${accent}` : undefined, ...style }}>
      {children}
    </div>
  );
}

// Section heading — a real title (title case, as authored), not an
// uppercase/letter-spaced eyebrow label. `right` renders small
// secondary metadata aligned to the far edge.
function SL({ children, right = null, style = {} }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: SP.md, gap: SP.sm, ...style }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: K.text }}>{children}</div>
      {right && <div style={{ fontSize: 12, color: K.textMuted, whiteSpace: "nowrap" }}>{right}</div>}
    </div>
  );
}

export { Panel, SL };

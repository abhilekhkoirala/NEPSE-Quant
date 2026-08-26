import { K, SP, RADIUS } from "../common/theme.js";

function Loading({ phase, pct }) {
  return (
    <div style={{ minHeight: "100vh", background: K.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: K.fontUI, padding: SP.xl }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: K.text, marginBottom: SP.xl }}>TopoQuant</div>
      <div style={{ width: 320, maxWidth: "100%", height: 4, background: K.surfaceElevated, borderRadius: RADIUS.sm, marginBottom: SP.md, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: K.accent, transition: "width 0.3s ease", borderRadius: RADIUS.sm }} />
      </div>
      <div style={{ fontSize: 13, color: K.textSecondary }}>{phase}</div>
    </div>
  );
}

export { Loading };

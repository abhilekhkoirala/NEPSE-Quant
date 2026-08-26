import { K, SP, RADIUS } from "../common/theme.js";

// Decorative pipeline-stage diagram — not currently rendered anywhere in
// the app, kept in case it gets wired into a future overview/about
// section. Restyled to match the current token set.
function Pipeline() {
  const nodes = [
    { label: "Market Graph", sub: "EWMA corr", c: K.textMuted },
    { label: "Multi-Window", sub: "Ensemble", c: K.accent },
    { label: "Diffusion", sub: "Laplacian", c: K.accent },
    { label: "Residuals", sub: "Mispricing", c: K.warning },
    { label: "Adaptive", sub: "Trend/Rev", c: K.warning },
    { label: "Homology", sub: "β₀ β₁", c: K.positive },
    { label: "Risk Shield", sub: "Stop-Loss", c: K.negative },
    { label: "Sector Tilt", sub: "Optimal", c: "#9089B0" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "stretch", marginBottom: SP.xl, overflowX: "auto", paddingBottom: SP.xs }}>
      {nodes.flatMap((n, i) => {
        const items = [
          <div key={n.label} style={{ minWidth: 108, padding: `${SP.sm}px ${SP.md}px`, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderTop: `2px solid ${n.c}`, borderRadius: RADIUS.sm, textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: n.c, marginBottom: 3 }}>{n.label}</div>
            <div style={{ fontSize: 10, color: K.textMuted }}>{n.sub}</div>
          </div>,
        ];
        if (i < nodes.length - 1) items.push(<div key={`a${i}`} style={{ color: K.textMuted, fontSize: 13, display: "flex", alignItems: "center", padding: "0 4px" }}>{"\u25B6"}</div>);
        return items;
      })}
    </div>
  );
}

export { Pipeline };

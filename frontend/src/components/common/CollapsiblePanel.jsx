import { useState } from "react";
import { K, SP } from "./theme.js";
import { Panel } from "../layout/Panel.jsx";

// Collapsible/resizable wrapper — composes the existing Panel primitive
// only; no new colors or component styles, just an interaction affordance
// on top of it.
function CollapsiblePanel({ title, right = null, resizable = true, defaultOpen = true, bodyPadding = SP.lg, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Panel style={{ padding: 0, ...(open && resizable ? { resize: "vertical", overflow: "auto", minHeight: 150 } : {}) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${SP.md}px ${SP.lg}px`, borderBottom: `1px solid ${K.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: K.text }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: SP.sm }}>
          {right && <span style={{ fontSize: 12, color: K.textMuted }}>{right}</span>}
          <button onClick={() => setOpen((o) => !o)} className="btn-ghost" style={{ padding: "2px 9px", fontSize: 13, lineHeight: 1, border: `1px solid ${K.border}`, borderRadius: 4, background: "transparent", color: K.textSecondary, cursor: "pointer" }}>{open ? "–" : "+"}</button>
        </div>
      </div>
      <div className={`collapse-wrap${open ? "" : " collapsed"}`}>
        <div className="collapse-inner" style={{ padding: bodyPadding }}>{children}</div>
      </div>
    </Panel>
  );
}

export { CollapsiblePanel };

import { K, SP } from "../common/theme.js";

// `format` renders the current value next to the label (e.g. a raw 0.3
// becomes "30%"). All sliders share one accent color by default — these
// are neutral configuration controls, not semantically colored values,
// so a rainbow of per-slider colors would just be noise. `hint`, when
// given, becomes a native title-attribute tooltip on the label instead of
// a permanently-visible sentence underneath — the value should be
// readable at a glance; the explanation is there on hover if needed.
function Slider({ label, min, max, step = 1, value, onChange, format = (v) => v, color = K.accent, hint = null }) {
  return (
    <div style={{ marginBottom: SP.lg }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: SP.xs }}>
        <span style={{ fontSize: 13, color: K.textSecondary, cursor: hint ? "help" : "default" }} title={hint || undefined}>{label}</span>
        <span style={{ fontSize: 13, color: K.text, fontFamily: K.fontMono }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} style={{ width: "100%", accentColor: color, cursor: "pointer" }} />
    </div>
  );
}

export { Slider };

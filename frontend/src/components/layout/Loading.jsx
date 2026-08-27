import { K, SP, RADIUS } from "../common/theme.js";

// Fixed conceptual stages the boot sequence passes through, keyed by the
// `pct` threshold at which each becomes "done". This turns the single
// `phase` string App.jsx already tracks into a running checklist — the
// specific live message (e.g. "No cached data — running scraper…") is
// still shown verbatim underneath, nothing is hidden, it's just given a
// clearer sense of progress through the pipeline.
const STAGES = [
  { label: "Connecting to data source", at: 10 },
  { label: "Preparing market data", at: 30 },
  { label: "Detecting regime", at: 45 },
  { label: "Running walk-forward simulation", at: 60 },
  { label: "Building portfolio & signals", at: 100 },
];

function Loading({ phase, pct }) {
  return (
    <div style={{ minHeight: "100vh", background: K.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: K.fontUI, padding: SP.xl }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: SP.xxl }}>
        <img src="/favicon.svg" alt="" width={20} height={20} style={{ display: "block", borderRadius: 4 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: K.text }}>NEPSEQuant</div>
      </div>

      <div className="loading-steps" style={{ marginBottom: SP.xl }}>
        {(() => {
          const activeIdx = STAGES.findIndex(s => pct <= s.at);
          return STAGES.map((s, i) => {
            const state = activeIdx === -1 || i < activeIdx ? "done" : i === activeIdx ? "active" : "";
            return (
              <div key={s.label} className={`loading-step ${state}`}>
                <span className="loading-step-mark">{state === "done" ? "✓" : state === "active" ? "…" : "·"}</span>
                <span>{s.label}</span>
              </div>
            );
          });
        })()}
      </div>

      <div style={{ width: 320, maxWidth: "100%", height: 4, background: K.surfaceElevated, borderRadius: RADIUS.sm, marginBottom: SP.md, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: K.accent, transition: "width 0.3s ease", borderRadius: RADIUS.sm }} />
      </div>
      <div style={{ fontSize: 12, color: K.textMuted, fontFamily: K.fontMono }}>{phase}</div>
    </div>
  );
}

export { Loading };

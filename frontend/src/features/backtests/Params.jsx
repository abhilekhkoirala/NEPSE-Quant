import { useState } from "react";
import { K, SP } from "../../components/common/theme.js";
import { SL } from "../../components/layout/Panel.jsx";
import { Slider } from "../../components/forms/Slider.jsx";

const pct0 = (v) => `${(v * 100).toFixed(0)}%`;
const pct2 = (v) => `${(v * 100).toFixed(2)}%`;

// Parameter panel + Run Backtest button. Purely UI/local state — moved
// verbatim from src/App.jsx. onRun triggers POST /api/backtests (see
// App.jsx) instead of a local computeWithData() call. Compact by design:
// name + current value + a hover tooltip for anything that needs
// explaining, no permanent paragraphs under every control.
function Params({ params, setParams, onRun, running }) {
  const [local, setLocal] = useState({ ...params });
  const [preset, setPreset] = useState(null);
  const up = (k, v) => { setLocal(p => ({ ...p, [k]: v })); setPreset(null); };

  const applyPreset = (key) => {
    const p = key === "growth"
      ? { ...local, crisisScale: 0.70, stressScale: 1.15, ddFloor: 0.30, stopLoss: 0.18, momBlend: 0.45, maxPos: 0.28, targetVol: 0.26 }
      : key === "balanced"
        ? { ...local, crisisScale: 0.50, stressScale: 0.95, ddFloor: 0.24, stopLoss: 0.14, momBlend: 0.28, maxPos: 0.22, targetVol: 0.21 }
        : { ...local, crisisScale: 0.30, stressScale: 0.90, ddFloor: 0.19, stopLoss: 0.10, momBlend: 0.20, maxPos: 0.19, targetVol: 0.18 };
    setLocal(p);
    setPreset(key);
  };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SP.lg, flexWrap: "wrap", gap: SP.sm }}>
      <SL style={{ marginBottom: 0 }}>Strategy Parameters</SL>
      <div style={{ display: "flex", alignItems: "center", gap: SP.md }}>
        <div style={{ display: "flex" }}>
          {[["preserve", "Preserve"], ["balanced", "Balanced"], ["growth", "Growth"]].map(([key, label], i) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className={`btn-segment${preset === key ? " active" : ""}`}
              style={{ borderRadius: i === 0 ? "6px 0 0 6px" : i === 2 ? "0 6px 6px 0" : 0, marginLeft: i > 0 ? -1 : 0 }}
            >{label}</button>
          ))}
        </div>
        <button onClick={() => { setParams({ ...local }); onRun({ ...local }); }} disabled={running} className={running ? "btn btn-ghost" : "btn btn-primary"}>{running ? "Running…" : "Run Backtest"}</button>
      </div>
    </div>

    <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: `0 ${SP.xl}px` }}>
      <Slider label="Lookback" min={60} max={300} step={20} value={local.win} onChange={v => up("win", v)} format={(v) => `${v}d`} />
      <Slider label="Transaction cost" min={0.001} max={0.015} step={0.0005} value={local.txCost} onChange={v => up("txCost", v)} format={pct2} />
      <Slider label="Hybrid blend" min={0} max={0.5} step={0.05} value={local.momBlend} onChange={v => up("momBlend", v)} format={pct0} />
    </div>

    <div style={{ borderTop: `1px solid ${K.border}`, marginTop: SP.sm, paddingTop: SP.lg }}>
      <div className="section-eyebrow" style={{ marginBottom: SP.md }}>Risk Controls</div>
      <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: `0 ${SP.xl}px` }}>
        <Slider label="Crisis exposure" hint="Exposure kept during crisis. Higher = more aggressive." min={0.10} max={1.0} step={0.05} value={local.crisisScale} onChange={v => up("crisisScale", v)} format={pct0} />
        <Slider label="Stress exposure" hint="Exposure kept during stress. 100%+ = no reduction." min={0.50} max={1.20} step={0.05} value={local.stressScale} onChange={v => up("stressScale", v)} format={pct0} />
        <Slider label="Max drawdown" hint="Drawdown before the risk shield triggers. Higher = more tolerant." min={0.05} max={0.40} step={0.01} value={local.ddFloor} onChange={v => up("ddFloor", v)} format={pct0} />
        <Slider label="Stop loss" hint="Per-stock loss before forced exit. Higher = more room to recover." min={0.03} max={0.30} step={0.01} value={local.stopLoss} onChange={v => up("stopLoss", v)} format={pct0} />
      </div>
      <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: `0 ${SP.xl}px` }}>
        <Slider label="Max position" hint="Max weight per stock. Higher = more concentrated bets." min={0.10} max={0.40} step={0.01} value={local.maxPos} onChange={v => up("maxPos", v)} format={pct0} />
        <Slider label="Target volatility" hint="Volatility target for position sizing. Higher = more leverage in calm markets." min={0.10} max={0.35} step={0.01} value={local.targetVol} onChange={v => up("targetVol", v)} format={pct0} />
      </div>
    </div>
  </div>);
}

export { Params };

// Walk-forward backtest engine (out-of-sample, regime-gated, cost-aware)
// plus the equity-curve helpers used to report/chart its results:
// equityAtOrBefore (binary-search lookup on the sparse curve) and
// bootstrapEquityBand (resampled percentile risk band). Moved verbatim
// from src/App.jsx.
import {
  ensembleSignal, meanReversionSignal, momentumSignal, reversionSignal,
  qualityFilter, liquidityFilter, stockVols, estimateBetas,
} from "./signals.js";
import { regimeScale } from "./regime.js";
import { buildWeights } from "./portfolioWeights.js";
import { REV_BLEND } from "../config/constants.js";
import { mkRng } from "./random.js";

// Same rationale as regime.js: periodic yield inside the long walk-forward
// loop, harmless (and mildly useful) on the backend event loop.
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function walkForward(rets, sectors, nSectors, regimeMap, win=200, step=20, emb=20, dA=0.15, dS=8, txCost=0.004, momBlend=0.25, crisisScale=0.30, stressScale=0.90, ddFloor=0.19, stopLoss=0.10, maxPos=0.19, targetVol=0.18) {
  const nD=rets[0].length;
  const mRets = Array.from({length: nD}, (_, t) => rets.reduce((s,r) => s+r[t], 0) / rets.length);
  let eq=1, peak=1, benEq=1;
  const curve=[{day:0, equity:1, dd:0, benchmark:1}], daily=[], periods=[];
  let stepCount=0;
  const revBlend = REV_BLEND, adjMomBlend = momBlend * (1 - revBlend), topoShare = 1 - adjMomBlend - revBlend;
  let t = win;
  while (t < nD - 5) {
    const te = t, ts = te - win;
    if (ts < 0) { t += step; continue; }
    const regime = regimeMap[te] || "calm";
    const mSlice = mRets.slice(Math.max(0, te - 60), te);
    const mMu = mSlice.reduce((a, b) => a + b, 0) / (mSlice.length || 1);
    const realisedVol = Math.sqrt(mSlice.reduce((a, x) => a + (x - mMu) ** 2, 0) / (mSlice.length || 1)) * Math.sqrt(252);

    let scale = regimeScale(regime, realisedVol, targetVol, crisisScale, stressScale);

    // DD SHIELD — tiers scale relative to ddFloor param
    const currentDD = (peak - eq) / peak;
    if      (currentDD > ddFloor)           scale *= 0.08;
    else if (currentDD > ddFloor * 0.74)    scale *= 0.30;
    else if (currentDD > ddFloor * 0.47)    scale *= 0.60;
    else if (currentDD > ddFloor * 0.26)    scale *= 0.88;

    // VOL-SPIKE KILL SWITCH
    const recentVol = Math.sqrt(mSlice.slice(-10).reduce((a,x) => a + x*x, 0) / 10) * Math.sqrt(252);
    const longVol   = Math.sqrt(mSlice.reduce((a,x) => a + x*x, 0) / mSlice.length) * Math.sqrt(252);
    if (recentVol > longVol * 1.8) scale *= 0.30;
    else if (recentVol > longVol * 1.4) scale *= 0.60;

    if (scale < 0.001) {
      const endD = Math.min(t + step, nD);
      for (let d = t + 1; d < endD; d++) {
        benEq *= Math.exp(mRets[d] || 0);
        curve.push({ day: d, equity: +eq.toFixed(4), dd: +(-(peak - eq) / peak * 100).toFixed(3), benchmark: +benEq.toFixed(4) });
        daily.push(0);
      }
      t = endD;
    } else {
      // Pass a shared corrCache so ensembleSignal reuses matrices computed
      // for overlapping windows (saves up to 3 corrMatEWMA calls per step)
      const corrCache = {};
      const topoSig = ensembleSignal(rets, te, dA, dS, corrCache);
      const adaptive = regime === "calm" ? momentumSignal(rets, te, 60) : meanReversionSignal(rets, te, 20);
      const rev = reversionSignal(rets, te, 5);
      const rawBlended = topoSig.map((s, i) => s * topoShare + adaptive[i] * adjMomBlend + rev[i] * revBlend);

      // Re-normalise to unit std so quality/liquidity multipliers and buildWeights
      // operate on consistent z-score inputs regardless of universe size.
      const bmu = rawBlended.reduce((a,b) => a+b, 0) / rawBlended.length;
      const bsd = Math.sqrt(rawBlended.reduce((a,b) => a+(b-bmu)**2, 0) / rawBlended.length) || 1e-9;
      const blended = rawBlended.map(s => (s - bmu) / bsd);

      // Gradient quality filter
      const quality = qualityFilter(rets, te, 40);
      // Liquidity filter: down-weights bottom-20% by trading activity
      const liquidity = liquidityFilter(rets, te, 60);
      const filtered = blended.map((s, i) => s * quality[i] * liquidity[i]);

      const vols = stockVols(rets, Math.max(0, te - 60), te);
      const betas = estimateBetas(rets, mRets, ts, te);
      const rawW = buildWeights(filtered, sectors, vols, nSectors, betas, regime, maxPos);
      const w = rawW.map(x => x * scale);
      const tcCharge = w.reduce((acc, wi) => acc + Math.abs(wi) * txCost, 0);
      let turned = false;
      const activeW = [...w], cumAssetRet = new Array(rets.length).fill(0);
      const endD = Math.min(t + step, nD);
      const periodStart = t, turnoverFrac = tcCharge > 0 ? w.reduce((a,x)=>a+Math.abs(x),0) : 0;
      let periodGrossMult = 1, lastD = t;
      for (let d = t + 1; d < endD; d++) {
        if (regime === "calm" && (regimeMap[d] === "stress" || regimeMap[d] === "crisis")) { t = d; break; }
        // Inside the daily loop, after the regime break on line 420
        const slice5 = mRets.slice(Math.max(0, d-5), d);
        const intraVol = Math.sqrt(
          slice5.reduce((a,x) => a + x*x, 0) / (slice5.length||1)
        ) * Math.sqrt(252);

        if (intraVol > 0.32 && regime !== "crisis") { t = d; break; }
        const gross = activeW.reduce((acc, wi, i) => {
          if (wi === 0) return acc;
          const sRet = isFinite(rets[i][d]) ? Math.exp(rets[i][d]) - 1 : 0;
          cumAssetRet[i] += sRet;
          if (cumAssetRet[i] < -stopLoss) { activeW[i] = 0; return acc; }
          return acc + wi * sRet;
        }, 0);
        const tc = turned ? 0 : tcCharge;
        if (!turned) turned = true;
        eq *= (1 + gross - tc); peak = Math.max(peak, eq);
        benEq *= Math.exp(mRets[d] || 0);
        periodGrossMult *= (1 + gross); lastD = d;

        curve.push({ day: d, equity: +eq.toFixed(4), dd: +(-(peak - eq) / peak * 100).toFixed(3), benchmark: +benEq.toFixed(4) });
        daily.push(gross);
        if (d === endD - 1) t = endD;
      }
      periods.push({ startDay: periodStart, endDay: lastD, regime, grossRet: +((periodGrossMult - 1) * 100).toFixed(3), turnoverFrac: +turnoverFrac.toFixed(4), txCostFrac: +tcCharge.toFixed(4) });
    }
    stepCount++; if (stepCount % 5 === 0) await sleep(0);
  }
  const n=daily.length||1, hits=daily.filter(r=>r>1e-7).length, flats=daily.filter(r=>Math.abs(r)<=1e-7).length;
  const mu=daily.reduce((a,b)=>a+b,0)/n, sg=Math.sqrt(daily.reduce((a,b)=>a+(b-mu)**2,0)/n)||1e-9;
  const ar=Math.pow(eq,252/n)-1,av=sg*Math.sqrt(252),mdd=Math.min(...curve.map(c=>c.dd));
  // CVaR (Expected Shortfall) at 5% — average of worst 5% of daily returns
  const sortedDaily=[...daily].sort((a,b)=>a-b);
  const cvarCut=Math.max(1,Math.floor(n*0.05));
  const cvar=+(sortedDaily.slice(0,cvarCut).reduce((a,b)=>a+b,0)/cvarCut*100).toFixed(2);
  return{curve,periods,m:{totRet:+((eq-1)*100).toFixed(2),benRet:+((benEq-1)*100).toFixed(2),annRet:+(ar*100).toFixed(2),annVol:+(av*100).toFixed(2),sharpe:+(ar/av).toFixed(2),maxDD:+mdd.toFixed(2),calmar:+(ar/Math.abs(mdd/100+1e-9)).toFixed(2),hitRate:+((hits/n)*100).toFixed(1),flatRate:+((flats/n)*100).toFixed(1),cvar5:cvar}};
}


function equityAtOrBefore(curve, day) {
  let lo = 0, hi = curve.length - 1, ans = curve[0];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (curve[mid].day <= day) { ans = curve[mid]; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
// Bootstrap percentile band from the REALIZED daily net returns underlying the
// actual curve (resampling with replacement — captures path/sequencing risk
// inherent to this return distribution, not a forward forecast).

function bootstrapEquityBand(curve, nSim = 200, seed = 41) {
  const rng = mkRng(seed);
  const n = curve.length;
  if (n < 30) return [];
  const rets = [];
  for (let i = 1; i < n; i++) {
    const r = Math.log(curve[i].equity / curve[i - 1].equity);
    if (isFinite(r)) rets.push(r);
  }
  if (rets.length < 10) return [];
  const sims = Array.from({ length: nSim }, () => {
    let v = 1;
    return Array.from({ length: rets.length }, () => { v *= Math.exp(rets[Math.floor(rng() * rets.length)]); return v; });
  });
  const step = Math.max(1, Math.floor(rets.length / 130));
  const bands = [];
  for (let d = 0; d < rets.length; d += step) {
    const vals = sims.map(s => s[d]).sort((a, b) => a - b);
    const pct = p => vals[Math.min(Math.floor(vals.length * p), vals.length - 1)];
    bands.push({ day: curve[d + 1].day, p10: pct(0.10), p25: pct(0.25), p50: pct(0.50), p75: pct(0.75), p90: pct(0.90) });
  }
  return bands;
}


export { walkForward, equityAtOrBefore, bootstrapEquityBand };

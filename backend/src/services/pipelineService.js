// Orchestrates one full quant-engine run: regime detection -> walk-forward
// backtest -> ensemble signal -> news overlay -> final portfolio weights.
// This is the same sequence that used to run in the browser inside
// src/App.jsx's computeWithData() on every page load and every "RUN" click
// — moved here verbatim (see quant/*.js for the individual formulas), with
// the result cached in memory so the various /api/* read-endpoints can
// serve slices of it without recomputing.
import { corrMatEWMA } from "../quant/correlation.js";
import {
  ensembleSignal, meanReversionSignal, momentumSignal, reversionSignal,
  qualityFilter, liquidityFilter, lowCapFilter, stockVols, estimateBetas,
} from "../quant/signals.js";
import { rollingRegime, buildRegimeMap, regimeScale, computeHomology, classicalMDS2D, densityField } from "../quant/regime.js";
import { walkForward } from "../quant/backtest.js";
import { buildWeights } from "../quant/portfolioWeights.js";
import { applyNewsSentimentOverlay, computeNewsSentimentRegimeScale } from "../quant/newsSentiment.js";
import { EWMA_LAMBDA, REV_BLEND, DEFAULT_PARAMS } from "../config/constants.js";

let _current = null; // the last computed pipeline result (in-memory cache)
let _runCounter = 0;

async function runPipeline(rawData, params = DEFAULT_PARAMS, newsItems = []) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const raw = rawData;
  const winSize = Math.min(p.win, Math.floor(raw.nD * 0.25));

  const regimeSeries = await rollingRegime(raw.returns, winSize, 20);
  const regimeMap = buildRegimeMap(regimeSeries, raw.nD);

  const { curve, periods, m } = await walkForward(
    raw.returns, raw.sectors, raw.sectorNames.length, regimeMap, winSize, 60,
    p.emb, p.diffAlpha, p.diffSteps, p.txCost, p.momBlend, p.crisisScale,
    p.stressScale, p.ddFloor, p.stopLoss, p.maxPos, p.targetVol
  );

  const corrEnd2 = raw.nD;
  const Cfinal = corrMatEWMA(raw.returns, Math.max(0, corrEnd2 - winSize), corrEnd2, EWMA_LAMBDA);
  const topoSig = ensembleSignal(raw.returns, corrEnd2, p.diffAlpha, p.diffSteps);
  const lastRegime = regimeSeries[regimeSeries.length - 1]?.regime || "calm";
  const adaptiveSnap = lastRegime === "calm"
    ? momentumSignal(raw.returns, corrEnd2, 60)
    : meanReversionSignal(raw.returns, corrEnd2, 20);
  const revSnap = reversionSignal(raw.returns, corrEnd2, 5);

  const revBlend = REV_BLEND, adjMomBlend = p.momBlend * (1 - revBlend), topoShare = 1 - adjMomBlend - revBlend;
  const rawBlended = topoSig.map((s, i) => s * topoShare + adaptiveSnap[i] * adjMomBlend + revSnap[i] * revBlend);
  const blendMu = rawBlended.reduce((a, b) => a + b, 0) / rawBlended.length;
  const blendSd = Math.sqrt(rawBlended.reduce((a, b) => a + (b - blendMu) ** 2, 0) / rawBlended.length) || 1e-9;
  const blendedFinal = rawBlended.map(s => (s - blendMu) / blendSd);

  const qualityFinal = qualityFilter(raw.returns, corrEnd2, 40);
  const liquidityFinal = liquidityFilter(raw.returns, corrEnd2, 60);
  const lowCapFinal = lowCapFilter(raw.lastPrices);

  const rawOverlaid = applyNewsSentimentOverlay(blendedFinal, raw.tickers, newsItems);
  const ovMu = rawOverlaid.reduce((a, b) => a + b, 0) / rawOverlaid.length;
  const ovSd = Math.sqrt(rawOverlaid.reduce((a, b) => a + (b - ovMu) ** 2, 0) / rawOverlaid.length) || 1e-9;
  const overlaidSignal = rawOverlaid.map(s => (s - ovMu) / ovSd);
  const filteredFinal = overlaidSignal.map((s, i) => s * qualityFinal[i] * liquidityFinal[i] * lowCapFinal[i]);

  const volsFinal = stockVols(raw.returns, Math.max(0, corrEnd2 - 60), corrEnd2);
  const mRetsFinal = Array.from({ length: raw.nD }, (_, t) => raw.returns.reduce((s, r) => s + r[t], 0) / raw.returns.length);
  const finalBetas = estimateBetas(raw.returns, mRetsFinal, Math.max(0, corrEnd2 - winSize), corrEnd2);
  const rawWfinal = buildWeights(filteredFinal, raw.sectors, volsFinal, raw.sectorNames.length, finalBetas, lastRegime, 0.22);
  const last60Mean = mRetsFinal.slice(-60).reduce((a, b) => a + b, 0) / 60;
  const realisedVolFinal = Math.sqrt(mRetsFinal.slice(-60).reduce((a, x) => a + (x - last60Mean) ** 2, 0) / 60) * Math.sqrt(252);
  const rscale = regimeScale(lastRegime, realisedVolFinal, p.targetVol, p.crisisScale, p.stressScale);

  const newsSentiment = computeNewsSentimentRegimeScale(newsItems);
  const combinedScale = rscale * newsSentiment.scale;

  const scaledW = rawWfinal.map(x => x * combinedScale);
  const scaledSum = scaledW.reduce((a, b) => a + Math.abs(b), 0) || 1;
  const weights = scaledW.map(x => x / scaledSum);

  // 60-day cumulative-return sparkline per ticker (chart data only — the
  // Watchlist tab used to compute this itself from the full raw returns
  // matrix shipped to the browser; sending the whole matrix down just to
  // draw a 60-point line is unnecessary, so it's precomputed here instead
  // and only this small series goes out over the API).
  const sparkline60ByTicker = {};
  raw.tickers.forEach((t, i) => {
    const win = raw.returns[i].slice(-60);
    let cum = 1; const path = [1];
    for (const r of win) { cum *= Math.exp(r); path.push(cum); }
    sparkline60ByTicker[t] = path;
  });

  const signalData = raw.tickers
    .map((t, i) => ({
      ticker: t,
      signal: +overlaidSignal[i].toFixed(5),
      weight: +weights[i].toFixed(3),
      sector: raw.sectorNames[raw.sectors[i]] ?? "Other",
      sparkline60: sparkline60ByTicker[t],
    }))
    .sort((a, b) => b.signal - a.signal);

  // Previous run's signals, for the Δ SIG column in the Signals tab.
  const prevSignals = _current
    ? Object.fromEntries(_current.signalData.map(d => [d.ticker, d.signal]))
    : {};

  const homoData = computeHomology(Cfinal);

  // Regime-terrain geometry (classical MDS + density field on the
  // correlation distance matrix) — previously recomputed on every React
  // render in the browser; computed once per run here instead.
  const n = raw.tickers.length;
  const terrainPoints = classicalMDS2D(Cfinal, n);
  const { grid, max } = densityField(terrainPoints, 22, 14);

  _runCounter += 1;
  _current = {
    id: _runCounter,
    params: p,
    tickers: raw.tickers,
    sectors: raw.sectors,
    sectorNames: raw.sectorNames,
    returns: raw.returns,
    nD: raw.nD,
    lastPrices: raw.lastPrices,
    corr: Cfinal,
    homoData,
    regimeSeries,
    curve,
    periods,
    m,
    signalData,
    lastRegime,
    newsSentiment,
    prevSignals,
    terrain: { points: terrainPoints, density: { grid: Array.from(grid), max, cols: 22, rows: 14 } },
    computedAt: new Date().toISOString(),
  };
  return _current;
}

function getCurrent() {
  return _current;
}

export { runPipeline, getCurrent };

// Mirrors backend/src/config/constants.js DEFAULT_PARAMS — kept in sync
// manually since there's no shared package between frontend/backend yet.
// The backend is the source of truth (POST /api/backtests falls back to
// its own copy if the frontend ever sends nothing), this is just the
// initial value for the Parameters panel sliders.
const DEFAULT_PARAMS = { diffAlpha: 0.15, diffSteps: 8, win: 180, emb: 20, txCost: 0.0045, momBlend: 0.20, crisisScale: 0.30, stressScale: 0.90, ddFloor: 0.19, stopLoss: 0.10, maxPos: 0.19, targetVol: 0.18 };

export { DEFAULT_PARAMS };

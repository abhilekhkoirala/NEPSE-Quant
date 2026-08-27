// ============================================================
// Design tokens — quantitative research workstation theme.
//
// Personality: restrained / analytical / information-dense. One accent
// color (blue) carries all interactive/selection meaning; green/red/amber
// are reserved for gain/loss/warning semantics only — never decorative.
// Monospace is used for financial figures (prices, percentages, signal
// scores, timestamps); everything else — nav, headings, labels, body
// copy — is Inter. Radius stays small (4–6px) throughout; this should
// read as a terminal, not a SaaS dashboard.
// ============================================================

const K = {
  // Surfaces
  bg: "#0B0D0F",
  surface: "#111418",
  surfaceElevated: "#171B20",
  border: "#252A31",
  borderStrong: "#33383F",

  // Text
  text: "#F2F4F7",
  textSecondary: "#9299A3",
  textMuted: "#656C76",

  // Interactive accent — the only accent used for selection, links,
  // active nav, primary buttons, focus states, and neutral chart series.
  accent: "#5B8DEF",
  accentSoft: "#5B8DEF1A", // ~10% — tinted backgrounds for active/selected states
  accentBorder: "#5B8DEF4D", // ~30% — borders on accent-tinted callouts

  // Semantic — reserved for gain/loss/caution, never used decoratively
  positive: "#3FB88A",
  negative: "#E5484D",
  warning: "#D9A544",

  // Fonts
  fontUI: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  fontMono: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
};

// Spacing scale — 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48. Used throughout
// instead of arbitrary one-off pixel values.
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40, huge: 48 };

// Kept small deliberately (4–6px) — no 8–20px "modern SaaS card" radii.
const RADIUS = { sm: 4, md: 6, lg: 6 };

// Market-regime semantics — calm/stress/crisis map to the standard
// gain/warning/loss colors; fragmented is a genuinely distinct 4th
// state (fractured correlation structure), given its own muted,
// non-accent hue so it never reads as "just another blue link."
const REGIME_COLORS = { calm: K.positive, stress: K.warning, crisis: K.negative, fragmented: "#9089B0" };
const REGIME_LABELS = { calm: "Calm", stress: "Stress", crisis: "Crisis", fragmented: "Fragmented" };
// One-line, data-driven description for the Regime page's primary status
// block — a template filled with the run's own avgCorr/realisedVol, not
// canned copy independent of the numbers it sits above.
function regimeDescriptor(regime, avgCorr, realisedVol) {
  const corrTxt = avgCorr == null ? "correlation unavailable" : avgCorr > 0.6 ? `elevated correlation (${avgCorr.toFixed(2)})` : avgCorr > 0.35 ? `normal correlation (${avgCorr.toFixed(2)})` : `low correlation (${avgCorr.toFixed(2)})`;
  const volTxt = realisedVol == null ? "volatility unavailable" : `${realisedVol > 0.30 ? "elevated" : realisedVol > 0.18 ? "moderate" : "controlled"} volatility (${(realisedVol * 100).toFixed(0)}%)`;
  return `${corrTxt[0].toUpperCase()}${corrTxt.slice(1)} · ${volTxt}`;
}

// Categorical palette for sectors — deliberately kept out of the
// green/red/amber/blue semantic range so a sector tag is never
// mistaken for a gain/loss/warning/selection signal.
const SEC_COLOR_PALETTE = [
  "#7BA7D9", "#B08968", "#9C8AA5", "#6FAE8C", "#C9A66B", "#8A8FBF",
  "#A87C7C", "#6B8E9E", "#A69C6B", "#7C93A8", "#5C8FA6", "#8FA6C9",
];
const FALLBACK_SEC_NAMES = ["Commercial Bank", "Finance", "Hydropower", "Non-Life Insurance", "Other"];

function buildSecColors(secNames) {
  return secNames.map((_, i) => SEC_COLOR_PALETTE[i % SEC_COLOR_PALETTE.length]);
}

// Recharts tooltip chrome — shared across every chart in the app.
const TTP = {
  contentStyle: { background: K.surfaceElevated, border: `1px solid ${K.border}`, fontSize: 12, fontFamily: K.fontUI, borderRadius: RADIUS.sm, padding: "8px 10px" },
  labelStyle: { color: K.textSecondary, marginBottom: 4 },
  itemStyle: { color: K.text, fontFamily: K.fontMono, fontSize: 12 },
};

// Shared row style for label/value list rows (stat lists, snapshots).
const ROW = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${K.border}`, fontSize: 13 };

export { K, SP, RADIUS, FALLBACK_SEC_NAMES, SEC_COLOR_PALETTE, buildSecColors, TTP, REGIME_COLORS, REGIME_LABELS, regimeDescriptor, ROW };

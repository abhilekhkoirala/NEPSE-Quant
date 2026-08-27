// Status/type color tokens for the IPO tab. Kept as plain hex (not
// imported from theme.js) since these are IPO-domain categorical
// mappings, not the shared design-system palette — but chosen to sit
// alongside it: open/upcoming/allotment/closed echo the app's
// positive/accent/warning/muted semantics.
const STATUS_COLORS = { open: "#3FB88A", upcoming: "#5B8DEF", approved: "#9089B0", allotment: "#D9A544", closed: "#6F7680", unknown: "#6F7680" };
const STATUS_LABELS = { open: "Open", upcoming: "Upcoming", approved: "Approved", allotment: "Allotment", closed: "Closed", unknown: "Unknown" };
const TYPE_COLORS = { Ordinary: "#7BA7D9", FPO: "#9C8AA5", Rights: "#6FAE8C", Debenture: "#B08968", "Mutual Fund": "#A87C7C" };

// The scraped feed blends three sources (NepseAlpha, SEBON, Merolagani)
// with inconsistent status strings — some wrapped in the source site's
// own HTML (e.g. "<span style=\"color:#E81E62\">Closed</span>"), some
// blank. normalizeStatus() strips markup and buckets to one of the
// categories above so a status the scraper didn't clean up still gets a
// sensible label/color instead of showing raw HTML as text.
function normalizeStatus(raw) {
  const clean = String(raw || "").replace(/<[^>]*>/g, "").trim().toLowerCase();
  if (clean.includes("open")) return "open";
  if (clean.includes("upcoming")) return "upcoming";
  if (clean.includes("approved")) return "approved";
  if (clean.includes("allotment")) return "allotment";
  if (clean.includes("closed")) return "closed";
  return "unknown";
}

// Strips the same source-site HTML markup from any text field it turns
// up in (open/close dates from NepseAlpha carry it too).
function stripHtml(raw) {
  return String(raw ?? "").replace(/<[^>]*>/g, "").trim();
}

export { STATUS_COLORS, STATUS_LABELS, TYPE_COLORS, normalizeStatus, stripHtml };

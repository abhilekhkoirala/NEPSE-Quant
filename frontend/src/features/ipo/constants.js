// Status/type color tokens for the IPO tab. Kept as plain hex (not
// imported from theme.js) since these are IPO-domain categorical
// mappings, not the shared design-system palette — but chosen to sit
// alongside it: open/upcoming/allotment/closed echo the app's
// positive/accent/warning/muted semantics.
const STATUS_COLORS = { open: "#3FB88A", upcoming: "#5B8DEF", allotment: "#D9A544", closed: "#6F7680" };
const STATUS_LABELS = { open: "Open", upcoming: "Upcoming", allotment: "Allotment", closed: "Closed" };
const TYPE_COLORS = { Ordinary: "#7BA7D9", FPO: "#9C8AA5", Rights: "#6FAE8C", Debenture: "#B08968", "Mutual Fund": "#A87C7C" };

export { STATUS_COLORS, STATUS_LABELS, TYPE_COLORS };

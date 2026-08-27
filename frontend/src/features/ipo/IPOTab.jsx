import { useState, useEffect, useCallback } from "react";
import { K, SP, RADIUS } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { MetricRow } from "../../components/common/MetricCard.jsx";
import { STATUS_COLORS, STATUS_LABELS, normalizeStatus, stripHtml } from "./constants.js";
import iposApi from "../../lib/api/ipos.js";

const titleCase = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
// The scraped units field arrives as a plain digit string from one
// source and comma-grouped from another (e.g. "7,260,000") — Number()
// silently returns NaN on the latter unless commas are stripped first.
const parseUnits = (raw) => {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const STATUS_ORDER = { open: 0, upcoming: 1, approved: 1, allotment: 2, closed: 3, unknown: 4 };

// The IPO score (sector alignment + regime + timing + issue type) used to
// be computed client-side via scoreIPO() on every render. GET /api/ipos
// now returns each listing already scored — see
// backend/src/quant/ipoScoring.js and backend/src/api/ipos.js. The
// static-fallback dataset (IPO_STATIC_DATA) also moved server-side
// (backend/src/data/ipoDefaults.js) and is what the API itself falls
// back to when ipo_data.json is missing or empty, so this component no
// longer needs its own copy or its own "static vs live" fetch fallback
// logic — it just displays whatever the API returns and whether the
// server reports having scraped data.
function IPOTab({ result }) {
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // GET /api/ipos/status
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ items }, st] = await Promise.all([iposApi.getIpos(), iposApi.getStatus()]);
      setIpos(items);
      setStatus(st);
    } catch {
      setIpos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await iposApi.refresh(); await load(); } finally { setRefreshing(false); }
  }

  const dataSource = status?.exists ? "live" : "static";
  const scrapeTime = status?.scrapeTime ?? null;

  const scored = ipos
    .map(ipo => ({ ...ipo, statusKey: normalizeStatus(ipo.status) }))
    .filter(ipo => {
      // Keep anything with no parseable AD year (undated approvals, or
      // Merolagani's Nepali BS-calendar strings) and anything from 2025
      // onward; only drop clearly old historical closed issues.
      const raw = stripHtml(ipo.open_date || ipo.openDate || ipo.approval_date_ad || "");
      const year = raw.match(/20\d{2}/);
      return !year || Number(year[0]) >= 2025;
    })
    .sort((a, b) => {
      const so = (STATUS_ORDER[a.statusKey] ?? 5) - (STATUS_ORDER[b.statusKey] ?? 5);
      return so !== 0 ? so : b.score.total - a.score.total;
    });

  const filtered = filter === "all" ? scored : scored.filter(ipo => ipo.statusKey === filter);
  const openCount = scored.filter(i => i.statusKey === "open").length;
  const upcomingCount = scored.filter(i => i.statusKey === "upcoming" || i.statusKey === "approved").length;
  const bestOpen = scored.filter(i => i.statusKey === "open").sort((a, b) => b.score.total - a.score.total)[0];
  const regime = result?.lastRegime || "calm";
  const regimeGood = regime === "calm" || regime === "fragmented";

  const selKey = (ipo) => ipo.symbol || ipo.company || String(ipo.id);
  const sel = selected ? scored.find(i => selKey(i) === selected) : null;

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-bar-group">
          <span className="pill" style={{ color: dataSource === "live" ? K.positive : K.warning, borderColor: dataSource === "live" ? `${K.positive}4D` : `${K.warning}4D` }}>
            {dataSource === "live" ? "Live data · scrape_ipo.py" : "Illustrative data · run scrape_ipo.py for a live feed"}
          </span>
          {scrapeTime && <span style={{ fontSize: 11.5, color: K.textMuted }}>Last scraped {new Date(scrapeTime).toLocaleString()}</span>}
          <button onClick={handleRefresh} disabled={refreshing || loading} className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: 12 }}>
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: K.textSecondary }}>
          Regime <span style={{ color: regimeGood ? K.positive : K.negative, fontWeight: 600 }}>{titleCase(regime)}</span>
          <span style={{ margin: "0 8px" }}>·</span>
          Timing <span style={{ color: regimeGood ? K.positive : K.warning }}>{regimeGood ? "Favourable" : "Caution"}</span>
        </div>
      </div>

      <MetricRow columns={4} items={[
        { label: "Open Now", value: openCount, color: STATUS_COLORS.open },
        { label: "Upcoming", value: upcomingCount, color: STATUS_COLORS.upcoming },
        { label: "Best Open Score", value: bestOpen ? bestOpen.score.total : "—", tone: "accent" },
        { label: "Market Regime", value: titleCase(regime), color: regimeGood ? K.positive : K.negative },
      ]} />

      <hr className="divider" />

      <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: sel ? "1fr 340px" : "1fr", gap: SP.xl, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: SP.sm, marginBottom: SP.md, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <SL style={{ marginBottom: 0 }} right={`${filtered.length} issues`}>IPO Calendar</SL>
            <div style={{ display: "flex" }}>
              {["all", "open", "upcoming", "approved", "allotment", "closed"].map((f, i, arr) => (
                <button key={f} onClick={() => setFilter(f)} className={`btn-segment${filter === f ? " active" : ""}`} style={{ borderRadius: i === 0 ? "6px 0 0 6px" : i === arr.length - 1 ? "0 6px 6px 0" : 0, marginLeft: i > 0 ? -1 : 0 }}>
                  {f === "all" ? "All" : STATUS_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: SP.xxl, textAlign: "center", color: K.textSecondary, fontSize: 13 }}>Loading IPO data…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: SP.xxl, textAlign: "center", color: K.textSecondary, fontSize: 13 }}>No IPOs match this filter.</div>
          ) : (
            <div className="data-table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th className="num" data-align="right">Units</th>
                    <th>Opening</th>
                    <th>Closing</th>
                    <th>Issue Manager</th>
                    <th>Status</th>
                    <th className="num" data-align="right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ipo => {
                    const sc = ipo.score;
                    const scColor = sc.total >= 70 ? K.positive : sc.total >= 45 ? K.warning : K.negative;
                    const ipoKey = selKey(ipo);
                    const isSelected = selected === ipoKey;
                    return (
                      <tr key={ipoKey} className={`clickable${isSelected ? " selected" : ""}`} onClick={() => setSelected(isSelected ? null : ipoKey)}>
                        <td>
                          <div style={{ color: K.text, fontFamily: K.fontMono, fontWeight: 600, fontSize: 13 }}>{ipo.symbol || ipo.company?.split(" ")[0] || "—"}</div>
                          <div style={{ color: K.textMuted, fontSize: 11, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{ipo.company}</div>
                        </td>
                        <td className="num" data-align="right" style={{ color: K.textSecondary }}>{parseUnits(ipo.units)?.toLocaleString() ?? (ipo.publicShares ? ipo.publicShares.toLocaleString() : "—")}</td>
                        <td style={{ color: K.textSecondary, fontSize: 12.5 }}>{stripHtml(ipo.open_date || ipo.openDate) || "—"}</td>
                        <td style={{ color: K.textSecondary, fontSize: 12.5 }}>{stripHtml(ipo.close_date || ipo.closeDate) || "—"}</td>
                        <td style={{ color: K.text, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>{ipo.issue_manager || ipo.issueManager || "—"}</td>
                        <td>
                          <span style={{ fontSize: 11, padding: "2px 8px", background: `${STATUS_COLORS[ipo.statusKey]}1A`, border: `1px solid ${STATUS_COLORS[ipo.statusKey]}4D`, color: STATUS_COLORS[ipo.statusKey], borderRadius: RADIUS.sm }}>
                            {STATUS_LABELS[ipo.statusKey]}
                            {ipo.subscribed != null && ipo.statusKey !== "upcoming" ? <span style={{ marginLeft: 4 }}>{ipo.subscribed}×</span> : null}
                          </span>
                        </td>
                        <td className="num" data-align="right" style={{ color: scColor, fontWeight: 600 }}>{sc.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {sel && (
          <div style={{ display: "flex", flexDirection: "column", gap: SP.lg }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: SP.md }}>
                <div>
                  <div style={{ fontSize: 15, color: K.text, fontFamily: K.fontMono, fontWeight: 600, lineHeight: 1.4 }}>{sel.symbol || sel.company}</div>
                  {sel.symbol && <div style={{ fontSize: 12, color: K.textMuted, marginTop: 3 }}>{sel.company}</div>}
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: K.textMuted, cursor: "pointer", fontSize: 15 }}>✕</button>
              </div>
              {[
                { label: "Sector", value: sel.sector },
                { label: "Type", value: sel.type || "IPO" },
                { label: "Issue Price", value: sel.issuePrice ? `Rs. ${sel.issuePrice}` : sel.issue_price ? `Rs. ${sel.issue_price}` : (sel.price ? `Rs. ${sel.price}` : "—") },
                { label: "Units", value: parseUnits(sel.units)?.toLocaleString() ?? (sel.publicShares ? sel.publicShares.toLocaleString() : "—") },
                { label: "Opening Date", value: stripHtml(sel.open_date || sel.openDate) || "—" },
                { label: "Closing Date", value: stripHtml(sel.close_date || sel.closeDate) || "—" },
                { label: "Issue Manager", value: sel.issue_manager || sel.issueManager || "—" },
                { label: "Status", value: STATUS_LABELS[sel.statusKey] },
                { label: "Subscribed", value: sel.subscribed != null ? `${sel.subscribed}×` : "—" },
              ].filter(r => r.value && r.value !== "—" || ["Status", "Units"].includes(r.label)).map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: `${SP.xs + 1}px 0`, borderBottom: `1px solid ${K.border}` }}>
                  <span style={{ color: K.textSecondary }}>{r.label}</span>
                  <span style={{ color: K.text }}>{r.value}</span>
                </div>
              ))}
            </div>

            <div>
              <SL>Opportunity Score</SL>
              {(() => {
                const sc = sel.score;
                const scColor = sc.total >= 70 ? K.positive : sc.total >= 45 ? K.warning : K.negative;
                return (
                  <>
                    <div style={{ marginBottom: SP.lg }}>
                      <span style={{ fontSize: 26, color: scColor, fontFamily: K.fontMono, fontWeight: 600 }}>{sc.total}</span>
                      <span style={{ fontSize: 12, color: K.textMuted, marginLeft: 6 }}>/ 100</span>
                    </div>
                    {[
                      { label: "Sector Alignment", val: sc.sectorScore, max: 40, note: "Avg signal of listed peers" },
                      { label: "Market Regime", val: sc.regScore, max: 30, note: titleCase(regime) },
                      { label: "Timing / Status", val: sc.statScore, max: 20, note: STATUS_LABELS[sel.statusKey] },
                      { label: "Issue Type", val: sc.typeScore, max: 10, note: sel.type },
                    ].map(s => (
                      <div key={s.label} style={{ marginBottom: SP.md }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: K.textSecondary }}>{s.label}</span>
                          <span style={{ fontSize: 12, color: scColor, fontFamily: K.fontMono }}>{s.val} / {s.max}</span>
                        </div>
                        <div style={{ height: 4, background: K.surfaceElevated, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(s.val / s.max) * 100}%`, background: scColor, borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 11, color: K.textMuted, marginTop: 2 }}>{s.note}</div>
                      </div>
                    ))}
                    {result?.signalData && (() => {
                      const peers = result.signalData.filter(d => d.sector === sel.sector).slice(0, 5);
                      if (peers.length === 0) return null;
                      return (
                        <div style={{ marginTop: SP.md, borderTop: `1px solid ${K.border}`, paddingTop: SP.md }}>
                          <SL style={{ marginBottom: SP.sm }}>Listed Peers · {sel.sector}</SL>
                          {peers.map(p => (
                            <div key={p.ticker} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}>
                              <span style={{ color: K.text, fontFamily: K.fontMono, fontWeight: 600 }}>{p.ticker}</span>
                              <span style={{ color: p.signal > 0 ? K.positive : K.negative, fontFamily: K.fontMono }}>{p.signal > 0 ? "+" : ""}{p.signal.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>

            <div style={{ fontSize: 12, color: K.textSecondary, lineHeight: 1.7, padding: `${SP.md}px`, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.sm }}>
              <div style={{ color: K.warning, fontWeight: 600, marginBottom: SP.xs, fontSize: 12 }}>Disclaimer</div>
              Scores are derived from market regime, sector signal momentum of already-listed peers, and issue type — not the IPO company's fundamentals, financials, or promoter quality. Review the prospectus from SEBON before applying.
            </div>
          </div>
        )}
      </div>

      {!sel && (
        <div style={{ marginTop: SP.xl, fontSize: 12.5, color: K.textSecondary, lineHeight: 1.8 }}>
          <SL>How Scores Work</SL>
          Scores (0–100) combine four factors: <span style={{ color: K.text, fontWeight: 600 }}>Sector Alignment</span> (0–40, average ensemble signal of listed stocks in the same sector), <span style={{ color: K.text, fontWeight: 600 }}>Market Regime</span> (0–30, Calm=30, Fragmented=22, Stress=12, Crisis=4), <span style={{ color: K.text, fontWeight: 600 }}>Timing</span> (0–20, Open=20, Upcoming/Approved=14, Allotment=8), and <span style={{ color: K.text, fontWeight: 600 }}>Issue Type</span> (0–10, Ordinary=10, FPO=8, Debenture=6, Rights=5). Click any row for a full breakdown and listed peer signals.
        </div>
      )}
    </div>
  );
}

export { IPOTab };

import { useMemo, useState } from "react";
import { K, SP } from "../../components/common/theme.js";
import { FlashCell } from "../../components/common/FlashCell.jsx";
import { Sparkline } from "../../components/charts/Sparkline.jsx";

const COLUMNS = [
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "sector", label: "Sector", align: "left" },
  { key: "price", label: "Price", align: "right", sortable: true },
  { key: "chg", label: "60D", align: "right", sortable: true },
  { key: "trend", label: "Trend", align: "left" },
  { key: "signal", label: "Signal", align: "right", sortable: true },
  { key: "weight", label: "Weight", align: "right", sortable: true },
];

// Uses the 60-day sparkline path precomputed by the backend
// (signalData[i].sparkline60 — see pipelineService.js) instead of
// deriving it from a full raw-returns matrix shipped to the browser.
// Sector is deliberately styled as secondary (plain muted text, no pill)
// — ticker, price, and signal are what should visually dominate a row.
function Watchlist({ result }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: null, dir: 1 });

  const rows = useMemo(() => result.signalData.map(d => {
    const path = d.sparkline60 || [1];
    const chg = path.length > 1 ? path[path.length - 1] / path[0] - 1 : 0;
    return { ...d, path, chg, price: result.lastPriceByTicker?.[d.ticker] ?? null };
  }), [result.signalData, result.lastPriceByTicker]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = query ? rows.filter(r => r.ticker.toLowerCase().includes(query) || r.sector.toLowerCase().includes(query)) : rows;
    if (sort.key) {
      out = [...out].sort((a, b) => ((a[sort.key] ?? -Infinity) - (b[sort.key] ?? -Infinity)) * sort.dir);
    }
    return out;
  }, [rows, q, sort]);

  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: -1 });

  if (rows.length === 0) {
    return <div style={{ padding: `${SP.lg}px 0`, fontSize: 13, color: K.textSecondary }}>No tickers currently pass the active liquidity/quality filters — loosen the thresholds in Strategy Parameters to repopulate the watchlist.</div>;
  }

  return (<div>
    <div className="filter-bar">
      <input className="input" placeholder="Search ticker or sector…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 220 }} />
      <span style={{ fontSize: 12, color: K.textMuted }}>{filtered.length === rows.length ? `${rows.length} stocks` : `${filtered.length} of ${rows.length} stocks`}</span>
    </div>
    <div className="data-table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {COLUMNS.map(c => (
              <th
                key={c.key}
                data-align={c.align === "right" ? "right" : undefined}
                className={c.sortable ? `sortable${sort.key === c.key ? " sort-active" : ""}` : undefined}
                onClick={c.sortable ? () => toggleSort(c.key) : undefined}
              >
                {c.label}{c.sortable && sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.ticker}>
              <td style={{ fontFamily: K.fontMono, color: K.text, fontWeight: 600 }}>{r.ticker}</td>
              <td style={{ color: K.textMuted, fontSize: 12.5 }}>{r.sector}</td>
              <td className="num" data-align="right" style={{ color: K.textSecondary }}><FlashCell value={r.price} format={v => v ? v.toFixed(2) : "—"} /></td>
              <td className="num" data-align="right" style={{ color: r.chg >= 0 ? K.positive : K.negative }}>{(r.chg * 100).toFixed(1)}%</td>
              <td><Sparkline data={r.path} color={r.chg >= 0 ? K.positive : K.negative} /></td>
              <td className="num" data-align="right" style={{ color: K.textSecondary }}>{r.signal.toFixed(2)}</td>
              <td className="num" data-align="right" style={{ color: K.text }}>{(r.weight * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>);
}

export { Watchlist };

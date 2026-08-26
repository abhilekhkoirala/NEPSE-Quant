import { useState } from "react";
import { K, SP, RADIUS } from "../../components/common/theme.js";
import portfolioApi from "../../lib/api/portfolio.js";

// Upload a portfolio CSV (Scrip / Current Balance columns, as exported by
// most NEPSE brokers). Previously parsed the file itself in the browser
// with a naive, non-quote-aware split(",") — a second, weaker copy of the
// same parser the default portfolio.csv load path already used server-side.
// Now just reads the file as text and POSTs it to the backend, which
// parses it with the one canonical parser (dataService.parsePortfolioCSV)
// and updates the session's current portfolio.
function PortfolioUpload({ onUploaded }) {
  const [status, setStatus] = useState(null); // null | "loading" | "ok" | "error"
  const [message, setMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file) => {
    setStatus("loading");
    try {
      const text = await file.text();
      const res = await portfolioApi.upload(text);
      setStatus("ok");
      setMessage(`Loaded ${res.count} holdings`);
      onUploaded?.();
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Could not parse that file");
    }
  };

  return (
    <div>
      <label
        className={`dropzone${dragActive ? " drag-active" : ""}`}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: SP.sm, padding: `${SP.md}px ${SP.lg}px`, cursor: "pointer" }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
      >
        <span style={{ fontSize: 13, color: K.textSecondary }}>
          <span style={{ color: K.accent, fontWeight: 500 }}>Choose a file</span> or drag and drop portfolio.csv
        </span>
        <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
      </label>
      {status === "loading" && <div style={{ fontSize: 12, color: K.textMuted, marginTop: SP.xs }}>Uploading…</div>}
      {status === "ok" && <div style={{ fontSize: 12, color: K.positive, marginTop: SP.xs }}>{message}</div>}
      {status === "error" && <div style={{ fontSize: 12, color: K.negative, marginTop: SP.xs }}>{message}</div>}
    </div>
  );
}

export { PortfolioUpload };

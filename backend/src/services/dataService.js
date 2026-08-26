// Owns all on-disk state: the scraped price/sector CSVs, the default
// portfolio.csv, and the Python scraper subprocess + daily scheduler. This
// is the direct move of what used to live inline in server.js — same
// spawn/scheduler mechanics, same file layout, reorganized into one place
// so routes don't touch the filesystem directly.
//
// One real bug fixed in the move: the original server.js pointed BOTH the
// daily scheduler and the manual "refresh" button at scrape_news.py, which
// only ever writes nepse_news.json. It never actually refreshed
// nepse_prices.csv — the check that followed it (`existsSync(CSV_OUT)`)
// only ever passed because an old prices CSV happened to still be on
// disk from some earlier manual run of scrape_nepse.py. Both triggers now
// point at scrape_nepse.py (which writes prices + sectors + news
// together), matching what the scheduler's own comments say it's for.
import { spawn } from "child_process";
import { existsSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseCSVData, parseSectorCSV } from "../data/csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const SCRAPERS_DIR = join(__dirname, "..", "..", "scrapers");

const CSV_OUT = join(DATA_DIR, "nepse_prices.csv");
const SECTORS_OUT = join(DATA_DIR, "nepse_sectors.csv");
const PORTFOLIO_FILE = join(DATA_DIR, "portfolio.csv");
const PRICE_SCRAPER = join(SCRAPERS_DIR, "scrape_nepse.py");

// ─── Raw price/sector data, cached until the next successful scrape ───────
let _raw = null;

function loadRaw() {
  if (_raw) return _raw;
  if (!existsSync(CSV_OUT) || !existsSync(SECTORS_OUT)) return null;
  const secMeta = parseSectorCSV(readFileSync(SECTORS_OUT, "utf8"));
  _raw = parseCSVData(readFileSync(CSV_OUT, "utf8"), secMeta);
  return _raw;
}

function invalidateRaw() {
  _raw = null;
}

// ─── Default portfolio.csv (quote-aware parse — the same parser autoLoad
// used for this file; PortfolioUpload's separate, weaker split(",")
// parser is retired in favor of this single implementation, reused
// server-side for uploads too — see api/portfolio.js) ──────────────────────
function parsePortfolioCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const parseCSVLine = line => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ""));
  const headers = parseCSVLine(lines[0]);
  const scripIdx = headers.findIndex(h => h.toLowerCase() === "scrip");
  const qtyIdx = headers.findIndex(h => h.toLowerCase() === "current balance");
  if (scripIdx === -1 || qtyIdx === -1) return [];
  return lines.slice(1)
    .map(l => {
      const cols = parseCSVLine(l);
      return { symbol: cols[scripIdx]?.toUpperCase(), quantity: parseFloat(cols[qtyIdx]) };
    })
    .filter(p => p.symbol && !isNaN(p.quantity));
}

function loadDefaultPortfolio() {
  if (!existsSync(PORTFOLIO_FILE)) return [];
  return parsePortfolioCSV(readFileSync(PORTFOLIO_FILE, "utf8"));
}

// ─── Scraper subprocess (verbatim spawn/scheduler mechanics from
// server.js, cwd redirected to backend/data so the scraper's relative
// nepse_prices.csv / nepse_sectors.csv / portfolio.csv paths land there) ──
let scraperRunning = false;

function runScraper() {
  if (scraperRunning) {
    console.log("[scheduler] Scraper already running, skipping.");
    return Promise.resolve("already_running");
  }
  scraperRunning = true;
  console.log("[scraper] Starting NEPSE scraper...");

  return new Promise((resolve, reject) => {
    const py = spawn("python3", [PRICE_SCRAPER], { cwd: DATA_DIR });

    py.stdout.on("data", d => process.stdout.write(d.toString()));
    py.stderr.on("data", d => process.stderr.write(d.toString()));

    py.on("close", code => {
      scraperRunning = false;
      if (code !== 0) return reject(new Error(`Scraper exited with code ${code}`));
      if (!existsSync(CSV_OUT)) return reject(new Error("CSV not found after scrape"));
      invalidateRaw();
      console.log("[scraper] Done — CSV written to", CSV_OUT);
      resolve("ok");
    });

    py.on("error", err => {
      scraperRunning = false;
      reject(err);
    });
  });
}

function isScraperRunning() { return scraperRunning; }

// The "when to auto-scrape" scheduling concern lives in workers/scheduler.js
// (section 15 of the brief: isolate background jobs under backend/workers/
// so they can later move to cron/APScheduler/etc.) — it calls back into
// runScraper() above, which stays here since it's a data-access operation.
export {
  DATA_DIR, CSV_OUT, SECTORS_OUT, PORTFOLIO_FILE,
  loadRaw, invalidateRaw, loadDefaultPortfolio, parsePortfolioCSV,
  runScraper, isScraperRunning,
};
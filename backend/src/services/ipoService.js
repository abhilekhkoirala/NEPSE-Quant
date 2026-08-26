// IPO/FPO pipeline data: cached read of ipo_data.json (written by
// scrape_ipo.py), with a manual on-demand scrape trigger. Moved from the
// /api/ipo* routes in server.js — same cache/TTL/scrape pattern. Falls
// back to the built-in static IPO list (IPO_STATIC_DATA) when
// ipo_data.json is missing or empty, matching the original frontend's
// documented static-site fallback behavior.
import { spawn } from "child_process";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "./dataService.js";
import { IPO_STATIC_DATA } from "../data/ipoDefaults.js";

const SCRAPERS_DIR = join(DATA_DIR, "..", "scrapers");
const IPO_OUT = join(DATA_DIR, "ipo_data.json");
const IPO_SCRAPER_FILE = join(SCRAPERS_DIR, "scrape_ipo.py");
const IPO_CACHE_TTL_MS = 5 * 60 * 1000;

let _ipoCache = null;
let _ipoCacheTime = 0;
let ipoScraperRunning = false;

function loadIpoData() {
  const now = Date.now();
  if (_ipoCache && now - _ipoCacheTime < IPO_CACHE_TTL_MS) return _ipoCache;
  try {
    const json = JSON.parse(readFileSync(IPO_OUT, "utf8"));
    const items = json.items ?? (Array.isArray(json) ? json : []);
    _ipoCache = items.length ? items : IPO_STATIC_DATA;
    _ipoCacheTime = now;
    console.log(`[ipo] Loaded ${_ipoCache.length} IPOs from ${IPO_OUT}`);
  } catch (err) {
    console.warn(`[ipo] Could not read ${IPO_OUT}: ${err.message} — using built-in fallback list`);
    _ipoCache = IPO_STATIC_DATA;
    _ipoCacheTime = now;
  }
  return _ipoCache;
}

function refreshCache() {
  _ipoCache = null;
  _ipoCacheTime = 0;
  return loadIpoData();
}

function getStatus() {
  if (!existsSync(IPO_OUT)) {
    return { exists: false, hint: `Run scrape_ipo.py to generate ${IPO_OUT}` };
  }
  const stat = statSync(IPO_OUT);
  const json = JSON.parse(readFileSync(IPO_OUT, "utf8"));
  return {
    exists: true,
    fileModified: stat.mtime.toISOString(),
    scrapeTime: json.updatedAt ?? null,
    count: json.count ?? (json.items?.length ?? 0),
  };
}

function runIpoScraper() {
  return new Promise((resolve, reject) => {
    if (!existsSync(IPO_SCRAPER_FILE)) {
      return reject(new Error(`scrape_ipo.py not found at ${IPO_SCRAPER_FILE}`));
    }
    if (ipoScraperRunning) {
      return reject(Object.assign(new Error("IPO scraper already running, please wait."), { code: "ALREADY_RUNNING" }));
    }
    ipoScraperRunning = true;
    console.log("[ipo] Starting scrape_ipo.py ...");
    const py = spawn("python3", [IPO_SCRAPER_FILE], { cwd: DATA_DIR });
    py.stdout.on("data", d => process.stdout.write(d.toString()));
    py.stderr.on("data", d => process.stderr.write(d.toString()));
    py.on("close", code => {
      ipoScraperRunning = false;
      if (code !== 0) return reject(new Error(`scrape_ipo.py exited with code ${code}`));
      const data = refreshCache();
      console.log(`[ipo] Scrape done — ${data.length} IPOs loaded`);
      resolve(data);
    });
    py.on("error", err => { ipoScraperRunning = false; reject(err); });
  });
}

export { loadIpoData, refreshCache, getStatus, runIpoScraper };
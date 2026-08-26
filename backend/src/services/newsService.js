// Reads the scraped news feed. Moved from the GET /api/news handler in
// server.js — same file, same shape.
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "./dataService.js";

const NEWS_OUT = join(DATA_DIR, "nepse_news.json");

function loadNews() {
  if (!existsSync(NEWS_OUT)) {
    console.warn("[news] nepse_news.json not found at:", NEWS_OUT, "— run scrape_nepse.py first");
    return { items: [], error: "Run scrape_nepse.py to populate nepse_news.json" };
  }
  return JSON.parse(readFileSync(NEWS_OUT, "utf8"));
}

export { loadNews };

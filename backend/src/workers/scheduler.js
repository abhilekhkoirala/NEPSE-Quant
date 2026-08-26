// Daily auto-scrape scheduler. Isolated here (rather than inline in
// server.js, where it originally lived) per the brief's section 15 —
// background tasks live under backend/workers/ so they can later move to
// a real scheduler (cron, APScheduler, etc.) without touching the API
// layer. For now it's the same setInterval-based check the original app
// used, moved verbatim, just calling back into dataService.runScraper().
import { runScraper } from "../services/dataService.js";

// NEPSE market closes at 3:00 PM NPT (UTC+5:45). Scrapes at 4:00 PM NPT to
// ensure data is published. Checked every minute.
let lastScheduledScrape = null;

function shouldScrapeNow() {
  const now = new Date();
  const nepalOffset = 5 * 60 + 45;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nepalMinutes = (utcMinutes + nepalOffset) % (24 * 60);
  const nepalHour = Math.floor(nepalMinutes / 60);
  const nepalMin = nepalMinutes % 60;

  const nepalMs = now.getTime() + nepalOffset * 60 * 1000;
  const nepalDate = new Date(nepalMs);
  const dayOfWeek = nepalDate.getUTCDay();
  const dateStr = nepalDate.toISOString().slice(0, 10);

  const isNepseWeekday = dayOfWeek >= 0 && dayOfWeek <= 4; // Sun–Thu
  const isTargetTime = nepalHour === 16 && nepalMin === 0;
  const notYetRunToday = lastScheduledScrape !== dateStr;

  return isNepseWeekday && isTargetTime && notYetRunToday;
}

function startScheduler() {
  setInterval(() => {
    if (shouldScrapeNow()) {
      const nepalMs = Date.now() + (5 * 60 + 45) * 60 * 1000;
      const dateStr = new Date(nepalMs).toISOString().slice(0, 10);
      lastScheduledScrape = dateStr;
      console.log(`[scheduler] Triggering scheduled scrape for ${dateStr}...`);
      runScraper()
        .then(() => console.log("[scheduler] Scheduled scrape completed successfully."))
        .catch(err => {
          console.error("[scheduler] Scheduled scrape failed:", err.message);
          lastScheduledScrape = null;
        });
    }
  }, 60 * 1000);
  console.log("[scheduler] Auto-scrape active — runs daily at 4:00 PM NPT (Sun–Thu)");
}

function getLastScheduledScrape() { return lastScheduledScrape; }

export { startScheduler, getLastScheduledScrape };

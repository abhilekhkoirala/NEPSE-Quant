"""
NEPSE News Scraper  ·  v2.0
============================
Fetches recent NEPSE market news from SIX sources:

  1. Google News RSS  — NEPSE / market queries          (primary market)
  2. Google News RSS  — NRB / monetary policy queries   (macro)
  3. Google News RSS  — Nepal political / economy news  (political risk)
  4. Merolagani       — company announcements            (corporate actions)
  5. Sharesansar      — NEPSE-focused news site          (market news)
  6. NRB              — Nepal Rastra Bank press releases (monetary policy)

No extra packages needed — uses only requests + stdlib xml parser.

Usage:
    python scrape_news.py

Output:
    nepse_news.json   — loaded by your Express server at /api/news
"""

import requests
import json
import re
import time
import csv
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape

# ── Settings ───────────────────────────────────────────────────────────────
MAX_ITEMS_PER_SOURCE = 30
OUTPUT_FILE          = "nepse_news.json"
REQUEST_TIMEOUT      = 20
POLITE_DELAY         = 0.5   # seconds between requests
# ───────────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/xml, text/xml, */*",
}

HTML_HEADERS = {**HEADERS, "Accept": "text/html,application/xhtml+xml,*/*"}

# ── Google News RSS — market queries ──────────────────────────────────────
GNEWS_BASE = "https://news.google.com/rss/search?hl=en-NP&gl=NP&ceid=NP:en&q="

GNEWS_MARKET_QUERIES = [
    "NEPSE+Nepal+stock+market",
    "Nepal+stock+exchange+share+price",
    "Nepal+banking+finance+dividend+bonus+share",
    "Nepal+IPO+FPO+right+share+debenture",
    "SEBON+Nepal+securities+regulation",
]

# ── Google News RSS — macro / NRB queries ─────────────────────────────────
GNEWS_MACRO_QUERIES = [
    "NRB+Nepal+Rastra+Bank+monetary+policy+interest+rate",
    "Nepal+inflation+remittance+forex+reserve+economy",
    "Nepal+budget+fiscal+policy+tax+revenue",
]

# ── Google News RSS — political / risk queries ────────────────────────────
GNEWS_POLITICAL_QUERIES = [
    "Nepal+government+political+stability+coalition",
    "Nepal+import+export+trade+policy+ban",
    "Nepal+electricity+energy+hydropower+policy",
]

# ── Sentiment keywords ─────────────────────────────────────────────────────
# Market-specific positive signals
_POS = {
    "surge","rally","gain","profit","dividend","bonus","growth","record",
    "bullish","rise","soar","increase","expand","upgrade","buyback",
    "strong","beat","recover","ipo","fpo","listing","allotment","approved",
    "cut","reduce","lower","ease","surplus","inflow","remittance","stable",
    "reform","invest","development","infrastructure","export","surplus",
}
# Market-specific negative signals — NRB/political terms now weighted negatively
_NEG = {
    "fall","drop","loss","decline","bearish","crash","default","suspend",
    "halt","delist","probe","fraud","risk","penalty","fine","miss","warn",
    "debt","violation","action","tighten","hike","raise","inflation","deficit",
    "instability","crisis","protest","strike","ban","restrict","shortage",
    "sanction","corruption","scandal","arrest","raid","seized","laundering",
    "political","coalition","collapse","dissolved","deadlock","dispute",
    "flood","earthquake","disaster","outage","shortage","smuggling",
}

def sentiment_hint(text: str) -> str:
    words = set(re.findall(r"[a-z]+", text.lower()))
    score = len(words & _POS) - len(words & _NEG)
    return "positive" if score > 0 else "negative" if score < 0 else "neutral"


# ── Company name → ticker lookup ──────────────────────────────────────────
# Many NEPSE articles use company full names rather than ticker symbols.
# This table maps common name variants (lowercase) → ticker symbol.
COMPANY_NAME_MAP = {
    # Banks
    "nabil bank": "NABIL",
    "nepal investment bank": "NIB",
    "standard chartered bank": "SCB",
    "himalayan bank": "HBL",
    "nepal bank": "NBL",
    "rastriya banijya bank": "RBB",
    "agriculture development bank": "ADBL",
    "global ime bank": "GBIME",
    "kumari bank": "KBL",
    "machhapuchchhre bank": "MBL",
    "siddhartha bank": "SBL",
    "citizens bank": "CBL",
    "prime commercial bank": "PCBL",
    "prabhu bank": "PRVU",
    "sunrise bank": "SRBL",
    "ncc bank": "NCC",
    "laxmi sunrise bank": "LSL",
    "sanima bank": "SANIMA",
    "nic asia bank": "NICA",
    "nmb bank": "NMB",
    "everest bank": "EBL",
    "nepal sbi bank": "SBI",
    "bank of kathmandu": "BOKL",
    "civil bank": "CCBL",
    "muktinath bikas bank": "MNBBL",
    "miteri development bank": "MDBL",
    "garima bikas bank": "GBBL",
    "shine resunga": "SHINE",
    # Finance companies
    "nepal finance": "NFS",
    "multipurpose finance": "MFIL",
    "goodwill finance": "GUFL",
    "gfcl": "GFCL",
    "nirdhan utthan": "NUBL",
    "nmb microfinance": "NMBMF",
    # Hydro
    "upper tamakoshi": "UPPER",
    "shpc": "SHPC",
    "chilime": "CHCL",
    "nepal electricity": "NEA",
    "api power": "API",
    "ridi hydropower": "RIDI",
    "himal hydro": "HDHPC",
    "sanima mai": "SMHL",
    "ngadi": "NGPL",
    "nhpc": "NHPC",
    "upper bheri": "UBSL",
    "akpl": "AKPL",
    "bpcl": "BPCL",
    "sshl": "SSHL",
    "kpcl": "KPCL",
    "srhl": "SRHL",
    # Insurance
    "life insurance corporation": "LICN",
    "nepal life": "NLICL",
    "shikhar insurance": "SICL",
    "national life": "NLIC",
    "himalayan general": "HGI",
    "salapa": "SRLI",
    "reliance": "RNLI",
    "sagarmatha": "SIL",
    "prudential": "PIC",
    "premier insurance": "PPI",
    "ajod insurance": "AIL",
    "united insurance": "UNL",
    "lumbini general": "LIC",
    "neco insurance": "NICL",
    # Telecom / Other
    "nepal telecom": "NTEL",
    "ncell": "NCELL",
    "doorsanchar": "NTEL",
    "nim": "NICLBSL",
    "citizen investment": "CIT",
    "nepal infrastructure": "NIFRA",
    "bottlers nepal": "BNL",
    "unilever nepal": "UNL",
    "soaltee": "SHL",
    "himalayan distillery": "HDL",
    "nepal herbs": "NHE",
    "nimb": "NIMB",
    "czbil": "CZBIL",
}

def tag_tickers(text: str, tickers: "set[str]") -> "list[str]":
    upper = text.upper()
    lower = text.lower()
    found = set()
    # 1. Direct ticker symbol match (existing approach)
    for t in tickers:
        if re.search(r"\b" + re.escape(t) + r"\b", upper):
            found.add(t)
    # 2. Full company name match
    for name, ticker in COMPANY_NAME_MAP.items():
        if name in lower and ticker in tickers:
            found.add(ticker)
    return sorted(found)


def fmt_date(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d") if dt else ""


# ── Ticker universe ────────────────────────────────────────────────────────
def load_tickers() -> "set[str]":
    tickers = set()
    for fname in ("nepse_sectors.csv", "portfolio.csv"):
        try:
            with open(fname, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                col = "symbol" if fname == "nepse_sectors.csv" else "Scrip"
                for row in reader:
                    val = row.get(col, "").strip().upper()
                    if val and val != "TOTAL :":
                        tickers.add(val)
        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"  Warning reading {fname}: {e}")
    return tickers


# ── Shared: Google News RSS fetcher ───────────────────────────────────────
def scrape_google_news_queries(
    queries: "list[str]",
    tickers: "set[str]",
    label: str,
    seen_titles: "set[str]",
) -> "list[dict]":
    """Fetch a list of Google News RSS queries, deduplicating against seen_titles."""
    items = []
    for query in queries:
        url = GNEWS_BASE + query
        try:
            print(f"  [{label}] {query[:45]}…", end="", flush=True)
            resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()

            root = ET.fromstring(resp.content)
            channel = root.find("channel")
            if channel is None:
                print(" (no channel)")
                continue

            count = 0
            for item in channel.findall("item")[:MAX_ITEMS_PER_SOURCE]:
                title_el = item.find("title")
                link_el  = item.find("link")
                date_el  = item.find("pubDate")
                src_el   = item.find("source")

                if title_el is None:
                    continue

                title = unescape(title_el.text or "").strip()
                title = re.sub(r"\s+-\s+[\w\s]+$", "", title).strip()

                key = title[:60].lower()
                if key in seen_titles or len(title) < 10:
                    continue
                seen_titles.add(key)

                link   = link_el.text.strip() if link_el is not None else ""
                source = src_el.text.strip()  if src_el  is not None else "Google News"

                pub_date = ""
                if date_el is not None and date_el.text:
                    try:
                        pub_date = fmt_date(parsedate_to_datetime(date_el.text))
                    except Exception:
                        pub_date = date_el.text[:10]

                items.append({
                    "title":             title,
                    "url":               link,
                    "date":              pub_date,
                    "source":            source,
                    "category":          label,
                    "source_weight":     4 if label in ("Macro", "Political") else 1,
                    "tickers_mentioned": tag_tickers(title, tickers),
                    "sentiment_hint":    sentiment_hint(title),
                })
                count += 1

            print(f" {count} items")
        except Exception as e:
            print(f" FAILED ({e})")

        time.sleep(POLITE_DELAY)

    return items


# ── Source 4: Merolagani Announcements ────────────────────────────────────
MERO_ANN_PAGE = "https://merolagani.com/AnnouncementList.aspx"

def scrape_merolagani_announcements(tickers: "set[str]", seen_titles: "set[str]") -> "list[dict]":
    items = []
    try:
        print("  [Corporate] Merolagani announcements…", end="", flush=True)
        resp = requests.get(MERO_ANN_PAGE, headers=HTML_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        html = resp.text

        pattern = re.compile(
            r'href=["\'](?:https?://merolagani\.com)?(/AnnouncementDetail\.aspx\?id=(\d+))["\'][^>]*>'
            r'(.*?)</a>',
            re.IGNORECASE | re.DOTALL
        )

        seen_ids: "set[str]" = set()
        count = 0
        for m in pattern.finditer(html):
            ann_id = m.group(2)
            if ann_id in seen_ids:
                continue
            seen_ids.add(ann_id)

            raw_title = m.group(3)
            title = re.sub(r"<[^>]+>", " ", raw_title).strip()
            title = re.sub(r"\s+", " ", unescape(title)).strip()
            if len(title) < 8:
                continue

            key = title[:60].lower()
            if key in seen_titles:
                continue
            seen_titles.add(key)

            link = f"https://merolagani.com/AnnouncementDetail.aspx?id={ann_id}"

            context = html[max(0, m.start()-200):m.end()+200]
            date_match = re.search(r"(\d{4}-\d{2}-\d{2})", context)
            pub_date = date_match.group(1) if date_match else ""

            items.append({
                "title":             title,
                "url":               link,
                "date":              pub_date,
                "source":            "Merolagani",
                "category":          "corporate",
                "source_weight":     2,
                "tickers_mentioned": tag_tickers(title, tickers),
                "sentiment_hint":    sentiment_hint(title),
            })
            count += 1
            if count >= MAX_ITEMS_PER_SOURCE:
                break

        print(f" {count} items")
    except Exception as e:
        print(f" FAILED ({e})")

    return items


# ── Source 5: Sharesansar ─────────────────────────────────────────────────
SHARESANSAR_URL = "https://www.sharesansar.com/category/latest"

def scrape_sharesansar(tickers: "set[str]", seen_titles: "set[str]") -> "list[dict]":
    """
    Sharesansar is server-rendered — we parse article links and titles
    from the HTML directly. Layout: <a class='... text-...'>Title</a>
    with href pointing to /news/... pages.
    """
    items = []
    try:
        print("  [Market] Sharesansar latest…", end="", flush=True)
        resp = requests.get(SHARESANSAR_URL, headers=HTML_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        html = resp.text

        # Match news article links — Sharesansar uses /news/slug pattern
        pattern = re.compile(
            r'<a[^>]+href=["\']((https?://(?:www\.)?sharesansar\.com)?/news/([^"\']+))["\'][^>]*>'
            r'\s*(.*?)\s*</a>',
            re.IGNORECASE | re.DOTALL
        )

        # Also try to find dates nearby each article
        date_pattern = re.compile(r'(\d{4}-\d{2}-\d{2}|\w+ \d+,\s*\d{4})')

        count = 0
        for m in pattern.finditer(html):
            raw_url   = m.group(1)
            raw_title = m.group(4)

            # Clean title
            title = re.sub(r"<[^>]+>", " ", raw_title).strip()
            title = re.sub(r"\s+", " ", unescape(title)).strip()
            if len(title) < 15:
                continue

            key = title[:60].lower()
            if key in seen_titles:
                continue
            seen_titles.add(key)

            # Normalise URL
            link = raw_url if raw_url.startswith("http") else "https://www.sharesansar.com" + raw_url

            # Try to find a date in surrounding context
            context = html[max(0, m.start()-300):m.end()+300]
            dm = date_pattern.search(context)
            pub_date = ""
            if dm:
                raw_d = dm.group(1)
                if re.match(r"\d{4}-\d{2}-\d{2}", raw_d):
                    pub_date = raw_d
                else:
                    try:
                        pub_date = fmt_date(datetime.strptime(raw_d, "%B %d, %Y"))
                    except Exception:
                        pass

            items.append({
                "title":             title,
                "url":               link,
                "date":              pub_date,
                "source":            "Sharesansar",
                "category":          "market",
                "source_weight":     1,
                "tickers_mentioned": tag_tickers(title, tickers),
                "sentiment_hint":    sentiment_hint(title),
            })
            count += 1
            if count >= MAX_ITEMS_PER_SOURCE:
                break

        print(f" {count} items")
    except Exception as e:
        print(f" FAILED ({e})")

    time.sleep(POLITE_DELAY)
    return items


# ── Source 6: NRB Press Releases ──────────────────────────────────────────
NRB_PRESS_URL = "https://www.nrb.org.np/category/press-release/"

def scrape_nrb_press_releases(tickers: "set[str]", seen_titles: "set[str]") -> "list[dict]":
    """
    NRB's website lists press releases as standard WordPress post links.
    We extract the title, link, and date from the listing page HTML.
    """
    items = []
    try:
        print("  [Macro] NRB press releases…", end="", flush=True)
        resp = requests.get(NRB_PRESS_URL, headers=HTML_HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        html = resp.text

        # WordPress archive page: <h2 class="entry-title"><a href="...">Title</a></h2>
        # Also try generic article link patterns on NRB site
        pattern = re.compile(
            r'<(?:h2|h3|h4)[^>]*>\s*<a[^>]+href=["\']'
            r'(https?://(?:www\.)?nrb\.org\.np/[^"\']+)["\'][^>]*>\s*(.*?)\s*</a>',
            re.IGNORECASE | re.DOTALL
        )

        # Date pattern: NRB uses <time datetime="YYYY-MM-DD"> or text like "2024-01-15"
        date_pattern = re.compile(r'<time[^>]+datetime=["\'](\d{4}-\d{2}-\d{2})')

        count = 0
        # Find all dates in document order to match with articles
        all_dates = date_pattern.findall(html)
        date_idx = 0

        for i, m in enumerate(pattern.finditer(html)):
            link      = m.group(1)
            raw_title = m.group(2)

            title = re.sub(r"<[^>]+>", " ", raw_title).strip()
            title = re.sub(r"\s+", " ", unescape(title)).strip()
            if len(title) < 8:
                continue

            key = title[:60].lower()
            if key in seen_titles:
                continue
            seen_titles.add(key)

            pub_date = all_dates[i] if i < len(all_dates) else ""

            items.append({
                "title":             title,
                "url":               link,
                "date":              pub_date,
                "source":            "NRB",
                "category":          "monetary_policy",
                "source_weight":     4,
                "tickers_mentioned": tag_tickers(title, tickers),
                "sentiment_hint":    sentiment_hint(title),
            })
            count += 1
            if count >= MAX_ITEMS_PER_SOURCE:
                break

        print(f" {count} items")
    except Exception as e:
        print(f" FAILED ({e})")

    time.sleep(POLITE_DELAY)
    return items


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  NEPSE News Scraper  v2.0")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    tickers = load_tickers()
    print(f"  Ticker universe: {len(tickers)} symbols\n")

    # Global dedup set — shared across ALL sources so cross-source duplicates
    # are eliminated before they reach the JSON.
    seen_titles: "set[str]" = set()
    all_items:   "list[dict]" = []

    # ── 1 & 2 & 3: Google News (market + macro + political) ───────────────
    print("── Google News · Market ──────────────────────────────────")
    all_items += scrape_google_news_queries(
        GNEWS_MARKET_QUERIES, tickers, "Market", seen_titles)

    print("\n── Google News · Macro / NRB ─────────────────────────────")
    all_items += scrape_google_news_queries(
        GNEWS_MACRO_QUERIES, tickers, "Macro", seen_titles)

    print("\n── Google News · Political / Risk ────────────────────────")
    all_items += scrape_google_news_queries(
        GNEWS_POLITICAL_QUERIES, tickers, "Political", seen_titles)

    # ── 4: Merolagani ─────────────────────────────────────────────────────
    print("\n── Merolagani · Corporate Announcements ──────────────────")
    all_items += scrape_merolagani_announcements(tickers, seen_titles)

    # ── 5: Sharesansar ────────────────────────────────────────────────────
    print("\n── Sharesansar · Market News ─────────────────────────────")
    all_items += scrape_sharesansar(tickers, seen_titles)

    # ── 6: NRB Press Releases ─────────────────────────────────────────────
    print("\n── NRB · Press Releases ──────────────────────────────────")
    all_items += scrape_nrb_press_releases(tickers, seen_titles)

    # ── Sort newest-first ──────────────────────────────────────────────────
    all_items.sort(key=lambda x: x.get("date", ""), reverse=True)

    # ── Summary stats by category ──────────────────────────────────────────
    cats = {}
    for item in all_items:
        c = item.get("category", "other")
        cats[c] = cats.get(c, 0) + 1

    pos = sum(1 for i in all_items if i["sentiment_hint"] == "positive")
    neg = sum(1 for i in all_items if i["sentiment_hint"] == "negative")
    neu = sum(1 for i in all_items if i["sentiment_hint"] == "neutral")
    tagged = sum(1 for i in all_items if i["tickers_mentioned"])

    output = {
        "scraped_at":  datetime.now(timezone.utc).isoformat(),
        "item_count":  len(all_items),
        "items":       all_items,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"  Total unique items : {len(all_items)}")
    print(f"  Positive / Neg / Neutral: {pos} / {neg} / {neu}")
    print(f"  Items with tickers : {tagged}")
    print(f"  By category:")
    for cat, n in sorted(cats.items()):
        print(f"    {cat:<20} {n}")
    print(f"\n  Saved → {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
"""
NEPSE Historical Price Scraper — Full Universe
===============================================
1. Fetches the full company list from Merolagani (~1630 tickers)
2. Scrapes daily closing prices for every ticker via the chart API
3. Filters to liquid stocks (>=400 trading days, >=45% coverage)
4. Saves nepse_prices.csv and nepse_sectors.csv for the NEPSEQuant app

Requirements:
    pip install requests pandas

Usage:
    python scrape_nepse.py

Output:
    nepse_prices.csv   (dates as rows, tickers as columns)
    nepse_sectors.csv  (ticker -> sector name mapping)
"""

import requests
import pandas as pd
import time
import sys
import re
import csv
import json
from datetime import datetime, timedelta

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

# ── Liquidity filter settings ──────────────────────────────────────────────
MIN_TRADING_DAYS  = 400    # Must have at least this many days of raw data
MIN_COVERAGE_PCT  = 0.45   # Must have traded on ≥45% of available calendar days
MAX_STOCKS        = 300    # Cap at 300 most liquid stocks to keep CSV manageable
MAX_STALE_DAYS    = 45     # Exclude stocks whose last trade is older than this many calendar days
# ───────────────────────────────────────────────────────────────────────────

# ── News scraping settings ─────────────────────────────────────────────────
NEWS_MAX_ITEMS    = 60     # Max news items to keep in nepse_news.json
NEWS_LOOKBACK_DAYS = 14   # Only keep news from the last N days
NEWS_OUTPUT_FILE  = "nepse_news.json"

NEWS_SOURCES = [
    # ShareSansar — reliable NEPSE news aggregator
    "https://www.sharesansar.com/news",
    # NepseAlpha — NEPSE-specific analysis & news
    "https://nepsealpha.com/news",
]
# ───────────────────────────────────────────────────────────────────────────


def get_portfolio_tickers():
    tickers = set()
    try:
        with open("portfolio.csv", mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                scrip = row["Scrip"].strip()
                if scrip and scrip != "Total :":
                    tickers.add(scrip)
    except Exception as e:
        print(f"  Warning: Could not read portfolio.csv: {e}")
    return tickers

PORTFOLIO_TICKERS = get_portfolio_tickers()
print(f"  Portfolio tickers loaded: {len(PORTFOLIO_TICKERS)}")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://merolagani.com/",
}

# Fetch ~6 years of data
RANGE_START = 1577836800   # 2020-01-01
RANGE_END   = int(datetime.now().timestamp()) + 86400

AUTOSUGGEST_URL = (
    "https://merolagani.com/handlers/AutoSuggestHandler.ashx?type=Company"
)

API_URL = (
    "https://merolagani.com/handlers/TechnicalChartHandler.ashx"
    "?type=get_advanced_chart"
    "&symbol={symbol}"
    "&resolution=1D"
    f"&rangeStartDate={RANGE_START}"
    f"&rangeEndDate={RANGE_END}"
    "&from=&isAdjust=1&currencyCode=NPR"
)

# ── Sector classification by keyword in company name ──────────────────────
SECTOR_RULES = [
    ("Mutual Fund",        ["mutual fund", "scheme", "mf "]),
    ("Microfinance",       ["microfinance", "laghubitta", "bikash bank"]),
    ("Life Insurance",     ["life insurance", "jeevan"]),
    ("Non-Life Insurance", ["insurance", "beema"]),
    ("Hydropower",         ["hydropower", "hydro", "bijuli", "power", "energy", "electricity", "jal"]),
    ("Development Bank",   ["development bank"]),
    ("Finance",            ["finance", "capital"]),
    ("Commercial Bank",    ["bank"]),
    ("Manufacturing",      ["brewery", "cement", "sugar", "flour", "dairy", "tobacco",
                            "lube", "spinning", "salt", "noodles", "bottlers", "manufacturing"]),
    ("Hotels & Tourism",   ["hotel", "resort", "tourism"]),
    ("Trading",            ["trading", "trade"]),
    ("Infrastructure",     ["infrastructure", "infra", "telecom", "cable"]),
    ("Investment",         ["investment", "holdings"]),
]

def classify_sector(name: str) -> str:
    n = name.lower()
    for sector, keywords in SECTOR_RULES:
        if any(k in n for k in keywords):
            return sector
    return "Other"


def fetch_all_tickers() -> "list[dict]":
    """
    Returns a list of dicts: [{symbol, name, sector}, ...]
    """
    print("  Fetching full company list from Merolagani...", end="", flush=True)
    resp = requests.get(AUTOSUGGEST_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    raw = resp.json()

    companies = []
    for item in raw:
        # Format: "ADBL (Agriculture Development Bank Limited)"
        text = list(item.values())[0] if isinstance(item, dict) else str(item)
        match = re.match(r"^([A-Z0-9]+)\s*\((.+)\)$", text.strip())
        if match:
            symbol = match.group(1).strip()
            name   = match.group(2).strip()
            sector = classify_sector(name)
            companies.append({"symbol": symbol, "name": name, "sector": sector})

    print(f" {len(companies)} companies found")
    return companies


def scrape_ticker(symbol: str) -> pd.Series:
    """
    Fetches daily closing prices from Merolagani chart API.
    Returns a raw pd.Series (before forward-fill) with date index.
    """
    url = API_URL.format(symbol=symbol)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return pd.Series(dtype=float, name=symbol)

    timestamps = data.get("t", [])
    closes     = data.get("c", [])

    if not timestamps or not closes:
        return pd.Series(dtype=float, name=symbol)

    dates = (
        pd.to_datetime(timestamps, unit="s", utc=True)
        .tz_convert("Asia/Kathmandu")
        .normalize()
        .tz_localize(None)
    )
    series = pd.Series(closes, index=dates, name=symbol, dtype=float)
    series = series[~series.index.duplicated(keep="last")].sort_index()
    return series


def is_liquid(series: pd.Series) -> bool:
    """Returns True if the stock meets the minimum liquidity requirements."""
    if len(series) < MIN_TRADING_DAYS:
        return False
    # Coverage = raw trading days / total calendar days in range
    total_days = (series.index[-1] - series.index[0]).days
    if total_days == 0:
        return False
    coverage = len(series) / total_days
    return coverage >= MIN_COVERAGE_PCT


def is_active(series: pd.Series) -> bool:
    """Returns True if the stock has traded recently (not closed/delisted/halted).
    A stock is considered closed if its last data point is older than MAX_STALE_DAYS."""
    if series.empty:
        return False
    days_since_last_trade = (pd.Timestamp.now() - series.index[-1]).days
    return days_since_last_trade <= MAX_STALE_DAYS


def scrape_news(tickers: "list[str]") -> "list[dict]":
    """
    Scrapes recent NEPSE market news from ShareSansar and NepseAlpha.
    Returns a list of news dicts:
        { title, url, date, source, tickers_mentioned, sentiment_hint }

    Requires: pip install beautifulsoup4
    If bs4 is missing, returns an empty list with a warning.
    """
    if not HAS_BS4:
        print("  ⚠  beautifulsoup4 not installed — skipping news scrape.")
        print("      Run: pip install beautifulsoup4")
        return []

    ticker_set = set(tickers)
    cutoff     = datetime.now() - timedelta(days=NEWS_LOOKBACK_DAYS)
    all_items  = []

    # ── Source 1: ShareSansar ──────────────────────────────────────────────
    try:
        print("  Fetching news from ShareSansar…", end="", flush=True)
        resp = requests.get(NEWS_SOURCES[0], headers=HEADERS, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # ShareSansar wraps each story in <div class="featured-news-list">
        # or <div class="media"> blocks — try both selectors
        blocks = (
            soup.select("div.featured-news-list") or
            soup.select("div.media") or
            soup.select("article")
        )
        for block in blocks[:NEWS_MAX_ITEMS]:
            a_tag   = block.find("a", href=True)
            if not a_tag:
                continue
            title   = a_tag.get_text(strip=True)
            href    = a_tag["href"]
            link    = href if href.startswith("http") else "https://www.sharesansar.com" + href

            # Date: look for a <span> or <time> near the block
            date_el = block.find("time") or block.find("span", class_=re.compile(r"date|time|ago", re.I))
            date_str = date_el.get_text(strip=True) if date_el else ""

            # Tag tickers explicitly mentioned in the headline
            title_upper     = title.upper()
            mentioned       = sorted({t for t in ticker_set if re.search(r'\b' + re.escape(t) + r'\b', title_upper)})

            # Lightweight sentiment hint from keywords
            sentiment = _sentiment_hint(title)

            all_items.append({
                "title":             title,
                "url":               link,
                "date":              date_str,
                "source":            "ShareSansar",
                "tickers_mentioned": mentioned,
                "sentiment_hint":    sentiment,
            })

        print(f" {len(all_items)} items")
    except Exception as e:
        print(f" FAILED ({e})")

    # ── Source 2: NepseAlpha ───────────────────────────────────────────────
    try:
        print("  Fetching news from NepseAlpha…", end="", flush=True)
        resp2 = requests.get(NEWS_SOURCES[1], headers=HEADERS, timeout=20)
        resp2.raise_for_status()
        soup2 = BeautifulSoup(resp2.text, "html.parser")

        blocks2 = (
            soup2.select("div.news-item") or
            soup2.select("article") or
            soup2.select("div.card")
        )
        before = len(all_items)
        for block in blocks2[:NEWS_MAX_ITEMS]:
            a_tag = block.find("a", href=True)
            if not a_tag:
                continue
            title   = a_tag.get_text(strip=True)
            if not title or len(title) < 10:
                continue
            href    = a_tag["href"]
            link    = href if href.startswith("http") else "https://nepsealpha.com" + href

            date_el  = block.find("time") or block.find("span", class_=re.compile(r"date|time|ago", re.I))
            date_str = date_el.get_text(strip=True) if date_el else ""

            title_upper = title.upper()
            mentioned   = sorted({t for t in ticker_set if re.search(r'\b' + re.escape(t) + r'\b', title_upper)})
            sentiment   = _sentiment_hint(title)

            all_items.append({
                "title":             title,
                "url":               link,
                "date":              date_str,
                "source":            "NepseAlpha",
                "tickers_mentioned": mentioned,
                "sentiment_hint":    sentiment,
            })

        print(f" {len(all_items) - before} items")
    except Exception as e:
        print(f" FAILED ({e})")

    # Deduplicate by title prefix (first 60 chars)
    seen, deduped = set(), []
    for item in all_items:
        key = item["title"][:60].lower().strip()
        if key not in seen:
            seen.add(key)
            deduped.append(item)

    # Trim to max
    result = deduped[:NEWS_MAX_ITEMS]
    print(f"  Total unique news items: {len(result)}")
    return result


def _sentiment_hint(title: str) -> str:
    """
    Returns 'positive', 'negative', or 'neutral' based on keyword scan.
    This is purely lexical — NOT a true NLP model.
    The AI analysis layer should apply proper contextual reasoning.
    """
    t = title.lower()
    pos_kw = ["surge", "rally", "gain", "profit", "dividend", "bonus", "growth",
              "record", "bullish", "rise", "soar", "increase", "expand", "upgrade",
              "buyback", "strong", "beat", "recover", "IPO", "FPO"]
    neg_kw = ["fall", "drop", "loss", "decline", "bearish", "crash", "default",
              "suspend", "halt", "delist", "probe", "fraud", "risk", "cut",
              "penalty", "sebi", "sebon", "fine", "miss", "warn", "debt"]
    score = sum(1 for k in pos_kw if k in t) - sum(1 for k in neg_kw if k in t)
    if score > 0:   return "positive"
    if score < 0:   return "negative"
    return "neutral"


def main():
    print("=" * 60)
    print("  NEPSE Full-Universe Scraper — Merolagani Chart API")
    print(f"  Min days: {MIN_TRADING_DAYS}  |  Min coverage: {MIN_COVERAGE_PCT*100:.0f}%  |  Max stocks: {MAX_STOCKS}")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Step 1: Get all tickers
    companies = fetch_all_tickers()

    # Step 2: Scrape each ticker
    all_series  = []
    liquid_meta = []
    illiquid    = 0
    failed      = 0
    total       = len(companies)

    # Separate portfolio and non-portfolio companies
    portfolio_cos = [c for c in companies if c["symbol"] in PORTFOLIO_TICKERS]
    other_cos     = [c for c in companies if c["symbol"] not in PORTFOLIO_TICKERS]
    
    # Process portfolio stocks first (force include)
    ordered_companies = portfolio_cos + other_cos

    for i, co in enumerate(ordered_companies, 1):
        symbol = co["symbol"]
        is_portfolio = symbol in PORTFOLIO_TICKERS
        print(f"  [{i:4d}/{total}] {symbol:<12}", end="", flush=True)

        try:
            s = scrape_ticker(symbol)
            if s.empty:
                print("  — no data")
                failed += 1
            elif not is_active(s):
                last = s.index[-1].date() if not s.empty else "?"
                days_stale = (pd.Timestamp.now() - s.index[-1]).days if not s.empty else "?"
                print(f"  — closed/halted (last trade {last}, {days_stale}d ago)")
                illiquid += 1
            elif not is_portfolio and not is_liquid(s):
                print(f"  — illiquid ({len(s)} days)")
                illiquid += 1
            else:
                status = "✓ (forced)" if is_portfolio else "✓"
                print(f"  {status} {len(s)} days  [{co['sector']}]")
                all_series.append(s)
                liquid_meta.append(co)
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1

        time.sleep(0.5)

        # Stop once we have enough liquid stocks (but don't stop portfolio stocks)
        if len(all_series) >= MAX_STOCKS and symbol not in PORTFOLIO_TICKERS:
            print(f"\n  Reached {MAX_STOCKS} liquid stocks — stopping early (portfolio stocks kept).")
            break

    if not all_series:
        print("\nNo liquid stocks found. Check your internet connection.")
        sys.exit(1)

    # Step 3: Build DataFrame
    df = pd.concat(all_series, axis=1)
    df.sort_index(inplace=True)
    df.ffill(inplace=True)
    df.dropna(how="all", inplace=True)

    # Step 4: Save prices CSV
    prices_path = "nepse_prices.csv"
    df.index.name = "Date"
    df.to_csv(prices_path)

    # Step 5: Save sector mapping CSV
    sectors_path = "nepse_sectors.csv"
    sector_df = pd.DataFrame(liquid_meta)[["symbol", "name", "sector"]]
    sector_df.to_csv(sectors_path, index=False)

    print("\n" + "=" * 60)
    print(f"  Done!")
    print(f"  Liquid stocks:   {len(all_series)}")
    print(f"  Illiquid skipped: {illiquid}")
    print(f"  Failed/no data:  {failed}")
    print(f"  Trading days:    {len(df)}")
    print(f"  Date range:      {df.index[0].date()} → {df.index[-1].date()}")
    print(f"\n  Saved: {prices_path}")
    print(f"  Saved: {sectors_path}")

    # Step 6: Scrape and save news
    print("\n" + "=" * 60)
    print("  Scraping NEPSE market news…")
    all_symbols = [c["symbol"] for c in liquid_meta]
    news = scrape_news(all_symbols)
    news_meta = {
        "scraped_at": datetime.now().isoformat(),
        "item_count": len(news),
        "items": news,
    }
    with open(NEWS_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(news_meta, f, ensure_ascii=False, indent=2)
    print(f"  Saved: {NEWS_OUTPUT_FILE}  ({len(news)} items)")
    print("=" * 60)


if __name__ == "__main__":
    main()
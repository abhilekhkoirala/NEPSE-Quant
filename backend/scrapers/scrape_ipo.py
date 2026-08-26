"""
NEPSE IPO Scraper  ·  v4.0
===========================
Sources:
  1. Merolagani  — https://merolagani.com/Ipo.aspx?type=upcoming
                   Parses announcement-style anchor text.
  2. NepseAlpha  — Playwright browser automation (bypasses Cloudflare).
                   Columns: Company | Units | Opening Date | Closing Date |
                            Issue Manager | Status
  3. SEBON (PDF) — https://www.sebon.gov.np/ipo-approved
                   Downloads the PDF and extracts the approved-IPO table.

Dependencies:
    pip install requests pdfplumber playwright
    playwright install chromium

Usage:
    python scrape_ipo.py

Output:
    ipo_data.json
"""

import re
import json
import time
import calendar
import os
import importlib
from datetime import datetime, timezone
from html import unescape

import requests

# ── Settings ─────────────────────────────────────────────────────────────────
MAX_ITEMS_PER_SOURCE = 500
OUTPUT_FILE          = "ipo_data.json"
REQUEST_TIMEOUT      = 25
POLITE_DELAY         = 0.6
# ─────────────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/148.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection":      "keep-alive",
}

# ── NepseAlpha cookies (refresh every ~7 days) ────────────────────────────────
# HOW TO REFRESH:
#   1. Open Chrome → https://nepsealpha.com/investment-calandar/ipo
#   2. F12 → Application → Cookies → https://nepsealpha.com
#   3. Copy cf_clearance  → CF_CLEARANCE
#      Copy nepsealpha_session → NA_SESSION
CF_CLEARANCE = "COMPApFh80kMwNDYJVd4l3a2cMU02Sfs73350Cov1zQ-1785067986-1.2.1.1-_dW4OfjcUvTIOs5XEYKL8gtKWT4NSSBS2jQDPhep4WjAfmJVcp7QoGf0yZj39YA1MS7XsNN_CI9dj7Ap62ziOVbJilLp_YmBqHRNxpejA0rjUVuCHB2H09FG8BF_Ug_NzQt.1dGppP48xQfVMstfsNCPfxTKpK_Mhvq8d4f_TYrIZ5FE47EuvkZCRgMFpvLhID8t20Enz6FoLgzFZLsrGkkBpwkOZWeMz6PMRiaawAiDetB9xAOAxnmQhlz8QXWe2Tp_QTd7.ObQHAr8HgQxCNCqiHjncKQeRXuPW8oT5iY7AyILwQfzSrlMuHhUXJWCRnqwpK5XUsdPBJW43mNhY_KmZAt5q1r16sJ6pppuPm4"
NA_SESSION   = "eyJpdiI6Ikgwdzh6dG5uZUNVTkdwRlVXVG1Eb1E9PSIsInZhbHVlIjoiUEJGTFpndmFPSFVCUzFEVU9xREQ0Zi9vaDFVYyt0eFhRZW9IZ1R2bEYwaGNtMDRzVDhKRWw4TUJsMnl3MjBjZ0xlRzY2MHFabTdZbkphdVFOd1RyUEl0Nk5KMGhTS094dDBWaGdPSzlCRnZaSFZKc1FlQ3BxN0ZHQXIvVlN0ZFQiLCJtYWMiOiJmMzFhZGI4OGI0M2FlNTJhNjU5MzdhMmY2OTQ1Yjk0MGEyNWIzMjdhN2Q5Nzc3OGQzNzg3MzlmOGEyMWUzNDgyIiwidGFnIjoiIn0%3D"
# ─────────────────────────────────────────────────────────────────────────────


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def norm_date(raw: str) -> str:
    """Normalise various date strings to YYYY-MM-DD; return raw if unknown."""
    raw = raw.strip().rstrip(".,;")
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y",
                "%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%d %b %Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return raw


_BS_MONTHS = {
    "baisakh": "Apr/May", "jestha": "May/Jun",  "ashadh": "Jun/Jul",
    "shrawan": "Jul/Aug", "bhadra": "Aug/Sep",  "ashwin": "Sep/Oct",
    "kartik":  "Oct/Nov", "mangsir": "Nov/Dec", "poush":  "Dec/Jan",
    "magh":    "Jan/Feb", "falgun": "Feb/Mar",  "chaitra": "Mar/Apr",
}

def parse_nepali_date_range(text: str) -> "tuple[str, str]":
    iso = re.findall(r"\d{4}-\d{2}-\d{2}", text)
    if len(iso) >= 2:
        return iso[0], iso[1]
    if len(iso) == 1:
        return iso[0], ""
    m = re.search(
        r"(\d+)\w*\s*[-–to]+\s*(\d+)\w*\s+(\w+),?\s*(\d{4})",
        text, re.IGNORECASE,
    )
    if m:
        d1, d2, month, year = m.group(1), m.group(2), m.group(3), m.group(4)
        gre = _BS_MONTHS.get(month.lower(), month)
        return f"{d1} {month} {year} BS ({gre})", f"{d2} {month} {year} BS ({gre})"
    return "", ""


_IPO_KW = re.compile(
    r"\b(IPO|FPO|right\s+share|rights?\s+issue|debenture|mutual\s+fund"
    r"|public\s+issue|share\s+issue|unit\s+of\s+IPO|going\s+to\s+issue)\b",
    re.IGNORECASE,
)

def extract_ipo_meta(text: str) -> dict:
    units_m = re.search(r"([\d,]+\.?\d*)\s*units?", text, re.IGNORECASE)
    price_m = re.search(r"(?:price|Rs\.?|NPR)\s*[:\.]?\s*([\d,]+)", text, re.IGNORECASE)
    type_m  = re.search(r"\b(IPO|FPO|right\s+share|debenture|mutual\s+fund)\b", text, re.IGNORECASE)
    return {
        "units": units_m.group(1) if units_m else "",
        "price": price_m.group(1) if price_m else "",
        "type":  type_m.group(0).upper() if type_m else "IPO",
    }


def fetch_html(url: str, session: requests.Session) -> "str | None":
    try:
        r = session.get(url, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        return r.text
    except requests.HTTPError as e:
        print(f" HTTP {e.response.status_code}")
    except Exception as e:
        print(f" FAILED ({e})")
    return None


# ══════════════════════════════════════════════════════════════════════════════
# Source 1 — Merolagani
# ══════════════════════════════════════════════════════════════════════════════
MERO_IPO_URL = "https://merolagani.com/Ipo.aspx?type=upcoming"
MERO_ANN_URL = "https://merolagani.com/AnnouncementList.aspx"
MERO_BASE    = "https://merolagani.com"

_MERO_LINK = re.compile(
    r'href=["\'](?:https?://merolagani\.com)?(/AnnouncementDetail\.aspx\?id=(\d+))["\'][^>]*>'
    r'(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)

def _parse_merolagani_html(html: str, seen: "set[str]") -> "list[dict]":
    items = []
    seen_ids: "set[str]" = set()
    for m in _MERO_LINK.finditer(html):
        ann_id    = m.group(2)
        raw_title = m.group(3)
        if ann_id in seen_ids:
            continue
        seen_ids.add(ann_id)

        title = clean(raw_title)
        if len(title) < 10 or not _IPO_KW.search(title):
            continue

        key = title[:60].lower()
        if key in seen:
            continue
        seen.add(key)

        meta             = extract_ipo_meta(title)
        open_d, close_d  = parse_nepali_date_range(title)

        company_m = re.match(
            r"^(.+?)\s+(?:is going to|will|has|limited|ltd\.?)\b",
            title, re.IGNORECASE,
        )
        company = company_m.group(1).strip() if company_m else title[:60]

        items.append({
            "company":       company,
            "type":          meta["type"],
            "open_date":     open_d,
            "close_date":    close_d,
            "units":         meta["units"],
            "price":         meta["price"],
            "issue_manager": "",
            "status":        "",
            "description":   title,
            "url":           f"{MERO_BASE}/AnnouncementDetail.aspx?id={ann_id}",
            "source":        "Merolagani",
        })
        if len(items) >= MAX_ITEMS_PER_SOURCE:
            break
    return items


def scrape_merolagani(session: requests.Session, seen: "set[str]") -> "list[dict]":
    print("  [Merolagani] Upcoming IPO page…", end="", flush=True)
    html  = fetch_html(MERO_IPO_URL, session)
    items = _parse_merolagani_html(html, seen) if html else []

    if not items:
        print(f" 0 — trying AnnouncementList…", end="", flush=True)
        html2 = fetch_html(MERO_ANN_URL, session)
        items = _parse_merolagani_html(html2, seen) if html2 else []

    print(f" {len(items)} items")
    time.sleep(POLITE_DELAY)
    return items


# ══════════════════════════════════════════════════════════════════════════════
# Source 2 — NepseAlpha (Playwright — bypasses Cloudflare)
# ══════════════════════════════════════════════════════════════════════════════

_NA_COMPANY  = ("symbol", "company", "Company", "name")
_NA_UNITS    = ("units", "Units", "unit")
_NA_OPEN     = ("opening_date", "open_date", "Opening Date")
_NA_CLOSE    = ("closing_date", "close_date", "Closing Date")
_NA_MANAGER  = ("issue_manager", "Issue Manager", "issueManager", "manager")
_NA_STATUS   = ("status", "Status")

_NA_COLUMNS = (
    ("symbol",        True),
    ("units",         True),
    ("opening_date",  True),
    ("closing_date",  True),
    ("issue_manager", True),
    ("status",        True),
    ("view",          False),
)

def _na_params(draw: int, start: int, length: int) -> dict:
    p: dict = {}
    for i, (col, orderable) in enumerate(_NA_COLUMNS):
        p[f"columns[{i}][data]"]          = col
        p[f"columns[{i}][name]"]          = col
        p[f"columns[{i}][searchable]"]    = "true"
        p[f"columns[{i}][orderable]"]     = "true" if orderable else "false"
        p[f"columns[{i}][search][value]"] = ""
        p[f"columns[{i}][search][regex]"] = "false"
    p["draw"]          = draw
    p["start"]         = start
    p["length"]        = length
    p["search[value]"] = ""
    p["search[regex]"] = "false"
    return p


def _pick(row: dict, keys: tuple, default="") -> str:
    for k in keys:
        if k in row and row[k] is not None:
            return str(row[k]).strip()
    return default


def _parse_na_rows(rows: list, seen: "set[str]") -> "list[dict]":
    items = []
    for row in rows:
        if not isinstance(row, dict):
            if isinstance(row, (list, tuple)) and len(row) >= 4:
                row = {
                    "symbol":        row[0],
                    "units":         row[1],
                    "opening_date":  row[2],
                    "closing_date":  row[3],
                    "issue_manager": row[4] if len(row) > 4 else "",
                    "status":        row[5] if len(row) > 5 else "",
                }
            else:
                continue

        raw_sym    = _pick(row, _NA_COMPANY)
        href_m     = re.search(r'href=["\']([^"\']+)["\']', raw_sym)
        detail_url = ""
        if href_m:
            detail_url = href_m.group(1)
            if not detail_url.startswith("http"):
                detail_url = "https://nepsealpha.com" + detail_url
        company = clean(raw_sym)
        if not company or len(company) < 2:
            continue

        key = company[:60].lower()
        if key in seen:
            continue
        seen.add(key)

        open_d  = norm_date(_pick(row, _NA_OPEN))
        close_d = norm_date(_pick(row, _NA_CLOSE))
        status  = _pick(row, _NA_STATUS)

        type_m   = re.search(r"\((Public|Local|Nepalese Working Abroad|NRN)\)", company, re.I)
        ipo_type = type_m.group(1) if type_m else "IPO"

        items.append({
            "company":       company,
            "type":          ipo_type,
            "open_date":     open_d,
            "close_date":    close_d,
            "units":         _pick(row, _NA_UNITS),
            "price":         "",
            "issue_manager": _pick(row, _NA_MANAGER),
            "status":        status,
            "description":   "",
            "url":           detail_url or "https://nepsealpha.com/investment-calandar/ipo",
            "source":        "NepseAlpha",
        })
    return items


def scrape_nepsealpha(session: requests.Session, seen: "set[str]") -> "list[dict]":
    print("  [NepseAlpha] IPO calendar (Playwright)…", end="", flush=True)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(" SKIPPED — run: pip install playwright && playwright install chromium")
        return []

    items      = []
    page_size  = 100
    start      = 0
    total      = None

    NA_URL = "https://nepsealpha.com/investment-calandar/ipo"

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/148.0.0.0 Safari/537.36"
            )
        )

        # Inject saved cookies so Cloudflare accepts us
        context.add_cookies([
            {
                "name":   "cf_clearance",
                "value":  CF_CLEARANCE,
                "domain": "nepsealpha.com",
                "path":   "/",
            },
            {
                "name":   "nepsealpha_session",
                "value":  NA_SESSION,
                "domain": "nepsealpha.com",
                "path":   "/",
            },
        ])

        page = context.new_page()

        # Load the page once so Cloudflare can set any extra cookies it needs
        try:
            page.goto(NA_URL, wait_until="networkidle", timeout=30_000)
        except Exception as e:
            print(f" page load warning ({e}) — continuing anyway")

        # Now hit the DataTables AJAX endpoint page-by-page
        while True:
            params = _na_params(
                draw   = (start // page_size) + 1,
                start  = start,
                length = page_size,
            )
            qs = "&".join(f"{k}={v}" for k, v in params.items())
            ajax_url = f"{NA_URL}?{qs}"

            try:
                response = page.evaluate(
                    """async (url) => {
                        const r = await fetch(url, {
                            headers: {
                                "X-Requested-With": "XMLHttpRequest",
                                "Accept": "application/json, text/javascript, */*; q=0.01",
                            },
                            credentials: "include",
                        });
                        if (!r.ok) return { __status: r.status };
                        return r.json();
                    }""",
                    ajax_url,
                )
            except Exception as e:
                print(f" fetch error ({e})")
                break

            if isinstance(response, dict) and "__status" in response:
                status_code = response["__status"]
                print(f"\n  [NepseAlpha] HTTP {status_code} from AJAX call.")
                if status_code == 403:
                    print("  ► Cookies may have expired — re-copy from Chrome DevTools.")
                break

            if isinstance(response, dict):
                rows  = response.get("data", response.get("Data", []))
                total = response.get("recordsTotal", response.get("recordsFiltered", total))
            elif isinstance(response, list):
                rows  = response
                total = total or len(response)
            else:
                print(" Unexpected JSON shape")
                break

            batch = _parse_na_rows(rows, seen)
            items.extend(batch)

            start += len(rows)
            if not rows or (total is not None and start >= total) or start >= MAX_ITEMS_PER_SOURCE:
                break

            time.sleep(0.3)

        browser.close()

    print(f" {len(items)} items")
    time.sleep(POLITE_DELAY)
    return items


# ══════════════════════════════════════════════════════════════════════════════
# Source 3 — SEBON Approved IPO (local PDF)
# ══════════════════════════════════════════════════════════════════════════════
SEBON_PDF_PATH = "SEBON_IPO.pdf"

# PDF column layout (0-indexed):
#  0: S.N.  1: Company  2: Sector  3: From  4: To  5: No. of Shares
#  6: Rate  7: Amount   8: Public Issue %  9: Promoter Shares
# 10: Promoter %  11: Issue Manager  12: Date of Approval (BS)

# ── BS → AD conversion ───────────────────────────────────────────────────────
# Each entry is (BS_year, month_offsets_from_Jan):
# _BS_AD_OFFSET[year] = the AD year that BS year starts in (mid-April)
# Simpler approach: lookup table for BS year → AD year offset per month.
# BS month 1 (Baisakh) starts ~Apr 14 of that AD year.
# BS month 12 (Chaitra) ends ~Apr 13 of AD year+1.
_BS_MONTH_TO_AD_MONTH = {
    1:  (4,  14),   # Baisakh  → ~Apr 14
    2:  (5,  15),   # Jestha   → ~May 15
    3:  (6,  15),   # Ashadh   → ~Jun 15
    4:  (7,  16),   # Shrawan  → ~Jul 16
    5:  (8,  17),   # Bhadra   → ~Aug 17
    6:  (9,  17),   # Ashwin   → ~Sep 17
    7:  (10, 18),   # Kartik   → ~Oct 18
    8:  (11, 17),   # Mangsir  → ~Nov 17
    9:  (12, 16),   # Poush    → ~Dec 16
    10: (1,  15),   # Magh     → ~Jan 15  (AD year +1)
    11: (2,  13),   # Falgun   → ~Feb 13  (AD year +1)
    12: (3,  14),   # Chaitra  → ~Mar 14  (AD year +1)
}

def bs_to_ad(bs_date_str: str) -> str:
    """
    Convert a BS date string like '2082/04/12' to an approximate AD date 'YYYY-MM-DD'.
    Uses a fixed offset table (accurate to ±1 day for most dates).
    Returns the original string unchanged if it cannot be parsed.
    """
    # Strip anything after a comma (e.g. "2082/10/18, 2082/11/17 (Re-approved)")
    bs_date_str = bs_date_str.split(",")[0].strip()
    bs_date_str = re.sub(r"\s*\(.*?\)", "", bs_date_str).strip()

    m = re.match(r"(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})", bs_date_str)
    if not m:
        return bs_date_str

    bs_year, bs_month, bs_day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if bs_month not in _BS_MONTH_TO_AD_MONTH:
        return bs_date_str

    ad_month, month_start_day = _BS_MONTH_TO_AD_MONTH[bs_month]
    # BS year 2082 corresponds to AD 2025/2026
    ad_year = bs_year - 57 if bs_month >= 10 else bs_year - 56

    # Approximate AD day: offset from the BS month's start day in AD calendar
    ad_day = month_start_day + (bs_day - 1)

    # Handle month overflow (rough — nudge into next month if needed)
    try:
        dt = datetime(ad_year, ad_month, 1)
        days_in_month = calendar.monthrange(ad_year, ad_month)[1]
        if ad_day > days_in_month:
            ad_day -= days_in_month
            ad_month += 1
            if ad_month > 12:
                ad_month = 1
                ad_year += 1
        return f"{ad_year:04d}-{ad_month:02d}-{ad_day:02d}"
    except ValueError:
        return bs_date_str


def scrape_sebon_pdf(session: requests.Session, seen: "set[str]") -> "list[dict]":
    try:
        pdfplumber = importlib.import_module("pdfplumber")
    except ModuleNotFoundError:
        print("  [SEBON PDF] SKIPPED — run: python -m pip install pdfplumber")
        return []

    if not os.path.exists(SEBON_PDF_PATH):
        print(f"  [SEBON PDF] SKIPPED — '{SEBON_PDF_PATH}' not found in current directory.")
        return []

    print(f"  [SEBON PDF] Reading {SEBON_PDF_PATH}…", end="", flush=True)

    items = []
    try:
        with pdfplumber.open(SEBON_PDF_PATH) as pdf:
            for page in pdf.pages:
                table = page.extract_table()
                if not table:
                    continue

                for row in table:
                    if not row:
                        continue
                    cells = [clean(str(c or "")) for c in row]

                    def cel(i, default=""):
                        return cells[i].strip() if i < len(cells) else default

                    # col 0 = S.N. (skip header/total rows), col 1 = company name
                    sn      = cel(0)
                    company = cel(1)

                    # Skip header rows, total row, and blank rows
                    if not sn.isdigit():
                        continue
                    if not company or len(company) < 3:
                        continue
                    low = company.lower()
                    if low in ("name of company", "company", "name", "total"):
                        continue

                    key = company[:60].lower()
                    if key in seen:
                        continue
                    seen.add(key)

                    # col 2: Sector, col 5: No. of Shares (public issue size)
                    # col 6: Rate/Price (always 100), col 13: Issue Manager
                    # col 14: Date of Approval (BS) — convert to AD
                    raw_approval = cel(14)
                    approval_ad  = bs_to_ad(raw_approval) if raw_approval else ""

                    items.append({
                        "company":          company,
                        "type":             "IPO",
                        "sector":           cel(2),
                        "open_date":        "",
                        "close_date":       "",
                        "units":            cel(5),
                        "price":            cel(6),
                        "issue_manager":    cel(13),
                        "approval_date_bs": raw_approval,
                        "approval_date_ad": approval_ad,
                        "status":           "Approved",
                        "description":      "",
                        "url":              SEBON_PDF_PATH,
                        "source":           "SEBON",
                    })

                if len(items) >= MAX_ITEMS_PER_SOURCE:
                    break

    except Exception as e:
        print(f" FAILED ({e})")
        return []

    print(f" {len(items)} items")
    time.sleep(POLITE_DELAY)
    return items


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  NEPSE IPO Scraper  v4.0")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    session = requests.Session()
    session.headers.update(HEADERS)

    seen: "set[str]" = set()
    all_items: "list[dict]" = []

    print("\n── Source 1: Merolagani · Upcoming IPOs ──────────────────")
    all_items += scrape_merolagani(session, seen)

    print("\n── Source 2: NepseAlpha · IPO Calendar ───────────────────")
    all_items += scrape_nepsealpha(session, seen)

    print("\n── Source 3: SEBON · Approved IPO PDF ────────────────────")
    all_items += scrape_sebon_pdf(session, seen)

    # Sort: dated items newest first, undated last
    all_items.sort(key=lambda x: x.get("open_date") or "0000", reverse=True)

    by_source: "dict[str,int]" = {}
    by_type:   "dict[str,int]" = {}
    for it in all_items:
        by_source[it["source"]] = by_source.get(it["source"], 0) + 1
        by_type[it["type"]]     = by_type.get(it["type"], 0) + 1

    output = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "item_count": len(all_items),
        "items":      all_items,
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"  Total unique items : {len(all_items)}")
    print("  By source:")
    for src, n in sorted(by_source.items()):
        print(f"    {src:<20} {n}")
    print("  By type:")
    for typ, n in sorted(by_type.items()):
        print(f"    {typ:<20} {n}")
    print(f"\n  Saved → {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
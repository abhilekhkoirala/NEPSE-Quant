# NEPSE Trading Bot

A quantitative research platform for the Nepal Stock Exchange (NEPSE) that combines topological data analysis, ensemble signal generation, regime detection, and portfolio optimization into a single, cohesive application.

---

## Overview

NEPSE Trading Bot is a full-stack quantitative research tool designed for systematic analysis of the Nepal Stock Exchange. It moves beyond simple price charts by applying persistent homology (topological data analysis) to correlation structures, generating ensemble signals from multi-window graph diffusion, and dynamically detecting market regimes. All computation runs server-side, with a clean React frontend for visualization and interaction.

The platform includes:

- A topological market regime classifier (persistent homology β₁)
- Ensemble signal generation (multi-window Laplacian diffusion)
- Walk-forward backtesting with drawdown shields and volatility scaling
- Portfolio optimization, cash allocation, and rebalancing tools
- IPO scoring against current market conditions
- News sentiment integration (per-ticker and market-wide)
- Gemini-powered AI analyst with system-context assembly
- Scheduled daily data scraping (4 PM NPT)

---

## Architecture
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (React/Vite) │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Navigation │ Dashboard │ Tab Content (9 views) │ │
│ └──────────────────────────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ API Client (lib/api) │ │
│ └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
│
▼ HTTP/JSON
┌─────────────────────────────────────────────────────────────────┐
│ Backend (Node/Express) │
│ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ API Layer │ │
│ │ /stocks │ /signals │ /regime │ /backtests │ │
│ │ /portfolio │ /news │ /ipos │ /ai │ │
│ └────────────────────────────────────────────────────────┘ │
│ │ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Services Layer │ │
│ │ pipeline │ data │ portfolio │ news │ ipo │ gemini │ │
│ └────────────────────────────────────────────────────────┘ │
│ │ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Quant Engine │ │
│ │ correlation │ signals │ regime │ backtest │ │
│ │ portfolioWeights │ costs │ projections │ ipoScoring │ │
│ └────────────────────────────────────────────────────────┘ │
│ │ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Data Layer │ │
│ │ CSV/JSON files │ externalFetch (merolagani) │ │
│ └────────────────────────────────────────────────────────┘ │
│ │ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Python Scrapers │ │
│ │ scrape_nepse.py (prices) │ scrape_news.py │ scrape_ipo.py │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘


---

## Key Features

### Market Regime Detection

The platform uses persistent homology (β₁ cycles in the correlation graph) to classify market structure into four regimes:

| Regime | Description |
|--------|-------------|
| Calm | Low correlation, normal volatility |
| Stress | Elevated correlation, increased volatility |
| Crisis | High correlation, extreme volatility |
| Fragmented | Disconnected correlation structure |

The regime classifier combines four features: integration speed (ε), cycle birth (β₁), average pairwise correlation, and realised volatility. A scoring system (0–4 points per feature) ensures partial signals still register.

### Ensemble Signal

Signals are generated from a multi-window ensemble approach:

1. **Topological component** (45%): Graph-Laplacian diffusion on EWMA correlation matrices at 10-day, 30-day, and 90-day windows
2. **Adaptive component** (35%): Momentum in calm regimes, mean-reversion in stressed regimes
3. **Short-term reversion** (20%): 5-day reversal signal

The blended signal is re-normalised and filtered through quality (skew/volatility), liquidity (trading activity), and low-cap (price-based) filters.

### Walk-Forward Backtest

The backtest engine evaluates strategy performance out-of-sample with:

- **Regime-gated position scaling**: Calm (1.0x), Stress (0.9x), Crisis (0.3x)
- **Drawdown shield**: Progressive scaling at 26%, 47%, 74%, and 100% of the drawdown floor
- **Vol-spike kill switch**: Reduces exposure when 10-day vol exceeds 1.4x or 1.8x long-term vol
- **Per-stock stop-loss**: Exits positions that fall beyond the configured threshold
- **Transaction costs**: Tiered broker commission (0.24–0.36%) + SEBON fee (0.015%) + NEPSE fee (20% of broker) + DP charge (Rs. 25)

### Portfolio Tools

| Tool | Description |
|------|-------------|
| Optimal Holdings | Target allocation from current signal weights, floored to whole shares |
| Cash Allocator | Deploys fresh cash across top-N signals with momentum blend and risk-mode concentration caps |
| Bridge Trades | Diffs current holdings against model targets with estimated NEPSE transaction costs |

### IPO Scoring

Each IPO/FPO listing receives a 0–100 score based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Sector Alignment | 0–40 | Average ensemble signal of listed peers in the same sector |
| Market Regime | 0–30 | Calm=30, Fragmented=22, Stress=12, Crisis=4 |
| Timing / Status | 0–20 | Open=20, Upcoming=14, Allotment=8, Closed=0 |
| Issue Type | 0–10 | IPO/Ordinary=10, FPO=8, Debenture=6, Rights=5 |

### News Sentiment Integration

News flow affects the system in two ways:

1. **Per-ticker overlay**: Sentiment from recent headlines adjusts the blended signal by up to +12% (positive) or -25% (negative)
2. **Market-wide scale**: When negative news exceeds thresholds (40% -> stress, 60% -> crisis), position sizes are scaled down (0.75x or 0.45x)

### AI Analyst

The Gemini-powered assistant receives structured system context from the backend (quant metrics, regime, and recent news headlines) and the user's chat history. The API key never leaves the server.

---

## Data Pipeline

Three Python scrapers collect data on a daily schedule:

| Scraper | Source | Frequency | Output |
|---------|--------|-----------|--------|
| scrape_nepse.py | Merolagani API | Daily (4 PM NPT) | nepse_prices.csv, nepse_sectors.csv |
| scrape_news.py | Google RSS, Merolagani, Sharesansar, NRB | On-demand | nepse_news.json |
| scrape_ipo.py | Merolagani, NepseAlpha, SEBON PDF | On-demand | ipo_data.json |

The price scraper fetches the full company list from Merolagani (approx. 1,630 tickers), applies liquidity filters (≥400 trading days, ≥45% coverage), and retains the most liquid 300 stocks plus any portfolio holdings.

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/stocks | GET | Ticker universe with latest prices and signals |
| /api/stocks/refresh | POST | Trigger price data scrape |
| /api/signals | GET | Ranked ensemble signals with delta tracking |
| /api/regime | GET | Current regime, correlation matrix, terrain geometry |
| /api/regime/history | GET | Rolling regime series over time |
| /api/backtests | POST | Run the full quant pipeline |
| /api/backtests/current | GET | Last computed pipeline result |
| /api/portfolio/holdings | GET | Current portfolio with pricing and signals |
| /api/portfolio/upload | POST | Upload portfolio CSV |
| /api/portfolio/optimal-holdings | GET | Target allocation from current signals |
| /api/portfolio/cash-allocation | POST | Deploy cash across top-N signals |
| /api/portfolio/bridge-trades | GET | Rebalancing diff with cost estimates |
| /api/news | GET | Scraped news feed |
| /api/ipos | GET | IPO pipeline with scores |
| /api/ai/analyze | POST | Gemini AI analyst query |

---

## Setup

### Prerequisites

- Node.js 20.6+
- Python 3 with requests, pandas, beautifulsoup4, pdfplumber, playwright

### Installation

```bash
git clone <repository>
cd NEPSE_trading_bot

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# Python scrapers (optional, for data collection)
cd ../backend/scrapers
pip install -r requirements.txt
playwright install chromium
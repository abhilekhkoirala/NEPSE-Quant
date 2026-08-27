FROM node:20-slim

# System deps: Python for the scrapers, plus everything Playwright needs
# to run headless Chromium (used as a fallback source in scrape_ipo.py).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Node deps ---
COPY package*.json ./
RUN npm ci --omit=dev

# --- Python deps ---
COPY scrapers/requirements.txt ./scrapers/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r scrapers/requirements.txt \
    && python3 -m playwright install --with-deps chromium

# --- App source ---
COPY . .

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]

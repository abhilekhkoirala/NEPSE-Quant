import { get, post } from "./client.js";
const stocksApi = {
  getStocks: () => get("/api/stocks"),
  getStock: ticker => get(`/api/stocks/${ticker}`),
  getHistory: ticker => get(`/api/stocks/${ticker}/history`),
  getFundamentals: ticker => get(`/api/stocks/${ticker}/fundamentals`),
  refresh: () => post("/api/stocks/refresh"),
  refreshStatus: () => get("/api/stocks/refresh-status"),
};
export default stocksApi;

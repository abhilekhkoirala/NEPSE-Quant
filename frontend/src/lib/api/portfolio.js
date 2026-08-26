import { get, post } from "./client.js";
const portfolioApi = {
  getHoldings: () => get("/api/portfolio/holdings"),
  upload: csv => post("/api/portfolio/upload", { csv }),
  getOptimalHoldings: () => get("/api/portfolio/optimal-holdings"),
  getCashAllocation: (cash, topN, riskMode) => post("/api/portfolio/cash-allocation", { cash, topN, riskMode }),
  getBridgeTrades: () => get("/api/portfolio/bridge-trades"),
};
export default portfolioApi;

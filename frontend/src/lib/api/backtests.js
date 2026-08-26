import { get, post } from "./client.js";
const backtestsApi = {
  run: params => post("/api/backtests", { params }),
  getCurrent: () => get("/api/backtests/current"),
  getRiskBand: () => get("/api/backtests/current/risk-band"),
};
export default backtestsApi;

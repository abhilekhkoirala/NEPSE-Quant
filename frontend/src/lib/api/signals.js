import { get } from "./client.js";
const signalsApi = {
  getSignals: () => get("/api/signals"),
  getSignal: ticker => get(`/api/signals/${ticker}`),
};
export default signalsApi;

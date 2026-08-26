import { get } from "./client.js";
const regimeApi = {
  getRegime: () => get("/api/regime"),
  getHistory: () => get("/api/regime/history"),
};
export default regimeApi;

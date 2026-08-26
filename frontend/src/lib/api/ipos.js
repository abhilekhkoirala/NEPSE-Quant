import { get, post } from "./client.js";
const iposApi = {
  getIpos: () => get("/api/ipos"),
  getIpo: id => get(`/api/ipos/${id}`),
  refresh: () => post("/api/ipos/refresh"),
  getStatus: () => get("/api/ipos/status"),
  scrape: () => post("/api/ipos/scrape"),
};
export default iposApi;

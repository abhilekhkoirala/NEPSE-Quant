import { post } from "./client.js";
const aiApi = {
  analyze: history => post("/api/ai/analyze", { history }),
};
export default aiApi;

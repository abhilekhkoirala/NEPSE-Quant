import { get } from "./client.js";
const newsApi = {
  getNews: () => get("/api/news"),
  getSentiment: () => get("/api/news/sentiment"),
};
export default newsApi;

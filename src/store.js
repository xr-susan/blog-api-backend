import { HttpError } from "./http.js";
import { JsonBlogStore } from "./stores/json-store.js";
import { PostgresBlogStore } from "./stores/postgres-store.js";
import { SqliteBlogStore } from "./stores/sqlite-store.js";

export async function createStore(config) {
  const storage = config.storage.toLowerCase();

  if (storage === "json") {
    return new JsonBlogStore(config.dataFile);
  }

  if (storage === "sqlite") {
    const store = new SqliteBlogStore(config.sqliteFile);
    await store.ready();
    return store;
  }

  if (storage === "postgres") {
    const store = new PostgresBlogStore(config.databaseUrl);
    await store.ready();
    return store;
  }

  throw new HttpError(500, `Unsupported storage driver: ${config.storage}`);
}

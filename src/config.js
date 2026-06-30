import { resolve } from "node:path";

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    adminToken: env.BLOG_ADMIN_TOKEN || "",
    dataFile: resolve(env.BLOG_DATA_FILE || "./data/blog.json")
  };
}

import { resolve } from "node:path";

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    storage: env.BLOG_STORAGE || "sqlite",
    authSecret: env.BLOG_AUTH_SECRET || env.BLOG_ADMIN_TOKEN || "",
    adminEmail: env.BLOG_ADMIN_EMAIL || "admin@example.com",
    adminPassword: env.BLOG_ADMIN_PASSWORD || "",
    adminToken: env.BLOG_ADMIN_TOKEN || "",
    dataFile: resolve(env.BLOG_DATA_FILE || "./data/blog.json"),
    sqliteFile: resolve(env.BLOG_SQLITE_FILE || "./data/blog.sqlite"),
    databaseUrl: env.DATABASE_URL || "",
    logLevel: env.BLOG_LOG_LEVEL || "info"
  };
}

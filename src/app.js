import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createAuth } from "./auth.js";
import { createRequestLogger } from "./logger.js";
import { createStore } from "./store.js";
import { HttpError, readJson, requireAdmin, routeKey, sendJson, sendText } from "./http.js";
import {
  optionalString,
  readCommentStatus,
  readPostStatus,
  readTags,
  requireString,
  slugify
} from "./validation.js";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const OPENAPI_PATH = join(CURRENT_DIR, "..", "docs", "openapi.yaml");

export async function createApp(config) {
  const store = await createStore(config);
  const auth = createAuth(config);
  const logger = createRequestLogger(config);
  let server;

  server = createServer(async (req, res) => {
    const startedAt = process.hrtime.bigint();
    const url = new URL(req.url, "http://localhost");

    res.on("finish", () => logger(req, res, startedAt, url));

    try {
      await handleRequest({ req, res, url, store, auth });
    } catch (error) {
      handleError(res, error);
    }
  });

  server.on("close", () => {
    Promise.resolve(store.close?.()).catch((error) => {
      console.error(error);
    });
  });

  return server;
}

async function handleRequest(context) {
  const { req, res, url, store, auth } = context;
  const key = routeKey(req.method, url.pathname);

  if (key === "GET /health") {
    return sendJson(res, 200, { status: "ok" });
  }

  if (key === "GET /openapi.yaml") {
    const spec = await readFile(OPENAPI_PATH, "utf8");
    return sendText(res, 200, spec, "application/yaml; charset=utf-8");
  }

  if (key === "POST /v1/auth/login") {
    const body = await readJson(req);
    const token = auth.login(requireString(body, "email", 180), requireString(body, "password", 180));
    return sendJson(res, 200, {
      data: {
        token,
        tokenType: "Bearer"
      }
    });
  }

  if (key === "GET /v1/posts") {
    const filters = Object.fromEntries(url.searchParams);
    filters.status = filters.status || "published";

    if (filters.status !== "published") {
      requireAdmin(req, auth);
    }

    const result = await store.listPosts(filters);
    return sendJson(res, 200, result);
  }

  if (key === "POST /v1/posts") {
    requireAdmin(req, auth);
    const post = await store.createPost(readPostPayload(await readJson(req), true));
    return sendJson(res, 201, { data: post });
  }

  const postMatch = url.pathname.match(/^\/v1\/posts\/([a-z0-9-]+)$/);
  if (postMatch && req.method === "GET") {
    const post = await store.getPost(postMatch[1]);
    if (post.status !== "published") {
      requireAdmin(req, auth);
    }
    return sendJson(res, 200, { data: post });
  }

  if (postMatch && req.method === "PATCH") {
    requireAdmin(req, auth);
    const post = await store.updatePost(postMatch[1], readPostPayload(await readJson(req), false));
    return sendJson(res, 200, { data: post });
  }

  if (postMatch && req.method === "DELETE") {
    requireAdmin(req, auth);
    await store.deletePost(postMatch[1]);
    res.writeHead(204);
    return res.end();
  }

  const commentsMatch = url.pathname.match(/^\/v1\/posts\/([a-z0-9-]+)\/comments$/);
  if (commentsMatch && req.method === "GET") {
    const includePending = url.searchParams.get("includePending") === "true";
    if (includePending) {
      requireAdmin(req, auth);
    }
    const comments = await store.listComments(commentsMatch[1], includePending);
    return sendJson(res, 200, { data: comments });
  }

  if (commentsMatch && req.method === "POST") {
    const comment = await store.createComment(commentsMatch[1], readCommentPayload(await readJson(req)));
    return sendJson(res, 201, { data: comment });
  }

  const moderationMatch = url.pathname.match(/^\/v1\/comments\/([a-f0-9-]+)\/moderation$/);
  if (moderationMatch && req.method === "PATCH") {
    requireAdmin(req, auth);
    const body = await readJson(req);
    const comment = await store.moderateComment(moderationMatch[1], readCommentStatus(body.status));
    return sendJson(res, 200, { data: comment });
  }

  throw new HttpError(404, "Route not found.");
}

function readPostPayload(body, creating) {
  const payload = {};

  if (creating || body.title != null) {
    payload.title = requireString(body, "title", 140);
  }

  if (creating || body.content != null) {
    payload.content = requireString(body, "content", 50000);
  }

  if (creating || body.excerpt != null) {
    payload.excerpt = optionalString(body, "excerpt", 280);
  }

  if (creating || body.tags != null) {
    payload.tags = readTags(body);
  }

  if (creating || body.status != null) {
    payload.status = readPostStatus(body.status || "draft");
  }

  if (creating && body.slug != null) {
    payload.slug = slugify(body.slug);
  }

  return payload;
}

function readCommentPayload(body) {
  return {
    authorName: requireString(body, "authorName", 80),
    authorEmail: optionalString(body, "authorEmail", 180),
    content: requireString(body, "content", 2000)
  };
}

function handleError(res, error) {
  if (error instanceof HttpError) {
    return sendJson(res, error.status, {
      error: {
        message: error.message,
        details: error.details
      }
    });
  }

  console.error(error);
  return sendJson(res, 500, {
    error: {
      message: "Unexpected server error."
    }
  });
}

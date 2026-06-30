import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../src/app.js";

describe("Blog API", () => {
  let server;
  let baseUrl;
  let tempDir;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "blog-api-"));
    server = await createApp({
      port: 0,
      storage: "json",
      adminToken: "test-token",
      authSecret: "test-secret",
      adminEmail: "admin@example.com",
      adminPassword: "secret-password",
      logLevel: "silent",
      dataFile: join(tempDir, "blog.json")
    });

    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates, lists, and reads a published post", async () => {
    const created = await request("/v1/posts", {
      method: "POST",
      token: true,
      body: {
        title: "A Useful First Post",
        excerpt: "A short intro.",
        content: "Start small, document well, and keep the API pleasant.",
        tags: ["Node", "API"],
        status: "published"
      }
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.slug, "a-useful-first-post");

    const list = await request("/v1/posts?status=published&tag=node");
    assert.equal(list.status, 200);
    assert.equal(list.body.meta.total, 1);

    const detail = await request("/v1/posts/a-useful-first-post");
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.title, "A Useful First Post");
  });

  it("keeps comments pending until moderation", async () => {
    const pending = await request("/v1/posts/a-useful-first-post/comments", {
      method: "POST",
      body: {
        authorName: "Reader",
        authorEmail: "reader@example.com",
        content: "This helped me ship faster."
      }
    });

    assert.equal(pending.status, 201);

    const publicComments = await request("/v1/posts/a-useful-first-post/comments");
    assert.equal(publicComments.body.data.length, 0);

    const approved = await request(`/v1/comments/${pending.body.data.id}/moderation`, {
      method: "PATCH",
      token: true,
      body: { status: "approved" }
    });

    assert.equal(approved.body.data.status, "approved");

    const visibleComments = await request("/v1/posts/a-useful-first-post/comments");
    assert.equal(visibleComments.body.data.length, 1);
  });

  it("rejects admin writes without a token", async () => {
    const response = await request("/v1/posts", {
      method: "POST",
      body: {
        title: "No Token",
        content: "This should not be accepted."
      }
    });

    assert.equal(response.status, 401);
  });

  it("issues a short-lived admin token after login", async () => {
    const login = await request("/v1/auth/login", {
      method: "POST",
      body: {
        email: "admin@example.com",
        password: "secret-password"
      }
    });

    assert.equal(login.status, 200);
    assert.match(login.body.data.token, /^[^.]+\.[^.]+\.[^.]+$/);

    const created = await request("/v1/posts", {
      method: "POST",
      token: login.body.data.token,
      body: {
        title: "JWT Protected Post",
        content: "Created with a login-issued bearer token.",
        status: "published"
      }
    });

    assert.equal(created.status, 201);
  });

  it("keeps drafts private unless an admin token is provided", async () => {
    await request("/v1/posts", {
      method: "POST",
      token: true,
      body: {
        title: "Private Draft",
        content: "Not ready yet.",
        status: "draft"
      }
    });

    const publicList = await request("/v1/posts");
    assert.equal(publicList.body.data.some((post) => post.slug === "private-draft"), false);

    const publicDetail = await request("/v1/posts/private-draft");
    assert.equal(publicDetail.status, 401);

    const adminDetail = await request("/v1/posts/private-draft", { token: true });
    assert.equal(adminDetail.status, 200);
  });

  async function request(path, options = {}) {
    const headers = {
      "content-type": "application/json"
    };

    if (options.token) {
      headers.authorization = `Bearer ${options.token === true ? "test-token" : options.token}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null
    };
  }
});

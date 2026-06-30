import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../src/store.js";

describe("SQLite storage", () => {
  let tempDir;
  let store;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "blog-sqlite-"));
    store = await createStore({
      storage: "sqlite",
      sqliteFile: join(tempDir, "blog.sqlite")
    });
  });

  after(async () => {
    await store.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persists posts and comments through the shared store contract", async () => {
    const post = await store.createPost({
      title: "SQLite Backed Post",
      excerpt: "",
      content: "A real database is useful even in a small project.",
      tags: ["sqlite"],
      status: "published"
    });

    const comment = await store.createComment(post.slug, {
      authorName: "Reader",
      authorEmail: "",
      content: "Nice upgrade."
    });

    await store.moderateComment(comment.id, "approved");

    const posts = await store.listPosts({ status: "published", tag: "sqlite" });
    const comments = await store.listComments(post.slug);

    assert.equal(posts.meta.total, 1);
    assert.equal(comments.length, 1);
  });
});

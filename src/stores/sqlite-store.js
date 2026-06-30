import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { HttpError } from "../http.js";
import { slugify } from "../validation.js";
import { paginate, uniqueSlug } from "./json-store.js";

export class SqliteBlogStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.db = null;
  }

  async ready() {
    await mkdir(dirname(this.filePath), { recursive: true });
    this.db = new DatabaseSync(this.filePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        excerpt TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_slug TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_email TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (post_slug) REFERENCES posts(slug) ON DELETE CASCADE
      );
    `);
  }

  async close() {
    this.db?.close();
  }

  async listPosts(filters = {}) {
    let sql = "SELECT * FROM posts";
    const conditions = [];
    const params = {};

    if (filters.status) {
      conditions.push("status = $status");
      params.$status = filters.status;
    }

    if (filters.tag) {
      conditions.push("LOWER(tags) LIKE $tag");
      params.$tag = `%"${filters.tag.toLowerCase()}"%`;
    }

    if (filters.q) {
      conditions.push("(LOWER(title) LIKE $q OR LOWER(excerpt) LIKE $q OR LOWER(content) LIKE $q)");
      params.$q = `%${filters.q.toLowerCase()}%`;
    }

    if (conditions.length) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += " ORDER BY updated_at DESC";

    const posts = this.db.prepare(sql).all(params).map(rowToPost);
    return paginate(posts, filters);
  }

  async getPost(slug) {
    const row = this.db.prepare("SELECT * FROM posts WHERE slug = ?").get(slug);

    if (!row) {
      throw new HttpError(404, "Post not found.");
    }

    return rowToPost(row);
  }

  async createPost(input) {
    const posts = this.db.prepare("SELECT slug FROM posts").all();
    const now = new Date().toISOString();
    const slug = uniqueSlug(posts, input.slug || slugify(input.title));
    const post = {
      id: randomUUID(),
      title: input.title,
      slug,
      excerpt: input.excerpt,
      content: input.content,
      tags: input.tags,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      publishedAt: input.status === "published" ? now : null
    };

    this.db
      .prepare(`
        INSERT INTO posts
          (id, title, slug, excerpt, content, tags, status, created_at, updated_at, published_at)
        VALUES
          ($id, $title, $slug, $excerpt, $content, $tags, $status, $createdAt, $updatedAt, $publishedAt)
      `)
      .run(toSqlPost(post));

    return post;
  }

  async updatePost(slug, input) {
    const post = await this.getPost(slug);
    const wasPublished = post.status === "published";
    Object.assign(post, input, { updatedAt: new Date().toISOString() });

    if (!wasPublished && post.status === "published") {
      post.publishedAt = post.updatedAt;
    }

    this.db
      .prepare(`
        UPDATE posts
        SET title = $title,
            excerpt = $excerpt,
            content = $content,
            tags = $tags,
            status = $status,
            updated_at = $updatedAt,
            published_at = $publishedAt
        WHERE slug = $slug
      `)
      .run(toSqlPost(post));

    return post;
  }

  async deletePost(slug) {
    const result = this.db.prepare("DELETE FROM posts WHERE slug = ?").run(slug);
    this.db.prepare("DELETE FROM comments WHERE post_slug = ?").run(slug);

    if (result.changes === 0) {
      throw new HttpError(404, "Post not found.");
    }
  }

  async listComments(postSlug, includePending = false) {
    await this.getPost(postSlug);
    const sql = includePending
      ? "SELECT * FROM comments WHERE post_slug = ? ORDER BY created_at ASC"
      : "SELECT * FROM comments WHERE post_slug = ? AND status = 'approved' ORDER BY created_at ASC";

    return this.db.prepare(sql).all(postSlug).map(rowToComment);
  }

  async createComment(postSlug, input) {
    await this.getPost(postSlug);
    const now = new Date().toISOString();
    const comment = {
      id: randomUUID(),
      postSlug,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      content: input.content,
      status: "pending",
      createdAt: now,
      updatedAt: now
    };

    this.db
      .prepare(`
        INSERT INTO comments
          (id, post_slug, author_name, author_email, content, status, created_at, updated_at)
        VALUES
          ($id, $postSlug, $authorName, $authorEmail, $content, $status, $createdAt, $updatedAt)
      `)
      .run(toSqlComment(comment));

    return comment;
  }

  async moderateComment(id, status) {
    const row = this.db.prepare("SELECT * FROM comments WHERE id = ?").get(id);

    if (!row) {
      throw new HttpError(404, "Comment not found.");
    }

    const comment = rowToComment(row);
    comment.status = status;
    comment.updatedAt = new Date().toISOString();

    this.db
      .prepare("UPDATE comments SET status = $status, updated_at = $updatedAt WHERE id = $id")
      .run({
        $id: comment.id,
        $status: comment.status,
        $updatedAt: comment.updatedAt
      });

    return comment;
  }
}

function rowToPost(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    tags: JSON.parse(row.tags),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at
  };
}

function rowToComment(row) {
  return {
    id: row.id,
    postSlug: row.post_slug,
    authorName: row.author_name,
    authorEmail: row.author_email,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSqlPost(post) {
  return {
    $id: post.id,
    $title: post.title,
    $slug: post.slug,
    $excerpt: post.excerpt,
    $content: post.content,
    $tags: JSON.stringify(post.tags),
    $status: post.status,
    $createdAt: post.createdAt,
    $updatedAt: post.updatedAt,
    $publishedAt: post.publishedAt
  };
}

function toSqlComment(comment) {
  return {
    $id: comment.id,
    $postSlug: comment.postSlug,
    $authorName: comment.authorName,
    $authorEmail: comment.authorEmail,
    $content: comment.content,
    $status: comment.status,
    $createdAt: comment.createdAt,
    $updatedAt: comment.updatedAt
  };
}

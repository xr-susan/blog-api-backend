import { randomUUID } from "node:crypto";
import { HttpError } from "../http.js";
import { slugify } from "../validation.js";
import { paginate, uniqueSlug } from "./json-store.js";

export class PostgresBlogStore {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl;
    this.pool = null;
  }

  async ready() {
    if (!this.databaseUrl) {
      throw new HttpError(503, "DATABASE_URL is required when BLOG_STORAGE=postgres.");
    }

    let pg;
    try {
      pg = await import("pg");
    } catch {
      throw new HttpError(503, "Install the optional pg package before using PostgreSQL storage.");
    }

    const Pool = pg.Pool || pg.default?.Pool;
    this.pool = new Pool({ connectionString: this.databaseUrl });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        excerpt TEXT NOT NULL,
        content TEXT NOT NULL,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        published_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_slug TEXT NOT NULL REFERENCES posts(slug) ON DELETE CASCADE,
        author_name TEXT NOT NULL,
        author_email TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);
  }

  async close() {
    await this.pool?.end();
  }

  async listPosts(filters = {}) {
    const clauses = [];
    const values = [];

    if (filters.status) {
      values.push(filters.status);
      clauses.push(`status = $${values.length}`);
    }

    if (filters.tag) {
      values.push(JSON.stringify([filters.tag.toLowerCase()]));
      clauses.push(`tags @> $${values.length}::jsonb`);
    }

    if (filters.q) {
      values.push(`%${filters.q.toLowerCase()}%`);
      clauses.push(`(LOWER(title) LIKE $${values.length} OR LOWER(excerpt) LIKE $${values.length} OR LOWER(content) LIKE $${values.length})`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await this.pool.query(
      `SELECT * FROM posts ${where} ORDER BY updated_at DESC`,
      values
    );

    return paginate(result.rows.map(rowToPost), filters);
  }

  async getPost(slug) {
    const result = await this.pool.query("SELECT * FROM posts WHERE slug = $1", [slug]);

    if (result.rowCount === 0) {
      throw new HttpError(404, "Post not found.");
    }

    return rowToPost(result.rows[0]);
  }

  async createPost(input) {
    const existing = await this.pool.query("SELECT slug FROM posts");
    const now = new Date().toISOString();
    const slug = uniqueSlug(existing.rows, input.slug || slugify(input.title));
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

    await this.pool.query(
      `
        INSERT INTO posts
          (id, title, slug, excerpt, content, tags, status, created_at, updated_at, published_at)
        VALUES
          ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
      `,
      [
        post.id,
        post.title,
        post.slug,
        post.excerpt,
        post.content,
        JSON.stringify(post.tags),
        post.status,
        post.createdAt,
        post.updatedAt,
        post.publishedAt
      ]
    );

    return post;
  }

  async updatePost(slug, input) {
    const post = await this.getPost(slug);
    const wasPublished = post.status === "published";
    Object.assign(post, input, { updatedAt: new Date().toISOString() });

    if (!wasPublished && post.status === "published") {
      post.publishedAt = post.updatedAt;
    }

    await this.pool.query(
      `
        UPDATE posts
        SET title = $1,
            excerpt = $2,
            content = $3,
            tags = $4::jsonb,
            status = $5,
            updated_at = $6,
            published_at = $7
        WHERE slug = $8
      `,
      [
        post.title,
        post.excerpt,
        post.content,
        JSON.stringify(post.tags),
        post.status,
        post.updatedAt,
        post.publishedAt,
        post.slug
      ]
    );

    return post;
  }

  async deletePost(slug) {
    const result = await this.pool.query("DELETE FROM posts WHERE slug = $1", [slug]);

    if (result.rowCount === 0) {
      throw new HttpError(404, "Post not found.");
    }
  }

  async listComments(postSlug, includePending = false) {
    await this.getPost(postSlug);
    const query = includePending
      ? "SELECT * FROM comments WHERE post_slug = $1 ORDER BY created_at ASC"
      : "SELECT * FROM comments WHERE post_slug = $1 AND status = 'approved' ORDER BY created_at ASC";
    const result = await this.pool.query(query, [postSlug]);

    return result.rows.map(rowToComment);
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

    await this.pool.query(
      `
        INSERT INTO comments
          (id, post_slug, author_name, author_email, content, status, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        comment.id,
        comment.postSlug,
        comment.authorName,
        comment.authorEmail,
        comment.content,
        comment.status,
        comment.createdAt,
        comment.updatedAt
      ]
    );

    return comment;
  }

  async moderateComment(id, status) {
    const result = await this.pool.query("SELECT * FROM comments WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      throw new HttpError(404, "Comment not found.");
    }

    const comment = rowToComment(result.rows[0]);
    comment.status = status;
    comment.updatedAt = new Date().toISOString();

    await this.pool.query("UPDATE comments SET status = $1, updated_at = $2 WHERE id = $3", [
      comment.status,
      comment.updatedAt,
      comment.id
    ]);

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
    tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null
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
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

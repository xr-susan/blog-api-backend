import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { HttpError } from "../http.js";
import { slugify } from "../validation.js";

const EMPTY_STATE = {
  posts: [],
  comments: []
};

export class JsonBlogStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async listPosts(filters = {}) {
    const state = await this.#read();
    return paginate(filterPosts(state.posts, filters), filters);
  }

  async getPost(slug) {
    const state = await this.#read();
    const post = state.posts.find((item) => item.slug === slug);

    if (!post) {
      throw new HttpError(404, "Post not found.");
    }

    return post;
  }

  async createPost(input) {
    const state = await this.#read();
    const now = new Date().toISOString();
    const slug = uniqueSlug(state.posts, input.slug || slugify(input.title));

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

    state.posts.push(post);
    await this.#write(state);
    return post;
  }

  async updatePost(slug, input) {
    const state = await this.#read();
    const post = state.posts.find((item) => item.slug === slug);

    if (!post) {
      throw new HttpError(404, "Post not found.");
    }

    const wasPublished = post.status === "published";
    Object.assign(post, input, { updatedAt: new Date().toISOString() });

    if (!wasPublished && post.status === "published") {
      post.publishedAt = post.updatedAt;
    }

    await this.#write(state);
    return post;
  }

  async deletePost(slug) {
    const state = await this.#read();
    const nextPosts = state.posts.filter((post) => post.slug !== slug);

    if (nextPosts.length === state.posts.length) {
      throw new HttpError(404, "Post not found.");
    }

    state.posts = nextPosts;
    state.comments = state.comments.filter((comment) => comment.postSlug !== slug);
    await this.#write(state);
  }

  async listComments(postSlug, includePending = false) {
    const state = await this.#read();
    await this.getPost(postSlug);

    return state.comments
      .filter((comment) => comment.postSlug === postSlug)
      .filter((comment) => includePending || comment.status === "approved")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createComment(postSlug, input) {
    const state = await this.#read();
    const post = state.posts.find((item) => item.slug === postSlug);

    if (!post) {
      throw new HttpError(404, "Post not found.");
    }

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

    state.comments.push(comment);
    await this.#write(state);
    return comment;
  }

  async moderateComment(id, status) {
    const state = await this.#read();
    const comment = state.comments.find((item) => item.id === id);

    if (!comment) {
      throw new HttpError(404, "Comment not found.");
    }

    comment.status = status;
    comment.updatedAt = new Date().toISOString();
    await this.#write(state);
    return comment;
  }

  async #read() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const data = JSON.parse(raw);

      return {
        posts: Array.isArray(data.posts) ? data.posts : [],
        comments: Array.isArray(data.comments) ? data.comments : []
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        return structuredClone(EMPTY_STATE);
      }

      throw error;
    }
  }

  async #write(state) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`);
  }
}

export function filterPosts(posts, filters = {}) {
  let result = [...posts];

  if (filters.status) {
    result = result.filter((post) => post.status === filters.status);
  }

  if (filters.tag) {
    result = result.filter((post) => post.tags.includes(filters.tag.toLowerCase()));
  }

  if (filters.q) {
    const query = filters.q.toLowerCase();
    result = result.filter((post) => {
      return [post.title, post.excerpt, post.content].some((value) => {
        return value.toLowerCase().includes(query);
      });
    });
  }

  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function paginate(posts, filters = {}) {
  const page = Math.max(Number(filters.page || 1), 1);
  const limit = Math.min(Math.max(Number(filters.limit || 10), 1), 50);
  const start = (page - 1) * limit;

  return {
    data: posts.slice(start, start + limit),
    meta: {
      page,
      limit,
      total: posts.length
    }
  };
}

export function uniqueSlug(posts, baseSlug) {
  const base = baseSlug || "post";
  const used = new Set(posts.map((post) => post.slug));

  if (!used.has(base)) {
    return base;
  }

  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

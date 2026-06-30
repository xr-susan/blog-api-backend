import { HttpError } from "./http.js";

const POST_STATUSES = new Set(["draft", "published", "archived"]);
const COMMENT_STATUSES = new Set(["pending", "approved", "rejected"]);

export function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function requireString(body, field, maxLength) {
  const value = body[field];

  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(422, `${field} is required.`);
  }

  if (value.length > maxLength) {
    throw new HttpError(422, `${field} must be ${maxLength} characters or less.`);
  }

  return value.trim();
}

export function optionalString(body, field, maxLength, fallback = "") {
  const value = body[field];

  if (value == null) {
    return fallback;
  }

  if (typeof value !== "string") {
    throw new HttpError(422, `${field} must be a string.`);
  }

  if (value.length > maxLength) {
    throw new HttpError(422, `${field} must be ${maxLength} characters or less.`);
  }

  return value.trim();
}

export function readTags(body) {
  if (body.tags == null) {
    return [];
  }

  if (!Array.isArray(body.tags)) {
    throw new HttpError(422, "tags must be an array of strings.");
  }

  return [...new Set(body.tags.map((tag) => requireTag(tag)))].slice(0, 12);
}

export function readPostStatus(status = "draft") {
  if (!POST_STATUSES.has(status)) {
    throw new HttpError(422, "status must be draft, published, or archived.");
  }

  return status;
}

export function readCommentStatus(status = "pending") {
  if (!COMMENT_STATUSES.has(status)) {
    throw new HttpError(422, "status must be pending, approved, or rejected.");
  }

  return status;
}

function requireTag(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(422, "Each tag must be a non-empty string.");
  }

  return value.trim().toLowerCase().slice(0, 32);
}

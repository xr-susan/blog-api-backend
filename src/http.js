export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  res.end(body);
}

export function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(body);
}

export function requireAdmin(req, adminToken) {
  if (!adminToken) {
    throw new HttpError(503, "Admin token is not configured.");
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (token !== adminToken) {
    throw new HttpError(401, "Use a valid Bearer token to access this endpoint.");
  }
}

export function routeKey(method, pathname) {
  return `${method.toUpperCase()} ${pathname}`;
}

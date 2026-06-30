import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http.js";

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

export function createAuth(config) {
  return {
    login(email, password) {
      if (!config.authSecret || !config.adminPassword) {
        throw new HttpError(503, "Authentication is not configured.");
      }

      if (email !== config.adminEmail || password !== config.adminPassword) {
        throw new HttpError(401, "Invalid email or password.");
      }

      return signToken(
        {
          sub: email,
          role: "admin",
          exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
        },
        config.authSecret
      );
    },

    requireAdmin(token) {
      if (!token) {
        throw new HttpError(401, "Use a valid Bearer token to access this endpoint.");
      }

      if (config.adminToken && token === config.adminToken) {
        return { sub: "legacy-admin-token", role: "admin" };
      }

      const payload = verifyToken(token, config.authSecret);
      if (payload.role !== "admin") {
        throw new HttpError(403, "Admin access is required.");
      }

      return payload;
    }
  };
}

function signToken(payload, secret) {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");

  return `${header}.${body}.${signature}`;
}

function verifyToken(token, secret) {
  if (!secret) {
    throw new HttpError(503, "Authentication is not configured.");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new HttpError(401, "Use a valid Bearer token to access this endpoint.");
  }

  const [header, body, signature] = parts;
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");

  if (!safeEqual(signature, expected)) {
    throw new HttpError(401, "Use a valid Bearer token to access this endpoint.");
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "Token has expired.");
  }

  return payload;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

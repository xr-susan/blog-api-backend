# Blog API Backend

A small REST API for posts and comments, built with modern Node.js and zero runtime dependencies. It is intentionally easy to read, run, test, and extend.

## What it does

- Publish, update, search, and archive blog posts
- Filter posts by status, tag, keyword, page, and page size
- Keep drafts and archived posts private unless an admin token is provided
- Accept public comments as pending by default
- Moderate comments with a bearer token
- Store data in a local JSON file for simple demos and small deployments
- Serve an OpenAPI document at `/openapi.yaml`
- Run tests with Node's built-in test runner

## Quick start

```bash
git clone https://github.com/xr-susan/blog-api-backend.git
cd blog-api-backend
cp .env.example .env
npm test
npm start
```

The API starts at `http://localhost:3000`.

Set `BLOG_ADMIN_TOKEN` before using admin endpoints:

```bash
BLOG_ADMIN_TOKEN=dev-token npm start
```

## Example requests

Create a post:

```bash
curl -X POST http://localhost:3000/v1/posts \
  -H "content-type: application/json" \
  -H "authorization: Bearer dev-token" \
  -d '{
    "title": "A Useful First Post",
    "excerpt": "A short intro.",
    "content": "Start small, document well, and keep the API pleasant.",
    "tags": ["node", "api"],
    "status": "published"
  }'
```

List published posts:

```bash
curl "http://localhost:3000/v1/posts?status=published&tag=node"
```

Submit a comment:

```bash
curl -X POST http://localhost:3000/v1/posts/a-useful-first-post/comments \
  -H "content-type: application/json" \
  -d '{
    "authorName": "Reader",
    "authorEmail": "reader@example.com",
    "content": "This helped me ship faster."
  }'
```

Approve a comment:

```bash
curl -X PATCH http://localhost:3000/v1/comments/<comment-id>/moderation \
  -H "content-type: application/json" \
  -H "authorization: Bearer dev-token" \
  -d '{ "status": "approved" }'
```

## API overview

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/openapi.yaml` | OpenAPI spec |
| `GET` | `/v1/posts` | List posts |
| `POST` | `/v1/posts` | Create a post |
| `GET` | `/v1/posts/:slug` | Read one post |
| `PATCH` | `/v1/posts/:slug` | Update one post |
| `DELETE` | `/v1/posts/:slug` | Delete one post |
| `GET` | `/v1/posts/:slug/comments` | List approved comments |
| `POST` | `/v1/posts/:slug/comments` | Submit a pending comment |
| `PATCH` | `/v1/comments/:id/moderation` | Approve or reject a comment |

## Design notes

This project keeps the first version deliberately small:

- No database service is required. The JSON store makes the API easy to try locally.
- No framework is required. The route layer is short enough to understand in one sitting.
- The code is split by responsibility: HTTP helpers, validation, storage, app wiring, and server startup.

When the project grows, good next steps are SQLite/PostgreSQL storage, richer authentication, request logging, and deployment examples.

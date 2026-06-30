# Blog API Backend

A small REST API for posts and comments, built with modern Node.js. It is intentionally easy to read, run, test, and extend.

## What it does

- Publish, update, search, and archive blog posts
- Filter posts by status, tag, keyword, page, and page size
- Keep drafts and archived posts private unless an admin token is provided
- Accept public comments as pending by default
- Moderate comments with a bearer token
- Sign in with an admin email/password and receive a short-lived JWT
- Store data in JSON, SQLite, or PostgreSQL
- Emit compact JSON request logs
- Serve an OpenAPI document at `/openapi.yaml`
- Run tests with Node's built-in test runner

## Quick start

```bash
git clone https://github.com/xr-susan/blog-api-backend.git
cd blog-api-backend
cp .env.example .env
npm install
npm test
npm start
```

The API starts at `http://localhost:3000`.

Set an auth secret and admin password before using admin endpoints:

```bash
BLOG_AUTH_SECRET=dev-secret BLOG_ADMIN_PASSWORD=dev-password npm start
```

Sign in:

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"dev-password"}'
```

## Example requests

Create a post:

```bash
curl -X POST http://localhost:3000/v1/posts \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
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
  -H "authorization: Bearer <token>" \
  -d '{ "status": "approved" }'
```

## API overview

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/openapi.yaml` | OpenAPI spec |
| `POST` | `/v1/auth/login` | Issue an admin bearer token |
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

- SQLite is the default because it is durable and easy to run locally.
- PostgreSQL is available for hosted deployments through `BLOG_STORAGE=postgres`.
- The route layer stays small; auth, logging, validation, and storage each live in their own module.

See [docs/deployment.md](docs/deployment.md) for SQLite and Docker/PostgreSQL examples.

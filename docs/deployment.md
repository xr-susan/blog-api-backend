# Deployment

## Local SQLite

SQLite is the default storage driver and is the easiest option for a demo server.

```bash
BLOG_AUTH_SECRET=dev-secret BLOG_ADMIN_PASSWORD=dev-password npm start
```

The database file is created at `./data/blog.sqlite`.

## Docker With PostgreSQL

Use the Compose file when you want the API and PostgreSQL together:

```bash
docker compose -f deploy/docker-compose.yml up --build
```

Then sign in and create posts with the returned bearer token.

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"replace-before-deploy"}'
```

## Production Checklist

- Set `BLOG_AUTH_SECRET` to a long random value.
- Replace `BLOG_ADMIN_PASSWORD` before the first deploy.
- Use `BLOG_STORAGE=postgres` for hosted deployments.
- Store secrets in your platform's secret manager.
- Keep `/health` public for uptime checks.

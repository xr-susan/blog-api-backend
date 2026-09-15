# Repository metadata

> **Manual step required.** GitHub does not expose repository description or topics
> through files in the repository, so the owner has to paste both values below into
> the GitHub web UI by hand.
>
> 1. Open <https://github.com/xr-susan/blog-api-backend>.
> 2. Click the gear icon next to **About** in the right-hand sidebar.
> 3. Paste the description into the **Description** field.
> 4. Paste the topics into the **Topics** field (press Enter after each one).
> 5. Click **Save changes**.

## Why this change is needed

The current description advertises the project as TypeScript, which contradicts the
code. The repository contains only `.js` files, has no `tsconfig.json`, and declares no
TypeScript dependency in `package.json`; GitHub's language statistic reports JavaScript
for the same reason. The corrected description below removes that contradiction.

## Proposed description

Character count: 104 (GitHub's limit is 350, but short descriptions render better).

```text
A small, production-minded Blog API in plain JavaScript (ESM) with JSON, SQLite, and PostgreSQL storage.
```

## Proposed topics

```text
nodejs
javascript
esm
rest-api
blog-api
jwt-authentication
sqlite
postgresql
json-storage
node-test-runner
openapi
docker
docker-compose
backend
api-server
```

Fifteen lowercase, hyphenated topics. They describe only capabilities that exist in the
repository: Node.js, ESM, a REST API, JWT-based admin auth, the three storage backends,
Node's built-in test runner, the served OpenAPI document, and the Docker / Compose setup.

## Optional follow-up

The GitHub sidebar language bar already reports JavaScript, so no further action is
needed there. If a `TypeScript` topic was ever added, it should be removed for the same
reason as the description fix.

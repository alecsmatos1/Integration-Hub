# Deployment Guide

This document describes how to deploy the Integration Hub backend and frontend to a production environment.

## Overview

| Component | Recommended target |
|---|---|
| Backend (NestJS) | Railway, Render, or Fly.io |
| Frontend (Angular) | Vercel or Netlify |
| Database (PostgreSQL) | Railway PostgreSQL, Supabase, or Neon |

---

## Backend Deployment

### Environment Variables

Set these in your hosting provider's dashboard. Do not commit real values.

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=<random 64-char string>
JWT_REFRESH_SECRET=<random 64-char string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Railway

1. Create a new Railway project.
2. Add a PostgreSQL plugin - Railway sets `DATABASE_URL` automatically.
3. Connect your GitHub repo and select `apps/backend` as the root.
4. Set the environment variables above.
5. Set the build command: `npm install && npx prisma migrate deploy && npm run build`
6. Set the start command: `node dist/src/main`

### Render

1. Create a new Web Service.
2. Set the root directory to `apps/backend`.
3. Build command: `npm install && npx prisma migrate deploy && npm run build`
4. Start command: `node dist/src/main`
5. Add a PostgreSQL database and copy the connection string to `DATABASE_URL`.
6. Set all other environment variables in the Render dashboard.

### Fly.io

1. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. From `apps/backend`: `fly launch`
3. Set secrets: `fly secrets set JWT_SECRET=... JWT_REFRESH_SECRET=... CORS_ORIGIN=...`
4. Attach a Postgres instance: `fly postgres attach`
5. On each deploy run migrations: add `npx prisma migrate deploy` to your release command.

---

## Frontend Deployment

### Configuring the API URL

Before building for production, set the API base URL in:

```
apps/frontend/src/app/core/api.config.ts
```

```typescript
export const API_BASE_URL = 'https://your-backend-domain.railway.app';
```

For Vercel/Netlify, you can also inject this at build time using a build-time environment variable and Angular's `fileReplacements` if needed. For MVP, editing `api.config.ts` is sufficient.

### Vercel

1. Import the repository into Vercel.
2. Set the root directory to `apps/frontend`.
3. Build command: `npm run build`
4. Output directory: `dist/frontend/browser`
5. Update `API_BASE_URL` in `api.config.ts` before deploying.

### Netlify

1. Connect the repository to Netlify.
2. Set the base directory to `apps/frontend`.
3. Build command: `npm run build`
4. Publish directory: `dist/frontend/browser`
5. Add a `apps/frontend/public/_redirects` file with:
   ```
   /*  /index.html  200
   ```
   This ensures Angular's client-side routing works correctly.

---

## CORS

The backend reads `CORS_ORIGIN` from the environment. Set it to your frontend's deployed URL:

```
CORS_ORIGIN=https://your-frontend.vercel.app
```

Multiple origins are not supported in the current implementation. If needed, extend `main.ts` to parse a comma-separated list.

---

## Database Migrations

Run migrations against production before or during deployment:

```bash
DATABASE_URL=<production-url> npx prisma migrate deploy
```

Most hosting platforms support a release/predeploy hook where you can run this command automatically.

---

## Health Check

The backend exposes `GET /health` which returns `{"status":"ok"}`. Use this as the health check URL in your hosting provider's configuration.

---

## Security Notes

### Rate Limiting

The backend applies a global rate limit of 120 requests per minute per IP via `@nestjs/throttler`. The public webhook endpoint (`POST /webhooks/github/:pathToken`) has a separate, higher limit of 300 requests per minute to accommodate high-volume webhook traffic.

### Request Body Size

The default Express JSON body parser limit (100 KB) is in effect. This is sufficient for typical GitHub webhook payloads. If you expect unusually large payloads (e.g., push events with many files), you can increase this in `apps/backend/src/main.ts` by passing options to the body parser.

### Secret Storage

Webhook HMAC secrets (set when creating a connection) are stored in plaintext in the database. For a production deployment, consider encrypting secrets at rest using a key stored in your environment (e.g., a `SECRET_ENCRYPTION_KEY` env var). This is not implemented in the current version. As a mitigation, ensure your database is not publicly accessible and use a strong `DATABASE_URL` with SSL.

---

## Local Development

Local development is unchanged. See the [Quick Start](../README.md#quick-start) in the root README.

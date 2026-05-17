# Deployment Guide

This document describes how to deploy the Integration Hub backend and frontend to a production environment.

## Overview

| Component | Recommended target |
|---|---|
| Backend (NestJS) | Railway |
| Frontend (Angular) | Vercel |
| Database (PostgreSQL) | Railway PostgreSQL |

Current public deployment:

| Service | URL |
|---|---|
| Frontend | https://integration-hub-eight.vercel.app/login |
| Backend health check | https://integration-hub-production-fd21.up.railway.app/health |
| Backend API docs | https://integration-hub-production-fd21.up.railway.app/api |

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
4. Confirm the backend service has access to `DATABASE_URL` before the pre-deploy migration runs. If Railway created it on the database service only, add a reference variable on the backend service.
5. Set the other environment variables above.
6. Set the build command: `npx prisma generate && npm run build`
7. Set the pre-deploy command: `npx prisma migrate deploy`
8. Set the start command: `npm run start:prod`
9. Set the health check path: `/health`

---

## Frontend Deployment

### Configuring the API URL

The frontend uses Angular environment files to switch the API base URL between local and production builds.

**Local development** (`http://localhost:3000`) is set in:

```
apps/frontend/src/environments/environment.ts
```

**Production** URL is set in:

```
apps/frontend/src/environments/environment.production.ts
```

```typescript
export const environment = {
  production: true,
  apiBaseUrl: 'https://your-backend-domain.railway.app',
};
```

Angular's `fileReplacements` in `angular.json` automatically swaps the file when you run `npm run build` (which uses the `production` configuration). You do not need to edit `api.config.ts` manually.

### Vercel

1. Import the repository into Vercel.
2. Set the root directory to `apps/frontend`.
3. Build command: `npm run build`
4. Output directory: `dist/frontend/browser`
5. Set the production API URL in `apps/frontend/src/environments/environment.production.ts` after the Railway backend URL exists.

---

## CORS

The backend reads `CORS_ORIGIN` from the environment. Set it to your frontend's deployed URL:

```
CORS_ORIGIN=https://your-frontend.vercel.app
```

Current production value:

```
CORS_ORIGIN=https://integration-hub-eight.vercel.app
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

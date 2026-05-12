# Integration Hub — Backend

NestJS 11 REST API for the Integration Hub webhook automation platform.

## Tech stack

- **NestJS 11** with Express
- **Prisma 7** + `@prisma/adapter-pg` (PostgreSQL)
- **Passport-JWT** for authentication
- **Jest 30** for unit and e2e tests

## Environment variables

Create `apps/backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/integration_hub
JWT_SECRET=change-me-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-me-refresh
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
```

## Database setup

PostgreSQL must be running. Then run migrations:

```bash
npx prisma migrate dev --name init
```

Or via WSL (if Postgres runs inside WSL Ubuntu):

```bash
wsl -d Ubuntu -- bash -c "cd /path/to/project/apps/backend && DATABASE_URL=postgresql://... npx prisma migrate dev"
```

## Commands

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start development server
npm run start:dev

# Build
npm run build

# Run unit tests
npm test

# Run e2e tests (requires running Postgres)
npm run test:e2e

# Code coverage
npm run test:cov
```

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Sign in, get JWT |
| POST | `/auth/refresh` | No | Refresh access token |
| GET | `/auth/me` | JWT | Current user |
| GET | `/health` | No | Health check |
| GET | `/integrations/providers` | JWT | List providers |
| POST | `/integrations/connections` | JWT | Add connection |
| GET | `/integrations/connections` | JWT | List connections |
| POST | `/webhooks/endpoints` | JWT | Create webhook endpoint |
| GET | `/webhooks/endpoints` | JWT | List endpoints |
| GET | `/webhooks/events` | JWT | List received events |
| POST | `/webhooks/github/:pathToken` | No | GitHub webhook receiver |
| POST | `/workflows` | JWT | Create workflow |
| GET | `/workflows` | JWT | List workflows |
| POST | `/workflows/:id/execute` | JWT | Manual trigger |
| GET | `/executions` | JWT | List executions |
| GET | `/executions/:id/logs` | JWT | Execution logs |

Full interactive docs available at `/api` (Swagger) when running.

## Webhook URL format

After creating an endpoint, use the returned `pathToken`:

```
POST http://localhost:3000/webhooks/github/<pathToken>
```

Configure this URL in GitHub → Repository Settings → Webhooks.

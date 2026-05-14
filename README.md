# Integration Hub

[![CI](https://github.com/alecsmatos1/Integration-Hub/actions/workflows/ci.yml/badge.svg)](https://github.com/alecsmatos1/Integration-Hub/actions/workflows/ci.yml)

A webhook-to-workflow automation platform. Connect your GitHub account, receive webhook events, and trigger automated workflows - with a full-stack web UI and a REST API.

Built as a portfolio project demonstrating NestJS, Angular, Prisma, JWT auth, HMAC signature verification, and GitHub Actions CI.

---

## What This Demonstrates

| Skill | Implementation |
|---|---|
| Backend architecture | NestJS modular design with controllers, services, guards, and decorators |
| Authentication | JWT access + refresh tokens, bcrypt hashing, Passport strategy |
| Webhook security | HMAC-SHA256 signature verification using raw request body |
| Data persistence | Prisma ORM with PostgreSQL, migrations, relational queries |
| Async execution | In-memory queue with `setImmediate`, isolated WorkflowRunner |
| Multi-user isolation | All queries scoped by `userId`; cross-user access returns 404 |
| API security | CORS, rate limiting via `@nestjs/throttler`, secret stripping from responses |
| Frontend | Angular 21 standalone components, signals, lazy routes, HTTP interceptors |
| Testing | Jest e2e (39 tests), unit tests (21), Vitest frontend (8) |
| CI/CD | GitHub Actions with PostgreSQL service container |

---

## Architecture

```
apps/
  backend/    NestJS 11 REST API (auth, integrations, webhooks, workflows, executions)
  frontend/   Angular 21 SPA (dashboard, integrations, endpoints, events, workflows, executions)
packages/
  integrations/ Provider SDK contracts
```

```
GitHub Webhook -> POST /webhooks/github/:pathToken
                       |
                   HMAC-SHA256 verify (x-hub-signature-256)
                       |
                  Save WebhookEvent
                       |
              triggerForEvent (filtered by endpoint owner userId)
                       |
             Enqueue WorkflowExecution (setImmediate)
                       |
              WorkflowRunner executes steps in order
                       |
                ExecutionLog entries persisted per step
```

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 11, Express, Passport-JWT |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Database | PostgreSQL 16 |
| Frontend | Angular 21 (standalone components, signals, lazy routes) |
| Testing | Jest 30 (backend), Vitest 4 (frontend) |
| CI | GitHub Actions |

---

## Quick Start

### Prerequisites

- Node.js 22+
- Docker Desktop (for PostgreSQL via Docker Compose)

### 1. Database

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### 2. Backend

```bash
cd apps/backend
cp .env.example .env          # set JWT_SECRET and JWT_REFRESH_SECRET
npm install
npx prisma migrate deploy
npm run start:dev             # http://localhost:3000
# Swagger UI: http://localhost:3000/api
```

### 3. Frontend

```bash
cd apps/frontend
npm install
npm start                     # http://localhost:4200
```

---

## Demo Flow

1. Register at `http://localhost:4200/register`
2. Go to **Integrations** -> Add a GitHub connection (optionally set a webhook secret)
3. Go to **Endpoints** -> Create an endpoint -> copy the webhook URL
4. Add that URL to a GitHub repository -> Settings -> Webhooks
5. Push a commit - the event appears in **Events**
6. Go to **Workflows** -> Create a workflow with trigger `github / push` and a `log` step
7. The next push triggers it automatically, or click **Run now**
8. Go to **Executions** -> click **View logs** to see per-step output

---

## API Examples

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"Test1234!","name":"Demo"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"Test1234!"}' | jq -r .accessToken)

# Create connection
curl -X POST http://localhost:3000/integrations/connections \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"provider":"github","name":"My GitHub","secret":"my-hmac-secret"}'

# Create webhook endpoint
curl -X POST http://localhost:3000/webhooks/endpoints \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Prod Hook","connectionId":"<connection-id>"}'

# Simulate a signed GitHub push
PAYLOAD='{"ref":"refs/heads/main"}'
SIG="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "my-hmac-secret" | awk '{print $2}')"
curl -X POST http://localhost:3000/webhooks/github/<pathToken> \
  -H 'Content-Type: application/json' \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$PAYLOAD"

# Filter executions by status
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/executions?status=success"

# Filter events by type
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/webhooks/events?provider=github&eventType=push"

# Retry a failed execution
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/executions/<execution-id>/retry"
```

---

## Screenshots

> _Screenshots coming after deployment. See the [demo flow](#demo-flow) to run it locally._

| Screen | Description |
|---|---|
| `docs/assets/dashboard.png` | Overview with connection, endpoint, event, and execution counts |
| `docs/assets/webhook-endpoints.png` | Endpoint list with copyable webhook URLs |
| `docs/assets/webhook-events.png` | Incoming event log with HMAC signature status |
| `docs/assets/executions.png` | Execution history with status badges |
| `docs/assets/execution-logs.png` | Per-step log output |

---

## Running Tests

```bash
# Backend unit tests
cd apps/backend && npm test -- --runInBand

# Backend e2e tests (requires PostgreSQL)
cd apps/backend && npm run test:e2e

# Frontend tests
cd apps/frontend && npm test -- --watch=false
```

---

## Roadmap

- [ ] Slack / Discord / OpenAI providers
- [ ] Real HTTP step (not mock)
- [ ] Retry logic with exponential backoff
- [ ] Workflow editor UI (drag-and-drop steps)
- [ ] Rate limiting and API keys

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Roadmap](docs/ROADMAP.md)

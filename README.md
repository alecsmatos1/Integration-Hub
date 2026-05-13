# Integration Hub

A webhook-to-workflow automation platform. Connect your GitHub account, receive webhook events, and trigger automated workflows - with a full-stack web UI and a REST API.

Built as a portfolio project demonstrating NestJS, Angular, Prisma, JWT auth, HMAC signature verification, and GitHub Actions CI.

---

## Architecture

```
apps/
  backend/    NestJS 11 REST API (auth, integrations, webhooks, workflows, executions)
  frontend/   Angular 21 SPA (dashboard, integrations, endpoints, events, workflows, executions)
packages/
  shared/     Shared TypeScript types
  integrations/ Provider SDK stubs
```

```
GitHub Webhook -> POST /webhooks/github/:pathToken
                       |
                   HMAC verify (x-hub-signature-256)
                       |
                  Save WebhookEvent
                       |
              triggerForEvent (by userId)
                       |
             Enqueue WorkflowExecution (setImmediate)
                       |
              WorkflowRunner (log / http_request_mock steps)
                       |
                ExecutionLog entries
```

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11, Express, Passport-JWT |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Database | PostgreSQL |
| Frontend | Angular 21 (standalone components, signals, lazy routes) |
| Testing | Jest 30 (backend), Vitest 4 (frontend) |
| CI | GitHub Actions |

---

## Quick start

### Prerequisites

- Node.js 22+
- Docker Desktop (for PostgreSQL via Docker Compose)

### Database

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### Backend

```bash
cd apps/backend
cp .env.example .env          # fill JWT_SECRET, JWT_REFRESH_SECRET (DATABASE_URL is pre-filled for Docker)
npm install
npx prisma migrate deploy
npm run start:dev             # http://localhost:3000
# Swagger UI: http://localhost:3000/api
```

### Frontend

```bash
cd apps/frontend
npm install
npm start                     # http://localhost:4200
```

---

## Demo flow

1. Register at `http://localhost:4200/register`
2. Go to **Integrations** -> Add a GitHub connection (optionally set a webhook secret)
3. Go to **Endpoints** -> Create an endpoint -> copy the webhook URL
4. Add that URL to a GitHub repository -> Settings -> Webhooks
5. Push a commit - the event appears in **Events**
6. Go to **Workflows** -> Create a workflow with trigger `github / push` and a `log` step
7. The next push triggers it automatically, or click **Run now**
8. Go to **Executions** -> click **Logs** to see per-step output

---

## API examples

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"Test1234!","name":"Demo"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"Test1234!"}' | jq -r .accessToken)

# List providers
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/integrations/providers

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
- [Implementation guide](docs/IMPLEMENTATION.md)
- [Roadmap](docs/ROADMAP.md)
- [Backend README](apps/backend/README.md)
- [Frontend README](apps/frontend/README.md)

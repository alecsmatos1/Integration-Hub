# Roadmap

## Done

- Auth with JWT (access + refresh tokens, bcrypt, Passport strategy).
- GitHub webhook receiver with path-token routing.
- HMAC-SHA256 signature verification using raw request body.
- Webhook event history with provider and event type filtering.
- Linear workflow execution engine (steps run in sequence).
- Real HTTP workflow step with persisted status logs.
- Per-step execution logs persisted in PostgreSQL.
- Angular 21 dashboard with standalone components, signals, and lazy routes.
- Multi-user isolation - all resources scoped by authenticated user.
- CI pipeline with GitHub Actions and PostgreSQL service container.
- Rate limiting via `@nestjs/throttler` (global + webhook-specific limits).
- Dashboard stats with local cache.
- Screenshots and demo data in README.

## Next

- Public deployment (Railway backend + Vercel frontend).
- Frontend API URL driven by environment variable (not hardcoded).
- Deployment links and production demo script in README.

## Later

- Slack / Discord / OpenAI providers.
- BullMQ + Redis queue for async execution.
- Workflow editor UI (drag-and-drop step builder).
- Encrypted secrets at rest.
- Retry logic with exponential backoff.
- API keys for machine-to-machine access.

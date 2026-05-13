# Integration Hub - Frontend

Angular 21 SPA for the Integration Hub webhook automation platform.

## Tech stack

- **Angular 21** (standalone components, signals, `@for`/`@if` control flow)
- **Angular Router** with lazy-loaded routes and `authGuard`
- **Angular HttpClient** with `authInterceptor` (JWT bearer token)
- **SCSS** with shared partials
- **Vitest 4** via `@angular/build:unit-test`

## Setup

```bash
npm install
npm start        # dev server at http://localhost:4200
npm run build    # production build
npm test         # vitest unit tests
```

The frontend proxies all API calls to `http://localhost:3000`. Start the backend first.

## Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | Login | JWT login |
| `/register` | Register | Account creation |
| `/dashboard` | Dashboard | Stats overview |
| `/integrations` | Integrations | Provider connections |
| `/webhook-endpoints` | WebhookEndpoints | Manage webhook URLs |
| `/webhook-events` | WebhookEvents | Incoming event log |
| `/workflows` | Workflows | Create and run workflows |
| `/executions` | Executions | Execution history |
| `/executions/:id` | ExecutionDetail | Per-step logs |

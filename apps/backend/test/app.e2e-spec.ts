import * as crypto from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

/**
 * E2E test suite for the Integration Hub API.
 *
 * Requires a running PostgreSQL database. Set DATABASE_URL, JWT_SECRET, and
 * JWT_REFRESH_SECRET in the environment before running:
 *
 *   npm run test:e2e
 *
 * The CI workflow provides these via a PostgreSQL service container.
 */
describe('Integration Hub (e2e)', () => {
  let app: INestApplication<App>;

  let accessToken: string;
  let userId: string;
  let connectionId: string;
  let endpointId: string;
  let pathToken: string;
  let workflowId: string;
  let executionId: string;

  const user = {
    email: `e2e-${Date.now()}@example.com`,
    password: 'Test1234!',
    name: 'E2E User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // -- Health ------------------------------------------------------------------

  it('GET /health -> 200', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('ok'));
  });

  // -- Auth --------------------------------------------------------------------

  it('POST /auth/register -> 201 with tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(user.email);
    userId = res.body.user.id;
    accessToken = res.body.accessToken;
  });

  it('POST /auth/login -> 200 with tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    accessToken = res.body.accessToken;
  });

  it('GET /auth/me -> 401 without token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('GET /auth/me -> 200 with token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(userId);
    expect(res.body.email).toBe(user.email);
  });

  // -- Integrations -------------------------------------------------------------

  it('GET /integrations/providers -> 200 includes github', async () => {
    const res = await request(app.getHttpServer())
      .get('/integrations/providers')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const names = (res.body as Array<{ name: string }>).map((p) => p.name);
    expect(names).toContain('github');
  });

  it('POST /integrations/connections -> 201, secret not exposed', async () => {
    const res = await request(app.getHttpServer())
      .post('/integrations/connections')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ provider: 'github', name: 'My GitHub', secret: 'supersecret' })
      .expect(201);

    expect(res.body).not.toHaveProperty('secret');
    expect(res.body).toHaveProperty('id');
    connectionId = res.body.id;
  });

  it('GET /integrations/connections -> 200, no secrets', async () => {
    const res = await request(app.getHttpServer())
      .get('/integrations/connections')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    for (const conn of res.body as object[]) {
      expect(conn).not.toHaveProperty('secret');
    }
  });

  // -- Webhook Endpoints ---------------------------------------------------------

  it('POST /webhooks/endpoints -> 201 with pathToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/webhooks/endpoints')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'GitHub Hook', connectionId })
      .expect(201);

    expect(res.body).toHaveProperty('pathToken');
    endpointId = res.body.id;
    pathToken = res.body.pathToken;
  });

  it('GET /webhooks/endpoints -> 200 list', async () => {
    const res = await request(app.getHttpServer())
      .get('/webhooks/endpoints')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as Array<{ id: string }>).some((e) => e.id === endpointId)).toBe(true);
  });

  // -- Webhook Receipt -----------------------------------------------------------

  it('POST /webhooks/github/:pathToken -> 201 without secret (no sig check)', async () => {
    // Use a connection without a secret so signature is not required
    const connRes = await request(app.getHttpServer())
      .post('/integrations/connections')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ provider: 'github', name: 'Unsigned GitHub' })
      .expect(201);

    const epRes = await request(app.getHttpServer())
      .post('/webhooks/endpoints')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Unsigned Hook', connectionId: connRes.body.id })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/webhooks/github/${epRes.body.pathToken}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'push')
      .set('X-GitHub-Delivery', 'test-delivery-1')
      .send(JSON.stringify({ ref: 'refs/heads/main' }))
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });

  it('POST /webhooks/github/:pathToken -> 400 on invalid JSON', async () => {
    await request(app.getHttpServer())
      .post(`/webhooks/github/${pathToken}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'push')
      .send('not-valid-json{{{')
      .expect(400);
  });

  it('POST /webhooks/github/:pathToken -> 400 on wrong HMAC', async () => {
    const payload = JSON.stringify({ action: 'opened' });

    await request(app.getHttpServer())
      .post(`/webhooks/github/${pathToken}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'push')
      .set('X-Hub-Signature-256', 'sha256=badhash')
      .send(payload)
      .expect(400);
  });

  it('POST /webhooks/github/:pathToken -> 201 with correct HMAC', async () => {
    const connRes = await request(app.getHttpServer())
      .post('/integrations/connections')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ provider: 'github', name: 'Signed GitHub', secret: 'mysecret' })
      .expect(201);

    const epRes = await request(app.getHttpServer())
      .post('/webhooks/endpoints')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Signed Hook', connectionId: connRes.body.id })
      .expect(201);

    const payload = JSON.stringify({ action: 'pushed' });
    const sig = 'sha256=' + crypto.createHmac('sha256', 'mysecret').update(payload).digest('hex');

    await request(app.getHttpServer())
      .post(`/webhooks/github/${epRes.body.pathToken}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'push')
      .set('X-Hub-Signature-256', sig)
      .send(payload)
      .expect(201);
  });

  // -- Webhook Events ------------------------------------------------------------

  it('GET /webhooks/events -> 200 list', async () => {
    const res = await request(app.getHttpServer())
      .get('/webhooks/events')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  // -- Workflows -----------------------------------------------------------------

  it('POST /workflows -> 201 creates workflow', async () => {
    const res = await request(app.getHttpServer())
      .post('/workflows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'My Workflow',
        triggerProvider: 'github',
        triggerEvent: 'push',
        steps: [
          { order: 1, type: 'log', config: { message: 'Step 1' } },
          { order: 2, type: 'http_request_mock', config: { url: 'https://example.com', method: 'POST' } },
        ],
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.steps).toHaveLength(2);
    workflowId = res.body.id;
  });

  it('POST /workflows -> 400 on empty steps', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Bad', triggerProvider: 'github', triggerEvent: 'push', steps: [] })
      .expect(400);
  });

  it('POST /workflows -> 400 on invalid step type', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Bad',
        triggerProvider: 'github',
        triggerEvent: 'push',
        steps: [{ order: 1, type: 'invalid_type' }],
      })
      .expect(400);
  });

  it('POST /workflows -> 400 on duplicate step orders', async () => {
    await request(app.getHttpServer())
      .post('/workflows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Dup',
        triggerProvider: 'github',
        triggerEvent: 'push',
        steps: [
          { order: 1, type: 'log' },
          { order: 1, type: 'log' },
        ],
      })
      .expect(400);
  });

  it('GET /workflows -> 200 list', async () => {
    const res = await request(app.getHttpServer())
      .get('/workflows')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as Array<{ id: string }>).some((w) => w.id === workflowId)).toBe(true);
  });

  // -- Manual Execution ----------------------------------------------------------

  it('POST /workflows/:id/execute -> 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/workflows/${workflowId}/execute`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(res.body).toHaveProperty('id');
    executionId = res.body.id;
  });

  it('POST /workflows/nonexistent/execute -> 404', async () => {
    await request(app.getHttpServer())
      .post('/workflows/00000000-0000-0000-0000-000000000000/execute')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  // -- Executions ----------------------------------------------------------------

  it('GET /executions -> 200 list', async () => {
    const res = await request(app.getHttpServer())
      .get('/executions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /executions/:id/logs -> 200 after runner finishes', async () => {
    await new Promise((r) => setTimeout(r, 300));

    const res = await request(app.getHttpServer())
      .get(`/executions/${executionId}/logs`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
  });
});

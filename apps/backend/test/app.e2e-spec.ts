import * as crypto from 'crypto';
import { createServer, Server } from 'http';
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

  it('GET /webhooks/events?provider=github -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/webhooks/events?provider=github')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /webhooks/events?provider=invalid -> 400', async () => {
    await request(app.getHttpServer())
      .get('/webhooks/events?provider=invalid')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
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

  it('GET /executions?status=success -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/executions?status=success')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /executions?status=invalid -> 400', async () => {
    await request(app.getHttpServer())
      .get('/executions?status=invalid')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
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

  it('GET /executions/:id/logs includes step timing metadata', async () => {
    const res = await request(app.getHttpServer())
      .get(`/executions/${executionId}/logs`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    type Log = { message: string; metadata?: { durationMs?: number } };
    const logs = res.body as Log[];
    const completionLog = logs.find((l) => l.message.includes('Completed step') && l.metadata?.durationMs !== undefined);
    expect(completionLog).toBeDefined();
  });

  it('POST /executions/:id/retry -> 404 for non-failed execution', async () => {
    await request(app.getHttpServer())
      .post(`/executions/${executionId}/retry`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('POST /executions/nonexistent/retry -> 404', async () => {
    await request(app.getHttpServer())
      .post('/executions/00000000-0000-0000-0000-000000000000/retry')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  // -- HTTP Request Workflow -----------------------------------------------------

  describe('http_request workflow', () => {
    let testHttpServer: Server;
    let testHttpUrl: string;
    let httpWorkflowId: string;
    let httpExecutionId: string;
    let failWorkflowId: string;
    let failExecutionId: string;

    beforeAll(async () => {
      testHttpServer = createServer((req, res) => {
        if (req.url === '/todos/1') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      });

      await new Promise<void>((resolve) => testHttpServer.listen(0, '127.0.0.1', resolve));
      const address = testHttpServer.address();
      if (!address || typeof address === 'string') throw new Error('Test HTTP server did not start');
      testHttpUrl = `http://127.0.0.1:${address.port}/todos/1`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve, reject) => {
        testHttpServer.close((err) => (err ? reject(err) : resolve()));
      });
    });

    it('POST /workflows -> 201 accepts http_request step type', async () => {
      const res = await request(app.getHttpServer())
        .post('/workflows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'HTTP Request Workflow',
          triggerProvider: 'github',
          triggerEvent: 'push',
          steps: [
            {
              order: 1,
              type: 'http_request',
              config: { url: testHttpUrl, method: 'GET' },
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.steps[0].type).toBe('http_request');
      httpWorkflowId = res.body.id;
    });

    it('POST /workflows/:id/execute -> 201 starts http_request execution', async () => {
      const res = await request(app.getHttpServer())
        .post(`/workflows/${httpWorkflowId}/execute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      httpExecutionId = res.body.id;
    });

    it('GET /executions/:id/logs has http_request log entry after runner completes', async () => {
      await new Promise((r) => setTimeout(r, 800));

      const res = await request(app.getHttpServer())
        .get(`/executions/${httpExecutionId}/logs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const logs = res.body as Array<{ message: string; metadata?: Record<string, unknown> }>;
      expect(logs.length).toBeGreaterThan(0);
      const httpLog = logs.find((l) => l.message.includes('GET') && l.message.includes(testHttpUrl));
      expect(httpLog).toBeDefined();
      expect(httpLog?.metadata).toMatchObject({ method: 'GET', status: expect.any(Number) });
    });

    it('http_request execution with invalid URL transitions to failed', async () => {
      const wfRes = await request(app.getHttpServer())
        .post('/workflows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Failing HTTP Workflow',
          triggerProvider: 'github',
          triggerEvent: 'push',
          steps: [
            { order: 1, type: 'http_request', config: { url: 'http://localhost:1/unreachable', method: 'GET' } },
          ],
        })
        .expect(201);
      failWorkflowId = wfRes.body.id;

      const execRes = await request(app.getHttpServer())
        .post(`/workflows/${failWorkflowId}/execute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
      failExecutionId = execRes.body.id;

      await new Promise((r) => setTimeout(r, 500));

      const detailRes = await request(app.getHttpServer())
        .get('/executions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const executions = detailRes.body as Array<{ id: string; status: string }>;
      const failedExec = executions.find((e) => e.id === failExecutionId);
      expect(failedExec).toBeDefined();
      expect(failedExec?.status).toBe('failed');
    });
  });

  // -- Multi-User Isolation -----------------------------------------------------

  describe('multi-user isolation', () => {
    let tokenB: string;
    let workflowIdB: string;

    const userB = {
      email: `e2e-b-${Date.now()}@example.com`,
      password: 'Test1234!',
      name: 'E2E User B',
    };

    it('registers user B', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userB)
        .expect(201);
      tokenB = res.body.accessToken;
    });

    it('user B sees no connections (not user A data)', async () => {
      const res = await request(app.getHttpServer())
        .get('/integrations/connections')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect((res.body as unknown[]).length).toBe(0);
    });

    it('user B sees no webhook endpoints (not user A data)', async () => {
      const res = await request(app.getHttpServer())
        .get('/webhooks/endpoints')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect((res.body as unknown[]).length).toBe(0);
    });

    it('user B sees no webhook events (not user A data)', async () => {
      const res = await request(app.getHttpServer())
        .get('/webhooks/events')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect((res.body as unknown[]).length).toBe(0);
    });

    it('user B sees no executions (not user A data)', async () => {
      const res = await request(app.getHttpServer())
        .get('/executions')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect((res.body as unknown[]).length).toBe(0);
    });

    it('user B cannot manually execute user A workflow -> 404', async () => {
      await request(app.getHttpServer())
        .post(`/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it('user B cannot read user A execution logs -> 404', async () => {
      await request(app.getHttpServer())
        .get(`/executions/${executionId}/logs`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it('webhook to user A endpoint does not trigger user B workflow', async () => {
      // user B: connection, endpoint, workflow with same github/push trigger
      const connBRes = await request(app.getHttpServer())
        .post('/integrations/connections')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ provider: 'github', name: 'B GitHub' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/webhooks/endpoints')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'B Hook', connectionId: connBRes.body.id })
        .expect(201);

      const wfRes = await request(app.getHttpServer())
        .post('/workflows')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          name: 'B Workflow',
          triggerProvider: 'github',
          triggerEvent: 'push',
          steps: [{ order: 1, type: 'log', config: { message: 'B step' } }],
        })
        .expect(201);
      workflowIdB = wfRes.body.id;

      // user A: create an unsigned connection + endpoint for this test
      const connARes = await request(app.getHttpServer())
        .post('/integrations/connections')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ provider: 'github', name: 'A Unsigned' })
        .expect(201);

      const epARes = await request(app.getHttpServer())
        .post('/webhooks/endpoints')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'A Hook Unsigned', connectionId: connARes.body.id })
        .expect(201);

      // send webhook to user A's unsigned endpoint
      await request(app.getHttpServer())
        .post(`/webhooks/github/${epARes.body.pathToken}`)
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', 'push')
        .set('X-GitHub-Delivery', 'isolation-test')
        .send(JSON.stringify({ ref: 'refs/heads/main' }))
        .expect(201);

      await new Promise((r) => setTimeout(r, 300));

      // user B must still have zero executions
      const res = await request(app.getHttpServer())
        .get('/executions')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const executions = res.body as Array<{ workflowId: string }>;
      const bTriggered = executions.some((e) => e.workflowId === workflowIdB);
      expect(bTriggered).toBe(false);
    });
  });
});

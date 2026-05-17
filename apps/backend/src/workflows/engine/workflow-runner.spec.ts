import { WorkflowRunner } from './workflow-runner.js';

function makePrisma() {
  return {
    workflowExecution: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    executionLog: {
      create: jest.fn(),
    },
  } as unknown as import('../../common/prisma.service.js').PrismaService;
}

function makeExecution(steps: { order: number; type: string; config: object }[]) {
  return {
    id: 'exec-1',
    workflowId: 'wf-1',
    workflow: {
      id: 'wf-1',
      steps: steps.map((s, i) => ({
        id: `step-${i + 1}`,
        order: s.order,
        type: s.type,
        config: s.config,
      })),
    },
  };
}

describe('WorkflowRunner', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let runner: WorkflowRunner;

  beforeEach(() => {
    prisma = makePrisma();
    runner = new WorkflowRunner(prisma);
  });

  it('does nothing when execution is not found', async () => {
    (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(null);
    await runner.run('missing-id');
    expect(prisma.workflowExecution.update).not.toHaveBeenCalled();
  });

  it('transitions status running -> success for a log step', async () => {
    const execution = makeExecution([{ order: 1, type: 'log', config: { message: 'Hello' } }]);
    (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
    (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
    (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

    await runner.run('exec-1');

    const calls = (prisma.workflowExecution.update as jest.Mock).mock.calls;
    expect(calls[0][0].data.status).toBe('running');
    expect(calls[1][0].data.status).toBe('success');
  });

  it('writes a log entry containing the step message', async () => {
    const execution = makeExecution([{ order: 1, type: 'log', config: { message: 'My message' } }]);
    (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
    (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
    (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

    await runner.run('exec-1');

    const messages: string[] = (prisma.executionLog.create as jest.Mock).mock.calls.map(
      (c) => c[0].data.message as string,
    );
    expect(messages.some((m) => m.includes('My message'))).toBe(true);
  });

  it('writes HTTP mock log for http_request_mock step', async () => {
    const execution = makeExecution([
      { order: 1, type: 'http_request_mock', config: { url: 'https://api.test', method: 'POST' } },
    ]);
    (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
    (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
    (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

    await runner.run('exec-1');

    const messages: string[] = (prisma.executionLog.create as jest.Mock).mock.calls.map(
      (c) => c[0].data.message as string,
    );
    expect(messages.some((m) => m.includes('HTTP mock') && m.includes('https://api.test'))).toBe(true);
  });

  it('transitions status running -> failed for an unknown step type', async () => {
    const execution = makeExecution([{ order: 1, type: 'totally_unknown', config: {} }]);
    (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
    (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
    (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

    await runner.run('exec-1');

    const calls = (prisma.workflowExecution.update as jest.Mock).mock.calls;
    const failCall = calls.find((c) => c[0].data.status === 'failed');
    expect(failCall).toBeDefined();
    expect(failCall[0].data.errorMessage).toContain('totally_unknown');
  });

  describe('http_request step', () => {
    beforeEach(() => {
      global.fetch = jest.fn() as jest.Mock;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('logs success and transitions to success for 2xx response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('{"ok":true}'),
      });
      const execution = makeExecution([
        { order: 1, type: 'http_request', config: { url: 'https://api.test', method: 'GET' } },
      ]);
      (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
      (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
      (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

      await runner.run('exec-1');

      const updates = (prisma.workflowExecution.update as jest.Mock).mock.calls;
      expect(updates.at(-1)[0].data.status).toBe('success');
      const messages: string[] = (prisma.executionLog.create as jest.Mock).mock.calls.map(
        (c) => c[0].data.message as string,
      );
      expect(messages.some((m) => m.includes('GET') && m.includes('200'))).toBe(true);
    });

    it('transitions to failed when response status is 500', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });
      const execution = makeExecution([
        { order: 1, type: 'http_request', config: { url: 'https://api.test/fail', method: 'POST' } },
      ]);
      (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
      (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
      (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

      await runner.run('exec-1');

      const updates = (prisma.workflowExecution.update as jest.Mock).mock.calls;
      const failCall = updates.find((c) => c[0].data.status === 'failed');
      expect(failCall).toBeDefined();
      expect(failCall[0].data.errorMessage).toContain('500');
    });

    it('transitions to failed when fetch throws a network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
      const execution = makeExecution([
        { order: 1, type: 'http_request', config: { url: 'https://invalid.invalid', method: 'GET' } },
      ]);
      (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
      (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
      (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

      await runner.run('exec-1');

      const updates = (prisma.workflowExecution.update as jest.Mock).mock.calls;
      const failCall = updates.find((c) => c[0].data.status === 'failed');
      expect(failCall).toBeDefined();
      expect(failCall[0].data.errorMessage).toContain('Failed to fetch');
    });

    it('transitions to failed for invalid URL', async () => {
      const execution = makeExecution([
        { order: 1, type: 'http_request', config: { url: 'not-a-url', method: 'GET' } },
      ]);
      (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
      (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
      (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

      await runner.run('exec-1');

      const updates = (prisma.workflowExecution.update as jest.Mock).mock.calls;
      const failCall = updates.find((c) => c[0].data.status === 'failed');
      expect(failCall).toBeDefined();
      expect(failCall[0].data.errorMessage).toContain('Invalid URL');
    });

    it('transitions to failed for disallowed protocol', async () => {
      const execution = makeExecution([
        { order: 1, type: 'http_request', config: { url: 'ftp://files.example.com', method: 'GET' } },
      ]);
      (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
      (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
      (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

      await runner.run('exec-1');

      const updates = (prisma.workflowExecution.update as jest.Mock).mock.calls;
      const failCall = updates.find((c) => c[0].data.status === 'failed');
      expect(failCall).toBeDefined();
      expect(failCall[0].data.errorMessage).toContain('Unsupported protocol');
    });

    it('transitions to failed for invalid method', async () => {
      const execution = makeExecution([
        { order: 1, type: 'http_request', config: { url: 'https://api.test', method: 'CONNECT' } },
      ]);
      (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
      (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
      (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

      await runner.run('exec-1');

      const updates = (prisma.workflowExecution.update as jest.Mock).mock.calls;
      const failCall = updates.find((c) => c[0].data.status === 'failed');
      expect(failCall).toBeDefined();
      expect(failCall[0].data.errorMessage).toContain('Invalid method');
    });

    it('truncates responsePreview at 200 chars', async () => {
      const longBody = 'x'.repeat(500);
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        text: () => Promise.resolve(longBody),
      });
      const execution = makeExecution([
        { order: 1, type: 'http_request', config: { url: 'https://api.test', method: 'GET' } },
      ]);
      (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
      (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
      (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

      await runner.run('exec-1');

      const logCalls = (prisma.executionLog.create as jest.Mock).mock.calls;
      const httpLog = logCalls.find((c) => (c[0].data.metadata as Record<string, unknown>)?.responsePreview !== undefined);
      const preview = (httpLog[0].data.metadata as Record<string, unknown>).responsePreview as string;
      expect(preview.length).toBeLessThanOrEqual(200);
    });
  });

  it('executes multiple steps in ascending order', async () => {
    const execution = makeExecution([
      { order: 1, type: 'log', config: { message: 'first' } },
      { order: 2, type: 'log', config: { message: 'second' } },
    ]);
    (prisma.workflowExecution.findUnique as jest.Mock).mockResolvedValue(execution);
    (prisma.workflowExecution.update as jest.Mock).mockResolvedValue({});
    (prisma.executionLog.create as jest.Mock).mockResolvedValue({});

    await runner.run('exec-1');

    const messages: string[] = (prisma.executionLog.create as jest.Mock).mock.calls.map(
      (c) => c[0].data.message as string,
    );
    const firstIdx = messages.findIndex((m) => m === 'first');
    const secondIdx = messages.findIndex((m) => m === 'second');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });
});

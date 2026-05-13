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

import { WorkflowsService } from './workflows.service.js';

function makePrisma(workflows: { id: string }[] = []) {
  return {
    workflow: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue(workflows),
      create: jest.fn(),
    },
    workflowExecution: {
      create: jest.fn().mockResolvedValue({ id: 'exec-1' }),
    },
  } as unknown as import('../common/prisma.service.js').PrismaService;
}

function makeQueue() {
  return {
    enqueueWorkflowExecution: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('./queue/in-memory-queue.service.js').InMemoryQueueService;
}

describe('WorkflowsService.triggerForEvent - user isolation', () => {
  it('enqueues an execution for each matching active workflow', async () => {
    const workflows = [{ id: 'wf-1' }, { id: 'wf-2' }];
    const prisma = makePrisma(workflows);
    const queue = makeQueue();
    const svc = new WorkflowsService(prisma, queue);

    await svc.triggerForEvent('event-1', 'user-A', 'github', 'push');

    expect(prisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-A',
          triggerProvider: 'github',
          triggerEvent: 'push',
          isActive: true,
        }),
      }),
    );
    expect(queue.enqueueWorkflowExecution).toHaveBeenCalledTimes(2);
  });

  it('does not enqueue when no workflows match', async () => {
    const prisma = makePrisma([]);
    const queue = makeQueue();
    const svc = new WorkflowsService(prisma, queue);

    await svc.triggerForEvent('event-1', 'user-A', 'github', 'push');

    expect(queue.enqueueWorkflowExecution).not.toHaveBeenCalled();
  });

  it('filters by userId so another user\'s workflows are not triggered', async () => {
    const prisma = makePrisma([]);
    const queue = makeQueue();
    const svc = new WorkflowsService(prisma, queue);

    await svc.triggerForEvent('event-1', 'user-B', 'github', 'push');

    const call = (prisma.workflow.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.userId).toBe('user-B');
  });
});

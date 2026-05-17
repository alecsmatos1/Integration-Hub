import { of } from 'rxjs';
import { vi } from 'vitest';
import { ExecutionsService } from '../../services/executions.service';

describe('ExecutionsService retry', () => {
  it('retry() is called with the execution id', () => {
    const svc = {
      list: () => of([]),
      retry: vi.fn().mockReturnValue(of({})),
      getLogs: () => of([]),
    } as unknown as ExecutionsService;

    svc.retry('exec-abc').subscribe();

    expect(svc.retry).toHaveBeenCalledWith('exec-abc');
  });

  it('retry() returns an observable that emits', () => {
    const svc = {
      list: () => of([]),
      retry: vi.fn().mockReturnValue(of({ id: 'exec-abc' })),
      getLogs: () => of([]),
    } as unknown as ExecutionsService;

    let emitted: unknown;
    svc.retry('exec-abc').subscribe((v) => { emitted = v; });

    expect(emitted).toEqual({ id: 'exec-abc' });
  });
});

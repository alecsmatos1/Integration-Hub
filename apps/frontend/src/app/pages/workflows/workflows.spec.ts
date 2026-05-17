import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Workflows } from './workflows';
import { WorkflowsService } from '../../services/workflows.service';

describe('Workflows component submit()', () => {
  let comp: Workflows;
  let svc: WorkflowsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), Workflows, WorkflowsService],
    });
    svc = TestBed.inject(WorkflowsService);
    vi.spyOn(svc, 'list').mockReturnValue(of([]));
    vi.spyOn(svc, 'create').mockReturnValue(of({} as import('../../services/workflows.service').Workflow));
    comp = TestBed.inject(Workflows);
  });

  it('sends log payload with message', () => {
    comp.form.name = 'My Log Workflow';
    comp.form.stepType = 'log';
    comp.form.logMessage = 'Hello world';
    comp.submit();

    expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [expect.objectContaining({ type: 'log', config: { message: 'Hello world' } })],
      }),
    );
  });

  it('sends http_request payload with url and method', () => {
    comp.form.name = 'HTTP Workflow';
    comp.form.stepType = 'http_request';
    comp.form.httpUrl = 'https://api.example.com/notify';
    comp.form.httpMethod = 'POST';
    comp.submit();

    expect(svc.create).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [
          expect.objectContaining({
            type: 'http_request',
            config: { url: 'https://api.example.com/notify', method: 'POST' },
          }),
        ],
      }),
    );
  });
});

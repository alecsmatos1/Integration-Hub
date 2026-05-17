import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardStatsService } from './dashboard-stats.service';
import { IntegrationsService } from './integrations.service';
import { WebhooksService } from './webhooks.service';
import { WorkflowsService } from './workflows.service';
import { ExecutionsService } from './executions.service';

function makeStubs() {
  return {
    integrations: { listConnections: () => of([{}, {}]) },
    webhooks: { listEndpoints: () => of([{}]), listEvents: () => of([{}, {}, {}]) },
    workflows: { list: () => of([{}]) },
    executions: { list: () => of([{}, {}, {}, {}]) },
  };
}

function buildTestBed(overrides: Partial<ReturnType<typeof makeStubs>> = {}) {
  const stubs = { ...makeStubs(), ...overrides };
  TestBed.configureTestingModule({
    providers: [
      DashboardStatsService,
      { provide: IntegrationsService, useValue: stubs.integrations },
      { provide: WebhooksService, useValue: stubs.webhooks },
      { provide: WorkflowsService, useValue: stubs.workflows },
      { provide: ExecutionsService, useValue: stubs.executions },
    ],
  });
  return TestBed.inject(DashboardStatsService);
}

describe('DashboardStatsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('starts with zero stats when cache is empty', () => {
    const svc = buildTestBed();
    expect(svc.stats().connections).toBe(0);
    expect(svc.loadState()).toBe('idle');
  });

  it('loads cached stats from localStorage on init', () => {
    localStorage.setItem('dashboard_stats', JSON.stringify({
      connections: 5, endpoints: 2, events: 10, workflows: 3, executions: 7,
    }));
    const svc = buildTestBed();
    expect(svc.stats().connections).toBe(5);
  });

  it('refresh() updates stats and sets loadState to idle on success', () => {
    const svc = buildTestBed();
    svc.refresh();
    expect(svc.loadState()).toBe('idle');
    expect(svc.stats().connections).toBe(2);
    expect(svc.stats().events).toBe(3);
    expect(svc.stats().executions).toBe(4);
  });

  it('refresh() sets loadState to error and keeps cached stats on failure', () => {
    localStorage.setItem('dashboard_stats', JSON.stringify({
      connections: 9, endpoints: 0, events: 0, workflows: 0, executions: 0,
    }));
    const svc = buildTestBed({
      integrations: { listConnections: () => throwError(() => new Error('Network error')) },
    });
    svc.refresh();
    expect(svc.loadState()).toBe('error');
    expect(svc.stats().connections).toBe(9);
  });
});

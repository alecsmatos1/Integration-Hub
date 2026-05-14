import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { IntegrationsService } from './integrations.service';
import { WebhooksService } from './webhooks.service';
import { WorkflowsService } from './workflows.service';
import { ExecutionsService } from './executions.service';

export interface DashboardStats {
  connections: number;
  endpoints: number;
  events: number;
  workflows: number;
  executions: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardStatsService {
  private integrations = inject(IntegrationsService);
  private webhooks = inject(WebhooksService);
  private workflows = inject(WorkflowsService);
  private executions = inject(ExecutionsService);

  private readonly STORAGE_KEY = 'dashboard_stats';

  readonly stats = signal<DashboardStats>(this.loadCache());

  private loadCache(): DashboardStats {
    const empty: DashboardStats = { connections: 0, endpoints: 0, events: 0, workflows: 0, executions: 0 };
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DashboardStats) : empty;
    } catch {
      return empty;
    }
  }

  private saveCache(stats: DashboardStats): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats));
  }

  refresh(): void {
    forkJoin({
      connections: this.integrations.listConnections(),
      endpoints: this.webhooks.listEndpoints(),
      events: this.webhooks.listEvents(),
      workflows: this.workflows.list(),
      executions: this.executions.list(),
    }).subscribe(({ connections, endpoints, events, workflows, executions }) => {
      const stats: DashboardStats = {
        connections: connections.length,
        endpoints: endpoints.length,
        events: events.length,
        workflows: workflows.length,
        executions: executions.length,
      };
      this.stats.set(stats);
      this.saveCache(stats);
    });
  }
}

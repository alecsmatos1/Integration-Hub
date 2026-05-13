import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IntegrationsService } from '../../services/integrations.service';
import { WebhooksService } from '../../services/webhooks.service';
import { WorkflowsService } from '../../services/workflows.service';
import { ExecutionsService } from '../../services/executions.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  auth = inject(AuthService);
  private integrations = inject(IntegrationsService);
  private webhooks = inject(WebhooksService);
  private workflows = inject(WorkflowsService);
  private executions = inject(ExecutionsService);

  stats = signal({ connections: 0, endpoints: 0, events: 0, workflows: 0, executions: 0 });

  ngOnInit() {
    this.integrations.listConnections().subscribe((c) =>
      this.stats.update((s) => ({ ...s, connections: c.length })),
    );
    this.webhooks.listEndpoints().subscribe((e) =>
      this.stats.update((s) => ({ ...s, endpoints: e.length })),
    );
    this.webhooks.listEvents().subscribe((e) =>
      this.stats.update((s) => ({ ...s, events: e.length })),
    );
    this.workflows.list().subscribe((w) =>
      this.stats.update((s) => ({ ...s, workflows: w.length })),
    );
    this.executions.list().subscribe((e) =>
      this.stats.update((s) => ({ ...s, executions: e.length })),
    );
  }
}

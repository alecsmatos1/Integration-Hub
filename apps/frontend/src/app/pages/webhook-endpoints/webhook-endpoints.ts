import { Component, inject, signal, OnInit } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WebhooksService, WebhookEndpoint } from '../../services/webhooks.service';
import { IntegrationsService, Connection } from '../../services/integrations.service';

@Component({
  selector: 'app-webhook-endpoints',
  imports: [FormsModule, SlicePipe],
  templateUrl: './webhook-endpoints.html',
  styleUrl: './webhook-endpoints.scss',
})
export class WebhookEndpoints implements OnInit {
  private webhooks = inject(WebhooksService);
  private integrations = inject(IntegrationsService);

  endpoints = signal<WebhookEndpoint[]>([]);
  connections = signal<Connection[]>([]);
  showForm = signal(false);
  error = signal('');
  loading = signal(false);

  form = { name: '', provider: 'github', connectionId: '' };
  webhookBase = 'http://localhost:3000/webhooks/github/';

  ngOnInit() {
    this.webhooks.listEndpoints().subscribe((e) => this.endpoints.set(e));
    this.integrations.listConnections().subscribe((c) => {
      this.connections.set(c);
      if (c.length > 0) this.form.connectionId = c[0].id;
    });
  }

  submit() {
    this.error.set('');
    this.loading.set(true);
    this.webhooks.createEndpoint(this.form).subscribe({
      next: () => {
        this.showForm.set(false);
        this.form = { name: '', provider: 'github', connectionId: this.connections()[0]?.id ?? '' };
        this.webhooks.listEndpoints().subscribe((e) => this.endpoints.set(e));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to create endpoint');
        this.loading.set(false);
      },
    });
  }

  copyUrl(pathToken: string) {
    navigator.clipboard.writeText(this.webhookBase + pathToken);
  }
}

import { Component, inject, signal, OnInit } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegrationsService, Connection, Provider } from '../../services/integrations.service';

@Component({
  selector: 'app-integrations',
  imports: [FormsModule, SlicePipe],
  templateUrl: './integrations.html',
  styleUrl: './integrations.scss',
})
export class Integrations implements OnInit {
  private svc = inject(IntegrationsService);

  providers = signal<Provider[]>([]);
  connections = signal<Connection[]>([]);
  showForm = signal(false);
  error = signal('');
  success = signal('');
  loading = signal(false);

  form = { provider: 'github', name: '', secret: '' };

  ngOnInit() {
    this.load();
  }

  load() {
    this.svc.listProviders().subscribe((p) => this.providers.set(p));
    this.svc.listConnections().subscribe((c) => this.connections.set(c));
  }

  statusBadge(status: string): string {
    const map: Record<string, string> = {
      success: 'badge-success', failed: 'badge-danger',
      running: 'badge-info', pending: 'badge-warning',
      error: 'badge-danger', warn: 'badge-warning',
      received: 'badge-success', processed: 'badge-success',
    };
    return map[status] ?? 'badge-neutral';
  }

  submit() {
    this.error.set('');
    this.success.set('');
    this.loading.set(true);
    this.svc
      .createConnection({ provider: this.form.provider, name: this.form.name, secret: this.form.secret || undefined })
      .subscribe({
        next: () => {
          this.success.set('Connection created');
          this.form = { provider: 'github', name: '', secret: '' };
          this.showForm.set(false);
          this.svc.listConnections().subscribe((c) => this.connections.set(c));
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to create connection');
          this.loading.set(false);
        },
      });
  }
}

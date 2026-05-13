import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WebhooksService, WebhookEvent } from '../../services/webhooks.service';

@Component({
  selector: 'app-webhook-events',
  imports: [DatePipe],
  templateUrl: './webhook-events.html',
  styleUrl: './webhook-events.scss',
})
export class WebhookEvents implements OnInit {
  private svc = inject(WebhooksService);
  events = signal<WebhookEvent[]>([]);
  loading = signal(true);
  error = signal('');
  providerFilter = signal('');

  ngOnInit() {
    this.load();
  }

  onProviderChange(e: Event) {
    this.providerFilter.set((e.target as HTMLSelectElement).value);
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.error.set('');
    const provider = this.providerFilter();
    this.svc.listEvents(provider ? { provider } : undefined).subscribe({
      next: (e) => { this.events.set(e); this.loading.set(false); },
      error: () => { this.error.set('Failed to load events.'); this.loading.set(false); },
    });
  }
}

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

  ngOnInit() {
    this.svc.listEvents().subscribe((e) => this.events.set(e));
  }
}

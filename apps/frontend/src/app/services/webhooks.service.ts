import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:3000';

export interface WebhookEndpoint {
  id: string;
  name: string;
  providerId: string;
  provider?: { name: string; displayName: string };
  pathToken: string;
  isActive: boolean;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  eventType: string;
  externalEventId?: string;
  normalizedPayload: {
    actor?: string;
    repository?: string;
    summary: string;
  };
  signatureValid: boolean;
  receivedAt: string;
}

@Injectable({ providedIn: 'root' })
export class WebhooksService {
  private http = inject(HttpClient);

  createEndpoint(data: { name: string; provider: string; connectionId: string }) {
    return this.http.post<WebhookEndpoint>(`${API}/webhooks/endpoints`, data);
  }

  listEndpoints() {
    return this.http.get<WebhookEndpoint[]>(`${API}/webhooks/endpoints`);
  }

  listEvents() {
    return this.http.get<WebhookEvent[]>(`${API}/webhooks/events`);
  }
}

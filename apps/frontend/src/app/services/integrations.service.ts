import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:3000';

export interface Provider {
  id: string;
  name: string;
  displayName: string;
}

export interface Connection {
  id: string;
  name: string;
  providerId: string;
  provider?: Provider;
  isActive: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class IntegrationsService {
  private http = inject(HttpClient);

  listProviders() {
    return this.http.get<Provider[]>(`${API}/integrations/providers`);
  }

  createConnection(data: { provider: string; name: string; secret?: string; config?: Record<string, unknown> }) {
    return this.http.post<Connection>(`${API}/integrations/connections`, data);
  }

  listConnections() {
    return this.http.get<Connection[]>(`${API}/integrations/connections`);
  }
}

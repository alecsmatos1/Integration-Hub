import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WorkflowExecution } from './workflows.service';
import { API_BASE_URL } from '../core/api.config';

const API = API_BASE_URL;

export interface ExecutionLog {
  id: string;
  executionId: string;
  stepId?: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ExecutionsService {
  private http = inject(HttpClient);

  list(filters?: { status?: string }) {
    const params: Record<string, string> = {};
    if (filters?.status) params['status'] = filters.status;
    return this.http.get<WorkflowExecution[]>(`${API}/executions`, { params });
  }

  retry(executionId: string) {
    return this.http.post<import('./workflows.service').WorkflowExecution>(`${API}/executions/${executionId}/retry`, {});
  }

  getLogs(executionId: string) {
    return this.http.get<ExecutionLog[]>(`${API}/executions/${executionId}/logs`);
  }
}

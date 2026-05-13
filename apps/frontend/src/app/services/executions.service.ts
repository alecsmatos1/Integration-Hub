import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WorkflowExecution } from './workflows.service';

const API = 'http://localhost:3000';

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

  list() {
    return this.http.get<WorkflowExecution[]>(`${API}/executions`);
  }

  getLogs(executionId: string) {
    return this.http.get<ExecutionLog[]>(`${API}/executions/${executionId}/logs`);
  }
}

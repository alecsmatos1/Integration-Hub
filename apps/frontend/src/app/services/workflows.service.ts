import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../core/api.config';

const API = API_BASE_URL;

export interface WorkflowStep {
  id: string;
  order: number;
  type: string;
  provider?: string;
  action?: string;
  config?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  triggerProvider: string;
  triggerEvent: string;
  isActive: boolean;
  steps: WorkflowStep[];
  createdAt: string;
}

export interface CreateWorkflowDto {
  name: string;
  triggerProvider: string;
  triggerEvent: string;
  steps: { order: number; type: string; config?: Record<string, unknown> }[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflow?: { name: string };
  status: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkflowsService {
  private http = inject(HttpClient);

  create(dto: CreateWorkflowDto) {
    return this.http.post<Workflow>(`${API}/workflows`, dto);
  }

  list() {
    return this.http.get<Workflow[]>(`${API}/workflows`);
  }

  execute(workflowId: string) {
    return this.http.post<WorkflowExecution>(`${API}/workflows/${workflowId}/execute`, {});
  }
}

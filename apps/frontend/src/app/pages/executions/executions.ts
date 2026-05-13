import { Component, inject, signal, OnInit } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExecutionsService } from '../../services/executions.service';
import { WorkflowExecution } from '../../services/workflows.service';

const STATUSES = ['', 'pending', 'running', 'success', 'failed'] as const;

@Component({
  selector: 'app-executions',
  imports: [RouterLink, SlicePipe],
  templateUrl: './executions.html',
  styleUrl: './executions.scss',
})
export class Executions implements OnInit {
  private svc = inject(ExecutionsService);
  executions = signal<WorkflowExecution[]>([]);
  loading = signal(true);
  error = signal('');
  retryingId = signal<string | null>(null);
  statusFilter = signal('');
  readonly statuses = STATUSES;

  ngOnInit() {
    this.load();
  }

  onStatusChange(e: Event) {
    this.statusFilter.set((e.target as HTMLSelectElement).value);
    this.load();
  }

  retry(executionId: string) {
    this.retryingId.set(executionId);
    this.svc.retry(executionId).subscribe({
      next: () => { this.retryingId.set(null); this.load(); },
      error: () => this.retryingId.set(null),
    });
  }

  private load() {
    this.loading.set(true);
    this.error.set('');
    const status = this.statusFilter();
    this.svc.list(status ? { status } : undefined).subscribe({
      next: (e) => { this.executions.set(e); this.loading.set(false); },
      error: () => { this.error.set('Failed to load executions.'); this.loading.set(false); },
    });
  }
}

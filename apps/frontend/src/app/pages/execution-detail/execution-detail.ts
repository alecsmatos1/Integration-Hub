import { Component, inject, signal, OnInit } from '@angular/core';
import { JsonPipe, SlicePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExecutionsService, ExecutionLog } from '../../services/executions.service';

@Component({
  selector: 'app-execution-detail',
  imports: [RouterLink, JsonPipe, SlicePipe],
  templateUrl: './execution-detail.html',
  styleUrl: './execution-detail.scss',
})
export class ExecutionDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private svc = inject(ExecutionsService);

  executionId = signal('');
  logs = signal<ExecutionLog[]>([]);
  loading = signal(true);

  logRowClass(level: string): string {
    const map: Record<string, string> = {
      error: 'error', warn: 'warn', success: 'success', info: 'info',
    };
    return map[level] ?? 'info';
  }

  logBadgeClass(level: string): string {
    const map: Record<string, string> = {
      error: 'badge-danger', warn: 'badge-warning',
      success: 'badge-success', info: 'badge-neutral',
    };
    return map[level] ?? 'badge-neutral';
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.executionId.set(id);
    this.svc.getLogs(id).subscribe({
      next: (logs) => {
        this.logs.set(logs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

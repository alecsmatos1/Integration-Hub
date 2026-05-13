import { Component, inject, signal, OnInit } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowsService, Workflow } from '../../services/workflows.service';

@Component({
  selector: 'app-workflows',
  imports: [FormsModule, SlicePipe],
  templateUrl: './workflows.html',
  styleUrl: './workflows.scss',
})
export class Workflows implements OnInit {
  private svc = inject(WorkflowsService);

  workflows = signal<Workflow[]>([]);
  showForm = signal(false);
  error = signal('');
  success = signal('');
  loading = signal(false);
  executing = signal<string | null>(null);

  form = {
    name: '',
    triggerProvider: 'github',
    triggerEvent: 'push',
    stepType: 'log' as 'log' | 'http_request_mock',
    logMessage: 'Step executed',
    httpUrl: 'https://example.com',
    httpMethod: 'POST',
  };

  ngOnInit() {
    this.load();
  }

  load() {
    this.svc.list().subscribe((w) => this.workflows.set(w));
  }

  submit() {
    this.error.set('');
    this.success.set('');
    this.loading.set(true);

    const config: Record<string, unknown> =
      this.form.stepType === 'log'
        ? { message: this.form.logMessage }
        : { url: this.form.httpUrl, method: this.form.httpMethod };

    this.svc
      .create({
        name: this.form.name,
        triggerProvider: this.form.triggerProvider,
        triggerEvent: this.form.triggerEvent,
        steps: [{ order: 1, type: this.form.stepType, config }],
      })
      .subscribe({
        next: () => {
          this.success.set('Workflow created');
          this.showForm.set(false);
          this.form = { name: '', triggerProvider: 'github', triggerEvent: 'push', stepType: 'log', logMessage: 'Step executed', httpUrl: 'https://example.com', httpMethod: 'POST' };
          this.load();
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to create workflow');
          this.loading.set(false);
        },
      });
  }

  execute(id: string) {
    this.executing.set(id);
    this.svc.execute(id).subscribe({
      next: () => {
        this.executing.set(null);
        this.success.set('Execution started');
      },
      error: () => this.executing.set(null),
    });
  }
}

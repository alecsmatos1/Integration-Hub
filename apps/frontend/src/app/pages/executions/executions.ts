import { Component, inject, signal, OnInit } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExecutionsService } from '../../services/executions.service';
import { WorkflowExecution } from '../../services/workflows.service';

@Component({
  selector: 'app-executions',
  imports: [RouterLink, SlicePipe],
  templateUrl: './executions.html',
  styleUrl: './executions.scss',
})
export class Executions implements OnInit {
  private svc = inject(ExecutionsService);
  executions = signal<WorkflowExecution[]>([]);

  ngOnInit() {
    this.svc.list().subscribe((e) => this.executions.set(e));
  }
}

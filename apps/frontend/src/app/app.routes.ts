import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  { path: 'register', loadComponent: () => import('./pages/register/register').then((m) => m.Register) },
  {
    path: '',
    loadComponent: () => import('./layout/layout').then((m) => m.Layout),
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'integrations', loadComponent: () => import('./pages/integrations/integrations').then((m) => m.Integrations) },
      { path: 'webhook-endpoints', loadComponent: () => import('./pages/webhook-endpoints/webhook-endpoints').then((m) => m.WebhookEndpoints) },
      { path: 'webhook-events', loadComponent: () => import('./pages/webhook-events/webhook-events').then((m) => m.WebhookEvents) },
      { path: 'workflows', loadComponent: () => import('./pages/workflows/workflows').then((m) => m.Workflows) },
      { path: 'executions', loadComponent: () => import('./pages/executions/executions').then((m) => m.Executions) },
      { path: 'executions/:id', loadComponent: () => import('./pages/execution-detail/execution-detail').then((m) => m.ExecutionDetail) },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

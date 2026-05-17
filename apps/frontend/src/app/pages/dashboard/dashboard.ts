import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  auth = inject(AuthService);
  private dashboardStats = inject(DashboardStatsService);

  stats = this.dashboardStats.stats;
  loadState = this.dashboardStats.loadState;

  ngOnInit() {
    this.dashboardStats.refresh();
  }
}

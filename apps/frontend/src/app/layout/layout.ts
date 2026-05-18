import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  auth = inject(AuthService);

  initials = computed(() => {
    const user = this.auth.user();
    const name = user?.name ?? user?.email ?? 'U';
    return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  });

  logout() {
    this.auth.logout();
  }
}

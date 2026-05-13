import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { API_BASE_URL } from './api.config';

const API = API_BASE_URL;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user = signal<AuthUser | null>(this.loadUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem('user');
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  register(email: string, password: string, name: string) {
    return this.http.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
      `${API}/auth/register`,
      { email, password, name },
    ).pipe(tap((res) => this.saveSession(res)));
  }

  login(email: string, password: string) {
    return this.http.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
      `${API}/auth/login`,
      { email, password },
    ).pipe(tap((res) => this.saveSession(res)));
  }

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private saveSession(res: { accessToken: string; refreshToken: string; user: AuthUser }) {
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    this._user.set(res.user);
  }
}

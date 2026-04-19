import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, switchMap, catchError, of } from 'rxjs';
import { TokenService } from './token.service';
import { AuthStore, SessionUser } from './auth.store';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private tokens = inject(TokenService);
  private store = inject(AuthStore);
  private router = inject(Router);

  login(data: { username: string; password: string }) {
    const body = new URLSearchParams();
    body.set('username', data.username);
    body.set('password', data.password);

    return this.http.post<{ access_token: string; token_type: string }>(
      `${API}/auth/login`,
      body.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        withCredentials: true, // necesario para recibir la cookie refresh_token
      }
    ).pipe(tap(res => this.tokens.setAccess(res.access_token)));
  }

  me() {
    return this.http.get<SessionUser>(`${API}/auth/me`).pipe(
      tap(user => {
        if (user && user.rol && !user.roles) user.roles = [user.rol];
        this.store.setUser(user);
      })
    );
  }

  /**
   * Intenta restaurar la sesión al iniciar la app usando el refresh token (cookie HttpOnly).
   * Si el refresh falla, la sesión queda vacía sin redirigir — el guard lo manejará.
   */
  tryRestoreSession() {
    return this.http.post<{ access_token: string }>(
      `${API}/auth/refresh`,
      {},
      { withCredentials: true }
    ).pipe(
      tap(res => this.tokens.setAccess(res.access_token)),
      switchMap(() => this.me()),
      catchError(() => of(null)), // sin sesión válida → continúa sin usuario
    );
  }

  logout() {
    this.http.post(`${API}/auth/logout`, {}, { withCredentials: true }).subscribe({
      complete: () => {
        this.tokens.clear();
        this.store.clear();
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.tokens.clear();
        this.store.clear();
        this.router.navigateByUrl('/login');
      }
    });
  }

  forgotPassword(email: string, codigo_seguridad: string) {
    return this.http.post<{ message: string }>(`${API}/auth/forgot-password`, {
      email,
      codigo_seguridad
    });
  }

  resetPassword(token: string, new_password: string) {
    return this.http.post<{ message: string }>(`${API}/auth/reset-password`, {
      token,
      new_password
    });
  }
}

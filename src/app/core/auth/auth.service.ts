import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
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
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
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

  logout() {
    this.tokens.clear();
    this.store.clear();
    this.router.navigateByUrl('/login');
  }
}

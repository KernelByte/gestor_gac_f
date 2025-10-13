import { Injectable, signal } from '@angular/core';
const ACCESS_KEY = 'access_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private _access = signal<string | null>(localStorage.getItem(ACCESS_KEY));

  accessToken() { return this._access(); }
  hasToken() { return !!this._access(); }

  setAccess(token: string) {
    this._access.set(token);
    localStorage.setItem(ACCESS_KEY, token);
  }

  clear() {
    this._access.set(null);
    localStorage.removeItem(ACCESS_KEY);
  }
}

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenService {
  // Token en memoria — no persiste en localStorage (protegido contra XSS)
  private _access = signal<string | null>(null);

  accessToken() { return this._access(); }
  hasToken() { return !!this._access(); }

  setAccess(token: string) {
    this._access.set(token);
  }

  clear() {
    this._access.set(null);
  }
}

import { Injectable, computed, signal } from '@angular/core';

export interface SessionUser {
  id: number | string;
  username: string;
  nombre?: string;
  rol?: string;     // un solo rol desde backend
  roles?: string[];  // por si luego se devuelven múltiples
  id_usuario_publicador?: number | null;
  id_congregacion?: number | null;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private _user = signal<SessionUser | null>(null);

  user = computed(() => this._user());
  isLoggedIn = computed(() => !!this._user());

  setUser(u: SessionUser | null) { this._user.set(u); }
  clear() { this._user.set(null); }
}

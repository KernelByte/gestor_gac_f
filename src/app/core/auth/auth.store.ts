import { Injectable, computed, signal } from '@angular/core';

export interface SessionUser {
  id: number | string;
  username: string;
  nombre?: string;
  correo?: string;
  rol?: string;     // un solo rol desde backend
  roles?: string[];  // por si luego se devuelven múltiples
  id_usuario_publicador?: number | null;
  id_congregacion?: number | null;
  permisos?: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private _user = signal<SessionUser | null>(null);

  user = computed(() => this._user());
  isLoggedIn = computed(() => !!this._user());

  setUser(u: SessionUser | null) { this._user.set(u); }
  clear() { this._user.set(null); }

  hasPermission(cod: string): boolean {
    const u = this._user();
    if (!u) return false;
    if (u.rol === 'Administrador' || u.roles?.includes('Administrador')) return true;
    return u.permisos?.includes(cod) ?? false;
  }
}

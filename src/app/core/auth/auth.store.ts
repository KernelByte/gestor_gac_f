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
  id_grupo_publicador?: number | null;
  permisos?: string[];
  debe_cambiar_contrasena?: boolean;
}

export const ROL_ADMINISTRADOR = 'Administrador';
export const ROL_GESTOR = 'Gestor Aplicación';

/**
 * Roles con los que cuenta el usuario al comprobar una lista de roles, en
 * minúsculas. Espejo de `roles_efectivos` (backend, core/roles.py).
 *
 * El Gestor Aplicación es un rol DE CONGREGACIÓN: un publicador que además
 * gestiona usuarios y permisos. Como el rol es único por usuario, cuenta
 * también como 'Publicador' para no perder su informe ni sus asignaciones.
 */
export function rolesEfectivosDe(u: SessionUser | null): string[] {
  if (!u) return [];
  const base = (u.roles ?? (u.rol ? [u.rol] : [])).map(r => r.trim().toLowerCase());
  if (base.includes(ROL_GESTOR.toLowerCase()) && !base.includes('publicador')) {
    base.push('publicador');
  }
  return base;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private _user = signal<SessionUser | null>(null);

  user = computed(() => this._user());
  isLoggedIn = computed(() => !!this._user());
  rolesEfectivos = computed(() => rolesEfectivosDe(this._user()));

  setUser(u: SessionUser | null) { this._user.set(u); }
  clear() { this._user.set(null); }

  /** Comparación sin distinguir mayúsculas, con los roles efectivos. */
  hasRole(rol: string): boolean {
    return this.rolesEfectivos().includes(rol.trim().toLowerCase());
  }

  /** Único rol global (sin congregación). */
  isAdministrador(): boolean {
    return this.hasRole(ROL_ADMINISTRADOR);
  }

  /** Gestor de la congregación: gestiona usuarios y permisos de la suya. */
  isGestor(): boolean {
    return this.hasRole(ROL_GESTOR);
  }

  hasPermission(cod: string): boolean {
    const u = this._user();
    if (!u) return false;
    // Solo el Administrador lo ve todo. El Gestor ve los módulos de los
    // permisos que tenga (que puede asignarse a sí mismo).
    if (this.isAdministrador()) return true;
    return u.permisos?.includes(cod) ?? false;
  }
}

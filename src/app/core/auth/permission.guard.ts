import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from './auth.store';

/**
 * Guard que autoriza la ruta si el usuario tiene AL MENOS UNO de los permisos listados
 * en `data.permissions`. Administrador siempre pasa (ver `AuthStore.hasPermission`).
 * Si no cumple, redirige al dashboard principal.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  const required: string[] = route.data?.['permissions'] ?? [];
  if (!store.user()) return router.createUrlTree(['/login']);
  if (required.length === 0) return true;

  const ok = required.some(p => store.hasPermission(p));
  return ok ? true : router.createUrlTree(['/']);
};

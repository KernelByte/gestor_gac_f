import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from './auth.store';

/**
 * Autoriza la ruta si el usuario tiene ALGUNO de los roles de `data.roles`
 * (roles efectivos: el Gestor cuenta también como Publicador) O alguno de los
 * permisos de `data.permissions`. Es el espejo de `permiso_o_rol_requerido`
 * del backend: sin él, el menú mostraba enlaces por permiso que la ruta,
 * protegida solo por rol, rechazaba.
 */
export const rolOPermisoGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (!store.user()) return router.createUrlTree(['/login']);

  const roles: string[] = route.data?.['roles'] ?? [];
  const permisos: string[] = route.data?.['permissions'] ?? [];
  const ok = roles.some(r => store.hasRole(r)) || permisos.some(p => store.hasPermission(p));
  return ok ? true : router.createUrlTree(['/']);
};

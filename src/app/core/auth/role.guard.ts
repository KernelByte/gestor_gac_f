import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore, rolesEfectivosDe } from './auth.store';

export const roleGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  const allowed: string[] = route.data?.['roles'] ?? [];
  const user = store.user();

  if (!user) return router.createUrlTree(['/login']);

  // Roles efectivos: el Gestor Aplicación cuenta también como Publicador.
  const userRoles = rolesEfectivosDe(user);

  const ok = allowed.length === 0 || allowed.some(r => userRoles.includes(r.toLowerCase()));

  return ok ? true : router.createUrlTree(['/']);
};

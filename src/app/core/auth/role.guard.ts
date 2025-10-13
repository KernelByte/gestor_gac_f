import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from './auth.store';

export const roleGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  const allowed: string[] = route.data?.['roles'] ?? [];
  const user = store.user();

  if (!user) return router.createUrlTree(['/login']);

  const userRoles = (user.roles ?? (user.rol ? [user.rol] : []))
    .map(r => r.toLowerCase());

  const ok = allowed.length === 0 || allowed.some(r => userRoles.includes(r.toLowerCase()));

  return ok ? true : router.createUrlTree(['/']);
};

import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from './auth.store';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const tokens = inject(TokenService);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (store.isLoggedIn()) return true;
  
  if (!tokens.hasToken()) return router.createUrlTree(['/login']);

  return auth.me().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};

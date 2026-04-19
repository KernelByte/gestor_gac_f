import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TokenService } from '../auth/token.service';
import { catchError, switchMap, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

// URLs que NO deben activar el refresh (evita loops infinitos)
const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout'];

function addAuth(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const http = inject(HttpClient);

  const isNoRefresh = NO_REFRESH_URLS.some(url => req.url.includes(url));
  const authReq = addAuth(req, tokenService.accessToken());

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Solo intentar refresh en 401 y si no es una URL excluida
      if (err.status !== 401 || isNoRefresh) {
        if (err.status === 401) {
          tokenService.clear();
          router.navigateByUrl('/login');
        }
        return throwError(() => err);
      }

      // Intentar renovar el access token usando la cookie HttpOnly de refresh
      return http.post<{ access_token: string }>(
        `${API}/auth/refresh`,
        {},
        { withCredentials: true }
      ).pipe(
        switchMap(res => {
          tokenService.setAccess(res.access_token);
          // Reintentar la request original con el nuevo token
          return next(addAuth(req, res.access_token));
        }),
        catchError(() => {
          // Refresh falló (expirado, revocado) → logout total
          tokenService.clear();
          router.navigateByUrl('/login');
          return throwError(() => err);
        })
      );
    })
  );
};

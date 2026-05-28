import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TokenService } from '../auth/token.service';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

// URLs que NO deben activar el refresh (evita loops infinitos)
const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout'];

// Estado compartido para gestionar solicitudes concurrentes de refresh
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

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
      // Función para manejar el cierre de sesión sin interrumpir rutas públicas
      const handleLogoutRedirect = () => {
        tokenService.clear();
        const path = window.location.pathname;
        const isPublicRoute = path.startsWith('/public/') || path.startsWith('/auth/') || path === '/login';
        if (!isPublicRoute) {
          router.navigateByUrl('/login');
        }
      };

      // Solo intentar refresh en 401 y si no es una URL excluida
      // Para URLs excluidas (login, refresh, logout), el guard maneja el redirect
      if (err.status !== 401 || isNoRefresh) {
        return throwError(() => err);
      }

      // Si ya hay un refresco en curso, nos encolamos esperando al nuevo token
      if (isRefreshing) {
        return refreshTokenSubject.pipe(
          filter(token => token !== null || !isRefreshing), // Emitir si hay token o el proceso falló
          take(1),
          switchMap(token => {
            if (!token) {
              return throwError(() => err); // Propagar el error 401 original
            }
            return next(addAuth(req, token));
          })
        );
      }

      // Iniciamos el proceso de refresco (solo la primera petición entra aquí)
      isRefreshing = true;
      refreshTokenSubject.next(null); // Limpiar emisiones anteriores

      // Intentar renovar el access token usando la cookie HttpOnly de refresh
      return http.post<{ access_token: string }>(
        `${API}/auth/refresh`,
        {},
        { withCredentials: true }
      ).pipe(
        switchMap(res => {
          isRefreshing = false;
          tokenService.setAccess(res.access_token);
          refreshTokenSubject.next(res.access_token); // Desbloquear peticiones en cola con el nuevo token

          // Reintentar la request original con el nuevo token
          return next(addAuth(req, res.access_token));
        }),
        catchError((refreshErr) => {
          isRefreshing = false;
          refreshTokenSubject.next(null); // Desbloquear peticiones en cola indicando fallo

          // Refresh falló (expirado, revocado) → logout total
          handleLogoutRedirect();
          return throwError(() => refreshErr);
        })
      );
    })
  );
};


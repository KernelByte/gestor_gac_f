import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';

/**
 * Permisos del módulo, uno por pestaña de gestión (mismo patrón que Reuniones).
 * 'exhibidores.ver' es el de solo lectura: da acceso al calendario y nada más.
 */
export const PERMISOS_EXHIBIDORES = [
  'exhibidores.ver',
  'exhibidores.programacion',
  'exhibidores.ubicaciones',
  'exhibidores.participantes',
  'exhibidores.configuracion',
] as const;

/** Lectura: cualquier usuario con acceso a alguna parte del módulo. */
const verGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (PERMISOS_EXHIBIDORES.some(p => store.hasPermission(p))) return true;
  return inject(Router).createUrlTree(['/']);
};

/**
 * Gestión: exige el permiso de esa pestaña concreta. Quien tenga acceso a otra
 * parte del módulo cae al calendario en vez de a la raíz — así no se le expulsa
 * del módulo por entrar a una URL que no le toca.
 */
function guardGestion(permiso: string): CanActivateFn {
  return () => {
    const store = inject(AuthStore);
    if (store.hasPermission(permiso)) return true;
    const router = inject(Router);
    if (PERMISOS_EXHIBIDORES.some(p => store.hasPermission(p))) {
      return router.createUrlTree(['/exhibidores/calendario']);
    }
    return router.createUrlTree(['/']);
  };
}

export const EXHIBIDORES_ROUTES: Routes = [
  { path: '', redirectTo: 'programacion', pathMatch: 'full' },
  {
    path: 'programacion',
    title: 'Programación de Exhibidores',
    canActivate: [guardGestion('exhibidores.programacion')],
    loadComponent: () => import('./pages/programacion.page').then(m => m.ProgramacionExhibidoresPage),
  },
  {
    path: 'ubicaciones',
    title: 'Ubicaciones de Exhibidores',
    canActivate: [guardGestion('exhibidores.ubicaciones')],
    loadComponent: () => import('./pages/ubicaciones.page').then(m => m.UbicacionesExhibidoresPage),
  },
  {
    path: 'participantes',
    title: 'Participantes de Exhibidores',
    canActivate: [guardGestion('exhibidores.participantes')],
    loadComponent: () => import('./pages/participantes.page').then(m => m.ParticipantesExhibidoresPage),
  },
  {
    path: 'configuracion',
    title: 'Configuración de Exhibidores',
    canActivate: [guardGestion('exhibidores.configuracion')],
    loadComponent: () => import('./pages/configuracion.page').then(m => m.ConfiguracionExhibidoresPage),
  },
  {
    path: 'calendario',
    title: 'Calendario de Exhibidores',
    canActivate: [verGuard],
    loadComponent: () => import('./pages/calendario.page').then(m => m.CalendarioExhibidoresPage),
  },
];

import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';

const generalReunionesGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (
    store.hasPermission('reuniones.ver') ||
    store.hasPermission('reuniones.entre_semana') ||
    store.hasPermission('reuniones.fin_semana') ||
    store.hasPermission('reuniones.logistica') ||
    store.hasPermission('reuniones.discursos') ||
    store.hasPermission('reuniones.asistencia') ||
    store.hasPermission('reuniones.configuracion') ||
    store.user()?.roles?.includes('Secretario')
  ) return true;
  return inject(Router).createUrlTree(['/']);
};

const programacionGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (
    store.hasPermission('reuniones.entre_semana') ||
    store.hasPermission('reuniones.fin_semana') ||
    store.hasPermission('reuniones.logistica') ||
    store.hasPermission('reuniones.discursos') ||
    store.user()?.roles?.includes('Secretario')
  ) return true;
  return inject(Router).createUrlTree(['/reuniones']);
};

const asistenciaGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (store.hasPermission('reuniones.asistencia') || store.user()?.roles?.includes('Secretario')) return true;
  return inject(Router).createUrlTree(['/reuniones']);
};

const configuracionGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (store.hasPermission('reuniones.configuracion') || store.user()?.roles?.includes('Secretario')) return true;
  return inject(Router).createUrlTree(['/reuniones']);
};

export const REUNIONES_ROUTES: Routes = [
  { path: '', redirectTo: 'resumen', pathMatch: 'full' },
  {
    path: 'resumen',
    title: 'Resumen Hoy',
    canActivate: [generalReunionesGuard],
    loadComponent: () => import('./components/reuniones-resumen.component').then(m => m.ReunionesResumenComponent)
  },
  {
    path: 'asistencia',
    title: 'Asistencia Reuniones',
    canActivate: [asistenciaGuard],
    loadComponent: () => import('./components/reuniones-asistencia.component').then(m => m.ReunionesAsistenciaComponent)
  },
  {
    path: 'programacion',
    title: 'Programación de Reuniones',
    canActivate: [programacionGuard],
    loadComponent: () => import('./components/reuniones-entre-semana.component').then(m => m.ReunionesProgramacionComponent)
  },
  // Backward-compatible redirects
  { path: 'entre-semana', redirectTo: 'programacion', pathMatch: 'full' },
  { path: 'fin-semana', redirectTo: 'programacion', pathMatch: 'full' },
  {
    path: 'configuracion',
    title: 'Configuración de Reuniones',
    canActivate: [configuracionGuard],
    loadComponent: () => import('./components/reuniones-configuracion-plantillas.component').then(m => m.ReunionesConfiguracionPlantillasComponent)
  }
];

import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';

const generalReunionesGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (store.hasPermission('reuniones.ver') || 
      store.hasPermission('reuniones.entre_semana_ver') || 
      store.hasPermission('reuniones.fin_semana_ver') || 
      store.hasPermission('reuniones.asistencia_ver') || 
      store.hasPermission('reuniones.configuracion_ver') || 
      store.user()?.roles?.includes('Secretario')) return true;
  return inject(Router).createUrlTree(['/']);
};

const entreSemanaGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (store.hasPermission('reuniones.ver') || store.hasPermission('reuniones.entre_semana_ver') || store.user()?.roles?.includes('Secretario')) return true;
  return inject(Router).createUrlTree(['/reuniones']);
};

const finSemanaGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (store.hasPermission('reuniones.ver') || store.hasPermission('reuniones.fin_semana_ver') || store.user()?.roles?.includes('Secretario')) return true;
  return inject(Router).createUrlTree(['/reuniones']);
};

const asistenciaGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (store.hasPermission('reuniones.ver') || store.hasPermission('reuniones.asistencia_ver') || store.user()?.roles?.includes('Secretario')) return true;
  return inject(Router).createUrlTree(['/reuniones']);
};

const configuracionGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  if (store.hasPermission('reuniones.ver') || store.hasPermission('reuniones.configuracion_ver') || store.user()?.roles?.includes('Secretario')) return true;
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
    path: 'entre-semana',
    title: 'Reunión Vida y Ministerio',
    canActivate: [entreSemanaGuard],
    loadComponent: () => import('./components/reuniones-entre-semana.component').then(m => m.ReunionesEntreSemanaComponent)
  },
  {
    path: 'fin-semana',
    title: 'Reunión de Fin de Semana',
    canActivate: [finSemanaGuard],
    loadComponent: () => import('./components/reuniones-fin-semana.component').then(m => m.ReunionesFinSemanaComponent)
  },
  {
    path: 'configuracion',
    title: 'Configuración de Reuniones',
    canActivate: [configuracionGuard],
    loadComponent: () => import('./components/reuniones-configuracion-plantillas.component').then(m => m.ReunionesConfiguracionPlantillasComponent)
  }
];

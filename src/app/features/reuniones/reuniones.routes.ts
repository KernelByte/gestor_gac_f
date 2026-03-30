import { Routes } from '@angular/router';

export const REUNIONES_ROUTES: Routes = [
  { path: '', redirectTo: 'resumen', pathMatch: 'full' },
  {
    path: 'resumen',
    title: 'Resumen Hoy',
    loadComponent: () => import('./components/reuniones-resumen.component').then(m => m.ReunionesResumenComponent)
  },
  {
    path: 'asistencia',
    title: 'Asistencia Reuniones',
    loadComponent: () => import('./components/reuniones-asistencia.component').then(m => m.ReunionesAsistenciaComponent)
  },
  {
    path: 'entre-semana',
    title: 'Reunión Vida y Ministerio',
    loadComponent: () => import('./components/reuniones-entre-semana.component').then(m => m.ReunionesEntreSemanaComponent)
  },
  {
    path: 'fin-semana',
    title: 'Reunión de Fin de Semana',
    loadComponent: () => import('./components/reuniones-fin-semana.component').then(m => m.ReunionesFinSemanaComponent)
  },
  {
    path: 'configuracion',
    title: 'Configuración de Reuniones',
    loadComponent: () => import('./components/reuniones-configuracion-plantillas.component').then(m => m.ReunionesConfiguracionPlantillasComponent)
  }
];

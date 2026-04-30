import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission.guard';

export const REPORTES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'precursores' },
  {
    path: 'precursores',
    title: 'Análisis Precursores',
    canActivate: [permissionGuard],
    data: { permissions: ['reportes.precursores'] },
    loadComponent: () =>
      import('./pages/precursores/precursores.page').then(m => m.PrecursoresPage),
  },
  {
    path: 'publicadores',
    title: 'Análisis Publicadores',
    canActivate: [permissionGuard],
    data: { permissions: ['reportes.publicadores'] },
    loadComponent: () =>
      import('./pages/publicadores/publicadores.page').then(m => m.PublicadoresPage),
  },
  {
    path: 'predicacion',
    title: 'Análisis Predicación',
    canActivate: [permissionGuard],
    data: { permissions: ['reportes.predicacion'] },
    loadComponent: () =>
      import('./pages/predicacion/predicacion.page').then(m => m.PredicacionPage),
  },
];

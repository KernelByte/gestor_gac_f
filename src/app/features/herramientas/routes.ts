import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission.guard';

export const HERRAMIENTAS_ROUTES: Routes = [
  {
    path: 'mis-tareas',
    title: 'Mis Tareas',
    canActivate: [permissionGuard],
    data: { permissions: ['tareas.ver'] },
    loadComponent: () => import('./mis-tareas/pages/mis-tareas.page').then(m => m.MisTareasPage)
  },
  {
    path: 'tareas/:id',
    title: 'Detalle de tarea',
    loadComponent: () => import('../secretario-tools/tareas/pages/tarea-detail.page').then(m => m.TareaDetailPage)
  },
  { path: '', redirectTo: 'mis-tareas', pathMatch: 'full' }
];

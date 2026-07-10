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
  {
    path: 'visita-colaborador',
    title: 'Visita del circuito',
    // Sin guard de rol/permiso: cualquier usuario autenticado puede entrar;
    // la página solo muestra las visitas donde fue invitado como colaborador.
    loadComponent: () => import('./visita-colaborador/pages/visita-colaborador.page').then(m => m.VisitaColaboradorPage)
  },
  { path: '', redirectTo: 'mis-tareas', pathMatch: 'full' }
];

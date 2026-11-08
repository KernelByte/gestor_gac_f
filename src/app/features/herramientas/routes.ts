import { Routes } from '@angular/router';

export const HERRAMIENTAS_ROUTES: Routes = [
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
  { path: '', redirectTo: '/agenda', pathMatch: 'full' }
];

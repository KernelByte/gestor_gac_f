import { Routes } from '@angular/router';

export const HERRAMIENTAS_ROUTES: Routes = [
  {
    path: 'mis-tareas',
    title: 'Mis Tareas',
    loadComponent: () => import('./mis-tareas/pages/mis-tareas.page').then(m => m.MisTareasPage)
  },
  { path: '', redirectTo: 'mis-tareas', pathMatch: 'full' }
];

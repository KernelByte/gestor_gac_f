import { Routes } from '@angular/router';
import { PUBLICADORES_PROVIDERS } from './publicadores/providers';

export const SECRETARIO_ROUTES: Routes = [
   {
      path: 'publicadores',
      title: 'Gestión de Publicadores',
      loadComponent: () => import('./publicadores/ui/pages/publicadores-main.page').then(m => m.PublicadoresMainPage),
      providers: [...PUBLICADORES_PROVIDERS]
   },
   // 'grupos' main route is merged into publicadores tab
   {
      path: 'grupos/asignacion',
      title: 'Asignación Grupos',
      loadComponent: () => import('./grupos/pages/asignacion-grupos.page').then(m => m.AsignacionGruposPage)
   },
   {
      path: 'grupos/detalle-asignacion/:id',
      title: 'Detalle Asignación',
      loadComponent: () => import('./grupos/pages/formulario-asignacion.page').then(m => m.FormularioAsignacionPage)
   },
   {
      path: '',
      redirectTo: 'publicadores',
      pathMatch: 'full'
   }
];

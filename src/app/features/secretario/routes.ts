import { Routes } from '@angular/router';
import { PUBLICADORES_PROVIDERS } from './publicadores/providers';

export const SECRETARIO_ROUTES: Routes = [
   {
      path: 'publicadores',
      title: 'Publicadores',
      loadComponent: () => import('./publicadores/ui/pages/publicadores.page').then(m => m.PublicadoresPage),
      providers: [...PUBLICADORES_PROVIDERS]
   },
   {
      path: 'grupos',
      title: 'Grupos',
      loadComponent: () => import('./grupos/pages/grupos.page').then(m => m.GruposPage)
   },
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

import { CanActivateFn, Router, Routes } from '@angular/router';
import { PUBLICADORES_PROVIDERS } from './publicadores/providers';
import { inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';

const informesPermissionGuard: CanActivateFn = () => {
   const store = inject(AuthStore);
   const router = inject(Router);

   const user = store.user();
   if (!user) return router.createUrlTree(['/login']);

   const roles = (user.roles ?? (user.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
   const isPrivilegedRole = roles.includes('administrador') ||
      roles.includes('secretario') ||
      roles.includes('coordinador') ||
      roles.includes('superintendente de servicio');

   const ok = isPrivilegedRole ||
      store.hasPermission('informes.ver') ||
      store.hasPermission('informes.editar') ||
      store.hasPermission('informes.historial') ||
      store.hasPermission('informes.enviar') ||
      store.hasPermission('informes.enviar_todos') ||
      store.hasPermission('informes.editar_todos');

   return ok ? true : router.createUrlTree(['/']);
};

export const SECRETARIO_ROUTES: Routes = [
   {
      path: 'publicadores',
      title: 'Gestión de Publicadores',
      loadComponent: () => import('./publicadores/ui/pages/publicadores-main.page').then(m => m.PublicadoresMainPage),
      providers: [...PUBLICADORES_PROVIDERS]
   },
   {
      path: 'informes',
      title: 'Informes de Servicio',
      canActivate: [informesPermissionGuard],
      loadComponent: () => import('./informes/informes-main.page').then(m => m.InformesMainPage)
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

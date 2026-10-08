import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { permissionGuard } from './core/auth/permission.guard';
import { rolOPermisoGuard } from './core/auth/rol-o-permiso.guard';

export const routes: Routes = [
  { path: 'login', title: 'Iniciar Sesión', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
  { path: 'auth/solicitar-acceso', title: 'Solicitar Acceso', loadComponent: () => import('./features/auth/solicitar-acceso/solicitar-acceso.page').then(m => m.SolicitarAccesoPage) },
  { path: 'auth/forgot-password', title: 'Recuperar Contraseña', loadComponent: () => import('./features/auth/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage) },
  { path: 'auth/reset-password', title: 'Restablecer Contraseña', loadComponent: () => import('./features/auth/reset-password/reset-password.page').then(m => m.ResetPasswordPage) },

  { path: 'public/informe/:token', title: 'Enviar Informe', loadComponent: () => import('./features/public/informe/public-informe.page').then(m => m.PublicInformePage) },
  { path: 'public/visita/:token', title: 'Visita del Superintendente', loadComponent: () => import('./features/public/visita/public-visita.page').then(m => m.PublicVisitaPage) },
  { path: 'public/logistica/:token', title: 'Programa de la Congregación', loadComponent: () => import('./features/public/logistica/public-logistica.page').then(m => m.PublicLogisticaPage) },
  { path: 'public/invitacion/:token', title: 'Acceso a la app', loadComponent: () => import('./features/public/invitacion/public-invitacion.page').then(m => m.PublicInvitacionPage) },

  // Shell protegido
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.page').then(m => m.ShellPage),
    children: [
      { path: '', title: 'Dashboard', loadComponent: () => import('./features/home/home.page').then(m => m.HomePage) },
      {
        path: 'roles',
        title: 'Roles',
        canActivate: [roleGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./features/basicas/roles/roles.page').then(m => m.RolesPage),
      },
      {
        path: 'usuarios',
        title: 'Usuarios',
        canActivate: [roleGuard],
        data: { roles: ['Administrador', 'Gestor Aplicación', 'Coordinador', 'Secretario'] },
        loadComponent: () => import('./features/basicas/usuarios/pages/usuarios.page').then(m => m.UsuariosPage),
      },
      {
        path: 'usuarios/:id/permisos',
        title: 'Permisos de Usuario',
        canActivate: [roleGuard],
        data: { roles: ['Administrador', 'Gestor Aplicación', 'Coordinador', 'Secretario'] },
        loadComponent: () => import('./features/basicas/usuarios/pages/usuario-permisos/usuario-permisos.page').then(m => m.UsuarioPermisosPage),
      },
      {
        path: 'territorios/mapa',
        title: 'Mapa General de Territorios',
        canActivate: [permissionGuard],
        data: { permissions: ['territorios.ver'] },
        loadComponent: () => import('./features/territorios/pages/mapa-general.page').then(m => m.MapaGeneralPage),
      },
      {
        path: 'territorios',
        title: 'Territorios',
        canActivate: [permissionGuard],
        data: { permissions: ['territorios.ver'] },
        loadComponent: () => import('./features/territorios/pages/territorios.page').then(m => m.TerritoriosPage),
      },
      {
        path: 'horarios',
        title: 'Horarios de Predicación',
        canActivate: [permissionGuard],
        data: { permissions: ['territorios.ver'] },
        loadComponent: () => import('./features/territorios/pages/horarios.page').then(m => m.HorariosPage),
      },
      {
        path: 'seguimiento-predicacion',
        title: 'Predicación',
        canActivate: [permissionGuard],
        data: { permissions: ['territorios.ver'] },
        loadComponent: () => import('./features/territorios/pages/seguimiento-predicacion.page').then(m => m.SeguimientoPredicacionPage),
      },
      {
        path: 'exhibidores',
        loadChildren: () => import('./features/exhibidores/exhibidores.routes').then(m => m.EXHIBIDORES_ROUTES),
      },
      {
        path: 'reuniones',
        loadChildren: () => import('./features/reuniones/reuniones.routes').then(m => m.REUNIONES_ROUTES),
      },
      {
        path: 'reportes',
        loadChildren: () => import('./features/reportes/reportes.routes').then(m => m.REPORTES_ROUTES),
      },
      {
        path: 'secretario',
        canActivate: [roleGuard],
        data: { roles: ['Administrador', 'Coordinador', 'Secretario', 'Superintendente de servicio', 'Publicador'] },
        loadChildren: () => import('./features/secretario/routes').then(m => m.SECRETARIO_ROUTES)
      },
      {
        path: 'secretario-tools',
        canActivate: [roleGuard],
        // Exclusivo de Secretario/Administrador — Coordinador no es dueño de este menú.
        data: { roles: ['Administrador', 'Secretario'] },
        loadChildren: () => import('./features/secretario-tools/routes').then(m => m.SECRETARIO_TOOLS_ROUTES)
      },
      {
        path: 'herramientas',
        loadChildren: () => import('./features/herramientas/routes').then(m => m.HERRAMIENTAS_ROUTES)
      },
      {
        path: 'admin/configuracion',
        title: 'Configuración del Sistema',
        canActivate: [roleGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./features/configuracion/admin/admin-config.page').then(m => m.AdminConfigPage),
      },
      {
        path: 'configuracion',
        title: 'Configuración',
        // Rol o permiso, igual que el backend (ROLES_CONFIG o configuracion.ver):
        // el menú ya mostraba el enlace con el permiso y la ruta lo rechazaba.
        canActivate: [rolOPermisoGuard],
        data: { roles: ['Administrador', 'Secretario', 'Coordinador'], permissions: ['configuracion.ver'] },
        loadComponent: () => import('./features/configuracion/configuracion.page').then(m => m.ConfiguracionPage),
      },
      {
        path: 'perfil',
        title: 'Mi Perfil',
        loadChildren: () => import('./features/perfil/perfil.routes').then(m => m.perfilRoutes),
      },
      {
        path: 'design-system',
        title: 'Design System',
        loadComponent: () => import('./features/design-system/design-system.page').then(m => m.DesignSystemPage),
      },
    ]
  },

  { path: '**', redirectTo: '' }
];

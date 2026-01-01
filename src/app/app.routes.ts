import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { path: 'login', title: 'Iniciar Sesión', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
  { path: 'auth/forgot-password', title: 'Recuperar Contraseña', loadComponent: () => import('./features/auth/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage) },
  { path: 'auth/reset-password', title: 'Restablecer Contraseña', loadComponent: () => import('./features/auth/reset-password/reset-password.page').then(m => m.ResetPasswordPage) },

  // Shell protegido: adentro va el dashboard y demás menús
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
        data: { roles: ['Administrador', 'Coordinador', 'Secretario'] },
        loadComponent: () => import('./features/basicas/usuarios/pages/usuarios.page').then(m => m.UsuariosPage),
      },
      {
        path: 'usuarios/:id/permisos',
        title: 'Permisos de Usuario',
        canActivate: [roleGuard],
        data: { roles: ['Administrador', 'Coordinador', 'Secretario'] },
        loadComponent: () => import('./features/basicas/usuarios/pages/usuario-permisos/usuario-permisos.page').then(m => m.UsuarioPermisosPage),
      },
      {
        path: 'territorios',
        title: 'Territorios',
        // canActivate: [roleGuard],
        // data: { roles: [...] }, 
        loadComponent: () => import('./features/territorios/pages/territorios.page').then(m => m.TerritoriosPage),
      },
      {
        path: 'exhibidores',
        title: 'Exhibidores',
        loadComponent: () => import('./features/exhibidores/pages/exhibidores.page').then(m => m.ExhibidoresPage),
      },
      {
        path: 'reuniones',
        title: 'Reuniones',
        loadComponent: () => import('./features/reuniones/reuniones.page').then(m => m.ReunionesPageComponent),
      },
      {
        path: 'secretario',
        canActivate: [roleGuard],
        data: { roles: ['Administrador', 'Coordinador', 'Secretario', 'Superintendente de servicio', 'Publicador'] },
        loadChildren: () => import('./features/secretario/routes').then(m => m.SECRETARIO_ROUTES)
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
        canActivate: [roleGuard],
        data: { roles: ['Administrador', 'Secretario', 'Coordinador'] },
        loadComponent: () => import('./features/configuracion/configuracion.page').then(m => m.ConfiguracionPage),
      },
    ]
  },

  { path: '**', redirectTo: '' }
];

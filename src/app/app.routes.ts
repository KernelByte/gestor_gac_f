import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },

  // Shell protegido: adentro va el dashboard y demás menús
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.page').then(m => m.ShellPage),
    children: [
      { path: '', loadComponent: () => import('./features/home/home.page').then(m => m.HomePage) },
      {
        path: 'roles',
        canActivate: [roleGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./features/basicas/roles/roles.page').then(m => m.RolesPage),
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./features/basicas/usuarios/pages/usuarios.page').then(m => m.UsuariosPage),
      },
      {
        path: 'secretario',
        canActivate: [roleGuard],
        data: { roles: ['Administrador', 'Coordinador', 'Secretario', 'Superintendente de servicio'] },
        loadChildren: () => import('./features/secretario/routes').then(m => m.SECRETARIO_ROUTES)
      },
    ]
  },

  { path: '**', redirectTo: '' }
];

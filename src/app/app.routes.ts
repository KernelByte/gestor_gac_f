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
        path: 'secretario',
        canActivate: [roleGuard],
        data: { roles: ['Administrador'] },
        loadChildren: () => import('./features/secretario/publicadores/routes').then(m => m.PUBLICADORES_ROUTES)
      },
    ]
  },

  { path: '**', redirectTo: '' }
];

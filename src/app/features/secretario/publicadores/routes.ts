import type { Routes } from '@angular/router';
import { PUBLICADORES_PROVIDERS } from './providers';

export const PUBLICADORES_ROUTES: Routes = [
  {
    path: 'publicadores',
    loadComponent: () => import('./ui/pages/publicadores.page').then(m => m.PublicadoresListComponent),
    providers: [...PUBLICADORES_PROVIDERS]
  }
];

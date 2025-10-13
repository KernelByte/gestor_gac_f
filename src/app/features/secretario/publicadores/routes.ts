import type { Routes } from '@angular/router';
import { PUBLICADORES_PROVIDERS } from './providers';

export const PUBLICADORES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/pages/publicadores.page').then(m => m.PublicadoresPage),
    providers: [...PUBLICADORES_PROVIDERS]
  }
];

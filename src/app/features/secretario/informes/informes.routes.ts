import { Routes } from '@angular/router';

export const INFORMES_ROUTES: Routes = [
   {
      path: '',
      loadComponent: () => import('./informes-main.page').then(m => m.InformesMainPage),
   }
];

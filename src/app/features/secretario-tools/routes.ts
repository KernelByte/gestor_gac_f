import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';
import { actasGuard, reunionesAncianosGuard } from '../../core/auth/administracion.guard';
import { AuthStore } from '../../core/auth/auth.store';
import { primeraRutaAdministracion } from '../../core/auth/acceso-modulos';

// Grupo «Administración» (/administracion). Las direcciones viejas
// (/secretario-tools/…, …/reuniones-ancianos) redirigen aquí desde app.routes.ts,
// porque las notificaciones ya enviadas y los enlaces guardados las usan.
// Cada opción tiene su guard: el del padre solo exige poder abrir alguna.
const SOLO_SECRETARIO = { roles: ['Administrador', 'Secretario'] };

export const SECRETARIO_TOOLS_ROUTES: Routes = [
  // Mi Agenda salió de Administración (ahora /agenda); los avisos ya enviados traen esta dirección.
  // Función y no texto: así conserva ?fecha= de los avisos.
  { path: 'agenda', redirectTo: ({ queryParams }) => inject(Router).createUrlTree(['/agenda'], { queryParams }) },
  {
    path: 'reuniones-teocraticas',
    title: 'Reuniones teocráticas',
    canActivate: [reunionesAncianosGuard],
    loadComponent: () =>
      import('./reuniones-ancianos/pages/reuniones-ancianos-list.page').then(m => m.ReunionesAncianosListPage),
  },
  {
    // «Mi preparación»: la reunión vista por quien asiste, con sus notas privadas.
    path: 'reuniones-teocraticas/:id/preparar',
    title: 'Mi preparación',
    canActivate: [reunionesAncianosGuard],
    loadComponent: () =>
      import('./reuniones-ancianos/pages/reunion-preparar.page').then(m => m.ReunionPrepararPage),
  },
  {
    // La reunión en vivo: cronómetro compartido y notas del acta entre varios.
    path: 'reuniones-teocraticas/:id/en-vivo',
    title: 'Reunión en vivo',
    canActivate: [reunionesAncianosGuard],
    loadComponent: () =>
      import('./reuniones-ancianos/pages/reunion-en-vivo.page').then(m => m.ReunionEnVivoPage),
  },
  {
    // 'nueva' o el id de la reunión. El propio editor decide si es de
    // edición (gestores) o de solo lectura (convocados).
    path: 'reuniones-teocraticas/:id',
    title: 'Reunión teocrática',
    canActivate: [reunionesAncianosGuard],
    canDeactivate: [(c: { puedeSalir?: () => boolean | Promise<boolean> }) => c.puedeSalir?.() ?? true],
    loadComponent: () =>
      import('./reuniones-ancianos/pages/reunion-ancianos-editor.page').then(m => m.ReunionAncianosEditorPage),
  },
  {
    path: 'visita-superintendente',
    title: 'Visita del superintendente',
    canActivate: [roleGuard],
    data: SOLO_SECRETARIO,
    loadComponent: () =>
      import('./visita-superintendente/pages/visita-main.page').then(m => m.VisitaMainPage),
  },
  {
    path: 'actas-reunion',
    title: 'Actas de reunión',
    canActivate: [actasGuard],
    loadComponent: () =>
      import('./actas-reunion/pages/actas-list.page').then(m => m.ActasListPage),
  },
  {
    path: 'actas-reunion/:id',
    title: 'Editor de acta',
    canActivate: [actasGuard],
    loadComponent: () =>
      import('./actas-reunion/pages/acta-editor.page').then(m => m.ActaEditorPage),
  },
  {
    path: 'transferencias',
    title: 'Transferencias',
    canActivate: [roleGuard],
    data: SOLO_SECRETARIO,
    loadComponent: () =>
      import('./transferencias/pages/transferencias.page').then(m => m.TransferenciasPage),
  },
  {
    path: 'tareas/:id',
    title: 'Detalle de tarea',
    canActivate: [roleGuard],
    data: SOLO_SECRETARIO,
    loadComponent: () =>
      import('./tareas/pages/tarea-detail.page').then(m => m.TareaDetailPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => primeraRutaAdministracion(inject(AuthStore)) ?? '/',
  },
];

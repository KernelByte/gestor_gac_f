import { Routes } from '@angular/router';

export const SECRETARIO_TOOLS_ROUTES: Routes = [
  {
    path: 'agenda',
    title: 'Agenda del secretario',
    loadComponent: () =>
      import('./agenda/pages/agenda.page').then(m => m.AgendaPage),
  },
  {
    path: 'visita-superintendente',
    title: 'Visita del superintendente',
    loadComponent: () =>
      import('./visita-superintendente/pages/visita-main.page').then(m => m.VisitaMainPage),
  },
  {
    path: 'actas-reunion',
    title: 'Actas de reunión',
    loadComponent: () =>
      import('./actas-reunion/pages/actas-list.page').then(m => m.ActasListPage),
  },
  {
    path: 'actas-reunion/:id',
    title: 'Editor de acta',
    loadComponent: () =>
      import('./actas-reunion/pages/acta-editor.page').then(m => m.ActaEditorPage),
  },
  {
    path: 'transferencias',
    title: 'Transferencias',
    loadComponent: () =>
      import('./transferencias/pages/transferencias.page').then(m => m.TransferenciasPage),
  },
  {
    path: 'tareas/:id',
    title: 'Detalle de tarea',
    loadComponent: () =>
      import('./tareas/pages/tarea-detail.page').then(m => m.TareaDetailPage),
  },
  { path: '', redirectTo: 'agenda', pathMatch: 'full' },
];

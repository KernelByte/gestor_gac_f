import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';

interface ExhibidoresTab {
  key: string;
  label: string;
  /** Permiso que abre esta pestaña; el calendario no exige uno propio. */
  permiso?: string;
}

/** Orden fijo de las pestañas, con el permiso que habilita cada una. */
const TABS_EXHIBIDORES: ExhibidoresTab[] = [
  { key: 'calendario', label: 'Calendario' },
  { key: 'programacion', label: 'Programación', permiso: 'exhibidores.programacion' },
  { key: 'ubicaciones', label: 'Ubicaciones', permiso: 'exhibidores.ubicaciones' },
  { key: 'participantes', label: 'Participantes', permiso: 'exhibidores.participantes' },
  { key: 'configuracion', label: 'Configuración', permiso: 'exhibidores.configuracion' },
];

/**
 * Navegación interna del módulo Exhibidores (color azul de marca).
 * Solo muestra las pestañas que el usuario puede abrir.
 *
 * Mismo estilo de tab-bar que Informes / Publicadores: card con borde y
 * sombra, botones con ícono + etiqueta, activo con glow del color de marca.
 */
@Component({
  selector: 'app-exhibidores-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-[#1a1b26] rounded-2xl p-1.5 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors w-fit mb-6 flex-wrap"
         role="tablist">
      <button *ngFor="let tab of tabs" (click)="navegar(tab.key)"
        role="tab" [attr.aria-selected]="active === tab.key"
        class="flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-lg text-xs font-bold transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97]"
        [class]="active === tab.key
          ? 'bg-brand-blue text-white shadow-md shadow-blue-500/20'
          : 'text-slate-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/80'">
        <span class="shrink-0 flex items-center justify-center w-3.5 h-3.5">
          <svg *ngIf="tab.key === 'programacion'" class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
          <svg *ngIf="tab.key === 'ubicaciones'" class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <svg *ngIf="tab.key === 'participantes'" class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <svg *ngIf="tab.key === 'calendario'" class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <svg *ngIf="tab.key === 'configuracion'" class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </span>
        <span class="truncate">{{ tab.label }}</span>
      </button>
    </div>
  `,
})
export class ExhibidoresTabsComponent {
  private router = inject(Router);
  private auth = inject(AuthStore);

  get tabs(): ExhibidoresTab[] {
    return TABS_EXHIBIDORES.filter(t => !t.permiso || this.auth.hasPermission(t.permiso));
  }

  get active(): string {
    const url = this.router.url;
    const seccion = url.split('/')[2] ?? 'programacion';
    return seccion.split('?')[0];
  }

  navegar(key: string): void {
    this.router.navigate(['/exhibidores', key]);
  }
}

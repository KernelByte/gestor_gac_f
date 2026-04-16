import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PublicadoresListComponent } from './publicadores.page';
import { GruposListComponent } from '../../../grupos/pages/grupos.page';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { PublicadoresContactosComponent } from './publicadores-contactos.page';

export type PublicadoresTab = 'listado' | 'grupos' | 'contactos';

@Component({
  standalone: true,
  selector: 'app-publicadores-main',
  imports: [CommonModule, PublicadoresListComponent, GruposListComponent, PublicadoresContactosComponent],
  template: `
    <div class="flex flex-col gap-3 h-full">

      <!-- Tab Navigation (mismo estilo que informes, colores naranja) -->
      <div class="shrink-0 flex items-center gap-1.5 bg-white dark:bg-[#1a1b26] rounded-2xl p-1.5 shadow-sm border border-slate-200/60 dark:border-slate-800 transition-colors w-full sm:w-[380px]">
        @for (tab of visibleTabs(); track tab.id) {
          <button
            (click)="setTab(tab.id)"
            class="flex-1 sm:flex-none sm:min-w-[110px] px-4 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            [ngClass]="currentTab() === tab.id
              ? 'bg-brand-orange text-white shadow-md shadow-orange-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'"
          >
            <span class="shrink-0 flex items-center justify-center w-3.5 h-3.5">
              @if (tab.id === 'listado') {
                <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              }
              @if (tab.id === 'grupos') {
                <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              }
              @if (tab.id === 'contactos') {
                <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              }
            </span>
            <span class="truncate">{{ tab.label }}</span>
          </button>
        }
      </div>

      <!-- Content Area -->
      <div class="flex-1 min-h-0 relative animate-fadeIn">
         
         @if (currentTab() === 'listado') {
             <app-publicadores-list></app-publicadores-list>
         }

         @if (currentTab() === 'grupos') {
             <app-grupos-list></app-grupos-list>
         }

         @if (currentTab() === 'contactos') {
             <app-publicadores-contactos></app-publicadores-contactos>
         }

      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }
    .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class PublicadoresMainPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public authStore = inject(AuthStore);

  tabs: { id: PublicadoresTab, label: string }[] = [
    { id: 'listado', label: 'Listado' },
    { id: 'grupos', label: 'Grupos' },
    { id: 'contactos', label: 'Contactos' }
  ];

  visibleTabs = computed(() => {
    const auth = this.authStore;
    const user = auth.user();
    if (!user) return [];

    const roles = (user.roles ?? (user.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
    const isPrivileged = roles.some(r =>
      ['administrador', 'secretario', 'gestor aplicación'].includes(r)
    );

    const result: { id: PublicadoresTab, label: string }[] = [];
    if (isPrivileged || auth.hasPermission('publicadores.ver')) {
      result.push({ id: 'listado', label: 'Listado' });
    }
    if (isPrivileged || auth.hasPermission('grupos.ver') || roles.includes('coordinador') || roles.includes('superintendente de servicio')) {
      result.push({ id: 'grupos', label: 'Grupos' });
    }
    if (isPrivileged || auth.hasPermission('contactos.ver')) {
      result.push({ id: 'contactos', label: 'Contactos' });
    }
    return result;
  });
  
  public currentTab = signal<PublicadoresTab>('listado');

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as PublicadoresTab | undefined;
      const visible = this.visibleTabs();
      if (tab && visible.some(t => t.id === tab)) {
        this.currentTab.set(tab);
      } else {
        // Sin param válido: activar la primera tab visible y escribirla en la URL
        const first = visible[0];
        if (first) {
          this.currentTab.set(first.id);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { tab: first.id },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      }
    });
  }

  setTab(tab: PublicadoresTab) {
    this.currentTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,   // reemplaza en el historial, sin añadir entradas con "atrás"
    });
  }

}


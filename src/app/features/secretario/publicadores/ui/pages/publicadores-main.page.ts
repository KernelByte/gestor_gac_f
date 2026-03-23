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
    <div class="flex flex-col gap-6 h-full">
      
      <!-- Header & Navigation Wrapper -->
      <div class="shrink-0 flex flex-col gap-6">
          
          <!-- Title & Description -->
          <div class="px-8">
            <h1 class="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight mb-2 drop-shadow-sm">{{ pageTitle() }}</h1>
            <p class="text-slate-500 dark:text-slate-400 text-lg leading-relaxed max-w-3xl hidden md:block">{{ pageDescription() }}</p>
          </div>

          <!-- Modern Tab Navigation (Segmented Control) -->
          <div class="bg-slate-100/80 dark:bg-slate-900 p-1.5 rounded-2xl flex flex-wrap md:flex-nowrap gap-1 w-full md:w-fit border border-transparent dark:border-slate-800">
              @for (tab of visibleTabs(); track tab.id) {
                <button 
                  (click)="setTab(tab.id)"
                  class="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
                  [ngClass]="currentTab() === tab.id ? 'bg-white dark:bg-slate-800 text-brand-orange dark:text-orange-400 shadow-sm dark:shadow-lg dark:shadow-orange-900/10 ring-1 ring-black/5 dark:ring-white/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'"
                >
                  <!-- Icons based on tab.id -->
                  @if (tab.id === 'listado') {
                     <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  }
                  @if (tab.id === 'grupos') {
                     <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  }
                  @if (tab.id === 'contactos') {
                     <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  }
                  <span class="hidden md:inline">{{ tab.label }}</span>
                </button>
              }
          </div>
      </div>

      <!-- 3. Content Area -->
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

  isSuperintendenteServicio = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    const roles = user.roles ?? (user.rol ? [user.rol] : []);
    return roles.some(r => r.toLowerCase() === 'superintendente de servicio');
  });

  visibleTabs = computed(() => {
    const user = this.authStore.user();
    if (!user) return this.tabs;
    
    const roles = user.roles ?? (user.rol ? [user.rol] : []);
    const restrictedRoles = ['superintendente de servicio', 'coordinador'];
    
    const isRestricted = roles.some(r => restrictedRoles.includes(r.toLowerCase()));

    if (isRestricted) {
      return this.tabs.filter(t => t.id === 'grupos');
    }
    return this.tabs;
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

  pageTitle = computed(() => {
    switch (this.currentTab()) {
      case 'listado': return 'Gestión de Publicadores';
      case 'grupos': return 'Grupos de Predicación';
      case 'contactos': return 'Contactos de Emergencia';
      default: return 'Publicadores';
    }
  });

  pageDescription = computed(() => {
    switch (this.currentTab()) {
      case 'listado': return 'Administra el directorio de publicadores y su información teocrática.';
      case 'grupos': return 'Organiza los grupos de servicio del campo y sus asignaciones.';
      case 'contactos': return 'Gestiona la información de los contactos en caso de emergencia.';
      default: return '';
    }
  });
}


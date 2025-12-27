import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PublicadoresListComponent } from './publicadores.page';
import { GruposListComponent } from '../../../grupos/pages/grupos.page';

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
          <div>
            <h1 class="text-3xl font-display font-black text-slate-900 tracking-tight mb-2">{{ pageTitle() }}</h1>
            <p class="text-slate-500 text-lg leading-relaxed max-w-3xl hidden md:block">{{ pageDescription() }}</p>
          </div>

          <!-- Modern Tab Navigation (Segmented Control) -->
          <div class="bg-slate-100/80 p-1.5 rounded-2xl flex flex-wrap md:flex-nowrap gap-1 w-full md:w-fit">
              <button 
                (click)="currentTab.set('listado')" 
                class="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
                [ngClass]="currentTab() === 'listado' ? 'bg-white text-brand-orange shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span class="hidden md:inline">Listado</span>
              </button>
              
              <button 
                (click)="currentTab.set('grupos')" 
                class="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
                [ngClass]="currentTab() === 'grupos' ? 'bg-white text-brand-orange shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'"
              >
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                 <!-- Icono distinguido para Grupos -->
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> 
                 <!-- Mejor icono para grupos (Home/Location style) -->
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                <span class="hidden md:inline">Grupos</span>
              </button>
              
              <button 
                (click)="currentTab.set('contactos')" 
                class="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
                [ngClass]="currentTab() === 'contactos' ? 'bg-white text-brand-orange shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'"
              >
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                <span class="hidden md:inline">Contactos</span>
              </button>
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

  currentTab = signal<PublicadoresTab>('listado');

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (tab === 'grupos' || tab === 'contactos' || tab === 'listado') {
        this.currentTab.set(tab);
      }
    });
  }

  pageTitle = computed(() => {
    switch (this.currentTab()) {
      case 'listado': return 'Gestión de Publicadores';
      case 'grupos': return 'Grupos de Predicación';
      case 'contactos': return 'Contactos de Emergencia';
    }
  });

  pageDescription = computed(() => {
    switch (this.currentTab()) {
      case 'listado': return 'Administra el directorio de publicadores y su información teocrática.';
      case 'grupos': return 'Organiza los grupos de servicio del campo y sus asignaciones.';
      case 'contactos': return 'Gestiona la información de los contactos en caso de emergencia.';
    }
  });
}

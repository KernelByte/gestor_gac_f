import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicadoresListComponent } from './publicadores.page'; // Using the modified file but new class name
import { GruposListComponent } from '../../../grupos/pages/grupos.page'; // Using the modified file but new class name

import { PublicadoresContactosComponent } from './publicadores-contactos.page';

export type PublicadoresTab = 'listado' | 'grupos' | 'contactos';

@Component({
   standalone: true,
   selector: 'app-publicadores-main',
   imports: [CommonModule, PublicadoresListComponent, GruposListComponent, PublicadoresContactosComponent],
   template: `
    <div class="flex flex-col gap-6 h-full">
      
      <!-- 1. Header Section -->
      <div class="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div>
           <h1 class="text-3xl font-display font-black text-slate-900 tracking-tight">{{ pageTitle() }}</h1>
           <p class="text-slate-500 mt-1 max-w-2xl text-base">{{ pageDescription() }}</p>
         </div>
      </div>

      <!-- 2. Navigation Tabs -->
      <div class="flex border-b border-slate-200 gap-8">
         <button (click)="currentTab.set('listado')" 
            class="pb-4 text-sm font-bold transition-all relative"
            [ngClass]="currentTab() === 'listado' ? 'text-brand-orange' : 'text-slate-500 hover:text-slate-700'">
            Listado de Publicadores
            <span *ngIf="currentTab() === 'listado'" class="absolute bottom-0 left-0 w-full h-0.5 bg-brand-orange rounded-t-full"></span>
         </button>
         <button (click)="currentTab.set('grupos')" 
            class="pb-4 text-sm font-bold transition-all relative"
            [ngClass]="currentTab() === 'grupos' ? 'text-brand-orange' : 'text-slate-500 hover:text-slate-700'">
            Grupos de Predicación
            <span *ngIf="currentTab() === 'grupos'" class="absolute bottom-0 left-0 w-full h-0.5 bg-brand-orange rounded-t-full"></span>
         </button>
         <button (click)="currentTab.set('contactos')" 
            class="pb-4 text-sm font-bold transition-all relative"
            [ngClass]="currentTab() === 'contactos' ? 'text-brand-orange' : 'text-slate-500 hover:text-slate-700'">
            Contactos de Emergencia
            <span *ngIf="currentTab() === 'contactos'" class="absolute bottom-0 left-0 w-full h-0.5 bg-brand-orange rounded-t-full"></span>
         </button>
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
export class PublicadoresMainPage {
   currentTab = signal<PublicadoresTab>('listado');

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

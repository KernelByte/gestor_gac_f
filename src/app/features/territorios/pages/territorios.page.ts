import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

interface Territorio {
   id: string; // T-101
   nombre: string; // Los Rosales
   zona: string; // Norte
   viviendas: number;
   estado: 'Disponible' | 'Asignado' | 'En Pausa';
   asignadoA?: {
      nombre: string;
      avatar?: string;
      fecha: string;
      progreso: number;
   };
   coords?: any; // For map logic later
}

@Component({
   standalone: true,
   selector: 'app-territorios-page',
   imports: [CommonModule, FormsModule],
   animations: [
      trigger('slideOver', [
         transition(':enter', [
            style({ transform: 'translateX(100%)', opacity: 0 }),
            animate('400ms cubic-bezier(0.16, 1, 0.3, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
         ]),
         transition(':leave', [
            animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(100%)', opacity: 0 }))
         ])
      ])
   ],
   template: `
    <div class="h-full flex flex-col w-full max-w-[1920px] mx-auto p-4 sm:p-8 relative gap-6">
      
      <!-- 1. Header -->
      <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight font-display">Territorios</h1>
          <p class="text-slate-500 mt-1">Administra, asigna y monitorea el estado de los territorios de la congregación.</p>
        </div>
        <div class="flex items-center gap-3">
          <button class="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 shadow-sm transition-all focus:ring-4 focus:ring-slate-100 flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            Ver Mapa General
          </button>
          <button class="px-5 py-2.5 bg-[#6D28D9] text-white font-bold rounded-xl text-sm hover:bg-[#5b21b6] shadow-lg shadow-purple-900/20 transition-all active:scale-95 flex items-center gap-2">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nuevo Territorio
          </button>
        </div>
      </header>

      <!-- 2. KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <!-- Total -->
        <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div class="flex items-center gap-3 z-10">
            <div class="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </div>
            <span class="font-bold text-slate-500 text-sm">Territorios Totales</span>
          </div>
          <div class="flex items-baseline gap-3 z-10">
            <span class="text-4xl font-black text-slate-900 tracking-tight">124</span>
            <span class="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold">+2 nuevos</span>
          </div>
        </div>

        <!-- Asignados -->
        <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div class="flex items-center gap-3 z-10">
            <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <span class="font-bold text-slate-500 text-sm">Territorios Asignados</span>
          </div>
          <div class="flex items-baseline gap-3 z-10">
            <span class="text-4xl font-black text-slate-900 tracking-tight">45</span>
            <span class="text-slate-400 font-medium text-sm">de 124 disponibles</span>
          </div>
        </div>

        <!-- Cobertura -->
        <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div class="flex items-center gap-3 z-10">
            <div class="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            </div>
            <span class="font-bold text-slate-500 text-sm">Cobertura General</span>
          </div>
          <div class="flex items-baseline gap-3 z-10">
            <span class="text-4xl font-black text-slate-900 tracking-tight">36%</span>
            <span class="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold">+1.5% este mes</span>
          </div>
        </div>
      </div>

      <!-- 3. Main Content (List + Detail) -->
      <div class="flex-1 flex gap-6 min-h-0 relative">
        
        <!-- Left: List -->
        <div class="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
           
           <!-- Toolbar -->
           <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4">
              <div class="relative flex-1">
                 <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                 <input 
                   [(ngModel)]="searchQuery"
                   type="text" 
                   placeholder="Buscar territorio..." 
                   class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-slate-400"
                 >
              </div>
              <div class="flex gap-2">
                 <button class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-2">
                   Todas las Zonas
                   <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                 </button>
                 <button class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-2">
                   Todos los Estados
                   <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                 </button>
              </div>
           </div>

           <!-- Table -->
           <div class="flex-1 overflow-y-auto simple-scrollbar relative">
              <table class="w-full text-left border-collapse">
                 <thead class="sticky top-0 bg-white z-10 border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <tr>
                       <th class="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ID / Nombre</th>
                       <th class="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Zona</th>
                       <th class="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Viviendas</th>
                       <th class="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                       <th class="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Asignado A</th>
                       <th class="px-4 py-4 w-10"></th>
                    </tr>
                 </thead>
                 <tbody class="divide-y divide-slate-50">
                    <tr 
                      *ngFor="let t of filteredTerritorios()" 
                      (click)="selectTerritorio(t)"
                      class="group cursor-pointer hover:bg-purple-50/40 transition-colors"
                      [class.bg-purple-50]="selectedTerritorio()?.id === t.id"
                    >
                       <!-- ID/Name -->
                       <td class="px-6 py-4">
                          <p class="font-bold text-slate-900 group-hover:text-[#6D28D9] transition-colors">{{ t.id }}</p>
                          <p class="text-xs text-slate-500 font-medium">{{ t.nombre }}</p>
                       </td>
                       <!-- Zone -->
                       <td class="px-6 py-4 text-sm font-semibold text-slate-600">{{ t.zona }}</td>
                       <!-- Dwellings -->
                       <td class="px-6 py-4 text-sm font-bold text-slate-700 tabular-nums">{{ t.viviendas }}</td>
                       <!-- Status -->
                       <td class="px-6 py-4">
                          <span 
                            class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border"
                            [ngClass]="getStatusColor(t.estado)"
                          >
                             <span class="w-1.5 h-1.5 rounded-full mr-1.5" [ngClass]="getStatusDotColor(t.estado)"></span>
                             {{ t.estado }}
                          </span>
                       </td>
                       <!-- Assignee -->
                       <td class="px-6 py-4">
                          <div *ngIf="t.asignadoA" class="flex items-center gap-2">
                             <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                {{ t.asignadoA.nombre.charAt(0) }}{{ t.asignadoA.nombre.split(' ')[1]?.charAt(0) }}
                             </div>
                             <span class="text-xs font-semibold text-slate-700">{{ t.asignadoA.nombre }}</span>
                          </div>
                          <span *ngIf="!t.asignadoA" class="text-xs text-slate-300 font-medium">-</span>
                       </td>
                       <!-- Actions -->
                       <td class="px-4 py-4 text-right">
                          <button class="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                             <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                          </button>
                       </td>
                    </tr>
                 </tbody>
              </table>
           </div>
           
           <div class="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span class="text-xs text-slate-400 font-medium">Mostrando 1-5 de 124</span>
              <div class="flex gap-1">
                 <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-[#5B3C88] text-white text-xs font-bold shadow-md shadow-purple-900/10">1</button>
                 <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-500 text-xs font-bold transition-colors">2</button>
                 <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-500 text-xs font-bold transition-colors">3</button>
              </div>
           </div>
        </div>

        <!-- Right: Detail Panel (Overlay on mobile, Side by Side on Desktop) -->
        <div 
          *ngIf="selectedTerritorio()"
          @slideOver
          class="w-full md:w-[400px] shrink-0 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full absolute md:relative right-0 z-20"
        >
           <!-- Header -->
           <div class="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/30">
              <div>
                 <h2 class="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-1">Detalles Del Territorio</h2>
                 <h3 class="text-3xl font-black text-slate-900 tracking-tight">{{ selectedTerritorio()!.id }}</h3>
                 <p class="text-sm font-medium text-slate-500 mt-1">{{ selectedTerritorio()!.nombre }} • Zona {{ selectedTerritorio()!.zona }}</p>
              </div>
              <button (click)="closeDetails()" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
           </div>
           
           <!-- Content -->
           <div class="flex-1 overflow-y-auto p-6 simple-scrollbar space-y-6">
              
              <!-- Map Placeholder -->
              <div class="w-full aspect-video bg-slate-100 rounded-xl border border-slate-200 relative group overflow-hidden cursor-pointer shadow-inner">
                 <!-- Mock Map Image Pattern -->
                 <div style="background-image: url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/-74.006,40.7128,13,0/600x400?access_token=YOUR_ACCESS_TOKEN');" class="absolute inset-0 bg-cover bg-center opacity-80 mix-blend-multiply group-hover:scale-105 transition-transform duration-700"></div>
                 <div class="absolute inset-0 flex items-center justify-center">
                    <button class="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg text-xs font-bold text-slate-700 shadow-sm flex items-center gap-2 group-hover:bg-white transition-colors">
                       <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                       Ampliar Mapa
                    </button>
                 </div>
              </div>

              <!-- Current Assignment -->
              <div class="bg-purple-50/50 rounded-xl p-5 border border-purple-100">
                 <h4 class="text-[11px] font-bold text-purple-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                    Asignación Actual
                 </h4>
                 
                 <div *ngIf="selectedTerritorio()!.estado === 'Asignado' && selectedTerritorio()!.asignadoA as assignee; else unassignedState">
                    <div class="flex items-center gap-4 mb-4">
                       <div class="w-12 h-12 rounded-full bg-white text-purple-700 font-bold text-lg flex items-center justify-center shadow-sm border border-purple-100">
                          {{ assignee.nombre.charAt(0) }}{{ assignee.nombre.split(' ')[1]?.charAt(0) }}
                       </div>
                       <div>
                          <p class="font-bold text-slate-800">{{ assignee.nombre }}</p>
                          <p class="text-xs text-slate-500 font-medium">Asignado: {{ assignee.fecha }}</p>
                       </div>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="space-y-1.5">
                       <div class="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <span>Progreso estimado</span>
                          <span>~{{ assignee.progreso }}%</span>
                       </div>
                       <div class="h-2 w-full bg-purple-200/50 rounded-full overflow-hidden">
                          <div class="h-full bg-purple-600 rounded-full" [style.width.%]="assignee.progreso"></div>
                       </div>
                    </div>
                 </div>

                 <ng-template #unassignedState>
                    <div class="text-center py-4">
                       <p class="text-sm font-semibold text-slate-500">Este territorio no tiene asignación actual.</p>
                       <button class="mt-3 px-4 py-2 bg-white border border-purple-200 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-50 transition-colors">
                          Asignar Ahora
                       </button>
                    </div>
                 </ng-template>
              </div>

              <!-- Stats Grid -->
              <div class="grid grid-cols-2 gap-3">
                 <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Viviendas</p>
                    <p class="text-2xl font-black text-slate-700">{{ selectedTerritorio()!.viviendas }}</p>
                 </div>
                 <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Comercios</p>
                    <p class="text-2xl font-black text-slate-700">--</p>
                 </div>
              </div>
           </div>

           <!-- Footer Actions -->
           <div class="p-6 border-t border-slate-100 bg-white grid grid-cols-1 gap-3">
              <button class="w-full py-3.5 bg-[#5B3C88] hover:bg-[#4a2f73] text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-900/10 transition-all flex items-center justify-center gap-2">
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                 Imprimir Tarjeta
              </button>
              <div class="grid grid-cols-2 gap-3">
                 <button class="py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 19 9 24"></polyline><path d="M4 19h10a4 4 0 0 0 4-4v-3a4 4 0 0 0-4-4H9"></path></svg>
                    Devolver
                 </button>
                 <button class="py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Editar
                 </button>
              </div>
           </div>
        </div>

      </div>
    </div>
  `,
   styles: [`
    :host { display: block; height: 100%; }
    .simple-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
    .simple-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .simple-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .simple-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `]
})
export class TerritoriosPage {
   searchQuery = '';
   selectedTerritorio = signal<Territorio | null>(null);

   // MOCK DATA
   territorios: Territorio[] = [
      { id: 'T-101', nombre: 'Los Rosales', zona: 'Norte', viviendas: 45, estado: 'Disponible' },
      { id: 'T-102', nombre: 'Vista Hermosa', zona: 'Norte', viviendas: 32, estado: 'Asignado', asignadoA: { nombre: 'Juan Pérez', fecha: '12 Oct, 2023', progreso: 65 } },
      { id: 'T-103', nombre: 'San Miguel', zona: 'Sur', viviendas: 50, estado: 'Asignado', asignadoA: { nombre: 'María Rodriguez', fecha: '15 Oct, 2023', progreso: 30 } },
      { id: 'T-104', nombre: 'El Centro', zona: 'Centro', viviendas: 28, estado: 'En Pausa' },
      { id: 'T-105', nombre: 'Jardines', zona: 'Oeste', viviendas: 60, estado: 'Disponible' },
      { id: 'T-106', nombre: 'Las Palmas', zona: 'Este', viviendas: 38, estado: 'Asignado', asignadoA: { nombre: 'Carlos López', fecha: '01 Nov, 2023', progreso: 10 } },
      { id: 'T-107', nombre: 'Miraflores', zona: 'Norte', viviendas: 42, estado: 'Disponible' },
      { id: 'T-108', nombre: 'Santa Clara', zona: 'Sur', viviendas: 55, estado: 'En Pausa' },
   ];

   filteredTerritorios = computed(() => {
      const q = this.searchQuery.toLowerCase();
      return this.territorios.filter(t =>
         t.nombre.toLowerCase().includes(q) ||
         t.id.toLowerCase().includes(q) ||
         t.zona.toLowerCase().includes(q)
      );
   });

   selectTerritorio(t: Territorio) {
      this.selectedTerritorio.set(t);
   }

   closeDetails() {
      this.selectedTerritorio.set(null);
   }

   getStatusColor(estado: string): string {
      switch (estado) {
         case 'Disponible': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
         case 'Asignado': return 'bg-purple-50 text-purple-700 border-purple-100';
         case 'En Pausa': return 'bg-slate-100 text-slate-600 border-slate-200';
         default: return 'bg-slate-50';
      }
   }

   getStatusDotColor(estado: string): string {
      switch (estado) {
         case 'Disponible': return 'bg-emerald-500';
         case 'Asignado': return 'bg-purple-600';
         case 'En Pausa': return 'bg-slate-400';
         default: return 'bg-slate-400';
      }
   }
}

import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

type TabView = 'overview' | 'history' | 'rules';

interface Ubicacion {
   id: string;
   nombre: string;
   direccion: string;
   turnosHoy: number;
   estado: 'Activo' | 'Mantenimiento';
   imagenMap: string;
}

interface Turno {
   hora: string;
   estado: 'Completo' | 'Parcial' | 'Vacio';
   publicadores: { nombre: string; avatar?: string }[];
   capacidad: number;
}

@Component({
   standalone: true,
   selector: 'app-exhibidores-page',
   imports: [CommonModule, FormsModule],
   animations: [
      trigger('fadeIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(10px)' }),
            animate('300ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
         ])
      ])
   ],
   template: `
    <div class="flex flex-col gap-6 h-full">
      
      <!-- Header & Navigation Wrapper -->
      <div class="shrink-0 flex flex-col gap-6">
         
         <!-- Top Row: Title/Desc + Actions -->
         <div class="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <!-- Title & Description -->
            <div>
               <h1 class="text-3xl font-display font-black text-slate-900 tracking-tight mb-2">Gestión de Exhibidores</h1>
               <p class="text-slate-500 text-lg leading-relaxed max-w-3xl">Administre ubicaciones, asigne turnos y supervise el testimonio público.</p>
            </div>

            <!-- Global Actions -->
            <div class="flex items-center gap-3 shrink-0">
               <button class="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Calendario
               </button>
               <button class="px-5 py-2.5 bg-[#2563EB] text-white font-bold rounded-xl text-sm hover:bg-[#1d4ed8] shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  Nueva Ubicación
               </button>
            </div>
         </div>

         <!-- Modern Tab Navigation (Segmented Control) -->
         <div class="bg-slate-100/80 p-1.5 rounded-2xl flex flex-wrap md:flex-nowrap gap-1 w-full md:w-fit">
            <button (click)="currentTab.set('overview')" 
               class="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
               [ngClass]="currentTab() === 'overview' ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'">
               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
               Ubicaciones
            </button>
            <button (click)="currentTab.set('history')" 
               class="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
               [ngClass]="currentTab() === 'history' ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'">
               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
               Historial
            </button>
            <button (click)="currentTab.set('rules')" 
               class="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
               [ngClass]="currentTab() === 'rules' ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'">
               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
               Reglas
            </button>
         </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 min-h-0 relative">
         
         <!-- 1. OVERVIEW TAB -->
         <div *ngIf="currentTab() === 'overview'" @fadeIn class="h-full grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
            
            <!-- Left: Locations List -->
            <div class="lg:col-span-4 flex flex-col gap-4 overflow-y-auto simple-scrollbar pr-2 h-full">
               <div class="sticky top-0 z-10 bg-slate-50 pb-2">
                  <div class="relative">
                     <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                     <input type="text" placeholder="Buscar ubicación..." class="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:font-normal">
                  </div>
               </div>

               <!-- Location Cards -->
               <div *ngFor="let loc of ubicaciones" 
                  (click)="selectedLocation.set(loc)"
                  class="bg-white p-4 rounded-2xl border transition-all cursor-pointer group hover:shadow-md"
                  [ngClass]="selectedLocation()?.id === loc.id ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-md' : 'border-slate-200 hover:border-blue-200'">
                  
                  <!-- Mini Map Placeholder -->
                  <div class="w-full h-24 bg-slate-100 rounded-xl mb-3 overflow-hidden relative border border-slate-100">
                     <div class="absolute inset-0 opacity-60 bg-cover bg-center" style="background-image: url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/-0.1278,51.5074,13,0/300x150?access_token=mock'); background-color: #e2e8f0;"></div>
                     <div class="absolute top-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-md text-[10px] font-bold shadow-sm"
                        [ngClass]="loc.estado === 'Activo' ? 'text-emerald-600' : 'text-orange-600'">
                        {{ loc.estado }}
                     </div>
                  </div>

                  <h3 class="font-bold text-slate-900">{{ loc.nombre }}</h3>
                  <p class="text-xs text-slate-500 font-medium mb-3">{{ loc.direccion }}</p>
                  
                  <div class="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                     {{ loc.turnosHoy }} turnos hoy
                  </div>
               </div>
            </div>

            <!-- Right: Schedule & Details -->
            <div class="lg:col-span-8 flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <!-- Header -->
               <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                     <div class="flex items-center gap-2">
                        <h2 class="text-xl font-black text-slate-900">Programación: {{ selectedLocation()?.nombre }}</h2>
                        <svg class="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                     </div>
                     <p class="text-sm text-slate-500 font-medium mt-1">Planificación y asignación de publicadores.</p>
                  </div>
                  <div class="flex bg-slate-100 p-1 rounded-lg">
                     <button class="px-3 py-1.5 bg-white shadow-sm rounded-md text-xs font-bold text-slate-800">Día</button>
                     <button class="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">Semana</button>
                     <button class="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">Mes</button>
                  </div>
               </div>

               <!-- Date Nav -->
               <div class="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <div class="flex items-center gap-4">
                     <button class="p-1 hover:bg-white rounded hover:shadow-sm transition-all"><svg class="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                     <div class="flex items-center gap-2 font-bold text-slate-800">
                        <svg class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Hoy, 24 Octubre 2023
                     </div>
                     <button class="p-1 hover:bg-white rounded hover:shadow-sm transition-all"><svg class="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
                  </div>
                  <div class="flex gap-2">
                     <button class="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-slate-200 transition-all flex items-center gap-2">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copiar Previos
                     </button>
                     <button class="px-3 py-2 bg-[#1e40af] text-white rounded-lg text-xs font-bold hover:bg-[#1d4ed8] flex items-center gap-2 shadow-md shadow-blue-900/10">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Asignar Turno
                     </button>
                  </div>
               </div>

               <!-- Schedule List -->
               <div class="flex-1 overflow-y-auto simple-scrollbar">
                  <div class="grid grid-cols-12 px-6 py-3 bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                     <div class="col-span-2">Hora</div>
                     <div class="col-span-2">Estado</div>
                     <div class="col-span-3">Publicador 1</div>
                     <div class="col-span-3">Publicador 2</div>
                     <div class="col-span-2 text-right">Acciones</div>
                  </div>

                  <div class="divide-y divide-slate-50">
                     <div *ngFor="let t of mockTurnos" class="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
                        <!-- Time -->
                        <div class="col-span-2 flex items-center gap-2 font-bold text-slate-700 text-sm">
                           <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                           {{ t.hora }}
                        </div>

                        <!-- Status -->
                        <div class="col-span-2">
                           <span class="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border"
                              [ngClass]="{
                                 'bg-emerald-50 text-emerald-700 border-emerald-100': t.estado === 'Completo',
                                 'bg-amber-50 text-amber-700 border-amber-100': t.estado === 'Parcial',
                                 'bg-red-50 text-red-700 border-red-100': t.estado === 'Vacio'
                              }">
                              {{ t.estado }}
                           </span>
                        </div>

                        <!-- Pub 1 -->
                        <div class="col-span-3">
                           <div *ngIf="t.publicadores[0]" class="flex items-center gap-2">
                              <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold border border-blue-200">
                                 {{ t.publicadores[0].nombre.charAt(0) }}{{ t.publicadores[0].nombre.split(' ')[1]?.charAt(0) }}
                              </div>
                              <span class="text-sm font-medium text-slate-700">{{ t.publicadores[0].nombre }}</span>
                           </div>
                           <button *ngIf="!t.publicadores[0]" class="px-2 py-1 bg-white border border-slate-200 border-dashed rounded text-xs font-bold text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center gap-1">
                              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                              Asignar
                           </button>
                        </div>

                        <!-- Pub 2 -->
                        <div class="col-span-3">
                           <div *ngIf="t.publicadores[1]" class="flex items-center gap-2">
                              <div class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold border border-indigo-200">
                                 {{ t.publicadores[1].nombre.charAt(0) }}{{ t.publicadores[1].nombre.split(' ')[1]?.charAt(0) }}
                              </div>
                              <span class="text-sm font-medium text-slate-700">{{ t.publicadores[1].nombre }}</span>
                           </div>
                           <button *ngIf="!t.publicadores[1]" class="px-2 py-1 bg-white border border-slate-200 border-dashed rounded text-xs font-bold text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center gap-1">
                              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                              Asignar
                           </button>
                        </div>

                        <!-- Actions -->
                        <div class="col-span-2 flex justify-end">
                           <button class="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                             <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
               
               <div class="p-4 border-t border-slate-100 bg-slate-50 text-right">
                  <a href="#" class="text-xs font-bold text-[#2563EB] hover:underline flex items-center justify-end gap-1">
                     Ver disponibilidad mensual completa
                     <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </a>
               </div>
            </div>
         </div>

         <!-- 2. HISTORY TAB -->
         <div *ngIf="currentTab() === 'history'" @fadeIn class="h-full grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
            <!-- Main Content: History Table -->
            <div class="lg:col-span-8 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
               <div class="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 class="font-bold text-slate-800">Registros Recientes</h3>
                  <p class="text-xs text-slate-400 font-medium">Mostrando 1-5 de 124 registros</p>
               </div>
               <div class="flex-1 overflow-auto simple-scrollbar">
                  <table class="w-full text-left border-collapse">
                     <thead class="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                           <th class="px-6 py-4">Fecha / Hora</th>
                           <th class="px-6 py-4">Ubicación</th>
                           <th class="px-6 py-4">Publicadores</th>
                           <th class="px-6 py-4">Horas</th>
                           <th class="px-6 py-4 text-right"></th>
                        </tr>
                     </thead>
                     <tbody class="divide-y divide-slate-100 text-sm">
                        <tr class="hover:bg-slate-50 transition-colors">
                           <td class="px-6 py-4">
                              <div class="flex items-center gap-3">
                                 <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                 </div>
                                 <div>
                                    <p class="font-bold text-slate-900">24 Oct 2023</p>
                                    <p class="text-xs text-slate-500 font-medium">08:30 - 10:30</p>
                                 </div>
                              </div>
                           </td>
                           <td class="px-6 py-4">
                              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                 <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                 Plaza Central
                              </span>
                           </td>
                           <td class="px-6 py-4">
                              <div class="flex -space-x-2">
                                 <div class="w-8 h-8 rounded-full bg-slate-200 border-2 border-white"></div>
                                 <div class="w-8 h-8 rounded-full bg-slate-300 border-2 border-white"></div>
                              </div>
                              <p class="text-xs text-slate-500 font-medium mt-1">A. Garcia, C. Martinez</p>
                           </td>
                           <td class="px-6 py-4 font-black text-slate-700">2.0</td>
                           <td class="px-6 py-4 text-right">
                              <button class="text-slate-400 hover:text-blue-600"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                           </td>
                        </tr>
                        <!-- Repeat Mock Rows -->
                        <tr class="hover:bg-slate-50 transition-colors">
                           <td class="px-6 py-4">
                              <div class="flex items-center gap-3">
                                 <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                 </div>
                                 <div>
                                    <p class="font-bold text-slate-900">23 Oct 2023</p>
                                    <p class="text-xs text-slate-500 font-medium">16:00 - 18:00</p>
                                 </div>
                              </div>
                           </td>
                           <td class="px-6 py-4">
                              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                 <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                 Estación Tren
                              </span>
                           </td>
                           <td class="px-6 py-4">
                              <div class="flex -space-x-2">
                                 <div class="w-8 h-8 rounded-full bg-slate-200 border-2 border-white"></div>
                                 <div class="w-8 h-8 rounded-full bg-slate-300 border-2 border-white"></div>
                              </div>
                              <p class="text-xs text-slate-500 font-medium mt-1">R. Sánchez, J. Pérez</p>
                           </td>
                           <td class="px-6 py-4 font-black text-slate-700">4.0</td>
                           <td class="px-6 py-4 text-right">
                              <button class="text-slate-400 hover:text-blue-600"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            </div>

            <!-- Right Sidebar: Stats -->
            <div class="lg:col-span-4 flex flex-col gap-6">
               <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 class="font-black text-slate-900 text-lg mb-6">Resumen del Mes</h3>
                  
                  <div class="space-y-6">
                     <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center">
                           <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                        <div>
                           <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">Horas Totales</p>
                           <div class="flex items-baseline gap-2">
                              <span class="text-3xl font-black text-slate-900">342</span>
                              <span class="text-emerald-600 text-xs font-bold">+12%</span>
                           </div>
                        </div>
                     </div>

                     <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center">
                           <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </div>
                        <div>
                           <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">Turnos Cubiertos</p>
                           <div class="flex items-baseline gap-2">
                              <span class="text-3xl font-black text-slate-900">85</span>
                              <span class="text-slate-400 text-xs font-medium">de 90 programados</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div class="mt-8 pt-6 border-t border-slate-100">
                      <div class="flex justify-between items-center mb-2">
                         <span class="text-sm font-bold text-slate-700">Cobertura del Territorio</span>
                         <span class="text-sm font-black text-[#2563EB]">94%</span>
                      </div>
                      <div class="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                         <div class="h-full bg-[#2563EB] w-[94%] rounded-full"></div>
                      </div>
                  </div>
               </div>

               <!-- Active Location Card -->
               <div class="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-orange-100 shadow-sm relative overflow-hidden">
                  <h3 class="font-bold text-amber-900 mb-1 relative z-10">Ubicación Más Activa</h3>
                  <p class="text-3xl font-black text-amber-900 relative z-10 mb-4">Plaza Central</p>
                  
                  <div class="flex justify-between items-end relative z-10">
                     <div class="text-sm font-medium text-amber-800">
                        <p>Turnos este mes: <span class="font-bold">45</span></p>
                        <p>Promedio: <span class="font-bold">2.5h / turno</span></p>
                     </div>
                  </div>
                  
                  <!-- Decor -->
                  <div class="absolute -right-4 -bottom-4 w-32 h-32 bg-amber-200/40 rounded-full blur-2xl"></div>
               </div>

               <!-- Reports CTA -->
               <div class="bg-[#1e40af] text-white p-6 rounded-2xl shadow-lg shadow-blue-900/20 relative overflow-hidden group hover:bg-[#1d4ed8] transition-colors cursor-pointer">
                   <div class="relative z-10">
                      <h3 class="font-bold text-lg mb-1">Informes S-4</h3>
                      <p class="text-blue-200 text-sm mb-4 max-w-[80%]">Generar informe mensual de predicación pública para la sucursal.</p>
                      <button class="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold backdrop-blur-sm transition-all flex items-center gap-2">
                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                         Descargar PDF
                      </button>
                   </div>
                   <!-- Icon Decor -->
                   <svg class="absolute -right-6 -bottom-6 w-32 h-32 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
               </div>
            </div>
         </div>
         
         <!-- 3. RULES TAB (Simple Placeholder as requested to keep focused on UX) -->
         <div *ngIf="currentTab() === 'rules'" @fadeIn class="h-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex items-center justify-center flex-col text-center">
            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
               <svg class="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>
            </div>
            <h3 class="font-bold text-slate-900 text-lg">Configuración de Reglas</h3>
            <p class="text-slate-500 max-w-md mt-2">Aquí podrá configurar los requisitos de elegibilidad y códigos de conducta para los participantes.</p>
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
export class ExhibidoresPage {
   currentTab = signal<TabView>('overview');
   selectedLocation = signal<Ubicacion | null>(null);

   ubicaciones: Ubicacion[] = [
      { id: '1', nombre: 'Plaza Mayor - Stand A', direccion: 'Calle Principal, Esquina Norte', turnosHoy: 4, estado: 'Activo', imagenMap: '' },
      { id: '2', nombre: 'Parque del Retiro', direccion: 'Entrada Puerta de Alcalá', turnosHoy: 2, estado: 'Activo', imagenMap: '' },
      { id: '3', nombre: 'Estación Central', direccion: 'Vestíbulo Principal', turnosHoy: 0, estado: 'Mantenimiento', imagenMap: '' },
   ];

   mockTurnos: Turno[] = [
      { hora: '08:00 - 10:00', estado: 'Completo', capacidad: 2, publicadores: [{ nombre: 'Juan Pérez' }, { nombre: 'Maria Garcia' }] },
      { hora: '10:00 - 12:00', estado: 'Parcial', capacidad: 2, publicadores: [{ nombre: 'Ana Lopez' }] },
      { hora: '12:00 - 14:00', estado: 'Vacio', capacidad: 2, publicadores: [] },
      { hora: '14:00 - 16:00', estado: 'Completo', capacidad: 2, publicadores: [{ nombre: 'Carlos Ruiz' }, { nombre: 'Laura Mendez' }] },
   ];

   constructor() {
      this.selectedLocation.set(this.ubicaciones[0]);
   }
}

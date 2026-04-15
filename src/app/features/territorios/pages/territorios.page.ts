import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { geoKinks } from '../utils/geo-math.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { TerritoriosService } from '../services/territorios.service';
import { TerritorioMapComponent } from '../components/territorio-map.component';
import { TerritorioCardComponent } from '../components/territorio-card.component';
import { exportTerritorioCard } from '../utils/territorio-export.util';
import {
  Territorio,
  Manzana,
  CoberturaManzana,
  TerritorioStats,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  AsignacionTerritorio,
  Punto,
} from '../models/territorio.model';

@Component({
   standalone: true,
   selector: 'app-territorios-page',
   imports: [CommonModule, FormsModule, TerritorioMapComponent, TerritorioCardComponent],
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
    <div class="flex flex-col h-full overflow-hidden gap-5">

      <!-- 1. Header -->
      <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-display">Territorios</h1>
          <p class="text-slate-500 dark:text-slate-400 mt-1">Administra, asigna y monitorea el estado de los territorios de la congregación.</p>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="navigateToMap()" class="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all focus:ring-4 focus:ring-slate-100 dark:focus:ring-slate-800 flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            Ver Mapa General
          </button>
          <button (click)="openCreateModal()" class="px-5 py-2.5 bg-[#059669] text-white font-bold rounded-xl text-sm hover:bg-[#047857] shadow-lg shadow-emerald-900/20 dark:shadow-emerald-900/40 transition-all active:scale-95 flex items-center gap-2">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nuevo Territorio
          </button>
        </div>
      </header>

      <!-- 2. KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 shrink-0">
        <!-- Total -->
        <div class="bg-white dark:bg-slate-800/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div class="flex items-center gap-3 z-10">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </div>
            <span class="font-bold text-slate-500 dark:text-slate-400 text-sm">Territorios Totales</span>
          </div>
          <div class="flex items-baseline gap-3 z-10">
            <span class="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{{ territorios().length }}</span>
          </div>
        </div>

        <!-- Asignados -->
        <div class="bg-white dark:bg-slate-800/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div class="flex items-center gap-3 z-10">
            <div class="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <span class="font-bold text-slate-500 dark:text-slate-400 text-sm">Territorios Asignados</span>
          </div>
          <div class="flex items-baseline gap-3 z-10">
            <span class="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{{ asignadosCount() }}</span>
            <span class="text-slate-400 font-medium text-sm">de {{ territorios().length }}</span>
          </div>
        </div>

        <!-- Disponibles -->
        <div class="bg-white dark:bg-slate-800/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div class="flex items-center gap-3 z-10">
            <div class="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            </div>
            <span class="font-bold text-slate-500 dark:text-slate-400 text-sm">Disponibles</span>
          </div>
          <div class="flex items-baseline gap-3 z-10">
            <span class="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{{ disponiblesCount() }}</span>
          </div>
        </div>
      </div>

      <!-- 3. Filter Bar -->
      <div class="shrink-0 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-2">
        <div class="relative flex-1 w-full group">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#059669] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            [(ngModel)]="searchQuery"
            type="text"
            placeholder="Buscar territorio..."
            class="w-full pl-11 pr-4 py-2.5 bg-transparent border-none rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 transition-all"
          >
        </div>
        <div class="h-8 w-px bg-slate-100 dark:bg-slate-700 hidden sm:block shrink-0"></div>
        <div class="relative w-full sm:w-48 shrink-0">
          <select
            [(ngModel)]="estadoFilter"
            class="w-full pl-3 pr-8 py-2.5 border-none bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors appearance-none cursor-pointer outline-none"
          >
            <option value="">Todos los Estados</option>
            <option value="Disponible">Disponible</option>
            <option value="Asignado">Asignado</option>
            <option value="En Pausa">En Pausa</option>
          </select>
          <svg class="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>

      <!-- 4. Main Content (List + Detail) -->
      <div class="flex-1 flex gap-5 min-h-0 relative">

        <!-- Left: List -->
        <div class="flex-1 flex flex-col bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden transition-all duration-300">

           <!-- Table -->
           <div class="flex-1 overflow-y-auto simple-scrollbar relative">
              @if (loading()) {
                <div class="flex items-center justify-center py-20">
                  <div class="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              } @else {
              <table class="w-full text-left border-collapse">
                 <thead class="sticky top-0 bg-white dark:bg-slate-800 z-10 border-b border-slate-100 dark:border-slate-700/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <tr>
                       <th class="px-6 py-4 text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wider">Código / Nombre</th>
                       <th class="px-6 py-4 text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                       <th class="px-4 py-4 w-10"></th>
                    </tr>
                 </thead>
                  <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                    @for (t of paginatedTerritorios(); track t.id_territorio) {
                    <tr
                      (click)="selectTerritorio(t)"
                      class="group cursor-pointer hover:bg-emerald-50/40 dark:hover:bg-emerald-900/20 transition-colors"
                      [class.bg-emerald-50]="selectedTerritorio()?.id_territorio === t.id_territorio"
                      [class.dark:bg-emerald-900/20]="selectedTerritorio()?.id_territorio === t.id_territorio"
                    >
                       <!-- Code/Name -->
                       <td class="px-6 py-4">
                          <p class="font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#059669] dark:group-hover:text-emerald-400 transition-colors">{{ t.codigo }}</p>
                          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">{{ t.nombre }}</p>
                       </td>
                       <!-- Status -->
                       <td class="px-6 py-4">
                          <span 
                            class="inline-flex items-center px-2.5 py-1 rounded-full text-[0.625rem] font-bold border"
                            [ngClass]="getStatusColor(t.estado_territorio)"
                          >
                             <span class="w-1.5 h-1.5 rounded-full mr-1.5" [ngClass]="getStatusDotColor(t.estado_territorio)"></span>
                             {{ t.estado_territorio }}
                          </span>
                       </td>
                       <!-- Actions -->
                       <td class="px-4 py-4 text-right">
                          <button class="p-1.5 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                             <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                          </button>
                       </td>
                    </tr>
                    }
                 </tbody>
              </table>
              }
           </div>
           
           <!-- Pagination -->
           <div class="px-6 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <span class="text-xs text-slate-400 font-medium">
                Mostrando {{ paginationStart() }}-{{ paginationEnd() }} de {{ filteredTerritorios().length }}
              </span>
              <div class="flex gap-1">
                @for (p of totalPages(); track p) {
                  <button 
                    (click)="currentPage.set(p)"
                    class="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors"
                    [class.bg-emerald-600]="currentPage() === p"
                    [class.text-white]="currentPage() === p"
                    [class.shadow-md]="currentPage() === p"
                    [class.hover:bg-slate-100]="currentPage() !== p"
                    [class.dark:hover:bg-slate-700]="currentPage() !== p"
                    [class.text-slate-500]="currentPage() !== p"
                  >{{ p }}</button>
                }
              </div>
           </div>
        </div>

        <!-- Right: Detail Panel -->
        @if (selectedTerritorio()) {
        <div
          @slideOver
          class="w-full md:w-[420px] shrink-0 bg-white dark:bg-slate-800 md:rounded-2xl border-0 md:border border-slate-200 dark:border-slate-700/50 shadow-xl overflow-hidden flex flex-col h-full absolute inset-0 md:inset-auto md:relative z-30"
        >
           <!-- Mobile back button -->
           <div class="md:hidden flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 shrink-0">
             <button (click)="closeDetails()" class="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                 <path d="M19 12H5M12 5l-7 7 7 7"/>
               </svg>
               Volver
             </button>
           </div>
           <!-- Header -->
           <div class="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700/50 bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-900/10 dark:to-slate-800">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[0.6rem] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.15em] mb-1">Territorio</p>
                  <h3 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{{ selectedTerritorio()!.codigo }}</h3>
                  <p class="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1 truncate">{{ selectedTerritorio()!.nombre }}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0 mt-1">
                  <span class="text-xs font-bold px-2.5 py-1 rounded-full border"
                    [class]="selectedTerritorio()!.estado_territorio === 'Disponible'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50'
                      : selectedTerritorio()!.estado_territorio === 'Asignado'
                      ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800/50'
                      : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'">
                    <span class="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                      [class]="selectedTerritorio()!.estado_territorio === 'Disponible' ? 'bg-emerald-500' : selectedTerritorio()!.estado_territorio === 'Asignado' ? 'bg-sky-500' : 'bg-slate-400'"></span>{{ selectedTerritorio()!.estado_territorio }}
                  </span>
                  <button (click)="closeDetails()" class="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
              @if (selectedStats()) {
                <div class="flex gap-3 mt-3">
                  <div class="flex items-center gap-1.5 bg-white/70 dark:bg-slate-700/50 rounded-lg px-2.5 py-1.5 border border-slate-100 dark:border-slate-600/50">
                    <svg class="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    <span class="text-xs font-black text-slate-700 dark:text-slate-200">{{ selectedStats()!.manzanas_count }}</span>
                    <span class="text-[10px] text-slate-400">manz.</span>
                  </div>
                  <div class="flex items-center gap-1.5 bg-white/70 dark:bg-slate-700/50 rounded-lg px-2.5 py-1.5 border border-slate-100 dark:border-slate-600/50">
                    <svg class="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                    <span class="text-xs font-black text-slate-700 dark:text-slate-200">{{ selectedStats()!.viviendas_count }}</span>
                    <span class="text-[10px] text-slate-400">viv.</span>
                  </div>
                  <div class="flex items-center gap-1.5 bg-white/70 dark:bg-slate-700/50 rounded-lg px-2.5 py-1.5 border border-slate-100 dark:border-slate-600/50">
                    <svg class="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    <span class="text-xs font-black text-slate-700 dark:text-slate-200">{{ selectedStats()!.cobertura_promedio }}%</span>
                    <span class="text-[10px] text-slate-400">cob.</span>
                  </div>
                </div>
              }
           </div>

           <!-- Tabs (icon + label, scrollable) -->
           <div class="flex border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 shrink-0 overflow-x-auto no-scrollbar">
             @for (tab of tabs; track tab.id) {
               <button
                 (click)="setDetailTab($any(tab.id))"
                 class="flex items-center gap-1.5 px-3.5 py-2.5 text-[0.65rem] font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap"
                 [class]="activeDetailTab() === tab.id
                   ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
                   : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'"
               >
                 <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [innerHTML]="tab.icon"></svg>
                 {{ tab.label }}
               </button>
             }
           </div>

           <!-- Content -->
           <div class="flex-1 overflow-y-auto p-5 simple-scrollbar space-y-5">

             <!-- TAB: Info -->
             @if (activeDetailTab() === 'info') {
               <!-- Mini-map -->
               @if (selectedTerritorioPolygon()) {
                 <app-territorio-map
                   [geojson]="selectedTerritorioPolygon()"
                   [manzanasGeojson]="selectedManzanasGeoJSON()"
                   [puntosGeojson]="selectedPuntosGeoJSON()"
                   height="200px"
                   [interactive]="false" />
               } @else {
                 <div class="w-full h-36 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center gap-2">
                   <svg class="w-8 h-8 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                   <span class="text-xs text-slate-400 font-medium">Sin geometría — usa "Dibujar Mapa"</span>
                 </div>
               }

               <!-- Puntos de lugar -->
               @if (puntos().length > 0) {
                 <div>
                   <div class="flex items-center justify-between mb-2">
                     <h4 class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest">Puntos de salida</h4>
                     <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{{ puntos().length }}</span>
                   </div>
                   <div class="grid grid-cols-2 gap-1.5">
                     @for (p of puntos(); track p.id_punto) {
                       <div class="flex items-center gap-2 p-2 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/50 group">
                         <div class="w-7 h-7 rounded-lg flex items-center justify-center text-[0.6rem] font-black text-white shrink-0"
                              [class]="p.tipo === 'Salida' ? 'bg-rose-500' : p.tipo === 'Lugar' ? 'bg-emerald-500' : 'bg-slate-400'">
                           {{ p.tipo === 'Salida' ? 'S' : p.tipo === 'Lugar' ? 'L' : 'P' }}
                         </div>
                         <div class="min-w-0 flex-1">
                           <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate leading-tight">{{ p.nombre }}</p>
                           <p class="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">{{ p.tipo }}</p>
                         </div>
                         <button (click)="deletePunto(p.id_punto)" class="p-1 text-slate-200 hover:text-red-500 dark:text-slate-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                           <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                         </button>
                       </div>
                     }
                   </div>
                 </div>
               }

               @if (selectedTerritorio()!.notas) {
                 <div class="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-3.5 border border-amber-100 dark:border-amber-800/30 flex gap-2.5">
                   <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                   <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{{ selectedTerritorio()!.notas }}</p>
                 </div>
               }
             }

             <!-- TAB: Manzanas -->
             @if (activeDetailTab() === 'manzanas') {
               @if (coberturaLoading()) {
                 <div class="flex flex-col items-center justify-center py-10 gap-3">
                   <div class="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                   <span class="text-xs text-slate-400">Cargando manzanas...</span>
                 </div>
               } @else if (manzanasConCobertura().length === 0) {
                 <div class="text-center py-10 text-slate-400">
                   <svg class="w-10 h-10 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                   <p class="text-sm font-semibold">Sin manzanas</p>
                   <p class="text-xs mt-1">Dibuja manzanas con el editor de mapa</p>
                 </div>
               } @else {
                 <!-- Summary bar -->
                 <div class="bg-gradient-to-r from-emerald-50 to-emerald-50/40 dark:from-emerald-900/20 dark:to-transparent rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800/30">
                   <div class="flex justify-between items-center mb-2">
                     <span class="text-xs font-black text-emerald-700 dark:text-emerald-400">{{ manzanasPredicadasCount() }} de {{ manzanasConCobertura().length }} predicadas</span>
                     <span class="text-lg font-black text-emerald-600 dark:text-emerald-400">{{ manzanasPorcentaje() | number:'1.0-0' }}%</span>
                   </div>
                   <div class="w-full h-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                     <div class="h-full bg-emerald-500 rounded-full transition-all duration-700" [style.width.%]="manzanasPorcentaje()"></div>
                   </div>
                 </div>
                 <!-- Manzana list -->
                 <div class="space-y-1.5">
                   @for (m of manzanasConCobertura(); track m.id_manzana) {
                     @let isPredicada = m.ultimaCobertura?.estado === 'Predicada';
                     <div class="flex items-center gap-3 p-3 rounded-xl border transition-all"
                          [class]="isPredicada ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30' : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/40 hover:border-emerald-200 dark:hover:border-emerald-800/40'">
                       <div class="min-w-[2.25rem] h-9 px-2 rounded-xl font-black text-xs flex items-center justify-center shrink-0 transition-colors text-center leading-tight"
                            [class]="isPredicada ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900' : 'bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'">
                         {{ m.numero_manzana }}
                       </div>
                       @if (editingManzanaId() === m.id_manzana) {
                         <!-- Inline edit mode -->
                         <input
                           type="text"
                           [value]="editingManzanaNombre()"
                           (input)="editingManzanaNombre.set($any($event.target).value)"
                           (keydown.enter)="saveEditManzana(m.id_manzana)"
                           (keydown.escape)="cancelEditManzana()"
                           class="flex-1 min-w-0 px-2 py-1 text-xs font-bold rounded-lg border border-blue-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                           autofocus
                         />
                         <button (click)="saveEditManzana(m.id_manzana)"
                           [disabled]="!editingManzanaNombre().trim() || manzanaRenaming() === m.id_manzana"
                           class="text-[10px] font-bold px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 shrink-0">
                           {{ manzanaRenaming() === m.id_manzana ? '...' : 'Ok' }}
                         </button>
                         <button (click)="cancelEditManzana()"
                           class="text-[10px] font-bold px-2 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 text-slate-600 dark:text-slate-200 rounded-lg transition-colors shrink-0">
                           ✕
                         </button>
                       } @else {
                         <div class="flex-1 min-w-0">
                           <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{{ m.numero_manzana }}</p>
                           @if (isPredicada) {
                             <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                               <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                               Predicada · {{ m.ultimaCobertura!.fecha_inicio | date:'dd/MM/yy' }}
                             </p>
                           } @else {
                             <p class="text-[10px] text-slate-400">Pendiente</p>
                           }
                         </div>
                         <!-- Edit pencil button -->
                         <button (click)="startEditManzana(m)"
                           class="p-1.5 text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 rounded-lg transition-colors shrink-0">
                           <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                         </button>
                         <!-- Delete button -->
                         <button (click)="deleteManzana(m.id_manzana)"
                           [disabled]="manzanaDeleting() === m.id_manzana"
                           class="p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 rounded-lg transition-colors shrink-0 disabled:opacity-50">
                           @if (manzanaDeleting() === m.id_manzana) {
                             <div class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                           } @else {
                             <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                           }
                         </button>
                         @if (!isPredicada) {
                           <button (click)="marcarManzanaPredicada(m.id_manzana)"
                             [disabled]="coberturaSaving() === m.id_manzana"
                             class="text-[10px] font-bold px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0">
                             {{ coberturaSaving() === m.id_manzana ? '...' : '✓ Marcar' }}
                           </button>
                         } @else {
                           <svg class="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                         }
                       }
                     </div>
                   }
                 </div>
               }
             }

             <!-- TAB: Asignaciones -->
             @if (activeDetailTab() === 'asignaciones') {
               <!-- Asignación activa -->
               @if (asignacionActiva()) {
                 <div class="rounded-2xl border bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/40 p-4">
                   <div class="flex items-center gap-2 mb-3">
                     <div class="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                       <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                     </div>
                     <div>
                       <p class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Asignado a</p>
                       <p class="text-sm font-black text-slate-800 dark:text-white">{{ asignacionActiva()!.nombre_publicador ?? 'Publicador #' + asignacionActiva()!.id_publicador }}</p>
                     </div>
                   </div>
                   <p class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                     Desde {{ asignacionActiva()!.fecha_asignacion | date:'dd/MM/yyyy' }}
                   </p>
                   @if (asignacionActiva()!.notas) {
                     <p class="text-xs text-slate-500 italic mb-3 border-l-2 border-emerald-300 dark:border-emerald-700 pl-2">{{ asignacionActiva()!.notas }}</p>
                   }
                   <button (click)="openDevolverModal()" class="w-full py-2.5 text-xs font-bold bg-white dark:bg-slate-700 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2">
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.51"/></svg>
                     Registrar Devolución
                   </button>
                 </div>
               } @else {
                 <div class="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
                   <svg class="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                   <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Disponible para asignar</p>
                   <button (click)="openAsignarModal()" class="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm shadow-emerald-900/10 flex items-center justify-center gap-2">
                     <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                     Asignar Territorio
                   </button>
                 </div>
               }

               <!-- Historial -->
               @if (historialAsignaciones().length > 0) {
               <div>
                 <h4 class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Historial</h4>
                 <div class="space-y-1.5">
                   @for (a of historialAsignaciones(); track a.id_asignacion) {
                     @if (!a.activa) {
                     <div class="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/50">
                       <div class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                         <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                       </div>
                       <div class="min-w-0 flex-1">
                         <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{{ a.nombre_publicador ?? 'Publicador #' + a.id_publicador }}</p>
                         <p class="text-[10px] text-slate-400">{{ a.fecha_asignacion | date:'dd/MM/yy' }} → {{ a.fecha_devolucion | date:'dd/MM/yy' }}</p>
                       </div>
                       <span class="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">Devuelto</span>
                     </div>
                     }
                   }
                 </div>
               </div>
               }
             }


           </div>

           <!-- Footer Actions -->
           <div class="p-4 border-t border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm grid grid-cols-3 gap-2">
              <button (click)="openEditInfoModal()"
                class="py-2.5 bg-slate-50 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-1 hover:border-slate-300 dark:hover:border-slate-500">
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                 Editar
              </button>
              <button (click)="openMapEditor()"
                class="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-emerald-900/15 transition-all flex flex-col items-center justify-center gap-1 active:scale-95">
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                 Dibujar
              </button>
              <button (click)="printCard()"
                class="py-2.5 bg-slate-50 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-1 hover:border-slate-300 dark:hover:border-slate-500">
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                 Imprimir
              </button>
           </div>
        </div>
        }

        <!-- Hidden card for print (offscreen) -->
        @if (showPrintCard() && selectedTerritorio()) {
          <div style="position: fixed; left: -9999px; top: 0;">
            <app-territorio-card
              [territorio]="selectedTerritorio()"
              [geojson]="selectedTerritorioGeoJSON()"
              [manzanasGeojson]="selectedManzanasGeoJSON()"
              [stats]="selectedStats()"
            />
          </div>
        }

      </div>
      
      <!-- Modal Asignar Territorio -->
      @if (showAsignarModal()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="showAsignarModal.set(false)"></div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-fadeIn">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
            <h3 class="text-base font-black text-slate-900 dark:text-white">Asignar Territorio</h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ selectedTerritorio()?.codigo }} — {{ selectedTerritorio()?.nombre }}</p>
          </div>
          <div class="p-5 space-y-4">
            @if (asignacionError()) {
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-400 font-medium">{{ asignacionError() }}</div>
            }
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">ID Publicador *</label>
              <input type="number" [(ngModel)]="newAsignacion.id_publicador" placeholder="ID del publicador"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Asignación</label>
              <input type="date" [(ngModel)]="newAsignacion.fecha_asignacion"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
              <input type="text" [(ngModel)]="newAsignacion.notas" placeholder="Observaciones..."
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 flex gap-3">
            <button (click)="showAsignarModal.set(false)" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button (click)="saveAsignacion()" [disabled]="!newAsignacion.id_publicador || asignacionSaving()"
              class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
              {{ asignacionSaving() ? 'Guardando...' : 'Asignar' }}
            </button>
          </div>
        </div>
      </div>
      }

      <!-- Modal Devolver Territorio -->
      @if (showDevolverModal()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="showDevolverModal.set(false)"></div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-fadeIn">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
            <h3 class="text-base font-black text-slate-900 dark:text-white">Registrar Devolución</h3>
            <p class="text-xs text-slate-500 mt-0.5">Asignado a: {{ asignacionActiva()?.nombre_publicador }}</p>
          </div>
          <div class="p-5 space-y-4">
            @if (asignacionError()) {
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-400 font-medium">{{ asignacionError() }}</div>
            }
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Devolución</label>
              <input type="date" [(ngModel)]="devolucionData.fecha_devolucion"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
              <input type="text" [(ngModel)]="devolucionData.notas" placeholder="Observaciones..."
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 flex gap-3">
            <button (click)="showDevolverModal.set(false)" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button (click)="saveDevolucion()" [disabled]="asignacionSaving()"
              class="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
              {{ asignacionSaving() ? 'Guardando...' : 'Registrar Devolución' }}
            </button>
          </div>
        </div>
      </div>
      }

      <!-- Modal Nuevo Territorio -->
      @if (showCreateModal()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="closeCreateModal()"></div>
        
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-fadeIn">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
            <h3 class="text-lg font-black text-slate-900 dark:text-white">Nuevo Territorio</h3>
            <button (click)="closeCreateModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Código</label>
              <input type="text" [(ngModel)]="newTerritorio.codigo" placeholder="Ej: T-01" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Nombre</label>
              <input type="text" [(ngModel)]="newTerritorio.nombre" placeholder="Ej: Centro Norte" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Estado Inicial</label>
              <select [(ngModel)]="newTerritorio.estado_territorio" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all cursor-pointer">
                <option value="Disponible">Disponible</option>
                <option value="Asignado">Asignado</option>
                <option value="En Pausa">En Pausa</option>
              </select>
            </div>
          </div>
          
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
            <button (click)="closeCreateModal()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">Cancelar</button>
            <button (click)="saveNewTerritorio()" [disabled]="!newTerritorio.codigo || !newTerritorio.nombre || saving()" class="px-5 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center gap-2">
              @if (saving()) {
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              }
              Guardar
            </button>
          </div>
        </div>
      </div>
      }

      <!-- Modal Editar Info -->
      @if (showEditInfoModal() && selectedTerritorio()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="closeEditInfoModal()"></div>

        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-fadeIn">

          <!-- Header -->
          <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-white dark:from-emerald-900/10 dark:to-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg class="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </div>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">Editar Territorio</h3>
                <p class="text-[0.7rem] text-slate-400 font-medium">{{ selectedTerritorio()!.codigo }} · {{ selectedTerritorio()!.nombre }}</p>
              </div>
            </div>
            <button (click)="closeEditInfoModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Form -->
          <div class="px-6 py-5 space-y-4">

            <!-- Error feedback -->
            @if (editInfoError()) {
              <div class="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3">
                <svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p class="text-xs font-semibold text-red-600 dark:text-red-400">{{ editInfoError() }}</p>
              </div>
            }

            <!-- Código -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Código</label>
              <input
                type="text"
                [(ngModel)]="editingTerritorioInfo.codigo"
                placeholder="Ej: T-01"
                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
            </div>

            <!-- Nombre -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nombre</label>
              <input
                type="text"
                [(ngModel)]="editingTerritorioInfo.nombre"
                placeholder="Ej: Centro Norte"
                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
            </div>

            <!-- Estado -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Estado</label>
              <select
                [(ngModel)]="editingTerritorioInfo.estado_territorio"
                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
              >
                <option value="Disponible">Disponible</option>
                <option value="Asignado">Asignado</option>
                <option value="En Pausa">En Pausa</option>
              </select>
            </div>

            <!-- Notas -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Notas / Instrucciones <span class="font-normal normal-case text-slate-400">(opcional)</span></label>
              <textarea
                [(ngModel)]="editingTerritorioInfo.notas"
                rows="3"
                placeholder="Ej: Zona residencial, muchas rejas..."
                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none"
              ></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
            <button (click)="closeEditInfoModal()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">
              Cancelar
            </button>
            <button
              (click)="saveEditInfo()"
              [disabled]="!editingTerritorioInfo.nombre || !editingTerritorioInfo.codigo || saving()"
              class="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
            >
              @if (saving()) {
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              } @else {
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              }
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
      }
        
      <!-- Modal Editar Mapa -->
      @if (showMapEditModal() && selectedTerritorio()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="closeMapEditor()"></div>
        
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-5xl h-[85vh] flex flex-col relative z-10 shadow-2xl overflow-hidden animate-fadeIn">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                Editor Cartográfico: {{ selectedTerritorio()!.codigo }}
              </h3>
              <p class="text-sm text-slate-500 mt-1 font-medium">Selecciona la capa activa (arriba derecha) para dibujar el territorio, manzanas o colocar puntos.</p>
            </div>
            <button (click)="closeMapEditor()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700/50 p-2 rounded-full transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div class="flex-1 bg-slate-100 dark:bg-slate-900 relative">
            <app-territorio-map
              [geojson]="editingGeoJSON()"
              [manzanasGeojson]="selectedManzanasGeoJSON()"
              [puntosGeojson]="selectedPuntosGeoJSON()"
              height="100%"
              [enableDrawing]="true"
              [interactive]="true"
              (geometryChanged)="onGeometryChanged($event)"
              (manzanaDrawn)="onManzanaDrawn($event)"
              (puntoPlaced)="onPuntoPlaced($event)"
            />
          </div>

          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col gap-3 shrink-0">
            @if (geoSaveError()) {
              <div class="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3">
                <svg class="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p class="text-xs font-semibold text-red-600 dark:text-red-400 leading-snug">{{ geoSaveError() }}</p>
              </div>
            }
            <div class="flex justify-end gap-3">
              <button (click)="closeMapEditor()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">Cerrar editor</button>
              <button (click)="saveGeometry()" [disabled]="saving()" class="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2">
                @if (saving()) {
                  <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                } @else {
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                }
                Guardar límite del territorio
              </button>
            </div>
          </div>
        </div>
      </div>
      }
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
export class TerritoriosPage implements OnInit {
   private territoriosService = inject(TerritoriosService);
   private router = inject(Router);

   searchQuery = '';
   estadoFilter = '';
   loading = signal(true);
   saving = signal(false);
   showPrintCard = signal(false);
   showCreateModal = signal(false);
   showMapEditModal = signal(false);
   geoSaveError = signal<string | null>(null);
   showEditInfoModal = signal(false);
   editInfoError = signal<string | null>(null);

   newTerritorio: Partial<Territorio> = {
      codigo: '',
      nombre: '',
      estado_territorio: 'Disponible'
   };
   
   editingTerritorioInfo: Partial<Territorio> = {
      codigo: '',
      nombre: '',
      estado_territorio: 'Disponible',
      notas: ''
   };

   territorios = signal<Territorio[]>([]);
   selectedTerritorio = signal<Territorio | null>(null);
   selectedStats = signal<TerritorioStats | null>(null);
   selectedTerritorioGeoJSON = signal<GeoJSONFeatureCollection | null>(null);
   selectedTerritorioPolygon = signal<GeoJSONFeatureCollection | null>(null);
   selectedManzanasGeoJSON = signal<GeoJSONFeatureCollection | null>(null);
   selectedPuntosGeoJSON = signal<GeoJSONFeatureCollection | null>(null);
   puntos = signal<Punto[]>([]);

   // Asignaciones
   asignacionActiva = signal<AsignacionTerritorio | null>(null);
   historialAsignaciones = signal<AsignacionTerritorio[]>([]);
   showAsignarModal = signal(false);
   showDevolverModal = signal(false);
   asignacionSaving = signal(false);
   asignacionError = signal<string | null>(null);
   newAsignacion: { id_publicador: number | null; fecha_asignacion: string; notas: string } = {
     id_publicador: null,
     fecha_asignacion: new Date().toISOString().split('T')[0],
     notas: '',
   };
   devolucionData: { fecha_devolucion: string; notas: string } = {
     fecha_devolucion: new Date().toISOString().split('T')[0],
     notas: '',
   };

   // Manzanas con cobertura (Fase 4)
   manzanasConCobertura = signal<Array<Manzana & { ultimaCobertura?: CoberturaManzana }>>([]);
   coberturaLoading = signal(false);
   coberturaSaving = signal<number | null>(null); // id_manzana siendo guardado
   editingManzanaId = signal<number | null>(null);
   editingManzanaNombre = signal('');
   manzanaRenaming = signal<number | null>(null);
   manzanaDeleting = signal<number | null>(null);
   activeDetailTab = signal<'info' | 'manzanas' | 'asignaciones'>('info');
   manzanaSaving = signal(false);

   readonly tabs: Array<{ id: 'info' | 'manzanas' | 'asignaciones'; label: string; icon: string }> = [
     { id: 'info',        label: 'territorio',  icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
     { id: 'manzanas',   label: 'Manzanas',     icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
     { id: 'asignaciones', label: 'Asignación', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
   ];

   // Editor State
   editingGeoJSON = signal<GeoJSONFeatureCollection | null>(null);
   lastEditedGeoJSON = signal<GeoJSONFeatureCollection | null>(null);

   // Pagination
   pageSize = 20;
   currentPage = signal(1);

   // Computed KPIs
   asignadosCount = computed(() =>
     this.territorios().filter(t => t.estado_territorio === 'Asignado').length
   );
   disponiblesCount = computed(() =>
     this.territorios().filter(t => t.estado_territorio === 'Disponible').length
   );

   filteredTerritorios = computed(() => {
      const q = this.searchQuery.toLowerCase();
      const estado = this.estadoFilter;
      return this.territorios().filter(t => {
         const matchesSearch =
           t.nombre.toLowerCase().includes(q) ||
           t.codigo.toLowerCase().includes(q);
         const matchesEstado = !estado || t.estado_territorio === estado;
         return matchesSearch && matchesEstado;
      });
   });

   totalPages = computed(() => {
      const total = Math.ceil(this.filteredTerritorios().length / this.pageSize);
      return Array.from({ length: total }, (_, i) => i + 1);
   });

   paginatedTerritorios = computed(() => {
      const start = (this.currentPage() - 1) * this.pageSize;
      return this.filteredTerritorios().slice(start, start + this.pageSize);
   });

   paginationStart = computed(() => {
      if (this.filteredTerritorios().length === 0) return 0;
      return (this.currentPage() - 1) * this.pageSize + 1;
   });

   paginationEnd = computed(() => {
      const end = this.currentPage() * this.pageSize;
      return Math.min(end, this.filteredTerritorios().length);
   });

   ngOnInit(): void {
      this.loadTerritorios();
   }

   loadTerritorios(): void {
      this.loading.set(true);
      this.territoriosService.getTerritorios(0, 500).subscribe({
         next: (data) => {
            this.territorios.set(data);
            this.loading.set(false);
         },
         error: () => {
            this.loading.set(false);
         },
      });
   }

   selectTerritorio(t: Territorio): void {
      this.selectedTerritorio.set(t);
      this.selectedStats.set(null);
      this.selectedTerritorioGeoJSON.set(null);
      this.selectedTerritorioPolygon.set(null);
      this.selectedManzanasGeoJSON.set(null);
      this.selectedPuntosGeoJSON.set(null);
      this.puntos.set([]);
      this.activeDetailTab.set('info');
      this.asignacionActiva.set(null);
      this.historialAsignaciones.set([]);
      this.manzanasConCobertura.set([]);

      // Load stats
      this.territoriosService.getTerritorioStats(t.id_territorio).subscribe({
         next: (stats) => this.selectedStats.set(stats),
      });

      // Load asignacion activa + historial
      this.loadAsignaciones(t.id_territorio);

      // Load geojson for mini-map
      if (t.coordenada) {
         const fc: GeoJSONFeatureCollection = {
            type: 'FeatureCollection',
            features: [{
               type: 'Feature',
               id: t.id_territorio,
               properties: { codigo: t.codigo, nombre: t.nombre, estado_territorio: t.estado_territorio },
               geometry: t.coordenada,
            }],
         };
         // Store territory polygon separately for map editor and info-tab mini-map
         this.selectedTerritorioPolygon.set(fc);
         this.selectedTerritorioGeoJSON.set(fc);

         this.territoriosService.getManzanasGeoJSON(t.id_territorio).subscribe({
            next: (manzanasGeo) => {
               if (manzanasGeo?.features?.length > 0) {
                  this.selectedManzanasGeoJSON.set(manzanasGeo);
               }
            },
         });
      }

      // Load puntos
      this.loadPuntos(t.id_territorio);
   }

   closeDetails(): void {
      this.selectedTerritorio.set(null);
      this.selectedStats.set(null);
      this.selectedTerritorioGeoJSON.set(null);
      this.selectedTerritorioPolygon.set(null);
      this.selectedManzanasGeoJSON.set(null);
      this.selectedPuntosGeoJSON.set(null);
      this.puntos.set([]);
      this.asignacionActiva.set(null);
      this.historialAsignaciones.set([]);
      this.manzanasConCobertura.set([]);
   }

   // ── Asignaciones ────────────────────────────────────────────────────
   private loadAsignaciones(idTerritorio: number): void {
      this.territoriosService.getAsignaciones(idTerritorio).subscribe({
         next: (list) => {
            this.historialAsignaciones.set(list);
            this.asignacionActiva.set(list.find(a => a.activa) ?? null);
         },
      });
   }

   openAsignarModal(): void {
      this.newAsignacion = {
         id_publicador: null,
         fecha_asignacion: new Date().toISOString().split('T')[0],
         notas: '',
      };
      this.asignacionError.set(null);
      this.showAsignarModal.set(true);
   }

   openDevolverModal(): void {
      this.devolucionData = {
         fecha_devolucion: new Date().toISOString().split('T')[0],
         notas: '',
      };
      this.asignacionError.set(null);
      this.showDevolverModal.set(true);
   }

   saveAsignacion(): void {
      const t = this.selectedTerritorio();
      if (!t || !this.newAsignacion.id_publicador) return;
      this.asignacionSaving.set(true);
      this.asignacionError.set(null);
      this.territoriosService.createAsignacion(t.id_territorio, {
         id_publicador: this.newAsignacion.id_publicador,
         fecha_asignacion: this.newAsignacion.fecha_asignacion,
         notas: this.newAsignacion.notas || undefined,
      }).subscribe({
         next: () => {
            this.asignacionSaving.set(false);
            this.showAsignarModal.set(false);
            // Update territory state locally
            const updated = { ...t, estado_territorio: 'Asignado' };
            this.selectedTerritorio.set(updated);
            this.territorios.update(list => list.map(x => x.id_territorio === t.id_territorio ? updated : x));
            this.loadAsignaciones(t.id_territorio);
         },
         error: () => {
            this.asignacionSaving.set(false);
            this.asignacionError.set('Error al guardar la asignación.');
         },
      });
   }

   saveDevolucion(): void {
      const t = this.selectedTerritorio();
      const activa = this.asignacionActiva();
      if (!t || !activa) return;
      this.asignacionSaving.set(true);
      this.asignacionError.set(null);
      this.territoriosService.devolverAsignacion(t.id_territorio, activa.id_asignacion, {
         fecha_devolucion: this.devolucionData.fecha_devolucion,
         notas: this.devolucionData.notas || undefined,
      }).subscribe({
         next: () => {
            this.asignacionSaving.set(false);
            this.showDevolverModal.set(false);
            const updated = { ...t, estado_territorio: 'Disponible' };
            this.selectedTerritorio.set(updated);
            this.territorios.update(list => list.map(x => x.id_territorio === t.id_territorio ? updated : x));
            this.loadAsignaciones(t.id_territorio);
         },
         error: () => {
            this.asignacionSaving.set(false);
            this.asignacionError.set('Error al registrar la devolución.');
         },
      });
   }

   manzanasPredicadasCount(): number {
      return this.manzanasConCobertura().filter(m => m.ultimaCobertura?.estado === 'Predicada').length;
   }

   manzanasPorcentaje(): number {
      const total = this.manzanasConCobertura().length;
      return total > 0 ? (this.manzanasPredicadasCount() / total * 100) : 0;
   }

   // ── Manzanas cobertura (Fase 4) ──────────────────────────────────────
   loadManzanasCobertura(): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.coberturaLoading.set(true);
      this.territoriosService.getManzanas(t.id_territorio).subscribe({
         next: (manzanas) => {
            // For each manzana, load its latest cobertura
            let pending = manzanas.length;
            if (pending === 0) { this.coberturaLoading.set(false); this.manzanasConCobertura.set([]); return; }
            const result: Array<Manzana & { ultimaCobertura?: CoberturaManzana }> = manzanas.map(m => ({ ...m }));
            manzanas.forEach((m, i) => {
               this.territoriosService.getCoberturas(m.id_manzana).subscribe({
                  next: (coberturas) => {
                     if (coberturas.length > 0) {
                        result[i] = { ...result[i], ultimaCobertura: coberturas[coberturas.length - 1] };
                     }
                     pending--;
                     if (pending === 0) {
                        this.manzanasConCobertura.set(result);
                        this.coberturaLoading.set(false);
                     }
                  },
                  error: () => { pending--; if (pending === 0) { this.manzanasConCobertura.set(result); this.coberturaLoading.set(false); } },
               });
            });
         },
      });
   }

   marcarManzanaPredicada(idManzana: number): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.coberturaSaving.set(idManzana);
      this.territoriosService.createCobertura(idManzana, {
         id_manzana: idManzana,
         estado: 'Predicada',
         fecha_inicio: new Date().toISOString().split('T')[0],
      }).subscribe({
         next: (cobertura) => {
            this.coberturaSaving.set(null);
            this.manzanasConCobertura.update(list =>
               list.map(m => m.id_manzana === idManzana ? { ...m, ultimaCobertura: cobertura } : m)
            );
         },
         error: () => this.coberturaSaving.set(null),
      });
   }

   startEditManzana(m: Manzana): void {
      this.editingManzanaId.set(m.id_manzana);
      this.editingManzanaNombre.set(m.numero_manzana);
   }

   cancelEditManzana(): void {
      this.editingManzanaId.set(null);
      this.editingManzanaNombre.set('');
   }

   saveEditManzana(idManzana: number): void {
      const t = this.selectedTerritorio();
      const nombre = this.editingManzanaNombre().trim();
      if (!t || !nombre) return;
      this.manzanaRenaming.set(idManzana);
      this.territoriosService.updateManzana(t.id_territorio, idManzana, { numero_manzana: nombre }).subscribe({
         next: () => {
            this.manzanasConCobertura.update(list =>
               list.map(m => m.id_manzana === idManzana ? { ...m, numero_manzana: nombre } : m)
            );
            this.manzanaRenaming.set(null);
            this.editingManzanaId.set(null);
            this.editingManzanaNombre.set('');
            // Reload manzanas GeoJSON so map label updates
            this.territoriosService.getManzanasGeoJSON(t.id_territorio).subscribe(gj => this.selectedManzanasGeoJSON.set(gj));
         },
         error: () => this.manzanaRenaming.set(null),
      });
   }

   deleteManzana(idManzana: number): void {
      const t = this.selectedTerritorio();
      if (!t || !confirm('¿Eliminar esta manzana? Esta acción no se puede deshacer.')) return;
      this.manzanaDeleting.set(idManzana);
      this.territoriosService.deleteManzana(t.id_territorio, idManzana).subscribe({
         next: () => {
            this.manzanasConCobertura.update(list => list.filter(m => m.id_manzana !== idManzana));
            this.manzanaDeleting.set(null);
            this.territoriosService.getManzanasGeoJSON(t.id_territorio).subscribe(gj => this.selectedManzanasGeoJSON.set(gj));
         },
         error: () => this.manzanaDeleting.set(null),
      });
   }

   setDetailTab(tab: 'info' | 'manzanas' | 'asignaciones'): void {
      this.activeDetailTab.set(tab);
      if (tab === 'manzanas' && this.manzanasConCobertura().length === 0) {
         this.loadManzanasCobertura();
      }
   }

   navigateToMap(): void {
      this.router.navigate(['/territorios/mapa']);
   }

   // ── Puntos ───────────────────────────────────────────────────────────
   loadPuntos(idTerritorio: number): void {
      this.territoriosService.getPuntos(idTerritorio).subscribe({
         next: (pts) => {
            this.puntos.set(pts);
            // Build GeoJSON for map rendering
            if (pts.length > 0) {
               const features = pts
                 .filter(p => p.coordenadas)
                 .map(p => ({
                   type: 'Feature' as const,
                   id: p.id_punto,
                   properties: { nombre: p.nombre, tipo: p.tipo, notas: p.notas, id_territorio: p.id_territorio },
                   geometry: p.coordenadas!,
                 }));
               this.selectedPuntosGeoJSON.set({ type: 'FeatureCollection', features });
            } else {
               this.selectedPuntosGeoJSON.set(null);
            }
         },
      });
   }

   deletePunto(idPunto: number): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.territoriosService.deletePunto(t.id_territorio, idPunto).subscribe({
         next: () => {
            this.puntos.update(list => list.filter(p => p.id_punto !== idPunto));
            this.loadPuntos(t.id_territorio); // refresh GeoJSON
         },
      });
   }

   // ── Mapa editor events ────────────────────────────────────────────────
   onManzanaDrawn(event: { geojson: any; numero: string }): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.manzanaSaving.set(true);
      this.territoriosService.createManzana(t.id_territorio, {
         id_territorio: t.id_territorio,
         numero_manzana: event.numero,
         coordenada: event.geojson.geometry ?? event.geojson,
      }).subscribe({
         next: () => {
            this.manzanaSaving.set(false);
            // Reload manzanas GeoJSON and stats
            this.territoriosService.getManzanasGeoJSON(t.id_territorio).subscribe({
               next: (manzanasGeo) => {
                  if (manzanasGeo?.features?.length > 0) {
                     this.selectedManzanasGeoJSON.set(manzanasGeo);
                  }
               },
            });
            this.territoriosService.getTerritorioStats(t.id_territorio).subscribe({
               next: (stats) => this.selectedStats.set(stats),
            });
         },
         error: () => this.manzanaSaving.set(false),
      });
   }

   onPuntoPlaced(event: { geojson: any; nombre: string; tipo: string; notas: string }): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.territoriosService.createPunto(t.id_territorio, {
         id_territorio: t.id_territorio,
         nombre: event.nombre,
         tipo: event.tipo,
         coordenadas: event.geojson,
         notas: event.notas || undefined,
      }).subscribe({
         next: () => this.loadPuntos(t.id_territorio),
      });
   }

   openCreateModal(): void {
      this.newTerritorio = { codigo: '', nombre: '', estado_territorio: 'Disponible' };
      this.showCreateModal.set(true);
   }

   closeCreateModal(): void {
      this.showCreateModal.set(false);
   }

   openMapEditor(): void {
      // Use the territory polygon only (not merged with manzanas)
      const polygon = this.selectedTerritorioPolygon();
      const fc: GeoJSONFeatureCollection = polygon ?? { type: 'FeatureCollection', features: [] };
      this.editingGeoJSON.set(fc);
      this.lastEditedGeoJSON.set(null);
      this.geoSaveError.set(null);
      this.showMapEditModal.set(true);
   }

   closeMapEditor(): void {
      this.showMapEditModal.set(false);
      this.editingGeoJSON.set(null);
      this.lastEditedGeoJSON.set(null);
      this.geoSaveError.set(null);
   }

   openEditInfoModal(): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.editingTerritorioInfo = {
         codigo: t.codigo,
         nombre: t.nombre,
         estado_territorio: t.estado_territorio,
         notas: t.notas || ''
      };
      this.editInfoError.set(null);
      this.showEditInfoModal.set(true);
   }

   closeEditInfoModal(): void {
      this.showEditInfoModal.set(false);
      this.editInfoError.set(null);
   }

   saveEditInfo(): void {
      const t = this.selectedTerritorio();
      if (!t || !this.editingTerritorioInfo.nombre || !this.editingTerritorioInfo.codigo) return;

      this.saving.set(true);
      this.editInfoError.set(null);
      this.territoriosService.updateTerritorio(t.id_territorio, {
         codigo: this.editingTerritorioInfo.codigo,
         nombre: this.editingTerritorioInfo.nombre,
         estado_territorio: this.editingTerritorioInfo.estado_territorio,
         notas: this.editingTerritorioInfo.notas
      }).subscribe({
         next: (updated) => {
            this.saving.set(false);
            this.closeEditInfoModal();
            this.territorios.update(list => list.map(item => item.id_territorio === updated.id_territorio ? updated : item));
            this.selectedTerritorio.set(updated);
         },
         error: (err) => {
            console.error('Error al actualizar info de territorio:', err);
            const msg = err?.error?.detail ?? 'Error al guardar los cambios. Intenta de nuevo.';
            this.editInfoError.set(typeof msg === 'string' ? msg : 'Error al guardar los cambios.');
            this.saving.set(false);
         }
      });
   }

   onGeometryChanged(fc: GeoJSONFeatureCollection): void {
      this.lastEditedGeoJSON.set(fc);
   }

   saveGeometry(): void {
      const fc = this.lastEditedGeoJSON();
      const t = this.selectedTerritorio();
      if (!t || !fc) {
         this.closeMapEditor();
         return;
      }

      this.geoSaveError.set(null);

      // Validate self-intersections with turf.kinks
      for (const feature of fc.features) {
         if (feature.geometry?.type === 'Polygon') {
            try {
               const kinks = geoKinks(feature as any);
               if (kinks.features.length > 0) {
                  this.geoSaveError.set('El polígono tiene líneas que se cruzan (auto-intersección). Edítalo para corregirlo antes de guardar.');
                  return;
               }
            } catch {}
         }
      }

      let geometryToSave = null;
      if (fc.features.length > 0) {
         geometryToSave = fc.features[0].geometry;
      }

      this.saving.set(true);
      this.territoriosService.updateTerritorio(t.id_territorio, { coordenada: geometryToSave }).subscribe({
         next: (updated) => {
            this.saving.set(false);
            this.closeMapEditor();
            this.selectTerritorio(updated);
            this.territorios.update(list => list.map(item => item.id_territorio === updated.id_territorio ? updated : item));
         },
         error: (err) => {
            console.error('Error al guardar geometría:', err);
            const msg = err?.error?.detail ?? 'Error al guardar la geometría. Intenta de nuevo.';
            this.geoSaveError.set(typeof msg === 'string' ? msg : 'Error al guardar la geometría.');
            this.saving.set(false);
         }
      });
   }

   saveNewTerritorio(): void {
      if (!this.newTerritorio.codigo || !this.newTerritorio.nombre) return;
      
      this.saving.set(true);
      this.territoriosService.createTerritorio(this.newTerritorio).subscribe({
         next: (created) => {
            // Add to the signals instead of reloading completely (optional)
            this.territorios.update(list => [created, ...list]);
            this.saving.set(false);
            this.closeCreateModal();
            this.selectTerritorio(created);
         },
         error: (err) => {
            console.error('Error al crear territorio:', err);
            this.saving.set(false);
         }
      });
   }

   async printCard(): Promise<void> {
      const t = this.selectedTerritorio();
      if (!t) return;

      this.showPrintCard.set(true);

      // Wait for card to render
      await new Promise(resolve => setTimeout(resolve, 1500));

      await exportTerritorioCard(
         `territorio-card-${t.id_territorio}`,
         t.codigo,
         'pdf'
      );

      this.showPrintCard.set(false);
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

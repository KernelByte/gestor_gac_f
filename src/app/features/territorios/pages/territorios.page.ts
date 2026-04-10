import { Component, signal, computed, inject, OnInit } from '@angular/core';
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
  TerritorioStats,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
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
    <div class="h-full flex flex-col w-full max-w-[1920px] mx-auto p-4 sm:p-8 relative gap-6">
      
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
          <button (click)="openCreateModal()" class="px-5 py-2.5 bg-[#6D28D9] text-white font-bold rounded-xl text-sm hover:bg-[#5b21b6] shadow-lg shadow-purple-900/20 dark:shadow-purple-900/40 transition-all active:scale-95 flex items-center gap-2">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nuevo Territorio
          </button>
        </div>
      </header>

      <!-- 2. KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <!-- Total -->
        <div class="bg-white dark:bg-slate-800/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col gap-4 relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-purple-50 dark:bg-purple-900/20 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div class="flex items-center gap-3 z-10">
            <div class="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
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

      <!-- 3. Main Content (List + Detail) -->
      <div class="flex-1 flex gap-6 min-h-0 relative">
        
        <!-- Left: List -->
        <div class="flex-1 flex flex-col bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden transition-all duration-300">
           
           <!-- Toolbar -->
           <div class="p-4 border-b border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row gap-4">
              <div class="relative flex-1">
                 <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                 <input 
                   [(ngModel)]="searchQuery"
                   type="text" 
                   placeholder="Buscar territorio..." 
                   class="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#6D28D9] dark:focus:border-[#6D28D9] focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-slate-400"
                 >
              </div>
              <div class="flex gap-2">
                 <select
                   [(ngModel)]="estadoFilter"
                   class="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors appearance-none cursor-pointer"
                 >
                   <option value="">Todos los Estados</option>
                   <option value="Disponible">Disponible</option>
                   <option value="Asignado">Asignado</option>
                   <option value="En Pausa">En Pausa</option>
                 </select>
              </div>
           </div>

           <!-- Table -->
           <div class="flex-1 overflow-y-auto simple-scrollbar relative">
              @if (loading()) {
                <div class="flex items-center justify-center py-20">
                  <div class="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
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
                      class="group cursor-pointer hover:bg-purple-50/40 dark:hover:bg-purple-900/20 transition-colors"
                      [class.bg-purple-50]="selectedTerritorio()?.id_territorio === t.id_territorio"
                      [class.dark:bg-purple-900/20]="selectedTerritorio()?.id_territorio === t.id_territorio"
                    >
                       <!-- Code/Name -->
                       <td class="px-6 py-4">
                          <p class="font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#6D28D9] dark:group-hover:text-purple-400 transition-colors">{{ t.codigo }}</p>
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
                    [class.bg-[#5B3C88]]="currentPage() === p"
                    [class.text-white]="currentPage() === p"
                    [class.shadow-md]="currentPage() === p"
                    [class.hover:bg-white]="currentPage() !== p"
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
          class="w-full md:w-[420px] shrink-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-xl overflow-hidden flex flex-col h-full absolute md:relative right-0 z-20"
        >
           <!-- Header -->
           <div class="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-start justify-between bg-slate-50/30 dark:bg-slate-900/30">
              <div>
                 <h2 class="text-[0.625rem] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest mb-1">Detalles Del Territorio</h2>
                 <h3 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{{ selectedTerritorio()!.codigo }}</h3>
                 <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{{ selectedTerritorio()!.nombre }}</p>
              </div>
              <button (click)="closeDetails()" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
           </div>
           
           <!-- Content -->
           <div class="flex-1 overflow-y-auto p-6 simple-scrollbar space-y-6">
              
              <!-- Interactive Map -->
              @if (selectedTerritorioGeoJSON()) {
                <app-territorio-map
                  [geojson]="selectedTerritorioGeoJSON()"
                  height="200px"
                  [interactive]="false"
                />
              } @else {
                <div class="w-full aspect-video bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 flex items-center justify-center">
                  <span class="text-xs text-slate-400 font-medium">Sin geometría disponible</span>
                </div>
              }

              <!-- Stats Grid -->
              @if (selectedStats()) {
              <div class="grid grid-cols-3 gap-3">
                 <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider mb-1">Manzanas</p>
                    <p class="text-2xl font-black text-slate-700 dark:text-slate-200">{{ selectedStats()!.manzanas_count }}</p>
                 </div>
                 <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider mb-1">Viviendas</p>
                    <p class="text-2xl font-black text-slate-700 dark:text-slate-200">{{ selectedStats()!.viviendas_count }}</p>
                 </div>
                 <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider mb-1">Cobertura</p>
                    <p class="text-2xl font-black text-slate-700 dark:text-slate-200">{{ selectedStats()!.cobertura_promedio }}%</p>
                 </div>
              </div>
              }

              <!-- Notas -->
              @if (selectedTerritorio()!.notas) {
                <div class="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-800/30">
                  <h4 class="text-[0.6875rem] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">Notas</h4>
                  <p class="text-sm text-slate-700 dark:text-slate-300">{{ selectedTerritorio()!.notas }}</p>
                </div>
              }
           </div>

           <!-- Footer Actions -->
           <div class="p-6 border-t border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 grid grid-cols-1 gap-3">
              <button
                (click)="printCard()"
                class="w-full py-3.5 bg-[#5B3C88] hover:bg-[#4a2f73] text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-900/10 dark:shadow-purple-900/40 transition-all flex items-center justify-center gap-2"
              >
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                 Imprimir Tarjeta
              </button>
              <div class="grid grid-cols-2 gap-3">
                 <button (click)="openEditInfoModal()" class="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Editar Info
                 </button>
                 <button (click)="openMapEditor()" class="py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                    Dibujar Mapa
                 </button>
              </div>
           </div>
        </div>
        }

        <!-- Hidden card for print (offscreen) -->
        @if (showPrintCard() && selectedTerritorio()) {
          <div style="position: fixed; left: -9999px; top: 0;">
            <app-territorio-card
              [territorio]="selectedTerritorio()"
              [geojson]="selectedTerritorioGeoJSON()"
              [stats]="selectedStats()"
            />
          </div>
        }

      </div>
      
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
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="closeEditInfoModal()"></div>
        
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-fadeIn">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
            <h3 class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Editar Info de Territorio
            </h3>
            <button (click)="closeEditInfoModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Código</label>
              <input type="text" [(ngModel)]="editingTerritorioInfo.codigo" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-not-allowed opacity-70" disabled>
              <p class="text-[0.65rem] text-slate-400 mt-1">El código no se puede modificar.</p>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Nombre</label>
              <input type="text" [(ngModel)]="editingTerritorioInfo.nombre" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Estado</label>
              <select [(ngModel)]="editingTerritorioInfo.estado_territorio" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
                <option value="Disponible">Disponible</option>
                <option value="Asignado">Asignado</option>
                <option value="En Pausa">En Pausa</option>
              </select>
            </div>
            <div>
               <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Notas / Instrucciones (Opcional)</label>
               <textarea [(ngModel)]="editingTerritorioInfo.notas" rows="3" placeholder="Ej: Zona residencial, muchas rejas..." class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none"></textarea>
            </div>
          </div>
          
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
            <button (click)="closeEditInfoModal()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">Cancelar</button>
            <button (click)="saveEditInfo()" [disabled]="!editingTerritorioInfo.nombre || saving()" class="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-2">
              @if (saving()) {
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              }
              Actualizar Info
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
              <p class="text-sm text-slate-500 mt-1 font-medium">Usa las herramientas de la esquina izquierda para dibujar, editar o borrar los límites del territorio.</p>
            </div>
            <button (click)="closeMapEditor()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700/50 p-2 rounded-full transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div class="flex-1 bg-slate-100 dark:bg-slate-900 relative">
            <app-territorio-map
              [geojson]="editingGeoJSON()"
              height="100%"
              [enableDrawing]="true"
              [interactive]="true"
              (geometryChanged)="onGeometryChanged($event)"
            />
          </div>
          
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3 shrink-0">
            <button (click)="closeMapEditor()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">Cancelar</button>
            <button (click)="saveGeometry()" [disabled]="saving()" class="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2">
              @if (saving()) {
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              }
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Guardar Límites Geográficos
            </button>
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
   showEditInfoModal = signal(false);

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

      // Load stats
      this.territoriosService.getTerritorioStats(t.id_territorio).subscribe({
         next: (stats) => this.selectedStats.set(stats),
      });

      // Load geojson for mini-map
      if (t.coordenada) {
         // Build a simple FeatureCollection from the territory's own geometry
         const fc: GeoJSONFeatureCollection = {
            type: 'FeatureCollection',
            features: [{
               type: 'Feature',
               id: t.id_territorio,
               properties: { codigo: t.codigo, nombre: t.nombre, estado_territorio: t.estado_territorio },
               geometry: t.coordenada,
            }],
         };
         this.selectedTerritorioGeoJSON.set(fc);

         // Also try to load manzanas geojson to overlay
         this.territoriosService.getManzanasGeoJSON(t.id_territorio).subscribe({
            next: (manzanasGeo) => {
               if (manzanasGeo && manzanasGeo.features.length > 0) {
                  const merged: GeoJSONFeatureCollection = {
                     type: 'FeatureCollection',
                     features: [...fc.features, ...manzanasGeo.features],
                  };
                  this.selectedTerritorioGeoJSON.set(merged);
               }
            },
         });
      }
   }

   closeDetails(): void {
      this.selectedTerritorio.set(null);
      this.selectedStats.set(null);
      this.selectedTerritorioGeoJSON.set(null);
   }

   navigateToMap(): void {
      this.router.navigate(['/territorios/mapa']);
   }

   openCreateModal(): void {
      this.newTerritorio = { codigo: '', nombre: '', estado_territorio: 'Disponible' };
      this.showCreateModal.set(true);
   }

   closeCreateModal(): void {
      this.showCreateModal.set(false);
   }

   openMapEditor(): void {
      if (!this.selectedTerritorioGeoJSON()) {
        // Enforce basic empty FeatureCollection if they had absolutely no geometry yet
         const fc: GeoJSONFeatureCollection = { type: 'FeatureCollection', features: [] };
         this.editingGeoJSON.set(fc);
      } else {
         this.editingGeoJSON.set(this.selectedTerritorioGeoJSON());
      }
      this.lastEditedGeoJSON.set(null);
      this.showMapEditModal.set(true);
   }

   closeMapEditor(): void {
      this.showMapEditModal.set(false);
      this.editingGeoJSON.set(null);
      this.lastEditedGeoJSON.set(null);
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
      this.showEditInfoModal.set(true);
   }

   closeEditInfoModal(): void {
      this.showEditInfoModal.set(false);
   }

   saveEditInfo(): void {
      const t = this.selectedTerritorio();
      if (!t || !this.editingTerritorioInfo.nombre) return;

      this.saving.set(true);
      this.territoriosService.updateTerritorio(t.id_territorio, {
         nombre: this.editingTerritorioInfo.nombre,
         estado_territorio: this.editingTerritorioInfo.estado_territorio,
         notas: this.editingTerritorioInfo.notas
      }).subscribe({
         next: (updated) => {
            this.saving.set(false);
            this.closeEditInfoModal();
            // Actualizamos la lista local y el seleccionado
            this.territorios.update(list => list.map(item => item.id_territorio === updated.id_territorio ? updated : item));
            this.selectedTerritorio.set(updated);
         },
         error: (err) => {
            console.error('Error al actualizar info de territorio:', err);
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
         return; // no changes made
      }

      // Extract the first feature (since it's a single territory)
      let geometryToSave = null;
      if (fc.features.length > 0) {
         // Usually we expect a single polygon for this territory. 
         // If they drew multiple, we'd ideally use MultiPolygon. 
         // For now, let's take the first feature's geometry.
         geometryToSave = fc.features[0].geometry;
      }

      this.saving.set(true);
      this.territoriosService.updateTerritorio(t.id_territorio, { coordenada: geometryToSave }).subscribe({
         next: (updated) => {
            this.saving.set(false);
            this.closeMapEditor();
            // Refresh the selected territory to show the new map
            this.selectTerritorio(updated);
            // Update in the main list
            this.territorios.update(list => list.map(item => item.id_territorio === updated.id_territorio ? updated : item));
         },
         error: (err) => {
            console.error('Error al guardar geometría:', err);
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

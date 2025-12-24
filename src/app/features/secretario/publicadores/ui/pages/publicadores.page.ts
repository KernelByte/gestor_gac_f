import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PublicadoresFacade } from '../../application/publicadores.facade';
import { Publicador } from '../../domain/models/publicador';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

interface Estado {
  id_estado: number;
  tipo: string;
  nombre_estado: string;
}

interface Grupo {
  id_grupo: number;
  nombre_grupo: string;
  capitan_grupo?: string;
}

type TabType = 'personal' | 'teocratico' | 'emergencia';

interface ContactoEmergencia {
  id_contacto_emergencia?: number;
  id_publicador: number;
  nombre: string;
  telefono?: string;
  parentesco?: string;
  direccion?: string;
  etiqueta?: string;
  es_principal?: boolean;
  solo_urgencias?: boolean;
}

@Component({
  standalone: true,
  selector: 'app-publicadores-list',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <!-- Layout Container (Flex Row) -->
    <div class="flex h-full gap-5 overflow-hidden">
    
    <!-- LEFT SIDE: Main Content (List, Search, Toolbar) -->
    <div class="flex-1 flex flex-col gap-5 min-w-0 transition-all duration-500 ease-in-out">
      
      <!-- Compact Toolbar -->
      <div class="shrink-0 bg-white rounded-xl shadow-sm border border-slate-200/60 p-1.5 flex items-center gap-1.5 flex-wrap lg:flex-nowrap">
        
        <!-- Search Input (Compact) -->
        <div class="relative flex-1 min-w-[200px]">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            <input 
                type="text" 
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearch($event)"
                placeholder="Buscar..." 
                class="w-full h-9 pl-9 pr-3 bg-slate-50 border-none rounded-lg text-sm text-slate-700 font-medium placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-orange/20 transition-all outline-none"
            >
        </div>

        <!-- Separator -->
        <div class="w-px h-6 bg-slate-200 hidden lg:block shrink-0"></div>

        <!-- Quick Filters (Pills) -->
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
            <button 
                (click)="selectedEstado.set(null); currentPage.set(1)"
                class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                [ngClass]="selectedEstado() === null 
                  ? 'bg-brand-orange text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            >
                Todos <span class="text-[10px] opacity-80">{{ totalFilteredCount() }}</span>
            </button>
            
            <button 
                *ngFor="let e of estadosWithCounts()"
                (click)="selectedEstado.set(e.id_estado); currentPage.set(1)"
                class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                [ngClass]="selectedEstado() === e.id_estado 
                  ? 'bg-brand-orange text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100'"
            >
                {{ e.nombre_estado }} <span class="text-[10px] opacity-60">{{ e.count }}</span>
            </button>
        </div>

        <!-- Separator -->
        <div class="w-px h-6 bg-slate-200 hidden lg:block shrink-0"></div>

        <!-- More Filters Dropdown (Compact) -->
        <div class="relative shrink-0">
            <button 
                (click)="showAdvancedFilters.set(!showAdvancedFilters())"
                class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                [ngClass]="selectedGrupoFilter() !== null 
                  ? 'bg-brand-orange text-white shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-100'"
            >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                <span class="hidden sm:inline">{{ selectedGrupoFilter() !== null ? getGrupoNombre(selectedGrupoFilter()) : 'Filtros' }}</span>
                <svg class="w-3 h-3 transition-transform" [class.rotate-180]="showAdvancedFilters()" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            
            <!-- Dropdown Menu -->
            <div 
                *ngIf="showAdvancedFilters()"
                class="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1.5 animate-fadeInUp"
            >
                <div class="px-3 py-1.5 border-b border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grupo de Predicación</p>
                </div>
                <div class="max-h-52 overflow-y-auto simple-scrollbar">
                    <button 
                        (click)="selectedGrupoFilter.set(null); showAdvancedFilters.set(false); currentPage.set(1)"
                        class="w-full px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 transition-colors flex items-center justify-between"
                        [class.text-brand-orange]="selectedGrupoFilter() === null"
                        [class.text-slate-700]="selectedGrupoFilter() !== null"
                    >
                        <span>Todos los Grupos</span>
                        <svg *ngIf="selectedGrupoFilter() === null" class="w-3.5 h-3.5 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    </button>
                    <button 
                        *ngFor="let g of grupos()"
                        (click)="selectedGrupoFilter.set(g.id_grupo); showAdvancedFilters.set(false); currentPage.set(1)"
                        class="w-full px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 transition-colors flex items-center justify-between"
                        [class.text-brand-orange]="selectedGrupoFilter() === g.id_grupo"
                        [class.text-slate-700]="selectedGrupoFilter() !== g.id_grupo"
                    >
                        <span>{{ g.nombre_grupo }}</span>
                        <svg *ngIf="selectedGrupoFilter() === g.id_grupo" class="w-3.5 h-3.5 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- Spacer -->
        <div class="flex-1 hidden lg:block"></div>

        <!-- Action Button (Compact, inside toolbar) -->
        <button 
            (click)="openCreateForm()"
            class="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 h-9 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-orange-900/10 transition-all active:scale-95 whitespace-nowrap"
        >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
            <span class="hidden sm:inline">Nuevo</span>
        </button>
      </div>

      <!-- Main Content Area: Flex Grow to Fill Space -->
      <div class="flex-1 min-h-0 relative bg-transparent md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 flex flex-col overflow-hidden">
        
        <!-- Loading Overlay -->
        <div *ngIf="vm().loading" class="absolute inset-0 z-20 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
           <div class="w-8 h-8 rounded-full border-2 border-slate-100 border-t-brand-orange animate-spin"></div>
        </div>

        <!-- Scrollable Content Container (Primary Scroll) -->
        <div class="flex-1 overflow-y-auto min-h-0 relative simple-scrollbar">
             
             <!-- 1. Mobile Card View (Visible < md) -->
             <div class="md:hidden p-4 space-y-4 pb-4">
                 <div *ngFor="let p of pagedList(); trackBy: trackById" class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative">
                     <div class="flex items-start justify-between mb-4">
                         <div class="flex items-center gap-3">
                             <div 
                                class="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border border-slate-100 text-sm font-bold shadow-sm"
                                [ngClass]="getAvatarClass(p.id_publicador)"
                            >
                               {{ getInitials(p) }}
                            </div>
                            <div>
                                <h3 class="font-bold text-slate-900 leading-tight">{{ p.primer_nombre }} {{ p.primer_apellido }}</h3>
                                <p class="text-xs text-slate-500 font-medium">{{ p.segundo_nombre }} {{ p.segundo_apellido }}</p>
                            </div>
                         </div>
                          <!-- Estado Badge Mobile -->
                         <span 
                             class="inline-flex h-2.5 w-2.5 rounded-full"
                             [ngClass]="getEstadoDotClass(p.id_estado_publicador)"
                         ></span>
                     </div>

                     <!-- Info Grid -->
                     <div class="grid grid-cols-2 gap-3 text-sm mb-4">
                         <div class="bg-slate-50 p-2 rounded-lg">
                             <span class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Grupo</span>
                             <span class="font-bold text-slate-700 truncate block">{{ getGrupoNombre(p.id_grupo_publicador) }}</span>
                         </div>
                         <div class="bg-slate-50 p-2 rounded-lg">
                             <span class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Estado</span>
                             <span class="font-bold text-slate-700 truncate block">{{ getEstadoNombre(p.id_estado_publicador) }}</span>
                         </div>
                         <div class="bg-slate-50 p-2 rounded-lg col-span-2 flex items-center gap-2">
                              <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                              <span class="font-medium text-slate-600">{{ p.telefono || 'Sin teléfono' }}</span>
                         </div>
                     </div>

                     <!-- Actions -->
                     <div class="flex gap-2">
                         <button (click)="openEditForm(p)" class="flex-1 py-2.5 rounded-xl bg-brand-orange/10 text-brand-orange font-bold text-xs hover:bg-brand-orange hover:text-white transition-colors">
                             Editar
                         </button>
                         <button (click)="confirmDelete(p)" class="py-2.5 px-4 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                             <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                         </button>
                     </div>
                 </div>
                  <!-- Empty State Mobile -->
                  <div *ngIf="pagedList().length === 0 && !vm().loading" class="text-center py-12">
                      <p class="text-slate-400 font-medium">No se encontraron resultados</p>
                  </div>
             </div>

             <!-- 2. Desktop Table View (Visible md+) -->
             <div class="hidden md:block">
                <table class="w-full text-left border-collapse">
                   <thead class="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-md shadow-sm">
                      <tr class="border-b border-slate-200">
                         <th class="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre</th>
                         <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Grupo</th>
                         <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Fecha Nac.</th>
                         <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider hidden xl:table-cell">Fecha Bau.</th>
                         <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Teléfono</th>
                         <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                         <th class="px-4 py-4 w-10"></th>
                      </tr>
                   </thead>
                   <tbody class="divide-y divide-slate-100">
                      <tr *ngFor="let p of pagedList(); trackBy: trackById" class="group hover:bg-slate-50 transition-all">
                         
                         <!-- Nombre -->
                         <td class="px-8 py-4 relative">
                            <div class="flex items-center gap-4">
                               <div 
                                   class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-black/5 text-xs font-bold"
                                   [ngClass]="getAvatarClass(p.id_publicador)"
                               >
                                  {{ getInitials(p) }}
                               </div>
                               <div>
                                  <p class="text-sm font-bold text-slate-900">{{ getFullName(p) }}</p>
                                  <p *ngIf="isAdminOrGestor()" class="text-xs text-slate-400 font-medium">ID: {{ p.id_publicador }}</p>
                               </div>
                            </div>
                         </td>

                         <!-- Grupo -->
                         <td class="px-6 py-4">
                            <div class="flex items-center gap-2 text-slate-600">
                               <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                               <span class="text-sm font-medium">{{ getGrupoNombre(p.id_grupo_publicador) || 'Sin Grupo' }}</span>
                            </div>
                         </td>

                         <!-- Fecha Nacimiento (LG+) -->
                         <td class="px-6 py-4 hidden lg:table-cell">
                            <span class="text-sm text-slate-600 font-medium">{{ formatDate(p.fecha_nacimiento) }}</span>
                         </td>

                         <!-- Fecha Bautismo (XL+) -->
                         <td class="px-6 py-4 hidden xl:table-cell">
                            <span class="text-sm text-slate-600 font-medium">{{ formatDate(p.fecha_bautismo) }}</span>
                         </td>

                         <!-- Teléfono (LG+) -->
                         <td class="px-6 py-4 hidden lg:table-cell">
                            <a 
                               *ngIf="p.telefono" 
                               [href]="'tel:' + p.telefono" 
                               class="text-sm text-slate-600 font-mono hover:text-brand-orange hover:underline transition-colors"
                            >{{ p.telefono }}</a>
                            <span *ngIf="!p.telefono" class="text-sm text-slate-400">—</span>
                         </td>

                         <!-- Estado -->
                         <td class="px-6 py-4">
                              <span 
                                 class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                                 [ngClass]="{
                                     'bg-emerald-50 text-emerald-700 border-emerald-100': getEstadoNombre(p.id_estado_publicador).includes('Activo'),
                                     'bg-red-50 text-red-700 border-red-100': getEstadoNombre(p.id_estado_publicador).includes('Inactivo'),
                                     'bg-slate-100 text-slate-600 border-slate-200': !getEstadoNombre(p.id_estado_publicador).includes('Activo') && !getEstadoNombre(p.id_estado_publicador).includes('Inactivo')
                                 }"
                             >
                                 <span class="w-1.5 h-1.5 rounded-full animate-pulse" [ngClass]="getEstadoDotClass(p.id_estado_publicador)"></span>
                                 {{ getEstadoNombre(p.id_estado_publicador) }}
                             </span>
                         </td>

                         <!-- Actions -->
                         <td class="px-6 py-4 text-right">
                            <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                               <button (click)="openEditForm(p)" class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-brand-orange transition-all shadow-sm hover:shadow-md hover:shadow-orange-200" title="Editar">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                               </button>
                               <button (click)="confirmDelete(p)" class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-red-500 transition-all shadow-sm hover:shadow-md hover:shadow-red-200" title="Eliminar">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                               </button>
                            </div>
                         </td>
                      </tr>

                      <!-- Empty State -->
                      <tr *ngIf="pagedList().length === 0 && !vm().loading">
                         <td colspan="7" class="py-20 text-center">
                             <div class="flex flex-col items-center">
                                 <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <svg class="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
                                 </div>
                                 <h3 class="text-slate-900 font-bold">No se encontraron miembros</h3>
                                 <p class="text-slate-500 text-sm mt-1">Intenta con otros términos de búsqueda.</p>
                             </div>
                         </td>
                      </tr>
                   </tbody>
                </table>
             </div>
        </div>

        <!-- Pagination Footer (Compact & Professional) -->
        <div class="shrink-0 z-20 px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-white md:rounded-b-2xl">
            <span class="text-[11px] font-semibold text-slate-500">
               {{ (currentPage() - 1) * pageSize + 1 }} - {{ Math.min(currentPage() * pageSize, filteredList().length) }} 
               de <span class="text-slate-900">{{ filteredList().length }}</span> registros
            </span>
            <div class="flex items-center gap-2">
                 <button 
                  (click)="prevPage()" 
                  [disabled]="currentPage() === 1"
                  class="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-orange hover:border-brand-orange/30 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all"
                 >
                   <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                 </button>
                 <button 
                  (click)="nextPage()" 
                  [disabled]="currentPage() * pageSize >= filteredList().length"
                  class="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-orange hover:border-brand-orange/30 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all"
                 >
                   <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                 </button>
            </div>
        </div>
      </div>
    </div> <!-- End Left Side -->

    <!-- RIGHT SIDE: Editor Panel (Side Sheet) -->
    <!-- RIGHT SIDE: Editor Panel (Side Sheet with Smooth Transition) -->
    <div 
      class="shrink-0 flex flex-col bg-white border-l border-y border-slate-200 overflow-hidden transition-all duration-500 cubic-bezier(0.4, 0.0, 0.2, 1)"
      [ngClass]="panelOpen() 
        ? 'w-[440px] opacity-100 rounded-2xl border translate-x-0 ml-0' 
        : 'w-0 opacity-0 border-none translate-x-20 ml-0'"
    >
      <!-- Fixed Width Inner Container (Prevent content squishing) -->
      <div class="w-[440px] flex flex-col h-full">
      <!-- Panel Header (Clean & Modern) -->
      <div class="shrink-0 bg-gradient-to-b from-slate-50 to-white">
        
        <!-- Top Row: Title & Close -->
        <div class="px-6 pt-5 pb-4 flex items-start justify-between">
          <div>
            <h2 class="text-lg font-bold text-slate-900 leading-tight">
              {{ editingPublicador() ? 'Editar Publicador' : 'Nuevo Publicador' }}
            </h2>
            <p class="text-xs text-slate-500 mt-0.5" *ngIf="editingPublicador()">
              {{ editingPublicador()?.primer_nombre }} {{ editingPublicador()?.segundo_nombre }} {{ editingPublicador()?.primer_apellido }} {{ editingPublicador()?.segundo_apellido }}
            </p>
            <p class="text-xs text-slate-500 mt-0.5" *ngIf="!editingPublicador()">
              Complete la información requerida
            </p>
          </div>
          <button 
            (click)="tryClosePanel()" 
            class="p-1.5 -mt-1 -mr-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tabs Navigation (Modern Pill Style) -->
        <div class="px-6 pb-4">
          <div class="flex p-1 bg-slate-100/80 rounded-xl">
            <button 
              (click)="activeTab.set('personal')" 
              class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200"
              [ngClass]="activeTab() === 'personal' 
                ? 'bg-white text-brand-orange shadow-sm ring-1 ring-black/5' 
                : 'text-slate-500 hover:text-slate-700'"
            >
              Personal
            </button>
            <button 
              (click)="activeTab.set('teocratico')" 
              class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200"
              [ngClass]="activeTab() === 'teocratico' 
                ? 'bg-white text-brand-orange shadow-sm ring-1 ring-black/5' 
                : 'text-slate-500 hover:text-slate-700'"
            >
              Teocrático
            </button>
            <button 
              *ngIf="editingPublicador()" 
              (click)="activeTab.set('emergencia')" 
              class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200"
              [ngClass]="activeTab() === 'emergencia' 
                ? 'bg-white text-brand-orange shadow-sm ring-1 ring-black/5' 
                : 'text-slate-500 hover:text-slate-700'"
            >
              Emergencia
            </button>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent shrink-0"></div>

            <!-- 3. Scrollable Content Area -->
            <div class="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">
              <form [formGroup]="publicadorForm" (ngSubmit)="onSubmit()" class="space-y-6 pb-20"> <!-- pb-20 para espacio extra al final -->

                <!-- TAB: PERSONAL -->
                <!-- TAB: PERSONAL -->
                <div *ngIf="activeTab() === 'personal'" class="space-y-5 animate-fadeIn">
                     <!-- Sección Identidad (Card Sutil) -->
                     <div class="bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                        <div class="flex items-center gap-2 mb-4">
                            <div class="w-1 h-4 bg-brand-orange rounded-full"></div>
                            <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Identidad</h3>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-x-4 gap-y-4">
                             <!-- Fila 1: Nombres -->
                             <div class="col-span-1">
                               <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Primer Nombre <span class="text-red-500">*</span></label>
                               <input formControlName="primer_nombre" placeholder="Ej: Juan" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                             </div>
                             <div class="col-span-1">
                               <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Segundo Nombre</label>
                               <input formControlName="segundo_nombre" placeholder="Ej: Carlos" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                             </div>
                             
                             <!-- Fila 2: Apellidos -->
                             <div class="col-span-1">
                               <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Primer Apellido <span class="text-red-500">*</span></label>
                               <input formControlName="primer_apellido" placeholder="Ej: Pérez" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                             </div>
                             <div class="col-span-1">
                               <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Segundo Apellido</label>
                               <input formControlName="segundo_apellido" placeholder="Ej: García" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                             </div>
                        </div>
                     </div>

                     <!-- Sección Contacto -->
                     <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="col-span-1">
                                <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Teléfono</label>
                                <input formControlName="telefono" placeholder="+57 300..." class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                            </div>
                             <div class="col-span-1">
                                <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Sexo</label>
                                <select formControlName="sexo" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all cursor-pointer appearance-none">
                                    <option value="">Seleccionar</option>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Femenino">Femenino</option>
                                </select>
                             </div>
                        </div>

                         <div class="col-span-2">
                            <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Dirección / Barrio</label>
                            <input formControlName="direccion" placeholder="Calle 123 # 45-67" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="col-span-1">
                                <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Fecha Nacimiento</label>
                                <input type="date" formControlName="fecha_nacimiento" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                            </div>
                            
                            <!-- Estado (Compacto) -->
                            <div class="col-span-1">
                                <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Estado Inicial</label>
                                <div class="flex items-center gap-3 h-10 px-1">
                                     <label class="flex items-center gap-2 cursor-pointer group">
                                         <div class="relative flex items-center justify-center">
                                            <input type="radio" value="1" class="peer sr-only" [checked]="getEstadoNombre(publicadorForm.get('id_estado_publicador')?.value).includes('Activo')" (change)="setEstado('Activo')">
                                            <div class="w-4 h-4 border-2 border-slate-300 rounded-full peer-checked:border-brand-orange peer-checked:bg-brand-orange transition-all"></div>
                                         </div>
                                         <span class="text-xs font-bold text-slate-600 group-hover:text-slate-800">Activo</span>
                                     </label>
                                      <label class="flex items-center gap-2 cursor-pointer group">
                                         <div class="relative flex items-center justify-center">
                                            <input type="radio" value="2" class="peer sr-only" [checked]="getEstadoNombre(publicadorForm.get('id_estado_publicador')?.value).includes('Inactivo')" (change)="setEstado('Inactivo')">
                                             <div class="w-4 h-4 border-2 border-slate-300 rounded-full peer-checked:border-brand-orange peer-checked:bg-brand-orange transition-all"></div>
                                         </div>
                                         <span class="text-xs font-bold text-slate-600 group-hover:text-slate-800">Inactivo</span>
                                     </label>
                                 </div>
                            </div>
                        </div>
                     </div>
                </div>

                <!-- TAB: TEOCRÁTICO -->
                <div *ngIf="activeTab() === 'teocratico'" class="space-y-4 animate-fadeIn">
                       
                       <div class="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3">
                            <label class="block text-[11px] font-bold text-slate-500 mb-0.5 ml-0.5">Grupo de Servicio</label>
                            <select formControlName="id_grupo_publicador" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all cursor-pointer appearance-none">
                                <option [ngValue]="null">Sin asignar</option>
                                <option *ngFor="let g of grupos()" [ngValue]="g.id_grupo">{{ g.nombre_grupo }}</option>
                            </select>
                       </div>

                       <div class="grid grid-cols-2 gap-4">
                         <div class="col-span-1">
                             <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Fecha Bautismo</label>
                             <input type="date" formControlName="fecha_bautismo" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                         </div>
                         <div class="col-span-1">
                             <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Estado</label>
                             <select formControlName="id_estado_publicador" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all cursor-pointer appearance-none">
                                 <option [ngValue]="null">Seleccionar</option>
                                 <option *ngFor="let e of estadosPublicador()" [ngValue]="e.id_estado">{{ e.nombre_estado }}</option>
                             </select>
                         </div>
                       </div>
                       
                       <!-- Privilegios (Card Distinct) -->
                       <div class="mt-4 p-4 bg-orange-50/50 rounded-xl border border-orange-100/60">
                          <label class="block text-xs font-bold text-orange-800 uppercase tracking-wide mb-3">Privilegios</label>
                          <div class="flex flex-wrap gap-2">
                               <button 
                                type="button" 
                                (click)="toggleUngido()"
                                [class.bg-brand-orange]="publicadorForm.get('ungido')?.value"
                                [class.text-white]="publicadorForm.get('ungido')?.value"
                                [class.border-brand-orange]="publicadorForm.get('ungido')?.value"
                                [class.bg-white]="!publicadorForm.get('ungido')?.value"
                                [class.text-slate-600]="!publicadorForm.get('ungido')?.value"
                                [class.border-slate-200]="!publicadorForm.get('ungido')?.value"
                                class="px-4 py-2 rounded-lg border text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                               >
                                  <span class="w-2 h-2 rounded-full" [class.bg-white]="publicadorForm.get('ungido')?.value" [class.bg-slate-300]="!publicadorForm.get('ungido')?.value"></span>
                                  Ungido
                               </button>
                          </div>
                      </div>
                </div>

                <!-- TAB: EMERGENCIA -->
                <div *ngIf="activeTab() === 'emergencia'" class="space-y-6 animate-fadeIn">
                    
                    <!-- Header Actions -->
                    <div class="flex items-center justify-between" *ngIf="!showContactoForm()">
                        <div>
                           <h3 class="text-sm font-bold text-slate-900">Contactos Registrados</h3>
                           <p class="text-xs text-slate-500">En caso de urgencia médica o accidente.</p>
                        </div>
                        <button 
                          type="button"
                          (click)="initNewContacto()"
                          class="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange/10 text-brand-orange rounded-xl text-xs font-bold hover:bg-brand-orange hover:text-white transition-all"
                        >
                           <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                           Agregar Contacto
                        </button>
                    </div>

                    <!-- Lista de Contactos -->
                    <div *ngIf="!showContactoForm()" class="space-y-3">
                        <div *ngFor="let c of contactos()" class="p-4 rounded-xl border border-orange-200/50 bg-orange-50/30 hover:bg-orange-50 hover:border-brand-orange transition-all group relative">
                             <div class="flex justify-between items-start">
                                 <div>
                                     <div class="flex items-center gap-2 mb-1">
                                         <h4 class="text-sm font-bold text-slate-800">{{ c.nombre }}</h4>
                                         <span *ngIf="c.parentesco" class="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wide">{{ c.parentesco }}</span>
                                         <span *ngIf="c.es_principal" class="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-bold border border-orange-200">Principal</span>
                                     </div>
                                     <div class="flex flex-col gap-1">
                                        <div class="flex items-center gap-2 text-xs text-slate-600 font-medium">
                                            <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                            {{ c.telefono || 'Sin teléfono' }}
                                        </div>
                                         <div *ngIf="c.direccion" class="flex items-center gap-2 text-xs text-slate-500">
                                            <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                            {{ c.direccion }}
                                        </div>
                                     </div>
                                 </div>
                                 
                                 <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button type="button" (click)="editContacto(c)" class="p-2 text-slate-400 hover:text-brand-orange hover:bg-orange-50 rounded-lg transition-colors">
                                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                     </button>
                                     <button type="button" (click)="deleteContacto(c)" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                     </button>
                                 </div>
                             </div>
                        </div>

                        <!-- Empty State Contactos -->
                        <div *ngIf="contactos().length === 0" class="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                             <div class="w-12 h-12 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                 <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                             </div>
                             <p class="text-sm font-medium text-slate-900">Sin contactos de emergencia</p>
                             <p class="text-xs text-slate-500 mt-1">Agrega información vital para urgencias.</p>
                        </div>
                    </div>

                    <!-- Formulario Contacto (Inline) -->
                     <!-- Formulario Contacto (Inline Refined) -->
                     <div *ngIf="showContactoForm()" [formGroup]="contactoForm" class="bg-slate-50 p-5 rounded-2xl border border-slate-200 animate-fadeInUp">
                          <h4 class="text-sm font-bold text-slate-900 mb-4">{{ editingContacto() ? 'Editar Contacto' : 'Nuevo Contacto' }}</h4>
                          
                          <div class="space-y-4">
                              <div>
                                  <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Nombre Completo</label>
                                  <input formControlName="nombre" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                              </div>
                              
                              <div class="grid grid-cols-2 gap-4">
                                  <div class="col-span-1">
                                     <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Parentesco</label>
                                     <input formControlName="parentesco" placeholder="Ej. Madre" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                                  </div>
                                  <div class="col-span-1">
                                     <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Teléfono</label>
                                     <input formControlName="telefono" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                                  </div>
                              </div>
                              
                              <div>
                                  <label class="block text-[11px] font-bold text-slate-500 mb-1.5 ml-0.5">Dirección (Opcional)</label>
                                  <input formControlName="direccion" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all">
                              </div>

                              <div class="flex gap-6 pt-2">
                                  <label class="flex items-center gap-2 cursor-pointer group">
                                      <div class="relative flex items-center justify-center">
                                         <input type="checkbox" formControlName="es_principal" class="peer sr-only">
                                         <div class="w-4 h-4 border-2 border-slate-300 rounded md:rounded-md peer-checked:bg-brand-orange peer-checked:border-brand-orange transition-all"></div>
                                         <svg class="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                      </div>
                                      <span class="text-xs font-bold text-slate-600 group-hover:text-slate-800">Contacto Principal</span>
                                  </label>
                                  <label class="flex items-center gap-2 cursor-pointer group">
                                      <div class="relative flex items-center justify-center">
                                         <input type="checkbox" formControlName="solo_urgencias" class="peer sr-only">
                                         <div class="w-4 h-4 border-2 border-slate-300 rounded md:rounded-md peer-checked:bg-brand-orange peer-checked:border-brand-orange transition-all"></div>
                                         <svg class="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                      </div>
                                      <span class="text-xs font-bold text-slate-600 group-hover:text-slate-800">Solo Urgencias</span>
                                  </label>
                              </div>
                          </div>

                          <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200/50">
                              <button type="button" (click)="showContactoForm.set(false)" class="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-white hover:text-slate-800 transition-all">Cancelar</button>
                              <button 
                                type="button" 
                                (click)="saveContacto()"
                                [disabled]="contactoForm.invalid"
                                class="px-5 py-2.5 rounded-xl bg-brand-orange text-white font-bold text-xs shadow-lg shadow-orange-900/10 hover:bg-orange-600 hover:shadow-orange-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                              >
                                {{ editingContacto() ? 'Actualizar' : 'Guardar Contacto' }}
                              </button>
                          </div>
                     </div>
                </div>

              </form>
           </div>

           <!-- Panel Footer -->
           <div class="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
               <button 
                  type="button"
                  (click)="tryClosePanel()" 
                  class="px-5 h-11 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-white hover:border-slate-300 hover:text-slate-700 transition-all"
               >
                  Cancelar
               </button>
               <button 
                  type="button"
                  (click)="onSubmit()" 
                  [disabled]="publicadorForm.invalid || saving()" 
                  class="px-8 h-11 rounded-xl bg-brand-orange text-white font-bold text-sm hover:bg-orange-600 shadow-lg shadow-orange-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
               >
                  <svg *ngIf="saving()" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {{ saving() ? 'Guardando...' : (editingPublicador() ? 'Guardar Cambios' : 'Crear Publicador') }}
               </button>
           </div>
      </div> <!-- End Inner Container -->
    </div> <!-- End Detail Panel Outer -->

       <!-- Delete Modal (Clean) -->
      <div *ngIf="deleteModalOpen()" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity" (click)="closeDeleteModal()"></div>
          <div class="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-fadeInUp">
             <h3 class="text-lg font-bold text-slate-900 mb-2">¿Eliminar miembro?</h3>
             <p class="text-sm text-slate-500 mb-6">Esta acción eliminará permanentemente a <strong class="text-slate-900">{{ publicadorToDelete()?.primer_nombre }}</strong> de la base de datos.</p>
             <div class="flex gap-3 justify-end">
                <button (click)="closeDeleteModal()" class="px-4 py-2 rounded-lg text-slate-600 font-bold text-sm hover:bg-slate-50">Cancelar</button>
                <button (click)="executeDelete()" class="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700">Eliminar</button>
             </div>
          </div>
      </div>

  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .simple-scrollbar::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    .simple-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .simple-scrollbar::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 4px;
    }
    .simple-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #cbd5e1;
    }
    .animate-fadeIn {
        animation: fadeIn 0.3s ease-out forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(10px); }
        to { opacity: 1; transform: translateX(0); }
    }
    .animate-fadeInUp {
        animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .box-decoration-clone {
        box-decoration-break: clone;
    }
    .animate-slideInRight {
      animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `]
})
export class PublicadoresListComponent implements OnInit {
  private facade = inject(PublicadoresFacade);
  private authStore = inject(AuthStore);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);

  vm = this.facade.vm;
  Math = Math;

  // UI State
  panelOpen = signal(false);
  deleteModalOpen = signal(false);
  saving = signal(false);
  editingPublicador = signal<Publicador | null>(null);
  publicadorToDelete = signal<Publicador | null>(null);
  activeTab = signal<TabType>('personal');

  // Client-Side Filter & Pagination State
  searchQuery = signal('');
  selectedEstado = signal<number | null>(null);
  selectedGrupo: number | null = null;

  currentPage = signal(1);
  pageSize = 20;

  // Advanced Filters
  showAdvancedFilters = signal(false);
  selectedGrupoFilter = signal<number | null>(null);

  // Auxiliary Data
  estados = signal<Estado[]>([]);
  grupos = signal<Grupo[]>([]);
  contactos = signal<ContactoEmergencia[]>([]);
  showContactoForm = signal(false);
  editingContacto = signal<ContactoEmergencia | null>(null);

  // Role Check - Solo admin y gestor pueden ver el ID
  isAdminOrGestor = computed(() => {
    const user = this.authStore.user();
    const rol = user?.rol?.toLowerCase() || '';
    return rol.includes('admin') || rol.includes('gestor');
  });

  // Form
  publicadorForm: FormGroup;
  contactoForm: FormGroup;

  constructor() {
    this.publicadorForm = this.fb.group({
      primer_nombre: ['', [Validators.required, Validators.maxLength(100)]],
      segundo_nombre: ['', Validators.maxLength(100)],
      primer_apellido: ['', [Validators.required, Validators.maxLength(100)]],
      segundo_apellido: ['', Validators.maxLength(100)],
      sexo: [''],
      fecha_nacimiento: [null],
      telefono: [''],
      direccion: [''],
      barrio: [''],
      fecha_bautismo: [null],
      ungido: [false],
      id_grupo_publicador: [null],
      id_estado_publicador: [null, Validators.required],
      consentimiento_datos: [false]
    });

    this.contactoForm = this.fb.group({
      nombre: ['', Validators.required],
      parentesco: [''],
      telefono: [''],
      direccion: [''],
      etiqueta: [''],
      es_principal: [false],
      solo_urgencias: [false]
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.loadAuxiliaryData();
  }

  // Computed values
  estadosPublicador = computed(() => {
    return this.estados().filter(e => e.tipo === 'Teocratico');
  });

  rawList = computed(() => this.vm().list);

  // Filter Logic
  filteredList = computed(() => {
    let list = this.rawList();
    const q = this.searchQuery().toLowerCase().trim();
    const estadoId = this.selectedEstado();

    if (q) {
      list = list.filter(p =>
        p.primer_nombre.toLowerCase().includes(q) ||
        p.primer_apellido.toLowerCase().includes(q) ||
        p.segundo_nombre?.toLowerCase().includes(q) ||
        p.segundo_apellido?.toLowerCase().includes(q) ||
        (p.telefono && p.telefono.includes(q))
      );
    }

    if (estadoId !== null) {
      list = list.filter(p => p.id_estado_publicador === estadoId);
    }

    // Filter by Group
    const grupoId = this.selectedGrupoFilter();
    if (grupoId !== null) {
      list = list.filter(p => p.id_grupo_publicador == grupoId);
    }

    return list;
  });

  // Pagination Logic
  pagedList = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredList().slice(start, end);
  });

  // Stats Logic for Chips (Dynamic - based on search-filtered list)
  estadosWithCounts = computed(() => {
    // Base list for counting: apply search but NOT estado filter
    let baseList = this.rawList();
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      baseList = baseList.filter(p =>
        p.primer_nombre.toLowerCase().includes(q) ||
        p.primer_apellido.toLowerCase().includes(q) ||
        p.segundo_nombre?.toLowerCase().includes(q) ||
        p.segundo_apellido?.toLowerCase().includes(q) ||
        (p.telefono && p.telefono.includes(q))
      );
    }
    return this.estadosPublicador().map(e => ({
      ...e,
      count: baseList.filter(p => p.id_estado_publicador === e.id_estado).length
    }));
  });

  // Total filtered count for "Todos" chip
  totalFilteredCount = computed(() => {
    let baseList = this.rawList();
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      baseList = baseList.filter(p =>
        p.primer_nombre.toLowerCase().includes(q) ||
        p.primer_apellido.toLowerCase().includes(q) ||
        p.segundo_nombre?.toLowerCase().includes(q) ||
        p.segundo_apellido?.toLowerCase().includes(q) ||
        (p.telefono && p.telefono.includes(q))
      );
    }
    return baseList.length;
  });

  // Data Loading
  loadData() {
    const user = this.authStore.user();
    // Load ALL items (limit 1000) for client-side functionality
    const params: any = { limit: 1000, offset: 0 };
    if (user?.id_congregacion) {
      params.id_congregacion = user.id_congregacion;
    }
    this.facade.load(params);
  }

  async loadAuxiliaryData() {
    try {
      const user = this.authStore.user();
      const params: any = {};
      if (user?.id_congregacion) {
        params.id_congregacion = user.id_congregacion;
      }

      // Added trailing slashes to match service configuration
      const estados = await lastValueFrom(this.http.get<Estado[]>('/api/estados/'));
      this.estados.set(estados || []);

      const grupos = await lastValueFrom(this.http.get<Grupo[]>('/api/grupos/', { params }));
      this.grupos.set(grupos || []);

      // Debug log to verify data integrity
      console.log('Aux Data Loaded:', { estados: estados, grupos: grupos });
    } catch (error) {
      console.error('Error loading auxiliary data:', error);
    }
  }

  // Search & Filters
  // Search & Filters (Purely Client Side Updates)
  onSearch(value: string) {
    this.searchQuery.set(value);
    this.currentPage.set(1); // Reset to first page
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage() {
    if (this.currentPage() * this.pageSize < this.filteredList().length) {
      this.currentPage.update(p => p + 1);
    }
  }

  // Panel
  openCreateForm() {
    this.editingPublicador.set(null);
    this.activeTab.set('personal');
    this.publicadorForm.reset({
      consentimiento_datos: false,
      ungido: false,
      id_grupo_publicador: null,
      id_estado_publicador: null
    });
    this.panelOpen.set(true);
  }

  openEditForm(p: Publicador) {
    console.log('Editing Publicador:', p); // Debug log
    this.editingPublicador.set(p);
    this.activeTab.set('personal');
    this.publicadorForm.patchValue({
      primer_nombre: p.primer_nombre,
      segundo_nombre: p.segundo_nombre || '',
      primer_apellido: p.primer_apellido,
      segundo_apellido: p.segundo_apellido || '',
      sexo: p.sexo || '',
      fecha_nacimiento: p.fecha_nacimiento || null,
      telefono: p.telefono || '',
      direccion: p.direccion || '',
      barrio: p.barrio || '',
      fecha_bautismo: p.fecha_bautismo || null,
      ungido: p.ungido ?? false,
      id_grupo_publicador: p.id_grupo_publicador || null,
      id_estado_publicador: p.id_estado_publicador || null,
      consentimiento_datos: p.consentimiento_datos || false
    });
    this.panelOpen.set(true);
  }

  closePanel() {
    this.panelOpen.set(false);
    this.editingPublicador.set(null);
    this.publicadorForm.reset();
  }

  // Dirty Check - Warn user if there are unsaved changes
  tryClosePanel() {
    if (this.publicadorForm.dirty) {
      const confirmClose = confirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres cerrar?');
      if (confirmClose) {
        this.closePanel();
      }
    } else {
      this.closePanel();
    }
  }

  toggleUngido() {
    const current = this.publicadorForm.get('ungido')?.value;
    this.publicadorForm.get('ungido')?.setValue(!current);
  }

  // Helper to set estado from Radio buttons quick action in side panel
  setEstado(type: 'Activo' | 'Inactivo') {
    const estado = this.estadosPublicador().find(e => e.nombre_estado.includes(type));
    if (estado) {
      this.publicadorForm.get('id_estado_publicador')?.setValue(estado.id_estado);
    }
  }

  async onSubmit() {
    if (this.publicadorForm.invalid) return;

    this.saving.set(true);
    const data = this.publicadorForm.value;

    const user = this.authStore.user();
    const id_congregacion = user?.id_congregacion;
    const isAdminOrGestor = user?.rol?.toLowerCase().includes('admin') || user?.rol?.toLowerCase().includes('gestor');

    // Validación: Si NO es admin, necesita ID congregación siempre.
    // Si ES admin, puede no tener ID, pero si CREA uno nuevo, necesita contexto (pendiente UI).
    // Si ES admin y EDITA, todo bien.

    if (!id_congregacion && !isAdminOrGestor) {
      alert('Error: No se ha detectado tu congregación.');
      this.saving.set(false);
      return;
    }

    if (!id_congregacion && isAdminOrGestor && !this.editingPublicador()) {
      alert('Aviso: Como administrador, debes seleccionar una congregación para crear miembros (Función pendiente en UI).');
      this.saving.set(false);
      return;
    }

    try {
      if (this.editingPublicador()) {
        await this.facade.update(this.editingPublicador()!.id_publicador, data);
      } else {
        await this.facade.create({ ...data, id_congregacion_publicador: id_congregacion });
      }
      this.closePanel();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      this.saving.set(false);
    }
  }

  // Delete
  confirmDelete(p: Publicador) {
    this.publicadorToDelete.set(p);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal() {
    this.deleteModalOpen.set(false);
    this.publicadorToDelete.set(null);
  }

  async executeDelete() {
    const p = this.publicadorToDelete();
    if (p) {
      await this.facade.remove(p.id_publicador);
      this.closeDeleteModal();
    }
  }

  // Helpers
  trackById(index: number, item: Publicador) {
    return item.id_publicador;
  }

  getInitials(p: Publicador | null): string {
    if (!p) return '';
    const first = p.primer_nombre?.charAt(0) || '';
    const last = p.primer_apellido?.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  getAvatarClass(id: number): string {
    const COLORS = [
      'bg-blue-100 text-blue-700',
      'bg-emerald-100 text-emerald-700',
      'bg-orange-100 text-orange-700',
      'bg-purple-100 text-purple-700',
      'bg-cyan-100 text-cyan-700',
      'bg-rose-100 text-rose-700',
      'bg-teal-100 text-teal-700',
      'bg-indigo-100 text-indigo-700'
    ];
    return COLORS[Math.abs(id) % COLORS.length];
  }

  getFullName(p: Publicador): string {
    return [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
      .filter(n => n && n.trim())
      .join(' ');
  }

  getGrupoNombre(id: number | string | null | undefined): string {
    if (!id) return 'Sin Grupo'; // Better default text
    // Use loose equality (==) to handle potential string/number mismatches in API response
    const grupo = this.grupos().find(g => g.id_grupo == id);
    return grupo?.nombre_grupo || 'Sin Grupo';
  }

  getEstadoNombre(id: number | string | null | undefined): string {
    if (!id) return 'Sin estado';
    const estado = this.estados().find(e => e.id_estado == id);
    return estado?.nombre_estado || 'Sin estado';
  }

  getEstadoTextClass(id: number | string | null | undefined): string {
    const nombre = this.getEstadoNombre(id)?.toLowerCase() || '';
    if (nombre.includes('inactivo')) return 'text-red-500';
    if (nombre.includes('activo')) return 'text-emerald-500';
    return 'text-slate-400';
  }

  getEstadoDotClass(id: number | string | null | undefined): string {
    const nombre = this.getEstadoNombre(id)?.toLowerCase() || '';
    if (nombre.includes('inactivo')) return 'bg-red-500';
    if (nombre.includes('activo')) return 'bg-emerald-500';
    return 'bg-slate-300';
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return '—';
    try {
      // Extract date parts directly from ISO string to avoid timezone issues
      const parts = date.split('T')[0].split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
      }
      // Fallback for other formats
      const d = new Date(date);
      const userTimezoneOffset = d.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(d.getTime() + userTimezoneOffset);
      const dd = String(adjustedDate.getDate()).padStart(2, '0');
      const mm = String(adjustedDate.getMonth() + 1).padStart(2, '0');
      const yyyy = adjustedDate.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return date;
    }
  }

  // --- Emergencia Logic ---

  async loadContactos() {
    const pub = this.editingPublicador();
    if (!pub) return;
    try {
      const res = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', {
        params: { id_publicador: pub.id_publicador }
      }));
      this.contactos.set(res || []);
    } catch (e) {
      console.error('Error loading contactos', e);
      this.contactos.set([]);
    }
  }

  initNewContacto() {
    this.editingContacto.set(null);
    this.contactoForm.reset({ es_principal: false, solo_urgencias: false });
    this.showContactoForm.set(true);
  }

  editContacto(c: ContactoEmergencia) {
    this.editingContacto.set(c);
    this.contactoForm.patchValue({
      nombre: c.nombre,
      parentesco: c.parentesco,
      telefono: c.telefono,
      direccion: c.direccion,
      etiqueta: c.etiqueta,
      es_principal: c.es_principal,
      solo_urgencias: c.solo_urgencias
    });
    this.showContactoForm.set(true);
  }

  async saveContacto() {
    if (this.contactoForm.invalid) return;

    const val = this.contactoForm.value;
    const pub = this.editingPublicador();
    if (!pub) return;

    try {
      if (this.editingContacto()) {
        const id = this.editingContacto()!.id_contacto_emergencia;
        await lastValueFrom(this.http.put('/api/contactos-emergencia/' + id, val));
      } else {
        const payload = { ...val, id_publicador: pub.id_publicador };
        await lastValueFrom(this.http.post('/api/contactos-emergencia/', payload));
      }
      this.showContactoForm.set(false);
      this.loadContactos();
    } catch (e) {
      console.error('Error saving contacto', e);
      alert('Error al guardar contacto');
    }
  }

  async deleteContacto(c: ContactoEmergencia) {
    if (!confirm('¿Eliminar este contacto?')) return;
    try {
      await lastValueFrom(this.http.delete('/api/contactos-emergencia/' + c.id_contacto_emergencia));
      this.loadContactos();
    } catch (e) {
      alert('Error eliminando contacto');
    }
  }
}

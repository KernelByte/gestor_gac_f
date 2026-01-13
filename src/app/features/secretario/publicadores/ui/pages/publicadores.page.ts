import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PublicadoresFacade } from '../../application/publicadores.facade';
import { Publicador } from '../../domain/models/publicador';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { PrivilegiosService } from '../../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../../privilegios/domain/models/publicador-privilegio';
import { DatePickerComponent } from '../../../../../shared/components/date-picker/date-picker.component';

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePickerComponent],
  template: `
    <!-- Layout Container (Flex Row) -->
    <div class="flex h-full overflow-hidden">
    
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
        <div class="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
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

        <!-- More Filters Dropdown (Advanced) -->
        <div class="relative shrink-0 hidden md:block">
            <!-- Trigger Button -->
            <button 
                (click)="showAdvancedFilters.set(!showAdvancedFilters())"
                class="flex items-center gap-2 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all border outline-none"
                [ngClass]="activeFiltersCount() > 0 
                  ? 'bg-orange-50 border-orange-200 text-brand-orange shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'"
            >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                <span class="hidden sm:inline">Filtros</span>
                <span *ngIf="activeFiltersCount() > 0" class="flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-brand-orange text-white text-[9px] font-black shadow-sm">
                    {{ activeFiltersCount() }}
                </span>
                <svg class="w-3 h-3 opacity-50 transition-transform duration-200" [class.rotate-180]="showAdvancedFilters()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            
            <!-- Backdrop (Click Outside) -->
             <div *ngIf="showAdvancedFilters()" (click)="showAdvancedFilters.set(false)" class="fixed inset-0 z-40 bg-transparent"></div>

            <!-- Dropdown Menu -->
            <div 
                *ngIf="showAdvancedFilters()"
                class="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 z-50 overflow-hidden animate-fadeInUp flex flex-col max-h-[80vh]"
            >
                <!-- Header -->
                <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 sticky top-0">
                    <span class="text-xs font-bold text-slate-800">Filtros Avanzados</span>
                    <button 
                        *ngIf="activeFiltersCount() > 0"
                        (click)="clearFilters()"
                        class="text-[10px] font-bold text-brand-orange hover:text-orange-600 transition-colors uppercase tracking-wider"
                    >
                        Limpiar Todo
                    </button>
                </div>

                <!-- Scrollable Content -->
                <div class="overflow-y-auto p-2 simple-scrollbar">
                    
                    <!-- Section: Privilegios -->
                    <div class="mb-4">
                        <div class="px-2 py-1.5 flex items-center gap-2">
                             <span class="w-1 h-3 rounded-full bg-indigo-500"></span>
                             <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Privilegios</span>
                        </div>
                        <div class="space-y-0.5">
                            <label 
                                *ngFor="let p of privilegios()"
                                class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                            >
                                <span class="text-xs font-bold text-slate-700 group-hover:text-slate-900">{{ p.nombre_privilegio }}</span>
                                <div class="relative flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        [checked]="selectedPrivilegiosFilter().includes(p.id_privilegio)"
                                        (change)="togglePrivilegioFilter(p.id_privilegio)"
                                        class="peer sr-only"
                                    >
                                    <div class="w-4 h-4 border-2 border-slate-200 rounded transition-all peer-checked:bg-indigo-500 peer-checked:border-indigo-500 peer-checked:ring-2 peer-checked:ring-indigo-500/20"></div>
                                    <svg class="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="h-px bg-slate-100 mx-2 my-2"></div>

                    <!-- Section: Grupos -->
                    <div class="mb-2">
                        <div class="px-2 py-1.5 flex items-center gap-2">
                             <span class="w-1 h-3 rounded-full bg-brand-orange"></span>
                             <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grupos</span>
                        </div>
                        <div class="space-y-0.5">
                            <label 
                                *ngFor="let g of grupos()"
                                class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                            >
                                <span class="text-xs font-bold text-slate-700 group-hover:text-slate-900">{{ g.nombre_grupo }}</span>
                                <div class="relative flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        [checked]="selectedGruposFilter().includes(g.id_grupo)"
                                        (change)="toggleGrupoFilter(g.id_grupo)"
                                        class="peer sr-only"
                                    >
                                    <div class="w-4 h-4 border-2 border-slate-200 rounded transition-all peer-checked:bg-brand-orange peer-checked:border-brand-orange peer-checked:ring-2 peer-checked:ring-brand-orange/20"></div>
                                    <svg class="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            </label>
                        </div>
                    </div>
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
                                class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-sm font-bold shadow-sm"
                                [ngClass]="getAvatarClass(p.id_publicador)"
                            >
                               {{ getInitials(p) }}
                            </div>
                            <div>
                                <h3 class="font-bold text-slate-900 leading-tight mb-1">{{ p.primer_nombre }} {{ p.primer_apellido }}</h3>
                                <div class="flex flex-wrap gap-1 items-center">
                                     <ng-container *ngFor="let role of getRoles(p)">
                                          <span *ngIf="role.type === 'pill'" class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm" [ngClass]="role.class">
                                              {{ role.label }}
                                          </span>
                                          <span *ngIf="role.type === 'text'" class="text-[10px] uppercase tracking-wider" [ngClass]="role.class">
                                              {{ role.label }}
                                          </span>
                                     </ng-container>
                                </div>
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
                  <div *ngIf="pagedList().length === 0 && !vm().loading" class="text-center py-16 px-4">
                      <div class="w-16 h-16 mx-auto bg-gradient-to-br from-orange-50 via-white to-amber-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-orange-100/50">
                         <svg class="w-8 h-8 text-orange-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <h3 class="text-slate-800 font-bold mb-1">No se encontraron publicadores</h3>
                      <p class="text-slate-400 text-sm mb-4">Ajusta los filtros o búsqueda</p>
                      <button (click)="openCreateForm()" class="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-bold shadow-md shadow-orange-500/20">
                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                         Agregar
                      </button>
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
                                   class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-sm font-bold shadow-sm"
                                   [ngClass]="getAvatarClass(p.id_publicador)"
                               >
                                  {{ getInitials(p) }}
                               </div>
                                  <div class="flex flex-col gap-0.5 justify-center">
                                      <p class="text-sm font-bold text-slate-900 leading-tight mb-0.5">{{ getFullName(p) }}</p>
                                      <div class="flex flex-wrap gap-1 items-center">
                                         <ng-container *ngFor="let role of getRoles(p)">
                                              <span *ngIf="role.type === 'pill'" class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm" [ngClass]="role.class">
                                                  {{ role.label }}
                                              </span>
                                              <span *ngIf="role.type === 'text'" class="text-[10px] uppercase tracking-wider" [ngClass]="role.class">
                                                  {{ role.label }}
                                              </span>
                                         </ng-container>
                                         <span *ngIf="isAdminOrGestor()" class="text-[10px] text-slate-300 font-medium">#{{ p.id_publicador }}</span>
                                      </div>
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
                         <td colspan="7" class="py-24 text-center">
                             <div class="flex flex-col items-center">
                                 <div class="w-20 h-20 bg-gradient-to-br from-orange-50 via-white to-amber-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-orange-100/50 ring-4 ring-orange-50/50">
                                    <svg class="w-10 h-10 text-orange-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                       <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                       <circle cx="9" cy="7" r="4"></circle>
                                       <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                       <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                 </div>
                                 <h3 class="text-lg font-bold text-slate-800 mb-1">No se encontraron publicadores</h3>
                                 <p class="text-slate-500 text-sm max-w-xs">Intenta ajustando los filtros o términos de búsqueda.</p>
                                 <button (click)="openCreateForm()" class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-orange text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-95">
                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
                                    Agregar Publicador
                                 </button>
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
      class="shrink-0 flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:h-auto"
      [ngClass]="panelOpen() 
        ? 'w-full opacity-100 md:w-[480px] md:ml-5' 
        : 'w-0 opacity-0 md:ml-0'"
    >
      <!-- Inner Container with premium styling -->
      <div class="h-full flex flex-col bg-white rounded-none md:rounded-l-3xl shadow-2xl shadow-slate-900/10 border-l border-slate-100 overflow-hidden">
        
        <!-- Premium Gradient Header -->
        <div class="shrink-0 relative overflow-hidden">
             <!-- Background gradient -->
             <div class="hidden md:block absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-amber-50/30"></div>
             <div class="hidden md:block absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-100/50 to-transparent rounded-full -mr-16 -mt-16 blur-2xl"></div>
             
             <div class="relative px-4 pt-4 pb-2 md:px-8 md:pt-8 md:pb-4">
                <div class="flex items-start justify-between">
                     <div class="flex gap-4">
                         <!-- Icon with gradient background -->
                         <div class="hidden md:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange to-orange-500 text-white items-center justify-center shrink-0 shadow-lg shadow-orange-500/30 ring-4 ring-white">
                              <svg *ngIf="!editingPublicador()" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                              <svg *ngIf="editingPublicador()" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                         </div>
                         <div>
                             <div class="flex items-center gap-2 mb-1.5">
                                <span class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest"
                                      [ngClass]="editingPublicador() ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'">
                                  {{ editingPublicador() ? 'Modo Edición' : 'Nuevo Registro' }}
                                </span>
                             </div>
                             <h2 class="text-2xl font-display font-black text-slate-900 tracking-tight">
                                 {{ editingPublicador() ? 'Editar Publicador' : 'Nuevo Publicador' }}
                             </h2>
                             <p class="text-sm text-slate-500 mt-0.5" *ngIf="editingPublicador()">
                               {{ getFullName(editingPublicador()!) }}
                             </p>
                             <p class="text-sm text-slate-500 mt-0.5 hidden md:block" *ngIf="!editingPublicador()">
                               Complete la información requerida
                             </p>
                         </div>
                     </div>
                    <button (click)="tryClosePanel()" class="p-2.5 -mr-2 text-slate-400 hover:text-slate-600 transition-all rounded-xl hover:bg-white/80 hover:shadow-sm group">
                        <svg class="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
             </div>

             <!-- Tabs Navigation -->
             <div class="px-8 pb-6">
                <div class="flex p-1 bg-slate-100/50 hover:bg-slate-100/80 transition-colors rounded-xl border border-slate-200/50 backdrop-blur-sm">
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

        <!-- Divider is not needed with the new design, content scrolls cleanly -->

            <!-- 3. Scrollable Content Area -->
            <div class="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">
              <form [formGroup]="publicadorForm" (ngSubmit)="onSubmit()" class="space-y-6 pb-20"> <!-- pb-20 para espacio extra al final -->

                <!-- TAB: PERSONAL -->
                <!-- TAB: PERSONAL -->
                <div *ngIf="activeTab() === 'personal'" class="space-y-6 animate-fadeIn bg-white">
                     
                     <!-- Section: Identidad -->
                     <div class="space-y-6">
                        <div class="flex items-center gap-3 py-2">
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                           <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identidad</span>
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                             <!-- Fila 1: Nombres -->
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                                  Primer Nombre <span class="text-red-400">*</span>
                               </label>
                               <input formControlName="primer_nombre" (input)="capitalizeInput('primer_nombre')" placeholder="Ej: Juan" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                             </div>
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                                  Segundo Nombre
                               </label>
                               <input formControlName="segundo_nombre" (input)="capitalizeInput('segundo_nombre')" placeholder="Ej: Carlos" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                             </div>
                             
                             <!-- Fila 2: Apellidos -->
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                                  Primer Apellido <span class="text-red-400">*</span>
                               </label>
                               <input formControlName="primer_apellido" (input)="capitalizeInput('primer_apellido')" placeholder="Ej: Pérez" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                             </div>
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                                  Segundo Apellido
                               </label>
                               <input formControlName="segundo_apellido" (input)="capitalizeInput('segundo_apellido')" placeholder="Ej: García" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                             </div>
                        </div>
                     </div>

                     <!-- Section: Contacto -->
                     <div class="space-y-6">
                        <div class="flex items-center gap-3 py-2">
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                           <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contacto</span>
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                  Teléfono
                                </label>
                                <input formControlName="telefono" placeholder="+57 300..." class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                            </div>
                             <div class="col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Sexo
                                </label>
                                <!-- Custom Dropdown for Sexo -->
                                <div class="relative">
                                    <button
                                      type="button"
                                      (click)="sexoDropdownOpen.set(!sexoDropdownOpen())"
                                      class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-left shadow-sm hover:border-slate-300 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none flex items-center justify-between"
                                      [class.text-slate-400]="!publicadorForm.get('sexo')?.value"
                                      [class.text-slate-800]="publicadorForm.get('sexo')?.value"
                                    >
                                        {{ getSexoDisplayName() }}
                                        <svg class="w-4 h-4 text-slate-400 transition-transform duration-200" [class.rotate-180]="sexoDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                    </button>

                                    <!-- Dropdown Menu -->
                                    <div 
                                      *ngIf="sexoDropdownOpen()"
                                      class="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-fadeIn"
                                    >
                                        <div class="p-1">
                                            <button 
                                              type="button"
                                              (click)="publicadorForm.get('sexo')?.setValue('M'); sexoDropdownOpen.set(false)"
                                              class="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group"
                                              [ngClass]="publicadorForm.get('sexo')?.value === 'M' ? 'bg-orange-50 text-brand-orange' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
                                            >
                                                Masculino
                                                <svg *ngIf="publicadorForm.get('sexo')?.value === 'M'" class="w-4 h-4 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                                            </button>
                                            <button 
                                              type="button"
                                              (click)="publicadorForm.get('sexo')?.setValue('F'); sexoDropdownOpen.set(false)"
                                              class="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group"
                                              [ngClass]="publicadorForm.get('sexo')?.value === 'F' ? 'bg-orange-50 text-brand-orange' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
                                            >
                                                Femenino
                                                <svg *ngIf="publicadorForm.get('sexo')?.value === 'F'" class="w-4 h-4 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <!-- Overlay to close on click outside -->
                                    <div *ngIf="sexoDropdownOpen()" (click)="sexoDropdownOpen.set(false)" class="fixed inset-0 z-40 bg-transparent"></div>
                                </div>
                             </div>
                        </div>

                         <div class="col-span-2 space-y-2">
                            <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                               <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                               Dirección / Barrio
                            </label>
                            <input formControlName="direccion" placeholder="Calle 123 # 45-67" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                   <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                   Fecha Nacimiento
                                </label>
                                <app-date-picker formControlName="fecha_nacimiento" placeholder="Seleccionar fecha"></app-date-picker>
                            </div>
                            
                            <!-- Estado (Radio Group Styled) -->
                            <div class="col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                   <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                   Estado Inicial
                                </label>
                                <div class="flex items-center gap-2 h-12">
                                     <button type="button" 
                                             (click)="setEstado('Activo')"
                                             class="flex-1 h-10 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2"
                                             [ngClass]="getEstadoNombre(publicadorForm.get('id_estado_publicador')?.value).includes('Activo') 
                                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'">
                                         <div class="w-2 h-2 rounded-full" [ngClass]="getEstadoNombre(publicadorForm.get('id_estado_publicador')?.value).includes('Activo') ? 'bg-emerald-500' : 'bg-slate-300'"></div>
                                         Activo
                                     </button>
                                     <button type="button" 
                                             (click)="setEstado('Inactivo')"
                                             class="flex-1 h-10 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2"
                                             [ngClass]="getEstadoNombre(publicadorForm.get('id_estado_publicador')?.value).includes('Inactivo') 
                                                ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' 
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'">
                                         <div class="w-2 h-2 rounded-full" [ngClass]="getEstadoNombre(publicadorForm.get('id_estado_publicador')?.value).includes('Inactivo') ? 'bg-red-500' : 'bg-slate-300'"></div>
                                         Inactivo
                                     </button>
                                 </div>
                            </div>
                        </div>
                     </div>
                </div>

                <!-- TAB: TEOCRÁTICO is next -->

                <!-- TAB: TEOCRÁTICO -->
                <div *ngIf="activeTab() === 'teocratico'" class="space-y-6 animate-fadeIn bg-white">
                       
                       <!-- Header -->
                       <div class="flex items-center gap-3 py-2">
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                           <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servicio</span>
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                       </div>

                       <div class="space-y-2">
                            <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                               <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                               Grupo de Servicio
                            </label>
                            <div class="relative">
                                <select [compareWith]="compareFn" formControlName="id_grupo_publicador" class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none appearance-none cursor-pointer">
                                    <option [ngValue]="null">Sin asignar</option>
                                    <option *ngFor="let g of grupos(); trackBy: trackGroupById" [ngValue]="g.id_grupo">{{ g.nombre_grupo }}</option>
                                </select>
                                <div class="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                </div>
                            </div>
                       </div>

                       <div class="grid grid-cols-2 gap-4">
                         <div class="col-span-1 space-y-2">
                             <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                               <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                               Fecha Bautismo
                             </label>
                             <app-date-picker formControlName="fecha_bautismo" placeholder="Seleccionar fecha"></app-date-picker>
                         </div>
                         <div class="col-span-1 space-y-2">
                             <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                               <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                               Estado
                             </label>
                             <div class="relative">
                                 <!-- Backdrop for click outside -->
                                 <div *ngIf="estadoDropdownOpen()" (click)="estadoDropdownOpen.set(false)" class="fixed inset-0 z-10"></div>
                                 
                                 <!-- Trigger Button -->
                                 <button 
                                   type="button"
                                   (click)="toggleEstadoDropdown()"
                                   class="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none flex items-center justify-between"
                                 >
                                    <span [class.text-slate-400]="!publicadorForm.get('id_estado_publicador')?.value">
                                      {{ getSelectedEstadoName() }}
                                    </span>
                                    <svg class="w-4 h-4 text-slate-400 transition-transform duration-200" [class.rotate-180]="estadoDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                 </button>

                                 <!-- Dropdown Menu -->
                                 <div *ngIf="estadoDropdownOpen()" class="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-fadeIn">
                                     <div class="max-h-48 overflow-y-auto py-1">
                                         <button 
                                           type="button"
                                           (click)="selectEstado(null)"
                                           class="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-50 transition-colors flex items-center justify-between"
                                         >
                                             Seleccionar
                                             <svg *ngIf="!publicadorForm.get('id_estado_publicador')?.value" class="w-4 h-4 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                         </button>
                                         <button 
                                           *ngFor="let e of estadosPublicador()" 
                                           type="button"
                                           (click)="selectEstado(e.id_estado)"
                                           class="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-orange transition-colors flex items-center justify-between"
                                         >
                                             {{ e.nombre_estado }}
                                             <svg *ngIf="publicadorForm.get('id_estado_publicador')?.value == e.id_estado" class="w-4 h-4 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                         </button>
                                     </div>
                                 </div>
                             </div>
                         </div>
                       </div>
                       
                       <!-- Privilegios Management Section (Only in Edit Mode) -->
                       <div *ngIf="editingPublicador()" class="pt-4 space-y-4 border-t border-slate-100 mt-4">
                           <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Privilegios</label>

                           <!-- List of Privileges -->
                           <div class="space-y-2">
                               <div *ngFor="let pp of publicadorPrivilegios(); trackBy: trackPrivilegeById" class="p-3 rounded-xl border border-slate-100 bg-slate-50 relative group transition-all hover:bg-white hover:shadow-sm hover:border-slate-200">
                                   <div class="flex items-start justify-between">
                                       <div>
                                           <h4 class="text-xs font-bold text-slate-800">{{ getPrivilegioNombre(pp.id_privilegio) }}</h4>
                                           <div class="text-[11px] text-slate-500 font-medium flex gap-2">
                                               <span>Desde: {{ formatDate(pp.fecha_inicio) }}</span>
                                               <span *ngIf="pp.fecha_fin" class="text-slate-400">Hasta: {{ formatDate(pp.fecha_fin) }}</span>
                                               <span *ngIf="!pp.fecha_fin" class="text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-50 rounded-md">Activo</span>
                                           </div>
                                       </div>
                                       <button type="button" (click)="deletePublicadorPrivilegio(pp.id_publicador_privilegio)" class="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition-all">
                                           <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                       </button>
                                   </div>
                               </div>
                               <div *ngIf="publicadorPrivilegios().length === 0" class="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                   <p class="text-xs text-slate-400">Sin privilegios asignados</p>
                               </div>
                           </div>


                           <!-- Add New Privilege Form -->
                           <div class="bg-indigo-50/30 rounded-xl p-3 border border-indigo-100 relative">
                               <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Asignar Nuevo</p>
                               <div class="space-y-3">
                                   <!-- Custom Select Privilegio -->
                                   <div class="relative">
                                       <!-- Backdrop for click outside -->
                                       <div *ngIf="privilegeDropdownOpen()" (click)="privilegeDropdownOpen.set(false)" class="fixed inset-0 z-10"></div>
                                       
                                       <!-- Trigger -->
                                       <button 
                                         type="button"
                                         (click)="togglePrivilegeDropdown()"
                                         class="w-full h-10 px-3 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm flex items-center justify-between hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                                       >
                                          <span [class.text-slate-400]="!newPrivilegio().id_privilegio">
                                            {{ getSelectedPrivilegeName() }}
                                          </span>
                                          <svg class="w-4 h-4 text-slate-400 transition-transform duration-200" [class.rotate-180]="privilegeDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                       </button>

                                       <!-- Dropdown Menu -->
                                       <div *ngIf="privilegeDropdownOpen()" class="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-fadeIn">
                                           <div class="max-h-48 overflow-y-auto py-1">
                                               <button 
                                                 *ngFor="let p of privilegios()" 
                                                 type="button"
                                                 (click)="selectNewPrivilege(p)"
                                                 class="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-between group"
                                               >
                                                   {{ p.nombre_privilegio }}
                                                   <svg *ngIf="newPrivilegio().id_privilegio === p.id_privilegio" class="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                               </button>
                                               <div *ngIf="privilegios().length === 0" class="px-4 py-2 text-xs text-slate-400 text-center">No hay opciones</div>
                                           </div>
                                       </div>
                                   </div>
                                   
                                   <!-- Dates Row -->
                                   <div class="grid grid-cols-2 gap-2">
                                       <div>
                                           <label class="block text-[9px] text-slate-500 font-bold mb-1">Inicio</label>
                                           <app-date-picker 
                                             [ngModel]="newPrivilegio().fecha_inicio"
                                             (ngModelChange)="updateNewPrivilegio('fecha_inicio', $event)"
                                             [ngModelOptions]="{standalone: true}"
                                             placeholder="Seleccionar"
                                           ></app-date-picker>
                                       </div>
                                       <div [class.opacity-50]="!isAuxiliarySelected()" [class.pointer-events-none]="!isAuxiliarySelected()">
                                           <label class="block text-[9px] text-slate-500 font-bold mb-1">Fin (Opcional)</label>
                                           <app-date-picker 
                                             [ngModel]="newPrivilegio().fecha_fin"
                                             (ngModelChange)="updateNewPrivilegio('fecha_fin', $event)"
                                             [ngModelOptions]="{standalone: true}"
                                             [disabled]="!isAuxiliarySelected()"
                                             placeholder="Seleccionar"
                                           ></app-date-picker>
                                       </div>
                                   </div>

                                   <!-- Add Button -->
                                   <button 
                                     type="button" 
                                     (click)="addPrivilegio()"
                                     [disabled]="!canAddPrivilegio()"
                                     class="w-full h-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-indigo-500/20 transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                   >
                                       <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                       Asignar Privilegio
                                   </button>
                               </div>
                           </div>
                       </div>
                       <div *ngIf="!editingPublicador()" class="mt-6 p-4 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200">
                           <p class="text-xs text-slate-400">Guarda el publicador para gestionar sus privilegios.</p>
                       </div>

                       <!-- Privilegios Management Section (Only in Edit Mode) -->
                       <div class="pt-2 space-y-3">
                          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Privilegios Especiales</label>
                          <button 
                            type="button" 
                            (click)="toggleUngido()"
                            [class.ring-2]="publicadorForm.get('ungido')?.value"
                            [class.ring-brand-orange]="publicadorForm.get('ungido')?.value"
                            [class.bg-orange-50]="publicadorForm.get('ungido')?.value"
                            [class.border-brand-orange]="publicadorForm.get('ungido')?.value"
                            [class.bg-white]="!publicadorForm.get('ungido')?.value"
                            [class.border-slate-200]="!publicadorForm.get('ungido')?.value"
                            class="w-full h-14 rounded-xl border flex items-center justify-between px-4 transition-all duration-200 group"
                          >
                              <div class="flex items-center gap-3">
                                  <div class="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                                       [ngClass]="publicadorForm.get('ungido')?.value ? 'bg-brand-orange text-white' : 'bg-slate-100 text-slate-400'">
                                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                                  </div>
                                  <div class="text-left">
                                      <span class="block text-sm font-bold" [ngClass]="publicadorForm.get('ungido')?.value ? 'text-brand-orange' : 'text-slate-700'">Participante de los emblemas</span>
                                      <span class="text-xs text-slate-500 font-medium">Ungido</span>
                                  </div>
                              </div>
                              <div class="w-5 h-5 rounded-full border flex items-center justify-center transition-colors"
                                   [ngClass]="publicadorForm.get('ungido')?.value ? 'border-brand-orange bg-brand-orange' : 'border-slate-300'">
                                  <svg *ngIf="publicadorForm.get('ungido')?.value" class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              </div>
                          </button>
                      </div>                </div>

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
                     <!-- Formulario Contacto (Inline Refined) -->
                     <div *ngIf="showContactoForm()" [formGroup]="contactoForm" class="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm animate-fadeInUp">
                          <h4 class="text-lg font-display font-bold text-slate-900 mb-6">{{ editingContacto() ? 'Editar Contacto' : 'Nuevo Contacto' }}</h4>
                          
                          <div class="space-y-4">
                              <div class="space-y-2">
                                  <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                     <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                     Nombre Completo
                                  </label>
                                  <input formControlName="nombre" class="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-4 focus:ring-brand-orange/10 focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 font-normal">
                              </div>
                              
                              <div class="grid grid-cols-2 gap-4">
                                  <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        Parentesco
                                     </label>
                                     <input formControlName="parentesco" placeholder="Ej. Madre" class="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-4 focus:ring-brand-orange/10 focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 font-normal">
                                  </div>
                                  <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        Teléfono
                                     </label>
                                     <input formControlName="telefono" class="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-4 focus:ring-brand-orange/10 focus:border-brand-orange transition-all outline-none">
                                  </div>
                              </div>
                              
                              <div class="space-y-2">
                                  <label class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                     <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                     Dirección (Opcional)
                                  </label>
                                  <input formControlName="direccion" class="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 shadow-sm hover:border-slate-300 focus:ring-4 focus:ring-brand-orange/10 focus:border-brand-orange transition-all outline-none">
                              </div>

                              <div class="flex gap-4 pt-4">
                                  <label class="flex-1 flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-brand-orange/30 cursor-pointer transition-all group">
                                      <span class="text-xs font-bold text-slate-600 group-hover:text-slate-800">Contacto Principal</span>
                                      <div class="relative flex items-center justify-center">
                                         <input type="checkbox" formControlName="es_principal" class="peer sr-only">
                                         <div class="w-5 h-5 border border-slate-300 rounded peer-checked:bg-brand-orange peer-checked:border-brand-orange transition-all"></div>
                                         <svg class="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                      </div>
                                  </label>
                                  <label class="flex-1 flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-brand-orange/30 cursor-pointer transition-all group">
                                      <span class="text-xs font-bold text-slate-600 group-hover:text-slate-800">Solo Urgencias</span>
                                      <div class="relative flex items-center justify-center">
                                         <input type="checkbox" formControlName="solo_urgencias" class="peer sr-only">
                                         <div class="w-5 h-5 border border-slate-300 rounded peer-checked:bg-brand-orange peer-checked:border-brand-orange transition-all"></div>
                                         <svg class="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                      </div>
                                  </label>
                              </div>
                          </div>

                          <div class="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                              <button type="button" (click)="showContactoForm.set(false)" class="px-5 py-2.5 rounded-xl border-2 border-slate-100 text-slate-500 font-bold text-xs hover:bg-slate-50 hover:text-slate-700 transition-all">Cancelar</button>
                              <button 
                                type="button" 
                                (click)="saveContacto()"
                                [disabled]="contactoForm.invalid"
                                class="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-lg shadow-slate-900/20 hover:bg-black hover:shadow-slate-900/30 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                              >
                                {{ editingContacto() ? 'Actualizar' : 'Guardar' }}
                              </button>
                          </div>
                     </div>
                </div>
              </form>
           </div>

           <!-- Panel Footer -->
           <div class="px-8 py-5 border-t border-slate-100 bg-white flex items-center justify-between gap-4 shrink-0">
               <div class="hidden sm:block">
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                     <span class="text-red-400">*</span> Campo obligatorio
                  </p>
               </div>
               <div class="flex items-center gap-3 w-full sm:w-auto">
                   <button 
                      type="button"
                      (click)="tryClosePanel()" 
                      class="flex-1 sm:flex-none px-6 h-11 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all focus:ring-4 focus:ring-slate-100 outline-none"
                   >
                      Cancelar
                   </button>
                   <button 
                      type="button"
                      (click)="onSubmit()" 
                      [disabled]="publicadorForm.invalid || saving()" 
                      class="flex-1 sm:flex-none px-8 h-11 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-bold text-sm hover:shadow-lg hover:shadow-brand-orange/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                   >
                      <svg *ngIf="saving()" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      {{ saving() ? 'Guardando...' : (editingPublicador() ? 'Guardar Cambios' : 'Crear Registro') }}
                   </button>
               </div>
           </div>
      </div> <!-- End Inner Container -->
    </div> <!-- End Detail Panel Outer -->

       <!-- Delete Modal (Clean) -->
      <!-- Delete Modal (Refined & Clean) -->
      <div *ngIf="deleteModalOpen()" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <!-- Backdrop: Clean dark overlay without blur -->
          <div class="absolute inset-0 bg-slate-900/50 transition-opacity" (click)="closeDeleteModal()"></div>
          
          <!-- Modal Card -->
          <div class="relative bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-[380px] w-full animate-fadeInUp border border-slate-100">
             
             <!-- Icon Header -->
             <div class="flex items-center gap-4 mb-5">
                <div class="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <svg class="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-slate-900 leading-tight">¿Eliminar miembro?</h3>
                    <p class="text-xs text-slate-500 font-medium">Esta acción es irreversible</p>
                </div>
             </div>

             <!-- Content -->
             <p class="text-sm text-slate-600 leading-relaxed mb-6">
                 Estás a punto de eliminar a <strong class="text-slate-900 bg-slate-100 px-1 rounded">{{ publicadorToDelete()?.primer_nombre }} {{ publicadorToDelete()?.primer_apellido }}</strong>. ¿Deseas continuar?
             </p>

             <!-- Actions -->
             <div class="flex items-center gap-3">
                <button (click)="closeDeleteModal()" [disabled]="isDeleting()" class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Cancelar
                </button>
                <button (click)="executeDelete()" [disabled]="isDeleting()" class="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm shadow-md shadow-red-600/20 hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none">
                    <svg *ngIf="isDeleting()" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>{{ isDeleting() ? 'Eliminando...' : 'Eliminar' }}</span>
                </button>
              </div>
          </div>
      </div>

      <!-- Toast Notification -->
      <div 
        *ngIf="toastMessage()" 
        class="fixed bottom-6 right-6 z-[100] animate-fadeInUp"
      >
        <div 
          class="flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border backdrop-blur-sm"
          [ngClass]="toastMessage()?.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'"
        >
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            [ngClass]="toastMessage()?.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'"
          >
            <svg *ngIf="toastMessage()?.type === 'success'" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <svg *ngIf="toastMessage()?.type === 'error'" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </div>
          <span class="text-sm font-bold">{{ toastMessage()?.text }}</span>
          <button (click)="toastMessage.set(null)" class="ml-2 p-1 rounded-lg hover:bg-black/5 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
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
  private privilegiosService = inject(PrivilegiosService);
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
  selectedGruposFilter = signal<number[]>([]);
  selectedPrivilegiosFilter = signal<number[]>([]);

  activeFiltersCount = computed(() => this.selectedGruposFilter().length + this.selectedPrivilegiosFilter().length);


  // Auxiliary Data
  estados = signal<Estado[]>([]);
  grupos = signal<Grupo[]>([]);
  contactos = signal<ContactoEmergencia[]>([]);
  showContactoForm = signal(false);
  startEditingContacto = signal(false);
  sexoDropdownOpen = signal(false);
  editingContacto = signal<ContactoEmergencia | null>(null);

  // Privileges Data for List View
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map());

  // Toast Notification
  toastMessage = signal<{ text: string, type: 'success' | 'error' } | null>(null);

  showToast(text: string, type: 'success' | 'error' = 'success') {
    this.toastMessage.set({ text, type });
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  // Role Check - Solo admin y gestor pueden ver el ID
  isAdminOrGestor = computed(() => {
    const user = this.authStore.user();
    const rol = user?.rol?.toLowerCase() || '';
    return rol.includes('admin') || rol.includes('gestor');
  });

  // Form
  publicadorForm: FormGroup;
  contactoForm: FormGroup;

  // Privilegios Signals
  privilegios = signal<Privilegio[]>([]);
  publicadorPrivilegios = signal<PublicadorPrivilegio[]>([]);
  newPrivilegio = signal<{ id_privilegio: number | null, fecha_inicio: string, fecha_fin: string | null }>({
    id_privilegio: null,
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: null
  });

  constructor() {
    // Configurar validaciones de contraseña si fuera necesario
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

  // Modern Search Helper: Multi-term, full-text match
  matchesSearch(p: Publicador, q: string): boolean {
    const terms = q.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return true;

    const searchableText = [
      p.primer_nombre, 
      p.segundo_nombre, 
      p.primer_apellido, 
      p.segundo_apellido,
      p.telefono
    ].filter(Boolean).join(' ').toLowerCase();

    return terms.every(term => searchableText.includes(term));
  }

  // Filter Logic
  filteredList = computed(() => {
    let list = this.rawList();
    const q = this.searchQuery();
    const estadoId = this.selectedEstado();

    if (q && q.trim()) {
      list = list.filter(p => this.matchesSearch(p, q));
    }

    if (estadoId !== null) {
      list = list.filter(p => p.id_estado_publicador === estadoId);
    }

    // Filter by Grupo (Multi-select)
    const grupoIds = this.selectedGruposFilter();
    if (grupoIds.length > 0) {
      list = list.filter(p => p.id_grupo_publicador && grupoIds.includes(p.id_grupo_publicador));
    }

    // Filter by Privileges (Multi-select)
    const privIds = this.selectedPrivilegiosFilter();
    if (privIds.length > 0) {
      const map = this.publicadorPrivilegiosMap();
      list = list.filter(p => {
        const userPrivs = map.get(p.id_publicador) || [];
        // Check if user has ANY of the selected privileges
        return privIds.some(id => userPrivs.includes(id));
      });
    }

    return list;
  });

  // Filter Helpers
  toggleGrupoFilter(id: number) {
    this.selectedGruposFilter.update(current => {
      if (current.includes(id)) return current.filter(x => x !== id);
      return [...current, id];
    });
    this.currentPage.set(1);
  }

  togglePrivilegioFilter(id: number) {
    this.selectedPrivilegiosFilter.update(current => {
      if (current.includes(id)) return current.filter(x => x !== id);
      return [...current, id];
    });
    this.currentPage.set(1);
  }

  clearFilters() {
    this.selectedGruposFilter.set([]);
    this.selectedPrivilegiosFilter.set([]);
    this.showAdvancedFilters.set(false);
    this.currentPage.set(1);
  }

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
    const q = this.searchQuery();
    if (q && q.trim()) {
      baseList = baseList.filter(p => this.matchesSearch(p, q));
    }
    return this.estadosPublicador().map(e => ({
      ...e,
      count: baseList.filter(p => p.id_estado_publicador === e.id_estado).length
    }));
  });

  // Total filtered count for "Todos" chip
  totalFilteredCount = computed(() => {
    let baseList = this.rawList();
    const q = this.searchQuery();
    if (q && q.trim()) {
      baseList = baseList.filter(p => this.matchesSearch(p, q));
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
    this.loadPrivilegiosCatalog(); // Cargar catálogo de privilegios

    try {
      const user = this.authStore.user();
      const params: any = {};
      if (user?.id_congregacion) {
        params.id_congregacion = user.id_congregacion;
      }

      // Added trailing slashes to match service configuration
      const [estados, grupos, allPrivilegios] = await Promise.all([
        lastValueFrom(this.http.get<Estado[]>('/api/estados/')),
        lastValueFrom(this.http.get<Grupo[]>('/api/grupos/', { params })),
        lastValueFrom(this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/'))
      ]);

      this.estados.set(estados || []);
      this.grupos.set(grupos || []);

      // Process Privileges Map for List View
      const today = new Date().toISOString().split('T')[0];
      const privilegiosMap = new Map<number, number[]>();

      for (const pp of (allPrivilegios || [])) {
        if (!pp.fecha_fin || pp.fecha_fin >= today) {
          if (!privilegiosMap.has(pp.id_publicador)) {
            privilegiosMap.set(pp.id_publicador, []);
          }
          privilegiosMap.get(pp.id_publicador)!.push(pp.id_privilegio);
        }
      }
      this.publicadorPrivilegiosMap.set(privilegiosMap);

      // Debug log to verify data integrity
      console.log('Aux Data Loaded:', { estados: estados?.length, grupos: grupos?.length, ppCount: allPrivilegios?.length });
    } catch (error) {
      console.error('Error loading auxiliary data:', error);
    }
  }

  loadPrivilegiosCatalog() {
    this.privilegiosService.getPrivilegios().subscribe({
      next: (data) => this.privilegios.set(data),
      error: (err) => console.error('Error cargando privilegios', err)
    });
  }

  loadPublicadorPrivilegios(id: number) {
    this.privilegiosService.getPublicadorPrivilegios(id).subscribe({
      next: (data) => {
        this.publicadorPrivilegios.set(data);

        // Update GLOBAL MAP so the list updates immediately
        const today = new Date().toISOString().split('T')[0];
        const activePrivs = data
          .filter(pp => !pp.fecha_fin || pp.fecha_fin >= today)
          .map(pp => pp.id_privilegio);

        this.publicadorPrivilegiosMap.update(map => {
          map.set(id, activePrivs);
          return new Map(map); // Force signal update
        });
      },
      error: (err) => console.error('Error cargando privilegios de publicador', err)
    });
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

    const estadoActivo = this.estadosPublicador().find(e => e.nombre_estado.includes('Activo'));

    this.publicadorForm.reset({
      consentimiento_datos: false,
      ungido: false,
      id_grupo_publicador: null,
      id_estado_publicador: estadoActivo ? estadoActivo.id_estado : null
    });
    this.publicadorPrivilegios.set([]); // Clear privileges for new form
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
    this.loadPublicadorPrivilegios(p.id_publicador); // Fetch privileges for this publisher
    this.loadContactos(); // Fetch emergency contacts for this publisher
    this.panelOpen.set(true);
  }

  closePanel() {
    this.panelOpen.set(false);
    this.editingPublicador.set(null);
    this.publicadorPrivilegios.set([]); // Clear privileges on close
    this.contactos.set([]); // Clear emergency contacts on close
    this.showContactoForm.set(false); // Hide contact form
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


  capitalizeInput(controlName: string) {
    const control = this.publicadorForm.get(controlName);
    if (control && control.value) {
      const value = control.value.toString();
      if (value.length > 0) {
        const newValue = value.charAt(0).toUpperCase() + value.slice(1);
        if (value !== newValue) {
          control.setValue(newValue, { emitEvent: false });
        }
      }
    }
  }

  async onSubmit() {
    if (this.publicadorForm.invalid) return;

    this.saving.set(true);
    const rawData = this.publicadorForm.value;

    // Transform data for API compatibility
    const data = {
      ...rawData,
      // Convert ungido boolean to string for backend
      ungido: rawData.ungido ? 'Sí' : null,
      // Convert empty strings to null for optional fields
      segundo_nombre: rawData.segundo_nombre || null,
      segundo_apellido: rawData.segundo_apellido || null,
      telefono: rawData.telefono || null,
      direccion: rawData.direccion || null,
      barrio: rawData.barrio || null,
      fecha_nacimiento: rawData.fecha_nacimiento || null,
      fecha_bautismo: rawData.fecha_bautismo || null,
      sexo: rawData.sexo || null,
      id_grupo_publicador: rawData.id_grupo_publicador || null
    };

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
    if (this.isDeleting()) return; // Prevent closing while deleting
    this.deleteModalOpen.set(false);
    this.publicadorToDelete.set(null);
  }

  isDeleting = signal(false);

  async executeDelete() {
    const p = this.publicadorToDelete();
    if (!p) return;

    this.isDeleting.set(true);
    try {
      await this.facade.remove(p.id_publicador);
      this.showToast('Publicador eliminado correctamente', 'success');

      // Force close modal on success
      this.isDeleting.set(false);
      this.deleteModalOpen.set(false);
      this.publicadorToDelete.set(null);

    } catch (err: any) {
      console.error('Error deleting publicador:', err);
      const msg = err?.error?.detail || 'No se pudo eliminar el publicador';
      this.showToast(msg, 'error');
      this.isDeleting.set(false);
    }
  }

  // Helpers
  compareFn(c1: any, c2: any): boolean {
    return c1 == c2;
  }

  trackById(index: number, item: Publicador) {
    return item.id_publicador;
  }

  trackPrivilegeById(index: number, item: PublicadorPrivilegio) {
    return item.id_publicador_privilegio;
  }

  trackGroupById(index: number, item: Grupo) {
    return item.id_grupo;
  }

  getInitials(p: Publicador | null): string {
    if (!p) return '';
    const first = p.primer_nombre?.charAt(0) || '';
    const last = p.primer_apellido?.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  getAvatarClass(id: number): string {
    const COLORS = [
      'bg-blue-50 text-blue-600',
      'bg-emerald-50 text-emerald-600',
      'bg-orange-50 text-orange-600',
      'bg-purple-50 text-purple-600',
      'bg-cyan-50 text-cyan-600',
      'bg-rose-50 text-rose-600',
      'bg-indigo-50 text-indigo-600'
    ];
    return COLORS[Math.abs(id) % COLORS.length];
  }

  getRoles(p: Publicador): { label: string, type: 'pill' | 'text', class: string }[] {
    const privilegiosIds = this.publicadorPrivilegiosMap().get(p.id_publicador) || [];
    const catalogo = this.privilegios();

    const roleNames = privilegiosIds.map(id => catalogo.find(pr => pr.id_privilegio === id)?.nombre_privilegio?.toLowerCase() || '').filter(Boolean);

    // Sort logic or simple mapping? Let's just collect them all.
    // Order: Precursor R > Precursor A > Anciano > Ministerial > Publicador
    const roles: { label: string, type: 'pill' | 'text', class: string }[] = [];

    if (roleNames.some(r => r.includes('precursor regular'))) {
      roles.push({ label: 'PRECURSOR REGULAR', type: 'pill', class: 'bg-purple-100 text-purple-700' });
    }
    if (roleNames.some(r => r.includes('precursor auxiliar'))) {
      roles.push({ label: 'PRECURSOR AUXILIAR', type: 'pill', class: 'bg-amber-100 text-amber-700' });
    }
    if (roleNames.some(r => r.includes('anciano'))) {
      roles.push({ label: 'ANCIANO', type: 'pill', class: 'bg-indigo-100 text-indigo-700' });
    }
    if (roleNames.some(r => r.includes('siervo'))) {
      roles.push({ label: 'SIERVO MINISTERIAL', type: 'pill', class: 'bg-yellow-100 text-yellow-800' });
    }

    // Default if no specific roles
    if (roles.length === 0) {
      roles.push({ label: 'PUBLICADOR', type: 'text', class: 'text-slate-400 font-medium text-[10px] uppercase tracking-wide' });
    }

    return roles;
  }

  getFullName(p: Publicador): string {
    return [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
      .filter(n => n && n.trim())
      .join(' ');
  }

  getGrupoNombre(id: number | string | null | undefined): string {
    if (!id) return 'Sin Grupo';
    // Use loose equality (==) to handle potential string/number mismatches in API response
    const grupo = this.grupos().find(g => g.id_grupo == id);
    return grupo ? grupo.nombre_grupo : 'Sin Grupo';
  }

  // Sexo Display Helper
  getSexoDisplayName(): string {
    const value = this.publicadorForm.get('sexo')?.value;
    if (value === 'M') return 'Masculino';
    if (value === 'F') return 'Femenino';
    return 'Seleccionar';
  }

  // Custom Dropdown State
  privilegeDropdownOpen = signal(false);

  togglePrivilegeDropdown() {
    this.privilegeDropdownOpen.update(v => !v);
  }

  selectNewPrivilege(p: Privilegio) {
    this.updateNewPrivilegio('id_privilegio', p.id_privilegio);
    this.privilegeDropdownOpen.set(false);
  }

  getSelectedPrivilegeName(): string {
    const id = this.newPrivilegio().id_privilegio;
    if (!id) return 'Seleccionar Privilegio...';
    return this.getPrivilegioNombre(id);
  }

  // Estado Dropdown State
  estadoDropdownOpen = signal(false);

  toggleEstadoDropdown() {
    this.estadoDropdownOpen.update(v => !v);
  }

  selectEstado(id: number | null) {
    this.publicadorForm.get('id_estado_publicador')?.setValue(id);
    this.estadoDropdownOpen.set(false);
  }

  getSelectedEstadoName(): string {
    const id = this.publicadorForm.get('id_estado_publicador')?.value;
    if (!id) return 'Seleccionar';
    const estado = this.estadosPublicador().find(e => e.id_estado == id);
    return estado?.nombre_estado || 'Seleccionar';
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
  // --- Privilegios Helpers ---

  getPrivilegioNombre(id: number): string {
    const priv = this.privilegios().find(p => p.id_privilegio === id);
    return priv ? priv.nombre_privilegio : 'Desconocido';
  }

  updateNewPrivilegio(field: string, value: any) {
    // Si value es string de evento, extraer? No, ngModelChange da el valor.
    // Manejar inputs dates vacíos
    this.newPrivilegio.update(prev => ({ ...prev, [field]: value }));
  }

  isAuxiliarySelected(): boolean {
    const id = this.newPrivilegio().id_privilegio;
    if (!id) return false;
    const nombre = this.getPrivilegioNombre(Number(id));
    return nombre.toLowerCase().includes('auxiliar');
  }

  canAddPrivilegio(): boolean {
    const p = this.newPrivilegio();
    return !!p.id_privilegio && !!p.fecha_inicio;
  }

  addPrivilegio() {
    const pub = this.editingPublicador();
    if (!pub || !this.canAddPrivilegio()) return;

    const privData = this.newPrivilegio();
    const payload: any = {
      id_publicador: pub.id_publicador,
      id_privilegio: Number(privData.id_privilegio),
      fecha_inicio: privData.fecha_inicio,
      fecha_fin: privData.fecha_fin || null
    };

    // Si NO es auxiliar, forzar fecha_fin a null por regla de negocio (salvo que el usuario quiera cerrar un rango, pero 'Asignar' implica iniciar)
    // El usuario dijo: "Para precursor regular no se llena la fecha fin".
    if (!this.isAuxiliarySelected()) {
      payload.fecha_fin = null;
    }

    this.privilegiosService.createPublicadorPrivilegio(payload).subscribe({
      next: () => {
        this.loadPublicadorPrivilegios(pub.id_publicador);
        // Reset form
        this.newPrivilegio.set({
          id_privilegio: null,
          fecha_inicio: new Date().toISOString().split('T')[0],
          fecha_fin: null
        });
        this.privilegeDropdownOpen.set(false);
        this.showToast('Privilegio asignado correctamente', 'success');
      },
      error: (err) => {
        this.showToast('Error: ' + (err.error?.detail || 'No se pudo asignar el privilegio'), 'error');
      }
    });
  }

  deletePublicadorPrivilegio(id: number) {
    if (!confirm('¿Estás seguro de eliminar este privilegio del historial?')) return;
    const pub = this.editingPublicador();
    if (!pub) return;

    this.privilegiosService.deletePublicadorPrivilegio(id).subscribe({
      next: () => {
        this.loadPublicadorPrivilegios(pub.id_publicador);
        this.showToast('Privilegio eliminado', 'success');
      },
      error: (err) => this.showToast('Error al eliminar: ' + err.message, 'error')
    });
  }

}

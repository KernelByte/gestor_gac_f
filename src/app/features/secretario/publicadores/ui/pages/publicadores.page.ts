import { Component, inject, OnInit, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PublicadoresFacade } from '../../application/publicadores.facade';
import { DeleteOpcion, Publicador, UsuarioVinculado } from '../../domain/models/publicador';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../../../core/congregacion-context/congregacion-context.service';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { PrivilegiosService } from '../../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../../privilegios/domain/models/publicador-privilegio';
import { DatePickerComponent } from '../../../../../shared/components/date-picker/date-picker.component';
import { getInitialAvatarStyle } from '../../../../../core/utils/avatar-style.util';
import { environment } from '../../../../../../environments/environment';

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

interface Congregacion {
  id_congregacion: number;
  nombre_congregacion: string;
}

interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  adminOnly?: boolean;
  optional?: boolean;
}

@Component({
  standalone: true,
  selector: 'app-publicadores-list',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePickerComponent],
  template: `
    <!-- Layout Container (Flex Row) -->
    <div class="flex h-full overflow-hidden">
    
    <!-- LEFT SIDE: Main Content (List, Search, Toolbar) -->
    <div class="flex-1 flex flex-col gap-3 min-w-0 transition-all duration-500 ease-in-out">
      
      <!-- Compact Toolbar -->
      <div class="shrink-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-1.5 flex items-center gap-1.5 flex-wrap lg:flex-nowrap">
        
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
                class="w-full h-9 pl-9 pr-8 bg-slate-50 dark:bg-slate-700 border border-transparent dark:border-slate-600 rounded-lg text-base text-slate-700 dark:text-slate-100 font-medium placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:border-brand-orange/50 focus:ring-2 focus:ring-brand-orange/20 transition-all outline-none"
            >
            @if (searchQuery()) {
              <button
                (click)="onSearch('')"
                class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            }
        </div>

        <!-- Quick Filters (Pills) -->
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto order-last md:order-none">
            <button
                (click)="selectedEstado.set(null); currentPage.set(1)"
                class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ease-out active:scale-[0.97]"
                [ngClass]="selectedEstado() === null
                  ? 'bg-brand-orange text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200'"
            >
                Todos <span class="text-[0.625rem] opacity-80">{{ totalFilteredCount() }}</span>
            </button>

            <button
                *ngFor="let e of estadosWithCounts()"
                (click)="selectedEstado.set(e.id_estado); currentPage.set(1)"
                class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ease-out active:scale-[0.97]"
                [ngClass]="selectedEstado() === e.id_estado
                  ? 'bg-brand-orange text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'"
            >
                {{ e.nombre_estado }} <span class="text-[0.625rem] opacity-60">{{ e.count }}</span>
            </button>
        </div>

        <!-- More Filters Dropdown (Advanced) -->
        <div class="relative shrink-0">
            <!-- Trigger Button -->
            <button 
                (click)="showAdvancedFilters.set(!showAdvancedFilters())"
                aria-label="Filtros avanzados"
                title="Filtros avanzados"
                class="flex items-center justify-center w-9 h-9 rounded-lg transition-all border outline-none relative"
                [ngClass]="activeFiltersCount() > 0 
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-brand-orange shadow-sm' 
                  : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-200'"
            >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                <span *ngIf="activeFiltersCount() > 0" class="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-brand-orange text-white text-[9px] font-black shadow-sm ring-2 ring-white dark:ring-slate-900">
                    {{ activeFiltersCount() }}
                </span>
            </button>
            
            <!-- Backdrop (Click Outside) — semi-opaque on mobile for bottom-sheet feel -->
             <div *ngIf="showAdvancedFilters()" (click)="showAdvancedFilters.set(false)" class="fixed inset-0 z-30 bg-black/20 md:bg-transparent" style="pointer-events: auto;"></div>

            <!-- Dropdown Menu (desktop) / Bottom Sheet (mobile) -->
            <div
                *ngIf="showAdvancedFilters()"
                class="fixed inset-x-0 bottom-0 md:absolute md:inset-auto md:top-full md:right-0 md:bottom-auto md:mt-2 w-full md:w-72 z-40 bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border-t md:border border-slate-100 dark:border-slate-700 overflow-hidden animate-fadeInUp flex flex-col max-h-[80vh]"
            >
                <!-- Bottom sheet handle (mobile only) -->
                <div class="md:hidden flex justify-center pt-3 pb-1 shrink-0">
                    <div class="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-600"></div>
                </div>
                <!-- Header -->
                <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 sticky top-0">
                    <span class="text-xs font-bold text-slate-800 dark:text-slate-100">Filtros Avanzados</span>
                    <button 
                        *ngIf="activeFiltersCount() > 0"
                        (click)="clearFilters()"
                        class="text-[0.625rem] font-bold text-brand-orange hover:text-orange-600 transition-colors uppercase tracking-wider"
                    >
                        Limpiar Todo
                    </button>
                </div>

                <!-- Scrollable Content -->
                <div class="overflow-y-auto p-2 simple-scrollbar">

                    <!-- Section: Sexo -->
                    <div class="mb-1">
                        <div class="px-2 py-1.5 flex items-center gap-2">
                            <span class="w-1 h-3 rounded-full bg-blue-400"></span>
                            <span class="text-[0.625rem] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Sexo</span>
                        </div>
                        <div class="grid grid-cols-2 gap-1.5 px-2">
                            <button type="button" (click)="toggleSexoFilter('M')"
                                class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all border"
                                [ngClass]="selectedSexoFilter().includes('M')
                                  ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-blue-300 hover:text-blue-600'"
                            >
                                <span class="text-sm leading-none">♂</span> Masculino
                            </button>
                            <button type="button" (click)="toggleSexoFilter('F')"
                                class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all border"
                                [ngClass]="selectedSexoFilter().includes('F')
                                  ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-rose-300 hover:text-rose-600'"
                            >
                                <span class="text-sm leading-none">♀</span> Femenino
                            </button>
                        </div>
                    </div>

                    <div class="h-px bg-slate-100 dark:bg-slate-700/50 mx-2 my-2"></div>

                    <!-- Section: Consentimiento -->
                    <div class="mb-1">
                        <div class="px-2 py-1.5 flex items-center gap-2">
                            <span class="w-1 h-3 rounded-full bg-emerald-400"></span>
                            <span class="text-[0.625rem] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Consentimiento</span>
                        </div>
                        <div class="space-y-0.5">
                            <button type="button" (click)="setConsentimientoFilter(true)"
                                class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group text-left"
                                [ngClass]="selectedConsentimientoFilter() === true ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'"
                            >
                                <div class="flex items-center gap-2.5">
                                    <span class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all"
                                        [ngClass]="selectedConsentimientoFilter() === true ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'">
                                        <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </span>
                                    <span class="text-xs font-bold transition-colors"
                                        [ngClass]="selectedConsentimientoFilter() === true ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'">Con consentimiento</span>
                                </div>
                                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0"
                                    [ngClass]="selectedConsentimientoFilter() === true ? 'border-emerald-500' : 'border-slate-200 dark:border-slate-600'">
                                    <div class="w-2 h-2 rounded-full bg-emerald-500 transition-all"
                                        [class.opacity-0]="selectedConsentimientoFilter() !== true"></div>
                                </div>
                            </button>
                            <button type="button" (click)="setConsentimientoFilter(false)"
                                class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group text-left"
                                [ngClass]="selectedConsentimientoFilter() === false ? 'bg-slate-100 dark:bg-slate-800/80' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'"
                            >
                                <div class="flex items-center gap-2.5">
                                    <span class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all"
                                        [ngClass]="selectedConsentimientoFilter() === false ? 'bg-slate-600 dark:bg-slate-400 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'">
                                        <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                                    </span>
                                    <span class="text-xs font-bold transition-colors"
                                        [ngClass]="selectedConsentimientoFilter() === false ? 'text-slate-800 dark:text-slate-200' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'">Sin consentimiento</span>
                                </div>
                                <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0"
                                    [ngClass]="selectedConsentimientoFilter() === false ? 'border-slate-500 dark:border-slate-400' : 'border-slate-200 dark:border-slate-600'">
                                    <div class="w-2 h-2 rounded-full bg-slate-600 dark:bg-slate-400 transition-all"
                                        [class.opacity-0]="selectedConsentimientoFilter() !== false"></div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <ng-container *ngIf="!isScopedToGroup()">
                    <div class="h-px bg-slate-100 dark:bg-slate-700/50 mx-2 my-2"></div>

                    <!-- Section: Grupos (grid 2 columnas) -->
                    <div class="mb-3">
                        <div class="px-2 py-1.5 flex items-center gap-2">
                             <span class="w-1 h-3 rounded-full bg-brand-orange"></span>
                             <span class="text-[0.625rem] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Grupos</span>
                        </div>
                        <div class="grid grid-cols-2 gap-x-0.5 gap-y-0">
                            <label
                                *ngFor="let g of grupos()"
                                class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group"
                            >
                                <div class="relative flex items-center justify-center shrink-0">
                                    <input
                                        type="checkbox"
                                        [checked]="selectedGruposFilter().includes(g.id_grupo)"
                                        (change)="toggleGrupoFilter(g.id_grupo)"
                                        class="peer sr-only"
                                    >
                                    <div class="w-3.5 h-3.5 border-2 border-slate-200 dark:border-slate-600 rounded transition-all peer-checked:bg-brand-orange peer-checked:border-brand-orange peer-checked:ring-1 peer-checked:ring-brand-orange/20"></div>
                                    <svg class="absolute w-2 h-2 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <span class="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate">{{ g.nombre_grupo }}</span>
                            </label>
                        </div>
                    </div>

                    <div class="h-px bg-slate-100 dark:bg-slate-700/50 mx-2 my-2"></div>
                    </ng-container>

                    <!-- Section: Privilegios (grid 2 columnas) -->
                    <div class="mb-3" *ngIf="privilegiosEnCongregacion().length > 0">
                        <div class="px-2 py-1.5 flex items-center gap-2">
                             <span class="w-1 h-3 rounded-full bg-indigo-500"></span>
                             <span class="text-[0.625rem] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Privilegios</span>
                        </div>
                        <div class="grid grid-cols-2 gap-x-0.5 gap-y-0">
                            <label
                                *ngFor="let p of privilegiosEnCongregacion()"
                                class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group"
                            >
                                <div class="relative flex items-center justify-center shrink-0">
                                    <input
                                        type="checkbox"
                                        [checked]="selectedPrivilegiosFilter().includes(p.id_privilegio)"
                                        (change)="togglePrivilegioFilter(p.id_privilegio)"
                                        class="peer sr-only"
                                    >
                                    <div class="w-3.5 h-3.5 border-2 border-slate-200 dark:border-slate-600 rounded transition-all peer-checked:bg-indigo-500 peer-checked:border-indigo-500 peer-checked:ring-1 peer-checked:ring-indigo-500/20"></div>
                                    <svg class="absolute w-2 h-2 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <span class="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate">{{ p.nombre_privilegio }}</span>
                            </label>
                        </div>
                    </div>

                    <!-- Section: Barrio (solo si hay barrios registrados, grid 2 columnas) -->
                    <ng-container *ngIf="uniqueBarrios().length > 0">
                        <div class="h-px bg-slate-100 dark:bg-slate-700/50 mx-2 my-2"></div>
                        <div class="mb-2">
                            <div class="px-2 py-1.5 flex items-center gap-2">
                                <span class="w-1 h-3 rounded-full bg-teal-400"></span>
                                <span class="text-[0.625rem] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Barrio</span>
                            </div>
                            <div class="grid grid-cols-2 gap-x-0.5 gap-y-0 max-h-32 overflow-y-auto simple-scrollbar">
                                <label
                                    *ngFor="let b of uniqueBarrios()"
                                    class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group"
                                >
                                    <div class="relative flex items-center justify-center shrink-0">
                                        <input
                                            type="checkbox"
                                            [checked]="selectedBarriosFilter().includes(b)"
                                            (change)="toggleBarrioFilter(b)"
                                            class="peer sr-only"
                                        >
                                        <div class="w-3.5 h-3.5 border-2 border-slate-200 dark:border-slate-600 rounded transition-all peer-checked:bg-teal-500 peer-checked:border-teal-500 peer-checked:ring-1 peer-checked:ring-teal-500/20"></div>
                                        <svg class="absolute w-2 h-2 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                    <span class="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate">{{ b }}</span>
                                </label>
                            </div>
                        </div>
                    </ng-container>

                </div>
            </div>
        </div>

        <!-- Reset All Button (aparece solo cuando hay filtros o columnas personalizadas) -->
        <button
            *ngIf="hasCustomView()"
            (click)="resetAll()"
            aria-label="Restablecer filtros y columnas"
            title="Restablecer filtros y columnas"
            class="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-all border border-rose-200 dark:border-rose-800/60 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 animate-fadeIn"
        >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
            </svg>
        </button>

        <!-- Spacer -->
        <div class="flex-1 hidden lg:block"></div>

        <!-- Más opciones: Export + Column Manager (solo desktop) -->
        <div class="relative shrink-0 hidden md:block">
            <!-- Backdrop -->
            <div *ngIf="showMoreOptions()" (click)="showMoreOptions.set(false)" class="fixed inset-0 z-40 bg-transparent"></div>

            <!-- Trigger -->
            <button
                (click)="showMoreOptions.set(!showMoreOptions())"
                aria-label="Más opciones"
                title="Más opciones"
                class="flex items-center justify-center w-9 h-9 rounded-lg transition-all border outline-none"
                [ngClass]="showMoreOptions() || hasOptionalColumnsVisible()
                  ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm'
                  : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-200'"
            >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>

            <!-- Panel combinado -->
            <div *ngIf="showMoreOptions()" class="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-fadeInUp flex flex-col" style="max-height: 80vh;">

                <!-- Sección: Exportar -->
                <div *ngIf="canExportPublicadores()">
                    <div class="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Exportar</span>
                        <span class="text-[0.625rem] text-slate-400 dark:text-slate-500">{{ sortedList().length }} registros</span>
                    </div>
                    <div class="p-1.5 flex gap-1.5">
                        <button
                            (click)="exportData('excel'); showMoreOptions.set(false)"
                            [disabled]="exporting()"
                            class="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors group text-left disabled:opacity-50 disabled:cursor-not-allowed border border-slate-100 dark:border-slate-700"
                        >
                            <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Excel</span>
                        </button>
                        <button
                            (click)="exportData('pdf'); showMoreOptions.set(false)"
                            [disabled]="exporting()"
                            class="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors group text-left disabled:opacity-50 disabled:cursor-not-allowed border border-slate-100 dark:border-slate-700"
                        >
                            <svg class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-200">PDF</span>
                        </button>
                    </div>
                </div>

                <!-- Divider -->
                <div class="h-px bg-slate-100 dark:bg-slate-700/60 mx-3"></div>

                <!-- Sección: Columnas -->
                <div class="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Columnas</span>
                    <button (click)="resetColumns()" class="text-[0.625rem] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors uppercase tracking-wider">Restablecer</button>
                </div>

                <!-- Columnas configurables -->
                <div class="overflow-y-auto flex-1 simple-scrollbar">
                    <div class="p-2">
                        <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 px-2 py-1.5 mb-0.5">Arrastra <span class="font-bold">⠿</span> para reordenar</p>
                        <div class="space-y-0.5">
                            <div
                                *ngFor="let col of columnManagerList(); let i = index; trackBy: trackColById"
                                draggable="true"
                                (dragstart)="onColDragStart(i, $event)"
                                (dragover)="onColDragOver(i, $event)"
                                (drop)="onColDrop(i)"
                                (dragend)="onColDragEnd()"
                                class="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all select-none group"
                                [ngClass]="draggedColId() === col.id
                                  ? 'opacity-40 bg-slate-100 dark:bg-slate-700/60 border border-dashed border-slate-300 dark:border-slate-600 cursor-grabbing'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-grab active:cursor-grabbing'"
                            >
                                <svg class="w-3.5 h-5 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" viewBox="0 0 10 20" fill="currentColor" aria-hidden="true">
                                    <circle cx="3" cy="4" r="1.5"/><circle cx="7" cy="4" r="1.5"/>
                                    <circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/>
                                    <circle cx="3" cy="16" r="1.5"/><circle cx="7" cy="16" r="1.5"/>
                                </svg>
                                <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 flex-1 truncate">{{ col.label }}</span>
                                <button
                                    type="button"
                                    (click)="toggleColumnVisibility(col.id)"
                                    draggable="false"
                                    [attr.aria-label]="(col.visible ? 'Ocultar ' : 'Mostrar ') + col.label"
                                    class="rounded-full shrink-0 relative transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                                    [ngClass]="col.visible ? 'bg-brand-orange' : 'bg-slate-200 dark:bg-slate-600'"
                                    style="width:32px;height:18px;"
                                >
                                    <div
                                        class="bg-white rounded-full absolute shadow-sm transition-all duration-200"
                                        style="width:14px;height:14px;top:2px;"
                                        [ngStyle]="{'left': col.visible ? 'calc(100% - 16px)' : '2px'}"
                                    ></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Separador antes del botón Nuevo -->
        <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0"></div>

        <!-- Action Button (Compact, inside toolbar — hidden on mobile, FAB handles it) -->
        <button *ngIf="canEditPublicadores()"
            (click)="openCreateForm()"
            aria-label="Nuevo publicador"
            class="shrink-0 hidden md:inline-flex items-center justify-center gap-1.5 px-4 h-9 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-orange-900/10 transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-2"
        >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
            Nuevo
        </button>
      </div>

      <!-- Active Filter Chips Strip (visible cuando hay filtros activos, mobile + desktop) -->
      <div *ngIf="activeFiltersCount() > 0"
           class="shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar px-0.5 py-0.5 animate-fadeIn">
        <span class="text-[0.625rem] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider shrink-0">Filtros:</span>

        <!-- Chips de sexo -->
        <ng-container *ngFor="let s of selectedSexoFilter()">
          <span class="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[0.6875rem] font-bold whitespace-nowrap bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50 shrink-0">
            {{ s === 'M' ? '♂ Masculino' : '♀ Femenino' }}
            <button (click)="toggleSexoFilter(s)" class="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors" aria-label="Quitar filtro">
              <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </span>
        </ng-container>

        <!-- Chip consentimiento -->
        <span *ngIf="selectedConsentimientoFilter() !== null"
              class="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[0.6875rem] font-bold whitespace-nowrap bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50 shrink-0">
          {{ selectedConsentimientoFilter() ? 'Con consentimiento' : 'Sin consentimiento' }}
          <button (click)="setConsentimientoFilter(selectedConsentimientoFilter()!)" class="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors" aria-label="Quitar filtro">
            <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </span>

        <!-- Chips de grupos -->
        <ng-container *ngFor="let gId of selectedGruposFilter()">
          <span class="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[0.6875rem] font-bold whitespace-nowrap bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800/50 shrink-0">
            {{ getGrupoNombre(gId) }}
            <button (click)="toggleGrupoFilter(gId)" class="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors" aria-label="Quitar filtro">
              <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </span>
        </ng-container>

        <!-- Chips de privilegios -->
        <ng-container *ngFor="let pId of selectedPrivilegiosFilter()">
          <span class="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[0.6875rem] font-bold whitespace-nowrap bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50 shrink-0">
            {{ getPrivilegioNombre(pId) }}
            <button (click)="togglePrivilegioFilter(pId)" class="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors" aria-label="Quitar filtro">
              <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </span>
        </ng-container>

        <!-- Chips de barrios -->
        <ng-container *ngFor="let b of selectedBarriosFilter()">
          <span class="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[0.6875rem] font-bold whitespace-nowrap bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-800/50 shrink-0">
            {{ b }}
            <button (click)="toggleBarrioFilter(b)" class="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors" aria-label="Quitar filtro">
              <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </span>
        </ng-container>

        <!-- Clear all -->
        <button (click)="clearFilters()"
                class="ml-auto shrink-0 text-[0.625rem] font-bold text-rose-400 dark:text-rose-400 hover:text-rose-600 transition-colors uppercase tracking-wider whitespace-nowrap">
          Limpiar todo
        </button>
      </div>

      <!-- Main Content Area: mismo patrón que usuarios (tarjeta + scroll) -->
      <div class="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-transparent md:bg-white dark:md:bg-slate-900 md:rounded-2xl md:shadow-sm md:border md:border-slate-200 dark:md:border-slate-700 transition-all duration-300">
        
        <!-- Loading Overlay -->
        <div *ngIf="vm().loading" class="absolute inset-0 z-20 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
           <div class="w-8 h-8 rounded-full border-2 border-slate-100 border-t-brand-orange animate-spin"></div>
        </div>

        <!-- Scrollable Content Container (igual que usuarios: overflow-x/y + simple-scrollbar) -->
        <div class="flex-1 min-h-0 overflow-x-auto overflow-y-auto simple-scrollbar relative">
             
             <!-- 1. Mobile Card View (Visible < md) -->
             <div class="md:hidden p-3 space-y-3 pb-20">

                 <!-- Skeleton Loading — Mobile -->
                 <ng-container *ngIf="vm().loading">
                   <div *ngFor="let _ of [1,2,3,4,5,6]"
                        class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 animate-pulse flex flex-col gap-3">
                     <div class="flex items-start gap-3">
                       <div class="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700 shrink-0"></div>
                       <div class="flex-1 space-y-2 pt-0.5">
                         <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded-lg w-3/4"></div>
                         <div class="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
                         <div class="h-3 bg-gray-200 dark:bg-slate-700 rounded w-2/3"></div>
                       </div>
                       <div class="flex gap-1 shrink-0">
                         <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700"></div>
                         <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700"></div>
                       </div>
                     </div>
                     <div class="flex gap-1.5">
                       <div class="h-6 w-20 bg-gray-200 dark:bg-slate-700 rounded-lg"></div>
                       <div class="h-6 w-14 bg-gray-200 dark:bg-slate-700 rounded-lg"></div>
                     </div>
                   </div>
                 </ng-container>

                 <div *ngFor="let p of pagedList(); trackBy: trackById"
                      (click)="openQuickView(p)"
                      class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative flex flex-col gap-3 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] cursor-pointer">
                     
                     <div class="flex items-start justify-between gap-3">
                         <div class="flex items-center gap-3 min-w-0">
                             <div
                                class="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center font-semibold text-xs shadow-sm"
                                [ngClass]="getAvatarStyle(getFullName(p))"
                            >
                               {{ getInitials(p) }}
                            </div>
                            <div class="min-w-0 flex flex-col">
                                <h3 class="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">{{ getFullName(p) }}</h3>

                                <div class="flex flex-wrap gap-1 items-center mt-1">
                                     <ng-container *ngFor="let role of getRoles(p)">
                                          <span *ngIf="role.type === 'pill'" class="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6875rem] font-semibold" [ngClass]="role.class">
                                              {{ role.short }}
                                          </span>
                                          <span *ngIf="role.type === 'text'" class="text-[0.6875rem]" [ngClass]="role.class">
                                              {{ role.short }}
                                          </span>
                                     </ng-container>
                                </div>

                                <div class="flex items-center gap-1.5 mt-1 text-[0.6875rem] text-slate-500">
                                    <span class="truncate font-medium">{{ getGrupoNombre(p.id_grupo_publicador) }}</span>
                                    <span class="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                    <span class="flex items-center gap-1 font-medium">
                                        <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getEstadoDotClass(p.id_estado_publicador)"></span>
                                        {{ getEstadoNombre(p.id_estado_publicador) }}
                                    </span>
                                </div>
                            </div>
                         </div>

                         <!-- Actions -->
                         <div class="flex items-center gap-1 flex-shrink-0" *ngIf="canEditPublicadores()">
                             <button (click)="openEditForm(p); $event.stopPropagation()" aria-label="Editar publicador"
                                 class="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-[transform,background-color,color] duration-150 ease-out active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50">
                                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                             </button>
                             <button (click)="confirmDelete(p); $event.stopPropagation()" aria-label="Eliminar publicador"
                                 class="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-[transform,background-color,color] duration-150 ease-out active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-red-400/50">
                                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                             </button>
                         </div>
                     </div>

                     <!-- Conditionally Visible Data (Chips) -->
                     <div class="flex flex-wrap gap-1.5 pt-1" *ngIf="p.telefono || isMobileColVisible('fecha_bautismo') && p.fecha_bautismo || isMobileColVisible('sexo') && p.sexo || isMobileColVisible('direccion') && p.direccion || isMobileColVisible('barrio') && p.barrio">
                         <!-- Telephone -->
                         <a *ngIf="p.telefono" [href]="'tel:' + p.telefono" (click)="$event.stopPropagation()" class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[0.6875rem] font-semibold bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-600 active:scale-[0.97] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]">
                              <svg class="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                              {{ p.telefono }}
                         </a>
                         
                         <span *ngIf="isMobileColVisible('sexo') && p.sexo"
                             class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[0.6875rem] font-semibold border"
                             [ngClass]="p.sexo === 'M' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800/50' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800/50'">
                             {{ p.sexo === 'M' ? '♂ Masc' : '♀ Fem' }}
                         </span>
                         
                         <span *ngIf="isMobileColVisible('fecha_bautismo') && p.fecha_bautismo"
                             class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[0.6875rem] font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50">
                             <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                             Bautismo: {{ formatDate(p.fecha_bautismo) }}
                         </span>

                         <span *ngIf="isMobileColVisible('direccion') && p.direccion"
                             class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[0.6875rem] font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                             <svg class="w-3 h-3 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                             <span class="truncate">{{ p.direccion }}</span>
                         </span>
                         <span *ngIf="isMobileColVisible('barrio') && p.barrio && !isMobileColVisible('direccion')"
                             class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[0.6875rem] font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                             Barrio: {{ p.barrio }}
                         </span>
                     </div>
                 </div>
                  <!-- Empty State Mobile -->
                  <div *ngIf="pagedList().length === 0 && !vm().loading" class="text-center py-14 px-6">
                      <div class="w-16 h-16 mx-auto bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-orange-900/20 dark:via-gray-800 dark:to-amber-900/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-orange-100/50 dark:border-orange-800/30">
                         <svg class="w-8 h-8 text-orange-300 dark:text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <h3 class="text-slate-800 dark:text-slate-100 font-bold mb-1">No se encontraron publicadores</h3>
                      <p class="text-slate-400 dark:text-gray-500 text-sm mb-5">Ajusta los filtros o la búsqueda</p>
                      <div class="flex flex-col items-center gap-2">
                        <button *ngIf="activeFiltersCount() > 0 || searchQuery()"
                            (click)="clearFilters(); onSearch('')"
                            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                            Limpiar filtros
                        </button>
                        <button *ngIf="canEditPublicadores()" (click)="openCreateForm()" class="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-bold shadow-md shadow-orange-500/20">
                           <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                           Agregar
                        </button>
                      </div>
                  </div>
             </div>

             <!-- 2. Desktop Table View (Visible md+) -->
             <div class="hidden md:block">
                <table class="w-full min-w-max text-left border-collapse">
                   <thead class="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                      <!-- Sort chips strip (visible solo cuando hay ordenamientos activos) -->
                      <tr *ngIf="sortOrder().length > 0" class="border-b border-brand-orange/10 bg-orange-50/60 dark:bg-orange-900/10">
                        <td [attr.colspan]="totalVisibleColCount()" class="px-4 py-2">
                          <div class="flex items-center gap-2 flex-wrap">
                            <!-- Chips de criterios -->
                            <div class="flex items-center gap-1 flex-wrap flex-1">
                              <ng-container *ngFor="let s of sortOrder(); let i = index; let last = last">
                                <!-- Chip de criterio -->
                                <div class="flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <span class="w-3.5 h-3.5 rounded-full bg-brand-orange text-white text-[8px] font-black flex items-center justify-center shrink-0">{{ i + 1 }}</span>
                                  <span class="text-[0.625rem] font-bold text-slate-700 dark:text-slate-300 pl-0.5">{{ getSortColLabel(s.col) }}</span>
                                  <svg class="w-2.5 h-2.5 text-brand-orange transition-transform duration-200" [class.rotate-180]="s.dir === 'desc'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                  <button (click)="removeSortCriteria(i)" title="Quitar este criterio"
                                    class="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-300 hover:text-rose-500 transition-colors">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-2 h-2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                  </button>
                                </div>
                                <!-- Flecha de anidado entre chips -->
                                <svg *ngIf="!last" class="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                              </ng-container>
                            </div>
                            <!-- Hint + limpiar -->
                            <div class="flex items-center gap-2 shrink-0">
                              <span class="text-[0.625rem] text-slate-400 dark:text-slate-500 hidden lg:inline">
                                <kbd class="font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1 py-0.5 rounded text-[9px]">Shift</kbd>+clic para añadir
                              </span>
                              <button (click)="resetSort()" class="text-[0.625rem] font-bold text-rose-400 hover:text-rose-600 transition-colors uppercase tracking-wider">Limpiar orden</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tr class="border-b border-slate-200 dark:border-slate-700">
                         <!-- Columna fija: Nombre -->
                         <th class="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                           <button (click)="toggleSort('nombre', $event)" title="Clic para ordenar · Shift+Clic para anidar" class="flex items-center gap-1 group/sort hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                             Nombre
                             <ng-container *ngIf="getSortIndex('nombre') >= 0; else noSortNombre">
                               <span class="flex items-center gap-0.5">
                                 <svg class="w-3 h-3 text-brand-orange transition-transform duration-200" [class.rotate-180]="getSortDir('nombre') === 'desc'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                 <span *ngIf="sortOrder().length > 1" class="w-3.5 h-3.5 rounded-full bg-brand-orange text-white text-[8px] font-black flex items-center justify-center">{{ getSortIndex('nombre') + 1 }}</span>
                               </span>
                             </ng-container>
                             <ng-template #noSortNombre>
                               <svg class="w-3 h-3 opacity-0 group-hover/sort:opacity-30 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>
                             </ng-template>
                           </button>
                         </th>
                         <!-- Columnas configurables dinámicas -->
                         <ng-container *ngFor="let col of visibleMoveableColumns()">
                           <th class="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                             <button (click)="toggleSort(col.id, $event)" title="Clic para ordenar · Shift+Clic para anidar" class="flex items-center gap-1 group/sort hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                               {{ col.label }}
                               <ng-container *ngIf="getSortIndex(col.id) >= 0; else noSortDyn">
                                 <span class="flex items-center gap-0.5">
                                   <svg class="w-3 h-3 text-brand-orange transition-transform duration-200" [class.rotate-180]="getSortDir(col.id) === 'desc'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                   <span *ngIf="sortOrder().length > 1" class="w-3.5 h-3.5 rounded-full bg-brand-orange text-white text-[8px] font-black flex items-center justify-center">{{ getSortIndex(col.id) + 1 }}</span>
                                 </span>
                               </ng-container>
                               <ng-template #noSortDyn>
                                 <svg class="w-3 h-3 opacity-0 group-hover/sort:opacity-30 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>
                               </ng-template>
                             </button>
                           </th>
                         </ng-container>
                         <!-- Columna fija: Estado -->
                         <th class="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                           <button (click)="toggleSort('estado', $event)" title="Clic para ordenar · Shift+Clic para anidar" class="flex items-center gap-1 group/sort hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                             Estado
                             <ng-container *ngIf="getSortIndex('estado') >= 0; else noSortEstado">
                               <span class="flex items-center gap-0.5">
                                 <svg class="w-3 h-3 text-brand-orange transition-transform duration-200" [class.rotate-180]="getSortDir('estado') === 'desc'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                 <span *ngIf="sortOrder().length > 1" class="w-3.5 h-3.5 rounded-full bg-brand-orange text-white text-[8px] font-black flex items-center justify-center">{{ getSortIndex('estado') + 1 }}</span>
                               </span>
                             </ng-container>
                             <ng-template #noSortEstado>
                               <svg class="w-3 h-3 opacity-0 group-hover/sort:opacity-30 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>
                             </ng-template>
                           </button>
                         </th>
                         <th class="px-3 py-3 text-center text-xs font-bold text-slate-400 tracking-wider whitespace-nowrap">Acciones</th>
                      </tr>
                   </thead>
                   <tbody class="divide-y divide-slate-200 dark:divide-gray-700">

                      <!-- Skeleton Rows — Desktop Loading -->
                      <ng-container *ngIf="vm().loading">
                        <tr *ngFor="let _ of [1,2,3,4,5,6,7,8,9,10]"
                            class="animate-pulse border-b border-slate-100 dark:border-slate-700">
                          <td class="px-5 py-3">
                            <div class="flex items-center gap-3">
                              <div class="w-9 h-9 rounded-xl bg-gray-200 dark:bg-slate-700 shrink-0"></div>
                              <div class="space-y-1.5 flex-1">
                                <div class="h-3.5 bg-gray-200 dark:bg-slate-700 rounded-lg w-36"></div>
                                <div class="h-2.5 bg-gray-200 dark:bg-slate-700 rounded w-20"></div>
                              </div>
                            </div>
                          </td>
                          <td *ngFor="let c of visibleMoveableColumns()" class="px-4 py-3">
                            <div class="h-3 bg-gray-200 dark:bg-slate-700 rounded w-20"></div>
                          </td>
                          <td class="px-4 py-3">
                            <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded-full w-16"></div>
                          </td>
                          <td class="px-3 py-3">
                            <div class="flex justify-center gap-1">
                              <div class="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700"></div>
                              <div class="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700"></div>
                            </div>
                          </td>
                        </tr>
                      </ng-container>

                      <tr *ngFor="let p of pagedList(); trackBy: trackById" class="group hover:bg-slate-50 dark:hover:bg-gray-800/60 border-b border-transparent dark:border-slate-700/50 transition-colors duration-150">
                         
                         <!-- Nombre -->
                         <td class="px-5 py-2.5 relative">
                            <div class="flex items-center gap-3">
                               <div 
                                   class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-semibold text-xs shadow-sm"
                                   [ngClass]="getAvatarStyle(getFullName(p))"
                               >
                                  {{ getInitials(p) }}
                               </div>
                                  <div class="flex flex-col gap-0.5 justify-center">
                                      <p class="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-0.5">{{ getFullName(p) }}</p>
                                      <div class="flex flex-wrap gap-1 items-center">
                                         <ng-container *ngFor="let role of getRoles(p)">
                                              <span *ngIf="role.type === 'pill'" class="inline-flex items-center px-2 py-0.5 rounded-md text-[0.625rem] font-bold uppercase tracking-wider shadow-sm" [ngClass]="role.class">
                                                  {{ role.label }}
                                              </span>
                                              <span *ngIf="role.type === 'text'" class="text-[0.625rem] uppercase tracking-wider" [ngClass]="role.class">
                                                  {{ role.label }}
                                              </span>
                                         </ng-container>
                                         <span *ngIf="isAdminOrGestor()" class="text-[0.625rem] text-slate-300 dark:text-slate-600 font-medium">#{{ p.id_publicador }}</span>
                                      </div>
                                  </div>
                            </div>
                          </td>

                         <!-- Dynamic Columns -->
                         <ng-container *ngFor="let col of visibleMoveableColumns()">
                           <td class="px-4 py-2.5 whitespace-nowrap">
                             <ng-container [ngSwitch]="col.id">

                               <ng-container *ngSwitchCase="'congregacion'">
                                 <span class="text-sm font-medium text-slate-600 dark:text-slate-400 truncate block max-w-[200px]">{{ p.nombre_congregacion || '—' }}</span>
                               </ng-container>

                               <ng-container *ngSwitchCase="'grupo'">
                                 <div class="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                   <svg class="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                   <span class="text-sm font-medium truncate max-w-[140px]">{{ getGrupoNombre(p.id_grupo_publicador) }}</span>
                                 </div>
                               </ng-container>

                               <ng-container *ngSwitchCase="'fecha_nacimiento'">
                                 <span class="text-sm text-slate-600 dark:text-slate-400 font-medium font-mono">{{ formatDate(p.fecha_nacimiento) }}</span>
                               </ng-container>

                               <ng-container *ngSwitchCase="'fecha_bautismo'">
                                 <span class="text-sm text-slate-600 dark:text-slate-400 font-medium font-mono">{{ formatDate(p.fecha_bautismo) }}</span>
                               </ng-container>

                               <ng-container *ngSwitchCase="'fecha_inicio_informe'">
                                 <span class="text-sm text-slate-600 dark:text-slate-400 font-medium font-mono">{{ p.fecha_inicio_informe ? formatDate(p.fecha_inicio_informe) : '—' }}</span>
                               </ng-container>

                               <ng-container *ngSwitchCase="'fecha_inactividad'">
                                 <span class="text-sm font-medium font-mono" [ngClass]="p.fecha_inactividad ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'">{{ p.fecha_inactividad ? formatDate(p.fecha_inactividad) : '—' }}</span>
                               </ng-container>

                               <ng-container *ngSwitchCase="'telefono'">
                                 <a *ngIf="p.telefono" [href]="'tel:' + p.telefono" class="text-sm text-slate-600 dark:text-slate-400 font-mono hover:text-brand-orange hover:underline transition-colors">{{ p.telefono }}</a>
                                 <span *ngIf="!p.telefono" class="text-sm text-slate-400">—</span>
                               </ng-container>

                               <ng-container *ngSwitchCase="'sexo'">
                                 <span class="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                   <span class="w-4 h-4 rounded-full inline-flex items-center justify-center text-[0.625rem] font-black"
                                     [ngClass]="p.sexo === 'M' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : p.sexo === 'F' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'">
                                     {{ p.sexo === 'M' ? 'M' : p.sexo === 'F' ? 'F' : '?' }}
                                   </span>
                                   {{ p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : '—' }}
                                 </span>
                               </ng-container>

                               <ng-container *ngSwitchCase="'direccion'">
                                 <span class="text-sm text-slate-600 dark:text-slate-400 font-medium truncate block max-w-[180px]" [title]="p.direccion || ''">{{ p.direccion || '—' }}</span>
                               </ng-container>

                               <ng-container *ngSwitchCase="'barrio'">
                                 <span class="text-sm text-slate-600 dark:text-slate-400 font-medium truncate block max-w-[140px]" [title]="p.barrio || ''">{{ p.barrio || '—' }}</span>
                               </ng-container>

                               <ng-container *ngSwitchCase="'consentimiento_datos'">
                                 <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.625rem] font-bold border"
                                   [ngClass]="p.consentimiento_datos ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'">
                                   <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                     <ng-container *ngIf="p.consentimiento_datos"><polyline points="20 6 9 17 4 12"></polyline></ng-container>
                                     <ng-container *ngIf="!p.consentimiento_datos"><path d="M18 6L6 18M6 6l12 12"></path></ng-container>
                                   </svg>
                                   {{ p.consentimiento_datos ? 'Sí' : 'No' }}
                                 </span>
                               </ng-container>

                               <ng-container *ngSwitchDefault>
                                 <span class="text-sm text-slate-400">—</span>
                               </ng-container>

                             </ng-container>
                           </td>
                         </ng-container>

                         <!-- Estado -->
                         <td class="px-4 py-2.5">
                              <span 
                                 class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold border"
                                 [ngClass]="{
                                     'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-700/50': getEstadoNombre(p.id_estado_publicador).includes('Activo'),
                                     'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-100 dark:border-red-700/50': getEstadoNombre(p.id_estado_publicador).includes('Inactivo'),
                                     'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600': !getEstadoNombre(p.id_estado_publicador).includes('Activo') && !getEstadoNombre(p.id_estado_publicador).includes('Inactivo')
                                 }"
                             >
                                 <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getEstadoDotClass(p.id_estado_publicador)"></span>
                                 {{ getEstadoNombre(p.id_estado_publicador) }}
                             </span>
                         </td>

                         <!-- Actions -->
                         <td class="px-4 py-2.5 text-right">
                            <div class="flex items-center justify-end gap-1">
                               <button (click)="openQuickView(p)"
                                  class="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-700 dark:hover:bg-slate-600 hover:text-white transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.9] shadow-sm"
                                  aria-label="Ver detalles"
                                  title="Ver detalles">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                               </button>
                               <button *ngIf="canEditPublicadores()" (click)="openEditForm(p)"
                                  class="w-9 h-9 flex items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/20 text-brand-orange hover:bg-brand-orange hover:text-white transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.9] shadow-sm"
                                  title="Editar">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                               </button>
                               <button *ngIf="canEditPublicadores()" (click)="confirmDelete(p)"
                                  class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-red-500 hover:text-white transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.9]"
                                  title="Eliminar">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                               </button>
                            </div>
                         </td>
                      </tr>

                      <!-- Empty State -->
                      <tr *ngIf="pagedList().length === 0 && !vm().loading">
                         <td [attr.colspan]="totalVisibleColCount()" class="py-24 text-center">
                             <div class="flex flex-col items-center">
                                 <div class="w-20 h-20 bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800/50 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-orange-100/50 dark:border-slate-700 ring-4 ring-orange-50/50 dark:ring-slate-800">
                                    <svg class="w-10 h-10 text-orange-300 dark:text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                       <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                       <circle cx="9" cy="7" r="4"></circle>
                                       <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                       <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                 </div>
                                 <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-1">No se encontraron publicadores</h3>
                                 <p class="text-slate-500 dark:text-slate-400 text-sm max-w-xs">Intenta ajustando los filtros o términos de búsqueda.</p>
                                 <div class="flex items-center gap-3 mt-6">
                                   <button *ngIf="activeFiltersCount() > 0 || searchQuery()"
                                       (click)="clearFilters(); onSearch('')"
                                       class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                       <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                                       Limpiar filtros
                                   </button>
                                   <button *ngIf="canEditPublicadores()" (click)="openCreateForm()" class="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-orange text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-95">
                                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
                                      Agregar Publicador
                                   </button>
                                 </div>
                             </div>
                         </td>
                      </tr>
                   </tbody>
                </table>
             </div>
        </div>

        <!-- Pagination Footer -->
        <div class="shrink-0 z-20 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 md:rounded-b-2xl transition-all duration-300 shadow-[0_-1px_2px_rgba(0,0,0,0.02)] dark:shadow-none">

          <!-- Mobile Pagination: icon buttons + counter — compact for small screens -->
          <div class="flex sm:hidden items-center gap-2 px-3 py-2" style="padding-right: calc(0.75rem + 56px + 24px)">
            <!-- Prev -->
            <button
              (click)="prevPage()"
              [disabled]="currentPage() === 1"
              aria-label="Página anterior"
              class="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:text-brand-orange hover:border-brand-orange/40 active:scale-[0.92] transition-[background-color,color,border-color,transform] duration-150 disabled:opacity-35 disabled:cursor-not-allowed shadow-sm"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            </button>

            <!-- Counter — grows to fill remaining space -->
            <div class="flex-1 flex flex-col items-center justify-center leading-tight">
              <span class="text-sm font-black text-slate-800 dark:text-slate-100 tabular-nums">
                {{ currentPage() }} / {{ Math.ceil(filteredList().length / pageSize) || 1 }}
              </span>
              <span class="text-[0.625rem] font-medium text-slate-400 dark:text-gray-500 tabular-nums">
                {{ filteredList().length }} resultados
              </span>
            </div>

            <!-- Next -->
            <button
              (click)="nextPage()"
              [disabled]="currentPage() * pageSize >= filteredList().length"
              aria-label="Página siguiente"
              class="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:text-brand-orange hover:border-brand-orange/40 active:scale-[0.92] transition-[background-color,color,border-color,transform] duration-150 disabled:opacity-35 disabled:cursor-not-allowed shadow-sm"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

          <!-- Desktop Pagination: count label + prev/page/next -->
          <div class="hidden sm:flex items-center justify-between px-6 py-4">
            <p class="text-xs font-medium text-slate-500 dark:text-gray-400">
               Mostrando <span class="font-bold text-slate-800 dark:text-slate-100">{{ (currentPage() - 1) * pageSize + 1 }} – {{ Math.min(currentPage() * pageSize, filteredList().length) }}</span>
               de <span class="font-bold text-slate-800 dark:text-slate-100">{{ filteredList().length }}</span> publicadores
            </p>
            <div class="flex items-center gap-2">
              <button
               (click)="prevPage()"
               [disabled]="currentPage() === 1"
               aria-label="Página anterior"
               class="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-brand-orange dark:hover:text-brand-orange transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.93] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <span class="text-xs font-bold text-slate-500 dark:text-gray-400 min-w-[3rem] text-center tabular-nums">
                {{ currentPage() }} / {{ Math.ceil(filteredList().length / pageSize) || 1 }}
              </span>
              <button
               (click)="nextPage()"
               [disabled]="currentPage() * pageSize >= filteredList().length"
               aria-label="Página siguiente"
               class="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-brand-orange dark:hover:text-brand-orange transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.93] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div> <!-- End Left Side -->

    <!-- Mobile FAB: Nuevo Publicador -->
    <button
      *ngIf="canEditPublicadores() && !panelOpen()"
      (click)="openCreateForm()"
      aria-label="Nuevo publicador"
      class="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand-orange text-white rounded-full shadow-lg shadow-orange-500/40 active:scale-90 transition-[transform,box-shadow] duration-150 ease-out flex items-center justify-center hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-500/40"
    >
      <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
    </button>

    <!-- RIGHT SIDE: Editor Panel (Side Sheet / Bottom Sheet on mobile) -->
    <div
      class="shrink-0 flex flex-col overflow-hidden transition-[width,opacity,margin,transform] duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:h-auto"
      [ngClass]="panelOpen()
        ? 'translate-y-0 w-full opacity-100 pointer-events-auto md:w-[420px] lg:w-[460px] md:ml-4'
        : 'translate-y-full w-full opacity-0 pointer-events-none md:translate-y-0 md:w-0 md:opacity-0 md:ml-0 md:pointer-events-auto'"
    >
      <!-- Inner Container -->
      <div class="h-full flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl md:rounded-none md:rounded-l-3xl shadow-2xl shadow-slate-900/10 dark:shadow-black/50 md:border-l border-slate-100 dark:border-slate-800 overflow-hidden">
        <!-- Drawer grabber (mobile only) -->
        <div class="md:hidden flex justify-center pt-3 pb-1.5 shrink-0 bg-white dark:bg-slate-900">
          <div class="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
        </div>
        
        <!-- Premium Gradient Header (Always Light as per design) -->
        <!-- Premium Gradient Header -->
        <div class="shrink-0 relative overflow-hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
             <!-- Background gradient -->
             <div class="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-orange-900/10 transition-colors duration-500"></div>
             <div class="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-orange-100/40 to-transparent dark:from-orange-500/10 dark:to-transparent rounded-full -mr-16 -mt-16 blur-3xl"></div>
             
             <div class="relative px-4 pt-4 pb-2 md:px-5 md:pt-5 md:pb-3">
                <div class="flex items-start justify-between">
                     <div class="flex gap-3">
                         <!-- Icon with gradient background -->
                         <div class="hidden md:flex w-11 h-11 rounded-xl bg-brand-orange text-white items-center justify-center shrink-0 shadow-md shadow-orange-500/20 ring-[3px] ring-white dark:ring-slate-800 relative z-10 transition-shadow duration-300">
                              <svg *ngIf="!editingPublicador()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                              <svg *ngIf="editingPublicador()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                         </div>
                         <div>
                             <h2 class="text-xl font-display font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
                                 {{ editingPublicador() ? 'Editar Publicador' : 'Nuevo Publicador' }}
                             </h2>
                             <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium" *ngIf="editingPublicador()">
                               {{ getFullName(editingPublicador()!) }}
                             </p>
                             <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium" *ngIf="!editingPublicador()">
                               Complete la información requerida
                             </p>
                         </div>
                     </div>
                    <button (click)="tryClosePanel()" class="p-2.5 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all rounded-xl hover:bg-white/80 dark:hover:bg-slate-800 hover:shadow-sm group">
                        <svg class="w-5 h-5 group-hover:rotate-90 transition-transform duration-200 ease-out" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
             </div>

             <!-- Tabs Navigation (Dark Bar Style) -->
             <div class="px-4 pb-3 sm:px-5 sm:pb-4 md:px-5 md:pb-4 relative z-10">
                <div class="flex p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 backdrop-blur-md">
                  <button
                    (click)="activeTab.set('personal')"
                    class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200 relative"
                    [ngClass]="activeTab() === 'personal'
                      ? 'bg-brand-orange text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'"
                  >
                    Personal
                    <span *ngIf="tabHasErrors('personal') && activeTab() !== 'personal'" class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400"></span>
                  </button>
                  <button
                    (click)="activeTab.set('teocratico')"
                    class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200 relative"
                    [ngClass]="activeTab() === 'teocratico'
                      ? 'bg-brand-orange text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'"
                  >
                    Teocrático
                    <span *ngIf="tabHasErrors('teocratico') && activeTab() !== 'teocratico'" class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400"></span>
                  </button>
                  <button 
                    *ngIf="editingPublicador()" 
                    (click)="activeTab.set('emergencia')" 
                    class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200"
                    [ngClass]="activeTab() === 'emergencia'
                      ? 'bg-brand-orange text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'"
                  >
                    Emergencia
                  </button>
                </div>
             </div>
        </div>

        <!-- Divider is not needed with the new design, content scrolls cleanly -->

            <!-- 3. Scrollable Content Area -->
            <div class="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 scroll-smooth">
              <form [formGroup]="publicadorForm" (ngSubmit)="onSubmit()" class="space-y-4 pb-16"> <!-- pb-20 para espacio extra al final -->

                <!-- TAB: PERSONAL -->
                <div *ngIf="activeTab() === 'personal'" class="space-y-5 animate-fadeIn">
                     
                     <!-- Section: Identidad -->
                     <div class="space-y-4">
                        <div class="flex items-center gap-3 py-2">
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                           <span class="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-widest">Identidad</span>
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                             <!-- Fila 1: Nombres -->
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                                  Primer Nombre <span class="text-red-400">*</span>
                               </label>
                               <input formControlName="primer_nombre" (input)="capitalizeInput('primer_nombre')" placeholder="Ej: Juan" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal"
                                 [ngClass]="publicadorForm.get('primer_nombre')?.invalid && publicadorForm.get('primer_nombre')?.touched ? 'border-red-400 dark:border-red-500 focus:ring-red-400/30 focus:border-red-400' : ''">
                               <p *ngIf="publicadorForm.get('primer_nombre')?.invalid && publicadorForm.get('primer_nombre')?.touched" class="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                                 <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                 Campo requerido
                               </p>
                             </div>
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                                  Segundo Nombre
                               </label>
                               <input formControlName="segundo_nombre" (input)="capitalizeInput('segundo_nombre')" placeholder="Ej: Carlos" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                             </div>
                             
                             <!-- Fila 2: Apellidos -->
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                                  Primer Apellido <span class="text-red-400">*</span>
                               </label>
                               <input formControlName="primer_apellido" (input)="capitalizeInput('primer_apellido')" placeholder="Ej: Pérez" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal"
                                 [ngClass]="publicadorForm.get('primer_apellido')?.invalid && publicadorForm.get('primer_apellido')?.touched ? 'border-red-400 dark:border-red-500 focus:ring-red-400/30 focus:border-red-400' : ''">
                               <p *ngIf="publicadorForm.get('primer_apellido')?.invalid && publicadorForm.get('primer_apellido')?.touched" class="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                                 <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                 Campo requerido
                               </p>
                             </div>
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                                  Segundo Apellido
                               </label>
                               <input formControlName="segundo_apellido" (input)="capitalizeInput('segundo_apellido')" placeholder="Ej: García" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                             </div>

                             <!-- Fila 3: Sexo y Nacimiento -->
                             <div class="col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wide mb-2">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                                  Sexo
                               </label>
                                <!-- Custom Dropdown for Sexo -->
                                <div class="relative">
                                    <button
                                      type="button"
                                      (click)="sexoDropdownOpen.set(!sexoDropdownOpen())"
                                      class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-left shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all outline-none flex items-center justify-between"
                                      [class.text-slate-500]="!publicadorForm.get('sexo')?.value"
                                      [class.dark:text-slate-400]="!publicadorForm.get('sexo')?.value"
                                      [class.text-slate-800]="publicadorForm.get('sexo')?.value"
                                      [class.dark:text-white]="publicadorForm.get('sexo')?.value"
                                    >
                                        {{ getSexoDisplayName() }}
                                        <svg class="w-4 h-4 text-slate-400 transition-transform duration-200" [class.rotate-180]="sexoDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                    </button>

                                    <!-- Dropdown Menu -->
                                   <div 
                                     *ngIf="sexoDropdownOpen()"
                                     class="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-700 overflow-hidden animate-fadeIn"
                                   >
                                        <div class="p-1">
                                            <button 
                                              type="button"
                                              (click)="publicadorForm.get('sexo')?.setValue('M'); sexoDropdownOpen.set(false)"
                                              class="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group"
                                               [ngClass]="publicadorForm.get('sexo')?.value === 'M' ? 'bg-orange-50 dark:bg-orange-500/10 text-brand-orange' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'"
                                            >
                                                Masculino
                                                <svg *ngIf="publicadorForm.get('sexo')?.value === 'M'" class="w-4 h-4 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                                            </button>
                                           <button 
                                              type="button"
                                              (click)="publicadorForm.get('sexo')?.setValue('F'); sexoDropdownOpen.set(false)"
                                              class="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group"
                                              [ngClass]="publicadorForm.get('sexo')?.value === 'F' ? 'bg-orange-50 dark:bg-orange-500/10 text-brand-orange' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'"
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
                             <div class="col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wide mb-2">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Fecha Nacimiento
                                </label>
                                <app-date-picker formControlName="fecha_nacimiento" placeholder="Seleccionar fecha"></app-date-picker>
                             </div>
                        </div>
                     </div>

                     <!-- Section: Ubicación y Contacto -->
                     <div class="space-y-4">
                        <div class="flex items-center gap-3 py-2">
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                           <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ubicación y Contacto</span>
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div class="col-span-2 sm:col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wide mb-2">
                                  <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                  Teléfono
                               </label>
                               <input formControlName="telefono" placeholder="+57 300..." class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                            </div>

                            <div class="col-span-2 sm:col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                   <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                   Barrio
                                </label>
                                <input formControlName="barrio" placeholder="Ej: El Poblado" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                            </div>

                            <div class="col-span-2 space-y-2">
                                <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                   <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                   Dirección Completa
                                </label>
                                <input formControlName="direccion" placeholder="Calle 123 # 45-67" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                            </div>
                        </div>
                     </div>

                     <!-- Section: Consentimiento PDF -->
                     <div class="space-y-4" *ngIf="editingPublicador()">
                         <div class="flex items-center gap-3 py-2">
                             <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                             <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Consentimiento</span>
                             <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                         </div>

                         <!-- Estado actual del consentimiento -->
                         <div class="p-4 rounded-xl border-2 transition-all"
                             [ngClass]="editingPublicador()?.consentimiento_datos
                               ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40'
                               : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 border-dashed'">

                             <div class="flex items-center justify-between mb-3">
                                 <div class="flex items-center gap-2">
                                     <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                         [ngClass]="editingPublicador()?.consentimiento_datos ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'">
                                         <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                             <ng-container *ngIf="editingPublicador()?.consentimiento_datos"><polyline points="20 6 9 17 4 12"></polyline></ng-container>
                                             <ng-container *ngIf="!editingPublicador()?.consentimiento_datos"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></ng-container>
                                         </svg>
                                     </div>
                                     <div>
                                         <p class="text-sm font-bold" [ngClass]="editingPublicador()?.consentimiento_datos ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'">
                                             {{ editingPublicador()?.consentimiento_datos ? 'Consentimiento registrado' : 'Sin consentimiento' }}
                                         </p>
                                         <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 mt-0.5">
                                             {{ editingPublicador()?.archivo_consentimiento ? 'Archivo adjunto' : 'Sube el formulario firmado en PDF o imagen' }}
                                         </p>
                                     </div>
                                 </div>
                             </div>

                             <!-- Acciones del PDF -->
                             <div class="flex flex-wrap gap-2">
                                 <!-- Botón Subir / Actualizar PDF -->
                                 <label class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all"
                                     [ngClass]="uploadingPdf()
                                       ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                       : 'bg-brand-orange/10 text-brand-orange hover:bg-brand-orange hover:text-white'">
                                     <svg *ngIf="!uploadingPdf()" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                     <svg *ngIf="uploadingPdf()" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round"/></svg>
                                     {{ editingPublicador()?.archivo_consentimiento ? 'Cambiar archivo' : 'Subir archivo' }}
                                     <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" class="hidden" (change)="onConsentimientoPdfSelected($event)" [disabled]="uploadingPdf()">
                                 </label>

                                 <!-- Botón Ver archivo (solo si hay archivo) -->
                                 <button *ngIf="editingPublicador()?.archivo_consentimiento" type="button"
                                     (click)="downloadConsentimientoPdf()"
                                     class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all">
                                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                     Ver archivo
                                 </button>

                                 <!-- Botón Eliminar PDF (solo si hay archivo) -->
                                 <button *ngIf="editingPublicador()?.archivo_consentimiento" type="button"
                                     (click)="deleteConsentimientoPdf()"
                                     class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all">
                                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                     Eliminar
                                 </button>
                             </div>

                             <!-- Error message -->
                             <p *ngIf="pdfError()" class="text-[0.6875rem] text-red-500 font-bold mt-2 animate-fadeIn">{{ pdfError() }}</p>
                         </div>
                     </div>

                     <!-- Section: Acceso App Móvil (Sutil) -->
                     <div class="space-y-4 pt-4">
                        <div class="flex items-center gap-3 py-2">
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                           <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Acceso App Móvil</span>
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                        </div>

                        <div class="rounded-2xl border border-sky-100 dark:border-sky-900/30 bg-sky-50/30 dark:bg-sky-900/10 p-5 space-y-4">
                            <!-- Toggle login simple -->
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200">Acceso habilitado</p>
                                    <p class="text-[0.6875rem] text-slate-500 dark:text-slate-400 mt-0.5">Permite al publicador ingresar con su PIN o correo</p>
                                </div>
                                <button type="button"
                                        (click)="publicadorForm.get('permite_login_simple')?.setValue(!publicadorForm.get('permite_login_simple')?.value)"
                                        class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none"
                                        [ngClass]="publicadorForm.get('permite_login_simple')?.value ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'">
                                    <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
                                          [ngClass]="publicadorForm.get('permite_login_simple')?.value ? 'translate-x-6' : 'translate-x-1'"></span>
                                </button>
                            </div>

                            <!-- PIN Display (Only in Edit Mode or if access enabled) -->
                            <div *ngIf="editingPublicador()" class="pt-4 border-t border-sky-100 dark:border-sky-900/20 flex items-center justify-between gap-3">
                                <div>
                                    <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                                      Código PIN
                                      <span title="Código numérico de 4-6 dígitos generado automáticamente. El publicador lo usa para acceder a la app móvil de la congregación." class="cursor-help text-slate-300 dark:text-slate-600 hover:text-slate-400 transition-colors">
                                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><path d="M12 12v4"/></svg>
                                      </span>
                                    </p>
                                    <div class="flex items-center gap-2">
                                        <span class="font-mono text-xl font-black tracking-widest"
                                              [ngClass]="publicadorForm.get('permite_login_simple')?.value ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 line-through'">
                                            {{ editingPublicador()?.codigo_pin || '—' }}
                                        </span>
                                        <button *ngIf="editingPublicador()?.codigo_pin"
                                                type="button"
                                                (click)="copyPin(editingPublicador()?.codigo_pin)"
                                                title="Copiar PIN"
                                                class="p-1.5 rounded-md text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors">
                                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                        </button>
                                    </div>
                                </div>

                                <!-- Acciones PIN -->
                                <div class="flex items-center gap-2 shrink-0">
                                    <button type="button"
                                            (click)="enviarCredencialesWhatsapp()"
                                            [disabled]="!editingPublicador()?.codigo_pin || !publicadorForm.get('permite_login_simple')?.value || sendingWhatsapp()"
                                            class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-xs font-bold text-[#1da851] dark:text-[#25D366] hover:bg-[#25D366]/20 transition-all disabled:opacity-50 shadow-sm"
                                            title="Enviar por WhatsApp">
                                        <svg *ngIf="sendingWhatsapp()" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                        <svg *ngIf="!sendingWhatsapp()" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                        Enviar
                                    </button>
                                    <button type="button"
                                            (click)="regenerarPin(editingPublicador()!.id_publicador)"
                                            [disabled]="savingPin() || !publicadorForm.get('permite_login_simple')?.value"
                                            class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-sky-100 dark:border-sky-900/30 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all disabled:opacity-50 shadow-sm">
                                        <svg class="w-3.5 h-3.5" [ngClass]="savingPin() ? 'animate-spin' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                        Nuevo PIN
                                    </button>
                                </div>
                            </div>
                        </div>
                     </div>
                </div>

                <!-- TAB: TEOCRÁTICO -->
                <div *ngIf="activeTab() === 'teocratico'" class="space-y-6 animate-fadeIn">
                       
                       <!-- Section: Asignación -->
                       <div class="space-y-4">
                           <div class="flex items-center gap-3 py-2">
                               <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                               <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Asignación</span>
                               <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                           </div>

                           <div class="grid grid-cols-2 gap-4">
                               <div *ngIf="isAdminOrGestor()" class="col-span-2 sm:col-span-1 space-y-2">
                                    <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                       <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                       Congregación
                                    </label>
                                    <div class="relative">
                                        <select formControlName="id_congregacion_publicador" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none appearance-none cursor-pointer">
                                            <option [ngValue]="null">Seleccionar</option>
                                            <option *ngFor="let c of congregaciones()" [ngValue]="c.id_congregacion">{{ c.nombre_congregacion }}</option>
                                        </select>
                                        <div class="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                        </div>
                                    </div>
                               </div>

                               <div class="col-span-2 sm:col-span-1 space-y-2">
                                    <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                       <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                       Grupo de Servicio
                                    </label>
                                    <div class="relative">
                                        <select [compareWith]="compareFn" formControlName="id_grupo_publicador" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none appearance-none cursor-pointer">
                                            <option [ngValue]="null">Sin asignar</option>
                                            <option *ngFor="let g of grupos(); trackBy: trackGroupById" [ngValue]="g.id_grupo">{{ g.nombre_grupo }}</option>
                                        </select>
                                        <div class="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                        </div>
                                    </div>
                               </div>
                           </div>
                       </div>

                       <!-- Section: Estado Espiritual -->
                       <div class="space-y-4">
                           <div class="flex items-center gap-3 py-2">
                               <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                               <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Estado Espiritual</span>
                               <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                           </div>

                           <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                       <span class="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                                       Estado <span class="text-red-400">*</span>
                                     </label>
                                     <div class="relative">
                                         <!-- Backdrop for click outside -->
                                         <div *ngIf="estadoDropdownOpen()" (click)="estadoDropdownOpen.set(false)" class="fixed inset-0 z-10"></div>
                                         
                                         <!-- Trigger Button -->
                                         <button 
                                           type="button" 
                                           (click)="toggleEstadoDropdown()"
                                           class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none flex items-center justify-between"
                                         >
                                            <span [class.text-slate-400]="!publicadorForm.get('id_estado_publicador')?.value" [class.dark:text-slate-500]="!publicadorForm.get('id_estado_publicador')?.value" [class.dark:text-slate-200]="publicadorForm.get('id_estado_publicador')?.value">
                                              {{ getSelectedEstadoName() }}
                                            </span>
                                            <svg class="w-4 h-4 text-slate-400 transition-transform duration-200" [class.rotate-180]="estadoDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                         </button>

                                         <!-- Dropdown Menu -->
                                         <div *ngIf="estadoDropdownOpen()" class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 overflow-hidden animate-fadeIn">
                                             <div class="max-h-48 overflow-y-auto py-1">
                                                 <button 
                                                   type="button"
                                                   (click)="selectEstado(null)"
                                                   class="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
                                                 >
                                                     Seleccionar
                                                     <svg *ngIf="!publicadorForm.get('id_estado_publicador')?.value" class="w-4 h-4 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                 </button>
                                                 <button 
                                                   *ngFor="let e of estadosPublicador()" 
                                                   type="button" 
                                                   (click)="selectEstado(e.id_estado)"
                                                   class="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-brand-orange transition-colors flex items-center justify-between"
                                                 >
                                                     {{ e.nombre_estado }}
                                                     <svg *ngIf="publicadorForm.get('id_estado_publicador')?.value == e.id_estado" class="w-4 h-4 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                     <p *ngIf="publicadorForm.get('id_estado_publicador')?.invalid && publicadorForm.get('id_estado_publicador')?.touched" class="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                                       <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                       Selecciona un estado
                                     </p>
                                 </div>
                                 <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                       <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                       Fecha Bautismo
                                     </label>
                                     <app-date-picker formControlName="fecha_bautismo" placeholder="Seleccionar fecha"></app-date-picker>
                                 </div>
                                 <div class="col-span-1 sm:col-span-2 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                         <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                         Fecha Inicio Informe
                                         <span title="Fecha desde la que el publicador presenta informes de predicación al circuito. Normalmente coincide con la fecha de bautismo o de incorporación como publicador." class="cursor-help text-slate-300 dark:text-slate-600 hover:text-slate-400 transition-colors">
                                           <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><path d="M12 12v4"/></svg>
                                         </span>
                                     </label>
                                     <app-date-picker formControlName="fecha_inicio_informe" placeholder="Seleccionar fecha"></app-date-picker>
                                 </div>
                           </div>

                           <!-- Ungido Toggle -->
                           <div class="pt-2">
                              <button 
                                type="button" 
                                (click)="toggleUngido()"
                                [class.ring-2]="publicadorForm.get('ungido')?.value"
                                [class.ring-brand-orange]="publicadorForm.get('ungido')?.value"
                                [class.bg-orange-50]="publicadorForm.get('ungido')?.value"
                                [class.border-brand-orange]="publicadorForm.get('ungido')?.value"
                                [class.bg-white]="!publicadorForm.get('ungido')?.value"
                                [class.dark:bg-slate-800]="!publicadorForm.get('ungido')?.value"
                                [class.border-slate-200]="!publicadorForm.get('ungido')?.value"
                                [class.dark:border-slate-700]="!publicadorForm.get('ungido')?.value"
                                class="w-full h-14 rounded-xl border flex items-center justify-between px-4 transition-all duration-200 group"
                              >
                                  <div class="flex items-center gap-3">
                                      <div class="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                                           [ngClass]="publicadorForm.get('ungido')?.value ? 'bg-brand-orange text-white' : 'bg-slate-100 text-slate-400'">
                                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                                      </div>
                                      <div class="text-left">
                                          <span class="block text-sm font-bold" [ngClass]="publicadorForm.get('ungido')?.value ? 'text-brand-orange' : 'text-slate-700'">Participante de los emblemas</span>
                                          <span class="text-xs text-slate-500 font-medium flex items-center gap-1">
                                            Ungido
                                            <span title="Los ungidos son los 144.000 que reinarán con Cristo. Marcar solo si el publicador participa activamente en los emblemas de la Cena del Señor." class="cursor-help text-slate-300 dark:text-slate-600 hover:text-slate-400 transition-colors">
                                              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><path d="M12 12v4"/></svg>
                                            </span>
                                          </span>
                                      </div>
                                  </div>
                                  <!-- Toggle switch -->
                                  <div class="relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200"
                                       [ngClass]="publicadorForm.get('ungido')?.value ? 'bg-brand-orange' : 'bg-slate-200 dark:bg-slate-600'">
                                    <div class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                                         [ngClass]="publicadorForm.get('ungido')?.value ? 'translate-x-4' : 'translate-x-0'"></div>
                                  </div>
                              </button>
                                 </div>
                        </div>
                       
                       <!-- Section: Privilegios (Only in Edit Mode) -->
                       <div *ngIf="editingPublicador()" class="pt-4 space-y-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                           <label class="block text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Privilegios</label>

                           <!-- List of Privileges -->
                           <div class="space-y-2">
                               <div *ngFor="let pp of publicadorPrivilegios(); trackBy: trackPrivilegeById" class="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 relative group transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm hover:border-slate-200 dark:hover:border-slate-600">
                                   <div class="p-3 flex items-start justify-between">
                                       <div>
                                           <h4 class="text-xs font-bold text-slate-800 dark:text-white">{{ getPrivilegioNombre(pp.id_privilegio) }}</h4>
                                           <div class="text-[0.6875rem] text-slate-500 dark:text-slate-400 font-medium flex gap-2">
                                               <span>Desde: {{ formatDate(pp.fecha_inicio) }}</span>
                                               <span *ngIf="pp.fecha_fin" class="text-slate-400">Hasta: {{ formatDate(pp.fecha_fin) }}</span>
                                               <span *ngIf="!pp.fecha_fin" class="text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">Activo</span>
                                           </div>
                                       </div>
                                       <div class="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-all">
                                           <!-- Acción primaria: Finalizar (sólo si está activo) -->
                                           <button *ngIf="!pp.fecha_fin && closingPrivilegioId() !== pp.id_publicador_privilegio"
                                               type="button"
                                               (click)="startClosingPrivilegio(pp.id_publicador_privilegio)"
                                               title="Finalizar privilegio (conserva el historial)"
                                               class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-500 dark:hover:text-white text-[10px] font-bold transition-all">
                                               <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="17" y1="16" x2="12" y2="16"/><line x1="12" y1="16" x2="12" y2="21"/></svg>
                                               Finalizar
                                           </button>
                                           <!-- Acción secundaria: Eliminar definitivamente (sólo si no toca informes) -->
                                           <button type="button"
                                               (click)="confirmDeletePrivilegio(pp.id_publicador_privilegio)"
                                               [disabled]="!isPrivilegioEliminable(pp.id_publicador_privilegio)"
                                               [title]="isPrivilegioEliminable(pp.id_publicador_privilegio) ? 'Eliminar definitivamente' : motivoNoEliminable(pp.id_publicador_privilegio)"
                                               class="p-1.5 text-slate-400 hover:text-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-400">
                                               <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                           </button>
                                       </div>
                                   </div>
                                   <!-- Panel inline para establecer fecha fin -->
                                   <div *ngIf="closingPrivilegioId() === pp.id_publicador_privilegio" class="px-3 pb-3 border-t border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 rounded-b-xl">
                                       <p class="text-[0.625rem] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-2 mb-2">Fecha de cierre</p>
                                       <div class="flex items-center gap-2">
                                           <div class="flex-1">
                                               <app-date-picker
                                                 [ngModel]="closingPrivilegioFechaFin()"
                                                 (ngModelChange)="closingPrivilegioFechaFin.set($event)"
                                                 [ngModelOptions]="{standalone: true}"
                                                 placeholder="Seleccionar fecha"
                                               ></app-date-picker>
                                           </div>
                                           <button type="button" (click)="confirmClosingPrivilegio()"
                                               [disabled]="!closingPrivilegioFechaFin()"
                                               class="h-9 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                               Guardar
                                           </button>
                                           <button type="button" (click)="cancelClosingPrivilegio()"
                                               class="h-9 px-2 text-slate-400 hover:text-slate-600 transition-all">
                                               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                           </button>
                                       </div>
                                   </div>
                               </div>
                               <div *ngIf="publicadorPrivilegios().length === 0" class="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                   <p class="text-xs text-slate-400">Sin privilegios asignados</p>
                               </div>
                           </div>


                           <!-- Add New Privilege Form -->
                           <div class="bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl p-3 border border-indigo-100 dark:border-indigo-500/20 relative">
                               <p class="text-[0.625rem] font-bold text-indigo-400 uppercase tracking-widest mb-2">Asignar Nuevo</p>
                               <div class="space-y-3">
                                   <!-- Custom Select Privilegio -->
                                   <div class="relative">
                                       <!-- Backdrop for click outside -->
                                       <div *ngIf="privilegeDropdownOpen()" (click)="privilegeDropdownOpen.set(false)" class="fixed inset-0 z-10"></div>
                                       
                                       <!-- Trigger -->
                                       <button 
                                         type="button"
                                         (click)="togglePrivilegeDropdown()"
                                         class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm flex items-center justify-between hover:border-indigo-400 dark:hover:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                                       >
                                          <span [class.text-slate-400]="!newPrivilegio().id_privilegio">
                                            {{ getSelectedPrivilegeName() }}
                                          </span>
                                          <svg class="w-4 h-4 text-slate-400 transition-transform duration-200" [class.rotate-180]="privilegeDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                       </button>

                                       <!-- Dropdown Menu -->
                                       <div *ngIf="privilegeDropdownOpen()" class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 overflow-hidden animate-fadeIn">
                                           <div class="max-h-48 overflow-y-auto py-1">
                                               <button
                                                 *ngFor="let p of privilegiosAsignables()"
                                                 type="button"
                                                 (click)="selectNewPrivilege(p)"
                                                 class="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-between group"
                                               >
                                                   {{ p.nombre_privilegio }}
                                                   <svg *ngIf="newPrivilegio().id_privilegio === p.id_privilegio" class="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                               </button>
                                               <div *ngIf="privilegiosAsignables().length === 0" class="px-4 py-2 text-xs text-slate-400 text-center">No hay opciones</div>
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

                                   <!-- Conflict warning -->
                                   <div *ngIf="privilegioConflictoMsg()" class="flex items-start gap-1.5 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
                                     <svg class="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                       <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                                     </svg>
                                     <p class="text-[10px] font-medium text-amber-700 dark:text-amber-400 leading-tight">{{ privilegioConflictoMsg() }}</p>
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
                       <div *ngIf="!editingPublicador()" class="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center border border-dashed border-slate-200 dark:border-slate-700">
                           <p class="text-xs text-slate-400 dark:text-slate-500">Guarda el publicador para gestionar sus privilegios.</p>
                       </div>
                </div>

                <!-- TAB: EMERGENCIA -->
                <div *ngIf="activeTab() === 'emergencia'" class="space-y-6 animate-fadeIn">
                    
                    <!-- Header Actions -->
                    <div class="flex items-center justify-between" *ngIf="!showContactoForm()">
                        <div>
                           <h3 class="text-sm font-bold text-slate-900 dark:text-white">Contactos Registrados</h3>
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
                    <div *ngIf="!showContactoForm()" class="space-y-2">
                        <div *ngFor="let c of contactos()" class="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-brand-orange/50 dark:hover:border-brand-orange/40 hover:shadow-sm transition-all group relative">
                             <div class="flex justify-between items-start gap-3">
                                 <div class="min-w-0 flex-1">
                                     <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                                         <h4 class="text-sm font-bold text-slate-900 dark:text-white">{{ c.nombre }}</h4>
                                         <span *ngIf="c.parentesco" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[0.625rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{{ c.parentesco }}</span>
                                         <span *ngIf="c.es_principal" class="px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/30 text-brand-orange dark:text-orange-400 text-[0.625rem] font-bold border border-orange-200 dark:border-orange-800/50">Principal</span>
                                     </div>
                                     <div class="flex flex-col gap-1">
                                        <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                                            <svg class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                            {{ c.telefono || 'Sin teléfono' }}
                                        </div>
                                         <div *ngIf="c.direccion" class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <svg class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                            <span class="truncate">{{ c.direccion }}</span>
                                        </div>
                                     </div>
                                 </div>

                                 <div class="flex gap-1 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                     <button type="button" (click)="editContacto(c)" aria-label="Editar contacto" class="p-2 text-slate-400 hover:text-brand-orange hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors">
                                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                     </button>
                                     <button type="button" (click)="confirmDeleteContacto(c)" aria-label="Eliminar contacto" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                     </button>
                                 </div>
                             </div>
                        </div>

                        <!-- Empty State Contactos -->
                        <div *ngIf="contactos().length === 0" class="text-center py-8 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                             <div class="w-12 h-12 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                 <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                             </div>
                             <p class="text-sm font-medium text-slate-900 dark:text-white">Sin contactos de emergencia</p>
                             <p class="text-xs text-slate-500 mt-1">Agrega información vital para urgencias.</p>
                        </div>
                    </div>

                    <!-- Formulario Contacto -->
                     <div *ngIf="showContactoForm()" [formGroup]="contactoForm" class="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-sm animate-fadeInUp">
                          <h4 class="text-lg font-display font-bold text-slate-900 dark:text-white mb-6">{{ editingContacto() ? 'Editar Contacto' : 'Nuevo Contacto' }}</h4>
                          
                          <div class="space-y-4">
                              <div class="space-y-2">
                                  <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                     <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                     Nombre Completo
                                  </label>
                                  <input formControlName="nombre" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    [ngClass]="contactoForm.get('nombre')?.invalid && contactoForm.get('nombre')?.touched ? 'border-red-400 dark:border-red-500' : ''">
                                  <p *ngIf="contactoForm.get('nombre')?.invalid && contactoForm.get('nombre')?.touched" class="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                                    <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    El nombre es requerido
                                  </p>
                              </div>
                              
                              <div class="grid grid-cols-2 gap-4">
                                  <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        Parentesco
                                     </label>
                                     <select formControlName="parentesco" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none appearance-none cursor-pointer">
                                       <option value="" disabled selected>— Seleccionar parentesco —</option>
                                       <optgroup label="Pareja">
                                         <option value="Esposo">Esposo</option>
                                         <option value="Esposa">Esposa</option>
                                         <option value="Compañero/a de vida">Compañero/a de vida</option>
                                       </optgroup>
                                       <optgroup label="Padres e hijos">
                                         <option value="Madre">Madre</option>
                                         <option value="Padre">Padre</option>
                                         <option value="Hijo">Hijo</option>
                                         <option value="Hija">Hija</option>
                                       </optgroup>
                                       <optgroup label="Hermanos">
                                         <option value="Hermano">Hermano</option>
                                         <option value="Hermana">Hermana</option>
                                       </optgroup>
                                       <optgroup label="Abuelos y nietos">
                                         <option value="Abuelo">Abuelo</option>
                                         <option value="Abuela">Abuela</option>
                                         <option value="Nieto">Nieto</option>
                                         <option value="Nieta">Nieta</option>
                                       </optgroup>
                                       <optgroup label="Tíos y sobrinos">
                                         <option value="Tío">Tío</option>
                                         <option value="Tía">Tía</option>
                                         <option value="Sobrino">Sobrino</option>
                                         <option value="Sobrina">Sobrina</option>
                                       </optgroup>
                                       <optgroup label="Políticos">
                                         <option value="Suegro">Suegro</option>
                                         <option value="Suegra">Suegra</option>
                                         <option value="Yerno">Yerno</option>
                                         <option value="Nuera">Nuera</option>
                                         <option value="Cuñado">Cuñado</option>
                                         <option value="Cuñada">Cuñada</option>
                                       </optgroup>
                                       <optgroup label="Primos">
                                         <option value="Primo">Primo</option>
                                         <option value="Prima">Prima</option>
                                       </optgroup>
                                       <optgroup label="Otros">
                                         <option value="Amigo">Amigo</option>
                                         <option value="Amiga">Amiga</option>
                                         <option value="Vecino">Vecino</option>
                                         <option value="Vecina">Vecina</option>
                                         <option value="Otro">Otro</option>
                                       </optgroup>
                                     </select>
                                  </div>
                                  <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        Teléfono
                                     </label>
                                     <input formControlName="telefono" placeholder="+57 300..." class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500">
                                  </div>
                              </div>
                              
                              <div class="space-y-2">
                                  <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                     <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                     Dirección (Opcional)
                                  </label>
                                  <input formControlName="direccion" placeholder="Calle 123 # 45-67" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-base font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500">
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
                              <button type="button" (click)="showContactoForm.set(false)" class="px-5 py-2.5 rounded-xl border-2 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-all">Cancelar</button>
                              <button 
                                type="button" 
                                (click)="saveContacto()"
                                [disabled]="contactoForm.invalid"
                                class="px-6 py-2.5 rounded-xl bg-brand-orange text-white font-bold text-xs shadow-sm shadow-orange-500/20 hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                              >
                                {{ editingContacto() ? 'Actualizar' : 'Guardar' }}
                              </button>
                          </div>
                     </div>
                </div>
              </form>
           </div>

           <!-- Panel Footer -->
           <div class="px-4 pt-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-20" style="padding-bottom: max(12px, env(safe-area-inset-bottom));">
               <div class="flex items-center gap-2.5">
                   <button
                      type="button"
                      (click)="tryClosePanel()"
                      class="flex-1 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold text-sm hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                   >
                      Cancelar
                   </button>
                   <button
                      type="button"
                      (click)="onSubmit()"
                      [disabled]="saving()"
                      class="flex-1 h-10 rounded-lg bg-brand-orange hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2"
                   >
                      <svg *ngIf="saving()" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      {{ saving() ? 'Guardando...' : (editingPublicador() ? 'Guardar Cambios' : 'Crear Registro') }}
                   </button>
               </div>
               <p class="text-[0.625rem] text-slate-400 dark:text-slate-600 font-medium mt-2 mb-1">
                 <span class="text-red-400">*</span> Campo obligatorio
               </p>
           </div>
      </div> <!-- End Inner Container -->
    </div> <!-- End Detail Panel Outer -->

      <!-- ═══════════════════════════════════════════════════════════════ -->
      <!-- QUICK VIEW MODAL                                              -->
      <!-- ═══════════════════════════════════════════════════════════════ -->
      <div *ngIf="viewingPublicador()" class="fixed inset-0 z-[55] flex items-end sm:items-end md:items-center justify-center p-0 sm:p-0 md:p-6">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" (click)="closeQuickView()"></div>

        <!-- Card -->
        <div class="relative w-full md:max-w-[540px] max-h-[88dvh] sm:max-h-[90dvh] md:max-h-[90vh] flex flex-col bg-white dark:bg-[#0f1629] rounded-t-[1.75rem] md:rounded-[1.75rem] shadow-2xl shadow-slate-900/50 dark:shadow-black/70 border border-slate-200/80 dark:border-white/[0.06] overflow-hidden animate-fadeInUp mt-auto md:mt-0">

          <!-- Drawer Grabber for Mobile -->
          <div class="flex-none flex justify-center pt-2.5 pb-1 md:hidden">
            <div class="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
          </div>

          <!-- ── Header ─────────────────────────────────────────────── -->
          <div class="relative shrink-0 px-4 sm:px-6 pt-4 md:pt-7 pb-5 overflow-hidden border-b border-slate-100 dark:border-white/[0.06]">
            <!-- Decorative background blobs -->
            <div class="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-[0.07] dark:opacity-[0.12] blur-2xl pointer-events-none"
              [ngClass]="getAvatarStyle(getFullName(viewingPublicador()!))"></div>
            <div class="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-brand-orange opacity-[0.05] dark:opacity-[0.08] blur-2xl pointer-events-none"></div>

            <!-- Close button — 44×44 touch target -->
            <button (click)="closeQuickView()"
              class="absolute top-3 right-3 md:top-4 md:right-4 w-11 h-11 md:w-9 md:h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.07] text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.12] hover:text-slate-700 dark:hover:text-white transition-all duration-200 active:scale-90">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            <div class="flex items-center gap-3 sm:gap-4 pr-8">
              <!-- Avatar with glow -->
              <div class="relative shrink-0">
                <div class="absolute inset-0 rounded-2xl blur-md opacity-40 scale-110"
                  [ngClass]="getAvatarStyle(getFullName(viewingPublicador()!))"></div>
                <div class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-base sm:text-lg shadow-lg"
                  [ngClass]="getAvatarStyle(getFullName(viewingPublicador()!))">
                  {{ getInitials(viewingPublicador()) }}
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight truncate tracking-tight">{{ getFullName(viewingPublicador()!) }}</h2>
                <div class="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 flex-wrap">
                  <!-- Estado -->
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold border"
                    [ngClass]="{
                      'bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-400/20': getEstadoNombre(viewingPublicador()!.id_estado_publicador).includes('Activo'),
                      'bg-red-500/10 dark:bg-red-400/10 text-red-700 dark:text-red-400 border-red-500/20 dark:border-red-400/20': getEstadoNombre(viewingPublicador()!.id_estado_publicador).includes('Inactivo'),
                      'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]': !getEstadoNombre(viewingPublicador()!.id_estado_publicador).includes('Activo') && !getEstadoNombre(viewingPublicador()!.id_estado_publicador).includes('Inactivo')
                    }">
                    <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getEstadoDotClass(viewingPublicador()!.id_estado_publicador)"></span>
                    {{ getEstadoNombre(viewingPublicador()!.id_estado_publicador) }}
                  </span>
                  <!-- Sexo con SVG -->
                  <span *ngIf="viewingPublicador()!.sexo" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-sky-500/10 dark:bg-sky-400/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 dark:border-sky-400/20">
                    <svg *ngIf="viewingPublicador()!.sexo === 'M'" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="14" r="5"/><line x1="19" y1="5" x2="14.14" y2="9.86"/><polyline points="15 5 19 5 19 9"/></svg>
                    <svg *ngIf="viewingPublicador()!.sexo !== 'M'" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><line x1="12" y1="13" x2="12" y2="21"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
                    {{ viewingPublicador()!.sexo === 'M' ? 'Masculino' : 'Femenino' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Scrollable Body ─────────────────────────────────────── -->
          <div class="flex-1 overflow-y-auto simple-scrollbar px-4 sm:px-5 py-4 sm:py-5 space-y-5">

            <!-- Sección: Contacto -->
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="w-1 h-4 rounded-full bg-sky-500 dark:bg-sky-400 shrink-0"></span>
                <p class="text-[0.6875rem] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Contacto</p>
              </div>
              <div class="grid grid-cols-2 gap-2 sm:gap-2.5">
                <!-- Teléfono — min 44px height via min-h -->
                <div class="flex items-center gap-3 min-h-[56px] p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] hover:border-sky-200 dark:hover:border-sky-500/30 transition-all duration-200">
                  <div class="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-sky-400/10 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-sky-600 dark:text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Teléfono</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">{{ viewingPublicador()!.telefono || '—' }}</p>
                  </div>
                </div>
                <!-- Nacimiento -->
                <div class="flex items-center gap-3 min-h-[56px] p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] hover:border-violet-200 dark:hover:border-violet-500/30 transition-all duration-200">
                  <div class="w-9 h-9 rounded-xl bg-violet-500/10 dark:bg-violet-400/10 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nacimiento</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">{{ viewingPublicador()!.fecha_nacimiento ? formatDateExport(viewingPublicador()!.fecha_nacimiento!) : '—' }}</p>
                  </div>
                </div>
                <!-- Dirección (full width) -->
                <div class="col-span-2 flex items-start gap-3 min-h-[56px] p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] hover:border-amber-200 dark:hover:border-amber-500/30 transition-all duration-200">
                  <div class="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg class="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dirección</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5 leading-snug">{{ viewingPublicador()!.direccion || '—' }}
                      <span *ngIf="viewingPublicador()!.barrio" class="ml-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">· {{ viewingPublicador()!.barrio }}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sección: Servicio -->
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="w-1 h-4 rounded-full bg-brand-orange shrink-0"></span>
                <p class="text-[0.6875rem] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Servicio</p>
              </div>
              <div class="grid grid-cols-2 gap-2 sm:gap-2.5">
                <!-- Grupo -->
                <div class="flex items-center gap-3 min-h-[56px] p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] hover:border-orange-200 dark:hover:border-orange-500/30 transition-all duration-200">
                  <div class="w-9 h-9 rounded-xl bg-orange-500/10 dark:bg-orange-400/10 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Grupo</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">{{ getGrupoNombre(viewingPublicador()!.id_grupo_publicador) }}</p>
                  </div>
                </div>
                <!-- Bautismo -->
                <div class="flex items-center gap-3 min-h-[56px] p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] hover:border-teal-200 dark:hover:border-teal-500/30 transition-all duration-200">
                  <div class="w-9 h-9 rounded-xl bg-teal-500/10 dark:bg-teal-400/10 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-teal-600 dark:text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Bautismo</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">{{ viewingPublicador()!.fecha_bautismo ? formatDateExport(viewingPublicador()!.fecha_bautismo!) : '—' }}</p>
                  </div>
                </div>
                <!-- Inicio Informe -->
                <div class="flex items-center gap-3 min-h-[56px] p-3 sm:p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-400/[0.07] border border-emerald-100 dark:border-emerald-400/20 hover:border-emerald-300 dark:hover:border-emerald-400/40 transition-all duration-200" *ngIf="viewingPublicador()!.fecha_inicio_informe">
                  <div class="w-9 h-9 rounded-xl bg-emerald-500/15 dark:bg-emerald-400/15 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Inicio Inf.</p>
                    <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-400 truncate mt-0.5">{{ formatDateExport(viewingPublicador()!.fecha_inicio_informe!) }}</p>
                  </div>
                </div>
                <!-- Inactividad -->
                <div class="flex items-center gap-3 min-h-[56px] p-3 sm:p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-400/[0.07] border border-rose-100 dark:border-rose-400/20 hover:border-rose-300 dark:hover:border-rose-400/40 transition-all duration-200" *ngIf="viewingPublicador()!.fecha_inactividad">
                  <div class="w-9 h-9 rounded-xl bg-rose-500/15 dark:bg-rose-400/15 flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Inactividad</p>
                    <p class="text-sm font-semibold text-rose-700 dark:text-rose-400 truncate mt-0.5">{{ formatDateExport(viewingPublicador()!.fecha_inactividad!) }}</p>
                  </div>
                </div>
                <!-- Consentimiento (full width) -->
                <div class="col-span-2 flex items-center gap-3 min-h-[56px] p-3 sm:p-3.5 rounded-2xl border transition-all duration-200"
                  [ngClass]="viewingPublicador()!.consentimiento_datos
                    ? 'bg-emerald-50 dark:bg-emerald-400/[0.07] border-emerald-200 dark:border-emerald-400/25'
                    : 'bg-slate-50 dark:bg-white/[0.04] border-slate-100 dark:border-white/[0.06]'">
                  <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    [ngClass]="viewingPublicador()!.consentimiento_datos ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : 'bg-slate-200 dark:bg-white/[0.08]'">
                    <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <ng-container *ngIf="viewingPublicador()!.consentimiento_datos"><polyline points="20 6 9 17 4 12"/></ng-container>
                      <ng-container *ngIf="!viewingPublicador()!.consentimiento_datos"><path d="M18 6L6 18M6 6l12 12"/></ng-container>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[0.625rem] font-bold uppercase tracking-wider" [ngClass]="viewingPublicador()!.consentimiento_datos ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'">Consentimiento de datos</p>
                    <p class="text-sm font-semibold mt-0.5" [ngClass]="viewingPublicador()!.consentimiento_datos ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'">
                      {{ viewingPublicador()!.consentimiento_datos ? 'Ha dado consentimiento' : 'Sin consentimiento' }}
                    </p>
                  </div>
                  <!-- PDF button — 44px min touch target -->
                  <button *ngIf="viewingPublicador()!.archivo_consentimiento" type="button"
                    (click)="viewConsentimientoPdfFromQuickView()"
                    class="inline-flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-white/[0.07] border border-emerald-200 dark:border-emerald-400/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 transition-all shadow-sm active:scale-95 min-h-[44px] sm:min-h-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    PDF
                  </button>
                </div>
              </div>
            </div>

            <!-- Sección: Privilegios -->
            <div *ngIf="publicadorPrivilegios().length > 0">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-1 h-4 rounded-full bg-violet-500 dark:bg-violet-400 shrink-0"></span>
                <p class="text-[0.6875rem] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Privilegios</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <span *ngFor="let pp of publicadorPrivilegios()"
                  class="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold bg-violet-500/10 dark:bg-violet-400/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 dark:border-violet-400/20 hover:bg-violet-500/15 dark:hover:bg-violet-400/15 transition-colors duration-150 min-h-[36px]">
                  <svg class="w-3 h-3 text-violet-500 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  {{ getPrivilegioNombre(pp.id_privilegio) }}
                </span>
              </div>
            </div>

          </div>

          <!-- ── Footer — safe-area aware, full-width CTA on mobile ── -->
          <div class="shrink-0 px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/80 dark:bg-white/[0.02]">
            <!-- Mobile: stacked full-width CTA, then ghost close -->
            <div class="flex flex-col gap-2 sm:hidden">
              <button *ngIf="canEditPublicadores()" (click)="editFromQuickView()"
                class="w-full h-12 rounded-2xl text-sm font-bold bg-brand-orange hover:bg-orange-500 text-white shadow-md shadow-orange-500/25 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar publicador
              </button>
              <button (click)="closeQuickView()"
                class="w-full h-11 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200 transition-all duration-200 active:scale-[0.98]">
                Cerrar
              </button>
            </div>
            <!-- Tablet/Desktop: side by side -->
            <div class="hidden sm:flex items-center justify-between gap-3">
              <button (click)="closeQuickView()"
                class="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200 transition-all duration-200 active:scale-95">
                Cerrar
              </button>
              <button *ngIf="canEditPublicadores()" (click)="editFromQuickView()"
                class="px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-orange hover:bg-orange-500 text-white shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 transition-all duration-200 active:scale-95 flex items-center gap-2">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar publicador
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- Delete Modal -->
      <div *ngIf="deleteModalOpen()" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/50 transition-opacity" (click)="closeDeleteModal()"></div>

          <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5 sm:p-7 max-w-[480px] w-full max-h-[90dvh] overflow-y-auto overscroll-contain animate-fadeInUp border border-slate-100 dark:border-slate-700">

            <!-- Header dinámico según step -->
            <div class="flex items-center gap-4 mb-5">
              <!-- Ícono: papelera para eliminación, flechas para reasignación -->
              <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                   [class.bg-red-50]="deleteStep() !== 'reassign-picker'"
                   [class.dark:bg-red-900/20]="deleteStep() !== 'reassign-picker'"
                   [class.bg-orange-50]="deleteStep() === 'reassign-picker'"
                   [class.dark:bg-orange-900/20]="deleteStep() === 'reassign-picker'">
                <!-- Papelera (checking, simple, linked-choice, confirm-delete-both) -->
                <svg *ngIf="deleteStep() !== 'reassign-picker'" class="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                <!-- Flechas (reassign-picker) -->
                <svg *ngIf="deleteStep() === 'reassign-picker'" class="w-6 h-6 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"/>
                </svg>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {{ deleteStep() === 'reassign-picker' ? 'Reasignar usuario del sistema' : deleteStep() === 'confirm-delete-both' ? 'Confirmar eliminación doble' : '¿Eliminar miembro?' }}
                </h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {{ publicadorToDelete()?.primer_nombre }} {{ publicadorToDelete()?.primer_apellido }}
                </p>
              </div>
            </div>

            <!-- Step: checking -->
            <div *ngIf="deleteStep() === 'checking'" class="flex flex-col items-center py-6 gap-3">
              <div class="relative w-10 h-10">
                <svg class="w-10 h-10 animate-spin text-slate-200 dark:text-slate-700" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                </svg>
                <svg class="w-10 h-10 animate-spin text-slate-500 dark:text-slate-400 absolute inset-0" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
                </svg>
              </div>
              <div class="text-center">
                <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Comprobando accesos vinculados</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Verificando si este miembro tiene usuario del sistema…</p>
              </div>
            </div>

            <!-- Step: simple (sin usuario vinculado) -->
            <div *ngIf="deleteStep() === 'simple'">
              <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                Estás a punto de eliminar permanentemente a <strong class="text-slate-900 dark:text-white">{{ publicadorToDelete()?.primer_nombre }} {{ publicadorToDelete()?.primer_apellido }}</strong>. Esta acción no se puede deshacer.
              </p>
              <div class="flex items-center gap-3">
                <button (click)="closeDeleteModal()" [disabled]="isDeleting()" class="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancelar</button>
                <button (click)="executeDelete()" [disabled]="isDeleting()" class="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100">
                  <svg *ngIf="isDeleting()" class="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>{{ isDeleting() ? 'Eliminando…' : 'Sí, eliminar' }}</span>
                </button>
              </div>
            </div>

            <!-- Step: linked-choice (tiene usuario vinculado) -->
            <div *ngIf="deleteStep() === 'linked-choice'">
              <!-- Información del usuario vinculado -->
              <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-5">
                <p class="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">Usuario del sistema vinculado</p>
                <div class="flex items-start gap-3">
                  <div class="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0 mt-0.5">
                    <svg class="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{{ usuarioVinculado()?.nombre_usuario }}</p>
                      <span class="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300">{{ usuarioVinculado()?.rol_usuario }}</span>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{{ usuarioVinculado()?.correo_usuario }}</p>
                  </div>
                </div>
                <p class="text-xs text-amber-700 dark:text-amber-400 mt-3 leading-relaxed">Este usuario necesita estar vinculado a un publicador para acceder a la congregación. ¿Qué deseas hacer con su cuenta?</p>
              </div>

              <!-- Opciones -->
              <div class="flex flex-col gap-2.5 mb-5">
                <!-- Opción A -->
                <button (click)="selectDeleteOpcion('eliminar_con_usuario')"
                        [disabled]="isDeleting()"
                        aria-label="Eliminar publicador y también el usuario del sistema"
                        class="w-full text-left p-4 rounded-xl border border-red-200 dark:border-red-800/60 hover:border-red-400 dark:hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Eliminar publicador y usuario</p>
                      <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Se eliminarán ambos registros permanentemente</p>
                    </div>
                    <svg class="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-red-400 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </div>
                </button>

                <!-- Opción B -->
                <button (click)="selectDeleteOpcion('reasignar_usuario')"
                        [disabled]="isDeleting()"
                        aria-label="Eliminar publicador pero reasignar el usuario del sistema a otro publicador"
                        class="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4 text-orange-600 dark:text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"/></svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Eliminar publicador y reasignar usuario</p>
                      <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">El usuario seguirá activo vinculado a otro miembro</p>
                    </div>
                    <svg class="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-orange-400 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </div>
                </button>
              </div>

              <button (click)="closeDeleteModal()" [disabled]="isDeleting()" class="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancelar</button>
            </div>

            <!-- Step: confirm-delete-both (confirmación secundaria para Opción A) -->
            <div *ngIf="deleteStep() === 'confirm-delete-both'">
              <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-5">
                <p class="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Se eliminarán permanentemente:</p>
                <ul class="text-sm text-red-700 dark:text-red-400 space-y-2 mt-2">
                  <li class="flex items-start gap-2">
                    <svg class="w-3.5 h-3.5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    <span>Publicador: <strong>{{ publicadorToDelete()?.primer_nombre }} {{ publicadorToDelete()?.primer_apellido }}</strong></span>
                  </li>
                  <li class="flex items-start gap-2">
                    <svg class="w-3.5 h-3.5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    <span>Usuario del sistema: <strong>{{ usuarioVinculado()?.nombre_usuario }}</strong></span>
                  </li>
                </ul>
                <p class="text-xs text-red-600 dark:text-red-400 mt-3">Esta acción no se puede deshacer. El usuario perderá acceso al sistema.</p>
              </div>
              <div class="flex items-center gap-3">
                <button (click)="deleteStep.set('linked-choice')" [disabled]="isDeleting()" class="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Atrás</button>
                <button (click)="executeDelete()" [disabled]="isDeleting()" class="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100">
                  <svg *ngIf="isDeleting()" class="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>{{ isDeleting() ? 'Eliminando…' : 'Sí, eliminar ambos' }}</span>
                </button>
              </div>
            </div>

            <!-- Step: reassign-picker -->
            <div *ngIf="deleteStep() === 'reassign-picker'">
              <p class="text-sm text-slate-600 dark:text-slate-300 mb-3">
                ¿A qué miembro se reasignará la cuenta de <strong class="text-slate-900 dark:text-white">{{ usuarioVinculado()?.nombre_usuario }}</strong>?
              </p>

              <!-- Buscador -->
              <div class="relative mb-2">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="m21 21-4.35-4.35"/></svg>
                <input type="text"
                       placeholder="Buscar publicador…"
                       [value]="busquedaReasignar()"
                       (input)="busquedaReasignar.set($any($event.target).value)"
                       class="w-full pl-9 pr-3 py-3 sm:py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700/50 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-orange-400 dark:focus:border-orange-500 focus:ring-2 focus:ring-orange-400/20 transition-colors">
              </div>

              <div class="max-h-40 sm:max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-slate-700 mb-4 divide-y divide-slate-100 dark:divide-slate-700/60">
                <button *ngFor="let pub of publicadoresFiltradosReasignar()"
                        type="button"
                        role="radio"
                        [attr.aria-checked]="publicadorReasignadoId() === pub.id_publicador"
                        (click)="publicadorReasignadoId.set(pub.id_publicador)"
                        class="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors min-h-[44px]"
                        [class.bg-orange-50]="publicadorReasignadoId() === pub.id_publicador"
                        [class.dark:bg-orange-900/20]="publicadorReasignadoId() === pub.id_publicador"
                        [class.hover:bg-slate-50]="publicadorReasignadoId() !== pub.id_publicador"
                        [class.dark:hover:bg-slate-700/40]="publicadorReasignadoId() !== pub.id_publicador">
                  <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                       [class.border-orange-500]="publicadorReasignadoId() === pub.id_publicador"
                       [class.border-slate-300]="publicadorReasignadoId() !== pub.id_publicador"
                       [class.dark:border-orange-400]="publicadorReasignadoId() === pub.id_publicador"
                       [class.dark:border-slate-600]="publicadorReasignadoId() !== pub.id_publicador">
                    <div *ngIf="publicadorReasignadoId() === pub.id_publicador" class="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400"></div>
                  </div>
                  <span class="text-sm text-slate-800 dark:text-slate-200 font-medium">{{ pub.primer_nombre }} {{ pub.primer_apellido }}</span>
                </button>
                <!-- Sin publicadores en la congregación -->
                <div *ngIf="publicadoresParaReasignar().length === 0" class="px-4 py-8 text-center">
                  <p class="text-sm text-slate-500 dark:text-slate-400">No hay otros publicadores disponibles en esta congregación</p>
                </div>
                <!-- Sin resultados de búsqueda -->
                <div *ngIf="publicadoresParaReasignar().length > 0 && publicadoresFiltradosReasignar().length === 0" class="px-4 py-6 text-center">
                  <p class="text-xs text-slate-400 dark:text-slate-500">Sin resultados para "<span class="font-medium">{{ busquedaReasignar() }}</span>"</p>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <button (click)="deleteStep.set('linked-choice')" [disabled]="isDeleting()" class="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Atrás</button>
                <button (click)="deleteOpcionElegida.set('reasignar_usuario'); executeDelete()"
                        [disabled]="isDeleting() || !publicadorReasignadoId()"
                        class="flex-1 min-h-[44px] rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100">
                  <svg *ngIf="isDeleting()" class="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>{{ isDeleting() ? 'Procesando…' : 'Confirmar reasignación' }}</span>
                </button>
              </div>
            </div>

          </div>
      </div>

      <!-- Delete Contacto Modal -->
      <div *ngIf="deleteContactoModalOpen()" class="fixed inset-0 z-[62] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/50 transition-opacity" (click)="closeDeleteContactoModal()"></div>
          <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-[360px] w-full animate-fadeInUp border border-slate-100 dark:border-slate-700">
             <div class="flex items-center gap-4 mb-4">
                <div class="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                </div>
                <div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-white">¿Eliminar contacto?</h3>
                    <p class="text-[0.6875rem] text-slate-500 dark:text-slate-400 font-medium">Esta acción es irreversible</p>
                </div>
             </div>
             <p class="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                 Se eliminará el contacto <strong class="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-1 rounded">{{ contactoToDelete()?.nombre }}</strong> de este publicador.
             </p>
             <div class="flex items-center gap-2">
                <button (click)="closeDeleteContactoModal()" [disabled]="isDeletingContacto()" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancelar</button>
                <button (click)="executeDeleteContacto()" [disabled]="isDeletingContacto()" class="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm shadow-md shadow-red-600/20 hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none">
                    <svg *ngIf="isDeletingContacto()" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    {{ isDeletingContacto() ? 'Eliminando...' : 'Eliminar' }}
                </button>
             </div>
          </div>
      </div>

      <!-- Start Date Selection Modal (New Registration) -->
      <div *ngIf="showStartDateModal()" class="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" (click)="showStartDateModal.set(false)"></div>
          
          <!-- Modal Card -->
          <div class="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-[420px] w-full animate-fadeInUp border border-slate-100 dark:border-slate-700">
             
             <!-- Icon Header -->
             <div class="flex items-center gap-4 mb-6">
                <div class="w-14 h-14 rounded-2xl bg-brand-orange/10 flex items-center justify-center shrink-0">
                    <svg class="w-7 h-7 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path>
                    </svg>
                </div>
                <div>
                    <h3 class="text-xl font-black text-slate-900 dark:text-white leading-tight">Configuración de Informe</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">Paso Final</p>
                </div>
             </div>

             <!-- Content -->
             <div class="space-y-5">
                 <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                     Para completar el registro de <strong class="text-slate-900 dark:text-white">{{ publicadorForm.get('primer_nombre')?.value }} {{ publicadorForm.get('primer_apellido')?.value }}</strong>, por favor selecciona desde qué mes comenzará a informar en esta congregación.
                 </p>

                 <div class="space-y-2">
                    <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wide mb-2">
                       <span class="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                       Fecha de inicio de informe
                    </label>
                    <app-date-picker 
                      [ngModel]="publicadorForm.get('fecha_inicio_informe')?.value" 
                      (ngModelChange)="publicadorForm.get('fecha_inicio_informe')?.setValue($event)"
                      placeholder="Seleccionar mes y año"
                    ></app-date-picker>
                    <p class="text-[0.625rem] text-slate-400 font-medium italic mt-1.5">
                      * Se recomienda seleccionar el primer día del mes correspondiente.
                    </p>
                 </div>
             </div>

             <!-- Actions -->
             <div class="flex items-center gap-3 mt-8">
                <button (click)="showStartDateModal.set(false)" class="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    Atrás
                </button>
                <button 
                  (click)="confirmCreationWithStartDate()" 
                  [disabled]="!publicadorForm.get('fecha_inicio_informe')?.value || saving()" 
                  class="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                >
                    <svg *ngIf="saving()" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Finalizar Registro</span>
                </button>
              </div>
          </div>
      </div>

      <!-- Delete Privilege Modal (Sutil) -->
      <div *ngIf="deletePrivilegioModalOpen()" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity" (click)="closeDeletePrivilegioModal()"></div>
          
          <!-- Modal Card -->
          <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-[360px] w-full animate-fadeInUp border border-slate-100 dark:border-slate-700">
             
             <!-- Icon Header -->
             <div class="flex items-center gap-4 mb-4">
                <div class="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <div>
                    <h3 class="text-base font-bold text-slate-900 dark:text-white">¿Eliminar definitivamente?</h3>
                    <p class="text-[0.6875rem] text-slate-500 font-medium">Sólo usar para corregir registros creados por error</p>
                </div>
             </div>

             <!-- Content -->
             <p class="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                 Se eliminará el registro de la base de datos. Si el publicador llegó a precursar en algún mes, usá <span class="font-bold text-amber-600 dark:text-amber-400">Finalizar</span> en su lugar para conservar el historial.
             </p>

             <!-- Actions -->
             <div class="flex items-center gap-2">
                <button (click)="closeDeletePrivilegioModal()" class="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    Cancelar
                </button>
                <button (click)="executeDeletePrivilegio()" class="flex-1 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-white transition-all active:scale-95 shadow-sm">
                    Confirmar
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
            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
            : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'"
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
    :host-context(.dark) .simple-scrollbar::-webkit-scrollbar-thumb {
      background: #334155;
    }
    :host-context(.dark) .simple-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }
    .animate-fadeIn {
        animation: fadeIn 0.25s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(8px); }
        to { opacity: 1; transform: translateX(0); }
    }
    .animate-fadeInUp {
        animation: fadeInUp 0.25s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(8px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .box-decoration-clone {
        box-decoration-break: clone;
    }
    .animate-slideInRight {
      animation: slideInRight 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(16px); }
      to { opacity: 1; transform: translateX(0); }
    }
    /* Stagger rows — first 10 rows animate in cascading */
    tbody tr:nth-child(1) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 0ms; }
    tbody tr:nth-child(2) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 30ms; }
    tbody tr:nth-child(3) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 60ms; }
    tbody tr:nth-child(4) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 90ms; }
    tbody tr:nth-child(5) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 120ms; }
    tbody tr:nth-child(6) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 150ms; }
    tbody tr:nth-child(7) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 180ms; }
    tbody tr:nth-child(8) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 210ms; }
    tbody tr:nth-child(9) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 240ms; }
    tbody tr:nth-child(10) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 270ms; }
    @keyframes rowIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
        .animate-fadeIn, .animate-fadeInUp, .animate-slideInRight { animation: none; opacity: 1; transform: none; }
        tbody tr { animation: none !important; opacity: 1; }
    }
  `]
})
export class PublicadoresListComponent implements OnInit {
  private facade = inject(PublicadoresFacade);
  private authStore = inject(AuthStore);
  private congregacionContext = inject(CongregacionContextService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private privilegiosService = inject(PrivilegiosService);
  vm = this.facade.vm;
  Math = Math;

  // UI State
  panelOpen = signal(false);
  deleteModalOpen = signal(false);
  saving = signal(false);
  exporting = signal(false);
  showExportMenu = signal(false);
  showMoreOptions = signal(false);
  showStartDateModal = signal(false);
  viewingPublicador = signal<Publicador | null>(null);
  editingPublicador = signal<Publicador | null>(null);
  publicadorToDelete = signal<Publicador | null>(null);
  contactoToDelete = signal<ContactoEmergencia | null>(null);
  deleteContactoModalOpen = signal(false);
  isDeletingContacto = signal(false);
  activeTab = signal<TabType>('personal');

  // Consentimiento PDF State
  uploadingPdf = signal(false);
  pdfError = signal<string | null>(null);

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
  selectedSexoFilter = signal<string[]>([]);
  selectedConsentimientoFilter = signal<boolean | null>(null);
  selectedBarriosFilter = signal<string[]>([]);

  sortOrder = signal<{ col: string; dir: 'asc' | 'desc' }[]>([]);

  activeFiltersCount = computed(() =>
    this.selectedGruposFilter().length +
    this.selectedPrivilegiosFilter().length +
    this.selectedSexoFilter().length +
    (this.selectedConsentimientoFilter() !== null ? 1 : 0) +
    this.selectedBarriosFilter().length
  );

  hasCustomView = computed(() => {
    if (this.activeFiltersCount() > 0) return true;
    if (this.sortOrder().length > 0) return true;
    const current = this.columnConfig();
    const defaults = this.MOVEABLE_COLUMNS_DEFAULT;
    if (current.length !== defaults.length) return true;
    return current.some((col, i) => col.id !== defaults[i].id || col.visible !== defaults[i].visible);
  });

  uniqueBarrios = computed(() => {
    const barrios = this.rawList()
      .map(p => p.barrio)
      .filter((b): b is string => !!b && b.trim().length > 0);
    return [...new Set(barrios)].sort((a, b) => a.localeCompare(b, 'es'));
  });

  privilegiosEnCongregacion = computed(() => {
    const map = this.publicadorPrivilegiosMap();
    const pubIds = new Set(this.rawList().map(p => p.id_publicador));
    const usedIds = new Set<number>();
    for (const [pubId, privIds] of map.entries()) {
      if (pubIds.has(pubId)) privIds.forEach(id => usedIds.add(id));
    }
    return this.privilegios().filter(p => usedIds.has(p.id_privilegio));
  });

  // ─── Column Manager ──────────────────────────────────────────────────────
  private readonly COL_STORAGE_KEY = 'gac_pub_col_v2';
  private _draggedColIdx: number | null = null;
  draggedColId = signal<string | null>(null);
  showColumnManager = signal(false);
  columnConfig = signal<TableColumn[]>([]);

  readonly MOVEABLE_COLUMNS_DEFAULT: TableColumn[] = [
    { id: 'congregacion', label: 'Congregación', visible: true, adminOnly: true },
    { id: 'grupo', label: 'Grupo', visible: true },
    { id: 'fecha_nacimiento', label: 'Fecha Nac.', visible: true },
    { id: 'fecha_bautismo', label: 'Fecha Bau.', visible: true },
    { id: 'telefono', label: 'Teléfono', visible: true },
    { id: 'sexo', label: 'Sexo', visible: false, optional: true },
    { id: 'direccion', label: 'Dirección', visible: false, optional: true },
    { id: 'barrio', label: 'Barrio', visible: false, optional: true },
    { id: 'consentimiento_datos', label: 'Consentimiento', visible: true },
    { id: 'fecha_inicio_informe', label: 'Inicio Inf.', visible: false, optional: true },
    { id: 'fecha_inactividad', label: 'Inactividad', visible: false, optional: true },
  ];

  visibleMoveableColumns = computed(() => {
    const isAdmin = this.isAdminOrGestor();
    return this.columnConfig().filter(col => col.visible && (!col.adminOnly || isAdmin));
  });

  columnManagerList = computed(() => {
    const isAdmin = this.isAdminOrGestor();
    return this.columnConfig().filter(col => !col.adminOnly || isAdmin);
  });

  hasOptionalColumnsVisible = computed(() =>
    this.columnConfig().some(col => col.optional && col.visible)
  );

  totalVisibleColCount = computed(() =>
    1 + this.visibleMoveableColumns().length + 1 + 1
  );

  // Auxiliary Data
  estados = signal<Estado[]>([]);
  grupos = signal<Grupo[]>([]);
  congregaciones = signal<Congregacion[]>([]);
  contactos = signal<ContactoEmergencia[]>([]);
  showContactoForm = signal(false);
  startEditingContacto = signal(false);
  sexoDropdownOpen = signal(false);
  editingContacto = signal<ContactoEmergencia | null>(null);

  // Privileges Data for List View
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map());

  // Toast Notification
  toastMessage = signal<{ text: string, type: 'success' | 'error' } | null>(null);

  // Modal de confirmación para privilegios
  privilegioToDelete = signal<number | null>(null);
  deletePrivilegioModalOpen = signal(false);

  confirmDeletePrivilegio(id: number) {
    this.privilegioToDelete.set(id);
    this.deletePrivilegioModalOpen.set(true);
  }

  closeDeletePrivilegioModal() {
    this.deletePrivilegioModalOpen.set(false);
    this.privilegioToDelete.set(null);
  }

  // Inline close (fecha_fin) for active privileges
  closingPrivilegioId = signal<number | null>(null);
  closingPrivilegioFechaFin = signal<string>('');

  startClosingPrivilegio(id: number) {
    this.closingPrivilegioId.set(id);
    this.closingPrivilegioFechaFin.set('');
  }

  cancelClosingPrivilegio() {
    this.closingPrivilegioId.set(null);
    this.closingPrivilegioFechaFin.set('');
  }

  confirmClosingPrivilegio() {
    const id = this.closingPrivilegioId();
    const fecha = this.closingPrivilegioFechaFin();
    const pub = this.editingPublicador();
    if (!id || !fecha || !pub) return;

    this.privilegiosService.updatePublicadorPrivilegio(id, { fecha_fin: fecha }).subscribe({
      next: () => {
        this.loadPublicadorPrivilegios(pub.id_publicador);
        this.showToast('Privilegio cerrado correctamente', 'success');
        this.cancelClosingPrivilegio();
      },
      error: (err) => this.showToast('Error: ' + (err.error?.detail || err.message), 'error')
    });
  }

  showToast(text: string, type: 'success' | 'error' = 'success') {
    this.toastMessage.set({ text, type });
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  // ── Login Simple (PIN) ────────────────────────────────────────────────────
  savingPin = signal(false);

  async regenerarPin(idPublicador: number) {
    if (this.savingPin()) return;
    this.savingPin.set(true);
    try {
      const updated = await lastValueFrom(
        this.http.patch<any>(`/api/publicadores/${idPublicador}/regenerar-pin`, {})
      );
      const current = this.editingPublicador();
      if (current) {
        this.editingPublicador.set({ ...current, codigo_pin: updated.codigo_pin });
      }
      this.facade.load();
      this.showToast(`Nuevo PIN: ${updated.codigo_pin}`, 'success');
    } catch {
      this.showToast('Error al regenerar el PIN', 'error');
    } finally {
      this.savingPin.set(false);
    }
  }

  sendingWhatsapp = signal(false);

  enviarCredencialesWhatsapp() {
    const pub = this.editingPublicador();
    if (!pub || !pub.codigo_pin) return;
    
    this.sendingWhatsapp.set(true);
    
    // Obtenemos la configuracion para el codigo de la congregacion
    this.http.get<any>(`${environment.apiUrl}/configuracion/`).subscribe({
      next: (config) => {
        this.sendingWhatsapp.set(false);
        const codigoCongregacion = config.codigo_seguridad || 'No configurado';
        const pin = pub.codigo_pin;
        const nombre = pub.primer_nombre || 'Publicador';
        
        let telefono = pub.telefono;
        if (!telefono) {
            this.showToast('El publicador no tiene un teléfono registrado.', 'error');
            return;
        }

        telefono = telefono.replace(/\D/g, '');
        if (!telefono.startsWith('57') && telefono.length === 10) {
            telefono = '57' + telefono;
        }

        const mensaje = `Hola ${nombre},\n\nTus datos de acceso a la App Móvil son:\n\n*Código de Congregación:* ${codigoCongregacion}\n*CÓDIGO PIN:* ${pin}\n\nPuedes ingresar de forma segura usando estos datos.`;
        
        const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
      },
      error: (err) => {
        console.error('Error obteniendo código de congregación:', err);
        this.sendingWhatsapp.set(false);
        this.showToast('No se pudo obtener el código de congregación.', 'error');
      }
    });
  }

  copyPin(pin?: string | null) {
    if (!pin) return;
    navigator.clipboard.writeText(pin).then(() => {
      this.showToast(`PIN copiado: ${pin}`, 'success');
    }).catch(() => {
      this.showToast('No se pudo copiar el PIN', 'error');
    });
  }

  // Role Check - Solo admin y gestor pueden ver el ID
  isAdminOrGestor = computed(() => {
    const user = this.authStore.user();
    const rol = user?.rol?.toLowerCase() || '';
    return rol.includes('admin') || rol.includes('gestor');
  });

  isSecretario = computed(() => {
    const user = this.authStore.user();
    const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
    return roles.includes('secretario');
  });

  canEditPublicadores = computed(() =>
    this.isAdminOrGestor() || this.isSecretario() || this.authStore.hasPermission('publicadores.editar')
  );

  canExportPublicadores = computed(() => {
    const user = this.authStore.user();
    const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
    return roles.some(r => ['administrador', 'gestor aplicación', 'coordinador', 'secretario', 'superintendente de servicio', 'publicador'].includes(r));
  });

  isScopedToGroup = computed(() =>
    !this.isAdminOrGestor() && !this.isSecretario() && !this.authStore.hasPermission('publicadores.ver_todos')
  );

  // Form
  publicadorForm: FormGroup;
  contactoForm: FormGroup;

  // Privilegios Signals
  privilegios = signal<Privilegio[]>([]);

  private readonly PRIVILEGIOS_EXCLUIDOS_ASIGNACION = [
    'audio', 'vigilancia', 'acomodador', 'video', 'micrófono', 'microfono', 'plataforma'
  ];

  privilegiosAsignables = computed(() =>
    this.privilegios().filter(p =>
      !this.PRIVILEGIOS_EXCLUIDOS_ASIGNACION.includes(p.nombre_privilegio.toLowerCase())
    )
  );

  publicadorPrivilegios = signal<PublicadorPrivilegio[]>([]);
  // Cache de eliminabilidad por id_publicador_privilegio (lo consulta el backend)
  eliminableMap = signal<Map<number, { eliminable: boolean; motivo: string | null }>>(new Map());

  isPrivilegioEliminable(id: number): boolean {
    const entry = this.eliminableMap().get(id);
    // Default conservador: hasta saber, asumimos NO eliminable (el botón queda deshabilitado).
    return entry?.eliminable ?? false;
  }

  motivoNoEliminable(id: number): string {
    return this.eliminableMap().get(id)?.motivo ?? 'Verificando…';
  }
  newPrivilegio = signal<{ id_privilegio: number | null, fecha_inicio: string, fecha_fin: string | null }>({
    id_privilegio: null,
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: null
  });

  privilegioConflictoMsg = computed<string | null>(() => {
    const id = this.newPrivilegio().id_privilegio;
    if (!id) return null;

    const nombre = this.getPrivilegioNombre(Number(id)).toLowerCase();
    const activos = this.publicadorPrivilegios().filter(p => !p.fecha_fin);

    if (activos.some(p => p.id_privilegio === Number(id))) {
      return 'Este privilegio ya está activo para este publicador.';
    }

    if (nombre.includes('precursor')) {
      const tieneOtroPrecursor = activos.some(p =>
        this.getPrivilegioNombre(p.id_privilegio).toLowerCase().includes('precursor') &&
        p.id_privilegio !== Number(id)
      );
      if (tieneOtroPrecursor) {
        return 'El publicador ya tiene un tipo de Precursor activo. Solo puede tener uno a la vez.';
      }
    }

    return null;
  });

  constructor() {
    effect(() => {
      this.congregacionContext.effectiveCongregacionId();
      untracked(() => {
        this.loadData();
        this.loadAuxiliaryData();
      });
    });
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
      id_congregacion_publicador: [null],
      id_estado_publicador: [null, Validators.required],
      consentimiento_datos: [false],
      fecha_inicio_informe: [null],
      permite_login_simple: [true]
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
    this.initColumnConfig();
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

    // Filter by Sexo (Multi-select: M / F)
    const sexos = this.selectedSexoFilter();
    if (sexos.length > 0) {
      list = list.filter(p => p.sexo && sexos.includes(p.sexo));
    }

    // Filter by Barrio (Multi-select)
    const barrios = this.selectedBarriosFilter();
    if (barrios.length > 0) {
      list = list.filter(p => p.barrio && barrios.includes(p.barrio));
    }

    // Filter by Consentimiento (true / false / null=sin filtro)
    const consent = this.selectedConsentimientoFilter();
    if (consent !== null) {
      list = list.filter(p => !!p.consentimiento_datos === consent);
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
    this.selectedSexoFilter.set([]);
    this.selectedConsentimientoFilter.set(null);
    this.selectedBarriosFilter.set([]);
    this.showAdvancedFilters.set(false);
    this.currentPage.set(1);
  }

  toggleSexoFilter(sexo: string) {
    this.selectedSexoFilter.update(current =>
      current.includes(sexo) ? current.filter(s => s !== sexo) : [...current, sexo]
    );
    this.currentPage.set(1);
  }

  setConsentimientoFilter(value: boolean) {
    const current = this.selectedConsentimientoFilter();
    this.selectedConsentimientoFilter.set(current === value ? null : value);
    this.currentPage.set(1);
  }

  toggleBarrioFilter(barrio: string) {
    this.selectedBarriosFilter.update(current =>
      current.includes(barrio) ? current.filter(b => b !== barrio) : [...current, barrio]
    );
    this.currentPage.set(1);
  }

  // ─── Sort Helpers ────────────────────────────────────────────────────────
  getSortIndex(col: string): number {
    return this.sortOrder().findIndex(s => s.col === col);
  }

  getSortDir(col: string): 'asc' | 'desc' {
    return this.sortOrder().find(s => s.col === col)?.dir ?? 'asc';
  }

  getSortColLabel(col: string): string {
    const all: { id: string; label: string }[] = [
      { id: 'nombre', label: 'Nombre' },
      { id: 'estado', label: 'Estado' },
      ...this.MOVEABLE_COLUMNS_DEFAULT,
    ];
    return all.find(c => c.id === col)?.label ?? col;
  }

  toggleSort(col: string, event: MouseEvent) {
    const isShift = event.shiftKey;
    const current = this.sortOrder();
    const idx = current.findIndex(s => s.col === col);

    if (idx >= 0) {
      const updated = [...current];
      updated[idx] = { col, dir: updated[idx].dir === 'asc' ? 'desc' : 'asc' };
      this.sortOrder.set(updated);
    } else if (isShift && current.length > 0) {
      this.sortOrder.set([...current, { col, dir: 'asc' }]);
    } else {
      this.sortOrder.set([{ col, dir: 'asc' }]);
    }
    this.currentPage.set(1);
  }

  resetSort() {
    this.sortOrder.set([]);
    this.currentPage.set(1);
  }

  removeSortCriteria(index: number) {
    this.sortOrder.set(this.sortOrder().filter((_, j) => j !== index));
    this.currentPage.set(1);
  }

  // ─── Column Manager Methods ───────────────────────────────────────────────
  initColumnConfig() {
    try {
      const stored = localStorage.getItem(this.COL_STORAGE_KEY);
      if (stored) {
        const parsed: TableColumn[] = JSON.parse(stored);
        const merged = this.MOVEABLE_COLUMNS_DEFAULT.map(def => {
          const found = parsed.find(p => p.id === def.id);
          return found ? { ...def, visible: found.visible } : def;
        });
        const storedIds = parsed.map(p => p.id);
        const ordered = [
          ...parsed.filter(p => merged.some(m => m.id === p.id)).map(p => merged.find(m => m.id === p.id)!),
          ...merged.filter(m => !storedIds.includes(m.id))
        ];
        this.columnConfig.set(ordered);
      } else {
        this.columnConfig.set([...this.MOVEABLE_COLUMNS_DEFAULT]);
      }
    } catch {
      this.columnConfig.set([...this.MOVEABLE_COLUMNS_DEFAULT]);
    }
  }

  saveColumnConfig() {
    try { localStorage.setItem(this.COL_STORAGE_KEY, JSON.stringify(this.columnConfig())); } catch { }
  }

  toggleColumnVisibility(id: string) {
    this.columnConfig.update(cols => cols.map(col => col.id === id ? { ...col, visible: !col.visible } : col));
    this.saveColumnConfig();
  }

  resetColumns() {
    this.columnConfig.set([...this.MOVEABLE_COLUMNS_DEFAULT]);
    this.saveColumnConfig();
  }

  resetAll() {
    this.clearFilters();
    this.resetColumns();
    this.resetSort();
  }

  // ─── Vista Rápida ────────────────────────────────────────────────────────
  openQuickView(p: Publicador) {
    this.viewingPublicador.set(p);
    this.loadPublicadorPrivilegios(p.id_publicador);
  }

  closeQuickView() {
    this.viewingPublicador.set(null);
  }

  editFromQuickView() {
    const p = this.viewingPublicador();
    if (!p) return;
    this.closeQuickView();
    this.openEditForm(p);
  }

  // ─── Exportación ─────────────────────────────────────────────────────────
  exportData(format: 'excel' | 'pdf') {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.showExportMenu.set(false);

    // Columnas visibles en el mismo orden que la tabla: Nombre, [dinámicas], Estado
    const allColumns = [
      { id: 'nombre', label: 'Nombre' },
      ...this.visibleMoveableColumns().map(c => ({ id: c.id, label: c.label })),
      { id: 'estado', label: 'Estado' },
    ];

    // Serializar cada fila con los valores ya formateados (igual a como se muestran en pantalla)
    const rows = this.sortedList().map(p => {
      const row: Record<string, string> = {};
      for (const col of allColumns) {
        row[col.id] = this.getExportCellValue(p, col.id);
      }
      return row;
    });

    const titulo = 'Listado de Publicadores';
    const endpoint = `/api/publicadores/export/${format}`;

    this.http.post(endpoint, { columns: allColumns, rows, titulo }, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const ext = format === 'excel' ? 'xlsx' : 'pdf';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${titulo.replace(/ /g, '_')}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
      },
    });
  }

  private getExportCellValue(p: Publicador, colId: string): string {
    switch (colId) {
      case 'nombre': return this.getFullName(p);
      case 'congregacion': return p.nombre_congregacion ?? '';
      case 'grupo': return this.getGrupoNombre(p.id_grupo_publicador);
      case 'fecha_nacimiento': return p.fecha_nacimiento ? this.formatDateExport(p.fecha_nacimiento) : '';
      case 'fecha_bautismo': return p.fecha_bautismo ? this.formatDateExport(p.fecha_bautismo) : '';
      case 'fecha_inicio_informe': return p.fecha_inicio_informe ? this.formatDateExport(p.fecha_inicio_informe) : '';
      case 'fecha_inactividad': return p.fecha_inactividad ? this.formatDateExport(p.fecha_inactividad) : '';
      case 'telefono': return p.telefono ?? '';
      case 'sexo': return p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : (p.sexo ?? '');
      case 'direccion': return p.direccion ?? '';
      case 'barrio': return p.barrio ?? '';
      case 'consentimiento_datos': return p.consentimiento_datos ? 'Sí' : 'No';
      case 'estado': return this.getEstadoNombre(p.id_estado_publicador);
      default: return '';
    }
  }

  formatDateExport(dateStr: string): string {
    if (!dateStr) return '';
    try {
      // Parse YYYY-MM-DD or full ISO string without timezone shift
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
      }
      const d = new Date(dateStr);
      const userTimezoneOffset = d.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(d.getTime() + userTimezoneOffset);
      return adjustedDate.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  onColDragStart(index: number, event: DragEvent) {
    this._draggedColIdx = index;
    this.draggedColId.set(this.columnConfig()[index]?.id ?? null);
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; }
  }

  onColDragOver(index: number, event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) { event.dataTransfer.dropEffect = 'move'; }
  }

  onColDrop(targetIndex: number) {
    if (this._draggedColIdx === null || this._draggedColIdx === targetIndex) {
      this._draggedColIdx = null;
      this.draggedColId.set(null);
      return;
    }
    const cols = [...this.columnConfig()];
    const [moved] = cols.splice(this._draggedColIdx, 1);
    cols.splice(targetIndex, 0, moved);
    this.columnConfig.set(cols);
    this.saveColumnConfig();
    this._draggedColIdx = null;
    this.draggedColId.set(null);
  }

  onColDragEnd() {
    this._draggedColIdx = null;
    this.draggedColId.set(null);
  }

  trackColById(_: number, col: TableColumn) { return col.id; }

  isMobileColVisible(colId: string): boolean {
    return this.columnConfig().some(col => col.id === colId && col.visible);
  }

  // Pagination Logic
  private getSortValue(p: Publicador, col: string): string | number {
    switch (col) {
      case 'nombre': return this.getFullName(p).toLowerCase();
      case 'congregacion': return p.nombre_congregacion?.toLowerCase() ?? '';
      case 'grupo': return this.getGrupoNombre(p.id_grupo_publicador).toLowerCase();
      case 'fecha_nacimiento': return p.fecha_nacimiento ? new Date(p.fecha_nacimiento).getTime() : 0;
      case 'fecha_bautismo': return p.fecha_bautismo ? new Date(p.fecha_bautismo).getTime() : 0;
      case 'fecha_inicio_informe': return p.fecha_inicio_informe ? new Date(p.fecha_inicio_informe).getTime() : 0;
      case 'fecha_inactividad': return p.fecha_inactividad ? new Date(p.fecha_inactividad).getTime() : 0;
      case 'telefono': return (p.telefono ?? '').toLowerCase();
      case 'sexo': return (p.sexo ?? '').toLowerCase();
      case 'direccion': return (p.direccion ?? '').toLowerCase();
      case 'barrio': return (p.barrio ?? '').toLowerCase();
      case 'consentimiento_datos': return p.consentimiento_datos ? 1 : 0;
      case 'estado': return this.getEstadoNombre(p.id_estado_publicador).toLowerCase();
      default: return '';
    }
  }

  sortedList = computed(() => {
    const order = this.sortOrder();
    const list = [...this.filteredList()];
    if (order.length === 0) return list;

    return list.sort((a, b) => {
      for (const { col, dir } of order) {
        const valA = this.getSortValue(a, col);
        const valB = this.getSortValue(b, col);
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  });

  pagedList = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.sortedList().slice(start, end);
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
    const effectiveId = this.congregacionContext.effectiveCongregacionId();
    const params: any = { limit: 1000, offset: 0 };
    if (effectiveId != null) {
      params.id_congregacion = effectiveId;
    }
    if (this.isScopedToGroup()) {
      const idGrupo = this.authStore.user()?.id_grupo_publicador;
      if (idGrupo != null) {
        params.id_grupo = idGrupo;
      }
    }
    this.facade.load(params);
  }

  async loadAuxiliaryData() {
    this.loadPrivilegiosCatalog(); // Cargar catálogo de privilegios

    try {
      const effectiveId = this.congregacionContext.effectiveCongregacionId();
      const params: any = {};
      if (effectiveId != null) {
        params.id_congregacion = effectiveId;
      }

      // Added trailing slashes to match service configuration
      const requests: any[] = [
        lastValueFrom(this.http.get<Estado[]>('/api/estados/')),
        lastValueFrom(this.http.get<Grupo[]>('/api/grupos/', { params })),
        lastValueFrom(this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/', { params: { limit: 500, ...(effectiveId != null ? { id_congregacion: effectiveId } : {}) } }))
      ];

      if (this.isAdminOrGestor()) {
        requests.push(lastValueFrom(this.http.get<Congregacion[]>('/api/congregaciones/')));
      }

      const results = await Promise.all(requests);

      const estados = results[0];
      const grupos = results[1];
      const allPrivilegios = results[2];

      if (this.isAdminOrGestor() && results[3]) {
        this.congregaciones.set(results[3]);
      }

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
    // Obtenemos todos los registros (sin filtrar por activos)
    this.privilegiosService.getPublicadorPrivilegios(id).subscribe({
      next: (data) => {
        // Agrupar por id_privilegio y quedarnos solo con el más reciente o el activo
        const latestPrivsMap = new Map<number, any>();
        data.forEach(pp => {
          const existing = latestPrivsMap.get(pp.id_privilegio);
          if (!existing) {
            latestPrivsMap.set(pp.id_privilegio, pp);
          } else {
            // Si el actual no tiene fecha_fin (es activo), lo preferimos
            if (!pp.fecha_fin) {
              latestPrivsMap.set(pp.id_privilegio, pp);
            } 
            // Si el existente también tiene fecha_fin, nos quedamos con el más reciente
            else if (existing.fecha_fin) {
              if (new Date(pp.fecha_inicio).getTime() > new Date(existing.fecha_inicio).getTime()) {
                latestPrivsMap.set(pp.id_privilegio, pp);
              }
            }
          }
        });
        
        const filteredData = Array.from(latestPrivsMap.values());
        this.publicadorPrivilegios.set(filteredData);

        // Update GLOBAL MAP so the list updates immediately
        const today = new Date().toISOString().split('T')[0];
        const activePrivs = data
          .filter(pp => !pp.fecha_fin || pp.fecha_fin >= today)
          .map(pp => pp.id_privilegio);

        this.publicadorPrivilegiosMap.update(map => {
          map.set(id, activePrivs);
          return new Map(map); // Force signal update
        });

        // Cargar estado de eliminabilidad para cada registro visible
        this.eliminableMap.set(new Map());
        filteredData.forEach(pp => {
          this.privilegiosService.isPrivilegioEliminable(pp.id_publicador_privilegio).subscribe({
            next: (res) => {
              this.eliminableMap.update(map => {
                map.set(pp.id_publicador_privilegio, res);
                return new Map(map);
              });
            },
            error: () => {
              // Si falla, dejamos el default conservador (no eliminable).
            }
          });
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
      id_congregacion_publicador: null,
      id_estado_publicador: estadoActivo ? estadoActivo.id_estado : null,
      permite_login_simple: true
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
      id_congregacion_publicador: p.id_congregacion_publicador || null,
      id_estado_publicador: p.id_estado_publicador || null,
      consentimiento_datos: p.consentimiento_datos || false,
      fecha_inicio_informe: p.fecha_inicio_informe || null,
      permite_login_simple: p.permite_login_simple ?? true
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

  tabHasErrors(tab: 'personal' | 'teocratico'): boolean {
    if (!this.publicadorForm) return false;
    const tabFields: Record<string, string[]> = {
      personal: ['primer_nombre', 'primer_apellido'],
      teocratico: ['id_estado_publicador']
    };
    return (tabFields[tab] || []).some(field => {
      const c = this.publicadorForm.get(field);
      return c?.invalid && c?.touched;
    });
  }

  async onSubmit() {
    this.publicadorForm.markAllAsTouched();
    if (this.publicadorForm.invalid) return;

    this.saving.set(true);
    const rawData = this.publicadorForm.value;

    // Transform data for API compatibility
    const editingPub = this.editingPublicador();
    const nuevoEstadoNombre = this.getEstadoNombre(rawData.id_estado_publicador).toLowerCase();
    const estadoAnteriorNombre = editingPub
      ? this.getEstadoNombre(editingPub.id_estado_publicador).toLowerCase()
      : '';

    let fechaInactividad: string | null | undefined = undefined;
    if (editingPub) {
      if (nuevoEstadoNombre.includes('inactivo') && !estadoAnteriorNombre.includes('inactivo')) {
        fechaInactividad = new Date().toISOString().split('T')[0];
      } else if (!nuevoEstadoNombre.includes('inactivo') && estadoAnteriorNombre.includes('inactivo')) {
        fechaInactividad = null;
      }
    }

    const data: any = {
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

    if (fechaInactividad !== undefined) {
      data.fecha_inactividad = fechaInactividad;
    }

    const user = this.authStore.user();
    const isAdminOrGestor = user?.rol?.toLowerCase().includes('admin') || user?.rol?.toLowerCase().includes('gestor');
    const id_congregacion = this.congregacionContext.effectiveCongregacionId();

    // Validación: Si NO es admin, necesita ID congregación siempre.
    // Si ES admin, usa la congregación seleccionada en el navbar (contexto).
    if (id_congregacion == null && !isAdminOrGestor) {
      alert('Error: No se ha detectado tu congregación.');
      this.saving.set(false);
      return;
    }

    if (id_congregacion == null && isAdminOrGestor && !this.editingPublicador()) {
      alert('Aviso: Como administrador, debes seleccionar una congregación en la barra superior para crear miembros.');
      this.saving.set(false);
      return;
    }

    try {
      if (this.editingPublicador()) {
        await this.facade.update(this.editingPublicador()!.id_publicador, data);
        this.closePanel();
        this.showToast('Cambios guardados correctamente', 'success');
      } else {
        // En lugar de crear inmediatamente, abrimos el modal para pedir la fecha de inicio de informe
        this.showStartDateModal.set(true);
      }
    } catch (error) {
      console.error('Error saving:', error);
      this.showToast('Error al guardar los cambios', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Finaliza la creación del publicador después de que el usuario selecciona la fecha de inicio de informe.
   */
  async confirmCreationWithStartDate() {
    if (this.publicadorForm.invalid) return;

    this.saving.set(true);
    const rawData = this.publicadorForm.value;

    const data = {
      ...rawData,
      ungido: rawData.ungido ? 'Sí' : null,
      segundo_nombre: rawData.segundo_nombre || null,
      segundo_apellido: rawData.segundo_apellido || null,
      telefono: rawData.telefono || null,
      direccion: rawData.direccion || null,
      barrio: rawData.barrio || null,
      fecha_nacimiento: rawData.fecha_nacimiento || null,
      fecha_bautismo: rawData.fecha_bautismo || null,
      sexo: rawData.sexo || null,
      id_grupo_publicador: rawData.id_grupo_publicador || null,
      fecha_inicio_informe: rawData.fecha_inicio_informe // Aseguramos que se envíe la fecha seleccionada
    };

    const id_congregacion = this.congregacionContext.effectiveCongregacionId();

    try {
      await this.facade.create({ ...data, id_congregacion_publicador: id_congregacion! });
      this.showStartDateModal.set(false);
      this.closePanel();
      this.showToast('Publicador creado correctamente', 'success');
    } catch (error) {
      console.error('Error creating publicador:', error);
      this.showToast('Error al crear el publicador', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  // Delete
  isDeleting = signal(false);
  checkingUsuarioVinculado = signal(false);
  deleteStep = signal<'checking' | 'simple' | 'linked-choice' | 'confirm-delete-both' | 'reassign-picker'>('checking');
  usuarioVinculado = signal<UsuarioVinculado | null>(null);
  deleteOpcionElegida = signal<DeleteOpcion | null>(null);
  publicadoresParaReasignar = signal<Publicador[]>([]);
  publicadorReasignadoId = signal<number | null>(null);
  busquedaReasignar = signal('');
  publicadoresFiltradosReasignar = computed(() => {
    const q = this.busquedaReasignar().toLowerCase().trim();
    if (!q) return this.publicadoresParaReasignar();
    return this.publicadoresParaReasignar().filter(p => {
      const nombre = `${p.primer_nombre} ${p.segundo_nombre ?? ''} ${p.primer_apellido} ${p.segundo_apellido ?? ''}`.toLowerCase();
      return nombre.includes(q);
    });
  });

  async confirmDelete(p: Publicador) {
    this.publicadorToDelete.set(p);
    this.deleteModalOpen.set(true);
    this.deleteStep.set('checking');
    this.checkingUsuarioVinculado.set(true);
    try {
      const info = await this.facade.checkUsuarioVinculado(p.id_publicador);
      this.usuarioVinculado.set(info);
      this.deleteStep.set(info.tiene_usuario_vinculado ? 'linked-choice' : 'simple');
    } catch {
      this.showToast('Error al verificar usuario vinculado', 'error');
      this.closeDeleteModal();
    } finally {
      this.checkingUsuarioVinculado.set(false);
    }
  }

  closeDeleteModal() {
    if (this.isDeleting()) return;
    this.deleteModalOpen.set(false);
    this.publicadorToDelete.set(null);
    this.usuarioVinculado.set(null);
    this.deleteStep.set('checking');
    this.deleteOpcionElegida.set(null);
    this.publicadoresParaReasignar.set([]);
    this.publicadorReasignadoId.set(null);
    this.busquedaReasignar.set('');
  }

  selectDeleteOpcion(opcion: DeleteOpcion) {
    if (opcion === 'eliminar_con_usuario') {
      this.deleteStep.set('confirm-delete-both');
    } else if (opcion === 'reasignar_usuario') {
      const pub = this.publicadorToDelete();
      const todos = this.facade.vm().list.filter(
        p => p.id_publicador !== pub?.id_publicador
      );
      this.publicadoresParaReasignar.set(todos);
      this.deleteStep.set('reassign-picker');
    } else {
      this.deleteOpcionElegida.set(opcion);
    }
  }

  async executeDelete() {
    const p = this.publicadorToDelete();
    if (!p) return;

    const step = this.deleteStep();
    const opcion: DeleteOpcion = step === 'simple' || !this.usuarioVinculado()?.tiene_usuario_vinculado
      ? 'sin_usuario'
      : step === 'confirm-delete-both'
        ? 'eliminar_con_usuario'
        : (this.deleteOpcionElegida() ?? 'eliminar_con_usuario');

    if (opcion === 'reasignar_usuario') {
      const nuevoId = this.publicadorReasignadoId();
      if (!nuevoId) {
        this.showToast('Debes seleccionar un publicador para reasignar el usuario', 'error');
        return;
      }
      this.isDeleting.set(true);
      try {
        await this.facade.removeWithOpcion(p.id_publicador, opcion, nuevoId);
        this.showToast('Publicador eliminado y usuario reasignado correctamente', 'success');
        this.closeDeleteModal();
      } catch (err: any) {
        this.showToast(err?.error?.detail || 'No se pudo eliminar el publicador', 'error');
      } finally {
        this.isDeleting.set(false);
      }
      return;
    }

    this.isDeleting.set(true);
    try {
      await this.facade.removeWithOpcion(p.id_publicador, opcion);
      this.showToast('Publicador eliminado correctamente', 'success');
      this.closeDeleteModal();
    } catch (err: any) {
      console.error('Error deleting publicador:', err);
      const msg = err?.error?.detail || 'No se pudo eliminar el publicador';
      this.showToast(msg, 'error');
    } finally {
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

  getAvatarStyle(name: string): string {
    return getInitialAvatarStyle(name || '');
  }

  getRoles(p: Publicador): { label: string, short: string, type: 'pill' | 'text', class: string }[] {
    const privilegiosIds = this.publicadorPrivilegiosMap().get(p.id_publicador) || [];
    const catalogo = this.privilegios();

    const roleNames = privilegiosIds.map(id => catalogo.find(pr => pr.id_privilegio === id)?.nombre_privilegio?.toLowerCase() || '').filter(Boolean);

    // Order: Precursor R > Precursor A > Anciano > Ministerial > Publicador
    const roles: { label: string, short: string, type: 'pill' | 'text', class: string }[] = [];

    if (roleNames.some(r => r.includes('precursor regular'))) {
      roles.push({ label: 'PRECURSOR REGULAR', short: 'Prec. Regular', type: 'pill', class: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' });
    }
    if (roleNames.some(r => r.includes('precursor auxiliar'))) {
      roles.push({ label: 'PRECURSOR AUXILIAR', short: 'Prec. Auxiliar', type: 'pill', class: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' });
    }
    if (roleNames.some(r => r.includes('anciano'))) {
      roles.push({ label: 'ANCIANO', short: 'Anciano', type: 'pill', class: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' });
    }
    if (roleNames.some(r => r.includes('siervo'))) {
      roles.push({ label: 'SIERVO MINISTERIAL', short: 'S. Ministerial', type: 'pill', class: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' });
    }

    // Default if no specific roles
    if (roles.length === 0) {
      // No mostrar nada si no tiene privilegios especiales (es publicador por defecto)
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

  confirmDeleteContacto(c: ContactoEmergencia) {
    this.contactoToDelete.set(c);
    this.deleteContactoModalOpen.set(true);
  }

  closeDeleteContactoModal() {
    this.contactoToDelete.set(null);
    this.deleteContactoModalOpen.set(false);
  }

  async executeDeleteContacto() {
    const c = this.contactoToDelete();
    if (!c) return;
    this.isDeletingContacto.set(true);
    try {
      await lastValueFrom(this.http.delete('/api/contactos-emergencia/' + c.id_contacto_emergencia));
      this.loadContactos();
      this.closeDeleteContactoModal();
    } catch (e) {
      this.showToast('Error al eliminar el contacto', 'error');
    } finally {
      this.isDeletingContacto.set(false);
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
    return !!p.id_privilegio && !!p.fecha_inicio && !this.privilegioConflictoMsg();
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
    const pub = this.editingPublicador();
    if (!pub) return;

    this.privilegiosService.deletePublicadorPrivilegio(id).subscribe({
      next: () => {
        this.loadPublicadorPrivilegios(pub.id_publicador);
        this.showToast('Privilegio eliminado', 'success');
      },
      error: (err) => {
        if (err?.status === 409) {
          // El backend rechazó el delete porque hay informes en el rango.
          // Refrescamos el estado de eliminable y dirigimos al usuario a Finalizar.
          this.eliminableMap.update(map => {
            map.set(id, { eliminable: false, motivo: err.error?.detail ?? null });
            return new Map(map);
          });
          this.showToast(err.error?.detail || 'No se puede eliminar: usá Finalizar para conservar el historial.', 'error');
          this.startClosingPrivilegio(id);
        } else {
          this.showToast('Error al eliminar: ' + (err.error?.detail || err.message), 'error');
        }
      }
    });
  }

  executeDeletePrivilegio() {
    const id = this.privilegioToDelete();
    if (id !== null) {
      this.deletePublicadorPrivilegio(id);
      this.closeDeletePrivilegioModal();
    }
  }

  // ─── Consentimiento PDF Handlers ─────────────────────────────────────────

  async onConsentimientoPdfSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validar tipo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.pdfError.set('Solo se permiten archivos PDF o imágenes (JPG, PNG, WEBP).');
      input.value = '';
      return;
    }

    // Validar tamaño (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      this.pdfError.set('El archivo excede el tamaño máximo de 10 MB.');
      input.value = '';
      return;
    }

    const pub = this.editingPublicador();
    if (!pub) return;

    this.uploadingPdf.set(true);
    this.pdfError.set(null);

    try {
      const updated = await this.facade.uploadConsentimientoPdf(pub.id_publicador, file);
      // Actualizar publicador en edición con el nuevo estado
      this.editingPublicador.set({ ...pub, ...updated });
      
      // Sincronizar el formulario para que al hacer Guardar Cambios no lo sobreescriba a falso
      this.publicadorForm.patchValue({
         consentimiento_datos: updated.consentimiento_datos
      });

      this.showToast('Consentimiento PDF subido correctamente', 'success');
    } catch (err: any) {
      this.pdfError.set(err?.error?.detail || err?.message || 'Error al subir el archivo.');
    } finally {
      this.uploadingPdf.set(false);
      input.value = ''; // Reset input para permitir subir el mismo archivo
    }
  }

  async downloadConsentimientoPdf() {
    const pub = this.editingPublicador();
    if (!pub) return;

    try {
      const blob = await this.facade.downloadConsentimientoPdf(pub.id_publicador);
      // Abrir en nueva pestaña
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Liberar URL después de un momento
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      this.showToast(err?.error?.detail || 'Error al descargar el archivo.', 'error');
    }
  }

  async deleteConsentimientoPdf() {
    const pub = this.editingPublicador();
    if (!pub) return;

    try {
      const updated = await this.facade.deleteConsentimientoPdf(pub.id_publicador);
      this.editingPublicador.set({ ...pub, ...updated });

      // Sincronizar el formulario para que al hacer Guardar Cambios envíe falso
      this.publicadorForm.patchValue({
         consentimiento_datos: updated.consentimiento_datos
      });

      this.showToast('Consentimiento PDF eliminado', 'success');
    } catch (err: any) {
      this.showToast(err?.error?.detail || 'Error al eliminar el archivo.', 'error');
    }
  }

  async viewConsentimientoPdfFromQuickView() {
    const pub = this.viewingPublicador();
    if (!pub) return;

    try {
      const blob = await this.facade.downloadConsentimientoPdf(pub.id_publicador);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      this.showToast(err?.error?.detail || 'Error al descargar el archivo.', 'error');
    }
  }

}

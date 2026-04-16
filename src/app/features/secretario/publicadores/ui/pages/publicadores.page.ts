import { Component, inject, OnInit, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PublicadoresFacade } from '../../application/publicadores.facade';
import { Publicador } from '../../domain/models/publicador';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../../../core/congregacion-context/congregacion-context.service';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { PrivilegiosService } from '../../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../../privilegios/domain/models/publicador-privilegio';
import { DatePickerComponent } from '../../../../../shared/components/date-picker/date-picker.component';
import { getInitialAvatarStyle } from '../../../../../core/utils/avatar-style.util';

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
      <div class="shrink-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 p-1.5 flex items-center gap-1.5 flex-wrap lg:flex-nowrap">
        
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
                class="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-slate-800/50 border border-transparent dark:border-slate-700/50 rounded-lg text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-brand-orange/50 focus:ring-2 focus:ring-brand-orange/20 transition-all outline-none"
            >
        </div>

        <!-- Separator -->
        <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden lg:block shrink-0"></div>

        <!-- Quick Filters (Pills) -->
        <div class="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
            <button 
                (click)="selectedEstado.set(null); currentPage.set(1)"
                class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                [ngClass]="selectedEstado() === null 
                  ? 'bg-brand-orange text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200'"
            >
                Todos <span class="text-[0.625rem] opacity-80">{{ totalFilteredCount() }}</span>
            </button>
            
            <button 
                *ngFor="let e of estadosWithCounts()"
                (click)="selectedEstado.set(e.id_estado); currentPage.set(1)"
                class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                [ngClass]="selectedEstado() === e.id_estado 
                  ? 'bg-brand-orange text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'"
            >
                {{ e.nombre_estado }} <span class="text-[0.625rem] opacity-60">{{ e.count }}</span>
            </button>
        </div>

        <!-- Separator -->
        <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden lg:block shrink-0"></div>

        <!-- More Filters Dropdown (Advanced) -->
        <div class="relative shrink-0 hidden md:block">
            <!-- Trigger Button -->
            <button 
                (click)="showAdvancedFilters.set(!showAdvancedFilters())"
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
            
            <!-- Backdrop (Click Outside) -->
             <div *ngIf="showAdvancedFilters()" (click)="showAdvancedFilters.set(false)" class="fixed inset-0 bg-transparent" style="z-index: 9998; pointer-events: auto;"></div>

            <!-- Dropdown Menu -->
            <div 
                *ngIf="showAdvancedFilters()"
                class="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-700 overflow-hidden animate-fadeInUp flex flex-col max-h-[80vh]" style="z-index: 9999;"
            >
                <!-- Header -->
                <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 sticky top-0">
                    <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Filtros Avanzados</span>
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
                            <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sexo</span>
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
                            <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Consentimiento</span>
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
                             <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Grupos</span>
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
                    <div class="mb-3">
                        <div class="px-2 py-1.5 flex items-center gap-2">
                             <span class="w-1 h-3 rounded-full bg-indigo-500"></span>
                             <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Privilegios</span>
                        </div>
                        <div class="grid grid-cols-2 gap-x-0.5 gap-y-0">
                            <label
                                *ngFor="let p of privilegios()"
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
                                <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Barrio</span>
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

        <!-- Separator -->
        <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden lg:block shrink-0"></div>

        <!-- Column Manager -->
        <div class="relative shrink-0 hidden md:block">
            <button
                (click)="showColumnManager.set(!showColumnManager())"
                title="Gestionar columnas"
                class="flex items-center justify-center w-9 h-9 rounded-lg transition-all border outline-none"
                [ngClass]="hasOptionalColumnsVisible()
                  ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 shadow-sm'
                  : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-200'"
            >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </button>

            <!-- Backdrop -->
            <div *ngIf="showColumnManager()" (click)="showColumnManager.set(false)" class="fixed inset-0 z-40 bg-transparent"></div>

            <!-- Dropdown -->
            <div *ngIf="showColumnManager()" class="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-fadeInUp flex flex-col" style="max-height: 80vh;">

                <!-- Header -->
                <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Configurar Columnas</span>
                    <button (click)="resetColumns()" class="text-[0.625rem] font-bold text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors uppercase tracking-wider">Restablecer</button>
                </div>

                <!-- Fixed Columns (Locked Info) -->
                <div class="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-900/20 shrink-0">
                    <p class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Columnas Fijas</p>
                    <div class="space-y-0.5">
                        <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg opacity-50 cursor-not-allowed select-none">
                            <svg class="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <span class="text-[0.6875rem] font-semibold text-slate-600 dark:text-slate-400 flex-1">Nombre</span>
                            <div class="rounded-full bg-brand-orange relative shrink-0" style="width:32px;height:18px;"><div class="bg-white rounded-full absolute shadow-sm" style="width:14px;height:14px;top:2px;right:2px;"></div></div>
                        </div>
                        <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg opacity-50 cursor-not-allowed select-none">
                            <svg class="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <span class="text-[0.6875rem] font-semibold text-slate-600 dark:text-slate-400 flex-1">Estado</span>
                            <div class="rounded-full bg-brand-orange relative shrink-0" style="width:32px;height:18px;"><div class="bg-white rounded-full absolute shadow-sm" style="width:14px;height:14px;top:2px;right:2px;"></div></div>
                        </div>
                    </div>
                </div>

                <!-- Configurable Columns -->
                <div class="overflow-y-auto flex-1 simple-scrollbar">
                    <div class="p-2">
                        <p class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 pt-1 mb-0.5">Columnas Configurables</p>
                        <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 px-2 mb-2.5">Arrastra <span class="font-bold">⠿</span> para reordenar</p>
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
                                  ? 'opacity-40 bg-violet-50 dark:bg-violet-900/20 border border-dashed border-violet-300 dark:border-violet-700 cursor-grabbing'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-grab active:cursor-grabbing'"
                            >
                                <!-- Drag Handle -->
                                <svg class="w-3.5 h-5 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-colors" viewBox="0 0 10 20" fill="currentColor" aria-hidden="true">
                                    <circle cx="3" cy="4" r="1.5"/><circle cx="7" cy="4" r="1.5"/>
                                    <circle cx="3" cy="10" r="1.5"/><circle cx="7" cy="10" r="1.5"/>
                                    <circle cx="3" cy="16" r="1.5"/><circle cx="7" cy="16" r="1.5"/>
                                </svg>
                                <!-- Label -->
                                <span class="text-[0.6875rem] font-semibold text-slate-700 dark:text-slate-300 flex-1 truncate">{{ col.label }}</span>
                                <span *ngIf="col.optional" class="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 uppercase tracking-wide">Extra</span>
                                <!-- Toggle Switch -->
                                <button
                                    type="button"
                                    (click)="toggleColumnVisibility(col.id)"
                                    draggable="false"
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

        <!-- Reset All Button (aparece solo cuando hay filtros o columnas personalizadas) -->
        <div class="relative shrink-0 hidden md:block">
            <button
                *ngIf="hasCustomView()"
                (click)="resetAll()"
                title="Restablecer filtros y columnas"
                class="flex items-center justify-center w-9 h-9 rounded-lg transition-all border border-rose-200 dark:border-rose-800/60 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 animate-fadeIn"
            >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                </svg>
            </button>
        </div>

        <!-- Spacer -->
        <div class="flex-1 hidden lg:block"></div>

        <!-- Export Dropdown -->
        <div *ngIf="canExportPublicadores()" class="relative shrink-0 hidden md:block">
            <!-- Backdrop -->
            <div *ngIf="showExportMenu()" (click)="showExportMenu.set(false)" class="fixed inset-0 z-40 bg-transparent"></div>

            <!-- Trigger -->
            <button
                (click)="showExportMenu.set(!showExportMenu())"
                [disabled]="exporting()"
                [title]="exporting() ? 'Exportando...' : 'Exportar vista'"
                class="flex items-center justify-center w-9 h-9 rounded-lg transition-all border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <!-- Spinner cuando exporta -->
                <svg *ngIf="exporting()" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round"/></svg>
                <!-- Icono normal -->
                <svg *ngIf="!exporting()" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>

            <!-- Menú dropdown -->
            <div
                *ngIf="showExportMenu()"
                class="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg shadow-slate-200/60 dark:shadow-black/40 border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-fadeInUp"
            >
                <!-- Cabecera del menú -->
                <div class="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider">Exportar vista actual</p>
                    <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 mt-0.5">{{ sortedList().length }} registros · {{ visibleMoveableColumns().length + 2 }} columnas</p>
                </div>

                <!-- Opción Excel -->
                <button
                    (click)="exportData('excel')"
                    class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors group text-left"
                >
                    <div class="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                        <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Excel (.xlsx)</p>
                        <p class="text-[0.625rem] text-slate-400 dark:text-slate-500">Con filtros y columnas visibles</p>
                    </div>
                </button>

                <!-- Opción PDF -->
                <button
                    (click)="exportData('pdf')"
                    class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors group text-left"
                >
                    <div class="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0 group-hover:bg-rose-200 dark:group-hover:bg-rose-900/50 transition-colors">
                        <svg class="w-4 h-4 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-200">PDF</p>
                        <p class="text-[0.625rem] text-slate-400 dark:text-slate-500">Orientación automática por columnas</p>
                    </div>
                </button>
            </div>
        </div>

        <!-- Separador antes del botón Nuevo -->
        <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0"></div>

        <!-- Action Button (Compact, inside toolbar) -->
        <button *ngIf="canEditPublicadores()"
            (click)="openCreateForm()"
            class="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 h-9 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-orange-900/10 transition-all active:scale-95 whitespace-nowrap"
        >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
            <span class="hidden sm:inline">Nuevo</span>
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
             <div class="md:hidden p-4 space-y-4 pb-4">
                 <div *ngFor="let p of pagedList(); trackBy: trackById" class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative">
                     <div class="flex items-start justify-between mb-4">
                         <div class="flex items-center gap-3">
                             <div 
                                class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm shadow-sm ring-1 ring-white border border-white/50"
                                [ngClass]="getAvatarStyle(getFullName(p))"
                            >
                               {{ getInitials(p) }}
                            </div>
                            <div>
                                <h3 class="font-bold text-slate-900 dark:text-white leading-tight mb-1">{{ p.primer_nombre }} {{ p.primer_apellido }}</h3>
                                <div class="flex flex-wrap gap-1 items-center">
                                     <ng-container *ngFor="let role of getRoles(p)">
                                          <span *ngIf="role.type === 'pill'" class="inline-flex items-center px-2 py-0.5 rounded-md text-[0.625rem] font-bold uppercase tracking-wider shadow-sm" [ngClass]="role.class">
                                              {{ role.label }}
                                          </span>
                                          <span *ngIf="role.type === 'text'" class="text-[0.625rem] uppercase tracking-wider" [ngClass]="role.class">
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
                     <div class="grid grid-cols-2 gap-3 text-sm mb-3">
                         <div class="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                             <span class="block text-[0.625rem] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Grupo</span>
                             <span class="font-bold text-slate-700 dark:text-slate-300 truncate block">{{ getGrupoNombre(p.id_grupo_publicador) }}</span>
                         </div>
                         <div class="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                             <span class="block text-[0.625rem] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Estado</span>
                             <span class="font-bold text-slate-700 dark:text-slate-300 truncate block">{{ getEstadoNombre(p.id_estado_publicador) }}</span>
                         </div>
                         <div class="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg col-span-2 flex items-center gap-2">
                              <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                              <span class="font-medium text-slate-600 dark:text-slate-300">{{ p.telefono || 'Sin teléfono' }}</span>
                         </div>
                     </div>

                     <!-- Optional Columns (Mobile Chips) -->
                     <div class="flex flex-wrap gap-1.5 mb-3" *ngIf="isMobileColVisible('sexo') && p.sexo || isMobileColVisible('direccion') && p.direccion || isMobileColVisible('barrio') && p.barrio || isMobileColVisible('consentimiento_datos')">
                         <span *ngIf="isMobileColVisible('sexo') && p.sexo"
                             class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[0.6875rem] font-semibold border"
                             [ngClass]="p.sexo === 'M' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800/50' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800/50'">
                             {{ p.sexo === 'M' ? '♂ Masculino' : '♀ Femenino' }}
                         </span>
                         <span *ngIf="isMobileColVisible('direccion') && p.direccion"
                             class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[0.6875rem] font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                             <svg class="w-3 h-3 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                             <span class="truncate">{{ p.direccion }}</span>
                         </span>
                         <span *ngIf="isMobileColVisible('barrio') && p.barrio && !isMobileColVisible('direccion')"
                             class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[0.6875rem] font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                             Barrio: {{ p.barrio }}
                         </span>
                         <span *ngIf="isMobileColVisible('consentimiento_datos')"
                             class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[0.6875rem] font-bold border"
                             [ngClass]="p.consentimiento_datos ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'">
                             {{ p.consentimiento_datos ? '✓ Con consentimiento' : '✗ Sin consentimiento' }}
                         </span>
                     </div>

                     <!-- Actions -->
                     <div class="flex gap-2" *ngIf="canEditPublicadores()">
                         <button (click)="openEditForm(p)" class="flex-1 py-2.5 rounded-xl bg-brand-orange/10 text-brand-orange font-bold text-xs hover:bg-brand-orange hover:text-white transition-colors">
                             Editar
                         </button>
                         <button (click)="confirmDelete(p)" class="py-2.5 px-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                             <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                         </button>
                     </div>
                 </div>
                  <!-- Empty State Mobile -->
                  <div *ngIf="pagedList().length === 0 && !vm().loading" class="text-center py-16 px-4">
                      <div class="w-16 h-16 mx-auto bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-orange-900/20 dark:via-slate-800 dark:to-amber-900/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-orange-100/50 dark:border-orange-800/30">
                         <svg class="w-8 h-8 text-orange-300 dark:text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <h3 class="text-slate-800 dark:text-white font-bold mb-1">No se encontraron publicadores</h3>
                      <p class="text-slate-400 dark:text-slate-500 text-sm mb-4">Ajusta los filtros o búsqueda</p>
                      <button *ngIf="canEditPublicadores()" (click)="openCreateForm()" class="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-bold shadow-md shadow-orange-500/20">
                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                         Agregar
                      </button>
                  </div>
             </div>

             <!-- 2. Desktop Table View (Visible md+) -->
             <div class="hidden md:block">
                <table class="w-full min-w-max text-left border-collapse">
                   <thead class="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
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
                         <th class="px-3 py-3 w-10"></th>
                      </tr>
                   </thead>
                   <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                      <tr *ngFor="let p of pagedList(); trackBy: trackById" class="group hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-transparent dark:border-slate-800/50 transition-all">
                         
                         <!-- Nombre -->
                         <td class="px-5 py-2.5 relative">
                            <div class="flex items-center gap-3">
                               <div 
                                   class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm shadow-sm ring-1 ring-white border border-white/50"
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
                                     'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50': getEstadoNombre(p.id_estado_publicador).includes('Activo'),
                                     'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800/50': getEstadoNombre(p.id_estado_publicador).includes('Inactivo'),
                                     'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600': !getEstadoNombre(p.id_estado_publicador).includes('Activo') && !getEstadoNombre(p.id_estado_publicador).includes('Inactivo')
                                 }"
                             >
                                 <span class="w-1.5 h-1.5 rounded-full animate-pulse" [ngClass]="getEstadoDotClass(p.id_estado_publicador)"></span>
                                 {{ getEstadoNombre(p.id_estado_publicador) }}
                             </span>
                         </td>

                         <!-- Actions -->
                         <td class="px-3 py-2.5 text-right">
                            <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                               <button (click)="openQuickView(p)" class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-sky-500 transition-all shadow-sm hover:shadow-md hover:shadow-sky-200" title="Ver detalles">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                               </button>
                               <button *ngIf="canEditPublicadores()" (click)="openEditForm(p)" class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-brand-orange transition-all shadow-sm hover:shadow-md hover:shadow-orange-200" title="Editar">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                               </button>
                               <button *ngIf="canEditPublicadores()" (click)="confirmDelete(p)" class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-red-500 transition-all shadow-sm hover:shadow-md hover:shadow-red-200" title="Eliminar">
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
                                 <button *ngIf="canEditPublicadores()" (click)="openCreateForm()" class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-orange text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-95">
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

        <!-- Pagination Footer (Matches Grupos Module) -->
        <div class="shrink-0 z-20 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between md:rounded-b-2xl transition-all duration-300 shadow-[0_-1px_2px_rgba(0,0,0,0.02)] dark:shadow-none">
             <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
                Mostrando <span class="font-bold text-slate-800 dark:text-slate-200">{{ (currentPage() - 1) * pageSize + 1 }} - {{ Math.min(currentPage() * pageSize, filteredList().length) }}</span> 
                de <span class="font-bold text-slate-800 dark:text-white">{{ filteredList().length }}</span> publicadores
             </p>
             <div class="flex gap-2">
                  <button 
                   (click)="prevPage()" 
                   [disabled]="currentPage() === 1"
                   class="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-brand-orange dark:hover:text-brand-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <button 
                   (click)="nextPage()" 
                   [disabled]="currentPage() * pageSize >= filteredList().length"
                   class="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-brand-orange dark:hover:text-brand-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
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
      <div class="h-full flex flex-col bg-white dark:bg-slate-900 rounded-none md:rounded-l-3xl shadow-2xl shadow-slate-900/10 dark:shadow-black/50 border-l border-slate-100 dark:border-slate-800 overflow-hidden">
        
        <!-- Premium Gradient Header (Always Light as per design) -->
        <!-- Premium Gradient Header -->
        <div class="shrink-0 relative overflow-hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
             <!-- Background gradient -->
             <div class="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-orange-900/10 transition-colors duration-500"></div>
             <div class="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-orange-100/40 to-transparent dark:from-orange-500/10 dark:to-transparent rounded-full -mr-16 -mt-16 blur-3xl"></div>
             
             <div class="relative px-4 pt-4 pb-2 md:px-8 md:pt-8 md:pb-4">
                <div class="flex items-start justify-between">
                     <div class="flex gap-4">
                         <!-- Icon with gradient background -->
                         <div class="hidden md:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-orange to-orange-500 text-white items-center justify-center shrink-0 shadow-lg shadow-orange-500/20 ring-4 ring-white dark:ring-slate-800 relative z-10 transition-shadow duration-300">
                              <svg *ngIf="!editingPublicador()" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                              <svg *ngIf="editingPublicador()" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                         </div>
                         <div>
                             <div class="flex items-center gap-2 mb-1.5">
                                <span class="px-2.5 py-1 rounded-lg text-[0.625rem] font-black uppercase tracking-widest shadow-sm border border-transparent"
                                      [ngClass]="editingPublicador() 
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/30' 
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/30'">
                                  {{ editingPublicador() ? 'Modo Edición' : 'Nuevo Registro' }}
                                </span>
                             </div>
                             <h2 class="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
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
                        <svg class="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
             </div>

             <!-- Tabs Navigation (Dark Bar Style) -->
             <div class="px-4 pb-4 sm:px-6 sm:pb-6 md:px-8 md:pb-8 relative z-10">
                <div class="flex p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 backdrop-blur-md">
                  <button 
                    (click)="activeTab.set('personal')" 
                    class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200"
                    [ngClass]="activeTab() === 'personal' 
                      ? 'bg-white dark:bg-slate-700 text-brand-orange shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'"
                  >
                    Personal
                  </button>
                  <button 
                    (click)="activeTab.set('teocratico')" 
                    class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200"
                    [ngClass]="activeTab() === 'teocratico' 
                      ? 'bg-white dark:bg-slate-700 text-brand-orange shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'"
                  >
                    Teocrático
                  </button>
                  <button 
                    *ngIf="editingPublicador()" 
                    (click)="activeTab.set('emergencia')" 
                    class="flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all duration-200"
                    [ngClass]="activeTab() === 'emergencia' 
                      ? 'bg-white dark:bg-slate-700 text-brand-orange shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'"
                  >
                    Emergencia
                  </button>
                </div>
             </div>
        </div>

        <!-- Divider is not needed with the new design, content scrolls cleanly -->

            <!-- 3. Scrollable Content Area -->
            <div class="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 scroll-smooth">
              <form [formGroup]="publicadorForm" (ngSubmit)="onSubmit()" class="space-y-6 pb-20"> <!-- pb-20 para espacio extra al final -->

                <!-- TAB: PERSONAL -->
                <div *ngIf="activeTab() === 'personal'" class="space-y-8 animate-fadeIn">
                     
                     <!-- Section: Identidad -->
                     <div class="space-y-6">
                        <div class="flex items-center gap-3 py-2">
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                           <span class="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-widest">Identidad</span>
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <!-- Fila 1: Nombres -->
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                                  Primer Nombre <span class="text-red-400">*</span>
                               </label>
                               <input formControlName="primer_nombre" (input)="capitalizeInput('primer_nombre')" placeholder="Ej: Juan" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                             </div>
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                                  Segundo Nombre
                               </label>
                               <input formControlName="segundo_nombre" (input)="capitalizeInput('segundo_nombre')" placeholder="Ej: Carlos" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                             </div>
                             
                             <!-- Fila 2: Apellidos -->
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                                  Primer Apellido <span class="text-red-400">*</span>
                               </label>
                               <input formControlName="primer_apellido" (input)="capitalizeInput('primer_apellido')" placeholder="Ej: Pérez" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                             </div>
                             <div class="col-span-1 space-y-2">
                               <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                                  Segundo Apellido
                               </label>
                               <input formControlName="segundo_apellido" (input)="capitalizeInput('segundo_apellido')" placeholder="Ej: García" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
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
                     <div class="space-y-6">
                        <div class="flex items-center gap-3 py-2">
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                           <span class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ubicación y Contacto</span>
                           <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="col-span-2 sm:col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wide mb-2">
                                  <span class="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"></span>
                                  Teléfono
                               </label>
                               <input formControlName="telefono" placeholder="+57 300..." class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                            </div>

                            <div class="col-span-2 sm:col-span-1 space-y-2">
                                <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                   <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                   Barrio
                                </label>
                                <input formControlName="barrio" placeholder="Ej: El Poblado" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                            </div>

                            <div class="col-span-2 space-y-2">
                                <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                   <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                   Dirección Completa
                                </label>
                                <input formControlName="direccion" placeholder="Calle 123 # 45-67" class="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal">
                            </div>
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
                                    <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Código PIN</p>
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

                                <!-- Regenerar PIN -->
                                <button type="button"
                                        (click)="regenerarPin(editingPublicador()!.id_publicador)"
                                        [disabled]="savingPin() || !publicadorForm.get('permite_login_simple')?.value"
                                        class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-sky-100 dark:border-sky-900/30 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all disabled:opacity-50 shrink-0 shadow-sm">
                                    <svg class="w-3.5 h-3.5" [ngClass]="savingPin() ? 'animate-spin' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                    Nuevo PIN
                                </button>
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

                           <div class="grid grid-cols-2 gap-4">
                                <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
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
                                 </div>
                                 <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                       <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                       Fecha Bautismo
                                     </label>
                                     <app-date-picker formControlName="fecha_bautismo" placeholder="Seleccionar fecha"></app-date-picker>
                                 </div>
                                 <div class="col-span-2 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                         <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                         Fecha Inicio Informe
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
                                          <span class="text-xs text-slate-500 font-medium">Ungido</span>
                                      </div>
                                  </div>
                                  <div class="w-5 h-5 rounded-full border flex items-center justify-center transition-colors"
                                       [ngClass]="publicadorForm.get('ungido')?.value ? 'border-brand-orange bg-brand-orange' : 'border-slate-300'">
                                      <svg *ngIf="publicadorForm.get('ungido')?.value" class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
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
                                       <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                           <!-- Botón cerrar privilegio (solo si está activo) -->
                                           <button *ngIf="!pp.fecha_fin && closingPrivilegioId() !== pp.id_publicador_privilegio"
                                               type="button"
                                               (click)="startClosingPrivilegio(pp.id_publicador_privilegio)"
                                               title="Establecer fecha fin"
                                               class="p-1.5 text-slate-400 hover:text-amber-500 transition-all">
                                               <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="17" y1="16" x2="12" y2="16"/><line x1="12" y1="16" x2="12" y2="21"/></svg>
                                           </button>
                                           <button type="button" (click)="confirmDeletePrivilegio(pp.id_publicador_privilegio)" class="p-1.5 text-slate-400 hover:text-red-500 transition-all">
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
                                                 *ngFor="let p of privilegios()" 
                                                 type="button"
                                                 (click)="selectNewPrivilege(p)"
                                                 class="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-between group"
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
                       <div *ngIf="!editingPublicador()" class="mt-6 p-4 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200 dark:border-slate-700">
                           <p class="text-xs text-slate-400">Guarda el publicador para gestionar sus privilegios.</p>
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
                    <div *ngIf="!showContactoForm()" class="space-y-3">
                        <div *ngFor="let c of contactos()" class="p-4 rounded-xl border border-orange-200/50 dark:border-orange-800/30 bg-orange-50/30 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-brand-orange dark:hover:border-brand-orange/50 transition-all group relative">
                             <div class="flex justify-between items-start">
                                 <div>
                                     <div class="flex items-center gap-2 mb-1">
                                         <h4 class="text-sm font-bold text-slate-800">{{ c.nombre }}</h4>
                                         <span *ngIf="c.parentesco" class="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[0.625rem] font-bold text-slate-500 uppercase tracking-wide">{{ c.parentesco }}</span>
                                         <span *ngIf="c.es_principal" class="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[0.625rem] font-bold border border-orange-200">Principal</span>
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
                        <div *ngIf="contactos().length === 0" class="text-center py-8 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                             <div class="w-12 h-12 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                 <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                             </div>
                             <p class="text-sm font-medium text-slate-900 dark:text-white">Sin contactos de emergencia</p>
                             <p class="text-xs text-slate-500 mt-1">Agrega información vital para urgencias.</p>
                        </div>
                    </div>

                    <!-- Formulario Contacto (Inline) -->
                     <!-- Formulario Contacto (Inline Refined) -->
                     <!-- Formulario Contacto (Inline Refined) -->
                     <div *ngIf="showContactoForm()" [formGroup]="contactoForm" class="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-sm animate-fadeInUp">
                          <h4 class="text-lg font-display font-bold text-slate-900 dark:text-white mb-6">{{ editingContacto() ? 'Editar Contacto' : 'Nuevo Contacto' }}</h4>
                          
                          <div class="space-y-4">
                              <div class="space-y-2">
                                  <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                     <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                     Nombre Completo
                                  </label>
                                  <input formControlName="nombre" class="w-full h-12 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-4 focus:ring-brand-orange/10 focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 font-normal">
                              </div>
                              
                              <div class="grid grid-cols-2 gap-4">
                                  <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        Parentesco
                                     </label>
                                     <input formControlName="parentesco" placeholder="Ej. Madre" class="w-full h-12 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-4 focus:ring-brand-orange/10 focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 font-normal">
                                  </div>
                                  <div class="col-span-1 space-y-2">
                                     <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                        Teléfono
                                     </label>
                                     <input formControlName="telefono" class="w-full h-12 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-4 focus:ring-brand-orange/10 focus:border-brand-orange transition-all outline-none">
                                  </div>
                              </div>
                              
                              <div class="space-y-2">
                                  <label class="flex items-center gap-2 text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                     <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                     Dirección (Opcional)
                                  </label>
                                  <input formControlName="direccion" class="w-full h-12 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 focus:ring-4 focus:ring-brand-orange/10 focus:border-brand-orange transition-all outline-none">
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
           <div class="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 z-20">
               <div class="hidden sm:block">
                  <p class="text-[0.625rem] text-slate-400 font-bold uppercase tracking-wider">
                     <span class="text-red-400">*</span> Campo obligatorio
                  </p>
               </div>
               <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto min-w-0">
                   <button 
                      type="button"
                      (click)="tryClosePanel()" 
                      class="flex-1 sm:flex-none min-w-0 px-6 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-200 transition-all focus:ring-4 focus:ring-slate-100 outline-none"
                   >
                      Cancelar
                   </button>
                   <button 
                      type="button"
                      (click)="onSubmit()" 
                      [disabled]="publicadorForm.invalid || saving()" 
                      class="flex-1 sm:flex-none min-w-0 px-8 h-11 rounded-xl bg-gradient-to-r from-brand-orange to-orange-500 text-white font-bold text-sm hover:shadow-lg hover:shadow-brand-orange/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                   >
                      <svg *ngIf="saving()" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      {{ saving() ? 'Guardando...' : (editingPublicador() ? 'Guardar Cambios' : 'Crear Registro') }}
                   </button>
               </div>
           </div>
      </div> <!-- End Inner Container -->
    </div> <!-- End Detail Panel Outer -->

      <!-- ═══════════════════════════════════════════════════════════════ -->
      <!-- QUICK VIEW MODAL                                              -->
      <!-- ═══════════════════════════════════════════════════════════════ -->
      <div *ngIf="viewingPublicador()" class="fixed inset-0 z-[55] flex items-center justify-center p-4 md:p-6">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" (click)="closeQuickView()"></div>

        <!-- Card -->
        <div class="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-900/20 dark:shadow-black/60 border border-slate-100 dark:border-slate-800 overflow-hidden animate-fadeInUp">

          <!-- ── Header ─────────────────────────────────────────────── -->
          <div class="relative shrink-0 px-6 pt-6 pb-5 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/60 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
            <button (click)="closeQuickView()" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div class="flex items-center gap-4">
              <!-- Avatar -->
              <div class="w-14 h-14 rounded-full flex items-center justify-center shrink-0 font-semibold text-base shadow-sm ring-1 ring-white border border-white/50"
                [ngClass]="getAvatarStyle(getFullName(viewingPublicador()!))">
                {{ getInitials(viewingPublicador()) }}
              </div>
              <div class="min-w-0">
                <h2 class="text-lg font-black text-slate-900 dark:text-white leading-tight truncate">{{ getFullName(viewingPublicador()!) }}</h2>
                <!-- Estado badge -->
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-bold border"
                    [ngClass]="{
                      'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50': getEstadoNombre(viewingPublicador()!.id_estado_publicador).includes('Activo'),
                      'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50': getEstadoNombre(viewingPublicador()!.id_estado_publicador).includes('Inactivo'),
                      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700': !getEstadoNombre(viewingPublicador()!.id_estado_publicador).includes('Activo') && !getEstadoNombre(viewingPublicador()!.id_estado_publicador).includes('Inactivo')
                    }">
                    <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getEstadoDotClass(viewingPublicador()!.id_estado_publicador)"></span>
                    {{ getEstadoNombre(viewingPublicador()!.id_estado_publicador) }}
                  </span>
                  <span *ngIf="viewingPublicador()!.sexo" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800/50">
                    {{ viewingPublicador()!.sexo === 'M' ? '♂ Masculino' : '♀ Femenino' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Scrollable Body ─────────────────────────────────────── -->
          <div class="flex-1 overflow-y-auto simple-scrollbar px-6 py-5 space-y-5">

            <!-- Sección: Contacto -->
            <div>
              <p class="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Contacto</p>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div class="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-600">
                    <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider">Teléfono</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{{ viewingPublicador()!.telefono || '—' }}</p>
                  </div>
                </div>
                <div class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div class="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-600">
                    <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider">Nacimiento</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{{ viewingPublicador()!.fecha_nacimiento ? formatDateExport(viewingPublicador()!.fecha_nacimiento!) : '—' }}</p>
                  </div>
                </div>
                <div class="col-span-2 flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div class="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-600">
                    <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider">Dirección</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{{ viewingPublicador()!.direccion || '—' }}
                      <span *ngIf="viewingPublicador()!.barrio" class="ml-1 text-[0.6875rem] font-bold text-slate-400">· {{ viewingPublicador()!.barrio }}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sección: Teocrático -->
            <div>
              <p class="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Servicio</p>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div class="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-600">
                    <svg class="w-3.5 h-3.5 text-brand-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider">Grupo</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{{ getGrupoNombre(viewingPublicador()!.id_grupo_publicador) }}</p>
                  </div>
                </div>
                <div class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div class="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-600">
                    <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider">Bautismo</p>
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{{ viewingPublicador()!.fecha_bautismo ? formatDateExport(viewingPublicador()!.fecha_bautismo!) : '—' }}</p>
                  </div>
                </div>
                <div class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50" *ngIf="viewingPublicador()!.fecha_inicio_informe">
                  <div class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0 shadow-sm border border-emerald-100 dark:border-emerald-800/50">
                    <svg class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider">Inicio Inf.</p>
                    <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-400 truncate mt-0.5">{{ formatDateExport(viewingPublicador()!.fecha_inicio_informe!) }}</p>
                  </div>
                </div>
                <div class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50" *ngIf="viewingPublicador()!.fecha_inactividad">
                  <div class="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0 shadow-sm border border-rose-100 dark:border-rose-800/50">
                    <svg class="w-3.5 h-3.5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-[0.625rem] font-bold text-rose-400 uppercase tracking-wider">Inactividad</p>
                    <p class="text-sm font-semibold text-rose-600 dark:text-rose-400 truncate mt-0.5">{{ formatDateExport(viewingPublicador()!.fecha_inactividad!) }}</p>
                  </div>
                </div>
                <!-- Consentimiento -->
                <div class="col-span-2 flex items-center gap-2.5 p-3 rounded-xl"
                  [ngClass]="viewingPublicador()!.consentimiento_datos ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-800/50'">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    [ngClass]="viewingPublicador()!.consentimiento_datos ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'">
                    <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <ng-container *ngIf="viewingPublicador()!.consentimiento_datos"><polyline points="20 6 9 17 4 12"/></ng-container>
                      <ng-container *ngIf="!viewingPublicador()!.consentimiento_datos"><path d="M18 6L6 18M6 6l12 12"/></ng-container>
                    </svg>
                  </div>
                  <div>
                    <p class="text-[0.625rem] font-bold uppercase tracking-wider" [ngClass]="viewingPublicador()!.consentimiento_datos ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'">Consentimiento de datos</p>
                    <p class="text-sm font-bold mt-0.5" [ngClass]="viewingPublicador()!.consentimiento_datos ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'">
                      {{ viewingPublicador()!.consentimiento_datos ? 'Ha dado consentimiento' : 'Sin consentimiento' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sección: Privilegios -->
            <div *ngIf="publicadorPrivilegios().length > 0">
              <p class="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Privilegios</p>
              <div class="flex flex-wrap gap-2">
                <span *ngFor="let pp of publicadorPrivilegios()"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                  <svg class="w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  {{ getPrivilegioNombre(pp.id_privilegio) }}
                </span>
              </div>
            </div>

          </div>

          <!-- ── Footer ─────────────────────────────────────────────── -->
          <div class="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
            <button (click)="closeQuickView()" class="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              Cerrar
            </button>
            <button *ngIf="canEditPublicadores()" (click)="editFromQuickView()"
              class="px-5 py-2 rounded-xl text-sm font-bold bg-brand-orange hover:bg-orange-600 text-white shadow-sm shadow-orange-500/20 hover:shadow-md hover:shadow-orange-500/30 transition-all active:scale-95 flex items-center gap-2">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
            </button>
          </div>

        </div>
      </div>

       <!-- Delete Modal (Clean) -->
      <!-- Delete Modal (Refined & Clean) -->
      <div *ngIf="deleteModalOpen()" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <!-- Backdrop: Clean dark overlay without blur -->
          <div class="absolute inset-0 bg-slate-900/50 transition-opacity" (click)="closeDeleteModal()"></div>
          
          <!-- Modal Card -->
          <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-[380px] w-full animate-fadeInUp border border-slate-100 dark:border-slate-700">
             
             <!-- Icon Header -->
             <div class="flex items-center gap-4 mb-5">
                <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                    <svg class="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white leading-tight">¿Eliminar miembro?</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Esta acción es irreversible</p>
                </div>
             </div>

             <!-- Content -->
             <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                 Estás a punto de eliminar a <strong class="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-1 rounded">{{ publicadorToDelete()?.primer_nombre }} {{ publicadorToDelete()?.primer_apellido }}</strong>. ¿Deseas continuar?
             </p>

             <!-- Actions -->
             <div class="flex items-center gap-3">
                <button (click)="closeDeleteModal()" [disabled]="isDeleting()" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Cancelar
                </button>
                <button (click)="executeDelete()" [disabled]="isDeleting()" class="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm shadow-md shadow-red-600/20 hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none">
                    <svg *ngIf="isDeleting()" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>{{ isDeleting() ? 'Eliminando...' : 'Eliminar' }}</span>
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
                       <span class="w-1.5 h-1.5 rounded-full bg-brand-orange shadow-[0_0_8px_rgba(249,115,22,0.4)]"></span>
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
                    <h3 class="text-base font-bold text-slate-900 dark:text-white">¿Eliminar privilegio?</h3>
                    <p class="text-[0.6875rem] text-slate-500 font-medium">Se borrará del historial del publicador</p>
                </div>
             </div>

             <!-- Content -->
             <p class="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                 Esta acción eliminará permanentemente este registro del historial. ¿Estás seguro de continuar?
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
  showStartDateModal = signal(false);
  viewingPublicador = signal<Publicador | null>(null);
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

  // ─── Column Manager ──────────────────────────────────────────────────────
  private readonly COL_STORAGE_KEY = 'gac_pub_col_v1';
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
    { id: 'consentimiento_datos', label: 'Consentimiento', visible: false, optional: true },
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
    this.closingPrivilegioFechaFin.set(new Date().toISOString().split('T')[0]);
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
  publicadorPrivilegios = signal<PublicadorPrivilegio[]>([]);
  newPrivilegio = signal<{ id_privilegio: number | null, fecha_inicio: string, fecha_fin: string | null }>({
    id_privilegio: null,
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: null
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
        lastValueFrom(this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/', { params: { limit: 500 } }))
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
    // activos=true → solo registros con fecha_fin IS NULL (el activo actual de cada tipo)
    this.privilegiosService.getPublicadorPrivilegios(id, true).subscribe({
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
      this.deleteModalOpen.set(false);
      this.publicadorToDelete.set(null);
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

  getRoles(p: Publicador): { label: string, type: 'pill' | 'text', class: string }[] {
    const privilegiosIds = this.publicadorPrivilegiosMap().get(p.id_publicador) || [];
    const catalogo = this.privilegios();

    const roleNames = privilegiosIds.map(id => catalogo.find(pr => pr.id_privilegio === id)?.nombre_privilegio?.toLowerCase() || '').filter(Boolean);

    // Sort logic or simple mapping? Let's just collect them all.
    // Order: Precursor R > Precursor A > Anciano > Ministerial > Publicador
    const roles: { label: string, type: 'pill' | 'text', class: string }[] = [];

    if (roleNames.some(r => r.includes('precursor regular'))) {
      roles.push({ label: 'PRECURSOR REGULAR', type: 'pill', class: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' });
    }
    if (roleNames.some(r => r.includes('precursor auxiliar'))) {
      roles.push({ label: 'PRECURSOR AUXILIAR', type: 'pill', class: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' });
    }
    if (roleNames.some(r => r.includes('anciano'))) {
      roles.push({ label: 'ANCIANO', type: 'pill', class: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' });
    }
    if (roleNames.some(r => r.includes('siervo'))) {
      roles.push({ label: 'SIERVO MINISTERIAL', type: 'pill', class: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' });
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

  executeDeletePrivilegio() {
    const id = this.privilegioToDelete();
    if (id !== null) {
      this.deletePublicadorPrivilegio(id);
      this.closeDeletePrivilegioModal();
    }
  }

}

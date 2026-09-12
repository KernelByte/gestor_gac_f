import { Component, signal, computed, inject, OnInit, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { TokenService } from '../../../core/auth/token.service';
import { environment } from '../../../../environments/environment';
import { getInitialAvatarStyle } from '../../../core/utils/avatar-style.util';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { SelectPickerComponent, PickerOption } from '../../../shared/components/select-picker/select-picker.component';
import { CatalogoDiscursosComponent } from './catalogo-discursos.component';
import { CatalogoCanticosComponent } from './catalogo-canticos.component';
import { ReportePrivilegiosDialogComponent } from './reporte-privilegios-dialog.component';
import { inicialesDe, nombreLegal, nombreMostrado } from '../../../core/utils/nombre.util';
import {
  MWBImportPreviewResponse,
  MWBImportConfirmRequest,
  SemanaConfirm,
  PlantillaOption,
  PlantillaDetailResponse,
  PlantillaParteDetail,
  PlantillaUpdateRequest,
  AlgoProfile,
  PublicadorMatrizItem,
  ColumnaPermiso,
  GrupoMatrizOption,
  ReportePrivilegiosOpciones,
  CambioPermisoPublicador,
  UpdateMatrizRequest,
  AusenciaOut,
  SemanaSinReunion,
  AlcanceSemana,
} from '../models/reuniones.models';

@Component({
  selector: 'app-reuniones-configuracion-plantillas',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, SelectPickerComponent, CatalogoDiscursosComponent, CatalogoCanticosComponent, ReportePrivilegiosDialogComponent],
  template: `
    <div class="cfg-root flex flex-col gap-5 h-full">

       <!-- Toast -->
       @if (toast()) {
         <div class="shrink-0 animate-slideDown flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-sm"
              [class]="toast()!.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200/60 dark:border-red-800/50 text-red-700 dark:text-red-300'">
           <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                [class]="toast()!.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'">
             @if (toast()!.type === 'success') {
               <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
             } @else {
               <svg class="w-3.5 h-3.5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             }
           </div>
           <span class="text-xs font-bold">{{ toast()!.message }}</span>
         </div>
       }

       <!-- ===== TAB PILLS + FILTROS (misma línea) ===== -->
       <div class="shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 w-full">
           <!-- Tabs -->
           <div class="flex items-center gap-1 sm:gap-1.5 bg-white dark:bg-[#1a1b26] rounded-2xl p-1.5 shadow-sm border border-slate-200/60 dark:border-slate-800 transition-colors overflow-x-auto max-w-full scrollbar-none">
             @for (tab of visibleTabs(); track tab.id) {
               <button
                 (click)="activeTab.set(tab.id)"
                 class="px-2.5 sm:px-4 h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] whitespace-nowrap shrink-0"
                 [class]="activeTab() === tab.id
                   ? 'bg-brand-purple text-white shadow-md shadow-purple-500/20'
                   : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'">
                 @if (tab.id === 'privilegios') {
                   <span class="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                     <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                   </span>
                 }
                 @if (tab.id === 'ausencias') {
                   <span class="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                     <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                   </span>
                 }
                 @if (tab.id === 'sin-reunion') {
                   <span class="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                     <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="15" x2="15" y2="19"/><line x1="15" y1="15" x2="9" y2="19"/></svg>
                   </span>
                 }
                 @if (tab.id === 'parametros') {
                   <span class="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                     <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                   </span>
                 }
                 @if (tab.id === 'catalogo') {
                  <span class="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                    <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/></svg>
                  </span>
                }
                @if (tab.id === 'plantillas') {
                   <span class="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                     <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                   </span>
                 }
                 <span class="hidden xs:inline sm:inline">{{ tab.label }}</span>
               </button>
             }
           </div>

           <!-- Acciones contextuales (filtros + botones Guardar) -->
           <div class="flex items-center gap-2 flex-wrap justify-start">

            <!-- Perfil del algoritmo (solo indicador de guardado) -->
            @if (activeTab() === 'parametros' && profileSaving()) {
              <div class="flex items-center gap-1.5 text-[0.625rem] font-bold text-[#6D28D9] dark:text-purple-400">
                <div class="w-3 h-3 border-2 border-[#6D28D9] border-t-transparent rounded-full animate-spin"></div>
                Guardando perfil...
              </div>
            }

           <!-- Filtros (solo para tab privilegios) — van ANTES del botón Guardar -->
           @if (activeTab() === 'privilegios') {
               <!-- Search -->
               <div class="relative w-full sm:w-[180px]">
                   <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                   </div>
                   <input type="text"
                     [ngModel]="searchQuery()"
                     (ngModelChange)="searchQuery.set($event); currentPage.set(1)"
                     placeholder="Buscar publicador..."
                     class="priv-search w-full h-9 pl-9 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none shadow-sm">
               </div>
               <!-- Filter Icons sexo -->
               <div class="flex items-center gap-1">
                   <button
                     (click)="setFiltroSexo('solo_hombres')"
                     title="Solo Hermanos"
                     class="h-9 px-2.5 flex items-center gap-1.5 rounded-lg transition-[background-color,border-color,color,transform] duration-150 ease-out border active:scale-[0.97]"
                     [class]="filtroSexo() === 'solo_hombres'
                       ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                       : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 hover:text-blue-500'">
                       <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
                       <span class="hidden sm:inline text-[11px] font-bold">Hermanos</span>
                   </button>
                   <button
                     (click)="setFiltroSexo('solo_mujeres')"
                     title="Solo Hermanas"
                     class="h-9 px-2.5 flex items-center gap-1.5 rounded-lg transition-[background-color,border-color,color,transform] duration-150 ease-out border active:scale-[0.97]"
                     [class]="filtroSexo() === 'solo_mujeres'
                       ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                       : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-rose-300 hover:text-rose-500'">
                       <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M12 21v-8"/><path d="M9 14l3-3 3 3"/></svg>
                       <span class="hidden sm:inline text-[11px] font-bold">Hermanas</span>
                   </button>
               </div>
               <!-- Permission dropdown custom -->
               <div class="relative shrink-0 permiso-dropdown-root">
                 <!-- Trigger -->
                 <button
                   (click)="permisoDropdownOpen.set(!permisoDropdownOpen())"
                   class="h-9 pl-3 pr-2.5 flex items-center gap-2 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap"
                   [class]="filtroPermiso()
                     ? 'border-[#6D28D9] bg-[#6D28D9]/10 dark:bg-[#6D28D9]/20 text-[#6D28D9] dark:text-purple-300 ring-2 ring-[#6D28D9]/20'
                     : 'bg-white dark:bg-[#1a1b26] border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'">
                   <svg class="w-3.5 h-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                   <span>{{ filtroPermiso() ? getColLabel(filtroPermiso()!) : 'Con permiso...' }}</span>
                   <svg class="w-3 h-3 shrink-0 opacity-50 transition-transform" [class.rotate-180]="permisoDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                 </button>
                 <!-- Panel -->
                 @if (permisoDropdownOpen()) {
                   <div class="absolute top-full right-0 mt-1.5 z-50 w-52 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#1a1b26] shadow-xl shadow-black/20 overflow-hidden py-1">
                     <!-- Clear option -->
                     <button
                       (click)="setFiltroPermiso(null)"
                       class="w-full px-3 py-2 flex items-center gap-2.5 text-[11px] font-bold transition-colors text-left"
                       [class]="!filtroPermiso()
                         ? 'bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-300'
                         : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-600 dark:hover:text-slate-500'">
                       <span class="w-4 h-4 rounded flex items-center justify-center shrink-0"
                             [class]="!filtroPermiso() ? 'bg-[#6D28D9]/20' : ''">
                         @if (!filtroPermiso()) {
                           <svg class="w-2.5 h-2.5 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                         }
                       </span>
                       Todos los publicadores
                     </button>
                     <!-- Divider -->
                     <div class="mx-3 my-1 border-t border-slate-100 dark:border-slate-800"></div>
                     <!-- Columns -->
                     @for (col of columnas(); track col.key) {
                       <button
                         (click)="setFiltroPermiso(col.key)"
                         class="w-full px-3 py-1.5 flex items-center gap-2.5 text-[11px] font-semibold transition-colors text-left"
                         [class]="filtroPermiso() === col.key
                           ? 'bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-300'
                           : 'text-slate-600 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/60'">
                         <span class="w-4 h-4 rounded flex items-center justify-center shrink-0"
                               [class]="filtroPermiso() === col.key ? 'bg-[#6D28D9]/20' : ''">
                           @if (filtroPermiso() === col.key) {
                             <svg class="w-2.5 h-2.5 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                           }
                         </span>
                         {{ col.label }}
                       </button>
                     }
                   </div>
                 }
               </div>
               <!-- Clear button -->
               @if (hasMatrizActiveFilters()) {
                 <button (click)="clearMatrizFilters()"
                         class="h-9 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-bold text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition-all border border-transparent whitespace-nowrap">
                   <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                   Limpiar
                 </button>
               }
               <!-- Divisor visual antes de las acciones -->
               <div class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 hidden sm:block"></div>

               <!-- Reporte imprimible de la matriz -->
               <button
                 (click)="abrirReporte()"
                 [disabled]="matrizLoading() || !publicadores().length"
                 title="Generar el reporte imprimible de permisos"
                 class="h-9 px-3 flex items-center gap-1.5 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1b26] text-slate-600 dark:text-slate-300 hover:border-[#6D28D9] hover:text-[#6D28D9] dark:hover:text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed transition-[border-color,color,transform] duration-150 ease-out active:scale-[0.97] whitespace-nowrap">
                 <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
                 <span class="hidden sm:inline">Reporte</span>
               </button>
           }

           <!-- Guardar privilegios — al final, como acción principal -->
           @if (activeTab() === 'privilegios') {
             <button
               *ngIf="hasEditPermission()"
               (click)="guardarMatriz()"
               [disabled]="!matrizHasPending() || matrizSaving()"
               class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.97]">
               @if (matrizSaving()) {
                 <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
               } @else {
                 <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
               }
               Guardar
               @if (matrizHasPending() && !matrizSaving()) {
                 <span class="ml-0.5 px-1.5 py-0.5 rounded-md bg-white/20 text-[0.5625rem] font-black tabular-nums leading-none">{{ matrizPendingCount() }}</span>
               }
             </button>
           }

           <!-- Guardar plantilla (cuando se edita) -->
           @if (activeTab() === 'plantillas' && plantillaEditing()) {
             <button (click)="savePlantillaEdit()" [disabled]="plantillasLoading()" class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.97]">
               @if (plantillasLoading()) {
                 <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
               } @else {
                 <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
               }
               Guardar
             </button>
           }

           </div>
       </div>

       <!-- ===== TAB: PLANTILLAS ===== -->
       @if (activeTab() === 'plantillas') {

       <!-- Selector de guía: dos plantillas globales distintas, cada una con
            su propio histórico y su propio importador de IA. -->
       <div class="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-fit shrink-0">
         <button (click)="setPlantillaTipoActivo('entre_semana')"
                 class="px-3.5 h-8 rounded-lg text-[0.6875rem] font-bold transition-colors duration-150"
                 [class]="plantillaTipoActivo() === 'entre_semana' ? 'bg-[#6D28D9] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
           Entre semana
         </button>
         <button (click)="setPlantillaTipoActivo('fin_semana')"
                 class="px-3.5 h-8 rounded-lg text-[0.6875rem] font-bold transition-colors duration-150"
                 [class]="plantillaTipoActivo() === 'fin_semana' ? 'bg-[#6D28D9] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
           Fin de semana
         </button>
       </div>

       <!-- Toolbar -->
       <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
           <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-[#6D28D9]/10 dark:bg-[#6D28D9]/20 rounded-xl flex items-center justify-center shrink-0">
                 <svg class="w-4.5 h-4.5 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div>
                <h3 class="font-bold text-slate-800 dark:text-white text-[0.8125rem]">Generador de Plantillas <span class="text-[#6D28D9] dark:text-purple-400 font-black">Motor IA</span></h3>
                <p class="text-[0.625rem] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                  {{ plantillaTipoActivo() === 'fin_semana' ? 'Reunión Pública y Estudio de La Atalaya' : 'Vida y Ministerio Cristiano' }}
                </p>
              </div>
           </div>

           <input type="file" #fileInput (change)="onFileSelected($event)" accept=".pdf" class="hidden">

           @if (!mwbLoading()) {
             <div class="flex items-center gap-2 flex-wrap">
               <!-- Selector mes / año -->
               <div class="flex items-center gap-0 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 h-9 overflow-hidden shrink-0">
                 <span class="pl-3 pr-2 text-[9px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500 border-r border-slate-200 dark:border-slate-700 h-full flex items-center shrink-0">Mes</span>
                 <select [ngModel]="mwbTargetMonth()" (ngModelChange)="mwbTargetMonth.set(+$event)" class="h-full text-[0.6875rem] font-bold bg-transparent outline-none px-2 text-slate-700 dark:text-slate-200 cursor-pointer">
                   <option [value]="1">Enero</option><option [value]="2">Febrero</option><option [value]="3">Marzo</option>
                   <option [value]="4">Abril</option><option [value]="5">Mayo</option><option [value]="6">Junio</option>
                   <option [value]="7">Julio</option><option [value]="8">Agosto</option><option [value]="9">Septiembre</option>
                   <option [value]="10">Octubre</option><option [value]="11">Noviembre</option><option [value]="12">Diciembre</option>
                 </select>
                 <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></span>
                 <input type="number" [ngModel]="mwbTargetYear()" (ngModelChange)="mwbTargetYear.set(+$event)"
                        class="w-16 h-full text-[0.6875rem] font-bold bg-transparent outline-none pl-1 pr-3 text-slate-700 dark:text-slate-200 text-center" min="2020" max="2100">
               </div>

               <button *ngIf="hasEditPermission()" (click)="fileInput.click()" [disabled]="mwbConfirming()"
                       class="plt-btn-primary h-9 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[0.6875rem] font-bold rounded-lg shadow-sm flex items-center gap-2 shrink-0">
                 <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                 <span>Subir PDF</span>
               </button>
               <button *ngIf="hasEditPermission()" (click)="mwbJsonInputOpen.set(!mwbJsonInputOpen())"
                       class="plt-btn-secondary h-9 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-500 border border-slate-200 dark:border-slate-600 text-[0.6875rem] font-bold rounded-lg flex items-center gap-2 shrink-0">
                 <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                 <span>JSON</span>
               </button>
             </div>
           }
       </div>

       @if (mwbJsonInputOpen()) {
         <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shrink-0 animate-fadeIn">
           <h4 class="text-xs font-bold text-slate-800 dark:text-white mb-2">Pega aquí el JSON generado</h4>
           <textarea [ngModel]="mwbJsonText()" (ngModelChange)="mwbJsonText.set($event)" rows="6"
                     class="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-500 focus:ring-2 focus:ring-[#6D28D9]/50 outline-none resize-y mb-3 h-40"
                     placeholder='{"mensaje": "OK", "semanas": [{ "titulo_semana": "...", "partes": [] }]}'></textarea>
           <div class="flex items-center gap-2 justify-end">
              <button (click)="mwbJsonInputOpen.set(false)" class="plt-btn-secondary h-8 px-4 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-[0.6875rem] font-bold rounded-lg">Cancelar</button>
              <button (click)="processJsonInput()" class="plt-btn-primary h-8 px-4 bg-[#6D28D9] text-white text-[0.6875rem] font-bold rounded-lg shadow-sm">Procesar JSON</button>
           </div>
         </div>
       }

       <!-- Temas de La Atalaya cargados — separado a propósito del editor de
            la plantilla: el editor de abajo es SIEMPRE la estructura fija
            (lo genérico), y aquí se ve, semana por semana, qué trajo cada
            import de PDF/JSON. Así queda claro si el import realmente
            guardó algo, sin tener que abrir "Editar" y buscarlo mezclado. -->
       @if (plantillaTipoActivo() === 'fin_semana') {
         <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 shrink-0">
           <div class="flex items-center justify-between mb-3">
             <h3 class="text-[0.6875rem] font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
               <svg class="w-3.5 h-3.5 text-[#6D28D9] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               Temas de La Atalaya Cargados
               @if (atalayaTemas().length > 0) {
                 <span class="ml-1 px-1.5 py-0.5 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-400 text-[9px] font-black tabular-nums">{{ atalayaTemas().length }}</span>
               }
             </h3>
             @if (atalayaTemasLoading()) {
               <div class="w-3 h-3 border-2 border-[#6D28D9] border-t-transparent rounded-full animate-spin"></div>
             }
           </div>

           @if (atalayaTemas().length > 0) {
             <!-- max-h + scroll propio: sin tope, una guía con muchas semanas
                  importadas (un año completo son ~52) crecía sin límite y
                  empujaba el panel de Histórico/Editor de abajo fuera de la
                  vista — la tarjeta es shrink-0 dentro de una columna de
                  altura fija, así que lo de abajo era quien pagaba el espacio. -->
             <div class="flex flex-col gap-1.5 max-h-56 overflow-y-auto simple-scrollbar pr-1 -mr-1">
               @for (tema of atalayaTemas(); track tema.id_parte) {
                 <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                   <div class="min-w-0 flex-1">
                     <h4 class="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-200 truncate">{{ tema.titulo_semana }}</h4>
                     @if (tema.fuente_informacion) {
                       <p class="text-[9px] text-slate-400 dark:text-slate-500 truncate">{{ tema.fuente_informacion }}</p>
                     }
                   </div>
                   @if (puedeGestionarGuia()) {
                     <button (click)="eliminarTemaAtalaya(tema)" title="Quitar este tema"
                             class="plt-icon-btn w-8 h-8 flex items-center justify-center text-rose-400/60 rounded-lg shrink-0">
                       <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                     </button>
                   }
                 </div>
               }
             </div>
           } @else if (!atalayaTemasLoading()) {
             <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500 text-center py-3">
               Ningún mes tiene tema cargado todavía. Sube el PDF de La Atalaya arriba para agregarlos.
             </p>
           }
         </div>
       }

       <!-- Split Content Area — en móvil el histórico aparece primero (colapsable), luego el editor -->
       <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">

           <!-- Historical Archive Panel — en móvil va arriba colapsable -->
           <div class="lg:flex-[1] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col lg:min-h-0"
                [class]="historialExpanded() ? 'min-h-0' : 'shrink-0'">
             <button class="plt-history-header px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20 w-full text-left"
                     (click)="toggleHistorial()">
               <h3 class="text-[0.6875rem] font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                 <svg class="w-3.5 h-3.5 text-[#6D28D9] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                 Histórico Guardado
                 @if (savedPlantillas().length > 0) {
                   <span class="ml-1 px-1.5 py-0.5 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-400 text-[9px] font-black tabular-nums">{{ savedPlantillas().length }}</span>
                 }
               </h3>
               <div class="flex items-center gap-2">
                 @if (plantillasLoading()) {
                   <div class="w-3 h-3 border-2 border-[#6D28D9] border-t-transparent rounded-full animate-spin"></div>
                 }
                 <!-- Flecha solo visible en móvil -->
                 <svg class="w-4 h-4 text-slate-400 lg:hidden transition-transform duration-200 ease-out shrink-0"
                      [class.rotate-180]="historialExpanded()"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
               </div>
             </button>

             <div class="overflow-y-auto flex-1 p-3 flex flex-col gap-1.5 simple-scrollbar"
                  [class.hidden]="!historialExpanded()"
                  [class.lg:flex]="true">
               @for (p of savedPlantillas(); track p.id_plantilla) {
                 <div class="plt-hist-item group flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 cursor-default">
                   <!-- Left border accent -->
                   <div class="w-1 self-stretch rounded-full shrink-0"
                        [class]="p.tipo === 'entre_semana' ? 'bg-[#6D28D9]/30' : 'bg-emerald-400/40'"></div>
                   <div class="min-w-0 flex-1">
                     <h4 class="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight" [title]="p.nombre">{{ p.nombre }}</h4>
                     <span class="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider"
                           [class]="p.tipo === 'entre_semana' ? 'bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'">
                       {{ p.tipo === 'entre_semana' ? 'Estudio' : 'Fin de Sem' }}
                     </span>
                   </div>
                   <!-- Solo los roles globales mantienen la guía: es la misma
                        para todas las congregaciones y editarla las alcanza a
                        todas. Ver puedeGestionarGuia. -->
                   @if (puedeGestionarGuia()) {
                     <div class="flex items-center gap-0.5 shrink-0">
                       <button (click)="editPlantilla(p.id_plantilla)"
                               class="plt-icon-btn w-8 h-8 flex items-center justify-center text-[#6D28D9]/60 dark:text-purple-400/60 rounded-lg" title="Editar">
                         <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                       </button>
                       <button (click)="deletePlantilla(p.id_plantilla)"
                               class="plt-icon-btn w-8 h-8 flex items-center justify-center text-rose-400/60 rounded-lg" title="Eliminar">
                         <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                       </button>
                     </div>
                   }
                 </div>
               } @empty {
                 @if (!plantillasLoading()) {
                   <div class="flex-1 flex flex-col items-center justify-center opacity-50 text-center px-4 py-8">
                     <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                       <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                     </div>
                     <p class="text-[0.625rem] font-bold text-slate-500 dark:text-slate-400">Sin plantillas guardadas</p>
                   </div>
                 }
               }
             </div>
           </div>

           <!-- Main Logic Panel (Preview / Editor) -->
           @if (mwbPreview() || (plantillaEditing() && selectedPlantilla())) {
             <div class="lg:flex-[2] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col min-h-0 animate-fadeIn overflow-hidden">
               <!-- Panel header -->
               <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                 <div class="min-w-0">
                   <h3 class="text-[0.8125rem] font-bold text-slate-800 dark:text-white truncate">
                     {{ plantillaEditing() ? 'Modificando Plantilla' : (mwbPreview()?.mensaje || 'Confirmación de Estructura') }}
                   </h3>
                   <p class="text-[0.625rem] font-medium mt-0.5"
                      [class]="plantillaEditing() ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
                     {{ plantillaEditing() ? 'Los cambios afectarán solo a las generaciones futuras.' : 'Verifique y confirme la estructura propuesta por la IA.' }}
                   </p>
                 </div>
                 <div class="flex items-center gap-2 shrink-0 ml-3">
                   @if (plantillaEditing()) {
                    <button (click)="closePlantillaEditor()"
                            class="plt-btn-secondary h-8 px-3 border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[0.6875rem] font-bold rounded-lg flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
                      <span class="hidden sm:inline">Cerrar</span>
                    </button>
                    <button (click)="savePlantillaEdit()" [disabled]="plantillasLoading()"
                            class="plt-btn-primary h-8 px-4 bg-[#6D28D9] text-white text-[0.6875rem] font-bold rounded-lg shadow-sm shadow-purple-500/20 flex items-center gap-1.5">
                      @if (plantillasLoading()) {
                        <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      }
                      Guardar
                    </button>
                  } @else {
                     <button (click)="confirmMWB()" [disabled]="mwbConfirming()"
                             class="plt-btn-primary h-8 px-4 bg-emerald-500 text-white text-[0.6875rem] font-bold rounded-lg shadow-sm shadow-emerald-900/20 flex items-center gap-1.5 disabled:opacity-50">
                       @if (mwbConfirming()) {
                         <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                         <span>Importando...</span>
                       } @else {
                         <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                         <span>Importar Mes</span>
                       }
                     </button>
                   }
                 </div>
               </div>

               <div class="overflow-y-auto min-h-0 space-y-3 p-4 simple-scrollbar">
                 <!-- MWB PREVIEW Mode -->
                 @if (mwbPreview()) {
                   @for (semana of mwbPreview()?.semanas; track $index; let i = $index) {
                     <div class="border border-slate-200 dark:border-slate-700/80 rounded-[14px] overflow-hidden shadow-sm">
                       <div class="bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                         <div class="flex items-center gap-2.5 flex-1 min-w-0">
                           <div class="w-6 h-6 rounded-lg bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-400 flex items-center justify-center font-black text-[0.6rem] shrink-0">W{{ i + 1 }}</div>
                           <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                             <input [(ngModel)]="semana.titulo_semana" class="w-full bg-transparent border-none font-bold text-slate-800 dark:text-white uppercase tracking-wide text-[0.6875rem] outline-none focus:ring-1 focus:ring-[#6D28D9]/50 rounded px-1 min-w-0">
                             @if (semana.lectura_semanal) {
                               <div class="text-[9px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 px-1">
                                 <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                                 Lectura: {{ semana.lectura_semanal }}
                               </div>
                             }
                           </div>
                         </div>
                         <div class="flex items-center gap-1.5 shrink-0">
                           <svg class="w-3.5 h-3.5 text-slate-400 hidden sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                           <input type="date" [ngModel]="mwbDates().get(i) || ''" (ngModelChange)="updateMwbDate(i, $event)"
                                  class="h-7 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[0.625rem] font-medium focus:ring-2 focus:ring-[#6D28D9]/50 outline-none w-[130px]">
                         </div>
                       </div>
                       <div class="bg-white dark:bg-slate-900">
                         <table class="w-full text-left border-collapse">
                           <tbody>
                             @for (parte of semana.partes; track $index) {
                               <tr class="plt-parte-row border-b last:border-b-0 border-slate-100 dark:border-slate-800/50">
                                 <td class="py-2 px-3 w-[100px] sm:w-[130px] align-top pt-2.5">
                                   <span class="text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-none" [style.color]="getSectionColor(parte.seccion)">{{ parte.seccion }}</span>
                                 </td>
                                 <td class="py-2 px-2 align-middle">
                                   <div class="flex flex-col gap-1">
                                     <input [(ngModel)]="parte.nombre_parte" class="text-[0.6875rem] font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none focus:ring-1 focus:ring-[#6D28D9]/40 rounded px-1 w-full">
                                     @if (parte.fuente_informacion) {
                                       <div class="text-[9px] text-slate-400 dark:text-slate-500 italic px-1 truncate">{{ parte.fuente_informacion }}</div>
                                     }
                                     <div class="flex items-center gap-1.5 px-1">
                                       <button (click)="parte.aplica_sala_b = !parte.aplica_sala_b"
                                               class="plt-tag-toggle px-2 py-1 rounded-md text-[8px] font-black uppercase leading-none"
                                               [class]="parte.aplica_sala_b ? 'bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-400 ring-1 ring-[#6D28D9]/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'">Sala B</button>
                                       <button (click)="parte.requiere_pareja = !parte.requiere_pareja"
                                               class="plt-tag-toggle px-2 py-1 rounded-md text-[8px] font-black uppercase leading-none"
                                               [class]="parte.requiere_pareja ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ring-1 ring-amber-500/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'">Pareja</button>
                                     </div>
                                   </div>
                                 </td>
                                 <td class="py-2 px-3 text-right w-16 sm:w-20 align-middle">
                                   <div class="flex items-center justify-end gap-1">
                                     <input type="number" [(ngModel)]="parte.duracion_minutos" class="w-9 h-7 text-center bg-slate-100 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 rounded-lg text-[0.625rem] font-black outline-none border border-transparent focus:ring-1 focus:ring-[#6D28D9]/40 focus:bg-white dark:focus:bg-slate-900 transition-colors">
                                     <span class="text-[8px] font-bold text-slate-400 uppercase">min</span>
                                   </div>
                                 </td>
                               </tr>
                             }
                           </tbody>
                         </table>
                       </div>
                     </div>
                   }
                 }

                 <!-- EDITING Mode -->
                 @if (plantillaEditing() && selectedPlantilla()) {
                   <div class="border border-slate-200 dark:border-slate-700/80 rounded-[14px] overflow-hidden shadow-sm">
                     <div class="bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                       <input [(ngModel)]="selectedPlantilla()!.nombre" placeholder="Nombre Único de Plantilla"
                              class="w-full bg-transparent border-none font-bold text-slate-800 dark:text-white uppercase tracking-wide text-[0.6875rem] outline-none focus:ring-1 focus:ring-[#6D28D9]/50 rounded px-1">
                     </div>
                   </div>

                   @for (week of plantillaByWeek(); track week.ordinal) {
                     <div class="border border-slate-200 dark:border-slate-700/80 rounded-[14px] overflow-hidden shadow-sm">
                       <div class="bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                         <div class="w-6 h-6 rounded-lg bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-400 flex items-center justify-center font-black text-[0.55rem] shrink-0">{{ week.ordinal === 0 ? 'GEN' : ('S' + week.ordinal) }}</div>
                         <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                           @if (week.ordinal === 0) {
                             <span class="text-[0.6875rem] font-bold text-slate-800 dark:text-white uppercase tracking-wide px-1">General — se repite en cada semana</span>
                           } @else {
                             <input [ngModel]="week.titulo_semana || ''" (ngModelChange)="updateSemanaMeta(week.ordinal, 'titulo_semana', $event)"
                                    placeholder="Título de la semana"
                                    class="w-full bg-transparent border-none font-bold text-slate-800 dark:text-white uppercase tracking-wide text-[0.6875rem] outline-none focus:ring-1 focus:ring-[#6D28D9]/50 rounded px-1 min-w-0">
                             <div class="flex items-center gap-1 px-1">
                               <svg class="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                               <span class="text-[9px] font-bold text-slate-400">Lectura:</span>
                               <input [ngModel]="week.lectura_semanal || ''" (ngModelChange)="updateSemanaMeta(week.ordinal, 'lectura_semanal', $event)"
                                      placeholder="—"
                                      class="flex-1 bg-transparent border-none text-[9px] font-bold text-slate-500 dark:text-slate-400 outline-none focus:ring-1 focus:ring-[#6D28D9]/50 rounded px-1 min-w-0">
                             </div>
                           }
                         </div>
                       </div>
                       <div class="bg-white dark:bg-slate-900">
                         <table class="w-full text-left border-collapse">
                           <tbody>
                             @for (parte of week.partes; track $index) {
                               <tr class="plt-parte-row border-b last:border-b-0 border-slate-100 dark:border-slate-800/50">
                                 <td class="py-2 px-3 w-[100px] sm:w-[130px] align-top pt-2.5">
                                   <span class="text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-none" [style.color]="getSectionColor(parte.seccion)">{{ parte.seccion }}</span>
                                 </td>
                                 <td class="py-2 px-2 align-middle">
                                   <div class="flex flex-col gap-1">
                                     <input [(ngModel)]="parte.nombre_parte" class="text-[0.6875rem] font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none focus:ring-1 focus:ring-[#6D28D9]/40 rounded px-1 w-full">
                                     @if (parte.fuente_informacion) {
                                       <div class="text-[9px] text-slate-400 dark:text-slate-500 italic px-1 truncate">{{ parte.fuente_informacion }}</div>
                                     }
                                     <div class="flex items-center gap-1.5 px-1">
                                       <button (click)="parte.aplica_sala_b = !parte.aplica_sala_b"
                                               class="plt-tag-toggle px-2 py-1 rounded-md text-[8px] font-black uppercase leading-none"
                                               [class]="parte.aplica_sala_b ? 'bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-400 ring-1 ring-[#6D28D9]/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'">Sala B</button>
                                       <button (click)="parte.requiere_pareja = !parte.requiere_pareja"
                                               class="plt-tag-toggle px-2 py-1 rounded-md text-[8px] font-black uppercase leading-none"
                                               [class]="parte.requiere_pareja ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ring-1 ring-amber-500/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'">Pareja</button>
                                     </div>
                                   </div>
                                 </td>
                                 <td class="py-2 px-3 text-right w-16 sm:w-20 align-middle">
                                   <div class="flex items-center justify-end gap-1">
                                     <input type="number" [(ngModel)]="parte.duracion_minutos" class="w-9 h-7 text-center bg-slate-100 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 rounded-lg text-[0.625rem] font-black outline-none border border-transparent focus:ring-1 focus:ring-[#6D28D9]/40 focus:bg-white dark:focus:bg-slate-900 transition-colors">
                                     <span class="text-[8px] font-bold text-slate-400 uppercase">min</span>
                                   </div>
                                 </td>
                                 <td class="py-2 pr-2 w-8 align-middle">
                                   <button (click)="removeParte(parte)" title="Quitar parte"
                                           class="plt-icon-btn w-7 h-7 flex items-center justify-center text-rose-400/60 rounded-lg">
                                     <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                   </button>
                                 </td>
                               </tr>
                             }
                           </tbody>
                         </table>
                         <button (click)="addParte(week.ordinal)"
                                 class="w-full flex items-center justify-center gap-1.5 py-2 text-[0.625rem] font-bold text-[#6D28D9]/70 dark:text-purple-400/70 hover:bg-[#6D28D9]/5 dark:hover:bg-purple-400/5 border-t border-slate-100 dark:border-slate-800/50 transition-colors">
                           <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                           Agregar parte
                         </button>
                       </div>
                     </div>
                   }

                   @if (plantillaEditing() && selectedPlantilla()) {
                     <button (click)="addSemana()"
                             class="w-full flex items-center justify-center gap-1.5 h-10 rounded-[14px] border border-dashed border-slate-300 dark:border-slate-700 text-[0.6875rem] font-bold text-slate-500 dark:text-slate-400 hover:border-[#6D28D9]/40 hover:text-[#6D28D9] dark:hover:text-purple-400 transition-colors">
                       <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                       {{ plantillaTipoActivo() === 'fin_semana' ? 'Agregar parte general' : 'Agregar semana' }}
                     </button>
                     @if (plantillaTipoActivo() === 'fin_semana') {
                       <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 text-center px-2 -mt-1">
                         El tema semanal de La Atalaya (título, cántico) se agrega solo, importando el PDF arriba — esto es solo para el resto de la reunión.
                       </p>
                     }
                   }
                 }
               </div>
             </div>
           }

       </div>
       } <!-- end plantillas tab -->

      <!-- ===== MODAL: CONFIRMAR ELIMINAR PLANTILLA ===== -->
      @if (confirmDeleteId() !== null) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="confirmDeleteId.set(null)">
          <div class="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm"></div>
          <div class="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-sm p-6 flex flex-col gap-5 animate-fadeIn" (click)="$event.stopPropagation()">
            <!-- Icon -->
            <div class="flex flex-col items-center gap-3 text-center">
              <div class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/40 flex items-center justify-center">
                <svg class="w-6 h-6 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-900 dark:text-white">Eliminar plantilla</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Esta acción es permanente. Los programas ya creados <span class="font-bold text-slate-700 dark:text-slate-500">no se verán afectados</span>.</p>
              </div>
            </div>
            <!-- Actions -->
            <div class="flex items-center gap-2">
              <button (click)="confirmDeleteId.set(null)" class="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              <button (click)="confirmDelete()" class="flex-1 h-9 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-bold shadow-sm shadow-rose-900/20 transition-all">Sí, eliminar</button>
            </div>
          </div>
        </div>
      }

       <!-- ===== TAB: AUSENCIAS ===== -->
       @if (activeTab() === 'ausencias') {
       <div class="aus-tab flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto simple-scrollbar animate-fadeIn">

         <!-- ── Formulario de registro ──
              Sin overflow-hidden: el calendario del date-picker es un popup
              position:absolute anclado adentro de esta tarjeta: si se recorta
              aquí, se ve "atras y tapado" en vez de flotar sobre la pantalla. -->
         <div class="aus-card shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
           <div class="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
             <div class="flex items-start gap-3">
               <div class="aus-form-icon shrink-0 w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 flex items-center justify-center">
                 <svg class="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9.5" y1="16" x2="14.5" y2="16"/></svg>
               </div>
               <div class="min-w-0">
                 <h3 class="text-sm font-bold text-slate-800 dark:text-white leading-tight">Registrar ausencia</h3>
                 <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                   No se le asignará ningún puesto de Logística en ese rango, aunque tenga el permiso.
                   Si ya estaba asignado, se avisa en la casilla sin quitárselo.
                 </p>
               </div>
             </div>
           </div>

           <div class="p-4 sm:p-5">
             <!-- Móvil y tablet: 2 columnas (Desde/Hasta comparten fila desde el primer momento,
                  Publicador y Motivo ocupan la fila completa). Portátil/escritorio (lg, 1024px+): fila completa.
                  items-start evita que, al abrir un calendario inline en móvil, la celda vecina se
                  estire y quede con un hueco vacío debajo. -->
             <div class="grid grid-cols-2 lg:grid-cols-12 items-start gap-3 sm:gap-4">
               <div class="col-span-2 lg:col-span-4 flex flex-col gap-1.5">
                 <label class="aus-label">Publicador</label>
                 <!-- El <select> nativo lo dibuja el SO y no acepta estilos: se usa
                      el picker propio de la app, que ademas busca al escribir y en
                      tactil se abre como hoja inferior. -->
                 <app-select-picker
                   [ngModel]="ausenciaIdPublicador"
                   (ngModelChange)="ausenciaIdPublicador = $event"
                   [ngModelOptions]="{ standalone: true }"
                   [options]="opcionesPublicadorAusencia()"
                   colorScheme="violet"
                   ariaLabel="Publicador"
                   placeholder="Selecciona un publicador">
                 </app-select-picker>
               </div>

               <div class="lg:col-span-2 flex flex-col gap-1.5">
                 <label class="aus-label">Desde</label>
                 <app-date-picker
                   [(ngModel)]="ausenciaFechaInicio"
                   [ngModelOptions]="{ standalone: true }"
                   colorScheme="violet"
                   [fieldLike]="true"
                   [inlineOnMobile]="true"
                   placeholder="Fecha inicio">
                 </app-date-picker>
               </div>

               <div class="lg:col-span-2 flex flex-col gap-1.5">
                 <label class="aus-label">Hasta</label>
                 <app-date-picker
                   [(ngModel)]="ausenciaFechaFin"
                   [ngModelOptions]="{ standalone: true }"
                   [minDate]="ausenciaFechaInicio"
                   colorScheme="violet"
                   [fieldLike]="true"
                   [inlineOnMobile]="true"
                   placeholder="Fecha fin">
                 </app-date-picker>
               </div>

               <div class="col-span-2 lg:col-span-4 flex flex-col gap-1.5">
                 <label for="aus-motivo" class="aus-label">
                   Motivo <span class="font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">(opcional)</span>
                 </label>
                 <div class="flex items-stretch gap-2">
                   <input
                     id="aus-motivo"
                     type="text"
                     class="form-control aus-field flex-1 min-w-0"
                     [(ngModel)]="ausenciaMotivoForm"
                     [ngModelOptions]="{ standalone: true }"
                     maxlength="200"
                     placeholder="Viaje, salud, estudios...">
                   <button
                     (click)="registrarAusencia()"
                     [disabled]="!puedeRegistrarAusencia() || guardandoAusencia()"
                     aria-label="Registrar ausencia"
                     title="Registrar ausencia"
                     class="aus-submit shrink-0 flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-[#6D28D9] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
                     @if (guardandoAusencia()) {
                       <div class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                     } @else {
                       <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                     }
                   </button>
                 </div>
               </div>
             </div>

             @if (ausenciaError()) {
               <div role="alert" class="aus-error mt-3 flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/50 px-3 py-2.5">
                 <svg class="w-4 h-4 shrink-0 text-rose-500 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                 <p class="text-xs font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">{{ ausenciaError() }}</p>
               </div>
             }
           </div>
         </div>

         <!-- ── Lista de ausencias ── -->
         <!-- shrink-0 en móvil: sin esto, al no caber el formulario + esta tarjeta en la
              altura fija de .aus-tab, flexbox la encogía por debajo de su contenido y el
              overflow-hidden recortaba las filas — la lista "desaparecía" aunque hubiera
              ausencias registradas. Desde sm: vuelve a poder crecer/encogerse para llenar
              el espacio restante con su propio scroll interno. -->
         <div class="aus-card shrink-0 sm:shrink sm:flex-1 sm:min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden flex flex-col">

           @if (!loadingAusencias() && ausencias().length > 0) {
             <!-- Resumen + buscador: en móvil se apilan -->
             <div class="shrink-0 flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800">
               <div class="flex items-center gap-2 flex-wrap min-w-0">
                 <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Registradas</p>
                 <span class="aus-chip aus-chip-neutral">{{ ausencias().length }}</span>
                 @if (ausenciasEnCurso() > 0) {
                   <span class="aus-chip aus-chip-live">
                     <span class="aus-dot"></span>
                     {{ ausenciasEnCurso() }} en curso
                   </span>
                 }
                 @if (ausenciasProximas() > 0) {
                   <span class="aus-chip aus-chip-soon">{{ ausenciasProximas() }} próxima{{ ausenciasProximas() > 1 ? 's' : '' }}</span>
                 }
               </div>

               <div class="relative sm:ml-auto sm:w-56 shrink-0">
                 <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                 <input
                   type="text"
                   [ngModel]="ausenciaFiltro()"
                   (ngModelChange)="ausenciaFiltro.set($event)"
                   [ngModelOptions]="{ standalone: true }"
                   placeholder="Buscar persona o motivo..."
                   aria-label="Buscar ausencias"
                   class="aus-search w-full min-h-[40px] pl-9 pr-3 bg-slate-50 dark:bg-slate-800/50 border border-transparent dark:border-slate-700/50 rounded-xl text-xs text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none">
               </div>
             </div>
           }

           @if (loadingAusencias()) {
             <div class="sm:flex-1 flex flex-col items-center justify-center gap-3 py-14">
               <div class="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-[#6D28D9] animate-spin"></div>
               <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">Cargando ausencias...</p>
             </div>

           } @else if (ausencias().length === 0) {
             <div class="sm:flex-1 flex flex-col items-center justify-center gap-3 py-14 text-center px-6">
               <div class="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex items-center justify-center">
                 <svg class="w-7 h-7 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               </div>
               <div>
                 <p class="text-sm font-bold text-slate-700 dark:text-slate-200">Nadie tiene ausencias registradas</p>
                 <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                   Cuando alguien viaje o no pueda participar por un tiempo, regístralo arriba y el motor dejará de asignarlo en esas fechas.
                 </p>
               </div>
             </div>

           } @else if (ausenciasOrdenadas().length === 0) {
             <div class="sm:flex-1 flex flex-col items-center justify-center gap-2 py-14 text-center px-6">
               <p class="text-sm font-bold text-slate-600 dark:text-slate-300">Sin coincidencias</p>
               <p class="text-xs text-slate-400 dark:text-slate-500">Nadie coincide con "{{ ausenciaFiltro() }}".</p>
               <button (click)="ausenciaFiltro.set('')" class="aus-clear mt-1 px-3 min-h-[36px] rounded-lg text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                 Limpiar búsqueda
               </button>
             </div>

           } @else {
             <div class="sm:flex-1 sm:min-h-0 sm:overflow-y-auto simple-scrollbar divide-y divide-slate-100 dark:divide-slate-800/80">
               @for (a of ausenciasOrdenadas(); track a.id_ausencia; let i = $index) {
                 <div
                   class="aus-row group flex items-center gap-3 px-4 sm:px-5 py-3"
                   [attr.data-estado]="estadoAusencia(a)"
                   [style.--aus-i]="i">

                   <!-- Avatar: mismo lenguaje que la matriz de privilegios -->
                   <div
                     class="aus-avatar shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-[0.7rem] ring-1 ring-white dark:ring-slate-800 border border-white/50"
                     [class]="avatarAusenciaClass(a)"
                     aria-hidden="true">
                     {{ inicialesAusencia(a) }}
                   </div>

                   <div class="min-w-0 flex-1">
                     <div class="flex items-center gap-2 min-w-0">
                       <p class="text-[0.8125rem] sm:text-sm font-bold text-slate-800 dark:text-white truncate">{{ a.nombre_completo }}</p>
                       <span class="aus-state shrink-0" [attr.data-estado]="estadoAusencia(a)">
                         @if (estadoAusencia(a) === 'en_curso') { <span class="aus-dot"></span> }
                         {{ estadoAusenciaLabel(a) }}
                       </span>
                     </div>

                     <p class="text-[0.6875rem] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap leading-tight">
                       <span class="data-num">{{ formatRangoAusencia(a) }}</span>
                       <span class="text-slate-300 dark:text-slate-600" aria-hidden="true">&#183;</span>
                       <span>{{ duracionAusencia(a) }}</span>
                       @if (estadoAusencia(a) !== 'finalizada') {
                         <span class="text-slate-300 dark:text-slate-600" aria-hidden="true">&#183;</span>
                         <span class="font-semibold" [attr.data-estado]="estadoAusencia(a)">{{ estadoAusenciaDetalle(a) }}</span>
                       }
                     </p>

                     @if (a.motivo) {
                       <p class="text-[0.6875rem] sm:text-xs text-slate-400 dark:text-slate-500 mt-1 truncate italic">{{ a.motivo }}</p>
                     }
                   </div>

                   <!-- Siempre visible: en táctil no hay hover que revele acciones -->
                   <button
                     (click)="ausenciaAEliminar.set(a)"
                     [attr.aria-label]="'Eliminar ausencia de ' + a.nombre_completo"
                     title="Eliminar ausencia"
                     class="aus-del shrink-0 w-11 h-11 -mr-1.5 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500">
                     <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                   </button>
                 </div>
               }
             </div>
           }
         </div>
       </div>
       }

      <!-- ===== MODAL: CONFIRMAR ELIMINAR AUSENCIA ===== -->
      @if (ausenciaAEliminar() !== null) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="ausenciaAEliminar.set(null)">
          <div class="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm"></div>
          <div class="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-sm p-6 flex flex-col gap-5 animate-fadeIn" (click)="$event.stopPropagation()">
            <div class="flex flex-col items-center gap-3 text-center">
              <div class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/40 flex items-center justify-center">
                <svg class="w-6 h-6 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-900 dark:text-white">Eliminar ausencia</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  <span class="font-bold text-slate-700 dark:text-slate-300">{{ ausenciaAEliminar()!.nombre_completo }}</span>
                  volverá a estar disponible del {{ formatRangoAusencia(ausenciaAEliminar()!) }}.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button (click)="ausenciaAEliminar.set(null)" class="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              <button (click)="confirmarEliminarAusencia()" class="flex-1 h-9 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-bold shadow-sm shadow-rose-900/20 transition-all">Sí, eliminar</button>
            </div>
          </div>
        </div>
      }

      <!-- ===== TAB: SEMANAS SIN REUNIÓN ===== -->
      @if (activeTab() === 'sin-reunion') {
      <div class="aus-tab flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto simple-scrollbar animate-fadeIn">

        <!-- ── Formulario de registro ──
             Sin overflow-hidden: el calendario del date-picker es un popup
             absolute anclado dentro de esta tarjeta. -->
        <div class="aus-card shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
          <div class="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-start gap-3">
              <div class="aus-form-icon shrink-0 w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center">
                <svg class="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="15" x2="15" y2="19"/><line x1="15" y1="15" x2="9" y2="19"/></svg>
              </div>
              <div class="min-w-0">
                <h3 class="text-sm font-bold text-slate-800 dark:text-white leading-tight">Marcar semana sin reunión</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Para asambleas, congresos o la Conmemoración. No se programará a nadie esa semana,
                  ni en las reuniones ni en la logística.
                  <span class="font-bold text-rose-600 dark:text-rose-400">Se borra lo ya programado de esa semana, incluso lo confirmado</span>,
                  para que esos publicadores queden libres para otras partes.
                </p>
              </div>
            </div>
          </div>

          <div class="p-4 sm:p-5">
            <div class="grid grid-cols-2 lg:grid-cols-12 items-start gap-3 sm:gap-4">
              <div class="col-span-2 lg:col-span-3 flex flex-col gap-1.5">
                <label class="aus-label">Semana</label>
                <app-date-picker
                  [(ngModel)]="ssrFecha"
                  [ngModelOptions]="{ standalone: true }"
                  colorScheme="violet"
                  [fieldLike]="true"
                  [inlineOnMobile]="true"
                  placeholder="Cualquier día de la semana">
                </app-date-picker>
              </div>

              <div class="col-span-2 lg:col-span-3 flex flex-col gap-1.5">
                <label class="aus-label">Se cancela</label>
                <app-select-picker
                  [ngModel]="ssrAlcance"
                  (ngModelChange)="ssrAlcance = $event"
                  [ngModelOptions]="{ standalone: true }"
                  [options]="opcionesAlcanceSemana"
                  colorScheme="violet"
                  ariaLabel="Alcance"
                  placeholder="Selecciona el alcance">
                </app-select-picker>
              </div>

              <div class="col-span-2 lg:col-span-6 flex flex-col gap-1.5">
                <label for="ssr-motivo" class="aus-label">
                  Motivo <span class="font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">(opcional)</span>
                </label>
                <div class="flex items-stretch gap-2">
                  <input
                    id="ssr-motivo"
                    type="text"
                    class="form-control aus-field flex-1 min-w-0"
                    [(ngModel)]="ssrMotivo"
                    [ngModelOptions]="{ standalone: true }"
                    maxlength="200"
                    placeholder="Asamblea de circuito, congreso, Conmemoración...">
                  <button
                    (click)="prepararSemanaSinReunion()"
                    [disabled]="!puedeMarcarSemana() || guardandoSemana()"
                    aria-label="Marcar semana sin reunión"
                    title="Marcar semana sin reunión"
                    class="aus-submit shrink-0 flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-[#6D28D9] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
                    @if (guardandoSemana()) {
                      <div class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    } @else {
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    }
                  </button>
                </div>
              </div>
            </div>

            @if (semanaError()) {
              <div role="alert" class="aus-error mt-3 flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/50 px-3 py-2.5">
                <svg class="w-4 h-4 shrink-0 text-rose-500 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p class="text-xs font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">{{ semanaError() }}</p>
              </div>
            }
          </div>
        </div>

        <!-- ── Lista de semanas marcadas ── -->
        <div class="aus-card shrink-0 sm:shrink sm:flex-1 sm:min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 overflow-hidden flex flex-col">
          @if (loadingSemanas()) {
            <div class="flex items-center justify-center py-16">
              <div class="w-6 h-6 border-2 border-[#6D28D9] border-t-transparent rounded-full animate-spin"></div>
            </div>
          } @else if (semanasSinReunion().length === 0) {
            <div class="flex flex-col items-center justify-center py-14 px-6 text-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-center">
                <svg class="w-6 h-6 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <p class="text-xs font-bold text-slate-500 dark:text-slate-400">No hay semanas marcadas</p>
              <p class="text-[0.7rem] text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                Marca aquí las semanas de asamblea, congreso o Conmemoración para que no se programe a nadie.
              </p>
            </div>
          } @else {
            <div class="shrink-0 flex items-center gap-2 flex-wrap px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Marcadas</p>
              <span class="aus-chip aus-chip-neutral">{{ semanasSinReunion().length }}</span>
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
              @for (s of semanasSinReunion(); track s.id_semana_sin_reunion) {
                <div class="flex items-center gap-3 px-4 sm:px-5 py-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="text-xs font-bold text-slate-800 dark:text-white">{{ formatRangoSemana(s) }}</p>
                      <span class="aus-chip aus-chip-neutral">{{ etiquetaAlcance(s.alcance) }}</span>
                    </div>
                    <p class="text-[0.7rem] text-slate-500 dark:text-slate-400 mt-0.5">
                      Semana {{ s.semana_iso }} de {{ s.ano_iso }}@if (s.motivo) { · {{ s.motivo }} }
                    </p>
                  </div>
                  <button
                    (click)="semanaAEliminar.set(s)"
                    class="btn-icon-delete shrink-0"
                    aria-label="Quitar marca"
                    title="Quitar marca">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>
      }

      <!-- ===== MODAL: CONFIRMAR MARCAR SEMANA (destructivo) ===== -->
      @if (semanaAConfirmar() !== null) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="semanaAConfirmar.set(null)">
          <div class="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm"></div>
          <div class="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-sm p-6 flex flex-col gap-5 animate-fadeIn" (click)="$event.stopPropagation()">
            <div class="flex flex-col items-center gap-3 text-center">
              <div class="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 flex items-center justify-center">
                <svg class="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-900 dark:text-white">Marcar semana sin reunión</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {{ formatRangoSemana(semanaAConfirmar()!) }} —
                  {{ etiquetaAlcance(semanaAConfirmar()!.alcance) }}.
                </p>
                @if ((semanaAConfirmar()!.borradas ?? 0) > 0) {
                  <p class="text-xs mt-2 leading-relaxed font-bold text-rose-600 dark:text-rose-400">
                    Se borrarán {{ semanaAConfirmar()!.borradas }} asignaciones ya hechas, incluidas las confirmadas.
                    Esto no se puede deshacer.
                  </p>
                } @else {
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    No hay nada programado en esa semana todavía.
                  </p>
                }
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button (click)="semanaAConfirmar.set(null)" class="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              <button (click)="confirmarMarcarSemana()" [disabled]="guardandoSemana()" class="flex-1 h-9 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-bold shadow-sm shadow-rose-900/20 transition-all disabled:opacity-50">Sí, marcar</button>
            </div>
          </div>
        </div>
      }

      <!-- ===== MODAL: CONFIRMAR QUITAR MARCA ===== -->
      @if (semanaAEliminar() !== null) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="semanaAEliminar.set(null)">
          <div class="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm"></div>
          <div class="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 w-full max-w-sm p-6 flex flex-col gap-5 animate-fadeIn" (click)="$event.stopPropagation()">
            <div class="flex flex-col items-center gap-3 text-center">
              <div class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/40 flex items-center justify-center">
                <svg class="w-6 h-6 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-900 dark:text-white">Quitar la marca</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {{ formatRangoSemana(semanaAEliminar()!) }} volverá a programarse.
                  Las asignaciones que se borraron no se recuperan: hay que volver a generar.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button (click)="semanaAEliminar.set(null)" class="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              <button (click)="confirmarEliminarSemana()" class="flex-1 h-9 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-bold shadow-sm shadow-rose-900/20 transition-all">Sí, quitar</button>
            </div>
          </div>
        </div>
      }

       <!-- ===== TAB: PARÁMETROS DEL ALGORITMO ===== -->
       @if (activeTab() === 'parametros') {
        <div class="flex-1 min-h-0 flex flex-col gap-5 algo-tab animate-fadeIn overflow-y-auto simple-scrollbar pb-8">
          @if (algoLoading()) {
            <div class="flex items-center justify-center py-16">
              <div class="w-6 h-6 border-2 border-[#6D28D9] border-t-transparent rounded-full animate-spin"></div>
            </div>
          } @else if (algoProfiles().length > 0) {

            <!-- Sección Perfil -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 shrink-0">
              <div class="mb-5">
                <h4 class="text-sm font-black text-slate-800 dark:text-slate-100 mb-0.5">Perfil del Algoritmo</h4>
                <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 leading-relaxed">Selecciona el comportamiento del motor de asignaciones. Estos perfiles ajustan automáticamente los pesos heurísticos y ventanas de tiempo.</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                @for (perfil of algoProfiles(); track perfil.id; let i = $index) {
                  <button
                    (click)="selectProfile(perfil.id)"
                    class="algo-profile-card relative flex flex-col items-start p-4 rounded-xl border-2 text-left overflow-hidden"
                    [class]="activeProfileId() === perfil.id
                      ? 'border-[#6D28D9] bg-gradient-to-br from-[#6D28D9]/[0.06] to-[#6D28D9]/[0.02] dark:from-[#6D28D9]/20 dark:to-[#6D28D9]/5 shadow-md shadow-purple-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'"
                    [style.animation-delay]="(i * 60) + 'ms'"
                  >
                    <!-- Check badge activo -->
                    @if (activeProfileId() === perfil.id) {
                      <div class="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#6D28D9] flex items-center justify-center shadow-sm shadow-purple-500/30">
                        <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    }

                    <!-- Ícono -->
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-200"
                      [class]="activeProfileId() === perfil.id
                        ? 'bg-[#6D28D9] text-white shadow-lg shadow-purple-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'">
                      @if (perfil.id === 'balanceado') {
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      } @else if (perfil.id === 'rotacion') {
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                      } @else {
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      }
                    </div>

                    <h5 class="text-[0.8125rem] font-bold mb-1 transition-colors duration-150"
                      [class]="activeProfileId() === perfil.id
                        ? 'text-[#6D28D9] dark:text-[#a78bfa]'
                        : 'text-slate-800 dark:text-slate-100'">
                      {{ perfil.label }}
                    </h5>
                    <p class="text-[0.625rem] text-slate-500 dark:text-slate-400 leading-relaxed">{{ perfil.description }}</p>
                  </button>
                }
              </div>
            </div>

            <!-- Ajustes adicionales -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden shrink-0">
              <div class="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80">
                <h4 class="text-[0.6875rem] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Ajustes Adicionales</h4>
                <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 mt-0.5">Límites estrictos que aplican independientemente del perfil.</p>
              </div>
              <div class="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
                <div class="flex-1 min-w-0">
                  <div class="text-[0.8125rem] font-bold text-slate-700 dark:text-slate-200">Límite de partes cruzadas</div>
                  <div class="text-[0.625rem] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">Número máximo de partes permitidas para un publicador en la misma semana.</div>
                </div>
                <!-- Stepper +/- -->
                <div class="flex items-center gap-0 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 self-start sm:self-auto">
                  <button (click)="onMaxPartesChange(algoMaxPartesCruzadas() - 1)"
                          [disabled]="algoMaxPartesCruzadas() <= 1"
                          class="algo-stepper-btn w-9 h-9 flex items-center justify-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 disabled:opacity-30 border-r border-slate-200 dark:border-slate-700">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <div class="w-12 h-9 flex items-center justify-center text-base font-black tabular-nums text-slate-800 dark:text-white bg-white dark:bg-slate-900 select-none">
                    {{ algoMaxPartesCruzadas() }}
                  </div>
                  <button (click)="onMaxPartesChange(algoMaxPartesCruzadas() + 1)"
                          [disabled]="algoMaxPartesCruzadas() >= 5"
                          class="algo-stepper-btn w-9 h-9 flex items-center justify-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 disabled:opacity-30 border-l border-slate-200 dark:border-slate-700">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              </div>
            </div>

          }
        </div>
       }

       <!-- ===== TAB: ASIGNACIÓN DE PRIVILEGIOS ===== -->
       @if (activeTab() === 'privilegios') {

       <!-- Matriz Content -->
       <div class="flex-1 min-h-0 flex flex-col gap-4 animate-fadeIn">

           @if (matrizLoading()) {
             <div class="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center">
               <div class="flex flex-col items-center gap-3">
                 <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-[#6D28D9] animate-spin"></div>
                 <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">Cargando publicadores...</p>
               </div>
             </div>
           }

           @if (matrizErrorMsg()) {
             <div class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 flex items-center gap-3">
               <div class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                 <svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
               </div>
               <div class="flex-1 min-w-0">
                 <p class="text-sm font-bold text-red-700 dark:text-red-300">Error al cargar</p>
                 <p class="text-xs text-red-500 dark:text-red-400/80 truncate">{{ matrizErrorMsg() }}</p>
               </div>
               <button (click)="loadMatriz()" class="shrink-0 px-3 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-xs text-red-600 dark:text-red-400 font-bold transition-all">
                 Reintentar
               </button>
             </div>
           }

           @if (!matrizLoading() && !matrizErrorMsg()) {

             <!-- Data Table / Cards -->
             <div class="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">

                 <!-- ── VISTA MÓVIL: acordeón (< md) ── -->
                  <div class="flex md:hidden flex-col overflow-y-auto simple-scrollbar flex-1 min-h-0 gap-y-2 p-2">
                    @for (pub of paginatedPublicadores(); track pub.id_publicador) {
                      <div class="rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700"
                           [class.bg-amber-50/40]="isDirty(pub.id_publicador)"
                           [class.dark:bg-amber-900/10]="isDirty(pub.id_publicador)">
                       <!-- Fila colapsada — siempre visible, toque para expandir -->
                       <div class="px-3 py-3 flex items-center gap-3 cursor-pointer select-none active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors duration-100"
                            (click)="toggleCard(pub.id_publicador)">
                          <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm shadow-sm ring-1 ring-white border border-white/50"
                               [ngClass]="getAvatarClass(pub)">
                            {{ inicialesDe(pub) }}
                          </div>
                         <div class="flex-1 min-w-0">
                           <p class="text-[0.8125rem] font-bold text-slate-800 dark:text-white leading-tight break-words">
                             {{ nombreMostrado(pub) }}
                           </p>
                           <div class="flex flex-wrap gap-1 mt-0.5">
                             @if (pub.privilegios.length > 0) {
                               @for (priv of pub.privilegios; track priv) {
                                 <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none" [class]="privilegioBadgeClass(priv)">{{ privilegioLabel(priv) }}</span>
                               }
                             } @else {
                               <span class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{{ isHermano(pub) ? 'Hermano' : 'Hermana' }}</span>
                             }
                           </div>
                         </div>
                         <!-- Indicador de cambios pendientes -->
                         @if (isDirty(pub.id_publicador)) {
                           <div class="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse"></div>
                         }
                         <!-- Flecha -->
                         <svg class="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ease-out"
                              [class.rotate-180]="isExpanded(pub.id_publicador)"
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                           <polyline points="6 9 12 15 18 9"/>
                         </svg>
                       </div>

                       <!-- Panel expandido -->
                       @if (isExpanded(pub.id_publicador)) {
                         <div class="px-3 pb-3 animate-fadeIn">
                           <!-- Permisos regulares -->
                           <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-3">
                             @for (col of regularColumnas(); track col.key) {
                               <label class="flex items-center gap-2 cursor-pointer" [class.opacity-50]="!hasEditPermission()"
                                      [title]="permisoTooltip(col.key)">
                                 <input type="checkbox"
                                        [checked]="getPermiso(pub, col.key)"
                                        (change)="togglePermiso(pub, col.key)"
                                        [disabled]="!hasEditPermission()"
                                        class="priv-check shrink-0">
                                 <span class="text-[11px] font-semibold leading-snug text-slate-600 dark:text-slate-500">
                                   {{ col.label }}
                                 </span>
                               </label>
                             }
                           </div>
                           <!-- Restricciones (fondo ámbar) -->
                           @if (restriccionColumnas().length > 0) {
                             <div class="rounded-lg bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-700/30 px-3 py-2.5 mb-3">
                               <p class="text-[9px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-wider mb-2">Restricciones</p>
                               <div class="grid grid-cols-1 gap-y-2">
                                 @for (col of restriccionColumnas(); track col.key) {
                                   <label class="flex items-center gap-2 cursor-pointer" [class.opacity-50]="!hasEditPermission()"
                                          [title]="permisoTooltip(col.key)">
                                     <input type="checkbox"
                                            [checked]="getPermiso(pub, col.key)"
                                            (change)="togglePermiso(pub, col.key)"
                                            [disabled]="!hasEditPermission()"
                                            class="priv-check shrink-0">
                                     <span class="text-[11px] font-semibold leading-snug text-amber-700 dark:text-amber-400">
                                       {{ col.label }}
                                     </span>
                                   </label>
                                 }
                               </div>
                             </div>
                           }
                           <!-- Oratoria -->
                           <div class="flex items-center gap-3 pt-1">
                             <span class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">Oratoria</span>
                             <select [ngModel]="getOratoria(pub)"
                                     (ngModelChange)="setOratoria(pub, $event)"
                                     [attr.data-level]="getOratoria(pub)"
                                     [disabled]="!hasEditPermission()"
                                     class="priv-select flex-1 max-w-[180px]"
                                     [class.ring-2]="isOratoriaDirty(pub.id_publicador)"
                                     [class.ring-amber-300]="isOratoriaDirty(pub.id_publicador)">
                               <option [value]="1">Principiante</option>
                               <option [value]="2">Básico</option>
                               <option [value]="3">Intermedio</option>
                               <option [value]="4">Avanzado</option>
                               <option [value]="5">Experto</option>
                             </select>
                           </div>
                         </div>
                       }
                     </div>
                   }
                 </div>

                 <!-- ── VISTA ESCRITORIO: tabla (≥ md) ── -->
                 <div class="priv-scroll hidden md:flex flex-1 min-h-0 overflow-x-auto overflow-y-auto simple-scrollbar">
                     <table class="priv-table w-full min-w-max text-left border-collapse">
                          <thead class="priv-thead sticky top-0 z-30">
                           <tr>
                              <th class="priv-th-publisher is-sticky px-2 py-1.5 sticky left-0 z-40 min-w-[170px] text-left">
                                <span class="text-[9px] font-black text-white uppercase tracking-[0.14em]">Publicador</span>
                              </th>
                              @for (col of regularColumnas(); track col.key) {
                                <th class="priv-th px-0.5 py-1.5 text-center min-w-[40px] border-l border-white/[0.07] cursor-pointer select-none transition-colors hover:bg-white/10"
                                    [class.bg-amber-400]="filtroPermiso() === col.key"
                                    [class.!text-slate-900]="filtroPermiso() === col.key"
                                    [title]="'Filtrar por ' + col.label + (filtroPermiso() === col.key ? ' (activo — clic para quitar)' : '')"
                                    (click)="setFiltroPermiso(filtroPermiso() === col.key ? null : col.key)">
                                  <span class="text-[9px] font-black uppercase tracking-[0.02em] leading-tight whitespace-normal block"
                                        [class]="filtroPermiso() === col.key ? 'text-slate-900' : 'text-white'">
                                    {{ col.label }}
                                    @if (filtroPermiso() === col.key) {
                                      <span class="block text-[8px] mt-0.5 opacity-80">✓ filtrado</span>
                                    }
                                  </span>
                                </th>
                              }
                              @for (col of restriccionColumnas(); track col.key) {
                                <th class="priv-th priv-restrict-header px-0.5 py-1.5 text-center min-w-[46px] border-l border-amber-400/[0.18] cursor-pointer select-none transition-colors hover:bg-amber-400/10"
                                    [class.bg-amber-400]="filtroPermiso() === col.key"
                                    [title]="'Filtrar por ' + col.label + (filtroPermiso() === col.key ? ' (activo — clic para quitar)' : '')"
                                    (click)="setFiltroPermiso(filtroPermiso() === col.key ? null : col.key)">
                                  <div class="inline-flex items-center gap-0.5 justify-center">
                                    <svg class="w-2 h-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                                         [class]="filtroPermiso() === col.key ? 'text-slate-900' : 'text-amber-300'">
                                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                                    </svg>
                                    <span class="text-[9px] font-black uppercase tracking-[0.02em] leading-tight whitespace-normal"
                                          [class]="filtroPermiso() === col.key ? 'text-slate-900' : 'text-amber-200'">
                                      {{ col.label }}
                                      @if (filtroPermiso() === col.key) {
                                        <span class="block text-[8px] mt-0.5 opacity-80">✓ filtrado</span>
                                      }
                                    </span>
                                  </div>
                                </th>
                              }
                              <th class="priv-th priv-th-oratoria px-0.5 py-1.5 text-center min-w-[80px] border-l border-white/[0.07]">
                                <span class="text-[9px] font-black text-white uppercase tracking-[0.02em] leading-tight whitespace-normal block">Oratoria</span>
                              </th>
                           </tr>
                         </thead>
                         <tbody>
                              @for (pub of paginatedPublicadores(); track pub.id_publicador; let idx = $index) {
                                 <tr class="priv-row group border-b border-slate-200 dark:border-slate-800/60 hover:bg-purple-50/40 dark:hover:bg-purple-900/10"
                                    [class.is-dirty]="isDirty(pub.id_publicador)"
                                    [ngClass]="isDirty(pub.id_publicador)
                                      ? 'bg-amber-50/40 dark:bg-amber-900/10'
                                      : (idx % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-800/20' : '')">
                                     <td class="px-2.5 py-1.5 sticky left-0 bg-white dark:bg-slate-900 z-10 group-hover:bg-purple-50/40 dark:group-hover:bg-purple-900/10 transition-colors border-r border-slate-100 dark:border-slate-800/60">
                                        <div class="flex items-center gap-1.5">
                                             <div class="priv-avatar w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-semibold text-[0.625rem] shadow-sm ring-1 ring-white border border-white/50"
                                                  [ngClass]="getAvatarClass(pub)">
                                               {{ inicialesDe(pub) }}
                                             </div>
                                            <div class="min-w-0">
                                                <div class="priv-name text-xs font-bold text-slate-800 dark:text-white leading-tight tracking-tight break-words max-w-[150px]" [title]="nombreMostrado(pub)">
                                          {{ nombreMostrado(pub) }}
                                      </div>
                                      <div class="flex flex-wrap gap-0.5 mt-0.5">
                                          @if (pub.privilegios.length > 0) {
                                            @for (priv of pub.privilegios; track priv) {
                                              <div class="text-[8px] font-bold px-1 py-0.5 inline-block rounded-md leading-none"
                                                   [title]="priv"
                                                   [class]="privilegioBadgeClass(priv)">
                                                {{ privilegioLabel(priv) }}
                                              </div>
                                            }
                                          } @else {
                                            <span class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide">{{ isHermano(pub) ? 'Hermano' : 'Hermana' }}</span>
                                          }
                                      </div>
                                            </div>
                                        </div>
                                    </td>
                                     <td *ngFor="let col of columnas()"
                                         class="priv-cell px-0.5 py-1.5 text-center border-l"
                                         [class]="col.key.startsWith('no_')
                                          ? 'border-amber-200/40 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10'
                                          : 'border-slate-100/70 dark:border-slate-800/40'">
                                          <label class="inline-flex items-center justify-center cursor-pointer p-0.5" [title]="permisoTooltip(col.key)">
                                            <input type="checkbox"
                                              [checked]="getPermiso(pub, col.key)"
                                              (change)="togglePermiso(pub, col.key)"
                                              [disabled]="!hasEditPermission()"
                                              class="priv-check">
                                          </label>
                                    </td>
                                     <td class="px-1 py-1.5 text-center border-l border-slate-100/70 dark:border-slate-800/40">
                                      <select
                                        [ngModel]="getOratoria(pub)"
                                        (ngModelChange)="setOratoria(pub, $event)"
                                        [attr.data-level]="getOratoria(pub)"
                                        [disabled]="!hasEditPermission()"
                                        class="priv-select w-20"
                                        [class.ring-2]="isOratoriaDirty(pub.id_publicador)"
                                        [class.ring-amber-300]="isOratoriaDirty(pub.id_publicador)">
                                        <option [value]="1">Principiante</option>
                                        <option [value]="2">Básico</option>
                                        <option [value]="3">Intermedio</option>
                                        <option [value]="4">Avanzado</option>
                                        <option [value]="5">Experto</option>
                                      </select>
                                    </td>
                               </tr>
                             }
                         </tbody>
                     </table>
                  </div>

                  <!-- Pagination -->
                  <div class="priv-pagination shrink-0 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <span class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium tabular-nums">
                      {{ (currentPage() - 1) * pageSize() + 1 }}–{{ Math.min(currentPage() * pageSize(), filteredPublicadores().length) }}
                      <span class="text-slate-300 dark:text-slate-600">de</span>
                      {{ filteredPublicadores().length }}
                    </span>
                    <div class="flex items-center gap-0.5">
                        <button (click)="prevPage()"
                                [disabled]="currentPage() === 1"
                                class="priv-page-btn w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed text-slate-400 dark:text-slate-500 flex items-center justify-center">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"/></svg>
                        </button>
                        @for (item of getPagesArray(); track $index) {
                          @if (item === null) {
                            <span class="w-7 h-7 flex items-center justify-center text-[0.6875rem] text-slate-300 dark:text-slate-600 select-none">···</span>
                          } @else {
                            <button (click)="setPage(item)"
                                    class="priv-page-btn w-7 h-7 rounded-lg text-xs font-bold"
                                    [class]="currentPage() === item
                                      ? 'bg-[#6D28D9] text-white shadow-sm'
                                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'">
                              {{ item }}
                            </button>
                          }
                        }
                        <button (click)="nextPage()"
                                [disabled]="currentPage() === totalPages()"
                                class="priv-page-btn w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed text-slate-400 dark:text-slate-500 flex items-center justify-center">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/></svg>
                        </button>
                    </div>
                  </div>
              </div>
            }
        </div>
       } <!-- end privilegios tab -->

       @if (activeTab() === 'catalogo') {
         <app-catalogo-discursos />
       } <!-- end catalogo tab -->

       @if (activeTab() === 'catalogo-canticos') {
         <app-catalogo-canticos />
       } <!-- end catalogo-canticos tab -->

       <!-- ===== MODAL: REPORTE DE PERMISOS ===== -->
       @if (reporteAbierto()) {
         <app-reporte-privilegios-dialog
           [publicadores]="publicadores()"
           [columnas]="columnas()"
           [grupos]="grupos()"
           [sexoInicial]="filtroSexo()"
           [privilegioInicial]="filtroPrivilegio()"
           [descargando]="reporteDescargando()"
           (cerrar)="reporteAbierto.set(false)"
           (descargar)="descargarReporte($event)" />
       }

       <!-- ===== MODAL: DUPLICATE DETECTION MWB ===== -->
       @if (mwbShowDuplicateModal()) {
         <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
           <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slideDown">
             <div class="p-6">
               <div class="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4 mx-auto">
                 <svg class="w-6 h-6 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
               </div>

               @if (mwbEnUsoPor().length > 0) {
                 <!-- La guía es global: si alguna congregación ya generó su
                      programación a partir de ella, reimportarla reescribiría
                      las partes de las que cuelga. No se ofrece reemplazar. -->
                 <h3 class="text-lg font-black text-slate-900 dark:text-white text-center tracking-tight">Esta guía está en uso</h3>
                 <p class="text-sm text-slate-500 dark:text-slate-400 text-center mt-2 leading-relaxed px-2">
                   «{{ mwbNombreGuia() }}» ya está importada y hay congregaciones que han generado
                   su programación a partir de ella. No se puede reimportar sin destruir esa
                   programación.
                 </p>

                 <div class="mt-5 space-y-2 max-h-48 overflow-y-auto pr-1 simple-scrollbar">
                   @for (cong of mwbEnUsoPor(); track cong.id_congregacion) {
                     <div class="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                       <p class="text-[0.6875rem] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide truncate">{{ cong.nombre }}</p>
                       <span class="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 uppercase tracking-tighter tabular-nums">{{ cong.programas }} programas</span>
                     </div>
                   }
                 </div>

                 <p class="text-[0.6875rem] text-slate-400 text-center mt-4 leading-relaxed px-2">
                   Cada congregación debe eliminar antes su programación desde «Eliminar guía»,
                   en su pestaña de programación.
                 </p>
               } @else {
                 <h3 class="text-lg font-black text-slate-900 dark:text-white text-center tracking-tight">Esta guía ya está subida</h3>
                 <p class="text-sm text-slate-500 dark:text-slate-400 text-center mt-2 leading-relaxed px-2">
                   «{{ mwbNombreGuia() }}» ya existe, pero ninguna congregación la está usando
                   todavía. Si continúa, sus partes serán <b>reemplazadas</b> por las de esta
                   importación.
                 </p>
               }
             </div>

             <div class="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
               <button (click)="dismissDuplicateModal()"
                       class="flex-1 h-10 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]">
                 {{ mwbEnUsoPor().length > 0 ? 'Entendido' : 'Cancelar' }}
               </button>
               @if (mwbEnUsoPor().length === 0) {
                 <button (click)="acceptDuplicateReplace()"
                         [disabled]="mwbConfirming()"
                         class="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm shadow-amber-900/20 transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.97] flex items-center justify-center gap-2">
                   @if (mwbConfirming()) {
                     <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   }
                   Reemplazar Datos
                 </button>
               }
             </div>
           </div>
         </div>
       }

      <!-- ===== AI LOADING OVERLAY ===== -->
      @if (mwbLoading()) {
        <div class="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-fadeIn">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-md"></div>

          <!-- Card -->
          <div class="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-700/60 w-full max-w-sm p-8 flex flex-col items-center gap-6">

            <!-- AI orb with double ping rings -->
            <div class="relative flex items-center justify-center">
              <div class="absolute w-24 h-24 rounded-full bg-purple-400/10 animate-ping" style="animation-duration:2s"></div>
              <div class="absolute w-16 h-16 rounded-full bg-purple-400/15 animate-ping" style="animation-duration:1.5s;animation-delay:0.3s"></div>
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-[#6D28D9] to-[#a78bfa] flex items-center justify-center shadow-xl shadow-purple-500/40">
                <svg class="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/></svg>
              </div>
            </div>

            <!-- Text content -->
            <div class="text-center flex flex-col gap-2 w-full">
              <p class="text-[0.6875rem] font-black uppercase tracking-widest text-[#6D28D9] dark:text-purple-400">Motor IA activo</p>
              <p class="text-sm font-bold text-slate-800 dark:text-white leading-snug min-h-[2.5rem] flex items-center justify-center text-center px-2">
                {{ mwbProgressMessage() || 'Analizando documento PDF...' }}
              </p>
              <p class="text-[0.625rem] text-slate-400 dark:text-slate-500">Este proceso puede tardar unos momentos</p>
            </div>

            <!-- Percentage -->
            <div class="text-4xl font-black tabular-nums text-[#6D28D9] dark:text-purple-400 leading-none">
              {{ mwbProgress() }}<span class="text-xl font-bold">%</span>
            </div>

            <!-- Progress bar -->
            <div class="w-full flex flex-col gap-1.5">
              <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden relative">
                <div class="bg-gradient-to-r from-[#6D28D9] via-[#8B5CF6] to-[#a78bfa] h-full rounded-full transition-all duration-500 ease-out"
                     [style.width.%]="mwbProgress()"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.8s_ease-in-out_infinite]"></div>
              </div>
              <!-- Animated dots -->
              <div class="flex items-center justify-center gap-1 pt-0.5">
                <span class="w-1.5 h-1.5 rounded-full bg-[#6D28D9]/40 animate-bounce" style="animation-delay:0ms"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#6D28D9]/60 animate-bounce" style="animation-delay:200ms"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#6D28D9] animate-bounce" style="animation-delay:400ms"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#6D28D9]/60 animate-bounce" style="animation-delay:600ms"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-[#6D28D9]/40 animate-bounce" style="animation-delay:800ms"></span>
              </div>
            </div>

          </div>
        </div>
      }

    </div>
  `,
  styles: [`
     :host {
       display: block;
       height: 100%;
       --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
     }
     .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
     .animate-slideDown { animation: slideDown 0.25s ease-out; }
     @keyframes fadeIn {
       from { opacity: 0; transform: translateY(4px); }
       to { opacity: 1; transform: translateY(0); }
     }
     @keyframes slideDown {
       from { opacity: 0; transform: translateY(-8px); }
       to { opacity: 1; transform: translateY(0); }
     }
     @keyframes shimmer {
       0% { transform: translateX(-100%); }
       100% { transform: translateX(200%); }
     }

     /* Sticky column shadow */
     td.sticky, th.sticky { box-shadow: 2px 0 6px -2px rgba(0,0,0,0.06); }

     /* ─────── Privilegios Tab ─────── */

     /* Stats cards */
     .priv-stat {
       transition: box-shadow 200ms var(--ease-out-strong),
                   border-color 160ms ease,
                   transform 160ms var(--ease-out-strong);
     }
     @media (hover: hover) and (pointer: fine) {
       .priv-stat:hover {
         box-shadow: 0 4px 16px -4px rgba(15,23,42,0.10);
         border-color: rgba(109,40,217,0.20);
         transform: translateY(-1px);
       }
     }

     /* Header */
     .priv-thead {
       background: #6d28d9 !important;
       box-shadow: 0 1px 0 rgba(255,255,255,0.12), 0 4px 12px -4px rgba(109,40,217,0.3);
     }
     .priv-thead th { background: transparent !important; }

     /* Sticky publisher column */
     .priv-thead .priv-th-publisher {
       background: #6d28d9 !important;
       z-index: 40 !important;
       box-shadow: inset -1px 0 0 rgba(255,255,255,0.12);
     }

     /* Regular column headers — hover */
     .priv-thead .priv-th {
       transition: background-color 150ms cubic-bezier(0.23, 1, 0.32, 1);
       border-bottom: 1px solid rgba(255,255,255,0.12);
     }
     @media (hover: hover) and (pointer: fine) {
       .priv-thead .priv-th:hover {
         background: rgba(255,255,255,0.08) !important;
       }
     }

     /* Restriction column */
     .priv-thead .priv-restrict-header {
       background: rgba(146, 64, 14, 0.5) !important;
       border-bottom: 1px solid rgba(251,191,36,0.3) !important;
     }
     @media (hover: hover) and (pointer: fine) {
       .priv-thead .priv-restrict-header:hover {
         background: rgba(146, 64, 14, 0.68) !important;
       }
     }

     /* Row with hover accent bar */
     .priv-row { position: relative; transition: background-color 160ms var(--ease-out-strong); }
      .priv-row > td:first-child::before {
        content: '';
        position: absolute;
        left: 0; top: 3px; bottom: 3px;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: #6D28D9;
        transform: scaleY(0);
        transform-origin: center;
        transition: transform 220ms var(--ease-out-strong);
      }
     .priv-row:hover > td:first-child::before { transform: scaleY(1); }
     .priv-row.is-dirty > td:first-child::before { background: #f59e0b; transform: scaleY(1); }

     /* Cell tint when checkbox is checked — guides the eye */
     td.priv-cell { transition: background-color 200ms ease; }
     td.priv-cell:has(.priv-check:checked) {
       background: linear-gradient(180deg, rgba(109,40,217,0.05), rgba(109,40,217,0.10));
     }
     :host-context(.dark) td.priv-cell:has(.priv-check:checked) {
       background: linear-gradient(180deg, rgba(167,139,250,0.10), rgba(167,139,250,0.18));
     }

     /* Custom checkbox */
     .priv-check {
       appearance: none;
       -webkit-appearance: none;
        width: 16px; height: 16px;
        border-radius: 5px;
        border: 1.5px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
        position: relative;
        display: inline-block;
        transition: transform 140ms var(--ease-out-strong),
                    background-color 180ms var(--ease-out-strong),
                    border-color 180ms var(--ease-out-strong),
                    box-shadow 180ms var(--ease-out-strong);
      }
      :host-context(.dark) .priv-check { background: #0f172a; border-color: #475569; }
      @media (hover: hover) and (pointer: fine) {
        .priv-check:hover:not(:disabled) {
          border-color: #6D28D9;
          box-shadow: 0 0 0 3px rgba(109,40,217,0.10);
        }
      }
      .priv-check:active:not(:disabled) { transform: scale(0.9); }
      .priv-check:checked {
        background: linear-gradient(180deg, #7c3aed, #6D28D9);
        border-color: #6D28D9;
        box-shadow: 0 2px 6px -2px rgba(109,40,217,0.45);
      }
      .priv-check:checked::after {
        content: '';
        position: absolute;
        left: 4px; top: 1px;
        width: 4px; height: 9px;
        border-right: 2px solid #fff;
        border-bottom: 2px solid #fff;
        transform: rotate(45deg);
        animation: checkPop 200ms var(--ease-out-strong);
      }
     @keyframes checkPop {
       0% { opacity: 0; transform: rotate(45deg) scale(0.4); }
       60% { opacity: 1; transform: rotate(45deg) scale(1.1); }
       100% { opacity: 1; transform: rotate(45deg) scale(1); }
     }
     .priv-check:disabled { opacity: 0.35; cursor: not-allowed; }

     /* Oratoria select — color-coded levels with custom chevron */
     .priv-select {
       appearance: none;
       -webkit-appearance: none;
        background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 5px center;
        padding-right: 18px !important;
       font-weight: 700;
       transition: border-color 160ms var(--ease-out-strong),
                   box-shadow 160ms var(--ease-out-strong),
                   background-color 160ms ease,
                   color 160ms ease,
                   transform 140ms var(--ease-out-strong);
     }
     .priv-select:active:not(:disabled) { transform: scale(0.96); }
     .priv-select:focus { box-shadow: 0 0 0 4px rgba(109,40,217,0.18); border-color: #6D28D9 !important; outline: none; }
     .priv-select[data-level="1"] { background-color: #f8fafc; color: #475569; border-color: #e2e8f0 !important; }
     .priv-select[data-level="2"] { background-color: #f0f9ff; color: #0369a1; border-color: #bae6fd !important; }
     .priv-select[data-level="3"] { background-color: #eff6ff; color: #1d4ed8; border-color: #bfdbfe !important; }
     .priv-select[data-level="4"] { background-color: #eef2ff; color: #4338ca; border-color: #c7d2fe !important; }
     .priv-select[data-level="5"] { background-color: #faf5ff; color: #6b21a8; border-color: #ddd6fe !important; }
     :host-context(.dark) .priv-select[data-level="1"] { background-color: #1e293b; color: #cbd5e1; border-color: #334155 !important; }
     :host-context(.dark) .priv-select[data-level="2"] { background-color: rgba(2,132,199,0.18); color: #7dd3fc; border-color: rgba(2,132,199,0.4) !important; }
     :host-context(.dark) .priv-select[data-level="3"] { background-color: rgba(37,99,235,0.18); color: #93c5fd; border-color: rgba(37,99,235,0.4) !important; }
     :host-context(.dark) .priv-select[data-level="4"] { background-color: rgba(79,70,229,0.18); color: #a5b4fc; border-color: rgba(79,70,229,0.4) !important; }
     :host-context(.dark) .priv-select[data-level="5"] { background-color: rgba(124,58,237,0.18); color: #c4b5fd; border-color: rgba(124,58,237,0.4) !important; }

     /* Search input refinement */
     .priv-search { transition: border-color 160ms var(--ease-out-strong), box-shadow 160ms var(--ease-out-strong); }
     .priv-search:focus { box-shadow: 0 0 0 4px rgba(109,40,217,0.15); border-color: #6D28D9; }

      /* Pagination button feedback */
     .priv-page-btn { transition: background-color 160ms ease, color 160ms ease, transform 140ms var(--ease-out-strong); }
     .priv-page-btn:active:not(:disabled) { transform: scale(0.92); }

     /* ─────── Plantillas Tab ─────── */

     /* Primary action buttons */
     .plt-btn-primary {
       transition: background-color 160ms cubic-bezier(0.23,1,0.32,1),
                   box-shadow 160ms cubic-bezier(0.23,1,0.32,1),
                   transform 120ms cubic-bezier(0.23,1,0.32,1);
     }
     .plt-btn-primary:active:not(:disabled) { transform: scale(0.97); }

     /* Secondary action buttons */
     .plt-btn-secondary {
       transition: background-color 160ms cubic-bezier(0.23,1,0.32,1),
                   border-color 160ms cubic-bezier(0.23,1,0.32,1),
                   transform 120ms cubic-bezier(0.23,1,0.32,1);
     }
     .plt-btn-secondary:active { transform: scale(0.97); }

     /* Icon buttons in history */
     .plt-icon-btn {
       transition: background-color 140ms cubic-bezier(0.23,1,0.32,1),
                   color 140ms cubic-bezier(0.23,1,0.32,1),
                   transform 120ms cubic-bezier(0.23,1,0.32,1);
     }
     @media (hover: hover) and (pointer: fine) {
       .plt-icon-btn:hover { background-color: rgba(109,40,217,0.08); color: #6D28D9; }
       .plt-icon-btn[title="Eliminar"]:hover { background-color: rgba(244,63,94,0.08); color: #f43f5e; }
     }
     .plt-icon-btn:active { transform: scale(0.88); }

     /* Tag toggles (Sala B / Pareja) */
     .plt-tag-toggle {
       transition: background-color 140ms cubic-bezier(0.23,1,0.32,1),
                   color 140ms cubic-bezier(0.23,1,0.32,1),
                   box-shadow 140ms cubic-bezier(0.23,1,0.32,1),
                   transform 120ms cubic-bezier(0.23,1,0.32,1);
     }
     .plt-tag-toggle:active { transform: scale(0.93); }

     /* Part row hover */
     .plt-parte-row {
       transition: background-color 140ms cubic-bezier(0.23,1,0.32,1);
     }
     @media (hover: hover) and (pointer: fine) {
       .plt-parte-row:hover { background-color: rgba(109,40,217,0.025); }
       :host-context(.dark) .plt-parte-row:hover { background-color: rgba(167,139,250,0.06); }
     }

     /* History item */
     .plt-hist-item {
       transition: border-color 160ms cubic-bezier(0.23,1,0.32,1),
                   box-shadow 160ms cubic-bezier(0.23,1,0.32,1),
                   background-color 160ms cubic-bezier(0.23,1,0.32,1);
     }
     @media (hover: hover) and (pointer: fine) {
       .plt-hist-item:hover { border-color: #e2e8f0; box-shadow: 0 2px 8px -2px rgba(15,23,42,0.08); }
       :host-context(.dark) .plt-hist-item:hover { border-color: #334155; }
     }

     /* History header button (mobile toggle) */
     .plt-history-header {
       transition: background-color 140ms cubic-bezier(0.23,1,0.32,1);
     }
     @media (hover: hover) and (pointer: fine) {
       .plt-history-header:hover { background-color: rgba(109,40,217,0.03); }
     }

     /* ─────── Parámetros Tab ─────── */

     /* Profile cards stagger entry */
     .algo-tab .algo-profile-card {
       opacity: 0;
       transform: translateY(6px);
       animation: algo-card-in 260ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
     }
     @keyframes algo-card-in {
       to { opacity: 1; transform: translateY(0); }
     }

     /* Hover only on pointer devices */
     @media (hover: hover) and (pointer: fine) {
       .algo-profile-card:hover {
         border-color: #c4b5fd !important;
         box-shadow: 0 4px 16px -4px rgba(109,40,217,0.12);
       }
     }

     /* Press feedback */
     .algo-profile-card:active {
       transform: scale(0.98);
       transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
     }

     /* Stepper buttons */
     .algo-stepper-btn {
       transition: background-color 140ms cubic-bezier(0.23, 1, 0.32, 1),
                   transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
     }
     @media (hover: hover) and (pointer: fine) {
       .algo-stepper-btn:not(:disabled):hover { background-color: #ede9fe; color: #6D28D9; }
       :host-context(.dark) .algo-stepper-btn:not(:disabled):hover { background-color: rgba(109,40,217,0.20); color: #a78bfa; }
     }
     .algo-stepper-btn:not(:disabled):active { transform: scale(0.88); }

     /* ─────── Adaptación a portátiles (MacBook Pro 14" / 16") ─────── */

     /* El scroll de la matriz no arrastra la página al llegar al borde */
     .priv-scroll { overscroll-behavior: contain; }

     /* Nivel de oratoria legible completo ("Intermedio", "Principiante") en
        vez de truncado: hay sitio de sobra en cualquier portátil. */
     @media (min-width: 1200px) {
       .priv-table .priv-select {
         width: 96px;
         font-size: 11px;
         padding-right: 16px !important;
       }
     }

     /* MacBook Pro 14" (1512 CSS px) — con el sidebar abierto quedan ~1148 px
        útiles y la matriz se salía 117 px: se compactan cabeceras, columna de
        publicador y selector de oratoria para que entre completa sin scroll
        horizontal. Por encima de 1600 px (MBP 16" = 1728) ya cabía sola. */
     @media (min-width: 1200px) and (max-width: 1600px) {
       .priv-table thead th:not(.priv-th-publisher) span {
         font-size: 8px;
         letter-spacing: 0;
         overflow-wrap: break-word;
       }
       .priv-table thead th.priv-th { max-width: 76px; }
       .priv-table thead th.priv-restrict-header { min-width: 0; max-width: 62px; }
       .priv-table thead th.priv-th-publisher { min-width: 140px; }
       .priv-table .priv-name { max-width: 104px; }
       .priv-table .priv-select {
         width: 84px;
         font-size: 10px;
         padding-left: 5px;
         padding-right: 14px !important;
         background-position: right 3px center;
       }
     }

     /* Alturas de portátil (14" ≈ 860 px, 16" ≈ 990 px de viewport): densidad
        más alta para ver ~19–23 filas sin sacrificar legibilidad. */
     @media (min-width: 1024px) and (max-height: 1000px) {
       .cfg-root { gap: 0.75rem; }
       .priv-table tbody td { padding-top: 3px; padding-bottom: 3px; }
       .priv-table .priv-avatar { width: 26px; height: 26px; }
       .priv-table .priv-name { font-size: 11.5px; }
     }

     /* Degradado que indica que la tabla continúa bajo la barra de paginación */
     @media (min-width: 1200px) {
       .priv-pagination { position: relative; }
       .priv-pagination::before {
         content: '';
         position: absolute;
         left: 0; right: 0; bottom: 100%;
         height: 18px;
         background: linear-gradient(to top, rgba(255,255,255,0.92), rgba(255,255,255,0));
         pointer-events: none;
       }
       :host-context(.dark) .priv-pagination::before {
         background: linear-gradient(to top, rgba(15,23,42,0.92), rgba(15,23,42,0));
       }
     }

     /* ─────── Ausencias Tab ─────── */

     .aus-card {
       box-shadow: var(--shadow-soft);
     }

     .aus-label {
       font-size: 0.7rem;
       font-weight: 700;
       letter-spacing: 0.04em;
       text-transform: uppercase;
       color: rgb(100 116 139);
     }
     :host-context(.dark) .aus-label { color: rgb(148 163 184); }

     /* Los campos heredan .form-control/.form-select globales; aquí solo se
        ajusta el alto para que cumplan el mínimo táctil de 44px. */
     .aus-field { min-height: 44px; padding-top: 0.5rem; padding-bottom: 0.5rem; }

     .aus-search {
       transition: background-color 160ms var(--ease-out-strong),
                   border-color 160ms var(--ease-out-strong),
                   box-shadow 160ms var(--ease-out-strong);
     }
     .aus-search:focus {
       background: #fff;
       border-color: rgba(109,40,217,0.45);
       box-shadow: 0 0 0 3px rgba(109,40,217,0.12);
     }
     :host-context(.dark) .aus-search:focus {
       background: rgb(15 23 42);
       border-color: rgba(139,92,246,0.5);
       box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
     }

     /* Botón primario: feedback de pulsación inmediato */
     .aus-submit {
       transition: background-color 160ms var(--ease-out-strong),
                   transform 140ms var(--ease-out-strong),
                   box-shadow 160ms var(--ease-out-strong);
     }
     @media (hover: hover) and (pointer: fine) {
       .aus-submit:not(:disabled):hover { background: #5b21b6; }
     }
     .aus-submit:not(:disabled):active { transform: scale(0.97); }

     .aus-clear { transition: background-color 150ms var(--ease-out-strong), transform 140ms var(--ease-out-strong); }
     .aus-clear:active { transform: scale(0.97); }

     .aus-error { animation: ausIn 220ms var(--ease-out-strong) both; }

     /* ── Chips de resumen ── */
     .aus-chip {
       display: inline-flex; align-items: center; gap: 0.3rem;
       height: 1.35rem; padding: 0 0.5rem;
       border-radius: 9999px;
       font-size: 0.625rem; font-weight: 800;
       letter-spacing: 0.02em;
       white-space: nowrap;
     }
     .aus-chip-neutral {
       background: rgb(241 245 249); color: rgb(71 85 105);
       font-variant-numeric: tabular-nums;
     }
     .aus-chip-live { background: rgb(209 250 229); color: rgb(4 120 87); }
     .aus-chip-soon { background: rgb(254 243 199); color: rgb(146 64 14); }
     :host-context(.dark) .aus-chip-neutral { background: rgb(30 41 59); color: rgb(148 163 184); }
     :host-context(.dark) .aus-chip-live { background: rgba(16,185,129,0.15); color: rgb(110 231 183); }
     :host-context(.dark) .aus-chip-soon { background: rgba(245,158,11,0.15); color: rgb(252 211 77); }

     /* ── Etiqueta de estado por fila ── */
     .aus-state {
       display: inline-flex; align-items: center; gap: 0.3rem;
       height: 1.15rem; padding: 0 0.45rem;
       border-radius: 9999px;
       font-size: 0.5625rem; font-weight: 800;
       text-transform: uppercase; letter-spacing: 0.05em;
       white-space: nowrap;
     }
     .aus-state[data-estado="en_curso"]   { background: rgb(209 250 229); color: rgb(4 120 87); }
     .aus-state[data-estado="proxima"]    { background: rgb(254 243 199); color: rgb(146 64 14); }
     .aus-state[data-estado="finalizada"] { background: rgb(241 245 249); color: rgb(100 116 139); }
     :host-context(.dark) .aus-state[data-estado="en_curso"]   { background: rgba(16,185,129,0.15); color: rgb(110 231 183); }
     :host-context(.dark) .aus-state[data-estado="proxima"]    { background: rgba(245,158,11,0.15); color: rgb(252 211 77); }
     :host-context(.dark) .aus-state[data-estado="finalizada"] { background: rgb(30 41 59); color: rgb(148 163 184); }

     /* Texto de apoyo coloreado igual que su estado */
     [data-estado="en_curso"].font-semibold { color: rgb(5 150 105); }
     [data-estado="proxima"].font-semibold  { color: rgb(180 83 9); }
     :host-context(.dark) [data-estado="en_curso"].font-semibold { color: rgb(52 211 153); }
     :host-context(.dark) [data-estado="proxima"].font-semibold  { color: rgb(251 191 36); }

     /* Punto latente: solo para "en curso", que es lo único que pasa ahora */
     .aus-dot {
       width: 5px; height: 5px; border-radius: 9999px;
       background: currentColor; flex: none;
       animation: ausPulse 2s ease-in-out infinite;
     }

     /* ── Filas ── */
     .aus-row {
       position: relative;
       transition: background-color 160ms var(--ease-out-strong);
       animation: ausIn 260ms var(--ease-out-strong) both;
       /* Escalonado corto y tope bajo: una lista larga no debe hacerse esperar */
       animation-delay: calc(min(var(--aus-i, 0), 8) * 40ms);
     }
     @media (hover: hover) and (pointer: fine) {
       .aus-row:hover { background: rgb(248 250 252); }
       :host-context(.dark) .aus-row:hover { background: rgba(30,41,59,0.45); }
     }

     /* Filete de color a la izquierda según estado: da a la lista un ritmo
        legible de un vistazo sin recuadrar cada fila. */
     .aus-row::before {
       content: '';
       position: absolute; left: 0; top: 0; bottom: 0;
       width: 3px;
       background: transparent;
       transition: background-color 180ms var(--ease-out-strong);
     }
     .aus-row[data-estado="en_curso"]::before { background: rgb(16 185 129); }
     .aus-row[data-estado="proxima"]::before  { background: rgb(251 191 36); }

     /* Lo ya finalizado pierde peso visual, sin desaparecer */
     .aus-row[data-estado="finalizada"] .aus-avatar { opacity: 0.55; }

     .aus-avatar { transition: opacity 160ms var(--ease-out-strong); }

     /* Botón eliminar: 44px reales de área táctil */
     .aus-del {
       transition: color 150ms var(--ease-out-strong),
                   background-color 150ms var(--ease-out-strong),
                   transform 140ms var(--ease-out-strong);
     }
     @media (hover: hover) and (pointer: fine) {
       .aus-del:hover { color: rgb(244 63 94); background: rgb(255 241 242); }
       :host-context(.dark) .aus-del:hover { color: rgb(251 113 133); background: rgba(159,18,57,0.22); }
     }
     .aus-del:active { transform: scale(0.92); }
     .aus-del:focus-visible {
       outline: 2px solid rgba(109,40,217,0.5);
       outline-offset: 2px;
     }

     @keyframes ausIn {
       from { opacity: 0; transform: translateY(6px); }
       to   { opacity: 1; transform: translateY(0); }
     }
     @keyframes ausPulse {
       0%, 100% { opacity: 1; }
       50%      { opacity: 0.35; }
     }

     /* En pantallas chicas el formulario gana aire y la fila se compacta */
     @media (max-width: 640px) {
       .aus-row { padding-top: 0.875rem; padding-bottom: 0.875rem; }
     }

     @media (prefers-reduced-motion: reduce) {
       .priv-stat, .priv-row, .priv-check, .priv-select, .priv-avatar, .priv-page-btn,
       .priv-row > td:first-child::before,
       .algo-profile-card, .algo-stepper-btn,
       .aus-row, .aus-row::before, .aus-del, .aus-submit, .aus-search, .aus-avatar,
       .aus-clear, .aus-error, .aus-dot { transition: none !important; animation: none !important; }
     }
  `]
})
export class ReunionesConfiguracionPlantillasComponent implements OnInit {
  /** Expuestos a la plantilla: las funciones sueltas no son accesibles desde el HTML. */
  readonly nombreMostrado = nombreMostrado;
  readonly inicialesDe = inicialesDe;


  private reunionesSvc = inject(ReunionesService);
  private congregacionCtx = inject(CongregacionContextService);

  /**
   * Si el usuario puede subir, editar o borrar la guía de actividades.
   *
   * La guía es global: la misma para todas las congregaciones, y editarla baja
   * el cambio a la programación de todas. Por eso la mantienen solo los roles
   * globales, y no quien tiene 'reuniones.configuracion' de una congregación.
   * El backend lo exige igual (requiere_guia_global); esto es para que la
   * pantalla no ofrezca botones que van a devolver 403.
   */
  puedeGestionarGuia = computed(() => this.congregacionCtx.isAdmin());
  private authStore = inject(AuthStore);
  private tokenSvc = inject(TokenService);
  private route = inject(ActivatedRoute);

  hasEditPermission = computed(() => {
    return this.authStore.hasPermission('reuniones.configuracion');
  });

  // ── Tabs — visibles para cualquiera con reuniones.configuracion ──
  private allTabs = [
    { id: 'privilegios', label: 'Asignación de Privilegios' },
    { id: 'ausencias', label: 'Ausencias' },
    { id: 'sin-reunion', label: 'Semanas sin reunión' },
    { id: 'parametros', label: 'Parámetros del Algoritmo' },
    { id: 'plantillas', label: 'Plantillas de Reunión' },
    { id: 'catalogo', label: 'Catálogo de Discursos' },
    { id: 'catalogo-canticos', label: 'Catálogo de Cánticos' }
  ];

  puedeGestionarPlantillas = computed(() => {
    const roles = this.authStore.user()?.roles ?? [];
    return roles.includes('Administrador') || roles.includes('Gestor Aplicación');
  });

  visibleTabs = computed(() => {
    return this.puedeGestionarPlantillas()
      ? this.allTabs
      : this.allTabs.filter(t => t.id !== 'plantillas' && t.id !== 'parametros' && t.id !== 'catalogo' && t.id !== 'catalogo-canticos');
  });

  activeTab = signal('privilegios');

  // ── Algorithm Profiles ──
  algoProfiles = signal<AlgoProfile[]>([]);
  activeProfileId = signal<string>('balanceado');
  algoMaxPartesCruzadas = signal<number>(2);
  algoLoading = signal(false);
  profileSaving = signal(false);
  private algoLoaded = false;
  protected readonly Math = Math;

  // ── Toast ──
  toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── MWB State ──
  mwbLoading = signal(false);
  mwbConfirming = signal(false);
  mwbPreview = signal<MWBImportPreviewResponse | null>(null);
  mwbDates = signal<Map<number, string>>(new Map());
  mwbProgress = signal(0);
  mwbProgressMessage = signal('');
  mwbJsonInputOpen = signal(false);
  mwbJsonText = signal('');
  mwbTargetYear = signal<number>(new Date().getFullYear());
  mwbTargetMonth = signal<number>(new Date().getMonth() + 1);

  // ── MWB Duplicate Detection ──
  /** Nombre de la guía que ya existe con el mismo periodo. */
  mwbNombreGuia = signal('');
  /** Congregaciones con programación generada a partir de esa guía. Si trae
   *  algo, reimportar está bloqueado: la guía es global y reescribir sus
   *  partes rompería la programación de todas ellas. */
  mwbEnUsoPor = signal<Array<{ id_congregacion: number; nombre: string; programas: number }>>([]);
  mwbShowDuplicateModal = signal(false);
  private mwbPendingPayload: any = null;

  // ── Plantillas Histórico ──
  /** Qué guía se administra en este tab: MWB (entre semana) o La Atalaya (fin
   *  de semana). Decide tanto qué trae el histórico como qué endpoint de
   *  importación con IA se usa — son dos guías distintas, cada una global. */
  plantillaTipoActivo = signal<'entre_semana' | 'fin_semana'>('entre_semana');
  savedPlantillas = signal<PlantillaOption[]>([]);
  plantillasLoading = signal(false);
  selectedPlantilla = signal<PlantillaDetailResponse | null>(null);
  plantillaEditing = signal(false);
  confirmDeleteId = signal<number | null>(null);
  plantillaByWeek = computed(() => {
    const p = this.selectedPlantilla();
    if (!p) return [];
    const weeksMap = new Map<number, { partes: PlantillaParteDetail[]; titulo_semana?: string; lectura_semanal?: string }>();
    p.partes.forEach(parte => {
      // 0 es el grupo "General": partes sin semana propia (sin
      // titulo_semana) que se repiten en cada programa generado, a
      // diferencia de una semana real importada de La Atalaya (ordinal =
      // su semana ISO, siempre >= 1).
      const ord = parte.semana_ordinal ?? 0;
      if (!weeksMap.has(ord)) {
        weeksMap.set(ord, {
          partes: [],
          titulo_semana: parte.titulo_semana,
          lectura_semanal: parte.lectura_semanal,
        });
      }
      weeksMap.get(ord)!.partes.push(parte);
    });
    let groups = Array.from(weeksMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ordinal, data]) => ({ ordinal, ...data }));
    // El editor de fin de semana solo muestra lo genérico ("General", ordinal
    // 0): los temas de La Atalaya por semana se ven y se borran aparte, en la
    // tarjeta "Temas de La Atalaya Cargados" — mezclarlos aquí es lo que
    // hacía parecer que un import "no se veía".
    if (this.plantillaTipoActivo() === 'fin_semana') {
      groups = groups.filter(g => g.ordinal === 0);
    }
    return groups;
  });

  // ── Temas de La Atalaya (fin de semana) ──
  /** Los temas ya cargados sobre la plantilla de fin de semana, mostrados
   *  aparte del editor genérico para que se vea claramente qué trajo cada
   *  import — independiente de si el editor está abierto o no. */
  atalayaTemas = signal<PlantillaParteDetail[]>([]);
  atalayaTemasLoading = signal(false);
  private atalayaPlantillaId: number | null = null;

  /** Autosuficiente a propósito: busca la plantilla de fin de semana por su
   *  cuenta en vez de depender de `savedPlantillas()` ya estar en sync (esa
   *  dependencia era lo que dejaba la tarjeta vacía hasta refrescar la
   *  página a mano después de confirmar un import). Se puede llamar desde
   *  cualquier lado sin preocuparse del orden de otras cargas. */
  loadAtalayaTemas() {
    const idCongregacion = this.congregacionCtx.effectiveCongregacionId();

    this.atalayaTemasLoading.set(true);
    this.reunionesSvc.getPlantillas('fin_semana', idCongregacion).subscribe({
      next: (plantillas) => {
        const plantillaFinSemana = plantillas[0];
        if (!plantillaFinSemana) {
          this.atalayaTemas.set([]);
          this.atalayaPlantillaId = null;
          this.atalayaTemasLoading.set(false);
          return;
        }
        this.atalayaPlantillaId = plantillaFinSemana.id_plantilla;
        this.reunionesSvc.getPlantillaDetail(plantillaFinSemana.id_plantilla).subscribe({
          next: (res) => {
            this.atalayaTemas.set(
              res.partes
                .filter(p => !!p.titulo_semana)
                .sort((a, b) => (a.semana_ordinal ?? 0) - (b.semana_ordinal ?? 0))
            );
            this.atalayaTemasLoading.set(false);
          },
          error: (err) => {
            console.error(err);
            this.atalayaTemasLoading.set(false);
          }
        });
      },
      error: (err) => {
        console.error(err);
        this.atalayaTemasLoading.set(false);
      }
    });
  }

  eliminarTemaAtalaya(tema: PlantillaParteDetail) {
    if (!this.atalayaPlantillaId || tema.semana_ordinal == null) return;
    this.reunionesSvc.eliminarTemaAtalaya(this.atalayaPlantillaId, tema.semana_ordinal).subscribe({
      next: () => {
        this.showToast('success', 'Tema eliminado');
        this.loadAtalayaTemas();
      },
      error: (err) => {
        console.error(err);
        this.showToast('error', err?.error?.detail ?? 'Error al eliminar el tema');
      }
    });
  }

  // ── Matriz de Publicadores (Privilegios) ──
  publicadores = signal<PublicadorMatrizItem[]>([]);
  columnas = signal<ColumnaPermiso[]>([]);
  grupos = signal<GrupoMatrizOption[]>([]);
  regularColumnas = computed(() => this.columnas().filter(c => !c.key.startsWith('no_')));
  restriccionColumnas = computed(() => this.columnas().filter(c => c.key.startsWith('no_')));

  /** El nombre largo lo manda el backend junto con la columna: era el mismo
   *  mapa copiado a mano en los dos lados. */
  permisoTooltip(key: string): string {
    const col = this.columnas().find(c => c.key === key);
    return col?.nombre_largo || col?.label || key.replace(/_/g, ' ');
  }
  matrizLoading = signal(false);
  matrizSaving = signal(false);
  matrizErrorMsg = signal<string | null>(null);
  searchQuery = signal('');
  filtroSexo = signal<'todos' | 'solo_hombres' | 'solo_mujeres'>('todos');
  filtroPrivilegio = signal<string | null>(null);
  filtroPermiso = signal<string | null>(null);
  permisoDropdownOpen = signal(false);
  currentPage = signal(1);

  readonly privilegioOptions = [
    { key: 'Anciano', label: 'Anciano', color: 'amber' },
    { key: 'Siervo Ministerial', label: 'S. Ministerial', color: 'blue' },
    { key: 'Precursor Regular', label: 'P. Regular', color: 'emerald' },
    { key: 'Precursor Especial', label: 'P. Especial', color: 'emerald' },
    { key: 'Precursor Auxiliar', label: 'P. Auxiliar', color: 'teal' },
    { key: 'Publicador', label: 'Publicador', color: 'slate' },
  ];
  pageSize = signal(50);
  private dirtyMap = new Map<number, Record<string, boolean>>();
  private dirtyOratoriaMap = new Map<number, number>();
  matrizPendingCount = signal(0);
  historialExpanded = signal(true);
  toggleHistorial() { this.historialExpanded.update(v => !v); }

  expandedCards = signal<Set<number>>(new Set());

  toggleCard(id: number) {
    this.expandedCards.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isExpanded(id: number): boolean {
    return this.expandedCards().has(id);
  }

  filteredPublicadores = computed(() => {
    let list = this.publicadores();
    const q = this.searchQuery().toLowerCase().trim();
    const sexoFilter = this.filtroSexo();
    const privFilter = this.filtroPrivilegio();
    const permisoFilter = this.filtroPermiso();
    if (q) {
      list = list.filter(p => (nombreMostrado(p) + ' ' + nombreLegal(p)).toLowerCase().includes(q));
    }
    if (sexoFilter === 'solo_hombres') {
      list = list.filter(p => this.isHermano(p));
    } else if (sexoFilter === 'solo_mujeres') {
      list = list.filter(p => !this.isHermano(p));
    }
    if (privFilter) {
      list = list.filter(p => p.privilegios.includes(privFilter));
    }
    if (permisoFilter) {
      list = list.filter(p => this.getPermiso(p, permisoFilter));
    }
    return list;
  });

  paginatedPublicadores = computed(() => {
    const list = this.filteredPublicadores();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  totalPages = computed(() => Math.ceil(this.filteredPublicadores().length / this.pageSize()));
  matrizHasPending = computed(() => this.matrizPendingCount() > 0);

  private matrizLoaded = false;

  // ── Ausencias ──
  ausencias = signal<AusenciaOut[]>([]);
  loadingAusencias = signal(false);
  guardandoAusencia = signal(false);
  ausenciaError = signal<string | null>(null);
  ausenciaAEliminar = signal<AusenciaOut | null>(null);
  ausenciaIdPublicador: number | null = null;
  ausenciaFechaInicio: string | null = null;
  ausenciaFechaFin: string | null = null;
  ausenciaMotivoForm = '';
  private ausenciasLoaded = false;

  // ── Semanas sin reunión ──
  semanasSinReunion = signal<SemanaSinReunion[]>([]);
  loadingSemanas = signal(false);
  guardandoSemana = signal(false);
  semanaError = signal<string | null>(null);
  /** Resultado del dry_run: lo que se marcará si el usuario confirma. */
  semanaAConfirmar = signal<SemanaSinReunion | null>(null);
  semanaAEliminar = signal<SemanaSinReunion | null>(null);
  ssrFecha: string | null = null;
  ssrAlcance: AlcanceSemana = 'ambas';
  ssrMotivo = '';
  private semanasLoaded = false;

  readonly opcionesAlcanceSemana = [
    { value: 'ambas', label: 'Ambas reuniones' },
    { value: 'entre_semana', label: 'Solo entre semana' },
    { value: 'fin_semana', label: 'Solo fin de semana' },
  ];

  /** Texto libre para filtrar la lista cuando crece. */
  ausenciaFiltro = signal('');

  /**
   * Ordena por relevancia, no por fecha bruta: lo que está pasando ahora va
   * primero, luego lo que viene (lo más cercano antes) y al final lo que ya
   * terminó. Una lista ordenada solo por fecha entierra lo urgente.
   */
  ausenciasOrdenadas = computed<AusenciaOut[]>(() => {
    const peso = { en_curso: 0, proxima: 1, finalizada: 2 } as Record<string, number>;
    const q = this.ausenciaFiltro().trim().toLowerCase();

    return [...this.ausencias()]
      .filter((a) => !q
        || a.nombre_completo.toLowerCase().includes(q)
        || (a.motivo ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        const da = peso[this.estadoAusencia(a)];
        const db = peso[this.estadoAusencia(b)];
        if (da !== db) return da - db;
        // Dentro del mismo grupo: las finalizadas más recientes primero,
        // el resto por la fecha que toca antes.
        return da === 2
          ? b.fecha_fin.localeCompare(a.fecha_fin)
          : a.fecha_inicio.localeCompare(b.fecha_inicio);
      });
  });

  ausenciasEnCurso = computed(
    () => this.ausencias().filter((a) => this.estadoAusencia(a) === 'en_curso').length,
  );
  ausenciasProximas = computed(
    () => this.ausencias().filter((a) => this.estadoAusencia(a) === 'proxima').length,
  );

  /** Opciones para el picker: el valor que viaja es el id, no el nombre. */
  opcionesPublicadorAusencia = computed<PickerOption[]>(() =>
    this.publicadoresOrdenadosAusencia().map((p) => ({
      value: p.id_publicador,
      label: nombreMostrado(p),
    })),
  );

  /** Misma lista que "Asignación de Privilegios", solo reordenada por apellido. */
  publicadoresOrdenadosAusencia = computed(() =>
    [...this.publicadores()].sort((a, b) =>
      `${a.primer_apellido} ${a.primer_nombre}`.localeCompare(`${b.primer_apellido} ${b.primer_nombre}`)
    ),
  );

  constructor() {
    effect(() => {
      if (this.activeTab() === 'parametros' && !this.algoLoaded) {
        this.loadAlgoProfiles();
      }
      if (this.activeTab() === 'privilegios' && !this.matrizLoaded) {
        this.loadMatriz();
      }
      // El picker de publicador de Ausencias reutiliza la misma lista: si aún
      // no se cargó (nadie visitó "Privilegios" primero), se carga aquí.
      if (this.activeTab() === 'ausencias') {
        if (!this.matrizLoaded) this.loadMatriz();
        if (!this.ausenciasLoaded) this.loadAusencias();
      }
      if (this.activeTab() === 'sin-reunion' && !this.semanasLoaded) {
        this.loadSemanasSinReunion();
      }
    });
  }

  // ── Lifecycle ──
  ngOnInit(): void {
    this.loadSavedPlantillas();
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam && this.visibleTabs().some(t => t.id === tabParam)) {
      this.activeTab.set(tabParam);
    }
    // Matriz loads lazily via effect when tab is selected (default tab)
  }

  // ── Role check ──
  private hasRole(r: string): boolean {
    const u = this.authStore.user();
    const roles = u?.roles ?? (u?.rol ? [u.rol] : []);
    return roles.map((x: string) => (x || '').toLowerCase()).includes(r.toLowerCase());
  }

  // ── MWB Logic ──
  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = null;

    this.mwbLoading.set(true);
    this.mwbProgress.set(0);
    this.mwbProgressMessage.set('Subiendo PDF...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = this.tokenSvc.accessToken() || '';
      const streamPath = this.plantillaTipoActivo() === 'fin_semana'
        ? 'importar-atalaya/stream'
        : 'importar-mwb/stream';
      const response = await fetch(
        `${environment.apiUrl}/reuniones/programas/${streamPath}`,
        {
          method: 'POST',
          body: formData,
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || `Error ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.step === 'error') {
              throw new Error(evt.message);
            }
            this.mwbProgress.set(evt.progress);
            this.mwbProgressMessage.set(evt.message);

            if (evt.step === 'done' && evt.result) {
              const res = evt.result as MWBImportPreviewResponse;
              this.mwbPreview.set(res);
              this.showToast('success', res.mensaje);
              const map = this.prefillDates(res.semanas);
              this.mwbDates.set(map);
            }
          } catch (parseErr: any) {
            if (parseErr.message && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      this.showToast('error', err?.message || 'Error al analizar PDF');
    } finally {
      this.mwbLoading.set(false);
      this.mwbProgress.set(0);
      this.mwbProgressMessage.set('');
    }
  }

  processJsonInput(): void {
    const txt = this.mwbJsonText().trim();
    if (!txt) {
      this.showToast('error', 'El JSON no puede estar vacío');
      return;
    }

    try {
      const parsed = JSON.parse(txt);
      if (!parsed.semanas || !Array.isArray(parsed.semanas)) {
        throw new Error('El JSON no contiene el arreglo "semanas".');
      }
      
      const res = parsed as MWBImportPreviewResponse;
      res.mensaje = res.mensaje || 'JSON ingresado manualmente';
      
      this.mwbPreview.set(res);
      this.mwbJsonInputOpen.set(false);
      
      const map = this.prefillDates(res.semanas);
      this.mwbDates.set(map);
      
      this.showToast('success', 'Estructura cargada correctamente. Revisa y asigna las fechas.');
    } catch (err: any) {
      console.error(err);
      this.showToast('error', 'Error al procesar JSON: ' + err.message);
    }
  }

  prefillDates(semanas: any[]): Map<number, string> {
    let year = this.mwbTargetYear();
    const fallbackMonth = this.mwbTargetMonth();
    const map = new Map<number, string>();
    const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    
    let lastValidDate: Date | null = null;
    
    for (let i = 0; i < semanas.length; i++) {
        const title = (semanas[i].titulo_semana || '').toUpperCase();
        
        let foundDay: number | null = null;
        let foundMonthIdx: number | null = null;

        // 1. Extraer el primer numero de la cadena (suele ser el dia inicial de la semana)
        const matchDay = title.match(/\b(\d+)\b/);
        if (matchDay) { foundDay = parseInt(matchDay[1], 10); }

        // 2. Extraer el primer mes mencionado
        type MonthPos = { idx: number, m: number };
        const positions: MonthPos[] = [];
        for (let m = 0; m < monthNames.length; m++) {
           const pos = title.indexOf(monthNames[m]);
           if (pos !== -1) {
              positions.push({ idx: pos, m: m + 1 });
           }
        }
        if (positions.length > 0) {
            positions.sort((a,b) => a.idx - b.idx);
            foundMonthIdx = positions[0].m;
        }

        let weekDate: Date;

        if (foundDay !== null && foundMonthIdx !== null) {
            // Manejar salto de año (De Diciembre a Enero)
            if (lastValidDate && lastValidDate.getMonth() === 11 && foundMonthIdx === 1) {
                year++; // Avanzar el anio de forma persistente para las siguentes semanas
            }
            weekDate = new Date(year, foundMonthIdx - 1, foundDay);
        } else if (lastValidDate) {
            // Fallback: +7 días a la anterior
            weekDate = new Date(lastValidDate.getTime());
            weekDate.setDate(weekDate.getDate() + 7);
        } else {
            // Fallback inicial estricto si no hay titulo legible
            weekDate = new Date(year, fallbackMonth - 1, 1);
            while (weekDate.getDay() !== 1) {
              weekDate.setDate(weekDate.getDate() + 1);
            }
        }

        lastValidDate = weekDate;

        const yStr = weekDate.getFullYear();
        const mStr = String(weekDate.getMonth() + 1).padStart(2, '0');
        const dStr = String(weekDate.getDate()).padStart(2, '0');
        map.set(i, `${yStr}-${mStr}-${dStr}`);
    }
    
    return map;
  }

  updateMwbDate(index: number, dateStr: string) {
    const map = new Map(this.mwbDates());
    map.set(index, dateStr);
    this.mwbDates.set(map);
  }

  getISOWeekNumber(d: Date): number {
    const date = new Date(d.getTime());
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  }

  confirmMWB() {
    const preview = this.mwbPreview();
    if (!preview) return;

    // Subir la guía es una operación global (ver payload más abajo): no
    // depende de tener una congregación seleccionada.
    const datesMap = this.mwbDates();
    for (let i = 0; i < preview.semanas.length; i++) {
        if (!datesMap.get(i)) {
            this.showToast('error', `Acción requerida: Debe seleccionar la fecha del Lunes para la semana ${i+1} en la previsualización.`);
            return;
        }
    }

    const semanasConfirm: SemanaConfirm[] = preview.semanas.map((s, i) => {
       const dStr = datesMap.get(i)!;
       const localDate = new Date(dStr + 'T00:00:00');
       return {
           semana_iso: this.getISOWeekNumber(localDate),
           ano: localDate.getFullYear(),
           fecha_lunes: dStr,
           titulo_semana: s.titulo_semana,
           lectura_semanal: s.lectura_semanal,
           partes: s.partes.map(p => ({
               ...p,
               fuente_informacion: p.fuente_informacion || undefined
           }))
       };
    });

    // Sin id_congregacion: lo que se sube es la guía global, no la
    // programación de nadie. Cada congregación la genera después desde su
    // pestaña, con su propio día y hora de reunión.
    const payload: MWBImportConfirmRequest = { semanas: semanasConfirm };

    // Atalaya no crea una plantilla nueva ni reescribe nada de la existente:
    // solo agrega/reemplaza el tema de las semanas que vienen en el payload,
    // así que no hay nada "en uso" que pueda bloquear el guardado — se
    // confirma directo, sin el paso de check-duplicates que sí necesita MWB.
    if (this.plantillaTipoActivo() === 'fin_semana') {
      this.doConfirmMWB(payload);
      return;
    }

    this.mwbConfirming.set(true);
    this.reunionesSvc.checkMWBDuplicates(payload).subscribe({
        next: (res) => {
            if (res.existe) {
                this.mwbNombreGuia.set(res.nombre);
                this.mwbEnUsoPor.set(res.en_uso_por ?? []);
                this.mwbPendingPayload = payload;
                this.mwbShowDuplicateModal.set(true);
                this.mwbConfirming.set(false);
            } else {
                this.doConfirmMWB(payload);
            }
        },
        error: (err) => {
            console.error('Error al verificar duplicados:', err);
            this.doConfirmMWB(payload);
        }
    });
  }

  doConfirmMWB(payload: MWBImportConfirmRequest) {
    const confirmar$ = this.plantillaTipoActivo() === 'fin_semana'
      ? this.reunionesSvc.confirmarAtalaya(payload)
      : this.reunionesSvc.confirmarMWB(payload);

    this.mwbConfirming.set(true);
    confirmar$.subscribe({
        next: (res) => {
            this.showToast('success', `${res.mensaje} (${res.partes_creadas} partes)`);
            this.mwbConfirming.set(false);
            this.mwbPreview.set(null);
            this.mwbDates.set(new Map());
            this.mwbShowDuplicateModal.set(false);
            this.mwbPendingPayload = null;
            this.loadSavedPlantillas(); // Refrescar el histórico automáticamente
            if (this.plantillaTipoActivo() === 'fin_semana') this.loadAtalayaTemas();
        },
        error: (err) => {
            console.error('Error al confirmar MWB:', err);
            // El 409 de "guía en uso" explica exactamente qué congregaciones la
            // bloquean; tragárselo con un mensaje genérico deja al importador
            // sin saber qué hacer.
            this.showToast('error', err?.error?.detail ?? 'Error al procesar la confirmación');
            this.mwbConfirming.set(false);
        }
    });
  }

  acceptDuplicateReplace() {
    if (this.mwbPendingPayload) {
      this.doConfirmMWB(this.mwbPendingPayload);
    }
  }

  dismissDuplicateModal() {
    this.mwbShowDuplicateModal.set(false);
    this.mwbEnUsoPor.set([]);
    this.mwbNombreGuia.set('');
    this.mwbPendingPayload = null;
  }

  getSectionColor(seccion: string): string {
    const s = seccion.toUpperCase();
    if (s.includes('TESOROS')) return '#557e89';
    if (s.includes('MAESTROS')) return '#c59133';
    if (s.includes('VIDA CRISTIANA')) return '#a83c23';
    return '#64748b';
  }

  formatMesAno(mes: number, ano: number): string {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${meses[mes - 1] ?? mes} ${ano}`;
  }

  // ── Plantillas Management ──
  loadSavedPlantillas() {
    // Las plantillas son globales: un rol global puede verlas sin haber
    // seleccionado congregación todavía.
    const idCongregacion = this.congregacionCtx.effectiveCongregacionId();

    const tipo = this.plantillaTipoActivo();
    this.plantillasLoading.set(true);
    this.reunionesSvc.getPlantillas(tipo, idCongregacion).subscribe({
      next: (res) => {
        this.savedPlantillas.set(res);
        this.plantillasLoading.set(false);
        if (tipo === 'fin_semana') this.loadAtalayaTemas();
      },
      error: (err) => {
        console.error(err);
        this.plantillasLoading.set(false);
      }
    });
  }

  setPlantillaTipoActivo(tipo: 'entre_semana' | 'fin_semana') {
    if (this.plantillaTipoActivo() === tipo) return;
    this.plantillaTipoActivo.set(tipo);
    this.mwbPreview.set(null);
    this.closePlantillaEditor();
    this.loadSavedPlantillas();
  }

  editPlantilla(id: number) {
    this.plantillasLoading.set(true);
    this.reunionesSvc.getPlantillaDetail(id).subscribe({
      next: (res) => {
        this.selectedPlantilla.set(res);
        this.plantillaEditing.set(true);
        this.plantillasLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.showToast('error', 'Error al cargar detalle de plantilla');
        this.plantillasLoading.set(false);
      }
    });
  }

  closePlantillaEditor() {
    this.selectedPlantilla.set(null);
    this.plantillaEditing.set(false);
  }

  updateSemanaMeta(ordinal: number, field: 'titulo_semana' | 'lectura_semanal', value: string) {
    const p = this.selectedPlantilla();
    if (!p) return;
    p.partes.forEach(parte => {
      if ((parte.semana_ordinal ?? 0) === ordinal) {
        (parte as any)[field] = value;
      }
    });
    this.selectedPlantilla.set({ ...p, partes: [...p.partes] });
  }

  /** Quita una parte del editor en memoria; se borra en BD recién al Guardar
   *  (update_plantilla borra las que no vengan en el payload). */
  removeParte(parte: PlantillaParteDetail) {
    const p = this.selectedPlantilla();
    if (!p) return;
    p.partes = p.partes.filter(x => x !== parte);
    this.selectedPlantilla.set({ ...p, partes: [...p.partes] });
  }

  /** Agrega una fila vacía al final de un grupo existente (una semana real,
   *  o el grupo 0 "General" que se repite en cada programa). */
  addParte(ordinal: number) {
    const p = this.selectedPlantilla();
    if (!p) return;
    const week = this.plantillaByWeek().find(w => w.ordinal === ordinal);
    const maxOrden = Math.max(0, ...p.partes.filter(x => (x.semana_ordinal ?? 0) === ordinal).map(x => x.orden_visual));
    const nueva: PlantillaParteDetail = {
      nombre_parte: '',
      seccion: '',
      privilegios_permitidos: [],
      requiere_pareja: false,
      aplica_sala_b: false,
      es_informativa: false,
      orden_visual: maxOrden + 1,
      // El grupo 0 es "General": sin semana_ordinal propio ni titulo_semana,
      // para que el backend lo repita en cada semana que se genere (con o
      // sin tema de La Atalaya importado para esa semana).
      semana_ordinal: ordinal === 0 ? undefined : ordinal,
      titulo_semana: week?.titulo_semana,
      lectura_semanal: week?.lectura_semanal,
    };
    p.partes = [...p.partes, nueva];
    this.selectedPlantilla.set({ ...p, partes: p.partes });
  }

  /** Agrega contenido a la plantilla:
   *  - Fin de semana: los temas por semana los trae el importador de La
   *    Atalaya, así que aquí solo hace falta el grupo "General" (lo que se
   *    repite siempre) — si ya existe, se le agrega una fila más.
   *  - Entre semana: agrega un nuevo bloque de semana con ordinal siguiente,
   *    como antes. */
  addSemana() {
    const p = this.selectedPlantilla();
    if (!p) return;

    if (this.plantillaTipoActivo() === 'fin_semana') {
      this.addParte(0);
      return;
    }

    const ordinales = p.partes.map(x => x.semana_ordinal ?? 0);
    const nuevoOrdinal = (ordinales.length ? Math.max(...ordinales) : 0) + 1;
    const nueva: PlantillaParteDetail = {
      nombre_parte: '',
      seccion: '',
      privilegios_permitidos: [],
      requiere_pareja: false,
      aplica_sala_b: false,
      es_informativa: false,
      orden_visual: 1,
      semana_ordinal: nuevoOrdinal,
    };
    p.partes = [...p.partes, nueva];
    this.selectedPlantilla.set({ ...p, partes: p.partes });
  }

  deletePlantilla(id: number) {
    this.confirmDeleteId.set(id);
  }

  confirmDelete() {
    const id = this.confirmDeleteId();
    if (id === null) return;
    this.confirmDeleteId.set(null);

    this.reunionesSvc.deletePlantilla(id).subscribe({
      next: (res) => {
        this.showToast('success', res.mensaje);
        this.loadSavedPlantillas();
      },
      error: (err) => {
        console.error(err);
        // El backend devuelve 409 con la lista de congregaciones que tienen
        // programación colgando de esta guía. Ese detalle es la acción a
        // tomar; "Error al eliminar plantilla" no dice nada.
        this.showToast('error', err?.error?.detail ?? 'Error al eliminar la guía');
      }
    });
  }

  savePlantillaEdit() {
    const p = this.selectedPlantilla();
    if (!p) return;

    this.plantillasLoading.set(true);
    const payload: PlantillaUpdateRequest = {
      nombre: p.nombre,
      tiene_sala_b: p.tiene_sala_b,
      partes: p.partes
    };

    this.reunionesSvc.updatePlantilla(p.id_plantilla, payload).subscribe({
      next: (res) => {
        this.showToast('success', 'Plantilla actualizada correctamente');
        this.loadSavedPlantillas();
        if (this.plantillaTipoActivo() === 'fin_semana') this.loadAtalayaTemas();
        this.closePlantillaEditor();
        this.plantillasLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.showToast('error', 'Error al guardar cambios');
        this.plantillasLoading.set(false);
      }
    });
  }

  // ── Algorithm Profiles Methods ──
  loadAlgoProfiles(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;

    this.algoLoading.set(true);
    this.reunionesSvc.getAlgorithmProfiles(idCong).subscribe({
      next: (res) => {
        this.algoProfiles.set(res.perfiles);
        this.activeProfileId.set(res.perfil_activo);
        this.algoMaxPartesCruzadas.set(res.algo_max_partes_cruzadas);
        this.algoLoaded = true;
        this.algoLoading.set(false);
      },
      error: (err) => {
        this.showToast('error', err?.error?.detail || 'Error al cargar perfiles del algoritmo');
        this.algoLoading.set(false);
      }
    });
  }

  selectProfile(perfilId: string): void {
    if (this.activeProfileId() === perfilId) return;
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    
    this.profileSaving.set(true);
    this.reunionesSvc.setAlgorithmProfile(perfilId, idCong).subscribe({
      next: (res) => {
        this.activeProfileId.set(perfilId);
        this.profileSaving.set(false);
        this.showToast('success', res.message);
      },
      error: (err) => {
        this.profileSaving.set(false);
        this.showToast('error', err?.error?.detail || 'Error al activar el perfil');
      }
    });
  }

  onMaxPartesChange(value: number): void {
    const num = Number(value);
    if (isNaN(num) || num < 1 || num > 5) return;
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    
    this.algoMaxPartesCruzadas.set(num);
    this.reunionesSvc.updateAlgorithmParams({ id_congregacion: idCong, parametros: { algo_max_partes_cruzadas: num } }).subscribe({
      next: () => {
        this.showToast('success', 'Límite actualizado');
      },
      error: (err) => {
        this.showToast('error', err?.error?.detail || 'Error al guardar límite');
      }
    });
  }
  // ── Reporte de permisos (PDF) ──
  reporteAbierto = signal(false);
  /** Cuál de los dos archivos está en curso, para que el diálogo sepa qué botón
   *  poner a girar. */
  reporteDescargando = signal<'pdf' | 'xlsx' | null>(null);

  abrirReporte(): void {
    if (!this.publicadores().length) return;
    this.reporteAbierto.set(true);
  }

  descargarReporte(
    evento: { opciones: ReportePrivilegiosOpciones; archivo: 'pdf' | 'xlsx' },
  ): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || this.reporteDescargando()) return;
    const { opciones, archivo } = evento;
    this.reporteDescargando.set(archivo);
    this.reunionesSvc.descargarReportePrivilegios(idCong, opciones, archivo).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `permisos_asignacion_${opciones.formato}_${new Date().toISOString().slice(0, 10)}.${archivo}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.reporteDescargando.set(null);
        this.reporteAbierto.set(false);
        this.showToast('success', 'Reporte generado');
      },
      error: (err) => {
        this.reporteDescargando.set(null);
        this.showToast('error', err?.error?.detail ?? 'No se pudo generar el reporte');
      },
    });
  }

  // ── Matriz de Publicadores Methods ──
  loadMatriz(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) {
      this.matrizErrorMsg.set('No hay congregación seleccionada. Selecciona una en el panel de administración.');
      return;
    }

    this.matrizLoading.set(true);
    this.matrizErrorMsg.set(null);
    this.dirtyMap.clear();
    this.dirtyOratoriaMap.clear();
    this.matrizPendingCount.set(0);
    this.matrizLoaded = true;

    this.reunionesSvc.getMatrizConfiguracion(idCong).subscribe({
      next: (res) => {
        this.publicadores.set(res.publicadores);
        this.columnas.set(res.columnas);
        this.grupos.set(res.grupos ?? []);
        this.matrizLoading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.detail ?? err?.message ?? 'Error al cargar la configuración.';
        this.matrizErrorMsg.set(msg);
        this.matrizLoading.set(false);
      }
    });
  }

  // ── Ausencias ──────────────────────────────────────
  loadAusencias(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;

    this.loadingAusencias.set(true);
    this.ausenciasLoaded = true;
    this.reunionesSvc.getAusencias(idCong).subscribe({
      next: (res) => {
        this.ausencias.set(res);
        this.loadingAusencias.set(false);
      },
      error: () => this.loadingAusencias.set(false),
    });
  }

  /**
   * Método plano, no computed: los campos del formulario son propiedades
   * normales (para poder usar [(ngModel)]), no señales, así que un computed
   * nunca se volvería a evaluar al escribir en el formulario.
   */
  puedeRegistrarAusencia(): boolean {
    return this.ausenciaIdPublicador !== null && !!this.ausenciaFechaInicio && !!this.ausenciaFechaFin;
  }

  registrarAusencia(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || !this.puedeRegistrarAusencia()) return;

    if (this.ausenciaFechaFin! < this.ausenciaFechaInicio!) {
      this.ausenciaError.set('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }

    this.guardandoAusencia.set(true);
    this.ausenciaError.set(null);

    this.reunionesSvc.crearAusencia({
      id_congregacion: idCong,
      id_publicador: this.ausenciaIdPublicador!,
      fecha_inicio: this.ausenciaFechaInicio!,
      fecha_fin: this.ausenciaFechaFin!,
      motivo: this.ausenciaMotivoForm.trim() || null,
    }).subscribe({
      next: (nueva) => {
        this.ausencias.update((list) => [nueva, ...list]);
        this.guardandoAusencia.set(false);
        this.ausenciaIdPublicador = null;
        this.ausenciaFechaInicio = null;
        this.ausenciaFechaFin = null;
        this.ausenciaMotivoForm = '';
        this.showToast('success', `Ausencia registrada para ${nueva.nombre_completo}.`);
      },
      error: (err) => {
        this.guardandoAusencia.set(false);
        this.ausenciaError.set(err?.error?.detail ?? 'No se pudo registrar la ausencia.');
      },
    });
  }

  // ── Semanas sin reunión ────────────────────────────
  loadSemanasSinReunion(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;

    this.loadingSemanas.set(true);
    this.semanasLoaded = true;
    this.reunionesSvc.getSemanasSinReunion(idCong).subscribe({
      next: (res) => {
        this.semanasSinReunion.set(res);
        this.loadingSemanas.set(false);
      },
      error: () => this.loadingSemanas.set(false),
    });
  }

  /** Plano, no computed: los campos del formulario son propiedades, no señales. */
  puedeMarcarSemana(): boolean {
    return !!this.ssrFecha;
  }

  /**
   * Primero un dry_run para saber cuántas asignaciones se perderían, y recién
   * entonces se pide confirmación. El borrado es irreversible.
   */
  prepararSemanaSinReunion(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || !this.puedeMarcarSemana()) return;

    this.guardandoSemana.set(true);
    this.semanaError.set(null);

    this.reunionesSvc.crearSemanaSinReunion({
      id_congregacion: idCong,
      fecha: this.ssrFecha!,
      alcance: this.ssrAlcance,
      motivo: this.ssrMotivo.trim() || null,
      dry_run: true,
    }).subscribe({
      next: (previo) => {
        this.guardandoSemana.set(false);
        this.semanaAConfirmar.set(previo);
      },
      error: (err) => {
        this.guardandoSemana.set(false);
        this.semanaError.set(err?.error?.detail ?? 'No se pudo comprobar la semana.');
      },
    });
  }

  confirmarMarcarSemana(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || !this.ssrFecha) return;

    this.guardandoSemana.set(true);
    this.reunionesSvc.crearSemanaSinReunion({
      id_congregacion: idCong,
      fecha: this.ssrFecha,
      alcance: this.ssrAlcance,
      motivo: this.ssrMotivo.trim() || null,
    }).subscribe({
      next: (nueva) => {
        this.guardandoSemana.set(false);
        this.semanaAConfirmar.set(null);
        // Puede ser un alta o una actualización de la misma semana.
        this.semanasSinReunion.update((list) => [
          nueva,
          ...list.filter((x) => x.id_semana_sin_reunion !== nueva.id_semana_sin_reunion),
        ]);
        this.ssrFecha = null;
        this.ssrAlcance = 'ambas';
        this.ssrMotivo = '';
        const n = nueva.borradas ?? 0;
        this.showToast('success', n > 0
          ? `Semana marcada. Se borraron ${n} asignaciones.`
          : 'Semana marcada como sin reunión.');
      },
      error: (err) => {
        this.guardandoSemana.set(false);
        this.semanaAConfirmar.set(null);
        this.semanaError.set(err?.error?.detail ?? 'No se pudo marcar la semana.');
      },
    });
  }

  confirmarEliminarSemana(): void {
    const s = this.semanaAEliminar();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!s || !idCong) return;
    this.semanaAEliminar.set(null);

    this.reunionesSvc.eliminarSemanaSinReunion(s.id_semana_sin_reunion, idCong).subscribe({
      next: () => {
        this.semanasSinReunion.update((list) =>
          list.filter((x) => x.id_semana_sin_reunion !== s.id_semana_sin_reunion));
        this.showToast('success', 'Se quitó la marca. Vuelve a generar para programar esa semana.');
      },
      error: (err) => {
        this.showToast('error', err?.error?.detail ?? 'No se pudo quitar la marca.');
      },
    });
  }

  etiquetaAlcance(alcance: AlcanceSemana): string {
    return this.opcionesAlcanceSemana.find((o) => o.value === alcance)?.label ?? alcance;
  }

  /** "8 – 14 jun 2026", omitiendo el mes repetido cuando la semana no lo cruza. */
  formatRangoSemana(s: SemanaSinReunion): string {
    const ini = new Date(s.fecha_inicio + 'T00:00:00');
    const fin = new Date(s.fecha_fin + 'T00:00:00');
    const mesIni = ini.toLocaleDateString('es', { month: 'short' });
    const mesFin = fin.toLocaleDateString('es', { month: 'short' });
    const cabecera = mesIni === mesFin
      ? `${ini.getDate()} – ${fin.getDate()} ${mesFin}`
      : `${ini.getDate()} ${mesIni} – ${fin.getDate()} ${mesFin}`;
    return `${cabecera} ${fin.getFullYear()}`;
  }

  confirmarEliminarAusencia(): void {
    const a = this.ausenciaAEliminar();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!a || !idCong) return;
    this.ausenciaAEliminar.set(null);

    this.reunionesSvc.eliminarAusencia(a.id_ausencia, idCong).subscribe({
      next: () => {
        this.ausencias.update((list) => list.filter((x) => x.id_ausencia !== a.id_ausencia));
      },
      error: (err) => {
        this.showToast('error', err?.error?.detail ?? 'No se pudo eliminar la ausencia.');
      },
    });
  }

  /**
   * Estado de una ausencia respecto a hoy. Es lo que separa "esta persona no
   * está disponible ahora mismo" de "esto ya pasó": sin esto la lista es plana
   * y hay que leer fechas una por una.
   */
  estadoAusencia(a: AusenciaOut): 'en_curso' | 'proxima' | 'finalizada' {
    const hoy = this.hoyISO();
    if (a.fecha_fin < hoy) return 'finalizada';
    if (a.fecha_inicio > hoy) return 'proxima';
    return 'en_curso';
  }

  estadoAusenciaLabel(a: AusenciaOut): string {
    switch (this.estadoAusencia(a)) {
      case 'en_curso':   return 'En curso';
      case 'proxima':    return 'Próxima';
      default:           return 'Finalizada';
    }
  }

  /** Texto de apoyo: cuánto falta o cuánto lleva. Evita hacer cuentas mentales. */
  estadoAusenciaDetalle(a: AusenciaOut): string {
    const estado = this.estadoAusencia(a);
    if (estado === 'en_curso') {
      const faltan = this.diasEntre(this.hoyISO(), a.fecha_fin);
      return faltan === 0 ? 'Termina hoy' : (faltan === 1 ? 'Termina mañana' : 'Termina en ' + faltan + ' días');
    }
    if (estado === 'proxima') {
      const faltan = this.diasEntre(this.hoyISO(), a.fecha_inicio);
      return faltan === 1 ? 'Empieza mañana' : 'Empieza en ' + faltan + ' días';
    }
    return 'Finalizada';
  }

  /** Duración total del rango, inclusiva en ambos extremos. */
  duracionAusencia(a: AusenciaOut): string {
    const dias = this.diasEntre(a.fecha_inicio, a.fecha_fin) + 1;
    return dias === 1 ? '1 día' : dias + ' días';
  }

  private hoyISO(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  private diasEntre(desdeISO: string, hastaISO: string): number {
    const toDate = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const ms = toDate(hastaISO).getTime() - toDate(desdeISO).getTime();
    return Math.round(ms / 86400000);
  }

  /** Iniciales para el avatar, mismo lenguaje visual que la matriz de privilegios. */
  inicialesAusencia(a: AusenciaOut): string {
    const partes = a.nombre_completo.trim().split(/\s+/);
    const primera = partes[0]?.[0] ?? '';
    const segunda = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primera + segunda).toUpperCase();
  }

  avatarAusenciaClass(a: AusenciaOut): string {
    return getInitialAvatarStyle(a.nombre_completo.trim() || '');
  }

  /**
   * Rango compacto: el año se escribe una sola vez al final cuando ambos
   * extremos caen en el mismo. El formato largo ("30 de ago de 2026 – 6 de
   * sept de 2026") partía la línea en móvil y dejaba el separador huérfano.
   */
  formatRangoAusencia(a: AusenciaOut): string {
    const partes = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      const fecha = new Date(y, m - 1, d);
      const mes = fecha.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
      return { dia: d, mes, ano: y };
    };

    const ini = partes(a.fecha_inicio);
    const fin = partes(a.fecha_fin);

    if (a.fecha_inicio === a.fecha_fin) {
      return ini.dia + ' ' + ini.mes + ' ' + ini.ano;
    }
    if (ini.ano === fin.ano) {
      return ini.dia + ' ' + ini.mes + ' – ' + fin.dia + ' ' + fin.mes + ' ' + fin.ano;
    }
    return ini.dia + ' ' + ini.mes + ' ' + ini.ano + ' – ' + fin.dia + ' ' + fin.mes + ' ' + fin.ano;
  }

  getPermiso(pub: PublicadorMatrizItem, key: string): boolean {
    const dirty = this.dirtyMap.get(pub.id_publicador);
    if (dirty && key in dirty) {
      return dirty[key];
    }
    return pub.permisos[key] ?? false;
  }

  togglePermiso(pub: PublicadorMatrizItem, key: string): void {
    const current = this.getPermiso(pub, key);
    const newVal = !current;
    const original = pub.permisos[key] ?? false;
    let dirty = this.dirtyMap.get(pub.id_publicador);

    if (newVal === original) {
      if (dirty) {
        delete dirty[key];
        if (Object.keys(dirty).length === 0) {
          this.dirtyMap.delete(pub.id_publicador);
        }
      }
    } else {
      if (!dirty) {
        dirty = {};
        this.dirtyMap.set(pub.id_publicador, dirty);
      }
      dirty[key] = newVal;
    }

    this.matrizPendingCount.set(this.dirtyMap.size + this.dirtyOratoriaMap.size);
    this.publicadores.update(list => [...list]);
  }

  isDirty(id: number): boolean {
    return this.dirtyMap.has(id) || this.dirtyOratoriaMap.has(id);
  }

  isOratoriaDirty(id: number): boolean {
    return this.dirtyOratoriaMap.has(id);
  }

  getOratoria(pub: PublicadorMatrizItem): number {
    return this.dirtyOratoriaMap.get(pub.id_publicador) ?? pub.nivel_oratoria ?? 3;
  }

  setOratoria(pub: PublicadorMatrizItem, value: any): void {
    const numValue = Number(value);
    const original = pub.nivel_oratoria ?? 3;

    if (numValue === original) {
      this.dirtyOratoriaMap.delete(pub.id_publicador);
    } else {
      this.dirtyOratoriaMap.set(pub.id_publicador, numValue);
    }

    this.matrizPendingCount.set(this.dirtyMap.size + this.dirtyOratoriaMap.size);
    this.publicadores.update(list => [...list]);
  }

  setFiltroSexo(filter: 'solo_hombres' | 'solo_mujeres'): void {
    if (this.filtroSexo() === filter) {
      this.filtroSexo.set('todos');
    } else {
      this.filtroSexo.set(filter);
    }
    this.currentPage.set(1);
  }

  setFiltroPrivilegio(priv: string): void {
    this.filtroPrivilegio.set(this.filtroPrivilegio() === priv ? null : priv);
    this.currentPage.set(1);
  }

  setFiltroPermiso(key: string | null): void {
    this.filtroPermiso.set(key);
    this.permisoDropdownOpen.set(false);
    this.currentPage.set(1);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.permiso-dropdown-root')) {
      this.permisoDropdownOpen.set(false);
    }
  }

  clearMatrizFilters(): void {
    this.searchQuery.set('');
    this.filtroSexo.set('todos');
    this.filtroPrivilegio.set(null);
    this.filtroPermiso.set(null);
    this.currentPage.set(1);
  }

  hasMatrizActiveFilters = computed(() =>
    this.searchQuery().trim() !== '' ||
    this.filtroSexo() !== 'todos' ||
    this.filtroPrivilegio() !== null ||
    this.filtroPermiso() !== null
  );

  getColLabel(key: string): string {
    return this.columnas().find(c => c.key === key)?.label ?? key;
  }

  privilegioActiveClass(color: string): string {
    const map: Record<string, string> = {
      amber: 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 text-amber-700 dark:text-amber-300',
      blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300',
      emerald: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 text-emerald-700 dark:text-emerald-300',
      teal: 'bg-teal-50 dark:bg-teal-900/30 border-teal-400 text-teal-700 dark:text-teal-300',
      slate: 'bg-slate-100 dark:bg-slate-700 border-slate-400 text-slate-700 dark:text-slate-200',
    };
    return map[color] ?? map['slate'];
  }

  guardarMatriz(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || this.matrizPendingCount() === 0) return;

    this.matrizSaving.set(true);
    this.toast.set(null);

    const cambios: CambioPermisoPublicador[] = [];
    const changedIds = new Set([...this.dirtyMap.keys(), ...this.dirtyOratoriaMap.keys()]);

    changedIds.forEach(id_publicador => {
      const permisos = this.dirtyMap.get(id_publicador);
      const nivel_oratoria = this.dirtyOratoriaMap.get(id_publicador);
      const cambio: CambioPermisoPublicador = { id_publicador, permisos: permisos || {} };
      if (nivel_oratoria !== undefined) {
        cambio.nivel_oratoria = nivel_oratoria;
      }
      cambios.push(cambio);
    });

    const payload: UpdateMatrizRequest = {
      id_congregacion: idCong,
      cambios,
    };

    this.reunionesSvc.updateMatrizConfiguracion(payload).subscribe({
      next: (res) => {
        this.publicadores.update(list =>
          list.map(pub => {
            const dirty = this.dirtyMap.get(pub.id_publicador);
            const dirtyOratoria = this.dirtyOratoriaMap.get(pub.id_publicador);
            if (!dirty && dirtyOratoria === undefined) return pub;
            return {
              ...pub,
              permisos: dirty ? { ...pub.permisos, ...dirty } : pub.permisos,
              nivel_oratoria: dirtyOratoria ?? pub.nivel_oratoria
            };
          })
        );
        this.matrizSaving.set(false);
        this.dirtyMap.clear();
        this.dirtyOratoriaMap.clear();
        this.matrizPendingCount.set(0);
        this.publicadores.update(list => [...list]);
        this.showToast('success', res.message);
      },
      error: (err) => {
        const msg = err?.error?.detail ?? 'Error al guardar los cambios.';
        this.matrizSaving.set(false);
        this.showToast('error', msg);
      }
    });
  }

  // ── Pagination ──
  setPage(p: number) { this.currentPage.set(p); }
  prevPage() { if (this.currentPage() > 1) this.setPage(this.currentPage() - 1); }
  nextPage() { if (this.currentPage() < this.totalPages()) this.setPage(this.currentPage() + 1); }

  getPagesArray(): (number | null)[] {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | null)[] = [1];
    if (current > 3) pages.push(null);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push(null);
    pages.push(total);
    return pages;
  }

  // ── Helpers ──
  isHermano(pub: PublicadorMatrizItem): boolean {
    return pub.sexo === 'M' || pub.sexo === 'Masculino';
  }

  countPrivilegio(nombre: string): number {
    return this.filteredPublicadores().filter(p => p.privilegios.includes(nombre)).length;
  }

  countPrecursores(): number {
    return this.filteredPublicadores().filter(p =>
      p.privilegios.includes('Precursor Regular') || p.privilegios.includes('Precursor Especial')
    ).length;
  }

  getAvatarClass(pub: PublicadorMatrizItem): string {
    return getInitialAvatarStyle(nombreMostrado(pub));
  }

  privilegioLabel(priv: string): string {
    const abreviaciones: Record<string, string> = {
      'Superintendente': 'Sup.', 'Anciano': 'Anciano', 'Siervo Ministerial': 'S.M.',
      'Precursor Especial': 'P. Esp.', 'Precursor Regular': 'P. Reg.',
      'Precursor Auxiliar': 'P. Aux.', 'Publicador': 'Pub.',
    };
    return abreviaciones[priv] ?? priv;
  }

  privilegioBadgeClass(priv: string): string {
    switch (priv) {
      case 'Anciano': case 'Superintendente':
        return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50';
      case 'Siervo Ministerial':
        return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50';
      case 'Precursor Regular': case 'Precursor Especial':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50';
      case 'Precursor Auxiliar':
        return 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700/50';
      default:
        return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
    }
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 4000);
  }
}


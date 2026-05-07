import { Component, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { TokenService } from '../../../core/auth/token.service';
import { environment } from '../../../../environments/environment';
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
  CambioPermisoPublicador,
  UpdateMatrizRequest
} from '../models/reuniones.models';

@Component({
  selector: 'app-reuniones-configuracion-plantillas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col gap-5 h-full">

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
                 @if (tab.id === 'parametros') {
                   <span class="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                     <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
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

           <!-- Acciones contextuales (botones Guardar + filtros) -->
           <div class="flex items-center gap-2 ml-auto flex-wrap justify-end">

            <!-- Perfil del algoritmo (solo indicador de guardado) -->
            @if (activeTab() === 'parametros' && profileSaving()) {
              <div class="flex items-center gap-1.5 text-[0.625rem] font-bold text-[#6D28D9] dark:text-purple-400">
                <div class="w-3 h-3 border-2 border-[#6D28D9] border-t-transparent rounded-full animate-spin"></div>
                Guardando perfil...
              </div>
            }

           <!-- Guardar privilegios -->
           @if (activeTab() === 'privilegios') {
             @if (matrizHasPending()) {
               <span class="text-[0.625rem] font-bold text-amber-500 dark:text-amber-400 animate-pulse">
                 {{ matrizPendingCount() }} cambio{{ matrizPendingCount() > 1 ? 's' : '' }}
               </span>
             }
             <button
               *ngIf="hasEditPermission()"
               (click)="guardarMatriz()"
               [disabled]="!matrizHasPending() || matrizSaving()"
               class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
               @if (matrizSaving()) {
                 <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
               } @else {
                 <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
               }
               Guardar
             </button>
           }

           <!-- Guardar plantilla (cuando se edita) -->
           @if (activeTab() === 'plantillas' && plantillaEditing()) {
             <button (click)="savePlantillaEdit()" [disabled]="plantillasLoading()" class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
               @if (plantillasLoading()) {
                 <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
               } @else {
                 <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
               }
               Guardar
             </button>
           }

           <!-- Filtros buscador (solo para tab privilegios) -->
           @if (activeTab() === 'privilegios') {
               <!-- Filter Icons -->
               <div class="flex items-center gap-1">
                   <button
                     (click)="setFiltroSexo('solo_hombres')"
                     title="Solo Hermanos"
                     class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all border"
                     [class]="filtroSexo() === 'solo_hombres'
                       ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                       : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 hover:text-blue-500'">
                       <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
                   </button>
                   <button
                     (click)="setFiltroSexo('solo_mujeres')"
                     title="Solo Hermanas"
                     class="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-all border"
                     [class]="filtroSexo() === 'solo_mujeres'
                       ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                       : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-rose-300 hover:text-rose-500'">
                       <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M12 21v-8"/><path d="M9 14l3-3 3 3"/></svg>
                   </button>
               </div>
               <!-- Search -->
               <div class="relative w-full sm:w-[200px]">
                   <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                   </div>
                   <input type="text"
                     [ngModel]="searchQuery()"
                     (ngModelChange)="searchQuery.set($event)"
                     placeholder="Buscar publicador..."
                     class="priv-search w-full h-9 pl-9 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none shadow-sm">
               </div>
           }

           </div>
       </div>

       <!-- ===== TAB: PLANTILLAS ===== -->
       @if (activeTab() === 'plantillas') {

       <!-- Toolbar -->
       <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
           <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-[#6D28D9]/10 dark:bg-[#6D28D9]/20 rounded-xl flex items-center justify-center shrink-0">
                 <svg class="w-4.5 h-4.5 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <h3 class="font-bold text-slate-800 dark:text-white text-[0.8125rem]">Generador de Plantillas <span class="text-[#6D28D9] dark:text-purple-400 font-black">Motor IA</span></h3>
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
                       class="plt-btn-secondary h-9 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 text-[0.6875rem] font-bold rounded-lg flex items-center gap-2 shrink-0">
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
                     class="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-[#6D28D9]/50 outline-none resize-y mb-3 h-40"
                     placeholder='{"mensaje": "OK", "semanas": [{ "titulo_semana": "...", "partes": [] }]}'></textarea>
           <div class="flex items-center gap-2 justify-end">
              <button (click)="mwbJsonInputOpen.set(false)" class="plt-btn-secondary h-8 px-4 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-[0.6875rem] font-bold rounded-lg">Cancelar</button>
              <button (click)="processJsonInput()" class="plt-btn-primary h-8 px-4 bg-[#6D28D9] text-white text-[0.6875rem] font-bold rounded-lg shadow-sm">Procesar JSON</button>
           </div>
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
                   <!-- Acciones siempre visibles -->
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
                         <div class="w-6 h-6 rounded-lg bg-[#6D28D9]/10 text-[#6D28D9] dark:text-purple-400 flex items-center justify-center font-black text-[0.6rem] shrink-0">W{{ week.ordinal }}</div>
                         <div class="flex flex-col gap-0.5 min-w-0 flex-1">
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
                               </tr>
                             }
                           </tbody>
                         </table>
                       </div>
                     </div>
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
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">Esta acción es permanente. Los programas ya creados <span class="font-bold text-slate-700 dark:text-slate-300">no se verán afectados</span>.</p>
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
             <!-- Stats bar compact -->
             <div class="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200/60 dark:bg-slate-700/40 rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-700/50">
               <div class="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-900">
                 <span class="text-base font-black text-slate-800 dark:text-white tabular-nums leading-none">{{ filteredPublicadores().length }}</span>
                 <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide leading-none">Publicadores</span>
               </div>
               <div class="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-900">
                 <span class="text-base font-black text-slate-800 dark:text-white tabular-nums leading-none">{{ countPrivilegio('Anciano') }}</span>
                 <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide leading-none">Ancianos</span>
               </div>
               <div class="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-900">
                 <span class="text-base font-black text-slate-800 dark:text-white tabular-nums leading-none">{{ countPrivilegio('Siervo Ministerial') }}</span>
                 <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide leading-none">S. Ministeriales</span>
               </div>
               <div class="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-900">
                 <span class="text-base font-black text-slate-800 dark:text-white tabular-nums leading-none">{{ countPrecursores() }}</span>
                 <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide leading-none">Precursores</span>
               </div>
             </div>

             <!-- Data Table / Cards -->
             <div class="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">

                 <!-- ── VISTA MÓVIL: acordeón (< md) ── -->
                 <div class="flex md:hidden flex-col overflow-y-auto simple-scrollbar flex-1 min-h-0 divide-y divide-slate-100 dark:divide-slate-800/60">
                   @for (pub of paginatedPublicadores(); track pub.id_publicador) {
                     <div [class]="isDirty(pub.id_publicador) ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''">
                       <!-- Fila colapsada — siempre visible, toque para expandir -->
                       <div class="px-3 py-3 flex items-center gap-3 cursor-pointer select-none active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors duration-100"
                            (click)="toggleCard(pub.id_publicador)">
                         <div class="priv-avatar w-9 h-9 rounded-xl flex items-center justify-center font-black text-[0.6875rem] shrink-0"
                              [class]="avatarClass(pub)">
                           {{ pub.primer_nombre[0] }}{{ pub.primer_apellido[0] }}
                         </div>
                         <div class="flex-1 min-w-0">
                           <p class="text-[0.8125rem] font-bold text-slate-800 dark:text-white truncate leading-tight">
                             {{ pub.primer_nombre.split(' ')[0] }} {{ pub.primer_apellido.split(' ')[0] }}
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
                         <div class="px-3 pb-3 animate-slideDown">
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
                                 <span class="text-[11px] font-semibold leading-snug text-slate-600 dark:text-slate-300">
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
                 <div class="hidden md:flex flex-1 min-h-0 overflow-x-auto overflow-y-auto simple-scrollbar">
                     <table class="w-full min-w-max text-left border-collapse">
                          <thead class="priv-thead sticky top-0 z-30">
                           <tr>
                             <th class="priv-th-publisher is-sticky px-3 py-2 sticky left-0 z-40 min-w-[160px] text-left">
                               <span class="text-[9px] font-black text-white uppercase tracking-[0.14em]">Publicador</span>
                             </th>
                             @for (col of regularColumnas(); track col.key) {
                               <th class="priv-th px-1 py-1.5 text-center min-w-[48px] border-l border-white/[0.07]" [title]="permisoTooltip(col.key)">
                                 <span class="text-[8px] font-black text-white uppercase tracking-[0.02em] leading-tight whitespace-normal block">{{ col.label }}</span>
                               </th>
                             }
                             @for (col of restriccionColumnas(); track col.key) {
                               <th class="priv-th priv-restrict-header px-1 py-1.5 text-center min-w-[56px] border-l border-amber-400/[0.18]" [title]="permisoTooltip(col.key)">
                                 <div class="inline-flex items-center gap-0.5 justify-center">
                                   <svg class="w-2 h-2 text-amber-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                   <span class="text-[8px] font-black text-amber-200 uppercase tracking-[0.02em] leading-tight whitespace-normal">{{ col.label }}</span>
                                 </div>
                               </th>
                             }
                             <th class="priv-th px-1 py-1.5 text-center min-w-[80px] border-l border-white/[0.07]">
                               <span class="text-[8px] font-black text-white uppercase tracking-[0.02em] leading-tight whitespace-normal block">Oratoria</span>
                             </th>
                           </tr>
                         </thead>
                         <tbody>
                              @for (pub of paginatedPublicadores(); track pub.id_publicador; let idx = $index) {
                                <tr class="priv-row group border-b border-slate-100 dark:border-slate-800/60 hover:bg-purple-50/40 dark:hover:bg-purple-900/10"
                                    [class.is-dirty]="isDirty(pub.id_publicador)"
                                    [ngClass]="isDirty(pub.id_publicador)
                                      ? 'bg-amber-50/40 dark:bg-amber-900/10'
                                      : (idx % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-800/20' : '')">
                                   <td class="px-4 py-1.5 sticky left-0 bg-white dark:bg-slate-900 z-10 group-hover:bg-purple-50/40 dark:group-hover:bg-purple-900/10 transition-colors border-r border-slate-100 dark:border-slate-800/60">
                                       <div class="flex items-center gap-2.5">
                                           <div class="priv-avatar w-8 h-8 rounded-xl flex items-center justify-center font-black text-[0.6875rem] shrink-0"
                                                [class]="avatarClass(pub)">
                                             {{ pub.primer_nombre[0] }}{{ pub.primer_apellido[0] }}
                                           </div>
                                           <div class="min-w-0">
                                               <div class="text-[0.8125rem] font-bold text-slate-800 dark:text-white truncate max-w-[130px] leading-tight tracking-tight" [title]="pub.primer_nombre + ' ' + pub.primer_apellido">
                                         {{ pub.primer_nombre.split(' ')[0] }} {{ pub.primer_apellido.split(' ')[0] }}
                                     </div>
                                     <div class="flex flex-wrap gap-1 mt-1">
                                         @if (pub.privilegios.length > 0) {
                                           @for (priv of pub.privilegios; track priv) {
                                             <div class="text-[9px] font-bold px-1.5 py-0.5 inline-block rounded-md leading-none"
                                                  [title]="priv"
                                                  [class]="privilegioBadgeClass(priv)">
                                               {{ privilegioLabel(priv) }}
                                             </div>
                                           }
                                         } @else {
                                           <span class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-semibold tracking-wide">{{ isHermano(pub) ? 'Hermano' : 'Hermana' }}</span>
                                         }
                                     </div>
                                           </div>
                                       </div>
                                   </td>
                                   <td *ngFor="let col of columnas()"
                                       class="priv-cell px-1 py-1.5 text-center border-l"
                                       [class]="col.key.startsWith('no_')
                                         ? 'border-amber-200/40 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10'
                                         : 'border-slate-100/70 dark:border-slate-800/40'">
                                         <label class="inline-flex items-center justify-center cursor-pointer p-1" [title]="permisoTooltip(col.key)">
                                           <input type="checkbox"
                                             [checked]="getPermiso(pub, col.key)"
                                             (change)="togglePermiso(pub, col.key)"
                                             [disabled]="!hasEditPermission()"
                                             class="priv-check">
                                         </label>
                                   </td>
                                   <td class="px-2 py-1.5 text-center border-l border-slate-100/70 dark:border-slate-800/40">
                                     <select
                                       [ngModel]="getOratoria(pub)"
                                       (ngModelChange)="setOratoria(pub, $event)"
                                       [attr.data-level]="getOratoria(pub)"
                                       [disabled]="!hasEditPermission()"
                                       class="priv-select w-[92px]"
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
                  <div class="shrink-0 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
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

       <!-- ===== MODAL: DUPLICATE DETECTION MWB ===== -->
       @if (mwbShowDuplicateModal()) {
         <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
           <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slideDown">
             <div class="p-6">
               <div class="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4 mx-auto">
                 <svg class="w-6 h-6 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
               </div>

               <h3 class="text-lg font-black text-slate-900 dark:text-white text-center tracking-tight">¡Atención! Semanas Ya Existentes</h3>
               <p class="text-sm text-slate-500 dark:text-slate-400 text-center mt-2 leading-relaxed px-2">
                 Se han detectado programas creados para las siguientes fechas. Si continúa, los datos actuales serán <b>reemplazados</b> por la nueva importación.
               </p>

               <div class="mt-5 space-y-2 max-h-48 overflow-y-auto pr-1 simple-scrollbar">
                 @for (dup of mwbDuplicates(); track $index) {
                   <div class="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                     <div class="min-w-0">
                       <p class="text-[0.6875rem] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide truncate">{{ dup.titulo_guia }}</p>
                       <p class="text-[0.625rem] text-slate-400 font-bold tabular-nums">Semana {{ dup.semana_iso }} ({{ dup.fecha }})</p>
                     </div>
                     <span class="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 uppercase tracking-tighter">Existente</span>
                   </div>
                 }
               </div>
             </div>

             <div class="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
               <button (click)="dismissDuplicateModal()"
                       class="flex-1 h-10 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all">
                 Cancelar
               </button>
               <button (click)="acceptDuplicateReplace()"
                       [disabled]="mwbConfirming()"
                       class="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm shadow-amber-900/20 transition-all flex items-center justify-center gap-2">
                 @if (mwbConfirming()) {
                   <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                 }
                 Reemplazar Datos
               </button>
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
                   border-color 160ms ease;
     }
     .priv-stat:hover {
       box-shadow: 0 4px 14px -4px rgba(15,23,42,0.08);
       border-color: rgba(109,40,217,0.18);
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
       left: 0; top: 4px; bottom: 4px;
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
       width: 18px; height: 18px;
       border-radius: 6px;
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
         box-shadow: 0 0 0 4px rgba(109,40,217,0.10);
       }
     }
     .priv-check:active:not(:disabled) { transform: scale(0.9); }
     .priv-check:checked {
       background: linear-gradient(180deg, #7c3aed, #6D28D9);
       border-color: #6D28D9;
       box-shadow: 0 3px 8px -2px rgba(109,40,217,0.45);
     }
     .priv-check:checked::after {
       content: '';
       position: absolute;
       left: 5px; top: 1.5px;
       width: 5px; height: 10px;
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
       background-position: right 7px center;
       padding-right: 22px !important;
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

     /* Avatar */
     .priv-avatar {
       box-shadow: 0 1px 3px rgba(15,23,42,0.10), inset 0 0 0 1.5px rgba(255,255,255,0.6);
       transition: transform 220ms var(--ease-out-strong), box-shadow 200ms ease;
     }
     .priv-row:hover .priv-avatar { transform: scale(1.06); box-shadow: 0 3px 8px rgba(15,23,42,0.14), inset 0 0 0 1.5px rgba(255,255,255,0.7); }

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

     @media (prefers-reduced-motion: reduce) {
       .priv-stat, .priv-row, .priv-check, .priv-select, .priv-avatar, .priv-page-btn,
       .priv-row > td:first-child::before,
       .algo-profile-card, .algo-stepper-btn { transition: none !important; animation: none !important; }
     }
  `]
})
export class ReunionesConfiguracionPlantillasComponent implements OnInit {

  private reunionesSvc = inject(ReunionesService);
  private congregacionCtx = inject(CongregacionContextService);
  private authStore = inject(AuthStore);
  private tokenSvc = inject(TokenService);

  hasEditPermission = computed(() => {
    return this.authStore.hasPermission('reuniones.configuracion_editar') || !!this.authStore.user()?.roles?.includes('Secretario');
  });

  // ── Tabs ──
  private allTabs = [
    { id: 'privilegios', label: 'Asignación de Privilegios', adminOnly: false },
    { id: 'parametros', label: 'Parámetros del Algoritmo', adminOnly: true },
    { id: 'plantillas', label: 'Plantillas de Reunión', adminOnly: true }
  ];

  visibleTabs = computed(() => {
    const isAdmin = this.hasRole('Administrador') || this.hasRole('Gestor Aplicación');
    return this.allTabs.filter(t => !t.adminOnly || isAdmin);
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
  mwbDuplicates = signal<Array<{ semana_iso: number; ano: number; titulo_guia: string; fecha: string | null }>>([]);
  mwbShowDuplicateModal = signal(false);
  private mwbPendingPayload: any = null;

  // ── Plantillas Histórico ──
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
      const ord = parte.semana_ordinal || 1;
      if (!weeksMap.has(ord)) {
        weeksMap.set(ord, {
          partes: [],
          titulo_semana: parte.titulo_semana,
          lectura_semanal: parte.lectura_semanal,
        });
      }
      weeksMap.get(ord)!.partes.push(parte);
    });
    return Array.from(weeksMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ordinal, data]) => ({ ordinal, ...data }));
  });

  // ── Matriz de Publicadores (Privilegios) ──
  publicadores = signal<PublicadorMatrizItem[]>([]);
  columnas = signal<ColumnaPermiso[]>([]);
  regularColumnas = computed(() => this.columnas().filter(c => !c.key.startsWith('no_')));
  restriccionColumnas = computed(() => this.columnas().filter(c => c.key.startsWith('no_')));

  private readonly PERMISO_LABELS: Record<string, string> = {
    presidente_entre_semana:       'Presidente de la reunión entre semana',
    presidente_fin_semana:         'Presidente de la reunión fin de semana',
    orador:                        'Conferenciante / Orador público',
    lector_libro:                  'Lector del Libro (Estudio de Libro)',
    lector_atalaya:                'Lector de La Atalaya',
    oracion:                       'Oración pública',
    acomodador:                    'Acomodador',
    microfono:                     'Micrófono',
    audio:                         'Mesa de audio',
    video:                         'Mesa de video',
    vigilancia:                    'Vigilancia',
    sala_principal:                'Sala principal',
    sala_auxiliar:                 'Sala auxiliar (Sala B)',
    capitan_predicacion:           'Capitán de predicación',
    plataforma:                    'Plataforma (presentaciones y multimedia)',
    no_discursa_mejores_maestros:  'No participa en partes de Seamos Mejores Maestros',
  };

  permisoTooltip(key: string): string {
    return this.PERMISO_LABELS[key] ?? key.replace(/_/g, ' ');
  }
  matrizLoading = signal(false);
  matrizSaving = signal(false);
  matrizErrorMsg = signal<string | null>(null);
  searchQuery = signal('');
  filtroSexo = signal<'todos' | 'solo_hombres' | 'solo_mujeres'>('todos');
  currentPage = signal(1);
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
    if (q) {
      list = list.filter(p => `${p.primer_nombre} ${p.primer_apellido}`.toLowerCase().includes(q));
    }
    if (sexoFilter === 'solo_hombres') {
      list = list.filter(p => this.isHermano(p));
    } else if (sexoFilter === 'solo_mujeres') {
      list = list.filter(p => !this.isHermano(p));
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

  constructor() {
    effect(() => {
      if (this.activeTab() === 'parametros' && !this.algoLoaded) {
        this.loadAlgoProfiles();
      }
      if (this.activeTab() === 'privilegios' && !this.matrizLoaded) {
        this.loadMatriz();
      }
    });
  }

  // ── Lifecycle ──
  ngOnInit(): void {
    this.loadSavedPlantillas();
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
      const response = await fetch(
        `${environment.apiUrl}/reuniones/programas/importar-mwb/stream`,
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

    const idCongregacion = this.congregacionCtx.effectiveCongregacionId();
    if (!idCongregacion) {
        this.showToast('error', 'Seleccione una congregacion');
        return;
    }

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

    const payload: MWBImportConfirmRequest = {
        id_congregacion: idCongregacion,
        semanas: semanasConfirm
    };

    this.mwbConfirming.set(true);
    this.reunionesSvc.checkMWBDuplicates(payload).subscribe({
        next: (res) => {
            if (res.duplicados && res.duplicados.length > 0) {
                this.mwbDuplicates.set(res.duplicados);
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
    this.mwbConfirming.set(true);
    this.reunionesSvc.confirmarMWB(payload).subscribe({
        next: (res) => {
            this.showToast('success', `${res.mensaje}. Programas creados: ${res.programas_creados}`);
            this.mwbConfirming.set(false);
            this.mwbPreview.set(null);
            this.mwbDates.set(new Map());
            this.mwbShowDuplicateModal.set(false);
            this.mwbPendingPayload = null;
            this.loadSavedPlantillas(); // Refrescar el histórico automáticamente
        },
        error: (err) => {
            console.error('Error al confirmar MWB:', err);
            this.showToast('error', 'Error al procesar la confirmación');
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
    this.mwbDuplicates.set([]);
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
    const idCongregacion = this.congregacionCtx.effectiveCongregacionId();
    if (!idCongregacion) return;

    this.plantillasLoading.set(true);
    this.reunionesSvc.getPlantillas('entre_semana', idCongregacion).subscribe({
      next: (res) => {
        this.savedPlantillas.set(res);
        this.plantillasLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.plantillasLoading.set(false);
      }
    });
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
      if ((parte.semana_ordinal || 1) === ordinal) {
        (parte as any)[field] = value;
      }
    });
    this.selectedPlantilla.set({ ...p, partes: [...p.partes] });
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
        this.showToast('error', 'Error al eliminar plantilla');
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
        this.matrizLoading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.detail ?? err?.message ?? 'Error al cargar la configuración.';
        this.matrizErrorMsg.set(msg);
        this.matrizLoading.set(false);
      }
    });
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

  avatarClass(pub: PublicadorMatrizItem): string {
    const base = 'bg-gradient-to-br ';
    if (pub.privilegios.includes('Anciano') || pub.privilegios.includes('Superintendente')) {
      return base + 'from-amber-100 to-yellow-100 text-amber-700';
    }
    if (pub.privilegios.includes('Siervo Ministerial')) {
      return base + 'from-blue-100 to-cyan-100 text-blue-700';
    }
    if (!this.isHermano(pub)) {
      return base + 'from-pink-100 to-rose-100 text-pink-600';
    }
    return base + 'from-slate-100 to-slate-200 text-slate-600';
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

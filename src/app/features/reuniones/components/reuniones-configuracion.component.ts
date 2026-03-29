import { Component, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { environment } from '../../../../environments/environment';
import {
  PublicadorMatrizItem,
  ColumnaPermiso,
  CambioPermisoPublicador,
  UpdateMatrizRequest,
  MWBImportPreviewResponse,
  MWBImportConfirmRequest,
  SemanaConfirm,
  AlgorithmParam
} from '../models/reuniones.models';

@Component({
  selector: 'app-reuniones-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col gap-5 h-full">

       <!-- ===== PAGE HEADER ===== -->
       <div class="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
           <div>
               <h2 class="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">Configuracion del Motor</h2>
               <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Ajuste las capacidades de los publicadores para las asignaciones automaticas.</p>
           </div>
           <div class="flex items-center gap-2 shrink-0">
               @if (hasPendingChanges() || algoHasDirty()) {
                 <span class="text-[10px] font-bold text-amber-500 dark:text-amber-400 animate-pulse">
                   {{ pendingCount() + (algoHasDirty() ? 1 : 0) }} cambio{{ (pendingCount() + (algoHasDirty() ? 1 : 0)) > 1 ? 's' : '' }}
                 </span>
               }
               <button
                 (click)="guardarCambios()"
                 [disabled]="(!hasPendingChanges() && !algoHasDirty()) || saving() || algoSaving()"
                 class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
                   @if (saving() || algoSaving()) {
                     <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   } @else {
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                   }
                   Guardar
               </button>
           </div>
       </div>

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

       <!-- ===== COMPACT TOOLBAR: Tabs + Search + Filters ===== -->
       <div class="shrink-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 p-1.5 flex items-center gap-1.5 flex-wrap lg:flex-nowrap">

           <!-- Tab pills -->
           <div class="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
             @for (tab of configTabs; track tab.id) {
               <button
                 (click)="activeTab.set(tab.id)"
                 class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                 [class]="activeTab() === tab.id
                   ? 'bg-[#6D28D9] text-white shadow-sm'
                   : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'">
                 <span [innerHTML]="tab.icon"></span>
                 {{ tab.label }}
               </button>
             }
           </div>

           <!-- Separator -->
           <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden lg:block shrink-0"></div>

           <!-- Search (publicadores tab only) -->
           @if (activeTab() === 'publicadores') {
             <div class="relative flex-1 min-w-[200px]">
                 <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                 </div>
                 <input type="text"
                   [ngModel]="searchQuery()"
                   (ngModelChange)="searchQuery.set($event)"
                   placeholder="Buscar publicador..."
                   class="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-slate-800/50 border border-transparent dark:border-slate-700/50 rounded-lg text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-[#6D28D9]/50 focus:ring-2 focus:ring-[#6D28D9]/20 transition-all outline-none">
             </div>

             <!-- Separator -->
             <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden lg:block shrink-0"></div>

             <!-- Sex filter pills -->
             <div class="hidden md:flex items-center gap-1 shrink-0">
                 <button
                   (click)="setFiltroSexo('solo_hombres')"
                   class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                   [class]="filtroSexo() === 'solo_hombres'
                     ? 'bg-blue-500 text-white shadow-sm'
                     : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'">
                     Hermanos
                 </button>
                 <button
                   (click)="setFiltroSexo('solo_mujeres')"
                   class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                   [class]="filtroSexo() === 'solo_mujeres'
                     ? 'bg-rose-500 text-white shadow-sm'
                     : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'">
                     Hermanas
                 </button>
             </div>
           }
       </div>

       <!-- ===== TAB: MATRIZ DE PUBLICADORES ===== -->
       @if (activeTab() === 'publicadores') {
        <div class="flex-1 min-h-0 flex flex-col gap-4">

           <!-- Loading -->
           @if (loading()) {
             <div class="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center">
               <div class="flex flex-col items-center gap-3">
                 <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-[#6D28D9] animate-spin"></div>
                 <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">Cargando publicadores...</p>
               </div>
             </div>
           }

           <!-- Error -->
           @if (errorMsg()) {
             <div class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 flex items-center gap-3">
               <div class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                 <svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
               </div>
               <div class="flex-1 min-w-0">
                 <p class="text-sm font-bold text-red-700 dark:text-red-300">Error al cargar</p>
                 <p class="text-xs text-red-500 dark:text-red-400/80 truncate">{{ errorMsg() }}</p>
               </div>
               <button (click)="loadMatriz()" class="shrink-0 px-3 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-xs text-red-600 dark:text-red-400 font-bold transition-all">
                 Reintentar
               </button>
             </div>
           }

           @if (!loading() && !errorMsg()) {
             <!-- Stats bar -->
             <div class="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-slate-800 dark:text-white tabular-nums">{{ filteredPublicadores().length }}</p>
                 <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Publicadores</p>
               </div>
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{{ countPrivilegio('Anciano') }}</p>
                 <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Ancianos</p>
               </div>
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{{ countPrivilegio('Siervo Ministerial') }}</p>
                 <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">S. Ministeriales</p>
               </div>
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-slate-600 dark:text-slate-300 tabular-nums">{{ countPrecursores() }}</p>
                 <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Precursores</p>
               </div>
             </div>

             <!-- Data Table -->
             <div class="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                 <div class="flex-1 min-h-0 overflow-x-auto overflow-y-auto simple-scrollbar">
                     <table class="w-full min-w-max text-left border-collapse">
                         <thead class="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                             <tr class="border-b border-slate-200 dark:border-slate-700">
                                 <th class="px-4 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md z-10 min-w-[150px]">Publicador</th>
                                 <th class="px-2 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[80px]">Privilegio</th>
                                 <th *ngFor="let col of columnas()"
                                     class="px-2 py-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[70px] leading-tight whitespace-normal">
                                   {{ col.label }}
                                 </th>
                                 <th class="px-2 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[90px] leading-tight whitespace-normal">
                                   Nivel Oratoria
                                 </th>
                             </tr>
                         </thead>
                         <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                              @for (pub of paginatedPublicadores(); track pub.id_publicador) {
                                <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                    [class.bg-amber-50/30]="isDirty(pub.id_publicador)"
                                    [class.dark:bg-amber-900/10]="isDirty(pub.id_publicador)">

                                   <!-- Publicador -->
                                   <td class="px-4 py-2 sticky left-0 bg-white dark:bg-slate-900 z-10 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 transition-colors border-r border-slate-100 dark:border-slate-800/50">
                                       <div class="flex items-center gap-3">
                                           <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ring-1 ring-white dark:ring-slate-800"
                                                [class]="avatarClass(pub)">
                                             {{ pub.primer_nombre[0] }}{{ pub.primer_apellido[0] }}
                                           </div>
                                           <div>
                                               <div class="text-[13px] font-bold text-slate-800 dark:text-white truncate max-w-[140px] leading-tight" [title]="pub.primer_nombre + ' ' + pub.primer_apellido">
                                         {{ pub.primer_nombre.split(' ')[0] }} {{ pub.primer_apellido.split(' ')[0] }}
                                     </div>
                                     <div class="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                         {{ isHermano(pub) ? 'Hermano' : 'Hermana' }}
                                     </div>
                                           </div>
                                       </div>
                                   </td>

                                   <!-- Privilegio -->
                                   <td class="px-2 py-2 text-center">
                                       <div class="flex flex-wrap gap-1 justify-center">
                                         @for (priv of pub.privilegios; track priv) {
                                           <div class="text-[9px] font-bold px-1.5 py-0.5 inline-block rounded-md"
                                                [title]="priv"
                                                [class]="privilegioBadgeClass(priv)">
                                             {{ privilegioLabel(priv) }}
                                           </div>
                                         }
                                       </div>
                                   </td>

                                   <!-- Permisos checkboxes -->
                                   <td *ngFor="let col of columnas()"
                                       class="px-1 py-2 text-center">
                                         <label class="inline-flex items-center justify-center cursor-pointer p-1">
                                           <input type="checkbox"
                                             [checked]="getPermiso(pub, col.key)"
                                             (change)="togglePermiso(pub, col.key)"
                                             class="w-4 h-4 text-[#6D28D9] rounded border-slate-300 dark:border-slate-600 focus:ring-[#6D28D9] focus:ring-offset-0 cursor-pointer transition-colors">
                                         </label>
                                   </td>
                                   
                                   <!-- Nivel Oratoria Selector -->
                                   <td class="px-2 py-2 text-center">
                                     <select
                                       [ngModel]="getOratoria(pub)"
                                       (ngModelChange)="setOratoria(pub, $event)"
                                       class="h-7 px-1 w-[85px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[9px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#6D28D9]/20 transition-all cursor-pointer truncate"
                                       [class.border-amber-400]="isOratoriaDirty(pub.id_publicador)">
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
                  <div class="shrink-0 px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <span class="text-[11px] text-slate-400 dark:text-slate-500 font-medium tabular-nums">
                      {{ (currentPage() - 1) * pageSize() + 1 }}–{{ Math.min(currentPage() * pageSize(), filteredPublicadores().length) }}
                      <span class="text-slate-300 dark:text-slate-600">de</span>
                      {{ filteredPublicadores().length }}
                    </span>
                    <div class="flex items-center gap-0.5">
                        <button (click)="prevPage()"
                                [disabled]="currentPage() === 1"
                                class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-slate-400 dark:text-slate-500 flex items-center justify-center">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"/></svg>
                        </button>

                        @for (item of getPagesArray(); track $index) {
                          @if (item === null) {
                            <span class="w-7 h-7 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-600 select-none">···</span>
                          } @else {
                            <button (click)="setPage(item)"
                                    class="w-7 h-7 rounded-lg text-xs font-bold transition-all"
                                    [class]="currentPage() === item
                                      ? 'bg-[#6D28D9] text-white shadow-sm'
                                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'">
                              {{ item }}
                            </button>
                          }
                        }

                        <button (click)="nextPage()"
                                [disabled]="currentPage() === totalPages()"
                                class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-slate-400 dark:text-slate-500 flex items-center justify-center">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/></svg>
                        </button>
                    </div>
                  </div>
              </div>
            }
        </div>
       }

       <!-- ===== TAB: PLANTILLAS (MWB UPLOAD) ===== -->
       @if (activeTab() === 'plantillas') {
        <div class="flex-1 min-h-0 flex flex-col gap-6">
           <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 flex flex-col items-center justify-center text-center shrink-0 transition-all"
                [class]="mwbPreview() ? 'py-5' : 'py-12'">
               <div class="w-14 h-14 bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-blue-900/20 dark:via-slate-800 dark:to-cyan-900/10 rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-blue-100/50 dark:border-blue-800/30">
                  <svg class="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
               </div>
               <h3 class="font-bold text-slate-800 dark:text-white mb-1">Motor de PDF Guía de Actividades</h3>
               @if (!mwbPreview()) {
                   <p class="text-[13px] text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">Suba el archivo PDF mensual de la Guía de Actividades (MWB) para automatizar la estructura de las reuniones de estudio de forma determinista.</p>
               }
               
               <input type="file" #fileInput (change)="onFileSelected($event)" accept=".pdf" class="hidden">

               @if (mwbLoading()) {
                 <div class="w-full max-w-sm mt-2">
                   <div class="flex items-center justify-between mb-1.5">
                     <span class="text-xs font-bold text-slate-600 dark:text-slate-300">{{ mwbProgressMessage() || 'Iniciando...' }}</span>
                     <span class="text-xs font-mono font-bold text-[#6D28D9]">{{ mwbProgress() }}%</span>
                   </div>
                   <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                     <div class="bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] h-2 rounded-full transition-all duration-500 ease-out"
                       [style.width.%]="mwbProgress()"></div>
                   </div>
                 </div>
               } @else {
                 <button (click)="fileInput.click()" [disabled]="mwbConfirming()" class="h-10 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-[13px] font-bold rounded-xl shadow-sm transition-all flex items-center gap-2">
                   <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                   <span>{{ mwbPreview() ? 'Subir Otro PDF' : 'Subir Guía PDF' }}</span>
                 </button>
               }
           </div>
           
           <!-- MWB Preview Area -->
           @if (mwbPreview()) {
             <div class="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col min-h-0 animate-fadeIn">
               <div class="flex items-center justify-between mb-5 shrink-0 px-1 border-b border-transparent">
                 <div>
                   <h3 class="text-base font-bold text-slate-800 dark:text-white">{{ mwbPreview()?.mensaje }}</h3>
                   <span class="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">Se detectaron {{ mwbPreview()?.semanas?.length }} semanas en el archivo. Configure la fecha Lunes correspondiente para cada una.</span>
                 </div>
                 <button (click)="confirmMWB()" [disabled]="mwbConfirming()" class="h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold rounded-xl shadow-sm shadow-emerald-900/20 transition-all flex items-center gap-2 disabled:opacity-50">
                    @if (mwbConfirming()) {
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Generando Estructuras...</span>
                    } @else {
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Confirmar e Importar</span>
                    }
                 </button>
               </div>
               
               <div class="overflow-y-auto min-h-0 space-y-4 pr-2">
                 @for (semana of mwbPreview()?.semanas; track $index; let i = $index) {
                   <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                     <div class="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                       <div class="flex items-center gap-2.5">
                           <div class="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">W{{ i + 1 }}</div>
                           <h4 class="text-[13px] font-bold text-slate-800 dark:text-white uppercase tracking-wide">{{ semana.titulo_semana }}</h4>
                       </div>
                       
                       <div class="flex items-center gap-2 sm:ml-auto">
                           <label class="text-[11px] font-bold text-slate-500 uppercase">Día Lunes:</label>
                           <input type="date" 
                               [ngModel]="mwbDates().get(i) || ''"
                               (ngModelChange)="updateMwbDate(i, $event)"
                               class="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none w-[140px]">
                       </div>
                     </div>
                     <div class="p-0 bg-white dark:bg-slate-900">
                       <table class="w-full text-left border-collapse">
                         <tbody>
                           @for (parte of semana.partes; track $index) {
                             <tr class="border-b last:border-b-0 border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                               <td class="py-3 px-5">
                                 <div class="text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                     {{ parte.nombre_parte }}
                                     @if (parte.aplica_sala_b) {
                                         <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">Sala B</span>
                                     }
                                     @if (parte.requiere_pareja) {
                                         <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Pareja</span>
                                     }
                                 </div>
                                 <div class="text-[11px] text-slate-500 mt-0.5">{{ parte.seccion }}</div>
                               </td>
                               <td class="py-3 px-5 text-right w-24">
                                 <span class="inline-flex py-1 px-2 mb-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded overflow-hidden text-[11px] font-bold">
                                   {{ parte.duracion_minutos }} min
                                 </span>
                               </td>
                             </tr>
                           }
                         </tbody>
                       </table>
                     </div>
                   </div>
                 }
               </div>
             </div>
           }
        </div>
       }

       <!-- ===== TAB: PARÁMETROS ===== -->
       @if (activeTab() === 'parametros') {
        <div class="flex-1 min-h-0 flex flex-col gap-4 animate-fadeIn overflow-y-auto">

          @if (algoLoading()) {
            <div class="flex items-center justify-center py-12">
              <div class="w-6 h-6 border-2 border-[#6D28D9] border-t-transparent rounded-full animate-spin"></div>
            </div>
          }

          @if (!algoLoading() && algoParams().length > 0) {

            <!-- Indicador suma de pesos -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
              <div class="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                <svg class="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Suma de pesos heurísticos:</span>
                <span class="text-sm font-black font-mono shrink-0"
                  [class]="Math.abs(algoWeightSum() - 1.0) > 0.05 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'">
                  {{ algoWeightSum().toFixed(2) }}
                </span>
                @if (Math.abs(algoWeightSum() - 1.0) > 0.05) {
                  <span class="text-[10px] text-amber-500 font-bold block sm:inline w-full sm:w-auto ml-0 sm:ml-1 mt-1 sm:mt-0">Los pesos deben sumar ~1.0</span>
                }
              </div>
              <div class="flex items-center justify-end w-full sm:w-auto">
                <button (click)="resetAlgoDefaults()"
                  class="text-[10px] font-bold px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-300 hover:text-[#6D28D9] transition-all shrink-0">
                  Restaurar por defecto
                </button>
              </div>
            </div>

            <!-- Pesos Heuristicos -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden shrink-0">
              <div class="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <h4 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Pesos Heurísticos</h4>
                <p class="text-[10px] text-slate-400 mt-0.5">Controlan la prioridad relativa de cada criterio al asignar publicadores.</p>
              </div>
              @for (param of algoByCategory().peso_heuristico; track param.key) {
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ param.label }}</div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug whitespace-normal break-words">{{ param.description }}</div>
                  </div>
                  <div class="flex items-center shrink-0 pr-2 pb-1 sm:pb-0 sm:pr-0">
                    <input type="range"
                      [min]="param.min_val" [max]="param.max_val" [step]="param.step"
                      [ngModel]="getAlgoValue(param)"
                      (ngModelChange)="onAlgoParamChange(param.key, $event)"
                      class="w-32 h-1.5 accent-[#6D28D9] cursor-pointer block">
                    <span class="w-12 text-center font-mono text-sm font-black text-slate-700 dark:text-slate-200 block"
                      [class.text-amber-500]="isAlgoDirty(param.key)">
                      {{ getAlgoValue(param).toFixed(2) }}
                    </span>
                  </div>
                </div>
              }
            </div>

            <!-- Ventanas de Tiempo -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden shrink-0">
              <div class="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <h4 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Ventanas de Tiempo</h4>
                <p class="text-[10px] text-slate-400 mt-0.5">Periodos en días usados para normalizar y evaluar asignaciones.</p>
              </div>
              @for (param of algoByCategory().ventana_tiempo; track param.key) {
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ param.label }}</div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug whitespace-normal break-words">{{ param.description }}</div>
                  </div>
                  <div class="flex items-center shrink-0 pr-2 pb-1 sm:pb-0 sm:pr-0">
                    <input type="number"
                      [min]="param.min_val" [max]="param.max_val" [step]="param.step"
                      [ngModel]="getAlgoValue(param)"
                      (ngModelChange)="onAlgoParamChange(param.key, $event)"
                      class="w-20 h-8 px-2 text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-mono font-bold text-slate-700 dark:text-slate-200 focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 outline-none transition-all block"
                      [class.border-amber-400]="isAlgoDirty(param.key)">
                    <span class="text-[10px] text-slate-400 w-8 pl-1 block">días</span>
                  </div>
                </div>
              }
            </div>

            <!-- Restricciones Duras -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden shrink-0">
              <div class="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <h4 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Restricciones Duras</h4>
                <p class="text-[10px] text-slate-400 mt-0.5">Límites estrictos que el motor respeta como reglas absolutas.</p>
              </div>
              @for (param of algoByCategory().restriccion_dura; track param.key) {
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ param.label }}</div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug whitespace-normal break-words">{{ param.description }}</div>
                  </div>
                  <div class="flex items-center shrink-0 pr-2 pb-1 sm:pb-0 sm:pr-0">
                    @if (param.key === 'algo_nivel_oratoria_default') {
                      <select
                        [ngModel]="getAlgoValue(param)"
                        (ngModelChange)="onAlgoParamChange(param.key, $event)"
                        class="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 outline-none transition-all cursor-pointer block"
                        [class.border-amber-400]="isAlgoDirty(param.key)">
                        <option [ngValue]="1">Principante (1)</option>
                        <option [ngValue]="2">Básico (2)</option>
                        <option [ngValue]="3">Intermedio (3)</option>
                        <option [ngValue]="4">Avanzado (4)</option>
                        <option [ngValue]="5">Experto (5)</option>
                      </select>
                    } @else {
                      <input type="number"
                        [min]="param.min_val" [max]="param.max_val" [step]="param.step"
                        [ngModel]="getAlgoValue(param)"
                        (ngModelChange)="onAlgoParamChange(param.key, $event)"
                        class="w-20 h-8 px-2 text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-mono font-bold text-slate-700 dark:text-slate-200 focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 outline-none transition-all block"
                        [class.border-amber-400]="isAlgoDirty(param.key)">
                      <div class="w-8 pl-1 block"></div>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="h-12 w-full shrink-0"><!-- Spacer bottom for scrolling --></div>
          }
        </div>
       }

    </div>
  `,
  styles: [`
     :host { display: block; height: 100%; }
     .animate-fadeIn {
       animation: fadeIn 0.2s ease-out;
     }
     .animate-slideDown {
       animation: slideDown 0.25s ease-out;
     }
     @keyframes fadeIn {
       from { opacity: 0; transform: translateY(4px); }
       to { opacity: 1; transform: translateY(0); }
     }
     @keyframes slideDown {
       from { opacity: 0; transform: translateY(-8px); }
       to { opacity: 1; transform: translateY(0); }
     }
     /* Sticky column shadow */
     td.sticky, th.sticky {
       box-shadow: 2px 0 6px -2px rgba(0,0,0,0.06);
     }
  `]
})
export class ReunionesConfiguracionComponent implements OnInit {

  private reunionesSvc = inject(ReunionesService);
  private congregacionCtx = inject(CongregacionContextService);

  // ── Tabs ──
  configTabs = [
     { id: 'publicadores', label: 'Matriz de Publicadores', icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
     { id: 'plantillas', label: 'Plantillas de Reunión', icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
     { id: 'parametros', label: 'Parámetros del Algoritmo', icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' }
  ];
  activeTab = signal('publicadores');

  // ── Data ──
  publicadores = signal<PublicadorMatrizItem[]>([]);
  columnas = signal<ColumnaPermiso[]>([]);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── MWB State ──
  mwbLoading = signal(false);
  mwbConfirming = signal(false);
  mwbPreview = signal<MWBImportPreviewResponse | null>(null);
  mwbDates = signal<Map<number, string>>(new Map());
  mwbProgress = signal(0);
  mwbProgressMessage = signal('');

  // ── Algorithm Params ──
  algoParams = signal<AlgorithmParam[]>([]);
  algoLoading = signal(false);
  algoSaving = signal(false);
  algoDirtyMap = signal<Map<string, number>>(new Map());
  private algoLoaded = false;

  algoByCategory = computed(() => {
    const params = this.algoParams();
    return {
      peso_heuristico: params.filter(p => p.category === 'peso_heuristico'),
      ventana_tiempo: params.filter(p => p.category === 'ventana_tiempo'),
      restriccion_dura: params.filter(p => p.category === 'restriccion_dura'),
    };
  });

  algoWeightSum = computed(() => {
    const params = this.algoParams();
    return params
      .filter(p => p.key.startsWith('algo_w_'))
      .reduce((sum, p) => sum + this.getAlgoValue(p), 0);
  });

  algoHasDirty = computed(() => this.algoDirtyMap().size > 0);

  // ── Filters & Pagination ──
  searchQuery = signal('');
  filtroSexo = signal<'todos' | 'solo_hombres' | 'solo_mujeres'>('todos');
  currentPage = signal(1);
  pageSize = signal(11);
  protected readonly Math = Math;

  // ── Change tracking ──
  private dirtyMap = new Map<number, Record<string, boolean>>();
  private dirtyOratoriaMap = new Map<number, number>();

  // ── Computed ──
  filteredPublicadores = computed(() => {
    let list = this.publicadores();
    const q = this.searchQuery().toLowerCase().trim();
    const sexoFilter = this.filtroSexo();

    if (q) {
      list = list.filter(p =>
        `${p.primer_nombre} ${p.primer_apellido}`.toLowerCase().includes(q)
      );
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

  algoValid = computed(() => Math.abs(this.algoWeightSum() - 1.0) <= 0.05);

  hasPendingChanges = computed(() => this.pendingCount() > 0 || (this.algoHasDirty() && this.algoValid()));
  pendingCount = signal(0);

  constructor() {
    effect(() => {
      if (this.activeTab() === 'parametros' && !this.algoLoaded) {
        this.loadAlgoParams();
      }
    }, { allowSignalWrites: true });
  }

  // ── Lifecycle ──
  ngOnInit(): void {
    this.loadMatriz();
  }

  loadMatriz(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) {
      this.errorMsg.set('No hay congregación seleccionada. Selecciona una en el panel de administración.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);
    this.dirtyMap.clear();
    this.dirtyOratoriaMap.clear();
    this.pendingCount.set(0);

    this.reunionesSvc.getMatrizConfiguracion(idCong).subscribe({
      next: (res) => {
        this.publicadores.set(res.publicadores);
        this.columnas.set(res.columnas);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.detail ?? err?.message ?? 'Error al cargar la configuración.';
        this.errorMsg.set(msg);
        this.loading.set(false);
      }
    });
  }

  // ── Permission Handling ──
  getPermiso(pub: PublicadorMatrizItem, key: string): boolean {
    // Check dirty first
    const dirty = this.dirtyMap.get(pub.id_publicador);
    if (dirty && key in dirty) {
      return dirty[key];
    }
    return pub.permisos[key] ?? false;
  }

  togglePermiso(pub: PublicadorMatrizItem, key: string): void {
    const current = this.getPermiso(pub, key);
    const newVal = !current;

    // Check if it's the same as original (undo)
    const original = pub.permisos[key] ?? false;
    let dirty = this.dirtyMap.get(pub.id_publicador);

    if (newVal === original) {
      // Revert — remove from dirty
      if (dirty) {
        delete dirty[key];
        if (Object.keys(dirty).length === 0) {
          this.dirtyMap.delete(pub.id_publicador);
        }
      }
    } else {
      // Mark as dirty
      if (!dirty) {
        dirty = {};
        this.dirtyMap.set(pub.id_publicador, dirty);
      }
      dirty[key] = newVal;
    }

    // Update signal
    this.pendingCount.set(this.dirtyMap.size + this.dirtyOratoriaMap.size);

    // Force reactivity update
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
    
    this.pendingCount.set(this.dirtyMap.size + this.dirtyOratoriaMap.size);
    this.publicadores.update(list => [...list]);
  }

  setFiltroSexo(filter: 'solo_hombres' | 'solo_mujeres'): void {
    if (this.filtroSexo() === filter) {
      this.filtroSexo.set('todos'); // Toggle off
    } else {
      this.filtroSexo.set(filter); // Toggle on
    }
  }

  // ── Save ──
  guardarCambios(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;

    if (this.algoHasDirty() && this.algoValid()) {
      this.saveAlgoParams();
    }

    if (this.pendingCount() > 0) {
      this.saving.set(true);
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
          // Apply dirty changes to the model as official values
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
          this.saving.set(false);
          this.dirtyMap.clear();
          this.dirtyOratoriaMap.clear();
          this.pendingCount.set(0);
          this.publicadores.update(list => [...list]);
          if (!this.algoHasDirty()) {
              this.showToast('success', res.message);
          }
        },
        error: (err) => {
          const msg = err?.error?.detail ?? 'Error al guardar los cambios.';
          this.saving.set(false);
          this.showToast('error', msg);
        }
      });
    }
  }

  // ── Pagination Helpers ──
  setPage(p: number) {
    this.currentPage.set(p);
  }

  prevPage() {
    if (this.currentPage() > 1) this.setPage(this.currentPage() - 1);
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) this.setPage(this.currentPage() + 1);
  }

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

  countHombres(): number {
    return this.filteredPublicadores().filter(p => this.isHermano(p)).length;
  }

  countPrecursores(): number {
    return this.filteredPublicadores().filter(p =>
      p.privilegios.includes('Precursor Regular') ||
      p.privilegios.includes('Precursor Especial')
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

      const token = localStorage.getItem('access_token') || '';
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
              const map = new Map<number, string>();
              res.semanas.forEach((_: any, i: number) => map.set(i, ''));
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
            this.showToast('error', `Falta configurar la fecha del Lunes para la semana ${i+1}`);
            return;
        }
    }

    const semanasConfirm: SemanaConfirm[] = preview.semanas.map((s, i) => {
       const dStr = datesMap.get(i)!;
       const localDate = new Date(dStr + 'T00:00:00'); // parse as local midnight
       return {
           semana_iso: this.getISOWeekNumber(localDate),
           ano: localDate.getFullYear(),
           fecha_lunes: dStr,
           titulo_semana: s.titulo_semana,
           partes: s.partes
       };
    });

    const payload: MWBImportConfirmRequest = {
        id_congregacion: idCongregacion,
        semanas: semanasConfirm
    };

    this.mwbConfirming.set(true);
    this.reunionesSvc.confirmarMWB(payload).subscribe({
        next: (res) => {
            this.showToast('success', `${res.mensaje}. Programas creados: ${res.programas_creados}`);
            this.mwbConfirming.set(false);
            this.mwbPreview.set(null);
            this.mwbDates.set(new Map());
        },
        error: (err) => {
            console.error(err);
            this.showToast('error', err?.error?.detail || 'Error al guardar estructura');
            this.mwbConfirming.set(false);
        }
    });
  }

  privilegioLabel(priv: string): string {
    const abreviaciones: Record<string, string> = {
      'Superintendente': 'Sup.',
      'Anciano': 'Anciano',
      'Siervo Ministerial': 'S.M.',
      'Precursor Especial': 'P. Esp.',
      'Precursor Regular': 'P. Reg.',
      'Precursor Auxiliar': 'P. Aux.',
      'Publicador': 'Pub.',
    };
    return abreviaciones[priv] ?? priv;
  }

  privilegioBadgeClass(priv: string): string {
    switch (priv) {
      case 'Anciano':
      case 'Superintendente':
        return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50';
      case 'Siervo Ministerial':
        return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50';
      case 'Precursor Regular':
      case 'Precursor Especial':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50';
      case 'Precursor Auxiliar':
        return 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700/50';
      default:
        return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
    }
  }

  // ── Algorithm Params Methods ──
  loadAlgoParams(): void {
    this.algoLoading.set(true);
    this.reunionesSvc.getAlgorithmParams().subscribe({
      next: (res) => {
        this.algoParams.set(res.parametros);
        this.algoDirtyMap.set(new Map());
        this.algoLoaded = true;
        this.algoLoading.set(false);
      },
      error: (err) => {
        this.showToast('error', err?.error?.detail || 'Error al cargar parámetros del algoritmo');
        this.algoLoading.set(false);
      }
    });
  }

  getAlgoValue(param: AlgorithmParam): number {
    const dirty = this.algoDirtyMap();
    return dirty.has(param.key) ? dirty.get(param.key)! : param.value;
  }

  isAlgoDirty(key: string): boolean {
    return this.algoDirtyMap().has(key);
  }

  onAlgoParamChange(key: string, value: any): void {
    const param = this.algoParams().find(p => p.key === key);
    if (!param) return;
    
    const numValue = Number(value);
    this.algoDirtyMap.update(map => {
      const newMap = new Map(map);
      if (numValue === param.value) {
        newMap.delete(key);
      } else {
        newMap.set(key, numValue);
      }
      return newMap;
    });
  }

  resetAlgoDefaults(): void {
    this.algoParams.update(params =>
      params.map(p => ({ ...p, value: p.default }))
    );
    
    const newDirty = new Map<string, number>();
    const params = this.algoParams();
    for (const p of params) {
      if (p.value !== p.default) {
        newDirty.set(p.key, p.default);
      }
    }
    this.algoDirtyMap.set(newDirty);
  }

  saveAlgoParams(): void {
    const currentDirty = this.algoDirtyMap();
    if (currentDirty.size === 0) return;

    this.algoSaving.set(true);
    const parametros: Record<string, number> = {};
    currentDirty.forEach((val, key) => {
      parametros[key] = val;
    });

    this.reunionesSvc.updateAlgorithmParams({ parametros }).subscribe({
      next: (res) => {
        this.algoParams.update(params =>
          params.map(p => currentDirty.has(p.key) ? { ...p, value: currentDirty.get(p.key)! } : p)
        );
        this.algoDirtyMap.set(new Map());
        this.algoSaving.set(false);
        this.showToast('success', res.message);
      },
      error: (err) => {
        this.algoSaving.set(false);
        this.showToast('error', err?.error?.detail || 'Error al guardar parámetros');
      }
    });
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 4000);
  }
}

import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import {
  PublicadorMatrizItem,
  ColumnaPermiso,
  CambioPermisoPublicador,
  UpdateMatrizRequest,
  MWBImportPreviewResponse,
  MWBImportConfirmRequest,
  SemanaConfirm
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
               @if (hasPendingChanges()) {
                 <span class="text-[10px] font-bold text-amber-500 dark:text-amber-400 animate-pulse">
                   {{ pendingCount() }} cambio{{ pendingCount() > 1 ? 's' : '' }}
                 </span>
               }
               <button
                 (click)="guardarCambios()"
                 [disabled]="!hasPendingChanges() || saving()"
                 class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
                   @if (saving()) {
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
                                 <th class="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md z-10 min-w-[200px]">Publicador</th>
                                 <th class="px-3 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[120px]">Privilegio</th>
                                 <th *ngFor="let col of columnas()"
                                     class="px-2 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[80px] whitespace-nowrap">
                                   {{ col.label }}
                                 </th>
                             </tr>
                         </thead>
                         <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                              @for (pub of paginatedPublicadores(); track pub.id_publicador) {
                                <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                    [class.bg-amber-50/30]="isDirty(pub.id_publicador)"
                                    [class.dark:bg-amber-900/10]="isDirty(pub.id_publicador)">

                                   <!-- Publicador -->
                                   <td class="px-6 py-3 sticky left-0 bg-white dark:bg-slate-900 z-10 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 transition-colors">
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
                                   <td class="px-3 py-3 text-center">
                                       <div class="flex flex-wrap gap-1 justify-center">
                                         @for (priv of pub.privilegios; track priv) {
                                           <div class="text-[10px] font-bold px-2 py-0.5 inline-block rounded-md"
                                                [class]="privilegioBadgeClass(priv)">
                                             {{ privilegioLabel(priv) }}
                                           </div>
                                         }
                                       </div>
                                   </td>

                                   <!-- Permisos checkboxes -->
                                   <td *ngFor="let col of columnas()"
                                       class="px-2 py-3 text-center">
                                         <label class="inline-flex items-center justify-center cursor-pointer">
                                           <input type="checkbox"
                                             [checked]="getPermiso(pub, col.key)"
                                             (change)="togglePermiso(pub, col.key)"
                                             class="w-[18px] h-[18px] text-[#6D28D9] rounded border-slate-300 dark:border-slate-600 focus:ring-[#6D28D9] focus:ring-offset-0 cursor-pointer transition-colors">
                                         </label>
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
               <button (click)="fileInput.click()" [disabled]="mwbLoading() || mwbConfirming()" class="h-10 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-[13px] font-bold rounded-xl shadow-sm transition-all flex items-center gap-2">
                 @if (mwbLoading()) {
                   <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                   <span>Analizando PDF...</span>
                 } @else {
                   <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                   <span>{{ mwbPreview() ? 'Subir Otro PDF' : 'Subir Guía PDF' }}</span>
                 }
               </button>
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
        <div class="flex-1 min-h-0">
           <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 flex flex-col items-center justify-center text-center">
               <div class="w-16 h-16 bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-violet-900/20 dark:via-slate-800 dark:to-purple-900/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-purple-100/50 dark:border-purple-800/30">
                  <svg class="w-8 h-8 text-purple-300 dark:text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
               </div>
               <h3 class="font-bold text-slate-800 dark:text-white mb-1">Parametros del Algoritmo</h3>
               <p class="text-xs text-slate-400 dark:text-slate-500 max-w-xs">Ajuste los pesos del motor de asignaciones (tiempo, oratoria, fatiga). Proximamente.</p>
           </div>
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

  // ── Filters & Pagination ──
  searchQuery = signal('');
  filtroSexo = signal<'todos' | 'solo_hombres' | 'solo_mujeres'>('todos');
  currentPage = signal(1);
  pageSize = signal(10);
  protected readonly Math = Math;

  // ── Change tracking ──
  private dirtyMap = new Map<number, Record<string, boolean>>();

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

  hasPendingChanges = computed(() => this.pendingCount() > 0);
  pendingCount = signal(0);

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
    this.pendingCount.set(this.dirtyMap.size);

    // Force reactivity update
    this.publicadores.update(list => [...list]);
  }

  isDirty(id: number): boolean {
    return this.dirtyMap.has(id);
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
    if (!idCong || this.dirtyMap.size === 0) return;

    this.saving.set(true);
    this.toast.set(null);

    const cambios: CambioPermisoPublicador[] = [];
    this.dirtyMap.forEach((permisos, id_publicador) => {
      cambios.push({ id_publicador, permisos });
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
            if (!dirty) return pub;
            return {
              ...pub,
              permisos: { ...pub.permisos, ...dirty }
            };
          })
        );
        this.saving.set(false);
        this.dirtyMap.clear();
        this.pendingCount.set(0);
        this.publicadores.update(list => [...list]);
        this.showToast('success', res.message);
      },
      error: (err) => {
        const msg = err?.error?.detail ?? 'Error al guardar los cambios.';
        this.saving.set(false);
        this.showToast('error', msg);
      }
    });
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
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.mwbLoading.set(true);
    this.reunionesSvc.importarMWB(file).subscribe({
      next: (res) => {
        this.mwbPreview.set(res);
        this.mwbLoading.set(false);
        this.showToast('success', res.mensaje);
        
        const map = new Map<number, string>();
        res.semanas.forEach((_, i) => map.set(i, ''));
        this.mwbDates.set(map);
      },
      error: (err) => {
        console.error(err);
        this.showToast('error', err?.error?.detail || 'Error al analizar PDF');
        this.mwbLoading.set(false);
      }
    });
    // Reset file input value to allow uploading the same file again
    event.target.value = null;
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
      'Publicador': 'Publicador',
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

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 4000);
  }
}

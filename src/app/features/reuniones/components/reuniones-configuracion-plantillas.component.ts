import { Component, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { environment } from '../../../../environments/environment';
import {
  MWBImportPreviewResponse,
  MWBImportConfirmRequest,
  SemanaConfirm,
  PlantillaOption,
  PlantillaDetailResponse,
  PlantillaParteDetail,
  PlantillaUpdateRequest,
  AlgorithmParam,
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

       <!-- ===== PAGE HEADER ===== -->
       <div class="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
           <div>
               <h2 class="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">Configuración de Reuniones</h2>
               <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Plantillas, parámetros del motor y asignación de privilegios.</p>
           </div>
           <!-- Save button for parametros tab -->
           @if (activeTab() === 'parametros') {
             <div class="flex items-center gap-2 shrink-0">
               @if (algoHasDirty()) {
                 <span class="text-[0.625rem] font-bold text-amber-500 dark:text-amber-400 animate-pulse">Cambios sin guardar</span>
               }
               <button
                 (click)="saveAlgoParams()"
                 [disabled]="!algoHasDirty() || !algoValid() || algoSaving()"
                 class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
                   @if (algoSaving()) {
                     <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   } @else {
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                   }
                   Guardar
               </button>
             </div>
           }
           <!-- Save button for privilegios tab -->
           @if (activeTab() === 'privilegios') {
             <div class="flex items-center gap-2 shrink-0">
               @if (matrizHasPending()) {
                 <span class="text-[0.625rem] font-bold text-amber-500 dark:text-amber-400 animate-pulse">
                   {{ matrizPendingCount() }} cambio{{ matrizPendingCount() > 1 ? 's' : '' }}
                 </span>
               }
               <button
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
             </div>
           }
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

       <!-- ===== TAB PILLS ===== -->
       <div class="shrink-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
         @for (tab of visibleTabs(); track tab.id) {
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

       <!-- ===== TAB: PLANTILLAS ===== -->
       @if (activeTab() === 'plantillas') {

       <!-- Compact Toolbar for Upload -->
       <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 transition-all">
           <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-blue-900/20 dark:via-slate-800 dark:to-cyan-900/10 rounded-xl flex items-center justify-center shadow-sm border border-blue-100/50 dark:border-blue-800/30 shrink-0">
                 <svg class="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div>
                  <h3 class="font-bold text-slate-800 dark:text-white text-sm">Generador de Plantillas (Motor IA)</h3>
                  <p class="text-[0.6875rem] text-slate-500 dark:text-slate-400 hidden sm:block">Suba el PDF de la Guía de Actividades para estructurar reuniones o crear nuevas plantillas.</p>
              </div>
           </div>

           <input type="file" #fileInput (change)="onFileSelected($event)" accept=".pdf" class="hidden">

           @if (mwbLoading()) {
             <div class="w-full sm:w-48 mt-1 sm:mt-0">
               <div class="flex items-center justify-between mb-1.5">
                 <span class="text-[0.625rem] font-bold text-slate-600 dark:text-slate-300">{{ mwbProgressMessage() || 'Analizando mediante IA...' }}</span>
                 <span class="text-[0.625rem] font-mono font-bold text-[#6D28D9]">{{ mwbProgress() }}%</span>
               </div>
               <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                 <div class="bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] h-full rounded-full transition-all duration-500 ease-out"
                   [style.width.%]="mwbProgress()"></div>
               </div>
             </div>
           } @else {
             <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
               <!-- Filtros mes y año -->
               <div class="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 h-9 shrink-0">
                   <div class="px-2 border-r border-slate-100 dark:border-slate-700 mr-1 hidden md:block">
                     <span class="text-[9px] uppercase tracking-wider font-black text-slate-400 dark:text-slate-500">Mes Inicial</span>
                   </div>
                   <select [ngModel]="mwbTargetMonth()" (ngModelChange)="mwbTargetMonth.set(+$event)" class="text-[0.6875rem] font-bold bg-transparent outline-none p-1 text-slate-700 dark:text-slate-200 focus:ring-1 rounded cursor-pointer">
                     <option [value]="1">Enero</option>
                     <option [value]="2">Febrero</option>
                     <option [value]="3">Marzo</option>
                     <option [value]="4">Abril</option>
                     <option [value]="5">Mayo</option>
                     <option [value]="6">Junio</option>
                     <option [value]="7">Julio</option>
                     <option [value]="8">Agosto</option>
                     <option [value]="9">Septiembre</option>
                     <option [value]="10">Octubre</option>
                     <option [value]="11">Noviembre</option>
                     <option [value]="12">Diciembre</option>
                  </select>
                  <input type="number" [ngModel]="mwbTargetYear()" (ngModelChange)="mwbTargetYear.set(+$event)" class="w-14 text-[0.6875rem] font-bold bg-transparent outline-none p-1 text-slate-700 dark:text-slate-200 focus:ring-1 rounded text-center" min="2020" max="2100">
               </div>
               
               <button (click)="fileInput.click()" [disabled]="mwbConfirming()" class="h-9 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-[0.6875rem] font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
                 <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                 <span>Subir PDF MWB</span>
               </button>
               <button (click)="mwbJsonInputOpen.set(!mwbJsonInputOpen())" class="h-9 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 text-[0.6875rem] font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
                 <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                 <span>Pegar JSON</span>
               </button>
               @if (plantillaEditing()) {
                 <button (click)="closePlantillaEditor()" class="h-9 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[0.6875rem] font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all justify-center sm:flex hidden w-full sm:w-auto">
                   Cerrar Editor
                 </button>
               }
             </div>
           }
       </div>

       @if (mwbJsonInputOpen()) {
         <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner p-4 shrink-0 transition-all animate-fadeIn mb-4">
           <h4 class="text-xs font-bold text-slate-800 dark:text-white mb-2">Pega aquí el JSON generado</h4>
           <textarea [ngModel]="mwbJsonText()" (ngModelChange)="mwbJsonText.set($event)" rows="6" class="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-[#6D28D9]/50 outline-none resize-y mb-3 h-48" placeholder='{"mensaje": "OK", "semanas": [{ "titulo_semana": "...", "partes": [] }]}'></textarea>
           <div class="flex items-center gap-2 justify-end">
              <button (click)="mwbJsonInputOpen.set(false)" class="h-8 px-4 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-[0.6875rem] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              <button (click)="processJsonInput()" class="h-8 px-4 bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-[0.6875rem] font-bold rounded-lg shadow-sm transition-all">Procesar JSON</button>
           </div>
         </div>
       }

       <!-- Split Content Area -->
       <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">

           <!-- Main Logic Panel (Preview / Editor) -->
           @if (mwbPreview() || (plantillaEditing() && selectedPlantilla())) {
             <div class="flex-[2] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-5 flex flex-col min-h-0 animate-fadeIn">
               <div class="flex items-center justify-between mb-4 shrink-0 px-1 border-b border-transparent">
                 <div>
                   <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                     {{ plantillaEditing() ? 'Modificando Plantilla' : (mwbPreview()?.mensaje || 'Confirmación de Estructura') }}
                   </h3>
                   <span class="text-[0.6875rem] font-medium text-emerald-600 dark:text-emerald-400 hidden sm:block">
                     {{ plantillaEditing() ? 'Los cambios afectarán solo a las generaciones futuras.' : 'Verifique y confirme la estructura propuesta por la IA.' }}
                   </span>
                 </div>
                 <div class="flex items-center gap-2">
                   @if (plantillaEditing()) {
                     <button (click)="savePlantillaEdit()" [disabled]="plantillasLoading()" class="h-8 px-4 bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-[0.6875rem] font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5">
                       @if (plantillasLoading()) {
                         <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                       }
                       Guardar
                     </button>
                   } @else {
                     <button (click)="confirmMWB()" [disabled]="mwbConfirming()" class="h-8 px-4 bg-emerald-500 hover:bg-emerald-600 text-white text-[0.6875rem] font-bold rounded-lg shadow-sm shadow-emerald-900/20 transition-all flex items-center gap-1.5 disabled:opacity-50">
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

               <div class="overflow-y-auto min-h-0 space-y-3 pr-1 sm:pr-2 simple-scrollbar">
                 <!-- MWB PREVIEW Mode -->
                 @if (mwbPreview()) {
                   @for (semana of mwbPreview()?.semanas; track $index; let i = $index) {
                     <div class="border border-slate-200 dark:border-slate-700/80 rounded-[14px] overflow-hidden shadow-sm">
                       <div class="bg-slate-50 dark:bg-slate-800/80 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                         <div class="flex items-center gap-2.5 flex-1 w-full">
                             <div class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[0.625rem] shrink-0">W{{ i + 1 }}</div>
                             <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                               <input [(ngModel)]="semana.titulo_semana" class="w-full bg-transparent border-none font-bold text-slate-800 dark:text-white uppercase tracking-wide text-[0.6875rem] sm:text-xs outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 min-w-0">
                               @if (semana.lectura_semanal) {
                                 <div class="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 px-1">
                                   <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                                   Lectura: {{ semana.lectura_semanal }}
                                 </div>
                               }
                             </div>
                         </div>

                         <div class="flex items-center gap-2 sm:ml-auto shrink-0">
                             <div class="flex items-center gap-1.5 shrink-0 hidden sm:flex">
                                 <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                 <label class="text-[0.625rem] font-bold text-slate-500 uppercase">Lunes:</label>
                             </div>
                             <input type="date"
                                 [ngModel]="mwbDates().get(i) || ''"
                                 (ngModelChange)="updateMwbDate(i, $event)"
                                 [class.border-red-500]="!!mwbDates().get(i) === false"
                                 class="h-7 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[0.625rem] sm:text-[0.6875rem] font-medium focus:ring-2 focus:ring-[#6D28D9]/50 outline-none w-[110px] sm:w-[120px]">
                         </div>
                       </div>
                       <div class="p-0 bg-white dark:bg-slate-900">
                         <table class="w-full text-left border-collapse">
                           <tbody>
                             @for (parte of semana.partes; track $index) {
                               <tr class="border-b last:border-b-0 border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                 <td class="py-2 px-3 sm:px-4 w-1/4 min-w-[90px] sm:min-w-[120px] align-middle">
                                     <div class="text-[9px] sm:text-[0.625rem] font-black uppercase tracking-widest" [style.color]="getSectionColor(parte.seccion)">{{ parte.seccion }}</div>
                                 </td>
                                 <td class="py-2 px-2 sm:px-4 align-middle">
                                    <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                                      <input [(ngModel)]="parte.nombre_parte" class="text-[0.6875rem] sm:text-xs font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 flex-1 min-w-0 w-full overflow-hidden text-ellipsis">
                                      @if (parte.fuente_informacion) {
                                        <div class="text-[9px] text-slate-400 dark:text-slate-500 font-medium px-1 italic truncate">
                                          {{ parte.fuente_informacion }}
                                        </div>
                                      }
                                    </div>
                                     <div class="flex items-center gap-1 shrink-0 px-1 mt-1 sm:mt-0">
                                       <button (click)="parte.aplica_sala_b = !parte.aplica_sala_b"
                                               [class]="parte.aplica_sala_b ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 ring-1 ring-purple-500/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                                               class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all whitespace-nowrap">Sala B</button>
                                       <button (click)="parte.requiere_pareja = !parte.requiere_pareja"
                                               [class]="parte.requiere_pareja ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ring-1 ring-amber-500/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                                               class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all whitespace-nowrap">Pareja</button>
                                     </div>
                                 </td>
                                 <td class="py-2 px-3 sm:px-4 text-right w-16 sm:w-24 align-middle">
                                   <div class="flex items-center justify-end gap-1">
                                     <input type="number" [(ngModel)]="parte.duracion_minutos" class="w-8 sm:w-10 h-6 text-center bg-slate-100 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 rounded text-[9px] sm:text-[0.625rem] font-black outline-none border border-transparent focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all">
                                     <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">min</span>
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
                     <div class="bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center">
                       <input [(ngModel)]="selectedPlantilla()!.nombre" placeholder="Nombre Único de Plantilla" class="flex-1 w-full bg-transparent border-none font-bold text-slate-800 dark:text-white uppercase tracking-wide text-[0.6875rem] sm:text-xs outline-none focus:ring-1 focus:ring-blue-500 rounded px-1">
                     </div>
                     <div class="p-0 bg-white dark:bg-slate-900 overflow-y-auto flex-1 simple-scrollbar">
                        @for (week of plantillaByWeek(); track week.ordinal) {
                          <div class="bg-slate-50/40 dark:bg-slate-800/20 px-4 py-2 border-b border-t first:border-t-0 border-slate-200 dark:border-slate-700">
                             <h5 class="text-[0.625rem] font-black uppercase text-slate-500 tracking-widest text-[#6366F1]">Semana {{ week.ordinal }}</h5>
                          </div>
                          <table class="w-full text-left border-collapse mb-4 last:mb-0">
                            <tbody>
                              @for (parte of week.partes; track $index) {
                             <tr class="border-b last:border-b-0 border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                               <td class="py-2 px-3 sm:px-4 w-1/4 min-w-[90px] sm:min-w-[120px] align-middle">
                                   <div class="text-[9px] sm:text-[0.625rem] font-black uppercase tracking-widest"
                                        [style.color]="getSectionColor(parte.seccion)">
                                     {{ parte.seccion }}
                                   </div>
                               </td>
                               <td class="py-2 px-2 sm:px-4 align-middle">
                                 <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                   <input [(ngModel)]="parte.nombre_parte" class="text-[0.6875rem] sm:text-xs font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 flex-1 min-w-0 w-full overflow-hidden text-ellipsis">
                                   <div class="flex items-center gap-1 shrink-0 px-1 mt-1 sm:mt-0">
                                     <button (click)="parte.aplica_sala_b = !parte.aplica_sala_b"
                                             [class]="parte.aplica_sala_b ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 ring-1 ring-purple-500/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                                             class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all whitespace-nowrap">Sala B</button>
                                     <button (click)="parte.requiere_pareja = !parte.requiere_pareja"
                                             [class]="parte.requiere_pareja ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ring-1 ring-amber-500/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                                             class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all whitespace-nowrap">Pareja</button>
                                   </div>
                                 </div>
                               </td>
                               <td class="py-2 px-3 sm:px-4 text-right w-16 sm:w-24 align-middle">
                                 <div class="flex items-center justify-end gap-1">
                                   <input type="number" [(ngModel)]="parte.duracion_minutos" class="w-8 sm:w-10 h-6 text-center bg-slate-100 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 rounded text-[9px] sm:text-[0.625rem] font-black outline-none border border-transparent focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all">
                                   <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest">min</span>
                                 </div>
                               </td>
                             </tr>
                           }
                         </tbody>
                       </table>
                     }
                      </div>
                   </div>
                 }
               </div>
             </div>
           }

           <!-- Historical Archive Panel -->
           <div class="flex-[1] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col transition-all min-h-[300px]">
             <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
               <h3 class="text-[0.6875rem] font-bold text-slate-800 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                 <svg class="w-3.5 h-3.5 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                 Histórico Guardado
               </h3>
               @if (plantillasLoading()) {
                 <div class="w-3 h-3 border-2 border-[#6D28D9] border-t-transparent rounded-full animate-spin"></div>
               }
             </div>

             <div class="overflow-y-auto flex-1 p-3 flex flex-col gap-2 simple-scrollbar">
                 @for (p of savedPlantillas(); track p.id_plantilla) {
                   <div class="group flex items-center justify-between px-3.5 py-2.5 rounded-[12px] bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/90 shadow-sm hover:shadow-md transition-all cursor-default">
                     <div class="min-w-0 pr-3 flex-1 flex flex-col justify-center">
                       <h4 class="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-200 truncate mb-0.5 leading-tight" [title]="p.nombre">{{ p.nombre }}</h4>
                       <span class="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider self-start"
                             [class]="p.tipo === 'entre_semana' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'">
                         {{ p.tipo === 'entre_semana' ? 'Estudio' : 'Fin de Sem' }}
                       </span>
                     </div>

                     <div class="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                       <button (click)="editPlantilla(p.id_plantilla)" class="w-6 h-6 flex items-center justify-center text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition-all" title="Editar">
                         <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                       </button>
                       <button (click)="deletePlantilla(p.id_plantilla)" class="w-6 h-6 flex items-center justify-center text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-md transition-all" title="Eliminar">
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
                       <p class="text-[0.625rem] font-bold text-slate-500 dark:text-slate-400">Sin plantillas</p>
                     </div>
                   }
                 }
             </div>
           </div>

       </div>
       } <!-- end plantillas tab -->

       <!-- ===== TAB: PARÁMETROS DEL ALGORITMO ===== -->
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
                  <span class="text-[0.625rem] text-amber-500 font-bold block sm:inline w-full sm:w-auto ml-0 sm:ml-1 mt-1 sm:mt-0">Los pesos deben sumar ~1.0</span>
                }
              </div>
              <div class="flex items-center justify-end w-full sm:w-auto">
                <button (click)="resetAlgoDefaults()"
                  class="text-[0.625rem] font-bold px-3 py-1.5 rounded-md hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-300 hover:text-[#6D28D9] transition-all shrink-0">
                  Restaurar por defecto
                </button>
              </div>
            </div>

            <!-- Pesos Heuristicos -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden shrink-0">
              <div class="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <h4 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Pesos Heurísticos</h4>
                <p class="text-[0.625rem] text-slate-400 mt-0.5">Controlan la prioridad relativa de cada criterio al asignar publicadores.</p>
              </div>
              @for (param of algoByCategory().peso_heuristico; track param.key) {
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ param.label }}</div>
                    <div class="text-[0.625rem] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug whitespace-normal break-words">{{ param.description }}</div>
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
                <p class="text-[0.625rem] text-slate-400 mt-0.5">Periodos en días usados para normalizar y evaluar asignaciones.</p>
              </div>
              @for (param of algoByCategory().ventana_tiempo; track param.key) {
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ param.label }}</div>
                    <div class="text-[0.625rem] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug whitespace-normal break-words">{{ param.description }}</div>
                  </div>
                  <div class="flex items-center shrink-0 pr-2 pb-1 sm:pb-0 sm:pr-0">
                    <input type="number"
                      [min]="param.min_val" [max]="param.max_val" [step]="param.step"
                      [ngModel]="getAlgoValue(param)"
                      (ngModelChange)="onAlgoParamChange(param.key, $event)"
                      class="w-20 h-8 px-2 text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-mono font-bold text-slate-700 dark:text-slate-200 focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 outline-none transition-all block"
                      [class.border-amber-400]="isAlgoDirty(param.key)">
                    <span class="text-[0.625rem] text-slate-400 w-8 pl-1 block">días</span>
                  </div>
                </div>
              }
            </div>

            <!-- Restricciones Duras -->
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden shrink-0">
              <div class="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <h4 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Restricciones Duras</h4>
                <p class="text-[0.625rem] text-slate-400 mt-0.5">Límites estrictos que el motor respeta como reglas absolutas.</p>
              </div>
              @for (param of algoByCategory().restriccion_dura; track param.key) {
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ param.label }}</div>
                    <div class="text-[0.625rem] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug whitespace-normal break-words">{{ param.description }}</div>
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

       <!-- ===== TAB: ASIGNACIÓN DE PRIVILEGIOS ===== -->
       @if (activeTab() === 'privilegios') {

       <!-- Search + Filters Toolbar -->
       <div class="shrink-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 p-1.5 flex items-center gap-1.5 flex-wrap lg:flex-nowrap">
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
           <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden lg:block shrink-0"></div>
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
       </div>

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
             <!-- Stats bar -->
             <div class="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-slate-800 dark:text-white tabular-nums">{{ filteredPublicadores().length }}</p>
                 <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Publicadores</p>
               </div>
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{{ countPrivilegio('Anciano') }}</p>
                 <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Ancianos</p>
               </div>
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{{ countPrivilegio('Siervo Ministerial') }}</p>
                 <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">S. Ministeriales</p>
               </div>
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-slate-600 dark:text-slate-300 tabular-nums">{{ countPrecursores() }}</p>
                 <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Precursores</p>
               </div>
             </div>

             <!-- Data Table -->
             <div class="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                 <div class="flex-1 min-h-0 overflow-x-auto overflow-y-auto simple-scrollbar">
                     <table class="w-full min-w-max text-left border-collapse">
                         <thead class="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                             <tr class="border-b border-slate-200 dark:border-slate-700">
                                 <th class="px-4 py-2 text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md z-10 min-w-[150px]">Publicador</th>
                                 <th class="px-2 py-2 text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[80px]">Privilegio</th>
                                 <th *ngFor="let col of columnas()"
                                     class="px-2 py-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[70px] leading-tight whitespace-normal">
                                   {{ col.label }}
                                 </th>
                                 <th class="px-2 py-2 text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[90px] leading-tight whitespace-normal">
                                   Nivel Oratoria
                                 </th>
                             </tr>
                         </thead>
                         <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                              @for (pub of paginatedPublicadores(); track pub.id_publicador) {
                                <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                    [class.bg-amber-50/30]="isDirty(pub.id_publicador)"
                                    [class.dark:bg-amber-900/10]="isDirty(pub.id_publicador)">
                                   <td class="px-4 py-2 sticky left-0 bg-white dark:bg-slate-900 z-10 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 transition-colors border-r border-slate-100 dark:border-slate-800/50">
                                       <div class="flex items-center gap-3">
                                           <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[0.6875rem] shrink-0 ring-1 ring-white dark:ring-slate-800"
                                                [class]="avatarClass(pub)">
                                             {{ pub.primer_nombre[0] }}{{ pub.primer_apellido[0] }}
                                           </div>
                                           <div>
                                               <div class="text-[0.8125rem] font-bold text-slate-800 dark:text-white truncate max-w-[140px] leading-tight" [title]="pub.primer_nombre + ' ' + pub.primer_apellido">
                                         {{ pub.primer_nombre.split(' ')[0] }} {{ pub.primer_apellido.split(' ')[0] }}
                                     </div>
                                     <div class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium">
                                         {{ isHermano(pub) ? 'Hermano' : 'Hermana' }}
                                     </div>
                                           </div>
                                       </div>
                                   </td>
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
                                   <td *ngFor="let col of columnas()"
                                       class="px-1 py-2 text-center">
                                         <label class="inline-flex items-center justify-center cursor-pointer p-1">
                                           <input type="checkbox"
                                             [checked]="getPermiso(pub, col.key)"
                                             (change)="togglePermiso(pub, col.key)"
                                             class="w-4 h-4 text-[#6D28D9] rounded border-slate-300 dark:border-slate-600 focus:ring-[#6D28D9] focus:ring-offset-0 cursor-pointer transition-colors">
                                         </label>
                                   </td>
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
                    <span class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium tabular-nums">
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
                            <span class="w-7 h-7 flex items-center justify-center text-[0.6875rem] text-slate-300 dark:text-slate-600 select-none">···</span>
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
export class ReunionesConfiguracionPlantillasComponent implements OnInit {

  private reunionesSvc = inject(ReunionesService);
  private congregacionCtx = inject(CongregacionContextService);
  private authStore = inject(AuthStore);

  // ── Tabs ──
  private allTabs = [
    { id: 'privilegios', label: 'Asignación de Privilegios', icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', adminOnly: false },
    { id: 'plantillas', label: 'Plantillas de Reunión', icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>', adminOnly: true },
    { id: 'parametros', label: 'Parámetros del Algoritmo', icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', adminOnly: true }
  ];

  visibleTabs = computed(() => {
    const isAdmin = this.hasRole('Administrador') || this.hasRole('Gestor Aplicación');
    return this.allTabs.filter(t => !t.adminOnly || isAdmin);
  });

  activeTab = signal('privilegios');

  // ── Algorithm Params ──
  algoParams = signal<AlgorithmParam[]>([]);
  algoLoading = signal(false);
  algoSaving = signal(false);
  algoDirtyMap = signal<Map<string, number>>(new Map());
  private algoLoaded = false;
  protected readonly Math = Math;

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
  algoValid = computed(() => Math.abs(this.algoWeightSum() - 1.0) <= 0.05);

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
  plantillaByWeek = computed(() => {
    const p = this.selectedPlantilla();
    if (!p) return [];
    const weeksMap = new Map<number, PlantillaParteDetail[]>();
    p.partes.forEach(parte => {
      const ord = parte.semana_ordinal || 0;
      if (!weeksMap.has(ord)) weeksMap.set(ord, []);
      weeksMap.get(ord)!.push(parte);
    });
    return Array.from(weeksMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ordinal, partes]) => ({ ordinal, partes }));
  });

  // ── Matriz de Publicadores (Privilegios) ──
  publicadores = signal<PublicadorMatrizItem[]>([]);
  columnas = signal<ColumnaPermiso[]>([]);
  matrizLoading = signal(false);
  matrizSaving = signal(false);
  matrizErrorMsg = signal<string | null>(null);
  searchQuery = signal('');
  filtroSexo = signal<'todos' | 'solo_hombres' | 'solo_mujeres'>('todos');
  currentPage = signal(1);
  pageSize = signal(11);
  private dirtyMap = new Map<number, Record<string, boolean>>();
  private dirtyOratoriaMap = new Map<number, number>();
  matrizPendingCount = signal(0);

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
        this.loadAlgoParams();
      }
      if (this.activeTab() === 'privilegios' && !this.matrizLoaded) {
        this.loadMatriz();
      }
    }, { allowSignalWrites: true });
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

  deletePlantilla(id: number) {
    if (!confirm('¿Está seguro de eliminar esta plantilla? No afectará programas ya creados.')) return;

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

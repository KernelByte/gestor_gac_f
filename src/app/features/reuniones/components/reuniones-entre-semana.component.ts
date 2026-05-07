import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs'; // 'of' used in tryLoadDrafts catchError
import { catchError, switchMap } from 'rxjs/operators';
import { ReunionesService } from '../services/reuniones.service';
import { AsistenciaService } from '../services/asistencia.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ThemeService } from '../../../core/services/theme.service';
import {
  ProgramaSemana,
  AsignacionDraft,
  CandidatoAlternativo,
  PlantillaOption,
  GenerarMesForm,
  GenerarAsignacionesRequest,
  ProgramaMensualCreateRequest,
  ConfirmarDraftRequest,
  EditarAsignacionRequest,
  PeriodoConfirmado,
  ConflictoMes,
  GrupoPlantilla,
} from '../models/reuniones.models';

@Component({
  selector: 'app-reuniones-programacion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full gap-0">

      <!-- ===== PAGE HEADER ===== -->
      <div class="shrink-0 flex items-center justify-between gap-3 pb-3">
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
            {{ tituloReunion() }}
          </h1>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Generar Mes — visible en móvil (md:hidden), en desktop está en el sidebar -->
          <button
            *ngIf="hasEditPermission()"
            (click)="openModal()"
            [disabled]="estado() === 'loading'"
            title="Generar Mes"
            class="md:hidden flex items-center gap-1.5 px-3 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm shadow-purple-900/20 active:scale-95">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span class="hidden sm:inline">Generar Mes</span>
          </button>
          <!-- Confirmar -->
          <button
            *ngIf="hasEditPermission()"
            (click)="confirmar()"
            [disabled]="!canConfirmar()"
            title="Confirmar borrador"
            class="btn-confirmar flex items-center gap-1.5 px-3 h-10 rounded-xl border disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-95">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="hidden sm:inline">Confirmar</span>
          </button>
          <!-- Borrar borrador -->
          <button
            *ngIf="hasEditPermission()"
            (click)="borrarBorrador()"
            [disabled]="!canBorrarBorrador()"
            title="Borrar borrador"
            class="btn-borrar flex items-center gap-1.5 px-3 h-10 rounded-xl border disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-95">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            <span class="hidden sm:inline">Borrar borrador</span>
          </button>
        </div>
      </div>

      <!-- ===== MEETING TYPE SELECTOR ===== -->
      @if (showTipoTabs()) {
        <div class="shrink-0 flex items-center pb-3">
          <div class="tipo-tabs inline-flex items-center rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
            <button
              (click)="onTipoChange('entre_semana')"
              class="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
              [class]="tipoReunionActivo() === 'entre_semana'
                ? 'bg-white dark:bg-slate-700 text-[#6D28D9] dark:text-purple-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'">
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              <span class="hidden xs:inline">Reunion entre semana</span>
              <span class="xs:hidden">Entre semana</span>
            </button>
            <button
              (click)="onTipoChange('fin_semana')"
              class="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
              [class]="tipoReunionActivo() === 'fin_semana'
                ? 'bg-white dark:bg-slate-700 text-[#6D28D9] dark:text-purple-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'">
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
              <span class="hidden xs:inline">Reunion Fin de semana</span>
              <span class="xs:hidden">Fin de semana</span>
            </button>
          </div>
        </div>
      }

      <!-- ===== ERROR ===== -->
      @if (estado() === 'error') {
        <div class="shrink-0 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p class="flex-1 min-w-0 text-red-600 dark:text-red-400 text-xs font-medium truncate">{{ errorMsg() }}</p>
          <button
            (click)="estado.set('idle')"
            class="shrink-0 px-3 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-xs text-red-600 dark:text-red-400 font-bold transition-all">
            Cerrar
          </button>
        </div>
      }

      <!-- ===== CONFIRMADO — banner ===== -->
      @if (estado() === 'confirmado') {
        <div class="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p class="text-emerald-700 dark:text-emerald-300 text-xs font-bold">Asignaciones confirmadas correctamente.</p>
        </div>
      }

      <!-- ===== ÁREA PRINCIPAL: sidebar + contenido ===== -->
      <div class="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-4 overflow-hidden">

        <!-- ── SIDEBAR DESKTOP (oculto en móvil) ── -->
        <aside class="hidden md:flex md:w-60 lg:w-64 xl:w-72 shrink-0 flex-col gap-3 overflow-y-auto simple-scrollbar py-0.5 pr-0.5">

          <!-- Botón Generar Mes -->
          <button
            *ngIf="hasEditPermission()"
            (click)="openModal()"
            [disabled]="estado() === 'loading'"
            class="w-full flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm shadow-purple-900/20 active:scale-95 shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Generar Mes
          </button>

          <!-- Historial de programaciones -->
          @if (loadingPeriodos()) {
            <div class="flex justify-center py-4">
              <div class="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-violet-500 animate-spin"></div>
            </div>
          } @else if (gruposPlantilla().length > 0) {
            <div class="flex flex-col gap-1.5">
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 pb-0.5">Programación confirmada</p>
              @for (grupo of gruposPlantilla(); track grupoKey(grupo)) {
                <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                  <!-- Cabecera del grupo -->
                  <div class="flex items-center gap-1 px-2.5 h-9 bg-slate-50 dark:bg-slate-800/80">
                    <button
                      (click)="toggleGrupo(grupoKey(grupo), $event)"
                      class="flex-1 flex items-center gap-2 text-left min-w-0 py-2">
                      <svg
                        [class.rotate-90]="gruposExpandidos().has(grupoKey(grupo))"
                        class="w-3 h-3 text-slate-400 shrink-0 transition-transform duration-150"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                      </svg>
                      <span class="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{{ abreviarNombreGuia(grupo.nombre_plantilla) }}</span>
                      <span class="text-[0.65rem] text-slate-400 shrink-0">({{ grupo.periodos.length }})</span>
                    </button>
                    @if (hasEditPermission()) {
                      <button
                        (click)="eliminarGuiaCompleta(grupo, $event)"
                        title="Eliminar guía completa"
                        class="shrink-0 w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-all active:scale-95 flex items-center justify-center">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    }
                  </div>
                  <!-- Meses del grupo -->
                  @if (gruposExpandidos().has(grupoKey(grupo))) {
                    <div class="flex flex-col gap-0.5 p-1.5">
                      @for (p of grupo.periodos; track p.ano + '-' + p.mes) {
                        <div class="flex items-center gap-1">
                          <button
                            (click)="loadHistorial(p.mes, p.ano)"
                            [disabled]="loadingHistorial()"
                            class="flex-1 flex items-center justify-between px-2.5 h-8 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-40 group">
                            <span>{{ p.label }}</span>
                            <svg class="w-3 h-3 text-slate-400 group-hover:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                          </button>
                          <button
                            (click)="descargarPdfMes(p, $event)"
                            [disabled]="descargandoPdf()"
                            title="Descargar PDF de {{ p.label }}"
                            class="shrink-0 w-7 h-7 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-all active:scale-95 flex items-center justify-center disabled:opacity-40">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                          </button>
                          @if (periodoEliminable(p) && hasEditPermission()) {
                            <button
                              (click)="eliminarHistorial(p, $event)"
                              title="Eliminar {{ p.label }}"
                              class="shrink-0 w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-all active:scale-95 flex items-center justify-center">
                              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </aside>

        <!-- ── PANEL PRINCIPAL ── -->
        <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative">

          <!-- Week toolbar (draft / confirmado / historial) -->
          @if (estado() === 'draft' || estado() === 'confirmado' || estado() === 'historial') {
            <div class="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <!-- Week pills (scroll horizontal con snap) -->
              <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 snap-x snap-mandatory">
                @for (sem of semanas(); track sem.semana_iso; let i = $index) {
                  <button
                    (click)="selectedWeekIdx.set(i)"
                    class="snap-start shrink-0 flex items-center gap-1 px-3 h-9 md:h-7 rounded-full text-[0.7rem] font-bold whitespace-nowrap transition-all border active:scale-95"
                    [class]="weekTabClass(i)">
                    {{ sem.fecha | date:'d MMMM' }}
                  </button>
                }
              </div>
              @if (estado() === 'historial') {
                <button
                  (click)="semanas.set([]); estado.set('idle')"
                  class="shrink-0 flex items-center gap-1 px-3 h-9 md:h-7 rounded-full text-[0.65rem] font-bold border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400 transition-all active:scale-95">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  Volver
                </button>
              }
            </div>
          }

          <!-- Loading overlay -->
          @if (estado() === 'loading') {
            <div class="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
              <div class="flex flex-col items-center gap-3">
                <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-[#6D28D9] animate-spin"></div>
                <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">Generando programa...</p>
              </div>
            </div>
          }

          <!-- IDLE state (simplificado) -->
          @if (estado() === 'idle' || (estado() !== 'loading' && estado() !== 'error' && semanas().length === 0)) {
            <div class="flex-1 flex flex-col items-center justify-center py-12 text-center px-6">
              <div class="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <svg class="w-7 h-7 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <h3 class="text-slate-700 dark:text-slate-300 font-bold text-sm mb-1">Ninguna programación seleccionada</h3>
              <p class="hidden md:block text-slate-400 dark:text-slate-500 text-xs max-w-xs">Elige un mes del panel lateral para verlo, o genera uno nuevo con el botón Generar Mes.</p>
              <p class="md:hidden text-slate-400 dark:text-slate-500 text-xs max-w-xs">Selecciona una programación o genera una nueva.</p>
              <!-- Botón solo en móvil (en desktop está el sidebar) -->
              <button
                *ngIf="hasEditPermission()"
                (click)="openModal()"
                class="md:hidden mt-5 inline-flex items-center gap-2 px-4 h-10 bg-[#6D28D9] hover:bg-[#5b21b6] text-white rounded-xl text-xs font-bold shadow-sm shadow-purple-900/20 transition-all active:scale-95">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Generar Mes
              </button>
            </div>
          }

          <!-- DRAFT / CONFIRMADO / HISTORIAL: lista de asignaciones -->
          @if ((estado() === 'draft' || estado() === 'confirmado' || estado() === 'historial') && currentSemana(); as semana) {

            <!-- Sticky info bar: título semana + estado -->
            <div class="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-4">
              <div class="min-w-0">
                @if (semana.titulo_guia) {
                  <p class="text-[0.78rem] font-bold text-slate-700 dark:text-slate-200 truncate">{{ semana.titulo_guia }}</p>
                }
                <p class="text-[0.6rem] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">{{ semana.partes.length }} partes</p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="w-1.5 h-1.5 rounded-full shrink-0"
                  [class]="estado() === 'confirmado' ? 'bg-emerald-400' : estado() === 'historial' ? 'bg-violet-400' : 'bg-amber-400'"></span>
                <span class="text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{{ estadoLabel() }}</span>
              </div>
            </div>

            <!-- Lista de partes por sección -->
            <div class="flex-1 overflow-y-auto simple-scrollbar bg-[#f8f9fb] dark:bg-slate-950">
              @for (seccion of seccionesActuales(); track seccion.id) {

                <!-- Encabezado de sección -->
                <div class="sticky top-0 z-10" [style]="'background:' + seccion.headerBg">
                  <div class="px-4 py-2 flex items-center gap-2.5" [style]="'border-left:3px solid ' + seccion.color">
                    <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" [style.background-color]="seccion.color">
                      <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path [attr.d]="seccion.iconPath"/>
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-[0.65rem] font-black uppercase tracking-widest leading-none" [style.color]="seccion.color">{{ seccion.titulo }}</p>
                    </div>
                    @if (salaCountsPorSeccion()[seccion.id] > 0) {
                      <div class="flex items-center rounded-lg p-0.5 gap-0.5 shrink-0"
                        [style]="'border:1px solid ' + seccionColor(seccion.color, 0.3) + '; background:' + seccionColor(seccion.color, 0.06)">
                        <button
                          (click)="selectedSala.set('Principal'); $event.stopPropagation()"
                          class="flex items-center gap-1 px-2.5 h-6 rounded-md text-[0.65rem] font-bold whitespace-nowrap transition-all active:scale-95"
                          [style]="selectedSala() === 'Principal'
                            ? 'background:' + seccion.color + '; color:white; box-shadow:0 1px 4px rgba(0,0,0,0.18)'
                            : 'color:' + seccion.color + '; opacity:0.55'">
                          Principal
                        </button>
                        <button
                          (click)="selectedSala.set('Auxiliar'); $event.stopPropagation()"
                          class="flex items-center gap-1 px-2.5 h-6 rounded-md text-[0.65rem] font-bold whitespace-nowrap transition-all active:scale-95"
                          [style]="selectedSala() === 'Auxiliar'
                            ? 'background:' + seccion.color + '; color:white; box-shadow:0 1px 4px rgba(0,0,0,0.18)'
                            : 'color:' + seccion.color + '; opacity:0.55'">
                          Sala B
                        </button>
                      </div>
                    }
                  </div>
                  <div class="h-px" [style.background]="seccion.headerBorder"></div>
                </div>

                <!-- Grupos de partes -->
                <div class="px-3 py-2 flex flex-col gap-1.5">
                  @for (grupo of seccion.grupos; track grupo.key) {
                    <div class="parte-card"
                      [class.has-conflict]="grupoHasConflict(grupo.partes)"
                      [class.has-swapped]="grupoHasSwapped(grupo.partes)"
                      [class.is-open]="isGroupOpen(grupo)"
                      [class.dropdown-active]="grupoDropdownActivo(grupo.partes)">
                      <div class="px-3.5 py-2.5 flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full shrink-0 mt-px" [style.background-color]="grupoDotColor(grupo.partes, seccion.color)"></div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-baseline gap-1.5 min-w-0">
                            <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate leading-snug flex-1 min-w-0">
                              {{ displayNombreParte(grupo.partes[0]) }}
                            </p>
                            @if (grupo.partes[0].duracion_minutos) {
                              <span class="text-[0.55rem] font-black shrink-0 px-1.5 py-[2px] rounded leading-none"
                                [style.color]="seccion.color" [style.background-color]="seccion.badgeBg">
                                {{ grupo.partes[0].duracion_minutos }}&nbsp;min
                              </span>
                            }
                          </div>
                          <div class="flex items-center gap-1.5 mt-0.5">
                            @if (grupoHasConflict(grupo.partes)) {
                              <span class="text-[0.6rem] font-semibold leading-none" style="color:#dc2626">Sin candidato</span>
                            } @else if (grupoHasReemplazo(grupo.partes)) {
                              <span class="text-[0.6rem] leading-none" style="color:#94a3b8">Reemplazo</span>
                            }
                            @if (grupoHasSwapped(grupo.partes)) {
                              <span class="text-[0.6rem] font-semibold leading-none" style="color:#b45309">Modificado</span>
                            }
                          </div>
                        </div>
                        <!-- Pills de asignados -->
                        <div class="flex items-center gap-2 shrink-0">
                          @for (asig of grupo.partes; track asig.id_programa_parte; let pi = $index) {
                            <div class="relative">
                              <button
                                (click)="estado() === 'historial' ? openHistorialEdit(asig) : toggleDropdown(asig)"
                                [disabled]="estado() === 'confirmado' || !hasEditPermission()"
                                [class]="assigneeButtonClass(asig)">
                                @if (grupo.partes.length > 1) {
                                  <span class="text-[0.48rem] font-black uppercase tracking-wide leading-none shrink-0 opacity-60">{{ grupoRoleLabel(grupo, pi) }}</span>
                                  <span class="opacity-30 text-[0.6rem] leading-none shrink-0">·</span>
                                }
                                <span>{{ asig.nombre_completo }}</span>
                                @if (estado() === 'draft' && asig.alternativos.length > 0) {
                                  <svg class="chevron w-3 h-3 shrink-0"
                                    [class.open]="openDropdownId() === pillKey(asig)"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                                  </svg>
                                }
                                @if (estado() === 'historial' && hasEditPermission()) {
                                  <svg class="w-3 h-3 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.414-6.414a2 2 0 112.828 2.828L11.828 13.828A2 2 0 0111 14.414V16h1.586a2 2 0 001.414-.586l.586-.586"/>
                                  </svg>
                                }
                                @if (asig.es_ayudante && estado() !== 'confirmado' && estado() !== 'historial' && hasEditPermission()) {
                                  <span
                                    (click)="onEliminarAyudante(asig, selectedWeekIdx(), $event)"
                                    class="opacity-40 hover:opacity-90 leading-none shrink-0 ml-0.5 cursor-pointer active:scale-90 transition-all"
                                    title="Quitar ayudante">✕</span>
                                }
                              </button>
                              <!-- Dropdown draft -->
                              @if (estado() === 'draft' && openDropdownId() === pillKey(asig) && asig.alternativos.length > 0) {
                                <div class="dropdown-panel absolute right-0 top-full mt-2 z-50 w-60 overflow-hidden" style="border-radius:14px">
                                  <div class="dropdown-header px-3.5 py-2.5 flex items-center gap-2">
                                    <span class="w-[3px] h-3.5 rounded-full shrink-0" [style.background-color]="seccion.color"></span>
                                    <span class="dropdown-label text-[0.6rem] font-bold uppercase tracking-widest flex-1">Candidatos</span>
                                    @if (asig.es_ayudante) {
                                      <div class="flex items-center gap-0.5">
                                        @for (opt of sexoOpts; track opt.v) {
                                          <button
                                            (click)="setSexoFilter(asig, opt.v); $event.stopPropagation()"
                                            class="px-1.5 h-5 rounded text-[0.55rem] font-black transition-all active:scale-95"
                                            [style]="getSexoFilter(asig) === opt.v
                                              ? 'background:' + seccion.color + '; color:white'
                                              : 'opacity:0.4'">
                                            {{ opt.l }}
                                          </button>
                                        }
                                      </div>
                                    }
                                  </div>
                                  <div class="p-1.5 flex flex-col gap-0.5">
                                    @for (alt of filteredAlternativos(asig); track alt.id_publicador) {
                                      <button
                                        (click)="swapAsignacion(selectedWeekIdx(), asig, alt)"
                                        class="dropdown-alt-row w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-[8px]">
                                        <span class="dropdown-alt-name text-[0.75rem] font-semibold truncate">{{ alt.nombre_completo }}</span>
                                        <span class="text-[0.6rem] font-black font-mono shrink-0 tabular-nums px-1.5 py-0.5 rounded-[4px]"
                                          [style.color]="seccion.color" [style.background-color]="seccion.badgeBg">
                                          {{ alt.score | number:'1.2-2' }}
                                        </span>
                                      </button>
                                    }
                                  </div>
                                </div>
                              }
                              <!-- Dropdown historial -->
                              @if (estado() === 'historial' && editingHistorialId() === asig.id_asignacion) {
                                <div class="dropdown-panel absolute right-0 top-full mt-2 z-50 w-60 overflow-hidden" style="border-radius:14px">
                                  <div class="dropdown-header px-3.5 py-2.5 flex items-center gap-2">
                                    <span class="w-[3px] h-3.5 rounded-full shrink-0" [style.background-color]="seccion.color"></span>
                                    <span class="dropdown-label text-[0.6rem] font-bold uppercase tracking-widest flex-1">Cambiar asignado</span>
                                  </div>
                                  <div class="p-1.5 flex flex-col gap-0.5">
                                    @if (loadingCandidatos()) {
                                      <div class="flex items-center justify-center py-3">
                                        <div class="w-4 h-4 rounded-full border-2 border-slate-200 border-t-[#6D28D9] animate-spin"></div>
                                      </div>
                                    } @else if (historialCandidatos().length === 0) {
                                      <p class="text-[0.65rem] text-slate-400 text-center py-3">Sin candidatos disponibles</p>
                                    } @else {
                                      @for (alt of historialCandidatos(); track alt.id_publicador) {
                                        <button
                                          (click)="selectHistorialCandidato(selectedWeekIdx(), asig, alt)"
                                          class="dropdown-alt-row w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-[8px]">
                                          <span class="dropdown-alt-name text-[0.75rem] font-semibold truncate">{{ alt.nombre_completo }}</span>
                                          <span class="text-[0.6rem] font-black font-mono shrink-0 tabular-nums px-1.5 py-0.5 rounded-[4px]"
                                            [style.color]="seccion.color" [style.background-color]="seccion.badgeBg">
                                            {{ alt.score | number:'1.2-2' }}
                                          </span>
                                        </button>
                                      }
                                    }
                                  </div>
                                </div>
                              }
                            </div>
                          }
                          <!-- + Ayudante -->
                          @if (puedeAgregarAyudante(grupo, seccion) && estado() !== 'confirmado' && hasEditPermission()) {
                            <button
                              (click)="onAgregarAyudante(grupo, selectedWeekIdx())"
                              [disabled]="loadingAyudante() === grupo.partes[0].id_programa_parte"
                              class="flex items-center gap-1 px-2 h-7 rounded-full text-[0.6rem] font-bold border transition-all active:scale-95 disabled:opacity-40"
                              [style]="'border-color:' + seccionColor(seccion.color, 0.3) + '; color:' + seccion.color + '; opacity:0.7'">
                              @if (loadingAyudante() === grupo.partes[0].id_programa_parte) {
                                <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                              } @else {
                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              }
                              Ayudante
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

        </div>

        <!-- ── HISTORIAL MÓVIL (acordeón, oculto en desktop) ── -->
        @if (gruposPlantilla().length > 0 || loadingPeriodos()) {
          <details class="md:hidden shrink-0 group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <summary class="flex items-center justify-between px-4 h-11 cursor-pointer list-none select-none">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Programación confirmada</span>
              <svg class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </summary>
            <div class="border-t border-slate-100 dark:border-slate-800 p-2 flex flex-col gap-1.5 max-h-64 overflow-y-auto simple-scrollbar">
              @if (loadingPeriodos()) {
                <div class="flex justify-center py-3">
                  <div class="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-violet-500 animate-spin"></div>
                </div>
              } @else {
                @for (grupo of gruposPlantilla(); track grupoKey(grupo)) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div class="flex items-center gap-1 px-3 h-10 bg-slate-50 dark:bg-slate-800/80">
                      <button
                        (click)="toggleGrupo(grupoKey(grupo), $event)"
                        class="flex-1 flex items-center gap-2 text-left min-w-0 py-2">
                        <svg
                          [class.rotate-90]="gruposExpandidos().has(grupoKey(grupo))"
                          class="w-3 h-3 text-slate-400 shrink-0 transition-transform duration-150"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                        <span class="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{{ abreviarNombreGuia(grupo.nombre_plantilla) }}</span>
                        <span class="text-[0.65rem] text-slate-400 shrink-0">({{ grupo.periodos.length }})</span>
                      </button>
                      @if (hasEditPermission()) {
                        <button
                          (click)="eliminarGuiaCompleta(grupo, $event)"
                          title="Eliminar guía completa"
                          class="shrink-0 w-9 h-9 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-all active:scale-95 flex items-center justify-center">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      }
                    </div>
                    @if (gruposExpandidos().has(grupoKey(grupo))) {
                      <div class="flex flex-col gap-0.5 p-1.5">
                        @for (p of grupo.periodos; track p.ano + '-' + p.mes) {
                          <div class="flex items-center gap-1">
                            <button
                              (click)="loadHistorial(p.mes, p.ano)"
                              [disabled]="loadingHistorial()"
                              class="flex-1 flex items-center justify-between px-3 h-10 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-40 group">
                              <span>{{ p.label }}</span>
                              <svg class="w-3 h-3 text-slate-400 group-hover:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                            </button>
                            <button
                              (click)="descargarPdfMes(p, $event)"
                              [disabled]="descargandoPdf()"
                              title="Descargar PDF de {{ p.label }}"
                              class="shrink-0 w-10 h-10 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-500 hover:text-violet-700 dark:text-violet-400 transition-all active:scale-95 flex items-center justify-center disabled:opacity-40">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                            </button>
                            @if (periodoEliminable(p) && hasEditPermission()) {
                              <button
                                (click)="eliminarHistorial(p, $event)"
                                title="Eliminar {{ p.label }}"
                                class="shrink-0 w-10 h-10 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-all active:scale-95 flex items-center justify-center">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              }
            </div>
          </details>
        }

      </div>
    </div>

    <!-- ===== MODAL GENERAR MES ===== -->
    @if (showModal()) {
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fadeIn" (click)="showModal.set(false)"></div>
      <div class="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div
          class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 p-6 w-full max-w-md pointer-events-auto animate-fadeIn"
          (click)="$event.stopPropagation()">

          <div class="flex items-center justify-between mb-5">
            <div>
              <h2 class="text-base font-display font-bold text-slate-900 dark:text-white">Generar Programa del Mes</h2>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Configura los parámetros para crear el programa</p>
            </div>
            <button
              (click)="showModal.set(false)"
              class="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="mb-4">
            <div class="flex items-center gap-1.5 mb-1.5">
              <span class="w-1 h-3 rounded-full bg-emerald-400"></span>
              <label class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plantilla</label>
            </div>
            @if (loadingPlantillas()) {
              <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-400">
                <div class="w-3.5 h-3.5 border-2 border-slate-300 dark:border-slate-600 border-t-[#6D28D9] rounded-full animate-spin"></div>
                Cargando plantillas...
              </div>
            } @else if (plantillas().length === 0) {
              <div class="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-400">
                No hay plantillas disponibles.
              </div>
            } @else {
              <select
                [value]="modalForm().id_plantilla"
                (change)="updateModal('id_plantilla', +$any($event.target).value)"
                class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] outline-none transition-all">
                @for (p of plantillas(); track p.id_plantilla) {
                  <option [value]="p.id_plantilla" [selected]="modalForm().id_plantilla === p.id_plantilla">{{ p.nombre }}</option>
                }
              </select>
            }
          </div>

          <div class="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
            <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{{ fechasPreview().length }} semanas a crear</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-mono leading-relaxed">{{ fechasPreview().join('  ·  ') }}</p>
          </div>

          <div class="flex gap-2">
            <button
              (click)="showModal.set(false)"
              class="flex-1 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
              Cancelar
            </button>
            <button
              (click)="onModalSubmit()"
              [disabled]="loadingPlantillas() || plantillas().length === 0 || modalForm().id_plantilla === 0"
              class="flex-1 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-40 disabled:cursor-not-allowed text-xs text-white font-bold transition-all shadow-sm shadow-purple-900/20 active:scale-95">
              Generar Programa
            </button>
          </div>

        </div>
      </div>
    }

    <!-- ===== MODAL CONFLICTOS DE REGENERACIÓN ===== -->
    @if (showConflictoModal()) {
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn" (click)="cancelarConflictoModal()"></div>
      <div class="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div class="pointer-events-auto w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 animate-slideUp">
          <div class="flex items-start gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Meses ya generados</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Los siguientes meses ya tienen programa:</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5 mb-4">
            @for (c of conflictosDetectados(); track c.ano + '-' + c.mes) {
              <span class="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs font-semibold text-amber-700 dark:text-amber-400">
                {{ c.label }}
              </span>
            }
          </div>
          @if (mesesFaltantes().length > 0) {
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">Se pueden generar los meses faltantes:</p>
            <div class="flex flex-wrap gap-1.5 mb-5">
              @for (m of mesesFaltantes(); track m.ano + '-' + m.mes) {
                <span class="px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 text-xs font-semibold text-violet-700 dark:text-violet-400">
                  {{ m.label }}
                </span>
              }
            </div>
            <div class="flex gap-2">
              <button
                (click)="cancelarConflictoModal()"
                class="flex-1 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
                Cancelar
              </button>
              <button
                (click)="confirmarGenerarFaltantes()"
                class="flex-1 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] text-xs text-white font-bold transition-all shadow-sm shadow-purple-900/20 active:scale-95">
                Generar faltantes
              </button>
            </div>
          } @else {
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Todos los meses de esta guía ya están generados. Para regenerar un mes, elimínalo primero desde el historial.
            </p>
            <button
              (click)="cancelarConflictoModal()"
              class="w-full h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
              Entendido
            </button>
          }
        </div>
      </div>
    }

    <!-- Cerrar dropdown al hacer clic fuera -->
    @if (openDropdownId() !== null) {
      <div class="fixed inset-0 z-30" (click)="openDropdownId.set(null)"></div>
    }

    <!-- ===== DIÁLOGO DE CONFIRMACIÓN ===== -->
    @if (confirmDialog(); as dlg) {
      <div class="confirm-overlay" (click)="onConfirmDialogAction(false)">
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <!-- Icono -->
          <div class="confirm-icon-wrap">
            <svg class="confirm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <!-- Texto -->
          <div class="confirm-text">
            <p class="confirm-title">{{ dlg.title }}</p>
            <p class="confirm-body">{{ dlg.body }}</p>
          </div>
          <!-- Acciones -->
          <div class="confirm-actions">
            <button class="confirm-btn-cancel" (click)="onConfirmDialogAction(false)">Cancelar</button>
            <button class="confirm-btn-delete" (click)="onConfirmDialogAction(true)">Eliminar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }

    /* ── Custom easing curves (Emil: never use browser defaults) ── */
    :host {
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
      --ease-in-out-expo: cubic-bezier(0.77, 0, 0.175, 1);
    }

    /* ── Card group ── */
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .parte-card {
      position: relative;
      z-index: 1;
      border-radius: 10px;
      background: white;
      border: 1px solid rgba(0,0,0,0.08);
      transition: box-shadow 150ms var(--ease-out-expo),
                  border-color 150ms var(--ease-out-expo);
      animation: cardIn 220ms var(--ease-out-expo) both;
    }
    .parte-card.is-open,
    .parte-card.dropdown-active {
      z-index: 50;
    }
    :host-context(.dark) .parte-card {
      background: rgba(30,41,59,0.9);
      border-color: rgba(255,255,255,0.07);
    }
    .parte-card.has-conflict { border-color: rgba(239,68,68,0.25); }
    .parte-card.has-swapped  { border-color: rgba(245,158,11,0.25); }
    @media (hover: hover) and (pointer: fine) {
      .parte-card:hover {
        border-color: rgba(0,0,0,0.14);
        box-shadow: 0 2px 8px rgba(0,0,0,0.07);
      }
      :host-context(.dark) .parte-card:hover {
        border-color: rgba(255,255,255,0.12);
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      }
    }
    .parte-card:nth-child(1)  { animation-delay:  15ms; }
    .parte-card:nth-child(2)  { animation-delay:  40ms; }
    .parte-card:nth-child(3)  { animation-delay:  65ms; }
    .parte-card:nth-child(4)  { animation-delay:  90ms; }
    .parte-card:nth-child(5)  { animation-delay: 115ms; }
    .parte-card:nth-child(6)  { animation-delay: 140ms; }
    .parte-card:nth-child(n+7){ animation-delay: 160ms; }

    /* ── Assignee pill button ── */
    .assignee-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 14px;
      height: 30px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      border: 1px solid transparent;
      cursor: pointer;
      transition: transform 120ms var(--ease-out-expo),
                  background-color 120ms ease,
                  box-shadow 120ms ease,
                  border-color 120ms ease;
    }
    .assignee-btn:active:not(:disabled) {
      transform: scale(0.97);
    }
    .assignee-btn:disabled { opacity: 0.5; cursor: default; }

    /* Normal state */
    .assignee-btn.normal {
      background: rgba(109,40,217,0.08);
      color: #5b21b6;
      border-color: rgba(109,40,217,0.18);
      box-shadow: 0 1px 2px rgba(109,40,217,0.06);
    }
    :host-context(.dark) .assignee-btn.normal {
      background: rgba(139,92,246,0.12);
      color: #c4b5fd;
      border-color: rgba(139,92,246,0.22);
    }
    @media (hover: hover) and (pointer: fine) {
      .assignee-btn.normal:not(:disabled):hover {
        background: rgba(109,40,217,0.13);
        box-shadow: 0 2px 6px rgba(109,40,217,0.12);
      }
    }
    /* Conflict state */
    .assignee-btn.conflict {
      background: rgba(239,68,68,0.07);
      color: #dc2626;
      border-color: rgba(239,68,68,0.25);
    }
    :host-context(.dark) .assignee-btn.conflict {
      background: rgba(239,68,68,0.12);
      color: #fca5a5;
      border-color: rgba(239,68,68,0.3);
    }
    /* Swapped state */
    .assignee-btn.swapped {
      background: rgba(245,158,11,0.09);
      color: #b45309;
      border-color: rgba(245,158,11,0.28);
    }
    :host-context(.dark) .assignee-btn.swapped {
      background: rgba(245,158,11,0.12);
      color: #fcd34d;
      border-color: rgba(245,158,11,0.3);
    }

    /* ── Dropdown: origin-aware scale (Emil: never scale from center on popovers) ── */
    @keyframes dropIn {
      from { opacity: 0; transform: scale(0.95) translateY(-4px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .dropdown-panel {
      transform-origin: top right;
      animation: dropIn 160ms var(--ease-out-expo);
      background: white;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    }
    :host-context(.dark) .dropdown-panel {
      background: #1e293b;
      border-color: rgba(255,255,255,0.1);
      box-shadow: 0 8px 30px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3);
    }
    .dropdown-header {
      border-bottom: 1px solid rgba(0,0,0,0.06);
      background: rgba(0,0,0,0.02);
    }
    :host-context(.dark) .dropdown-header {
      background: rgba(255,255,255,0.03);
      border-bottom-color: rgba(255,255,255,0.08);
    }
    .dropdown-label { color: #94a3b8; }
    :host-context(.dark) .dropdown-label { color: #cbd5e1; }
    .dropdown-alt-name { color: #334155; }
    :host-context(.dark) .dropdown-alt-name { color: #e2e8f0; }
    .dropdown-alt-row {
      transition: background-color 100ms ease;
      background: transparent;
    }
    .dropdown-alt-row:hover { background: rgba(0,0,0,0.04); }
    :host-context(.dark) .dropdown-alt-row:hover { background: rgba(255,255,255,0.06); }

    /* ── Chevron rotate ── */
    .chevron {
      transition: transform 180ms var(--ease-out-expo);
    }
    .chevron.open { transform: rotate(180deg); }

    /* ── Section fadeIn (page-level) ── */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn { animation: fadeIn 0.15s ease-out; }

    /* ── Action buttons (Confirmar / Borrar) ── */
    .btn-confirmar {
      background: rgba(5,150,105,0.08);
      border-color: rgba(5,150,105,0.25);
      color: #047857;
    }
    .btn-confirmar:not(:disabled):hover {
      background: rgba(5,150,105,0.14);
    }
    :host-context(.dark) .btn-confirmar {
      background: rgba(52,211,153,0.1);
      border-color: rgba(52,211,153,0.22);
      color: #6ee7b7;
    }
    :host-context(.dark) .btn-confirmar:not(:disabled):hover {
      background: rgba(52,211,153,0.18);
    }
    .btn-borrar {
      background: rgba(220,38,38,0.07);
      border-color: rgba(220,38,38,0.22);
      color: #b91c1c;
    }
    .btn-borrar:not(:disabled):hover {
      background: rgba(220,38,38,0.13);
    }
    :host-context(.dark) .btn-borrar {
      background: rgba(248,113,113,0.1);
      border-color: rgba(248,113,113,0.2);
      color: #fca5a5;
    }
    :host-context(.dark) .btn-borrar:not(:disabled):hover {
      background: rgba(248,113,113,0.16);
    }

    /* ── Diálogo de confirmación ── */
    @keyframes overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes dialogIn {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .confirm-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(4px);
      animation: overlayIn 160ms ease;
    }
    .confirm-dialog {
      width: 100%;
      max-width: 380px;
      border-radius: 18px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      animation: dialogIn 200ms var(--ease-out-expo);
      background: white;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
    }
    :host-context(.dark) .confirm-dialog {
      background: #1e293b;
      border-color: rgba(255,255,255,0.1);
      box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4);
    }
    .confirm-icon-wrap {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(220,38,38,0.08);
      border: 1px solid rgba(220,38,38,0.18);
      flex-shrink: 0;
    }
    :host-context(.dark) .confirm-icon-wrap {
      background: rgba(239,68,68,0.12);
      border-color: rgba(239,68,68,0.25);
    }
    .confirm-icon { width: 22px; height: 22px; stroke: #dc2626; }
    :host-context(.dark) .confirm-icon { stroke: #f87171; }
    .confirm-text { display: flex; flex-direction: column; gap: 0.3rem; }
    .confirm-title {
      font-size: 0.95rem; font-weight: 800;
      color: #0f172a; line-height: 1.3;
    }
    :host-context(.dark) .confirm-title { color: #f1f5f9; }
    .confirm-body {
      font-size: 0.8rem; line-height: 1.55;
      color: #64748b;
    }
    :host-context(.dark) .confirm-body { color: #94a3b8; }
    .confirm-actions {
      display: flex; gap: 0.5rem; justify-content: flex-end; padding-top: 0.25rem;
    }
    .confirm-btn-cancel, .confirm-btn-delete {
      height: 36px; padding: 0 1.1rem;
      border-radius: 10px;
      font-size: 0.78rem; font-weight: 700;
      cursor: pointer; transition: all 120ms ease;
      border: 1px solid transparent;
    }
    .confirm-btn-cancel:active, .confirm-btn-delete:active { transform: scale(0.97); }
    .confirm-btn-cancel {
      background: rgba(0,0,0,0.04);
      border-color: rgba(0,0,0,0.1);
      color: #475569;
    }
    .confirm-btn-cancel:hover { background: rgba(0,0,0,0.08); }
    :host-context(.dark) .confirm-btn-cancel {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.12);
      color: #94a3b8;
    }
    :host-context(.dark) .confirm-btn-cancel:hover { background: rgba(255,255,255,0.1); }
    .confirm-btn-delete {
      background: #dc2626;
      color: white;
      box-shadow: 0 2px 8px rgba(220,38,38,0.3);
    }
    .confirm-btn-delete:hover { background: #b91c1c; box-shadow: 0 4px 12px rgba(220,38,38,0.4); }
  `]
})
export class ReunionesProgramacionComponent implements OnInit {

  private reunionesSvc = inject(ReunionesService);
  private asistenciaSvc = inject(AsistenciaService);
  congregacionCtx = inject(CongregacionContextService);
  private authStore = inject(AuthStore);
  private themeService = inject(ThemeService);

  hasEditPermission = computed(() => {
    const tipo = this.tipoReunionActivo();
    const perm = tipo === 'entre_semana' ? 'reuniones.entre_semana_editar' : 'reuniones.fin_semana_editar';
    return this.authStore.hasPermission(perm) || !!this.authStore.user()?.roles?.includes('Secretario');
  });

  // ── State machine ──────────────────────────────────────────────
  estado = signal<'idle' | 'loading' | 'draft' | 'confirmado' | 'historial' | 'error'>('idle');
  errorMsg = signal<string | null>(null);

  // ── Data signals ───────────────────────────────────────────────
  semanas = signal<ProgramaSemana[]>([]);
  selectedWeekIdx = signal(0);
  plantillas = signal<PlantillaOption[]>([]);
  loadingPlantillas = signal(false);

  // ── Historial signals ──────────────────────────────────────────
  periodos = signal<PeriodoConfirmado[]>([]);
  loadingPeriodos = signal(false);
  loadingHistorial = signal(false);
  descargandoPdf = signal(false);

  gruposPlantilla = computed<GrupoPlantilla[]>(() => {
    const mapa = new Map<string, GrupoPlantilla>();
    for (const p of this.periodos()) {
      const key = p.id_plantilla !== null ? String(p.id_plantilla) : 'sin-plantilla';
      if (!mapa.has(key)) {
        mapa.set(key, {
          id_plantilla: p.id_plantilla,
          nombre_plantilla: p.nombre_plantilla ?? 'Sin guía asociada',
          periodos: [],
        });
      }
      mapa.get(key)!.periodos.push(p);
    }
    return Array.from(mapa.values());
  });

  gruposExpandidos = signal<Set<string>>(new Set());

  // ── Diálogo de confirmación personalizado ─────────────────────
  confirmDialog = signal<{ title: string; body: string; resolve: (v: boolean) => void } | null>(null);

  private openConfirmDialog(title: string, body: string): Promise<boolean> {
    return new Promise(resolve => this.confirmDialog.set({ title, body, resolve }));
  }

  onConfirmDialogAction(accept: boolean): void {
    const d = this.confirmDialog();
    this.confirmDialog.set(null);
    d?.resolve(accept);
  }

  // ── Conflictos de regeneración ────────────────────────────────
  showConflictoModal = signal(false);
  conflictosDetectados = signal<ConflictoMes[]>([]);
  mesesFaltantes = signal<ConflictoMes[]>([]);
  pendingCreatePayload = signal<ProgramaMensualCreateRequest | null>(null);
  pendingGenPayload = signal<GenerarAsignacionesRequest | null>(null);
  editingHistorialId = signal<number | null>(null);
  historialCandidatos = signal<CandidatoAlternativo[]>([]);
  loadingCandidatos = signal(false);

  // ── Modal ──────────────────────────────────────────────────────
  showModal = signal(false);
  modalForm = signal<GenerarMesForm>({
    mes:      new Date().getMonth() + 1,
    ano:      new Date().getFullYear(),
    mes_fin:  new Date().getMonth() + 1,
    ano_fin:  new Date().getFullYear(),
    id_plantilla: 0,
    dia_reunion:  2,
  });

  // ── UI ─────────────────────────────────────────────────────────
  openDropdownId = signal<string | null>(null);
  selectedSala = signal<'Principal' | 'Auxiliar'>('Principal');

  // ── Meeting type toggle ────────────────────────────────────────
  tipoReunionActivo = signal<'entre_semana' | 'fin_semana'>('entre_semana');

  canViewEntreSemana = computed(() =>
    this.authStore.hasPermission('reuniones.entre_semana_ver') ||
    !!this.authStore.user()?.roles?.includes('Secretario')
  );
  canViewFinSemana = computed(() =>
    this.authStore.hasPermission('reuniones.fin_semana_ver') ||
    !!this.authStore.user()?.roles?.includes('Secretario')
  );
  showTipoTabs = computed(() => this.canViewEntreSemana() && this.canViewFinSemana());

  tituloReunion = computed(() =>
    this.tipoReunionActivo() === 'entre_semana'
      ? 'Vida y Ministerio Cristianos'
      : 'Reunión Pública y Atalaya'
  );

  // ── Section config ─────────────────────────────────────────────
  private readonly SECCIONES_ENTRE_SEMANA: Record<string, { titulo: string; color: string; orden: number; iconPath: string; iconViewBox?: string }> = {
    tesoros: {
      titulo: 'Tesoros de la Biblia',
      color: '#3c7f8b',
      orden: 0,
      iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    },
    seamos_mejores: {
      titulo: 'Seamos Mejores Maestros',
      color: '#d68f00',
      orden: 1,
      iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    },
    nuestra_vida: {
      titulo: 'Nuestra Vida Cristiana',
      color: '#bf2f13',
      orden: 2,
      iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    },
  };

  private readonly SECCIONES_FIN_SEMANA: Record<string, { titulo: string; color: string; orden: number; iconPath: string; iconViewBox?: string }> = {
    introduccion: {
      titulo: 'Introducción',
      color: '#6366f1',
      orden: 0,
      iconPath: 'M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z',
    },
    discurso_publico: {
      titulo: 'Discurso Público',
      color: '#2563eb',
      orden: 1,
      iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    },
    estudio_atalaya: {
      titulo: 'Estudio de La Atalaya',
      color: '#059669',
      orden: 2,
      iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    },
    conclusion: {
      titulo: 'Conclusión',
      color: '#64748b',
      orden: 3,
      iconPath: 'M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z',
    },
  };

  private get seccionesConfig() {
    return this.tipoReunionActivo() === 'entre_semana'
      ? this.SECCIONES_ENTRE_SEMANA
      : this.SECCIONES_FIN_SEMANA;
  }


  seccionColor(color: string, alpha: number): string {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** Mezcla el color de sección con blanco para obtener un fondo sólido opaco. mix=0→blanco, mix=1→color puro */
  seccionColorSolid(color: string, mix: number): string {
    const r = Math.round(255 * (1 - mix) + parseInt(color.slice(1, 3), 16) * mix);
    const g = Math.round(255 * (1 - mix) + parseInt(color.slice(3, 5), 16) * mix);
    const b = Math.round(255 * (1 - mix) + parseInt(color.slice(5, 7), 16) * mix);
    return `rgb(${r},${g},${b})`;
  }

  /** Mezcla el color de sección con slate-950 (#0f172a) para dark mode */
  seccionColorSolidDark(color: string, mix: number): string {
    const darkR = 15, darkG = 23, darkB = 42;
    const r = Math.round(darkR * (1 - mix) + parseInt(color.slice(1, 3), 16) * mix);
    const g = Math.round(darkG * (1 - mix) + parseInt(color.slice(3, 5), 16) * mix);
    const b = Math.round(darkB * (1 - mix) + parseInt(color.slice(5, 7), 16) * mix);
    return `rgb(${r},${g},${b})`;
  }

  // ── Computed ───────────────────────────────────────────────────
  currentSemana = computed(() => this.semanas()[this.selectedWeekIdx()] ?? null);

  salaCounts = computed(() => {
    const semana = this.currentSemana();
    if (!semana) return { principal: 0, auxiliar: 0 };
    const aux = semana.partes.filter(p => p.sala === 'Auxiliar').length;
    return { principal: semana.partes.length - aux, auxiliar: aux };
  });

  salaCountsPorSeccion = computed(() => {
    const semana = this.currentSemana();
    if (!semana) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const p of semana.partes) {
      if (p.sala === 'Auxiliar') {
        const sec = this._inferSeccion(p);
        counts[sec] = (counts[sec] ?? 0) + 1;
      }
    }
    return counts;
  });

  canConfirmar = computed(() => this.estado() === 'draft' && this.semanas().length > 0);
  canBorrarBorrador = computed(() => this.estado() === 'draft' && this.semanas().length > 0);
  fechasPreview = computed(() => {
    const { mes, ano, mes_fin, ano_fin, dia_reunion } = this.modalForm();
    return this.calcFechasRango(ano, mes, ano_fin, mes_fin, dia_reunion);
  });

  seccionesActuales = computed(() => {
    const semana = this.currentSemana();
    if (!semana) return [];
    const isDark = this.themeService.darkMode();
    const sala = this.selectedSala();
    const filtered = semana.partes.filter(p => {
      if (p.sala === 'Auxiliar') return sala === 'Auxiliar';
      if (p.aplica_sala_b) return sala === 'Principal';
      return true;
    });
    return this._buildSecciones(filtered, isDark);
  });

  private _inferSeccion(p: AsignacionDraft): string {
    const cfg = this.seccionesConfig;
    // 1. Key exacto (seed-based programs)
    if (p.seccion && cfg[p.seccion]) return p.seccion;

    // 2. Mapeo flexible del string de sección
    const s = (p.seccion || '').toLowerCase();

    // -- Fin de semana mappings --
    if (this.tipoReunionActivo() === 'fin_semana') {
      if (s.includes('discurso') || s.includes('publico') || s.includes('público')) return 'discurso_publico';
      if (s.includes('atalaya') || s.includes('estudio')) return 'estudio_atalaya';
      if (s.includes('apertura') || s.includes('introduccion') || s.includes('introducción')) return 'introduccion';
      if (s.includes('clausura') || s.includes('conclusion') || s.includes('conclusión') || s.includes('final')) return 'conclusion';
      // fallback by part name
      const n = (p.nombre_parte || '').toLowerCase();
      if (n.includes('discurso') || n.includes('orador')) return 'discurso_publico';
      if (n.includes('atalaya') || n.includes('conductor') || n.includes('lector')) return 'estudio_atalaya';
      if (n.includes('presidente') || n.includes('oración inicial') || n.includes('oracion inicial') || n.includes('canto')) return 'introduccion';
      if (n.includes('oración final') || n.includes('oracion final')) return 'conclusion';
      return 'introduccion';
    }

    // -- Entre semana mappings --
    if (s.includes('tesoro')) return 'tesoros';
    if (s.includes('mejor') || s.includes('maestro')) return 'seamos_mejores';
    if (s.includes('vida') || s.includes('cristian')) return 'nuestra_vida';
    if (s.includes('apertura')) return 'tesoros';
    if (s.includes('clausura')) return 'nuestra_vida';

    // 3. Inferencia por nombre de parte
    const n = (p.nombre_parte || '').toLowerCase();
    if (n.includes('tesoros') || n.includes('lectura de la biblia') || n.includes('busquemos') || n.includes('perlas') || n.includes('presidente') || n.includes('oración inicial') || n.includes('oracion inicial')) return 'tesoros';
    if (n.includes('empiece') || n.includes('revisita') || n.includes('discípulo') || n.includes('haga discí') || n.includes('seamos') || n.includes('maestro')) return 'seamos_mejores';
    if (n.includes('estudio bíblico') || n.includes('estudio biblico') || n.includes('necesidades') || n.includes('oración final') || n.includes('oracion final') || n.includes('conductor') || n.includes('hospitalario') || n.includes('anuncio')) return 'nuestra_vida';

    return 'tesoros';
  }

  private _buildSecciones(partes: AsignacionDraft[], isDark: boolean) {
    const map = new Map<string, AsignacionDraft[]>();
    for (const p of partes) {
      const key = this._inferSeccion(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }

    const result: any[] = [];
    for (const [seccionKey, seccionPartes] of map) {
      const cfg = this.seccionesConfig[seccionKey] ?? Object.values(this.seccionesConfig)[0];
      const grupos = this._buildGrupos(seccionPartes);
      result.push({
        id: seccionKey,
        titulo: cfg.titulo,
        color: cfg.color,
        orden: cfg.orden,
        iconPath: cfg.iconPath,
        headerBg: isDark
          ? this.seccionColorSolidDark(cfg.color, 0.08)
          : this.seccionColorSolid(cfg.color, 0.12),
        headerBorder: this.seccionColor(cfg.color, isDark ? 0.4 : 0.25),
        badgeBg: this.seccionColor(cfg.color, isDark ? 0.18 : 0.14),
        partes: seccionPartes,
        grupos,
      });
    }
    return result.sort((a: any, b: any) => a.orden - b.orden);
  }

  private _buildGrupos(partes: AsignacionDraft[]) {
    const grupos: { key: string; partes: AsignacionDraft[]; role0: string; role1: string }[] = [];
    // Track by object reference — avoids key collisions when conductor+lector share id_programa_parte
    const used = new Set<AsignacionDraft>();
    const uid = (p: AsignacionDraft, i: number) =>
      p.id_asignacion != null ? `a${p.id_asignacion}` : `i${i}`;

    const maestros = partes.filter(p => !p.es_ayudante);
    const ayudantes = partes.filter(p => p.es_ayudante);

    maestros.forEach((p, i) => {
      if (used.has(p)) return;
      used.add(p);

      const nombre = (p.nombre_parte || '').toLowerCase();
      const esConductor = nombre.includes('conductor') || 
                          (nombre.includes('estudio bíblico') && !nombre.includes('lector')) ||
                          (nombre.includes('estudio biblico') && !nombre.includes('lector')) ||
                          (nombre.includes('estudio de la atalaya') && !nombre.includes('lector'));
      const esMaestro = nombre.includes('empiece') || nombre.includes('revisita') || nombre.includes('discípulo') || nombre.includes('haga disc');
      const key = uid(p, i);

      if (esConductor) {
        // EBC lector shares same id_programa_parte, has "lector" in nombre_parte, es_ayudante=false
        const lectorM = maestros.find(q => {
          if (used.has(q)) return false;
          const qn = (q.nombre_parte || '').toLowerCase();
          return (q.id_programa_parte === p.id_programa_parte && qn.includes('lector')) ||
                 (qn === nombre) ||
                 (qn.includes('lector') && (nombre.includes('estudio') || nombre.includes('atalaya')));
        });
        const lectorA = !lectorM ? ayudantes.find(q => {
          if (used.has(q)) return false;
          const qn = (q.nombre_parte || '').toLowerCase();
          return qn.includes('lector') && (qn.includes('estudio') || qn.includes('atalaya'));
        }) : null;
        const lector = lectorM ?? lectorA;
        if (lector) {
          used.add(lector);
          grupos.push({ key, partes: [p, lector], role0: 'Conductor', role1: 'Lector' });
        } else {
          grupos.push({ key, partes: [p], role0: '', role1: '' });
        }
      } else if (esMaestro || p.aplica_sala_b) {
        const stripSuffix = (n: string) =>
          n.replace(/\s*\((sala b[^)]*|ayudante[^)]*)\)/gi, '').trim();
        const nombreBase = stripSuffix(nombre);
        const misAyudantes = nombreBase.length > 2
          ? ayudantes.filter(q => {
              if (used.has(q)) return false;
              return stripSuffix((q.nombre_parte || '').toLowerCase()).startsWith(nombreBase);
            }).slice(0, 2)
          : [];
        misAyudantes.forEach(a => used.add(a));
        grupos.push({ key, partes: [p, ...misAyudantes], role0: 'Maestro', role1: 'Ayudante' });
      } else {
        grupos.push({ key, partes: [p], role0: '', role1: '' });
      }
    });

    // Ayudantes huérfanos (sin maestro emparejado)
    ayudantes.forEach((a, i) => {
      if (!used.has(a)) {
        grupos.push({ key: uid(a, maestros.length + i), partes: [a], role0: '', role1: '' });
      }
    });

    return grupos;
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  ngOnInit(): void {
    // Set initial type based on user permissions
    if (!this.canViewEntreSemana() && this.canViewFinSemana()) {
      this.tipoReunionActivo.set('fin_semana');
    }
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) {
      this.errorMsg.set('No hay congregacion seleccionada. Selecciona una en el panel de administracion.');
      this.estado.set('error');
      return;
    }
    this.tryLoadDrafts(idCong);
    this.loadPeriodos(idCong);
  }

  private loadPeriodos(idCong: number): void {
    this.loadingPeriodos.set(true);
    this.reunionesSvc.getPeriodosConfirmados(this.tipoReunionActivo(), idCong).subscribe({
      next: (p) => { this.periodos.set(p); this.loadingPeriodos.set(false); },
      error: () => this.loadingPeriodos.set(false),
    });
  }

  // ── Load existing drafts ───────────────────────────────────────
  private tryLoadDrafts(idCong: number): void {
    const now = new Date();
    const defaultDay = this.tipoReunionActivo() === 'entre_semana' ? 2 : 7;
    const fechas = this.calcFechas(now.getFullYear(), now.getMonth() + 1, defaultDay);
    if (fechas.length === 0) { this.estado.set('idle'); return; }

    this.estado.set('loading');
    const ano = now.getFullYear();
    const requests = fechas.map((f) =>
      this.reunionesSvc
        .getDraft(this.tipoReunionActivo(), ano, this.getIsoWeek(f), idCong)
        .pipe(catchError(() => of(null)))
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const valid = results.filter((r): r is ProgramaSemana => r !== null);
        if (valid.length > 0) {
          this.semanas.set(valid);
          this.estado.set('draft');
        } else {
          this.estado.set('idle');
        }
      },
      error: () => this.estado.set('idle'),
    });
  }

  // ── Modal ──────────────────────────────────────────────────────
  openModal(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.showModal.set(true);
    this.loadingPlantillas.set(true);
    forkJoin({
      plantillas: this.reunionesSvc.getPlantillas(this.tipoReunionActivo(), idCong),
      config: this.asistenciaSvc.getCongregacionConfig().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ plantillas, config }) => {
        const configKey = this.tipoReunionActivo() === 'entre_semana' ? 'dia_reunion_entre_semana' : 'dia_reunion_fin_semana';
        const diaReunion = this.diaReunionToNumber(config?.[configKey as keyof typeof config] as string | null ?? null);
        this.plantillas.set(plantillas);
        this.modalForm.update((f) => ({ ...f, dia_reunion: diaReunion }));
        if (plantillas.length > 0) {
          const selected =
            plantillas.find((p) => p.id_plantilla === this.modalForm().id_plantilla) ?? plantillas[0];
          this.applyPlantillaPeriodo(selected);
        }
        this.loadingPlantillas.set(false);
      },
      error: () => {
        this.plantillas.set([]);
        this.loadingPlantillas.set(false);
        this.errorMsg.set('No se pudieron cargar las plantillas.');
      },
    });
  }

  updateModal(field: keyof GenerarMesForm, value: number): void {
    if (field === 'id_plantilla') {
      const plantilla = this.plantillas().find((p) => p.id_plantilla === value);
      if (plantilla) {
        this.applyPlantillaPeriodo(plantilla);
        return;
      }
    }
    this.modalForm.update((f) => ({ ...f, [field]: value }));
  }

  private applyPlantillaPeriodo(plantilla: PlantillaOption): void {
    const f = this.modalForm();
    const mesIni = plantilla.mes_inicio ?? f.mes;
    const anoIni = plantilla.ano_inicio ?? f.ano;
    const mesFin = plantilla.mes_fin    ?? mesIni;
    const anoFin = plantilla.ano_fin    ?? anoIni;
    this.modalForm.update((prev) => ({
      ...prev,
      id_plantilla: plantilla.id_plantilla,
      mes: mesIni, ano: anoIni,
      mes_fin: mesFin, ano_fin: anoFin,
    }));
  }

  private diaReunionToNumber(dia: string | null): number {
    const map: Record<string, number> = {
      Lunes: 1,
      Martes: 2,
      Miercoles: 3,
      Jueves: 4,
      Viernes: 5,
      Sabado: 6,
      Domingo: 7,
    };
    const defaultDay = this.tipoReunionActivo() === 'entre_semana' ? 2 : 7;
    return dia ? map[dia] ?? defaultDay : defaultDay;
  }

  onModalSubmit(): void {
    const form = this.modalForm();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || form.id_plantilla === 0) return;

    const fechas = this.calcFechasRango(form.ano, form.mes, form.ano_fin, form.mes_fin, form.dia_reunion);
    if (fechas.length === 0) return;

    const createPayload: ProgramaMensualCreateRequest = {
      id_congregacion: idCong,
      tipo_reunion: this.tipoReunionActivo(),
      mes: form.mes,
      ano: form.ano,
      semanas: fechas,
      id_plantilla: form.id_plantilla,
    };

    const genPayload: GenerarAsignacionesRequest = {
      tipo_reunion: this.tipoReunionActivo(),
      fecha_inicio: fechas[0],
      fecha_fin: fechas[fechas.length - 1],
      id_congregacion: idCong,
    };

    // Verificar conflictos antes de generar
    this.reunionesSvc.verificarConflictosPlantilla(createPayload).subscribe({
      next: (resultado) => {
        if (resultado.tiene_conflictos) {
          this.showModal.set(false);
          this.conflictosDetectados.set(resultado.conflictos);
          this.mesesFaltantes.set(resultado.meses_faltantes);
          this.pendingCreatePayload.set(createPayload);
          this.pendingGenPayload.set(genPayload);
          this.showConflictoModal.set(true);
        } else {
          this.showModal.set(false);
          this._ejecutarGeneracion(createPayload, genPayload);
        }
      },
      error: () => {
        // Si falla la verificación, proceder directamente
        this.showModal.set(false);
        this._ejecutarGeneracion(createPayload, genPayload);
      },
    });
  }

  confirmarGenerarFaltantes(): void {
    const createPayload = this.pendingCreatePayload();
    const genPayload = this.pendingGenPayload();
    const faltantes = this.mesesFaltantes();
    this.showConflictoModal.set(false);
    if (!createPayload || !genPayload) return;

    if (faltantes.length === 0) return;

    // Pasamos la lista COMPLETA de semanas a crearProgramaMensual para que el backend
    // calcule los índices ordinales correctamente respecto a la guía completa.
    // El backend ya omite internamente las semanas que ya existen en la DB.
    const mesesSet = new Set(faltantes.map(m => `${m.ano}-${m.mes}`));
    const semanasFiltradas = createPayload.semanas.filter(f => {
      const d = new Date(f + 'T00:00:00');
      return mesesSet.has(`${d.getFullYear()}-${d.getMonth() + 1}`);
    });

    // generar solo trae las semanas nuevas al UI
    const genFiltrado: GenerarAsignacionesRequest = {
      ...genPayload,
      fecha_inicio: semanasFiltradas[0],
      fecha_fin: semanasFiltradas[semanasFiltradas.length - 1],
    };
    // createPayload sin filtrar → ordinales correctos en el backend
    this._ejecutarGeneracion(createPayload, genFiltrado);
  }

  cancelarConflictoModal(): void {
    this.showConflictoModal.set(false);
    this.pendingCreatePayload.set(null);
    this.pendingGenPayload.set(null);
  }

  private _ejecutarGeneracion(createPayload: ProgramaMensualCreateRequest, genPayload: GenerarAsignacionesRequest): void {
    this.estado.set('loading');
    this.errorMsg.set(null);
    this.reunionesSvc
      .crearProgramaMensual(createPayload)
      .pipe(switchMap(() => this.reunionesSvc.generarAsignaciones(genPayload)))
      .subscribe({
        next: (resp) => {
          const seen = new Set<number>();
          const unicas = resp.semanas.filter(s => seen.has(s.semana_iso) ? false : (seen.add(s.semana_iso), true));
          this.semanas.set(unicas);
          this.selectedWeekIdx.set(0);
          this.selectedSala.set('Principal');
          this.estado.set('draft');
          this.loadPeriodos(this.congregacionCtx.effectiveCongregacionId()!);
        },
        error: (err) => {
          const msg = err?.error?.detail ?? err?.message ?? 'Error al generar el programa.';
          this.errorMsg.set(msg);
          this.estado.set('error');
        },
      });
  }

  // ── Manual swap ────────────────────────────────────────────────
  // Unique key per pill — disambiguates conductor vs lector sharing the same id_programa_parte
  pillKey(asig: AsignacionDraft): string {
    return asig.id_asignacion != null
      ? `a${asig.id_asignacion}`
      : `p${asig.id_programa_parte}|${asig.nombre_parte ?? ''}|${asig.es_ayudante ? '1' : '0'}`;
  }

  swapAsignacion(
    semanaIdx: number,
    asigRef: AsignacionDraft,
    candidato: CandidatoAlternativo,
  ): void {
    const targetKey = this.pillKey(asigRef);
    this.semanas.update((semanas) =>
      semanas.map((sem, si) => {
        if (si !== semanaIdx) return sem;
        return {
          ...sem,
          partes: sem.partes.map((asig) => {
            if (this.pillKey(asig) !== targetKey) return asig;
            return {
              ...asig,
              id_publicador: candidato.id_publicador,
              nombre_completo: candidato.nombre_completo,
              _swapped: true,
            };
          }),
        };
      })
    );
    this.openDropdownId.set(null);

    // Persist the swap to Redis so confirmation uses the updated assignment
    if (this.estado() === 'draft') {
      const semana = this.semanas()[semanaIdx];
      const idCong = this.congregacionCtx.effectiveCongregacionId();
      if (semana && idCong) {
        const ano = new Date(semana.fecha).getFullYear();
        this.reunionesSvc.swapDraftAsignacion(
          this.tipoReunionActivo(), ano, semana.semana_iso, idCong,
          asigRef.id_programa_parte, asigRef.nombre_parte ?? '',
          candidato.id_publicador, candidato.nombre_completo,
        ).subscribe(); // fire-and-forget; local state already updated
      }
    }
  }

  toggleDropdown(asig: AsignacionDraft): void {
    const key = this.pillKey(asig);
    this.openDropdownId.update((id) => (id === key ? null : key));
  }

  isGroupOpen(grupo: any): boolean {
    const openId = this.openDropdownId();
    if (openId === null) return false;
    return grupo.partes.some((p: any) => this.pillKey(p) === openId);
  }

  // ── Confirm ────────────────────────────────────────────────────
  confirmar(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    const semanas = this.semanas();
    if (semanas.length === 0) return;

    const ano = new Date(semanas[0].fecha).getFullYear();
    const semanasIso = semanas.map((s) => s.semana_iso);

    this.estado.set('loading');

    const payload: ConfirmarDraftRequest = {
      tipo_reunion: this.tipoReunionActivo(),
      semanas_iso: semanasIso,
      ano,
      id_congregacion: idCong,
    };

    this.reunionesSvc.confirmarDrafts(payload).subscribe({
      next: () => {
        this.estado.set('confirmado');
        this.loadPeriodos(idCong);
      },
      error: (err) => {
        const msg = err?.error?.detail ?? 'Error al confirmar las asignaciones.';
        this.errorMsg.set(msg);
        this.estado.set('error');
      },
    });
  }

  async borrarBorrador(): Promise<void> {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    const semanas = this.semanas();
    if (!idCong || semanas.length === 0 || this.estado() !== 'draft') return;
    const ok = await this.openConfirmDialog(
      'Borrar borrador',
      '¿Deseas borrar este borrador? Las asignaciones generadas se perderán y no se podrán recuperar.'
    );
    if (!ok) return;

    const ano = new Date(semanas[0].fecha).getFullYear();
    const requests = semanas.map((sem) =>
      this.reunionesSvc.deleteDraft(this.tipoReunionActivo(), ano, sem.semana_iso, idCong)
    );

    this.estado.set('loading');
    this.errorMsg.set(null);

    forkJoin(requests).subscribe({
      next: () => {
        this.semanas.set([]);
        this.selectedWeekIdx.set(0);
        this.estado.set('idle');
      },
      error: (err) => {
        const msg = err?.error?.detail ?? 'Error al borrar el borrador.';
        this.errorMsg.set(msg);
        this.estado.set('error');
      },
    });
  }


  // ── CSS helpers ────────────────────────────────────────────────
  estadoBadgeClass = computed(() => {
    const base = 'px-2.5 py-1 rounded-full text-xs font-bold border ';
    const map: Record<string, string> = {
      idle:       base + 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      loading:    base + 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse',
      draft:      base + 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      confirmado: base + 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      historial:  base + 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800',
      error:      base + 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    };
    return map[this.estado()] ?? map['idle'];
  });

  estadoLabel = computed(() => {
    const map: Record<string, string> = {
      idle: 'Sin programa',
      loading: 'Procesando...',
      draft: 'Borrador',
      confirmado: 'Confirmado',
      historial: 'Historial',
      error: 'Error',
    };
    return map[this.estado()] ?? '';
  });

  weekTabClass(i: number): string {
    return i === this.selectedWeekIdx()
      ? 'bg-[#6D28D9] text-white border-[#6D28D9] shadow-sm shadow-purple-900/20'
      : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#6D28D9]/40 hover:text-[#6D28D9] dark:hover:border-[#6D28D9]/30 dark:hover:text-[#a78bfa] bg-white dark:bg-slate-800';
  }

  salaTabClass(sala: 'Principal' | 'Auxiliar'): string {
    const base = 'flex items-center gap-1 px-2 h-6 rounded text-[0.65rem] font-bold whitespace-nowrap transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ';
    return sala === this.selectedSala()
      ? base + 'bg-white/80 shadow-sm'
      : base + 'opacity-60 hover:opacity-90';
  }

  parteCardClass(asig: AsignacionDraft): string {
    if (asig.estado === 'conflict')
      return 'bg-red-50/40 dark:bg-red-900/10';
    if (asig._swapped)
      return 'bg-amber-50/40 dark:bg-amber-900/10';
    return 'hover:bg-slate-50 dark:hover:bg-slate-800/40';
  }

  grupoCardClass(grupo: { partes: AsignacionDraft[] }): string {
    const hasConflict = grupo.partes.some(p => p.estado === 'conflict');
    const hasSwapped = grupo.partes.some(p => p._swapped);
    if (hasConflict) return 'bg-red-50/30 dark:bg-red-900/10';
    if (hasSwapped)  return 'bg-amber-50/30 dark:bg-amber-900/10';
    return 'hover:bg-slate-50/60 dark:hover:bg-slate-800/20';
  }

  assigneeButtonClass(asig: AsignacionDraft): string {
    if (asig.estado === 'conflict') return 'assignee-btn conflict';
    if (asig._swapped)              return 'assignee-btn swapped';
    return 'assignee-btn normal';
  }

  grupoHasConflict(partes: AsignacionDraft[]): boolean {
    return partes.some(p => p.estado === 'conflict');
  }
  grupoHasSwapped(partes: AsignacionDraft[]): boolean {
    return partes.some(p => p._swapped === true);
  }
  grupoDropdownActivo(partes: AsignacionDraft[]): boolean {
    const openId = this.openDropdownId();
    const editId = this.editingHistorialId();
    return partes.some(p => openId === this.pillKey(p) || editId === p.id_asignacion);
  }
  grupoHasReemplazo(partes: AsignacionDraft[]): boolean {
    return partes.some(p => p.es_reemplazo);
  }
  grupoDotColor(partes: AsignacionDraft[], seccionColor: string): string {
    if (partes.some(p => p.estado === 'conflict')) return '#ef4444';
    if (partes.some(p => p._swapped)) return '#f59e0b';
    return seccionColor;
  }

  displayNombreParte(asig: AsignacionDraft): string {
    const n = asig.nombre_parte || '';
    const nl = n.toLowerCase();
    if ((nl.includes('palabras de introducci') || nl.includes('introducción y oración') || nl.includes('introduccion y oracion'))
        && !nl.includes('presidente')) {
      return `${n} (Presidente)`;
    }
    return n;
  }

  grupoRoleLabel(grupo: { partes: AsignacionDraft[]; role0: string; role1: string }, pi: number): string {
    if (pi === 0) return grupo.role0;
    if (pi === 1) return grupo.role1;
    return 'Ayudante 2';
  }

  // ── Ayudantes: add / remove ─────────────────────────────────────
  loadingAyudante = signal<number | null>(null);

  readonly sexoOpts = [
    { v: null as string | null, l: 'Todos' },
    { v: 'F', l: '♀' },
    { v: 'M', l: '♂' },
  ];

  private _sexoFilters = new Map<string, string | null>();

  setSexoFilter(asig: AsignacionDraft, sexo: string | null): void {
    this._sexoFilters.set(this.pillKey(asig), sexo);
  }

  getSexoFilter(asig: AsignacionDraft): string | null {
    return this._sexoFilters.get(this.pillKey(asig)) ?? null;
  }

  filteredAlternativos(asig: AsignacionDraft): CandidatoAlternativo[] {
    if (!asig.es_ayudante) return asig.alternativos;
    const filtro = this._sexoFilters.get(this.pillKey(asig)) ?? null;
    if (!filtro) return asig.alternativos;
    return asig.alternativos.filter(a => {
      const sexo = (a as any).sexo;
      if (!sexo) return true;
      return sexo.toUpperCase().startsWith(filtro);
    });
  }

  puedeAgregarAyudante(grupo: { partes: AsignacionDraft[] }, seccion: any): boolean {
    if (seccion?.id !== 'seamos_mejores') return false;
    const ayudantes = grupo.partes.filter(p => p.es_ayudante);
    return ayudantes.length < 2 && grupo.partes[0]?.aplica_sala_b === true;
  }

  onAgregarAyudante(grupo: { partes: AsignacionDraft[] }, semanaIdx: number): void {
    const maestro = grupo.partes.find(p => !p.es_ayudante);
    if (!maestro) return;
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.loadingAyudante.set(maestro.id_programa_parte);
    this.reunionesSvc.agregarAyudante(maestro.id_programa_parte, idCong).subscribe({
      next: (nuevaAsig) => {
        this.semanas.update(semanas => semanas.map((sem, si) => {
          if (si !== semanaIdx) return sem;
          return { ...sem, partes: [...sem.partes, nuevaAsig] };
        }));
        this.loadingAyudante.set(null);
      },
      error: () => this.loadingAyudante.set(null),
    });
  }

  onEliminarAyudante(asig: AsignacionDraft, semanaIdx: number, event: Event): void {
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.reunionesSvc.eliminarAyudante(asig.id_programa_parte, idCong).subscribe({
      next: () => {
        this.semanas.update(semanas => semanas.map((sem, si) => {
          if (si !== semanaIdx) return sem;
          return { ...sem, partes: sem.partes.filter(p => p.id_programa_parte !== asig.id_programa_parte) };
        }));
        this._sexoFilters.delete(this.pillKey(asig));
      },
    });
  }

  // ── Historial ──────────────────────────────────────────────────
  readonly MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  periodoEliminable(p: { ano: number; mes: number }): boolean {
    const hoy = new Date();
    const limite = new Date(hoy.getFullYear(), hoy.getMonth() - 4, 1);
    const periodo = new Date(p.ano, p.mes - 1, 1);
    return periodo >= limite;
  }

  toggleGrupo(key: string, event: Event): void {
    event.stopPropagation();
    this.gruposExpandidos.update(set => {
      const next = new Set(set);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  grupoKey(grupo: GrupoPlantilla): string {
    return grupo.id_plantilla !== null ? String(grupo.id_plantilla) : 'sin-plantilla';
  }

  abreviarNombreGuia(nombre: string): string {
    // "Guía de Actividades - Mayo 2026" → "GDA - Mayo 2026"
    return nombre.replace(/Gu[ií]a\s+de\s+Actividades/i, 'GDA');
  }

  descargarPdfMes(p: PeriodoConfirmado, event: Event): void {
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || this.descargandoPdf()) return;
    this.descargandoPdf.set(true);
    this.reunionesSvc
      .descargarProgramacionPdf(this.tipoReunionActivo(), p.ano, p.mes, idCong)
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `programacion_${this.tipoReunionActivo()}_${p.ano}_${String(p.mes).padStart(2, '0')}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          this.descargandoPdf.set(false);
        },
        error: () => this.descargandoPdf.set(false),
      });
  }

  async eliminarHistorial(p: PeriodoConfirmado, event: Event): Promise<void> {
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    const ok = await this.openConfirmDialog(
      `Eliminar ${p.label}`,
      `Se borrarán todas las semanas, partes y asignaciones confirmadas de este mes. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    this.reunionesSvc.eliminarHistorialMes(this.tipoReunionActivo(), p.ano, p.mes, idCong).subscribe({
      next: () => {
        this.periodos.update(list => list.filter(x => !(x.ano === p.ano && x.mes === p.mes)));
        this.semanas.set([]);
        this.estado.set('idle');
      },
    });
  }

  async eliminarGuiaCompleta(grupo: GrupoPlantilla, event: Event): Promise<void> {
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    const mesesLabel = grupo.periodos.map(p => p.label).join(', ');
    const ok = await this.openConfirmDialog(
      `Eliminar "${grupo.nombre_plantilla}"`,
      `Se eliminarán todos los programas de ${mesesLabel}. Las semanas, partes y asignaciones confirmadas se perderán permanentemente.`
    );
    if (!ok) return;

    const mesSet = new Set(grupo.periodos.map(p => `${p.ano}-${p.mes}`));
    const limpiar = () => {
      this.periodos.update(list => list.filter(p => !mesSet.has(`${p.ano}-${p.mes}`)));
      this.semanas.set([]);
      this.estado.set('idle');
    };

    if (grupo.id_plantilla !== null) {
      this.reunionesSvc.eliminarHistorialPlantilla(grupo.id_plantilla, idCong).subscribe({ next: limpiar });
    } else {
      // "Sin guía asociada": eliminar mes a mes en serie
      const tipo = this.tipoReunionActivo();
      const periodos = [...grupo.periodos];
      const deleteNext = (idx: number) => {
        if (idx >= periodos.length) { limpiar(); return; }
        const p = periodos[idx];
        this.reunionesSvc.eliminarHistorialMes(tipo, p.ano, p.mes, idCong).subscribe({
          next: () => deleteNext(idx + 1),
          error: () => deleteNext(idx + 1),
        });
      };
      deleteNext(0);
    }
  }

  loadHistorial(mes: number, ano: number): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.loadingHistorial.set(true);
    this.reunionesSvc.getHistorialConfirmado(this.tipoReunionActivo(), ano, mes, idCong).subscribe({
      next: (semanas) => {
        if (semanas.length === 0) {
          this.errorMsg.set(`No hay programas confirmados para ${this.MESES[mes - 1]} ${ano}.`);
          this.estado.set('error');
        } else {
          this.semanas.set(semanas);
          this.selectedWeekIdx.set(0);
          this.selectedSala.set('Principal');
          this.estado.set('historial');
        }
        this.loadingHistorial.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al cargar el historial.');
        this.estado.set('error');
        this.loadingHistorial.set(false);
      },
    });
  }

  openHistorialEdit(asig: AsignacionDraft): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || !asig.id_asignacion) return;
    if (this.editingHistorialId() === asig.id_asignacion) {
      this.editingHistorialId.set(null);
      return;
    }
    this.editingHistorialId.set(asig.id_asignacion);
    this.historialCandidatos.set([]);
    this.loadingCandidatos.set(true);
    this.reunionesSvc.getCandidatosConfirmados(asig.id_asignacion, idCong).subscribe({
      next: (candidatos) => {
        this.historialCandidatos.set(candidatos);
        this.loadingCandidatos.set(false);
      },
      error: () => this.loadingCandidatos.set(false),
    });
  }

  selectHistorialCandidato(semanaIdx: number, asig: AsignacionDraft, candidato: CandidatoAlternativo): void {
    if (!asig.id_asignacion) return;
    const payload: EditarAsignacionRequest = { id_publicador_nuevo: candidato.id_publicador };
    this.reunionesSvc.editarAsignacion(asig.id_asignacion, payload).subscribe({
      next: (result) => {
        this.semanas.update((semanas) =>
          semanas.map((sem, si) => {
            if (si !== semanaIdx) return sem;
            return {
              ...sem,
              partes: sem.partes.map((p) => {
                if (p.id_asignacion !== asig.id_asignacion) return p;
                return { ...p, id_publicador: result.id_publicador, nombre_completo: result.nombre_completo, _swapped: true };
              }),
            };
          })
        );
        this.editingHistorialId.set(null);
      },
      error: () => this.editingHistorialId.set(null),
    });
  }

  // ── Date utilities ─────────────────────────────────────────────
  private calcFechasRango(
    anoInicio: number, mesInicio: number,
    anoFin: number,   mesFin: number,
    diaSemana: number
  ): string[] {
    const fechas: string[] = [];
    const primerDia = new Date(anoInicio, mesInicio - 1, 1);
    const isoDay = primerDia.getDay() === 0 ? 7 : primerDia.getDay();
    let offset = diaSemana - isoDay;
    if (offset < 0) offset += 7;
    let current = new Date(anoInicio, mesInicio - 1, 1 + offset);
    // límite: primer día del mes siguiente al mes de fin
    const limite = new Date(anoFin, mesFin, 1);
    while (true) {
      // Comparar el LUNES ISO de la semana, no la fecha de reunión.
      // Una semana pertenece al rango si su lunes cae dentro del rango,
      // aunque el día de reunión caiga en el mes siguiente (ej: semana 27abr–3may).
      const dow = current.getDay() === 0 ? 7 : current.getDay();
      const lunes = new Date(current.getFullYear(), current.getMonth(), current.getDate() - (dow - 1));
      if (lunes >= limite) break;
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      fechas.push(`${y}-${m}-${d}`);
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
    }
    return fechas;
  }

  private calcFechas(ano: number, mes: number, diaSemana: number): string[] {
    return this.calcFechasRango(ano, mes, ano, mes, diaSemana);
  }

  private getIsoWeek(dateStr: string): number {
    const d = new Date(dateStr);
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  // ── Meeting type toggle ────────────────────────────────────────
  onTipoChange(tipo: 'entre_semana' | 'fin_semana'): void {
    if (tipo === this.tipoReunionActivo()) return;
    this.tipoReunionActivo.set(tipo);
    // Reset state for new type
    this.semanas.set([]);
    this.selectedWeekIdx.set(0);
    this.selectedSala.set('Principal');
    this.estado.set('idle');
    this.errorMsg.set(null);
    this.periodos.set([]);
    this.openDropdownId.set(null);
    this.editingHistorialId.set(null);
    // Reload for the new type
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (idCong) {
      this.tryLoadDrafts(idCong);
      this.loadPeriodos(idCong);
    }
  }
}

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
} from '../models/reuniones.models';

@Component({
  selector: 'app-reuniones-programacion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-3 h-full">

      <!-- ===== PAGE HEADER ===== -->
      <div class="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            {{ tituloReunion() }}
          </h1>
          <div class="flex items-center gap-2 mt-1">
            <span [class]="estadoBadgeClass()">{{ estadoLabel() }}</span>
            @if (congregacionCtx.selectedCongregacionName()) {
              <span class="text-xs text-slate-400 dark:text-slate-500">· {{ congregacionCtx.selectedCongregacionName() }}</span>
            }
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            *ngIf="hasEditPermission()"
            (click)="openModal()"
            [disabled]="estado() === 'loading'"
            class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm shadow-purple-900/20 active:scale-95">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Generar Mes
          </button>
          <button
            *ngIf="hasEditPermission()"
            (click)="confirmar()"
            [disabled]="!canConfirmar()"
            class="btn-confirmar flex items-center gap-1.5 px-3 h-9 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-95">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Confirmar
          </button>
          <button
            *ngIf="hasEditPermission()"
            (click)="borrarBorrador()"
            [disabled]="!canBorrarBorrador()"
            class="btn-borrar flex items-center gap-1.5 px-3 h-9 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-95">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Borrar borrador
          </button>
        </div>
      </div>

      <!-- ===== MEETING TYPE SELECTOR ===== -->
      @if (showTipoTabs()) {
        <div class="shrink-0 flex items-center justify-center sm:justify-start">
          <div class="tipo-tabs inline-flex items-center rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
            <button
              (click)="onTipoChange('entre_semana')"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
              [class]="tipoReunionActivo() === 'entre_semana'
                ? 'bg-white dark:bg-slate-700 text-[#6D28D9] dark:text-purple-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              Vida y Ministerio
            </button>
            <button
              (click)="onTipoChange('fin_semana')"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
              [class]="tipoReunionActivo() === 'fin_semana'
                ? 'bg-white dark:bg-slate-700 text-[#6D28D9] dark:text-purple-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
              Reunión Pública
            </button>
          </div>
        </div>
      }

      <!-- ===== ERROR ===== -->
      @if (estado() === 'error') {
        <div class="shrink-0 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-red-700 dark:text-red-300 text-sm font-bold">Ocurrio un error</p>
            <p class="text-red-500 dark:text-red-400/80 text-xs truncate">{{ errorMsg() }}</p>
          </div>
          <button
            (click)="estado.set('idle')"
            class="shrink-0 px-3 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-xs text-red-600 dark:text-red-400 font-bold transition-all">
            Reintentar
          </button>
        </div>
      }

      <!-- ===== CONFIRMADO — banner ===== -->
      @if (estado() === 'confirmado') {
        <div class="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/50 p-3.5 flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p class="text-emerald-700 dark:text-emerald-300 text-xs font-bold">Asignaciones confirmadas y guardadas en la base de datos.</p>
        </div>
      }

      <!-- ===== MAIN CONTENT AREA ===== -->
      <div class="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">

        <!-- ── CARD TOOLBAR: week navigation + sala filter ── -->
        @if (estado() === 'draft' || estado() === 'confirmado' || estado() === 'historial') {
          <div class="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <!-- Week pills (scrollable) -->
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0">
              @for (sem of semanas(); track sem.semana_iso; let i = $index) {
                <button
                  (click)="selectedWeekIdx.set(i)"
                  class="flex items-center gap-1 px-3 h-7 rounded-full text-[0.7rem] font-bold whitespace-nowrap transition-all shrink-0 border active:scale-95"
                  [class]="weekTabClass(i)">
                  <span>{{ sem.fecha | date:'d MMMM' }}</span>
                </button>
              }
            </div>
            @if (estado() === 'historial') {
              <button
                (click)="semanas.set([]); estado.set('idle')"
                class="shrink-0 flex items-center gap-1 px-2.5 h-7 rounded-full text-[0.65rem] font-bold border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400 transition-all active:scale-95">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                Volver
              </button>
            }
          </div>
        }

        <!-- Loading overlay -->
        @if (estado() === 'loading') {
          <div class="absolute inset-0 z-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
            <div class="flex flex-col items-center gap-3">
              <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-[#6D28D9] animate-spin"></div>
              <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">Generando programa...</p>
            </div>
          </div>
        }

        <!-- IDLE state (empty) -->
        @if (estado() === 'idle' || (estado() !== 'loading' && estado() !== 'error' && semanas().length === 0)) {
          <div class="flex-1 flex flex-col items-center justify-center py-16 text-center px-6">
            <div class="w-16 h-16 mx-auto bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-violet-900/20 dark:via-slate-800 dark:to-purple-900/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-purple-100/50 dark:border-purple-800/30">
              <svg class="w-8 h-8 text-purple-300 dark:text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>
            </div>
            <h3 class="text-slate-800 dark:text-white font-bold mb-1">No hay programa generado</h3>
            <p class="text-slate-400 dark:text-slate-500 text-sm mb-5 max-w-xs">Genera el programa del mes para asignar automaticamente a los publicadores.</p>
            <button
              *ngIf="hasEditPermission()"
              (click)="openModal()"
              class="inline-flex items-center gap-2 px-4 h-9 bg-[#6D28D9] hover:bg-[#5b21b6] text-white rounded-lg text-xs font-bold shadow-sm shadow-purple-900/20 transition-all active:scale-95">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Generar Mes
            </button>

            <!-- Ver historial de programaciones confirmadas -->
            @if (loadingPeriodos()) {
              <div class="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 w-full max-w-xs flex justify-center">
                <div class="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-violet-500 animate-spin"></div>
              </div>
            } @else if (periodos().length > 0) {
              <div class="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 w-full max-w-sm">
                <p class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 text-center">Ver programación confirmada</p>
                <div class="flex flex-col gap-1.5">
                  @for (p of periodos(); track p.ano + '-' + p.mes) {
                    <div class="flex items-center gap-1.5">
                      <button
                        (click)="loadHistorial(p.mes, p.ano)"
                        [disabled]="loadingHistorial()"
                        class="flex-1 flex items-center justify-between px-4 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-40 group">
                        <span>{{ p.label }}</span>
                        <svg class="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                      @if (periodoEliminable(p) && hasEditPermission()) {
                        <button
                          (click)="eliminarHistorial(p, $event)"
                          title="Eliminar programación de {{ p.label }}"
                          class="shrink-0 w-9 h-9 rounded-xl border border-red-100 dark:border-red-900/30 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-all active:scale-95 flex items-center justify-center">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- DRAFT / CONFIRMADO / HISTORIAL: assignment list -->
        @if ((estado() === 'draft' || estado() === 'confirmado' || estado() === 'historial') && currentSemana(); as semana) {

          <!-- Sticky content header: week title + estado -->
          <div class="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-5 py-2 flex items-center justify-between gap-4">
            <div class="min-w-0">
              @if (semana.titulo_guia) {
                <p class="text-[0.78rem] font-bold text-slate-700 dark:text-slate-200 truncate">{{ semana.titulo_guia }}</p>
              }
              <p class="text-[0.6rem] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
                {{ semana.partes.length }} partes
              </p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="w-1.5 h-1.5 rounded-full shrink-0"
                [class]="estado() === 'confirmado' ? 'bg-emerald-400' : estado() === 'historial' ? 'bg-violet-400' : 'bg-amber-400'"></span>
              <span class="text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{{ estadoLabel() }}</span>
            </div>
          </div>

          <!-- Parts list grouped by section -->
          <div class="flex-1 overflow-y-auto simple-scrollbar bg-[#f8f9fb] dark:bg-slate-950">
            @for (seccion of seccionesActuales(); track seccion.id) {

              <!-- Section header -->
              <div class="sticky top-0 z-10"
                [style]="'background:' + seccion.headerBg">
                <div class="px-4 py-2 flex items-center gap-2.5"
                  [style]="'border-left:3px solid ' + seccion.color">
                  <!-- Icon -->
                  <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    [style.background-color]="seccion.color">
                    <svg class="w-3 h-3 text-white"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path [attr.d]="seccion.iconPath"/>
                    </svg>
                  </div>
                  <!-- Title -->
                  <div class="flex-1 min-w-0">
                    <p class="text-[0.65rem] font-black uppercase tracking-widest leading-none" [style.color]="seccion.color">
                      {{ seccion.titulo }}
                    </p>
                  </div>
                  <!-- Sala B toggle (only in seamos_mejores when there are Sala B parts) -->
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
                <!-- Bottom border line using section color -->
                <div class="h-px" [style.background]="seccion.headerBorder"></div>
              </div>

              <!-- Groups in section -->
              <div class="px-3 py-2 flex flex-col gap-1.5">
                @for (grupo of seccion.grupos; track grupo.key) {
                  <div class="parte-card"
                    [class.has-conflict]="grupoHasConflict(grupo.partes)"
                    [class.has-swapped]="grupoHasSwapped(grupo.partes)"
                    [class.is-open]="isGroupOpen(grupo)">

                    <div class="px-3.5 py-2.5 flex items-center gap-3">
                      <!-- Color dot -->
                      <div class="w-2 h-2 rounded-full shrink-0 mt-px"
                        [style.background-color]="grupoDotColor(grupo.partes, seccion.color)">
                      </div>

                      <!-- Part name + duration (once per group) -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-1.5 min-w-0">
                          <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate leading-snug flex-1 min-w-0">
                            {{ displayNombreParte(grupo.partes[0]) }}
                          </p>
                          @if (grupo.partes[0].duracion_minutos) {
                            <span class="text-[0.55rem] font-black shrink-0 px-1.5 py-[2px] rounded leading-none"
                              [style.color]="seccion.color"
                              [style.background-color]="seccion.badgeBg">
                              {{ grupo.partes[0].duracion_minutos }}&nbsp;min
                            </span>
                          }
                        </div>
                        <!-- Status badges (any part) -->
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

                      <!-- Assignee pills: one per part, side by side -->
                      <div class="flex items-center gap-2 shrink-0">
                        @for (asig of grupo.partes; track asig.id_programa_parte; let pi = $index) {
                          <div class="relative">
                            <button
                              (click)="estado() === 'historial' ? openHistorialEdit(asig) : toggleDropdown(asig.id_programa_parte)"
                              [disabled]="estado() === 'confirmado' || !hasEditPermission()"
                              [class]="assigneeButtonClass(asig)">
                              <!-- Role badge inside pill (only for paired parts) -->
                              @if (grupo.partes.length > 1) {
                                <span class="text-[0.48rem] font-black uppercase tracking-wide leading-none shrink-0 opacity-60">
                                  {{ grupoRoleLabel(grupo, pi) }}
                                </span>
                                <span class="opacity-30 text-[0.6rem] leading-none shrink-0">·</span>
                              }
                              <span>{{ asig.nombre_completo }}</span>
                              @if (estado() === 'draft' && asig.alternativos.length > 0) {
                                <svg class="chevron w-3 h-3 shrink-0"
                                  [class.open]="openDropdownId() === asig.id_programa_parte"
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                                </svg>
                              }
                              @if (estado() === 'historial' && hasEditPermission()) {
                                <svg class="w-3 h-3 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.414-6.414a2 2 0 112.828 2.828L11.828 13.828A2 2 0 0111 14.414V16h1.586a2 2 0 001.414-.586l.586-.586"/>
                                </svg>
                              }
                              <!-- × para eliminar ayudante -->
                              @if (asig.es_ayudante && estado() !== 'confirmado' && estado() !== 'historial' && hasEditPermission()) {
                                <span
                                  (click)="onEliminarAyudante(asig, selectedWeekIdx(), $event)"
                                  class="opacity-40 hover:opacity-90 leading-none shrink-0 ml-0.5 cursor-pointer active:scale-90 transition-all"
                                  title="Quitar ayudante">✕</span>
                              }
                            </button>
                            <!-- Draft dropdown -->
                            @if (estado() === 'draft' && openDropdownId() === asig.id_programa_parte && asig.alternativos.length > 0) {
                              <div class="dropdown-panel absolute right-0 top-full mt-2 z-50 w-60 overflow-hidden"
                                style="border-radius:14px">
                                <div class="dropdown-header px-3.5 py-2.5 flex items-center gap-2">
                                  <span class="w-[3px] h-3.5 rounded-full shrink-0" [style.background-color]="seccion.color"></span>
                                  <span class="dropdown-label text-[0.6rem] font-bold uppercase tracking-widest flex-1">Candidatos</span>
                                  @if (asig.es_ayudante) {
                                    <div class="flex items-center gap-0.5">
                                      @for (opt of sexoOpts; track opt.v) {
                                        <button
                                          (click)="setSexoFilter(asig.id_programa_parte, opt.v); $event.stopPropagation()"
                                          class="px-1.5 h-5 rounded text-[0.55rem] font-black transition-all active:scale-95"
                                          [style]="getSexoFilter(asig.id_programa_parte) === opt.v
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
                                      (click)="swapAsignacion(selectedWeekIdx(), asig.id_programa_parte, alt, asig.es_ayudante)"
                                      class="dropdown-alt-row w-full flex items-center justify-between gap-3 px-3 py-2 text-left rounded-[8px]">
                                      <span class="dropdown-alt-name text-[0.75rem] font-semibold truncate">{{ alt.nombre_completo }}</span>
                                      <span class="text-[0.6rem] font-black font-mono shrink-0 tabular-nums px-1.5 py-0.5 rounded-[4px]"
                                        [style.color]="seccion.color"
                                        [style.background-color]="seccion.badgeBg">
                                        {{ alt.score | number:'1.2-2' }}
                                      </span>
                                    </button>
                                  }
                                </div>
                              </div>
                            }
                            <!-- Historial edit dropdown -->
                            @if (estado() === 'historial' && editingHistorialId() === asig.id_asignacion) {
                              <div class="dropdown-panel absolute right-0 top-full mt-2 z-50 w-60 overflow-hidden"
                                style="border-radius:14px">
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
                                        class="dropdown-alt-row w-full flex items-center justify-between gap-3 px-3 py-2 text-left rounded-[8px]">
                                        <span class="dropdown-alt-name text-[0.75rem] font-semibold truncate">{{ alt.nombre_completo }}</span>
                                        <span class="text-[0.6rem] font-black font-mono shrink-0 tabular-nums px-1.5 py-0.5 rounded-[4px]"
                                          [style.color]="seccion.color"
                                          [style.background-color]="seccion.badgeBg">
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
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Configura los parametros para crear el programa</p>
            </div>
            <button
              (click)="showModal.set(false)"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Plantilla -->
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

          <!-- Preview de fechas -->
          <div class="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
            <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{{ fechasPreview().length }} semanas a crear</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-mono leading-relaxed">{{ fechasPreview().join('  ·  ') }}</p>
          </div>

          <!-- Botones -->
          <div class="flex gap-2">
            <button
              (click)="showModal.set(false)"
              class="flex-1 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
              Cancelar
            </button>
            <button
              (click)="onModalSubmit()"
              [disabled]="loadingPlantillas() || plantillas().length === 0 || modalForm().id_plantilla === 0"
              class="flex-1 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-40 disabled:cursor-not-allowed text-xs text-white font-bold transition-all shadow-sm shadow-purple-900/20 active:scale-95">
              Generar Programa
            </button>
          </div>

        </div>
      </div>
    }

    <!-- Close dropdown on outside click -->
    @if (openDropdownId() !== null) {
      <div class="fixed inset-0 z-30" (click)="openDropdownId.set(null)"></div>
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
    .parte-card.is-open {
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
  periodos = signal<{ ano: number; mes: number; label: string }[]>([]);
  loadingPeriodos = signal(false);
  loadingHistorial = signal(false);
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
  openDropdownId = signal<number | null>(null);
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
    // Clave compuesta: id + tipo (maestro vs ayudante) para que no colisionen cuando comparten id_programa_parte
    const pKey = (p: AsignacionDraft) => `${p.id_programa_parte}|${p.es_ayudante ? '1' : '0'}`;
    const usedKeys = new Set<string>();

    const maestros = partes.filter(p => !p.es_ayudante);
    const ayudantes = partes.filter(p => p.es_ayudante);

    for (const p of maestros) {
      const pk = pKey(p);
      if (usedKeys.has(pk)) continue;
      usedKeys.add(pk);

      const nombre = (p.nombre_parte || '').toLowerCase();
      const esConductor = nombre.includes('conductor') || nombre.includes('estudio bíblico');
      const esMaestro = nombre.includes('empiece') || nombre.includes('revisita') || nombre.includes('discípulo') || nombre.includes('haga disc');
      const uid = pk;

      if (esConductor) {
        // EBC: pair Conductor with Lector
        const lector = ayudantes.find(q => {
          if (usedKeys.has(pKey(q))) return false;
          const qn = (q.nombre_parte || '').toLowerCase();
          return qn.includes('lector') && qn.includes('estudio');
        });
        if (lector) {
          usedKeys.add(pKey(lector));
          grupos.push({ key: uid, partes: [p, lector], role0: 'Conductor', role1: 'Lector' });
        } else {
          grupos.push({ key: uid, partes: [p], role0: '', role1: '' });
        }
      } else if (esMaestro || p.aplica_sala_b) {
        // Normaliza nombre quitando sufijos de sala/ayudante para comparar la base
        const stripSuffix = (n: string) =>
          n.replace(/\s*\((sala b[^)]*|ayudante[^)]*)\)/gi, '').trim();
        const nombreBase = stripSuffix(nombre);
        // Recoger hasta 2 ayudantes cuya base de nombre coincida con la del maestro
        const misAyudantes = nombreBase.length > 2
          ? ayudantes.filter(q => {
              if (usedKeys.has(pKey(q))) return false;
              return stripSuffix((q.nombre_parte || '').toLowerCase()).startsWith(nombreBase);
            }).slice(0, 2)
          : [];
        misAyudantes.forEach(a => usedKeys.add(pKey(a)));
        grupos.push({ key: uid, partes: [p, ...misAyudantes], role0: 'Maestro', role1: 'Ayudante' });
      } else {
        grupos.push({ key: uid, partes: [p], role0: '', role1: '' });
      }
    }

    // Ayudantes huérfanos (sin maestro emparejado)
    for (const a of ayudantes) {
      if (!usedKeys.has(pKey(a))) {
        grupos.push({ key: pKey(a), partes: [a], role0: '', role1: '' });
      }
    }

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

    this.showModal.set(false);
    this.estado.set('loading');
    this.errorMsg.set(null);

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

    this.reunionesSvc
      .crearProgramaMensual(createPayload)
      .pipe(
        switchMap(() => this.reunionesSvc.generarAsignaciones(genPayload))
      )
      .subscribe({
        next: (resp) => {
          const seen = new Set<number>();
          const unicas = resp.semanas.filter(s => seen.has(s.semana_iso) ? false : (seen.add(s.semana_iso), true));
          this.semanas.set(unicas);
          this.selectedWeekIdx.set(0);
          this.selectedSala.set('Principal');
          this.estado.set('draft');
        },
        error: (err) => {
          const msg =
            err?.error?.detail ?? err?.message ?? 'Error al generar el programa.';
          this.errorMsg.set(msg);
          this.estado.set('error');
        },
      });
  }

  // ── Manual swap ────────────────────────────────────────────────
  swapAsignacion(
    semanaIdx: number,
    parteId: number,
    candidato: CandidatoAlternativo,
    esAyudante?: boolean
  ): void {
    this.semanas.update((semanas) =>
      semanas.map((sem, si) => {
        if (si !== semanaIdx) return sem;
        return {
          ...sem,
          partes: sem.partes.map((asig) => {
            if (asig.id_programa_parte !== parteId) return asig;
            if (esAyudante !== undefined && asig.es_ayudante !== esAyudante) return asig;
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
  }

  toggleDropdown(parteId: number): void {
    this.openDropdownId.update((id) => (id === parteId ? null : parteId));
  }

  isGroupOpen(grupo: any): boolean {
    const openId = this.openDropdownId();
    if (openId === null) return false;
    return grupo.partes.some((p: any) => p.id_programa_parte === openId);
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
      next: () => this.estado.set('confirmado'),
      error: (err) => {
        const msg = err?.error?.detail ?? 'Error al confirmar las asignaciones.';
        this.errorMsg.set(msg);
        this.estado.set('error');
      },
    });
  }

  borrarBorrador(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    const semanas = this.semanas();
    if (!idCong || semanas.length === 0 || this.estado() !== 'draft') return;
    if (!window.confirm('¿Deseas borrar este borrador? Esta accion no se puede deshacer.')) return;

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

  private _sexoFilters = new Map<number, string | null>();

  setSexoFilter(idParte: number, sexo: string | null): void {
    this._sexoFilters.set(idParte, sexo);
  }

  getSexoFilter(idParte: number): string | null {
    return this._sexoFilters.get(idParte) ?? null;
  }

  filteredAlternativos(asig: AsignacionDraft): CandidatoAlternativo[] {
    if (!asig.es_ayudante) return asig.alternativos;
    const filtro = this._sexoFilters.get(asig.id_programa_parte) ?? null;
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
        this._sexoFilters.delete(asig.id_programa_parte);
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

  eliminarHistorial(p: { ano: number; mes: number; label: string }, event: Event): void {
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    if (!window.confirm(`¿Eliminar todas las asignaciones confirmadas de ${p.label}? Esta acción no se puede deshacer.`)) return;
    this.reunionesSvc.eliminarHistorialMes(this.tipoReunionActivo(), p.ano, p.mes, idCong).subscribe({
      next: () => {
        this.periodos.update(list => list.filter(x => !(x.ano === p.ano && x.mes === p.mes)));
        if (this.estado() === 'historial') { this.semanas.set([]); this.estado.set('idle'); }
      },
    });
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
    while (current < limite) {
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

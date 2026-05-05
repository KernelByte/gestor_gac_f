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
import {
  ProgramaSemana,
  AsignacionDraft,
  CandidatoAlternativo,
  PlantillaOption,
  GenerarMesForm,
  GenerarAsignacionesRequest,
  ProgramaMensualCreateRequest,
  ConfirmarDraftRequest,
} from '../models/reuniones.models';

@Component({
  selector: 'app-reuniones-entre-semana',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-3 h-full">

      <!-- ===== PAGE HEADER ===== -->
      <div class="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Vida y Ministerio Cristianos
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
            class="flex items-center gap-1.5 px-3 h-9 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-95"
            style="background:rgba(5,150,105,0.08); border-color:rgba(5,150,105,0.25); color:#047857;"
            onmouseenter="if(!this.disabled)this.style.background='rgba(5,150,105,0.14)'"
            onmouseleave="this.style.background='rgba(5,150,105,0.08)'">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Confirmar
          </button>
          <button
            *ngIf="hasEditPermission()"
            (click)="borrarBorrador()"
            [disabled]="!canBorrarBorrador()"
            class="flex items-center gap-1.5 px-3 h-9 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all active:scale-95"
            style="background:rgba(220,38,38,0.07); border-color:rgba(220,38,38,0.22); color:#b91c1c;"
            onmouseenter="if(!this.disabled)this.style.background='rgba(220,38,38,0.13)'"
            onmouseleave="this.style.background='rgba(220,38,38,0.07)'">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Borrar borrador
          </button>
        </div>
      </div>

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
        @if (estado() === 'draft' || estado() === 'confirmado') {
          <div class="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <!-- Week pills (scrollable) -->
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
              @for (sem of semanas(); track sem.semana_iso; let i = $index) {
                <button
                  (click)="selectedWeekIdx.set(i)"
                  class="flex items-center gap-1 px-2.5 h-7 rounded-md text-[0.7rem] font-bold whitespace-nowrap transition-all shrink-0"
                  [class]="weekTabClass(i)">
                  <span class="font-mono opacity-70">S{{ sem.semana_iso }}</span>
                  <span>{{ sem.fecha | date:'d MMM' }}</span>
                </button>
              }
            </div>
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
          </div>
        }

        <!-- DRAFT / CONFIRMADO: assignment list -->
        @if ((estado() === 'draft' || estado() === 'confirmado') && currentSemana(); as semana) {

          <!-- Sticky content header: week title + estado -->
          <div class="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-5 py-2 flex items-center justify-between gap-4">
            <div class="min-w-0">
              @if (semana.titulo_guia) {
                <p class="text-[0.78rem] font-bold text-slate-700 dark:text-slate-200 truncate">{{ semana.titulo_guia }}</p>
              }
              <p class="text-[0.6rem] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
                {{ semana.partes.length }} partes · semana {{ semana.semana_iso }}
              </p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" [class]="estado() === 'confirmado' ? 'bg-emerald-400' : 'bg-amber-400'"></span>
              <span class="text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{{ estadoLabel() }}</span>
            </div>
          </div>

          <!-- Parts list grouped by section -->
          <div class="flex-1 overflow-y-auto simple-scrollbar" style="background:#f8f9fb">
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
                        <span style="font-size:0.55rem; font-weight:900; font-family:monospace; padding:1px 5px; border-radius:4px;"
                          [style.background]="selectedSala() === 'Auxiliar' ? 'rgba(255,255,255,0.25)' : seccionColor(seccion.color, 0.15)">
                          {{ salaCounts().auxiliar }}
                        </span>
                      </button>
                    </div>
                  }
                  <!-- Count -->
                  <span class="text-[0.58rem] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                    [style.color]="seccion.color"
                    [style.background-color]="seccion.badgeBg">
                    {{ seccion.partes.length }}
                  </span>
                </div>
                <!-- Bottom border line using section color -->
                <div class="h-px" [style.background]="seccion.headerBorder"></div>
              </div>

              <!-- Groups in section -->
              <div class="px-3 py-2 flex flex-col gap-1.5">
                @for (grupo of seccion.grupos; track grupo.key) {
                  <div class="parte-card"
                    [class.has-conflict]="grupo.partes[0].estado === 'conflict'"
                    [class.has-swapped]="grupo.partes[0]._swapped"
                    [class.is-open]="isGroupOpen(grupo)">

                    @for (asig of grupo.partes; track asig.id_programa_parte + (asig.sala || '') + (asig.es_ayudante ? 'h' : ''); let pi = $index) {

                      <!-- Pair divider -->
                      @if (pi > 0) {
                        <div class="mx-4 h-px" style="background:rgba(0,0,0,0.06)"></div>
                      }

                      <div class="px-3.5 py-2.5 flex items-center justify-between gap-3">
                        <!-- Color dot accent + Part info -->
                        <div class="flex-1 min-w-0 flex items-start gap-3">
                          <!-- Colored dot -->
                          <div class="w-2 h-2 rounded-full mt-[5px] shrink-0"
                            [style.background-color]="asig.estado === 'conflict' ? '#ef4444' : asig._swapped ? '#f59e0b' : seccion.color">
                          </div>
                          <div class="min-w-0 flex-1">
                            <!-- Role chip (above name) -->
                            @if (grupo.partes.length > 1) {
                              <div class="flex items-center gap-1.5 flex-wrap mb-1">
                                <span class="text-[0.55rem] font-black uppercase tracking-[0.08em] px-1.5 py-[2px] rounded shrink-0 leading-none"
                                  [style.color]="seccion.color"
                                  [style.background-color]="seccion.badgeBg">
                                  {{ pi === 0 ? grupo.role0 : grupo.role1 }}
                                </span>
                              </div>
                            }
                            <!-- Part name · duration chip -->
                            <div class="flex items-baseline gap-1.5 min-w-0">
                              <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate leading-snug flex-1 min-w-0">{{ asig.nombre_parte }}</p>
                              @if (asig.duracion_minutos) {
                                <span class="text-[0.55rem] font-black shrink-0 px-1.5 py-[2px] rounded leading-none"
                                  [style.color]="seccion.color"
                                  [style.background-color]="seccion.badgeBg">{{ asig.duracion_minutos }}&nbsp;min</span>
                              }
                            </div>
                            <!-- Status badges -->
                            <div class="flex items-center gap-1.5 mt-0.5">
                              @if (asig.estado === 'conflict') {
                                <span class="inline-flex items-center gap-1 text-[0.6rem] font-semibold leading-none" style="color:#dc2626">
                                  Sin candidato
                                </span>
                              } @else if (asig.es_reemplazo) {
                                <span class="text-[0.6rem] leading-none" style="color:#94a3b8">Reemplazo</span>
                              }
                              @if (asig._swapped) {
                                <span class="text-[0.6rem] font-semibold leading-none" style="color:#b45309">Modificado</span>
                              }
                            </div>
                          </div>
                        </div>

                        <!-- Assignee pill + dropdown -->
                        <div class="relative shrink-0">
                          <button
                            (click)="toggleDropdown(asig.id_programa_parte + (asig.es_ayudante ? 10000 : 0))"
                            [disabled]="estado() === 'confirmado' || !hasEditPermission()"
                            [class]="assigneeButtonClass(asig)">
                            <span class="truncate max-w-[140px]">{{ asig.nombre_completo }}</span>
                            @if (estado() !== 'confirmado' && asig.alternativos.length > 0) {
                              <svg class="chevron w-3 h-3 shrink-0"
                                [class.open]="openDropdownId() === asig.id_programa_parte + (asig.es_ayudante ? 10000 : 0)"
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                              </svg>
                            }
                          </button>

                          @if (openDropdownId() === asig.id_programa_parte + (asig.es_ayudante ? 10000 : 0) && asig.alternativos.length > 0) {
                            <div class="dropdown-panel absolute right-0 top-full mt-2 z-50 w-60 overflow-hidden"
                              style="border-radius:14px; background:white; border:1px solid rgba(0,0,0,0.08); box-shadow:0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)">
                              <div class="px-3.5 py-2.5 flex items-center gap-2"
                                style="border-bottom:1px solid rgba(0,0,0,0.06); background:rgba(0,0,0,0.02)">
                                <span class="w-[3px] h-3.5 rounded-full shrink-0" [style.background-color]="seccion.color"></span>
                                <span class="text-[0.6rem] font-bold uppercase tracking-widest" style="color:#94a3b8">Candidatos</span>
                              </div>
                              <div class="p-1.5 flex flex-col gap-0.5">
                                @for (alt of asig.alternativos; track alt.id_publicador) {
                                  <button
                                    (click)="swapAsignacion(selectedWeekIdx(), asig.id_programa_parte, alt, asig.es_ayudante)"
                                    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-left rounded-[8px]"
                                    style="transition: background-color 100ms ease;"
                                    onmouseenter="this.style.background='rgba(0,0,0,0.04)'"
                                    onmouseleave="this.style.background='transparent'">
                                    <span class="text-[0.75rem] font-semibold truncate" style="color:#334155">{{ alt.nombre_completo }}</span>
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
                        </div>
                      </div>
                    }
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
    .dark .parte-card {
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
    .dark .assignee-btn.normal {
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
    .dark .assignee-btn.conflict {
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
    .dark .assignee-btn.swapped {
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
    }

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
  `]
})
export class ReunionesEntreSemanaComponent implements OnInit {

  private reunionesSvc = inject(ReunionesService);
  private asistenciaSvc = inject(AsistenciaService);
  congregacionCtx = inject(CongregacionContextService);
  private authStore = inject(AuthStore);

  hasEditPermission = computed(() => {
    return this.authStore.hasPermission('reuniones.entre_semana_editar') || !!this.authStore.user()?.roles?.includes('Secretario');
  });

  // ── State machine ──────────────────────────────────────────────
  estado = signal<'idle' | 'loading' | 'draft' | 'confirmado' | 'error'>('idle');
  errorMsg = signal<string | null>(null);

  // ── Data signals ───────────────────────────────────────────────
  semanas = signal<ProgramaSemana[]>([]);
  selectedWeekIdx = signal(0);
  plantillas = signal<PlantillaOption[]>([]);
  loadingPlantillas = signal(false);

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

  // ── Section config ─────────────────────────────────────────────
  private readonly SECCIONES_CONFIG: Record<string, { titulo: string; color: string; orden: number; iconPath: string; iconViewBox?: string }> = {
    tesoros: {
      titulo: 'Tesoros de la Biblia',
      color: '#3c7f8b',
      orden: 0,
      // book-open icon
      iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    },
    seamos_mejores: {
      titulo: 'Seamos Mejores Maestros',
      color: '#d68f00',
      orden: 1,
      // microphone icon
      iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    },
    nuestra_vida: {
      titulo: 'Nuestra Vida Cristiana',
      color: '#bf2f13',
      orden: 2,
      // users icon
      iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    },
  };


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
    const sala = this.selectedSala();
    const filtered = semana.partes.filter(p => {
      if (p.sala === 'Auxiliar') return sala === 'Auxiliar';
      if (p.aplica_sala_b) return sala === 'Principal';
      return true;
    });
    return this._buildSecciones(filtered);
  });

  private _inferSeccion(p: AsignacionDraft): string {
    // 1. Key exacto (seed-based programs)
    if (p.seccion && this.SECCIONES_CONFIG[p.seccion]) return p.seccion;

    // 2. Mapeo flexible del string de sección que guarda el parser MWB
    const s = (p.seccion || '').toLowerCase();
    if (s.includes('tesoro')) return 'tesoros';
    if (s.includes('mejor') || s.includes('maestro')) return 'seamos_mejores';
    if (s.includes('vida') || s.includes('cristian')) return 'nuestra_vida';
    // apertura/clausura van a tesoros (presidente, oraciones de apertura)
    if (s.includes('apertura')) return 'tesoros';
    if (s.includes('clausura')) return 'nuestra_vida';

    // 3. Inferencia por nombre de parte (fallback para drafts sin seccion)
    const n = (p.nombre_parte || '').toLowerCase();
    if (n.includes('tesoros') || n.includes('lectura de la biblia') || n.includes('busquemos') || n.includes('perlas') || n.includes('presidente') || n.includes('oración inicial') || n.includes('oracion inicial')) return 'tesoros';
    if (n.includes('empiece') || n.includes('revisita') || n.includes('discípulo') || n.includes('haga discí') || n.includes('seamos') || n.includes('maestro')) return 'seamos_mejores';
    if (n.includes('estudio bíblico') || n.includes('estudio biblico') || n.includes('necesidades') || n.includes('oración final') || n.includes('oracion final') || n.includes('conductor') || n.includes('hospitalario') || n.includes('anuncio')) return 'nuestra_vida';

    // 4. Sin suficiente información — usa el orden visual si existiera, o tesoros como último recurso
    return 'tesoros';
  }

  private _buildSecciones(partes: AsignacionDraft[]) {
    const map = new Map<string, AsignacionDraft[]>();
    for (const p of partes) {
      const key = this._inferSeccion(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }

    const result: any[] = [];
    for (const [seccionKey, seccionPartes] of map) {
      const cfg = this.SECCIONES_CONFIG[seccionKey] ?? this.SECCIONES_CONFIG['tesoros'];
      const grupos = this._buildGrupos(seccionPartes);
      result.push({
        id: seccionKey,
        titulo: cfg.titulo,
        color: cfg.color,
        orden: cfg.orden,
        iconPath: cfg.iconPath,
        // fondo sólido opaco para el sticky header (mezcla con blanco)
        headerBg: this.seccionColorSolid(cfg.color, 0.12),
        headerBorder: this.seccionColor(cfg.color, 0.25),
        // badge y chips
        badgeBg: this.seccionColor(cfg.color, 0.14),
        partes: seccionPartes,
        grupos,
      });
    }
    return result.sort((a: any, b: any) => a.orden - b.orden);
  }

  private _buildGrupos(partes: AsignacionDraft[]) {
    const grupos: { key: string; partes: AsignacionDraft[]; role0: string; role1: string }[] = [];
    const used = new Set<string>();

    for (const p of partes) {
      const uid = p.id_programa_parte + '_' + (p.es_ayudante ? 'h' : 'p') + '_' + (p.sala || '');
      if (used.has(uid)) continue;
      used.add(uid);

      const nombre = (p.nombre_parte || '').toLowerCase();
      const esConductor = nombre.includes('conductor') || nombre.includes('estudio bíblico');
      const esMaestro = !p.es_ayudante && (nombre.includes('empiece') || nombre.includes('revisita') || nombre.includes('discípulo'));

      // Try to find paired part: ayudante shares same id_programa_parte
      const pareja = partes.find((q) => {
        const quid = q.id_programa_parte + '_' + (q.es_ayudante ? 'h' : 'p') + '_' + (q.sala || '');
        if (used.has(quid)) return false;
        // Pair: same id_programa_parte, one is ayudante
        if (q.id_programa_parte === p.id_programa_parte && q.es_ayudante !== p.es_ayudante) return true;
        // Pair: EBC Conductor + Lector (same seccion, consecutive orden)
        if (esConductor) {
          const qNombre = (q.nombre_parte || '').toLowerCase();
          if (qNombre.includes('lector') && qNombre.includes('estudio')) return true;
        }
        return false;
      });

      if (pareja) {
        const parejaNombre = (pareja.nombre_parte || '').toLowerCase();
        const pairUid = pareja.id_programa_parte + '_' + (pareja.es_ayudante ? 'h' : 'p') + '_' + (pareja.sala || '');
        used.add(pairUid);
        // Determine roles
        let role0 = 'Conductor';
        let role1 = pareja.es_ayudante ? 'Ayudante' : (parejaNombre.includes('lector') ? 'Lector' : 'Pareja');
        if (esMaestro) { role0 = 'Maestro'; role1 = 'Ayudante'; }
        grupos.push({ key: uid, partes: [p, pareja], role0, role1 });
      } else {
        grupos.push({ key: uid, partes: [p], role0: '', role1: '' });
      }
    }
    return grupos;
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  ngOnInit(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) {
      this.errorMsg.set('No hay congregacion seleccionada. Selecciona una en el panel de administracion.');
      this.estado.set('error');
      return;
    }
    this.tryLoadDrafts(idCong);
  }

  // ── Load existing drafts ───────────────────────────────────────
  private tryLoadDrafts(idCong: number): void {
    const now = new Date();
    const fechas = this.calcFechas(now.getFullYear(), now.getMonth() + 1, 2);
    if (fechas.length === 0) { this.estado.set('idle'); return; }

    this.estado.set('loading');
    const ano = now.getFullYear();
    const requests = fechas.map((f) =>
      this.reunionesSvc
        .getDraft('entre_semana', ano, this.getIsoWeek(f), idCong)
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
      plantillas: this.reunionesSvc.getPlantillas('entre_semana', idCong),
      config: this.asistenciaSvc.getCongregacionConfig().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ plantillas, config }) => {
        const diaReunion = this.diaReunionToNumber(config?.dia_reunion_entre_semana ?? null);
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
    };
    return dia ? map[dia] ?? 2 : 2;
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
      tipo_reunion: 'entre_semana',
      mes: form.mes,
      ano: form.ano,
      semanas: fechas,
      id_plantilla: form.id_plantilla,
    };

    const genPayload: GenerarAsignacionesRequest = {
      tipo_reunion: 'entre_semana',
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
    return grupo.partes.some((p: any) => (p.id_programa_parte + (p.es_ayudante ? 10000 : 0)) === openId);
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
      tipo_reunion: 'entre_semana',
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
      this.reunionesSvc.deleteDraft('entre_semana', ano, sem.semana_iso, idCong)
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
      error: 'Error',
    };
    return map[this.estado()] ?? '';
  });

  weekTabClass(i: number): string {
    return i === this.selectedWeekIdx()
      ? 'bg-[#6D28D9] text-white shadow-sm'
      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200';
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
}

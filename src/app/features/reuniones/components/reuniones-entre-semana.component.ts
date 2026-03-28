import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
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
  providers: [DatePipe],
  template: `
    <div class="flex flex-col gap-5 h-full">

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
            (click)="irConfiguracion()"
            class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Configuracion
          </button>
          <button
            (click)="openModal()"
            [disabled]="estado() === 'loading'"
            class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm shadow-purple-900/20 active:scale-95">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Generar Mes
          </button>
          <button
            (click)="confirmar()"
            [disabled]="!canConfirmar()"
            class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#059669] hover:bg-[#047857] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm shadow-emerald-900/20 active:scale-95">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Confirmar
          </button>
        </div>
      </div>

      <!-- ===== TOOLBAR: week tabs (same pattern as publicadores compact bar) ===== -->
      @if (estado() === 'draft' || estado() === 'confirmado') {
        <div class="shrink-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
          @for (sem of semanas(); track sem.semana_iso; let i = $index) {
            <button
              (click)="selectedWeekIdx.set(i)"
              class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0"
              [class]="weekTabClass(i)">
              <span class="opacity-60 font-mono">S{{ sem.semana_iso }}</span>
              <span>{{ sem.fecha | date:'d MMM' }}</span>
            </button>
          }
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
      <div class="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-all">

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
              (click)="openModal()"
              class="inline-flex items-center gap-2 px-4 h-9 bg-[#6D28D9] hover:bg-[#5b21b6] text-white rounded-lg text-xs font-bold shadow-sm shadow-purple-900/20 transition-all active:scale-95">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Generar Mes
            </button>
          </div>
        }

        <!-- DRAFT / CONFIRMADO: assignment list -->
        @if ((estado() === 'draft' || estado() === 'confirmado') && currentSemana(); as semana) {

          <!-- Sticky header -->
          <div class="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm">
            <div>
              @if (semana.titulo_guia) {
                <p class="text-xs font-bold text-slate-800 dark:text-slate-100">{{ semana.titulo_guia }}</p>
              }
              <p class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{{ semana.partes.length }} partes · semana {{ semana.semana_iso }}</p>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full" [class]="estado() === 'confirmado' ? 'bg-emerald-400' : 'bg-amber-400'"></span>
              <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{{ estadoLabel() }}</span>
            </div>
          </div>

          <!-- Parts list -->
          <div class="flex-1 overflow-y-auto simple-scrollbar divide-y divide-slate-200 dark:divide-slate-800">
            @for (asig of semana.partes; track asig.id_programa_parte) {
              <div
                [class]="parteCardClass(asig)"
                class="group px-6 py-3.5 transition-colors">

                <div class="flex items-center justify-between gap-4">
                  <!-- Part info -->
                  <div class="flex-1 min-w-0 flex items-center gap-3">
                    <!-- Conflict indicator dot -->
                    <span class="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
                      [class]="asig.estado === 'conflict' ? 'bg-red-400' : asig._swapped ? 'bg-amber-400' : 'bg-purple-300 dark:bg-purple-600'">
                    </span>
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">{{ asig.nombre_parte }}</p>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        @if (asig.estado === 'conflict') {
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50">
                            Sin candidato
                          </span>
                        } @else if (asig.es_reemplazo) {
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            Reemplazo
                          </span>
                        }
                        @if (asig._swapped) {
                          <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50">
                            Modificado
                          </span>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Assignee button + dropdown -->
                  <div class="relative shrink-0">
                    <button
                      (click)="toggleDropdown(asig.id_programa_parte)"
                      [disabled]="estado() === 'confirmado'"
                      [class]="assigneeButtonClass(asig)"
                      class="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all active:scale-95 border">
                      <span>{{ asig.nombre_completo }}</span>
                      @if (estado() !== 'confirmado' && asig.alternativos.length > 0) {
                        <svg class="w-3 h-3 opacity-50 transition-transform duration-150"
                          [class.rotate-180]="openDropdownId() === asig.id_programa_parte"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                        </svg>
                      }
                    </button>

                    <!-- Dropdown alternatives -->
                    @if (openDropdownId() === asig.id_programa_parte && asig.alternativos.length > 0) {
                      <div class="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-700 overflow-hidden animate-fadeIn">
                        <div class="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2">
                          <span class="w-1 h-3 rounded-full bg-[#6D28D9]"></span>
                          <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Candidatos alternativos</span>
                        </div>
                        <div class="p-1.5">
                          @for (alt of asig.alternativos; track alt.id_publicador) {
                            <button
                              (click)="swapAsignacion(selectedWeekIdx(), asig.id_programa_parte, alt)"
                              class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors">
                              <span class="text-xs font-bold text-slate-700 dark:text-slate-200">{{ alt.nombre_completo }}</span>
                              <span class="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-bold shrink-0 tabular-nums">{{ alt.score | number:'1.2-2' }}</span>
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>

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

          <!-- Grid 2 cols: Mes + Año -->
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div class="flex items-center gap-1.5 mb-1.5">
                <span class="w-1 h-3 rounded-full bg-[#6D28D9]"></span>
                <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mes</label>
              </div>
              <select
                [value]="modalForm().mes"
                (change)="updateModal('mes', +$any($event.target).value)"
                class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] outline-none transition-all">
                @for (m of meses; track m.value) {
                  <option [value]="m.value" [selected]="modalForm().mes === m.value">{{ m.label }}</option>
                }
              </select>
            </div>
            <div>
              <div class="flex items-center gap-1.5 mb-1.5">
                <span class="w-1 h-3 rounded-full bg-[#6D28D9]"></span>
                <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Año</label>
              </div>
              <select
                [value]="modalForm().ano"
                (change)="updateModal('ano', +$any($event.target).value)"
                class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] outline-none transition-all">
                @for (a of anos; track a) {
                  <option [value]="a" [selected]="modalForm().ano === a">{{ a }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Dia de reunion -->
          <div class="mb-3">
            <div class="flex items-center gap-1.5 mb-1.5">
              <span class="w-1 h-3 rounded-full bg-blue-400"></span>
              <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dia de reunion</label>
            </div>
            <select
              [value]="modalForm().dia_reunion"
              (change)="updateModal('dia_reunion', +$any($event.target).value)"
              class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-slate-800 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] outline-none transition-all">
              @for (d of diasSemana; track d.value) {
                <option [value]="d.value" [selected]="modalForm().dia_reunion === d.value">{{ d.label }}</option>
              }
            </select>
          </div>

          <!-- Plantilla -->
          <div class="mb-4">
            <div class="flex items-center gap-1.5 mb-1.5">
              <span class="w-1 h-3 rounded-full bg-emerald-400"></span>
              <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plantilla</label>
            </div>
            @if (plantillas().length === 0) {
              <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-400">
                <div class="w-3.5 h-3.5 border-2 border-slate-300 dark:border-slate-600 border-t-[#6D28D9] rounded-full animate-spin"></div>
                Cargando plantillas...
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
            <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{{ fechasPreview().length }} semanas a crear</p>
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
              [disabled]="plantillas().length === 0 || modalForm().id_plantilla === 0"
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
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fadeIn { animation: fadeIn 0.15s ease-out; }
  `]
})
export class ReunionesEntreSemanaComponent implements OnInit {

  private reunionesSvc = inject(ReunionesService);
  congregacionCtx = inject(CongregacionContextService);
  private router = inject(Router);
  private datePipe = inject(DatePipe);

  // ── State machine ──────────────────────────────────────────────
  estado = signal<'idle' | 'loading' | 'draft' | 'confirmado' | 'error'>('idle');
  errorMsg = signal<string | null>(null);

  // ── Data signals ───────────────────────────────────────────────
  semanas = signal<ProgramaSemana[]>([]);
  selectedWeekIdx = signal(0);
  plantillas = signal<PlantillaOption[]>([]);

  // ── Modal ──────────────────────────────────────────────────────
  showModal = signal(false);
  modalForm = signal<GenerarMesForm>({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    id_plantilla: 0,
    dia_reunion: 2,
  });

  // ── UI ─────────────────────────────────────────────────────────
  openDropdownId = signal<number | null>(null);

  // ── Computed ───────────────────────────────────────────────────
  currentSemana = computed(() => this.semanas()[this.selectedWeekIdx()] ?? null);
  canConfirmar = computed(() => this.estado() === 'draft' && this.semanas().length > 0);
  fechasPreview = computed(() => {
    const { mes, ano, dia_reunion } = this.modalForm();
    return this.calcFechas(ano, mes, dia_reunion);
  });

  // ── Static data ────────────────────────────────────────────────
  meses = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
  ];
  anos = [
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1,
  ];
  diasSemana = [
    { value: 1, label: 'Lunes' }, { value: 2, label: 'Martes' },
    { value: 3, label: 'Miercoles' }, { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
  ];

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
    this.reunionesSvc.getPlantillas('entre_semana', idCong).subscribe({
      next: (p) => {
        this.plantillas.set(p);
        if (p.length > 0 && this.modalForm().id_plantilla === 0) {
          this.modalForm.update((f) => ({ ...f, id_plantilla: p[0].id_plantilla }));
        }
      },
      error: () => this.plantillas.set([]),
    });
  }

  updateModal(field: keyof GenerarMesForm, value: number): void {
    this.modalForm.update((f) => ({ ...f, [field]: value }));
  }

  onModalSubmit(): void {
    const form = this.modalForm();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || form.id_plantilla === 0) return;

    const fechas = this.calcFechas(form.ano, form.mes, form.dia_reunion);
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
      .pipe(switchMap(() => this.reunionesSvc.generarAsignaciones(genPayload)))
      .subscribe({
        next: (resp) => {
          this.semanas.set(resp.semanas);
          this.selectedWeekIdx.set(0);
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
    candidato: CandidatoAlternativo
  ): void {
    this.semanas.update((semanas) =>
      semanas.map((sem, si) => {
        if (si !== semanaIdx) return sem;
        return {
          ...sem,
          partes: sem.partes.map((asig) => {
            if (asig.id_programa_parte !== parteId) return asig;
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

  // ── Navigation ─────────────────────────────────────────────────
  irConfiguracion(): void {
    this.router.navigate(['/reuniones/configuracion']);
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
      : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200';
  }

  parteCardClass(asig: AsignacionDraft): string {
    if (asig.estado === 'conflict')
      return 'bg-red-50/40 dark:bg-red-900/10';
    if (asig._swapped)
      return 'bg-amber-50/40 dark:bg-amber-900/10';
    return 'hover:bg-slate-50 dark:hover:bg-slate-800/40';
  }

  assigneeButtonClass(asig: AsignacionDraft): string {
    if (asig.estado === 'conflict')
      return 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
    if (asig._swapped)
      return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700';
    return 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30';
  }

  // ── Date utilities ─────────────────────────────────────────────
  private calcFechas(ano: number, mes: number, diaSemana: number): string[] {
    const fechas: string[] = [];
    const primerDia = new Date(ano, mes - 1, 1);
    const jsDay = primerDia.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    let offset = diaSemana - isoDay;
    if (offset < 0) offset += 7;
    let current = new Date(ano, mes - 1, 1 + offset);
    while (current.getMonth() === mes - 1) {
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      fechas.push(`${ano}-${mm}-${dd}`);
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
    }
    return fechas;
  }

  private getIsoWeek(dateStr: string): number {
    const d = new Date(dateStr);
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}

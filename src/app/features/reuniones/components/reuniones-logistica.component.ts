import {
  Component, signal, inject, OnInit, HostListener, DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LogisticaService } from '../services/logistica.service';
import { ConflictosService } from '../services/conflictos.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  FechaReunionOut,
  GrupoBase,
  LogisticaAseoOut,
  LogisticaItemOut,
  LogisticaMesOut,
  MesDisponible,
  MESES_ES,
  PUESTOS_LABEL,
  PublicadorBase,
} from '../models/logistica.models';

type Estado = 'idle' | 'loading' | 'ready' | 'error';

// Agrupaciones de secciones visuales
const SECCION_PUESTOS: Record<string, string[]> = {
  'Acomodadores y Vigilancia': ['acomodador_1', 'acomodador_2', 'vigilancia_1', 'vigilancia_2'],
  'Micrófono y Plataforma':    ['microfono_1', 'microfono_2', 'plataforma'],
  'Audio / Video':             ['audio', 'video'],
};

// Color principal por sección (mismo que se usa en el PDF)
const SECCION_COLOR: Record<string, string> = {
  'Acomodadores y Vigilancia': '#0369a1',
  'Micrófono y Plataforma':    '#0369a1',
  'Audio / Video':             '#0891b2',
  'Aseo':                      '#059669',
};

// Puestos que por defecto son solo varones (refleja el backend)
const PUESTOS_SOLO_VARONES = new Set([
  'acomodador_1', 'acomodador_2',
  'vigilancia_1', 'vigilancia_2',
  'microfono_1', 'microfono_2',
  'plataforma',
]);

function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

@Component({
  selector: 'app-reuniones-logistica',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col h-full gap-0">

      <!-- ===== PAGE HEADER ===== -->
      <div class="shrink-0 flex items-center justify-between gap-3 pb-3">
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
            Logística de Reuniones
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Acomodadores · Vigilancia · Micrófono · Plataforma · Audio/Video · Aseo</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <!-- PDF móvil -->
          @if (mesDatos()?.confirmado) {
            <button
              (click)="descargarPdf()"
              [disabled]="descargandoPdf()"
              title="Descargar PDF"
              class="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-[transform,background-color] duration-150 ease-out shadow-sm active:scale-[0.97] md:hidden">
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
          }
          <!-- Menú móvil (meses + generar) -->
          <button
            (click)="mobileMesesAbierto.set(true)"
            title="Meses programados"
            class="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-[transform,background-color] duration-150 ease-out shadow-sm active:scale-[0.97]">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </button>
        </div>
      </div>

      <!-- ===== ERROR ===== -->
      @if (estado() === 'error') {
        <div class="shrink-0 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p class="flex-1 min-w-0 text-red-600 dark:text-red-400 text-xs font-medium truncate">{{ errorMsg() }}</p>
          <button (click)="estado.set('idle')" class="shrink-0 px-3 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-xs text-red-600 font-bold transition-all">Cerrar</button>
        </div>
      }

      <!-- ===== CONFIRMADO banner ===== -->
      @if (confirmadoBanner()) {
        <div class="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p class="text-emerald-700 dark:text-emerald-300 text-xs font-bold">Logística confirmada correctamente.</p>
        </div>
      }

      <!-- ===== LAYOUT principal ===== -->
      <div class="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-4 overflow-hidden">

        <!-- ── SIDEBAR ── -->
        <aside class="hidden md:flex md:w-60 lg:w-64 xl:w-72 2xl:w-80 shrink-0 flex-col gap-3 overflow-y-auto simple-scrollbar py-0.5 pr-0.5">

          <!-- Generar Mes -->
          @if (hasEditPermission()) {
            <button
              (click)="abrirModalGenerar()"
              [disabled]="estado() === 'loading'"
              class="w-full flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm shadow-purple-900/20 active:scale-95 shrink-0">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Generar Mes
            </button>
          }

          <!-- Historial de meses -->
          @if (mesesDisponibles().length > 0) {
            <div class="flex flex-col gap-1.5">
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 pb-0.5">Meses programados</p>
              @for (m of mesesDisponibles(); track m.ano + '-' + m.mes) {
                <div class="flex items-center gap-1">
                  <button
                    (click)="cargarMes(m.ano, m.mes)"
                    [disabled]="estado() === 'loading'"
                    class="flex-1 flex items-center justify-between px-2.5 h-10 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-40 group">
                    <span>{{ mesLabel(m) }}</span>
                    <svg class="w-3 h-3 text-slate-400 group-hover:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                  <button
                    (click)="descargarPdfMes(m)"
                    [disabled]="descargandoPdf()"
                    title="Descargar PDF"
                    class="shrink-0 w-9 h-10 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 hover:text-emerald-700 transition-all active:scale-95 flex items-center justify-center disabled:opacity-40">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                  </button>
                </div>
              }
            </div>
          }
        </aside>

        <!-- ── PANEL PRINCIPAL ── -->
        <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative">

          @if (estado() === 'loading') {
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-10 rounded-2xl">
              <div class="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-violet-500 animate-spin"></div>
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Cargando...</p>
            </div>
          }

          @if (!mesDatos() && estado() !== 'loading') {
            <!-- Estado vacío -->
            <div class="flex-1 flex flex-col gap-4 p-4 md:items-center md:justify-center md:p-8 overflow-y-auto simple-scrollbar">

              <!-- Encabezado vacío (siempre visible) -->
              <div class="flex flex-col items-center gap-3 text-center pt-4 md:pt-0">
                <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <svg class="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Sin programación activa</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                    @if (mesesDisponibles().length > 0) {
                      Selecciona un mes del historial para verlo.
                    } @else if (hasEditPermission()) {
                      Genera una nueva programación para comenzar.
                    } @else {
                      No hay logística programada. Consulta con el secretario.
                    }
                  </p>
                </div>
                @if (hasEditPermission()) {
                  <button
                    (click)="abrirModalGenerar()"
                    class="flex items-center gap-2 px-4 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] text-xs font-bold text-white transition-[transform,background-color] duration-150 ease-out shadow-sm active:scale-[0.97]">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Generar mes
                  </button>
                }
              </div>

              <!-- Lista de meses disponibles — visible en móvil directamente, oculta en desktop (el sidebar la muestra) -->
              @if (mesesDisponibles().length > 0) {
                <div class="md:hidden flex flex-col gap-2 pb-4">
                  <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">Meses programados</p>
                  @for (m of mesesDisponibles(); track m.ano + '-' + m.mes) {
                    <div class="flex items-center gap-2">
                      <button
                        (click)="cargarMes(m.ano, m.mes)"
                        [disabled]="estado() === 'loading'"
                        class="flex-1 flex items-center justify-between px-4 h-12 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-800 dark:text-slate-100 text-sm font-medium transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] disabled:opacity-40 border border-slate-200 dark:border-slate-700">
                        <span>{{ mesLabel(m) }}</span>
                        <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </button>
                      <button
                        (click)="descargarPdfMes(m)"
                        [disabled]="descargandoPdf()"
                        title="Descargar PDF"
                        class="shrink-0 w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 text-emerald-600 transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] flex items-center justify-center disabled:opacity-40 border border-emerald-200 dark:border-emerald-800/50">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                      </button>
                    </div>
                  }
                </div>
              }

            </div>
          }

          @if (mesDatos() && estado() !== 'loading') {
            <!-- Toolbar del mes cargado -->
            <div class="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {{ mesLabel({ ano: mesDatos()!.ano, mes: mesDatos()!.mes }) }}
                </span>
                @if (mesDatos()!.confirmado) {
                  <span class="shrink-0 px-2 py-0.5 rounded-full text-[0.6rem] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    Confirmado
                  </span>
                } @else {
                  <span class="shrink-0 px-2 py-0.5 rounded-full text-[0.6rem] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    Borrador
                  </span>
                }
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <!-- Confirmar -->
                @if (!mesDatos()!.confirmado && hasEditPermission()) {
                  <button
                    (click)="confirmarMes()"
                    [disabled]="estado() === 'loading'"
                    class="flex items-center gap-1 px-2.5 h-8 rounded-full border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-[0.65rem] font-bold transition-all active:scale-95 disabled:opacity-40">
                    <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Confirmar
                  </button>
                }
                <!-- Eliminar mes -->
                @if (hasEditPermission()) {
                  <button
                    (click)="eliminarMes()"
                    [disabled]="estado() === 'loading'"
                    title="Eliminar programación del mes"
                    class="flex items-center gap-1 px-2.5 h-8 rounded-full border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-[0.65rem] font-bold transition-all active:scale-95 disabled:opacity-40">
                    <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Borrar
                  </button>
                }
                <!-- PDF — siempre visible; deshabilitado con tooltip si no está confirmado -->
                <button
                  (click)="descargarPdf()"
                  [disabled]="!mesDatos()!.confirmado || descargandoPdf()"
                  [title]="mesDatos()!.confirmado ? 'Descargar PDF del mes' : 'Confirma el mes antes de descargar el PDF'"
                  class="flex items-center gap-1 px-2.5 h-8 rounded-full border text-[0.65rem] font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  [class]="mesDatos()!.confirmado
                    ? 'border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    : 'border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'">
                  <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                  PDF
                </button>
              </div>
            </div>

            <!-- Contenido — scroll -->
            <div class="flex-1 overflow-y-auto simple-scrollbar p-3 md:p-4">

              <!-- ═══════════════ VISTA MÓVIL: CARDS POR FECHA ═══════════════ -->
              <div class="md:hidden flex flex-col gap-3 logistica-stagger">
                @for (fecha of mesDatos()!.fechas; track fecha.fecha) {
                  <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                    <!-- Card header -->
                    <div class="flex items-baseline gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <span class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ formatFecha(fecha.fecha) }}</span>
                      <span class="text-[0.65rem] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">{{ fecha.dia_semana }}</span>
                    </div>
                    <!-- Secciones de puestos -->
                    @for (seccion of seccionesKeys; track seccion) {
                      <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="w-1.5 h-1.5 rounded-full shrink-0" [style.background]="seccionHeaderColor(seccion)"></span>
                          <span class="text-[0.6rem] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{{ seccion }}</span>
                        </div>
                        <div class="flex flex-col gap-1.5">
                          @for (puesto of seccionPuestos(seccion); track puesto) {
                            <button
                              type="button"
                              (click)="!mesDatos()!.confirmado && hasEditPermission() && abrirCombobox(fecha.fecha, puesto)"
                              [attr.data-cell]="fecha.fecha + '::' + puesto"
                              [disabled]="mesDatos()!.confirmado || !hasEditPermission()"
                              class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 transition-[transform,border-color] duration-150 ease-out active:scale-[0.98] enabled:hover:border-violet-300 dark:enabled:hover:border-violet-600 disabled:opacity-90">
                              <span class="text-[0.65rem] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide shrink-0">{{ puestoLabel(puesto) }}</span>
                              @if (getAsignacion(fecha.fecha, puesto)?.publicador) {
                                <span class="text-xs font-medium text-slate-800 dark:text-slate-100 truncate text-right">{{ getAsignacion(fecha.fecha, puesto)!.publicador!.nombre_completo }}</span>
                              } @else {
                                <span class="text-xs italic text-slate-400 dark:text-slate-500">Sin asignar</span>
                              }
                            </button>
                          }
                        </div>
                      </div>
                    }
                    <!-- Aseo -->
                    <div class="px-4 py-3">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="w-1.5 h-1.5 rounded-full shrink-0" [style.background]="seccionHeaderColor('Aseo')"></span>
                        <span class="text-[0.6rem] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Aseo del salón</span>
                      </div>
                      @if (!mesDatos()!.confirmado && hasEditPermission()) {
                        <div class="flex flex-wrap gap-1.5">
                          @for (g of gruposDisponibles(); track g.id_grupo) {
                            <button
                              type="button"
                              (click)="onToggleGrupo(fecha, g.id_grupo, !isGrupoAsignado(fecha.fecha, g.id_grupo))"
                              [class]="isGrupoAsignado(fecha.fecha, g.id_grupo)
                                ? 'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.7rem] font-bold bg-[#059669] text-white shadow-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97]'
                                : 'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.7rem] font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 transition-[transform,border-color,color] duration-150 ease-out active:scale-[0.97]'">
                              @if (isGrupoAsignado(fecha.fecha, g.id_grupo)) {
                                <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              }
                              {{ g.nombre_grupo }}
                            </button>
                          }
                        </div>
                      } @else {
                        @if (gruposAsignadosFecha(fecha.fecha).length > 0) {
                          <div class="flex flex-wrap gap-1.5">
                            @for (g of gruposAsignadosFecha(fecha.fecha); track g) {
                              <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.7rem] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                {{ g }}
                              </span>
                            }
                          </div>
                        } @else {
                          <span class="text-xs italic text-slate-400 dark:text-slate-500">Sin asignar</span>
                        }
                      }
                    </div>
                  </div>
                }
              </div>

              <!-- ═══════════════ VISTA DESKTOP: TABLAS ═══════════════ -->
              <div class="hidden md:flex md:flex-col gap-6">

              <!-- ── Secciones de puestos ── -->
              @for (seccion of seccionesKeys; track seccion) {
                <div>
                  <!-- Cabecera de sección -->
                  <div class="flex items-center gap-2 mb-2">
                    <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                    <span class="text-[0.65rem] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-2 whitespace-nowrap">
                      {{ seccion }}
                    </span>
                    <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                  </div>

                  <!-- Tabla responsive -->
                  <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table class="w-full text-xs">
                      <thead>
                        <tr [style.background]="seccionHeaderColor(seccion)" class="text-white">
                          <th class="px-2 lg:px-3 py-2 text-left font-bold whitespace-nowrap">Fecha</th>
                          <th class="px-3 py-2 text-left font-bold whitespace-nowrap hidden lg:table-cell">Día</th>
                          @for (puesto of seccionPuestos(seccion); track puesto) {
                            <th class="px-2 lg:px-3 py-2 text-left font-bold whitespace-nowrap">{{ puestoLabel(puesto) }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (fecha of mesDatos()!.fechas; track fecha.fecha; let i = $index) {
                          <tr [style.background]="i % 2 === 0 ? '' : seccionRowAltColor(seccion)" [class]="i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'dark:bg-slate-800/40'">
                            <td class="px-2 lg:px-3 py-1.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{{ formatFecha(fecha.fecha) }}</td>
                            <td class="px-3 py-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400 hidden lg:table-cell">{{ fecha.dia_semana }}</td>
                            @for (puesto of seccionPuestos(seccion); track puesto) {
                              <td class="px-2 py-1">
                                @if (!mesDatos()!.confirmado && hasEditPermission()) {
                                  <!-- Buscador de publicador — ancho de la celda, dropdown flotante -->
                                  <div class="relative w-full min-w-[120px]" [attr.data-cell]="fecha.fecha + '::' + puesto">

                                    <!-- Trigger + input en el mismo espacio (sin salto de tamaño) -->
                                    <div class="flex items-center w-full rounded-lg border bg-white dark:bg-slate-800 overflow-hidden transition-colors"
                                         [class]="activeCellKey() === (fecha.fecha + '::' + puesto)
                                           ? 'border-violet-400 dark:border-violet-500 ring-1 ring-violet-300 dark:ring-violet-700'
                                           : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'">

                                      @if (activeCellKey() === (fecha.fecha + '::' + puesto)) {
                                        <!-- Input de búsqueda -->
                                        <svg class="w-3 h-3 shrink-0 text-violet-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                                        <input
                                          type="text"
                                          class="flex-1 min-w-0 text-xs bg-transparent text-slate-800 dark:text-slate-100 outline-none px-1.5 py-1.5 placeholder:text-slate-400"
                                          placeholder="Buscar..."
                                          [value]="cellSearch()"
                                          (input)="onSearchInput($any($event.target).value)"
                                          autocomplete="off"
                                          spellcheck="false"
                                        />
                                        @if (buscandoPublicador()) {
                                          <div class="w-3 h-3 rounded-full border-2 border-violet-200 border-t-violet-500 animate-spin shrink-0 mr-2"></div>
                                        }
                                      } @else {
                                        <!-- Nombre asignado o placeholder — clic abre búsqueda -->
                                        <button
                                          type="button"
                                          (click)="abrirCombobox(fecha.fecha, puesto)"
                                          class="flex-1 min-w-0 flex items-center gap-1 px-2 py-1.5 text-left">
                                          @if (getAsignacion(fecha.fecha, puesto)?.publicador) {
                                            <span class="flex-1 min-w-0 text-xs text-slate-800 dark:text-slate-100 truncate">
                                              {{ getAsignacion(fecha.fecha, puesto)!.publicador!.nombre_completo }}
                                            </span>
                                          } @else {
                                            <span class="flex-1 text-xs text-slate-400 italic truncate">Sin asignar</span>
                                          }
                                          <!-- Ícono lápiz al hover -->
                                          <svg class="w-3 h-3 shrink-0 text-slate-300 hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                                        </button>
                                        <!-- Botón quitar (solo si hay asignado) -->
                                        @if (getAsignacion(fecha.fecha, puesto)?.publicador) {
                                          <button
                                            type="button"
                                            (click)="onCambiarPublicador(fecha.fecha, puesto, null)"
                                            title="Quitar asignación"
                                            class="shrink-0 px-1.5 py-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none">
                                            ×
                                          </button>
                                        }
                                      }
                                    </div>

                                    <!-- Dropdown flotante — no afecta el layout -->
                                    @if (activeCellKey() === (fecha.fecha + '::' + puesto)) {
                                      <div class="absolute z-50 left-0 top-[calc(100%+4px)] w-56 max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl simple-scrollbar">

                                        @if (getAsignacion(fecha.fecha, puesto)?.publicador) {
                                          <button
                                            type="button"
                                            (mousedown)="$event.preventDefault(); seleccionarCandidato(fecha.fecha, puesto, null)"
                                            class="w-full text-left text-xs px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800">
                                            <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                            Quitar asignación
                                          </button>
                                        }

                                        @if (cellSearch().trim().length === 0) {
                                          <p class="text-[0.65rem] text-slate-400 px-3 py-3 italic text-center">Escribe un nombre para buscar</p>
                                        } @else if (buscandoPublicador()) {
                                          <p class="text-[0.65rem] text-slate-400 px-3 py-3 italic text-center">Buscando...</p>
                                        } @else if (resultadosBusqueda().length === 0) {
                                          <p class="text-[0.65rem] text-slate-400 px-3 py-3 italic text-center">Sin resultados</p>
                                        } @else {
                                          @for (c of resultadosBusqueda(); track c.id_publicador) {
                                            <button
                                              type="button"
                                              (mousedown)="$event.preventDefault(); seleccionarCandidato(fecha.fecha, puesto, c.id_publicador)"
                                              [class]="'w-full text-left text-xs px-3 py-2 transition-colors ' + (getAsignacion(fecha.fecha, puesto)?.publicador?.id_publicador === c.id_publicador ? 'bg-violet-50 dark:bg-violet-900/20 font-semibold text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800')">
                                              {{ c.nombre_completo }}
                                            </button>
                                          }
                                        }
                                      </div>
                                    }
                                  </div>
                                } @else {
                                  <span class="text-slate-700 dark:text-slate-200">
                                    {{ getAsignacion(fecha.fecha, puesto)?.publicador?.nombre_completo || '—' }}
                                  </span>
                                }
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }

              <!-- ── Aseo del Salón ── -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                  <span class="text-[0.65rem] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-2 whitespace-nowrap">
                    Aseo del Salón
                  </span>
                  <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                </div>
                <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table class="w-full text-xs">
                    <thead>
                      <tr [style.background]="seccionHeaderColor('Aseo')" class="text-white">
                        <th class="px-2 lg:px-3 py-2 text-left font-bold whitespace-nowrap w-20">Fecha</th>
                        <th class="px-3 py-2 text-left font-bold whitespace-nowrap hidden lg:table-cell w-20">Día</th>
                        <th class="px-2 lg:px-3 py-2 text-left font-bold">Grupo asignado</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (fecha of mesDatos()!.fechas; track fecha.fecha; let i = $index) {
                        <tr [style.background]="i % 2 === 0 ? '' : seccionRowAltColor('Aseo')" [class]="i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'dark:bg-slate-800/40'">
                          <td class="px-2 lg:px-3 py-1.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{{ formatFecha(fecha.fecha) }}</td>
                          <td class="px-3 py-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400 hidden lg:table-cell">{{ fecha.dia_semana }}</td>
                          <td class="px-2 py-1.5">
                            @if (!mesDatos()!.confirmado && hasEditPermission()) {
                              <!-- Chips de grupos: seleccionado = violeta sólido, no seleccionado = outline gris -->
                              <div class="flex flex-wrap gap-1.5">
                                @for (g of gruposDisponibles(); track g.id_grupo) {
                                  <button
                                    type="button"
                                    (click)="onToggleGrupo(fecha, g.id_grupo, !isGrupoAsignado(fecha.fecha, g.id_grupo))"
                                    [class]="isGrupoAsignado(fecha.fecha, g.id_grupo)
                                      ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-bold bg-[#059669] text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30 transition-all active:scale-95'
                                      : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-medium border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400 transition-all active:scale-95'">
                                    @if (isGrupoAsignado(fecha.fecha, g.id_grupo)) {
                                      <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    }
                                    {{ g.nombre_grupo }}
                                  </button>
                                }
                              </div>
                            } @else {
                              <!-- Vista solo lectura: badge del grupo seleccionado -->
                              @if (getAseoLabel(fecha.fecha) !== '—') {
                                <div class="flex flex-wrap gap-1.5">
                                  @for (g of gruposAsignadosFecha(fecha.fecha); track g) {
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                      <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                      {{ g }}
                                    </span>
                                  }
                                </div>
                              } @else {
                                <span class="text-slate-400 dark:text-slate-500 italic text-xs">Sin asignar</span>
                              }
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              </div> <!-- fin grid desktop -->

            </div>
          }

        </div>
      </div>

    </div>

    <!-- ===== MODAL CONFIRMACIÓN ===== -->
    @if (confirmPendiente()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 border border-slate-200 dark:border-slate-700">
          <div class="flex items-start gap-3">
            <div class="shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            </div>
            <div>
              <p class="text-sm font-bold text-slate-900 dark:text-white">{{ confirmPendiente()!.titulo }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ confirmPendiente()!.mensaje }}</p>
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <button (click)="cancelarConfirm()"
              class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              Cancelar
            </button>
            <button (click)="aceptarConfirm()"
              class="px-4 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-all active:scale-95">
              {{ confirmPendiente()!.accionLabel }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL GENERAR MES ===== -->
    @if (modalGenerarAbierto()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarModal()">
        <div class="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-5" (click)="$event.stopPropagation()">
          <h2 class="text-base font-black text-slate-800 dark:text-white">Generar programación</h2>
          <div class="flex gap-3">
            <div class="flex-1 flex flex-col gap-1">
              <label class="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mes</label>
              <select
                [(ngModel)]="modalMes"
                class="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400">
                @for (m of mesesOpciones; track m.value) {
                  <option [value]="m.value">{{ m.label }}</option>
                }
              </select>
            </div>
            <div class="w-24 flex flex-col gap-1">
              <label class="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Año</label>
              <input
                type="number"
                [(ngModel)]="modalAno"
                min="2024" max="2030"
                class="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400">
            </div>
          </div>
          <div class="flex gap-2 justify-end pt-1">
            <button (click)="cerrarModal()" class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              Cancelar
            </button>
            <button
              (click)="generarMes()"
              [disabled]="estado() === 'loading'"
              class="px-5 h-9 rounded-xl text-xs font-bold text-white bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 transition-all active:scale-95">
              Generar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== SHEET MÓVIL: MESES PROGRAMADOS ===== -->
    @if (mobileMesesAbierto()) {
      <div class="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm sheet-overlay" (click)="mobileMesesAbierto.set(false)">
        <div class="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-700 max-h-[85vh] flex flex-col sheet-content" (click)="$event.stopPropagation()">
          <div class="shrink-0 pt-2.5 pb-2 flex justify-center">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>
          <div class="px-5 pb-3">
            <h2 class="text-base font-black text-slate-800 dark:text-white">Meses programados</h2>
          </div>
          <div class="flex-1 overflow-y-auto simple-scrollbar px-4 pb-5 flex flex-col gap-2">
            @if (hasEditPermission()) {
              <button
                (click)="mobileMesesAbierto.set(false); abrirModalGenerar()"
                [disabled]="estado() === 'loading'"
                class="w-full flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 text-xs font-bold text-white transition-[transform,background-color] duration-150 ease-out shadow-sm active:scale-[0.97] shrink-0">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Generar mes
              </button>
            }
            @if (mesesDisponibles().length > 0) {
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 pt-2 pb-1">Historial</p>
              @for (m of mesesDisponibles(); track m.ano + '-' + m.mes) {
                <div class="flex items-center gap-2">
                  <button
                    (click)="cargarMes(m.ano, m.mes); mobileMesesAbierto.set(false)"
                    [disabled]="estado() === 'loading'"
                    class="flex-1 flex items-center justify-between px-3 h-11 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-sm font-medium transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] disabled:opacity-40">
                    <span>{{ mesLabel(m) }}</span>
                    <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                  <button
                    (click)="descargarPdfMes(m)"
                    [disabled]="descargandoPdf()"
                    title="Descargar PDF"
                    class="shrink-0 w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] flex items-center justify-center disabled:opacity-40">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                  </button>
                </div>
              }
            } @else {
              <p class="text-xs italic text-slate-400 dark:text-slate-500 text-center py-6">No hay meses programados.</p>
            }
          </div>
        </div>
      </div>
    }

    <!-- ===== SHEET MÓVIL: COMBOBOX BÚSQUEDA PUBLICADOR ===== -->
    @if (activeCellKey() && mesDatos() && !mesDatos()!.confirmado && hasEditPermission()) {
      <div class="md:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm sheet-overlay" (click)="cerrarCombobox()" data-cell-sheet>
        <div class="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-700 max-h-[85vh] flex flex-col sheet-content" (click)="$event.stopPropagation()" data-cell-sheet>
          <div class="shrink-0 pt-2.5 pb-2 flex justify-center">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>
          <div class="shrink-0 px-5 pb-3">
            <p class="text-[0.65rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{{ activeCellPuestoLabel() }}</p>
            <p class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ activeCellFechaLabel() }}</p>
          </div>
          <div class="shrink-0 px-4 pb-3">
            <div class="flex items-center gap-2 px-3 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-300 transition-[border-color] duration-150">
              <svg class="w-4 h-4 shrink-0 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                class="flex-1 min-w-0 text-sm bg-transparent text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400"
                placeholder="Buscar publicador..."
                [value]="cellSearch()"
                (input)="onSearchInput($any($event.target).value)"
                autocomplete="off"
                spellcheck="false"
                autofocus
              />
              @if (buscandoPublicador()) {
                <div class="w-3.5 h-3.5 rounded-full border-2 border-violet-200 border-t-violet-500 animate-spin shrink-0"></div>
              }
            </div>
          </div>
          <div class="flex-1 overflow-y-auto simple-scrollbar px-2 pb-5">
            @if (activeCellAsignacion()?.publicador) {
              <button
                type="button"
                (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(null)"
                class="w-full text-left text-sm px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 mb-1">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Quitar asignación
              </button>
            }
            @if (cellSearch().trim().length === 0) {
              <p class="text-xs text-slate-400 px-3 py-6 italic text-center">Escribe un nombre para buscar.</p>
            } @else if (buscandoPublicador()) {
              <p class="text-xs text-slate-400 px-3 py-6 italic text-center">Buscando...</p>
            } @else if (resultadosBusqueda().length === 0) {
              <p class="text-xs text-slate-400 px-3 py-6 italic text-center">Sin resultados.</p>
            } @else {
              @for (c of resultadosBusqueda(); track c.id_publicador) {
                <button
                  type="button"
                  (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(c.id_publicador)"
                  [class]="'w-full text-left text-sm px-3 py-3 rounded-xl transition-colors ' + (activeCellAsignacion()?.publicador?.id_publicador === c.id_publicador ? 'bg-violet-50 dark:bg-violet-900/20 font-semibold text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800')">
                  {{ c.nombre_completo }}
                </button>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Sheet móvil: entrada desde abajo con curva tipo drawer iOS */
    .sheet-overlay {
      animation: sheetFadeIn 200ms cubic-bezier(0.32, 0.72, 0, 1);
    }
    .sheet-content {
      animation: sheetSlideUp 280ms cubic-bezier(0.32, 0.72, 0, 1);
    }
    @keyframes sheetFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes sheetSlideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    /* Stagger sutil en las cards móviles */
    .logistica-stagger > * {
      opacity: 0;
      transform: translateY(6px);
      animation: cardEnter 280ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }
    .logistica-stagger > *:nth-child(1)  { animation-delay: 0ms; }
    .logistica-stagger > *:nth-child(2)  { animation-delay: 40ms; }
    .logistica-stagger > *:nth-child(3)  { animation-delay: 80ms; }
    .logistica-stagger > *:nth-child(4)  { animation-delay: 120ms; }
    .logistica-stagger > *:nth-child(5)  { animation-delay: 160ms; }
    .logistica-stagger > *:nth-child(6)  { animation-delay: 200ms; }
    .logistica-stagger > *:nth-child(7)  { animation-delay: 240ms; }
    .logistica-stagger > *:nth-child(n+8) { animation-delay: 280ms; }
    @keyframes cardEnter {
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .sheet-overlay, .sheet-content, .logistica-stagger > * {
        animation: none;
        opacity: 1;
        transform: none;
      }
    }
  `],
})
export class ReunionesLogisticaComponent implements OnInit {
  private logisticaSvc = inject(LogisticaService);
  private conflictosSvc = inject(ConflictosService);
  private congregacionCtx = inject(CongregacionContextService);
  private authStore = inject(AuthStore);
  private destroyRef = inject(DestroyRef);

  estado = signal<Estado>('idle');
  errorMsg = signal('');
  confirmadoBanner = signal(false);

  mesDatos = signal<LogisticaMesOut | null>(null);
  mesesDisponibles = signal<MesDisponible[]>([]);

  descargandoPdf = signal(false);

  // Candidatos cacheados por clave `${puesto}::${incluirHermanas}` (para auto-asignación)
  private candidatosCache = signal<Record<string, PublicadorBase[]>>({});
  cargandoCandidatos = signal(false);
  gruposDisponibles = signal<GrupoBase[]>([]);

  // Buscador de publicadores (manual)
  resultadosBusqueda = signal<PublicadorBase[]>([]);
  buscandoPublicador = signal(false);
  private searchSubject = new Subject<string>();

  // Combobox state
  activeCellKey = signal<string | null>(null);
  cellSearch = signal<string>('');
  hermanasPorPuesto = signal<Record<string, boolean>>({});

  // Modal de confirmación (reemplaza window.confirm)
  confirmPendiente = signal<{ titulo: string; mensaje: string; accionLabel: string; callback: () => void } | null>(null);

  // Modal generar
  modalGenerarAbierto = signal(false);
  modalMes = new Date().getMonth() + 1;
  modalAno = new Date().getFullYear();

  // Sheet móvil de meses
  mobileMesesAbierto = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.activeCellKey()) return;
    const target = event.target as HTMLElement;
    // En móvil el combobox se renderiza en un sheet (data-cell-sheet), no en una celda
    if (!target.closest('[data-cell]') && !target.closest('[data-cell-sheet]')) {
      this.cerrarCombobox();
    }
  }

  readonly seccionesKeys = Object.keys(SECCION_PUESTOS);

  readonly mesesOpciones = MESES_ES.map((label, i) => ({ value: i + 1, label }));

  hasEditPermission(): boolean {
    return (
      this.authStore.hasPermission('reuniones.logistica') ||
      this.authStore.user()?.roles?.includes('Secretario') === true
    );
  }

  ngOnInit(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.cargarMeses(cong);
    this.cargarGrupos(cong);
    this.precargarCandidatos(cong);

    // Debounce para el buscador de publicadores
    this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => {
        if (!q || q.trim().length === 0) {
          this.buscandoPublicador.set(false);
          return [[]];
        }
        return this.logisticaSvc.buscarPublicadores(q, this.congregacionCtx.effectiveCongregacionId());
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (results) => {
        this.resultadosBusqueda.set(results as PublicadorBase[]);
        this.buscandoPublicador.set(false);
      },
      error: () => this.buscandoPublicador.set(false),
    });
  }

  private cargarMeses(cong: number | null): void {
    this.logisticaSvc.getMeses(cong).subscribe({
      next: (meses) => this.mesesDisponibles.set(meses),
      error: () => {},
    });
  }

  private cargarGrupos(cong: number | null): void {
    this.logisticaSvc.getGrupos(cong).subscribe({
      next: (gs) => this.gruposDisponibles.set(gs),
      error: () => {},
    });
  }

  private precargarCandidatos(cong: number | null): void {
    const puestos = Object.values(SECCION_PUESTOS).flat();
    const uniquePuestos = [...new Set(puestos)];
    this.cargandoCandidatos.set(true);
    let pendientes = uniquePuestos.length;
    for (const puesto of uniquePuestos) {
      // Precarga solo con el filtro por defecto (varones para puestos restringidos)
      const clave = `${puesto}::false`;
      this.logisticaSvc.getCandidatos(puesto, cong, false).subscribe({
        next: (candidates) => {
          this.candidatosCache.update((c) => ({ ...c, [clave]: candidates }));
          if (--pendientes === 0) this.cargandoCandidatos.set(false);
        },
        error: () => { if (--pendientes === 0) this.cargandoCandidatos.set(false); },
      });
    }
  }

  private cargarCandidatosConHermanas(puesto: string): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const clave = `${puesto}::true`;
    if (this.candidatosCache()[clave]) return; // ya cargado
    this.logisticaSvc.getCandidatos(puesto, cong, true).subscribe({
      next: (candidates) => {
        this.candidatosCache.update((c) => ({ ...c, [clave]: candidates }));
      },
      error: () => {},
    });
  }

  cargarMes(ano: number, mes: number): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.estado.set('loading');
    this.logisticaSvc.getMes(ano, mes, cong).subscribe({
      next: (data) => {
        this.mesDatos.set(data);
        this.estado.set('ready');
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail ?? 'Error al cargar el mes');
        this.estado.set('error');
      },
    });
  }

  abrirModalGenerar(): void {
    this.modalMes = new Date().getMonth() + 1;
    this.modalAno = new Date().getFullYear();
    this.modalGenerarAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalGenerarAbierto.set(false);
  }

  generarMes(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.cerrarModal();
    this.estado.set('loading');
    this.logisticaSvc
      .generar({ ano: this.modalAno, mes: this.modalMes }, cong)
      .subscribe({
        next: (data) => {
          this.mesDatos.set(data);
          this.estado.set('ready');
          this.cargarMeses(cong);
        },
        error: (err) => {
          this.errorMsg.set(err?.error?.detail ?? 'Error al generar el mes');
          this.estado.set('error');
        },
      });
  }

  confirmarMes(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const datos = this.mesDatos();
    if (!datos) return;
    this.estado.set('loading');
    this.logisticaSvc
      .confirmar({ ano: datos.ano, mes: datos.mes }, cong)
      .subscribe({
        next: (updated) => {
          this.mesDatos.set(updated);
          this.estado.set('ready');
          this.confirmadoBanner.set(true);
          setTimeout(() => this.confirmadoBanner.set(false), 4000);
        },
        error: (err) => {
          this.errorMsg.set(err?.error?.detail ?? 'Error al confirmar');
          this.estado.set('error');
        },
      });
  }

  eliminarMes(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const datos = this.mesDatos();
    if (!datos) return;
    const mesNombre = MESES_ES[datos.mes - 1] ?? `${datos.mes}`;
    this.confirmPendiente.set({
      titulo: `Eliminar ${mesNombre} ${datos.ano}`,
      mensaje: 'Se eliminará toda la programación de logística de este mes. Esta acción no se puede deshacer.',
      accionLabel: 'Eliminar',
      callback: () => {
        this.estado.set('loading');
        this.logisticaSvc.eliminarMes(datos.ano, datos.mes, cong).subscribe({
          next: () => {
            this.mesDatos.set(null);
            this.estado.set('idle');
            this.cargarMeses(cong);
          },
          error: (err) => {
            this.errorMsg.set(err?.error?.detail ?? 'Error al eliminar el mes');
            this.estado.set('error');
          },
        });
      },
    });
  }

  aceptarConfirm(): void {
    this.confirmPendiente()?.callback();
    this.confirmPendiente.set(null);
  }

  cancelarConfirm(): void {
    this.confirmPendiente.set(null);
  }

  // ── Acceso a datos ────────────────────────────────────────────

  seccionPuestos(seccion: string): string[] {
    return SECCION_PUESTOS[seccion] ?? [];
  }

  seccionHeaderColor(seccion: string): string {
    return SECCION_COLOR[seccion] ?? '#6D28D9';
  }

  seccionRowAltColor(seccion: string): string {
    return `${SECCION_COLOR[seccion] ?? '#6D28D9'}12`;
  }

  puestoLabel(puesto: string): string {
    return PUESTOS_LABEL[puesto] ?? puesto;
  }

  getAsignacion(fecha: string, puesto: string): LogisticaItemOut | undefined {
    return this.mesDatos()?.asignaciones.find(
      (a) => a.fecha === fecha && a.puesto === puesto
    );
  }

  esPuestoSoloVarones(puesto: string): boolean {
    return PUESTOS_SOLO_VARONES.has(puesto);
  }

  getCandidatosFiltrados(puesto: string): PublicadorBase[] {
    const hermanas = this.hermanasPorPuesto()[puesto] ?? false;
    const clave = `${puesto}::${hermanas}`;
    const todos = this.candidatosCache()[clave] ?? [];
    const q = normalizarTexto(this.cellSearch().trim());
    if (!q) return todos;
    return todos.filter((c) => normalizarTexto(c.nombre_completo).includes(q));
  }

  onSearchInput(value: string): void {
    this.cellSearch.set(value);
    if (value.trim().length > 0) {
      this.buscandoPublicador.set(true);
    } else {
      this.resultadosBusqueda.set([]);
    }
    this.searchSubject.next(value);
  }

  abrirCombobox(fecha: string, puesto: string): void {
    this.activeCellKey.set(`${fecha}::${puesto}`);
    this.cellSearch.set('');
    this.resultadosBusqueda.set([]);
  }

  cerrarCombobox(): void {
    this.activeCellKey.set(null);
    this.cellSearch.set('');
    this.resultadosBusqueda.set([]);
    this.buscandoPublicador.set(false);
  }

  seleccionarCandidato(fecha: string, puesto: string, idPublicador: number | null): void {
    this.cerrarCombobox();
    this.onCambiarPublicador(fecha, puesto, idPublicador);
  }

  // Helpers para el sheet móvil del combobox
  private parseActiveCell(): { fecha: string; puesto: string } | null {
    const key = this.activeCellKey();
    if (!key) return null;
    const [fecha, puesto] = key.split('::');
    return { fecha, puesto };
  }

  activeCellPuestoLabel(): string {
    const p = this.parseActiveCell();
    return p ? this.puestoLabel(p.puesto) : '';
  }

  activeCellFechaLabel(): string {
    const p = this.parseActiveCell();
    if (!p) return '';
    const fechaObj = this.mesDatos()?.fechas.find((f) => f.fecha === p.fecha);
    return fechaObj ? `${this.formatFecha(p.fecha)} · ${fechaObj.dia_semana}` : this.formatFecha(p.fecha);
  }

  activeCellAsignacion(): LogisticaItemOut | undefined {
    const p = this.parseActiveCell();
    return p ? this.getAsignacion(p.fecha, p.puesto) : undefined;
  }

  seleccionarCandidatoActiva(idPublicador: number | null): void {
    const p = this.parseActiveCell();
    if (!p) return;
    this.seleccionarCandidato(p.fecha, p.puesto, idPublicador);
  }

  toggleHermanas(puesto: string, checked: boolean): void {
    this.hermanasPorPuesto.update((m) => ({ ...m, [puesto]: checked }));
    if (checked) {
      this.cargarCandidatosConHermanas(puesto);
    }
  }

  isGrupoAsignado(fecha: string, idGrupo: number): boolean {
    return (
      this.mesDatos()?.aseo.some((s) => s.fecha === fecha && s.grupo.id_grupo === idGrupo) ?? false
    );
  }

  getAseoLabel(fecha: string): string {
    const grupos = this.mesDatos()?.aseo
      .filter((s) => s.fecha === fecha)
      .map((s) => s.grupo.nombre_grupo);
    return grupos?.join(', ') || '—';
  }

  gruposAsignadosFecha(fecha: string): string[] {
    return (
      this.mesDatos()?.aseo
        .filter((s) => s.fecha === fecha)
        .map((s) => s.grupo.nombre_grupo) ?? []
    );
  }

  formatFecha(fechaStr: string): string {
    const d = new Date(fechaStr + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')} ${MESES_ES[d.getMonth()].slice(0, 3)}`;
  }

  mesLabel(m: MesDisponible): string {
    return `${MESES_ES[m.mes - 1]} ${m.ano}`;
  }

  // ── Edición en línea ──────────────────────────────────────────

  onCambiarPublicador(fecha: string, puesto: string, idPublicador: number | null): void {
    const asig = this.getAsignacion(fecha, puesto);
    if (!asig) return;

    const guardar = () => {
      this.logisticaSvc.editarItem(asig.id_logistica, { id_publicador: idPublicador }).subscribe({
        next: (updated) => {
          this.mesDatos.update((d) => {
            if (!d) return d;
            return {
              ...d,
              asignaciones: d.asignaciones.map((a) =>
                a.id_logistica === updated.id_logistica ? updated : a
              ),
            };
          });
        },
        error: (err) => {
          this.errorMsg.set(err?.error?.detail ?? 'Error al actualizar asignación');
          this.estado.set('error');
          // revertir al publicador anterior en el signal
          this.mesDatos.update((d) => d ? { ...d } : d);
        },
      });
    };

    // Sin publicador seleccionado → guardar directamente
    if (!idPublicador) {
      guardar();
      return;
    }

    const cong = this.congregacionCtx.effectiveCongregacionId();
    if (!cong) { guardar(); return; }

    const hermanas = this.hermanasPorPuesto()[puesto] ?? false;
    const claveCandidatos = `${puesto}::${hermanas}`;
    const nombre = this.candidatosCache()[claveCandidatos]?.find(c => c.id_publicador === idPublicador)?.nombre_completo ?? 'Esta persona';

    // Verificar conflicto unificado (entre semana, fin semana, logística y discursos)
    this.conflictosSvc
      .confirmarSiHayConflicto(
        idPublicador, fecha, cong, nombre,
        { tipo: 'logistica', id: asig.id_logistica },
      )
      .subscribe((proceder) => {
        if (proceder) {
          guardar();
        } else {
          // Revertir el select al publicador anterior
          this.mesDatos.update((d) => d ? { ...d } : d);
        }
      });
  }

  onToggleGrupo(fecha: FechaReunionOut, idGrupo: number, checked: boolean): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const current = (this.mesDatos()?.aseo ?? [])
      .filter((s) => s.fecha === fecha.fecha)
      .map((s) => s.grupo.id_grupo);
    const ids = checked
      ? [...new Set([...current, idGrupo])]
      : current.filter((id) => id !== idGrupo);

    this.logisticaSvc
      .editarAseo({ fecha: fecha.fecha, tipo_reunion: fecha.tipo_reunion, ids_grupo: ids }, cong)
      .subscribe({
        next: (updated: LogisticaAseoOut[]) => {
          this.mesDatos.update((d) => {
            if (!d) return d;
            const sinEstaFecha = d.aseo.filter((s) => s.fecha !== fecha.fecha);
            return { ...d, aseo: [...sinEstaFecha, ...updated] };
          });
        },
        error: (err) => {
          this.errorMsg.set(err?.error?.detail ?? 'Error al actualizar aseo');
          this.estado.set('error');
        },
      });
  }

  // ── PDF ───────────────────────────────────────────────────────

  descargarPdf(): void {
    const datos = this.mesDatos();
    if (!datos) return;
    this.descargarPdfMes({ ano: datos.ano, mes: datos.mes });
  }

  descargarPdfMes(m: MesDisponible): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.descargandoPdf.set(true);
    this.logisticaSvc.descargarPdf(m.ano, m.mes, cong).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logistica_${MESES_ES[m.mes - 1]}_${m.ano}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.descargandoPdf.set(false);
      },
      error: () => {
        this.descargandoPdf.set(false);
        this.errorMsg.set('Error al generar el PDF');
        this.estado.set('error');
      },
    });
  }
}

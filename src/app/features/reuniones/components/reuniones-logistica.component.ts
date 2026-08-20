import {
  Component, signal, computed, inject, OnInit, HostListener, DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LogisticaService } from '../services/logistica.service';
import { ConflictosService } from '../services/conflictos.service';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  AseoBloqueOut,
  AseoPreferenciaOpcion,
  AseoRotacion,
  FechaReunionOut,
  GrupoBase,
  ConflictoLogisticaItem,
  LogisticaAseoOut,
  LogisticaEstado,
  LogisticaItemOut,
  LogisticaMesOut,
  MesDisponible,
  MESES_ES,
  PERMISO_LABEL,
  PUESTO_A_PERMISO,
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
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 min-h-[1rem] truncate">Acomodadores · Vigilancia · Micrófono · Audio/Video</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
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

      <!-- ===== PUBLICADO banner ===== -->
      <!-- aria-live: publicar es la acción con más consecuencias de la pantalla
           y su único acuse es este cartel, que aparece lejos del botón. -->
      @if (confirmadoBanner()) {
        <div
          role="status" aria-live="polite"
          class="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p class="text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            Publicado. La congregación ya ve esta versión.
          </p>
        </div>
      }

      <!-- ===== CAMBIOS SIN PUBLICAR ===== -->
      <!-- Sin este aviso, editar un mes publicado no tendría ninguna señal de
           que lo visible sigue siendo lo anterior. -->
      @if (estadoMes() === 'cambios_sin_publicar') {
        <div class="shrink-0 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200/60 dark:border-violet-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          <p class="text-violet-700 dark:text-violet-300 text-xs">
            <span class="font-bold">Hay cambios sin publicar.</span>
            La congregación sigue viendo la versión anterior hasta que publiques.
          </p>
        </div>
      }

      <!-- ===== PUESTOS POR CUBRIR ===== -->
      <!-- El recuento por si solo obliga a repasar el mes entero a ojo. Cada
           chip lleva a su casilla y la resalta. -->
      @if (listaConflictos().length > 0 && mesDatos()) {
        <div class="shrink-0 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/60 px-4 py-3 mb-3">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
            <p class="text-red-700 dark:text-red-300 text-xs">
              <span class="font-bold">{{ conflictosLabel() }}</span>
              <span class="hidden sm:inline"> antes de publicar. Toca uno para ir a su casilla.</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            @for (c of listaConflictos(); track c.id_logistica) {
              <button
                type="button"
                (click)="irAConflicto(c)"
                class="inline-flex items-center gap-1.5 px-3 h-11 sm:h-8 rounded-full bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-[0.7rem] font-semibold transition-all hover:-translate-y-px hover:border-red-400 active:scale-95">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                {{ conflictoEtiqueta(c) }}
              </button>
            }
          </div>
        </div>
      }

      <!-- ===== LAYOUT principal ===== -->
      <div class="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-4 overflow-hidden">

        <!-- ── SIDEBAR ── -->
        <aside class="hidden md:flex md:w-60 lg:w-64 xl:w-72 2xl:w-80 shrink-0 flex-col gap-3 overflow-y-auto simple-scrollbar p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">

          <!-- Historial de meses -->
          @if (mesesDisponibles().length > 0) {
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between px-1 pb-0.5">
                <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Meses programados</p>
                <span class="min-w-[1.25rem] h-4 px-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-[0.6rem] font-black flex items-center justify-center">{{ mesesDisponibles().length }}</span>
              </div>
              <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <div class="flex flex-col gap-0.5 p-1.5">
                  @for (m of mesesDisponibles(); track m.ano + '-' + m.mes) {
                    <div class="flex items-center gap-1">
                      <button
                        (click)="cargarMes(m.ano, m.mes)"
                        [disabled]="estado() === 'loading'"
                        class="flex-1 flex items-center justify-between gap-2 px-2.5 h-10 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-40 group">
                        <span class="truncate">{{ mesLabel(m) }}</span>
                        <span class="flex items-center gap-1.5 shrink-0">
                          <!-- Punto de estado: forma distinta por estado además
                               del color, y el texto va en el title. -->
                          <span
                            class="w-1.5 h-1.5 rounded-full"
                            [class]="puntoEstadoClass(m)"
                            [title]="etiquetaEstadoMes(m)"></span>
                          <svg class="w-3 h-3 text-slate-400 group-hover:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                        </span>
                      </button>
                      <button
                        (click)="descargarPdfMes(m)"
                        [disabled]="descargandoPdf()"
                        title="Descargar PDF"
                        aria-label="Descargar PDF"
                        class="shrink-0 w-9 h-9 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-all active:scale-95 flex items-center justify-center disabled:opacity-40">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Generar nuevo mes -->
          @if (hasEditPermission()) {
            <div class="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 shrink-0">
            <button
              (click)="abrirModalGenerar()"
              [disabled]="estado() === 'loading'"
              class="w-full flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm shadow-purple-900/20 active:scale-95 shrink-0 mt-auto">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Generar Mes
            </button>
            </div>
          }
        </aside>

        <!-- ── PANEL PRINCIPAL ── -->
        <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative">

          @if (estado() === 'loading') {
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-10 rounded-2xl">
              <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-[#6D28D9] animate-spin"></div>
              <div class="text-center">
                <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Cargando logística...</p>
                <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 mt-0.5">Cargando asignaciones del mes</p>
              </div>
            </div>
          }

          @if (!mesDatos() && estado() !== 'loading') {
            <!-- Estado vacío -->
            <div class="flex-1 flex flex-col gap-4 p-4 md:items-center md:justify-center md:p-8 overflow-y-auto simple-scrollbar">

              <!-- Encabezado vacío — oculto en móvil cuando hay meses (la lista los muestra) -->
              <div class="flex flex-col items-center gap-3 text-center pt-4 md:pt-0"
                [class]="mesesDisponibles().length > 0 ? 'hidden md:flex' : 'flex'">
                <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <svg class="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Ninguna programación seleccionada</h3>
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
                @if (mesesDisponibles().length === 0 && hasEditPermission()) {
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
                        <span class="truncate">{{ mesLabel(m) }}</span>
                        <span class="flex items-center gap-2 shrink-0">
                          <!-- En móvil hay sitio para la etiqueta completa, no solo el punto. -->
                          <span
                            class="px-2 py-0.5 rounded-full text-[0.6rem] font-bold"
                            [class]="badgeEstadoMesClass(m)">
                            {{ etiquetaEstadoMes(m) }}
                          </span>
                          <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                        </span>
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
            <!-- Toolbar del mes cargado.
                 En móvil se apila: cuatro acciones y el título no caben en 390px
                 y se montaban unas sobre otras. -->
            <div class="shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-2 min-w-0">
                <!-- Volver — solo móvil -->
                <button
                  (click)="mesDatos.set(null); estado.set('idle')"
                  class="md:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors active:scale-[0.95]"
                  title="Volver"
                  aria-label="Volver">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <!-- En móvil el estado baja a una segunda línea: es demasiado
                     importante para esconderlo, y no cabe junto al mes. -->
                <div class="min-w-0 flex flex-col md:flex-row md:items-center gap-x-2">
                  <span class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {{ mesLabel({ ano: mesDatos()!.ano, mes: mesDatos()!.mes }) }}
                  </span>
                  <div class="flex items-center gap-2 min-w-0">
                    <!-- El texto siempre está: el color solo refuerza. -->
                    <span
                      class="shrink-0 px-2 py-0.5 rounded-full text-[0.6rem] font-bold"
                      [class]="estadoBadgeClass()">
                      {{ estadoLabel() }}
                    </span>
                    <!-- Cobertura — el dato que dice si el mes está listo -->
                    @if (coberturaLabel()) {
                      <span class="hidden mbp:inline shrink-0 text-[0.65rem] text-slate-400 dark:text-slate-500 data-num">
                        {{ coberturaLabel() }}
                      </span>
                    }
                  </div>
                </div>
              </div>
              <!-- Las secundarias pierden su etiqueta en móvil y quedan en icono
                   con aria-label; la primaria conserva el texto. -->
              <div class="flex items-center gap-1 shrink-0 overflow-x-auto simple-scrollbar md:overflow-visible">
                <!-- Acción primaria: publicar. Una sola cada vez. -->
                @if (puedePublicar()) {
                  <button
                    (click)="publicarMes()"
                    [disabled]="estado() === 'loading'"
                    [title]="conflictosLabel()
                      ? 'Faltan ' + conflictosLabel() + ' antes de poder publicar'
                      : 'Hacer visible este mes a la congregación'"
                    class="flex items-center gap-1.5 px-4 h-11 sm:px-3.5 sm:h-9 rounded-full bg-brand-purple text-white text-[0.65rem] font-bold shadow-sm transition-all hover:-translate-y-px active:scale-95 disabled:opacity-40">
                    <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    Publicar
                    @if (conflictosLabel()) {
                      <span class="px-1.5 rounded-full bg-white/25 text-[0.6rem] data-num">{{ mesDatos()!.conflictos }}</span>
                    }
                  </button>
                }
                <!-- Volver a lo publicado -->
                @if (puedeDescartar()) {
                  <button
                    (click)="descartarCambios()"
                    [disabled]="estado() === 'loading'"
                    title="Deshacer los cambios y volver a la versión que ve la congregación"
                    aria-label="Descartar cambios"
                    class="flex items-center justify-center gap-1 w-11 h-11 sm:w-auto sm:h-9 sm:px-3 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-[0.65rem] font-bold transition-all active:scale-95 disabled:opacity-40">
                    <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/></svg>
                    <span class="hidden sm:inline">Descartar</span>
                  </button>
                }
                <!-- Eliminar mes -->
                @if (hasEditPermission()) {
                  <button
                    (click)="eliminarMes()"
                    [disabled]="estado() === 'loading'"
                    title="Eliminar programación del mes"
                    aria-label="Eliminar programación del mes"
                    class="flex items-center justify-center gap-1 w-11 h-11 sm:w-auto sm:h-9 sm:px-3 rounded-full border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-[0.65rem] font-bold transition-all active:scale-95 disabled:opacity-40">
                    <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    <span class="hidden sm:inline">Borrar</span>
                  </button>
                }
                <!-- PDF — necesita que exista una versión publicada -->
                <button
                  (click)="descargarPdf()"
                  [disabled]="!tienePublicacion() || descargandoPdf()"
                  [title]="tienePublicacion()
                    ? 'Descargar PDF del mes'
                    : 'Publica el mes antes de descargar el PDF'"
                  aria-label="Descargar PDF del mes"
                  class="flex items-center justify-center gap-1 w-11 h-11 sm:w-auto sm:h-9 sm:px-3 rounded-full border text-[0.65rem] font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  [class]="tienePublicacion()
                    ? 'border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    : 'border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500'">
                  <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                  <span class="hidden sm:inline">PDF</span>
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
                              (click)="puedeEditar() && abrirCombobox(fecha.fecha, puesto)"
                              [attr.data-cell]="fecha.fecha + '::' + puesto"
                              [disabled]="!puedeEditar()"
                              class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-slate-800/40 transition-[transform,border-color] duration-150 ease-out active:scale-[0.98] enabled:hover:border-violet-300 dark:enabled:hover:border-violet-600 disabled:opacity-90"
                              [class]="esConflicto(fecha.fecha, puesto)
                                ? 'border-red-400 dark:border-red-500'
                                : 'border-slate-200 dark:border-slate-700'">
                              <span class="text-[0.65rem] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide shrink-0">{{ puestoLabel(puesto) }}</span>
                              @if (getAsignacion(fecha.fecha, puesto)?.publicador) {
                                <span class="text-xs font-medium text-slate-800 dark:text-slate-100 truncate text-right">{{ getAsignacion(fecha.fecha, puesto)!.publicador!.nombre_completo }}</span>
                              } @else {
                                <span
                                  class="text-xs truncate"
                                  [class]="esConflicto(fecha.fecha, puesto)
                                    ? 'text-red-500 dark:text-red-400 font-semibold'
                                    : 'text-slate-400 dark:text-slate-500 italic'">
                                  {{ textoCasillaVacia(fecha.fecha, puesto) }}
                                </span>
                              }
                            </button>
                          }
                        </div>
                      </div>
                    }
                    <!-- Aseo -->
                    @if (bloqueDeFecha(fecha.fecha); as bloque) {
                    <div class="px-4 py-3">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="w-1.5 h-1.5 rounded-full shrink-0" [style.background]="seccionHeaderColor('Aseo')"></span>
                        <span class="text-[0.6rem] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Aseo del salón</span>
                      </div>
                      @if (alcanceBloque(bloque)) {
                        <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 mb-2">{{ alcanceBloque(bloque) }}</p>
                      }
                      @if (puedeEditar()) {
                        <div class="flex flex-wrap gap-1.5">
                          @for (g of gruposDisponibles(); track g.id_grupo) {
                            <button
                              type="button"
                              (click)="onToggleGrupo(bloque, g.id_grupo, !isGrupoAsignado(bloque, g.id_grupo))"
                              [class]="isGrupoAsignado(bloque, g.id_grupo)
                                ? 'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.7rem] font-bold bg-[#059669] text-white shadow-sm transition-[transform,background-color] duration-150 ease-out active:scale-[0.97]'
                                : 'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.7rem] font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-500 transition-[transform,border-color,color] duration-150 ease-out active:scale-[0.97]'">
                              @if (isGrupoAsignado(bloque, g.id_grupo)) {
                                <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              }
                              {{ g.nombre_grupo }}
                            </button>
                          }
                        </div>
                      } @else {
                        @if (gruposAsignadosBloque(bloque).length > 0) {
                          <div class="flex flex-wrap gap-1.5">
                            @for (g of gruposAsignadosBloque(bloque); track g) {
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
                    }
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
                                @if (puedeEditar()) {
                                  <!-- Buscador de publicador — ancho de la celda, dropdown flotante -->
                                  <div class="relative w-full min-w-[120px]" [attr.data-cell]="fecha.fecha + '::' + puesto">

                                    <!-- Trigger + input en el mismo espacio (sin salto de tamaño) -->
                                    <div class="flex items-center w-full rounded-lg border bg-white dark:bg-slate-800 overflow-hidden transition-colors"
                                         [class]="activeCellKey() === (fecha.fecha + '::' + puesto)
                                           ? 'border-violet-400 dark:border-violet-500 ring-1 ring-violet-300 dark:ring-violet-700'
                                           : esConflicto(fecha.fecha, puesto)
                                             ? 'border-red-400 dark:border-red-500 ring-1 ring-red-200 dark:ring-red-800/60'
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
                                            <span
                                              class="flex-1 text-xs italic truncate"
                                              [class]="esConflicto(fecha.fecha, puesto)
                                                ? 'text-red-500 dark:text-red-400 font-semibold not-italic'
                                                : 'text-slate-400'">
                                              {{ textoCasillaVacia(fecha.fecha, puesto) }}
                                            </span>
                                          }
                                          <!-- Ícono lápiz al hover -->
                                          <svg class="w-3 h-3 shrink-0 text-slate-500 hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                                        </button>
                                        <!-- Botón quitar (solo si hay asignado) -->
                                        @if (getAsignacion(fecha.fecha, puesto)?.publicador) {
                                          <button
                                            type="button"
                                            (click)="onCambiarPublicador(fecha.fecha, puesto, null)"
                                            title="Quitar asignación"
                                            class="shrink-0 px-1.5 py-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none">
                                            ×
                                          </button>
                                        }
                                      }
                                    </div>

                                    <!-- Dropdown flotante — no afecta el layout -->
                                    @if (activeCellKey() === (fecha.fecha + '::' + puesto)) {
                                      <div
                                        data-dropdown
                                        class="absolute z-50 left-0 w-72 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl simple-scrollbar"
                                        [class]="dropdownArriba()
                                          ? 'bottom-[calc(100%+4px)]'
                                          : 'top-[calc(100%+4px)]'">

                                        @if (getAsignacion(fecha.fecha, puesto)?.publicador) {
                                          <button
                                            type="button"
                                            (mousedown)="$event.preventDefault(); seleccionarCandidato(fecha.fecha, puesto, null)"
                                            class="w-full text-left text-xs px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800">
                                            <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                            Quitar asignación
                                          </button>
                                        }

                                        <!-- Quienes tienen el permiso del puesto. Se ven de
                                             entrada: obligar a escribir un nombre para
                                             descubrirlos escondía la respuesta. -->
                                        @if (getCandidatosFiltrados(puesto).length > 0) {
                                          <p class="text-[0.55rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-2.5 pb-1">
                                            Habilitados para {{ puestoLabel(puesto) }}
                                          </p>
                                          @for (c of getCandidatosFiltrados(puesto); track c.id_publicador) {
                                            <button
                                              type="button"
                                              (mousedown)="$event.preventDefault(); seleccionarCandidato(fecha.fecha, puesto, c.id_publicador)"
                                              [class]="'w-full text-left text-xs px-3 py-2 transition-colors ' + (getAsignacion(fecha.fecha, puesto)?.publicador?.id_publicador === c.id_publicador ? 'bg-violet-50 dark:bg-violet-900/20 font-semibold text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800')">
                                              {{ c.nombre_completo }}
                                            </button>
                                          }
                                        } @else if (sinHabilitados(puesto)) {
                                          <p class="text-[0.65rem] text-slate-400 px-3 py-3 text-center leading-relaxed">
                                            Nadie tiene el permiso de {{ puestoLabel(puesto) }}.<br>
                                            Actívalo en Configuración o busca abajo.
                                          </p>
                                        } @else {
                                          <p class="text-[0.65rem] text-slate-400 px-3 py-2.5 italic text-center">
                                            Ningún habilitado coincide
                                          </p>
                                        }

                                        <!-- Los puestos de varones pueden abrirse a hermanas
                                             puntualmente; el motor nunca lo hace solo. -->
                                        @if (esPuestoSoloVarones(puesto)) {
                                          <label
                                            class="flex items-center gap-2 px-3 py-2 border-t border-slate-100 dark:border-slate-800 cursor-pointer text-[0.65rem] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                                            (mousedown)="$event.preventDefault()">
                                            <input
                                              type="checkbox"
                                              class="w-3.5 h-3.5 accent-violet-600"
                                              [checked]="hermanasPorPuesto()[puesto] ?? false"
                                              (change)="toggleHermanas(puesto, $any($event.target).checked)" />
                                            Incluir hermanas
                                          </label>
                                        }

                                        <!-- Búsqueda libre: permite asignar a alguien sin el
                                             permiso, dejando claro que va aparte. -->
                                        @if (cellSearch().trim().length > 0) {
                                          @if (buscandoPublicador()) {
                                            <p class="text-[0.65rem] text-slate-400 px-3 py-2.5 italic text-center border-t border-slate-100 dark:border-slate-800">Buscando...</p>
                                          } @else if (otrosPublicadores(puesto).length > 0) {
                                            <p class="text-[0.55rem] font-black uppercase tracking-wider text-amber-600/90 dark:text-amber-500/90 px-3 pt-2.5 pb-1 border-t border-slate-100 dark:border-slate-800">
                                              Sin el permiso de {{ permisoLabel(puesto) }}
                                            </p>
                                            @for (c of otrosPublicadores(puesto); track c.id_publicador) {
                                              <!-- Dos acciones por fila: el nombre asigna solo hoy;
                                                   el boton ademas deja el permiso configurado. No se
                                                   repite el aviso: ya lo dice el encabezado. -->
                                              <div class="flex items-center gap-1 px-1.5">
                                                <button
                                                  type="button"
                                                  (mousedown)="$event.preventDefault(); seleccionarCandidato(fecha.fecha, puesto, c.id_publicador)"
                                                  class="flex-1 min-w-0 text-left text-xs px-1.5 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors truncate">
                                                  {{ c.nombre_completo }}
                                                </button>
                                                @if (puedeGestionarPermisos() && permisoDePuesto(puesto)) {
                                                  <button
                                                    type="button"
                                                    (mousedown)="$event.preventDefault(); otorgarPermisoYAsignar(fecha.fecha, puesto, c.id_publicador, c.nombre_completo)"
                                                    [disabled]="esOtorgando(c.id_publicador)"
                                                    [attr.aria-label]="'Dar el permiso de ' + permisoLabel(puesto) + ' a ' + c.nombre_completo"
                                                    class="shrink-0 flex items-center gap-1 pl-1.5 pr-2 h-7 rounded-lg border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-[0.6rem] font-bold hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all active:scale-95 disabled:opacity-40">
                                                    @if (esOtorgando(c.id_publicador)) {
                                                      <div class="w-3 h-3 rounded-full border-2 border-violet-200 border-t-violet-500 animate-spin"></div>
                                                    } @else {
                                                      <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                                                      Dar permiso
                                                    }
                                                  </button>
                                                }
                                              </div>
                                            }
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
                        <th class="px-2 lg:px-3 py-2 text-left font-bold whitespace-nowrap w-20">{{ aseoCabeceras()[0] }}</th>
                        <th class="px-3 py-2 text-left font-bold whitespace-nowrap hidden lg:table-cell w-24">{{ aseoCabeceras()[1] }}</th>
                        <th class="px-2 lg:px-3 py-2 text-left font-bold">Grupo asignado</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (bloque of aseoBloques(); track bloque.clave; let i = $index) {
                        <tr [style.background]="i % 2 === 0 ? '' : seccionRowAltColor('Aseo')" [class]="i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'dark:bg-slate-800/40'">
                          <td class="px-2 lg:px-3 py-1.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{{ bloque.etiqueta }}</td>
                          <td class="px-3 py-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400 hidden lg:table-cell">{{ bloque.detalle }}</td>
                          <td class="px-2 py-1.5">
                            @if (puedeEditar()) {
                              <!-- Chips de grupos: seleccionado = violeta sólido, no seleccionado = outline gris -->
                              <div class="flex flex-wrap gap-1.5">
                                @for (g of gruposDisponibles(); track g.id_grupo) {
                                  <button
                                    type="button"
                                    (click)="onToggleGrupo(bloque, g.id_grupo, !isGrupoAsignado(bloque, g.id_grupo))"
                                    [class]="isGrupoAsignado(bloque, g.id_grupo)
                                      ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-bold bg-[#059669] text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30 transition-all active:scale-95'
                                      : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-medium border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400 transition-all active:scale-95'">
                                    @if (isGrupoAsignado(bloque, g.id_grupo)) {
                                      <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    }
                                    {{ g.nombre_grupo }}
                                  </button>
                                }
                              </div>
                            } @else {
                              <!-- Vista solo lectura: badge del grupo seleccionado -->
                              @if (getAseoLabel(bloque) !== '—') {
                                <div class="flex flex-wrap gap-1.5">
                                  @for (g of gruposAsignadosBloque(bloque); track g) {
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
            <div
              class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              [class]="confirmPendiente()!.tono === 'accion'
                ? 'bg-violet-100 dark:bg-violet-900/30'
                : 'bg-red-100 dark:bg-red-900/30'">
              @if (confirmPendiente()!.tono === 'accion') {
                <svg class="w-4 h-4 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              } @else {
                <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
              }
            </div>
            <div>
              <p class="text-sm font-bold text-slate-900 dark:text-white">{{ confirmPendiente()!.titulo }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ confirmPendiente()!.mensaje }}</p>
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <button (click)="cancelarConfirm()"
              class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              Cancelar
            </button>
            <button (click)="aceptarConfirm()"
              class="px-4 h-9 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
              [class]="confirmPendiente()!.tono === 'accion'
                ? 'bg-violet-600 hover:bg-violet-700'
                : 'bg-red-600 hover:bg-red-700'">
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

          <!-- Rotación del aseo: cada congregación lo lleva a su manera -->
          @if (rotacionOpciones().length > 0) {
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rotación del aseo</label>
              <div class="flex flex-col gap-1.5">
                @for (op of rotacionOpciones(); track op.id) {
                  <button
                    type="button"
                    (click)="modalRotacionAseo.set(op.id)"
                    [class]="modalRotacionAseo() === op.id
                      ? 'w-full text-left px-3 py-2 rounded-xl border-2 border-[#059669] bg-emerald-50 dark:bg-emerald-900/20 transition-all'
                      : 'w-full text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all'">
                    <span class="flex items-center gap-2">
                      <span
                        [class]="modalRotacionAseo() === op.id
                          ? 'w-3.5 h-3.5 rounded-full border-[4px] border-[#059669] shrink-0'
                          : 'w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0'"></span>
                      <span class="text-xs font-bold text-slate-700 dark:text-slate-200">{{ op.label }}</span>
                    </span>
                    <span class="block pl-[1.375rem] text-[0.65rem] leading-snug text-slate-500 dark:text-slate-400 mt-0.5">{{ op.description }}</span>
                  </button>
                }
              </div>
            </div>
          }

          <div class="flex gap-2 justify-end pt-1">
            <button (click)="cerrarModal()" class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
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
    @if (activeCellKey() && puedeEditar()) {
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
            <!-- Mismo orden que en escritorio: primero los habilitados. -->
            @if (getCandidatosFiltrados(activeCellPuesto()).length > 0) {
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-2 pb-1">
                Habilitados para {{ activeCellPuestoLabel() }}
              </p>
              @for (c of getCandidatosFiltrados(activeCellPuesto()); track c.id_publicador) {
                <button
                  type="button"
                  (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(c.id_publicador)"
                  [class]="'w-full text-left text-sm px-3 py-3 rounded-xl transition-colors ' + (activeCellAsignacion()?.publicador?.id_publicador === c.id_publicador ? 'bg-violet-50 dark:bg-violet-900/20 font-semibold text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800')">
                  {{ c.nombre_completo }}
                </button>
              }
            } @else if (sinHabilitados(activeCellPuesto())) {
              <p class="text-xs text-slate-400 px-3 py-5 text-center leading-relaxed">
                Nadie tiene el permiso de {{ activeCellPuestoLabel() }}.<br>
                Actívalo en Configuración o busca arriba.
              </p>
            } @else {
              <p class="text-xs text-slate-400 px-3 py-4 italic text-center">Ningún habilitado coincide</p>
            }

            @if (esPuestoSoloVarones(activeCellPuesto())) {
              <label
                class="flex items-center gap-2.5 px-3 min-h-[44px] mt-1 border-t border-slate-100 dark:border-slate-800 cursor-pointer text-xs text-slate-500 dark:text-slate-400"
                (mousedown)="$event.preventDefault()">
                <input
                  type="checkbox"
                  class="w-4 h-4 accent-violet-600"
                  [checked]="hermanasPorPuesto()[activeCellPuesto()] ?? false"
                  (change)="toggleHermanas(activeCellPuesto(), $any($event.target).checked)" />
                Incluir hermanas
              </label>
            }

            @if (cellSearch().trim().length > 0) {
              @if (buscandoPublicador()) {
                <p class="text-xs text-slate-400 px-3 py-4 italic text-center border-t border-slate-100 dark:border-slate-800">Buscando...</p>
              } @else if (otrosPublicadores(activeCellPuesto()).length > 0) {
                <p class="text-[0.6rem] font-black uppercase tracking-wider text-amber-600/90 dark:text-amber-500/90 px-3 pt-3 pb-1 border-t border-slate-100 dark:border-slate-800">
                  Sin el permiso de {{ permisoLabel(activeCellPuesto()) }}
                </p>
                @for (c of otrosPublicadores(activeCellPuesto()); track c.id_publicador) {
                  <div class="flex items-center gap-2 px-1">
                    <button
                      type="button"
                      (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(c.id_publicador)"
                      class="flex-1 min-w-0 text-left text-sm px-2 min-h-[44px] rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors truncate">
                      {{ c.nombre_completo }}
                    </button>
                    @if (puedeGestionarPermisos() && permisoDePuesto(activeCellPuesto())) {
                      <button
                        type="button"
                        (mousedown)="$event.preventDefault(); otorgarPermisoYAsignarActiva(c.id_publicador, c.nombre_completo)"
                        [disabled]="esOtorgando(c.id_publicador)"
                        [attr.aria-label]="'Dar el permiso de ' + permisoLabel(activeCellPuesto()) + ' a ' + c.nombre_completo"
                        class="shrink-0 flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-[0.7rem] font-bold hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all active:scale-95 disabled:opacity-40">
                        @if (esOtorgando(c.id_publicador)) {
                          <div class="w-3.5 h-3.5 rounded-full border-2 border-violet-200 border-t-violet-500 animate-spin"></div>
                        } @else {
                          <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                          Dar permiso
                        }
                      </button>
                    }
                  </div>
                }
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
  // Solo para activar un permiso desde el desplegable; la matriz completa vive
  // en Configuracion y comparte este mismo endpoint.
  private reunionesSvc = inject(ReunionesService);
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
  /** El desplegable se voltea hacia arriba cuando abajo lo recortaría la tabla. */
  dropdownArriba = signal(false);
  cellSearch = signal<string>('');
  hermanasPorPuesto = signal<Record<string, boolean>>({});

  // Modal de confirmación (reemplaza window.confirm)
  // `tono` separa lo destructivo (borrar un mes) de lo constructivo (dar un
  // permiso). Sin esto, conceder un permiso salia con la estetica de alerta roja.
  confirmPendiente = signal<{
    titulo: string;
    mensaje: string;
    accionLabel: string;
    tono?: 'peligro' | 'accion';
    callback: () => void;
  } | null>(null);

  // Modal generar
  modalGenerarAbierto = signal(false);
  modalMes = new Date().getMonth() + 1;
  modalAno = new Date().getFullYear();
  // Rotación del aseo: se precarga con la preferencia de la congregación y al
  // generar queda guardada como la nueva preferencia.
  modalRotacionAseo = signal<AseoRotacion>('reunion');
  rotacionOpciones = signal<AseoPreferenciaOpcion[]>([]);

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
    return this.authStore.hasPermission('reuniones.logistica');
  }

  // ── Ciclo de vida del mes ──────────────────────────────────
  // Un mes publicado sigue siendo editable: corregir un nombre ya no obliga a
  // borrar y regenerar el mes. Editarlo lo deja en 'cambios sin publicar' y la
  // versión visible sigue siendo la anterior hasta volver a publicar.

  estadoMes = computed<LogisticaEstado>(() => this.mesDatos()?.estado ?? 'sin_generar');

  /** Editar depende del permiso, no del estado. */
  puedeEditar = computed(() => !!this.mesDatos() && this.hasEditPermission());

  /** Hay algo nuevo que publicar (nunca publicado, o publicado y luego editado). */
  puedePublicar = computed(() => {
    const e = this.estadoMes();
    return this.hasEditPermission()
      && (e === 'borrador' || e === 'pendiente_revision' || e === 'cambios_sin_publicar');
  });

  /** Existe una versión publicada: el PDF tiene sentido y se puede descartar. */
  tienePublicacion = computed(() => {
    const e = this.estadoMes();
    return e === 'publicado' || e === 'cambios_sin_publicar';
  });

  puedeDescartar = computed(
    () => this.hasEditPermission() && !!this.mesDatos()?.puede_descartar,
  );

  estadoLabel = computed(() => {
    switch (this.estadoMes()) {
      case 'publicado':            return 'Publicado';
      case 'cambios_sin_publicar': return 'Cambios sin publicar';
      case 'pendiente_revision':   return 'Pendiente por revisar';
      case 'borrador':             return 'Borrador';
      default:                     return 'Sin generar';
    }
  });

  /**
   * El estado nunca se comunica solo por color: la píldora siempre lleva su
   * texto, y estos tonos son el refuerzo, no la información.
   */
  estadoBadgeClass = computed(() => {
    switch (this.estadoMes()) {
      case 'publicado':
        return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
      case 'cambios_sin_publicar':
        return 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300';
      case 'pendiente_revision':
        return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
      default:
        return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
    }
  });

  /** "78 de 81 puestos cubiertos" — vacío si el mes no tiene puestos. */
  coberturaLabel = computed(() => {
    const d = this.mesDatos();
    if (!d || !d.cobertura_total) return '';
    return `${d.cobertura_cubierta} de ${d.cobertura_total} puestos cubiertos`;
  });

  conflictosLabel = computed(() => {
    const n = this.mesDatos()?.conflictos ?? 0;
    if (!n) return '';
    return n === 1 ? '1 puesto por cubrir' : `${n} puestos por cubrir`;
  });

  // ── Conflictos: dónde están, no sólo cuántos ───────────────
  // Decir "quedan 3 puestos sin asignar" sin señalarlos obliga a repasar el mes
  // entero a ojo. Se marcan en la tabla y se listan para saltar a cada uno.

  listaConflictos = computed<ConflictoLogisticaItem[]>(
    () => this.mesDatos()?.conflictos_detalle ?? [],
  );

  private conflictoIds = computed(
    () => new Set(this.listaConflictos().map((c) => c.id_logistica)),
  );

  /** ¿Esta casilla está vacía teniendo a alguien que podría cubrirla? */
  esConflicto(fecha: string, puesto: string): boolean {
    const a = this.getAsignacion(fecha, puesto);
    return !!a && this.conflictoIds().has(a.id_logistica);
  }

  /**
   * Un vacío que nadie puede cubrir no es un error, es la configuración de la
   * congregación: se distingue en el texto para no mandar a buscar a nadie.
   */
  textoCasillaVacia(fecha: string, puesto: string): string {
    return this.esConflicto(fecha, puesto) ? 'Falta asignar' : 'Sin asignar';
  }

  conflictoEtiqueta(c: ConflictoLogisticaItem): string {
    return `${this.formatFecha(c.fecha)} · ${this.puestoLabel(c.puesto)}`;
  }

  /** Lleva la vista hasta la casilla y la resalta un instante. */
  irAConflicto(c: ConflictoLogisticaItem): void {
    const sel = `[data-cell="${c.fecha}::${c.puesto}"]`;
    // Hay dos maquetas simultáneas (tarjetas en móvil, tabla en escritorio) y
    // sólo una es visible: se busca la que realmente ocupa espacio.
    const celda = Array.from(document.querySelectorAll<HTMLElement>(sel))
      .find((el) => el.offsetParent !== null);
    if (!celda) return;
    celda.scrollIntoView({ behavior: 'smooth', block: 'center' });
    celda.classList.remove('highlight-flash');
    // Reinicia la animación si se pulsa dos veces el mismo conflicto.
    void celda.offsetWidth;
    celda.classList.add('highlight-flash');
  }

  /** Estado de un mes de la lista lateral (el detalle aún no está cargado). */
  etiquetaEstadoMes(m: MesDisponible): string {
    switch (m.estado) {
      case 'publicado':            return 'Publicado';
      case 'cambios_sin_publicar': return 'Cambios sin publicar';
      case 'pendiente_revision':   return 'Pendiente por revisar';
      default:                     return 'Borrador';
    }
  }

  /** Punto de estado del sidebar de escritorio, donde no cabe la etiqueta. */
  puntoEstadoClass(m: MesDisponible): string {
    switch (m.estado) {
      case 'publicado':            return 'bg-emerald-500';
      case 'cambios_sin_publicar': return 'bg-violet-500';
      case 'pendiente_revision':   return 'bg-red-500';
      default:                     return 'bg-amber-400';
    }
  }

  /** Píldora del listado móvil, donde sí cabe el texto. */
  badgeEstadoMesClass(m: MesDisponible): string {
    switch (m.estado) {
      case 'publicado':
        return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
      case 'cambios_sin_publicar':
        return 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300';
      case 'pendiente_revision':
        return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
      default:
        return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
    }
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
    this.cargarConfiguracionAseo();
  }

  private cargarConfiguracionAseo(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.logisticaSvc
      .getConfiguracionAseo(cong)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cfg) => {
          const pref = cfg.preferencias.find((p) => p.key === 'log_aseo_rotacion');
          if (!pref) return;
          this.rotacionOpciones.set(pref.options);
          this.modalRotacionAseo.set(pref.value);
        },
        // Si falla, el modal sigue usable: se genera con la preferencia guardada.
        error: () => this.rotacionOpciones.set([]),
      });
  }

  cerrarModal(): void {
    this.modalGenerarAbierto.set(false);
  }

  generarMes(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const modo = this.modalRotacionAseo();
    this.cerrarModal();
    this.estado.set('loading');
    this.logisticaSvc
      .generar({ ano: this.modalAno, mes: this.modalMes, modo_aseo: modo }, cong)
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

  publicarMes(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const datos = this.mesDatos();
    if (!datos) return;
    this.estado.set('loading');
    this.logisticaSvc
      .publicar({ ano: datos.ano, mes: datos.mes }, cong)
      .subscribe({
        next: (updated) => {
          this.mesDatos.set(updated);
          this.estado.set('ready');
          this.confirmadoBanner.set(true);
          setTimeout(() => this.confirmadoBanner.set(false), 4000);
          this.cargarMeses(cong);
        },
        error: (err) => {
          // 409 = quedan huecos que alguien podría cubrir. El backend ya
          // explica cuántos; se muestra tal cual en vez de un texto genérico.
          this.errorMsg.set(err?.error?.detail ?? 'Error al publicar');
          this.estado.set('error');
        },
      });
  }

  descartarCambios(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const datos = this.mesDatos();
    if (!datos) return;
    const mesNombre = MESES_ES[datos.mes - 1] ?? `${datos.mes}`;
    this.confirmPendiente.set({
      titulo: `Descartar cambios de ${mesNombre} ${datos.ano}`,
      mensaje:
        'Se perderán las ediciones hechas desde la última publicación y el mes '
        + 'volverá exactamente a la versión que ve la congregación.',
      accionLabel: 'Descartar',
      callback: () => {
        this.estado.set('loading');
        this.logisticaSvc.descartarCambios({ ano: datos.ano, mes: datos.mes }, cong).subscribe({
          next: (updated) => {
            this.mesDatos.set(updated);
            this.estado.set('ready');
            this.cargarMeses(cong);
          },
          error: (err) => {
            this.errorMsg.set(err?.error?.detail ?? 'Error al descartar los cambios');
            this.estado.set('error');
          },
        });
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

  /**
   * Publicadores que la búsqueda libre encontró y que NO están habilitados para
   * el puesto. Se ofrecen aparte para poder asignar a alguien puntualmente sin
   * confundirlos con quienes tienen el permiso.
   */
  otrosPublicadores(puesto: string): PublicadorBase[] {
    const habilitados = new Set(
      (this.candidatosCache()[`${puesto}::${this.hermanasPorPuesto()[puesto] ?? false}`] ?? [])
        .map((c) => c.id_publicador),
    );
    return this.resultadosBusqueda().filter((c) => !habilitados.has(c.id_publicador));
  }

  // ── Asignar a alguien sin el permiso del puesto ────────────
  // Se permite a proposito: el motor automatico si respeta el permiso, pero una
  // asignacion manual puntual no deberia quedar bloqueada. Lo que si hace falta
  // es que se vea, y poder arreglar la configuracion sin salir de la pantalla.

  /** Activar un permiso es cosa de Configuracion, no de Logistica. */
  puedeGestionarPermisos = computed(
    () => this.authStore.hasPermission('reuniones.configuracion'),
  );

  /** Permiso que habilita este puesto ('acomodador_1' -> 'acomodador'). */
  permisoDePuesto(puesto: string): string {
    return PUESTO_A_PERMISO[puesto] ?? '';
  }

  permisoLabel(puesto: string): string {
    const permiso = this.permisoDePuesto(puesto);
    return PERMISO_LABEL[permiso] ?? this.puestoLabel(puesto);
  }

  /** Publicadores a los que se les acaba de conceder el permiso en esta sesion. */
  otorgandoPermiso = signal<Set<number>>(new Set());

  esOtorgando(idPublicador: number): boolean {
    return this.otorgandoPermiso().has(idPublicador);
  }

  /**
   * Concede el permiso del puesto y, acto seguido, asigna a la persona.
   *
   * Es una sola accion para quien la usa: sin modal, sin ir a Configuracion y
   * volver. Si la concesion falla no se asigna nada — dejarla asignada haria
   * creer que el permiso quedo guardado cuando no fue asi.
   */
  otorgarPermisoYAsignar(
    fecha: string, puesto: string, idPublicador: number, nombre: string,
  ): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const permiso = this.permisoDePuesto(puesto);
    if (!cong || !permiso || this.esOtorgando(idPublicador)) return;

    const etiqueta = this.permisoLabel(puesto);

    // Se confirma porque el efecto sobrevive a esta pantalla: cambia la
    // configuracion de la congregacion, no solo la casilla de hoy.
    this.confirmPendiente.set({
      titulo: `Dar el permiso de ${etiqueta}`,
      mensaje:
        `${nombre} quedará habilitado para ${etiqueta} de aquí en adelante, `
        + 'no solo en esta fecha. Se guarda en Configuración y también quedará '
        + 'asignado ahora.',
      accionLabel: 'Dar permiso y asignar',
      tono: 'accion',
      callback: () => this._ejecutarOtorgar(fecha, puesto, idPublicador, nombre, cong, permiso),
    });
  }

  private _ejecutarOtorgar(
    fecha: string, puesto: string, idPublicador: number,
    nombre: string, cong: number, permiso: string,
  ): void {
    this.otorgandoPermiso.update((s) => new Set(s).add(idPublicador));

    const soltar = () => this.otorgandoPermiso.update((s) => {
      const n = new Set(s); n.delete(idPublicador); return n;
    });

    this.reunionesSvc.updateMatrizConfiguracion({
      id_congregacion: cong,
      cambios: [{ id_publicador: idPublicador, permisos: { [permiso]: true } }],
    }).subscribe({
      next: () => {
        // La cache de habilitados quedo obsoleta: se recarga para que al
        // reabrir el desplegable esta persona ya salga arriba.
        this.invalidarCandidatos(puesto);
        soltar();
        // El nombre viaja explicito: al cerrarse el modal se limpia la busqueda
        // libre, y sin el el aviso de conflicto diria "Esta persona".
        this.onCambiarPublicador(fecha, puesto, idPublicador, nombre);
      },
      error: (err) => {
        soltar();
        this.errorMsg.set(
          err?.error?.detail ?? 'No se pudo dar el permiso. La asignación no se guardó.',
        );
        this.estado.set('error');
      },
    });
  }

  /** Recarga los habilitados de un puesto tras cambiar sus permisos. */
  private invalidarCandidatos(puesto: string): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const hermanas = this.hermanasPorPuesto()[puesto] ?? false;
    const clave = `${puesto}::${hermanas}`;
    this.logisticaSvc.getCandidatos(puesto, cong, hermanas).subscribe({
      next: (candidates) => {
        this.candidatosCache.update((c) => ({ ...c, [clave]: candidates }));
      },
      error: () => {},
    });
  }

  /** Puesto de la casilla abierta, para el sheet móvil. */
  activeCellPuesto(): string {
    return this.parseActiveCell()?.puesto ?? '';
  }

  /** ¿Hay alguien con el permiso de este puesto en la congregación? */
  sinHabilitados(puesto: string): boolean {
    const clave = `${puesto}::${this.hermanasPorPuesto()[puesto] ?? false}`;
    return (this.candidatosCache()[clave] ?? []).length === 0;
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
    this.dropdownArriba.set(false);
    this.ajustarDireccionDropdown(fecha, puesto);
  }

  /**
   * Decide si el desplegable se abre hacia abajo o hacia arriba.
   *
   * La tabla vive dentro de un contenedor con overflow para poder desplazarse en
   * horizontal, y eso recorta también en vertical: en las últimas filas la lista
   * de candidatos quedaba cortada y parecía que no había ninguno. Se mide el
   * desplegable ya renderizado en vez de estimar su alto, que depende de cuántos
   * habilitados haya.
   */
  private ajustarDireccionDropdown(fecha: string, puesto: string, intentos = 5): void {
    requestAnimationFrame(() => {
      // Hay dos maquetas en el DOM (tarjetas y tabla): sólo interesa la visible.
      const celda = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-cell="${fecha}::${puesto}"]`),
      ).find((el) => el.offsetParent !== null);
      const menu = celda?.querySelector<HTMLElement>('[data-dropdown]');
      const contenedor = celda?.closest<HTMLElement>('.overflow-x-auto');
      if (!menu || !contenedor) {
        // La detección de cambios de Angular puede pintar el desplegable después
        // de este frame; se reintenta unos pocos en vez de rendirse en el primero.
        if (intentos > 0) this.ajustarDireccionDropdown(fecha, puesto, intentos - 1);
        return;
      }
      // Se mide una sola vez por apertura: volver a medir ya volteado invertiría
      // el resultado y el menú oscilaría.
      this.dropdownArriba.set(
        menu.getBoundingClientRect().bottom > contenedor.getBoundingClientRect().bottom,
      );
    });
  }

  cerrarCombobox(): void {
    this.activeCellKey.set(null);
    this.cellSearch.set('');
    this.resultadosBusqueda.set([]);
    this.buscandoPublicador.set(false);
    this.dropdownArriba.set(false);
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

  /** Version para el sheet movil, que solo conoce la casilla activa. */
  otorgarPermisoYAsignarActiva(idPublicador: number, nombre: string): void {
    const p = this.parseActiveCell();
    if (!p) return;
    this.otorgarPermisoYAsignar(p.fecha, p.puesto, idPublicador, nombre);
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

  // ── Aseo por bloques ──────────────────────────────────────────
  // Un bloque es una reunión, una semana o el mes entero, según cómo rote la
  // congregación. El backend ya los arma; aquí solo se leen.

  aseoBloques(): AseoBloqueOut[] {
    return this.mesDatos()?.aseo_bloques ?? [];
  }

  aseoModo(): AseoRotacion {
    return this.mesDatos()?.aseo_modo ?? 'reunion';
  }

  /** Cabeceras de las dos primeras columnas de la tabla de aseo. */
  aseoCabeceras(): [string, string] {
    switch (this.aseoModo()) {
      case 'mes':    return ['Mes', 'Fechas'];
      case 'semana': return ['Semana', 'Fechas'];
      default:       return ['Fecha', 'Día'];
    }
  }

  isGrupoAsignado(bloque: AseoBloqueOut, idGrupo: number): boolean {
    return bloque.grupos.some((g) => g.id_grupo === idGrupo);
  }

  getAseoLabel(bloque: AseoBloqueOut): string {
    return bloque.grupos.map((g) => g.nombre_grupo).join(', ') || '—';
  }

  gruposAsignadosBloque(bloque: AseoBloqueOut): string[] {
    return bloque.grupos.map((g) => g.nombre_grupo);
  }

  /** Bloque al que pertenece una fecha (la vista móvil va tarjeta por fecha). */
  bloqueDeFecha(fecha: string): AseoBloqueOut | null {
    return this.aseoBloques().find((b) => b.fechas.some((f) => f.fecha === fecha)) ?? null;
  }

  /**
   * Aviso para la tarjeta móvil: en rotación semanal o mensual el grupo cubre
   * más de una reunión, y conviene que se vea antes de tocarlo.
   */
  alcanceBloque(bloque: AseoBloqueOut | null): string {
    if (!bloque || this.aseoModo() === 'reunion' || bloque.fechas.length < 2) return '';
    return `${bloque.etiqueta} · ${bloque.detalle}`;
  }

  formatFecha(fechaStr: string): string {
    const d = new Date(fechaStr + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')} ${MESES_ES[d.getMonth()]}`;
  }

  mesLabel(m: MesDisponible): string {
    return `${MESES_ES[m.mes - 1]} ${m.ano}`;
  }

  // ── Edición en línea ──────────────────────────────────────────

  /**
   * Refresca solo la cabecera del mes tras una edición.
   *
   * El estado, los conflictos y la cobertura los calcula el backend (saber si un
   * hueco es un conflicto exige saber quién tiene el permiso), así que hay que
   * preguntárselos. Se sustituyen únicamente esos campos y no las asignaciones,
   * para no deshacer el cambio que el usuario acaba de ver aplicado ni provocar
   * un repintado completo de las tablas.
   */
  private refrescarEstadoMes(): void {
    const datos = this.mesDatos();
    if (!datos) return;
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.logisticaSvc.getMes(datos.ano, datos.mes, cong).subscribe({
      next: (fresco) => {
        this.mesDatos.update((d) => d ? {
          ...d,
          estado: fresco.estado,
          publicado_en: fresco.publicado_en,
          puede_descartar: fresco.puede_descartar,
          conflictos: fresco.conflictos,
          conflictos_detalle: fresco.conflictos_detalle,
          cobertura_total: fresco.cobertura_total,
          cobertura_cubierta: fresco.cobertura_cubierta,
          confirmado: fresco.confirmado,
        } : d);
        this.mesesDisponibles.update((ms) => ms.map((m) =>
          m.ano === fresco.ano && m.mes === fresco.mes
            ? { ...m, estado: fresco.estado }
            : m
        ));
      },
      // Un fallo aquí solo desactualiza la cabecera: no merece romper la
      // edición que ya se guardó bien.
      error: () => {},
    });
  }

  onCambiarPublicador(
    fecha: string, puesto: string, idPublicador: number | null,
    nombrePreferido?: string,
  ): void {
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
          this.refrescarEstadoMes();
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
    // Tambien se busca en los resultados de la busqueda libre: quien viene de
    // "Otros publicadores" no esta en la cache de habilitados, y sin esto el
    // aviso de conflicto decia "Esta persona" en vez de su nombre.
    const nombre =
      nombrePreferido
      ?? this.candidatosCache()[claveCandidatos]?.find(c => c.id_publicador === idPublicador)?.nombre_completo
      ?? this.resultadosBusqueda().find(c => c.id_publicador === idPublicador)?.nombre_completo
      ?? 'Esta persona';

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

  /**
   * Cambia el grupo de un bloque completo. En rotación semanal o mensual el
   * cambio alcanza todas las fechas del tramo en una sola llamada, que es lo que
   * espera quien ve una única fila.
   */
  onToggleGrupo(bloque: AseoBloqueOut, idGrupo: number, checked: boolean): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const current = bloque.grupos.map((g) => g.id_grupo);
    const ids = checked
      ? [...new Set([...current, idGrupo])]
      : current.filter((id) => id !== idGrupo);

    const fechas = bloque.fechas.map((f) => ({
      fecha: f.fecha,
      tipo_reunion: f.tipo_reunion,
    }));
    const fechasDelBloque = new Set(bloque.fechas.map((f) => f.fecha));

    this.logisticaSvc
      .editarAseo({ fechas, ids_grupo: ids }, cong)
      .subscribe({
        next: (updated: LogisticaAseoOut[]) => {
          this.mesDatos.update((d) => {
            if (!d) return d;
            // El agrupado no cambia al editar —las mismas fechas siguen juntas—,
            // así que basta con refrescar los grupos de este bloque.
            const gruposNuevos = this.gruposDisponibles().filter((g) =>
              ids.includes(g.id_grupo),
            );
            return {
              ...d,
              aseo: [
                ...d.aseo.filter((s) => !fechasDelBloque.has(s.fecha)),
                ...updated,
              ],
              aseo_bloques: d.aseo_bloques.map((b) =>
                b.clave === bloque.clave ? { ...b, grupos: gruposNuevos } : b,
              ),
            };
          });
          this.refrescarEstadoMes();
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


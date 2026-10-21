import {
  Component, EventEmitter, HostListener, Input, OnInit, Output, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { fechaIsoLocal, hoyIso } from '../../../core/utils/fecha.util';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
import { ReunionesService } from '../services/reuniones.service';
import {
  AsistenciaSeguimiento, Seguimiento, SeguimientoHistorialResponse,
  SeguimientoOcurrencia, SeguimientoPersona, SeguimientoReunion, SeguimientoRol,
} from '../models/reuniones.models';
import {
  SeguimientoAsignacionPanelComponent, SeguimientoObjetivo,
} from './seguimiento-asignacion-panel.component';
import {
  ASISTENCIAS, asistencia, claseNivel, etiquetaNivel, formatFecha, formatFechaLarga,
  formatSegundos, hace, nivelDeTiempo, parseTiempo,
} from './seguimiento-tiempo.util';

type SubTab = 'anotaciones' | 'anotar' | 'personas' | 'rotacion';
type Periodo = '3m' | '6m' | '12m' | 'todo' | 'personalizado';
type FiltroAnotacion = 'todas' | 'notas' | 'pasado' | 'faltas';

/** El estado editable de una fila de la hoja de trabajo. Es un objeto mutable
 *  y con identidad estable: `[(ngModel)]` escribe directamente sobre él, y el
 *  estado de guardado vive dentro para que la fila pueda enseñarlo sola. */
interface FilaEdicion {
  tiempo: string;
  asistio: AsistenciaSeguimiento | null;
  notas: string;
  estado: 'limpio' | 'guardando' | 'guardado' | 'error';
}

interface GrupoAnotaciones {
  fecha: string;
  /** "Martes 20 oct" y "2026", calculados una vez y no en cada ciclo. */
  titulo: string;
  anio: string;
  items: SeguimientoOcurrencia[];
}

/** Reuniones del historial que se pintan de entrada; el resto, con "Ver más". */
const GRUPOS_POR_PAGINA = 12;

/** Clases que se repiten: el buscador de cada pestaña y los chips de filtro. */
const INPUT_BUSCAR = 'h-10 pl-9 pr-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[0.875rem] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-colors';
const CHIP_ON = 'bg-violet-50 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300';
const CHIP_OFF = 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600';

const TABS: { id: SubTab; label: string; ayuda: string }[] = [
  { id: 'anotaciones', label: 'Mis anotaciones', ayuda: 'Todo lo que has anotado, de lo más reciente a lo más antiguo. Toca una anotación para cambiarla.' },
  { id: 'anotar', label: 'Anotar', ayuda: 'Las reuniones ya celebradas. Escribe cuánto duró cada parte, marca si la persona cumplió y añade observaciones. Se guarda solo al salir del campo.' },
  { id: 'personas', label: 'Por persona', ayuda: 'Cada hermano con sus partes y lo que anotaste de él.' },
  { id: 'rotacion', label: 'A quién le toca', ayuda: 'Para cada parte, primero quien lleva más tiempo sin hacerla.' },
];

const PERIODOS: { id: Periodo; label: string; meses: number | null }[] = [
  { id: '3m', label: 'Últimos 3 meses', meses: 3 },
  { id: '6m', label: 'Últimos 6 meses', meses: 6 },
  { id: '12m', label: 'Último año', meses: 12 },
  { id: 'todo', label: 'Todo', meses: null },
  { id: 'personalizado', label: 'Elegir fechas…', meses: null },
];

/**
 * El seguimiento del consejero: lo que cada uno anota de las partes de la
 * reunión. Es PRIVADO de quien lo escribe, y la pantalla lo dice.
 *
 * Cuatro pestañas, cada una para una pregunta:
 *
 *   · «Mis anotaciones» → "¿qué anoté?". El historial plano de todo lo anotado,
 *     con buscador y filtros. Es la que abre primero: antes no existía y para
 *     releer una observación había que adivinar en qué reunión estaba.
 *   · «Anotar»          → la hoja de trabajo para apuntar de una sentada los
 *     tiempos de una reunión ya celebrada, editando en línea.
 *   · «Por persona»     → cómo le va a cada uno: tiempos y lo anotado por parte.
 *   · «A quién le toca» → ordena por quién lleva más tiempo sin llevar un papel.
 *
 * Todo sale de una sola llamada: el backend devuelve las vistas del mismo
 * recorrido, así que cambiar de pestaña no pide nada.
 */
@Component({
  selector: 'app-seguimiento-reuniones',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, SelectPickerComponent, SeguimientoAsignacionPanelComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
      (click)="cerrar.emit()">
      <div role="dialog" aria-modal="true" aria-labelledby="seg-hist-titulo"
        class="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-6xl h-[92vh] sm:h-[88vh] flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden"
        (click)="$event.stopPropagation()">

        <div class="flex justify-center pt-3 pb-1 sm:hidden">
          <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
        </div>

        <!-- ═══ CABECERA ═══ -->
        <div class="shrink-0 px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 id="seg-hist-titulo" class="font-display text-lg font-bold text-slate-900 dark:text-white leading-tight">Seguimiento de partes</h2>
              <!-- Lo primero que alguien se pregunta antes de escribir sobre un
                   hermano: quién más lo va a leer. -->
              <p class="flex items-center gap-1.5 text-[0.8125rem] text-slate-500 dark:text-slate-400 mt-1">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                Lo que anotas es privado: solo lo ves tú.
              </p>
            </div>
            <button type="button" (click)="cerrar.emit()" aria-label="Cerrar"
              class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Pestañas: texto llano y una línea que dice para qué sirve la
               activa. Se desplazan en horizontal en pantallas estrechas. -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Vistas del seguimiento">
              @for (t of TABS; track t.id) {
                <button type="button" role="tab" [id]="'seg-tab-' + t.id"
                  [attr.aria-selected]="subTab() === t.id" [attr.aria-controls]="'seg-panel'"
                  (click)="cambiarTab(t.id)"
                  class="shrink-0 flex items-center gap-1.5 px-3.5 h-10 rounded-xl text-[0.8125rem] font-semibold whitespace-nowrap transition-colors duration-150 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500"
                  [class]="subTab() === t.id
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'">
                  {{ t.label }}
                  @if (t.id === 'anotaciones' && datos(); as d) {
                    <span class="min-w-[1.25rem] h-5 px-1.5 rounded-full text-[0.7rem] font-bold flex items-center justify-center tabular-nums"
                      [class]="subTab() === t.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'">{{ d.total_con_seguimiento }}</span>
                  }
                  @if (t.id === 'anotar' && datos()?.total_pendientes) {
                    <span class="min-w-[1.25rem] h-5 px-1.5 rounded-full text-[0.7rem] font-bold flex items-center justify-center tabular-nums"
                      [class]="subTab() === t.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'"
                      [attr.aria-label]="datos()!.total_pendientes + ' partes sin anotar'">{{ datos()!.total_pendientes }}</span>
                  }
                </button>
              }
            </div>
            <p class="text-[0.8125rem] leading-relaxed text-slate-500 dark:text-slate-400 max-w-[70ch]">{{ ayudaTab() }}</p>
          </div>

          <!-- Periodo: opciones con nombre en vez de dos calendarios. Las
               fechas exactas solo aparecen si se piden. -->
          <div class="flex flex-wrap items-end gap-3">
            <div class="flex flex-col gap-1">
              <span id="seg-periodo-label" class="text-[0.75rem] font-semibold text-slate-500 dark:text-slate-400">Periodo</span>
              <div class="w-56">
                <app-select-picker [ngModel]="periodo()" (ngModelChange)="cambiarPeriodo($event)"
                  [ngModelOptions]="{ standalone: true }"
                  colorScheme="violet" ariaLabel="Periodo" [clearable]="false" [searchable]="false"
                  [options]="OPCIONES_PERIODO"></app-select-picker>
              </div>
            </div>
            @if (periodo() === 'personalizado') {
              <div class="flex flex-col gap-1 min-w-[9.5rem] flex-1 sm:flex-none">
                <label class="text-[0.75rem] font-semibold text-slate-500 dark:text-slate-400">Desde</label>
                <app-date-picker [(ngModel)]="rangoDesde" [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="cargar()" [maxDate]="rangoHasta || null" colorScheme="violet"
                  placeholder="El principio"></app-date-picker>
              </div>
              <div class="flex flex-col gap-1 min-w-[9.5rem] flex-1 sm:flex-none">
                <label class="text-[0.75rem] font-semibold text-slate-500 dark:text-slate-400">Hasta</label>
                <app-date-picker [(ngModel)]="rangoHasta" [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="cargar()" [minDate]="rangoDesde || null" colorScheme="violet"
                  placeholder="Hoy y lo programado"></app-date-picker>
              </div>
            }
          </div>
        </div>

        <!-- ═══ CUERPO ═══ -->
        <div id="seg-panel" role="tabpanel" [attr.aria-labelledby]="'seg-tab-' + subTab()"
          class="flex-1 min-h-0 overflow-y-auto simple-scrollbar px-4 py-4 sm:px-5 sm:py-5">

          @if (cargando()) {
            <div class="flex flex-col gap-3" aria-busy="true" aria-label="Cargando el seguimiento">
              @for (i of [0, 1, 2, 3]; track i) {
                <div class="h-16 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse"></div>
              }
            </div>
          } @else if (error()) {
            <div role="alert" class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 flex items-center gap-3">
              <p class="flex-1 text-[0.8125rem] font-medium text-red-700 dark:text-red-400">{{ error() }}</p>
              <button type="button" (click)="cargar()"
                class="shrink-0 px-3 h-9 rounded-lg text-[0.8125rem] font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">Reintentar</button>
            </div>
          } @else if (datos(); as d) {

            <!-- Un periodo sin nada NO es un callejón sin salida: se dice entre
                 qué fechas hay datos y se ofrece saltar ahí de un clic. -->
            @if (d.total_apariciones === 0) {
              <div class="flex flex-col items-center justify-center py-14 text-center gap-2.5 max-w-sm mx-auto">
                <p class="text-[0.9375rem] font-semibold text-slate-700 dark:text-slate-200">No hay partes asignadas en este periodo</p>
                @if (d.rango_disponible.desde && d.rango_disponible.hasta) {
                  <p class="text-[0.8125rem] text-slate-500 dark:text-slate-400">
                    Hay programación del {{ formatFecha(d.rango_disponible.desde) }}
                    al {{ formatFecha(d.rango_disponible.hasta) }}.
                  </p>
                  <button type="button" (click)="usarRangoDisponible(d)"
                    class="mt-1 px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[0.8125rem] font-semibold transition-colors active:scale-95">
                    Ver todo lo que hay
                  </button>
                } @else {
                  <p class="text-[0.8125rem] text-slate-500 dark:text-slate-400">Esta congregación aún no tiene programación asignada.</p>
                }
              </div>
            }

            <!-- ─────────── MIS ANOTACIONES: el historial ─────────── -->
            @else if (subTab() === 'anotaciones') {

              @if (d.total_con_seguimiento === 0) {
                <!-- Vacío que enseña: qué es una anotación y dónde se hace. -->
                <div class="flex flex-col items-center justify-center py-14 text-center gap-2.5 max-w-sm mx-auto">
                  <p class="text-[0.9375rem] font-semibold text-slate-700 dark:text-slate-200">Aún no has anotado nada en este periodo</p>
                  <p class="text-[0.8125rem] leading-relaxed text-slate-500 dark:text-slate-400">
                    Cuando anotes el tiempo de una parte, si la persona cumplió o una observación, aparecerá aquí.
                  </p>
                  <button type="button" (click)="cambiarTab('anotar')"
                    class="mt-1 px-4 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[0.8125rem] font-semibold transition-colors active:scale-95">
                    Empezar a anotar
                  </button>
                </div>
              } @else {
                <div class="flex flex-col gap-3 mb-5">
                  <div class="relative">
                    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                    <label for="seg-buscar-a" class="sr-only">Buscar por nombre o parte</label>
                    <input id="seg-buscar-a" type="search" [ngModel]="filtroTexto()" (ngModelChange)="filtroTexto.set($event)"
                      placeholder="Buscar por nombre o parte"
                      [class]="INPUT_BUSCAR">
                  </div>
                  <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Mostrar">
                    @for (f of FILTROS; track f.id) {
                      <button type="button" (click)="filtroAnotacion.set(f.id)" [attr.aria-pressed]="filtroAnotacion() === f.id"
                        class="px-3 h-9 rounded-full border text-[0.8125rem] font-medium transition-colors active:scale-95"
                        [class]="filtroAnotacion() === f.id ? CHIP_ON : CHIP_OFF">
                        {{ f.label }}
                      </button>
                    }
                  </div>
                </div>

                @if (anotacionesAgrupadas().length === 0) {
                  <div class="flex flex-col items-center justify-center py-12 text-center gap-2">
                    <p class="text-[0.9375rem] font-semibold text-slate-700 dark:text-slate-200">Ninguna anotación coincide</p>
                    <button type="button" (click)="limpiarFiltros()"
                      class="px-3 h-9 rounded-lg text-[0.8125rem] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors">
                      Quitar la búsqueda y los filtros
                    </button>
                  </div>
                } @else {
                  <p class="text-[0.8125rem] text-slate-500 dark:text-slate-400 mb-3" aria-live="polite">
                    {{ totalAnotacionesVisibles() }} anotación{{ totalAnotacionesVisibles() === 1 ? '' : 'es' }}
                  </p>
                  <div class="flex flex-col gap-6">
                    @for (g of gruposVisibles(); track g.fecha) {
                      <section [attr.aria-label]="g.titulo">
                        <h3 class="font-display text-[0.875rem] font-bold text-slate-800 dark:text-slate-100 mb-2">
                          {{ g.titulo }} <span class="font-normal text-slate-400 dark:text-slate-500">{{ g.anio }}</span>
                        </h3>
                        <ul class="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                          @for (o of g.items; track o.id_asignacion) {
                            <li>
                              <button type="button" (click)="abrirPanel(o)"
                                [attr.aria-label]="'Cambiar la anotación de ' + o.nombre_completo + ', ' + o.detalle"
                                class="group w-full text-left px-4 py-3 flex items-start gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-500">
                                <span class="flex-1 min-w-0 flex flex-col gap-1.5">
                                  <span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span class="text-[0.9375rem] font-semibold text-slate-900 dark:text-slate-50">{{ o.nombre_completo }}</span>
                                    <span class="text-[0.8125rem] text-slate-500 dark:text-slate-400">{{ o.detalle }}@if (o.papel) {<span> · {{ o.papel }}</span>}@if (o.sala) {<span> · {{ o.sala }}</span>}</span>
                                  </span>
                                  <span class="flex flex-wrap items-center gap-1.5">
                                    @if (o.seguimiento?.duracion_real_seg != null) {
                                      <span class="px-2 h-6 rounded-full text-[0.75rem] font-semibold flex items-center gap-1 tabular-nums" [class]="claseNivel(o.seguimiento!.nivel)">
                                        {{ formatSegundos(o.seguimiento!.duracion_real_seg!) }}
                                        @if (o.seguimiento!.nivel; as n) {
                                          <span class="font-normal">· {{ etiquetaNivel(n, o.seguimiento!.duracion_real_seg!, o.duracion_minutos) }}</span>
                                        }
                                      </span>
                                    }
                                    @if (o.seguimiento?.asistio; as a) {
                                      <span class="px-2 h-6 rounded-full text-[0.75rem] font-semibold flex items-center" [class]="asistencia(a).claseChip">{{ asistencia(a).texto }}</span>
                                    }
                                  </span>
                                  @if (o.seguimiento?.notas) {
                                    <span class="text-[0.875rem] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line max-w-[70ch]">{{ o.seguimiento!.notas }}</span>
                                  }
                                </span>
                                <span class="shrink-0 mt-0.5 text-[0.8125rem] font-semibold text-violet-700 dark:text-violet-300 opacity-70 group-hover:opacity-100 transition-opacity">Cambiar</span>
                              </button>
                            </li>
                          }
                        </ul>
                      </section>
                    }
                    @if (gruposVisibles().length < anotacionesAgrupadas().length) {
                      <button type="button" (click)="limiteGrupos.set(limiteGrupos() + GRUPOS_POR_PAGINA)"
                        class="self-center px-4 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-[0.8125rem] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95">
                        Ver reuniones anteriores
                      </button>
                    }
                  </div>
                }
              }
            }

            <!-- ─────────── ANOTAR: la hoja de trabajo ─────────── -->
            @else if (subTab() === 'anotar') {

              <div class="flex items-center gap-3 mb-4 flex-wrap">
                <p class="text-[0.8125rem] text-slate-500 dark:text-slate-400 flex-1 min-w-[12rem]">
                  {{ d.reuniones.length }} {{ d.reuniones.length === 1 ? 'reunión celebrada' : 'reuniones celebradas' }}
                  @if (d.total_pendientes > 0) {
                    · {{ d.total_pendientes }} {{ d.total_pendientes === 1 ? 'parte' : 'partes' }} sin anotar
                  }
                </p>
                <button type="button" (click)="soloPendientes.set(!soloPendientes())"
                  [attr.aria-pressed]="soloPendientes()"
                  class="shrink-0 flex items-center gap-2 px-3 h-9 rounded-full border text-[0.8125rem] font-medium transition-colors active:scale-95"
                  [class]="soloPendientes() ? CHIP_ON : CHIP_OFF">
                  <span class="w-4 h-4 rounded border flex items-center justify-center"
                    [class]="soloPendientes() ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300 dark:border-slate-600'">
                    @if (soloPendientes()) {
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    }
                  </span>
                  Ocultar lo ya anotado
                </button>
              </div>

              @if (reunionesVisibles().length === 0) {
                <div class="flex flex-col items-center justify-center py-14 text-center gap-2">
                  <p class="text-[0.9375rem] font-semibold text-slate-700 dark:text-slate-200">Todo anotado</p>
                  <p class="text-[0.8125rem] text-slate-500 dark:text-slate-400">Todas las reuniones celebradas de este periodo ya tienen sus anotaciones.</p>
                </div>
              }

              <div class="flex flex-col gap-3">
                @for (r of reunionesVisibles(); track r.fecha) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button type="button" (click)="toggle('m|' + r.fecha)"
                      [attr.aria-expanded]="expandido('m|' + r.fecha)"
                      class="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-500">
                      <span class="flex-1 min-w-0">
                        <span class="block font-display text-[0.9375rem] font-bold text-slate-900 dark:text-slate-50">{{ formatFechaLarga(r.fecha) }}</span>
                        <span class="block text-[0.8125rem] mt-0.5"
                          [class]="r.registradas === r.total ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'">
                          @if (r.registradas === r.total) { Todo anotado } @else { {{ r.registradas }} de {{ r.total }} partes anotadas }
                        </span>
                      </span>
                      <!-- Avance: qué reunión está a medias sin abrirla. -->
                      <span class="hidden sm:block w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0" aria-hidden="true">
                        <span class="block h-full rounded-full"
                          [class]="r.registradas === r.total ? 'bg-emerald-500' : 'bg-violet-500'"
                          [style.width.%]="pct(r.registradas, r.total)"></span>
                      </span>
                      <svg class="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200" [class.rotate-90]="expandido('m|' + r.fecha)"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>

                    @if (expandido('m|' + r.fecha)) {
                      <div class="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                        @for (o of partesVisibles(r); track o.id_asignacion) {
                          <div class="px-4 py-3 bg-slate-50/60 dark:bg-slate-800/25 flex flex-col gap-2.5">

                            <!-- Quién y qué -->
                            <div class="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap min-w-0">
                              <span class="text-[0.9375rem] font-semibold text-slate-900 dark:text-slate-50">{{ o.nombre_completo }}</span>
                              <span class="text-[0.8125rem] text-slate-500 dark:text-slate-400 flex-1 min-w-0">
                                {{ o.detalle }}@if (o.papel) {<span> · {{ o.papel }}</span>}@if (o.sala) {<span> · {{ o.sala }}</span>}
                              </span>
                              @if (o.duracion_minutos) {
                                <span class="shrink-0 text-[0.75rem] text-slate-500 dark:text-slate-400 tabular-nums">{{ o.duracion_minutos }} min previstos</span>
                              }
                            </div>

                            <!-- Los tres datos, en línea y con su nombre: apuntar
                                 ocho partes no puede costar ocho diálogos. -->
                            <div class="flex items-end gap-x-3 gap-y-2.5 flex-wrap">
                              <div class="flex flex-col gap-1">
                                <label [attr.for]="'t-' + o.id_asignacion" class="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400">Duró</label>
                                <div class="flex items-center gap-1.5">
                                  <input [id]="'t-' + o.id_asignacion" type="text" inputmode="numeric"
                                    [(ngModel)]="ed(o).tiempo" [ngModelOptions]="{ standalone: true }"
                                    (blur)="guardarFila(o)" (keydown.enter)="guardarFila(o)"
                                    placeholder="0:00" title="Minutos y segundos, por ejemplo 4:35"
                                    class="w-[4.75rem] h-10 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[0.875rem] font-semibold text-center tabular-nums text-slate-800 dark:text-slate-100 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-colors">
                                  @if (nivelFila(o); as n) {
                                    <span class="shrink-0 px-2 h-7 rounded-full text-[0.75rem] font-semibold flex items-center whitespace-nowrap" [class]="claseNivel(n)">
                                      {{ etiquetaNivel(n, segundosFila(o), o.duracion_minutos) }}
                                    </span>
                                  }
                                </div>
                              </div>

                              <div class="flex flex-col gap-1">
                                <span [id]="'a-' + o.id_asignacion" class="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400">¿Cumplió?</span>
                                <div class="flex items-center gap-1" role="group" [attr.aria-labelledby]="'a-' + o.id_asignacion">
                                  @for (op of ASISTENCIAS; track op.valor) {
                                    <button type="button" (click)="marcarAsistencia(o, op.valor)"
                                      [attr.aria-pressed]="ed(o).asistio === op.valor"
                                      class="shrink-0 px-3 h-10 rounded-lg text-[0.8125rem] font-semibold border transition-colors active:scale-95"
                                      [class]="ed(o).asistio === op.valor ? op.claseBoton : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'">
                                      {{ op.boton }}
                                    </button>
                                  }
                                </div>
                              </div>

                              <div class="flex flex-col gap-1 flex-1 min-w-[12rem]">
                                <label [attr.for]="'n-' + o.id_asignacion" class="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400">Observaciones</label>
                                <input [id]="'n-' + o.id_asignacion" type="text"
                                  [(ngModel)]="ed(o).notas" [ngModelOptions]="{ standalone: true }"
                                  (blur)="guardarFila(o)" (keydown.enter)="guardarFila(o)"
                                  placeholder="Opcional"
                                  class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[0.875rem] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-colors">
                              </div>

                              <div class="flex items-center gap-1 h-10">
                                <!-- Estado del guardado, en palabras: guardar solo
                                     sin decirlo sería un acto de fe. -->
                                <span class="w-[5.5rem] text-[0.75rem] font-medium flex items-center gap-1" aria-live="polite">
                                  @switch (ed(o).estado) {
                                    @case ('guardando') {
                                      <span class="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-violet-500 animate-spin"></span>
                                      <span class="text-slate-500">Guardando</span>
                                    }
                                    @case ('guardado') {
                                      <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                      <span class="text-emerald-700 dark:text-emerald-400">Guardado</span>
                                    }
                                    @case ('error') {
                                      <button type="button" (click)="guardarFila(o, true)"
                                        class="text-red-700 dark:text-red-400 underline underline-offset-2">No se guardó. Reintentar</button>
                                    }
                                  }
                                </span>
                                <!-- Para lo que la fila no da: el cronómetro. -->
                                <button type="button" (click)="abrirPanel(o)"
                                  title="Cronometrar esta parte"
                                  [attr.aria-label]="'Cronometrar la parte de ' + o.nombre_completo"
                                  class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/25 transition-colors active:scale-95">
                                  <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 1.5M9.5 2h5"/></svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- ─────────── POR PERSONA: la ficha ─────────── -->
            @else if (subTab() === 'personas') {

              <div class="relative mb-4">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <label for="seg-filtro-p" class="sr-only">Buscar por nombre</label>
                <input id="seg-filtro-p" type="search" [ngModel]="filtroTexto()" (ngModelChange)="filtroTexto.set($event)"
                  placeholder="Buscar por nombre"
                  [class]="INPUT_BUSCAR">
              </div>

              @if (personasFiltradas().length === 0) {
                <div class="flex flex-col items-center justify-center py-14 text-center gap-2">
                  <p class="text-[0.9375rem] font-semibold text-slate-700 dark:text-slate-200">Nadie con ese nombre</p>
                  <p class="text-[0.8125rem] text-slate-500 dark:text-slate-400">No hay partes de esa persona en este periodo.</p>
                </div>
              }

              <div class="flex flex-col gap-2">
                @for (p of personasFiltradas(); track p.id_publicador) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button type="button" (click)="toggle('p|' + p.id_publicador)"
                      [attr.aria-expanded]="expandido('p|' + p.id_publicador)"
                      class="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-500">
                      <span class="flex-1 min-w-0">
                        <span class="block text-[0.9375rem] font-semibold text-slate-900 dark:text-slate-50">{{ p.nombre_completo }}</span>
                        <span class="block text-[0.8125rem] text-slate-500 dark:text-slate-400 mt-0.5">
                          {{ p.total }} parte{{ p.total === 1 ? '' : 's' }} ·
                          @if (p.dias_desde_ultima != null) {
                            la última {{ hace(p.dias_desde_ultima) | lowercase }}
                          } @else {
                            todavía ninguna celebrada
                          }
                          @if (p.proxima_fecha) {
                            <span class="text-violet-700 dark:text-violet-300"> · próxima el {{ formatFecha(p.proxima_fecha) }}</span>
                          }
                        </span>
                      </span>

                      <!-- Cómo se le da el tiempo, en palabras y no solo en color. -->
                      @if (p.tiempo && p.tiempo.medidas > 0) {
                        <span class="hidden sm:flex shrink-0 flex-col items-end gap-1">
                          <span class="flex w-20 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700" aria-hidden="true">
                            <span class="h-full bg-amber-400" [style.width.%]="pct(p.tiempo.corto, p.tiempo.medidas)"></span>
                            <span class="h-full bg-emerald-500" [style.width.%]="pct(p.tiempo.en_tiempo, p.tiempo.medidas)"></span>
                            <span class="h-full bg-red-500" [style.width.%]="pct(p.tiempo.pasado, p.tiempo.medidas)"></span>
                          </span>
                          <span class="text-[0.75rem] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                            {{ p.tiempo.en_tiempo }} de {{ p.tiempo.medidas }} en tiempo
                          </span>
                        </span>
                      }

                      @if (p.sin_seguimiento > 0) {
                        <span class="shrink-0 px-2 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[0.75rem] font-medium flex items-center whitespace-nowrap">{{ p.sin_seguimiento }} sin anotar</span>
                      }
                      <svg class="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200" [class.rotate-90]="expandido('p|' + p.id_publicador)"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>

                    @if (expandido('p|' + p.id_publicador)) {
                      <div class="border-t border-slate-100 dark:border-slate-800">
                        @if (p.tiempo && p.tiempo.medidas > 0) {
                          <div class="px-4 py-2.5 bg-white dark:bg-slate-900 flex items-center gap-x-4 gap-y-1 flex-wrap text-[0.8125rem] border-b border-slate-100 dark:border-slate-800">
                            <span class="text-slate-500 dark:text-slate-400">De {{ p.tiempo.medidas }} cronometrada{{ p.tiempo.medidas === 1 ? '' : 's' }}:</span>
                            <span class="font-medium text-emerald-700 dark:text-emerald-400">{{ p.tiempo.en_tiempo }} en tiempo</span>
                            <span class="font-medium text-red-700 dark:text-red-400">{{ p.tiempo.pasado }} se pasó</span>
                            <span class="font-medium text-amber-700 dark:text-amber-400">{{ p.tiempo.corto }} se quedó corto</span>
                            @if (p.tiempo.desviacion_media_seg != null) {
                              <span class="text-slate-500 dark:text-slate-400">
                                · de media {{ p.tiempo.desviacion_media_seg > 0 ? 'se pasa' : 'le sobran' }} {{ formatSegundos(abs(p.tiempo.desviacion_media_seg)) }}
                              </span>
                            }
                          </div>
                        }
                        <div class="divide-y divide-slate-100 dark:divide-slate-800">
                          @for (r of p.roles; track r.rol_key) {
                            <div class="bg-slate-50/60 dark:bg-slate-800/30">
                              <button type="button" (click)="toggle('r|' + p.id_publicador + '|' + r.rol_key)"
                                [attr.aria-expanded]="expandido('r|' + p.id_publicador + '|' + r.rol_key)"
                                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors">
                                <span class="flex-1 min-w-0 text-[0.875rem] font-medium text-slate-800 dark:text-slate-200">{{ r.etiqueta }}</span>
                                <span class="shrink-0 text-[0.75rem] text-slate-500 dark:text-slate-400 tabular-nums">{{ r.veces }} {{ r.veces === 1 ? 'vez' : 'veces' }}</span>
                                <span class="shrink-0 text-[0.75rem] text-slate-500 dark:text-slate-400 hidden sm:inline">
                                  · {{ r.dias_desde_ultima != null ? hace(r.dias_desde_ultima) : 'solo programada' }}
                                </span>
                                <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200" [class.rotate-90]="expandido('r|' + p.id_publicador + '|' + r.rol_key)"
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                              </button>

                              @if (expandido('r|' + p.id_publicador + '|' + r.rol_key)) {
                                <div class="pb-2">
                                  @for (o of r.ocurrencias; track o.id_asignacion) {
                                    <button type="button" (click)="abrirPanel(o)"
                                      class="w-full flex items-start gap-3 pl-6 pr-4 py-2 text-left hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                                      <span class="shrink-0 w-24 text-[0.8125rem] font-medium text-slate-600 dark:text-slate-300 tabular-nums">{{ formatFecha(o.fecha) }}</span>
                                      <span class="flex-1 min-w-0 flex flex-col gap-1">
                                        @if (o.seguimiento; as s) {
                                          <span class="flex items-center gap-1.5 flex-wrap">
                                            @if (s.duracion_real_seg != null) {
                                              <span class="px-2 h-6 rounded-full text-[0.75rem] font-semibold flex items-center tabular-nums" [class]="claseNivel(s.nivel)">
                                                {{ formatSegundos(s.duracion_real_seg) }}
                                              </span>
                                            }
                                            @if (s.asistio && s.asistio !== 'si') {
                                              <span class="px-2 h-6 rounded-full text-[0.75rem] font-semibold flex items-center" [class]="asistencia(s.asistio).claseChip">{{ asistencia(s.asistio).texto }}</span>
                                            }
                                          </span>
                                          @if (s.notas) {
                                            <span class="text-[0.8125rem] leading-relaxed text-slate-600 dark:text-slate-300">{{ s.notas }}</span>
                                          }
                                        } @else if (o.fecha <= hoy) {
                                          <span class="text-[0.8125rem] text-slate-500 dark:text-slate-400">Sin anotar · toca para anotar</span>
                                        } @else {
                                          <span class="text-[0.8125rem] text-slate-500 dark:text-slate-400">Programada</span>
                                        }
                                      </span>
                                      @if (o.sala) {
                                        <span class="shrink-0 text-[0.75rem] text-slate-500 dark:text-slate-400">{{ o.sala }}</span>
                                      }
                                    </button>
                                  }
                                </div>
                              }
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- ─────────── A QUIÉN LE TOCA ─────────── -->
            @else {

              <div class="relative mb-4">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <label for="seg-filtro-r" class="sr-only">Buscar una parte</label>
                <input id="seg-filtro-r" type="search" [ngModel]="filtroTexto()" (ngModelChange)="filtroTexto.set($event)"
                  placeholder="Buscar una parte"
                  [class]="INPUT_BUSCAR">
              </div>

              @if (rolesFiltrados().length === 0) {
                <div class="flex flex-col items-center justify-center py-14 text-center gap-2">
                  <p class="text-[0.9375rem] font-semibold text-slate-700 dark:text-slate-200">Ninguna parte con ese nombre</p>
                  <p class="text-[0.8125rem] text-slate-500 dark:text-slate-400">Prueba con otra palabra o amplía el periodo.</p>
                </div>
              }

              <div class="flex flex-col gap-2">
                @for (r of rolesFiltrados(); track r.rol_key) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button type="button" (click)="toggle('rol|' + r.rol_key)"
                      [attr.aria-expanded]="expandido('rol|' + r.rol_key)"
                      class="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-500">
                      <span class="flex-1 min-w-0">
                        <span class="block text-[0.9375rem] font-semibold text-slate-900 dark:text-slate-50">{{ r.etiqueta }}</span>
                        <span class="block text-[0.8125rem] text-slate-500 dark:text-slate-400 mt-0.5">
                          {{ r.total }} {{ r.total === 1 ? 'vez' : 'veces' }} · {{ r.personas.length }} persona{{ r.personas.length === 1 ? '' : 's' }}
                          @if (r.personas.length) {
                            <span class="sm:hidden"> · le toca a {{ r.personas[0].nombre_completo }}</span>
                          }
                        </span>
                      </span>
                      <!-- El dato por el que se abre esta pestaña, sin abrir la fila. -->
                      @if (r.personas.length) {
                        <span class="hidden sm:block shrink-0 text-right max-w-[13rem]">
                          <span class="block text-[0.75rem] text-slate-500 dark:text-slate-400">Le toca a</span>
                          <span class="block text-[0.875rem] font-semibold text-violet-700 dark:text-violet-300 truncate">{{ r.personas[0].nombre_completo }}</span>
                        </span>
                      }
                      <svg class="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200" [class.rotate-90]="expandido('rol|' + r.rol_key)"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>

                    @if (expandido('rol|' + r.rol_key)) {
                      <ol class="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                        @for (p of r.personas; track p.id_publicador; let i = $index) {
                          <li class="flex items-center gap-3 px-4 py-2.5 bg-slate-50/60 dark:bg-slate-800/30">
                            <span class="shrink-0 w-5 text-[0.75rem] text-slate-400 tabular-nums text-right">{{ i + 1 }}</span>
                            <span class="flex-1 min-w-0 text-[0.875rem] font-medium text-slate-800 dark:text-slate-200">{{ p.nombre_completo }}</span>
                            <span class="shrink-0 text-[0.75rem] text-slate-500 dark:text-slate-400 tabular-nums">{{ p.veces }} {{ p.veces === 1 ? 'vez' : 'veces' }}</span>
                            <span class="shrink-0 w-32 text-right text-[0.8125rem]">
                              @if (p.proxima_fecha) {
                                <span class="text-slate-500 dark:text-slate-400">Ya la tiene el {{ formatFecha(p.proxima_fecha) }}</span>
                              } @else if (p.dias_desde_ultima == null) {
                                <span class="font-medium text-violet-700 dark:text-violet-300">Nunca</span>
                              } @else {
                                <span [class]="p.dias_desde_ultima >= 90 ? 'font-medium text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'">
                                  {{ hace(p.dias_desde_ultima) }}
                                </span>
                              }
                            </span>
                          </li>
                        }
                      </ol>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>
    </div>

    @if (panelObjetivo(); as obj) {
      <app-seguimiento-asignacion-panel
        [objetivo]="obj"
        [idCong]="idCong!"
        (guardado)="onGuardado(obj.id_asignacion, $event)"
        (cerrar)="panelObjetivo.set(null)">
      </app-seguimiento-asignacion-panel>
    }
  `,
})
export class SeguimientoReunionesComponent implements OnInit {
  @Input() idCong: number | null = null;
  @Input() tipoReunion: string = 'entre_semana';
  @Output() cerrar = new EventEmitter<void>();
  /** Se emite cuando se guarda o borra algo, para que la programación refresque
   *  las marcas de sus filas sin recargarlo todo a ciegas. */
  @Output() cambiado = new EventEmitter<void>();

  constructor(private svc: ReunionesService) {}

  // Reexportadas para el template.
  readonly formatFecha = formatFecha;
  readonly formatFechaLarga = formatFechaLarga;
  readonly formatSegundos = formatSegundos;
  readonly claseNivel = claseNivel;
  readonly etiquetaNivel = etiquetaNivel;
  readonly hace = hace;
  readonly abs = Math.abs;
  readonly TABS = TABS;
  readonly OPCIONES_PERIODO: PickerOption[] = PERIODOS.map(p => ({ value: p.id, label: p.label }));
  readonly ASISTENCIAS = ASISTENCIAS;
  readonly asistencia = asistencia;
  readonly INPUT_BUSCAR = INPUT_BUSCAR;
  readonly CHIP_ON = CHIP_ON;
  readonly CHIP_OFF = CHIP_OFF;
  readonly GRUPOS_POR_PAGINA = GRUPOS_POR_PAGINA;

  readonly FILTROS: { id: FiltroAnotacion; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'notas', label: 'Con observaciones' },
    { id: 'pasado', label: 'Se pasó de tiempo' },
    { id: 'faltas', label: 'No vino o lo sustituyeron' },
  ];

  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Con el panel de una asignación abierto, Escape lo cierra a él primero:
    // es el que está encima y el que tiene datos sin guardar.
    if (this.panelObjetivo()) return;
    this.cerrar.emit();
  }

  subTab = signal<SubTab>('anotaciones');
  periodo = signal<Periodo>('12m');
  cargando = signal(false);
  error = signal('');
  datos = signal<SeguimientoHistorialResponse | null>(null);

  filtroTexto = signal('');
  filtroAnotacion = signal<FiltroAnotacion>('todas');
  soloPendientes = signal(false);
  private expandidos = signal<Set<string>>(new Set());
  panelObjetivo = signal<SeguimientoObjetivo | null>(null);
  limiteGrupos = signal(GRUPOS_POR_PAGINA);
  private carga?: Subscription;

  rangoDesde: string | null = null;
  rangoHasta: string | null = null;

  readonly hoy = hoyIso();

  ayudaTab = computed(() => TABS.find(t => t.id === this.subTab())!.ayuda);

  /** Estado editable de la hoja de trabajo, por asignación. Es un Map plano y
   *  no un signal a propósito: `[(ngModel)]` escribe sobre el objeto que
   *  devuelve `ed()`, y esa referencia tiene que ser la misma en cada ciclo de
   *  detección o el input perdería el foco a la primera tecla. */
  private ediciones = new Map<number, FilaEdicion>();

  /** El historial: todo lo anotado, de lo más reciente a lo más antiguo y
   *  agrupado por reunión. Sale de `reuniones` porque solo se anota lo ya
   *  celebrado y ahí está cada asignación una sola vez. */
  anotacionesAgrupadas = computed<GrupoAnotaciones[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const q = this.filtroTexto().trim().toLowerCase();
    const filtro = this.filtroAnotacion();
    const grupos: GrupoAnotaciones[] = [];
    // El backend ya las manda de la más reciente a la más antigua.
    for (const r of d.reuniones) {
      const items = r.partes.filter(o => {
        const s = o.seguimiento;
        if (!s) return false;
        if (q && !o.nombre_completo.toLowerCase().includes(q) && !o.detalle.toLowerCase().includes(q)) return false;
        if (filtro === 'notas') return !!s.notas?.trim();
        if (filtro === 'pasado') return s.nivel === 'pasado';
        if (filtro === 'faltas') return s.asistio === 'no' || s.asistio === 'sustituido';
        return true;
      });
      if (items.length) grupos.push({ fecha: r.fecha, titulo: formatFechaLarga(r.fecha), anio: r.fecha.slice(0, 4), items });
    }
    return grupos;
  });

  gruposVisibles = computed(() => this.anotacionesAgrupadas().slice(0, this.limiteGrupos()));

  totalAnotacionesVisibles = computed(() =>
    this.anotacionesAgrupadas().reduce((n, g) => n + g.items.length, 0));

  personasFiltradas = computed<SeguimientoPersona[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const q = this.filtroTexto().trim().toLowerCase();
    if (!q) return d.personas;
    return d.personas.filter(p => p.nombre_completo.toLowerCase().includes(q));
  });

  rolesFiltrados = computed<SeguimientoRol[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const q = this.filtroTexto().trim().toLowerCase();
    if (!q) return d.roles;
    return d.roles.filter(r => r.etiqueta.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    // Un año hacia atrás y sin tope por delante. Menos hacia atrás no basta
    // para ver si alguien repite papel; y cerrar el rango en hoy escondería lo
    // ya programado, que es lo que hay que mirar antes de asignar otra vez.
    this.cambiarPeriodo('12m');
  }

  cambiarTab(t: SubTab): void {
    // La búsqueda de una pestaña (un nombre) no tiene sentido en otra (una parte).
    this.filtroTexto.set('');
    this.subTab.set(t);
  }

  cambiarPeriodo(p: Periodo): void {
    this.periodo.set(p);
    if (p === 'personalizado') return; // espera a que elija las fechas
    const meses = PERIODOS.find(x => x.id === p)!.meses;
    if (meses == null) {
      this.rangoDesde = null;
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() - meses);
      this.rangoDesde = fechaIsoLocal(d);
    }
    this.rangoHasta = null;
    this.cargar();
  }

  cargar(): void {
    if (!this.idCong) return;
    // Cambiar de periodo varias veces seguidas no debe dejar respuestas viejas
    // compitiendo con la última.
    this.carga?.unsubscribe();
    this.cargando.set(true);
    this.error.set('');
    this.limiteGrupos.set(GRUPOS_POR_PAGINA);
    this.carga = this.svc.getSeguimientoHistorial(
      this.idCong, this.tipoReunion, this.rangoDesde, this.rangoHasta,
    ).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.ediciones.clear();
        // En «Anotar», la reunión más reciente sin terminar abierta de entrada:
        // es la que se viene a apuntar casi siempre.
        const primera = d.reuniones.find(r => r.registradas < r.total) ?? d.reuniones[0];
        if (primera) this.expandidos.set(new Set([`m|${primera.fecha}`]));
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el seguimiento. Revisa la conexión.');
        this.cargando.set(false);
      },
    });
  }

  /** Salta al rango en el que sí hay datos, desde el aviso de periodo vacío. */
  usarRangoDisponible(d: SeguimientoHistorialResponse): void {
    this.periodo.set('personalizado');
    this.rangoDesde = d.rango_disponible.desde ?? null;
    this.rangoHasta = d.rango_disponible.hasta ?? null;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroTexto.set('');
    this.filtroAnotacion.set('todas');
    this.limiteGrupos.set(GRUPOS_POR_PAGINA);
  }

  pct(parte: number, total: number): number {
    return total ? (parte / total) * 100 : 0;
  }

  // ── Hoja de trabajo ──

  reunionesVisibles = computed<SeguimientoReunion[]>(() => {
    const reuniones = this.datos()?.reuniones ?? [];
    return this.soloPendientes() ? reuniones.filter(r => r.registradas < r.total) : reuniones;
  });

  partesVisibles(r: SeguimientoReunion): SeguimientoOcurrencia[] {
    if (!this.soloPendientes()) return r.partes;
    return r.partes.filter(o => !o.seguimiento);
  }

  /** El estado editable de esta fila, creándolo la primera vez desde lo que ya
   *  había guardado. Devuelve siempre la misma referencia. */
  ed(o: SeguimientoOcurrencia): FilaEdicion {
    let fila = this.ediciones.get(o.id_asignacion);
    if (!fila) {
      const s = o.seguimiento;
      fila = {
        tiempo: s?.duracion_real_seg != null ? formatSegundos(s.duracion_real_seg) : '',
        asistio: s?.asistio ?? null,
        notas: s?.notas ?? '',
        estado: 'limpio',
      };
      this.ediciones.set(o.id_asignacion, fila);
    }
    return fila;
  }

  segundosFila(o: SeguimientoOcurrencia): number | null {
    return parseTiempo(this.ed(o).tiempo);
  }

  nivelFila(o: SeguimientoOcurrencia) {
    return nivelDeTiempo(this.segundosFila(o), o.duracion_minutos);
  }

  /** Marcar asistencia guarda al momento: es un clic deliberado, no algo que se
   *  esté escribiendo a medias. */
  marcarAsistencia(o: SeguimientoOcurrencia, v: AsistenciaSeguimiento): void {
    const fila = this.ed(o);
    fila.asistio = fila.asistio === v ? null : v;
    this.guardarFila(o);
  }

  /** Guarda la fila si de verdad cambió algo.
   *
   * Se dispara al salir del campo y no con un botón por fila porque apuntar
   * ocho partes seguidas con ocho botones de guardar es lo que hacía que no se
   * apuntara nada. La comparación contra lo ya guardado evita crear filas
   * vacías por el simple hecho de pasar por encima con el tabulador.
   * `reintento` salta esa comparación: tras un error, lo de la fila no coincide
   * con lo guardado pero el usuario pide volver a mandarlo igual.
   */
  guardarFila(o: SeguimientoOcurrencia, reintento = false): void {
    if (!this.idCong) return;
    const fila = this.ed(o);
    const segundos = parseTiempo(fila.tiempo);
    const notas = fila.notas.trim() || null;
    const s = o.seguimiento;

    const igual =
      (s?.duracion_real_seg ?? null) === segundos &&
      (s?.asistio ?? null) === fila.asistio &&
      (s?.notas ?? null) === notas;
    if (igual && !reintento) return;

    // Todo vacío sobre algo que nunca se guardó: no hay nada que registrar.
    if (!s && segundos == null && fila.asistio == null && notas == null) return;

    // Normaliza lo escrito ("330" → "5:30") para que el campo enseñe lo mismo
    // que se acaba de mandar.
    fila.tiempo = segundos != null ? formatSegundos(segundos) : '';
    fila.estado = 'guardando';

    this.svc.guardarSeguimiento(o.id_asignacion, {
      id_congregacion: this.idCong,
      asistio: fila.asistio,
      duracion_real_seg: segundos,
      notas,
    }).subscribe({
      next: (guardado) => {
        fila.estado = 'guardado';
        this.aplicarEnMemoria(o.id_asignacion, guardado);
        this.cambiado.emit();
        // El acuse se apaga solo: es una confirmación, no un estado.
        setTimeout(() => { if (fila.estado === 'guardado') fila.estado = 'limpio'; }, 2000);
      },
      error: () => { fila.estado = 'error'; },
    });
  }

  // ── Panel de una asignación (el del cronómetro) ──

  abrirPanel(o: SeguimientoOcurrencia): void {
    this.panelObjetivo.set({
      id_asignacion: o.id_asignacion,
      nombre_completo: o.nombre_completo,
      nombre_parte: o.detalle,
      papel: o.papel,
      fecha: o.fecha,
      duracion_minutos: o.duracion_minutos,
      seguimiento: o.seguimiento,
    });
  }

  onGuardado(idAsignacion: number, seg: Seguimiento | null): void {
    this.aplicarEnMemoria(idAsignacion, seg);
    // El panel pudo cambiar el tiempo con el cronómetro: la fila de la hoja de
    // trabajo tiene que enseñar lo mismo.
    this.ediciones.delete(idAsignacion);
    this.cambiado.emit();
  }

  /** Escribe el resultado en el árbol que ya está en memoria en vez de volver a
   *  pedirlo todo: la lista puede ser larga y se está a mitad de apuntar. */
  private aplicarEnMemoria(idAsignacion: number, seg: Seguimiento | null): void {
    const d = this.datos();
    if (!d) return;
    let delta = 0;

    const escribir = (o: SeguimientoOcurrencia) => {
      if (o.id_asignacion !== idAsignacion) return;
      if (!o.seguimiento && seg) delta = 1;
      else if (o.seguimiento && !seg) delta = -1;
      o.seguimiento = seg;
    };

    for (const r of d.reuniones) {
      r.partes.forEach(escribir);
      r.registradas = r.partes.filter(o => o.seguimiento).length;
    }
    for (const p of d.personas) {
      for (const r of p.roles) r.ocurrencias.forEach(escribir);
      p.sin_seguimiento = p.roles
        .flatMap(r => r.ocurrencias)
        .filter(o => !o.seguimiento && o.fecha <= this.hoy).length;
    }

    d.total_con_seguimiento += delta;
    d.total_pendientes -= delta;
    this.datos.set({ ...d });
  }

  // ── Expandir / contraer ──

  toggle(key: string): void {
    const s = new Set(this.expandidos());
    s.has(key) ? s.delete(key) : s.add(key);
    this.expandidos.set(s);
  }

  expandido(key: string): boolean {
    return this.expandidos().has(key);
  }
}

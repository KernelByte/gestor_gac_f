import {
  Component, signal, computed, inject, OnInit, HostListener, DestroyRef, NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { whatsappUrl } from '../../../shared/whatsapp';
import { SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
import { LogisticaService } from '../services/logistica.service';
import { ConflictosService } from '../services/conflictos.service';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  AseoBloqueOut,
  AseoRotacion,
  CLAVE_CANTIDAD_MICROFONO,
  CLAVE_CANTIDAD_VIGILANCIA,
  CLAVE_REQUIERE_REVISION,
  CLAVE_ROTACION_ASEO,
  EnlacePublicoLogistica,
  FechaReunionOut,
  GrupoBase,
  ConflictoLogisticaItem,
  LogisticaAseoOut,
  LogisticaEstado,
  LogisticaItemOut,
  LogisticaMesOut,
  MesDisponible,
  MESES_ES,
  OpcionesPdfLogistica,
  OrientacionPagina,
  PERMISO_LABEL,
  PreferenciaLogistica,
  PUESTO_A_PERMISO,
  PUESTO_ROTACION_CLAVES,
  PUESTOS_LABEL,
  PublicadorBase,
  RebalanceoPropuesta,
  TamanoPagina,
} from '../models/logistica.models';

type Estado = 'idle' | 'loading' | 'ready' | 'error';

/** Cuánto trabajo lleva alguien respecto a la media del mes abierto. */
type NivelCarga = 'baja' | 'normal' | 'alta';

/** Una asignación puntual dentro del detalle expandido de una persona. */
interface AsignacionBalance {
  fecha: string;
  puesto: string;
  puestoLabel: string;
}

/** Una fila del panel de balance: qué le tocó a una persona este mes. */
interface CargaPersonaMes {
  id: number;
  nombre: string;
  total: number;
  /** Etiquetas de los puestos que cubre, para el título de la fila. */
  detalle: string;
  nivel: NivelCarga;
  /** Ancho de la barra, relativo a quien más tareas tiene. */
  pct: number;
  /** Cada asignación que suma el total, ordenada por fecha. */
  asignaciones: AsignacionBalance[];
}

// Agrupaciones de secciones visuales
const SECCION_PUESTOS: Record<string, string[]> = {
  'Acomodadores y Vigilancia': ['acomodador_1', 'acomodador_2', 'vigilancia_1', 'vigilancia_2'],
  'Micrófono y Plataforma':    ['microfono_1', 'microfono_2', 'plataforma'],
  'Audio / Video':             ['audio', 'video'],
};

// Color de identidad por sección. Antes acomodadores y micrófono compartían
// el mismo azul: dos bandas idénticas una debajo de otra que no distinguían
// nada, así que el color no informaba, sólo decoraba. Con un tono por sección
// el ojo ubica de un vistazo en qué bloque está sin leer el título.
const SECCION_COLOR: Record<string, string> = {
  'Acomodadores y Vigilancia': '#0369a1',
  'Micrófono y Plataforma':    '#6d28d9',
  'Audio / Video':             '#0891b2',
  'Aseo':                      '#059669',
};

function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

@Component({
  selector: 'app-reuniones-logistica',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SelectPickerComponent],
  template: `
    <div class="flex flex-col h-full gap-0">

      <!-- ===== BARRA SUPERIOR ===== -->
      <!-- La banda del título iba de lado a lado con el 70% del ancho vacío,
           mientras los controles del mes se apretaban en una fila propia
           dentro del panel. Ahora comparten esta: a la izquierda lo que
           proyecta el shell -el selector de pestaña y el título-, a la derecha
           qué mes se está viendo y qué se puede hacer con él. Es una fila menos
           y ni un pixel de ancho desaprovechado. -->
      <!-- Envuelve sólo en móvil: en escritorio todo va en una línea y quien
           cede espacio es el título, que se recorta. Partir la fila dejaba las
           acciones solas en una segunda banda igual de vacía que la que se
           acaba de aprovechar. -->
      <div class="shrink-0 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 pb-3 min-w-0">

        <ng-content select="[cabecera]"></ng-content>

        <!-- Empuja la bandeja del mes y lo que venga en [accion-derecha]
             juntos al extremo derecho, sin hueco entre ellos. -->
        <span class="hidden md:block md:flex-1" aria-hidden="true"></span>

        @if (mesDatos() && estado() !== 'loading') {
          <!-- ===== BANDEJA DE CONTROL DEL MES ===== -->
          <!-- Antes cada control era su propia píldora suelta sobre el fondo
               de la página: mes y estado a un lado sin chrome propio, y las
               acciones -vista, carga, publicar, borrar- en su propia bandeja
               aparte. Dos superficies para lo que es una sola tarea. Ahora
               todo vive dentro de una única bandeja con su propio fondo y
               borde, como una barra de herramientas real; los separadores
               finos marcan dónde empieza cada grupo sin gastar una etiqueta.
               El color se reserva para lo que importa: violeta cuando algo
               está abierto, ámbar sólo si hay carga desigual, rojo sólo al
               pasar sobre "Borrar". El resto vive en gris hasta que se toca. -->
          <div class="flex flex-wrap items-center gap-0.5 min-w-0 w-full md:w-auto md:ml-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-1">

            <!-- Selector de mes: el propio título es el control.
                 Antes la lista de meses ocupaba una columna fija de unos
                 15rem a la izquierda durante toda la sesión, para algo
                 que se toca una vez al abrir la pantalla; ese ancho es
                 justo el que le faltaba a la tabla, que tiene once
                 columnas y se leía con scroll horizontal. Desplegado
                 desde aquí ocupa ancho sólo mientras se usa. -->
            <div class="relative shrink-0" data-mes-menu>
              <button
                type="button"
                data-testid="log-selector-mes"
                (click)="menuMesesAbierto.set(!menuMesesAbierto())"
                [attr.aria-expanded]="menuMesesAbierto()"
                aria-haspopup="listbox"
                aria-label="Cambiar de mes"
                class="flex items-center gap-1.5 h-8 px-2.5 rounded-xl transition-colors"
                [class]="menuMesesAbierto()
                  ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                  : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'">
                <svg class="w-3.5 h-3.5 shrink-0 text-violet-500/80 dark:text-violet-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 3v3M16 3v3"/></svg>
                <span class="text-sm font-bold whitespace-nowrap">
                  {{ mesLabel({ ano: mesDatos()!.ano, mes: mesDatos()!.mes }) }}
                </span>
                <svg
                  class="w-3.5 h-3.5 shrink-0 opacity-50 transition-transform duration-200"
                  [class.rotate-180]="menuMesesAbierto()"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>

              @if (menuMesesAbierto()) {
                <div
                  role="listbox"
                  aria-label="Meses programados"
                  class="absolute z-40 top-[calc(100%+4px)] left-0 w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
                  <div class="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain simple-scrollbar p-1.5">
                    @for (grupo of mesesPorAno(); track grupo.ano) {
                      <!-- El año como divisor del grupo, no repetido en
                           cada fila: doce "2026" seguidos no distinguen
                           nada. -->
                      <p class="flex items-center gap-2 px-1.5 pt-2.5 pb-1 first:pt-0.5">
                        <span class="text-[0.65rem] font-bold text-slate-400 dark:text-slate-500 data-num">{{ grupo.ano }}</span>
                        <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
                      </p>
                      @for (m of grupo.meses; track m.ano + '-' + m.mes) {
                        <button
                          type="button"
                          role="option"
                          data-testid="log-fila-mes"
                          [attr.data-ano]="m.ano"
                          [attr.data-mes]="m.mes"
                          [attr.aria-selected]="esMesActivo(m)"
                          (click)="cargarMes(m.ano, m.mes); menuMesesAbierto.set(false)"
                          [disabled]="estado() === 'loading'"
                          class="w-full flex items-center gap-2 px-2 h-9 rounded-lg text-xs transition-colors disabled:opacity-40"
                          [class]="esMesActivo(m)
                            ? 'bg-violet-50 dark:bg-violet-900/25 text-violet-700 dark:text-violet-300 font-bold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'">
                          <!-- Punto de estado: el texto va en el title,
                               el color sólo refuerza. -->
                          <span class="w-1.5 h-1.5 rounded-full shrink-0" [class]="puntoEstadoClass(m)" [title]="etiquetaEstadoMes(m)"></span>
                          <span class="flex-1 min-w-0 truncate text-left">{{ mesSoloLabel(m) }}</span>
                          @if (esMesActivo(m)) {
                            <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          }
                        </button>
                      }
                    }
                  </div>
                  <!-- Generar cierra la lista: es lo único de aquí que no
                       es elegir entre lo que ya existe. -->
                  @if (hasEditPermission()) {
                    <div class="shrink-0 p-1.5 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        data-testid="log-btn-generar-mes"
                        (click)="menuMesesAbierto.set(false); abrirModalGenerar()"
                        [disabled]="estado() === 'loading'"
                        class="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-brand-purple hover:brightness-110 disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-[0.98]">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Generar mes
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden="true"></span>

            <div class="flex items-center gap-2 min-w-0 px-1">
              <!-- El texto siempre está: el icono y el color solo refuerzan.
                   Antes era sólo una pastilla de color; un icono distinto por
                   estado -visto, lápiz, alerta, reloj- se reconoce sin leer
                   ni depender del color, y es el mismo lenguaje que ya usa el
                   punto de cada fila en la lista de meses. -->
              <span
                class="shrink-0 flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full text-[0.6rem] font-bold"
                [class]="estadoBadgeClass()">
                @switch (estadoMes()) {
                  @case ('publicado') {
                    <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  }
                  @case ('cambios_sin_publicar') {
                    <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                  }
                  @case ('pendiente_revision') {
                    <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  }
                  @default {
                    <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/></svg>
                  }
                }
                {{ estadoLabel() }}
              </span>
              <!-- Cobertura — el dato que dice si el mes está listo -->
              @if (coberturaLabel()) {
                <span class="hidden md:inline shrink-0 text-[0.65rem] text-slate-500 dark:text-slate-500 data-num">
                  {{ coberturaLabel() }}
                </span>
              }
            </div>

          <!-- Balance de carga: se abre en un panel propio, al lado de la
               tabla en pantallas anchas y como hoja en las estrechas. Antes
               era un desplegable encima de la tabla y abrirlo le robaba
               media pantalla de alto, que es justo donde se trabaja. El
               boton ya adelanta lo unico accionable -cuantos van cargados
               de mas- para que abrirlo sea opcional. -->
          @if (puedeVerBalance() && balanceCarga().length > 0) {
            <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden="true"></span>
            <button
              type="button"
              data-testid="log-btn-balance"
              (click)="alternarPanelBalance()"
              [attr.aria-expanded]="panelBalanceAbierto()"
              [title]="balanceResumen()"
              class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold transition-colors"
              [class]="panelBalanceAbierto()
                ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'">
              <svg class="w-3.5 h-3.5 shrink-0 text-amber-500/80 dark:text-amber-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12.5" y="8" width="3" height="10" rx="1"/><rect x="18" y="14" width="3" height="4" rx="1"/></svg>
              Carga
              @if (balanceConteos().alta > 0) {
                <span class="px-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[0.6rem] font-bold data-num">{{ balanceConteos().alta }}</span>
              }
            </button>
          }

          <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden="true"></span>

          <!-- Acciones del mes. Publicar y Descartar van en la misma píldora
               con rótulo -icono + texto, h-8, rounded-xl- que usan Volver y
               Borrar en Entre semana/Fin de semana: es el mismo par de
               acciones sobre el mismo estado (mes con cambios sin publicar),
               así que se ven igual en las tres pantallas. El resto de
               acciones del mes siguen en icono. -->
          <div class="flex items-center gap-0.5 min-w-0 overflow-x-auto simple-scrollbar md:overflow-visible">
            <!-- Acción primaria: publicar. Una sola cada vez. -->
            @if (puedePublicar()) {
              <button
                data-testid="log-btn-publicar"
                (click)="publicarMes()"
                [disabled]="estado() === 'loading'"
                [title]="conflictosLabel()
                  ? 'Publicar — ' + conflictosLabel()
                  : 'Publicar: hacer visible este mes a la congregación'"
                [attr.aria-label]="conflictosLabel()
                  ? 'Publicar. ' + conflictosLabel()
                  : 'Publicar'"
                class="relative shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.97]">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Publicar
                <!-- Los puestos sin cubrir siguen contándose encima del botón:
                     es la única señal de que publicar todavía no toca. -->
                @if (conflictosLabel()) {
                  <span class="absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[0.6rem] font-bold data-num ring-2 ring-white dark:ring-slate-900">{{ mesDatos()!.conflictos }}</span>
                }
              </button>
            }
            <!-- Volver a lo publicado: junto a Publicar, no dentro del menú.
                 Son la pareja "publicar / deshacer" del mismo estado -mes con
                 cambios sin publicar-, así que van visibles una al lado de la
                 otra en vez de obligar a abrir algo para deshacer. -->
            @if (puedeDescartar()) {
              <button
                data-testid="log-btn-descartar"
                (click)="descartarCambios()"
                [disabled]="estado() === 'loading'"
                title="Descartar: deshacer los cambios y volver a la versión que ve la congregación"
                aria-label="Descartar cambios"
                class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.97]">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/></svg>
                Descartar
              </button>
            }

            <!-- PDF, Compartir y Eliminar viven detrás de un menú: las tres
                 son sobre el mes ya cerrado -exportarlo, difundirlo o
                 borrarlo-, no sobre editarlo, así que se agrupan aparte de
                 Publicar/Descartar en vez de competir por la misma fila.
                 Sin condición de visibilidad: el PDF (ítem del menú) ya
                 estaba siempre presente antes, sólo que a veces deshabilitado
                 mientras el mes no tenía publicación. -->
              <div class="relative shrink-0" data-acciones-menu>
                <button
                  type="button"
                  data-testid="log-btn-acciones"
                  (click)="menuAccionesAbierto.set(!menuAccionesAbierto())"
                  [attr.aria-expanded]="menuAccionesAbierto()"
                  aria-haspopup="menu"
                  title="Más acciones sobre este mes"
                  aria-label="Más acciones sobre este mes"
                  class="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-xl transition-all active:scale-95"
                  [class]="menuAccionesAbierto()
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
                </button>

                @if (menuAccionesAbierto()) {
                  <div role="menu" class="absolute z-40 top-[calc(100%+4px)] right-0 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden p-1.5 flex flex-col gap-0.5">
                    <!-- Vista: cuánto se mira del mes. Vivía como su propio
                         desplegable en la barra; ahora entra aquí para
                         dejarle sitio a Publicar/Descartar cuando la barra
                         no tiene ancho de sobra. No cierra el menú al
                         elegir -es un ajuste, no una acción de una vez-. -->
                    <div class="px-1 pt-0.5 pb-1">
                      <p class="px-1 pb-1 text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Vista</p>
                      <div role="radiogroup" aria-label="Cuánto mostrar del mes" class="flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                        @for (v of vistasPeriodo; track v.id) {
                          <button
                            type="button"
                            role="menuitemradio"
                            [attr.aria-checked]="vistaPeriodo() === v.id"
                            (click)="cambiarVista(v.id)"
                            class="flex-1 h-7 rounded-md text-xs font-semibold transition-colors"
                            [class]="vistaPeriodo() === v.id
                              ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
                            {{ v.full }}
                          </button>
                        }
                      </div>
                    </div>
                    <span class="h-px bg-slate-100 dark:bg-slate-800 mx-1 my-0.5" aria-hidden="true"></span>

                    <!-- PDF — necesita que exista una versión publicada -->
                    <button
                      type="button"
                      role="menuitem"
                      (click)="menuAccionesAbierto.set(false); descargarPdf()"
                      [disabled]="!tienePublicacion() || descargandoPdf()"
                      class="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg text-left text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-40">
                      @if (descargandoPdf()) {
                        <div class="w-4 h-4 shrink-0 mt-px rounded-full border-2 border-emerald-200 border-t-emerald-500 animate-spin"></div>
                      } @else {
                        <svg class="w-4 h-4 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                      }
                      <span class="min-w-0 flex-1">
                        <span class="block text-xs font-bold leading-tight">Descargar PDF</span>
                        <span class="block text-[0.65rem] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">
                          {{ tienePublicacion() ? 'La programación de este mes.' : 'Publica el mes primero.' }}
                        </span>
                      </span>
                    </button>

                    <!-- Compartir: enlace público + WhatsApp + imprimir,
                         todo en un mismo panel. Necesita mes publicado -no
                         tiene sentido dar a conocer una versión que no es la
                         vigente-. -->
                    @if (hasEditPermission() && tienePublicacion()) {
                      <button
                        type="button"
                        role="menuitem"
                        (click)="menuAccionesAbierto.set(false); abrirPanelCompartir()"
                        class="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg text-left text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                        <svg class="w-4 h-4 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"/></svg>
                        <span class="min-w-0 flex-1">
                          <span class="block text-xs font-bold leading-tight">Compartir</span>
                          <span class="block text-[0.65rem] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">Enlace público, WhatsApp o impresión.</span>
                        </span>
                      </button>
                    }

                    @if (hasEditPermission()) {
                      <span class="h-px bg-slate-100 dark:bg-slate-800 mx-1 my-0.5" aria-hidden="true"></span>
                      <button
                        type="button"
                        role="menuitem"
                        data-testid="log-btn-eliminar-mes"
                        (click)="menuAccionesAbierto.set(false); eliminarMes()"
                        [disabled]="estado() === 'loading'"
                        class="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg text-left text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40">
                        <svg class="w-4 h-4 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        <span class="min-w-0 flex-1">
                          <span class="block text-xs font-bold leading-tight">Eliminar el mes</span>
                          <span class="block text-[0.65rem] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">Borra toda la programación de logística.</span>
                        </span>
                      </button>
                    }
                  </div>
                }
              </div>
          </div>

          <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden="true"></span>

          <!-- Salir del mes. Va al final y con rótulo, como en las demás
               pantallas de reuniones: es la única acción de la bandeja que no
               opera sobre el mes sino que lo abandona, y con el resto en
               iconos el texto la separa sin gastar otro filete. -->
          <button
            type="button"
            data-testid="log-btn-volver"
            (click)="volverAListado()"
            title="Volver al listado de programaciones"
            aria-label="Volver al listado de programaciones"
            class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.97]">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Volver
          </button>
        </div>
        }

        <!-- Fuera del @if del mes: sea cual sea el estado, este botón siempre
             cae al extremo derecho de la fila. Con bandeja, se apoya justo
             después de ella; sin bandeja, su propio md:ml-auto lo empuja
             solo. -->
        <ng-content select="[accion-derecha]"></ng-content>
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
           chip lleva a su casilla y la resalta. Todo en una sola linea con
           scroll propio: envueltos, veinte conflictos formaban un bloque rojo
           de cuatro filas que empujaba la tabla fuera de la pantalla. -->
      @if (listaConflictos().length > 0 && mesDatos()) {
        <div class="shrink-0 flex items-center gap-2 min-w-0 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/60 pl-3 pr-2 py-1.5 mb-3">
          <svg class="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          <p class="shrink-0 text-red-700 dark:text-red-300 text-xs font-bold">{{ conflictosLabel() }}</p>
          <div class="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            @for (c of listaConflictos(); track c.id_logistica) {
              <button
                type="button"
                (click)="irAConflicto(c)"
                [title]="'Ir a ' + conflictoEtiqueta(c)"
                class="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 sm:h-7 rounded-full bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-[0.7rem] font-semibold transition-all hover:-translate-y-px hover:border-red-400 active:scale-95">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                {{ conflictoEtiqueta(c) }}
              </button>
            }
          </div>
        </div>
      }

      <!-- ===== LAYOUT principal ===== -->
      <div class="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-4 overflow-hidden">

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
            <!-- Estado vacío. Es el único momento sin barra de mes, así que la
                 lista y el botón de generar viven aquí: sin ellos no habría
                 forma de entrar a la pantalla. Todo vive dentro de una sola
                 tarjeta para que no se vea como piezas sueltas en el centro. -->
            <div class="flex-1 flex items-center justify-center p-6 overflow-y-auto simple-scrollbar">
              <div class="w-full max-w-sm flex flex-col items-center text-center gap-1.5">

                <div class="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mb-2.5">
                  <svg class="w-6 h-6 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>

                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200">Ninguna programación abierta</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-[15rem]">
                  @if (mesesDisponibles().length > 0) {
                    Elige un mes para verlo y editarlo.
                  } @else if (hasEditPermission()) {
                    Genera una nueva programación para comenzar.
                  } @else {
                    No hay logística programada. Consulta con el secretario.
                  }
                </p>

                @if (mesesDisponibles().length > 0) {
                  <!-- Lista en tarjeta y no chips sueltos: filas del mismo ancho,
                       una debajo de otra, se leen como un solo bloque. -->
                  <div class="w-full mt-4 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    @for (m of mesesDisponibles(); track m.ano + '-' + m.mes) {
                      <!-- Aquí sí cabe la etiqueta, a diferencia del
                           desplegable compacto de la barra superior: en vez
                           del punto de 6px -que obligaba a acercarse para
                           distinguir el color-, una píldora con el texto del
                           estado, la misma que ya existía sin usar. -->
                      <button
                        data-testid="log-fila-mes"
                        [attr.data-ano]="m.ano"
                        [attr.data-mes]="m.mes"
                        (click)="cargarMes(m.ano, m.mes)"
                        [disabled]="estado() === 'loading'"
                        class="w-full flex items-center gap-2.5 px-3.5 h-11 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors active:bg-violet-100 dark:active:bg-violet-900/30 disabled:opacity-40">
                        <span class="min-w-0 truncate text-left flex-1">{{ mesLabel(m) }}</span>
                        <span class="shrink-0 px-2 h-5 flex items-center rounded-full text-[0.6rem] font-bold" [class]="badgeEstadoMesClass(m)">{{ etiquetaEstadoMes(m) }}</span>
                        <svg class="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                      </button>
                    }
                  </div>
                }

                @if (hasEditPermission()) {
                  <button
                    data-testid="log-btn-generar-mes"
                    (click)="abrirModalGenerar()"
                    [disabled]="estado() === 'loading'"
                    class="w-full mt-4 flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-brand-purple hover:brightness-110 disabled:opacity-50 text-xs font-bold text-white transition-all shadow-sm active:scale-[0.98]">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Generar mes
                  </button>
                }

              </div>
            </div>
          }

          @if (mesDatos() && estado() !== 'loading') {
            <!-- Navegador del periodo. Solo aparece si hay algo entre lo que
                 elegir: en vista de mes completo no hace falta. -->
            @if (vistaPeriodo() === 'semana' && semanasDelMes().length > 0) {
              <div
                class="shrink-0 flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-800"
                role="tablist" aria-label="Semanas del mes">
                @for (g of semanasDelMes(); track g.iso; let i = $index) {
                  <button
                    type="button"
                    role="tab"
                    [attr.aria-selected]="semanaSel() === i"
                    (click)="semanaSel.set(i)"
                    class="shrink-0 px-3 h-8 rounded-full text-[0.7rem] font-bold whitespace-nowrap border transition-all active:scale-[0.97]"
                    [class]="semanaSel() === i
                      ? 'bg-brand-purple text-white border-brand-purple shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300 hover:text-violet-600'">
                    {{ etiquetaSemana(g) }}
                  </button>
                }
              </div>
            }
            @if (vistaPeriodo() === 'dia' && (mesDatos()!.fechas.length > 0)) {
              <div
                class="shrink-0 flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-800"
                role="tablist" aria-label="Fechas del mes">
                @for (f of mesDatos()!.fechas; track f.fecha; let i = $index) {
                  <button
                    type="button"
                    role="tab"
                    [attr.aria-selected]="diaSel() === i"
                    (click)="diaSel.set(i)"
                    class="shrink-0 px-3 h-8 rounded-full text-[0.7rem] font-bold whitespace-nowrap border transition-all active:scale-[0.97]"
                    [class]="diaSel() === i
                      ? 'bg-brand-purple text-white border-brand-purple shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300 hover:text-violet-600'">
                    {{ formatFecha(f.fecha) }}
                  </button>
                }
              </div>
            }

            <!-- Contenido — scroll -->
            <div class="flex-1 overflow-y-auto simple-scrollbar p-3 md:p-4">

              <!-- ═══════ TARJETAS POR FECHA — siempre en movil, y en escritorio
                   cuando se mira un solo dia (una tarjeta se lee mejor que una
                   tabla de una sola fila con scroll horizontal). ═══════ -->
              <div
                class="flex flex-col gap-3 logistica-stagger"
                [class]="usaTarjetas() ? 'max-w-2xl mx-auto w-full' : 'md:hidden'">
                @for (fecha of fechasVisibles(); track fecha.fecha) {
                  <div class="sec-card sec-bg rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-[var(--shadow-soft)]">
                    <!-- Card header. El día de la semana faltaba: "05
                         Septiembre" no dice si toca entre semana o fin de
                         semana, que es lo primero que se comprueba. -->
                    <div class="flex items-baseline gap-2 px-4 py-2.5 bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10">
                      <span class="font-mono tabular-nums text-base font-bold text-slate-900 dark:text-white">{{ diaNumero(fecha.fecha) }}</span>
                      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ fecha.dia_semana }}</span>
                    </div>
                    <!-- Secciones de puestos -->
                    @for (seccion of seccionesKeys; track seccion) {
                      <div class="sec-card px-4 py-3 border-b border-slate-100 dark:border-slate-800" [style.--sec]="seccionHeaderColor(seccion)">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="w-1.5 h-1.5 rounded-full shrink-0" [style.background]="seccionHeaderColor(seccion)"></span>
                          <span class="sec-ink text-[0.6rem] font-black uppercase tracking-widest">{{ seccion }}</span>
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
                                : esAusente(fecha.fecha, puesto)
                                  ? 'border-amber-400 dark:border-amber-500'
                                  : 'border-slate-200 dark:border-slate-700'">
                              <span class="text-[0.65rem] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide shrink-0">{{ puestoLabel(puesto) }}</span>
                              @if (getAsignacion(fecha.fecha, puesto)?.publicador) {
                                <span class="flex items-center gap-1 min-w-0 justify-end">
                                  @if (esAusente(fecha.fecha, puesto)) {
                                    <svg class="w-3 h-3 shrink-0 text-amber-500" [attr.title]="ausenciaMotivo(fecha.fecha, puesto)" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                  }
                                  <span class="text-xs font-medium text-slate-800 dark:text-slate-100 truncate text-right">{{ getAsignacion(fecha.fecha, puesto)!.publicador!.nombre_completo }}</span>
                                </span>
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
                    <div class="sec-card px-4 py-3" [style.--sec]="seccionHeaderColor('Aseo')">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="w-1.5 h-1.5 rounded-full shrink-0" [style.background]="seccionHeaderColor('Aseo')"></span>
                        <span class="sec-ink text-[0.6rem] font-black uppercase tracking-widest">Aseo del salón</span>
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
              <!-- Sin 'md:flex' estatico: Angular fusiona class con [class], y la
                   regla de media query ganaria sobre el 'hidden' del binding,
                   dejando la tabla visible debajo de la tarjeta en vista de dia. -->
              <div class="md:flex-col gap-6" [class]="usaTarjetas() ? 'hidden' : 'hidden md:flex'">

              <!-- ── Secciones de puestos ── -->
              @for (seccion of seccionesKeys; track seccion) {
                <!-- La sección y su tabla son una sola pieza. Antes eran dos:
                     un título flotante entre dos filetes y, debajo, una tarjeta
                     coronada por una banda azul saturada de lado a lado. La
                     banda pesaba más que los propios nombres -que es lo único
                     que se viene a leer- y repetía el mismo azul en dos
                     secciones seguidas. Ahora el color de identidad cabe en un
                     punto y la cabecera vuelve a ser lo que era: rótulos. -->
                <section class="sec-card sec-bg sec-frame rounded-2xl border shadow-[var(--shadow-soft)] overflow-hidden" [style.--sec]="seccionHeaderColor(seccion)">
                  <header class="sec-surface sec-bg flex items-center gap-2.5 px-4 py-3 border-b">
                    <span class="w-2 h-2 rounded-full shrink-0" [style.background]="seccionHeaderColor(seccion)" aria-hidden="true"></span>
                    <h3 class="sec-ink font-display text-[0.85rem] font-bold tracking-tight">{{ seccion }}</h3>
                  </header>

                  <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                      <thead class="sec-head sec-bg sticky top-0 z-10">
                        <tr class="text-slate-500 dark:text-slate-400">
                          <th class="sec-head sec-bg sticky left-0 z-10 px-4 py-2 text-left text-[0.6rem] font-bold uppercase tracking-widest whitespace-nowrap">Fecha</th>
                          @for (puesto of seccionPuestos(seccion); track puesto) {
                            <th class="px-3 py-2 text-left text-[0.6rem] font-bold uppercase tracking-widest whitespace-nowrap min-w-[140px]">{{ puestoLabel(puesto) }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody class="sec-line divide-y [&>tr]:border-[color:var(--card-line)]">
                        @for (fecha of fechasVisibles(); track fecha.fecha) {
                          <tr class="group transition-colors hover:bg-[color:var(--card-bg-hover)]">
                            <!-- Día y día de semana en una sola columna: el mes
                                 lo dice el selector de arriba, así que escribirlo
                                 diez veces gastaba una columna entera para no
                                 añadir nada. -->
                            <td class="sec-bg sec-bg-hover sticky left-0 z-10 transition-colors px-4 py-2 whitespace-nowrap">
                              <span class="flex items-baseline gap-1.5">
                                <span class="font-mono tabular-nums text-[0.9rem] font-bold text-slate-900 dark:text-white">{{ diaNumero(fecha.fecha) }}</span>
                                <span class="text-[0.65rem] font-medium text-slate-500 dark:text-slate-400">{{ fecha.dia_semana }}</span>
                              </span>
                            </td>
                            @for (puesto of seccionPuestos(seccion); track puesto) {
                              <td class="px-2 py-1">
                                @if (puedeEditar()) {
                                  <!-- Buscador de publicador — ancho de la celda, dropdown flotante -->
                                  <div class="relative w-full min-w-[120px]" [attr.data-cell]="fecha.fecha + '::' + puesto">

                                    <!-- Trigger + input en el mismo espacio (sin salto de tamaño) -->
                                    <!-- En reposo es texto sobre la fila. El borde y el
                                         fondo de campo aparecen al pasar el mouse o al
                                         estar activa: la tabla se lee como datos, no
                                         como un formulario lleno de casillas. El
                                         conflicto si se marca siempre, sin esperar hover. -->
                                    <div class="flex items-center w-full rounded-lg border transition-colors"
                                         [class]="activeCellKey() === (fecha.fecha + '::' + puesto)
                                           ? 'border-violet-400 dark:border-violet-500 ring-1 ring-violet-300 dark:ring-violet-700 bg-white dark:bg-slate-800'
                                           : esConflicto(fecha.fecha, puesto)
                                             ? 'border-red-400 dark:border-red-500 ring-1 ring-red-200 dark:ring-red-800/60 bg-white dark:bg-slate-800'
                                             : esAusente(fecha.fecha, puesto)
                                               ? 'border-amber-400 dark:border-amber-500 ring-1 ring-amber-200 dark:ring-amber-800/60 bg-white dark:bg-slate-800'
                                               : 'border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-600 group-hover:bg-white dark:group-hover:bg-slate-800'">

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
                                            @if (esAusente(fecha.fecha, puesto)) {
                                              <svg class="w-3 h-3 shrink-0 text-amber-500" [attr.title]="ausenciaMotivo(fecha.fecha, puesto)" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                            }
                                            <span class="flex-1 min-w-0 text-[0.8rem] text-slate-800 dark:text-slate-100 truncate">
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
                                          <!-- El lapiz solo se anuncia al pasar por la fila -->
                                          <svg class="w-3 h-3 shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                                        </button>
                                        <!-- Botón quitar (solo si hay asignado) -->
                                        @if (getAsignacion(fecha.fecha, puesto)?.publicador) {
                                          <button
                                            type="button"
                                            (click)="onCambiarPublicador(fecha.fecha, puesto, null)"
                                            title="Quitar asignación"
                                            aria-label="Quitar asignación"
                                            class="shrink-0 px-1.5 py-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-[opacity,color] duration-150 text-base leading-none">
                                            ×
                                          </button>
                                        }
                                      }
                                    </div>
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
                </section>
              }

              <!-- ── Aseo del Salón ── -->
              <section class="sec-card sec-bg sec-frame rounded-2xl border shadow-[var(--shadow-soft)] overflow-hidden" [style.--sec]="seccionHeaderColor('Aseo')">
                <header class="sec-surface sec-bg flex items-center gap-2.5 px-4 py-3 border-b">
                  <span class="w-2 h-2 rounded-full shrink-0" [style.background]="seccionHeaderColor('Aseo')" aria-hidden="true"></span>
                  <h3 class="sec-ink font-display text-[0.85rem] font-bold tracking-tight">Aseo del Salón</h3>
                </header>
                <div class="overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead class="sec-head sec-bg">
                      <tr class="text-slate-500 dark:text-slate-400">
                        <th class="px-4 py-2 text-left text-[0.6rem] font-bold uppercase tracking-widest whitespace-nowrap w-20">{{ aseoCabeceras()[0] }}</th>
                        <th class="px-3 py-2 text-left text-[0.6rem] font-bold uppercase tracking-widest whitespace-nowrap hidden lg:table-cell w-24">{{ aseoCabeceras()[1] }}</th>
                        <th class="px-3 py-2 text-left text-[0.6rem] font-bold uppercase tracking-widest">Grupo asignado</th>
                      </tr>
                    </thead>
                    <tbody class="sec-line divide-y [&>tr]:border-[color:var(--card-line)]">
                      @for (bloque of aseoBloquesVisibles(); track bloque.clave) {
                        <tr class="group transition-colors hover:bg-[color:var(--card-bg-hover)]">
                          <td class="px-4 py-2 whitespace-nowrap font-semibold text-[0.8rem] text-slate-900 dark:text-white">{{ bloque.etiqueta }}</td>
                          <td class="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400 hidden lg:table-cell">{{ bloque.detalle }}</td>
                          <td class="px-3 py-2">
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
              </section>

              </div> <!-- fin grid desktop -->

            </div>
          }

        </div>

        <!-- ── PANEL DE CARGA (acoplado en pantallas anchas) ──
             Ocupa una columna propia en vez de una franja encima de la tabla:
             ninguna de las dos se encoge por abrir la otra, y los saltos a una
             casilla se ven sin cerrar nada. Por debajo de xl no cabe al lado y
             pasa a ser una hoja lateral -o inferior en movil-. -->
        @if (balancePanelVisible()) {
          <aside
            id="panel-balance-carga"
            aria-label="Balance de carga del mes"
            class="hidden xl:flex xl:w-[19rem] 2xl:w-[21rem] shrink-0 flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm balance-dock">
            <ng-container [ngTemplateOutlet]="balancePanelBody"></ng-container>
          </aside>
        }
      </div>

    </div>

    <!-- ===== MODAL REEQUILIBRAR MES ===== -->
    <!-- La propuesta se enseña entera antes de tocar nada: son muchas casillas
         a la vez y aceptar a ciegas un cambio así no es razonable. -->
    @if (rebalanceoAbierto()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarRebalanceo()">
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700"
          (click)="$event.stopPropagation()">

          <div class="shrink-0 px-5 pt-5 pb-3">
            <p class="text-sm font-bold text-slate-900 dark:text-white">Reequilibrar el mes</p>
            @if (rebalanceando() && !rebalanceoPropuesta()) {
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Calculando el reparto…</p>
            } @else if (rebalanceoPropuesta(); as p) {
              @if (p.cambios.length > 0) {
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {{ p.cambios.length }} cambios. El reparto pasa de una desviación de
                  <span class="font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200">{{ p.antes.desviacion }}</span>
                  a
                  <span class="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{{ p.despues.desviacion }}</span>,
                  repartiendo entre {{ p.despues.personas }} personas en vez de {{ p.antes.personas }}.
                </p>
              }
            }
          </div>

          @if (rebalanceoPropuesta(); as p) {
            @if (p.cambios.length > 0) {
              <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar px-3 pb-2">
                @for (c of p.cambios; track c.id_logistica) {
                  <div class="flex items-center gap-2 px-2 py-2 rounded-lg border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span class="shrink-0 w-24 text-[0.65rem] text-slate-500 dark:text-slate-400">
                      {{ formatFecha(c.fecha) }}
                    </span>
                    <span class="shrink-0 w-24 truncate text-[0.65rem] font-semibold text-slate-600 dark:text-slate-300">
                      {{ puestoLabel(c.puesto) }}
                    </span>
                    <span class="flex-1 min-w-0 flex items-center gap-1.5 text-xs">
                      <span class="min-w-0 truncate text-slate-400 dark:text-slate-500 line-through">{{ c.de.nombre_completo }}</span>
                      <svg class="w-3 h-3 shrink-0 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                      <span class="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">{{ c.a.nombre_completo }}</span>
                    </span>
                  </div>
                }
              </div>
            } @else {
              <!-- Un modal vacío parecería un fallo: hay que decir por qué no
                   hay nada que mover. -->
              <div class="flex-1 px-5 py-6 text-center">
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  El mes ya está todo lo repartido que se puede sin crear choques.
                </p>
                @if (p.protegidas_manual > 0) {
                  <p class="text-[0.7rem] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
                    {{ p.protegidas_manual }} {{ p.protegidas_manual === 1 ? 'casilla asignada' : 'casillas asignadas' }} a mano
                    {{ p.protegidas_manual === 1 ? 'quedó' : 'quedaron' }} sin tocar.
                  </p>
                }
              </div>
            }
          }

          <div class="shrink-0 flex items-center gap-2 justify-end px-5 py-3 border-t border-slate-100 dark:border-slate-800">
            @if (rebalanceoPropuesta()?.protegidas_manual && rebalanceoPropuesta()!.cambios.length > 0) {
              <p class="flex-1 min-w-0 text-[0.65rem] text-slate-400 dark:text-slate-500 leading-tight">
                No se toca lo que asignaste a mano.
              </p>
            }
            <button (click)="cerrarRebalanceo()"
              class="shrink-0 px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              {{ rebalanceoPropuesta()?.cambios?.length ? 'Cancelar' : 'Cerrar' }}
            </button>
            @if (rebalanceoPropuesta()?.cambios?.length) {
              <button (click)="aplicarRebalanceo()"
                [disabled]="rebalanceando()"
                data-testid="log-btn-aplicar-rebalanceo"
                class="shrink-0 px-4 h-9 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-40">
                Aplicar
              </button>
            }
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL CONFIRMACIÓN ===== -->
    @if (confirmPendiente()) {
      <div data-testid="log-modal-confirm" class="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
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

    <!-- ===== PANEL COMPARTIR Y PUBLICAR ===== -->
    <!-- Agrupa enlace público, WhatsApp e impresión: las tres formas de sacar
         el programa del sistema, en un solo sitio, como pide el documento de
         gerencia ("Reúne, en un solo panel..."). Solo lectura/difusión: nada
         de lo que hay aquí reasigna ni cambia el programa. -->
    @if (panelCompartirAbierto()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarPanelCompartir()">
        <div class="w-full max-w-lg max-h-[90dvh] overflow-y-auto simple-scrollbar bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col" (click)="$event.stopPropagation()">

          <div class="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div class="min-w-0">
              <h2 class="text-sm font-black text-slate-800 dark:text-white">Compartir y publicar</h2>
              @if (mesDatos()) {
                <p class="text-[0.7rem] text-slate-500 dark:text-slate-400 mt-0.5">{{ mesLabel({ ano: mesDatos()!.ano, mes: mesDatos()!.mes }) }}</p>
              }
            </div>
            <button (click)="cerrarPanelCompartir()" aria-label="Cerrar" class="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="p-5 space-y-4">

            <!-- Card: enlace público -->
            <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div class="flex items-center gap-1.5 mb-1">
                <svg class="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 13a5 5 0 007.07 0l1.93-1.93a5 5 0 00-7.07-7.07L10.5 5.5"/><path d="M14 11a5 5 0 00-7.07 0l-1.93 1.93a5 5 0 007.07 7.07L13.5 18.5"/></svg>
                <span class="text-[0.65rem] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Enlace público</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">Compártelo con el ayudante de cartelera: desde ahí puede enviar las asignaciones por WhatsApp antes de cada reunión, sin iniciar sesión. Expira solo.</p>

              @if (cargandoEnlace()) {
                <p class="text-xs text-slate-400">Cargando…</p>
              } @else if (!enlaceActivo()) {
                <button
                  (click)="generarEnlacePublico()"
                  [disabled]="generandoEnlace()"
                  class="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50">
                  {{ generandoEnlace() ? 'Generando…' : 'Generar enlace' }}
                </button>
              } @else {
                <a [href]="enlaceActivo()!.url_publica" target="_blank" rel="noopener" class="block text-xs text-violet-600 dark:text-violet-400 font-medium truncate hover:underline">
                  {{ enlaceActivo()!.url_publica }}
                </a>

                @if (!editandoFechaEnlace()) {
                  <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span>Expira el {{ enlaceActivo()!.fecha_expiracion | date:'d MMM y':'':'es' }}</span>
                    <button (click)="abrirEdicionFechaEnlace()" type="button" class="font-semibold text-violet-600 dark:text-violet-400 hover:underline">Cambiar fecha</button>
                  </p>
                } @else {
                  <div class="mt-2 flex items-center gap-2 flex-wrap">
                    <input type="date" [(ngModel)]="fechaEnlaceInput" class="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200" />
                    <button (click)="guardarFechaEnlace()" [disabled]="!fechaEnlaceInput" class="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold disabled:opacity-50">Guardar</button>
                    <button (click)="editandoFechaEnlace.set(false)" class="h-8 px-3 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                  </div>
                }

                <div class="flex gap-2 mt-3">
                  <button (click)="copiarEnlace()" class="flex-1 h-9 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    {{ copiadoEnlace() ? 'Copiado ✓' : 'Copiar enlace' }}
                  </button>
                  <button (click)="revocarEnlacePublico()" class="h-9 px-3 rounded-lg border border-red-300 dark:border-red-700 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                    Revocar
                  </button>
                </div>
              }
            </div>

            <!-- Card: WhatsApp -->
            <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div class="flex items-center gap-1.5 mb-1">
                <svg class="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A8.86 8.86 0 0011.94 4a8.94 8.94 0 00-7.74 13.4L3 21l3.7-1.17a8.9 8.9 0 004.24 1.08h.01a8.94 8.94 0 006.65-14.6zm-5.66 13.7a7.4 7.4 0 01-3.78-1.04l-.27-.16-2.8.88.9-2.73-.18-.28a7.44 7.44 0 1113.86-3.9 7.43 7.43 0 01-7.73 7.23zm4.08-5.56c-.22-.11-1.31-.65-1.51-.72s-.35-.11-.5.11-.58.72-.71.87-.26.17-.48.06a6.1 6.1 0 01-1.8-1.11 6.75 6.75 0 01-1.24-1.55c-.13-.22 0-.34.1-.45s.22-.26.33-.39a1.5 1.5 0 00.22-.37.4.4 0 000-.39c-.06-.11-.5-1.2-.68-1.65s-.36-.37-.5-.38h-.43a.82.82 0 00-.6.28 2.5 2.5 0 00-.78 1.86 4.36 4.36 0 00.91 2.3 9.99 9.99 0 003.82 3.37 4.3 4.3 0 002.69.56 2.3 2.3 0 001.51-1.06 1.87 1.87 0 00.13-1.06c-.05-.1-.2-.15-.42-.26z"/></svg>
                <span class="text-[0.65rem] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Compartir por WhatsApp</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">Resumen de una reunión: tema, apoyo en auditorio y grupos.</p>

              @if (mesDatos()?.fechas?.length) {
                <label class="block mb-2">
                  <span class="block text-[0.6rem] font-bold uppercase tracking-wide text-slate-400 mb-1">Fecha</span>
                  <app-select-picker
                    [(ngModel)]="whatsappFechaSeleccionada"
                    [options]="whatsappFechaOptions()"
                    [clearable]="false"
                    colorScheme="violet"
                    ariaLabel="Fecha">
                  </app-select-picker>
                </label>
                <button
                  (click)="abrirWhatsapp()"
                  [disabled]="cargandoWhatsapp() || !whatsappFechaSeleccionada"
                  class="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50">
                  {{ cargandoWhatsapp() ? 'Preparando…' : 'Redactar mensaje' }}
                </button>
              } @else {
                <p class="text-xs text-slate-400">Este mes no tiene fechas programadas.</p>
              }
            </div>

            <!-- Card: imprimir -->
            <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div class="flex items-center gap-1.5 mb-1">
                <svg class="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
                <span class="text-[0.65rem] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Imprimir</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">Vista lista para imprimir o guardar como PDF.</p>
              <button
                (click)="abrirOpcionesImpresion()"
                class="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                Opciones de impresión
              </button>
            </div>

          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL WHATSAPP: revisar antes de enviar ===== -->
    @if (whatsappAbierto()) {
      <div class="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarWhatsapp()">
        <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col" (click)="$event.stopPropagation()">
          <div class="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-sm font-black text-slate-800 dark:text-white">Revisar mensaje</h2>
            <button (click)="cerrarWhatsapp()" aria-label="Cerrar" class="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="p-5">
            <textarea
              [ngModel]="whatsappMensaje()"
              (ngModelChange)="whatsappMensaje.set($event)"
              rows="12"
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200 font-mono"></textarea>
          </div>
          <div class="shrink-0 flex gap-2 justify-end px-5 py-4 border-t border-slate-100 dark:border-slate-800">
            <button (click)="cerrarWhatsapp()" class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button (click)="enviarWhatsapp()" class="px-4 h-9 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95">Enviar por WhatsApp</button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL OPCIONES DE IMPRESIÓN ===== -->
    @if (imprimirOpcionesAbierto()) {
      <div class="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarOpcionesImpresion()">
        <div class="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-4" (click)="$event.stopPropagation()">
          <h2 class="text-sm font-black text-slate-800 dark:text-white">Opciones de impresión</h2>

          <label class="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" [ngModel]="opcionIncluirDiscursos()" (ngModelChange)="opcionIncluirDiscursos.set($event)" class="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
            <span class="text-xs text-slate-700 dark:text-slate-200">Incluir discursos públicos del mes siguiente</span>
          </label>

          <div>
            <span class="block text-[0.65rem] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Tamaño de página</span>
            <div class="flex gap-2">
              <button type="button" (click)="opcionTamanoPagina.set('carta')" class="flex-1 h-9 rounded-lg border text-xs font-bold transition-all" [class]="opcionTamanoPagina()==='carta' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'">Carta</button>
              <button type="button" (click)="opcionTamanoPagina.set('a4')" class="flex-1 h-9 rounded-lg border text-xs font-bold transition-all" [class]="opcionTamanoPagina()==='a4' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'">A4</button>
            </div>
          </div>

          <div>
            <span class="block text-[0.65rem] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Orientación</span>
            <div class="flex gap-2">
              <button type="button" (click)="opcionOrientacion.set('vertical')" class="flex-1 h-9 rounded-lg border text-xs font-bold transition-all" [class]="opcionOrientacion()==='vertical' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'">Vertical</button>
              <button type="button" (click)="opcionOrientacion.set('horizontal')" class="flex-1 h-9 rounded-lg border text-xs font-bold transition-all" [class]="opcionOrientacion()==='horizontal' ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'">Horizontal</button>
            </div>
          </div>

          <div class="flex gap-2 justify-end mt-1">
            <button (click)="cerrarOpcionesImpresion()" class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button (click)="confirmarImpresion()" [disabled]="descargandoPdf()" class="px-4 h-9 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition-all active:scale-95 disabled:opacity-50">
              {{ descargandoPdf() ? 'Generando…' : 'Descargar PDF' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL GENERAR MES ===== -->
    @if (modalGenerarAbierto()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarModal()">
        <div data-testid="log-modal-generar" class="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-5" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-base font-black text-slate-800 dark:text-white">Generar programación</h2>
            <!-- Cómo se arma la programación de esta congregación. Vive detrás de
                 un botón y no en este modal porque no es una decisión de este mes:
                 se configura una vez y vale para todos los meses siguientes. -->
            <button
              type="button"
              data-testid="log-btn-config"
              (click)="abrirModalConfig()"
              title="Configurar cómo se genera la programación"
              class="shrink-0 -mr-2 flex items-center gap-1.5 px-2 h-8 rounded-lg text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors focus-ring">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>
              </svg>
              Configuración
            </button>
          </div>
          <div class="flex gap-3">
            <div class="flex-1 flex flex-col gap-1">
              <label class="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mes</label>
              <div class="relative">
                @if (mesModalDropdownAbierto()) {
                  <div class="fixed inset-0 z-[59]" (click)="mesModalDropdownAbierto.set(false)"></div>
                }
                <button type="button" data-testid="log-generar-mes" (click)="mesModalDropdownAbierto.set(!mesModalDropdownAbierto())"
                  class="h-9 w-full px-3 rounded-xl border bg-white dark:bg-slate-800 text-sm text-left flex items-center justify-between gap-2 outline-none transition-[border-color,background-color] duration-150 ease-out"
                  [class]="mesModalDropdownAbierto() ? 'border-violet-500 ring-2 ring-violet-400/30' : 'border-slate-200 dark:border-slate-600 hover:border-violet-300 dark:hover:border-violet-700'">
                  <span class="text-slate-800 dark:text-slate-100">{{ mesesOpciones[modalMes - 1].label }}</span>
                  <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-150" [class.rotate-180]="mesModalDropdownAbierto()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
                @if (mesModalDropdownAbierto()) {
                  <div class="absolute left-0 top-full mt-1.5 w-full max-h-64 overflow-y-auto simple-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[60] py-1.5">
                    @for (m of mesesOpcionesDesc; track m.value) {
                      <button type="button" data-testid="log-opcion-mes" [attr.data-mes]="m.value"
                        (click)="modalMes = m.value; mesModalDropdownAbierto.set(false)"
                        class="w-full px-3.5 py-2 text-sm font-semibold text-left transition-colors duration-100"
                        [class]="modalMes === m.value ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'">
                        {{ m.label }}
                      </button>
                    }
                  </div>
                }
              </div>
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

          <!-- La rotación del aseo y las demás particularidades de esta
               congregación viven en "Configuración" (botón de arriba): son
               permanentes, no una elección de este mes puntual. -->

          <div class="flex gap-2 justify-end pt-1">
            <button (click)="cerrarModal()" class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
              Cancelar
            </button>
            <button
              data-testid="log-btn-generar"
              (click)="generarMes()"
              [disabled]="estado() === 'loading'"
              class="px-5 h-9 rounded-xl text-xs font-bold text-white bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 transition-all active:scale-95">
              Generar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL CONFIGURACIÓN DE GENERACIÓN ===== -->
    <!-- z-[70]: se abre encima del modal de generar y de su desplegable de mes. -->
    @if (modalConfigAbierto()) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarModalConfig()">
        <div
          data-testid="log-modal-config"
          role="dialog"
          aria-modal="true"
          aria-labelledby="log-config-titulo"
          class="w-full max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          (click)="$event.stopPropagation()">

          <div class="shrink-0 flex items-start gap-3 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div class="min-w-0 flex-1">
              <h2 id="log-config-titulo" class="text-base font-black text-slate-800 dark:text-white">Cómo se genera</h2>
              <p class="text-[0.7rem] leading-snug text-slate-500 dark:text-slate-400 mt-0.5">
                La forma de trabajar de esta congregación. Se guarda al momento y
                vale para todos los meses que se generen a partir de ahora.
              </p>
            </div>
            <button
              type="button"
              (click)="cerrarModalConfig()"
              aria-label="Cerrar configuración"
              class="shrink-0 -mr-2 -mt-1 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-ring">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto simple-scrollbar px-6 py-4">
            @if (configCargando()) {
              <div class="flex flex-col gap-2.5" aria-hidden="true">
                @for (fila of filasEsqueletoConfig; track fila) {
                  <div class="flex items-center gap-3">
                    <div class="flex-1 h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
                    <div class="w-28 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
                  </div>
                }
              </div>
            } @else {
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Rotación
              </p>
              <p class="text-[0.7rem] leading-snug text-slate-500 dark:text-slate-400 mt-1 mb-2">
                Por reunión rota siempre; por semana repite entre semana y fin de
                semana; por mes deja a la misma persona todo el mes.
              </p>

              <div class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (f of filasRotacion; track f.clave) {
                  <div class="flex items-center gap-2 py-1.5">
                    <p class="min-w-0 flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                      {{ f.label }}
                    </p>
                    <!-- Ancho reservado siempre: el spinner se desvanece en su
                         sitio en vez de empujar el selector al aparecer. -->
                    <div class="w-3 h-3 shrink-0 border-2 border-violet-400 border-t-transparent rounded-full animate-spin transition-opacity duration-150"
                         [class.opacity-0]="configGuardando() !== f.clave"
                         aria-hidden="true"></div>
                    <div
                      role="radiogroup"
                      [attr.aria-label]="f.label + ': rotación'"
                      class="inline-flex shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5">
                      @for (op of opcionesPref(f.clave); track op.id) {
                        <button
                          type="button"
                          role="radio"
                          [attr.data-testid]="'log-rot-' + f.testid + '-' + op.id"
                          [attr.aria-checked]="valorPref(f.clave) === op.id"
                          [attr.title]="op.description"
                          [disabled]="configGuardando() !== null"
                          (click)="guardarPreferencia(f.clave, op.id)"
                          class="px-2.5 h-6 rounded-md text-[0.65rem] font-bold transition-colors duration-150 disabled:cursor-not-allowed"
                          [class]="valorPref(f.clave) === op.id
                            ? 'bg-[#6D28D9] text-white'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:hover:text-slate-500'">
                          {{ op.label }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Cantidad de puestos
                </p>
                <p class="text-[0.7rem] leading-snug text-slate-500 dark:text-slate-400 mt-1 mb-2">
                  Algunas congregaciones solo tienen una persona habilitada para
                  vigilancia o micrófono.
                </p>

                <div class="divide-y divide-slate-100 dark:divide-slate-800">
                  @for (f of filasCantidad; track f.clave) {
                    <div class="flex items-center gap-2 py-1.5">
                      <p class="min-w-0 flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                        {{ f.label }}
                      </p>
                      <div class="w-3 h-3 shrink-0 border-2 border-violet-400 border-t-transparent rounded-full animate-spin transition-opacity duration-150"
                           [class.opacity-0]="configGuardando() !== f.clave"
                           aria-hidden="true"></div>
                      <div
                        role="radiogroup"
                        [attr.aria-label]="f.label + ': cantidad de puestos'"
                        class="inline-flex shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5">
                        @for (op of opcionesPref(f.clave); track op.id) {
                          <button
                            type="button"
                            role="radio"
                            [attr.data-testid]="'log-cant-' + f.testid + '-' + op.id"
                            [attr.aria-checked]="valorPref(f.clave) === op.id"
                            [attr.title]="op.description"
                            [disabled]="configGuardando() !== null"
                            (click)="guardarPreferencia(f.clave, op.id)"
                            class="px-2.5 h-6 rounded-md text-[0.65rem] font-bold transition-colors duration-150 disabled:cursor-not-allowed"
                            [class]="valorPref(f.clave) === op.id
                              ? 'bg-[#6D28D9] text-white'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:hover:text-slate-500'">
                            {{ op.label }}
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div class="flex items-center gap-2">
                  <p class="min-w-0 flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                    Que otra persona revise antes de publicar
                  </p>
                  <div class="w-3 h-3 shrink-0 border-2 border-violet-400 border-t-transparent rounded-full animate-spin transition-opacity duration-150"
                       [class.opacity-0]="configGuardando() !== claveRequiereRevision"
                       aria-hidden="true"></div>
                  <div
                    role="radiogroup"
                    aria-label="Exigir revisión antes de publicar"
                    class="inline-flex shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5">
                    @for (op of opcionesPref(claveRequiereRevision); track op.id) {
                      <button
                        type="button"
                        role="radio"
                        [attr.data-testid]="'log-revision-' + op.id"
                        [attr.aria-checked]="valorPref(claveRequiereRevision) === op.id"
                        [attr.title]="op.description"
                        [disabled]="configGuardando() !== null"
                        (click)="guardarPreferencia(claveRequiereRevision, op.id)"
                        class="px-2.5 h-6 rounded-md text-[0.65rem] font-bold transition-colors duration-150 disabled:cursor-not-allowed"
                        [class]="valorPref(claveRequiereRevision) === op.id
                          ? 'bg-[#6D28D9] text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:hover:text-slate-500'">
                        {{ op.label }}
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="shrink-0 flex items-center gap-3 px-6 py-3 border-t border-slate-100 dark:border-slate-800">
            <p class="min-w-0 flex-1 text-[0.65rem] leading-snug"
               [class]="configError()
                 ? 'text-red-600 dark:text-red-400 font-bold'
                 : 'text-slate-400 dark:text-slate-500'">
              {{ configError() ?? 'Los cambios se guardan solos.' }}
            </p>
            <button
              type="button"
              (click)="cerrarModalConfig()"
              class="shrink-0 px-4 h-9 rounded-xl text-xs font-bold text-white bg-[#6D28D9] hover:bg-[#5b21b6] transition-all active:scale-95 focus-ring">
              Listo
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== BALANCE DE CARGA: cuerpo compartido ===== -->
    <!-- Un solo cuerpo para las dos presentaciones -columna acoplada en xl y
         hoja por debajo-: dos copias del mismo listado se habrian separado a
         la primera correccion. -->
    <ng-template #balancePanelBody>
      <!-- Encabezado: la conclusion antes que la lista. Quien abre esto
           pregunta "a quien le estoy pidiendo de mas", y la media es la vara
           con la que se mide esa respuesta. -->
      <div class="shrink-0 flex items-start gap-3 px-4 pt-3.5 pb-3">
        <div class="min-w-0 flex-1">
          <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Balance de carga</p>
          <p class="flex items-baseline gap-1.5 mt-1">
            <span class="text-xl font-black leading-none text-slate-900 dark:text-white data-num">{{ promedioCargaLabel() }}</span>
            <span class="text-[0.7rem] text-slate-500 dark:text-slate-400">tareas de media · {{ balanceCarga().length }} personas</span>
          </p>
        </div>
        <button
          type="button"
          (click)="cerrarPanelBalance()"
          aria-label="Cerrar balance de carga"
          title="Cerrar"
          class="shrink-0 w-8 h-8 -mr-1 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Buscar y acotar: con treinta nombres, recorrer la lista a ojo para
           comprobar a una persona concreta es el gasto real de esta pantalla. -->
      <div class="shrink-0 px-4 pb-3 flex flex-col gap-2">
        <div class="flex items-center gap-2 px-2.5 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 focus-within:border-violet-400 dark:focus-within:border-violet-500 transition-colors">
          <svg class="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            class="flex-1 min-w-0 text-xs bg-transparent text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400"
            placeholder="Buscar persona..."
            aria-label="Buscar persona en el balance de carga"
            [value]="balanceBusqueda()"
            (input)="balanceBusqueda.set($any($event.target).value)"
            autocomplete="off"
            spellcheck="false" />
          @if (balanceBusqueda()) {
            <button
              type="button"
              (click)="balanceBusqueda.set('')"
              aria-label="Limpiar búsqueda"
              class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          }
        </div>
        <!-- Solo los dos extremos se pueden filtrar: "normal" no lleva a
             ninguna decision, y ofrecerlo solo alarga el interruptor. -->
        <div class="flex items-center gap-1" role="group" aria-label="Filtrar por nivel de carga">
          @for (f of balanceFiltros; track f.id) {
            <button
              type="button"
              (click)="balanceFiltro.set(f.id)"
              [attr.aria-pressed]="balanceFiltro() === f.id"
              class="flex-1 flex items-center justify-center gap-1.5 h-7 px-2 rounded-lg border text-[0.65rem] font-bold transition-colors"
              [class]="balanceFiltro() === f.id
                ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'">
              {{ f.label }}
              <span class="data-num opacity-60">{{ balanceConteos()[f.id] }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Lista con el scroll aqui dentro: el encabezado y la nota del pie no
           se van con ella. -->
      <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain simple-scrollbar px-2 pb-2">
        @for (grupo of balanceGrupos(); track grupo.nivel) {
          <!-- El nivel va en el encabezado del grupo y no repetido en una
               etiqueta por fila: treinta pastillas diciendo lo mismo son ruido,
               y agrupar deja el desequilibrio visible de un vistazo. -->
          <p
            class="sticky top-0 z-10 flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-slate-900 text-[0.6rem] font-black uppercase tracking-wider"
            [class]="nivelTextoClass(grupo.nivel)">
            <span class="w-1.5 h-1.5 rounded-full shrink-0" [class]="nivelBarraClass(grupo.nivel)"></span>
            {{ grupo.label }}
            <span class="data-num opacity-60">{{ grupo.filas.length }}</span>
          </p>
          @for (f of grupo.filas; track f.id) {
            <div class="min-w-0">
              <button
                type="button"
                (click)="toggleExpandirPersona(f.id)"
                [attr.aria-expanded]="personaExpandida() === f.id"
                class="w-full h-9 flex items-center gap-2 min-w-0 px-2 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800">
                <svg
                  class="w-3 h-3 shrink-0 text-slate-300 dark:text-slate-600 transition-transform duration-200"
                  [class.rotate-90]="personaExpandida() === f.id"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                <span class="min-w-0 flex-1 truncate text-left text-xs text-slate-700 dark:text-slate-200">{{ f.nombre }}</span>
                <!-- La barra es apoyo visual; el numero va aparte para no
                     depender solo del color ni del largo. -->
                <span class="w-12 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0" aria-hidden="true">
                  <span class="block h-full rounded-full transition-[width] duration-300 ease-out" [class]="nivelBarraClass(f.nivel)" [style.width.%]="f.pct"></span>
                </span>
                <span class="w-4 text-right text-xs font-bold text-slate-800 dark:text-slate-100 data-num shrink-0">{{ f.total }}</span>
              </button>

              @if (personaExpandida() === f.id) {
                <!-- Chips de solo lectura: cada uno salta a su celda en la
                     tabla, mismo mecanismo que los conflictos de arriba. -->
                <div class="flex flex-col gap-1.5 pl-7 pr-2 pb-2.5 pt-0.5">
                  @for (a of f.asignaciones; track a.fecha + a.puesto) {
                    <div class="flex items-center gap-1 min-w-0">
                      <button
                        type="button"
                        (click)="irACeldaBalance(a)"
                        class="flex-1 min-w-0 truncate text-left inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[0.65rem] font-medium transition-all hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-700 dark:hover:text-violet-300 active:scale-95">
                        {{ formatFecha(a.fecha) }} · {{ a.puestoLabel }}
                      </button>
                      <!-- Pasarle esta parte a alguien menos cargado. Sólo con
                           permiso de edición: sin él el panel sigue siendo de
                           consulta, como hasta ahora. -->
                      @if (puedeEditar()) {
                        <button
                          type="button"
                          (click)="abrirReemplazo(a)"
                          [attr.aria-expanded]="reemplazoAbierto()?.fecha === a.fecha && reemplazoAbierto()?.puesto === a.puesto"
                          [title]="'Pasar ' + a.puestoLabel + ' del ' + formatFecha(a.fecha) + ' a otra persona'"
                          aria-label="Pasar esta parte a otra persona"
                          class="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border transition-colors active:scale-95"
                          [class]="reemplazoAbierto()?.fecha === a.fecha && reemplazoAbierto()?.puesto === a.puesto
                            ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400'">
                          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
                        </button>
                      }
                    </div>

                    @if (reemplazoAbierto()?.fecha === a.fecha && reemplazoAbierto()?.puesto === a.puesto) {
                      <div class="rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/40 dark:bg-violet-900/10 p-1.5 mb-1">
                        @if (candidatosParaAliviar(a).length > 0) {
                          <p class="text-[0.55rem] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 px-1.5 pb-1">
                            Pasar a quien va con menos
                          </p>
                          @for (c of candidatosParaAliviar(a); track c.id_publicador) {
                            <button
                              type="button"
                              (click)="reemplazarDesdeBalance(a, c.id_publicador)"
                              class="w-full flex items-center gap-2 px-2 h-8 rounded-lg text-left transition-colors hover:bg-white dark:hover:bg-slate-800 active:scale-[0.98]">
                              <span class="flex-1 min-w-0 truncate text-[0.7rem] text-slate-700 dark:text-slate-200">{{ c.nombre_completo }}</span>
                              <!-- Su carga actual: es el dato por el que se
                                   elige, así que va al lado del nombre. -->
                              <span class="shrink-0 font-mono tabular-nums text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-400">{{ cargaDe(c.id_publicador) }}</span>
                            </button>
                          }
                        } @else {
                          <p class="text-[0.65rem] text-slate-500 dark:text-slate-400 px-2 py-2 leading-relaxed">
                            Nadie con este permiso está libre ese día y va con menos carga.
                          </p>
                        }
                      </div>
                    }
                  }
                </div>
              }
            </div>
          }
        } @empty {
          <p class="px-4 py-8 text-center text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            Nadie coincide con lo que buscas.
          </p>
        }
      </div>

      <!-- Fuera del area con scroll: la pista y el enlace deben verse siempre,
           sin bajar hasta el final de treinta nombres. -->
      <p class="shrink-0 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/70 text-[0.65rem] leading-relaxed text-slate-500 dark:text-slate-400">
        Alta o baja es respecto a la media de este mes, no a un numero fijo. No incluye el aseo, que se asigna por grupo.
        @if (puedeVerReporteCarga()) {
          <a routerLink="/reportes/logistica" class="font-semibold text-violet-600 dark:text-violet-400 hover:underline">Ver varios meses</a>
        }
      </p>

      <!-- Reparto de todo el mes de una vez. No aplica nada al pulsar: abre la
           propuesta para revisarla. -->
      @if (puedeEditar()) {
        <div class="shrink-0 px-4 pb-3">
          <button
            type="button"
            data-testid="log-btn-rebalancear"
            (click)="pedirRebalanceo()"
            [disabled]="rebalanceando()"
            class="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs font-bold hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all active:scale-[0.98] disabled:opacity-40">
            @if (rebalanceando()) {
              <div class="w-3.5 h-3.5 rounded-full border-2 border-violet-200 border-t-violet-500 animate-spin"></div>
              Calculando…
            } @else {
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
              Reequilibrar el mes
            }
          </button>
        </div>
      }
    </ng-template>

    <!-- ===== BALANCE DE CARGA: hoja (por debajo de xl) ===== -->
    @if (balancePanelVisible()) {
      <div
        class="xl:hidden fixed inset-0 z-[58] bg-slate-900/40 backdrop-blur-sm sheet-overlay"
        (click)="cerrarPanelBalance()">
        <!-- Movil: hoja inferior, el gesto que ya usan los otros paneles.
             Tablet: hoja lateral, que deja la tabla a la vista mientras se
             salta de una asignacion a otra. -->
        <div
          class="absolute inset-x-0 bottom-0 max-h-[85dvh] rounded-tl-3xl rounded-tr-3xl border-t
                 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[21rem] sm:max-h-none sm:rounded-tl-2xl sm:rounded-tr-none sm:rounded-bl-2xl sm:border-t-0 sm:border-l
                 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col balance-sheet"
          (click)="$event.stopPropagation()">
          <div class="shrink-0 sm:hidden pt-2.5 pb-1 flex justify-center">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>
          <ng-container [ngTemplateOutlet]="balancePanelBody"></ng-container>
        </div>
      </div>
    }

    <!-- ===== POPOVER ESCRITORIO: COMBOBOX BÚSQUEDA PUBLICADOR ===== -->
    <!-- Vivía como <div absolute> dentro de la celda, adentro de la tabla con
         overflow-x-auto. Ese contenedor recorta también en vertical -es como
         funciona overflow: si un eje no es "visible" el otro deja de serlo
         también-, así que en las filas de arriba el desplegable quedaba
         cortado por su propio techo y quien lo abría lo veía nacer detrás de
         la cabecera pegajosa, como un elemento roto. Ahora es uno solo,
         fijo respecto al viewport y calculado con la posición real del
         disparador: nunca vive dentro de un contenedor con scroll, así que
         nada vuelve a recortarlo. -->
    @if (activeCellKey() && puedeEditar() && comboboxPos(); as pos) {
      <div
        class="hidden md:block fixed z-[70] w-72 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl simple-scrollbar combobox-pop"
        data-combobox-popover
        [style.top.px]="pos.top"
        [style.left.px]="pos.left"
        [style.transform]="pos.openUp ? 'translateY(-100%)' : 'none'">

        @if (activeCellAsignacion()?.publicador) {
          <button
            type="button"
            (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(null)"
            class="w-full text-left text-xs px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800">
            <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            Quitar asignación
          </button>
        }

        <!-- Habilitados y libres ese día: los que de verdad sirven de
             reemplazo. Antes iban mezclados con quienes ya tenían una parte
             en otra reunión, así que elegir al primero de la lista era jugar
             a la lotería y el choque sólo se descubría al guardar. -->
        @if (candidatosLibres(activeCellPuesto()).length > 0) {
          <p class="text-[0.55rem] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-3 pt-2.5 pb-1">
            Libres ese día
          </p>
          @for (c of candidatosLibres(activeCellPuesto()); track c.id_publicador) {
            <button
              type="button"
              (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(c.id_publicador)"
              [class]="'w-full text-left text-xs px-3 py-2 transition-colors ' + (activeCellAsignacion()?.publicador?.id_publicador === c.id_publicador ? 'bg-violet-50 dark:bg-violet-900/20 font-semibold text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800')">
              <span class="block">{{ c.nombre_completo }}</span>
              @if (c.ultima_vez) {
                <span class="block text-[0.6rem] font-normal text-slate-400 dark:text-slate-500">Últ. vez: {{ c.ultima_vez | date:'d MMM y':'':'es' }}</span>
              }
            </button>
          }
        }

        <!-- Con el permiso pero ya ocupados. No se ocultan: a veces la mejor
             opción sigue siendo alguien con otra parte, y esconderlo obligaría
             a buscarlo a mano sin saber por qué no salía. -->
        @if (candidatosOcupados(activeCellPuesto()).length > 0) {
          <p class="text-[0.55rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-2.5 pb-1 border-t border-slate-100 dark:border-slate-800">
            Ya tienen algo ese día
          </p>
          @for (c of candidatosOcupados(activeCellPuesto()); track c.id_publicador) {
            <button
              type="button"
              (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(c.id_publicador)"
              [class]="'w-full text-left px-3 py-2 transition-colors flex items-baseline gap-2 ' + (activeCellAsignacion()?.publicador?.id_publicador === c.id_publicador ? 'bg-violet-50 dark:bg-violet-900/20 font-semibold text-violet-700 dark:text-violet-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800')">
              <span class="flex-1 min-w-0">
                <span class="block truncate text-xs text-slate-500 dark:text-slate-400">{{ c.nombre_completo }}</span>
                @if (c.ultima_vez) {
                  <span class="block text-[0.55rem] text-slate-400 dark:text-slate-500">Últ. vez: {{ c.ultima_vez | date:'d MMM y':'':'es' }}</span>
                }
              </span>
              <span class="shrink-0 text-[0.55rem] font-semibold text-amber-600 dark:text-amber-500">{{ motivoOcupado(c.id_publicador) }}</span>
            </button>
          }
        }

        @if (getCandidatosFiltrados(activeCellPuesto()).length === 0) {
          @if (sinHabilitados(activeCellPuesto())) {
            <p class="text-[0.65rem] text-slate-400 px-3 py-3 text-center leading-relaxed">
              Nadie tiene el permiso de {{ activeCellPuestoLabel() }}.<br>
              Actívalo en Configuración o busca abajo.
            </p>
          } @else {
            <p class="text-[0.65rem] text-slate-400 px-3 py-2.5 italic text-center">
              Ningún habilitado coincide
            </p>
          }
        }

        <!-- Búsqueda libre: permite asignar a alguien sin el permiso,
             dejando claro que va aparte. -->
        @if (cellSearch().trim().length > 0) {
          @if (buscandoPublicador()) {
            <p class="text-[0.65rem] text-slate-400 px-3 py-2.5 italic text-center border-t border-slate-100 dark:border-slate-800">Buscando...</p>
          } @else if (otrosPublicadores(activeCellPuesto()).length > 0) {
            <p class="text-[0.55rem] font-black uppercase tracking-wider text-amber-600/90 dark:text-amber-500/90 px-3 pt-2.5 pb-1 border-t border-slate-100 dark:border-slate-800">
              Sin el permiso de {{ permisoLabel(activeCellPuesto()) }}
            </p>
            @for (c of otrosPublicadores(activeCellPuesto()); track c.id_publicador) {
              <!-- Dos acciones por fila: el nombre asigna solo hoy; el botón
                   además deja el permiso configurado. No se repite el aviso:
                   ya lo dice el encabezado. -->
              <div class="flex items-center gap-1 px-1.5">
                <button
                  type="button"
                  (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(c.id_publicador)"
                  class="flex-1 min-w-0 text-left text-xs px-1.5 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors truncate">
                  {{ c.nombre_completo }}
                </button>
                @if (puedeGestionarPermisos() && permisoDePuesto(activeCellPuesto())) {
                  <button
                    type="button"
                    (mousedown)="$event.preventDefault(); otorgarPermisoYAsignarActiva(c.id_publicador, c.nombre_completo)"
                    [disabled]="esOtorgando(c.id_publicador)"
                    [attr.aria-label]="'Dar el permiso de ' + permisoLabel(activeCellPuesto()) + ' a ' + c.nombre_completo"
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
            <!-- Mismo criterio que en escritorio: primero quien puede y está
                 libre; después quien puede pero ya tiene algo, diciendo qué. -->
            @if (candidatosLibres(activeCellPuesto()).length > 0) {
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-3 pt-2 pb-1">
                Libres ese día
              </p>
              @for (c of candidatosLibres(activeCellPuesto()); track c.id_publicador) {
                <button
                  type="button"
                  (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(c.id_publicador)"
                  [class]="'w-full text-left text-sm px-3 py-3 rounded-xl transition-colors ' + (activeCellAsignacion()?.publicador?.id_publicador === c.id_publicador ? 'bg-violet-50 dark:bg-violet-900/20 font-semibold text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800')">
                  <span class="block">{{ c.nombre_completo }}</span>
                  @if (c.ultima_vez) {
                    <span class="block text-xs font-normal text-slate-400 dark:text-slate-500">Últ. vez: {{ c.ultima_vez | date:'d MMM y':'':'es' }}</span>
                  }
                </button>
              }
            }

            @if (candidatosOcupados(activeCellPuesto()).length > 0) {
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 pt-3 pb-1 border-t border-slate-100 dark:border-slate-800">
                Ya tienen algo ese día
              </p>
              @for (c of candidatosOcupados(activeCellPuesto()); track c.id_publicador) {
                <button
                  type="button"
                  (mousedown)="$event.preventDefault(); seleccionarCandidatoActiva(c.id_publicador)"
                  [class]="'w-full text-left px-3 py-3 rounded-xl transition-colors flex items-baseline gap-2 ' + (activeCellAsignacion()?.publicador?.id_publicador === c.id_publicador ? 'bg-violet-50 dark:bg-violet-900/20 font-semibold text-violet-700 dark:text-violet-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800')">
                  <span class="flex-1 min-w-0">
                    <span class="block truncate text-sm text-slate-500 dark:text-slate-400">{{ c.nombre_completo }}</span>
                    @if (c.ultima_vez) {
                      <span class="block text-xs text-slate-400 dark:text-slate-500">Últ. vez: {{ c.ultima_vez | date:'d MMM y':'':'es' }}</span>
                    }
                  </span>
                  <span class="shrink-0 text-[0.6rem] font-semibold text-amber-600 dark:text-amber-500">{{ motivoOcupado(c.id_publicador) }}</span>
                </button>
              }
            }

            @if (getCandidatosFiltrados(activeCellPuesto()).length === 0) {
              @if (sinHabilitados(activeCellPuesto())) {
                <p class="text-xs text-slate-400 px-3 py-5 text-center leading-relaxed">
                  Nadie tiene el permiso de {{ activeCellPuestoLabel() }}.<br>
                  Actívalo en Configuración o busca arriba.
                </p>
              } @else {
                <p class="text-xs text-slate-400 px-3 py-4 italic text-center">Ningún habilitado coincide</p>
              }
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
    /* Identidad de color por sección.
       El tono llega como --sec desde la plantilla (un solo hex por sección) y
       de ahí se derivan la superficie y la tinta. Se deriva en CSS y no en el
       TypeScript porque cada tema necesita mezclas distintas del mismo tono:
       en claro la superficie es un velo del 7% y la tinta se oscurece para
       pasar contraste -cian y esmeralda al 100% se quedan en 3.5:1 sobre
       blanco, por debajo del mínimo-; en oscuro es al revés, la superficie
       necesita más cuerpo y la tinta se aclara. */
    .sec-card {
      --sec-surface: color-mix(in oklch, var(--sec) 20%, transparent);
      --sec-head:    color-mix(in oklch, var(--sec) 12%, transparent);
      --sec-ink:     color-mix(in oklch, var(--sec) 75%, black 25%);
      --sec-edge:    color-mix(in oklch, var(--sec) 42%, transparent);
      --sec-frame:   color-mix(in oklch, var(--sec) 24%, transparent);
      /* Superficie de la tarjeta. En claro basta el blanco sobre el panel
         porque el borde gris ya la recorta; en oscuro no: el panel que las
         contiene es tambien slate-900, asi que tarjeta y fondo eran el mismo
         color y las tablas se disolvian. En un tema oscuro la elevacion se
         dice aclarando la superficie, no con sombra. */
      --card-bg:       #ffffff;
      --card-bg-hover: #f8fafc;
      --card-line:     rgba(15, 23, 42, 0.07);
    }
    :host-context(.dark) .sec-card {
      --sec-surface: color-mix(in oklch, var(--sec) 40%, transparent);
      --sec-head:    color-mix(in oklch, var(--sec) 24%, transparent);
      --sec-ink:     color-mix(in oklch, var(--sec) 45%, white 55%);
      --sec-edge:    color-mix(in oklch, var(--sec) 52%, transparent);
      --sec-frame:   color-mix(in oklch, var(--sec) 40%, transparent);
      --card-bg:       #161d2c;
      --card-bg-hover: #1d2739;
      --card-line:     rgba(255, 255, 255, 0.07);
    }
    /* Un unico color de superficie para la tarjeta, la cabecera pegajosa y la
       columna de fecha: si se separan, al desplazar se ve el escalon. */
    .sec-bg    { background-color: var(--card-bg); }
    .sec-frame { border-color: var(--sec-frame); }
    .sec-line  { border-color: var(--card-line); }
    .group:hover .sec-bg-hover { background-color: var(--card-bg-hover); }
    /* El velo va como background-image sobre el color de fondo que ya pone
       Tailwind, no como background: si fuera el atajo pisaria ese color y la
       cabecera pegajosa -que tiene que tapar las filas al desplazar- se
       volveria translucida. */
    .sec-surface {
      background-image: linear-gradient(var(--sec-surface), var(--sec-surface));
      border-color: var(--sec-edge);
    }
    .sec-head {
      background-image: linear-gradient(var(--sec-head), var(--sec-head));
    }
    .sec-ink { color: var(--sec-ink); }

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
    /* Popover del combobox: solo opacidad. El propio elemento ya usa
       [style.transform] para plantarse arriba o abajo del disparador -animar
       ahí tambien un scale/translate competiria con esa transformada fija en
       vez de combinarse con ella. */
    .combobox-pop {
      animation: comboboxFadeIn 120ms ease-out;
    }
    @keyframes comboboxFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    /* Hoja del balance: sube desde abajo en movil y entra desde la derecha en
       cuanto hay ancho para ponerla al lado de la tabla. El corte va aqui y no
       con un prefijo sm: porque Tailwind solo genera variantes de sus propias
       utilidades, no de una clase del componente.
       Sin fill-mode: dejar la transformada fija crearia un contexto de apilado
       que atraparia los desplegables de dentro. */
    .balance-sheet {
      animation: sheetSlideUp 280ms cubic-bezier(0.32, 0.72, 0, 1);
    }
    @media (min-width: 640px) {
      .balance-sheet {
        animation: balanceSlideIn 260ms cubic-bezier(0.32, 0.72, 0, 1);
      }
    }
    @keyframes balanceSlideIn {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }
    /* Columna acoplada: aparece sin animar el ancho -eso repinta la tabla
       entera en cada fotograma-, solo su propio contenido. */
    .balance-dock {
      animation: balanceDockIn 220ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    @keyframes balanceDockIn {
      from { opacity: 0; transform: translateX(8px); }
      to   { opacity: 1; transform: translateX(0); }
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
      .sheet-overlay, .sheet-content, .balance-sheet, .balance-dock, .logistica-stagger > * {
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
  private zone = inject(NgZone);

  estado = signal<Estado>('idle');
  errorMsg = signal('');
  confirmadoBanner = signal(false);

  mesDatos = signal<LogisticaMesOut | null>(null);
  mesesDisponibles = signal<MesDisponible[]>([]);

  /**
   * Agrupa `mesesDisponibles` por año consecutivo, para mostrar el año una
   * sola vez por grupo en vez de repetirlo en cada fila del historial.
   * Asume que la lista ya llega ordenada por año/mes (la da así el backend).
   */
  mesesPorAno = computed<{ ano: number; meses: MesDisponible[] }[]>(() => {
    const grupos: { ano: number; meses: MesDisponible[] }[] = [];
    for (const m of this.mesesDisponibles()) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.ano === m.ano) {
        ultimo.meses.push(m);
      } else {
        grupos.push({ ano: m.ano, meses: [m] });
      }
    }
    return grupos;
  });

  descargandoPdf = signal(false);

  // ── Compartir y publicar ────────────────────────────────────
  // Enlace público, WhatsApp e impresión con opciones, agrupados en un solo
  // panel. Sólo se abre con el mes ya publicado (gateado en el botón que lo
  // dispara) — no tiene sentido compartir una versión que no es la vigente.

  panelCompartirAbierto = signal(false);

  cerrarPanelCompartir(): void {
    this.panelCompartirAbierto.set(false);
    this.editandoFechaEnlace.set(false);
  }

  abrirPanelCompartir(): void {
    this.panelCompartirAbierto.set(true);
    this.cargarEnlaceActivo();
    const datos = this.mesDatos();
    if (datos?.fechas.length) {
      const idx = this.indicePorDefectoDia();
      this.whatsappFechaSeleccionada = datos.fechas[idx]?.fecha ?? datos.fechas[0].fecha;
    }
  }

  // — Enlace público —

  enlaceActivo = signal<EnlacePublicoLogistica | null>(null);
  cargandoEnlace = signal(false);
  generandoEnlace = signal(false);
  editandoFechaEnlace = signal(false);
  fechaEnlaceInput = '';
  copiadoEnlace = signal(false);

  private cargarEnlaceActivo(): void {
    const datos = this.mesDatos();
    if (!datos) return;
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.cargandoEnlace.set(true);
    this.logisticaSvc.obtenerEnlace(datos.ano, datos.mes, cong).subscribe({
      next: (e) => {
        this.enlaceActivo.set(e);
        this.cargandoEnlace.set(false);
      },
      error: () => this.cargandoEnlace.set(false),
    });
  }

  generarEnlacePublico(): void {
    const datos = this.mesDatos();
    if (!datos) return;
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.generandoEnlace.set(true);
    this.logisticaSvc.generarEnlace({ ano: datos.ano, mes: datos.mes }, cong).subscribe({
      next: (e) => {
        this.enlaceActivo.set(e);
        this.generandoEnlace.set(false);
      },
      error: (err) => {
        this.generandoEnlace.set(false);
        this.errorMsg.set(err?.error?.detail ?? 'No se pudo generar el enlace.');
        this.estado.set('error');
      },
    });
  }

  /** El navegador ya deja "Copiado" un rato como acuse; sin esto el botón no
   *  da ninguna señal de que sí funcionó. */
  copiarEnlace(): void {
    const e = this.enlaceActivo();
    if (!e) return;
    navigator.clipboard?.writeText(e.url_publica).then(() => {
      this.copiadoEnlace.set(true);
      setTimeout(() => this.copiadoEnlace.set(false), 2000);
    });
  }

  abrirEdicionFechaEnlace(): void {
    const e = this.enlaceActivo();
    this.fechaEnlaceInput = e ? e.fecha_expiracion.slice(0, 10) : '';
    this.editandoFechaEnlace.set(true);
  }

  guardarFechaEnlace(): void {
    const datos = this.mesDatos();
    if (!datos || !this.fechaEnlaceInput) return;
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.logisticaSvc.actualizarEnlaceExpiracion(
      { ano: datos.ano, mes: datos.mes, fecha_expiracion: this.fechaEnlaceInput }, cong,
    ).subscribe({
      next: (e) => {
        this.enlaceActivo.set(e);
        this.editandoFechaEnlace.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail ?? 'No se pudo actualizar la fecha.');
        this.estado.set('error');
      },
    });
  }

  revocarEnlacePublico(): void {
    const datos = this.mesDatos();
    if (!datos) return;
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.confirmPendiente.set({
      titulo: 'Revocar enlace público',
      mensaje: 'Quien ya tenga este enlace guardado dejará de poder abrirlo. Se puede generar uno nuevo después.',
      accionLabel: 'Revocar',
      tono: 'peligro',
      callback: () => {
        this.logisticaSvc.revocarEnlaces(datos.ano, datos.mes, cong).subscribe({
          next: () => this.enlaceActivo.set(null),
        });
      },
    });
  }

  // — Compartir por WhatsApp —

  whatsappFechaSeleccionada = '';
  whatsappAbierto = signal(false);
  whatsappMensaje = signal('');
  cargandoWhatsapp = signal(false);

  whatsappFechaOptions = computed(() =>
    (this.mesDatos()?.fechas ?? []).map((f) => ({
      value: f.fecha,
      label: `${this.formatFecha(f.fecha)} · ${f.dia_semana}`,
    })),
  );

  abrirWhatsapp(): void {
    if (!this.whatsappFechaSeleccionada) return;
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.cargandoWhatsapp.set(true);
    this.logisticaSvc.resumenDia(this.whatsappFechaSeleccionada, cong).subscribe({
      next: (r) => {
        this.whatsappMensaje.set(r.mensaje);
        this.cargandoWhatsapp.set(false);
        this.whatsappAbierto.set(true);
      },
      error: (err) => {
        this.cargandoWhatsapp.set(false);
        this.errorMsg.set(err?.error?.detail ?? 'No se pudo preparar el mensaje.');
        this.estado.set('error');
      },
    });
  }

  cerrarWhatsapp(): void {
    this.whatsappAbierto.set(false);
  }

  /** Sin teléfono fijo: abre el selector de contacto de WhatsApp — esto es
   *  difusión a la congregación, no un mensaje 1 a 1. */
  enviarWhatsapp(): void {
    window.open(whatsappUrl(this.whatsappMensaje()), '_blank');
    this.cerrarWhatsapp();
  }

  // — Imprimir con opciones —

  imprimirOpcionesAbierto = signal(false);
  opcionIncluirDiscursos = signal(false);
  opcionTamanoPagina = signal<TamanoPagina>('carta');
  opcionOrientacion = signal<OrientacionPagina>('vertical');

  abrirOpcionesImpresion(): void {
    this.imprimirOpcionesAbierto.set(true);
  }

  cerrarOpcionesImpresion(): void {
    this.imprimirOpcionesAbierto.set(false);
  }

  confirmarImpresion(): void {
    const datos = this.mesDatos();
    if (!datos) return;
    this.descargarPdfMes(
      { ano: datos.ano, mes: datos.mes },
      {
        incluir_discursos: this.opcionIncluirDiscursos(),
        tamano_pagina: this.opcionTamanoPagina(),
        orientacion: this.opcionOrientacion(),
      },
    );
    this.imprimirOpcionesAbierto.set(false);
  }

  // Candidatos cacheados por clave `${puesto}::${incluirHermanas}` (para auto-asignación)
  private candidatosCache = signal<Record<string, PublicadorBase[]>>({});
  cargandoCandidatos = signal(false);

  // Quién está ocupado ese día en las OTRAS programaciones, cacheado por
  // fecha. Va por fecha y los candidatos por puesto porque cada uno cambia
  // con una cosa distinta: así moverse por la misma fila o la misma columna
  // no vuelve a pedir nada.
  private ocupadosPorFecha = signal<Record<string, Record<number, string>>>({});
  gruposDisponibles = signal<GrupoBase[]>([]);

  // Buscador de publicadores (manual)
  resultadosBusqueda = signal<PublicadorBase[]>([]);
  buscandoPublicador = signal(false);
  private searchSubject = new Subject<string>();

  // Combobox state
  activeCellKey = signal<string | null>(null);
  /** El desplegable se voltea hacia arriba cuando abajo lo recortaría la tabla. */
  /** Posición fija (viewport) del popover de escritorio. Ver posicionarCombobox(). */
  comboboxPos = signal<{ top: number; left: number; openUp: boolean } | null>(null);
  cellSearch = signal<string>('');

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
  mesModalDropdownAbierto = signal(false);
  modalMes = new Date().getMonth() + 1;
  modalAno = new Date().getFullYear();

  // Configuración de generación: cómo arma la programación esta congregación.
  // Vive aparte del modal de generar porque no es una decisión del mes que se
  // está armando, sino la forma de trabajar de la congregación: se guarda al
  // instante y el siguiente `generar` la respeta sin volver a preguntar.
  modalConfigAbierto = signal(false);
  configPreferencias = signal<PreferenciaLogistica[]>([]);
  configCargando = signal(false);
  /** Clave que se está guardando ahora mismo, para el spinner de esa fila. */
  configGuardando = signal<string | null>(null);
  configError = signal<string | null>(null);

  /**
   * Filas de la sección "Rotación": un puesto por permiso más el aseo al
   * final, todas con el mismo selector de tres vías (reunión/semana/mes).
   * `testid` identifica cada fila en los data-testid de sus botones.
   */
  readonly filasRotacion = [
    ...PUESTO_ROTACION_CLAVES.map((p) => ({
      clave: p.clave,
      testid: p.permiso,
      label: PERMISO_LABEL[p.permiso] ?? p.permiso,
    })),
    { clave: CLAVE_ROTACION_ASEO, testid: 'aseo', label: 'Aseo del salón' },
  ];
  /** Filas de la sección "Cantidad de puestos": mismo selector, con opciones 1/2. */
  readonly filasCantidad = [
    { clave: CLAVE_CANTIDAD_VIGILANCIA, testid: 'vigilancia', label: 'Vigilancia' },
    { clave: CLAVE_CANTIDAD_MICROFONO, testid: 'microfono', label: 'Micrófono' },
  ];
  readonly claveRequiereRevision = CLAVE_REQUIERE_REVISION;
  readonly claveRotacionAseo = CLAVE_ROTACION_ASEO;
  /** Fuera de la plantilla: un literal inline se recrearía en cada ciclo. */
  readonly filasEsqueletoConfig = [1, 2, 3, 4, 5, 6, 7];

  // Selector de mes de la barra. Sustituye a la barra lateral fija: la lista
  // de meses y el botón de generar sólo ocupan ancho mientras se usan, y el
  // resto del tiempo ese ancho es de la tabla.
  menuMesesAbierto = signal(false);

  /** Menú "…" con PDF, Compartir y Eliminar. Siempre disponible: el PDF
   *  (primer ítem) ya se mostraba sin condición, sólo deshabilitado hasta
   *  que hubiera publicación. */
  menuAccionesAbierto = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      this.activeCellKey()
      && !target.closest('[data-cell]')
      && !target.closest('[data-cell-sheet]')
      && !target.closest('[data-combobox-popover]')
    ) {
      // En móvil el combobox vive en un sheet (data-cell-sheet); en escritorio,
      // en un popover fijo (data-combobox-popover) que ya no cuelga de la celda.
      this.cerrarCombobox();
    }
    if (this.menuMesesAbierto() && !target.closest('[data-mes-menu]')) {
      this.menuMesesAbierto.set(false);
    }
    if (this.menuAccionesAbierto() && !target.closest('[data-acciones-menu]')) {
      this.menuAccionesAbierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Lo desplegado primero: cerrar el panel de carga teniendo abierto el
    // selector de mes encima sería responder a algo que no se ve.
    if (this.modalConfigAbierto()) this.cerrarModalConfig();
    else if (this.menuMesesAbierto()) this.menuMesesAbierto.set(false);
    else if (this.menuAccionesAbierto()) this.menuAccionesAbierto.set(false);
    else if (this.balancePanelVisible()) this.cerrarPanelBalance();
    else if (this.activeCellKey()) this.cerrarCombobox();
  }

  // El popover del combobox se posiciona una sola vez, en coordenadas fijas
  // de viewport; si la ventana cambia de tamaño esas coordenadas quedan
  // obsoletas. Cerrarlo es más simple y predecible que recalcularlo en vivo.
  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.activeCellKey()) this.cerrarCombobox();
  }

  readonly seccionesKeys = Object.keys(SECCION_PUESTOS);

  // ── Cómo se mira el mes: completo, una semana o un día ─────
  // El mes entero ya viene en una sola respuesta de /logistica/mes, asi que
  // acercarse a una semana o a un dia es filtrar lo que ya esta en memoria:
  // ninguna de estas vistas pide nada al servidor.

  readonly vistasPeriodo = [
    { id: 'mes' as const,    full: 'Mes' },
    { id: 'semana' as const, full: 'Semana' },
    { id: 'dia' as const,    full: 'Día' },
  ];

  vistaPeriodo = signal<'mes' | 'semana' | 'dia'>('mes');
  semanaSel = signal(0);
  diaSel = signal(0);

  /** Numero de semana ISO de una fecha 'YYYY-MM-DD'. */
  private semanaIso(fechaStr: string): number {
    const d = new Date(fechaStr + 'T00:00:00');
    const base = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    base.setUTCDate(base.getUTCDate() + 4 - (base.getUTCDay() || 7));
    const inicioAno = new Date(Date.UTC(base.getUTCFullYear(), 0, 1));
    return Math.ceil(((base.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
  }

  /** Las fechas del mes agrupadas por semana ISO, en orden. */
  semanasDelMes = computed(() => {
    const fechas = this.mesDatos()?.fechas ?? [];
    const grupos: { iso: number; fechas: FechaReunionOut[] }[] = [];
    for (const f of fechas) {
      const iso = this.semanaIso(f.fecha);
      const previo = grupos.find((g) => g.iso === iso);
      if (previo) previo.fechas.push(f);
      else grupos.push({ iso, fechas: [f] });
    }
    return grupos;
  });

  /** Fechas que toca pintar segun la vista elegida. */
  fechasVisibles = computed<FechaReunionOut[]>(() => {
    const fechas = this.mesDatos()?.fechas ?? [];
    switch (this.vistaPeriodo()) {
      case 'semana': {
        const grupo = this.semanasDelMes()[this.semanaSel()];
        return grupo ? grupo.fechas : [];
      }
      case 'dia': {
        const f = fechas[this.diaSel()];
        return f ? [f] : [];
      }
      default:
        return fechas;
    }
  });

  /** Solo los bloques de aseo que tocan alguna fecha visible. */
  aseoBloquesVisibles = computed<AseoBloqueOut[]>(() => {
    const visibles = new Set(this.fechasVisibles().map((f) => f.fecha));
    return this.aseoBloques().filter((b) => b.fechas.some((f) => visibles.has(f.fecha)));
  });

  /**
   * En 'dia' se usan las tarjetas por fecha —las mismas del movil— tambien en
   * escritorio: para una sola fecha, una tarjeta se lee mejor que una tabla de
   * una fila con scroll horizontal.
   */
  usaTarjetas = computed(() => this.vistaPeriodo() === 'dia');

  cambiarVista(v: 'mes' | 'semana' | 'dia'): void {
    if (this.vistaPeriodo() === v) return;
    this.vistaPeriodo.set(v);
    // Al acercarse, arrancar por el periodo que contiene la fecha de hoy si el
    // mes abierto es el actual; si no, por el primero.
    if (v === 'semana') this.semanaSel.set(this.indicePorDefectoSemana());
    if (v === 'dia') this.diaSel.set(this.indicePorDefectoDia());
  }

  private indicePorDefectoDia(): number {
    const fechas = this.mesDatos()?.fechas ?? [];
    const hoy = new Date().toISOString().slice(0, 10);
    const i = fechas.findIndex((f) => f.fecha >= hoy);
    return i >= 0 ? i : 0;
  }

  private indicePorDefectoSemana(): number {
    const grupos = this.semanasDelMes();
    const hoy = new Date().toISOString().slice(0, 10);
    const i = grupos.findIndex((g) => g.fechas.some((f) => f.fecha >= hoy));
    return i >= 0 ? i : 0;
  }

  /** Etiqueta corta de una semana para su pill: '1 – 5 sep'. */
  etiquetaSemana(g: { fechas: FechaReunionOut[] }): string {
    const ini = g.fechas[0], fin = g.fechas[g.fechas.length - 1];
    if (!ini) return '';
    const dia = (f: string) => Number(f.slice(8, 10));
    const mesCorto = MESES_ES[Number(ini.fecha.slice(5, 7)) - 1].slice(0, 3).toLowerCase();
    return ini.fecha === fin.fecha
      ? `${dia(ini.fecha)} ${mesCorto}`
      : `${dia(ini.fecha)} – ${dia(fin.fecha)} ${mesCorto}`;
  }

  /** El mes que se esta viendo ahora mismo en el panel principal. */
  esMesActivo(m: MesDisponible): boolean {
    const d = this.mesDatos();
    return !!d && d.ano === m.ano && d.mes === m.mes;
  }

  readonly mesesOpciones = MESES_ES.map((label, i) => ({ value: i + 1, label }));
  /** Mismas opciones, de Diciembre a Enero: es como se listan en el desplegable
   *  del modal de generar. `mesesOpciones` se deja en orden calendario porque
   *  `mesesOpciones[modalMes - 1]` depende de esa posición para el label del botón. */
  readonly mesesOpcionesDesc = [...this.mesesOpciones].reverse();

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

  // ── Balance de carga del mes abierto ───────────────────────
  // Sólo informa: no mueve ni reasigna nada. Contesta "¿me estoy apoyando
  // siempre en los mismos?" sin obligar a contar nombres a mano por la tabla.
  //
  // Se deriva de las asignaciones ya cargadas en vez de consultar al servidor:
  // así el panel refleja también los cambios del borrador que todavía no se han
  // publicado, que es justo cuando sirve de algo.
  //
  // El aseo queda fuera a propósito: se asigna a un grupo entero, y repartirlo
  // entre sus integrantes inventaría una carga que nadie asignó. La rotación de
  // grupos se mira en el reporte de Carga de logística.

  // El panel vive fuera del flujo vertical de la pantalla: columna propia al
  // lado de la tabla en pantallas anchas, hoja lateral o inferior en las
  // estrechas. Cuando era un desplegable encima de la tabla, abrirlo dejaba la
  // programación reducida a una franja de dos filas, que es justo lo que se
  // está mirando cuando se consulta la carga.
  panelBalanceAbierto = signal(false);

  /** ¿Hay algo que enseñar y permiso para verlo? Lo comparten las dos formas. */
  balancePanelVisible = computed(
    () => this.panelBalanceAbierto() && this.puedeVerBalance() && this.balanceCarga().length > 0,
  );

  /** Persona cuya lista de asignaciones está desplegada. Una a la vez. */
  personaExpandida = signal<number | null>(null);

  /** Filtra por nombre. Con treinta personas, recorrer la lista a ojo para
   *  comprobar a una concreta es el gasto real del panel. */
  balanceBusqueda = signal('');

  /** Sólo los extremos: "normal" no lleva a ninguna decisión. */
  readonly balanceFiltros = [
    { id: 'todos' as const, label: 'Todos' },
    { id: 'alta' as const,  label: 'Alta' },
    { id: 'baja' as const,  label: 'Baja' },
  ];

  balanceFiltro = signal<'todos' | 'alta' | 'baja'>('todos');

  alternarPanelBalance(): void {
    if (this.panelBalanceAbierto()) this.cerrarPanelBalance();
    else this.panelBalanceAbierto.set(true);
  }

  cerrarPanelBalance(): void {
    this.panelBalanceAbierto.set(false);
    this.personaExpandida.set(null);
    this.limpiarCeldasMarcadas();
  }

  // ── Rebalanceo del mes ────────────────────────────────────
  // Nunca se aplica a ciegas: primero se pide la propuesta, se enseña qué
  // cambiaría, y sólo entonces se confirma. Reescribir el mes de golpe sin
  // mostrar nada es lo que haría que nadie se atreviera a pulsar el botón.
  rebalanceoPropuesta = signal<RebalanceoPropuesta | null>(null);
  rebalanceando = signal(false);
  /** El modal está abierto aunque la propuesta venga vacía: hay que decirlo. */
  rebalanceoAbierto = signal(false);

  pedirRebalanceo(): void {
    const datos = this.mesDatos();
    if (!datos || this.rebalanceando()) return;
    this.rebalanceando.set(true);
    this.rebalanceoPropuesta.set(null);
    this.rebalanceoAbierto.set(true);
    this.logisticaSvc
      .rebalancearMes(datos.ano, datos.mes, false, this.congregacionCtx.effectiveCongregacionId())
      .subscribe({
        next: (p) => {
          this.rebalanceoPropuesta.set(p);
          this.rebalanceando.set(false);
        },
        error: (err) => {
          this.rebalanceando.set(false);
          this.rebalanceoAbierto.set(false);
          this.errorMsg.set(err?.error?.detail ?? 'No se pudo calcular el reparto');
          this.estado.set('error');
        },
      });
  }

  aplicarRebalanceo(): void {
    const datos = this.mesDatos();
    const propuesta = this.rebalanceoPropuesta();
    if (!datos || !propuesta?.cambios.length || this.rebalanceando()) return;
    this.rebalanceando.set(true);
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.logisticaSvc.rebalancearMes(datos.ano, datos.mes, true, cong).subscribe({
      next: () => {
        this.rebalanceando.set(false);
        this.cerrarRebalanceo();
        // Se recarga el mes entero en vez de parchear cada casilla en memoria:
        // un rebalanceo toca muchas a la vez y aquí el estado publicado del
        // periodo también cambia.
        this.cargarMes(datos.ano, datos.mes);
      },
      error: (err) => {
        this.rebalanceando.set(false);
        this.errorMsg.set(err?.error?.detail ?? 'No se pudo aplicar el reparto');
        this.estado.set('error');
      },
    });
  }

  cerrarRebalanceo(): void {
    this.rebalanceoAbierto.set(false);
    this.rebalanceoPropuesta.set(null);
  }

  toggleExpandirPersona(id: number): void {
    // Al pasar a otra persona -o al plegar la actual- las casillas marcadas
    // dejan de tener dueño visible en el panel: se apagan aquí y no sólo al
    // pulsar el siguiente chip, porque si no quedarían encendidas mientras se
    // recorre la lista buscando a quién revisar.
    this.limpiarCeldasMarcadas();
    this.personaExpandida.set(this.personaExpandida() === id ? null : id);
  }

  puedeVerBalance = computed(() => this.authStore.hasPermission('reuniones.carga_trabajo'));

  /** Enlace al reporte multi-mes: sólo si además puede abrir esa pantalla. */
  puedeVerReporteCarga = computed(() => this.authStore.hasPermission('reportes.logistica'));

  balanceCarga = computed<CargaPersonaMes[]>(() => {
    const asignaciones = this.mesDatos()?.asignaciones ?? [];

    const acumulado = new Map<number, {
      nombre: string; total: number; puestos: string[]; detalle: AsignacionBalance[];
    }>();
    for (const a of asignaciones) {
      if (!a.publicador) continue;
      const fila = acumulado.get(a.publicador.id_publicador)
        ?? { nombre: a.publicador.nombre_completo, total: 0, puestos: [], detalle: [] };
      fila.total += 1;
      const etiqueta = this.puestoLabel(a.puesto);
      if (!fila.puestos.includes(etiqueta)) fila.puestos.push(etiqueta);
      fila.detalle.push({ fecha: a.fecha, puesto: a.puesto, puestoLabel: etiqueta });
      acumulado.set(a.publicador.id_publicador, fila);
    }
    if (acumulado.size === 0) return [];

    const totales = [...acumulado.values()].map((f) => f.total);
    const promedio = totales.reduce((s, n) => s + n, 0) / totales.length;
    const maximo = Math.max(...totales);

    return [...acumulado.entries()]
      .map(([id, f]) => ({
        id,
        nombre: f.nombre,
        total: f.total,
        detalle: f.puestos.join(' · '),
        nivel: this.nivelCarga(f.total, promedio),
        pct: maximo ? Math.round((f.total / maximo) * 100) : 0,
        asignaciones: f.detalle.sort((a, b) => a.fecha.localeCompare(b.fecha)),
      }))
      // Más cargado primero: la pregunta que trae aquí a alguien es "¿a quién
      // estoy pidiendo de más?", y esa respuesta debe estar en la primera fila.
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  });

  /** Media de tareas por persona **entre quienes tienen alguna** este mes. */
  promedioCarga = computed(() => {
    const filas = this.balanceCarga();
    if (!filas.length) return 0;
    return filas.reduce((s, f) => s + f.total, 0) / filas.length;
  });

  /**
   * Mismo criterio que `clasificar_nivel` en logistica_carga_service.py. Si
   * cambia uno, cambia el otro: que la misma persona salga "alta" aquí y
   * "normal" en el reporte destruiría la confianza en ambas pantallas.
   *
   * El margen no baja de 1 tarea entera porque con medias pequeñas (2,1) un
   * umbral sólo porcentual marcaría como "alta" a quien lleva una tarea más que
   * el resto, que es ruido y no desequilibrio.
   */
  private nivelCarga(total: number, promedio: number): NivelCarga {
    if (promedio <= 0) return 'normal';
    const margen = Math.max(1, promedio * 0.25);
    if (total > promedio + margen) return 'alta';
    if (total < promedio - margen) return 'baja';
    return 'normal';
  }

  /** "2,5 de media · 3 con carga alta" — el resumen del encabezado plegado. */
  balanceResumen = computed(() => {
    const filas = this.balanceCarga();
    if (!filas.length) return '';
    const altas = filas.filter((f) => f.nivel === 'alta').length;
    const bajas = filas.filter((f) => f.nivel === 'baja').length;
    const media = this.promedioCarga().toLocaleString('es', { maximumFractionDigits: 1 });
    const partes = [`${filas.length} personas`, `${media} tareas de media`];
    if (altas) partes.push(altas === 1 ? '1 con carga alta' : `${altas} con carga alta`);
    if (bajas) partes.push(bajas === 1 ? '1 con carga baja' : `${bajas} con carga baja`);
    return partes.join(' · ');
  });

  /** La media con el formato del sitio, para el número grande del panel. */
  promedioCargaLabel = computed(
    () => this.promedioCarga().toLocaleString('es', { maximumFractionDigits: 1 }),
  );

  /** Cuántos hay en cada nivel. Alimenta el interruptor y el aviso del botón. */
  balanceConteos = computed(() => {
    const filas = this.balanceCarga();
    return {
      todos: filas.length,
      alta: filas.filter((f) => f.nivel === 'alta').length,
      baja: filas.filter((f) => f.nivel === 'baja').length,
    };
  });

  /**
   * La lista agrupada por nivel, ya filtrada. El nivel pasa al encabezado del
   * grupo en vez de repetirse en una etiqueta por fila: treinta pastillas
   * diciendo lo mismo son ruido, y agrupadas el desequilibrio se ve de golpe.
   */
  balanceGrupos = computed(() => {
    const busqueda = normalizarTexto(this.balanceBusqueda().trim());
    const filtro = this.balanceFiltro();
    const filas = this.balanceCarga().filter((f) => {
      if (filtro !== 'todos' && f.nivel !== filtro) return false;
      return !busqueda || normalizarTexto(f.nombre).includes(busqueda);
    });
    // Mismo orden que la lista: primero quien más lleva.
    const orden: NivelCarga[] = ['alta', 'normal', 'baja'];
    return orden
      .map((nivel) => ({
        nivel,
        label: this.nivelGrupoLabel(nivel),
        filas: filas.filter((f) => f.nivel === nivel),
      }))
      .filter((g) => g.filas.length > 0);
  });

  private nivelGrupoLabel(nivel: NivelCarga): string {
    switch (nivel) {
      case 'alta': return 'Carga alta';
      case 'baja': return 'Carga baja';
      default:     return 'Carga normal';
    }
  }

  /** Color del encabezado de grupo: el mismo criterio que la barra. */
  nivelTextoClass(nivel: NivelCarga): string {
    switch (nivel) {
      case 'alta': return 'text-amber-600 dark:text-amber-400';
      case 'baja': return 'text-sky-600 dark:text-sky-400';
      default:     return 'text-emerald-600 dark:text-emerald-400';
    }
  }

  /**
   * Ámbar para carga alta, no rojo: el rojo de esta pantalla significa "esto
   * impide publicar", y una carga desigual no impide nada. Azul para la baja
   * porque tampoco es un fallo: es margen para repartir.
   */
  nivelBarraClass(nivel: NivelCarga): string {
    switch (nivel) {
      case 'alta': return 'bg-amber-500 dark:bg-amber-400';
      case 'baja': return 'bg-sky-500 dark:bg-sky-400';
      default:     return 'bg-emerald-500 dark:bg-emerald-400';
    }
  }

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

  // ── Ausencias: aviso, no bloqueo ────────────────────────────
  // Alguien puede quedar asignado antes de registrar su ausencia (o
  // asignarse a mano después). No se le quita el puesto solo -eso lo decide
  // una persona-, pero la celda lo advierte sin necesidad de hover.

  private ausenciasPorLogistica = computed(() => {
    const mapa = new Map<number, string | null>();
    for (const a of this.mesDatos()?.ausencias_detalle ?? []) {
      mapa.set(a.id_logistica, a.motivo);
    }
    return mapa;
  });

  /** ¿La persona ya asignada aquí tiene una ausencia registrada esta fecha? */
  esAusente(fecha: string, puesto: string): boolean {
    const a = this.getAsignacion(fecha, puesto);
    return !!a && this.ausenciasPorLogistica().has(a.id_logistica);
  }

  ausenciaMotivo(fecha: string, puesto: string): string {
    const a = this.getAsignacion(fecha, puesto);
    if (!a) return '';
    const motivo = this.ausenciasPorLogistica().get(a.id_logistica);
    return motivo || 'Tiene una ausencia registrada en esta fecha';
  }

  conflictoEtiqueta(c: ConflictoLogisticaItem): string {
    return `${this.formatFecha(c.fecha)} · ${this.puestoLabel(c.puesto)}`;
  }

  /** Lleva la vista hasta la casilla y la resalta un instante. */
  irAConflicto(c: ConflictoLogisticaItem): void {
    this.saltarACelda(c.fecha, c.puesto);
  }

  /** Mismo salto que un conflicto, para un chip del panel de balance de carga. */
  irACeldaBalance(a: AsignacionBalance): void {
    this.saltarACelda(a.fecha, a.puesto);
  }

  private saltarACelda(fecha: string, puesto: string): void {
    const sel = `[data-cell="${fecha}::${puesto}"]`;
    // Hay dos maquetas simultáneas (tarjetas en móvil, tabla en escritorio) y
    // sólo una es visible: se busca la que realmente ocupa espacio.
    const celda = Array.from(document.querySelectorAll<HTMLElement>(sel))
      .find((el) => el.offsetParent !== null);
    if (!celda) return;
    celda.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Las marcas se acumulan a propósito: repasando a una persona se van
    // encendiendo todas sus fechas a la vez, que es justo lo que se quiere
    // ver. Quien las apaga es el cambio de persona, no el siguiente chip.
    celda.classList.remove('highlight-flash');
    // Reinicia la animación si se pulsa dos veces el mismo elemento.
    void celda.offsetWidth;
    celda.classList.add('highlight-flash');
  }

  /** Apaga todas las casillas resaltadas, en ambas maquetas. */
  private limpiarCeldasMarcadas(): void {
    document
      .querySelectorAll<HTMLElement>('.highlight-flash')
      .forEach((el) => el.classList.remove('highlight-flash'));
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
    this.vigilarScrollParaCerrarCombobox();

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
      this.logisticaSvc.getCandidatos(puesto, cong).subscribe({
        next: (candidates) => {
          this.candidatosCache.update((c) => ({ ...c, [puesto]: candidates }));
          if (--pendientes === 0) this.cargandoCandidatos.set(false);
        },
        error: () => { if (--pendientes === 0) this.cargandoCandidatos.set(false); },
      });
    }
  }

  cargarMes(ano: number, mes: number): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.estado.set('loading');
    this.logisticaSvc.getMes(ano, mes, cong).subscribe({
      next: (data) => {
        this.mesDatos.set(data);
        // Otro mes tiene otras semanas y otras fechas: los indices anteriores
        // apuntarian a un periodo que ya no existe.
        this.semanaSel.set(0);
        this.diaSel.set(0);
        this.estado.set('ready');
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail ?? 'Error al cargar el mes');
        this.estado.set('error');
      },
    });
  }

  /**
   * Cierra el mes abierto y vuelve al listado de programaciones.
   *
   * Ese listado ya existía -es lo que se ve cuando no hay ningún mes cargado-,
   * pero sólo se llegaba a él recargando la pantalla: una vez abierto un mes no
   * había salida. El desplegable deja saltar de un mes a otro, que no es lo
   * mismo que volver al índice.
   *
   * Se cierra todo lo que colgaba del mes; si no, quedarían abiertos paneles
   * apuntando a asignaciones que ya no están en memoria.
   */
  volverAListado(): void {
    this.cerrarCombobox();
    this.cerrarPanelBalance();
    this.cerrarRebalanceo();
    this.menuMesesAbierto.set(false);
    this.limpiarCeldasMarcadas();
    this.mesDatos.set(null);
    this.estado.set('idle');
    // La lista puede haber cambiado mientras se editaba -un mes recién
    // generado, otro publicado-, así que se refresca al volver a ella.
    this.cargarMeses(this.congregacionCtx.effectiveCongregacionId());
  }

  abrirModalGenerar(): void {
    this.modalMes = new Date().getMonth() + 1;
    this.modalAno = new Date().getFullYear();
    this.modalGenerarAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalGenerarAbierto.set(false);
  }

  // ── Configuración de generación ──────────────────────────────────────

  abrirModalConfig(): void {
    this.modalConfigAbierto.set(true);
    this.configError.set(null);
    this.configCargando.set(true);
    this.logisticaSvc
      .getConfiguracionPreferencias(this.congregacionCtx.effectiveCongregacionId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cfg) => {
          this.configPreferencias.set(cfg.preferencias);
          this.configCargando.set(false);
        },
        error: () => {
          this.configError.set('No se pudo cargar la configuración.');
          this.configCargando.set(false);
        },
      });
  }

  cerrarModalConfig(): void {
    this.modalConfigAbierto.set(false);
    this.configGuardando.set(null);
    this.configError.set(null);
  }

  /** Valor actual de una preferencia; el default mientras no haya cargado. */
  valorPref(clave: string): string {
    const pref = this.configPreferencias().find((p) => p.key === clave);
    return pref?.value ?? '';
  }

  /** Opciones de una preferencia de varias vías (ej. rotación del aseo). */
  opcionesPref(clave: string): PreferenciaLogistica['options'] {
    return this.configPreferencias().find((p) => p.key === clave)?.options ?? [];
  }

  /**
   * Guarda una preferencia sola, en cuanto se toca.
   *
   * Se pinta el valor nuevo antes de que responda el servidor -el interruptor
   * tiene que moverse con el dedo- y se revierte si la llamada falla, para que
   * la pantalla nunca afirme algo que no quedó guardado.
   */
  guardarPreferencia(clave: string, valor: string): void {
    const anterior = this.valorPref(clave);
    if (anterior === valor || this.configGuardando()) return;

    this.aplicarValorPref(clave, valor);
    this.configGuardando.set(clave);
    this.configError.set(null);
    this.logisticaSvc
      .actualizarPreferencias({ [clave]: valor }, this.congregacionCtx.effectiveCongregacionId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cfg) => {
          this.configPreferencias.set(cfg.preferencias);
          this.configGuardando.set(null);
        },
        error: (err) => {
          this.aplicarValorPref(clave, anterior);
          this.configGuardando.set(null);
          this.configError.set(err?.error?.detail ?? 'No se pudo guardar el cambio.');
        },
      });
  }

  private aplicarValorPref(clave: string, valor: string): void {
    this.configPreferencias.update((prefs) =>
      prefs.map((p) => (p.key === clave ? { ...p, value: valor } : p)),
    );
  }

  generarMes(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    const ano = this.modalAno;
    const mes = this.modalMes;
    this.cerrarModal();

    // El backend, al encontrar filas para el mes, las devuelve tal cual sin
    // tocar nada -por diseño, `generar` nunca pisa un mes ya armado. Aquí se
    // adelanta esa pregunta: dejarlo como está (no pasa nada) o recrearlo
    // desde cero, que sí es una acción destructiva y merece confirmación.
    const existente = this.mesesDisponibles().find((m) => m.ano === ano && m.mes === mes);
    if (existente) {
      const mesNombre = MESES_ES[mes - 1] ?? `${mes}`;
      this.confirmPendiente.set({
        titulo: `${mesNombre} ${ano} ya tiene programación`,
        mensaje: `Estado actual: ${this.etiquetaEstadoMes(existente)}. Puedes dejarla tal como está, o `
          + 'recrearla desde cero: se perderían las asignaciones manuales y la publicación de ese mes.',
        accionLabel: 'Recrear desde cero',
        tono: 'peligro',
        callback: () => this.recrearMes(ano, mes, cong),
      });
      return;
    }

    this.ejecutarGenerar(ano, mes, cong);
  }

  private recrearMes(ano: number, mes: number, cong: number | null): void {
    this.estado.set('loading');
    this.logisticaSvc.eliminarMes(ano, mes, cong).subscribe({
      next: () => this.ejecutarGenerar(ano, mes, cong),
      error: (err) => {
        this.errorMsg.set(err?.error?.detail ?? 'Error al recrear el mes');
        this.estado.set('error');
      },
    });
  }

  private ejecutarGenerar(ano: number, mes: number, cong: number | null): void {
    this.estado.set('loading');
    // Sin modo_aseo: el backend ya toma la rotación guardada en "Configuración".
    this.logisticaSvc.generar({ ano, mes }, cong).subscribe({
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
    const mesNombre = MESES_ES[datos.mes - 1] ?? `${datos.mes}`;
    const conflictos = this.conflictosLabel();
    if (conflictos) {
      this.confirmPendiente.set({
        titulo: 'No puedes publicar todavía',
        mensaje: `Quedan ${conflictos}. Cúbrelos primero: no se puede publicar un mes con puestos sin asignar.`,
        accionLabel: 'Entendido',
        tono: 'peligro',
        callback: () => {},
      });
      return;
    }
    this.confirmPendiente.set({
      titulo: `Publicar ${mesNombre} ${datos.ano}`,
      mensaje: 'La programación quedará visible para toda la congregación y cada publicador podrá ver su asignación.',
      accionLabel: 'Publicar',
      tono: 'accion',
      callback: () => {
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
    const base = SECCION_PUESTOS[seccion] ?? [];
    const activos = this.mesDatos()?.puestos_activos;
    return activos ? base.filter((p) => activos.includes(p)) : base;
  }

  seccionHeaderColor(seccion: string): string {
    return SECCION_COLOR[seccion] ?? '#6D28D9';
  }

  puestoLabel(puesto: string): string {
    return PUESTOS_LABEL[puesto] ?? puesto;
  }

  getAsignacion(fecha: string, puesto: string): LogisticaItemOut | undefined {
    return this.mesDatos()?.asignaciones.find(
      (a) => a.fecha === fecha && a.puesto === puesto
    );
  }

  /**
   * Publicadores que la búsqueda libre encontró y que NO están habilitados para
   * el puesto. Se ofrecen aparte para poder asignar a alguien puntualmente sin
   * confundirlos con quienes tienen el permiso.
   */
  otrosPublicadores(puesto: string): PublicadorBase[] {
    const habilitados = new Set(
      (this.candidatosCache()[puesto] ?? []).map((c) => c.id_publicador),
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
    this.logisticaSvc.getCandidatos(puesto, cong).subscribe({
      next: (candidates) => {
        this.candidatosCache.update((c) => ({ ...c, [puesto]: candidates }));
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
    return (this.candidatosCache()[puesto] ?? []).length === 0;
  }

  getCandidatosFiltrados(puesto: string): PublicadorBase[] {
    const todos = this.candidatosCache()[puesto] ?? [];
    const q = normalizarTexto(this.cellSearch().trim());
    if (!q) return todos;
    return todos.filter((c) => normalizarTexto(c.nombre_completo).includes(q));
  }

  /**
   * Quién no está libre en la casilla abierta, y por qué.
   *
   * Se calcula una vez por apertura y no por candidato: la plantilla consulta
   * esto para cada nombre de la lista y, resuelto a base de recorrer las
   * asignaciones del mes en cada consulta, serían treinta barridos completos
   * en cada ciclo de detección de cambios.
   *
   * Dos fuentes que a propósito no se unifican en el servidor: la logística
   * del propio mes ya está en memoria y se lee al instante -en cuanto se
   * asigna a alguien deja de estar libre sin volver a preguntar-, y el resto
   * de programaciones vienen del backend cacheadas por fecha.
   */
  private ocupacionCasillaActiva = computed<Record<number, string>>(() => {
    const p = this.parseActiveCell();
    return p ? this.ocupacionEnCasilla(p.fecha, p.puesto) : {};
  });

  /**
   * Quién no está libre en una fecha, sin contar la casilla indicada.
   *
   * Lo usan dos sitios: el desplegable de asignación de la tabla y el
   * reemplazo desde el panel de balance. Es la misma pregunta -"¿quién puede
   * coger esto?"- hecha desde dos pantallas, así que comparten respuesta.
   */
  private ocupacionEnCasilla(fecha: string, puesto: string): Record<number, string> {
    // El backend primero, la logística después: si alguien ya tiene otro
    // puesto ese mismo día, eso es lo más cercano a lo que se está editando
    // y es el motivo más útil que mostrar.
    const mapa: Record<number, string> = { ...(this.ocupadosPorFecha()[fecha] ?? {}) };
    for (const a of this.mesDatos()?.asignaciones ?? []) {
      const id = a.publicador?.id_publicador;
      // La propia casilla no cuenta: quien la ocupa ahora no está "ocupado".
      if (!id || a.fecha !== fecha || a.puesto === puesto) continue;
      mapa[id] = this.puestoLabel(a.puesto);
    }
    return mapa;
  }

  /** Por qué esta persona no está libre en la fecha abierta, o '' si lo está. */
  motivoOcupado(idPublicador: number): string {
    return this.ocupacionCasillaActiva()[idPublicador] ?? '';
  }

  /** Habilitados para el puesto que además están libres ese día. */
  candidatosLibres(puesto: string): PublicadorBase[] {
    return this.getCandidatosFiltrados(puesto)
      .filter((c) => !this.motivoOcupado(c.id_publicador));
  }

  /**
   * Habilitados que ya tienen algo ese día. No se ocultan -a veces la mejor
   * opción sigue siendo alguien con otra parte, y esconderlo obligaría a
   * buscarlo a mano sin saber por qué no salía-, pero van después y dicen en
   * qué están.
   */
  candidatosOcupados(puesto: string): PublicadorBase[] {
    return this.getCandidatosFiltrados(puesto)
      .filter((c) => !!this.motivoOcupado(c.id_publicador));
  }

  // ── Aliviar a alguien desde el panel de balance ───────────
  // El panel detectaba el desequilibrio pero no dejaba corregirlo: había que
  // memorizar el nombre, cerrarlo, buscar la casilla en la tabla y reasignar
  // a ciegas, sin saber a quién le venía bien la carga. Esto cierra el círculo
  // en el mismo sitio donde se ve el problema.

  /** Chip de fecha cuyo selector de reemplazo está abierto. Uno a la vez. */
  reemplazoAbierto = signal<AsignacionBalance | null>(null);

  abrirReemplazo(a: AsignacionBalance): void {
    this.reemplazoAbierto.set(
      this.reemplazoAbierto()?.fecha === a.fecha && this.reemplazoAbierto()?.puesto === a.puesto
        ? null
        : a,
    );
    if (this.reemplazoAbierto()) this.cargarOcupados(a.fecha);
  }

  cerrarReemplazo(): void {
    this.reemplazoAbierto.set(null);
  }

  /** Cuántas tareas lleva cada quien este mes. Sin asignaciones = 0. */
  private cargaPorPersona = computed<Record<number, number>>(() => {
    const mapa: Record<number, number> = {};
    for (const f of this.balanceCarga()) mapa[f.id] = f.total;
    return mapa;
  });

  cargaDe(idPublicador: number): number {
    return this.cargaPorPersona()[idPublicador] ?? 0;
  }

  /**
   * A quién se le puede pasar esta parte: tiene el permiso, está libre ese
   * día, y va menos cargado que quien la tiene ahora.
   *
   * Ordenados por carga ascendente porque el objetivo es descargar: el primero
   * de la lista debe ser el que más lo necesita. `balanceCarga()` sólo incluye
   * a quien tiene al menos una tarea, así que quien va con cero -el candidato
   * ideal- no aparece ahí; `cargaDe` lo resuelve devolviendo 0.
   *
   * Se excluye a quien ya va igual o más cargado: ofrecerlo sería mover el
   * problema de sitio en vez de repartirlo.
   */
  candidatosParaAliviar(a: AsignacionBalance): PublicadorBase[] {
    const actual = this.getAsignacion(a.fecha, a.puesto)?.publicador?.id_publicador;
    const cargaActual = actual ? this.cargaDe(actual) : 0;
    const ocupados = this.ocupacionEnCasilla(a.fecha, a.puesto);
    return (this.candidatosCache()[a.puesto] ?? [])
      .filter((c) =>
        c.id_publicador !== actual
        && !ocupados[c.id_publicador]
        && this.cargaDe(c.id_publicador) < cargaActual,
      )
      .sort((x, y) =>
        this.cargaDe(x.id_publicador) - this.cargaDe(y.id_publicador)
        || x.nombre_completo.localeCompare(y.nombre_completo),
      );
  }

  /** Pasa la parte a otra persona. Reutiliza el flujo normal de reasignación. */
  reemplazarDesdeBalance(a: AsignacionBalance, idPublicador: number): void {
    this.cerrarReemplazo();
    this.onCambiarPublicador(a.fecha, a.puesto, idPublicador);
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
    this.comboboxPos.set(null);
    this.cargarOcupados(fecha);
    this.posicionarCombobox(fecha, puesto);
  }

  /**
   * Cierra el popover en cuanto se desplaza cualquier cosa que lo mueva de
   * sitio.
   *
   * El popover es `fixed`: se planta en coordenadas de pantalla y ahí se
   * queda, pero la celda que lo abrió viaja con el scroll. Al desplazar la
   * lista quedaban separados y el panel terminaba flotando sobre filas que no
   * eran las suyas.
   *
   * Un único listener en `document` y en fase de captura porque el scroll
   * puede venir de varios sitios -el área de contenido, el contenedor
   * horizontal de cada tabla, la ventana- y los eventos `scroll` de un
   * elemento no burbujean; en captura, en cambio, bajan desde `document`
   * hasta el objetivo, así que uno solo los ve todos.
   *
   * Se registra fuera de la zona de Angular: durante un desplazamiento esto
   * se dispara en cada fotograma y no vale la pena una ronda de detección de
   * cambios para comprobar una bandera que casi siempre está apagada.
   */
  private vigilarScrollParaCerrarCombobox(): void {
    const alScroll = (ev: Event) => {
      if (!this.activeCellKey()) return;
      const t = ev.target as HTMLElement | null;
      // Desplazarse DENTRO de la lista de candidatos no la cierra: ahí el
      // popover no se mueve respecto a la pantalla, que es lo que importa.
      if (t?.closest?.('[data-combobox-popover]')) return;
      this.zone.run(() => this.cerrarCombobox());
    };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('scroll', alScroll, { capture: true, passive: true });
    });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', alScroll, { capture: true });
    });
  }

  /**
   * Trae quién está ocupado ese día, una vez por fecha.
   *
   * Si la respuesta aún no llegó, la lista se pinta con todos como libres y
   * se reordena al llegar. Es preferible a bloquear el desplegable: abrirlo
   * es la acción más repetida de la pantalla y suele resolverse escribiendo
   * un nombre que ya se tenía en mente.
   */
  private cargarOcupados(fecha: string): void {
    if (this.ocupadosPorFecha()[fecha]) return;
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.logisticaSvc.getOcupados(fecha, cong).subscribe({
      next: (mapa) => {
        this.ocupadosPorFecha.update((c) => ({ ...c, [fecha]: mapa ?? {} }));
      },
      // Sin este dato la lista sigue siendo usable: se muestra sin separar.
      error: () => {},
    });
  }

  /**
   * Posición del popover de escritorio, en coordenadas de viewport.
   *
   * Antes el desplegable era `absolute` dentro de la celda, y la celda vive en
   * una tabla con `overflow-x-auto`. Ese contenedor recorta también en
   * vertical -es como funciona `overflow`: si un eje no es "visible" el otro
   * deja de serlo también-, así que el menú nacía cortado por el borde del
   * contenedor y, cerca del principio de la tabla, aparecía detrás de la
   * cabecera pegajosa. `fixed` con coordenadas propias escapa de cualquier
   * contenedor con scroll: ya no hay nada que lo recorte.
   *
   * El alto del panel varía según cuántos habilitados haya, así que en vez de
   * adivinarlo se decide con el espacio disponible: si abajo no entra un
   * panel razonable Y arriba hay más sitio, se abre hacia arriba con
   * `translateY(-100%)` desde el borde superior del disparador -así no hace
   * falta conocer el alto real para posicionarlo-. El eje horizontal se
   * ajusta para que nunca quede fuera de la pantalla.
   */
  private posicionarCombobox(fecha: string, puesto: string, intentos = 5): void {
    requestAnimationFrame(() => {
      // Hay dos maquetas en el DOM (tarjetas y tabla): sólo interesa la visible.
      const disparador = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-cell="${fecha}::${puesto}"]`),
      ).find((el) => el.offsetParent !== null);
      if (!disparador) {
        // La detección de cambios de Angular puede pintar la celda después de
        // este frame; se reintenta unos pocos en vez de rendirse en el primero.
        if (intentos > 0) this.posicionarCombobox(fecha, puesto, intentos - 1);
        return;
      }
      const PANEL_ANCHO = 288; // w-72
      const PANEL_ALTO_ESTIMADO = 240;
      const MARGEN = 6;
      const rect = disparador.getBoundingClientRect();
      const espacioAbajo = window.innerHeight - rect.bottom;
      const espacioArriba = rect.top;
      const openUp = espacioAbajo < PANEL_ALTO_ESTIMADO && espacioArriba > espacioAbajo;
      const left = Math.min(
        Math.max(rect.left, MARGEN),
        window.innerWidth - PANEL_ANCHO - MARGEN,
      );
      this.comboboxPos.set({
        top: openUp ? rect.top - MARGEN : rect.bottom + MARGEN,
        left,
        openUp,
      });
    });
  }

  cerrarCombobox(): void {
    this.activeCellKey.set(null);
    this.cellSearch.set('');
    this.resultadosBusqueda.set([]);
    this.buscandoPublicador.set(false);
    this.comboboxPos.set(null);
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

  /**
   * Sólo el día. Dentro de la tabla el mes ya lo dice el selector de la barra
   * superior, así que repetirlo en las diez filas gastaba media columna para
   * escribir "Septiembre" diez veces.
   */
  diaNumero(fechaStr: string): string {
    return String(new Date(fechaStr + 'T00:00:00').getDate()).padStart(2, '0');
  }

  mesLabel(m: MesDisponible): string {
    return `${MESES_ES[m.mes - 1]} ${m.ano}`;
  }

  /** Solo el nombre del mes, para listas ya agrupadas por año. */
  mesSoloLabel(m: MesDisponible): string {
    return MESES_ES[m.mes - 1];
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
      this.logisticaSvc.editarItem(asig.id_logistica, { id_publicador: idPublicador, confirmar_conflicto: true }).subscribe({
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

    // Tambien se busca en los resultados de la busqueda libre: quien viene de
    // "Otros publicadores" no esta en la cache de habilitados, y sin esto el
    // aviso de conflicto decia "Esta persona" en vez de su nombre.
    const nombre =
      nombrePreferido
      ?? this.candidatosCache()[puesto]?.find(c => c.id_publicador === idPublicador)?.nombre_completo
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

  descargarPdfMes(m: MesDisponible, opciones: OpcionesPdfLogistica = {}): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.descargandoPdf.set(true);
    this.logisticaSvc.descargarPdf(m.ano, m.mes, cong, opciones).subscribe({
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


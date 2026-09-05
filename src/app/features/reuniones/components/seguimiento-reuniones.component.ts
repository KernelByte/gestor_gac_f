import {
  Component, EventEmitter, HostListener, Input, OnInit, Output, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { ReunionesService } from '../services/reuniones.service';
import {
  AsistenciaSeguimiento, Seguimiento, SeguimientoHistorialResponse,
  SeguimientoOcurrencia, SeguimientoPersona, SeguimientoReunion, SeguimientoRol,
} from '../models/reuniones.models';
import {
  SeguimientoAsignacionPanelComponent, SeguimientoObjetivo,
} from './seguimiento-asignacion-panel.component';
import {
  claseNivel, etiquetaNivel, formatFecha, formatFechaLarga, formatSegundos, hace,
  nivelDeTiempo, parseTiempo,
} from './seguimiento-tiempo.util';

type SubTab = 'reuniones' | 'personas' | 'rotacion';

/** El estado editable de una fila de la hoja de trabajo. Es un objeto mutable
 *  y con identidad estable: `[(ngModel)]` escribe directamente sobre él, y el
 *  estado de guardado vive dentro para que la fila pueda enseñarlo sola. */
interface FilaEdicion {
  tiempo: string;
  asistio: AsistenciaSeguimiento | null;
  notas: string;
  estado: 'limpio' | 'guardando' | 'guardado' | 'error';
}

/**
 * El seguimiento del consejero, en las tres formas en que de verdad se usa.
 *
 * La primera versión de esta pantalla era un acordeón de conteos: decía cuántas
 * veces le había tocado algo a cada uno y poco más, y para APUNTAR había que
 * salir de aquí e ir pastilla por pastilla por el programa. Eso es justo al
 * revés de como se trabaja.
 *
 *   · «Reuniones» es la hoja de trabajo, y por eso abre primero: se sale de la
 *     reunión del miércoles y se apuntan de una sentada los tiempos de sus
 *     ocho partes, editando en línea, sin abrir y cerrar un diálogo por cada
 *     estudiante. Solo lista lo ya celebrado.
 *   · «Personas» es la ficha: no el conteo, sino cómo le va — cuántas veces se
 *     pasa de tiempo, cuánto de media, qué se le apuntó cada vez.
 *   · «Rotación» responde a quién asignar, y por eso ordena por quién lleva
 *     más tiempo sin llevar ese papel, no por quién más lo ha llevado.
 *
 * Todo sale de una sola llamada: el backend devuelve las tres vistas del mismo
 * recorrido, así que cambiar de pestaña no pide nada.
 */
@Component({
  selector: 'app-seguimiento-reuniones',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, SeguimientoAsignacionPanelComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
      (click)="cerrar.emit()">
      <div role="dialog" aria-modal="true" aria-labelledby="seg-hist-titulo"
        class="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl h-[92vh] sm:h-[88vh] flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden"
        (click)="$event.stopPropagation()">

        <div class="flex justify-center pt-3 pb-1 sm:hidden">
          <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
        </div>

        <!-- ═══ CABECERA ═══ -->
        <div class="shrink-0 px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3.5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 id="seg-hist-titulo" class="text-base font-black text-slate-900 dark:text-white">Seguimiento</h2>
              <p class="text-[0.7rem] text-slate-500 dark:text-slate-400 mt-0.5">Reunión entre semana</p>
            </div>
            <button type="button" (click)="cerrar.emit()" aria-label="Cerrar"
              class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Tres números que sí se miran: lo que queda por apuntar, cómo va
               el tiempo en general, y cuánta gente está entrando al programa. -->
          @if (datos(); as d) {
            <div class="grid grid-cols-3 gap-2">
              <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/70 dark:border-slate-700/60">
                <p class="text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Por apuntar</p>
                <p class="text-lg font-black leading-tight tabular-nums"
                  [class]="d.total_pendientes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
                  {{ d.total_pendientes }}
                </p>
              </div>
              <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/70 dark:border-slate-700/60">
                <p class="text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">En tiempo</p>
                <p class="text-lg font-black leading-tight text-slate-800 dark:text-slate-100 tabular-nums">
                  @if (d.tiempo.medidas > 0) {
                    {{ porcentajeEnTiempo(d) }}<span class="text-xs font-bold text-slate-400">%</span>
                  } @else {
                    <span class="text-sm text-slate-400 font-bold">—</span>
                  }
                </p>
              </div>
              <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/70 dark:border-slate-700/60">
                <p class="text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Personas</p>
                <p class="text-lg font-black leading-tight text-slate-800 dark:text-slate-100 tabular-nums">{{ d.total_personas }}</p>
              </div>
            </div>
          }

          <!-- Rango de fechas -->
          <div class="flex items-center gap-2">
            <div class="flex-1 flex flex-col gap-1">
              <label class="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Desde</label>
              <app-date-picker [(ngModel)]="rangoDesde" [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="cargar()" [maxDate]="rangoHasta || null" colorScheme="blue"
                placeholder="Sin límite"></app-date-picker>
            </div>
            <div class="flex-1 flex flex-col gap-1">
              <label class="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hasta</label>
              <app-date-picker [(ngModel)]="rangoHasta" [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="cargar()" [minDate]="rangoDesde || null" colorScheme="blue"
                placeholder="Sin límite"></app-date-picker>
            </div>
          </div>

          <!-- Sub-tabs -->
          <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 self-start" role="tablist">
            <button (click)="subTab.set('reuniones')" role="tab" [attr.aria-selected]="subTab() === 'reuniones'"
              class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-colors active:scale-[0.97]"
              [class]="subTab() === 'reuniones' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
              Reuniones
              @if (datos()?.total_pendientes) {
                <span class="min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[0.6rem] font-black flex items-center justify-center"
                  [class]="subTab() === 'reuniones' ? 'bg-white/25' : 'bg-amber-500 text-white'">{{ datos()!.total_pendientes }}</span>
              }
            </button>
            <button (click)="subTab.set('personas')" role="tab" [attr.aria-selected]="subTab() === 'personas'"
              class="px-3 h-9 rounded-lg text-xs font-bold transition-colors active:scale-[0.97]"
              [class]="subTab() === 'personas' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
              Personas
            </button>
            <button (click)="subTab.set('rotacion')" role="tab" [attr.aria-selected]="subTab() === 'rotacion'"
              class="px-3 h-9 rounded-lg text-xs font-bold transition-colors active:scale-[0.97]"
              [class]="subTab() === 'rotacion' ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
              Rotación
            </button>
          </div>
        </div>

        <!-- ═══ CUERPO ═══ -->
        <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar p-4 sm:p-5">

          @if (cargando()) {
            <div class="flex items-center justify-center py-16">
              <div class="w-7 h-7 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-blue-500 animate-spin"></div>
            </div>
          } @else if (error()) {
            <div role="alert" class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-red-600 dark:text-red-400 text-xs font-medium">
              {{ error() }}
            </div>
          } @else if (datos(); as d) {

            <!-- Un rango sin nada NO es un callejón sin salida: lo más fácil de
                 equivocar aquí es el año, así que se dice entre qué fechas hay
                 datos y se ofrece saltar ahí de un clic. -->
            @if (d.total_apariciones === 0) {
              <div class="flex flex-col items-center justify-center py-14 text-center gap-2.5">
                <p class="text-sm font-bold text-slate-500 dark:text-slate-400">No hay asignaciones en este rango</p>
                @if (d.rango_disponible.desde && d.rango_disponible.hasta) {
                  <p class="text-xs text-slate-400 dark:text-slate-500">
                    Hay programación desde el {{ formatFecha(d.rango_disponible.desde) }}
                    hasta el {{ formatFecha(d.rango_disponible.hasta) }}.
                  </p>
                  <button type="button" (click)="usarRangoDisponible(d)"
                    class="mt-1 px-4 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors active:scale-95">
                    Ver todo lo que hay
                  </button>
                } @else {
                  <p class="text-xs text-slate-400 dark:text-slate-500">Esta congregación aún no tiene programación asignada.</p>
                }
              </div>
            }

            <!-- ─────────── REUNIONES: la hoja de trabajo ─────────── -->
            @else if (subTab() === 'reuniones') {

              <div class="flex items-center gap-2.5 mb-4">
                <p class="text-xs font-bold text-slate-500 dark:text-slate-400 flex-1">
                  {{ d.reuniones.length }} reunión{{ d.reuniones.length === 1 ? '' : 'es' }} ya celebrada{{ d.reuniones.length === 1 ? '' : 's' }}
                </p>
                <button type="button" (click)="soloPendientes.set(!soloPendientes())"
                  [attr.aria-pressed]="soloPendientes()"
                  class="shrink-0 px-3 h-9 rounded-lg border text-[0.7rem] font-bold transition-colors active:scale-95"
                  [class]="soloPendientes()
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-amber-300'">
                  Solo lo que falta
                </button>
              </div>

              @if (reunionesVisibles(d).length === 0) {
                <div class="flex flex-col items-center justify-center py-14 text-center gap-2">
                  <p class="text-sm font-bold text-slate-500 dark:text-slate-400">Nada pendiente</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500">Todas las reuniones celebradas de este rango ya tienen su seguimiento.</p>
                </div>
              }

              <div class="flex flex-col gap-2.5">
                @for (r of reunionesVisibles(d); track r.fecha) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button type="button" (click)="toggle('m|' + r.fecha)"
                      [attr.aria-expanded]="expandido('m|' + r.fecha)"
                      class="w-full flex items-center gap-3 px-3.5 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left">
                      <span class="flex-1 min-w-0">
                        <span class="block text-sm font-bold text-slate-800 dark:text-slate-100">{{ formatFechaLarga(r.fecha) }}</span>
                        <span class="block text-[0.65rem] text-slate-400 dark:text-slate-500 mt-0.5">{{ r.registradas }} de {{ r.total }} partes apuntadas</span>
                      </span>
                      <!-- Barra de avance: se ve de un vistazo qué reunión está
                           a medias sin tener que abrirla. -->
                      <span class="hidden sm:block w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        <span class="block h-full rounded-full transition-all"
                          [class]="r.registradas === r.total ? 'bg-emerald-500' : 'bg-amber-500'"
                          [style.width.%]="r.total ? (r.registradas / r.total) * 100 : 0"></span>
                      </span>
                      @if (r.registradas === r.total) {
                        <span class="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </span>
                      } @else {
                        <span class="shrink-0 px-2 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[0.6rem] font-black flex items-center tabular-nums">{{ r.total - r.registradas }}</span>
                      }
                      <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform" [class.rotate-90]="expandido('m|' + r.fecha)"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>

                    @if (expandido('m|' + r.fecha)) {
                      <div class="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                        @for (o of partesVisibles(r); track o.id_asignacion) {
                          <div class="px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-800/25 flex flex-col gap-2">

                            <!-- Quién y qué -->
                            <div class="flex items-center gap-2 min-w-0">
                              <span class="shrink-0 w-1.5 h-1.5 rounded-full"
                                [class]="o.seguimiento ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'"></span>
                              <span class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{{ o.nombre_completo }}</span>
                              <span class="text-[0.65rem] text-slate-400 dark:text-slate-500 truncate min-w-0 flex-1">
                                {{ o.detalle }}@if (o.papel) {<span> · {{ o.papel }}</span>}@if (o.sala) {<span> · {{ o.sala }}</span>}
                              </span>
                              @if (o.duracion_minutos) {
                                <span class="shrink-0 text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 tabular-nums">{{ o.duracion_minutos }} min</span>
                              }
                            </div>

                            <!-- Los tres campos, en línea: apuntar ocho partes
                                 no puede costar ocho diálogos. -->
                            <div class="flex items-center gap-1.5 flex-wrap pl-3.5">
                              <label [attr.for]="'t-' + o.id_asignacion" class="sr-only">Tiempo de {{ o.nombre_completo }}</label>
                              <input [id]="'t-' + o.id_asignacion" type="text" inputmode="numeric"
                                [(ngModel)]="ed(o).tiempo" [ngModelOptions]="{ standalone: true }"
                                (blur)="guardarFila(o)" (keydown.enter)="guardarFila(o)"
                                placeholder="mm:ss"
                                class="w-[4.5rem] h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black text-center tabular-nums text-slate-800 dark:text-slate-100 placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors">

                              @if (nivelFila(o); as n) {
                                <span class="shrink-0 px-2 h-6 rounded-full text-[0.6rem] font-black flex items-center whitespace-nowrap" [class]="claseNivel(n)">
                                  {{ etiquetaNivel(n, segundosFila(o), o.duracion_minutos) }}
                                </span>
                              }

                              @for (op of ASISTENCIAS; track op.valor) {
                                <button type="button" (click)="marcarAsistencia(o, op.valor)"
                                  [attr.aria-pressed]="ed(o).asistio === op.valor"
                                  [title]="op.titulo"
                                  class="shrink-0 px-2 h-6 rounded-lg text-[0.6rem] font-black border transition-colors active:scale-95"
                                  [class]="ed(o).asistio === op.valor ? op.clase : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'">
                                  {{ op.corto }}
                                </button>
                              }

                              <label [attr.for]="'n-' + o.id_asignacion" class="sr-only">Observaciones de {{ o.nombre_completo }}</label>
                              <input [id]="'n-' + o.id_asignacion" type="text"
                                [(ngModel)]="ed(o).notas" [ngModelOptions]="{ standalone: true }"
                                (blur)="guardarFila(o)" (keydown.enter)="guardarFila(o)"
                                placeholder="Observaciones…"
                                class="flex-1 min-w-[8rem] h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors">

                              <!-- Estado del guardado. Sin esto, escribir y que
                                   se guarde solo sería un acto de fe. -->
                              <span class="shrink-0 w-5 h-5 flex items-center justify-center">
                                @switch (ed(o).estado) {
                                  @case ('guardando') {
                                    <span class="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 animate-spin"></span>
                                  }
                                  @case ('guardado') {
                                    <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                  }
                                  @case ('error') {
                                    <svg class="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01" stroke-linecap="round"/></svg>
                                  }
                                }
                              </span>

                              <!-- Para lo que la fila no da: el cronómetro. -->
                              <button type="button" (click)="abrirPanel(o)"
                                title="Abrir con cronómetro"
                                [attr.aria-label]="'Abrir el cronómetro de ' + o.nombre_completo"
                                class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/25 transition-colors active:scale-95">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 1.5M9.5 2h5"/></svg>
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <!-- ─────────── PERSONAS: la ficha ─────────── -->
            @else if (subTab() === 'personas') {

              <div class="mb-4">
                <label for="seg-filtro-p" class="sr-only">Filtrar por nombre</label>
                <input id="seg-filtro-p" type="text" [(ngModel)]="filtroTexto" [ngModelOptions]="{ standalone: true }"
                  placeholder="Filtrar por nombre…"
                  class="h-9 px-3 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors">
              </div>

              @if (personasFiltradas().length === 0) {
                <div class="flex flex-col items-center justify-center py-14 text-center gap-2">
                  <p class="text-sm font-bold text-slate-500 dark:text-slate-400">Sin resultados</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500">Nadie con ese nombre tiene asignaciones en el rango.</p>
                </div>
              }

              <div class="flex flex-col gap-2">
                @for (p of personasFiltradas(); track p.id_publicador) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button type="button" (click)="toggle('p|' + p.id_publicador)"
                      [attr.aria-expanded]="expandido('p|' + p.id_publicador)"
                      class="w-full flex items-center gap-3 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left">
                      <span class="flex-1 min-w-0">
                        <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ p.nombre_completo }}</span>
                        <span class="block text-[0.65rem] text-slate-400 dark:text-slate-500 mt-0.5">
                          {{ p.total }} parte{{ p.total === 1 ? '' : 's' }} ·
                          @if (p.dias_desde_ultima != null) {
                            última {{ hace(p.dias_desde_ultima) | lowercase }}
                          } @else {
                            aún sin celebrar ninguna
                          }
                          @if (p.proxima_fecha) {
                            <span class="text-blue-500 dark:text-blue-400"> · próxima {{ formatFecha(p.proxima_fecha) }}</span>
                          }
                        </span>
                      </span>

                      <!-- Cómo se le da el tiempo, en una barra de tres tramos:
                           es lo que un conteo nunca dijo. -->
                      @if (p.tiempo && p.tiempo.medidas > 0) {
                        <span class="hidden sm:flex shrink-0 items-center gap-1.5">
                          <span class="flex w-20 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                            <span class="h-full bg-amber-400" [style.width.%]="pct(p.tiempo.corto, p.tiempo.medidas)"></span>
                            <span class="h-full bg-emerald-500" [style.width.%]="pct(p.tiempo.en_tiempo, p.tiempo.medidas)"></span>
                            <span class="h-full bg-red-500" [style.width.%]="pct(p.tiempo.pasado, p.tiempo.medidas)"></span>
                          </span>
                          @if (p.tiempo.desviacion_media_seg != null) {
                            <span class="text-[0.6rem] font-black tabular-nums whitespace-nowrap"
                              [class]="p.tiempo.desviacion_media_seg > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'">
                              {{ p.tiempo.desviacion_media_seg > 0 ? '+' : '−' }}{{ formatSegundos(abs(p.tiempo.desviacion_media_seg)) }}
                            </span>
                          }
                        </span>
                      }

                      @if (p.sin_seguimiento > 0) {
                        <span class="shrink-0 px-2 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[0.6rem] font-black flex items-center"
                          title="Partes ya celebradas sin apuntar">{{ p.sin_seguimiento }} sin apuntar</span>
                      }
                      <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform" [class.rotate-90]="expandido('p|' + p.id_publicador)"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>

                    @if (expandido('p|' + p.id_publicador)) {
                      <div class="border-t border-slate-100 dark:border-slate-800">
                        @if (p.tiempo && p.tiempo.medidas > 0) {
                          <div class="px-3.5 py-2 bg-white dark:bg-slate-900 flex items-center gap-3 flex-wrap text-[0.65rem] font-bold border-b border-slate-100 dark:border-slate-800">
                            <span class="text-slate-400 dark:text-slate-500">{{ p.tiempo.medidas }} cronometrada{{ p.tiempo.medidas === 1 ? '' : 's' }}:</span>
                            <span class="text-emerald-600 dark:text-emerald-400">{{ p.tiempo.en_tiempo }} en tiempo</span>
                            <span class="text-red-600 dark:text-red-400">{{ p.tiempo.pasado }} se pasó</span>
                            <span class="text-amber-600 dark:text-amber-400">{{ p.tiempo.corto }} corto</span>
                          </div>
                        }
                        <div class="divide-y divide-slate-100 dark:divide-slate-800">
                          @for (r of p.roles; track r.rol_key) {
                            <div class="bg-slate-50/60 dark:bg-slate-800/30">
                              <button type="button" (click)="toggle('r|' + p.id_publicador + '|' + r.rol_key)"
                                [attr.aria-expanded]="expandido('r|' + p.id_publicador + '|' + r.rol_key)"
                                class="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors">
                                <span class="flex-1 min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{{ r.etiqueta }}</span>
                                @if (r.veces > 1) {
                                  <span class="shrink-0 text-[0.65rem] font-black text-amber-600 dark:text-amber-400">×{{ r.veces }}</span>
                                }
                                <span class="shrink-0 text-[0.6rem] text-slate-400 dark:text-slate-500 hidden sm:inline">
                                  {{ r.dias_desde_ultima != null ? hace(r.dias_desde_ultima) : 'Solo programada' }}
                                </span>
                                <svg class="w-3 h-3 shrink-0 text-slate-400 transition-transform" [class.rotate-90]="expandido('r|' + p.id_publicador + '|' + r.rol_key)"
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                              </button>

                              @if (expandido('r|' + p.id_publicador + '|' + r.rol_key)) {
                                <div class="pb-1.5">
                                  @for (o of r.ocurrencias; track o.id_asignacion) {
                                    <button type="button" (click)="abrirPanel(o)"
                                      class="w-full flex items-start gap-2.5 pl-5 pr-3.5 py-1.5 text-left hover:bg-white dark:hover:bg-slate-900/60 transition-colors">
                                      <span class="shrink-0 w-20 text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 pt-px">{{ formatFecha(o.fecha) }}</span>
                                      <span class="flex-1 min-w-0 flex flex-col gap-0.5">
                                        @if (o.seguimiento; as s) {
                                          <span class="flex items-center gap-1.5 flex-wrap">
                                            @if (s.duracion_real_seg != null) {
                                              <span class="px-1.5 h-5 rounded-full text-[0.6rem] font-black flex items-center tabular-nums" [class]="claseNivel(s.nivel)">
                                                {{ formatSegundos(s.duracion_real_seg) }}
                                              </span>
                                            }
                                            @if (s.asistio === 'no') {
                                              <span class="px-1.5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[0.6rem] font-black flex items-center">No vino</span>
                                            } @else if (s.asistio === 'sustituido') {
                                              <span class="px-1.5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[0.6rem] font-black flex items-center">Sustituido</span>
                                            }
                                          </span>
                                          @if (s.notas) {
                                            <span class="text-[0.65rem] text-slate-500 dark:text-slate-400 line-clamp-2">{{ s.notas }}</span>
                                          }
                                        } @else if (o.fecha <= hoyIso) {
                                          <span class="text-[0.65rem] text-amber-600/80 dark:text-amber-400/80 italic">Sin apuntar</span>
                                        } @else {
                                          <span class="text-[0.65rem] text-slate-400 dark:text-slate-500 italic">Programada</span>
                                        }
                                      </span>
                                      @if (o.sala) {
                                        <span class="shrink-0 text-[0.6rem] font-bold text-slate-400">{{ o.sala }}</span>
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

            <!-- ─────────── ROTACIÓN: a quién le toca ─────────── -->
            @else {

              <div class="mb-4 flex flex-col gap-2">
                <label for="seg-filtro-r" class="sr-only">Filtrar por parte</label>
                <input id="seg-filtro-r" type="text" [(ngModel)]="filtroTexto" [ngModelOptions]="{ standalone: true }"
                  placeholder="Filtrar por parte…"
                  class="h-9 px-3 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors">
                <p class="text-[0.65rem] text-slate-400 dark:text-slate-500">
                  Dentro de cada parte, primero quien lleva más tiempo sin llevarla.
                </p>
              </div>

              @if (rolesFiltrados().length === 0) {
                <div class="flex flex-col items-center justify-center py-14 text-center gap-2">
                  <p class="text-sm font-bold text-slate-500 dark:text-slate-400">Sin resultados</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500">Ninguna parte con ese nombre en el rango.</p>
                </div>
              }

              <div class="flex flex-col gap-2">
                @for (r of rolesFiltrados(); track r.rol_key) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button type="button" (click)="toggle('rol|' + r.rol_key)"
                      [attr.aria-expanded]="expandido('rol|' + r.rol_key)"
                      class="w-full flex items-center gap-3 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left">
                      <span class="flex-1 min-w-0">
                        <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ r.etiqueta }}</span>
                        <span class="block text-[0.65rem] text-slate-400 dark:text-slate-500 mt-0.5">
                          {{ r.total }} vez{{ r.total === 1 ? '' : 'ces' }} · {{ r.personas.length }} persona{{ r.personas.length === 1 ? '' : 's' }}
                        </span>
                      </span>
                      <!-- Quién la lleva esperando más: el dato por el que se
                           abre esta pestaña, visible sin abrir la fila. -->
                      @if (r.personas.length) {
                        <span class="hidden sm:block shrink-0 text-right">
                          <span class="block text-[0.6rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Le toca</span>
                          <span class="block text-[0.7rem] font-bold text-violet-600 dark:text-violet-400 truncate max-w-[10rem]">{{ r.personas[0].nombre_completo }}</span>
                        </span>
                      }
                      <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform" [class.rotate-90]="expandido('rol|' + r.rol_key)"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>

                    @if (expandido('rol|' + r.rol_key)) {
                      <div class="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                        @for (p of r.personas; track p.id_publicador) {
                          <div class="flex items-center gap-2.5 px-3.5 py-2 bg-slate-50/60 dark:bg-slate-800/30">
                            <span class="flex-1 min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{{ p.nombre_completo }}</span>
                            <span class="shrink-0 text-[0.65rem] font-black text-slate-400 dark:text-slate-500 tabular-nums">×{{ p.veces }}</span>
                            <span class="shrink-0 w-28 text-right text-[0.6rem] font-bold">
                              @if (p.proxima_fecha) {
                                <span class="text-blue-500 dark:text-blue-400">Ya tiene {{ formatFecha(p.proxima_fecha) }}</span>
                              } @else if (p.dias_desde_ultima == null) {
                                <span class="text-violet-600 dark:text-violet-400">Nunca</span>
                              } @else {
                                <span [class]="p.dias_desde_ultima >= 90 ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500'">
                                  {{ hace(p.dias_desde_ultima) }}
                                </span>
                              }
                            </span>
                          </div>
                        }
                      </div>
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

  readonly ASISTENCIAS: { valor: AsistenciaSeguimiento; corto: string; titulo: string; clase: string }[] = [
    { valor: 'si', corto: 'Sí', titulo: 'Cumplió', clase: 'bg-emerald-600 border-emerald-600 text-white' },
    { valor: 'no', corto: 'No', titulo: 'No vino', clase: 'bg-red-500 border-red-500 text-white' },
    { valor: 'sustituido', corto: 'Sust.', titulo: 'Lo sustituyeron', clase: 'bg-amber-500 border-amber-500 text-white' },
  ];

  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Con el panel de una asignación abierto, Escape lo cierra a él primero:
    // es el que está encima y el que tiene datos sin guardar.
    if (this.panelObjetivo()) return;
    this.cerrar.emit();
  }

  subTab = signal<SubTab>('reuniones');
  cargando = signal(false);
  error = signal('');
  datos = signal<SeguimientoHistorialResponse | null>(null);

  filtroTexto = signal('');
  soloPendientes = signal(false);
  private expandidos = signal<Set<string>>(new Set());
  panelObjetivo = signal<SeguimientoObjetivo | null>(null);

  rangoDesde: string | null = null;
  rangoHasta: string | null = null;

  readonly hoyIso = new Date().toISOString().slice(0, 10);

  /** Estado editable de la hoja de trabajo, por asignación. Es un Map plano y
   *  no un signal a propósito: `[(ngModel)]` escribe sobre el objeto que
   *  devuelve `ed()`, y esa referencia tiene que ser la misma en cada ciclo de
   *  detección o el input perdería el foco a la primera tecla. */
  private ediciones = new Map<number, FilaEdicion>();

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
    const hace12 = new Date();
    hace12.setFullYear(hace12.getFullYear() - 1);
    this.rangoDesde = hace12.toISOString().slice(0, 10);
    this.rangoHasta = null;
    this.cargar();
  }

  cargar(): void {
    if (!this.idCong) return;
    this.cargando.set(true);
    this.error.set('');
    this.svc.getSeguimientoHistorial(
      this.idCong, this.tipoReunion, this.rangoDesde, this.rangoHasta,
    ).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.ediciones.clear();
        // La reunión más reciente abierta de entrada: es la que se viene a
        // apuntar el 90 % de las veces, y un clic menos es un clic menos.
        const primera = d.reuniones.find(r => r.registradas < r.total) ?? d.reuniones[0];
        if (primera) this.expandidos.set(new Set([`m|${primera.fecha}`]));
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el seguimiento.');
        this.cargando.set(false);
      },
    });
  }

  /** Salta al rango en el que sí hay datos, desde el aviso de rango vacío. */
  usarRangoDisponible(d: SeguimientoHistorialResponse): void {
    this.rangoDesde = d.rango_disponible.desde ?? null;
    this.rangoHasta = d.rango_disponible.hasta ?? null;
    this.cargar();
  }

  porcentajeEnTiempo(d: SeguimientoHistorialResponse): number {
    return Math.round((d.tiempo.en_tiempo / d.tiempo.medidas) * 100);
  }

  pct(parte: number, total: number): number {
    return total ? (parte / total) * 100 : 0;
  }

  // ── Hoja de trabajo ──

  reunionesVisibles(d: SeguimientoHistorialResponse): SeguimientoReunion[] {
    if (!this.soloPendientes()) return d.reuniones;
    return d.reuniones.filter(r => r.registradas < r.total);
  }

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
   */
  guardarFila(o: SeguimientoOcurrencia): void {
    if (!this.idCong) return;
    const fila = this.ed(o);
    const segundos = parseTiempo(fila.tiempo);
    const notas = fila.notas.trim() || null;
    const s = o.seguimiento;

    const igual =
      (s?.duracion_real_seg ?? null) === segundos &&
      (s?.asistio ?? null) === fila.asistio &&
      (s?.notas ?? null) === notas;
    if (igual) return;

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
        // El check se apaga solo: es un acuse, no un estado.
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
        .filter(o => !o.seguimiento && o.fecha <= this.hoyIso).length;
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

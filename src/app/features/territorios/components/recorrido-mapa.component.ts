import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, computed, effect, inject, signal, untracked,
} from '@angular/core';
import { escapeHtml } from '../../../shared/escape-html';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { TerritoriosService } from '../services/territorios.service';
import { crearCapaBasePropia } from '../utils/mapa-base-propio';
import { fechaIsoLocal, hoyIso } from '../../../core/utils/fecha.util';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
import { CriterioRecorrido, ManzanaRecorrido, PuntoSalidaOpcion, RecorridoRespuesta, SugerenciaSalida } from '../models/territorio.model';
import { SalidaProgramada, SalidasProgramaService, horaLegible, tituloDia } from '../services/salidas-programa.service';
import { codigosDe, textoManzanas } from '../utils/rangos-manzanas.util';

/** Zoom desde el cual se ven los números de las manzanas (más lejos solo se ve el color). */
const ZOOM_NUMEROS = 15;

/**
 * Mapa de todo el territorio de la congregación para el encargado: en qué orden se va predicando,
 * qué manzanas ya se hicieron y cuáles siguen, y marcar de una vez las que se predicaron (de una o varias tarjetas).
 */
@Component({
  selector: 'app-recorrido-mapa',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SelectPickerComponent],
  template: `
    <div class="h-full min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4">

      <!-- ── Mapa: ocupa todo lo que puede; lo demás flota encima o va en el panel ── -->
      <div class="relative h-[58dvh] min-h-[22rem] lg:h-auto lg:min-h-0 lg:flex-1 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/70 bg-slate-100 dark:bg-slate-900">
        <div #mapa class="absolute inset-0" [class.rec-zoom-bajo]="zoomBajo()"></div>

        @if (cargando()) {
          <div class="absolute inset-0 z-30 flex items-center justify-center bg-white/70 dark:bg-slate-900/60">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Cargando el mapa…</span>
          </div>
        }
        @if (errorCarga()) {
          <div class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-white/90 dark:bg-slate-900/90 text-center p-6" role="alert">
            <p class="text-base font-bold text-slate-900 dark:text-white">No se pudo cargar el recorrido</p>
            <button type="button" (click)="cargar(true)" class="h-11 px-5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">Reintentar</button>
          </div>
        }

        <!-- Avisos de modo, arriba y centrados -->
        @if (eligiendoInicio()) {
          <div class="flota absolute top-3 left-14 right-3 z-30 flex items-center justify-between gap-3 rounded-xl bg-violet-700 text-white pl-4 pr-2 py-2 shadow-lg" role="status">
            <p class="text-sm font-semibold">Toque la manzana donde empieza el recorrido.</p>
            <button type="button" (click)="eligiendoInicio.set(false)" class="shrink-0 h-9 px-3 text-sm font-bold rounded-lg bg-white/15 hover:bg-white/25">Cancelar</button>
          </div>
        } @else if (marcando()) {
          <div class="flota absolute top-3 left-14 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30 rounded-xl bg-slate-900/90 text-white px-4 py-2 shadow-lg text-[13px] leading-snug text-center" role="status">
            Toque una manzana: <b class="text-emerald-300">predicada</b> → <b class="text-fuchsia-300">a medias</b> → <b>no se predicó</b>
          </div>
        }

        @if (vistaPasada(); as vp) {
          <div class="flota absolute top-3 left-14 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30 rounded-xl bg-slate-900/90 text-white px-4 py-2 shadow-lg text-[13px] leading-snug text-center" role="status">
            Vuelta pasada: {{ vp.ciclo.fecha_inicio | date:'d MMM y':'':'es' }}@if (vp.ciclo.fecha_fin) { → {{ vp.ciclo.fecha_fin | date:'d MMM y':'':'es' }} }
            <button type="button" (click)="volverALaActual()" class="ml-2 underline font-bold">Volver</button>
          </div>
        }

        <!-- Ficha de la manzana tocada -->
        @if (foco(); as f) {
          @if (!marcando()) {
            <!-- Se vuelve a crear con cada manzana tocada: la ficha «salta» desde su sitio y se nota que respondió al toque -->
            @for (k of [f.id_manzana]; track k) {
            <div class="flota ficha absolute top-3 right-3 z-30 w-72 max-w-[calc(100%-4.5rem)] rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-lg p-3.5" aria-live="polite">
              <div class="flex items-start justify-between gap-2">
                <p class="text-[15px] font-black text-slate-900 dark:text-white leading-tight">Manzana {{ f.numero }}
                  <span class="block text-xs font-semibold text-slate-500 dark:text-slate-400">Tarjeta {{ f.codigo }}@if (f.barrio) { · {{ f.barrio }} }</span></p>
                <button type="button" (click)="foco.set(null)" class="-mr-1 -mt-1 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Cerrar">✕</button>
              </div>
              <p class="mt-2 text-sm text-slate-700 dark:text-slate-200 leading-snug">
                @if (f.estado_tarjeta) {
                  Fuera del recorrido: la tarjeta está {{ textoEstado(f.estado_tarjeta) }}.
                } @else if (f.predicada) {
                  <span class="punto bg-emerald-500"></span>Predicada el {{ f.fecha_predicada | date:'d MMM y':'':'es' }}@if (f.capitan && f.capitan !== 'Sin capitán') { · con {{ f.capitan }} }
                } @else if (f.parcial; as pa) {
                  <span class="punto bg-amber-500"></span>A medias desde el {{ pa.fecha | date:'d MMM y':'':'es' }}@if (pa.capitan) { · con {{ pa.capitan }} }
                  @if (pa.nota) { <span class="block mt-1 font-semibold text-amber-800 dark:text-amber-200">Faltó: {{ pa.nota }}</span> }
                } @else if (f.siguiente) {
                  <span class="punto bg-orange-500"></span>Pendiente · es la n.º {{ f.siguiente }} de las que siguen
                } @else {
                  <span class="punto bg-slate-400"></span>Pendiente
                }
              </p>
              @if (f.asignada_a) { <p class="mt-1 text-xs font-semibold text-violet-700 dark:text-violet-300">Asignada a {{ f.asignada_a }}</p> }
              <!-- Corregir lo marcado sin registrar otra salida -->
              @if (!vistaPasada() && !f.estado_tarjeta && (f.predicada || f.parcial)) {
                <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  @switch (correccion()) {
                    @case ('medias') {
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1" for="ficha-falto">¿Qué faltó? <span class="font-normal text-slate-500">(opcional)</span></label>
                      <input id="ficha-falto" type="text" maxlength="200" [value]="notaCorreccion" (input)="notaCorreccion = $any($event.target).value"
                        placeholder="Ej.: el lado de la Calle 22"
                        class="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white" />
                      <div class="mt-2 flex gap-2">
                        <button type="button" (click)="correccion.set(null)" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">Volver</button>
                        <button type="button" (click)="corregir(f, 'parcial')" [disabled]="guardando()" class="flex-1 h-10 rounded-lg bg-fuchsia-700 hover:bg-fuchsia-800 text-white text-sm font-bold disabled:opacity-50">Guardar</button>
                      </div>
                    }
                    @case ('quitar') {
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">¿Quitar la marca? La manzana vuelve a quedar pendiente.</p>
                      <div class="mt-2 flex gap-2">
                        <button type="button" (click)="correccion.set(null)" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                        <button type="button" (click)="quitarDeFicha(f)" [disabled]="guardando()" class="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50">Sí, quitar</button>
                      </div>
                    }
                    @default {
                      <p class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Editar estado</p>
                      <div class="flex gap-2">
                        @if (f.predicada) {
                          <button type="button" (click)="correccion.set('medias'); notaCorreccion = ''" class="flex-1 h-10 rounded-lg border border-fuchsia-300 dark:border-fuchsia-800 text-fuchsia-800 dark:text-fuchsia-200 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/30 text-sm font-bold">Fue a medias</button>
                        } @else {
                          <button type="button" (click)="corregir(f, 'predicada')" [disabled]="guardando()" class="flex-1 h-10 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-sm font-bold disabled:opacity-50">Ya se terminó</button>
                        }
                        <button type="button" (click)="correccion.set('quitar')" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold">Quitar la marca</button>
                      </div>
                    }
                  }
                  @if (errorFicha()) { <p class="mt-2 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">{{ errorFicha() }}</p> }
                </div>
              }
            </div>
            }
          }
        }

        <!-- Leyenda plegable -->
        <div class="absolute bottom-3 left-3 z-30">
          @if (leyenda()) {
            <div class="flota mb-2 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-lg p-3" id="rec-leyenda">
              <ul class="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                <li class="flex items-center gap-2"><span class="mz bg-green-500/70 border border-green-700"></span>Predicada</li>
                <li class="flex items-center gap-2"><span class="mz bg-green-500/25 border-2 border-dashed border-green-700"></span>A medias (falta una parte)</li>
                <li class="flex items-center gap-2"><span class="mz bg-amber-400/70 border-2 border-amber-700"></span>Las {{ siguientesMax() }} que siguen (las de la próxima salida)</li>
                <li class="flex items-center gap-2"><span class="mz bg-white border border-slate-500"></span>Pendiente</li>
                <li class="flex items-center gap-2"><span class="mz bg-white border border-dashed border-slate-500"></span>Asignada a un publicador</li>
                <li class="flex items-center gap-2"><span class="mz bg-slate-300/80 border border-dotted border-slate-400"></span>Tarjeta en pausa o retirada</li>
              </ul>
            </div>
          }
          <button type="button" (click)="leyenda.set(!leyenda())" [attr.aria-expanded]="leyenda()" aria-controls="rec-leyenda"
            class="h-9 px-3 rounded-lg bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-white dark:hover:bg-slate-700">
            <span class="flex -space-x-0.5"><span class="w-2.5 h-2.5 rounded-sm bg-green-500"></span><span class="w-2.5 h-2.5 rounded-sm bg-amber-400"></span><span class="w-2.5 h-2.5 rounded-sm bg-white border border-slate-400"></span></span>
            {{ leyenda() ? 'Ocultar colores' : 'Colores' }}
          </button>
        </div>
      </div>

      <!-- ── Panel: un solo modo a la vez (resumen o registrar) ── -->
      <aside class="lg:w-[22rem] xl:w-[24rem] shrink-0 flex flex-col lg:min-h-0 rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-800 lg:overflow-hidden"
        [attr.aria-label]="marcando() ? 'Registrar predicación' : 'Recorrido'">

        @if (marcando()) {
          <!-- Registrar: el formulario vive aquí, el mapa queda libre para tocar las manzanas -->
          <header class="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700/60">
            <h3 class="text-base font-black text-slate-900 dark:text-white">Registrar predicación</h3>
            <button type="button" (click)="cancelarMarcado()" class="w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Cancelar">✕</button>
          </header>

          <div class="flex-1 lg:min-h-0 lg:overflow-y-auto px-4 py-4 space-y-5">
            <!-- 1. Cuándo -->
            <section>
              <p class="paso"><span>1</span>¿Qué salida fue?</p>
              @if (opcionesSalida().length) {
                <app-select-picker colorScheme="emerald" ariaLabel="Fecha de la salida" [ngModel]="valorSalida()"
                  (ngModelChange)="elegirSalida($event)" [options]="opcionesSalida()" [searchable]="false"
                  placeholder="Elija la salida del programa" />
              }
              @if (!opcionesSalida().length || fueraDelPrograma()) {
                <input id="rec-fecha" type="date" [(ngModel)]="fecha" [max]="hoy" [class.mt-2]="opcionesSalida().length" aria-label="Fecha en que se predicó"
                  class="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              }
            </section>

            <!-- 2. Qué manzanas -->
            <section>
              <p class="paso"><span>2</span>¿Qué manzanas se predicaron?</p>
              <div class="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-3">
                <div class="flex items-center gap-3">
                  <p class="flex-1 min-w-0 leading-tight">
                    <span class="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{{ nPendientesElegidas() }}</span>
                    <span class="text-sm font-semibold text-slate-600 dark:text-slate-300"> {{ nPendientesElegidas() === 1 ? 'manzana' : 'manzanas' }}</span>
                    @if (tarjetasElegidas()) { <span class="block text-xs text-slate-500 dark:text-slate-400 truncate">{{ tarjetasElegidas() }}@if (aMedias().size) { · <b class="text-amber-700 dark:text-amber-300">{{ aMedias().size }} a medias</b> }</span> }
                  </p>
                  <!-- Se predicaron menos o más de las sugeridas: se ajusta siguiendo el orden -->
                  <div class="flex items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden" role="group" aria-label="Ajustar cuántas se predicaron">
                    <button type="button" (click)="menosUna()" [disabled]="nPendientesElegidas() === 0" title="Quitar la última en el orden"
                      class="w-11 h-11 text-xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30" aria-label="Una menos">−</button>
                    <span class="w-px h-6 bg-slate-200 dark:bg-slate-600"></span>
                    <button type="button" (click)="masUna()" [disabled]="!hayOtraQueSigue()" title="Agregar la que sigue en el orden"
                      class="w-11 h-11 text-xl font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-30" aria-label="La que sigue">+</button>
                  </div>
                </div>
                @if (nPendientesElegidas() === 0 && nPredicadasElegidas() === 0) {
                  <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Toque en el mapa las manzanas que se predicaron, o use <b>+</b> para ir agregando las que siguen.</p>
                }
                @if (sugerida(); as sg) {
                  @if (hayPistaSugerida() && nPendientesElegidas() === 0) {
                    <div class="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-2.5 py-2">
                      <p class="flex-1 min-w-0 text-xs font-semibold text-amber-900 dark:text-amber-100">Le tocaba: {{ textoDe(sg) }} <span class="font-normal">· marcadas en azul a trazos en el mapa</span></p>
                      <button type="button" (click)="usarSugeridas()"
                        class="shrink-0 h-9 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold">Marcar esas</button>
                    </div>
                  }
                }
              </div>

              @if (aMedias().size) {
                <ul class="mt-2 space-y-2" aria-label="Manzanas a medias">
                  @for (am of listaAMedias(); track am.id) {
                    <li class="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-2.5">
                      <label class="block text-xs font-bold text-amber-900 dark:text-amber-100 mb-1" [for]="'falto-' + am.id"><span class="inline-block size-3 rounded-sm align-[-1px] mr-1 border-2 border-dashed border-fuchsia-700 bg-fuchsia-300"></span>Manzana {{ am.numero }} a medias · ¿qué faltó?</label>
                      <input [id]="'falto-' + am.id" type="text" maxlength="200" [ngModel]="am.nota" (ngModelChange)="anotarFalta(am.id, $event)"
                        placeholder="Ej.: el lado de la Calle 22 (opcional)"
                        class="w-full h-10 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </li>
                  }
                </ul>
              }
            </section>

            <!-- 3. Quién -->
            @if (nPendientesElegidas() > 0 || elegidas().size === 0) {
              <section>
                <p class="paso"><span>3</span>¿Quién la dirigió? <span class="font-medium normal-case text-slate-400">(opcional)</span></p>
                <div class="space-y-2">
                  <app-select-picker colorScheme="emerald" ariaLabel="Capitán" [(ngModel)]="capitan"
                    [options]="capitanes" placeholder="Capitán" [searchable]="true" />
                  <app-select-picker colorScheme="emerald" ariaLabel="Punto de salida" [(ngModel)]="punto"
                    [options]="opcionesPunto()" placeholder="Punto de salida" [searchable]="false" />
                </div>
              </section>
            }

            @if (errorMarca()) {
              <p class="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{{ errorMarca() }}</p>
            }
          </div>

          <footer class="shrink-0 px-4 py-3 border-t border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 space-y-2">
            @if (confirmarQuitar()) {
              <p class="text-sm font-semibold text-red-800 dark:text-red-200" role="alert">
                ¿Quitar la marca de {{ nPredicadasElegidas() }} {{ nPredicadasElegidas() === 1 ? 'manzana' : 'manzanas' }}? Vuelven a quedar pendientes.
              </p>
              <div class="flex gap-2">
                <button type="button" (click)="confirmarQuitar.set(false)" class="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                <button type="button" (click)="quitarMarcas()" [disabled]="guardando()" class="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60">Sí, quitar</button>
              </div>
            } @else {
              <button type="button" (click)="guardarMarcas()" [disabled]="guardando() || nPendientesElegidas() === 0"
                class="btn-pri w-full h-12 rounded-xl text-white text-[15px] font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                {{ guardando() ? 'Guardando…' : 'Guardar lo predicado' + (nPendientesElegidas() ? ' (' + nPendientesElegidas() + ')' : '') }}
              </button>
              @if (nPredicadasElegidas() > 0) {
                <button type="button" (click)="confirmarQuitar.set(true)"
                  class="w-full h-10 rounded-xl text-sm font-bold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Quitar la marca de {{ nPredicadasElegidas() }} ya {{ nPredicadasElegidas() === 1 ? 'predicada' : 'predicadas' }}
                </button>
              }
            }
          </footer>
        } @else {
          <div class="flex-1 lg:min-h-0 lg:overflow-y-auto">
            @if (datos(); as d) {
              @let av = avance()!;
              <!-- Resumen + acción principal -->
              <section class="p-4 pb-5">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ idTerritorio == null ? 'Toda la congregación' : 'Esta tarjeta' }}</p>
                  <p class="text-sm tabular-nums text-slate-600 dark:text-slate-300"><b class="text-lg font-black text-slate-900 dark:text-white">{{ av.predicadas }}</b> de {{ av.total }} · <b class="text-emerald-700 dark:text-emerald-400">{{ porcentaje() }}%</b></p>
                </div>
                <div class="mt-2 h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex" role="progressbar" [attr.aria-valuenow]="porcentaje()" aria-valuemin="0" aria-valuemax="100" aria-label="Avance">
                  <div class="h-full bg-emerald-500 transition-[width] duration-500 ease-out" [style.width.%]="porcentaje()"></div>
                  <div class="h-full bg-amber-400/80 transition-[width] duration-500 ease-out" [style.width.%]="porcentajeMedias()"></div>
                </div>
                <p class="mt-2.5 text-sm text-slate-700 dark:text-slate-200 leading-snug">
                  @if (siguienteVisible(); as s) {
                    Sigue la <b class="font-black">manzana {{ s.numero }}</b>@if (idTerritorio == null) { <span class="text-slate-500 dark:text-slate-400"> · tarjeta {{ s.codigo }}</span> }@if (av.aMedias) { <span class="text-amber-700 dark:text-amber-300"> · {{ av.aMedias }} a medias</span> }
                  } @else if (av.total > 0) {
                    <span class="font-semibold text-emerald-700 dark:text-emerald-400">{{ idTerritorio == null ? 'Se predicó todo el territorio.' : 'Se predicaron todas las manzanas.' }}</span>
                  } @else {
                    {{ idTerritorio == null ? 'Aún no hay manzanas dibujadas.' : 'Esta tarjeta aún no tiene manzanas dibujadas.' }} Dibújelas en Territorios.
                  }
                </p>
                <button type="button" (click)="empezarMarcado()" [disabled]="av.total === 0 || !!vistaPasada()"
                  class="btn-pri mt-4 w-full h-12 rounded-xl text-white text-[15px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  Registrar predicación
                </button>
              </section>

              <!-- Salidas ya hechas sin registrar -->
              @if (deshacerSinSalida(); as u) {
                <div class="flota mx-4 mt-4 flex items-center gap-2 rounded-xl bg-slate-900 text-white pl-4 pr-2 py-2 text-sm" role="status">
                  <span class="flex-1 min-w-0">{{ u.texto }}</span>
                  <button type="button" (click)="deshacerNoSeSalio()" class="shrink-0 h-9 px-3 rounded-lg font-bold text-emerald-300 hover:bg-white/10">Deshacer</button>
                </div>
              }
              @if (errorSinSalida()) { <p class="mx-4 mt-3 text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{{ errorSinSalida() }}</p> }
              @if (porRegistrar().length) {
                <section class="border-t border-slate-100 dark:border-slate-700/60 px-4 py-4" aria-label="Salidas por registrar">
                  <div class="flex items-center justify-between gap-2">
                    <h3 class="text-sm font-black text-slate-900 dark:text-white">Por registrar <span class="ml-1 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs tabular-nums">{{ porRegistrar().length }}</span></h3>
                    <span class="text-xs text-slate-500 dark:text-slate-400">de la más antigua a la más nueva</span>
                  </div>
                  <ul class="mt-2 -mx-2">
                    @for (h of pendientesVisibles(); track h.id_horario; let primera = $first) {
                      <li>
                        <button type="button" (click)="registrarSalida(h)" [disabled]="guardando() || !!vistaPasada()"
                          class="fila w-full text-left flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/15">
                          <span class="w-11 shrink-0 text-center rounded-lg py-1" [class]="primera ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'">
                            <span class="block text-base font-black leading-none tabular-nums">{{ h.fecha_programada | date:'d' }}</span>
                            <span class="block text-[11px] font-bold leading-tight mt-0.5 opacity-80">{{ h.fecha_programada | date:'MMM':'':'es' }}</span>
                          </span>
                          <span class="min-w-0 flex-1">
                            <span class="block text-sm font-bold text-slate-900 dark:text-white truncate"><span class="capitalize">{{ h.fecha_programada | date:'EEEE':'':'es' }}</span>@if (h.hora_inicio) { · {{ hora(h.hora_inicio) }} }</span>
                            <span class="block text-xs text-slate-500 dark:text-slate-400 truncate">{{ h.lugar || 'Sin lugar' }}@if (h.capitanes.length) { · {{ h.capitanes[0].nombre }} }</span>
                            @if (h.sugerencia.manzanas.length) {
                              <span class="block text-xs font-semibold text-amber-800 dark:text-amber-300 truncate">Le tocaba {{ textoDe(h.sugerencia) }}</span>
                            }
                          </span>
                          <svg class="w-4 h-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        <!-- Salidas que no se pueden registrar: sin manzanas que sugerir o que no se hicieron -->
                        <div class="pl-[3.75rem] pr-2 pb-2 -mt-0.5">
                          @if (!h.sugerencia.manzanas.length) {
                            <p class="text-xs leading-snug text-slate-500 dark:text-slate-400">
                              {{ todoPredicado() ? 'Todo el territorio ya está predicado: no hay manzanas que sugerir.' : 'No hay manzanas que sugerir para esta salida.' }}
                            </p>
                          }
                          <div class="flex flex-wrap items-center gap-x-4">
                            <button type="button" (click)="noSeSalio(h)" [disabled]="guardando() || !!vistaPasada()"
                              class="h-9 -ml-2 px-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 disabled:opacity-40"
                              title="La salida no se hizo: se quita de esta lista y el programa la conserva">No se salió</button>
                            @if (todoPredicado() && !h.sugerencia.manzanas.length && puedeEditar) {
                              <button type="button" (click)="ordenAbierto.set(true)"
                                class="h-9 px-2 rounded-lg text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                title="Si salieron, se empieza otra vuelta para poder registrar lo predicado">Empezar vuelta nueva…</button>
                            }
                          </div>
                        </div>
                      </li>
                    }
                  </ul>
                  @if (porRegistrar().length > 3) {
                    <button type="button" (click)="verTodasPendientes.set(!verTodasPendientes())" class="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
                      {{ verTodasPendientes() ? 'Ver menos' : 'Ver las ' + porRegistrar().length }}
                    </button>
                  }
                </section>
              }

              <!-- Lo que agrega la página (con tarjeta: avisos e historial) -->
              <ng-content select="[panel]" />

              <!-- Orden del recorrido: se cambia poco, va en su propio panel -->
              @if (puedeEditar) {
                <section class="border-t border-slate-100 dark:border-slate-700/60 px-4 py-3">
                  <button type="button" (click)="ordenAbierto.set(true)" class="fila w-full text-left flex items-center gap-3 -mx-2 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <span class="w-9 h-9 shrink-0 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 flex items-center justify-center">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold text-slate-900 dark:text-white">Configuración</span>
                      <span class="block text-xs text-slate-500 dark:text-slate-400 truncate">{{ idTerritorio == null ? resumenOrden() : 'Empezar una vuelta nueva' }}</span>
                    </span>
                    <svg class="w-4 h-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </section>
              }

              <!-- Historial de vueltas de la tarjeta (empezar otra está en Configuración) -->
              @if (av.total > 0 && idTerritorio != null) {
                <section class="border-t border-slate-100 dark:border-slate-700/60 px-4 py-4" aria-label="Vueltas">
                  <h3 class="text-sm font-black text-slate-900 dark:text-white">Vueltas anteriores</h3>
                  @if (vistaPasada(); as vp) {
                    <p class="mt-1.5 text-sm text-slate-700 dark:text-slate-200">Está viendo la vuelta del <b>{{ vp.ciclo.fecha_inicio | date:'d MMM y':'':'es' }}</b>@if (vp.ciclo.fecha_fin) { al <b>{{ vp.ciclo.fecha_fin | date:'d MMM y':'':'es' }}</b> }. Es solo para consultar.</p>
                    <button type="button" (click)="volverALaActual()" class="mt-2 w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 text-white text-sm font-bold">Volver a la vuelta actual</button>
                  } @else if (idTerritorio != null) {
                    @if (vueltas().length) {
                      <ul class="mt-1.5 -mx-2">
                        @for (v of vueltas(); track v.id_ciclo) {
                          <li>
                            <button type="button" (click)="verVuelta(v)" [disabled]="cargandoVuelta()"
                              class="fila w-full text-left flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40">
                              <span class="min-w-0 flex-1">
                                <span class="block text-sm font-bold text-slate-900 dark:text-white">{{ v.fecha_inicio | date:'d MMM y':'':'es' }} → {{ v.fecha_fin ? (v.fecha_fin | date:'d MMM y':'':'es') : 'en curso' }}</span>
                                <span class="block text-xs text-slate-500 dark:text-slate-400">{{ v.manzanas_predicadas }} de {{ v.total_manzanas }} manzanas · {{ v.salidas }} {{ v.salidas === 1 ? 'salida' : 'salidas' }} · {{ v.dias }} {{ v.dias === 1 ? 'día' : 'días' }}</span>
                              </span>
                              <span class="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400">Ver en el mapa</span>
                            </button>
                          </li>
                        }
                      </ul>
                    } @else {
                      <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Aún no hay vueltas registradas en esta tarjeta.</p>
                    }
                  }
                </section>
              }
            }
          </div>
        }
      </aside>
    </div>

    <!-- ── Configuración (panel deslizable): orden del recorrido y vuelta nueva ── -->
    @if (ordenAbierto() && datos(); as d) {
      <div class="fixed inset-0 z-[1100] flex justify-end" (keydown.escape)="ordenAbierto.set(false)">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" (click)="ordenAbierto.set(false)"></div>
        <section class="cajon relative w-full sm:max-w-md h-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="orden-titulo">
          <header class="shrink-0 flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700/60">
            <div>
              <h3 id="orden-titulo" class="text-lg font-black text-slate-900 dark:text-white">Configuración</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ idTerritorio == null ? 'El orden del recorrido y cuándo empezar otra vuelta.' : 'Cuándo empezar otra vuelta en esta tarjeta.' }}</p>
            </div>
            <button type="button" (click)="ordenAbierto.set(false)" class="w-10 h-10 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Cerrar">✕</button>
          </header>
          <div class="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
            @if (idTerritorio == null) {
            <fieldset>
              <legend class="paso"><span>1</span>¿Cómo se avanza?</legend>
              <div class="space-y-2">
                @for (c of criterios; track c.id) {
                  <label class="relative flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-emerald-500/30"
                    [class]="d.config.criterio === c.id ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/40'">
                    <input type="radio" name="criterio-recorrido" class="sr-only" [checked]="d.config.criterio === c.id" [disabled]="guardandoConfig()" (change)="cambiarCriterio(c.id)" />
                    <span class="mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center"
                      [class]="d.config.criterio === c.id ? 'border-emerald-600' : 'border-slate-300 dark:border-slate-500'">
                      @if (d.config.criterio === c.id) { <span class="w-2 h-2 rounded-full bg-emerald-600"></span> }
                    </span>
                    <span>
                      <span class="block text-sm font-bold text-slate-900 dark:text-white">{{ c.titulo }}</span>
                      <span class="block text-xs text-slate-600 dark:text-slate-300">{{ c.ayuda }}</span>
                    </span>
                  </label>
                }
              </div>
              @if (d.config.criterio === 'barrio') {
                <p class="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Orden de los barrios</p>
                <ol class="space-y-1.5">
                  @for (b of barriosOrdenados(); track b.id_sector; let i = $index; let ultimo = $last) {
                    <li class="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 pl-3 pr-1 py-1">
                      <span class="w-5 text-xs font-black tabular-nums text-slate-500">{{ i + 1 }}</span>
                      <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background-color]="b.color || '#94a3b8'"></span>
                      <span class="flex-1 min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{{ b.nombre }}</span>
                      <button type="button" (click)="moverBarrio(i, -1)" [disabled]="i === 0 || guardandoConfig()" [attr.aria-label]="'Subir ' + b.nombre"
                        class="w-10 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">↑</button>
                      <button type="button" (click)="moverBarrio(i, 1)" [disabled]="ultimo || guardandoConfig()" [attr.aria-label]="'Bajar ' + b.nombre"
                        class="w-10 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">↓</button>
                    </li>
                  }
                </ol>
              }
            </fieldset>

            <div>
              <p class="paso"><span>2</span>¿Desde dónde empieza?</p>
              <p class="text-sm text-slate-800 dark:text-slate-100">
                @if (inicioActual(); as ini) {
                  Desde la <strong class="font-black">manzana {{ ini.numero }}</strong> <span class="text-slate-500 dark:text-slate-400">(tarjeta {{ ini.codigo }})</span>
                } @else {
                  Desde el principio del orden.
                }
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" (click)="elegirInicioEnMapa()" [disabled]="guardandoConfig()"
                  class="h-11 px-4 rounded-xl border border-violet-300 dark:border-violet-700 text-violet-800 dark:text-violet-200 text-sm font-bold hover:bg-violet-50 dark:hover:bg-violet-900/20">Elegir en el mapa</button>
                @if (inicioActual()) {
                  <button type="button" (click)="guardarConfig({ inicio: null })" [disabled]="guardandoConfig()"
                    class="h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">Desde el principio</button>
                }
              </div>
            </div>

            <div>
              <p class="paso"><span>3</span>¿Cuántas manzanas le tocan a cada salida?</p>
              <div class="flex items-center gap-3">
                <button type="button" (click)="cambiarPorSalida(-1)" [disabled]="guardandoConfig() || d.config.manzanas_por_salida <= 1" aria-label="Una menos"
                  class="w-11 h-11 rounded-xl border border-slate-300 dark:border-slate-600 text-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40">−</button>
                <span class="min-w-[2.5rem] text-center text-2xl font-black tabular-nums text-slate-900 dark:text-white" aria-live="polite">{{ d.config.manzanas_por_salida }}</span>
                <button type="button" (click)="cambiarPorSalida(1)" [disabled]="guardandoConfig() || d.config.manzanas_por_salida >= 30" aria-label="Una más"
                  class="w-11 h-11 rounded-xl border border-slate-300 dark:border-slate-600 text-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40">+</button>
              </div>
              <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Es lo que Horarios le sugiere a cada salida. Siempre se pueden marcar más o menos.</p>
            </div>
            @if (errorConfig()) { <p class="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{{ errorConfig() }}</p> }
            }

            <!-- Vuelta nueva: acción poco frecuente, por eso vive aquí y no junto a «Registrar predicación» -->
            @let av = avance()!;
            <div [class]="idTerritorio == null ? 'pt-5 border-t border-slate-100 dark:border-slate-700/60' : ''">
              <p class="text-sm font-black text-slate-900 dark:text-white">Empezar una vuelta nueva</p>
              @if (av.predicadas === 0 && av.aMedias === 0) {
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-snug">Aún no hay nada predicado en esta vuelta; no hay qué reiniciar.</p>
              } @else {
                @let completa = av.predicadas === av.total;
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-snug">
                  {{ completa ? 'Se predicó todo: la próxima salida que registre empieza otra vuelta sola.' : 'Úselo si se decide empezar de nuevo sin haber terminado.' }}
                  Lo predicado queda en el historial y el mapa vuelve a «pendiente»{{ idTerritorio == null ? ' en todas las tarjetas' : '' }}.
                </p>
                @if (confirmarVuelta()) {
                  <div class="mt-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/15 p-3" role="alertdialog" aria-label="Empezar vuelta nueva">
                    <p class="text-sm text-slate-800 dark:text-slate-100 leading-snug">
                      @if (completa) { ¿Empezar la vuelta nueva ahora? }
                      @else { Faltan <b>{{ av.total - av.predicadas }}</b> {{ av.total - av.predicadas === 1 ? 'manzana' : 'manzanas' }}: la vuelta se guarda como terminada (cuenta en el registro S-13). ¿Empezar la nueva? }
                    </p>
                    <div class="mt-2.5 flex gap-2">
                      <button type="button" (click)="confirmarVuelta.set(false)" class="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                      <button type="button" (click)="empezarVueltaNueva()" [disabled]="guardando()" class="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50">Sí, empezar</button>
                    </div>
                  </div>
                } @else {
                  <button type="button" (click)="confirmarVuelta.set(true)" [disabled]="!!vistaPasada()"
                    class="mt-3 h-11 px-4 rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40">Empezar vuelta nueva…</button>
                }
                @if (errorVuelta()) { <p class="mt-2 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">{{ errorVuelta() }}</p> }
              }
            </div>
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    :host ::ng-deep .rec-num {
      background: rgba(255,255,255,0.92); border: 0; border-radius: 6px; padding: 0 5px;
      color: #0f172a; font: 800 12px/18px system-ui, sans-serif; box-shadow: 0 1px 3px rgba(15,23,42,0.25); pointer-events: none;
    }
    :host ::ng-deep .rec-num::before { display: none; }
    :host ::ng-deep .rec-zoom-bajo .rec-num { display: none; }
    :host ::ng-deep .rec-cod {
      background: rgba(15,23,42,0.78); border: 0; color: #fff; border-radius: 6px; padding: 1px 6px;
      font: 800 11px/16px system-ui, sans-serif; letter-spacing: 0.02em; pointer-events: none;
    }
    :host ::ng-deep .rec-cod::before { display: none; }
    /* Leaflet: los controles no deben quedar debajo de lo que flota */
    :host ::ng-deep .leaflet-top.leaflet-left { z-index: 1001; }

    .paso { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; font-weight: 800; color: rgb(15 23 42); }
    .paso > span:first-child { flex-shrink: 0; width: 22px; height: 22px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; background: rgb(209 250 229); color: rgb(4 120 87); }
    :host-context(.dark) .paso { color: #fff; }
    :host-context(.dark) .paso > span:first-child { background: rgb(6 78 59 / 0.5); color: rgb(110 231 183); }
    .punto { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 6px; vertical-align: middle; }
    .mz { width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; }

    .btn-pri { background: rgb(5 150 105); box-shadow: 0 6px 16px -6px rgb(5 150 105 / 0.55); transition: background-color 150ms ease-out, transform 120ms ease-out; }
    .btn-pri:hover:enabled { background: rgb(4 120 87); }
    .btn-pri:active:enabled { transform: scale(0.98); }
    .btn-pri:focus-visible, .fila:focus-visible { outline: 2px solid rgb(16 185 129); outline-offset: 2px; }
    .fila { transition: background-color 120ms ease-out, transform 120ms ease-out; }
    .fila:active:enabled { transform: scale(0.99); }

    .ficha { transform-origin: top right; animation: rec-ficha 200ms cubic-bezier(0.23, 1, 0.32, 1); }
    @keyframes rec-ficha { from { opacity: 0; transform: translate(6px, -6px) scale(0.96); } }
    /* La manzana tocada: borde azul que late una vez y queda fijo, para ligarla con su ficha */
    :host ::ng-deep path.rec-foco { stroke: #2563eb; stroke-width: 3px; stroke-opacity: 1; stroke-dasharray: none; animation: rec-late 500ms cubic-bezier(0.23, 1, 0.32, 1); }
    @keyframes rec-late { 0% { stroke-width: 7px; stroke-opacity: 0.3; } 100% { stroke-width: 3px; stroke-opacity: 1; } }
    .flota { animation: rec-entra 180ms cubic-bezier(0.23, 1, 0.32, 1); }
    .cajon { animation: rec-cajon 240ms cubic-bezier(0.32, 0.72, 0, 1); }
    @keyframes rec-entra { from { opacity: 0; transform: translateY(-4px); } }
    @keyframes rec-cajon { from { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) {
      .flota, .cajon, .ficha { animation: none; }
      :host ::ng-deep path.rec-foco { animation: none; }
      .btn-pri:active:enabled, .fila:active:enabled { transform: none; }
    }
  `],
})
export class RecorridoMapaComponent implements AfterViewInit, OnDestroy {
  private svc = inject(TerritoriosService);
  private programa = inject(SalidasProgramaService);

  @Input() puedeEditar = false;
  /**
   * Con una tarjeta: el mismo marcado del recorrido, pero solo con sus manzanas (vista «Por tarjeta»).
   * Sin tarjeta: todo el territorio de la congregación.
   */
  @Input() set idTerritorio(v: number | null) {
    const cambio = v !== this._idTerritorio;
    this._idTerritorio = v ?? null;
    this.idTerritorioSig.set(this._idTerritorio);
    if (cambio) { this.vistaPasada.set(null); this.cargarVueltas(); }
    if (cambio && this.map) {
      this.cancelarMarcado();
      this.foco.set(null);
      this.primeraVez = true;
      this.pintar();
      this.pintarTarjetas();
    }
  }
  get idTerritorio(): number | null { return this._idTerritorio; }
  private _idTerritorio: number | null = null;
  /** Publicadores de la congregación, ya como opciones del selector de capitán. */
  @Input() capitanes: PickerOption[] = [];
  /** Se avisó un cambio: la página refresca su lista y resumen. */
  @Output() cambio = new EventEmitter<void>();

  @ViewChild('mapa', { static: true }) mapaEl!: ElementRef<HTMLDivElement>;

  /** Cuántas se pintan en ámbar: las manzanas por salida de la configuración. */
  siguientesMax = computed(() => this.datos()?.config.manzanas_por_salida ?? 6);
  readonly hora = horaLegible;
  /** Leyenda de colores plegada (no quita mapa). */
  leyenda = signal(false);
  /** Panel deslizable del orden del recorrido. */
  ordenAbierto = signal(false);
  verTodasPendientes = signal(false);
  readonly hoy = hoyIso();
  readonly criterios: Array<{ id: CriterioRecorrido; titulo: string; ayuda: string }> = [
    { id: 'manzana', titulo: 'Por número de manzana', ayuda: 'Sigue 1, 2, 3… sin importar la tarjeta.' },
    { id: 'tarjeta', titulo: 'Por tarjeta', ayuda: 'Termina una tarjeta y pasa a la siguiente.' },
    { id: 'barrio', titulo: 'Por barrio', ayuda: 'Un barrio completo y luego el que usted indique.' },
  ];

  datos = signal<RecorridoRespuesta | null>(null);
  cargando = signal(true);
  errorCarga = signal(false);
  zoomBajo = signal(false);

  marcando = signal(false);
  eligiendoInicio = signal(false);
  elegidas = signal<Set<number>>(new Set());
  /** Elegidas que se predicaron solo en parte, con lo que faltó. */
  aMedias = signal<Map<number, string>>(new Map());
  foco = signal<ManzanaRecorrido | null>(null);
  fecha = hoyIso();
  capitan: number | null = null;
  guardando = signal(false);
  punto: number | null = null;
  puntos = signal<PuntoSalidaOpcion[]>([]);
  opcionesPunto = computed<PickerOption[]>(() =>
    this.puntos().map(p => ({ value: p.id_punto, label: p.nombre, hint: `Tarjeta ${p.codigo}` })));
  /** Salidas programadas ya pasadas y sin registrar (con lo que les tocaba). */
  /** Lo que le tocaba a la salida elegida: se muestra como pista, no se marca solo. */
  sugerida = signal<SugerenciaSalida | null>(null);
  private porRegistrarTodas = signal<Array<SalidaProgramada & { sugerencia: SugerenciaSalida }>>([]);
  /** Con tarjeta: solo las salidas que tocaban alguna de sus manzanas o que estaban programadas en ella. */
  porRegistrar = computed(() => {
    const t = this.idTerritorioSig();
    const todas = this.porRegistrarTodas();
    if (t == null) return todas;
    const mias = this.porId();
    return todas.filter(h => h.id_territorio === t || h.sugerencia.manzanas.some(m => mias.has(m.id_manzana)));
  });
  pendientesVisibles = computed(() => this.verTodasPendientes() ? this.porRegistrar() : this.porRegistrar().slice(0, 3));
  /** La salida programada a la que se enlaza lo que se marca; null = registro suelto. */
  horarioActivo = signal<SalidaProgramada | null>(null);
  /** Del programa: las de hoy y de las últimas 3 semanas que aún no se registraron (para elegir la fecha). */
  private programadas = signal<SalidaProgramada[]>([]);
  /** Fecha elegida a mano, fuera del programa. */
  fueraDelPrograma = signal(false);
  readonly OTRA_FECHA = 'otra' as const;
  opcionesSalida = computed<PickerOption[]>(() => {
    const lista = this.programadas();
    if (!lista.length) return [];
    return [
      ...lista.map(h => ({
        value: h.id_horario,
        label: [tituloDia(h.fecha_programada), horaLegible(h.hora_inicio)].filter(Boolean).join(' · '),
        hint: [h.capitanes.length ? 'Capitán: ' + h.capitanes.map(c => c.nombre).join(', ') : null, h.nombre_punto_salida || h.lugar]
          .filter(Boolean).join(' · ') || undefined,
      })),
      { value: this.OTRA_FECHA, label: 'Otra fecha…', hint: 'No está en el programa de salidas' },
    ];
  });
  valorSalida = computed(() => this.horarioActivo()?.id_horario ?? (this.fueraDelPrograma() ? this.OTRA_FECHA : null));
  errorMarca = signal<string | null>(null);
  confirmarQuitar = signal(false);
  guardandoConfig = signal(false);
  errorConfig = signal<string | null>(null);

  /** Las manzanas que se ven y se marcan: todas, o solo las de la tarjeta. */
  private idTerritorioSig = signal<number | null>(null);
  features = computed(() => {
    const pasada = this.vistaPasada();
    if (pasada) return pasada.features as any[];
    const todas = this.datos()?.features ?? [];
    const t = this.idTerritorioSig();
    return t == null ? todas : todas.filter(f => f.properties.id_territorio === t);
  });
  private porId = computed(() => new Map(this.features().map(f => [f.properties.id_manzana, f.properties])));
  /** Avance de lo que se ve: el de todo el recorrido o el de la tarjeta. */
  avance = computed(() => {
    const d = this.datos();
    if (!d) return null;
    if (this.idTerritorioSig() == null) return { total: d.total, predicadas: d.predicadas, aMedias: d.a_medias };
    const activas = this.features().map(f => f.properties).filter(p => !p.estado_tarjeta);
    return {
      total: activas.length,
      predicadas: activas.filter(p => p.predicada).length,
      aMedias: activas.filter(p => !p.predicada && p.parcial).length,
    };
  });
  /** La que sigue en el orden, dentro de lo que se ve. */
  siguienteVisible = computed(() => {
    const d = this.datos();
    if (this.idTerritorioSig() == null) return d?.siguiente_manzana ?? null;
    const p = this.pendientesEnOrden().find(x => !x.asignada_a);  // igual que el servidor: sin las asignadas
    return p ? { id_manzana: p.id_manzana, numero: p.numero, codigo: p.codigo } : null;
  });
  porcentaje = computed(() => {
    const a = this.avance();
    return a && a.total > 0 ? Math.round((a.predicadas / a.total) * 100) : 0;
  });
  porcentajeMedias = computed(() => {
    const a = this.avance();
    return a && a.total > 0 ? (a.aMedias / a.total) * 100 : 0;
  });
  /** «Por tarjeta · desde la manzana 1 · 6 por salida». */
  resumenOrden = computed(() => {
    const cfg = this.datos()?.config;
    if (!cfg) return '';
    const criterio = this.criterios.find(c => c.id === cfg.criterio)?.titulo ?? '';
    const ini = this.inicioActual();
    return [criterio, ini ? `desde la manzana ${ini.numero}` : 'desde el principio', `${cfg.manzanas_por_salida} por salida`].join(' · ');
  });
  nPendientesElegidas = computed(() => [...this.elegidas()].filter(id => !this.porId().get(id)?.predicada).length);
  nPredicadasElegidas = computed(() => [...this.elegidas()].filter(id => this.porId().get(id)?.predicada).length);
  tarjetasElegidas = computed(() => {
    const cods = new Set([...this.elegidas()].map(id => this.porId().get(id)?.codigo).filter((c): c is string => !!c));
    return [...cods].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).join(', ');
  });
  inicioActual = computed(() => {
    const id = this.datos()?.config.inicio?.id_manzana;
    const m = id != null ? this.porId().get(id) : undefined;
    return m ? { numero: m.numero, codigo: m.codigo } : null;
  });
  barriosOrdenados = computed(() => {
    const d = this.datos();
    if (!d) return [];
    const porId = new Map(d.barrios.map(b => [b.id_sector, b]));
    const fijos = d.config.orden_barrios.map(i => porId.get(i)).filter((b): b is NonNullable<typeof b> => !!b);
    const resto = d.barrios.filter(b => !d.config.orden_barrios.includes(b.id_sector));
    return [...fijos, ...resto];
  });

  private map: L.Map | null = null;
  private capaManzanas: L.LayerGroup | null = null;
  private capaTarjetas: L.GeoJSON | null = null;
  private capasPorManzana = new Map<number, L.Path>();
  private tileLayer: L.Layer | null = null;
  private primeraVez = true;
  private destruido = false;

  ngAfterViewInit(): void {
    this.map = L.map(this.mapaEl.nativeElement, { zoomControl: true, maxZoom: 19 }).setView([4.7, -74.1], 12);
    this.map.on('zoomend', () => this.zoomBajo.set((this.map?.getZoom() ?? 0) < ZOOM_NUMEROS));
    this.cargarBase();
    this.cargarTarjetas();
    this.cargar();
    this.cargarPorRegistrar();
    this.cargarProgramadas();
    this.svc.getPuntosSalida().subscribe({ next: (l) => this.puntos.set(l), error: () => this.puntos.set([]) });
    setTimeout(() => this.map?.invalidateSize(), 0);
    // El mapa ocupa lo que le dejen: al plegar o abrir el menú lateral (o girar la pantalla) se ajusta solo.
    this.observador = new ResizeObserver(() => this.map?.invalidateSize({ animate: false }));
    this.observador.observe(this.mapaEl.nativeElement);
  }

  private observador: ResizeObserver | null = null;

  ngOnDestroy(): void {
    this.destruido = true;
    this.observador?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  // ── Carga ─────────────────────────────────────────────────────────────
  cargar(mostrar = false): void {
    if (mostrar) this.cargando.set(true);
    this.errorCarga.set(false);
    this.svc.getRecorrido().subscribe({
      next: (r) => { this.cargando.set(false); this.aplicar(r); },
      error: () => { this.cargando.set(false); this.errorCarga.set(true); },
    });
  }

  /** Desde la página, tras editar o borrar una salida: el mapa y todo lo que depende de las salidas. */
  recargarTodo(): void {
    this.cargar();
    this.cargarPorRegistrar();
    this.cargarProgramadas();
    this.cargarVueltas();
  }

  textoDe(g: SugerenciaSalida): string {
    const medias = g.manzanas.filter(m => m.a_medias).map(m => m.numero);
    return `${textoManzanas(g.manzanas.map(m => m.numero))} (${codigosDe(g.manzanas)})${medias.length ? ` · la ${medias.join(', ')} estaba a medias` : ''}`;
  }

  private cargarProgramadas(): void {
    const desde = new Date(); desde.setDate(desde.getDate() - 21);
    this.programa.listar(fechaIsoLocal(desde), hoyIso()).subscribe({
      next: (l) => this.programadas.set(
        l.filter(h => !h.registro?.registrada)
          .sort((a, b) => b.fecha_programada.localeCompare(a.fecha_programada) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))),
      error: () => this.programadas.set([]),
    });
  }

  /**
   * Fecha desde el programa: con la salida elegida se llenan capitán y punto. Si estaba en «Salidas por
   * registrar» se muestra además lo que le tocaba, como pista.
   */
  elegirSalida(v: number | typeof this.OTRA_FECHA | null): void {
    if (v === this.OTRA_FECHA || v == null) {
      this.horarioActivo.set(null);
      this.sugerida.set(null);
      this.fueraDelPrograma.set(v === this.OTRA_FECHA);
      if (v === this.OTRA_FECHA) { this.fecha = hoyIso(); this.capitan = null; this.punto = null; }
      return;
    }
    const conSugerencia = this.porRegistrar().find(h => h.id_horario === v);
    if (conSugerencia && this.elegidas().size === 0) { this.registrarSalida(conSugerencia); return; }
    const h = conSugerencia ?? this.programadas().find(x => x.id_horario === v);
    if (!h) return;
    this.sugerida.set(conSugerencia?.sugerencia ?? null);
    this.fueraDelPrograma.set(false);
    this.horarioActivo.set(h);
    this.fecha = h.fecha_programada;
    this.capitan = h.capitanes[0]?.id_publicador ?? null;
    this.punto = h.id_punto_salida ?? null;
  }

  /** Al empezar a marcar: si hoy hay una sola salida en el programa, ya queda elegida. */
  private elegirLaDeHoy(): void {
    if (this.horarioActivo()) return;
    const hoy = this.programadas().filter(h => h.fecha_programada === this.hoy);
    if (hoy.length === 1) this.elegirSalida(hoy[0].id_horario);
  }

  /** Toda la vuelta que se ve está predicada: no queda nada que sugerir hasta empezar otra. */
  todoPredicado = computed(() => {
    const a = this.avance();
    return !!a && a.total > 0 && a.predicadas >= a.total;
  });

  // «No se salió»: la salida pasó y no se hizo; sale de la lista y se puede deshacer unos segundos.
  deshacerSinSalida = signal<{ id: number; texto: string } | null>(null);
  errorSinSalida = signal<string | null>(null);
  private temporizadorSinSalida?: ReturnType<typeof setTimeout>;

  noSeSalio(h: SalidaProgramada): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.errorSinSalida.set(null);
    this.svc.marcarSinSalida(h.id_horario, true).subscribe({
      next: () => {
        this.guardando.set(false);
        const cuando = [tituloDia(h.fecha_programada), horaLegible(h.hora_inicio)].filter(Boolean).join(' · ');
        this.deshacerSinSalida.set({ id: h.id_horario, texto: `Se quitó de la lista: ${cuando}.` });
        clearTimeout(this.temporizadorSinSalida);
        this.temporizadorSinSalida = setTimeout(() => this.deshacerSinSalida.set(null), 9000);
        this.cargarPorRegistrar();
        this.cambio.emit();
      },
      error: (err) => { this.guardando.set(false); this.errorSinSalida.set(err?.error?.detail ?? 'No se pudo quitar la salida. Intente de nuevo.'); },
    });
  }

  deshacerNoSeSalio(): void {
    const u = this.deshacerSinSalida();
    if (!u || this.guardando()) return;
    this.guardando.set(true);
    this.svc.marcarSinSalida(u.id, false).subscribe({
      next: () => { this.guardando.set(false); this.deshacerSinSalida.set(null); this.cargarPorRegistrar(); this.cambio.emit(); },
      error: (err) => { this.guardando.set(false); this.errorSinSalida.set(err?.error?.detail ?? 'No se pudo deshacer. Intente de nuevo.'); },
    });
  }

  private cargarPorRegistrar(): void {
    this.svc.getPorRegistrar().subscribe({ next: (l) => this.porRegistrarTodas.set(l), error: () => this.porRegistrarTodas.set([]) });
  }

  /** Abre el modo marcar con lo de esa salida ya puesto: fecha, capitán y punto, y de pista lo que le tocaba. */
  registrarSalida(h: SalidaProgramada & { sugerencia: SugerenciaSalida }): void {
    this.eligiendoInicio.set(false);
    this.foco.set(null);
    this.horarioActivo.set(h);
    this.fueraDelPrograma.set(false);
    this.fecha = h.fecha_programada;
    this.capitan = h.capitanes[0]?.id_publicador ?? null;
    this.punto = h.id_punto_salida ?? null;
    this.marcando.set(true);
    this.errorMarca.set(null);
    this.confirmarQuitar.set(false);
    // Se parte sin nada marcado (es más fácil marcar lo que se hizo que ir quitando): lo que tocaba queda de pista.
    this.sugerida.set(h.sugerencia);
    this.elegidas.set(new Set());
    this.aMedias.set(new Map());
    this.repintarEstilos();
    setTimeout(() => this.encuadrar(this.idsSugeridas()));
  }

  /** Las manzanas sugeridas que están en lo que se ve. */
  private idsSugeridas(): number[] {
    return (this.sugerida()?.manzanas ?? []).map(m => m.id_manzana).filter(id => this.porId().has(id));
  }

  // ── Corregir una manzana desde su ficha / empezar otra vuelta ─────────
  correccion = signal<'medias' | 'quitar' | null>(null);
  notaCorreccion = '';
  errorFicha = signal<string | null>(null);
  confirmarVuelta = signal(false);
  errorVuelta = signal<string | null>(null);
  /** Al tocar otra manzana la ficha empieza limpia. */
  private readonly limpiaFicha = effect(() => { this.foco(); untracked(() => { this.correccion.set(null); this.errorFicha.set(null); }); });

  corregir(f: ManzanaRecorrido, estado: 'predicada' | 'parcial'): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.errorFicha.set(null);
    this.svc.cambiarEstadoRecorrido(f.id_manzana, estado, estado === 'parcial' ? this.notaCorreccion.trim() || null : null).subscribe({
      next: (r) => { this.guardando.set(false); this.alCorregir(r, f.id_manzana); },
      error: (err) => { this.guardando.set(false); this.errorFicha.set(err?.error?.detail ?? 'No se pudo cambiar. Intente de nuevo.'); },
    });
  }

  quitarDeFicha(f: ManzanaRecorrido): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.errorFicha.set(null);
    this.svc.desmarcarRecorrido([f.id_manzana]).subscribe({
      next: (r) => { this.guardando.set(false); this.alCorregir(r, f.id_manzana); },
      error: (err) => { this.guardando.set(false); this.errorFicha.set(err?.error?.detail ?? 'No se pudo quitar la marca. Intente de nuevo.'); },
    });
  }

  /** Tras corregir: se repinta y la ficha muestra el estado nuevo de la misma manzana. */
  private alCorregir(r: RecorridoRespuesta, id: number): void {
    this.aplicar(r);
    this.foco.set(this.porId().get(id) ?? null);
    this.cargarPorRegistrar();
    this.cambio.emit();
  }

  vueltas = signal<any[]>([]);
  vistaPasada = signal<{ ciclo: any; features: any[] } | null>(null);
  cargandoVuelta = signal(false);

  private cargarVueltas(): void {
    const t = this.idTerritorioSig();
    if (t == null) { this.vueltas.set([]); return; }
    this.svc.vueltasRecorrido(t).subscribe({ next: (v) => this.vueltas.set(v), error: () => this.vueltas.set([]) });
  }

  verVuelta(v: { id_ciclo: number }): void {
    const t = this.idTerritorioSig();
    if (t == null || this.cargandoVuelta()) return;
    this.cargandoVuelta.set(true);
    this.svc.vueltaPasadaRecorrido(t, v.id_ciclo).subscribe({
      next: (fc) => {
        this.cargandoVuelta.set(false);
        this.cancelarMarcado();
        this.foco.set(null);
        this.vistaPasada.set({ ciclo: fc.ciclo, features: fc.features });
        this.pintar();
      },
      error: () => this.cargandoVuelta.set(false),
    });
  }

  volverALaActual(): void {
    this.vistaPasada.set(null);
    this.foco.set(null);
    this.pintar();
  }

  empezarVueltaNueva(): void {
    if (this.guardando()) return;
    const t = this.idTerritorioSig();
    this.guardando.set(true);
    this.errorVuelta.set(null);
    this.svc.nuevaVueltaRecorrido(t == null ? [] : [t]).subscribe({
      next: (r) => { this.guardando.set(false); this.confirmarVuelta.set(false); this.ordenAbierto.set(false); this.foco.set(null); this.aplicar(r); this.cargarPorRegistrar(); this.cargarVueltas(); this.cambio.emit(); },
      error: (err) => { this.guardando.set(false); this.errorVuelta.set(err?.error?.detail ?? 'No se pudo empezar la vuelta nueva. Intente de nuevo.'); },
    });
  }

  /** Marca en el mapa la manzana de la ficha abierta (borde azul que late), y la trae al frente. */
  private enFoco: L.Path | null = null;
  private readonly marcaFoco = effect(() => {
    const f = this.foco();
    const ver = f && !this.marcando() ? f.id_manzana : null;
    untracked(() => {
      this.enFoco?.getElement()?.classList.remove('rec-foco');
      this.enFoco = null;
      const capa = ver != null ? this.capasPorManzana.get(ver) : undefined;
      if (!capa) return;
      capa.bringToFront();
      capa.getElement()?.classList.add('rec-foco');
      this.enFoco = capa;
    });
  });

  /** Repinta al aparecer o desaparecer la pista de lo que tocaba. */
  private readonly repintaPista = effect(() => { this.sugerida(); untracked(() => this.repintarEstilos()); });

  hayPistaSugerida = computed(() => this.idsSugeridas().length > 0);

  /** Para quien hizo justo lo que tocaba: las marca de una vez. */
  usarSugeridas(): void {
    this.elegidas.set(new Set(this.idsSugeridas()));
    this.aMedias.set(new Map());
    this.alCambiarEleccion();
  }

  private encuadrar(ids: number[]): void {
    const bounds = L.latLngBounds([]);
    for (const id of ids) { const capa = this.capasPorManzana.get(id) as L.Polygon | undefined; if (capa) bounds.extend(capa.getBounds()); }
    if (!bounds.isValid() || !this.map) return;
    // Arriba queda la pista de marcado; el formulario va en el panel, no sobre el mapa.
    this.map.fitBounds(bounds, { paddingTopLeft: [50, 70], paddingBottomRight: [50, 60], maxZoom: 17 });
  }

  /** Quita el enlace con la salida programada: lo que se marque queda como registro suelto. */
  soltarSalida(): void {
    this.horarioActivo.set(null);
    this.sugerida.set(null);
    this.fueraDelPrograma.set(true);
  }

  private aplicar(r: RecorridoRespuesta): void {
    this.datos.set(r);
    this.pintar();
    const foco = this.foco();
    if (foco) this.foco.set(this.porId().get(foco.id_manzana) ?? null);
  }

  private cargarBase(): void {
    const poner = (capa: L.Layer) => { if (this.map && !this.destruido) this.tileLayer = capa.addTo(this.map); };
    const osm = () => poner(L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }));
    this.svc.getTileProvider().subscribe({
      next: (res) => {
        if (res.tile_provider === 'propio') {
          crearCapaBasePropia().then((c) => (c ? poner(c) : osm())).catch(osm);
        } else if (res.tile_provider === 'google') {
          poner(L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 19 }));
        } else {
          osm();
        }
      },
      error: osm,
    });
  }

  /** Los límites de las tarjetas, de referencia, con su código. */
  private tarjetasGeo: any = null;

  private cargarTarjetas(): void {
    this.svc.getTerritoriosGeoJSON().subscribe({
      next: (fc) => { this.tarjetasGeo = fc; this.pintarTarjetas(); },
    });
  }

  /** Contornos de las tarjetas de referencia; con tarjeta elegida, solo el suyo. */
  private pintarTarjetas(): void {
    if (!this.map || this.destruido || !this.tarjetasGeo) return;
    this.capaTarjetas?.remove();
    const t = this.idTerritorioSig();
    const fc = t == null ? this.tarjetasGeo
      : { ...this.tarjetasGeo, features: this.tarjetasGeo.features.filter((f: any) => (f.id ?? f.properties?.id_territorio) === t) };
    this.capaTarjetas = L.geoJSON(fc as any, {
      style: { color: '#334155', weight: 2.5, fill: false, dashArray: '7 5', opacity: 0.85 },
      interactive: false,
      onEachFeature: (f, layer) => {
        const codigo = (f.properties as any)?.codigo;
        if (codigo) (layer as L.Polygon).bindTooltip(escapeHtml(codigo), { permanent: true, direction: 'center', className: 'rec-cod' });
      },
    }).addTo(this.map);
    this.capaTarjetas.bringToBack();
  }

  // ── Dibujo ────────────────────────────────────────────────────────────
  private estiloDe(p: ManzanaRecorrido): L.PathOptions {
    const elegida = this.elegidas().has(p.id_manzana);
    const esInicio = this.datos()?.config.inicio?.id_manzana === p.id_manzana;
    let e: L.PathOptions = { color: '#64748b', weight: 1.5, fillColor: '#ffffff', fillOpacity: 0.55, dashArray: undefined };
    if (p.estado_tarjeta) return { ...e, color: '#94a3b8', fillColor: '#cbd5e1', fillOpacity: 0.7, weight: 1.5, dashArray: '2 4' };
    if (p.predicada) e = { ...e, color: '#047857', fillColor: '#10b981', fillOpacity: 0.6 };
    else if (p.parcial) e = { ...e, color: '#047857', fillColor: '#10b981', fillOpacity: 0.22, weight: p.siguiente === 1 ? 4 : 3, dashArray: '6 4' };
    else if (p.siguiente) e = { ...e, color: '#b45309', fillColor: '#f59e0b', fillOpacity: 0.6, weight: p.siguiente === 1 ? 4 : 2.5 };
    if (p.asignada_a && !p.predicada) e = { ...e, dashArray: '4 3' };
    if (esInicio) e = { ...e, color: '#6d28d9', weight: Math.max(e.weight ?? 0, 4) };
    // Lo que le tocaba a la salida: borde azul a trazos, sin marcar. Tocar la manzana la marca.
    if (!elegida && this.sugerida()?.manzanas.some(m => m.id_manzana === p.id_manzana) && !p.predicada) {
      e = { ...e, color: '#2563eb', weight: 4, dashArray: '8 5', fillColor: '#bfdbfe', fillOpacity: 0.55 };
    }
    if (elegida) e = { ...e, color: '#2563eb', weight: 4.5, dashArray: undefined, fillColor: p.predicada ? '#fca5a5' : '#93c5fd', fillOpacity: 0.8 };
    // Elegida «a medias»: otro color (fucsia, a trazos) para no confundirla con la completa (azul).
    if (elegida && this.aMedias().has(p.id_manzana)) e = { ...e, color: '#a21caf', dashArray: '7 5', fillColor: '#f0abfc', fillOpacity: 0.6 };
    return e;
  }

  private pintar(): void {
    const map = this.map;
    const d = this.datos();
    if (!map || !d) return;
    this.capaManzanas?.remove();
    this.capasPorManzana.clear();
    const grupo = L.layerGroup();
    for (const f of this.features()) {
      const p = f.properties;
      const capa = L.geoJSON(f as any, { style: () => this.estiloDe(p) });
      const poligono = capa.getLayers()[0] as L.Path;
      poligono.bindTooltip(escapeHtml(p.numero), { permanent: true, direction: 'center', className: 'rec-num' });
      poligono.on('click', () => this.alTocar(p));
      grupo.addLayer(poligono);
      this.capasPorManzana.set(p.id_manzana, poligono);
    }
    this.capaManzanas = grupo.addTo(map);
    this.zoomBajo.set(map.getZoom() < ZOOM_NUMEROS);
    const visibles = this.features();
    if (this.primeraVez && visibles.length > 0) {
      this.primeraVez = false;
      map.fitBounds(L.geoJSON({ type: 'FeatureCollection', features: visibles } as any).getBounds(), { padding: [30, 30], maxZoom: 18 });
    }
  }

  private repintarEstilos(): void {
    const por = this.porId();
    for (const [id, capa] of this.capasPorManzana) {
      const p = por.get(id);
      if (p) capa.setStyle(this.estiloDe(p));
    }
  }

  // ── Interacción ───────────────────────────────────────────────────────
  private alTocar(p: ManzanaRecorrido): void {
    if (this.eligiendoInicio()) {
      this.eligiendoInicio.set(false);
      this.guardarConfig({ inicio: p.id_manzana });
      return;
    }
    // Registrando, el toque solo elige; la ficha (con «Editar estado») es para mirar, no para registrar.
    if (!this.marcando()) { this.foco.set(p); return; }
    if (p.estado_tarjeta) {
      this.errorMarca.set(`La tarjeta ${p.codigo} está ${this.textoEstado(p.estado_tarjeta)}: no se marca su predicación.`);
      return;
    }
    const s = new Set(this.elegidas());
    const id = p.id_manzana;
    if (p.predicada) {
      // Una ya predicada solo se elige para quitarle la marca.
      if (s.has(id)) s.delete(id); else s.add(id);
    } else if (!s.has(id)) {
      s.add(id);                          // 1 vez: predicada
    } else if (!this.aMedias().has(id)) {
      this.anotarFalta(id, '');           // 2 veces: a medias
    } else {
      s.delete(id);                       // 3 veces: se quita
      this.quitarAMedias(id);
    }
    this.elegidas.set(s);
    this.alCambiarEleccion();
  }

  textoEstado(estado: string | null): string {
    return estado === 'Inactivo' ? 'retirada' : 'en pausa';
  }

  alternarMarcado(): void {
    if (this.marcando()) { this.cancelarMarcado(); return; }
    this.empezarMarcado();
  }

  /** Abre el modo marcar (también desde la página, con el botón de la tarjeta). */
  empezarMarcado(): void {
    this.eligiendoInicio.set(false);
    this.foco.set(null);
    this.marcando.set(true);
    this.elegirLaDeHoy();
  }

  /** Desde el panel del orden: se cierra y se toca la manzana en el mapa. */
  elegirInicioEnMapa(): void {
    this.ordenAbierto.set(false);
    this.cancelarMarcado();
    this.eligiendoInicio.set(true);
  }

  cancelarMarcado(): void {
    this.marcando.set(false);
    this.foco.set(null);
    this.horarioActivo.set(null);
    this.sugerida.set(null);
    this.fueraDelPrograma.set(false);
    this.elegidas.set(new Set());
    this.aMedias.set(new Map());
    this.confirmarQuitar.set(false);
    this.errorMarca.set(null);
    this.repintarEstilos();
  }

  /** Pendientes del recorrido en su orden (sin las apartadas). */
  private pendientesEnOrden = computed(() => this.features()
    .map(f => f.properties)
    .filter(p => !p.predicada && !p.estado_tarjeta && p.posicion !== null)
    .sort((a, b) => (a.posicion ?? 0) - (b.posicion ?? 0)));

  private siguienteSinElegir(): ManzanaRecorrido | undefined {
    const ya = this.elegidas();
    return this.pendientesEnOrden().find(p => !ya.has(p.id_manzana) && !p.asignada_a);
  }

  hayOtraQueSigue = computed(() => {
    const ya = this.elegidas();
    return this.pendientesEnOrden().some(p => !ya.has(p.id_manzana) && !p.asignada_a);
  });

  /** Se predicó una más de las sugeridas: agrega la que sigue en el orden. */
  masUna(): void {
    const p = this.siguienteSinElegir();
    if (!p) return;
    this.elegidas.set(new Set([...this.elegidas(), p.id_manzana]));
    this.alCambiarEleccion();
  }

  /** Se predicó una menos: quita la última elegida en el orden. */
  menosUna(): void {
    const ya = this.elegidas();
    const ultima = [...this.pendientesEnOrden()].reverse().find(p => ya.has(p.id_manzana));
    if (!ultima) return;
    const s = new Set(ya);
    s.delete(ultima.id_manzana);
    this.elegidas.set(s);
    this.quitarAMedias(ultima.id_manzana);
    this.alCambiarEleccion();
  }

  listaAMedias = computed(() => [...this.aMedias()].map(([id, nota]) => ({ id, nota, numero: this.porId().get(id)?.numero ?? '' }))
    .sort((a, b) => (this.porId().get(a.id)?.posicion ?? 0) - (this.porId().get(b.id)?.posicion ?? 0)));

  anotarFalta(id: number, nota: string): void {
    const m = new Map(this.aMedias());
    m.set(id, nota);
    this.aMedias.set(m);
  }

  private quitarAMedias(id: number): void {
    if (!this.aMedias().has(id)) return;
    const m = new Map(this.aMedias());
    m.delete(id);
    this.aMedias.set(m);
  }

  private alCambiarEleccion(): void {
    this.confirmarQuitar.set(false);
    this.errorMarca.set(null);
    this.repintarEstilos();
  }

  guardarMarcas(): void {
    const pendientes = [...this.elegidas()].filter(id => !this.porId().get(id)?.predicada);
    if (pendientes.length === 0 || this.guardando()) return;
    if (!this.fecha || (this.opcionesSalida().length && !this.horarioActivo() && !this.fueraDelPrograma())) {
      this.errorMarca.set('Elija la salida del programa (o «Otra fecha…») en la que se predicó.');
      return;
    }
    const medias = this.aMedias();
    const completas = pendientes.filter(id => !medias.has(id));
    const parciales = pendientes.filter(id => medias.has(id)).map(id => ({ id_manzana: id, nota: medias.get(id)?.trim() || null }));
    this.guardando.set(true);
    this.errorMarca.set(null);
    this.svc.marcarRecorrido({
      fecha: this.fecha, id_capitan: this.capitan, ids_manzanas: completas, parciales,
      id_horario: this.horarioActivo()?.id_horario ?? null, id_punto_salida: this.punto,
    }).subscribe({
      next: (r) => { this.guardando.set(false); this.terminarCambio(r); },
      error: (err) => { this.guardando.set(false); this.errorMarca.set(err?.error?.detail ?? 'No se pudo guardar. Intente de nuevo.'); },
    });
  }

  quitarMarcas(): void {
    const ids = [...this.elegidas()].filter(id => this.porId().get(id)?.predicada);
    if (ids.length === 0 || this.guardando()) return;
    this.guardando.set(true);
    this.svc.desmarcarRecorrido(ids).subscribe({
      next: (r) => { this.guardando.set(false); this.terminarCambio(r); },
      error: (err) => {
        this.guardando.set(false);
        this.confirmarQuitar.set(false);
        this.errorMarca.set(err?.error?.detail ?? 'No se pudo quitar la marca. Intente de nuevo.');
      },
    });
  }

  private terminarCambio(r: RecorridoRespuesta): void {
    this.marcando.set(false);
    this.foco.set(null);
    this.horarioActivo.set(null);
    this.sugerida.set(null);
    this.fueraDelPrograma.set(false);
    this.cargarPorRegistrar();
    this.cargarProgramadas();
    this.cargarVueltas();
    this.elegidas.set(new Set());
    this.aMedias.set(new Map());
    this.confirmarQuitar.set(false);
    this.aplicar(r);
    this.cambio.emit();
  }

  // ── Orden ─────────────────────────────────────────────────────────────
  cambiarCriterio(criterio: CriterioRecorrido): void {
    if (this.datos()?.config.criterio === criterio) return;
    this.guardarConfig({ criterio });
  }

  moverBarrio(i: number, delta: -1 | 1): void {
    const ids = this.barriosOrdenados().map(b => b.id_sector);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.guardarConfig({ orden_barrios: ids });
  }

  cambiarPorSalida(delta: -1 | 1): void {
    const n = (this.datos()?.config.manzanas_por_salida ?? 6) + delta;
    if (n >= 1 && n <= 30) this.guardarConfig({ manzanas_por_salida: n });
  }

  guardarConfig(cambio: { criterio?: CriterioRecorrido; orden_barrios?: number[]; inicio?: number | null; manzanas_por_salida?: number }): void {
    const cfg = this.datos()?.config;
    if (!cfg || this.guardandoConfig()) return;
    this.guardandoConfig.set(true);
    this.errorConfig.set(null);
    this.svc.guardarConfigRecorrido({
      criterio: cambio.criterio ?? cfg.criterio,
      orden_barrios: cambio.orden_barrios ?? (cfg.orden_barrios.length ? cfg.orden_barrios : this.barriosOrdenados().map(b => b.id_sector)),
      id_manzana_inicio: 'inicio' in cambio ? (cambio.inicio ?? null) : (cfg.inicio?.id_manzana ?? null),
      manzanas_por_salida: cambio.manzanas_por_salida ?? cfg.manzanas_por_salida,
    }).subscribe({
      next: (r) => { this.guardandoConfig.set(false); this.aplicar(r); },
      error: (err) => { this.guardandoConfig.set(false); this.errorConfig.set(err?.error?.detail ?? 'No se pudo guardar el orden. Intente de nuevo.'); },
    });
  }
}

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerritoriosService, PublicadorOpcion } from '../services/territorios.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { nombreMostrado } from '../../../core/utils/nombre.util';
import {
  Territorio,
  Manzana,
  Punto,
  SalidaPredicacion,
  ProgresoTerritorio,
  ResumenTerritorio,
  ViviendaDeTerritorio,
  textoDiasSinTrabajar,
  textoDireccion,
} from '../models/territorio.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';

interface EstadoManzana {
  nombre_capitan: string;
  fecha_salida: string;
}

@Component({
  selector: 'app-seguimiento-predicacion',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, PageHeaderComponent, SelectPickerComponent],
  template: `
    <div class="flex flex-col h-full min-h-0">

      <app-page-header
        title="Seguimiento de Predicación"
        subtitle="Elige un territorio para ver qué manzanas faltan y registrar las salidas del grupo"
        spacing="none" />

      <!-- Lista + detalle. En pantallas medianas y grandes van lado a lado;
           en el teléfono se alternan (la lista se oculta al elegir territorio). -->
      <div class="mt-5 flex flex-1 min-h-0 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-800 overflow-hidden">

        <!-- ── Lista de territorios ── -->
        <aside class="w-full md:w-64 2xl:w-80 shrink-0 flex-col border-r border-gray-100 dark:border-gray-700/60 min-h-0"
          [class]="territorioSeleccionado() ? 'hidden md:flex' : 'flex'"
          aria-label="Territorios">

          <div class="p-3 border-b border-gray-100 dark:border-gray-700/60 shrink-0">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="search"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                placeholder="Buscar territorio"
                aria-label="Buscar territorio"
                class="w-full pl-9 pr-3 h-10 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto">
            @if (loading()) {
              <div class="p-2 space-y-1">
                @for (i of [1,2,3,4,5,6]; track i) {
                  <div class="h-14 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse"></div>
                }
              </div>
            } @else if (territoriosFiltrados().length === 0) {
              <div class="py-12 px-4 text-center">
                <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">Ningún territorio coincide</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Prueba con otro nombre o código</p>
              </div>
            } @else {
              <ul class="p-2 space-y-0.5">
                @for (t of territoriosFiltrados(); track t.id_territorio) {
                  @let activo = territorioSeleccionado()?.id_territorio === t.id_territorio;
                  @let r = resumen().get(t.id_territorio);
                  <li>
                    <button type="button"
                      (click)="seleccionarTerritorio(t)"
                      [attr.aria-current]="activo ? 'true' : null"
                      class="w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                      [class]="activo
                        ? 'bg-green-50 dark:bg-green-900/25'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'">
                      <span class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs tabular-nums"
                        [class]="activo
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'">
                        {{ t.codigo }}
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block text-sm font-semibold truncate leading-snug"
                          [class]="activo ? 'text-green-900 dark:text-green-100' : 'text-gray-800 dark:text-gray-100'">
                          {{ t.nombre }}
                        </span>
                        <span class="block text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          @if (r?.ultima_salida) {
                            Última salida {{ textoDias(r!.dias_sin_trabajar) }}
                          } @else {
                            Sin salidas aún
                          }
                        </span>
                      </span>
                      @if (r && r.en_curso) {
                        <span class="shrink-0 text-xs font-bold tabular-nums"
                          [class]="activo ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'"
                          [attr.aria-label]="(r.porcentaje | number:'1.0-0') + '% de la vuelta'">
                          {{ r.porcentaje | number:'1.0-0' }}%
                        </span>
                      }
                    </button>
                  </li>
                }
              </ul>
            }
          </div>

          @if (!loading()) {
            <p class="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/60 shrink-0 text-xs text-gray-500 dark:text-gray-400">
              {{ territoriosFiltrados().length }}
              {{ territoriosFiltrados().length === 1 ? 'territorio' : 'territorios' }}
            </p>
          }
        </aside>

        <!-- ── Detalle ── -->
        @if (!territorioSeleccionado()) {
          <div class="hidden md:flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center bg-gray-50/70 dark:bg-gray-900/30">
            <svg class="w-12 h-12 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/>
            </svg>
            <div>
              <p class="text-base font-semibold text-gray-700 dark:text-gray-200">Elige un territorio de la lista</p>
              <ol class="mt-3 space-y-1.5 text-sm text-gray-500 dark:text-gray-400 text-left inline-block">
                <li><span class="font-semibold text-gray-700 dark:text-gray-300">1.</span> Registra la salida con su fecha y capitán.</li>
                <li><span class="font-semibold text-gray-700 dark:text-gray-300">2.</span> Marca las manzanas que se predicaron ese día.</li>
                <li><span class="font-semibold text-gray-700 dark:text-gray-300">3.</span> Cuando no falte ninguna, la vuelta queda completa.</li>
              </ol>
            </div>
          </div>
        } @else {
          @let t = territorioSeleccionado()!;
          @let p = progreso();
          <section class="flex-1 min-w-0 flex flex-col min-h-0 bg-gray-50/70 dark:bg-gray-900/30" [attr.aria-label]="'Territorio ' + t.codigo">

            <!-- Cabecera: quién es, cómo va y la acción principal -->
            <header class="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/60 px-4 md:px-6 py-4">
              <button type="button" (click)="volverALista()"
                class="md:hidden -ml-1 mb-2 inline-flex items-center gap-1 text-sm font-semibold text-green-700 dark:text-green-400 min-h-[44px]">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
                Territorios
              </button>

              <div class="flex flex-wrap items-start gap-x-6 gap-y-3">
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-green-700 dark:text-green-400 tabular-nums">Territorio {{ t.codigo }}</p>
                  <h2 class="font-display text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-tight md:truncate">{{ t.nombre }}</h2>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    @if (p?.ciclo; as ciclo) {
                      @if (ciclo.completado) {
                        <span class="font-semibold text-green-700 dark:text-green-400">Vuelta completada el {{ ciclo.fecha_fin | date:'d MMM yyyy':'':'es' }}.</span>
                        La próxima salida empieza una vuelta nueva.
                      } @else {
                        Vuelta en curso desde el {{ ciclo.fecha_inicio | date:'d MMM yyyy':'':'es' }}
                      }
                    } @else {
                      {{ t.estado_territorio }}
                    }
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0 basis-full sm:basis-auto [&>button]:flex-1 sm:[&>button]:flex-none [&>button]:justify-center">
                  @if (p?.ciclo && !p!.ciclo!.completado && p!.total_manzanas === 0) {
                    <button type="button" (click)="completarVuelta()" [disabled]="completandoCiclo()"
                      class="h-10 px-3.5 text-sm font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50">
                      Marcar vuelta completada
                    </button>
                  }
                  <button type="button" (click)="openNuevaSalidaModal()"
                    class="h-10 px-4 text-sm font-semibold bg-green-600 hover:bg-green-700 active:scale-[0.97] text-white rounded-xl transition flex items-center gap-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Registrar salida
                  </button>
                </div>
              </div>

              <!-- Progreso de la vuelta -->
              @if (p && p.total_manzanas > 0) {
                <div class="mt-4 flex items-center gap-4">
                  <div class="flex-1 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"
                    role="progressbar" [attr.aria-valuenow]="p.porcentaje" aria-valuemin="0" aria-valuemax="100"
                    aria-label="Avance de la vuelta">
                    <div class="h-full bg-green-500 rounded-full transition-[width] duration-700 ease-out" [style.width.%]="p.porcentaje"></div>
                  </div>
                  <p class="shrink-0 text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                    <span class="font-bold text-gray-900 dark:text-white">{{ p.manzanas_predicadas }}</span>
                    de {{ p.total_manzanas }} manzanas
                    <span class="ml-1.5 font-bold text-green-700 dark:text-green-400">{{ p.porcentaje | number:'1.0-0' }}%</span>
                  </p>
                </div>
              } @else if (progresoLoading()) {
                <div class="mt-4 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse"></div>
              }
            </header>

            <!-- Cuerpo: en escritorio dos columnas con scroll propio; la página no se desplaza -->
            <div class="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-4 md:p-5 flex flex-col gap-4">

              @if (noVisitar().length > 0) {
                <details class="shrink-0 group rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/15" role="alert">
                  <summary class="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer list-none text-sm font-semibold text-red-800 dark:text-red-300 select-none">
                    <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/>
                    </svg>
                    <span class="flex-1">
                      {{ noVisitar().length === 1 ? '1 dirección no se debe visitar' : noVisitar().length + ' direcciones no se deben visitar' }}
                    </span>
                    <span class="text-xs font-semibold underline underline-offset-2 group-open:hidden">Ver cuáles</span>
                    <span class="text-xs font-semibold underline underline-offset-2 hidden group-open:inline">Ocultar</span>
                  </summary>
                  <ul class="px-4 pb-3 space-y-1 max-h-32 overflow-y-auto">
                    @for (v of noVisitar(); track v.id_vivienda) {
                      <li class="text-sm text-red-900 dark:text-red-200">
                        <span class="font-semibold">Manzana {{ v.numero_manzana || v.id_manzana }}:</span>
                        {{ textoDir(v) }}@if (v.motivo_no_visitar) { · {{ v.motivo_no_visitar }} }
                      </li>
                    }
                  </ul>
                </details>
              }

              <div class="grid gap-4 lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_17rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">

                <!-- ── Manzanas ── -->
                <section class="flex flex-col lg:min-h-0 rounded-2xl border bg-white dark:bg-gray-800 transition-colors"
                  [class]="salidaActiva()
                    ? 'border-green-300 dark:border-green-700 ring-4 ring-green-500/10'
                    : 'border-gray-200/80 dark:border-gray-700/60'"
                  aria-labelledby="titulo-manzanas">

                  @if (salidaActiva(); as sa) {
                    <!-- Modo marcar: el panel se convierte en la herramienta de registro -->
                    <div class="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-green-100 dark:border-green-900/40 bg-green-50/70 dark:bg-green-900/20 rounded-t-2xl">
                      <div class="min-w-0 flex-1">
                        <h3 id="titulo-manzanas" class="text-sm font-bold text-gray-900 dark:text-white">
                          Salida del {{ sa.fecha_salida | date:'EEEE d MMM':'':'es' }}
                        </h3>
                        <p class="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                          Toca las manzanas que se predicaron ese día.
                        </p>
                      </div>
                      <span class="text-sm font-bold text-green-700 dark:text-green-300 tabular-nums whitespace-nowrap">
                        {{ manzanasSalidaActiva().length }} {{ manzanasSalidaActiva().length === 1 ? 'marcada' : 'marcadas' }}
                      </span>
                      <button type="button" (click)="closeSalidaTracking()"
                        class="h-9 px-4 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                        Listo
                      </button>
                    </div>
                  } @else {
                    <div class="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                      <h3 id="titulo-manzanas" class="text-sm font-bold text-gray-900 dark:text-white">
                        Manzanas
                      </h3>
                      @if (manzanas().length > 0) {
                        <div class="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
                          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-green-500" aria-hidden="true"></span>Predicada</span>
                          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border-2 border-gray-300 dark:border-gray-500" aria-hidden="true"></span>Falta</span>
                          @if (estadoLoading()) { <span class="text-gray-400">Actualizando…</span> }
                        </div>
                      }
                    </div>
                  }

                  <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-4">
                    @if (manzanasLoading()) {
                      <div class="grid grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] gap-2">
                        @for (i of [1,2,3,4,5,6,7,8,9,10,11,12]; track i) {
                          <div class="h-14 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse"></div>
                        }
                      </div>
                    } @else if (manzanas().length === 0) {
                      <div class="h-full min-h-[8rem] flex flex-col items-center justify-center text-center px-4">
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">Este territorio no tiene manzanas</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Agrégalas en Territorios → Congregación → Manzanas.</p>
                      </div>
                    } @else if (salidaActiva()) {
                      <div class="grid grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] gap-2">
                        @for (m of manzanas(); track m.id_manzana) {
                          @let marcada = manzanasSalidaActiva().includes(m.id_manzana);
                          @let toggling = manzanaSalidaToggling() === m.id_manzana;
                          <button type="button" (click)="toggleManzanaEnSalida(m.id_manzana)"
                            [disabled]="toggling"
                            [attr.aria-pressed]="marcada"
                            [attr.aria-label]="'Manzana ' + (m.numero_manzana || m.id_manzana)"
                            class="h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 font-bold transition-[background-color,border-color,transform] duration-150 active:scale-[0.95] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                            [class]="marcada
                              ? 'bg-green-500 border-green-600 text-white'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-400 dark:hover:border-green-600'">
                            @if (toggling) {
                              <span class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                            } @else {
                              <span class="text-base leading-none tabular-nums">{{ m.numero_manzana || m.id_manzana }}</span>
                              @if (marcada) {
                                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                              }
                            }
                          </button>
                        }
                      </div>
                    } @else {
                      <ul class="grid grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] gap-2">
                        @for (m of manzanas(); track m.id_manzana) {
                          @let estado = estadoManzanas().get(m.id_manzana);
                          <li class="h-14 rounded-xl flex flex-col items-center justify-center gap-1 px-1 text-center"
                            [class]="estado
                              ? 'bg-green-500 text-white'
                              : 'border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'"
                            [attr.title]="estado
                              ? 'Predicada el ' + (estado.fecha_salida | date:'d MMM yyyy':'':'es') + (estado.nombre_capitan ? ' · ' + estado.nombre_capitan : '')
                              : 'Falta predicar'">
                            <span class="text-base font-bold leading-none tabular-nums">{{ m.numero_manzana || m.id_manzana }}</span>
                            <span class="text-xs leading-none"
                              [class]="estado ? 'text-green-50 font-semibold' : 'text-gray-500 dark:text-gray-400'">
                              {{ estado ? (estado.fecha_salida | date:'d MMM':'':'es') : 'Falta' }}
                            </span>
                          </li>
                        }
                      </ul>
                    }
                  </div>
                </section>

                <!-- ── Salidas ── -->
                <section class="flex flex-col lg:min-h-0 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-800"
                  aria-labelledby="titulo-salidas">
                  <div class="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                    <h3 id="titulo-salidas" class="text-sm font-bold text-gray-900 dark:text-white">
                      Salidas registradas
                      @if (salidas().length) {
                        <span class="ml-1 font-semibold text-gray-500 dark:text-gray-400 tabular-nums">{{ salidas().length }}</span>
                      }
                    </h3>
                  </div>

                  <div class="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                    @if (salidasLoading()) {
                      <div class="p-3 space-y-2">
                        @for (i of [1,2,3]; track i) {
                          <div class="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse"></div>
                        }
                      </div>
                    } @else if (salidas().length === 0) {
                      <div class="h-full min-h-[10rem] flex flex-col items-center justify-center text-center px-6 py-8">
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">Todavía no hay salidas</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-[28ch]">
                          Cada vez que el grupo predique aquí, regístralo con <span class="font-semibold text-gray-700 dark:text-gray-200">Registrar salida</span>.
                        </p>
                      </div>
                    } @else {
                      <ul class="divide-y divide-gray-100 dark:divide-gray-700/60">
                        @for (s of salidas(); track s.id_salida) {
                          @let activa = salidaActiva()?.id_salida === s.id_salida;
                          <li class="px-4 py-2.5 transition-colors"
                            [class]="activa ? 'bg-green-50 dark:bg-green-900/20' : ''">
                            <div class="flex items-start gap-3">
                              <div class="w-11 shrink-0 text-center rounded-lg py-1"
                                [class]="activa ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'">
                                <span class="block text-lg font-bold leading-none tabular-nums">{{ s.fecha_salida | date:'d' }}</span>
                                <span class="block text-xs font-semibold leading-tight mt-0.5" [class]="activa ? 'text-green-50' : 'text-gray-500 dark:text-gray-400'">
                                  {{ s.fecha_salida | date:'MMM':'':'es' }}
                                </span>
                              </div>
                              <div class="min-w-0 flex-1">
                                <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                  {{ s.nombre_capitan || 'Sin capitán' }}
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                  <span class="capitalize">{{ s.fecha_salida | date:'EEEE':'':'es' }}</span>
                                  · {{ s.manzanas_predicadas === 1 ? '1 manzana' : s.manzanas_predicadas + ' manzanas' }}
                                  @if (s.nombre_punto_salida) { · {{ s.nombre_punto_salida }} }
                                </p>
                                @if (s.notas) {
                                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate" [title]="s.notas">{{ s.notas }}</p>
                                }
                              </div>
                            </div>

                            <div class="mt-1 2xl:pl-14 flex items-center gap-1">
                              @if (confirmarEliminarId() === s.id_salida) {
                                <span class="text-sm text-red-700 dark:text-red-400 font-semibold mr-auto">¿Eliminar esta salida?</span>
                                <button type="button" (click)="confirmarEliminarId.set(null)"
                                  class="h-8 px-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                  No
                                </button>
                                <button type="button" (click)="confirmarEliminarSalida(s.id_salida)"
                                  class="h-8 px-3 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                                  Sí, eliminar
                                </button>
                              } @else {
                                @if (activa) {
                                  <span class="h-8 inline-flex items-center whitespace-nowrap text-sm font-semibold text-green-700 dark:text-green-400 mr-auto">Marcando manzanas…</span>
                                } @else {
                                  <button type="button" (click)="openSalidaTracking(s)"
                                    class="h-8 px-2.5 -ml-2.5 mr-auto inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                    Marcar manzanas
                                  </button>
                                }
                                <button type="button" (click)="openEditSalidaModal(s)"
                                  title="Editar salida" aria-label="Editar salida"
                                  class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button type="button" (click)="confirmarEliminarId.set(s.id_salida)"
                                  title="Eliminar salida" aria-label="Eliminar salida"
                                  class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                                  </svg>
                                </button>
                              }
                            </div>
                          </li>
                        }
                      </ul>
                    }
                  </div>
                </section>
              </div>
            </div>
          </section>
        }
      </div>
    </div>

    <!-- Modal Nueva/Editar Salida -->
    @if (showSalidaModal()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" (click)="showSalidaModal.set(false)"></div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm relative z-10 shadow-2xl overflow-hidden">
          <div class="p-5 border-b border-gray-100 dark:border-gray-700/50">
            <h3 class="text-base font-bold text-gray-900 dark:text-white">
              {{ editingSalidaId() ? 'Editar Salida' : 'Nueva Salida' }}
            </h3>
          </div>
          <div class="p-5 space-y-4">
            <div>
              <label for="salida-fecha" class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Fecha <span class="text-red-500" aria-hidden="true">*</span>
              </label>
              <input id="salida-fecha" type="date" [(ngModel)]="editingSalida.fecha_salida"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label for="salida-capitan" class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Capitán <span class="text-xs text-gray-400 normal-case font-normal">(opcional)</span>
              </label>
              <app-select-picker colorScheme="emerald" ariaLabel="Capitán" [(ngModel)]="editingSalida.id_capitan"
                [options]="opcionesCapitan()" placeholder="— Sin capitán —" />
              @if (iniciaVueltaNueva()) {
                <p class="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                  Esta salida inicia una vuelta nueva: el capitán queda como "Asignado a" en el registro S-13.
                </p>
              }
            </div>
            <div>
              <label for="salida-punto" class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Punto de salida <span class="text-xs text-gray-400 normal-case font-normal">(opcional)</span>
              </label>
              <app-select-picker colorScheme="emerald" ariaLabel="Punto de salida" [(ngModel)]="editingSalida.id_punto_salida"
                [options]="opcionesPunto()" placeholder="— Sin punto de salida —" [searchable]="false" />
            </div>
            <div>
              <label for="salida-notas" class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Notas <span class="text-xs text-gray-400 normal-case font-normal">(opcional)</span>
              </label>
              <input id="salida-notas" type="text" [(ngModel)]="editingSalida.notas"
                placeholder="Observaciones..."
                class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div class="p-5 border-t border-gray-100 dark:border-gray-700/50 flex gap-3">
            <button (click)="showSalidaModal.set(false)"
              class="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button (click)="saveSalida()"
              [disabled]="!editingSalida.fecha_salida || salidaSaving()"
              class="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {{ salidaSaving() ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SeguimientoPredicacionPage implements OnInit {
  private territoriosService = inject(TerritoriosService);
  private congregacionCtx = inject(CongregacionContextService);

  publicadores = signal<PublicadorOpcion[]>([]);
  publicadoresOrdenados = computed(() =>
    [...this.publicadores()].sort((a, b) => nombreMostrado(a).localeCompare(nombreMostrado(b), 'es'))
  );
  nombreDe = (p: PublicadorOpcion) => nombreMostrado(p);
  puntos = signal<Punto[]>([]);
  noVisitar = signal<ViviendaDeTerritorio[]>([]);
  textoDir = textoDireccion;
  textoDias = textoDiasSinTrabajar;
  /** Última salida y % de la vuelta de cada territorio, para la lista. */
  resumen = signal<Map<number, ResumenTerritorio>>(new Map());
  puntosSalida = computed(() => this.puntos().filter(p => (p.tipo ?? 'Otro') === 'Salida'));
  opcionesCapitan = computed<PickerOption[]>(() =>
    this.publicadoresOrdenados().map(p => ({ value: p.id_publicador, label: this.nombreDe(p) })));
  opcionesPunto = computed<PickerOption[]>(() =>
    this.puntosSalida().map(pt => ({ value: pt.id_punto, label: pt.nombre || 'Punto ' + pt.id_punto })));

  /** Al crear una salida sin vuelta en curso, esa salida abre la vuelta y su capitán queda asignado. */
  iniciaVueltaNueva = computed(() => {
    if (this.editingSalidaId() !== null) return false;
    const ciclo = this.progreso()?.ciclo;
    return !ciclo || ciclo.completado;
  });

  // Lista
  territorios = signal<Territorio[]>([]);
  loading = signal(false);
  // Fix #1: signal para que computed() reactive al cambio
  searchQuery = signal('');

  // Selección
  territorioSeleccionado = signal<Territorio | null>(null);
  manzanas = signal<Manzana[]>([]);
  salidas = signal<SalidaPredicacion[]>([]);
  progreso = signal<ProgresoTerritorio | null>(null);

  // Estados
  estadoManzanas = signal<Map<number, EstadoManzana>>(new Map());
  manzanasLoading = signal(false);
  salidasLoading = signal(false);
  progresoLoading = signal(false);
  estadoLoading = signal(false);

  // Tracking activo
  salidaActiva = signal<SalidaPredicacion | null>(null);
  manzanasSalidaActiva = signal<number[]>([]);
  manzanaSalidaToggling = signal<number | null>(null);

  // Fix #2: confirmación inline de eliminación
  confirmarEliminarId = signal<number | null>(null);

  // Modal salida
  showSalidaModal = signal(false);
  editingSalidaId = signal<number | null>(null);
  editingSalida: Partial<SalidaPredicacion> = {};
  salidaSaving = signal(false);
  completandoCiclo = signal(false);

  // Fix #1: computed() ahora lee searchQuery() como signal → reactivo
  territoriosFiltrados = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.territorios();
    return this.territorios().filter(
      t => t.nombre.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.territoriosService.getTerritorios(0, 500).subscribe({
      next: (list) => { this.territorios.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.territoriosService.getPublicadores(this.congregacionCtx.effectiveCongregacionId())
      .subscribe({ next: (list) => this.publicadores.set(list) });
    this.loadResumen();
  }

  private loadResumen(): void {
    this.territoriosService.getResumen().subscribe({
      next: (filas) => this.resumen.set(new Map(filas.map(f => [f.id_territorio, f]))),
    });
  }

  volverALista(): void {
    this.salidaActiva.set(null);
    this.manzanasSalidaActiva.set([]);
    this.territorioSeleccionado.set(null);
  }

  seleccionarTerritorio(t: Territorio): void {
    this.territorioSeleccionado.set(t);
    this.progreso.set(null);
    this.salidaActiva.set(null);
    this.manzanasSalidaActiva.set([]);
    this.estadoManzanas.set(new Map());
    this.confirmarEliminarId.set(null);
    this.puntos.set([]);
    this.noVisitar.set([]);
    this.territoriosService.getNoVisitar(t.id_territorio).subscribe({ next: (l) => this.noVisitar.set(l) });
    this.territoriosService.getPuntos(t.id_territorio).subscribe({ next: (l) => this.puntos.set(l) });
    this.loadManzanas(t.id_territorio);
    this.loadSalidas(t.id_territorio);
    this.loadProgreso(t.id_territorio);
    // Fix #8: una sola llamada en lugar de N
    this.loadEstadoManzanas(t.id_territorio);
  }

  private loadManzanas(idTerritorio: number): void {
    this.manzanasLoading.set(true);
    this.territoriosService.getManzanas(idTerritorio).subscribe({
      next: (list) => { this.manzanas.set(list); this.manzanasLoading.set(false); },
      error: () => this.manzanasLoading.set(false),
    });
  }

  private loadSalidas(idTerritorio: number): void {
    this.salidasLoading.set(true);
    this.territoriosService.getSalidas(idTerritorio).subscribe({
      next: (list) => { this.salidas.set(list); this.salidasLoading.set(false); },
      error: () => this.salidasLoading.set(false),
    });
  }

  private loadProgreso(idTerritorio: number): void {
    this.progresoLoading.set(true);
    this.territoriosService.getSalidaProgreso(idTerritorio).subscribe({
      next: (p) => { this.progreso.set(p); this.progresoLoading.set(false); },
      error: () => this.progresoLoading.set(false),
    });
  }

  // Fix #8: reemplaza el N+1 buildEstadoManzanas con una sola request
  private loadEstadoManzanas(idTerritorio: number): void {
    this.estadoLoading.set(true);
    this.territoriosService.getEstadoManzanas(idTerritorio).subscribe({
      next: (data) => {
        const mapa = new Map<number, EstadoManzana>();
        Object.entries(data).forEach(([key, val]) => mapa.set(Number(key), val));
        this.estadoManzanas.set(mapa);
        this.estadoLoading.set(false);
      },
      error: () => this.estadoLoading.set(false),
    });
  }

  completarVuelta(): void {
    const t = this.territorioSeleccionado();
    if (!t || this.completandoCiclo()) return;
    this.completandoCiclo.set(true);
    this.territoriosService.completarCiclo(t.id_territorio).subscribe({
      next: () => {
        this.completandoCiclo.set(false);
        this.loadProgreso(t.id_territorio);
        this.loadEstadoManzanas(t.id_territorio);
        this.loadResumen();
      },
      error: () => this.completandoCiclo.set(false),
    });
  }

  openNuevaSalidaModal(): void {
    this.editingSalida = { fecha_salida: new Date().toISOString().slice(0, 10), id_capitan: null, id_punto_salida: null, notas: '' };
    this.editingSalidaId.set(null);
    this.showSalidaModal.set(true);
  }

  openEditSalidaModal(s: SalidaPredicacion): void {
    this.editingSalida = {
      fecha_salida: s.fecha_salida,
      id_capitan: s.id_capitan ?? null,
      id_punto_salida: s.id_punto_salida ?? null,
      notas: s.notas ?? '',
    };
    this.editingSalidaId.set(s.id_salida);
    this.showSalidaModal.set(true);
  }

  saveSalida(): void {
    const t = this.territorioSeleccionado();
    if (!t) return;
    this.salidaSaving.set(true);
    const id = this.editingSalidaId();
    // Solo lo que el backend guarda: el nombre del capitán se resuelve allí por id_capitan.
    const cuerpo: Partial<SalidaPredicacion> = {
      fecha_salida: this.editingSalida.fecha_salida,
      id_capitan: this.editingSalida.id_capitan ?? null,
      id_punto_salida: this.editingSalida.id_punto_salida ?? null,
      notas: this.editingSalida.notas,
    };
    const obs = id
      ? this.territoriosService.updateSalida(t.id_territorio, id, cuerpo)
      : this.territoriosService.createSalida(t.id_territorio, { ...cuerpo, id_territorio: t.id_territorio });
    obs.subscribe({
      next: () => {
        this.salidaSaving.set(false);
        this.showSalidaModal.set(false);
        this.loadSalidas(t.id_territorio);
        this.loadProgreso(t.id_territorio);
        this.loadEstadoManzanas(t.id_territorio);
        this.loadResumen();
      },
      error: () => this.salidaSaving.set(false),
    });
  }

  // Fix #2: flujo de dos pasos — primero pide confirmación, luego ejecuta
  confirmarEliminarSalida(idSalida: number): void {
    const t = this.territorioSeleccionado();
    if (!t) return;
    this.territoriosService.deleteSalida(t.id_territorio, idSalida).subscribe({
      next: () => {
        this.confirmarEliminarId.set(null);
        if (this.salidaActiva()?.id_salida === idSalida) {
          this.salidaActiva.set(null);
          this.manzanasSalidaActiva.set([]);
        }
        this.loadSalidas(t.id_territorio);
        this.loadProgreso(t.id_territorio);
        this.loadEstadoManzanas(t.id_territorio);
        this.loadResumen();
      },
    });
  }

  openSalidaTracking(s: SalidaPredicacion): void {
    const t = this.territorioSeleccionado();
    if (!t) return;
    this.salidaActiva.set(s);
    this.territoriosService.getManzanasSalida(t.id_territorio, s.id_salida).subscribe({
      next: (ids) => this.manzanasSalidaActiva.set(ids),
    });
  }

  closeSalidaTracking(): void {
    const t = this.territorioSeleccionado();
    this.salidaActiva.set(null);
    this.manzanasSalidaActiva.set([]);
    if (t) {
      this.loadSalidas(t.id_territorio);
      this.loadProgreso(t.id_territorio);
      this.loadEstadoManzanas(t.id_territorio);
      this.loadResumen();
    }
  }

  toggleManzanaEnSalida(idManzana: number): void {
    const t = this.territorioSeleccionado();
    const s = this.salidaActiva();
    if (!t || !s) return;
    const isPredicada = this.manzanasSalidaActiva().includes(idManzana);
    this.manzanaSalidaToggling.set(idManzana);
    if (isPredicada) {
      this.territoriosService.unmarkManzanaPredicada(t.id_territorio, s.id_salida, idManzana).subscribe({
        next: () => {
          this.manzanaSalidaToggling.set(null);
          this.manzanasSalidaActiva.update(ids => ids.filter(id => id !== idManzana));
        },
        error: () => this.manzanaSalidaToggling.set(null),
      });
    } else {
      this.territoriosService.markManzanaPredicada(t.id_territorio, s.id_salida, idManzana).subscribe({
        next: () => {
          this.manzanaSalidaToggling.set(null);
          this.manzanasSalidaActiva.update(ids => [...ids, idManzana]);
        },
        error: () => this.manzanaSalidaToggling.set(null),
      });
    }
  }
}

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerritoriosService } from '../services/territorios.service';
import {
  Territorio,
  Manzana,
  SalidaPredicacion,
  ProgresoTerritorio,
} from '../models/territorio.model';

interface EstadoManzana {
  nombre_capitan: string;
  fecha_salida: string;
}

@Component({
  selector: 'app-seguimiento-predicacion',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="flex flex-col h-full overflow-hidden">

      <!-- ── Fix #7: PageHeader ── -->
      <div class="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50 shrink-0">
        <h1 class="font-display font-bold text-2xl text-gray-900 dark:text-white leading-tight">
          Seguimiento de Predicación
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Registra y monitorea las salidas por territorio
        </p>
      </div>

      <!-- ── Split panel ── -->
      <div class="flex flex-1 overflow-hidden">

        <!-- ── Panel izquierdo: lista de territorios ── -->
        <div class="w-80 shrink-0 flex flex-col border-r border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800 overflow-hidden">

          <!-- Fix #1: buscador reactivo con signal -->
          <div class="p-4 border-b border-gray-100 dark:border-gray-700/50 shrink-0">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <!-- Fix #3 (accesibilidad): aria-label en input -->
              <input
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                placeholder="Buscar territorio..."
                aria-label="Buscar territorio"
                class="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <!-- Lista de territorios -->
          <div class="flex-1 overflow-y-auto">
            @if (loading()) {
              <div class="p-4 space-y-2">
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse"></div>
                }
              </div>
            } @else if (territoriosFiltrados().length === 0) {
              <!-- Fix #5: text-xs mínimo para "Sin resultados" -->
              <div class="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">Sin resultados</p>
                <p class="text-xs text-gray-400">Prueba con otro nombre o código</p>
              </div>
            } @else {
              <div class="p-2 space-y-1">
                @for (t of territoriosFiltrados(); track t.id_territorio) {
                  <button
                    (click)="seleccionarTerritorio(t)"
                    class="w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all border"
                    [class]="territorioSeleccionado()?.id_territorio === t.id_territorio
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/40 border-transparent'"
                  >
                    <!-- Badge código -->
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs"
                      [class]="territorioSeleccionado()?.id_territorio === t.id_territorio
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'">
                      {{ t.codigo }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate leading-tight">
                        {{ t.nombre }}
                      </p>
                      <!-- Fix #5: dot de estado con text-xs mínimo -->
                      <p class="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <span class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          [class]="t.estado_territorio === 'Disponible' ? 'bg-green-400'
                                 : t.estado_territorio === 'Asignado'   ? 'bg-sky-400'
                                 : 'bg-gray-300'"></span>
                        {{ t.estado_territorio }}
                      </p>
                    </div>
                    @if (territorioSeleccionado()?.id_territorio === t.id_territorio) {
                      <svg class="w-4 h-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    }
                  </button>
                }
              </div>
            }
          </div>

          <!-- Pie: conteo de territorios (Fix #7 — dato contextual) -->
          @if (!loading()) {
            <div class="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/50 shrink-0">
              <p class="text-xs text-gray-400">
                {{ territoriosFiltrados().length }}
                {{ territoriosFiltrados().length === 1 ? 'territorio' : 'territorios' }}
              </p>
            </div>
          }
        </div>

        <!-- ── Panel derecho: detalle ── -->
        @if (!territorioSeleccionado()) {
          <!-- Fix #6: gray en lugar de slate; Fix #5: text-sm -->
          <div class="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
              <svg class="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">Selecciona un territorio</p>
              <p class="text-xs text-gray-400 mt-0.5">para ver el seguimiento de predicación</p>
            </div>
          </div>
        } @else {
          <div class="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900/30">

            <!-- Header territorio -->
            <div class="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50 p-5 shrink-0">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <!-- Fix #5: label mínimo 10px; Fix #6: green en lugar de emerald -->
                  <p class="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-[0.15em] mb-0.5">
                    Territorio
                  </p>
                  <!-- Fix #5: font-bold en lugar de font-black -->
                  <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                    {{ territorioSeleccionado()!.codigo }} — {{ territorioSeleccionado()!.nombre }}
                  </h2>
                </div>
                @if (progreso()) {
                  <div class="shrink-0 text-right">
                    <p class="text-2xl font-bold text-green-600 dark:text-green-400 leading-none">
                      {{ progreso()!.porcentaje }}%
                    </p>
                    <p class="text-xs text-gray-400 mt-0.5">
                      {{ progreso()!.manzanas_predicadas }}/{{ progreso()!.total_manzanas }} manzanas
                    </p>
                  </div>
                } @else if (progresoLoading()) {
                  <div class="w-16 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse shrink-0"></div>
                }
              </div>
              @if (progreso() && progreso()!.total_manzanas > 0) {
                <div class="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div class="h-full bg-green-500 rounded-full transition-all duration-700"
                    [style.width.%]="progreso()!.porcentaje"></div>
                </div>
              }
            </div>

            <!-- Contenido scrollable -->
            <div class="flex-1 overflow-y-auto p-5 space-y-6">

              <!-- ── Vista tracking activo ── -->
              @if (salidaActiva()) {
                <!-- Fix #6: green en lugar de emerald; Fix #5: tamaños mínimos -->
                <div class="bg-green-50 dark:bg-green-900/15 rounded-2xl border border-green-200 dark:border-green-800/40 p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-[0.15em] mb-0.5">
                        Registrando salida
                      </p>
                      <p class="text-base font-semibold text-gray-800 dark:text-white">
                        {{ salidaActiva()!.fecha_salida | date:'EEEE d MMM':'':'es' }}
                      </p>
                      @if (salidaActiva()!.nombre_capitan) {
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                          <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                          </svg>
                          {{ salidaActiva()!.nombre_capitan }}
                        </p>
                      }
                    </div>
                    <button (click)="closeSalidaTracking()"
                      class="shrink-0 text-xs font-semibold px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/40 transition-colors flex items-center gap-1">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Volver
                    </button>
                  </div>
                  <div class="mt-3 flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-green-100 dark:bg-green-900/50 rounded-full overflow-hidden">
                      @let pctSalida = manzanas().length > 0
                        ? (manzanasSalidaActiva().length / manzanas().length * 100)
                        : 0;
                      <div class="h-full bg-green-500 rounded-full transition-all" [style.width.%]="pctSalida"></div>
                    </div>
                    <span class="text-xs font-bold text-green-600 dark:text-green-400 whitespace-nowrap tabular-nums">
                      {{ manzanasSalidaActiva().length }}/{{ manzanas().length }}
                    </span>
                  </div>
                </div>

                <!-- Fix #5: instrucción de manzana en text-xs -->
                <p class="text-xs text-gray-400 text-center">
                  Toca una manzana para marcarla como predicada en esta salida
                </p>

                @if (manzanas().length === 0) {
                  <div class="text-center py-6 text-gray-400 text-sm">
                    <p>No hay manzanas registradas en este territorio</p>
                  </div>
                } @else {
                  <div class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                    @for (m of manzanas(); track m.id_manzana) {
                      @let isPredicada = manzanasSalidaActiva().includes(m.id_manzana);
                      @let toggling = manzanaSalidaToggling() === m.id_manzana;
                      <button (click)="toggleManzanaEnSalida(m.id_manzana)"
                        [disabled]="toggling"
                        class="flex flex-col items-center justify-center aspect-square rounded-xl border-2 transition-all font-bold text-sm disabled:opacity-50"
                        [class]="isPredicada
                          ? 'bg-green-500 border-green-600 text-white shadow-md shadow-green-200 dark:shadow-green-900/40'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-green-400 dark:hover:border-green-600 hover:text-green-600 dark:hover:text-green-400 hover:shadow-sm'">
                        @if (toggling) {
                          <div class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        } @else {
                          <span class="text-sm leading-none">{{ m.numero_manzana || m.id_manzana }}</span>
                          @if (isPredicada) {
                            <svg class="w-3.5 h-3.5 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          }
                        }
                      </button>
                    }
                  </div>
                }

              } @else {

                <!-- ── Estado actual por manzana ── -->
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <!-- Fix #5: text-xs mínimo para label de sección -->
                    <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-widest">Estado por Manzana</h3>
                    @if (estadoLoading()) {
                      <span class="text-xs text-gray-400">Calculando...</span>
                    }
                  </div>

                  @if (manzanas().length === 0 && !manzanasLoading()) {
                    <div class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-center text-gray-400">
                      <p class="text-sm font-semibold">Sin manzanas registradas</p>
                      <p class="text-xs mt-1">Ve a Territorios → Manzanas para agregar manzanas a este territorio</p>
                    </div>
                  } @else if (manzanasLoading()) {
                    <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                      @for (i of [1,2,3,4,5,6]; track i) {
                        <div class="aspect-square bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse"></div>
                      }
                    </div>
                  } @else {
                    <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      @for (m of manzanas(); track m.id_manzana) {
                        @let estado = estadoManzanas().get(m.id_manzana);
                        <div class="rounded-2xl border-2 p-3 flex flex-col items-center gap-1.5 text-center transition-all"
                          [class]="estado
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'">
                          <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                            [class]="estado
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'">
                            {{ m.numero_manzana || m.id_manzana }}
                          </div>
                          @if (estado) {
                            <!-- Fix #5: mínimo text-[10px] para badges de manzana -->
                            <span class="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide leading-none">
                              Predicada
                            </span>
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 leading-tight truncate w-full">
                              {{ estado.nombre_capitan }}
                            </p>
                            <p class="text-[10px] text-gray-400 leading-none">
                              {{ estado.fecha_salida | date:'d MMM yy':'':'es' }}
                            </p>
                          } @else {
                            <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none">
                              Pendiente
                            </span>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- ── Salidas ── -->
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      Salidas ({{ salidas().length }})
                    </h3>
                    <button (click)="openNuevaSalidaModal()"
                      class="text-xs font-semibold px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-sm min-h-[32px]">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Nueva Salida
                    </button>
                  </div>

                  @if (salidasLoading()) {
                    <div class="space-y-2">
                      @for (i of [1,2,3]; track i) {
                        <div class="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse"></div>
                      }
                    </div>
                  } @else if (salidas().length === 0) {
                    <div class="text-center py-8 text-gray-400 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                      <svg class="w-10 h-10 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="1.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      <p class="text-sm font-semibold text-gray-500 dark:text-gray-400">Sin salidas registradas</p>
                      <p class="text-xs mt-1">Registra los días que el grupo predicó en este territorio</p>
                    </div>
                  } @else {
                    <div class="space-y-2">
                      @for (s of salidas(); track s.id_salida) {
                        <!-- Fix #3: botones siempre visibles (sin opacity-0 group-hover) -->
                        <div class="flex items-center gap-3 p-3 bg-white dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/40 hover:border-green-200 dark:hover:border-green-800/40 transition-all">
                          <!-- Date badge -->
                          <div class="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800/30 flex flex-col items-center justify-center shrink-0">
                            <span class="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase leading-none">
                              {{ s.fecha_salida | date:'MMM':'':'es' }}
                            </span>
                            <span class="text-base font-bold text-green-700 dark:text-green-300 leading-tight">
                              {{ s.fecha_salida | date:'d' }}
                            </span>
                          </div>

                          <!-- Info -->
                          <div class="flex-1 min-w-0">
                            @if (s.nombre_capitan) {
                              <p class="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                                {{ s.nombre_capitan }}
                              </p>
                            } @else {
                              <p class="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                {{ s.fecha_salida | date:'EEEE':'':'es' }}
                              </p>
                            }
                            <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                                {{ s.manzanas_predicadas }} manz.
                              </span>
                              <!-- Fix #4: SVG pin en lugar de emoji 📍 -->
                              @if (s.nombre_punto_salida) {
                                <span class="text-[10px] text-gray-400 flex items-center gap-0.5 truncate">
                                  <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                  </svg>
                                  {{ s.nombre_punto_salida }}
                                </span>
                              }
                            </div>
                          </div>

                          <!-- Fix #2: confirmación inline antes de eliminar -->
                          <!-- Fix #3: botones siempre visibles, sin hover-only -->
                          <div class="flex items-center gap-1 shrink-0">
                            @if (confirmarEliminarId() === s.id_salida) {
                              <span class="text-xs text-red-600 dark:text-red-400 font-semibold mr-1">¿Eliminar?</span>
                              <button (click)="confirmarEliminarSalida(s.id_salida)"
                                class="px-2 py-1 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                                Sí
                              </button>
                              <button (click)="confirmarEliminarId.set(null)"
                                class="px-2 py-1 text-xs font-bold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg transition-colors">
                                No
                              </button>
                            } @else {
                              <button (click)="openSalidaTracking(s)"
                                title="Registrar manzanas"
                                class="p-1.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <path d="M9 11l3 3L22 4"/>
                                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                </svg>
                              </button>
                              <button (click)="openEditSalidaModal(s)"
                                title="Editar salida"
                                class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <!-- Botón eliminar separado visualmente -->
                              <button (click)="confirmarEliminarId.set(s.id_salida)"
                                title="Eliminar salida"
                                class="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-0.5">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14H6L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/>
                                </svg>
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

              }
            </div>
          </div>
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
              <input id="salida-capitan" type="text" [(ngModel)]="editingSalida.nombre_capitan"
                placeholder="Nombre del capitán..."
                class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
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
  }

  seleccionarTerritorio(t: Territorio): void {
    this.territorioSeleccionado.set(t);
    this.salidaActiva.set(null);
    this.manzanasSalidaActiva.set([]);
    this.estadoManzanas.set(new Map());
    this.confirmarEliminarId.set(null);
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

  openNuevaSalidaModal(): void {
    this.editingSalida = { fecha_salida: new Date().toISOString().slice(0, 10), nombre_capitan: '' };
    this.editingSalidaId.set(null);
    this.showSalidaModal.set(true);
  }

  openEditSalidaModal(s: SalidaPredicacion): void {
    this.editingSalida = {
      fecha_salida: s.fecha_salida,
      nombre_capitan: s.nombre_capitan ?? '',
      id_capitan: s.id_capitan,
      id_punto_salida: s.id_punto_salida,
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
    const obs = id
      ? this.territoriosService.updateSalida(t.id_territorio, id, this.editingSalida)
      : this.territoriosService.createSalida(t.id_territorio, { ...this.editingSalida, id_territorio: t.id_territorio });
    obs.subscribe({
      next: () => {
        this.salidaSaving.set(false);
        this.showSalidaModal.set(false);
        this.loadSalidas(t.id_territorio);
        this.loadProgreso(t.id_territorio);
        this.loadEstadoManzanas(t.id_territorio);
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

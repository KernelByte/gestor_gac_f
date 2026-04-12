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
    <div class="flex h-full overflow-hidden">

      <!-- ── Panel izquierdo: lista de territorios ── -->
      <div class="w-72 shrink-0 flex flex-col border-r border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 overflow-hidden">
        <!-- Buscador -->
        <div class="p-4 border-b border-slate-100 dark:border-slate-700/50 shrink-0">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Buscar territorio..."
              class="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Lista -->
        <div class="flex-1 overflow-y-auto simple-scrollbar">
          @if (loading()) {
            <div class="p-4 space-y-2">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="h-16 bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse"></div>
              }
            </div>
          } @else if (territoriosFiltrados().length === 0) {
            <div class="p-6 text-center text-slate-400 text-sm">Sin resultados</div>
          } @else {
            <div class="p-2 space-y-1">
              @for (t of territoriosFiltrados(); track t.id_territorio) {
                <button
                  (click)="seleccionarTerritorio(t)"
                  class="w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all"
                  [class]="territorioSeleccionado()?.id_territorio === t.id_territorio
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 border border-transparent'"
                >
                  <!-- Badge código -->
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs"
                    [class]="territorioSeleccionado()?.id_territorio === t.id_territorio
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'">
                    {{ t.codigo }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-200 truncate leading-tight">{{ t.nombre }}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <span class="inline-block w-1.5 h-1.5 rounded-full"
                        [class]="t.estado_territorio === 'Disponible' ? 'bg-emerald-400' : t.estado_territorio === 'Asignado' ? 'bg-sky-400' : 'bg-slate-300'"></span>
                      {{ t.estado_territorio }}
                    </p>
                  </div>
                  @if (territorioSeleccionado()?.id_territorio === t.id_territorio) {
                    <svg class="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  }
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- ── Panel derecho: detalle ── -->
      @if (!territorioSeleccionado()) {
        <div class="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <svg class="w-16 h-16 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <p class="text-sm font-medium">Selecciona un territorio para ver el seguimiento</p>
        </div>
      } @else {
        <div class="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/30">

          <!-- Header territorio -->
          <div class="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 p-5 shrink-0">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-[0.6rem] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.15em] mb-0.5">Territorio</p>
                <h2 class="text-xl font-black text-slate-900 dark:text-white">{{ territorioSeleccionado()!.codigo }} — {{ territorioSeleccionado()!.nombre }}</h2>
              </div>
              <!-- Progreso -->
              @if (progreso()) {
                <div class="shrink-0 text-right">
                  <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{{ progreso()!.porcentaje }}%</p>
                  <p class="text-[10px] text-slate-400 mt-0.5">{{ progreso()!.manzanas_predicadas }}/{{ progreso()!.total_manzanas }} manzanas</p>
                </div>
              } @else if (progresoLoading()) {
                <div class="w-16 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse shrink-0"></div>
              }
            </div>
            @if (progreso() && progreso()!.total_manzanas > 0) {
              <div class="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div class="h-full bg-emerald-500 rounded-full transition-all duration-700" [style.width.%]="progreso()!.porcentaje"></div>
              </div>
            }
          </div>

          <!-- Contenido scrollable -->
          <div class="flex-1 overflow-y-auto simple-scrollbar p-5 space-y-6">

            <!-- ── Vista tracking activo ── -->
            @if (salidaActiva()) {
              <div class="bg-emerald-50 dark:bg-emerald-900/15 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 p-4">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.15em] mb-0.5">Registrando salida</p>
                    <p class="text-base font-black text-slate-800 dark:text-white">{{ salidaActiva()!.fecha_salida | date:'EEEE d MMM':'':'es' }}</p>
                    @if (salidaActiva()!.nombre_capitan) {
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        {{ salidaActiva()!.nombre_capitan }}
                      </p>
                    }
                  </div>
                  <button (click)="closeSalidaTracking()"
                    class="shrink-0 text-[10px] font-bold px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors flex items-center gap-1">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    Volver
                  </button>
                </div>
                <div class="mt-3 flex items-center gap-2">
                  <div class="flex-1 h-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                    @let pctSalida = manzanas().length > 0 ? (manzanasSalidaActiva().length / manzanas().length * 100) : 0;
                    <div class="h-full bg-emerald-500 rounded-full transition-all" [style.width.%]="pctSalida"></div>
                  </div>
                  <span class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{{ manzanasSalidaActiva().length }}/{{ manzanas().length }}</span>
                </div>
              </div>
              <p class="text-[10px] text-slate-400 text-center">Toca una manzana para marcarla como predicada en esta salida</p>
              @if (manzanas().length === 0) {
                <div class="text-center py-6 text-slate-400 text-sm"><p>No hay manzanas registradas en este territorio</p></div>
              } @else {
                <div class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                  @for (m of manzanas(); track m.id_manzana) {
                    @let isPredicada = manzanasSalidaActiva().includes(m.id_manzana);
                    @let toggling = manzanaSalidaToggling() === m.id_manzana;
                    <button (click)="toggleManzanaEnSalida(m.id_manzana)"
                      [disabled]="toggling"
                      class="flex flex-col items-center justify-center aspect-square rounded-xl border-2 transition-all font-black text-sm disabled:opacity-50"
                      [class]="isPredicada
                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/40'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-sm'">
                      @if (toggling) {
                        <div class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      } @else {
                        <span class="text-sm leading-none">{{ m.numero_manzana || m.id_manzana }}</span>
                        @if (isPredicada) {
                          <svg class="w-3.5 h-3.5 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
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
                  <h3 class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest">Estado por Manzana</h3>
                  @if (estadoLoading()) {
                    <span class="text-[10px] text-slate-400">Calculando...</span>
                  }
                </div>
                @if (manzanas().length === 0 && !manzanasLoading()) {
                  <div class="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-slate-400">
                    <p class="text-sm font-medium">Sin manzanas registradas</p>
                    <p class="text-xs mt-1">Ve a Territorios → Manzanas para agregar manzanas a este territorio</p>
                  </div>
                } @else if (manzanasLoading()) {
                  <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    @for (i of [1,2,3,4,5,6]; track i) {
                      <div class="aspect-square bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse"></div>
                    }
                  </div>
                } @else {
                  <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    @for (m of manzanas(); track m.id_manzana) {
                      @let estado = estadoManzanas().get(m.id_manzana);
                      <div class="rounded-2xl border-2 p-3 flex flex-col items-center gap-1.5 text-center transition-all"
                        [class]="estado
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'">
                        <!-- Número manzana -->
                        <div class="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                          [class]="estado ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'">
                          {{ m.numero_manzana || m.id_manzana }}
                        </div>
                        <!-- Estado badge -->
                        @if (estado) {
                          <span class="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide leading-none">Predicada</span>
                          <p class="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate w-full">{{ estado.nombre_capitan }}</p>
                          <p class="text-[8px] text-slate-400 leading-none">{{ estado.fecha_salida | date:'d MMM yy':'':'es' }}</p>
                        } @else {
                          <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none">Pendiente</span>
                        }
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- ── Salidas ── -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-widest">Salidas ({{ salidas().length }})</h3>
                  <button (click)="openNuevaSalidaModal()"
                    class="text-[10px] font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-sm shadow-emerald-900/10">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva Salida
                  </button>
                </div>

                @if (salidasLoading()) {
                  <div class="space-y-2">
                    @for (i of [1,2,3]; track i) {
                      <div class="h-16 bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse"></div>
                    }
                  </div>
                } @else if (salidas().length === 0) {
                  <div class="text-center py-8 text-slate-400 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <svg class="w-10 h-10 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">Sin salidas registradas</p>
                    <p class="text-xs mt-1">Registra los días que el grupo predicó en este territorio</p>
                  </div>
                } @else {
                  <div class="space-y-2">
                    @for (s of salidas(); track s.id_salida) {
                      <div class="group flex items-center gap-3 p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/40 hover:border-emerald-200 dark:hover:border-emerald-800/40 transition-all">
                        <!-- Date badge -->
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/30 flex flex-col items-center justify-center shrink-0">
                          <span class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase leading-none">{{ s.fecha_salida | date:'MMM':'':'es' }}</span>
                          <span class="text-base font-black text-emerald-700 dark:text-emerald-300 leading-tight">{{ s.fecha_salida | date:'d' }}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                          @if (s.nombre_capitan) {
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{{ s.nombre_capitan }}</p>
                          } @else {
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-200">{{ s.fecha_salida | date:'EEEE':'':'es' }}</p>
                          }
                          <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">{{ s.manzanas_predicadas }} manz.</span>
                            @if (s.nombre_punto_salida) {
                              <span class="text-[9px] text-slate-400 truncate">📍 {{ s.nombre_punto_salida }}</span>
                            }
                          </div>
                        </div>
                        <!-- Acciones -->
                        <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button (click)="openSalidaTracking(s)"
                            class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                            title="Registrar manzanas">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                          </button>
                          <button (click)="openEditSalidaModal(s)"
                            class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button (click)="deleteSalida(s.id_salida)"
                            class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                          </button>
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

    <!-- Modal Nueva/Editar Salida -->
    @if (showSalidaModal()) {
    <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="showSalidaModal.set(false)"></div>
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-fadeIn">
        <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
          <h3 class="text-base font-black text-slate-900 dark:text-white">{{ editingSalidaId() ? 'Editar Salida' : 'Nueva Salida' }}</h3>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha *</label>
            <input type="date" [(ngModel)]="editingSalida.fecha_salida"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Capitán (opcional)</label>
            <input type="text" [(ngModel)]="editingSalida.nombre_capitan" placeholder="Nombre del capitán..."
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
            <input type="text" [(ngModel)]="editingSalida.notas" placeholder="Observaciones..."
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 flex gap-3">
          <button (click)="showSalidaModal.set(false)" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
          <button (click)="saveSalida()" [disabled]="!editingSalida.fecha_salida || salidaSaving()"
            class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
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
  searchQuery = '';

  // Selección
  territorioSeleccionado = signal<Territorio | null>(null);
  manzanas = signal<Manzana[]>([]);
  salidas = signal<SalidaPredicacion[]>([]);
  progreso = signal<ProgresoTerritorio | null>(null);

  // Estados calculados
  estadoManzanas = signal<Map<number, EstadoManzana>>(new Map());
  manzanasLoading = signal(false);
  salidasLoading = signal(false);
  progresoLoading = signal(false);
  estadoLoading = signal(false);

  // Tracking activo
  salidaActiva = signal<SalidaPredicacion | null>(null);
  manzanasSalidaActiva = signal<number[]>([]);
  manzanaSalidaToggling = signal<number | null>(null);

  // Modal salida
  showSalidaModal = signal(false);
  editingSalidaId = signal<number | null>(null);
  editingSalida: Partial<SalidaPredicacion> = {};
  salidaSaving = signal(false);

  territoriosFiltrados = computed(() => {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.territorios();
    return this.territorios().filter(t =>
      t.nombre.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q)
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
    this.loadManzanas(t.id_territorio);
    this.loadSalidas(t.id_territorio);
    this.loadProgreso(t.id_territorio);
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
      next: (list) => {
        this.salidas.set(list);
        this.salidasLoading.set(false);
        this.buildEstadoManzanas(idTerritorio, list);
      },
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

  // Construye el mapa manzanaId → {último capitán, última fecha}
  // Itera salidas ordenadas de más reciente a más antigua.
  // Para cuando todas las manzanas tienen estado o se acaban las salidas.
  private buildEstadoManzanas(idTerritorio: number, salidas: SalidaPredicacion[]): void {
    if (salidas.length === 0) {
      this.estadoManzanas.set(new Map());
      return;
    }
    // Ordenar desc por fecha
    const sorted = [...salidas].sort((a, b) =>
      new Date(b.fecha_salida).getTime() - new Date(a.fecha_salida).getTime()
    );

    this.estadoLoading.set(true);
    const mapa = new Map<number, EstadoManzana>();
    let idx = 0;

    const processNext = () => {
      if (idx >= sorted.length) {
        this.estadoManzanas.set(mapa);
        this.estadoLoading.set(false);
        return;
      }
      const salida = sorted[idx++];
      this.territoriosService.getManzanasSalida(idTerritorio, salida.id_salida).subscribe({
        next: (ids) => {
          ids.forEach(idManzana => {
            if (!mapa.has(idManzana)) {
              mapa.set(idManzana, {
                nombre_capitan: salida.nombre_capitan ?? 'Sin capitán',
                fecha_salida: salida.fecha_salida,
              });
            }
          });
          processNext();
        },
        error: () => processNext(),
      });
    };

    processNext();
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
      },
      error: () => this.salidaSaving.set(false),
    });
  }

  deleteSalida(idSalida: number): void {
    const t = this.territorioSeleccionado();
    if (!t) return;
    this.territoriosService.deleteSalida(t.id_territorio, idSalida).subscribe({
      next: () => {
        if (this.salidaActiva()?.id_salida === idSalida) {
          this.salidaActiva.set(null);
          this.manzanasSalidaActiva.set([]);
        }
        this.loadSalidas(t.id_territorio);
        this.loadProgreso(t.id_territorio);
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

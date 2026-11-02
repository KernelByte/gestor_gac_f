import { Component, inject, signal, computed, OnInit, viewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerritoriosService, PublicadorOpcion } from '../services/territorios.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { nombreMostrado } from '../../../core/utils/nombre.util';
import {
  Territorio,
  Punto,
  SalidaPredicacion,
  ProgresoTerritorio,
  ResumenTerritorio,
  ViviendaDeTerritorio,
  textoDiasSinTrabajar,
  textoDireccion,
  tipoAviso,
} from '../models/territorio.model';
import { RecorridoMapaComponent } from '../components/recorrido-mapa.component';
import { HistorialPredicacionComponent } from '../components/historial-predicacion.component';
import { AuthStore } from '../../../core/auth/auth.store';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';

@Component({
  selector: 'app-seguimiento-predicacion',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, PageHeaderComponent, SelectPickerComponent, RecorridoMapaComponent, HistorialPredicacionComponent],
  template: `
    <div class="flex flex-col h-full min-h-0">

      <app-page-header
        title="Seguimiento de predicación"
        subtitle="Marque lo que se predicó y vea cómo avanza el territorio."
        spacing="none">
        <!-- Una sola pantalla: toda la congregación o una tarjeta (reemplaza las pestañas y la lista) -->
        <div class="flex w-full md:w-auto items-center gap-2">
          <div class="flex-1 min-w-0 md:flex-none md:w-80">
            <app-select-picker colorScheme="emerald" ariaLabel="Qué ver: toda la congregación o una tarjeta"
              [ngModel]="territorioSeleccionado()?.id_territorio ?? null" (ngModelChange)="elegirTarjeta($event)"
              [options]="opcionesTarjeta()" placeholder="Toda la congregación" [searchable]="true" />
          </div>
          <button type="button" (click)="historialAbierto.set(true)"
            class="shrink-0 h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30">
            <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/><polyline points="12 7 12 12 15.5 14"/></svg>
            Historial
          </button>
        </div>
      </app-page-header>

      @if (historialAbierto()) {
        <app-historial-predicacion [tarjetas]="opcionesTarjeta()" [capitanes]="opcionesCapitan()"
          [tarjetaInicial]="territorioSeleccionado()?.id_territorio ?? null" (cerrar)="historialAbierto.set(false)" />
      }

      <div class="mt-4 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <app-recorrido-mapa #refMapa [idTerritorio]="territorioSeleccionado()?.id_territorio ?? null"
          [puedeEditar]="puedeEditar()" [capitanes]="opcionesCapitan()" (cambio)="alCambiarRecorrido()">

          <!-- Con una tarjeta elegida: su vuelta, avisos e historial (van en el panel del mapa) -->
          <div panel>
            @if (territorioSeleccionado(); as t) {
              @let p = progreso();
              <section class="border-t border-slate-100 dark:border-slate-700/60 px-4 py-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-black text-slate-900 dark:text-white truncate">Tarjeta {{ t.codigo }}@if (t.nombre) { <span class="font-semibold text-slate-500 dark:text-slate-400"> · {{ t.nombre }}</span> }</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      @if (p?.ciclo; as ciclo) {
                        @if (ciclo.completado) {
                          <span class="font-semibold text-emerald-700 dark:text-emerald-400">Vuelta completada el {{ ciclo.fecha_fin | date:'d MMM yyyy':'':'es' }}</span> · la próxima salida empieza otra
                        } @else {
                          Vuelta en curso desde el {{ ciclo.fecha_inicio | date:'d MMM yyyy':'':'es' }}
                        }
                      } @else {
                        {{ t.estado_territorio }}
                      }
                    </p>
                  </div>
                  <button type="button" (click)="elegirTarjeta(null)" class="shrink-0 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">Ver todo</button>
                </div>
                @if (p?.ciclo && !p!.ciclo!.completado && p!.total_manzanas === 0) {
                  <button type="button" (click)="completarVuelta()" [disabled]="completandoCiclo()"
                    class="mt-3 w-full h-10 text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50">
                    Marcar vuelta completada
                  </button>
                }
                @if (noVisitar().length > 0) {
                  <details class="mt-3 group rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/15">
                    <summary class="flex items-center gap-2 px-3 py-2 cursor-pointer list-none text-sm font-semibold text-amber-900 dark:text-amber-200 select-none">
                      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      <span class="flex-1">{{ noVisitar().length === 1 ? '1 aviso' : noVisitar().length + ' avisos' }}</span>
                      <span class="text-xs font-semibold underline underline-offset-2 group-open:hidden">Ver</span>
                      <span class="text-xs font-semibold underline underline-offset-2 hidden group-open:inline">Ocultar</span>
                    </summary>
                    <ul class="px-3 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
                      @for (v of noVisitar(); track v.id_vivienda) {
                        <li class="text-sm text-slate-800 dark:text-slate-100 flex flex-wrap items-baseline gap-x-2">
                          <span class="shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-bold" [class]="chipAviso(v)">{{ etiquetaAviso(v) }}</span>
                          <span><span class="font-semibold">Manzana {{ v.numero_manzana || v.id_manzana }}:</span>
                          {{ textoDir(v) }}@if (v.motivo_no_visitar) { · {{ v.motivo_no_visitar }} }</span>
                        </li>
                      }
                    </ul>
                  </details>
                }
              </section>

              <!-- Historial de la tarjeta -->
              <section class="border-t border-slate-100 dark:border-slate-700/60 px-4 py-4" aria-labelledby="titulo-salidas">
                <h3 id="titulo-salidas" class="text-sm font-black text-slate-900 dark:text-white">
                  Salidas registradas
                  @if (salidas().length) { <span class="ml-1 font-semibold text-slate-400 tabular-nums">{{ salidas().length }}</span> }
                </h3>
                @if (salidasLoading()) {
                  <div class="mt-2 space-y-2">
                    @for (i of [1,2]; track i) { <div class="h-14 bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse"></div> }
                  </div>
                } @else if (salidas().length === 0) {
                  <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Todavía no hay salidas en esta tarjeta.</p>
                } @else {
                  <ul class="mt-2 -mx-2">
                    @for (s of salidas(); track s.id_salida) {
                      <li class="group/s rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        @if (confirmarEliminarId() === s.id_salida) {
                          <div class="flex items-center gap-2">
                            <span class="text-sm text-red-700 dark:text-red-400 font-semibold mr-auto">¿Eliminar la salida del {{ s.fecha_salida | date:'d MMM':'':'es' }}?</span>
                            <button type="button" (click)="confirmarEliminarId.set(null)" class="h-9 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">No</button>
                            <button type="button" (click)="confirmarEliminarSalida(s.id_salida)" class="h-9 px-3 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg">Sí, eliminar</button>
                          </div>
                        } @else {
                          <div class="flex items-center gap-3">
                            <span class="w-11 shrink-0 text-center rounded-lg py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100">
                              <span class="block text-base font-black leading-none tabular-nums">{{ s.fecha_salida | date:'d' }}</span>
                              <span class="block text-[11px] font-bold leading-tight mt-0.5 text-slate-500 dark:text-slate-400">{{ s.fecha_salida | date:'MMM':'':'es' }}</span>
                            </span>
                            <span class="min-w-0 flex-1">
                              <span class="block text-sm font-semibold text-slate-900 dark:text-white truncate">{{ s.nombre_capitan || 'Sin capitán' }}</span>
                              <span class="block text-xs text-slate-500 dark:text-slate-400 truncate">
                                {{ s.manzanas_predicadas === 1 ? '1 manzana' : s.manzanas_predicadas + ' manzanas' }}@if (s.nombre_punto_salida) { · {{ s.nombre_punto_salida }} }
                              </span>
                            </span>
                            <span class="flex items-center gap-0.5 sm:opacity-0 sm:group-hover/s:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                              <button type="button" (click)="openEditSalidaModal(s)" title="Editar salida" aria-label="Editar salida"
                                class="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button type="button" (click)="confirmarEliminarId.set(s.id_salida)" title="Eliminar salida" aria-label="Eliminar salida"
                                class="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                              </button>
                            </span>
                          </div>
                        }
                      </li>
                    }
                  </ul>
                }
              </section>
            }
          </div>
        </app-recorrido-mapa>
      </div>
    </div>

    <!-- Modal Nueva/Editar Salida -->
    @if (showSalidaModal()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" (click)="showSalidaModal.set(false)"></div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm relative z-10 shadow-2xl overflow-hidden">
          <div class="p-5 border-b border-gray-100 dark:border-gray-700/50">
            <h3 class="text-base font-bold text-gray-900 dark:text-white">
              Editar salida
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
  /** El mapa (toda la congregación o la tarjeta elegida). */
  mapaTarjeta = viewChild<RecorridoMapaComponent>('refMapa');
  private congregacionCtx = inject(CongregacionContextService);
  private authStore = inject(AuthStore);

  /** Fijar el orden del recorrido es tarea del encargado de territorios ('territorios.editar'); marcar basta con 'ver'. */
  puedeEditar = computed(() => {
    this.authStore.user();
    return this.authStore.hasPermission('territorios.editar');
  });

  /** Selector de arriba: cada tarjeta con su avance y su última salida (vacío = toda la congregación). */
  opcionesTarjeta = computed<PickerOption[]>(() => {
    const r = this.resumen();
    return this.territorios().map(t => {
      const f = r.get(t.id_territorio);
      const hint = !f?.ultima_salida ? 'Sin salidas' : [f.en_curso ? `${Math.round(f.porcentaje)} %` : null, this.textoDias(f.dias_sin_trabajar)].filter(Boolean).join(' · ');
      return { value: t.id_territorio, label: t.nombre?.trim() ? `${t.codigo} · ${t.nombre.trim()}` : t.codigo, hint };
    });
  });

  historialAbierto = signal(false);

  elegirTarjeta(id: number | null): void {
    const t = id == null ? null : this.territorios().find(x => x.id_territorio === id) ?? null;
    if (t) this.seleccionarTerritorio(t); else this.territorioSeleccionado.set(null);
  }

  /** Se marcó o quitó predicación desde el mapa: la lista y la tarjeta abierta se ponen al día. */
  alCambiarRecorrido(): void {
    this.loadResumen();
    const t = this.territorioSeleccionado();
    if (t) this.seleccionarTerritorio(t);
  }

  publicadores = signal<PublicadorOpcion[]>([]);
  publicadoresOrdenados = computed(() =>
    [...this.publicadores()].sort((a, b) => nombreMostrado(a).localeCompare(nombreMostrado(b), 'es'))
  );
  nombreDe = (p: PublicadorOpcion) => nombreMostrado(p);
  puntos = signal<Punto[]>([]);
  noVisitar = signal<ViviendaDeTerritorio[]>([]);
  textoDir = textoDireccion;
  etiquetaAviso = (v: ViviendaDeTerritorio) => tipoAviso(v.tipo_aviso)?.etiqueta ?? 'Aviso';
  chipAviso = (v: ViviendaDeTerritorio) => tipoAviso(v.tipo_aviso)?.chip ?? '';
  textoDias = textoDiasSinTrabajar;
  /** Última salida y % de la vuelta de cada territorio, para la lista. */
  resumen = signal<Map<number, ResumenTerritorio>>(new Map());
  puntosSalida = computed(() => this.puntos().filter(p => (p.tipo ?? 'Otro') === 'Salida'));
  opcionesCapitan = computed<PickerOption[]>(() =>
    this.publicadoresOrdenados().map(p => ({ value: p.id_publicador, label: this.nombreDe(p) })));
  opcionesPunto = computed<PickerOption[]>(() => {
    const base = this.puntosSalida().map(pt => ({ value: pt.id_punto, label: pt.nombre || 'Punto ' + pt.id_punto }));
    // El punto de la salida que se edita puede ser de otra tarjeta (el grupo se reunió en otra casa): igual se ofrece.
    const actual = this.puntoDeLaSalidaEditada();
    return actual && !base.some(o => o.value === actual.id) ? [...base, { value: actual.id, label: actual.nombre }] : base;
  });
  private puntoDeLaSalidaEditada = signal<{ id: number; nombre: string } | null>(null);

  territorios = signal<Territorio[]>([]);

  // Selección
  territorioSeleccionado = signal<Territorio | null>(null);
  salidas = signal<SalidaPredicacion[]>([]);
  progreso = signal<ProgresoTerritorio | null>(null);

  // Estados
  salidasLoading = signal(false);
  progresoLoading = signal(false);

  // Fix #2: confirmación inline de eliminación
  confirmarEliminarId = signal<number | null>(null);

  // Modal salida
  showSalidaModal = signal(false);
  editingSalidaId = signal<number | null>(null);
  editingSalida: Partial<SalidaPredicacion> = {};
  salidaSaving = signal(false);
  completandoCiclo = signal(false);

  ngOnInit(): void {
    this.territoriosService.getTerritorios(0, 500).subscribe({ next: (list) => this.territorios.set(list) });
    this.territoriosService.getPublicadores(this.congregacionCtx.effectiveCongregacionId())
      .subscribe({ next: (list) => this.publicadores.set(list) });
    this.loadResumen();
  }

  private loadResumen(): void {
    this.territoriosService.getResumen().subscribe({
      next: (filas) => this.resumen.set(new Map(filas.map(f => [f.id_territorio, f]))),
    });
  }

  seleccionarTerritorio(t: Territorio): void {
    this.territorioSeleccionado.set(t);
    this.progreso.set(null);
    this.confirmarEliminarId.set(null);
    this.puntos.set([]);
    this.noVisitar.set([]);
    this.territoriosService.getAvisos(t.id_territorio).subscribe({ next: (l) => this.noVisitar.set(l) });
    this.territoriosService.getPuntos(t.id_territorio).subscribe({ next: (l) => this.puntos.set(l) });
    this.loadSalidas(t.id_territorio);
    this.loadProgreso(t.id_territorio);
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

  completarVuelta(): void {
    const t = this.territorioSeleccionado();
    if (!t || this.completandoCiclo()) return;
    this.completandoCiclo.set(true);
    this.territoriosService.completarCiclo(t.id_territorio).subscribe({
      next: () => {
        this.completandoCiclo.set(false);
        this.loadProgreso(t.id_territorio);
        this.loadResumen();
      },
      error: () => this.completandoCiclo.set(false),
    });
  }

  openEditSalidaModal(s: SalidaPredicacion): void {
    this.editingSalida = {
      fecha_salida: s.fecha_salida,
      id_capitan: s.id_capitan ?? null,
      id_punto_salida: s.id_punto_salida ?? null,
      notas: s.notas ?? '',
    };
    this.puntoDeLaSalidaEditada.set(s.id_punto_salida != null
      ? { id: s.id_punto_salida, nombre: s.nombre_punto_salida || 'Punto ' + s.id_punto_salida } : null);
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
    if (!id) { this.salidaSaving.set(false); return; }
    this.territoriosService.updateSalida(t.id_territorio, id, cuerpo).subscribe({
      next: () => {
        this.salidaSaving.set(false);
        this.showSalidaModal.set(false);
        this.loadSalidas(t.id_territorio);
        this.loadProgreso(t.id_territorio);
        this.loadResumen();
        this.mapaTarjeta()?.recargarTodo(); // la fecha, el capitán o el borrado cambian el mapa, «Por registrar» y el programa
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
        this.loadSalidas(t.id_territorio);
        this.loadProgreso(t.id_territorio);
        this.loadResumen();
        this.mapaTarjeta()?.recargarTodo(); // la fecha, el capitán o el borrado cambian el mapa, «Por registrar» y el programa
      },
    });
  }


}

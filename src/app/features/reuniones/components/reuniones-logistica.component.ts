import {
  Component, signal, computed, inject, OnInit, effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogisticaService } from '../services/logistica.service';
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
          @if (mesDatos()) {
            <button
              (click)="descargarPdf()"
              [disabled]="descargandoPdf()"
              title="Descargar PDF"
              class="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm active:scale-95 md:hidden">
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
          }
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
        <aside class="hidden md:flex md:w-60 lg:w-64 xl:w-72 shrink-0 flex-col gap-3 overflow-y-auto simple-scrollbar py-0.5 pr-0.5">

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
                    class="flex-1 flex items-center justify-between px-2.5 h-8 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-40 group">
                    <span>{{ mesLabel(m) }}</span>
                    <svg class="w-3 h-3 text-slate-400 group-hover:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                  <button
                    (click)="descargarPdfMes(m)"
                    [disabled]="descargandoPdf()"
                    title="Descargar PDF"
                    class="shrink-0 w-7 h-7 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 hover:text-emerald-700 transition-all active:scale-95 flex items-center justify-center disabled:opacity-40">
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
            <div class="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Sin programación</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                  @if (hasEditPermission()) {
                    Selecciona un mes del historial o genera una nueva programación.
                  } @else {
                    No hay logística programada. Consulta con el secretario.
                  }
                </p>
              </div>
              @if (hasEditPermission()) {
                <button
                  (click)="abrirModalGenerar()"
                  class="flex items-center gap-2 px-4 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] text-xs font-bold text-white transition-all shadow-sm active:scale-95">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Generar primer mes
                </button>
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
                <!-- PDF -->
                <button
                  (click)="descargarPdf()"
                  [disabled]="descargandoPdf()"
                  title="Descargar PDF del mes"
                  class="flex items-center gap-1 px-2.5 h-8 rounded-full border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-[0.65rem] font-bold transition-all active:scale-95 disabled:opacity-40">
                  <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                  PDF
                </button>
              </div>
            </div>

            <!-- Contenido de tablas — scroll -->
            <div class="flex-1 overflow-y-auto simple-scrollbar p-3 md:p-4 flex flex-col gap-6">

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
                        <tr class="bg-[#2E5FA3] text-white">
                          <th class="px-3 py-2 text-left font-bold whitespace-nowrap">Fecha</th>
                          <th class="px-3 py-2 text-left font-bold whitespace-nowrap hidden sm:table-cell">Día</th>
                          @for (puesto of seccionPuestos(seccion); track puesto) {
                            <th class="px-3 py-2 text-left font-bold whitespace-nowrap">{{ puestoLabel(puesto) }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (fecha of mesDatos()!.fechas; track fecha.fecha; let i = $index) {
                          <tr [class]="i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-[#D6E4F7]/40 dark:bg-slate-800/40'">
                            <td class="px-3 py-1.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{{ formatFecha(fecha.fecha) }}</td>
                            <td class="px-3 py-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400 hidden sm:table-cell">{{ fecha.dia_semana }}</td>
                            @for (puesto of seccionPuestos(seccion); track puesto) {
                              <td class="px-2 py-1">
                                @if (!mesDatos()!.confirmado && hasEditPermission()) {
                                  <select
                                    [ngModel]="getAsignacion(fecha.fecha, puesto)?.publicador?.id_publicador ?? null"
                                    (ngModelChange)="onCambiarPublicador(fecha.fecha, puesto, $event)"
                                    class="w-full min-w-[120px] text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all">
                                    <option [ngValue]="null">— Sin asignar —</option>
                                    @for (c of getCandidatos(puesto); track c.id_publicador) {
                                      <option [ngValue]="c.id_publicador">{{ c.nombre_completo }}</option>
                                    }
                                  </select>
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
                <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="bg-[#2E5FA3] text-white">
                        <th class="px-3 py-2 text-left font-bold whitespace-nowrap">Fecha</th>
                        <th class="px-3 py-2 text-left font-bold whitespace-nowrap hidden sm:table-cell">Día</th>
                        <th class="px-3 py-2 text-left font-bold">Grupos</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (fecha of mesDatos()!.fechas; track fecha.fecha; let i = $index) {
                        <tr [class]="i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-[#D6E4F7]/40 dark:bg-slate-800/40'">
                          <td class="px-3 py-1.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">{{ formatFecha(fecha.fecha) }}</td>
                          <td class="px-3 py-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400 hidden sm:table-cell">{{ fecha.dia_semana }}</td>
                          <td class="px-2 py-1">
                            @if (!mesDatos()!.confirmado && hasEditPermission()) {
                              <!-- Multi-select para grupos -->
                              <div class="flex flex-wrap gap-1 items-center">
                                @for (g of gruposDisponibles(); track g.id_grupo) {
                                  <label class="flex items-center gap-1 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      [checked]="isGrupoAsignado(fecha.fecha, g.id_grupo)"
                                      (change)="onToggleGrupo(fecha, g.id_grupo, $any($event.target).checked)"
                                      class="rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-400 w-3.5 h-3.5">
                                    <span class="text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">{{ g.nombre_grupo }}</span>
                                  </label>
                                }
                              </div>
                            } @else {
                              <span class="text-slate-700 dark:text-slate-200">
                                {{ getAseoLabel(fecha.fecha) }}
                              </span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          }

        </div>
      </div>

    </div>

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
  `,
})
export class ReunionesLogisticaComponent implements OnInit {
  private logisticaSvc = inject(LogisticaService);
  private congregacionCtx = inject(CongregacionContextService);
  private authStore = inject(AuthStore);

  estado = signal<Estado>('idle');
  errorMsg = signal('');
  confirmadoBanner = signal(false);

  mesDatos = signal<LogisticaMesOut | null>(null);
  mesesDisponibles = signal<MesDisponible[]>([]);

  descargandoPdf = signal(false);

  // Candidatos cacheados por puesto
  private candidatosCache = signal<Record<string, PublicadorBase[]>>({});
  gruposDisponibles = signal<GrupoBase[]>([]);

  // Modal generar
  modalGenerarAbierto = signal(false);
  modalMes = new Date().getMonth() + 1;
  modalAno = new Date().getFullYear();

  readonly seccionesKeys = Object.keys(SECCION_PUESTOS);

  readonly mesesOpciones = MESES_ES.map((label, i) => ({ value: i + 1, label }));

  hasEditPermission(): boolean {
    return (
      this.authStore.hasPermission('reuniones.entre_semana_editar') ||
      this.authStore.hasPermission('reuniones.fin_semana_editar') ||
      this.authStore.user()?.roles?.includes('Secretario') === true
    );
  }

  ngOnInit(): void {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    this.cargarMeses(cong);
    this.cargarGrupos(cong);
    this.precargarCandidatos(cong);
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
    for (const puesto of uniquePuestos) {
      this.logisticaSvc.getCandidatos(puesto, cong).subscribe({
        next: (candidates) => {
          this.candidatosCache.update((c) => ({ ...c, [puesto]: candidates }));
        },
        error: () => {},
      });
    }
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
    if (!confirm(`¿Eliminar toda la programación de logística de ${datos.mes}/${datos.ano}? Esta acción no se puede deshacer.`)) return;
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
  }

  // ── Acceso a datos ────────────────────────────────────────────

  seccionPuestos(seccion: string): string[] {
    return SECCION_PUESTOS[seccion] ?? [];
  }

  puestoLabel(puesto: string): string {
    return PUESTOS_LABEL[puesto] ?? puesto;
  }

  getAsignacion(fecha: string, puesto: string): LogisticaItemOut | undefined {
    return this.mesDatos()?.asignaciones.find(
      (a) => a.fecha === fecha && a.puesto === puesto
    );
  }

  getCandidatos(puesto: string): PublicadorBase[] {
    return this.candidatosCache()[puesto] ?? [];
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

    // Verificar conflicto con la programación del día
    this.logisticaSvc.verificarConflicto(idPublicador, fecha).subscribe({
      next: (conflicto) => {
        if (conflicto.tiene_conflicto) {
          const partes = conflicto.partes.map(p => `"${p.nombre_parte}"`).join(', ');
          const nombre = this.candidatosCache()[puesto]?.find(c => c.id_publicador === idPublicador)?.nombre_completo ?? 'Esta persona';
          const msg = `⚠ ${nombre} ya tiene la parte ${partes} asignada en la reunión de ese día.\n\n¿Deseas asignarlo igualmente?`;
          if (!confirm(msg)) {
            // Revertir el select al publicador anterior
            this.mesDatos.update((d) => d ? { ...d } : d);
            return;
          }
        }
        guardar();
      },
      error: () => guardar(), // Si falla la verificación, guardar de todas formas
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

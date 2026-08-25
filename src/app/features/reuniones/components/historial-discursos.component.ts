import {
  Component, EventEmitter, HostListener, Input, OnInit, Output, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { DiscursosService } from '../services/discursos.service';
import {
  HistorialDiscursoEntrante,
  HistorialEntrantesOut,
  HistorialOradorSaliente,
  HistorialSalientesOut,
} from '../models/discursos.models';

type SubTab = 'entrantes' | 'salientes';

/**
 * Modal de historial: agrupa los discursos entrantes y salientes ya
 * registrados en el rango de fechas elegido, para ver qué se ha repetido
 * (entrantes) y cuánto ha dado cada orador (salientes).
 *
 * Vive en su propio archivo porque el componente padre ya pasa las 1900
 * líneas; este modal no depende de su estado, solo de `idCong` y un rango.
 */
@Component({
  selector: 'app-historial-discursos',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" (click)="cerrar.emit()">
      <div class="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl sm:max-h-[85vh] flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden" (click)="$event.stopPropagation()">

        <!-- Handle bar (móvil) -->
        <div class="flex justify-center pt-3 pb-1 sm:hidden">
          <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
        </div>

        <!-- Header -->
        <div class="shrink-0 px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-black text-slate-900 dark:text-white">Historial de discursos</h2>
            <button (click)="cerrar.emit()"
              class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-150 ease-out active:scale-[0.95]">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

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
            <button (click)="subTab.set('entrantes')" role="tab" [attr.aria-selected]="subTab() === 'entrantes'"
              class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-[background-color,color] duration-150 ease-out active:scale-[0.97]"
              [class]="subTab() === 'entrantes' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
              Entrantes
              @if (historialEntrantes()) {
                <span class="min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[0.6rem] font-bold flex items-center justify-center"
                  [class]="subTab() === 'entrantes' ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'">{{ historialEntrantes()!.items.length }}</span>
              }
            </button>
            <button (click)="subTab.set('salientes')" role="tab" [attr.aria-selected]="subTab() === 'salientes'"
              class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-[background-color,color] duration-150 ease-out active:scale-[0.97]"
              [class]="subTab() === 'salientes' ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
              Salientes
              @if (historialSalientes()) {
                <span class="min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[0.6rem] font-bold flex items-center justify-center"
                  [class]="subTab() === 'salientes' ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'">{{ historialSalientes()!.items.length }}</span>
              }
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar p-4 sm:p-5">

          @if (cargando()) {
            <div class="flex items-center justify-center py-16">
              <div class="w-7 h-7 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-blue-500 animate-spin"></div>
            </div>
          } @else if (error()) {
            <div class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-red-600 dark:text-red-400 text-xs font-medium">
              {{ error() }}
            </div>
          } @else if (subTab() === 'entrantes') {

            @if (historialEntrantes(); as h) {
              <!-- Resumen + filtros -->
              <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-4">
                <p class="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                  {{ h.total_discursos }} discurso{{ h.total_discursos === 1 ? '' : 's' }} ·
                  <span class="text-amber-600 dark:text-amber-400">{{ h.total_repetidos }} repetido{{ h.total_repetidos === 1 ? '' : 's' }}</span>
                </p>
                <div class="flex-1 flex items-center gap-2">
                  <input type="text" [(ngModel)]="filtroEntrantes" [ngModelOptions]="{ standalone: true }"
                    placeholder="Filtrar por título o número…"
                    class="h-9 px-3 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors">
                  <button type="button" (click)="soloRepetidos.set(!soloRepetidos())"
                    class="shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-lg border text-[0.7rem] font-bold transition-colors active:scale-95"
                    [class]="soloRepetidos()
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-amber-300'">
                    Solo repetidos
                  </button>
                </div>
              </div>

              @if (entrantesFiltrados().length === 0) {
                <div class="flex flex-col items-center justify-center py-14 text-center gap-2">
                  <p class="text-sm font-bold text-slate-500 dark:text-slate-400">Sin resultados</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500">Ningún discurso entrante en este rango con ese filtro.</p>
                </div>
              }

              <div class="flex flex-col gap-2">
                @for (item of entrantesFiltrados(); track (item.numero ?? -1) + '|' + item.titulo) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button type="button" (click)="toggle('e|' + (item.numero ?? -1) + '|' + item.titulo)"
                      class="w-full flex items-center gap-3 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left">
                      @if (item.numero != null) {
                        <span class="shrink-0 min-w-[1.75rem] h-6 px-1.5 rounded-full bg-blue-50 dark:bg-blue-900/25 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400 text-[0.65rem] font-black flex items-center justify-center">{{ item.numero }}</span>
                      }
                      <span class="flex-1 min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ item.titulo }}</span>
                      @if (item.veces > 1) {
                        <span class="shrink-0 px-2 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[0.65rem] font-black flex items-center justify-center">×{{ item.veces }}</span>
                      }
                      <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform" [class.rotate-90]="expandido('e|' + (item.numero ?? -1) + '|' + item.titulo)"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                    @if (expandido('e|' + (item.numero ?? -1) + '|' + item.titulo)) {
                      <div class="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                        @for (o of item.ocurrencias; track o.fecha + '|' + (o.nombre_orador ?? '')) {
                          <div class="flex items-center gap-2.5 px-3.5 py-2 bg-slate-50/60 dark:bg-slate-800/30">
                            <span class="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 w-24">{{ formatFecha(o.fecha) }}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-0 truncate">
                              {{ o.nombre_orador || 'Sin orador' }}@if (o.congregacion_origen) {<span> · {{ o.congregacion_origen }}</span>}
                            </span>
                            @if (o.presentado) {
                              <svg class="w-3.5 h-3.5 shrink-0 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" title="Presentado"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

          } @else {

            @if (historialSalientes(); as h) {
              <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-4">
                <p class="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                  {{ h.total_discursos }} discurso{{ h.total_discursos === 1 ? '' : 's' }} · {{ h.items.length }} orador{{ h.items.length === 1 ? '' : 'es' }}
                </p>
                <input type="text" [(ngModel)]="filtroSalientes" [ngModelOptions]="{ standalone: true }"
                  placeholder="Filtrar por orador…"
                  class="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 transition-colors">
              </div>

              @if (salientesFiltrados().length === 0) {
                <div class="flex flex-col items-center justify-center py-14 text-center gap-2">
                  <p class="text-sm font-bold text-slate-500 dark:text-slate-400">Sin resultados</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500">Ningún discurso saliente en este rango con ese filtro.</p>
                </div>
              }

              <div class="flex flex-col gap-2">
                @for (orador of salientesFiltrados(); track orador.id_publicador ?? -1) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button type="button" (click)="toggle('s|' + (orador.id_publicador ?? -1))"
                      class="w-full flex items-center gap-3 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left">
                      <span class="flex-1 min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ orador.nombre_completo }}</span>
                      <span class="shrink-0 px-2 h-6 rounded-full bg-violet-50 dark:bg-violet-900/25 text-violet-700 dark:text-violet-400 text-[0.65rem] font-black flex items-center justify-center">{{ orador.total }} discurso{{ orador.total === 1 ? '' : 's' }}</span>
                      <span class="hidden sm:flex shrink-0 text-[0.65rem] text-slate-400">{{ orador.temas_distintos }} tema{{ orador.temas_distintos === 1 ? '' : 's' }} distinto{{ orador.temas_distintos === 1 ? '' : 's' }}</span>
                      <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform" [class.rotate-90]="expandido('s|' + (orador.id_publicador ?? -1))"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                    @if (expandido('s|' + (orador.id_publicador ?? -1))) {
                      <div class="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                        @for (t of orador.temas; track (t.numero ?? -1) + '|' + t.titulo) {
                          <div class="px-3.5 py-2 bg-slate-50/60 dark:bg-slate-800/30">
                            <div class="flex items-center gap-2">
                              @if (t.numero != null) {
                                <span class="shrink-0 min-w-[1.5rem] h-5 px-1 rounded-full bg-violet-50 dark:bg-violet-900/25 border border-violet-200 dark:border-violet-800/50 text-violet-700 dark:text-violet-400 text-[0.6rem] font-black flex items-center justify-center">{{ t.numero }}</span>
                              }
                              <span class="flex-1 min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{{ t.titulo }}</span>
                              @if (t.veces > 1) {
                                <span class="shrink-0 text-[0.6rem] font-black text-amber-600 dark:text-amber-400">×{{ t.veces }}</span>
                              }
                            </div>
                            <div class="mt-1 flex flex-col gap-0.5 pl-1">
                              @for (o of t.ocurrencias; track o.fecha) {
                                <span class="text-[0.65rem] text-slate-400 dark:text-slate-500">
                                  {{ formatFecha(o.fecha) }}@if (o.congregacion_destino) {<span> · {{ o.congregacion_destino }}</span>}
                                </span>
                              }
                            </div>
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
  `,
})
export class HistorialDiscursosComponent implements OnInit {
  @Input() idCong: number | null = null;
  @Input() desdeInicial: string | null = null;
  @Input() hastaInicial: string | null = null;
  @Output() cerrar = new EventEmitter<void>();

  constructor(private svc: DiscursosService) {}

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cerrar.emit();
  }

  subTab = signal<SubTab>('entrantes');
  cargando = signal(false);
  error = signal('');

  rangoDesde: string | null = null;
  rangoHasta: string | null = null;

  historialEntrantes = signal<HistorialEntrantesOut | null>(null);
  historialSalientes = signal<HistorialSalientesOut | null>(null);

  filtroEntrantes = signal('');
  filtroSalientes = signal('');
  soloRepetidos = signal(false);
  private expandidos = signal<Set<string>>(new Set());

  entrantesFiltrados = computed<HistorialDiscursoEntrante[]>(() => {
    const h = this.historialEntrantes();
    if (!h) return [];
    const q = this.filtroEntrantes().trim().toLowerCase();
    return h.items.filter(it => {
      if (this.soloRepetidos() && it.veces <= 1) return false;
      if (!q) return true;
      return it.titulo.toLowerCase().includes(q) || String(it.numero ?? '').includes(q);
    });
  });

  salientesFiltrados = computed<HistorialOradorSaliente[]>(() => {
    const h = this.historialSalientes();
    if (!h) return [];
    const q = this.filtroSalientes().trim().toLowerCase();
    if (!q) return h.items;
    return h.items.filter(o => o.nombre_completo.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.rangoDesde = this.desdeInicial;
    this.rangoHasta = this.hastaInicial;
    this.cargar();
  }

  toggle(key: string): void {
    const s = new Set(this.expandidos());
    s.has(key) ? s.delete(key) : s.add(key);
    this.expandidos.set(s);
  }

  expandido(key: string): boolean {
    return this.expandidos().has(key);
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    let pendientes = 2;
    const listo = () => {
      pendientes -= 1;
      if (pendientes === 0) this.cargando.set(false);
    };
    this.svc.getHistorialEntrantes(this.idCong, this.rangoDesde, this.rangoHasta).subscribe({
      next: (h) => { this.historialEntrantes.set(h); listo(); },
      error: () => { this.error.set('No se pudo cargar el historial de entrantes.'); listo(); },
    });
    this.svc.getHistorialSalientes(this.idCong, this.rangoDesde, this.rangoHasta).subscribe({
      next: (h) => { this.historialSalientes.set(h); listo(); },
      error: () => { this.error.set('No se pudo cargar el historial de salientes.'); listo(); },
    });
  }

  formatFecha(fechaStr: string): string {
    const d = new Date(fechaStr + 'T00:00:00');
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
  }
}

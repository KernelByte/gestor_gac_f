import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerritoriosService } from '../services/territorios.service';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
import { HistorialEntrada, HistorialRespuesta } from '../models/territorio.model';
import { horaLegible } from '../services/salidas-programa.service';
import { fechaIsoLocal } from '../../../core/utils/fecha.util';
import { textoManzanas } from '../utils/rangos-manzanas.util';

type Periodo = 'tres' | 'anio' | 'todo';

interface EntradaVista {
  e: HistorialEntrada;
  /** Posición en la lista: escalona la entrada de las primeras. */
  indice: number;
  total: number;
  tarjetas: Array<{ codigo: string; completas: string; medias: Array<{ numero: string; nota: string | null }> }>;
}

interface MesVista { clave: string; titulo: string; entradas: EntradaVista[]; }

const PASO = 150;

/**
 * Historial de predicación: todo lo registrado, de lo más reciente a lo más antiguo, con filtros por
 * periodo, tarjeta y capitán. Va en un panel que se desliza desde la derecha (en el teléfono ocupa toda la pantalla).
 */
@Component({
  selector: 'app-historial-predicacion',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SelectPickerComponent],
  template: `
    <div class="fixed inset-0 z-[1100] flex justify-end">
      <div class="velo absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" (click)="cerrar.emit()"></div>

      <section class="cajon relative w-full sm:max-w-2xl h-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-labelledby="hist-titulo">
        <header class="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div class="min-w-0">
            <h2 id="hist-titulo" class="text-xl font-black text-slate-900 dark:text-white leading-tight">Historial de predicación</h2>
            <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Todo lo que se registró, de lo más reciente a lo más antiguo.</p>
          </div>
          <button #cerrarBtn type="button" (click)="cerrar.emit()" class="shrink-0 w-11 h-11 -mr-2 -mt-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Cerrar el historial">
            <svg class="mx-auto w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </header>

        <!-- Filtros: el periodo siempre a la vista; tarjeta y capitán, uno al lado del otro -->
        <div class="shrink-0 px-5 pb-4 space-y-3 border-b border-slate-100 dark:border-slate-700/60">
          <div class="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/50" role="radiogroup" aria-label="Periodo">
            @for (p of periodos; track p.id) {
              <button type="button" role="radio" [attr.aria-checked]="periodo() === p.id" (click)="cambiarPeriodo(p.id)"
                class="h-10 rounded-lg text-[13px] font-bold transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                [class]="periodo() === p.id ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'">{{ p.titulo }}</button>
            }
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <app-select-picker colorScheme="emerald" ariaLabel="Tarjeta" [ngModel]="tarjeta()" (ngModelChange)="cambiarTarjeta($event)"
              [options]="tarjetas" placeholder="Todas las tarjetas" [searchable]="true" />
            <app-select-picker colorScheme="emerald" ariaLabel="Capitán" [ngModel]="capitan()" (ngModelChange)="cambiarCapitan($event)"
              [options]="capitanes" placeholder="Todos los capitanes" [searchable]="true" />
          </div>
        </div>

        <!-- Resumen de lo que se está viendo -->
        @if (datos(); as d) {
          <p class="shrink-0 px-5 py-2.5 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700/60" aria-live="polite">
            <b class="text-slate-900 dark:text-white tabular-nums">{{ d.resumen.salidas }}</b> {{ d.resumen.salidas === 1 ? 'salida' : 'salidas' }}
            · <b class="text-slate-900 dark:text-white tabular-nums">{{ d.resumen.manzanas }}</b> {{ d.resumen.manzanas === 1 ? 'manzana' : 'manzanas' }}
            @if (d.resumen.a_medias) { · <span class="text-amber-700 dark:text-amber-300 font-semibold tabular-nums">{{ d.resumen.a_medias }} a medias</span> }
            @if (d.resumen.no_salio) { · <span class="tabular-nums">{{ d.resumen.no_salio }} no {{ d.resumen.no_salio === 1 ? 'se hizo' : 'se hicieron' }}</span> }
          </p>
        }

        <div class="flex-1 min-h-0 overflow-y-auto scroll-fino" #lista>
          @if (error()) {
            <div class="m-5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/15 p-4" role="alert">
              <p class="text-sm font-semibold text-red-800 dark:text-red-200">No se pudo cargar el historial.</p>
              <button type="button" (click)="cargar()" class="mt-2 h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Intentar de nuevo</button>
            </div>
          } @else if (cargando() && !datos()) {
            <div class="p-5 space-y-3" aria-busy="true">
              @for (i of [1,2,3,4]; track i) { <div class="h-20 rounded-2xl bg-slate-100 dark:bg-slate-700/50 animate-pulse"></div> }
            </div>
          } @else if (!meses().length) {
            <div class="px-8 py-14 text-center">
              <div class="mx-auto w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/60 text-slate-400 flex items-center justify-center">
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
              </div>
              <p class="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">No hay salidas registradas aquí</p>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                @if (hayFiltros()) { Pruebe con otro periodo, otra tarjeta u otro capitán. }
                @else { Cuando registre la predicación de una salida, aparecerá en esta lista. }
              </p>
              @if (hayFiltros()) {
                <button type="button" (click)="limpiar()" class="mt-4 h-11 px-5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">Ver todo el historial</button>
              }
            </div>
          } @else {
            <div [class.opacity-60]="cargando()" class="transition-opacity duration-150">
              @for (m of meses(); track m.clave) {
                <h3 class="sticky top-0 z-10 px-5 py-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur border-b border-slate-100 dark:border-slate-700/60">{{ m.titulo }}</h3>
                <ul class="px-3 py-1">
                  @for (v of m.entradas; track v.e.clave) {
                    <li class="entrada flex gap-3.5 px-2 py-3.5 rounded-xl border-b border-slate-100 dark:border-slate-700/40 last:border-b-0"
                        [style.animation-delay.ms]="v.indice < 12 ? v.indice * 24 : 0">
                      <span class="w-12 shrink-0 text-center rounded-xl py-1.5 self-start"
                            [class]="v.e.tipo === 'salida' ? 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-800 dark:text-emerald-200' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'">
                        <span class="block text-lg font-black leading-none tabular-nums">{{ v.e.fecha | date:'d':'':'es' }}</span>
                        <span class="block text-[11px] font-bold leading-tight mt-0.5 opacity-80">{{ v.e.fecha | date:'MMM':'':'es' }}</span>
                      </span>

                      <div class="min-w-0 flex-1">
                        <p class="flex flex-wrap items-baseline gap-x-2">
                          <span class="text-[15px] font-bold text-slate-900 dark:text-white"><span class="capitalize">{{ v.e.fecha | date:'EEEE':'':'es' }}</span>@if (v.e.hora) { · {{ hora(v.e.hora) }} }</span>
                          @if (v.e.tipo === 'no_salio') { <span class="text-sm font-semibold text-slate-500 dark:text-slate-400">No se salió</span> }
                        </p>
                        <p class="text-[13px] text-slate-500 dark:text-slate-400 leading-snug">
                          {{ v.e.lugar || 'Sin lugar' }}@if (v.e.capitan) { · con {{ v.e.capitan }} } @else if (v.e.tipo === 'salida') { · sin capitán anotado }
                        </p>

                        @if (v.tarjetas.length) {
                          <ul class="mt-2 space-y-1.5">
                            @for (t of v.tarjetas; track t.codigo) {
                              <li class="flex items-baseline gap-2 text-sm">
                                <span class="shrink-0 min-w-[2.75rem] text-center rounded-md px-1.5 py-0.5 text-xs font-black tabular-nums bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">{{ t.codigo }}</span>
                                <span class="min-w-0 text-slate-700 dark:text-slate-200 leading-snug">
                                  @if (t.completas) { {{ t.completas }} }
                                  @for (md of t.medias; track md.numero) {
                                    <span class="block text-amber-800 dark:text-amber-300"><b>Manzana {{ md.numero }}</b> a medias@if (md.nota) { · Faltó: {{ md.nota }} }</span>
                                  }
                                </span>
                              </li>
                            }
                          </ul>
                        }
                      </div>

                      @if (v.e.tipo === 'salida') {
                        <p class="shrink-0 text-right self-start leading-none">
                          <span class="block text-xl font-black tabular-nums text-slate-900 dark:text-white">{{ v.total }}</span>
                          <span class="block mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{{ v.total === 1 ? 'manzana' : 'manzanas' }}</span>
                        </p>
                      }
                    </li>
                  }
                </ul>
              }
              @if (datos()?.hay_mas) {
                <div class="px-5 py-5">
                  <button type="button" (click)="verMas()" [disabled]="cargando()" class="w-full h-12 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">
                    {{ cargando() ? 'Cargando…' : 'Ver salidas más antiguas' }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .cajon { animation: hist-cajon 260ms cubic-bezier(0.32, 0.72, 0, 1); }
    .velo { animation: hist-velo 200ms ease-out; }
    .entrada { animation: hist-entra 260ms cubic-bezier(0.23, 1, 0.32, 1) both; transition: background-color 120ms ease-out; }
    .entrada:hover { background: rgb(248 250 252 / 0.8); }
    :host-context(.dark) .entrada:hover { background: rgb(51 65 85 / 0.25); }
    .scroll-fino { scrollbar-width: thin; scrollbar-color: rgb(203 213 225) transparent; }
    @keyframes hist-cajon { from { transform: translateX(100%); } }
    @keyframes hist-velo { from { opacity: 0; } }
    @keyframes hist-entra { from { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .cajon, .velo, .entrada { animation: none; } }
  `],
})
export class HistorialPredicacionComponent implements OnInit, AfterViewInit {
  private svc = inject(TerritoriosService);

  /** Opciones de los filtros (las de la página). */
  @Input() tarjetas: PickerOption[] = [];
  @Input() capitanes: PickerOption[] = [];
  /** Si se abre desde una tarjeta, el historial empieza filtrado por ella y sin límite de fechas. */
  @Input() tarjetaInicial: number | null = null;
  @Output() cerrar = new EventEmitter<void>();

  @ViewChild('cerrarBtn') cerrarBtn?: ElementRef<HTMLButtonElement>;

  readonly hora = horaLegible;
  readonly periodos: Array<{ id: Periodo; titulo: string }> = [
    { id: 'tres', titulo: 'Últimos 3 meses' },
    { id: 'anio', titulo: 'Año de servicio' },
    { id: 'todo', titulo: 'Todo' },
  ];

  periodo = signal<Periodo>('tres');
  tarjeta = signal<number | null>(null);
  capitan = signal<number | null>(null);
  private limite = signal(PASO);

  datos = signal<HistorialRespuesta | null>(null);
  cargando = signal(false);
  error = signal(false);
  /** Descarta la respuesta de una petición vieja si el filtro cambió mientras llegaba. */
  private pedido = 0;

  hayFiltros = computed(() => this.periodo() !== 'todo' || this.tarjeta() !== null || this.capitan() !== null);

  meses = computed<MesVista[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const por = new Map<string, MesVista>();
    d.entradas.forEach((e, indice) => {
      const clave = e.fecha.slice(0, 7);
      let m = por.get(clave);
      if (!m) {
        const [y, mes] = clave.split('-').map(Number);
        const t = new Date(y, mes - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
        m = { clave, titulo: t.charAt(0).toUpperCase() + t.slice(1), entradas: [] };
        por.set(clave, m);
      }
      m.entradas.push({
        e, indice, total: e.completas + e.a_medias,
        tarjetas: e.tarjetas.map(t => ({
          codigo: t.codigo,
          completas: t.manzanas.some(x => !x.a_medias) ? textoManzanas(t.manzanas.filter(x => !x.a_medias).map(x => x.numero)) : '',
          medias: t.manzanas.filter(x => x.a_medias).map(x => ({ numero: x.numero, nota: x.nota })),
        })),
      });
    });
    return [...por.values()];
  });

  ngOnInit(): void {
    if (this.tarjetaInicial != null) { this.tarjeta.set(this.tarjetaInicial); this.periodo.set('todo'); }
    this.cargar();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.cerrarBtn?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  alEscape(): void { this.cerrar.emit(); }

  private rango(): { desde: string | null; hasta: string | null } {
    const hoy = new Date();
    if (this.periodo() === 'tres') {
      return { desde: fechaIsoLocal(new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate())), hasta: null };
    }
    if (this.periodo() === 'anio') {
      // El año de servicio empieza en septiembre.
      const y = hoy.getMonth() >= 8 ? hoy.getFullYear() : hoy.getFullYear() - 1;
      return { desde: `${y}-09-01`, hasta: null };
    }
    return { desde: null, hasta: null };
  }

  cargar(): void {
    const n = ++this.pedido;
    this.cargando.set(true);
    this.error.set(false);
    const { desde, hasta } = this.rango();
    this.svc.getHistorial({ desde, hasta, id_territorio: this.tarjeta(), id_capitan: this.capitan(), limite: this.limite() }).subscribe({
      next: (r) => { if (n !== this.pedido) return; this.datos.set(r); this.cargando.set(false); },
      error: () => { if (n !== this.pedido) return; this.cargando.set(false); this.error.set(true); },
    });
  }

  cambiarPeriodo(p: Periodo): void { if (this.periodo() === p) return; this.periodo.set(p); this.limite.set(PASO); this.cargar(); }
  cambiarTarjeta(id: number | null): void { this.tarjeta.set(id ?? null); this.limite.set(PASO); this.cargar(); }
  cambiarCapitan(id: number | null): void { this.capitan.set(id ?? null); this.limite.set(PASO); this.cargar(); }
  limpiar(): void { this.periodo.set('todo'); this.tarjeta.set(null); this.capitan.set(null); this.limite.set(PASO); this.cargar(); }
  verMas(): void { this.limite.update(l => l + PASO); this.cargar(); }
}

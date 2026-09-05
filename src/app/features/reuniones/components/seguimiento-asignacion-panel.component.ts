import {
  Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReunionesService } from '../services/reuniones.service';
import {
  AsistenciaSeguimiento, NivelTiempo, Seguimiento,
} from '../models/reuniones.models';
import {
  etiquetaNivel, formatFecha, formatSegundos, nivelDeTiempo, parseTiempo,
} from './seguimiento-tiempo.util';

/** Lo mínimo que el panel necesita saber de la asignación sobre la que escribe.
 *  Es un subconjunto de `AsignacionDraft` y de `SeguimientoOcurrencia`, para que
 *  lo puedan abrir tanto la fila del programa como el modal de historial sin
 *  que ninguno tenga que fabricarse el otro tipo. */
export interface SeguimientoObjetivo {
  id_asignacion: number;
  nombre_completo?: string | null;
  nombre_parte?: string | null;
  papel?: string | null;
  fecha?: string | null;
  duracion_minutos?: number | null;
  seguimiento?: Seguimiento | null;
}

/**
 * Lo que el consejero apunta sobre UNA asignación ya celebrada: si la persona
 * cumplió, cuánto se echó y las observaciones.
 *
 * El cronómetro no guarda solo al parar. Se detiene, deja el tiempo en el campo
 * y espera: quien cronometra desde la plataforma puede haber arrancado tarde o
 * haberse pasado un par de segundos al cortar, y el número tiene que poder
 * corregirse antes de quedar escrito.
 */
@Component({
  selector: 'app-seguimiento-asignacion-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
      (click)="cerrar.emit()">
      <div role="dialog" aria-modal="true" aria-labelledby="seg-panel-titulo"
        class="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:max-h-[88vh] flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden"
        (click)="$event.stopPropagation()">

        <div class="flex justify-center pt-3 pb-1 sm:hidden">
          <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
        </div>

        <!-- Cabecera: de quién y de qué parte se está hablando -->
        <div class="shrink-0 px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 id="seg-panel-titulo" class="text-base font-black text-slate-900 dark:text-white truncate">
              {{ objetivo.nombre_completo || 'Sin asignar' }}
            </h2>
            <p class="text-[0.7rem] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {{ objetivo.nombre_parte || 'Parte de reunión' }}@if (objetivo.papel) {<span> · {{ objetivo.papel }}</span>}@if (objetivo.fecha) {<span> · {{ formatFecha(objetivo.fecha) }}</span>}
            </p>
          </div>
          <button type="button" (click)="cerrar.emit()" aria-label="Cerrar"
            class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-5">

          <!-- ── TIEMPO ── -->
          <fieldset class="flex flex-col gap-2.5">
            <legend class="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Tiempo
              @if (objetivo.duracion_minutos) {
                <span class="normal-case tracking-normal font-medium text-slate-400"> · previsto {{ objetivo.duracion_minutos }} min</span>
              }
            </legend>

            <div class="flex items-center gap-3">
              <!-- Cronómetro. Redondo y grande: se pulsa desde la plataforma,
                   a veces sin mirar. -->
              <button type="button" (click)="toggleCrono()"
                [attr.aria-label]="corriendo() ? 'Detener el cronómetro' : 'Iniciar el cronómetro'"
                class="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95"
                [class]="corriendo()
                  ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'">
                @if (corriendo()) {
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                } @else {
                  <svg class="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.54.84l11.5-7.5a1 1 0 0 0 0-1.68L8.54 3.66A1 1 0 0 0 7 4.5z"/></svg>
                }
              </button>

              <div class="flex-1 min-w-0">
                <label for="seg-tiempo" class="sr-only">Tiempo real en minutos y segundos</label>
                <input id="seg-tiempo" type="text" inputmode="numeric" [(ngModel)]="tiempoTexto"
                  (ngModelChange)="onTiempoTextoChange()" placeholder="mm:ss"
                  [class.tabular-nums]="true"
                  class="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-lg font-black text-slate-800 dark:text-slate-100 tracking-wide placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors">
              </div>

              @if (nivel(); as n) {
                <span class="shrink-0 px-2.5 h-7 rounded-full text-[0.65rem] font-black flex items-center whitespace-nowrap"
                  [class]="n === 'pasado'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    : n === 'corto'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'">
                  {{ etiquetaNivel(n) }}
                </span>
              }
            </div>
          </fieldset>

          <!-- ── ASISTENCIA ── -->
          <fieldset class="flex flex-col gap-2">
            <legend class="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">¿Cumplió?</legend>
            <div class="flex items-center gap-1.5 flex-wrap">
              @for (op of ASISTENCIAS; track op.valor) {
                <button type="button" (click)="toggleAsistencia(op.valor)"
                  [attr.aria-pressed]="asistio() === op.valor"
                  class="px-3 h-9 rounded-xl text-xs font-bold border transition-colors active:scale-95"
                  [class]="asistio() === op.valor
                    ? op.clase
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'">
                  {{ op.label }}
                </button>
              }
            </div>
          </fieldset>

          <!-- ── NOTAS ── -->
          <div class="flex flex-col gap-2">
            <label for="seg-notas" class="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Observaciones</label>
            <textarea id="seg-notas" rows="4" [(ngModel)]="notas"
              placeholder="Qué se le dijo, en qué quedó, qué mirar la próxima vez…"
              class="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors resize-y"></textarea>
          </div>

          @if (error()) {
            <div role="alert" class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-red-600 dark:text-red-400 text-xs font-medium">
              {{ error() }}
            </div>
          }
        </div>

        <!-- Pie -->
        <div class="shrink-0 px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          @if (objetivo.seguimiento) {
            <button type="button" (click)="borrar()" [disabled]="guardando()"
              class="px-3 h-10 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors active:scale-95 disabled:opacity-40">
              Borrar
            </button>
          }
          <span class="flex-1"></span>
          <button type="button" (click)="cerrar.emit()" [disabled]="guardando()"
            class="px-4 h-10 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 disabled:opacity-40">
            Cancelar
          </button>
          <button type="button" (click)="guardar()" [disabled]="guardando()"
            class="px-5 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-lg shadow-blue-500/20 transition-colors active:scale-95 disabled:opacity-50 flex items-center gap-2">
            @if (guardando()) {
              <span class="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
            }
            Guardar
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SeguimientoAsignacionPanelComponent implements OnInit, OnDestroy {
  @Input({ required: true }) objetivo!: SeguimientoObjetivo;
  @Input({ required: true }) idCong!: number;
  @Output() cerrar = new EventEmitter<void>();
  /** El seguimiento guardado, o `null` si se acaba de borrar. El padre lo usa
   *  para refrescar la fila sin volver a pedir el mes entero. */
  @Output() guardado = new EventEmitter<Seguimiento | null>();

  constructor(private svc: ReunionesService) {}

  readonly ASISTENCIAS: { valor: AsistenciaSeguimiento; label: string; clase: string }[] = [
    { valor: 'si', label: 'Sí', clase: 'bg-emerald-600 border-emerald-600 text-white' },
    { valor: 'no', label: 'No vino', clase: 'bg-red-500 border-red-500 text-white' },
    { valor: 'sustituido', label: 'Lo sustituyeron', clase: 'bg-amber-500 border-amber-500 text-white' },
  ];

  guardando = signal(false);
  error = signal('');

  asistio = signal<AsistenciaSeguimiento | null>(null);
  notas = '';

  tiempoTexto = '';
  private segundos = signal<number | null>(null);

  corriendo = signal(false);
  private intervalo: ReturnType<typeof setInterval> | null = null;
  private arranque = 0;
  /** Lo que ya había medido antes de esta pulsación: permite parar, mirar y
   *  seguir sumando sin perder lo anterior. */
  private acumulado = 0;

  nivel = computed<NivelTiempo | null>(() =>
    nivelDeTiempo(this.segundos(), this.objetivo?.duracion_minutos)
  );

  ngOnInit(): void {
    const s = this.objetivo.seguimiento;
    if (!s) return;
    this.asistio.set(s.asistio ?? null);
    this.notas = s.notas ?? '';
    if (s.duracion_real_seg != null) {
      this.segundos.set(s.duracion_real_seg);
      this.acumulado = s.duracion_real_seg;
      this.tiempoTexto = this.formatSegundos(s.duracion_real_seg);
    }
  }

  ngOnDestroy(): void {
    this.pararIntervalo();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cerrar.emit();
  }

  // ── Cronómetro ──

  toggleCrono(): void {
    if (this.corriendo()) {
      this.pararIntervalo();
      this.acumulado = this.segundos() ?? 0;
      this.corriendo.set(false);
      return;
    }
    // Se mide contra el reloj y no contando ticks: un setInterval que se
    // retrasa (pestaña en segundo plano, móvil bloqueado) perdería segundos.
    this.arranque = Date.now();
    this.corriendo.set(true);
    this.intervalo = setInterval(() => {
      const s = this.acumulado + Math.floor((Date.now() - this.arranque) / 1000);
      this.segundos.set(s);
      this.tiempoTexto = this.formatSegundos(s);
    }, 250);
  }

  private pararIntervalo(): void {
    if (this.intervalo !== null) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }

  /** Escribir a mano manda sobre el cronómetro: si alguien corrige el número,
   *  se para para no pisárselo al segundo siguiente. */
  onTiempoTextoChange(): void {
    if (this.corriendo()) {
      this.pararIntervalo();
      this.corriendo.set(false);
    }
    const s = this.parseTiempo(this.tiempoTexto);
    this.segundos.set(s);
    this.acumulado = s ?? 0;
  }

  private parseTiempo = parseTiempo;
  readonly formatSegundos = formatSegundos;
  readonly formatFecha = formatFecha;

  etiquetaNivel(n: NivelTiempo): string {
    return etiquetaNivel(n, this.segundos(), this.objetivo.duracion_minutos);
  }

  // ── Campos de selección: volver a pulsar lo deja sin marcar ──

  toggleAsistencia(v: AsistenciaSeguimiento): void {
    this.asistio.set(this.asistio() === v ? null : v);
  }

  // ── Persistencia ──

  guardar(): void {
    this.pararIntervalo();
    this.corriendo.set(false);
    this.guardando.set(true);
    this.error.set('');
    this.svc.guardarSeguimiento(this.objetivo.id_asignacion, {
      id_congregacion: this.idCong,
      asistio: this.asistio(),
      duracion_real_seg: this.segundos(),
      notas: this.notas.trim() || null,
    }).subscribe({
      next: (s) => {
        this.guardando.set(false);
        this.guardado.emit(s);
        this.cerrar.emit();
      },
      error: () => {
        this.guardando.set(false);
        this.error.set('No se pudo guardar el seguimiento.');
      },
    });
  }

  borrar(): void {
    this.guardando.set(true);
    this.error.set('');
    this.svc.borrarSeguimiento(this.objetivo.id_asignacion, this.idCong).subscribe({
      next: () => {
        this.guardando.set(false);
        this.guardado.emit(null);
        this.cerrar.emit();
      },
      error: () => {
        this.guardando.set(false);
        this.error.set('No se pudo borrar el seguimiento.');
      },
    });
  }

}

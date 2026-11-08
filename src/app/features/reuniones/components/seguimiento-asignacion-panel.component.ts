import {
  Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ReunionesService } from '../services/reuniones.service';
import {
  AsistenciaSeguimiento, NivelTiempo, Seguimiento,
} from '../models/reuniones.models';
import {
  ASISTENCIAS, etiquetaNivel, formatFecha, formatSegundos, nivelDeTiempo, parseTiempo,
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
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <app-modal [open]="true" variant="sheet" size="lg" [title]="objetivo.nombre_completo || 'Sin asignar'"
      [subtitle]="subtitulo" [padding]="false" [hasFooter]="true" [dismissible]="!guardando()" (closed)="cerrar.emit()">
        <div class="p-5 flex flex-col gap-5">

          <!-- ── TIEMPO ── -->
          <fieldset class="flex flex-col gap-2.5">
            <legend class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
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
                  class="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-lg font-bold text-slate-800 dark:text-slate-100 tracking-wide placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors">
              </div>

              @if (nivel(); as n) {
                <span class="shrink-0 px-2.5 h-7 rounded-full text-xs font-bold flex items-center whitespace-nowrap"
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
            <legend class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">¿Cumplió?</legend>
            <div class="flex items-center gap-1.5 flex-wrap">
              @for (op of ASISTENCIAS; track op.valor) {
                <button type="button" (click)="toggleAsistencia(op.valor)"
                  [attr.aria-pressed]="asistio() === op.valor"
                  class="px-3 h-9 rounded-xl text-xs font-bold border transition-colors active:scale-95"
                  [class]="asistio() === op.valor
                    ? op.claseBoton
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'">
                  {{ op.boton }}
                </button>
              }
            </div>
          </fieldset>

          <!-- ── NOTAS ── -->
          <div class="flex flex-col gap-2">
            <label for="seg-notas" class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Observaciones</label>
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

        <ng-container slot="footer">
          @if (objetivo.seguimiento) {
            <button type="button" (click)="borrar()" [disabled]="guardando()" class="btn-ghost-danger mr-auto">Borrar</button>
          }
          <button type="button" (click)="cerrar.emit()" [disabled]="guardando()" class="btn-secondary">Cancelar</button>
          <button type="button" (click)="guardar()" [disabled]="guardando()" class="btn-primary">
            @if (guardando()) {
              <span class="spinner-xs"></span>
            }
            Guardar
          </button>
        </ng-container>
    </app-modal>
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

  readonly ASISTENCIAS = ASISTENCIAS;

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

  get subtitulo(): string {
    const o = this.objetivo;
    return (o.nombre_parte || 'Parte de reunión') + (o.papel ? ' · ' + o.papel : '') + (o.fecha ? ' · ' + formatFecha(o.fecha) : '');
  }

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

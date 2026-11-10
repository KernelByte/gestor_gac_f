import { Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from '../../../../shared/icons';
import { EstadoReunion } from '../../models/reunion-ancianos.model';

interface Paso { clave: string; etiqueta: string; ayuda: string; }

const PASOS: Paso[] = [
  { clave: 'borrador', etiqueta: 'Programar', ayuda: 'Se arma el programa y se asignan las partes. Los convocados todavía no la ven.' },
  { clave: 'convocada', etiqueta: 'Convocada', ayuda: 'Convocada: cada uno ve el programa y prepara sus partes y sus notas.' },
  { clave: 'en_curso', etiqueta: 'En curso', ayuda: 'La reunión se está realizando.' },
  { clave: 'realizada', etiqueta: 'Realizada', ayuda: 'La reunión ya se hizo; queda el acta.' },
];

/**
 * En qué momento va la reunión: Programar → Convocada → (En curso) → Realizada.
 * «En curso» solo existe si la congregación usa la reunión en vivo (o ya está en curso).
 * Orienta, no reemplaza al botón principal. Una sola excepción: con `puedeIniciar`, el paso
 * «En curso» es un botón que abre la reunión en vivo (un atajo a lo que viene a continuación).
 * En el teléfono se resume en «Paso 2 de 4 · Preparar».
 */
@Component({
  selector: 'app-reunion-pasos',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
  @if (estado() === 'cancelada') {
    <p class="badge-inactive"><lucide-icon name="ban" [size]="13" aria-hidden="true"></lucide-icon>Reunión cancelada</p>
  } @else {
    <ol class="pasos" aria-label="Momento de la reunión">
      @for (p of pasos(); track p.clave; let i = $index) {
        <li class="paso est-reunion" [attr.data-estado]="p.clave" [attr.data-fase]="i < actual() ? 'hecho' : i === actual() ? 'actual' : 'futuro'"
            [attr.aria-current]="i === actual() ? 'step' : null" [title]="p.clave === 'en_curso' && puedeIniciar() ? 'Abrir la reunión en vivo' : p.ayuda">
          @if (p.clave === 'en_curso' && puedeIniciar()) {
            <button type="button" class="paso-accion focus-ring" (click)="iniciarEnVivo.emit()" aria-label="Iniciar la reunión en vivo">
              <span class="punto" aria-hidden="true"><lucide-icon name="play" [size]="11"></lucide-icon></span>
              <span class="txt">{{ p.etiqueta }}</span>
            </button>
          } @else {
            <span class="punto" aria-hidden="true">
              @if (i < actual()) { <lucide-icon name="check" [size]="12"></lucide-icon> } @else { {{ i + 1 }} }
            </span>
            <span class="txt">{{ p.etiqueta }}</span>
            @if (i < actual()) { <span class="sr-only">(hecho)</span> }
          }
        </li>
      }
    </ol>
    <p class="resumen" aria-hidden="true">Paso {{ actual() + 1 }} de {{ pasos().length }} · <strong>{{ pasos()[actual()].etiqueta }}</strong></p>
  }
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .pasos { display: none; list-style: none; margin: 0; padding: 0; align-items: center; gap: 0.25rem; }
    .resumen { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); }
    :host-context(.dark) .resumen { color: var(--color-slate-400); }
    @container (min-width: 26rem) { .pasos { display: flex; } .resumen { display: none; } }
    .paso { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
    .paso-accion {
      display: inline-flex; align-items: center; gap: 0.375rem; font: inherit; color: var(--est);
      padding: 0.125rem 0.5rem 0.125rem 0.125rem; margin: -0.125rem 0; border-radius: 9999px; cursor: pointer;
      transition: background-color 150ms ease-out;
    }
    .paso-accion:hover { background: color-mix(in oklab, var(--est) 12%, transparent); }
    .paso-accion .punto { border: 1px solid currentColor; }
    .paso + .paso::before {
      content: ''; width: 1.25rem; height: 1px; margin-right: 0.25rem; background: var(--color-slate-300);
    }
    :host-context(.dark) .paso + .paso::before { background: var(--color-slate-700); }
    .punto {
      width: 1.25rem; height: 1.25rem; border-radius: 9999px; display: inline-grid; place-items: center;
      font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .paso[data-fase='futuro'] { color: var(--color-slate-500); }
    .paso[data-fase='futuro'] .punto { border: 1px solid var(--color-slate-400); }
    :host-context(.dark) .paso[data-fase='futuro'] { color: var(--color-slate-500); }
    :host-context(.dark) .paso[data-fase='futuro'] .punto { border-color: var(--color-slate-700); }
    /* Lo que ya pasó y el momento actual llevan el color de su paso; el actual, además, con aro. */
    .paso[data-fase='hecho'] { color: var(--color-slate-600); }
    :host-context(.dark) .paso[data-fase='hecho'] { color: var(--color-slate-300); }
    .paso[data-fase='hecho'] .punto { background: color-mix(in oklab, var(--est) 16%, transparent); color: var(--est); border: 1px solid color-mix(in oklab, var(--est) 45%, transparent); }
    .paso[data-fase='actual'] { color: var(--est); }
    .paso[data-fase='actual'] .punto { background: var(--est-fill); color: var(--est-on); box-shadow: 0 0 0 3px color-mix(in oklab, var(--est-fill) 28%, transparent); }
    :host-context(.dark) .paso[data-fase='actual'][data-estado]:not([data-estado='borrador']) .punto { color: var(--color-slate-950); }
  `],
})
export class ReunionPasosComponent {
  estado = input.required<EstadoReunion | 'en_curso' | null>();
  /** La congregación usa la reunión en vivo. */
  conEnVivo = input(false);
  /** «En curso» se vuelve un botón que abre la reunión en vivo (solo quien la puede iniciar). */
  puedeIniciar = input(false);
  iniciarEnVivo = output<void>();
  pasos = computed(() => this.conEnVivo() || this.estado() === 'en_curso' ? PASOS : PASOS.filter(p => p.clave !== 'en_curso'));
  actual = computed(() => Math.max(0, this.pasos().findIndex(p => p.clave === (this.estado() ?? 'borrador'))));
}



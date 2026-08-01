import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { EstadoPrecursor } from '../../../services/reportes.service';

/**
 * Semáforo de estado de la pauta: icono + texto + color (nunca solo color).
 *
 * Sin relleno: repetido en 33 filas, un badge sólido convierte la columna en
 * una tira de caramelos y le roba jerarquía a las cifras. El icono y la
 * versalita bastan para distinguir los tres estados de un vistazo.
 */
@Component({
  selector: 'app-estado-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [`
    :host { display: inline-block; }

    .estado {
      display: inline-flex;
      align-items: center;
      gap: 0.3125rem;
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .estado svg { width: 0.75rem; height: 0.75rem; flex: none; }

    .en_meta  { color: oklch(52% 0.13 162); }
    .atencion { color: oklch(58% 0.14 75); }
    .riesgo   { color: oklch(54% 0.19 25); }
    /* Exento: teal apagado, deliberadamente neutro. No es un logro ni una
       alarma, es "aquí no se mide" — no debe competir con los otros tres. */
    .exento   { color: oklch(55% 0.07 195); }

    :host-context(.dark) .en_meta  { color: oklch(76% 0.13 162); }
    :host-context(.dark) .atencion { color: oklch(80% 0.13 75); }
    :host-context(.dark) .riesgo   { color: oklch(71% 0.14 25); }
    :host-context(.dark) .exento   { color: oklch(75% 0.06 195); }

    /* En MacBook Pro 14" la columna compite con 12 meses de datos. */
    @media (min-width: 1440px) and (max-width: 1679.98px) {
      .estado { gap: 0.25rem; letter-spacing: 0.05em; }
    }
  `],
  template: `
    <span class="estado" [ngClass]="estado" [title]="titulo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path *ngIf="estado === 'en_meta'" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        <path *ngIf="estado === 'atencion'" stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01" />
        <path *ngIf="estado === 'riesgo'" stroke-linecap="round" stroke-linejoin="round"
              d="M12 9v4m0 4h.01M10.3 4.3l-8 14A1.9 1.9 0 004 21h16a1.9 1.9 0 001.7-2.7l-8-14a1.9 1.9 0 00-3.4 0z" />
        <path *ngIf="estado === 'exento'" stroke-linecap="round" stroke-linejoin="round"
              d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z" />
      </svg>
      {{ texto }}
    </span>
  `,
})
export class EstadoBadgeComponent {
  @Input() estado: EstadoPrecursor = 'en_meta';
  /** Motivo de la consideración especial, para el tooltip del estado exento. */
  @Input() motivo?: string | null;

  get texto(): string {
    return this.estado === 'en_meta' ? 'En meta'
      : this.estado === 'atencion' ? 'Atención'
      : this.estado === 'exento' ? 'Consideración especial'
      : 'Riesgo';
  }

  get titulo(): string {
    if (this.estado !== 'exento') return '';
    const motivo = this.motivo ? ` (${this.motivo})` : '';
    return `Exento del requisito de horas por consideración especial${motivo}. Conserva el nombramiento de precursor regular.`;
  }
}

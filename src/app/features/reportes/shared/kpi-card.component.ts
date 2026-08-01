import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Cifra de cabecera de un reporte.
 *
 * La jerarquía la carga la tipografía, no el color ni el adorno: rótulo en
 * versalitas, cifra en la display con cifras tabulares, apostilla en la
 * monoespaciada. Sin sombra: un filete basta para separar del lienzo.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styles: [`
    :host { display: block; height: 100%; }

    .kpi {
      --linea: oklch(91.5% 0.006 295);
      --rotulo: oklch(60% 0.010 295);
      --cifra: oklch(24% 0.018 295);
      --apostilla: oklch(68% 0.009 295);

      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      padding: 1rem 1.125rem 1.125rem;
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: #ffffff;
    }
    :host-context(.dark) .kpi {
      --linea: oklch(30% 0.026 265);
      --rotulo: oklch(64% 0.014 265);
      --cifra: oklch(97% 0.006 265);
      --apostilla: oklch(56% 0.014 265);
      background: #0f172a;
    }

    .rotulo {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      line-height: 1.35;
      color: var(--rotulo);
      /* Reserva dos líneas: un rótulo que envuelve no debe descolocar la
         cifra respecto a las tarjetas vecinas. */
      min-height: 2.7em;
    }

    .cifra {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.875rem;
      line-height: 1;
      letter-spacing: -0.035em;
      font-variant-numeric: tabular-nums;
      color: var(--cifra);
      padding-top: 0.5rem;
    }
    .sufijo {
      font-size: 0.9375rem;
      font-weight: 500;
      letter-spacing: -0.01em;
      color: var(--apostilla);
      margin-left: 0.25rem;
    }

    .apostilla {
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      letter-spacing: -0.01em;
      color: var(--apostilla);
      margin-top: auto;
      padding-top: 0.375rem;
    }

    /* En portátil la cabecera compite con la matriz por el alto. */
    @media (min-width: 1440px) {
      .kpi { padding: 0.875rem 1rem 1rem; gap: 0.25rem; }
      .cifra { font-size: 1.75rem; }
    }
  `],
  template: `
    <div class="kpi">
      <span class="rotulo">{{ label }}</span>
      <span class="cifra">
        {{ value | number:'1.0-1' }}<span *ngIf="suffix" class="sufijo">{{ suffix }}</span>
      </span>
      <span *ngIf="hint" class="apostilla">{{ hint }}</span>
    </div>
  `,
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() value: number = 0;
  @Input() hint?: string | null;
  @Input() suffix?: string;
}

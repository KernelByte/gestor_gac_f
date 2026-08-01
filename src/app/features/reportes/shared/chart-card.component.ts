import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgxEchartsDirective],
  styles: [`
    :host { display: block; }

    /* Mismo idioma que la cifra de cabecera: rótulo en versalitas, filete
       en vez de sombra. El gráfico es el contenido; la tarjeta se calla. */
    .grafica {
      --linea: oklch(91.5% 0.006 295);
      --titulo: oklch(27% 0.015 295);
      --apostilla: oklch(60% 0.010 295);
      border: 1px solid var(--linea);
      background: #ffffff;
    }
    :host-context(.dark) .grafica {
      --linea: oklch(30% 0.026 265);
      --titulo: oklch(96% 0.006 265);
      --apostilla: oklch(64% 0.014 265);
      background: #0f172a;
    }
    .titulo {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--apostilla);
    }
    .apostilla {
      font-size: 0.8125rem;
      line-height: 1.5;
      max-width: 68ch;
      color: var(--titulo);
      margin-top: 0.125rem;
    }
  `],
  template: `
    <div class="grafica rounded-xl p-4 flex flex-col gap-3 h-full">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h3 class="titulo">{{ title }}</h3>
          <p *ngIf="subtitle" class="apostilla">{{ subtitle }}</p>
        </div>
      </div>
      <div *ngIf="option; else emptyTpl"
           echarts
           [options]="option"
           [autoResize]="true"
           class="w-full"
           [style.height.px]="height"></div>
      <ng-template #emptyTpl>
        <div class="flex items-center justify-center text-sm text-slate-400 dark:text-slate-500"
             [style.height.px]="height">
          Sin datos
        </div>
      </ng-template>
    </div>
  `,
})
export class ChartCardComponent {
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() option: EChartsOption | null = null;
  @Input() height = 280;
}

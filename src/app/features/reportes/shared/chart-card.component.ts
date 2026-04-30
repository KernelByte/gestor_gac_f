import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-chart-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-3 h-full">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ title }}</h3>
          <p *ngIf="subtitle" class="text-[0.75rem] text-slate-500 dark:text-slate-400 mt-0.5">{{ subtitle }}</p>
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

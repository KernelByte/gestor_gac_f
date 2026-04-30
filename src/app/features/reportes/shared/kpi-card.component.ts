import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col">
      <span class="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400">{{ label }}</span>
      <span class="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
        {{ value | number:'1.0-1' }}<span *ngIf="suffix" class="text-base font-normal text-slate-500 ml-1">{{ suffix }}</span>
      </span>
      <span *ngIf="hint" class="text-[0.7rem] text-slate-400 dark:text-slate-500 mt-1">{{ hint }}</span>
    </div>
  `,
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() value: number = 0;
  @Input() hint?: string | null;
  @Input() suffix?: string;
}

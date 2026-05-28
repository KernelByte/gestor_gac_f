import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ProgressColor = 'violet' | 'orange' | 'green' | 'blue' | 'red';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Linear -->
    <div *ngIf="variant === 'linear'" class="w-full">
      <div *ngIf="label" class="flex items-center justify-between mb-1.5">
        <span class="text-xs font-medium text-gray-600">{{ label }}</span>
        <span class="text-xs font-semibold tabular-num text-gray-900">{{ percent() }}%</span>
      </div>
      <div class="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500 ease-out"
          [ngClass]="barClass()"
          [style.width.%]="percent()"
          role="progressbar"
          [attr.aria-valuenow]="percent()"
          aria-valuemin="0"
          aria-valuemax="100"
        ></div>
      </div>
    </div>

    <!-- Circular -->
    <div *ngIf="variant === 'circular'" class="relative inline-flex items-center justify-center" [style.width.px]="size" [style.height.px]="size">
      <svg [attr.width]="size" [attr.height]="size" class="-rotate-90">
        <circle [attr.cx]="size/2" [attr.cy]="size/2" [attr.r]="radius()" fill="none" stroke="rgb(243 244 246)" [attr.stroke-width]="stroke"/>
        <circle
          [attr.cx]="size/2" [attr.cy]="size/2" [attr.r]="radius()" fill="none"
          [attr.stroke-width]="stroke"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="dashOffset()"
          stroke-linecap="round"
          [ngClass]="strokeClass()"
          class="transition-all duration-500 ease-out"
        />
      </svg>
      <span class="absolute text-sm font-bold tabular-num text-gray-900">{{ percent() }}%</span>
    </div>
  `,
})
export class ProgressComponent {
  @Input() variant: 'linear' | 'circular' = 'linear';
  @Input() set value(v: number) { this._value.set(v); }
  @Input() max: number = 100;
  @Input() label: string = '';
  @Input() color: ProgressColor = 'violet';
  @Input() size: number = 56;
  @Input() stroke: number = 6;

  private _value = signal(0);

  percent = computed(() => {
    const v = Math.max(0, Math.min(this.max, this._value()));
    return Math.round((v / this.max) * 100);
  });

  barClass = computed(() => ({
    violet: 'bg-violet-600',
    orange: 'bg-orange-500',
    green:  'bg-green-600',
    blue:   'bg-blue-600',
    red:    'bg-red-500',
  })[this.color]);

  strokeClass = computed(() => ({
    violet: 'stroke-violet-600',
    orange: 'stroke-orange-500',
    green:  'stroke-green-600',
    blue:   'stroke-blue-600',
    red:    'stroke-red-500',
  })[this.color]);

  radius = computed(() => (this.size - this.stroke) / 2);
  circumference = computed(() => 2 * Math.PI * this.radius());
  dashOffset = computed(() => this.circumference() * (1 - this.percent() / 100));
}

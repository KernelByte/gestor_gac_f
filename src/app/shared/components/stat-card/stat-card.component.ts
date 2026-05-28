import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatCardVariant = 'minimal' | 'standard';

/**
 * Colores de acento por módulo:
 *   orange → Publicadores / Secretario
 *   green  → Territorios
 *   blue   → Exhibidores
 *   violet → Global / Marca
 */
export type StatCardColor = 'orange' | 'green' | 'blue' | 'violet' | 'red' | 'gray';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Variante minimal: solo label + número, sin ícono -->
    <div *ngIf="variant === 'minimal'" class="card p-4">
      <p class="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-1">{{ label }}</p>
      <p class="text-2xl font-bold text-gray-900 dark:text-slate-100">{{ value }}</p>
      <p *ngIf="sub" class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{{ sub }}</p>
    </div>

    <!-- Variante standard: ícono + número + label -->
    <div *ngIf="variant === 'standard'" class="card p-4 flex items-center gap-4">
      <div
        class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        [ngClass]="iconBgClass"
      >
        <ng-content select="[slot=icon]">
          <!-- ícono por defecto si no se proyecta ninguno -->
          <svg class="w-5 h-5" [ngClass]="iconColorClass" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        </ng-content>
      </div>
      <div class="min-w-0">
        <p class="text-2xl font-bold text-gray-900 dark:text-slate-100 leading-none">{{ value }}</p>
        <p class="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-slate-500 mt-1">{{ label }}</p>
        <p *ngIf="sub" class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{{ sub }}</p>
      </div>
    </div>
  `,
})
export class StatCardComponent {
  @Input() variant: StatCardVariant = 'standard';
  @Input() label: string = '';
  @Input() value: string | number = 0;
  @Input() sub: string = '';
  @Input() color: StatCardColor = 'orange';

  get iconBgClass(): string {
    const map: Record<StatCardColor, string> = {
      orange: 'bg-orange-100 dark:bg-orange-950/50',
      green:  'bg-green-100 dark:bg-green-950/50',
      blue:   'bg-blue-100 dark:bg-blue-950/50',
      violet: 'bg-violet-100 dark:bg-violet-950/50',
      red:    'bg-red-100 dark:bg-red-950/50',
      gray:   'bg-gray-100 dark:bg-slate-700',
    };
    return map[this.color];
  }

  get iconColorClass(): string {
    const map: Record<StatCardColor, string> = {
      orange: 'text-orange-500',
      green:  'text-green-600',
      blue:   'text-blue-600',
      violet: 'text-violet-600',
      red:    'text-red-500',
      gray:   'text-gray-400',
    };
    return map[this.color];
  }
}

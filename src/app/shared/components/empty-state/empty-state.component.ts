import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

export type EmptyStateVariant = 'empty' | 'error' | 'success';

/**
 * Acento por módulo — misma convención que app-stat-card:
 *   orange → Publicadores / Secretario
 *   green  → Territorios
 *   blue   → Exhibidores
 *   violet → Global / Marca (default)
 */
export type EmptyStateAccent = 'orange' | 'green' | 'blue' | 'violet';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="flex flex-col items-center justify-center text-center px-6 py-12 animate-slide-up">
      <!-- Chip de icono: mismo lenguaje que stat-card / confirm-dialog -->
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-inset"
           [ngClass]="chipClass">
        <lucide-icon [name]="iconName" [size]="26" [ngClass]="iconColorClass"></lucide-icon>
      </div>

      <p class="display-section text-lg mt-4">{{ title }}</p>

      <p *ngIf="description"
         class="text-sm text-gray-600 dark:text-slate-400 max-w-sm leading-relaxed mt-1.5">
        {{ description }}
      </p>

      <div class="flex items-center gap-2 mt-5" *ngIf="actionLabel || secondaryLabel">
        <button
          *ngIf="secondaryLabel"
          type="button"
          (click)="secondary.emit()"
          class="btn-secondary"
          [ngClass]="focusRingClass"
        >{{ secondaryLabel }}</button>
        <button
          *ngIf="actionLabel"
          type="button"
          (click)="action.emit()"
          [ngClass]="[actionButtonClass, focusRingClass]"
        >
          <lucide-icon *ngIf="variant === 'error'" name="refresh-cw" [size]="16"></lucide-icon>
          {{ actionLabel }}
        </button>
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() variant: EmptyStateVariant = 'empty';
  @Input() accent: EmptyStateAccent = 'violet';
  /** Nombre Lucide (kebab-case) registrado en shared/icons.ts. Vacío = icono por variante. */
  @Input() icon: string = '';
  @Input() title: string = 'Sin resultados';
  @Input() description: string = '';
  @Input() actionLabel: string = '';
  @Input() secondaryLabel: string = '';
  @Output() action = new EventEmitter<void>();
  @Output() secondary = new EventEmitter<void>();

  get iconName(): string {
    if (this.icon) return this.icon;
    if (this.variant === 'error') return 'alert-triangle';
    if (this.variant === 'success') return 'check-circle-2';
    return 'inbox';
  }

  /** El chip lleva el color semántico; en 'empty' toma el acento del módulo. */
  get chipClass(): string {
    if (this.variant === 'error') return 'bg-red-100 dark:bg-red-950/50 ring-red-200 dark:ring-red-900/60';
    if (this.variant === 'success') return 'bg-green-100 dark:bg-green-950/50 ring-green-200 dark:ring-green-900/60';
    const map: Record<EmptyStateAccent, string> = {
      orange: 'bg-orange-100 dark:bg-orange-950/50 ring-orange-200 dark:ring-orange-900/60',
      green:  'bg-green-100 dark:bg-green-950/50 ring-green-200 dark:ring-green-900/60',
      blue:   'bg-exh-100 dark:bg-exh-950/50 ring-exh-200 dark:ring-exh-900/60',
      violet: 'bg-violet-100 dark:bg-violet-950/50 ring-violet-200 dark:ring-violet-900/60',
    };
    return map[this.accent];
  }

  get iconColorClass(): string {
    if (this.variant === 'error') return 'text-red-600 dark:text-red-400';
    if (this.variant === 'success') return 'text-green-600 dark:text-green-400';
    const map: Record<EmptyStateAccent, string> = {
      orange: 'text-orange-500 dark:text-orange-400',
      green:  'text-green-600 dark:text-green-400',
      blue:   'text-exh-600 dark:text-exh-400',
      violet: 'text-violet-600 dark:text-violet-400',
    };
    return map[this.accent];
  }

  get actionButtonClass(): string {
    const map: Record<EmptyStateAccent, string> = {
      orange: 'btn-primary-orange',
      green:  'btn-primary-green',
      blue:   'btn-primary-blue',
      violet: 'btn-primary-violet',
    };
    return map[this.accent];
  }

  get focusRingClass(): string {
    const map: Record<EmptyStateAccent, string> = {
      orange: 'focus-ring-orange',
      green:  'focus-ring-green',
      blue:   'focus-ring-blue',
      violet: 'focus-ring',
    };
    return map[this.accent];
  }
}

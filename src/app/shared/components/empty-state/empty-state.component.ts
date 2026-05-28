import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

export type EmptyStateVariant = 'empty' | 'error' | 'success';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="flex flex-col items-center justify-center py-16 gap-3 text-center animate-slide-up">
      <div
        class="w-16 h-16 rounded-full flex items-center justify-center mb-1 ring-8"
        [class.bg-red-50]="variant === 'error'"
        [class.dark:bg-red-950/40]="variant === 'error'"
        [class.ring-red-50/40]="variant === 'error'"
        [class.bg-green-50]="variant === 'success'"
        [class.dark:bg-green-950/40]="variant === 'success'"
        [class.ring-green-50/40]="variant === 'success'"
        [class.bg-violet-50]="variant === 'empty'"
        [class.dark:bg-violet-950/40]="variant === 'empty'"
        [class.ring-violet-50/40]="variant === 'empty'"
      >
        <lucide-icon
          *ngIf="variant === 'error'"
          name="alert-triangle"
          [size]="28"
          class="text-red-500"
        ></lucide-icon>
        <lucide-icon
          *ngIf="variant === 'success'"
          name="check-circle-2"
          [size]="28"
          class="text-green-600"
        ></lucide-icon>
        <ng-container *ngIf="variant === 'empty'">
          <ng-content select="[slot=icon]">
            <lucide-icon name="folder-open" [size]="28" class="text-violet-500"></lucide-icon>
          </ng-content>
        </ng-container>
      </div>

      <p class="text-lg mt-1"
        [class.font-semibold]="variant === 'empty'"
        [class.font-bold]="variant === 'error'"
        [class.font-medium]="variant === 'success'"
        [class.tracking-tight]="variant === 'error'"
        [class.text-gray-900]="variant !== 'success'"
        [class.dark:text-slate-100]="variant !== 'success'"
        [class.text-green-800]="variant === 'success'"
        [class.dark:text-green-300]="variant === 'success'"
      >{{ title }}</p>

      <p *ngIf="description" class="text-sm text-gray-500 dark:text-slate-400 max-w-sm leading-relaxed">{{ description }}</p>

      <div class="flex items-center gap-2 mt-3" *ngIf="actionLabel || secondaryLabel">
        <button
          *ngIf="secondaryLabel"
          type="button"
          (click)="secondary.emit()"
          class="btn-secondary focus-ring"
        >{{ secondaryLabel }}</button>
        <button
          *ngIf="actionLabel"
          type="button"
          (click)="action.emit()"
          class="btn-primary-violet focus-ring"
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
  @Input() title: string = 'Sin resultados';
  @Input() description: string = '';
  @Input() actionLabel: string = '';
  @Input() secondaryLabel: string = '';
  @Output() action = new EventEmitter<void>();
  @Output() secondary = new EventEmitter<void>();
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div
      class="fixed bottom-6 right-6 flex flex-col gap-3 pointer-events-none"
      style="z-index: var(--z-toast)"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        *ngFor="let t of toast.toasts(); trackBy: trackById"
        class="pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border shadow-xl animate-slide-up"
        [class.border-green-200]="t.variant === 'success'"
        [class.border-red-200]="t.variant === 'error'"
        [class.border-amber-200]="t.variant === 'warning'"
        [class.border-sky-200]="t.variant === 'info'"
        role="status"
      >
        <!-- Icon -->
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          [class.bg-green-100]="t.variant === 'success'"
          [class.bg-red-100]="t.variant === 'error'"
          [class.bg-amber-100]="t.variant === 'warning'"
          [class.bg-sky-100]="t.variant === 'info'"
        >
          <lucide-icon *ngIf="t.variant === 'success'" name="check" [size]="18" class="text-green-700"></lucide-icon>
          <lucide-icon *ngIf="t.variant === 'error'"   name="x-circle" [size]="18" class="text-red-700"></lucide-icon>
          <lucide-icon *ngIf="t.variant === 'warning'" name="alert-triangle" [size]="18" class="text-amber-700"></lucide-icon>
          <lucide-icon *ngIf="t.variant === 'info'"    name="info" [size]="18" class="text-sky-700"></lucide-icon>
        </div>
        <!-- Content -->
        <div class="flex-1 min-w-0 pt-0.5">
          <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ t.title }}</p>
          <p *ngIf="t.description" class="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{{ t.description }}</p>
        </div>
        <!-- Close -->
        <button
          (click)="toast.dismiss(t.id)"
          class="btn-icon-sm shrink-0 -mr-1 -mt-0.5"
          aria-label="Cerrar notificación"
        >
          <lucide-icon name="x" [size]="16"></lucide-icon>
        </button>
      </div>
    </div>
  `,
})
export class ToastContainerComponent {
  toast = inject(ToastService);
  trackById = (_: number, t: { id: number }) => t.id;
}

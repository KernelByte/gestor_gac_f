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
      class="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        *ngFor="let t of toast.toasts(); trackBy: trackById"
        class="pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border shadow-lg animate-slide-up"
        [class.border-green-200]="t.variant === 'success'"
        [class.border-red-200]="t.variant === 'error'"
        [class.border-amber-200]="t.variant === 'warning'"
        [class.border-blue-200]="t.variant === 'info'"
        role="status"
      >
        <!-- Icon -->
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          [class.bg-green-100]="t.variant === 'success'"
          [class.bg-red-100]="t.variant === 'error'"
          [class.bg-amber-100]="t.variant === 'warning'"
          [class.bg-blue-100]="t.variant === 'info'"
        >
          <lucide-icon *ngIf="t.variant === 'success'" name="check" [size]="18" class="text-green-600"></lucide-icon>
          <lucide-icon *ngIf="t.variant === 'error'"   name="x-circle" [size]="18" class="text-red-600"></lucide-icon>
          <lucide-icon *ngIf="t.variant === 'warning'" name="alert-triangle" [size]="18" class="text-amber-600"></lucide-icon>
          <lucide-icon *ngIf="t.variant === 'info'"    name="info" [size]="18" class="text-blue-600"></lucide-icon>
        </div>
        <!-- Content -->
        <div class="flex-1 min-w-0 pt-0.5">
          <p class="text-sm font-semibold text-gray-900 dark:text-slate-100">{{ t.title }}</p>
          <p *ngIf="t.description" class="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{{ t.description }}</p>
        </div>
        <!-- Close -->
        <button
          (click)="toast.dismiss(t.id)"
          class="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition focus-ring"
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

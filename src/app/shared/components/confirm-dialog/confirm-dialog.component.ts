import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ModalComponent } from '../modal/modal.component';

export type ConfirmSeverity = 'danger' | 'warning' | 'info';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, ModalComponent, LucideAngularModule],
  template: `
    <app-modal [open]="open" [size]="'sm'" [padding]="false" (closed)="cancel()">
      <div class="p-6">
        <div class="flex items-start gap-4">
          <!-- Icon -->
          <div
            class="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            [class.bg-red-100]="severity === 'danger'"
            [class.bg-amber-100]="severity === 'warning'"
            [class.bg-blue-100]="severity === 'info'"
          >
            <lucide-icon *ngIf="severity === 'danger'"  name="trash-2"         [size]="22" class="text-red-600"></lucide-icon>
            <lucide-icon *ngIf="severity === 'warning'" name="alert-triangle"  [size]="22" class="text-amber-600"></lucide-icon>
            <lucide-icon *ngIf="severity === 'info'"    name="info"            [size]="22" class="text-blue-600"></lucide-icon>
          </div>
          <!-- Content -->
          <div class="flex-1 min-w-0">
            <h2 class="display-section text-lg">{{ title }}</h2>
            <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">{{ message }}</p>
          </div>
        </div>
      </div>
      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 rounded-b-2xl">
        <button
          (click)="cancel()"
          class="btn-secondary focus-ring"
        >{{ cancelLabel }}</button>
        <button
          (click)="accept()"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition active:scale-95 focus-ring"
          [class.bg-red-600]="severity === 'danger'"
          [class.hover:bg-red-700]="severity === 'danger'"
          [class.bg-amber-600]="severity === 'warning'"
          [class.hover:bg-amber-700]="severity === 'warning'"
          [class.bg-violet-600]="severity === 'info'"
          [class.hover:bg-violet-700]="severity === 'info'"
        >{{ confirmLabel }}</button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  @Input() open: boolean = false;
  @Input() title: string = '¿Confirmar acción?';
  @Input() message: string = '';
  @Input() confirmLabel: string = 'Confirmar';
  @Input() cancelLabel: string = 'Cancelar';
  @Input() severity: ConfirmSeverity = 'danger';

  @Output() openChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  accept() {
    this.confirmed.emit();
    this.close();
  }

  cancel() {
    this.cancelled.emit();
    this.close();
  }

  private close() {
    this.open = false;
    this.openChange.emit(false);
  }
}

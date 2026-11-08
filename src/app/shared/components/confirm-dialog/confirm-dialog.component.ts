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
    <app-modal
      [open]="open"
      size="sm"
      [padding]="false"
      [dismissible]="!busy"
      [hasFooter]="true"
      (closed)="cancel()"
    >
      <div class="p-6">
        <div class="flex items-start gap-4">
          <div
            class="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            [ngClass]="chipClass"
          >
            <lucide-icon *ngIf="severity === 'danger'"  name="trash-2"        [size]="22" class="text-red-700 dark:text-red-400"></lucide-icon>
            <lucide-icon *ngIf="severity === 'warning'" name="alert-triangle" [size]="22" class="text-amber-700 dark:text-amber-400"></lucide-icon>
            <lucide-icon *ngIf="severity === 'info'"    name="info"           [size]="22" class="text-sky-700 dark:text-sky-400"></lucide-icon>
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="display-section text-lg">{{ title }}</h2>
            <p *ngIf="message" class="text-sm text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-line">{{ message }}</p>
          </div>
        </div>
      </div>
      <ng-container slot="footer">
        <button type="button" *ngIf="cancelLabel" (click)="cancel()" [disabled]="busy" class="btn-secondary">{{ cancelLabel }}</button>
        <button
          type="button"
          (click)="accept()"
          [disabled]="busy"
          [class.btn-loading]="busy"
          [class.btn-danger]="severity === 'danger'"
          [class.btn-primary]="severity !== 'danger'"
          [style.--accent]="severity === 'warning' ? '#b45309' : null"
          [style.--accent-hover]="severity === 'warning' ? '#92400e' : null"
        >{{ confirmLabel }}</button>
      </ng-container>
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  @Input() open: boolean = false;
  @Input() title: string = '¿Confirmar acción?';
  @Input() message: string = '';
  @Input() confirmLabel: string = 'Confirmar';
  /** Vacío = un solo botón (aviso informativo). */
  @Input() cancelLabel: string = 'Cancelar';
  @Input() severity: ConfirmSeverity = 'danger';
  /**
   * Acción asíncrona en curso (borrar, guardar): el botón muestra el spinner y
   * ni Esc ni el velo cierran el diálogo hasta que termine. Con `busy` activo,
   * `confirmed` NO cierra el diálogo: lo cierra quien lo abrió al terminar.
   */
  @Input() busy: boolean = false;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  get chipClass(): string {
    if (this.severity === 'danger') return 'bg-red-100 dark:bg-red-950/60';
    if (this.severity === 'warning') return 'bg-amber-100 dark:bg-amber-950/60';
    return 'bg-sky-100 dark:bg-sky-950/60';
  }

  accept() {
    if (this.busy) return;
    this.confirmed.emit();
    // Si el padre activó `busy` al recibir `confirmed`, se queda abierto. Va en
    // setTimeout para que el input `busy` ya se haya actualizado (CD corre antes).
    setTimeout(() => { if (!this.busy) this.close(); });
  }

  cancel() {
    if (this.busy) return;
    this.cancelled.emit();
    this.close();
  }

  private close() {
    this.open = false;
    this.openChange.emit(false);
  }
}

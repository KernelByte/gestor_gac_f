import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

export type AvisoTone = 'info' | 'success' | 'warning' | 'danger';

/**
 * Aviso en línea dentro de la pantalla (no flota: para eso está el toast).
 * Un icono + texto en una caja con borde completo. Úsalo para errores de un
 * formulario, advertencias antes de actuar o notas de contexto.
 *
 *   <app-aviso tone="warning" title="Faltan informes">Hay 3 sin entregar.</app-aviso>
 *   <app-aviso tone="danger" dense [dismissible]="true" (dismissed)="error.set('')">{{ error() }}</app-aviso>
 *
 * Los de tono `danger` se anuncian de inmediato (role="alert"); el resto, sin
 * interrumpir (role="status").
 */
@Component({
  selector: 'app-aviso',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div
      class="flex items-start rounded-xl border"
      [class.gap-2.5]="dense" [class.px-3]="dense" [class.py-2]="dense"
      [class.gap-3]="!dense" [class.px-4]="!dense" [class.py-3]="!dense"
      [ngClass]="clases"
      [attr.role]="tone === 'danger' ? 'alert' : 'status'"
    >
      <lucide-icon [name]="icono" [size]="dense ? 16 : 18" class="shrink-0" [class.mt-0.5]="true" aria-hidden="true"></lucide-icon>
      <div class="min-w-0 flex-1 text-sm leading-relaxed">
        <p *ngIf="title" class="font-semibold">{{ title }}</p>
        <div [class.mt-0.5]="!!title"><ng-content></ng-content></div>
      </div>
      <button
        *ngIf="dismissible"
        type="button"
        (click)="dismissed.emit()"
        class="shrink-0 -mr-1 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Cerrar aviso"
      >
        <lucide-icon name="x" [size]="16"></lucide-icon>
      </button>
    </div>
  `,
})
export class AvisoComponent {
  @Input() tone: AvisoTone = 'info';
  @Input() title = '';
  /** Versión compacta para filas, tablas y paneles angostos. */
  @Input() dense = false;
  @Input() dismissible = false;
  @Output() dismissed = new EventEmitter<void>();

  private static readonly TONOS: Record<AvisoTone, { icono: string; clases: string }> = {
    info:    { icono: 'info',           clases: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/60 text-sky-900 dark:text-sky-200' },
    success: { icono: 'check-circle-2', clases: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200' },
    warning: { icono: 'alert-triangle', clases: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200' },
    danger:  { icono: 'alert-circle',   clases: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200' },
  };

  get icono(): string { return AvisoComponent.TONOS[this.tone].icono; }
  get clases(): string { return AvisoComponent.TONOS[this.tone].clases; }
}

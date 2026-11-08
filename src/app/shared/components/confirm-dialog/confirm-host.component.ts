import { Component, inject } from '@angular/core';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmService } from './confirm.service';

/** Se monta una sola vez en el shell; pinta lo que pide ConfirmService. */
@Component({
  selector: 'app-confirm-host',
  standalone: true,
  imports: [ConfirmDialogComponent],
  template: `
    @if (confirm.actual(); as c) {
      <app-confirm-dialog
        [open]="true"
        [title]="c.title"
        [message]="c.message"
        [confirmLabel]="c.confirmLabel"
        [cancelLabel]="c.cancelLabel"
        [severity]="c.severity"
        (confirmed)="confirm.responder(true)"
        (cancelled)="confirm.responder(false)"
      />
    }
  `,
})
export class ConfirmHostComponent {
  protected readonly confirm = inject(ConfirmService);
}

import { Injectable, signal } from '@angular/core';
import type { ConfirmSeverity } from './confirm-dialog.component';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Vacío o `null` = solo botón de aceptar (sustituye a `alert()`). */
  cancelLabel?: string | null;
  severity?: ConfirmSeverity;
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'cancelLabel'>> {
  cancelLabel: string;
  resolve: (ok: boolean) => void;
}

/**
 * Sustituto de `confirm()` y `alert()` del navegador:
 *
 *   if (!(await this.confirm.ask({ title: '¿Descartar cambios?', severity: 'warning' }))) return;
 *   await this.confirm.notify({ title: 'No se pudo guardar', message: detalle });
 *
 * El diálogo real lo pinta `<app-confirm-host>` (una sola vez, en el shell).
 * Si se pide otro mientras hay uno abierto, el anterior se resuelve como
 * "no" y el nuevo ocupa su lugar.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _actual = signal<ConfirmRequest | null>(null);
  readonly actual = this._actual.asReadonly();

  ask(opts: ConfirmOptions): Promise<boolean> {
    this._actual()?.resolve(false);
    return new Promise<boolean>(resolve => {
      this._actual.set({
        title: opts.title,
        message: opts.message ?? '',
        confirmLabel: opts.confirmLabel ?? 'Confirmar',
        cancelLabel: opts.cancelLabel === undefined ? 'Cancelar' : (opts.cancelLabel ?? ''),
        severity: opts.severity ?? 'danger',
        resolve,
      });
    });
  }

  /** Aviso con un solo botón. Siempre resuelve cuando la persona lo cierra. */
  async notify(opts: Omit<ConfirmOptions, 'cancelLabel'>): Promise<void> {
    await this.ask({ confirmLabel: 'Entendido', severity: 'info', ...opts, cancelLabel: null });
  }

  /** Lo llama el host al cerrar el diálogo. */
  responder(ok: boolean): void {
    const actual = this._actual();
    this._actual.set(null);
    actual?.resolve(ok);
  }
}

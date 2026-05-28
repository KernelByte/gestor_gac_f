import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<ToastItem[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private nextId = 1;

  show(variant: ToastVariant, title: string, description?: string, duration = 4000): void {
    const id = this.nextId++;
    this._toasts.update(list => [...list, { id, variant, title, description, duration }]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(title: string, description?: string, duration?: number) { this.show('success', title, description, duration); }
  error(title: string, description?: string, duration?: number)   { this.show('error',   title, description, duration); }
  warning(title: string, description?: string, duration?: number) { this.show('warning', title, description, duration); }
  info(title: string, description?: string, duration?: number)    { this.show('info',    title, description, duration); }

  dismiss(id: number): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }
}

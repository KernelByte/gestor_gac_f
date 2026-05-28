import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div
      *ngIf="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="title ? 'modal-title' : null"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm animate-fadeIn"
        (click)="dismissible && close()"
      ></div>

      <!-- Panel -->
      <div
        class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full animate-scale-in"
        [class.max-w-sm]="size === 'sm'"
        [class.max-w-md]="size === 'md'"
        [class.max-w-lg]="size === 'lg'"
        [class.max-w-2xl]="size === 'xl'"
        [class.max-w-4xl]="size === '2xl'"
      >
        <!-- Header -->
        <div *ngIf="title" class="flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h2 id="modal-title" class="display-section text-xl">{{ title }}</h2>
            <p *ngIf="subtitle" class="text-sm text-gray-500 mt-0.5">{{ subtitle }}</p>
          </div>
          <button
            *ngIf="dismissible"
            (click)="close()"
            class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition focus-ring"
            aria-label="Cerrar"
          >
            <lucide-icon name="x" [size]="20"></lucide-icon>
          </button>
        </div>

        <!-- Body -->
        <div [class.p-6]="padding" [class.px-6]="padding && title" [class.py-5]="padding && title">
          <ng-content></ng-content>
        </div>

        <!-- Footer -->
        <div *ngIf="hasFooter" class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 rounded-b-2xl">
          <ng-content select="[slot=footer]"></ng-content>
        </div>
      </div>
    </div>
  `,
})
export class ModalComponent {
  @Input() open: boolean = false;
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md';
  @Input() dismissible: boolean = true;
  @Input() hasFooter: boolean = false;
  @Input() padding: boolean = true;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open && this.dismissible) this.close();
  }

  close() {
    this.open = false;
    this.openChange.emit(false);
    this.closed.emit();
  }
}

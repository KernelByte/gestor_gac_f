import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DropdownItem {
  key: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative inline-block">
      <button
        type="button"
        (click)="toggle()"
        class="focus-ring rounded-lg"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="menu"
      >
        <ng-content select="[slot=trigger]"></ng-content>
      </button>

      <div
        *ngIf="isOpen()"
        class="absolute z-30 mt-1 min-w-[180px] bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg py-1 animate-scale-in origin-top-right"
        [class.right-0]="align === 'right'"
        [class.left-0]="align === 'left'"
        role="menu"
      >
        <ng-container *ngFor="let item of items">
          <div *ngIf="item.divider" class="my-1 border-t border-gray-100 dark:border-slate-700"></div>
          <button
            *ngIf="!item.divider"
            type="button"
            (click)="select(item)"
            [disabled]="item.disabled"
            class="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm transition focus-ring"
            [class.text-gray-700]="!item.danger && !item.disabled"
            [class.dark:text-slate-300]="!item.danger && !item.disabled"
            [class.hover:bg-gray-50]="!item.disabled"
            [class.dark:hover:bg-slate-700]="!item.disabled"
            [class.text-red-600]="item.danger"
            [class.dark:text-red-400]="item.danger"
            [class.hover:bg-red-50]="item.danger && !item.disabled"
            [class.dark:hover:bg-red-950/40]="item.danger && !item.disabled"
            [class.text-gray-300]="item.disabled"
            [class.dark:text-slate-600]="item.disabled"
            [class.cursor-not-allowed]="item.disabled"
            role="menuitem"
          >
            <span *ngIf="item.icon" [innerHTML]="item.icon" class="w-4 h-4 shrink-0"></span>
            <span class="flex-1">{{ item.label }}</span>
          </button>
        </ng-container>
      </div>
    </div>
  `,
})
export class DropdownComponent {
  @Input() items: DropdownItem[] = [];
  @Input() align: 'left' | 'right' = 'right';
  @Output() itemClick = new EventEmitter<string>();

  isOpen = signal(false);
  private host = inject(ElementRef<HTMLElement>);

  toggle() { this.isOpen.update(v => !v); }
  close()  { this.isOpen.set(false); }

  select(item: DropdownItem) {
    if (item.disabled) return;
    this.itemClick.emit(item.key);
    this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEsc() { this.close(); }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface ChipItem {
  id: number | string;
  label: string;
}

/**
 * Fichas con una × para quitar cada una (p. ej. las personas asignadas a una
 * tarea). Junto a un `app-select-picker` con `resetOnSelect` forma una
 * selección múltiple: el selector añade y las fichas quitan.
 */
@Component({
  selector: 'app-chip-list',
  standalone: true,
  template: `
    @if (items.length) {
      <ul class="chips" [attr.aria-label]="ariaLabel">
        @for (item of items; track item.id) {
          <li class="chip">
            <span class="chip-nombre">{{ item.label }}</span>
            <button type="button" class="chip-quitar" [disabled]="disabled" (click)="remove.emit(item.id)"
              [attr.aria-label]="'Quitar a ' + item.label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-width="2.4" d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0; }
    .chip { display: inline-flex; align-items: center; gap: 2px; max-width: 100%; min-height: 34px; padding: 0 2px 0 12px; border-radius: 999px; background: rgb(255 241 242); color: rgb(159 18 57); font-size: 14px; font-weight: 600; }
    :host-context(.dark) .chip { background: rgb(136 19 55 / 0.35); color: rgb(254 205 211); }
    .chip-nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip-quitar { width: 30px; height: 30px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 999px; color: currentColor; opacity: 0.7; transition: opacity 150ms ease, background-color 150ms ease; }
    .chip-quitar svg { width: 14px; height: 14px; }
    .chip-quitar:hover:not(:disabled) { opacity: 1; background: rgb(244 63 94 / 0.15); }
    .chip-quitar:disabled { opacity: 0.4; }
    .chip-quitar:focus-visible { outline: 2px solid rgb(244 63 94); outline-offset: 1px; opacity: 1; }
  `],
})
export class ChipListComponent {
  @Input() items: readonly ChipItem[] = [];
  @Input() disabled = false;
  @Input() ariaLabel: string | null = null;
  @Output() remove = new EventEmitter<number | string>();
}

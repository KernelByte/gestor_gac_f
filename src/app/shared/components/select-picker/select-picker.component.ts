import { Component, Input, signal, computed, forwardRef, ElementRef, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type ColorScheme = 'orange' | 'violet';

/**
 * Selector de opciones con estilo propio de la app — reemplaza el <select>
 * nativo del navegador/SO, cuyo menú desplegable no puede restylearse por CSS
 * (mismo motivo que llevó a crear TimePickerComponent/DatePickerComponent).
 */
@Component({
  selector: 'app-select-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SelectPickerComponent),
    multi: true,
  }],
  template: `
    <div class="sp-root"
         [class.sp-violet]="colorScheme === 'violet'"
         [class.sp-open-above]="openAbove()">

      <button
        type="button"
        [disabled]="disabled"
        (click)="toggle()"
        class="sp-trigger"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="value ?? (placeholder || 'Seleccionar')">
        <span class="sp-trigger-label"
              [class.sp-trigger-label--value]="!!value"
              [class.sp-trigger-label--placeholder]="!value">
          {{ value || placeholder || 'Seleccionar' }}
        </span>
        <svg *ngIf="value && clearable"
             class="sp-clear-btn"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             (click)="$event.stopPropagation(); clear()"
             role="button" aria-label="Limpiar selección">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
        <svg class="sp-chevron" [class.sp-chevron--open]="isOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      <div *ngIf="isOpen()" class="sp-popup" role="listbox">
        @if (clearable) {
          <button type="button" class="sp-opt sp-opt-empty" [class.sp-opt--on]="!value" (click)="select(null)">
            {{ placeholder || 'Sin selección' }}
          </button>
        }
        @for (opt of options; track opt) {
          <button type="button" class="sp-opt" [class.sp-opt--on]="opt === value"
                  [attr.aria-selected]="opt === value"
                  (click)="select(opt)">
            {{ opt }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }

    @keyframes spIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes spInUp {
      from { opacity: 0; transform: translateY(4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }

    .sp-root { position: relative; }

    /* ── Trigger — mismo lenguaje visual que .field / dp-trigger-field / tp-trigger ── */
    .sp-trigger {
      width: 100%; display: flex; align-items: center; gap: 0.5rem;
      cursor: pointer; text-align: left;
      border: 1px solid #e2e8f0; background: #ffffff;
      border-radius: 0.625rem; padding: 0.5rem 0.75rem;
      font-size: 0.875rem; color: #1e293b; min-height: 2.5rem;
      transition: border-color 160ms, box-shadow 160ms;
    }
    @media (max-width: 767px) { .sp-trigger { min-height: 2.75rem; font-size: 1rem; } }
    .sp-trigger:disabled { cursor: not-allowed; opacity: 0.55; }

    :host-context(.dark) .sp-trigger { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    .sp-trigger:not(:disabled):hover { border-color: #94a3b8; }
    :host-context(.dark) .sp-trigger:not(:disabled):hover { border-color: #475569; }

    .sp-root:focus-within .sp-trigger:not(:disabled) {
      outline: none; border-color: #f97316;
      box-shadow: 0 0 0 3px rgba(249,115,22,0.14);
    }
    .sp-violet:focus-within .sp-trigger:not(:disabled) {
      border-color: #7c3aed;
      box-shadow: 0 0 0 3px rgba(124,58,237,0.14);
    }
    :host-context(.dark) .sp-violet:focus-within .sp-trigger:not(:disabled) {
      border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.18);
    }

    .sp-trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sp-trigger-label--value { color: #1e293b; font-weight: 500; }
    :host-context(.dark) .sp-trigger-label--value { color: #e2e8f0; }
    .sp-trigger-label--placeholder { color: #94a3b8; font-style: italic; }
    :host-context(.dark) .sp-trigger-label--placeholder { color: #475569; }

    .sp-clear-btn { width: 0.875rem; height: 0.875rem; flex-shrink: 0; color: #94a3b8; cursor: pointer; transition: color 150ms; }
    .sp-clear-btn:hover { color: #f43f5e; }
    :host-context(.dark) .sp-clear-btn { color: #64748b; }

    .sp-chevron {
      width: 0.875rem; height: 0.875rem; flex-shrink: 0; color: #94a3b8;
      transition: transform 200ms, color 150ms;
    }
    .sp-violet .sp-chevron { color: #8b5cf6; }
    :host-context(.dark) .sp-chevron { color: #64748b; }
    :host-context(.dark) .sp-violet .sp-chevron { color: #a78bfa; }
    .sp-chevron--open { transform: rotate(180deg); }

    /* ── Popup ── */
    .sp-popup {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 200;
      max-height: 14rem; overflow-y: auto;
      background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 0.875rem; padding: 0.25rem;
      display: flex; flex-direction: column; gap: 1px;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.16), 0 2px 8px -2px rgba(0,0,0,0.08);
      animation: spIn 180ms cubic-bezier(0.23,1,0.32,1) both;
    }
    :host-context(.dark) .sp-popup {
      background: #0f172a; border-color: #1e293b;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.35);
    }
    .sp-open-above .sp-popup { top: auto; bottom: calc(100% + 4px); animation-name: spInUp; }
    .sp-popup::-webkit-scrollbar { width: 5px; }
    .sp-popup::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 9999px; }
    :host-context(.dark) .sp-popup::-webkit-scrollbar-thumb { background: #334155; }

    .sp-opt {
      border: none; background: transparent; cursor: pointer;
      padding: 0.5rem 0.625rem; border-radius: 0.5rem; text-align: left;
      font-size: 0.8125rem; font-weight: 500;
      color: #334155; min-height: 2.25rem;
      transition: background 120ms, color 120ms;
    }
    :host-context(.dark) .sp-opt { color: #cbd5e1; }
    .sp-opt-empty { color: #94a3b8; font-style: italic; }
    :host-context(.dark) .sp-opt-empty { color: #64748b; }

    .sp-opt:hover:not(.sp-opt--on) { background: #f1f5f9; color: #0f172a; }
    :host-context(.dark) .sp-opt:hover:not(.sp-opt--on) { background: #1e293b; color: #f1f5f9; }
    .sp-violet .sp-opt:hover:not(.sp-opt--on) { background: rgba(124,58,237,0.08); color: #6d28d9; }
    :host-context(.dark) .sp-violet .sp-opt:hover:not(.sp-opt--on) { background: rgba(167,139,250,0.12); color: #a78bfa; }

    .sp-opt--on { background: #f97316; color: #fff; font-weight: 700; }
    .sp-violet .sp-opt--on { background: #7c3aed; box-shadow: 0 2px 8px rgba(124,58,237,0.35); }

    @media (prefers-reduced-motion: reduce) {
      .sp-popup { animation: none !important; }
    }
  `],
})
export class SelectPickerComponent implements ControlValueAccessor {
  @Input() options: string[] = [];
  @Input() placeholder = 'Seleccionar';
  @Input() disabled = false;
  @Input() colorScheme: ColorScheme = 'orange';
  /** Si es true, muestra una opción para volver a dejar el campo vacío. */
  @Input() clearable = true;

  private el = inject(ElementRef);

  isOpen = signal(false);
  openAbove = signal(false);

  value: string | null = null;

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  /** Cierre por clic afuera / Escape a nivel de documento — robusto ante
   *  contenedores con overflow/scroll (ver TimePickerComponent). */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.el.nativeElement.contains(target)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.isOpen()) this.close();
  }

  toggle() {
    if (this.disabled) return;
    if (this.isOpen()) { this.close(); return; }
    this.isOpen.set(true);
    this.updateOpenDirection();
  }

  private updateOpenDirection() {
    requestAnimationFrame(() => {
      const host = this.el.nativeElement as HTMLElement;
      const rect = host.getBoundingClientRect();
      const popupH = 224; // 14rem
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      this.openAbove.set(spaceBelow < popupH && spaceAbove > spaceBelow);
    });
  }

  close() {
    this.isOpen.set(false);
    this.onTouched();
  }

  select(opt: string | null) {
    this.value = opt;
    this.onChange(opt);
    this.close();
  }

  clear() {
    this.select(null);
  }

  writeValue(value: string | null): void {
    this.value = value || null;
  }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}

import { Component, Input, signal, computed, forwardRef, ElementRef, inject, HostListener, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type ViewMode = 'calendar' | 'months' | 'years';
type ColorScheme = 'orange' | 'violet' | 'blue';

@Component({
   selector: 'app-date-picker',
   standalone: true,
   imports: [CommonModule],
   providers: [{
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true
   }],
   template: `
    <div class="dp-root"
         [class.dp-violet]="colorScheme === 'violet'"
         [class.dp-blue]="colorScheme === 'blue'"
         [class.dp-field-like]="fieldLike"
         [class.dp-inline]="isInline()"
         [class.dp-open-above]="openAbove()">

      <!-- Trigger -->
      <button
        #trigger
        type="button"
        [disabled]="disabled"
        (click)="toggle()"
        class="dp-trigger"
        [class.dp-trigger-field]="fieldLike"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="selectedDate() ? displayValueFull() : (placeholder || 'Seleccionar fecha')"
        [attr.title]="selectedDate() ? displayValueFull() : null">
        <svg class="dp-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span class="dp-trigger-label"
              [class.dp-trigger-label--value]="!!selectedDate()"
              [class.dp-trigger-label--placeholder]="!selectedDate()">
          {{ displayValue() }}
        </span>
        <svg *ngIf="selectedDate()"
             class="dp-clear-btn"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             (click)="$event.stopPropagation(); clearDate()"
             role="button" aria-label="Limpiar fecha">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <!-- Popup. Con popover="auto" vive en el top layer: no lo recorta ningún
           ancestro con overflow y el cierre por clic fuera / Escape lo da el
           navegador. En modo inline no lleva el atributo y fluye en el flujo. -->
      <div #popup class="dp-popup" role="dialog"
           [attr.popover]="isInline() ? null : 'auto'"
           [class.dp-popup--open]="isOpen()"
           (toggle)="onPopoverToggle($event)">

        <!-- Header -->
        <div class="dp-header">
          <button type="button" class="dp-nav" (click)="prev()" [disabled]="isPrevDisabled()" aria-label="Mes anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <button type="button" class="dp-period"
                  (click)="toggleViewMode()"
                  [disabled]="isRangeLockedToSingleMonth()">
            <span class="dp-period-label">
              {{ viewMode() === 'years'  ? 'Seleccionar año'
               : viewMode() === 'months' ? currentYear()
               : monthNames[currentMonth()] + ' ' + currentYear() }}
            </span>
            <svg *ngIf="!isRangeLockedToSingleMonth()"
                 class="dp-period-chevron"
                 [class.dp-period-chevron--open]="viewMode() !== 'calendar'"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <button type="button" class="dp-nav" (click)="next()" [disabled]="isNextDisabled()" aria-label="Mes siguiente">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- Vista: Años -->
        <div *ngIf="viewMode() === 'years'" class="dp-body dp-years" role="listbox">
          <button *ngFor="let y of yearsList()" type="button"
                  class="dp-year" [class.dp-year--on]="y === currentYear()"
                  (click)="selectYear(y)" [attr.aria-selected]="y === currentYear()" role="option">
            {{ y }}
          </button>
        </div>

        <!-- Vista: Meses -->
        <div *ngIf="viewMode() === 'months'" class="dp-body dp-months" role="listbox">
          <button *ngFor="let m of monthNames; let i = index" type="button"
                  class="dp-month" [class.dp-month--on]="i === currentMonth()"
                  (click)="selectMonth(i)" [attr.aria-selected]="i === currentMonth()" role="option">
            {{ m.slice(0, 3) }}
          </button>
        </div>

        <!-- Vista: Calendario -->
        <div *ngIf="viewMode() === 'calendar'" class="dp-body">
          <div class="dp-weekdays">
            <span *ngFor="let d of dayNames" class="dp-wd">{{ d }}</span>
          </div>
          <div class="dp-grid" role="grid">
            <ng-container *ngFor="let day of calendarDays()">
              <button *ngIf="day !== null" type="button"
                      class="dp-day"
                      [class.dp-day--sel]="isSelected(day)"
                      [class.dp-day--today]="isToday(day) && !isSelected(day)"
                      [class.dp-day--off]="isDayDisabled(day)"
                      (click)="!isDayDisabled(day) && selectDay(day)"
                      [attr.aria-pressed]="isSelected(day)"
                      [attr.aria-label]="day + ' de ' + monthNames[currentMonth()] + ' ' + currentYear()"
                      role="gridcell">
                {{ day }}
              </button>
              <div *ngIf="day === null" class="dp-day dp-day--empty" aria-hidden="true"></div>
            </ng-container>
          </div>
        </div>

        <!-- Footer -->
        <div class="dp-footer">
          <button type="button" class="dp-footer-clear" (click)="clearDate()">Borrar</button>
          <button type="button" class="dp-footer-today"
                  [class.dp-footer-today--off]="isTodayDisabled()"
                  [disabled]="isTodayDisabled()"
                  (click)="selectToday()">
            Hoy
          </button>
        </div>
      </div>
    </div>
  `,
   styles: [`
    /* ── Host ── */
    :host { display: block; position: relative; }

    @keyframes dpIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes dpInUp {
      from { opacity: 0; transform: translateY(4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }

    /* ── Root container ── */
    .dp-root { position: relative; }

    /* ══════════════════════════════════════
       TRIGGER
    ══════════════════════════════════════ */
    .dp-trigger {
      width: 100%; display: flex; align-items: center; gap: 0.5rem;
      cursor: pointer; background: none; border: none; text-align: left;
      transition: border-color 160ms, box-shadow 160ms;
    }
    .dp-trigger:disabled { cursor: not-allowed; opacity: 0.55; }

    /* Field-like variant */
    .dp-trigger-field {
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: 0.625rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      color: #1e293b;
      min-height: 2.5rem;
    }
    @media (max-width: 767px) { .dp-trigger-field { min-height: 2.75rem; font-size: 1rem; } }

    :host-context(.dark) .dp-trigger-field {
      background: #1e293b; border-color: #334155; color: #f1f5f9;
    }
    .dp-trigger-field:not(:disabled):hover { border-color: #94a3b8; }
    :host-context(.dark) .dp-trigger-field:not(:disabled):hover { border-color: #475569; }

    /* Focus */
    .dp-root:focus-within .dp-trigger-field:not(:disabled) {
      outline: none; border-color: #f97316;
      box-shadow: 0 0 0 3px rgba(249,115,22,0.14);
    }
    .dp-violet:focus-within .dp-trigger-field:not(:disabled) {
      border-color: #7c3aed;
      box-shadow: 0 0 0 3px rgba(124,58,237,0.14);
    }
    :host-context(.dark) .dp-violet:focus-within .dp-trigger-field:not(:disabled) {
      border-color: #a78bfa;
      box-shadow: 0 0 0 3px rgba(167,139,250,0.18);
    }

    .dp-trigger-icon {
      width: 1rem; height: 1rem; flex-shrink: 0;
      color: #94a3b8; transition: color 150ms;
    }
    .dp-violet .dp-trigger-icon { color: #8b5cf6; }
    .dp-trigger:not(:disabled):hover .dp-trigger-icon { color: #64748b; }
    .dp-violet .dp-trigger:not(:disabled):hover .dp-trigger-icon { color: #7c3aed; }
    :host-context(.dark) .dp-trigger-icon { color: #64748b; }
    :host-context(.dark) .dp-violet .dp-trigger-icon { color: #a78bfa; }

    .dp-trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dp-trigger-label--value { color: #1e293b; font-weight: 500; font-size: 0.875rem; }
    :host-context(.dark) .dp-trigger-label--value { color: #e2e8f0; }
    .dp-trigger-label--placeholder { color: #94a3b8; font-style: italic; font-size: 0.875rem; }
    :host-context(.dark) .dp-trigger-label--placeholder { color: #475569; }

    .dp-clear-btn {
      width: 0.875rem; height: 0.875rem; flex-shrink: 0;
      color: #94a3b8; cursor: pointer; transition: color 150ms;
    }
    .dp-clear-btn:hover { color: #f43f5e; }
    :host-context(.dark) .dp-clear-btn { color: #64748b; }

    /* ══════════════════════════════════════
       POPUP — top layer vía API popover; el JS lo ancla al trigger con
       coordenadas de viewport (position: fixed).
    ══════════════════════════════════════ */
    .dp-popup {
      position: fixed;
      inset: auto;           /* anula el inset:0 del UA stylesheet del popover */
      margin: 0;             /* idem: el UA centra con margin:auto */
      padding: 0;
      z-index: 200;
      width: 18rem;          /* 288px */
      max-height: calc(100dvh - 1rem);
      overflow-y: auto;
      overscroll-behavior: contain;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.16), 0 2px 8px -2px rgba(0,0,0,0.08);
      /* "backwards" y no "both": con "both" queda un transform en matriz
         identidad que crea stacking context y atrapa al popup. */
      animation: dpIn 180ms cubic-bezier(0.23,1,0.32,1) backwards;
    }
    .dp-popup:not(:popover-open) { display: none; }
    :host-context(.dark) .dp-popup {
      background: #0f172a;
      border-color: #1e293b;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.35);
    }

    /* Apertura hacia arriba: solo cambia la animación; el anclaje lo pone el JS */
    .dp-open-above .dp-popup { animation-name: dpInUp; }

    /* ══════════════════════════════════════
       MODO INLINE (móvil dentro de bottom sheets)
       El calendario fluye bajo el campo en vez de flotar; así nunca se recorta
       por contenedores con overflow y empuja el contenido de forma natural.
    ══════════════════════════════════════ */
    .dp-inline .dp-popup {
      position: static;
      width: 100%;
      max-height: none;
      overflow: visible;
      margin-top: 0.625rem;
      box-shadow: none;
      border-radius: 0.875rem;
      animation: dpIn 160ms cubic-bezier(0.23,1,0.32,1) backwards;
    }
    /* Sin atributo popover, :popover-open nunca casa: la visibilidad la manda
       la clase que refleja isOpen(). */
    .dp-inline .dp-popup.dp-popup--open { display: block; }
    /* Días más grandes para tacto cómodo aprovechando el ancho completo */
    .dp-inline .dp-grid { gap: 0.25rem; }
    .dp-inline .dp-day { max-width: 2.75rem; font-size: 0.9375rem; }
    .dp-inline .dp-weekdays .dp-wd { font-size: 0.75rem; }

    /* ══════════════════════════════════════
       HEADER
    ══════════════════════════════════════ */
    .dp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem 0.75rem 0.5rem;
      border-bottom: 1px solid #f1f5f9;
    }
    :host-context(.dark) .dp-header { border-bottom-color: #1e293b; }

    .dp-nav {
      display: flex; align-items: center; justify-content: center;
      width: 2rem; height: 2rem; border-radius: 0.5rem;
      border: none; background: transparent; color: #64748b; cursor: pointer;
      transition: background 140ms, color 140ms;
    }
    .dp-nav svg { width: 1rem; height: 1rem; }
    .dp-nav:not(:disabled):hover { background: #f1f5f9; color: #1e293b; }
    .dp-nav:disabled { color: #cbd5e1; cursor: not-allowed; }
    :host-context(.dark) .dp-nav:not(:disabled):hover { background: #1e293b; color: #e2e8f0; }
    :host-context(.dark) .dp-nav:disabled { color: #334155; }
    .dp-violet .dp-nav:not(:disabled):hover { background: rgba(124,58,237,0.08); color: #7c3aed; }
    :host-context(.dark) .dp-violet .dp-nav:not(:disabled):hover { background: rgba(167,139,250,0.1); color: #a78bfa; }

    .dp-period {
      display: flex; align-items: center; gap: 0.25rem;
      padding: 0.25rem 0.625rem; border: none; border-radius: 0.5rem;
      background: transparent; cursor: pointer;
      font-size: 0.875rem; font-weight: 700;
      color: #1e293b; transition: background 140ms, color 140ms;
    }
    :host-context(.dark) .dp-period { color: #f1f5f9; }
    .dp-period:not(:disabled):hover { background: #f1f5f9; }
    :host-context(.dark) .dp-period:not(:disabled):hover { background: #1e293b; }
    .dp-period:disabled { cursor: default; }
    .dp-violet .dp-period:not(:disabled):hover { background: rgba(124,58,237,0.08); color: #6d28d9; }
    :host-context(.dark) .dp-violet .dp-period:not(:disabled):hover { background: rgba(167,139,250,0.08); color: #a78bfa; }

    .dp-period-label { white-space: nowrap; }
    .dp-period-chevron { width: 0.75rem; height: 0.75rem; color: #94a3b8; transition: transform 200ms; }
    .dp-period-chevron--open { transform: rotate(180deg); }

    /* ══════════════════════════════════════
       BODY — área de días / meses / años
    ══════════════════════════════════════ */
    .dp-body { padding: 0.25rem 0.625rem 0.5rem; }

    /* Años */
    .dp-years { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.25rem; max-height: 14rem; overflow-y: auto; }
    .dp-year, .dp-month {
      padding: 0.4375rem; border: none; border-radius: 0.5rem;
      font-size: 0.8125rem; font-weight: 500; background: transparent;
      color: #475569; cursor: pointer;
      transition: background 120ms, color 120ms;
    }
    :host-context(.dark) .dp-year, :host-context(.dark) .dp-month { color: #94a3b8; }
    .dp-year:hover:not(.dp-year--on), .dp-month:hover:not(.dp-month--on) {
      background: #f1f5f9; color: #0f172a;
    }
    :host-context(.dark) .dp-year:hover:not(.dp-year--on),
    :host-context(.dark) .dp-month:hover:not(.dp-month--on) { background: #1e293b; color: #f1f5f9; }

    .dp-year--on, .dp-month--on { background: #f97316; color: #fff; font-weight: 700; }
    .dp-violet .dp-year--on, .dp-violet .dp-month--on { background: #7c3aed; }
    .dp-violet .dp-year:hover:not(.dp-year--on),
    .dp-violet .dp-month:hover:not(.dp-month--on) { background: rgba(124,58,237,0.08); color: #6d28d9; }

    /* Meses */
    .dp-months { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.25rem; }

    /* Encabezados de día de la semana */
    .dp-weekdays {
      display: grid; grid-template-columns: repeat(7,1fr);
      padding-bottom: 0.25rem;
    }
    .dp-wd {
      text-align: center;
      font-size: 0.625rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: #94a3b8;
    }
    :host-context(.dark) .dp-wd { color: #475569; }

    /* Grid de días */
    .dp-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; }

    .dp-day {
      display: flex; align-items: center; justify-content: center;
      aspect-ratio: 1; width: 100%; max-width: 2.25rem; margin: 0 auto;
      border: none; border-radius: 9999px; background: transparent;
      font-size: 0.8125rem; font-weight: 500;
      color: #334155; cursor: pointer;
      transition: background 120ms, color 120ms, transform 100ms;
    }
    :host-context(.dark) .dp-day { color: #cbd5e1; }
    .dp-day--empty { pointer-events: none; }

    /* Hover */
    .dp-day:not(.dp-day--sel):not(.dp-day--off):not(.dp-day--empty):hover {
      background: #f1f5f9; color: #0f172a; transform: scale(1.1);
    }
    :host-context(.dark) .dp-day:not(.dp-day--sel):not(.dp-day--off):not(.dp-day--empty):hover {
      background: #1e293b; color: #f8fafc;
    }
    .dp-violet .dp-day:not(.dp-day--sel):not(.dp-day--off):not(.dp-day--empty):hover {
      background: rgba(124,58,237,0.08); color: #6d28d9;
    }
    :host-context(.dark) .dp-violet .dp-day:not(.dp-day--sel):not(.dp-day--off):not(.dp-day--empty):hover {
      background: rgba(167,139,250,0.12); color: #a78bfa;
    }

    /* Seleccionado — orange */
    .dp-day--sel {
      background: #f97316; color: #fff; font-weight: 700;
      box-shadow: 0 2px 8px rgba(249,115,22,0.35);
    }
    .dp-day--sel:hover { background: #ea580c; transform: scale(1.05); }

    /* Seleccionado — violet */
    .dp-violet .dp-day--sel {
      background: #7c3aed;
      box-shadow: 0 2px 8px rgba(124,58,237,0.4);
    }
    .dp-violet .dp-day--sel:hover { background: #6d28d9; }

    /* Hoy — orange */
    .dp-day--today { color: #f97316; font-weight: 700; box-shadow: inset 0 0 0 1.5px #f97316; }
    :host-context(.dark) .dp-day--today { color: #fb923c; box-shadow: inset 0 0 0 1.5px #fb923c; }

    /* Hoy — violet */
    .dp-violet .dp-day--today { color: #7c3aed; box-shadow: inset 0 0 0 1.5px #7c3aed; }
    :host-context(.dark) .dp-violet .dp-day--today { color: #a78bfa; box-shadow: inset 0 0 0 1.5px #a78bfa; }

    /* Deshabilitado */
    .dp-day--off { color: #cbd5e1; cursor: not-allowed; opacity: 0.45; }
    :host-context(.dark) .dp-day--off { color: #334155; }

    /* ══════════════════════════════════════
       FOOTER
    ══════════════════════════════════════ */
    .dp-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.5rem 0.875rem 0.625rem;
      border-top: 1px solid #f1f5f9;
    }
    :host-context(.dark) .dp-footer { border-top-color: #1e293b; }

    .dp-footer-clear, .dp-footer-today {
      font-size: 0.75rem; font-weight: 600;
      background: none; border: none; cursor: pointer;
      padding: 0.25rem 0.5rem; border-radius: 0.375rem;
      transition: color 150ms, background 150ms;
    }
    .dp-footer-clear { color: #94a3b8; }
    .dp-footer-clear:hover { color: #f43f5e; background: rgba(244,63,94,0.07); }
    :host-context(.dark) .dp-footer-clear { color: #475569; }
    :host-context(.dark) .dp-footer-clear:hover { color: #fb7185; }

    .dp-footer-today { color: #f97316; }
    .dp-footer-today:hover:not(.dp-footer-today--off) { color: #ea580c; background: rgba(249,115,22,0.07); }
    .dp-violet .dp-footer-today { color: #7c3aed; }
    .dp-violet .dp-footer-today:hover:not(.dp-footer-today--off) { color: #6d28d9; background: rgba(124,58,237,0.07); }
    :host-context(.dark) .dp-violet .dp-footer-today { color: #a78bfa; }

    .dp-footer-today--off { color: #cbd5e1 !important; cursor: not-allowed; }
    :host-context(.dark) .dp-footer-today--off { color: #334155 !important; }

    /* ── Blue (Exhibidores) ─────────────────────────────── */
    .dp-blue:focus-within .dp-trigger-field:not(:disabled) {
      border-color: #165cfc;
      box-shadow: 0 0 0 3px rgba(22,92,252,0.14);
    }
    :host-context(.dark) .dp-blue:focus-within .dp-trigger-field:not(:disabled) {
      border-color: #6091fb; box-shadow: 0 0 0 3px rgba(96,145,251,0.18);
    }
    .dp-blue .dp-trigger-icon { color: #3b73fc; }
    .dp-blue .dp-trigger:not(:disabled):hover .dp-trigger-icon { color: #165cfc; }
    :host-context(.dark) .dp-blue .dp-trigger-icon { color: #6091fb; }
    .dp-blue .dp-nav:not(:disabled):hover { background: rgba(22,92,252,0.08); color: #165cfc; }
    :host-context(.dark) .dp-blue .dp-nav:not(:disabled):hover { background: rgba(96,145,251,0.1); color: #6091fb; }
    .dp-blue .dp-period:not(:disabled):hover { background: rgba(22,92,252,0.08); color: #0d47d0; }
    :host-context(.dark) .dp-blue .dp-period:not(:disabled):hover { background: rgba(96,145,251,0.08); color: #6091fb; }
    .dp-blue .dp-year--on, .dp-blue .dp-month--on { background: #165cfc; }
    .dp-blue .dp-year:hover:not(.dp-year--on),
    .dp-blue .dp-month:hover:not(.dp-month--on) { background: rgba(22,92,252,0.08); color: #0d47d0; }
    .dp-blue .dp-day:not(.dp-day--sel):not(.dp-day--off):not(.dp-day--empty):hover {
      background: rgba(22,92,252,0.08); color: #0d47d0;
    }
    :host-context(.dark) .dp-blue .dp-day:not(.dp-day--sel):not(.dp-day--off):not(.dp-day--empty):hover {
      background: rgba(96,145,251,0.1); color: #6091fb;
    }
    .dp-blue .dp-day--sel {
      background: #165cfc;
      box-shadow: 0 2px 8px rgba(22,92,252,0.4);
    }
    .dp-blue .dp-day--sel:hover { background: #0d47d0; }
    .dp-blue .dp-day--today { color: #165cfc; box-shadow: inset 0 0 0 1.5px #165cfc; }
    :host-context(.dark) .dp-blue .dp-day--today { color: #6091fb; box-shadow: inset 0 0 0 1.5px #6091fb; }
    .dp-blue .dp-footer-today { color: #165cfc; }
    .dp-blue .dp-footer-today:hover:not(.dp-footer-today--off) { color: #0d47d0; background: rgba(22,92,252,0.07); }
    :host-context(.dark) .dp-blue .dp-footer-today { color: #6091fb; }
  `]
})
export class DatePickerComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
   @Input() placeholder = 'dd/mm/aaaa';
   @Input() disabled = false;
   @Input() minDate: string | null = null;
   @Input() maxDate: string | null = null;
   @Input() colorScheme: ColorScheme = 'orange';
   @Input() fieldLike = false;
   /** En móvil (<768px), renderiza el calendario en el flujo (no como popup flotante),
       para que no se recorte dentro de contenedores con overflow (bottom sheets, etc.). */
   @Input() inlineOnMobile = false;

   private el = inject(ElementRef);
   @ViewChild('trigger') private triggerRef?: ElementRef<HTMLButtonElement>;
   @ViewChild('popup') private popupRef?: ElementRef<HTMLDivElement>;

   /** Instante del último cierre, para distinguir el light-dismiss del popover
    *  de un clic de cierre intencionado sobre el trigger. */
   private lastCloseAt = 0;

   /**
    * Cierre por clic afuera / Escape. Solo hace falta en modo inline: cuando
    * el calendario va en el top layer, el propio navegador se encarga.
    */
   @HostListener('document:click', ['$event'])
   onDocumentClick(event: MouseEvent) {
      if (!this.isOpen() || !this.isInline()) return;
      const target = event.target as Node | null;
      if (target && !this.el.nativeElement.contains(target)) this.close();
   }

   @HostListener('document:keydown.escape')
   onEscape() {
      if (this.isOpen() && this.isInline()) this.close();
   }

   isOpen    = signal(false);
   openAbove = signal(false);
   isInline   = signal(false);

   selectedDate = signal<Date | null>(null);
   currentMonth = signal(new Date().getMonth());
   currentYear  = signal(new Date().getFullYear());
   viewMode     = signal<ViewMode>('calendar');
   yearRangeStart = signal(new Date().getFullYear() - 11);

   monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
   monthNamesShort = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
   dayNames   = ['D','L','M','M','J','V','S'];

   private onChange: (v: string | null) => void = () => {};
   private onTouched: () => void = () => {};

   private parseDate(value: string | null): Date | null {
      if (!value) return null;
      const p = value.split('-');
      if (p.length !== 3) return null;
      return new Date(+p[0], +p[1] - 1, +p[2]);
   }
   private get parsedMin() { return this.parseDate(this.minDate); }
   private get parsedMax() { return this.parseDate(this.maxDate); }

   isDayDisabled(day: number): boolean {
      const min = this.parsedMin, max = this.parsedMax;
      if (!min && !max) return false;
      const d = new Date(this.currentYear(), this.currentMonth(), day);
      if (min && d < min) return true;
      if (max && d > max) return true;
      return false;
   }

   isPrevDisabled(): boolean {
      const min = this.parsedMin;
      if (!min) return false;
      if (this.viewMode() === 'calendar')
         return this.currentYear() < min.getFullYear() ||
            (this.currentYear() === min.getFullYear() && this.currentMonth() <= min.getMonth());
      if (this.viewMode() === 'months') return this.currentYear() <= min.getFullYear();
      return false;
   }

   isNextDisabled(): boolean {
      const max = this.parsedMax;
      if (!max) return false;
      if (this.viewMode() === 'calendar')
         return this.currentYear() > max.getFullYear() ||
            (this.currentYear() === max.getFullYear() && this.currentMonth() >= max.getMonth());
      if (this.viewMode() === 'months') return this.currentYear() >= max.getFullYear();
      return false;
   }

   isRangeLockedToSingleMonth(): boolean {
      const min = this.parsedMin, max = this.parsedMax;
      if (!min || !max) return false;
      return min.getFullYear() === max.getFullYear() && min.getMonth() === max.getMonth();
   }

   isTodayDisabled(): boolean {
      const t = new Date(), min = this.parsedMin, max = this.parsedMax;
      if (min && t < min) return true;
      if (max && t > max) return true;
      return false;
   }

   /** Texto visible del campo: compacto para que no se corte en columnas
    *  angostas (2 por fila, sidebars, etc.) sin perder la fecha exacta. */
   displayValue = computed(() => {
      const d = this.selectedDate();
      if (!d) return this.placeholder;
      return `${d.getDate()} ${this.monthNamesShort[d.getMonth()]} ${d.getFullYear()}`;
   });

   /** Versión larga y descriptiva — solo para title/aria-label (tooltip y lectores de pantalla). */
   displayValueFull = computed(() => {
      const d = this.selectedDate();
      if (!d) return this.placeholder;
      const weekDay = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][d.getDay()];
      const month   = this.monthNames[d.getMonth()].toLowerCase();
      return `${weekDay.charAt(0).toUpperCase() + weekDay.slice(1)} ${d.getDate()} de ${month}, ${d.getFullYear()}`;
   });

   yearsList = computed(() => {
      const years: number[] = [];
      const start = this.yearRangeStart();
      for (let i = start + 11; i >= start; i--) years.push(i);
      return years;
   });

   calendarDays = computed(() => {
      const year = this.currentYear(), month = this.currentMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const days: (number | null)[] = [];
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(i);
      return days;
   });

   private reposition = () => this.position();

   ngAfterViewInit() {
      // En captura, para enterarse también del scroll de contenedores internos
      // (el panel de edición scrollea por dentro, no la ventana).
      document.addEventListener('scroll', this.reposition, { capture: true, passive: true });
      window.addEventListener('resize', this.reposition, { passive: true });
   }

   ngOnDestroy() {
      document.removeEventListener('scroll', this.reposition, { capture: true });
      window.removeEventListener('resize', this.reposition);
   }

   toggle() {
      if (this.disabled) return;
      if (this.isOpen()) { this.close(); return; }
      // El light-dismiss del popover ya cerró en el pointerdown; sin esta
      // guarda, el click posterior sobre el trigger lo reabriría al instante.
      if (performance.now() - this.lastCloseAt < 200) return;
      this.open();
   }

   open() {
      const date = this.selectedDate() ?? this.parsedMin ?? new Date();
      this.currentMonth.set(date.getMonth());
      this.currentYear.set(date.getFullYear());
      this.yearRangeStart.set(date.getFullYear() - 11);
      this.viewMode.set('calendar');

      const inline = this.inlineOnMobile && window.innerWidth < 768;
      this.isInline.set(inline);

      if (inline) {
         // El calendario fluye bajo el campo; nos aseguramos de que quede visible al scroll.
         this.isOpen.set(true);
         requestAnimationFrame(() => {
            this.popupRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
         });
         return;
      }

      // rAF: el atributo `popover` se escribe según isInline(), así que hay
      // que dejar que Angular actualice el DOM antes de llamar a showPopover().
      requestAnimationFrame(() => {
         const popup = this.popupRef?.nativeElement;
         if (!popup?.hasAttribute('popover')) return;
         popup.showPopover();
         this.position();
      });
   }

   /** Ancla el popup al trigger en coordenadas de viewport. Al vivir en el
    *  top layer no lo recorta ningún contenedor, así que basta con que quepa
    *  en la ventana. */
   private position() {
      const trigger = this.triggerRef?.nativeElement;
      const popup = this.popupRef?.nativeElement;
      // Se consulta el estado real del popover y no la señal: el evento
      // `toggle` que la actualiza llega después de showPopover().
      if (!trigger || !popup || !popup.matches(':popover-open')) return;

      const r = trigger.getBoundingClientRect();
      const ancho = popup.offsetWidth || 288;
      const alto = popup.offsetHeight || 340;
      const margen = 8;

      const espacioAbajo = window.innerHeight - r.bottom;
      const espacioArriba = r.top;
      const arriba = espacioAbajo < alto + margen && espacioArriba > espacioAbajo;
      this.openAbove.set(arriba);

      popup.style.left = `${Math.max(margen, Math.min(r.left, window.innerWidth - ancho - margen))}px`;
      if (arriba) {
         popup.style.top = 'auto';
         popup.style.bottom = `${window.innerHeight - r.top + 4}px`;
      } else {
         popup.style.bottom = 'auto';
         popup.style.top = `${r.bottom + 4}px`;
      }
   }

   /** El navegador también cierra por su cuenta (Escape, clic fuera). */
   onPopoverToggle(event: Event) {
      const abierto = (event as ToggleEvent).newState === 'open';
      this.isOpen.set(abierto);
      if (!abierto) {
         this.lastCloseAt = performance.now();
         this.viewMode.set('calendar');
         this.onTouched();
      }
   }

   close() {
      if (this.isInline()) {
         this.isOpen.set(false);
         this.viewMode.set('calendar');
         this.onTouched();
         return;
      }
      const popup = this.popupRef?.nativeElement;
      if (popup?.matches(':popover-open')) popup.hidePopover();
   }

   toggleViewMode() {
      if (this.isRangeLockedToSingleMonth()) return;
      const m = this.viewMode();
      this.viewMode.set(m === 'calendar' ? 'years' : m === 'years' ? 'months' : 'calendar');
   }

   prev() {
      if (this.isPrevDisabled()) return;
      if (this.viewMode() === 'years') { this.yearRangeStart.update(y => y - 12); }
      else if (this.viewMode() === 'months') { this.currentYear.update(y => y - 1); }
      else if (this.currentMonth() === 0) { this.currentMonth.set(11); this.currentYear.update(y => y - 1); }
      else { this.currentMonth.update(m => m - 1); }
   }

   next() {
      if (this.isNextDisabled()) return;
      if (this.viewMode() === 'years') { this.yearRangeStart.update(y => y + 12); }
      else if (this.viewMode() === 'months') { this.currentYear.update(y => y + 1); }
      else if (this.currentMonth() === 11) { this.currentMonth.set(0); this.currentYear.update(y => y + 1); }
      else { this.currentMonth.update(m => m + 1); }
   }

   selectYear(year: number) { this.currentYear.set(year); this.viewMode.set('months'); }
   selectMonth(m: number)   { this.currentMonth.set(m);   this.viewMode.set('calendar'); }

   selectDay(day: number) {
      if (this.isDayDisabled(day)) return;
      const d = new Date(this.currentYear(), this.currentMonth(), day);
      this.selectedDate.set(d);
      this.emitValue(d);
      this.close();
   }

   selectToday() {
      if (this.isTodayDisabled()) return;
      const t = new Date();
      this.selectedDate.set(t);
      this.currentMonth.set(t.getMonth());
      this.currentYear.set(t.getFullYear());
      this.emitValue(t);
      this.close();
   }

   clearDate() { this.selectedDate.set(null); this.onChange(null); this.close(); }

   isSelected(day: number): boolean {
      const s = this.selectedDate();
      return !!s && s.getDate() === day && s.getMonth() === this.currentMonth() && s.getFullYear() === this.currentYear();
   }

   isToday(day: number): boolean {
      const t = new Date();
      return t.getDate() === day && t.getMonth() === this.currentMonth() && t.getFullYear() === this.currentYear();
   }

   private emitValue(d: Date) {
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      this.onChange(`${d.getFullYear()}-${m}-${day}`);
   }

   writeValue(value: string | null): void {
      if (value) {
         const p = value.split('-');
         this.selectedDate.set(p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null);
      } else {
         this.selectedDate.set(null);
      }
   }
   registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
   registerOnTouched(fn: () => void): void { this.onTouched = fn; }
   setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}

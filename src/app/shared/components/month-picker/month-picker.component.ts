import { Component, Input, signal, computed, forwardRef, ElementRef, inject, HostListener, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type ViewMode = 'months' | 'years';
type ColorScheme = 'orange' | 'violet' | 'blue' | 'teal' | 'rose';

/**
 * Selector de mes/año con el mismo lenguaje visual que <app-date-picker>.
 *
 * Existe porque `<input type="month">` abre el selector nativo del navegador
 * (blanco, en inglés a medias, sin modo oscuro) y no hay forma de darle estilo.
 * El valor que entra y sale es "YYYY-MM", igual que el del input nativo, así
 * que sustituirlo no toca ni el modelo ni el backend.
 */
@Component({
   selector: 'app-month-picker',
   standalone: true,
   imports: [CommonModule],
   providers: [{
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MonthPickerComponent),
      multi: true
   }],
   template: `
    <div class="mp-root"
         [class.mp-violet]="colorScheme === 'violet'"
         [class.mp-blue]="colorScheme === 'blue'"
         [class.mp-teal]="colorScheme === 'teal'"
         [class.mp-rose]="colorScheme === 'rose'"
         [class.mp-inline]="isInline()"
         [class.mp-open-above]="openAbove()">

      <!-- Trigger -->
      <button
        #trigger
        type="button"
        [disabled]="disabled"
        (click)="toggle()"
        class="mp-trigger"
        [attr.aria-haspopup]="'dialog'"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="selected() ? displayValueFull() : (placeholder || 'Seleccionar mes')"
        [attr.title]="selected() ? displayValueFull() : null">
        <svg class="mp-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span class="mp-trigger-label"
              [class.mp-trigger-label--value]="!!selected()"
              [class.mp-trigger-label--placeholder]="!selected()">
          {{ displayValue() }}
        </span>
        <svg *ngIf="selected() && !disabled"
             class="mp-clear-btn"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             (click)="$event.stopPropagation(); clear()"
             role="button" aria-label="Limpiar mes">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <!-- Popup. Con popover="auto" vive en el top layer: no lo recorta ningún
           ancestro con overflow y el cierre por clic fuera / Escape lo da el
           navegador. En modo inline no lleva el atributo y fluye en el flujo. -->
      <div #popup class="mp-popup" role="dialog"
           [attr.popover]="isInline() ? null : 'auto'"
           [class.mp-popup--open]="isOpen()"
           (toggle)="onPopoverToggle($event)">

        <!-- Header -->
        <div class="mp-header">
          <button type="button" class="mp-nav" (click)="prev()" [disabled]="isPrevDisabled()"
                  [attr.aria-label]="viewMode() === 'years' ? 'Años anteriores' : 'Año anterior'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <button type="button" class="mp-period" (click)="toggleViewMode()">
            <span class="mp-period-label">
              {{ viewMode() === 'years' ? 'Seleccionar año' : currentYear() }}
            </span>
            <svg class="mp-period-chevron"
                 [class.mp-period-chevron--open]="viewMode() === 'years'"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <button type="button" class="mp-nav" (click)="next()" [disabled]="isNextDisabled()"
                  [attr.aria-label]="viewMode() === 'years' ? 'Años siguientes' : 'Año siguiente'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- Vista: Años -->
        <div *ngIf="viewMode() === 'years'" class="mp-body mp-years" role="listbox">
          <button *ngFor="let y of yearsList()" type="button"
                  class="mp-year"
                  [class.mp-year--on]="y === currentYear()"
                  [class.mp-year--off]="isYearDisabled(y)"
                  [disabled]="isYearDisabled(y)"
                  (click)="selectYear(y)" [attr.aria-selected]="y === currentYear()" role="option">
            {{ y }}
          </button>
        </div>

        <!-- Vista: Meses -->
        <div *ngIf="viewMode() === 'months'" class="mp-body mp-months" role="listbox">
          <button *ngFor="let m of monthNamesShort; let i = index" type="button"
                  class="mp-month"
                  [class.mp-month--sel]="isSelected(i)"
                  [class.mp-month--now]="isCurrentMonth(i) && !isSelected(i)"
                  [class.mp-month--off]="isMonthDisabled(i)"
                  [disabled]="isMonthDisabled(i)"
                  (click)="selectMonth(i)"
                  [attr.aria-selected]="isSelected(i)"
                  [attr.aria-label]="monthNames[i] + ' de ' + currentYear()"
                  role="option">
            {{ m }}
          </button>
        </div>

        <!-- Footer -->
        <div class="mp-footer">
          <button type="button" class="mp-footer-clear" (click)="clear()">Borrar</button>
          <button type="button" class="mp-footer-now"
                  [class.mp-footer-now--off]="isThisMonthDisabled()"
                  [disabled]="isThisMonthDisabled()"
                  (click)="selectThisMonth()">
            Este mes
          </button>
        </div>
      </div>
    </div>
  `,
   styles: [`
    /* ── Host ── */
    :host { display: block; position: relative; }

    @keyframes mpIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes mpInUp {
      from { opacity: 0; transform: translateY(4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }

    /* ── Acento por esquema: un solo juego de variables que tiñe trigger,
         header, meses y footer. ── */
    .mp-root {
      position: relative;
      --mp-accent: #f97316;
      --mp-accent-strong: #ea580c;
      --mp-accent-dark: #fb923c;
      --mp-accent-rgb: 249,115,22;
    }
    .mp-violet { --mp-accent: #7c3aed; --mp-accent-strong: #6d28d9; --mp-accent-dark: #a78bfa; --mp-accent-rgb: 124,58,237; }
    .mp-blue   { --mp-accent: #165cfc; --mp-accent-strong: #0d47d0; --mp-accent-dark: #6091fb; --mp-accent-rgb: 22,92,252; }
    .mp-teal   { --mp-accent: #0d9488; --mp-accent-strong: #0f766e; --mp-accent-dark: #2dd4bf; --mp-accent-rgb: 13,148,136; }
    .mp-rose   { --mp-accent: #e11d48; --mp-accent-strong: #be123c; --mp-accent-dark: #fb7185; --mp-accent-rgb: 225,29,72; }

    /* ══════════════════════════════════════
       TRIGGER — mismas medidas que los campos del modal (campoModal)
    ══════════════════════════════════════ */
    .mp-trigger {
      width: 100%; display: flex; align-items: center; gap: 0.5rem;
      cursor: pointer; text-align: left;
      min-height: 2.5rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: 0.75rem;
      font-size: 0.875rem;
      color: #1e293b;
      transition: border-color 150ms, box-shadow 150ms;
    }
    :host-context(.dark) .mp-trigger { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    .mp-trigger:disabled { cursor: not-allowed; opacity: 0.55; }
    .mp-trigger:not(:disabled):hover { border-color: #94a3b8; }
    :host-context(.dark) .mp-trigger:not(:disabled):hover { border-color: #475569; }

    .mp-root:focus-within .mp-trigger:not(:disabled) {
      outline: none;
      border-color: var(--mp-accent);
      box-shadow: 0 0 0 3px rgba(var(--mp-accent-rgb), 0.16);
    }
    :host-context(.dark) .mp-root:focus-within .mp-trigger:not(:disabled) {
      border-color: var(--mp-accent-dark);
      box-shadow: 0 0 0 3px rgba(var(--mp-accent-rgb), 0.22);
    }

    .mp-trigger-icon {
      width: 1rem; height: 1rem; flex-shrink: 0;
      color: var(--mp-accent); transition: color 150ms;
    }
    :host-context(.dark) .mp-trigger-icon { color: var(--mp-accent-dark); }

    .mp-trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mp-trigger-label--value { color: #1e293b; font-weight: 500; }
    :host-context(.dark) .mp-trigger-label--value { color: #e2e8f0; }
    .mp-trigger-label--placeholder { color: #94a3b8; }
    :host-context(.dark) .mp-trigger-label--placeholder { color: #64748b; }

    .mp-clear-btn {
      width: 0.875rem; height: 0.875rem; flex-shrink: 0;
      color: #94a3b8; cursor: pointer; transition: color 150ms;
    }
    .mp-clear-btn:hover { color: #f43f5e; }
    :host-context(.dark) .mp-clear-btn { color: #64748b; }

    /* ══════════════════════════════════════
       POPUP
    ══════════════════════════════════════ */
    .mp-popup {
      position: fixed;
      inset: auto;           /* anula el inset:0 del UA stylesheet del popover */
      margin: 0;             /* idem: el UA centra con margin:auto */
      padding: 0;
      z-index: 200;
      width: 16.5rem;
      max-height: calc(100dvh - 1rem);
      overflow-y: auto;
      overscroll-behavior: contain;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.16), 0 2px 8px -2px rgba(0,0,0,0.08);
      /* "backwards" y no "both": con "both" queda un transform en matriz
         identidad que crea stacking context y atrapa al popup. */
      animation: mpIn 180ms cubic-bezier(0.23,1,0.32,1) backwards;
    }
    .mp-popup:not(:popover-open) { display: none; }
    :host-context(.dark) .mp-popup {
      background: #0f172a;
      border-color: #1e293b;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.35);
    }
    .mp-open-above .mp-popup { animation-name: mpInUp; }

    /* Modo inline (móvil dentro de hojas con overflow) */
    .mp-inline .mp-popup {
      position: static;
      width: 100%;
      max-height: none;
      overflow: visible;
      margin-top: 0.625rem;
      box-shadow: none;
      border-radius: 0.875rem;
      animation: mpIn 160ms cubic-bezier(0.23,1,0.32,1) backwards;
    }
    /* Sin atributo popover, :popover-open nunca casa: la visibilidad la manda
       la clase que refleja isOpen(). */
    .mp-inline .mp-popup.mp-popup--open { display: block; }
    .mp-inline .mp-month { padding: 0.75rem 0.25rem; font-size: 0.875rem; }

    /* ══════════════════════════════════════
       HEADER
    ══════════════════════════════════════ */
    .mp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem 0.75rem 0.5rem;
      border-bottom: 1px solid #f1f5f9;
    }
    :host-context(.dark) .mp-header { border-bottom-color: #1e293b; }

    .mp-nav {
      display: flex; align-items: center; justify-content: center;
      width: 2rem; height: 2rem; border-radius: 0.5rem;
      border: none; background: transparent; color: #64748b; cursor: pointer;
      transition: background 140ms, color 140ms;
    }
    .mp-nav svg { width: 1rem; height: 1rem; }
    .mp-nav:not(:disabled):hover { background: rgba(var(--mp-accent-rgb), 0.08); color: var(--mp-accent); }
    .mp-nav:disabled { color: #cbd5e1; cursor: not-allowed; }
    :host-context(.dark) .mp-nav:not(:disabled):hover { background: rgba(var(--mp-accent-rgb), 0.14); color: var(--mp-accent-dark); }
    :host-context(.dark) .mp-nav:disabled { color: #334155; }

    .mp-period {
      display: flex; align-items: center; gap: 0.25rem;
      padding: 0.25rem 0.625rem; border: none; border-radius: 0.5rem;
      background: transparent; cursor: pointer;
      font-size: 0.875rem; font-weight: 700;
      color: #1e293b; transition: background 140ms, color 140ms;
    }
    :host-context(.dark) .mp-period { color: #f1f5f9; }
    .mp-period:hover { background: rgba(var(--mp-accent-rgb), 0.08); color: var(--mp-accent-strong); }
    :host-context(.dark) .mp-period:hover { background: rgba(var(--mp-accent-rgb), 0.14); color: var(--mp-accent-dark); }

    .mp-period-label { white-space: nowrap; }
    .mp-period-chevron { width: 0.75rem; height: 0.75rem; color: #94a3b8; transition: transform 200ms; }
    .mp-period-chevron--open { transform: rotate(180deg); }

    /* ══════════════════════════════════════
       BODY
    ══════════════════════════════════════ */
    .mp-body { padding: 0.5rem 0.625rem 0.5rem; }

    .mp-years  { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.25rem; max-height: 14rem; overflow-y: auto; }
    .mp-months { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.25rem; }

    .mp-year, .mp-month {
      padding: 0.5rem 0.25rem; border: none; border-radius: 0.625rem;
      font-size: 0.8125rem; font-weight: 500; background: transparent;
      color: #475569; cursor: pointer;
      transition: background 120ms, color 120ms, transform 100ms;
    }
    :host-context(.dark) .mp-year, :host-context(.dark) .mp-month { color: #94a3b8; }

    .mp-year:not(.mp-year--on):not(.mp-year--off):hover,
    .mp-month:not(.mp-month--sel):not(.mp-month--off):hover {
      background: rgba(var(--mp-accent-rgb), 0.08);
      color: var(--mp-accent-strong);
      transform: translateY(-1px);
    }
    :host-context(.dark) .mp-year:not(.mp-year--on):not(.mp-year--off):hover,
    :host-context(.dark) .mp-month:not(.mp-month--sel):not(.mp-month--off):hover {
      background: rgba(var(--mp-accent-rgb), 0.16);
      color: var(--mp-accent-dark);
    }

    .mp-year--on, .mp-month--sel {
      background: var(--mp-accent); color: #fff; font-weight: 700;
      box-shadow: 0 2px 8px rgba(var(--mp-accent-rgb), 0.35);
    }
    .mp-year--on:hover, .mp-month--sel:hover { background: var(--mp-accent-strong); }

    /* Mes en curso, sin seleccionar */
    .mp-month--now {
      color: var(--mp-accent); font-weight: 700;
      box-shadow: inset 0 0 0 1.5px var(--mp-accent);
    }
    :host-context(.dark) .mp-month--now {
      color: var(--mp-accent-dark); box-shadow: inset 0 0 0 1.5px var(--mp-accent-dark);
    }

    .mp-month--off, .mp-year--off { color: #cbd5e1; cursor: not-allowed; opacity: 0.45; }
    :host-context(.dark) .mp-month--off, :host-context(.dark) .mp-year--off { color: #334155; }

    /* ══════════════════════════════════════
       FOOTER
    ══════════════════════════════════════ */
    .mp-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.5rem 0.875rem 0.625rem;
      border-top: 1px solid #f1f5f9;
    }
    :host-context(.dark) .mp-footer { border-top-color: #1e293b; }

    .mp-footer-clear, .mp-footer-now {
      font-size: 0.75rem; font-weight: 600;
      background: none; border: none; cursor: pointer;
      padding: 0.25rem 0.5rem; border-radius: 0.375rem;
      transition: color 150ms, background 150ms;
    }
    .mp-footer-clear { color: #94a3b8; }
    .mp-footer-clear:hover { color: #f43f5e; background: rgba(244,63,94,0.07); }
    :host-context(.dark) .mp-footer-clear { color: #475569; }
    :host-context(.dark) .mp-footer-clear:hover { color: #fb7185; }

    .mp-footer-now { color: var(--mp-accent); }
    .mp-footer-now:hover:not(.mp-footer-now--off) { color: var(--mp-accent-strong); background: rgba(var(--mp-accent-rgb), 0.08); }
    :host-context(.dark) .mp-footer-now { color: var(--mp-accent-dark); }
    .mp-footer-now--off { color: #cbd5e1 !important; cursor: not-allowed; }
    :host-context(.dark) .mp-footer-now--off { color: #334155 !important; }
  `]
})
export class MonthPickerComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
   @Input() placeholder = 'Mes y año';
   @Input() disabled = false;
   /** Límites en formato "YYYY-MM" (inclusivos). */
   @Input() minMonth: string | null = null;
   @Input() maxMonth: string | null = null;
   @Input() colorScheme: ColorScheme = 'orange';
   /** En móvil (<768px), abre el panel en el flujo para que no lo recorten
       contenedores con overflow (bottom sheets, modales que scrollean). */
   @Input() inlineOnMobile = false;

   private el = inject(ElementRef);
   @ViewChild('trigger') private triggerRef?: ElementRef<HTMLButtonElement>;
   @ViewChild('popup') private popupRef?: ElementRef<HTMLDivElement>;

   /** Instante del último cierre, para distinguir el light-dismiss del popover
    *  de un clic de cierre intencionado sobre el trigger. */
   private lastCloseAt = 0;

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
   isInline  = signal(false);

   /** Mes elegido como índice absoluto (año*12 + mes), o null. */
   selected    = signal<{ year: number; month: number } | null>(null);
   currentYear = signal(new Date().getFullYear());
   viewMode    = signal<ViewMode>('months');
   yearRangeStart = signal(new Date().getFullYear() - 5);

   monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
   monthNamesShort = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

   private onChange: (v: string | null) => void = () => {};
   private onTouched: () => void = () => {};

   /** "YYYY-MM" → número comparable; así los límites son una simple resta. */
   private parseLimit(value: string | null): number | null {
      if (!value) return null;
      const p = value.split('-');
      if (p.length < 2) return null;
      const y = +p[0], m = +p[1];
      if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
      return y * 12 + (m - 1);
   }
   private get min() { return this.parseLimit(this.minMonth); }
   private get max() { return this.parseLimit(this.maxMonth); }
   private serial(year: number, month: number) { return year * 12 + month; }

   isMonthDisabled(month: number): boolean {
      const s = this.serial(this.currentYear(), month);
      const min = this.min, max = this.max;
      return (min !== null && s < min) || (max !== null && s > max);
   }

   isYearDisabled(year: number): boolean {
      const min = this.min, max = this.max;
      return (min !== null && this.serial(year, 11) < min) ||
             (max !== null && this.serial(year, 0) > max);
   }

   isPrevDisabled(): boolean {
      if (this.viewMode() === 'years') return false;
      const min = this.min;
      return min !== null && this.serial(this.currentYear() - 1, 11) < min;
   }

   isNextDisabled(): boolean {
      if (this.viewMode() === 'years') return false;
      const max = this.max;
      return max !== null && this.serial(this.currentYear() + 1, 0) > max;
   }

   isThisMonthDisabled(): boolean {
      const t = new Date();
      const s = this.serial(t.getFullYear(), t.getMonth());
      const min = this.min, max = this.max;
      return (min !== null && s < min) || (max !== null && s > max);
   }

   /** Texto del campo: compacto, para que no se corte en columnas angostas. */
   displayValue = computed(() => {
      const s = this.selected();
      if (!s) return this.placeholder;
      return `${this.monthNamesShort[s.month]} ${s.year}`;
   });

   /** Versión larga — solo para title y aria-label. */
   displayValueFull = computed(() => {
      const s = this.selected();
      if (!s) return this.placeholder;
      return `${this.monthNames[s.month]} de ${s.year}`;
   });

   yearsList = computed(() => {
      const years: number[] = [];
      const start = this.yearRangeStart();
      for (let i = start; i < start + 12; i++) years.push(i);
      return years;
   });

   isSelected(month: number): boolean {
      const s = this.selected();
      return !!s && s.month === month && s.year === this.currentYear();
   }

   isCurrentMonth(month: number): boolean {
      const t = new Date();
      return t.getMonth() === month && t.getFullYear() === this.currentYear();
   }

   private reposition = () => this.position();

   ngAfterViewInit() {
      // En captura, para enterarse también del scroll de contenedores internos
      // (el modal scrollea por dentro, no la ventana).
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
      const s = this.selected();
      const year = s?.year ?? new Date().getFullYear();
      this.currentYear.set(year);
      this.yearRangeStart.set(year - 5);
      this.viewMode.set('months');

      const inline = this.inlineOnMobile && window.innerWidth < 768;
      this.isInline.set(inline);

      if (inline) {
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
      const ancho = popup.offsetWidth || 264;
      const alto = popup.offsetHeight || 280;
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
         this.viewMode.set('months');
         this.onTouched();
      }
   }

   close() {
      if (this.isInline()) {
         this.isOpen.set(false);
         this.viewMode.set('months');
         this.onTouched();
         return;
      }
      const popup = this.popupRef?.nativeElement;
      if (popup?.matches(':popover-open')) popup.hidePopover();
   }

   toggleViewMode() {
      const siguiente: ViewMode = this.viewMode() === 'months' ? 'years' : 'months';
      if (siguiente === 'years') this.yearRangeStart.set(this.currentYear() - 5);
      this.viewMode.set(siguiente);
   }

   prev() {
      if (this.isPrevDisabled()) return;
      if (this.viewMode() === 'years') this.yearRangeStart.update(y => y - 12);
      else this.currentYear.update(y => y - 1);
   }

   next() {
      if (this.isNextDisabled()) return;
      if (this.viewMode() === 'years') this.yearRangeStart.update(y => y + 12);
      else this.currentYear.update(y => y + 1);
   }

   selectYear(year: number) {
      if (this.isYearDisabled(year)) return;
      this.currentYear.set(year);
      this.viewMode.set('months');
   }

   selectMonth(month: number) {
      if (this.isMonthDisabled(month)) return;
      const year = this.currentYear();
      this.selected.set({ year, month });
      this.emitValue(year, month);
      this.close();
   }

   selectThisMonth() {
      if (this.isThisMonthDisabled()) return;
      const t = new Date();
      this.currentYear.set(t.getFullYear());
      this.selected.set({ year: t.getFullYear(), month: t.getMonth() });
      this.emitValue(t.getFullYear(), t.getMonth());
      this.close();
   }

   clear() {
      this.selected.set(null);
      this.onChange(null);
      this.close();
   }

   private emitValue(year: number, month: number) {
      this.onChange(`${year}-${(month + 1).toString().padStart(2, '0')}`);
   }

   writeValue(value: string | null): void {
      const p = (value ?? '').split('-');
      if (p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1])) {
         this.selected.set({ year: +p[0], month: +p[1] - 1 });
         this.currentYear.set(+p[0]);
      } else {
         this.selected.set(null);
      }
   }
   registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
   registerOnTouched(fn: () => void): void { this.onTouched = fn; }
   setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}

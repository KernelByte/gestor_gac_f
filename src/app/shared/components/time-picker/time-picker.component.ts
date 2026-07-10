import { Component, Input, signal, computed, forwardRef, ElementRef, inject, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type ColorScheme = 'orange' | 'violet';
type Meridiem = 'a. m.' | 'p. m.';

/**
 * Selector de hora con estilo propio de la app — reemplaza el picker nativo
 * del navegador/SO (input type="time"), que no puede restylearse por CSS.
 * Almacena/emite el valor en formato 24h "HH:mm" (igual que <input type="time">)
 * para que sea intercambiable en los formularios existentes.
 */
@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => TimePickerComponent),
    multi: true,
  }],
  template: `
    <div class="tp-root"
         [class.tp-violet]="colorScheme === 'violet'"
         [class.tp-open-above]="openAbove()"
         [class.tp-align-right]="alignRight()"
         [class.tp-closing]="closing()">

      <button
        type="button"
        [disabled]="disabled"
        (click)="toggle()"
        class="tp-trigger"
        [attr.aria-haspopup]="'dialog'"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="hour24 !== null ? displayValue() : (placeholder || 'Seleccionar hora')">
        <svg class="tp-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="tp-trigger-label"
              [class.tp-trigger-label--value]="hour24 !== null"
              [class.tp-trigger-label--placeholder]="hour24 === null">
          {{ hour24 !== null ? displayValue() : (placeholder || 'Hora') }}
        </span>
        <svg *ngIf="hour24 !== null"
             class="tp-clear-btn"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             (click)="$event.stopPropagation(); clearTime()"
             role="button" aria-label="Limpiar hora">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <div *ngIf="popupVisible()" class="tp-popup" role="dialog" aria-modal="true">
        <div class="tp-columns">
          <div class="tp-col" #hourCol>
            <button *ngFor="let h of hours" type="button"
                    class="tp-opt" [class.tp-opt--on]="h === hour12()"
                    (click)="selectHour12(h)" [attr.aria-selected]="h === hour12()">
              {{ h.toString().padStart(2,'0') }}
            </button>
          </div>
          <div class="tp-col" #minuteCol>
            <button *ngFor="let m of minutes" type="button"
                    class="tp-opt" [class.tp-opt--on]="m === minute()"
                    (click)="selectMinute(m)" [attr.aria-selected]="m === minute()">
              {{ m.toString().padStart(2,'0') }}
            </button>
          </div>
          <div class="tp-col tp-col-meridiem">
            <button type="button" class="tp-opt tp-meridiem" [class.tp-opt--on]="meridiem() === 'a. m.'"
                    (click)="selectMeridiem('a. m.')">a. m.</button>
            <button type="button" class="tp-opt tp-meridiem" [class.tp-opt--on]="meridiem() === 'p. m.'"
                    (click)="selectMeridiem('p. m.')">p. m.</button>
          </div>
        </div>

        <div class="tp-footer">
          <button type="button" class="tp-footer-clear" (click)="clearTime()">Borrar</button>
          <button type="button" class="tp-footer-now" (click)="selectNow()">Ahora</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }

    /* ── Entrada/salida del popup — misma curva que el date-picker, sin rebote ── */
    @keyframes tpIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes tpInUp {
      from { opacity: 0; transform: translateY(4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes tpOut {
      from { opacity: 1; transform: none; }
      to   { opacity: 0; transform: translateY(-4px) scale(0.98); }
    }
    @keyframes tpOutDown {
      from { opacity: 1; transform: none; }
      to   { opacity: 0; transform: translateY(4px) scale(0.98); }
    }
    .tp-root { position: relative; }

    /* ── Trigger — mismo lenguaje visual que .field / dp-trigger-field ── */
    .tp-trigger {
      width: 100%; display: flex; align-items: center; gap: 0.5rem;
      cursor: pointer; text-align: left;
      border: 1px solid #e2e8f0; background: #ffffff;
      border-radius: 0.625rem; padding: 0.5rem 0.75rem;
      font-size: 0.875rem; color: #1e293b; min-height: 2.5rem;
      transition: border-color 160ms, box-shadow 160ms;
    }
    @media (max-width: 767px) { .tp-trigger { min-height: 2.75rem; font-size: 1rem; } }
    .tp-trigger:disabled { cursor: not-allowed; opacity: 0.55; }

    :host-context(.dark) .tp-trigger { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    .tp-trigger:not(:disabled):hover { border-color: #94a3b8; }
    :host-context(.dark) .tp-trigger:not(:disabled):hover { border-color: #475569; }

    .tp-root:focus-within .tp-trigger:not(:disabled) {
      outline: none; border-color: #f97316;
      box-shadow: 0 0 0 3px rgba(249,115,22,0.14);
    }
    .tp-violet:focus-within .tp-trigger:not(:disabled) {
      border-color: #7c3aed;
      box-shadow: 0 0 0 3px rgba(124,58,237,0.14);
    }
    :host-context(.dark) .tp-violet:focus-within .tp-trigger:not(:disabled) {
      border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.18);
    }

    .tp-trigger-icon { width: 1rem; height: 1rem; flex-shrink: 0; color: #94a3b8; transition: color 150ms; }
    .tp-violet .tp-trigger-icon { color: #8b5cf6; }
    .tp-trigger:not(:disabled):hover .tp-trigger-icon { color: #64748b; }
    .tp-violet .tp-trigger:not(:disabled):hover .tp-trigger-icon { color: #7c3aed; }
    :host-context(.dark) .tp-trigger-icon { color: #64748b; }
    :host-context(.dark) .tp-violet .tp-trigger-icon { color: #a78bfa; }

    .tp-trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .tp-trigger-label--value { color: #1e293b; font-weight: 500; }
    :host-context(.dark) .tp-trigger-label--value { color: #e2e8f0; }
    .tp-trigger-label--placeholder { color: #94a3b8; font-style: italic; }
    :host-context(.dark) .tp-trigger-label--placeholder { color: #475569; }

    .tp-clear-btn { width: 0.875rem; height: 0.875rem; flex-shrink: 0; color: #94a3b8; cursor: pointer; transition: color 150ms; }
    .tp-clear-btn:hover { color: #f43f5e; }
    :host-context(.dark) .tp-clear-btn { color: #64748b; }

    /* ── Popup ──
       --tp-item-h: alto de cada opción (fila) de las columnas de hora/minuto.
       --tp-visible: cuántas filas se ven dentro del recorte de la columna.
       Con estos dos valores derivamos el padding vertical y el degradado de
       los bordes, así ningún ítem —incluido el primero y el último— queda
       recortado a la mitad: siempre hay espacio de sobra para que el scroll
       lo centre.
    ── */
    .tp-popup {
      --tp-item-h: 2.25rem;
      --tp-visible: 5;
      position: absolute; top: calc(100% + 4px); left: 0; z-index: 200;
      width: 12rem; background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 1rem;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.16), 0 2px 8px -2px rgba(0,0,0,0.08);
      animation: tpIn 180ms cubic-bezier(0.23,1,0.32,1) both;
      overflow: hidden;
    }
    @media (max-width: 767px) { .tp-popup { --tp-item-h: 2.75rem; } }
    :host-context(.dark) .tp-popup {
      background: #0f172a; border-color: #1e293b;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.35);
    }
    .tp-open-above .tp-popup { top: auto; bottom: calc(100% + 4px); animation-name: tpInUp; }
    .tp-align-right .tp-popup { left: auto; right: 0; }

    /* Salida: misma dirección de la que entró, más corta (~75% de la entrada) */
    .tp-closing .tp-popup { animation: tpOut 135ms cubic-bezier(0.4,0,1,1) both; }
    .tp-closing.tp-open-above .tp-popup { animation-name: tpOutDown; }

    .tp-columns {
      position: relative;
      display: grid; grid-template-columns: 1fr 1fr auto;
      height: calc(var(--tp-item-h) * var(--tp-visible));
      border-bottom: 1px solid #f1f5f9;
    }
    :host-context(.dark) .tp-columns { border-bottom-color: #1e293b; }

    /* Banda central: marca visualmente la fila "activa" del carrusel,
       independiente del resaltado de color del ítem seleccionado. */
    .tp-columns::before {
      content: '';
      position: absolute; left: 0; right: 0; z-index: 0; pointer-events: none;
      top: calc(50% - var(--tp-item-h) / 2);
      height: var(--tp-item-h);
      background: rgba(148,163,184,0.08);
      border-top: 1px solid rgba(148,163,184,0.18);
      border-bottom: 1px solid rgba(148,163,184,0.18);
    }
    :host-context(.dark) .tp-columns::before { background: rgba(148,163,184,0.06); border-color: rgba(148,163,184,0.16); }
    .tp-violet .tp-columns::before { background: rgba(124,58,237,0.05); border-color: rgba(124,58,237,0.22); }
    :host-context(.dark) .tp-violet .tp-columns::before { background: rgba(167,139,250,0.06); border-color: rgba(167,139,250,0.22); }

    .tp-col {
      height: calc(var(--tp-item-h) * var(--tp-visible));
      overflow-y: auto; scroll-snap-type: y mandatory;
      /* Relleno = espacio para que el primer/último ítem alcancen el centro
         visual sin quedar pegados (ni recortados) contra el borde. */
      padding-block: calc(var(--tp-item-h) * (var(--tp-visible) - 1) / 2);
      display: flex; flex-direction: column;
      /* Degradado suave en los bordes en vez de un corte duro */
      -webkit-mask-image: linear-gradient(to bottom,
        transparent 0, black calc(var(--tp-item-h) * 0.85),
        black calc(100% - var(--tp-item-h) * 0.85), transparent 100%);
      mask-image: linear-gradient(to bottom,
        transparent 0, black calc(var(--tp-item-h) * 0.85),
        black calc(100% - var(--tp-item-h) * 0.85), transparent 100%);
    }
    .tp-col:not(:last-child) { border-right: 1px solid #f1f5f9; }
    :host-context(.dark) .tp-col:not(:last-child) { border-right-color: #1e293b; }
    .tp-col::-webkit-scrollbar { width: 4px; }
    .tp-col::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 9999px; }
    :host-context(.dark) .tp-col::-webkit-scrollbar-thumb { background: #334155; }

    .tp-col-meridiem {
      justify-content: center; overflow: visible; gap: 0.375rem;
      padding-block: 0; mask-image: none; -webkit-mask-image: none;
    }

    .tp-opt {
      position: relative; z-index: 1;
      height: var(--tp-item-h); flex-shrink: 0; box-sizing: border-box;
      scroll-snap-align: center;
      display: flex; align-items: center; justify-content: center;
      border: none; background: transparent; cursor: pointer;
      border-radius: 0.5rem;
      font-size: 0.8125rem; font-weight: 500; font-variant-numeric: tabular-nums;
      color: #475569; text-align: center;
      transition: background 120ms, color 120ms;
    }
    :host-context(.dark) .tp-opt { color: #94a3b8; }
    .tp-opt:hover:not(.tp-opt--on) { background: #f1f5f9; color: #0f172a; }
    :host-context(.dark) .tp-opt:hover:not(.tp-opt--on) { background: #1e293b; color: #f1f5f9; }
    .tp-violet .tp-opt:hover:not(.tp-opt--on) { background: rgba(124,58,237,0.08); color: #6d28d9; }
    :host-context(.dark) .tp-violet .tp-opt:hover:not(.tp-opt--on) { background: rgba(167,139,250,0.12); color: #a78bfa; }

    .tp-opt--on { background: #f97316; color: #fff; font-weight: 700; }
    .tp-violet .tp-opt--on { background: #7c3aed; box-shadow: 0 2px 8px rgba(124,58,237,0.35); }

    .tp-meridiem {
      width: 100%; height: auto; min-height: var(--tp-item-h);
      font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.01em;
      padding: 0.375rem 0.625rem;
    }

    .tp-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.5rem 0.75rem 0.625rem;
    }
    .tp-footer-clear, .tp-footer-now {
      font-size: 0.75rem; font-weight: 600;
      background: none; border: none; cursor: pointer;
      padding: 0.25rem 0.5rem; border-radius: 0.375rem;
      transition: color 150ms, background 150ms;
    }
    .tp-footer-clear { color: #94a3b8; }
    .tp-footer-clear:hover { color: #f43f5e; background: rgba(244,63,94,0.07); }
    :host-context(.dark) .tp-footer-clear { color: #475569; }
    :host-context(.dark) .tp-footer-clear:hover { color: #fb7185; }

    .tp-footer-now { color: #f97316; }
    .tp-footer-now:hover { color: #ea580c; background: rgba(249,115,22,0.07); }
    .tp-violet .tp-footer-now { color: #7c3aed; }
    .tp-violet .tp-footer-now:hover { color: #6d28d9; background: rgba(124,58,237,0.07); }
    :host-context(.dark) .tp-violet .tp-footer-now { color: #a78bfa; }

    /* ── Reduced motion: sin animación de entrada/salida ni scroll suave ── */
    @media (prefers-reduced-motion: reduce) {
      .tp-popup { animation: none !important; }
      .tp-col { scroll-behavior: auto; }
    }
  `],
})
export class TimePickerComponent implements ControlValueAccessor {
  @Input() placeholder = 'Hora';
  @Input() disabled = false;
  @Input() colorScheme: ColorScheme = 'orange';

  @ViewChild('hourCol') hourColRef?: ElementRef<HTMLElement>;
  @ViewChild('minuteCol') minuteColRef?: ElementRef<HTMLElement>;

  private el = inject(ElementRef);

  isOpen = signal(false);
  /** true durante la animación de salida — mantiene el popup montado un instante más. */
  closing = signal(false);
  /** El popup permanece en el DOM mientras esté abierto o cerrándose (para poder animar la salida). */
  popupVisible = computed(() => this.isOpen() || this.closing());
  openAbove = signal(false);
  alignRight = signal(false);
  private closeTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Cierre por clic afuera / Escape, a nivel de documento — no depende de un
   * overlay "fixed" propio (ese approach se rompe si algún ancestro del
   * popup, p.ej. un contenedor con overflow o una animación con transform,
   * le crea un containing block distinto y dejar de cubrir toda la pantalla).
   */
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

  /** Hora 24h (0-23) o null si no hay valor. */
  hour24: number | null = null;
  private minuteValue = 0;

  hours = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
  minutes = Array.from({ length: 60 }, (_, i) => i);    // 0..59

  /** Métodos simples (no signals): el binding plano `hour24` los re-evalúa en cada ciclo de detección de cambios. */
  hour12(): number | null {
    if (this.hour24 === null) return null;
    const h = this.hour24 % 12;
    return h === 0 ? 12 : h;
  }
  minute(): number | null {
    return this.hour24 === null ? null : this.minuteValue;
  }
  meridiem(): Meridiem | null {
    if (this.hour24 === null) return null;
    return this.hour24 < 12 ? 'a. m.' : 'p. m.';
  }

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  displayValue(): string {
    const h = this.hour12();
    const m = this.minute();
    const mer = this.meridiem();
    if (h === null || m === null || !mer) return this.placeholder;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${mer}`;
  }

  toggle() {
    if (this.disabled) return;
    if (this.isOpen()) { this.close(); return; }
    clearTimeout(this.closeTimeout);
    this.closing.set(false);
    this.isOpen.set(true);
    this.updateOpenDirection();
    requestAnimationFrame(() => this.scrollSelectedIntoView());
  }

  private updateOpenDirection() {
    requestAnimationFrame(() => {
      const host = this.el.nativeElement as HTMLElement;
      const rect = host.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      const popupH = isMobile ? 300 : 250;
      const popupW = 192;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      this.openAbove.set(spaceBelow < popupH && spaceAbove > spaceBelow);
      this.alignRight.set(rect.left + popupW > window.innerWidth - 8);
    });
  }

  private scrollSelectedIntoView() {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
    const hourEl = this.hourColRef?.nativeElement.querySelector('.tp-opt--on') as HTMLElement | null;
    hourEl?.scrollIntoView({ block: 'center', behavior });
    const minEl = this.minuteColRef?.nativeElement.querySelector('.tp-opt--on') as HTMLElement | null;
    minEl?.scrollIntoView({ block: 'center', behavior });
  }

  /** Cierra reproduciendo la animación de salida antes de desmontar el popup del DOM. */
  close() {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.onTouched();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.closing.set(true);
    clearTimeout(this.closeTimeout);
    this.closeTimeout = setTimeout(() => this.closing.set(false), reduced ? 0 : 150);
  }

  private ensureDefaults() {
    if (this.hour24 === null) { this.hour24 = 12; this.minuteValue = 0; }
  }

  selectHour12(h12: number) {
    this.ensureDefaults();
    const isPm = (this.hour24 ?? 0) >= 12;
    this.hour24 = (h12 % 12) + (isPm ? 12 : 0);
    this.emit();
  }

  selectMinute(m: number) {
    this.ensureDefaults();
    this.minuteValue = m;
    this.emit();
  }

  selectMeridiem(mer: Meridiem) {
    this.ensureDefaults();
    const h12 = this.hour12() ?? 12;
    this.hour24 = mer === 'a. m.' ? (h12 % 12) : (h12 % 12) + 12;
    this.emit();
  }

  selectNow() {
    const now = new Date();
    this.hour24 = now.getHours();
    this.minuteValue = now.getMinutes();
    this.emit();
    requestAnimationFrame(() => this.scrollSelectedIntoView());
  }

  clearTime() {
    this.hour24 = null;
    this.minuteValue = 0;
    this.onChange(null);
    this.close();
  }

  private emit() {
    const h = this.hour24 ?? 0;
    const m = this.minuteValue;
    this.onChange(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }

  writeValue(value: string | null): void {
    if (value) {
      const [h, m] = value.split(':').map(Number);
      this.hour24 = Number.isFinite(h) ? h : null;
      this.minuteValue = Number.isFinite(m) ? m : 0;
    } else {
      this.hour24 = null;
      this.minuteValue = 0;
    }
  }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}

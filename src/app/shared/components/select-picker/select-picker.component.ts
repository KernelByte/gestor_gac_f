import {
  Component, Input, Output, EventEmitter, signal, computed, forwardRef, ElementRef, inject,
  HostListener, ViewChild, AfterViewInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type ColorScheme = 'orange' | 'violet';

/** Opción con identidad propia: el valor que viaja al formulario no tiene que
 *  ser el texto que ve el usuario (id numérico + etiqueta, típicamente). */
export interface PickerOption {
  value: unknown;
  label: string;
  /** Segunda línea opcional (congregación, rol, teléfono…). */
  hint?: string;
}

/**
 * Selector de opciones con estilo propio de la app — reemplaza el <select>
 * nativo del navegador/SO, cuyo menú desplegable no puede restylearse por CSS
 * (mismo motivo que llevó a crear TimePickerComponent/DatePickerComponent).
 *
 * El desplegable se abre con la API nativa `popover`, así que vive en el *top
 * layer*: no lo recorta ningún ancestro con overflow ni hace falta competir por
 * z-index. En pantallas táctiles o estrechas se presenta como hoja inferior,
 * que es el patrón que ya usan Publicadores, Grupos y Reuniones.
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
    <div class="sp-root" [class.sp-violet]="colorScheme === 'violet'">

      <button
        #trigger
        type="button"
        [disabled]="disabled"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)"
        class="sp-trigger"
        [class.sp-trigger--invalid]="invalid"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="ariaLabel || placeholder || 'Seleccionar'">
        <span class="sp-trigger-label"
              [class.sp-trigger-label--value]="!!selectedLabel()"
              [class.sp-trigger-label--placeholder]="!selectedLabel()">
          {{ selectedLabel() || placeholder || 'Seleccionar' }}
        </span>
        <svg *ngIf="selectedLabel() && clearable && !disabled"
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

      <!-- popover="auto": el cierre por clic fuera y por Escape los da el
           navegador, y al vivir en el top layer no lo recorta el panel. -->
      <div #popup popover="auto" class="sp-popup"
           [class.sp-popup--above]="openAbove()"
           (toggle)="onPopoverToggle($event)"
           role="listbox" [attr.aria-label]="ariaLabel || placeholder">

        <div class="sp-grabber" aria-hidden="true"></div>

        <div *ngIf="showSearch()" class="sp-search">
          <input #searchInput type="text" class="sp-search-input"
                 [placeholder]="'Buscar…'"
                 [value]="query()"
                 (input)="onQuery($any($event.target).value)"
                 (keydown)="onListKeydown($event)"
                 aria-label="Buscar opción">
        </div>

        <div class="sp-list" #list>
          <button *ngIf="clearable" type="button" class="sp-opt sp-opt-empty"
                  [class.sp-opt--on]="value() === null || value() === undefined"
                  (click)="select(null)">
            {{ placeholder || 'Sin selección' }}
          </button>

          <button *ngFor="let opt of filtered(); let i = index"
                  type="button" class="sp-opt"
                  [class.sp-opt--on]="isSelected(opt)"
                  [class.sp-opt--active]="i === activeIndex()"
                  [attr.aria-selected]="isSelected(opt)"
                  (click)="select(opt)">
            <span class="sp-opt-label">{{ opt.label }}</span>
            <span *ngIf="opt.hint" class="sp-opt-hint">{{ opt.hint }}</span>
          </button>

          <div *ngIf="filtered().length === 0" class="sp-empty-wrap">
            <p class="sp-empty">Sin resultados</p>
            <!-- Salida directa cuando la lista está vacía: sin esto había que
                 cerrar el desplegable y buscar aparte un enlace de "crear
                 nuevo" fuera del componente. -->
            <button *ngIf="emptyActionLabel" type="button" class="sp-empty-action"
                    (click)="onEmptyAction()">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {{ emptyActionLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }

    @keyframes spIn   { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: none; } }
    @keyframes spInUp { from { opacity: 0; transform: translateY(4px) scale(0.98); }  to { opacity: 1; transform: none; } }
    @keyframes spSheet{ from { opacity: 0; transform: translateY(100%); }             to { opacity: 1; transform: none; } }

    .sp-root { position: relative; }

    /* ── Trigger — mismo lenguaje visual que .field / dp-trigger-field / tp-trigger ── */
    .sp-trigger {
      width: 100%; display: flex; align-items: center; gap: 0.5rem;
      cursor: pointer; text-align: left;
      border: 1px solid #e2e8f0; background: #ffffff;
      border-radius: 0.625rem; padding: 0.5rem 0.75rem;
      font-size: 0.875rem; color: #1e293b; min-height: 2.75rem;
      transition: border-color 160ms, box-shadow 160ms;
    }
    @media (max-width: 767px) { .sp-trigger { font-size: 1rem; } }
    .sp-trigger:disabled { cursor: not-allowed; opacity: 0.55; }

    :host-context(.dark) .sp-trigger { background: #1e293b; border: 1px solid #334155; color: #f1f5f9; }
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
    .sp-trigger--invalid { border-color: #fca5a5; }

    .sp-trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sp-trigger-label--value { color: #1e293b; font-weight: 500; }
    :host-context(.dark) .sp-trigger-label--value { color: #e2e8f0; }
    .sp-trigger-label--placeholder { color: #94a3b8; }
    :host-context(.dark) .sp-trigger-label--placeholder { color: #64748b; }

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

    /* ── Popup (top layer). Las coordenadas las fija el componente en JS. ── */
    .sp-popup {
      position: fixed; margin: 0; padding: 0.25rem; border: 1px solid #e2e8f0;
      inset: auto; overflow: visible;
      max-height: 18rem; display: flex; flex-direction: column;
      background: #ffffff; border-radius: 0.875rem; color: inherit;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.16), 0 2px 8px -2px rgba(0,0,0,0.08);
      animation: spIn 180ms cubic-bezier(0.23,1,0.32,1) both;
    }
    .sp-popup:not(:popover-open) { display: none; }
    .sp-popup--above { animation-name: spInUp; }
    :host-context(.dark) .sp-popup {
      background: #0f172a; border-color: #1e293b;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.35);
    }
    .sp-popup::backdrop { background: transparent; }

    .sp-grabber { display: none; }

    .sp-search { padding: 0.25rem 0.25rem 0.375rem; }
    .sp-search-input {
      width: 100%; box-sizing: border-box; min-height: 2.5rem;
      padding: 0.375rem 0.625rem; font-size: 0.875rem;
      border: 1px solid #e2e8f0; border-radius: 0.5rem;
      background: #f8fafc; color: #1e293b; outline: none;
    }
    .sp-search-input:focus { border-color: #7c3aed; background: #fff; }
    :host-context(.dark) .sp-search-input { background: #1e293b; border-color: #334155; color: #e2e8f0; }

    .sp-list { overflow-y: auto; display: flex; flex-direction: column; gap: 1px; scrollbar-width: thin; }
    .sp-list::-webkit-scrollbar { width: 5px; }
    .sp-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 9999px; }
    :host-context(.dark) .sp-list::-webkit-scrollbar-thumb { background: #334155; }

    .sp-opt {
      border: none; background: transparent; cursor: pointer;
      padding: 0.5rem 0.625rem; border-radius: 0.5rem; text-align: left;
      font-size: 0.8125rem; font-weight: 500;
      color: #334155; min-height: 2.75rem;
      display: flex; flex-direction: column; justify-content: center; gap: 0.125rem;
      transition: background 120ms, color 120ms;
    }
    :host-context(.dark) .sp-opt { color: #cbd5e1; }
    .sp-opt-empty { color: #94a3b8; font-style: italic; }
    :host-context(.dark) .sp-opt-empty { color: #64748b; }
    /* flex-shrink:0 en ambas líneas es imprescindible, no cosmético: al ser
       hijas de un flex-column con overflow:hidden (necesario para truncar el
       nombre con "…"), su "tamaño mínimo automático" pasa a ser 0, así que en
       una fila de dos líneas el algoritmo de encogido aplastaba el nombre en
       vez del teléfono, y como el nombre también recorta su desborde, el
       texto quedaba con la parte superior cortada/solapada con la fila de
       arriba. Sin esto la fila se queda en min-height aunque el contenido no
       quepa; con esto crece más alta cuando hace falta. */
    .sp-opt-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
    .sp-opt-hint { font-size: 0.6875rem; font-weight: 500; color: #94a3b8; flex-shrink: 0; }
    :host-context(.dark) .sp-opt-hint { color: #64748b; }

    .sp-opt:hover:not(.sp-opt--on), .sp-opt--active:not(.sp-opt--on) { background: #f1f5f9; color: #0f172a; }
    :host-context(.dark) .sp-opt:hover:not(.sp-opt--on),
    :host-context(.dark) .sp-opt--active:not(.sp-opt--on) { background: #1e293b; color: #f1f5f9; }
    .sp-violet .sp-opt:hover:not(.sp-opt--on),
    .sp-violet .sp-opt--active:not(.sp-opt--on) { background: rgba(124,58,237,0.08); color: #6d28d9; }
    :host-context(.dark) .sp-violet .sp-opt:hover:not(.sp-opt--on),
    :host-context(.dark) .sp-violet .sp-opt--active:not(.sp-opt--on) { background: rgba(167,139,250,0.12); color: #a78bfa; }

    .sp-opt--on { background: #f97316; color: #fff; font-weight: 700; }
    .sp-opt--on .sp-opt-hint { color: rgba(255,255,255,0.75); }
    .sp-violet .sp-opt--on { background: #7c3aed; box-shadow: 0 2px 8px rgba(124,58,237,0.35); }

    .sp-empty-wrap { padding: 0.25rem; display: flex; flex-direction: column; gap: 0.375rem; }
    .sp-empty { padding: 0.5rem 0.375rem 0; font-size: 0.8125rem; color: #94a3b8; margin: 0; }

    .sp-empty-action {
      display: flex; align-items: center; justify-content: center; gap: 0.375rem;
      min-height: 2.75rem; padding: 0.5rem 0.75rem; border-radius: 0.625rem;
      border: 1px dashed #c4b5fd; background: rgba(124,58,237,0.05);
      color: #6d28d9; font-size: 0.8125rem; font-weight: 700; cursor: pointer;
      transition: background 120ms, border-color 120ms;
    }
    .sp-empty-action:hover { background: rgba(124,58,237,0.1); border-color: #7c3aed; }
    :host-context(.dark) .sp-empty-action { border-color: #4c1d95; background: rgba(167,139,250,0.06); color: #a78bfa; }
    :host-context(.dark) .sp-empty-action:hover { background: rgba(167,139,250,0.12); border-color: #7c3aed; }
    @media (max-width: 767px), (pointer: coarse) { .sp-empty-action { min-height: 3rem; font-size: 0.9375rem; } }

    /* ── Hoja inferior en táctil o pantalla estrecha: el menú flotante obliga a
         apuntar con precisión y queda lejos del pulgar. ── */
    @media (max-width: 767px), (pointer: coarse) {
      .sp-popup {
        top: auto !important; bottom: 0 !important;
        left: 0 !important; right: 0 !important;
        width: auto !important; max-width: none;
        max-height: 75svh;
        border-radius: 1.25rem 1.25rem 0 0;
        padding: 0.5rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
        animation-name: spSheet; animation-duration: 240ms;
      }
      .sp-popup::backdrop { background: rgba(0,0,0,0.45); }
      .sp-grabber {
        display: block; width: 2.25rem; height: 0.25rem; flex-shrink: 0;
        margin: 0.25rem auto 0.5rem; border-radius: 9999px; background: #cbd5e1;
      }
      :host-context(.dark) .sp-grabber { background: #475569; }
      .sp-opt { min-height: 3rem; font-size: 0.9375rem; }
      .sp-search-input { font-size: 1rem; min-height: 2.75rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .sp-popup { animation: none !important; }
    }
  `],
})
export class SelectPickerComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  /** Acepta `string[]` (uso histórico) u opciones con valor propio. */
  @Input() set options(value: readonly (string | PickerOption)[]) {
    this.normalized.set((value ?? []).map(o =>
      typeof o === 'string' ? { value: o, label: o } : o
    ));
  }
  @Input() placeholder = 'Seleccionar';
  @Input() disabled = false;
  @Input() colorScheme: ColorScheme = 'orange';
  /** Si es true, muestra una opción para volver a dejar el campo vacío. */
  @Input() clearable = true;
  /** Fuerza mostrar u ocultar el buscador; por defecto aparece con listas largas. */
  @Input() searchable: boolean | null = null;
  @Input() ariaLabel: string | null = null;
  @Input() invalid = false;
  /** Texto del botón que aparece cuando la lista queda vacía (p. ej. "Crear
   *  publicador nuevo"). Sin este input el estado vacío es solo el texto. */
  @Input() emptyActionLabel: string | null = null;
  @Output() emptyAction = new EventEmitter<void>();

  @ViewChild('trigger') triggerRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('popup') popupRef?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchRef?: ElementRef<HTMLInputElement>;

  private el = inject(ElementRef);

  normalized = signal<PickerOption[]>([]);
  isOpen = signal(false);
  openAbove = signal(false);
  query = signal('');
  activeIndex = signal(-1);

  /** Señal y no campo plano: selectedLabel()/isSelected() son computed y no
   *  se recalcularían al elegir una opción. */
  value = signal<unknown>(null);

  /** Con más de 7 opciones buscar es más rápido que recorrer la lista. */
  showSearch = computed(() => this.searchable ?? this.normalized().length > 7);

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.normalized();
    return this.normalized().filter(o =>
      o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q)
    );
  });

  selectedLabel = computed(() => {
    const v = this.value();
    if (v === null || v === undefined || v === '') return null;
    return this.normalized().find(o => o.value === v)?.label ?? null;
  });

  private onChange: (v: unknown) => void = () => {};
  private onTouched: () => void = () => {};
  private reposition = () => this.position();

  ngAfterViewInit() {
    // En captura, para enterarse también del scroll de contenedores internos
    // (el panel de usuarios scrollea por dentro, no la ventana).
    document.addEventListener('scroll', this.reposition, { capture: true, passive: true });
    window.addEventListener('resize', this.reposition, { passive: true });
  }

  ngOnDestroy() {
    document.removeEventListener('scroll', this.reposition, { capture: true });
    window.removeEventListener('resize', this.reposition);
  }

  isSelected(opt: PickerOption) { return opt.value === this.value(); }

  /** Debe coincidir con la media query de hoja inferior de los estilos. */
  private esHoja(): boolean {
    return window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
  }

  toggle() {
    if (this.disabled) return;
    this.isOpen() ? this.close() : this.open();
  }

  open() {
    const popup = this.popupRef?.nativeElement;
    if (!popup) return;
    this.query.set('');
    this.activeIndex.set(this.filtered().findIndex(o => this.isSelected(o)));
    popup.showPopover();
    this.position();
    if (this.showSearch()) requestAnimationFrame(() => this.searchRef?.nativeElement.focus());
  }

  close() {
    this.popupRef?.nativeElement.hidePopover();
  }

  /** El navegador también abre/cierra por su cuenta (Escape, clic fuera). */
  onPopoverToggle(event: Event) {
    const open = (event as ToggleEvent).newState === 'open';
    this.isOpen.set(open);
    if (!open) {
      this.onTouched();
      this.activeIndex.set(-1);
    }
  }

  /** Ancla el popup al trigger. En móvil manda el CSS de hoja inferior. */
  private position() {
    const trigger = this.triggerRef?.nativeElement;
    const popup = this.popupRef?.nativeElement;
    // Se consulta el estado real del popover y no la señal: el evento `toggle`
    // que la actualiza llega después de showPopover(), así que al posicionar
    // justo tras abrir la señal aún valdría false y el menú quedaba en (0,0).
    if (!trigger || !popup || !popup.matches(':popover-open')) return;

    // En modo hoja inferior manda el CSS. Hay que limpiar los estilos en línea
    // de una apertura previa en escritorio: si no, el `top` calculado empuja la
    // hoja fuera de la pantalla.
    if (this.esHoja()) {
      popup.style.removeProperty('top');
      popup.style.removeProperty('bottom');
      popup.style.removeProperty('left');
      popup.style.removeProperty('width');
      return;
    }

    const r = trigger.getBoundingClientRect();
    const alto = Math.min(popup.offsetHeight || 288, 288);
    const arriba = window.innerHeight - r.bottom < alto && r.top > window.innerHeight - r.bottom;
    this.openAbove.set(arriba);

    popup.style.width = `${r.width}px`;
    popup.style.left = `${r.left}px`;
    if (arriba) {
      popup.style.top = 'auto';
      popup.style.bottom = `${window.innerHeight - r.top + 4}px`;
    } else {
      popup.style.bottom = 'auto';
      popup.style.top = `${r.bottom + 4}px`;
    }
  }

  onQuery(q: string) {
    this.query.set(q);
    this.activeIndex.set(this.filtered().length ? 0 : -1);
  }

  onTriggerKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!this.isOpen()) { e.preventDefault(); this.open(); }
    }
  }

  onListKeydown(e: KeyboardEvent) {
    const list = this.filtered();
    if (!list.length) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      const next = (this.activeIndex() + paso + list.length) % list.length;
      this.activeIndex.set(next);
      this.scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = list[this.activeIndex()];
      if (opt) this.select(opt);
    } else if (e.key === 'Home') {
      e.preventDefault(); this.activeIndex.set(0); this.scrollActiveIntoView();
    } else if (e.key === 'End') {
      e.preventDefault(); this.activeIndex.set(list.length - 1); this.scrollActiveIntoView();
    }
  }

  private scrollActiveIntoView() {
    requestAnimationFrame(() => {
      const popup = this.popupRef?.nativeElement;
      popup?.querySelector('.sp-opt--active')?.scrollIntoView({ block: 'nearest' });
    });
  }

  select(opt: PickerOption | null) {
    this.value.set(opt ? opt.value : null);
    this.onChange(this.value());
    this.close();
    this.triggerRef?.nativeElement.focus();
  }

  clear() {
    this.select(null);
  }

  onEmptyAction() {
    this.close();
    this.emptyAction.emit();
  }

  writeValue(value: unknown): void {
    this.value.set(value === undefined ? null : value);
  }
  registerOnChange(fn: (v: unknown) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}

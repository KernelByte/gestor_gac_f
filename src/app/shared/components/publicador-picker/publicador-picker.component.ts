import {
  Component, Input, Output, EventEmitter, signal, computed, forwardRef,
  ElementRef, ViewChild, inject, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { PublicadorLookupService, PublicadorLite } from './publicador-lookup.service';

type ColorScheme = 'orange' | 'violet';

/**
 * Selector de publicadores con búsqueda por nombre.
 *
 * El valor del control sigue siendo el NOMBRE (string), no el id: así encaja
 * en formularios que guardan texto plano y no rompe los datos ya capturados a
 * mano. Quien necesite el resto de la ficha (teléfono, dirección, id) escucha
 * (seleccionado), que emite el publicador elegido — o null si el usuario
 * prefirió escribir un nombre libre.
 *
 * Escribir a mano sigue permitido a propósito: puede hacer falta anotar a
 * alguien que todavía no está registrado en el sistema.
 */
@Component({
  selector: 'app-publicador-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => PublicadorPickerComponent),
    multi: true,
  }],
  template: `
    <div class="pp-root"
         [class.pp-violet]="colorScheme === 'violet'"
         [class.pp-open-above]="openAbove()">

      <button
        type="button"
        [disabled]="disabled"
        (click)="toggle()"
        class="pp-trigger"
        role="combobox"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="value || placeholder">
        <svg class="pp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 8v6M23 11h-6"/>
        </svg>
        <span class="pp-trigger-label"
              [class.pp-trigger-label--value]="!!value"
              [class.pp-trigger-label--placeholder]="!value">
          {{ value || placeholder }}
        </span>
        @if (value && !disabled) {
          <svg class="pp-clear-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               (click)="$event.stopPropagation(); clear()"
               role="button" aria-label="Limpiar selección">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        }
        <svg class="pp-chevron" [class.pp-chevron--open]="isOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      @if (isOpen()) {
        <div class="pp-popup">
          <div class="pp-search">
            <svg class="pp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.5-3.5"/>
            </svg>
            <input #searchInput
                   class="pp-search-input"
                   type="text"
                   [value]="query()"
                   (input)="onQuery($event)"
                   (keydown)="onKeydown($event)"
                   placeholder="Buscar por nombre…"
                   aria-label="Buscar publicador" />
          </div>

          <div class="pp-list" role="listbox">
            @if (cargando()) {
              <p class="pp-msg">Cargando publicadores…</p>
            } @else {
              @for (p of filtrados(); track p.id_publicador; let i = $index) {
                <button type="button" class="pp-opt"
                        [class.pp-opt--on]="p.nombre_completo === value"
                        [class.pp-opt--hl]="i === resaltado()"
                        [attr.aria-selected]="p.nombre_completo === value"
                        (mouseenter)="resaltado.set(i)"
                        (click)="elegir(p)">
                  <span class="pp-opt-name">{{ p.nombre_completo }}</span>
                  <span class="pp-opt-meta">
                    @if (p.nombre_grupo) { {{ p.nombre_grupo }} }
                    @if (p.nombre_grupo && p.telefono) { <span class="pp-dot">·</span> }
                    @if (p.telefono) { {{ p.telefono }} }
                  </span>
                </button>
              } @empty {
                <p class="pp-msg">
                  @if (publicadores().length) { Ningún publicador coincide con la búsqueda. }
                  @else if (!idCongregacion) { Primero selecciona una congregación. }
                  @else { No hay publicadores disponibles. Puedes escribir el nombre a mano. }
                </p>
              }
            }
          </div>

          @if (textoLibre(); as txt) {
            <button type="button" class="pp-free" (click)="elegirTextoLibre(txt)">
              Usar «{{ txt }}» como texto libre
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }

    @keyframes ppIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes ppInUp {
      from { opacity: 0; transform: translateY(4px) scale(0.98); }
      to   { opacity: 1; transform: none; }
    }

    .pp-root { position: relative; }

    /* ── Trigger — mismo lenguaje visual que .field / sp-trigger ── */
    .pp-trigger {
      width: 100%; display: flex; align-items: center; gap: 0.5rem;
      cursor: pointer; text-align: left;
      border: 1px solid #e2e8f0; background: #ffffff;
      border-radius: 0.625rem; padding: 0.5rem 0.75rem;
      font-size: 0.875rem; color: #1e293b; min-height: 2.5rem;
      transition: border-color 160ms, box-shadow 160ms;
    }
    @media (max-width: 767px) { .pp-trigger { min-height: 2.75rem; font-size: 1rem; } }
    .pp-trigger:disabled { cursor: not-allowed; opacity: 0.55; }

    :host-context(.dark) .pp-trigger { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    .pp-trigger:not(:disabled):hover { border-color: #94a3b8; }
    :host-context(.dark) .pp-trigger:not(:disabled):hover { border-color: #475569; }

    .pp-root:focus-within .pp-trigger:not(:disabled) {
      outline: none; border-color: #f97316;
      box-shadow: 0 0 0 3px rgba(249,115,22,0.14);
    }
    .pp-violet:focus-within .pp-trigger:not(:disabled) {
      border-color: #7c3aed;
      box-shadow: 0 0 0 3px rgba(124,58,237,0.14);
    }
    :host-context(.dark) .pp-violet:focus-within .pp-trigger:not(:disabled) {
      border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.18);
    }

    .pp-icon { width: 0.9375rem; height: 0.9375rem; flex-shrink: 0; color: #94a3b8; }
    .pp-violet .pp-icon { color: #8b5cf6; }
    :host-context(.dark) .pp-icon { color: #64748b; }
    :host-context(.dark) .pp-violet .pp-icon { color: #a78bfa; }

    .pp-trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pp-trigger-label--value { color: #1e293b; font-weight: 500; }
    :host-context(.dark) .pp-trigger-label--value { color: #e2e8f0; }
    .pp-trigger-label--placeholder { color: #94a3b8; font-style: italic; }
    :host-context(.dark) .pp-trigger-label--placeholder { color: #475569; }

    .pp-clear-btn { width: 0.875rem; height: 0.875rem; flex-shrink: 0; color: #94a3b8; cursor: pointer; transition: color 150ms; }
    .pp-clear-btn:hover { color: #f43f5e; }
    :host-context(.dark) .pp-clear-btn { color: #64748b; }

    .pp-chevron {
      width: 0.875rem; height: 0.875rem; flex-shrink: 0; color: #94a3b8;
      transition: transform 200ms, color 150ms;
    }
    .pp-violet .pp-chevron { color: #8b5cf6; }
    :host-context(.dark) .pp-chevron { color: #64748b; }
    :host-context(.dark) .pp-violet .pp-chevron { color: #a78bfa; }
    .pp-chevron--open { transform: rotate(180deg); }

    /* ── Popup ── */
    .pp-popup {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 200;
      background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 0.875rem; padding: 0.25rem;
      display: flex; flex-direction: column; gap: 2px;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.16), 0 2px 8px -2px rgba(0,0,0,0.08);
      animation: ppIn 180ms cubic-bezier(0.23,1,0.32,1) both;
    }
    :host-context(.dark) .pp-popup {
      background: #0f172a; border-color: #1e293b;
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.35);
    }
    .pp-open-above .pp-popup { top: auto; bottom: calc(100% + 4px); animation-name: ppInUp; }

    /* ── Buscador ── */
    .pp-search {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.375rem 0.5rem; border-bottom: 1px solid #f1f5f9; margin-bottom: 2px;
    }
    :host-context(.dark) .pp-search { border-bottom-color: #1e293b; }
    .pp-search-icon { width: 0.875rem; height: 0.875rem; flex-shrink: 0; color: #94a3b8; }
    .pp-search-input {
      flex: 1; min-width: 0; border: none; background: transparent; outline: none;
      font-size: 0.8125rem; color: #1e293b; padding: 0.125rem 0;
    }
    :host-context(.dark) .pp-search-input { color: #f1f5f9; }
    .pp-search-input::placeholder { color: #94a3b8; font-style: italic; }
    :host-context(.dark) .pp-search-input::placeholder { color: #475569; }

    /* ── Lista ── */
    .pp-list { max-height: 13rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
    .pp-list::-webkit-scrollbar { width: 5px; }
    .pp-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 9999px; }
    :host-context(.dark) .pp-list::-webkit-scrollbar-thumb { background: #334155; }

    .pp-opt {
      border: none; background: transparent; cursor: pointer;
      padding: 0.4rem 0.625rem; border-radius: 0.5rem; text-align: left;
      display: flex; flex-direction: column; gap: 1px;
      transition: background 120ms, color 120ms;
    }
    .pp-opt-name { font-size: 0.8125rem; font-weight: 600; color: #334155; }
    :host-context(.dark) .pp-opt-name { color: #cbd5e1; }
    .pp-opt-meta { font-size: 0.6875rem; color: #94a3b8; }
    :host-context(.dark) .pp-opt-meta { color: #64748b; }
    .pp-opt-meta:empty { display: none; }
    .pp-dot { margin: 0 0.2rem; }

    .pp-opt--hl:not(.pp-opt--on) { background: #f1f5f9; }
    :host-context(.dark) .pp-opt--hl:not(.pp-opt--on) { background: #1e293b; }
    .pp-violet .pp-opt--hl:not(.pp-opt--on) { background: rgba(124,58,237,0.08); }
    :host-context(.dark) .pp-violet .pp-opt--hl:not(.pp-opt--on) { background: rgba(167,139,250,0.12); }

    .pp-opt--on { background: #f97316; }
    .pp-violet .pp-opt--on { background: #7c3aed; box-shadow: 0 2px 8px rgba(124,58,237,0.35); }
    .pp-opt--on .pp-opt-name, .pp-opt--on .pp-opt-meta { color: #fff; }
    .pp-opt--on .pp-opt-meta { opacity: 0.85; }

    .pp-msg {
      padding: 0.625rem; font-size: 0.75rem; color: #94a3b8; font-style: italic; text-align: center;
    }
    :host-context(.dark) .pp-msg { color: #64748b; }

    /* ── Texto libre ── */
    .pp-free {
      border: none; background: transparent; cursor: pointer;
      padding: 0.5rem 0.625rem; border-radius: 0.5rem; text-align: left;
      font-size: 0.75rem; font-weight: 600; color: #64748b;
      border-top: 1px solid #f1f5f9; margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    :host-context(.dark) .pp-free { color: #94a3b8; border-top-color: #1e293b; }
    .pp-free:hover { background: #f1f5f9; color: #0f172a; }
    :host-context(.dark) .pp-free:hover { background: #1e293b; color: #f1f5f9; }

    @media (prefers-reduced-motion: reduce) {
      .pp-popup { animation: none !important; }
    }
  `],
})
export class PublicadorPickerComponent implements ControlValueAccessor {
  /** Congregación de la que se listan los publicadores. */
  @Input() idCongregacion: number | null = null;
  @Input() placeholder = 'Buscar publicador…';
  @Input() disabled = false;
  @Input() colorScheme: ColorScheme = 'orange';

  /** Publicador elegido, o null si el usuario escribió un nombre libre. */
  @Output() seleccionado = new EventEmitter<PublicadorLite | null>();

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  private el = inject(ElementRef);
  private lookup = inject(PublicadorLookupService);

  isOpen = signal(false);
  openAbove = signal(false);
  query = signal('');
  resaltado = signal(0);
  cargando = signal(false);
  publicadores = signal<PublicadorLite[]>([]);

  value: string | null = null;

  private cargadaPara: number | null = null;

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  filtrados = computed(() => {
    const q = this.normalizar(this.query());
    const lista = this.publicadores();
    if (!q) return lista;
    return lista.filter(p => this.normalizar(p.nombre_completo).includes(q));
  });

  /** Texto tecleado que no corresponde exactamente a ningún publicador. */
  textoLibre = computed(() => {
    const q = this.query().trim();
    if (!q) return null;
    const exacto = this.publicadores().some(
      p => this.normalizar(p.nombre_completo) === this.normalizar(q)
    );
    return exacto ? null : q;
  });

  private normalizar(s: string): string {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  /** Cierre por clic afuera / Escape a nivel de documento — robusto ante
   *  contenedores con overflow/scroll (ver SelectPickerComponent). */
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
    this.query.set('');
    this.resaltado.set(0);
    this.isOpen.set(true);
    this.cargar();
    this.updateOpenDirection();
    requestAnimationFrame(() => this.searchInputRef?.nativeElement.focus());
  }

  /** Carga perezosa: solo al abrir, y una vez por congregación. */
  private cargar() {
    const id = this.idCongregacion;
    if (!id || this.cargadaPara === id) return;
    this.cargando.set(true);
    this.lookup.listar(id).subscribe((list) => {
      this.publicadores.set(list);
      this.cargadaPara = id;
      this.cargando.set(false);
    });
  }

  private updateOpenDirection() {
    requestAnimationFrame(() => {
      const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
      const popupH = 288; // buscador + lista + pie
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      this.openAbove.set(spaceBelow < popupH && spaceAbove > spaceBelow);
    });
  }

  onQuery(ev: Event) {
    this.query.set((ev.target as HTMLInputElement).value);
    this.resaltado.set(0);
  }

  onKeydown(ev: KeyboardEvent) {
    const n = this.filtrados().length;
    if (ev.key === 'ArrowDown' && n) {
      ev.preventDefault();
      this.resaltado.update(i => (i + 1) % n);
    } else if (ev.key === 'ArrowUp' && n) {
      ev.preventDefault();
      this.resaltado.update(i => (i - 1 + n) % n);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const p = this.filtrados()[this.resaltado()];
      if (p) this.elegir(p);
      else {
        const txt = this.textoLibre();
        if (txt) this.elegirTextoLibre(txt);
      }
    }
  }

  close() {
    this.isOpen.set(false);
    this.onTouched();
  }

  elegir(p: PublicadorLite) {
    this.value = p.nombre_completo;
    this.onChange(this.value);
    this.seleccionado.emit(p);
    this.close();
  }

  elegirTextoLibre(txt: string) {
    this.value = txt;
    this.onChange(txt);
    this.seleccionado.emit(null);
    this.close();
  }

  clear() {
    this.value = null;
    this.onChange(null);
    this.seleccionado.emit(null);
  }

  writeValue(value: string | null): void {
    this.value = value || null;
  }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }
}

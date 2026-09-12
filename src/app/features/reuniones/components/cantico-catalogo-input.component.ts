import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DiscursosService } from '../services/discursos.service';
import { CatalogoCantico } from '../models/discursos.models';

/**
 * Campo de texto con sugerencias del catálogo de cánticos ("Cantemos con
 * gozo a Jehová", 151 registros). Mismo comportamiento que
 * app-discurso-catalogo-input: no obliga a elegir del catálogo, y el
 * desplegable va en position:fixed porque las tarjetas de la programación
 * viven dentro de contenedores con scroll propio que lo recortarían.
 */
@Component({
  selector: 'app-cantico-catalogo-input',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CanticoCatalogoInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="relative w-full">
      <input #campo
        type="text"
        [value]="texto()"
        [disabled]="disabled"
        [placeholder]="placeholder"
        [class]="inputClass"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        [attr.aria-expanded]="abierto()"
        [attr.aria-controls]="abierto() ? listboxId : null"
        [attr.aria-activedescendant]="abierto() && resaltado() >= 0 ? listboxId + '-' + resaltado() : null"
        (input)="onInput($event)"
        (focus)="onFocus()"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()">

      @if (!disabled && catalogo().length > 0) {
        <svg class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 dark:text-slate-600 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke-linecap="round"/>
        </svg>
      }
    </div>

    @if (abierto() && sugerencias().length > 0) {
      <div class="fixed z-[60] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        [style.top.px]="pos().top" [style.left.px]="pos().left" [style.width.px]="pos().width"
        [id]="listboxId" role="listbox" (mousedown)="$event.preventDefault()">
        <div class="flex flex-col p-1.5 gap-0.5 max-h-72 overflow-y-auto simple-scrollbar">
          @for (c of sugerencias(); track c.numero; let i = $index) {
            <button type="button"
              [id]="listboxId + '-' + i"
              role="option"
              [attr.aria-selected]="i === resaltado()"
              (mousedown)="$event.preventDefault(); elegir(c)"
              (mouseenter)="resaltado.set(i)"
              class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-[background-color] duration-100 ease-out"
              [class]="i === resaltado()
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'">
              <span class="shrink-0 min-w-[2rem] h-6 px-1.5 rounded-md text-[0.65rem] font-black flex items-center justify-center transition-colors duration-100"
                [class]="i === resaltado()
                  ? 'bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200'
                  : 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'">
                {{ c.numero }}
              </span>
              <span class="flex-1 min-w-0 text-sm font-medium leading-snug transition-colors duration-100"
                [class]="i === resaltado()
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-slate-700 dark:text-slate-200'">
                {{ c.titulo }}
              </span>
            </button>
          }
        </div>
        @if (totalCoincidencias() > sugerencias().length) {
          <div class="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 text-[0.65rem] text-slate-400">
            {{ totalCoincidencias() - sugerencias().length }} coincidencias más. Sigue escribiendo para afinar.
          </div>
        }
      </div>
    }
  `,
})
export class CanticoCatalogoInputComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private svc = inject(DiscursosService);

  @ViewChild('campo') campoRef?: ElementRef<HTMLInputElement>;

  /** Valor inicial cuando NO se usa ngModel (tarjetas con [value] + (commit)). */
  @Input() set value(v: string | null | undefined) {
    this.texto.set(v ?? '');
  }
  @Input() disabled = false;
  @Input() placeholder = '';
  @Input() inputClass = '';
  /** 'numerado' produce "97. Título"; 'titulo' deja sólo el título. */
  @Input() formato: 'numerado' | 'titulo' = 'numerado';

  /** Valor final del campo: al elegir una sugerencia o al salir del campo. */
  @Output() commit = new EventEmitter<string | null>();
  /** El cántico elegido, para quien necesite el número por separado. */
  @Output() seleccion = new EventEmitter<CatalogoCantico>();

  readonly listboxId = `cat-cant-${Math.random().toString(36).slice(2, 9)}`;

  texto = signal('');
  catalogo = signal<CatalogoCantico[]>([]);
  sugerencias = signal<CatalogoCantico[]>([]);
  totalCoincidencias = signal(0);
  abierto = signal(false);
  resaltado = signal(-1);
  pos = signal({ top: 0, left: 0, width: 0 });

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};
  /** Último valor emitido, para no disparar un guardado por cada blur inocuo. */
  private ultimoEmitido: string | null = null;

  ngOnInit(): void {
    // shareReplay en el servicio: aunque haya un componente por fila, la
    // descarga del catálogo ocurre una sola vez.
    this.svc.getCatalogoCanticos().subscribe({
      next: (r) => this.catalogo.set(r.canticos ?? []),
      error: () => this.catalogo.set([]),
    });
    this.ultimoEmitido = this.texto() || null;
  }

  // ── ControlValueAccessor ────────────────────────────────────────────────────
  writeValue(v: string | null): void {
    this.texto.set(v ?? '');
    this.ultimoEmitido = v ?? null;
  }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(dis: boolean): void { this.disabled = dis; }

  // ── Interacción ─────────────────────────────────────────────────────────────
  onInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.texto.set(v);
    this.onChange(v.trim() ? v : null);
    this.filtrar(v);
  }

  onFocus(): void {
    if (this.texto().trim()) this.filtrar(this.texto());
  }

  onBlur(): void {
    this.cerrar();
    this.onTouched();
    this.emitirSiCambio(this.texto());
  }

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.cerrar();
      return;
    }
    const total = this.sugerencias().length;
    if (!this.abierto() || total === 0) {
      if (ev.key === 'ArrowDown' && this.texto().trim()) this.filtrar(this.texto());
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.resaltado.set((this.resaltado() + 1) % total);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.resaltado.set((this.resaltado() - 1 + total) % total);
    } else if (ev.key === 'Enter') {
      const i = this.resaltado();
      if (i >= 0) {
        ev.preventDefault();
        this.elegir(this.sugerencias()[i]);
      }
    } else if (ev.key === 'Tab') {
      this.cerrar();
    }
  }

  elegir(c: CatalogoCantico): void {
    const texto = this.formato === 'numerado' ? `${c.numero}. ${c.titulo}` : c.titulo;
    this.texto.set(texto);
    this.cerrar();
    this.resaltado.set(-1);
    this.onChange(texto);
    this.seleccion.emit(c);
    this.emitirSiCambio(texto);
    this.campoRef?.nativeElement.focus();
  }

  // El desplegable va en position:fixed y dejaría de cuadrar con el campo en
  // cuanto algo se desplace debajo. Se cierra en vez de perseguirlo (ver
  // discurso-catalogo-input, mismo mecanismo).
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.abierto()) this.cerrar();
  }

  private readonly cerrarPorScroll = (ev: Event) => {
    const lista = document.getElementById(this.listboxId);
    if (lista && ev.target instanceof Node && lista.contains(ev.target)) return;
    this.onViewportChange();
  };

  private abrir(): void {
    if (!this.abierto()) {
      document.addEventListener('scroll', this.cerrarPorScroll, true);
      this.abierto.set(true);
    }
  }

  private cerrar(): void {
    if (this.abierto()) {
      document.removeEventListener('scroll', this.cerrarPorScroll, true);
      this.abierto.set(false);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.cerrarPorScroll, true);
  }

  private emitirSiCambio(valor: string): void {
    const v = valor.trim() || null;
    if (v === this.ultimoEmitido) return;
    this.ultimoEmitido = v;
    this.commit.emit(v);
  }

  private filtrar(q: string): void {
    const query = q.trim();
    const datos = this.catalogo();
    if (!query || datos.length === 0) {
      this.sugerencias.set([]);
      this.totalCoincidencias.set(0);
      this.cerrar();
      return;
    }

    let coincidencias: CatalogoCantico[];
    if (/^\d+$/.test(query)) {
      const exacto = +query;
      coincidencias = datos
        .filter(c => String(c.numero).startsWith(query))
        .sort((a, b) => (a.numero === exacto ? -1 : b.numero === exacto ? 1 : a.numero - b.numero));
    } else {
      const tokens = this.normalizar(query).split(/\s+/).filter(Boolean);
      coincidencias = datos.filter(c => {
        const heno = this.normalizar(`${c.numero}. ${c.titulo}`);
        return tokens.every(t => heno.includes(t));
      });
    }

    this.totalCoincidencias.set(coincidencias.length);
    this.sugerencias.set(coincidencias.slice(0, 8));
    this.resaltado.set(coincidencias.length > 0 ? 0 : -1);

    if (coincidencias.length > 0) {
      this.medir();
      this.abrir();
    } else {
      this.cerrar();
    }
  }

  /**
   * Quita tildes, pasa a minúsculas y normaliza las comillas tipográficas.
   */
  private normalizar(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u201c\u201d]/g, '"')
      .toLowerCase();
  }

  private static readonly ANCHO_MIN = 400;

  private medir(): void {
    const el = this.campoRef?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();

    const margen = 8;
    const disponible = window.innerWidth - margen * 2;
    const ancho = Math.min(Math.max(r.width, CanticoCatalogoInputComponent.ANCHO_MIN), disponible);
    const left = Math.max(margen, Math.min(r.left, window.innerWidth - ancho - margen));

    const filas = this.sugerencias().length;
    const alto = Math.min(300, filas * 44 + 12);
    const cabeDebajo = window.innerHeight - r.bottom > alto + 8;

    this.pos.set({
      top: cabeDebajo ? r.bottom + 4 : Math.max(margen, r.top - alto - 4),
      left,
      width: ancho,
    });
  }
}

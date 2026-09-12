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
import { CatalogoDiscurso } from '../models/discursos.models';

/**
 * Campo de texto con sugerencias del catálogo de bosquejos del S-34.
 *
 * No obliga a elegir del catálogo: hay discursos y oradores de fuera, y mientras
 * nadie haya importado el archivo el campo se comporta exactamente igual que el
 * input libre que había antes.
 *
 * Se puede usar de dos formas, según cómo guarde la pantalla:
 *   - con [(ngModel)], en los modales
 *   - con [value] + (commit), en las tarjetas que guardan al salir del campo
 *
 * El desplegable se posiciona con position:fixed sobre el viewport porque las
 * tarjetas de la programación viven dentro de contenedores con scroll propio que
 * lo recortarían.
 */
@Component({
  selector: 'app-discurso-catalogo-input',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DiscursoCatalogoInputComponent),
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

      <!-- Marca discreta de que el campo tiene catálogo detrás -->
      @if (!disabled && catalogo().length > 0) {
        <svg class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 dark:text-slate-600 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke-linecap="round"/>
        </svg>
      }
    </div>

    @if (abierto() && (sugerencias().length > 0 || propios().length > 0)) {
      <div class="fixed z-[60] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        [style.top.px]="pos().top" [style.left.px]="pos().left" [style.width.px]="pos().width"
        [id]="listboxId" role="listbox" (mousedown)="$event.preventDefault()">
        <div class="flex flex-col p-1.5 gap-0.5 max-h-72 overflow-y-auto simple-scrollbar">
          <!-- Bosquejos que el orador tiene preparados: van primero y aparte
               del catálogo, porque normalmente se elige entre ellos. -->
          @if (propios().length > 0) {
            <p role="presentation" class="px-2.5 pt-1.5 pb-1 text-[0.6rem] font-bold uppercase tracking-wider text-teal-700/80 dark:text-teal-300/70">
              {{ sugeridosTitulo || 'Bosquejos del orador' }}
            </p>
            @for (b of propios(); track b.texto; let j = $index) {
              <button type="button"
                [id]="listboxId + '-' + j"
                role="option"
                [attr.aria-selected]="j === resaltado()"
                (mousedown)="$event.preventDefault(); elegirTexto(b.texto)"
                (mouseenter)="resaltado.set(j)"
                class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-[background-color] duration-100 ease-out"
                [class]="j === resaltado() ? 'bg-teal-50 dark:bg-teal-400/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'">
                <span class="shrink-0 min-w-[2rem] h-6 px-1.5 rounded-md text-[0.65rem] font-black flex items-center justify-center bg-teal-100 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300">
                  {{ b.numero ?? '—' }}
                </span>
                <span class="flex-1 min-w-0 text-sm font-medium leading-snug"
                  [class]="j === resaltado() ? 'text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-200'">
                  {{ b.titulo }}
                </span>
                @if (b.esActual) {
                  <span class="shrink-0 text-[0.6rem] font-bold text-teal-700 dark:text-teal-300">Actual</span>
                }
              </button>
            }
            @if (sugerencias().length > 0) {
              <p role="presentation" class="mt-1 px-2.5 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 text-[0.6rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Catálogo
              </p>
            }
          }
          @for (d of sugerencias(); track d.numero; let k = $index) {
            @let i = k + propios().length;
            <button type="button"
              [id]="listboxId + '-' + i"
              role="option"
              [attr.aria-selected]="i === resaltado()"
              (mousedown)="$event.preventDefault(); elegir(d)"
              (mouseenter)="resaltado.set(i)"
              class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-[background-color] duration-100 ease-out group"
              [class]="i === resaltado()
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'">
              <span class="shrink-0 min-w-[2rem] h-6 px-1.5 rounded-md text-[0.65rem] font-black flex items-center justify-center transition-colors duration-100"
                [class]="i === resaltado()
                  ? 'bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200'
                  : 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'">
                {{ d.numero }}
              </span>
              <span class="flex-1 min-w-0 text-sm font-medium leading-snug transition-colors duration-100"
                [class]="i === resaltado()
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-slate-700 dark:text-slate-200'">
                {{ d.titulo }}
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
export class DiscursoCatalogoInputComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private svc = inject(DiscursosService);

  @ViewChild('campo') campoRef?: ElementRef<HTMLInputElement>;

  /** Valor inicial cuando NO se usa ngModel (tarjetas con [value] + (commit)). */
  @Input() set value(v: string | null | undefined) {
    this.texto.set(v ?? '');
  }
  @Input() disabled = false;
  @Input() placeholder = '';
  /** Clases del input; se pasan desde fuera para que cada sitio conserve su aspecto. */
  @Input() inputClass = '';
  /**
   * Formato del texto que se escribe al elegir del catálogo. 'numerado' produce
   * "7. Título" (programación); 'titulo' deja sólo el título, para pantallas que
   * guardan el número en su propio campo.
   */
  @Input() formato: 'numerado' | 'titulo' = 'numerado';

  /**
   * Bosquejos que el orador de la fila tiene preparados ("110. Título").
   * Se ofrecen arriba, aparte del catálogo, y se enseñan nada más entrar al
   * campo aunque no se haya escrito nada.
   */
  @Input() set sugeridos(v: readonly string[] | null | undefined) {
    this._sugeridos = v ?? [];
  }
  @Input() sugeridosTitulo = '';
  private _sugeridos: readonly string[] = [];

  /** Valor final del campo: al elegir una sugerencia o al salir del campo. */
  @Output() commit = new EventEmitter<string | null>();
  /** El bosquejo elegido, para quien necesite el número por separado. */
  @Output() seleccion = new EventEmitter<CatalogoDiscurso>();

  readonly listboxId = `cat-disc-${Math.random().toString(36).slice(2, 9)}`;

  texto = signal('');
  catalogo = signal<CatalogoDiscurso[]>([]);
  sugerencias = signal<CatalogoDiscurso[]>([]);
  /** Bosquejos del orador que coinciden con lo escrito (van antes del catálogo). */
  propios = signal<{ texto: string; numero: number | null; titulo: string; esActual: boolean }[]>([]);
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
    this.svc.getCatalogo().subscribe({
      next: (r) => this.catalogo.set(r.discursos ?? []),
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
    // Sin nada escrito no se abre una lista de 194 elementos encima del campo;
    // pero si el orador tiene bosquejos preparados, esos sí se enseñan. Si el
    // texto ya es uno de ellos, se enseñan todos para poder cambiarlo.
    if (this._sugeridos.length > 0) this.filtrar(this.esPropio(this.texto()) ? '' : this.texto());
    else if (this.texto().trim()) this.filtrar(this.texto());
  }

  /** Enfoca el campo desde fuera (p. ej. tras elegir un orador con varios bosquejos) y abre su lista. */
  enfocar(): void {
    const el = this.campoRef?.nativeElement;
    if (!el || this.disabled) return;
    if (document.activeElement === el) this.onFocus();
    else el.focus();
  }

  /** Vacía el campo sin emitir nada (para campos que añaden a una lista y se reutilizan). */
  limpiar(): void {
    this.texto.set('');
    this.ultimoEmitido = null;
    this.cerrar();
  }

  /**
   * Confirma lo escrito como si se saliera del campo (Enter en un campo de
   * "añadir"). Un número suelto que está en el catálogo se completa con su
   * título: "72" se guardaría sin decir qué discurso es.
   */
  confirmar(): void {
    this.cerrar();
    const t = this.texto().trim();
    const d = /^\d{1,3}$/.test(t) ? this.catalogo().find(c => c.numero === +t) : undefined;
    if (d) this.elegir(d);
    else this.emitirSiCambio(this.texto());
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
    const total = this.propios().length + this.sugerencias().length;
    if (!this.abierto() || total === 0) {
      if (ev.key === 'ArrowDown' && (this.texto().trim() || this._sugeridos.length > 0)) this.filtrar(this.texto());
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
        const nPropios = this.propios().length;
        if (i < nPropios) this.elegirTexto(this.propios()[i].texto);
        else this.elegir(this.sugerencias()[i - nPropios]);
      }
    } else if (ev.key === 'Tab') {
      this.cerrar();
    }
  }

  elegir(d: CatalogoDiscurso): void {
    const texto = this.formato === 'numerado' ? `${d.numero}. ${d.titulo}` : d.titulo;
    this.texto.set(texto);
    this.cerrar();
    this.resaltado.set(-1);
    this.onChange(texto);
    this.seleccion.emit(d);
    this.emitirSiCambio(texto);
    this.campoRef?.nativeElement.focus();
  }

  /** Elige uno de los bosquejos del orador: se escribe tal cual está guardado. */
  elegirTexto(texto: string): void {
    this.texto.set(texto);
    this.cerrar();
    this.resaltado.set(-1);
    this.onChange(texto);
    const m = /^\s*(\d{1,3})\s*[.\-–]/.exec(texto);
    const d = m ? this.catalogo().find(c => c.numero === +m[1]) : undefined;
    if (d) this.seleccion.emit(d);
    this.emitirSiCambio(texto);
    this.campoRef?.nativeElement.focus();
  }

  // El desplegable va en position:fixed y dejaría de cuadrar con el campo en
  // cuanto algo se desplace debajo. Se cierra en vez de perseguirlo.
  //
  // El listener se registra en fase de captura porque el scroll que importa es
  // el del contenedor interno de las tarjetas, y ese evento no burbujea hasta
  // document. Por eso no vale un @HostListener('document:scroll').
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.abierto()) this.cerrar();
  }

  /**
   * El desplegable es `fixed` y se mide contra el campo, así que al moverse
   * la página se cierra para no quedar flotando desalineado. Pero el scroll
   * de la propia lista no mueve el campo: sin esta excepción, desplazarse por
   * las sugerencias cerraba el desplegable al primer movimiento.
   */
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
    const propios = this.propiosQueCoinciden(query);
    this.propios.set(propios);
    if (!query || datos.length === 0) {
      this.sugerencias.set([]);
      this.totalCoincidencias.set(0);
      if (propios.length > 0) {
        this.resaltado.set(Math.max(propios.findIndex(p => p.esActual), 0));
        this.medir();
        this.abrir();
      } else {
        this.cerrar();
      }
      return;
    }

    let coincidencias: CatalogoDiscurso[];
    if (/^\d+$/.test(query)) {
      // Sólo dígitos: se busca por número. El exacto va primero, luego los que
      // empiezan igual (escribir 1 ofrece 1, 10, 100...).
      const exacto = +query;
      coincidencias = datos
        .filter(d => String(d.numero).startsWith(query))
        .sort((a, b) => (a.numero === exacto ? -1 : b.numero === exacto ? 1 : a.numero - b.numero));
    } else {
      const tokens = this.normalizar(query).split(/\s+/).filter(Boolean);
      coincidencias = datos.filter(d => {
        const heno = this.normalizar(`${d.numero}. ${d.titulo}`);
        return tokens.every(t => heno.includes(t));
      });
    }

    // Lo que ya está entre los bosquejos del orador no se repite en el catálogo.
    const numerosPropios = new Set(propios.map(p => p.numero).filter((n): n is number => n != null));
    coincidencias = coincidencias.filter(d => !numerosPropios.has(d.numero));

    this.totalCoincidencias.set(coincidencias.length);
    this.sugerencias.set(coincidencias.slice(0, 8));
    const total = propios.length + Math.min(coincidencias.length, 8);
    this.resaltado.set(total > 0 ? 0 : -1);

    if (total > 0) {
      this.medir();
      this.abrir();
    } else {
      this.cerrar();
    }
  }

  /** Bosquejos del orador que casan con lo escrito (todos si no hay texto), ya troceados en número y título. */
  private propiosQueCoinciden(query: string) {
    const tokens = this.normalizar(query).split(/\s+/).filter(Boolean);
    const actual = this.normalizar(this.texto().trim());
    return this._sugeridos
      .map(texto => {
        const m = /^\s*(\d{1,3})\s*[.\-–]\s*(.+)$/.exec(texto);
        return {
          texto,
          numero: m ? +m[1] : null,
          titulo: m ? m[2] : texto,
          esActual: !!actual && this.normalizar(texto) === actual,
        };
      })
      .filter(b => tokens.every(t => this.normalizar(b.texto).includes(t)));
  }

  /** Si el texto es exactamente uno de los bosquejos del orador. */
  private esPropio(texto: string): boolean {
    const t = this.normalizar(texto.trim());
    return !!t && this._sugeridos.some(b => this.normalizar(b) === t);
  }

  /**
   * Quita tildes, pasa a minúsculas y normaliza las comillas tipográficas: los
   * títulos del S-34 llevan comillas curvas que nadie teclea.
   */
  private normalizar(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u201c\u201d]/g, '"')
      .toLowerCase();
  }

  /** Ancho mínimo del desplegable: por debajo, los títulos largos son ilegibles. */
  private static readonly ANCHO_MIN = 400;

  private medir(): void {
    const el = this.campoRef?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();

    // Las celdas de la programación son estrechas y truncarían casi todo el
    // título, así que el desplegable se ensancha por su cuenta y, si con eso se
    // sale por la derecha, se desplaza hacia la izquierda en lugar de recortarse.
    const margen = 8;
    const disponible = window.innerWidth - margen * 2;
    const ancho = Math.min(Math.max(r.width, DiscursoCatalogoInputComponent.ANCHO_MIN), disponible);
    const left = Math.max(margen, Math.min(r.left, window.innerWidth - ancho - margen));

    // Si no cabe debajo, el desplegable sale por encima del campo.
    const filas = this.propios().length + this.sugerencias().length;
    const alto = Math.min(300, filas * 44 + (this.propios().length > 0 ? 60 : 12));
    const cabeDebajo = window.innerHeight - r.bottom > alto + 8;

    this.pos.set({
      top: cabeDebajo ? r.bottom + 4 : Math.max(margen, r.top - alto - 4),
      left,
      width: ancho,
    });
  }
}

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
  type Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DiscursosService } from '../services/discursos.service';
import { CongregacionContacto, Discursante } from '../models/discursos.models';

/** Un discursante guardado, junto con la congregación de contacto que lo tiene registrado. */
export interface DiscursanteConCongregacion {
  discursante: Discursante;
  congregacion: CongregacionContacto;
}

/**
 * Campo "Orador" con sugerencias de los discursantes ya guardados en el
 * directorio de Congregaciones de contacto (mismo patrón de desplegable que
 * `app-congregacion-contacto-input`, del que este componente es una copia
 * adaptada: fixed + filtro cliente + teclado).
 *
 * A diferencia de aquel, aquí lo que se busca no es la congregación sino la
 * persona: antes había que escribir primero la congregación de origen para
 * que aparecieran sus discursantes como chips debajo del campo. Buscando
 * directamente por el nombre del orador —que es el dato que normalmente se
 * tiene a mano al programar— se ahorra ese paso, y al elegir uno se rellena
 * de una vez su congregación y, si aún no hay discurso escrito, también el
 * que tiene registrado.
 *
 * Sigue funcionando como texto libre para oradores que aún no están en
 * ningún directorio.
 */
@Component({
  selector: 'app-orador-catalogo-input',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OradorCatalogoInputComponent),
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
    </div>

    @if (abierto() && sugerencias().length > 0) {
      <div class="fixed z-[60] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        [style.top.px]="pos().top" [style.left.px]="pos().left" [style.width.px]="pos().width"
        [id]="listboxId" role="listbox" (mousedown)="$event.preventDefault()" [attr.aria-label]="'Discursantes que coinciden con ' + texto()">
        <div class="flex flex-col p-1.5 gap-0.5 max-h-72 overflow-y-auto simple-scrollbar">
          @for (r of sugerencias(); track r.discursante.id_discursante; let i = $index) {
            <!-- Con congregación de origen registrada, sus discursantes van
                 primero bajo su nombre; lo que coincida en otras
                 congregaciones queda debajo, separado. -->
            @if (nDeCongregacion() > 0 && (i === 0 || i === nDeCongregacion())) {
              <p role="presentation" class="px-2.5 pt-2 pb-1 text-[0.6rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                [class]="i > 0 ? 'mt-1 border-t border-slate-100 dark:border-slate-800' : ''">
                {{ i === 0 ? 'Discursantes de ' + nombreCongregacion() : 'Otras congregaciones' }}
              </p>
            }
            <button type="button"
              [id]="listboxId + '-' + i"
              role="option"
              [attr.aria-selected]="i === resaltado()"
              (mousedown)="$event.preventDefault(); elegir(r)"
              (mouseenter)="resaltado.set(i)"
              class="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-[background-color] duration-100 ease-out"
              [class]="i === resaltado() ? 'bg-teal-50 dark:bg-teal-400/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'">
              <span class="shrink-0 w-8 h-8 mt-0.5 rounded-full bg-teal-100 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300 text-xs font-black flex items-center justify-center">
                {{ r.discursante.nombre.charAt(0).toUpperCase() }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2">
                  <span class="min-w-0 flex-1 text-sm font-semibold truncate"
                    [class]="i === resaltado() ? 'text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-200'">
                    {{ r.discursante.nombre }}
                  </span>
                  @if (esActual(r)) {
                    <span class="shrink-0 text-[0.6rem] font-bold text-teal-700 dark:text-teal-300">Actual</span>
                  }
                  @if (r.discursante.telefono) {
                    <span class="shrink-0 font-mono text-[0.65rem] text-slate-400 dark:text-slate-500 tabular-nums">{{ telefonoLegible(r.discursante.telefono) }}</span>
                  }
                </div>
                @if (i >= nDeCongregacion()) {
                <div class="flex items-center gap-1 mt-0.5 text-[0.7rem] text-slate-400 dark:text-slate-500">
                  <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  <span class="truncate">{{ r.congregacion.nombre }}</span>
                </div>
                }
                @if (r.discursante.bosquejos.length > 0) {
                  <!-- Los números de todos sus bosquejos, para reconocerlo de un
                       vistazo; el título completo va en el tooltip. -->
                  <div class="flex items-center gap-1 mt-1 min-w-0" [title]="r.discursante.bosquejos.join('\n')">
                    @for (b of r.discursante.bosquejos.slice(0, 4); track b) {
                      <span class="font-mono text-[0.6rem] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-400/15 px-1.5 py-px rounded tabular-nums">{{ etiquetaBosquejo(b) }}</span>
                    }
                    @if (r.discursante.bosquejos.length > 4) {
                      <span class="text-[0.6rem] font-bold text-slate-400">+{{ r.discursante.bosquejos.length - 4 }}</span>
                    }
                    <span class="min-w-0 flex-1 truncate text-[0.65rem] text-slate-400 dark:text-slate-500">
                      {{ r.discursante.bosquejos.length === 1 ? tituloBosquejo(r.discursante.bosquejos[0]) : r.discursante.bosquejos.length + ' bosquejos' }}
                    </span>
                  </div>
                }
              </div>
            </button>
          }
        </div>
        <!-- El listado ya explica de dónde sale el dato: quien no reconoce
             ningún nombre entiende que puede seguir escribiendo el suyo. -->
        <p class="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 text-[0.65rem] text-slate-400 dark:text-slate-500">
          Al elegir se rellenan congregación y discurso
        </p>
      </div>
    }
  `,
})
export class OradorCatalogoInputComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private svc = inject(DiscursosService);

  @ViewChild('campo') campoRef?: ElementRef<HTMLInputElement>;

  /** Valor inicial cuando NO se usa ngModel (tarjetas con [value] + (blur)/(commit)). */
  @Input() set value(v: string | null | undefined) {
    this.texto.set(v ?? '');
  }
  @Input() disabled = false;
  @Input() placeholder = '';
  @Input() inputClass = '';
  /** Congregación (id_congregacion) cuyo directorio se busca. */
  @Input() idCong: number | null = null;
  /**
   * Congregación de origen ya escrita en la fila. Si está registrada en el
   * directorio, el campo ofrece sus discursantes nada más entrar, sin tener
   * que escribir; si no lo está (escrita a mano), no cambia nada.
   */
  @Input() congregacion: string | null = null;

  /** Valor final del campo: al elegir una sugerencia o al salir del campo. */
  @Output() commit = new EventEmitter<string | null>();
  /** El discursante elegido y su congregación, para autocompletar el resto de la fila. */
  @Output() seleccion = new EventEmitter<DiscursanteConCongregacion>();

  readonly listboxId = `orador-catalogo-${Math.random().toString(36).slice(2, 9)}`;

  texto = signal('');
  directorio: Signal<readonly CongregacionContacto[]> = signal([]);
  sugerencias = signal<DiscursanteConCongregacion[]>([]);
  abierto = signal(false);
  resaltado = signal(-1);
  pos = signal({ top: 0, left: 0, width: 0 });
  /** Cuántas de las sugerencias son de la congregación de origen (van primero). */
  nDeCongregacion = signal(0);
  nombreCongregacion = signal('');

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};
  private ultimoEmitido: string | null = null;

  ngOnInit(): void {
    this.directorio = this.svc.directorioContacto(this.idCong);
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
    // Con congregación registrada se abre con SU lista, haya o no algo
    // escrito: quien entra al campo viene a elegir a uno de ellos. Filtrar
    // por el nombre que ya estaba dejaba fuera a toda la congregación justo
    // después de cambiarla. Escribir vuelve a filtrar con normalidad.
    if (this.congregacionRegistrada()) this.filtrar('');
    else if (this.texto().trim()) this.filtrar(this.texto());
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
    if (!this.abierto() || this.sugerencias().length === 0) {
      if (ev.key === 'ArrowDown' && (this.texto().trim() || this.congregacionRegistrada())) this.filtrar(this.texto());
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.resaltado.set((this.resaltado() + 1) % this.sugerencias().length);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      const n = this.sugerencias().length;
      this.resaltado.set((this.resaltado() - 1 + n) % n);
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

  elegir(r: DiscursanteConCongregacion): void {
    this.texto.set(r.discursante.nombre);
    this.cerrar();
    this.resaltado.set(-1);
    this.onChange(r.discursante.nombre);
    // Sin `commit` aquí: quien escucha `seleccion` guarda el nombre junto con
    // el resto de la fila en una sola petición. Emitir también `commit`
    // lanzaba un segundo guardado solo con el nombre cuya respuesta, si
    // llegaba después, dejaba la fila sin la congregación recién puesta.
    this.ultimoEmitido = r.discursante.nombre;
    this.seleccion.emit(r);
    this.campoRef?.nativeElement.focus();
  }

  /** Si la sugerencia es el orador que ya está puesto en la fila. */
  esActual(r: DiscursanteConCongregacion): boolean {
    const t = this.normalizar(this.texto().trim());
    return !!t && this.normalizar(r.discursante.nombre) === t;
  }

  /** La congregación de origen de la fila, sólo si está en el directorio (comparada sin tildes ni mayúsculas). */
  private congregacionRegistrada(): CongregacionContacto | undefined {
    const nombre = this.normalizar((this.congregacion ?? '').trim());
    if (!nombre) return undefined;
    return this.directorio().find(c => this.normalizar(c.nombre) === nombre);
  }

  /** 3145678902 → "314 567 8902", igual que en la tarjeta de la congregación. */
  telefonoLegible(tel: string): string {
    const d = tel.replace(/\D/g, '');
    return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : tel;
  }

  /** "110. La familia feliz…" → "Nº 110"; sin número, "Sin nº". */
  etiquetaBosquejo(b: string): string {
    const m = /^\s*(\d{1,3})\s*[.\-–]/.exec(b);
    return m ? `Nº ${m[1]}` : 'Sin nº';
  }

  /** "110. La familia feliz…" → "La familia feliz…". */
  tituloBosquejo(b: string): string {
    return b.replace(/^\s*\d{1,3}\s*[.\-–]\s*/, '');
  }

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
    const query = this.normalizar(q.trim());
    const origen = this.congregacionRegistrada();
    if (!query && !origen) {
      this.cerrar();
      this.sugerencias.set([]);
      return;
    }

    const coincide = (d: Discursante) => !query || this.normalizar(d.nombre).includes(query);
    // Quien empieza por lo escrito ("Este" → "Esteban") va antes que quien
    // sólo lo contiene ("Este" → "Camilo Esteban"), que es como se suele
    // recordar un nombre a medio escribir.
    const ordenar = (a: DiscursanteConCongregacion, b: DiscursanteConCongregacion) => {
      const pa = query && this.normalizar(a.discursante.nombre).startsWith(query) ? 0 : 1;
      const pb = query && this.normalizar(b.discursante.nombre).startsWith(query) ? 0 : 1;
      return pa - pb || a.discursante.nombre.localeCompare(b.discursante.nombre);
    };

    // Primero los de la congregación de origen (todos, si no se ha escrito
    // nada); después, sólo si se está buscando un nombre, los que coincidan
    // en el resto del directorio. Son pocas congregaciones y pocos
    // discursantes cada una: no vale la pena un índice aparte.
    const deOrigen: DiscursanteConCongregacion[] = origen
      ? origen.discursantes.filter(coincide).map(discursante => ({ discursante, congregacion: origen })).sort(ordenar)
      : [];
    const otros: DiscursanteConCongregacion[] = [];
    if (query) {
      for (const congregacion of this.directorio()) {
        if (congregacion === origen) continue;
        for (const discursante of congregacion.discursantes) {
          if (coincide(discursante)) otros.push({ discursante, congregacion });
        }
      }
      otros.sort(ordenar);
    }

    const lista = [...deOrigen, ...otros].slice(0, 12);
    this.nDeCongregacion.set(Math.min(deOrigen.length, lista.length));
    this.nombreCongregacion.set(origen?.nombre ?? '');
    this.sugerencias.set(lista);
    // Resaltado: el orador que ya está puesto, si aparece; si no, el primero.
    const actual = lista.findIndex(r => this.esActual(r));
    this.resaltado.set(lista.length > 0 ? Math.max(actual, 0) : -1);

    if (lista.length > 0) {
      this.medir();
      this.abrir();
    } else {
      this.cerrar();
    }
  }

  private normalizar(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private static readonly ANCHO_MIN = 320;

  private medir(): void {
    const el = this.campoRef?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();

    const margen = 8;
    const disponible = window.innerWidth - margen * 2;
    const ancho = Math.min(Math.max(r.width, OradorCatalogoInputComponent.ANCHO_MIN), disponible);
    const left = Math.max(margen, Math.min(r.left, window.innerWidth - ancho - margen));

    const alto = Math.min(330, this.sugerencias().length * 62 + 60);
    const cabeDebajo = window.innerHeight - r.bottom > alto + 8;

    this.pos.set({
      top: cabeDebajo ? r.bottom + 4 : Math.max(margen, r.top - alto - 4),
      left,
      width: ancho,
    });
  }
}

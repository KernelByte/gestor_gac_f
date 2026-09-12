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
import { CongregacionContacto } from '../models/discursos.models';

/**
 * Campo de texto con sugerencias del directorio de congregaciones de
 * contacto (ver `app-discurso-catalogo-input`, del que este componente es
 * una copia adaptada: mismo patrón de desplegable fixed + filtro cliente).
 *
 * No obliga a elegir del directorio: sigue funcionando como el input libre
 * que había antes para congregaciones que aún no se han guardado.
 */
@Component({
  selector: 'app-congregacion-contacto-input',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CongregacionContactoInputComponent),
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
        [id]="listboxId" role="listbox" (mousedown)="$event.preventDefault()">
        <div class="flex flex-col p-1.5 gap-0.5 max-h-64 overflow-y-auto simple-scrollbar">
          @for (c of sugerencias(); track c.id_congregacion_contacto; let i = $index) {
            <button type="button"
              [id]="listboxId + '-' + i"
              role="option"
              [attr.aria-selected]="i === resaltado()"
              (mousedown)="$event.preventDefault(); elegir(c)"
              (mouseenter)="resaltado.set(i)"
              class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-[background-color] duration-100 ease-out"
              [class]="i === resaltado()
                ? 'bg-teal-50 dark:bg-teal-900/20'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'">
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                [class]="i === resaltado() ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              <span class="flex-1 min-w-0 text-sm font-medium truncate transition-colors duration-100"
                [class]="i === resaltado()
                  ? 'text-teal-700 dark:text-teal-300'
                  : 'text-slate-700 dark:text-slate-200'">
                {{ c.nombre }}
              </span>
              @if (c.hora_reunion_fin_semana) {
                <span class="shrink-0 text-[0.65rem] text-slate-400">{{ c.dia_reunion_fin_semana || '' }} {{ c.hora_reunion_fin_semana }}</span>
              }
            </button>
          }
        </div>
      </div>
    }

    <!-- Ofrecimiento de alta en el directorio.
         Va debajo del campo y no dentro del desplegable porque el caso que
         importa es justo cuando el desplegable NO se ve: quien escribe el
         nombre entero y sale del campo nunca llegó a abrirlo, y es ahí donde
         se pierde la ocasión de guardar la congregación. Tampoco es un diálogo:
         apuntar la congregación es opcional y no debe cortar lo que se estaba
         haciendo. -->
    @if (permitirCrear && porCrear(); as nombre) {
      <!-- flex-wrap y sin truncate: esto vive en una columna de rejilla que en
           pantallas medianas baja de 200 px. Con una sola línea el mensaje se
           cortaba a la mitad; así los botones caen debajo y todo se lee.
           El nombre no se repite aquí porque está en el campo de arriba. -->
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 px-2 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200/70 dark:border-teal-800/50">
        <span class="text-[0.65rem] leading-tight text-teal-800 dark:text-teal-300">
          No está en el directorio
        </span>
        <button type="button"
          (click)="crearAhora()"
          [disabled]="creando()"
          [title]="'Guardar ' + nombre + ' en el directorio de congregaciones'"
          class="px-2 h-6 rounded-md bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-wait text-white text-[0.6rem] font-bold transition-colors active:scale-95">
          {{ creando() ? 'Añadiendo…' : 'Añadir' }}
        </button>
        <button type="button"
          (click)="porCrear.set(null)"
          [attr.aria-label]="'Descartar: no añadir ' + nombre + ' al directorio'"
          class="w-6 h-6 rounded-md flex items-center justify-center text-teal-600/70 dark:text-teal-400/70 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    }
  `,
})
export class CongregacionContactoInputComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private svc = inject(DiscursosService);

  @ViewChild('campo') campoRef?: ElementRef<HTMLInputElement>;

  /** Valor inicial cuando NO se usa ngModel (tarjetas con [value] + (commit)). */
  @Input() set value(v: string | null | undefined) {
    this.texto.set(v ?? '');
  }
  @Input() disabled = false;
  @Input() placeholder = '';
  @Input() inputClass = '';
  /** Congregación (id_congregacion) cuyo directorio se busca. */
  @Input() idCong: number | null = null;

  /**
   * Ofrecer el alta en el directorio cuando el nombre escrito no está en él.
   *
   * Es opcional porque no todos los sitios donde se escribe una congregación
   * quieren dar de alta nada: dentro de un formulario que ya tiene su propio
   * guardado, un alta paralela y silenciosa despista más que ayuda.
   */
  @Input() permitirCrear = false;

  /** Valor final del campo: al elegir una sugerencia o al salir del campo. */
  @Output() commit = new EventEmitter<string | null>();
  /** La congregación de contacto elegida, para autocompletar hora/ubicación. */
  @Output() seleccion = new EventEmitter<CongregacionContacto>();
  /** La congregación recién dada de alta desde este campo. */
  @Output() creada = new EventEmitter<CongregacionContacto>();

  readonly listboxId = `cong-contacto-${Math.random().toString(36).slice(2, 9)}`;

  texto = signal('');
  /**
   * Directorio compartido por todos los campos, no una copia propia.
   *
   * Es lo que hace que dar de alta una congregación desde una fecha la ponga
   * al instante en el autocompletado de las demás.
   */
  directorio: Signal<readonly CongregacionContacto[]> = signal([]);
  sugerencias = signal<CongregacionContacto[]>([]);
  abierto = signal(false);
  resaltado = signal(-1);
  pos = signal({ top: 0, left: 0, width: 0 });

  /** Nombre escrito que no está en el directorio, a la espera de decisión. */
  porCrear = signal<string | null>(null);
  creando = signal(false);

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
    if (!this.abierto() || this.sugerencias().length === 0) {
      if (ev.key === 'ArrowDown' && this.texto().trim()) this.filtrar(this.texto());
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

  elegir(c: CongregacionContacto): void {
    this.texto.set(c.nombre);
    this.cerrar();
    this.resaltado.set(-1);
    this.onChange(c.nombre);
    this.seleccion.emit(c);
    this.emitirSiCambio(c.nombre);
    this.campoRef?.nativeElement.focus();
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
    this.revisarSiFaltaEnDirectorio(v);
  }

  /**
   * Decide si ofrecer el alta del nombre recién escrito.
   *
   * Se compara normalizado —sin tildes ni mayúsculas— igual que el filtro de
   * sugerencias: ofrecer "añadir Palmira Norte" cuando ya existe "palmira
   * norte" crearía duplicados que luego ensucian el autocompletado de todos.
   */
  private revisarSiFaltaEnDirectorio(nombre: string | null): void {
    if (!this.permitirCrear || !nombre) {
      this.porCrear.set(null);
      return;
    }
    const buscado = this.normalizar(nombre);
    const existe = this.directorio().some(c => this.normalizar(c.nombre) === buscado);
    this.porCrear.set(existe ? null : nombre);
  }

  /**
   * Da de alta la congregación con solo el nombre.
   *
   * El resto de datos —día, hora, dirección, contactos— se rellenan después
   * desde la pestaña Congregaciones. Pedirlos aquí convertiría un apunte de
   * dos segundos en un formulario, y quien está programando el mes no suele
   * tenerlos a mano en ese momento.
   */
  crearAhora(): void {
    const nombre = this.porCrear();
    if (!nombre || this.creando()) return;

    this.creando.set(true);
    this.svc.crearCongregacionContacto({ nombre }, this.idCong).subscribe({
      next: (c) => {
        // Entra en el directorio COMPARTIDO: la congregación queda disponible
        // en el autocompletado de todas las demás fechas al instante, no solo
        // en este campo ni solo tras recargar.
        this.svc.anadirADirectorio(c);
        this.porCrear.set(null);
        this.creando.set(false);
        this.creada.emit(c);
      },
      error: () => {
        // Sin alta no se pierde nada: el nombre escrito sigue guardado en la
        // fecha. Se deja el ofrecimiento para poder reintentar.
        this.creando.set(false);
      },
    });
  }

  private filtrar(q: string): void {
    const query = this.normalizar(q.trim());
    const datos = this.directorio();
    if (!query || datos.length === 0) {
      this.cerrar();
      this.sugerencias.set([]);
      return;
    }

    const coincidencias = datos.filter(c => this.normalizar(c.nombre).includes(query));
    this.sugerencias.set(coincidencias.slice(0, 8));
    this.resaltado.set(coincidencias.length > 0 ? 0 : -1);

    if (coincidencias.length > 0) {
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
    const ancho = Math.min(Math.max(r.width, CongregacionContactoInputComponent.ANCHO_MIN), disponible);
    const left = Math.max(margen, Math.min(r.left, window.innerWidth - ancho - margen));

    const alto = Math.min(264, this.sugerencias().length * 44 + 12);
    const cabeDebajo = window.innerHeight - r.bottom > alto + 8;

    this.pos.set({
      top: cabeDebajo ? r.bottom + 4 : Math.max(margen, r.top - alto - 4),
      left,
      width: ancho,
    });
  }
}

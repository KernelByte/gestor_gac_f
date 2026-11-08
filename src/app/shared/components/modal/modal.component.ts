import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

/**
 * Forma del panel:
 *   dialog → centrado (por defecto).
 *   sheet  → hoja inferior en móvil (con asa), centrado desde `sm`.
 *   drawer → cajón a la derecha, alto completo (detalle o edición lateral).
 */
export type ModalVariant = 'dialog' | 'sheet' | 'drawer';

let siguienteId = 0;
/** Modales abiertos, del más antiguo al más reciente. Esc cierra solo el último. */
const abiertos: ModalComponent[] = [];

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div
      *ngIf="open"
      class="fixed inset-0 flex"
      [ngClass]="clasesContenedor"
      [style.z-index]="variant === 'drawer' ? 'var(--z-drawer)' : 'var(--z-modal)'"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="title ? tituloId : null"
      [attr.data-testid]="testId"
    >
      <!-- Velo: único para toda la app. El desenfoque es leve (2 px): aísla el
           primer plano sin volver ilegible lo de atrás. -->
      <div
        class="absolute inset-0 animate-fadeIn"
        [ngClass]="velo === 'enfocado' ? 'backdrop-blur-md backdrop-saturate-50' : 'backdrop-blur-[2px]'"
        [style.background]="velo === 'enfocado' ? 'var(--velo-enfocado)' : 'var(--velo)'"
        (click)="dismissible && closeOnBackdrop && close()"
      ></div>

      <!-- Panel: max-h + flex-col para que el cuerpo sea lo único que se
           desplaza. Sin esto, un modal más alto que la pantalla (típico en
           móvil con el teclado abierto) se recorta y el resto queda
           inalcanzable. -->
      <div
        #panel
        tabindex="-1"
        class="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl w-full flex flex-col outline-none"
        [class.rounded-2xl]="variant === 'dialog'"
        [class.max-h-[90dvh]]="variant !== 'drawer'"
        [class.animate-scale-in]="variant === 'dialog'"
        [class.rounded-t-2xl]="variant === 'sheet'"
        [class.sm:rounded-2xl]="variant === 'sheet'"
        [class.animate-sheet-in]="variant === 'sheet'"
        [class.h-full]="variant === 'drawer'"
        [class.rounded-l-2xl]="variant === 'drawer'"
        [class.border-r-0]="variant === 'drawer'"
        [class.animate-drawer-in]="variant === 'drawer'"
        [class.max-w-sm]="size === 'sm'"
        [class.max-w-md]="size === 'md'"
        [class.max-w-lg]="size === 'lg'"
        [class.max-w-2xl]="size === 'xl'"
        [class.max-w-4xl]="size === '2xl'"
        [class.max-w-6xl]="size === '3xl'"
      >
        <!-- Asa de la hoja inferior (solo móvil) -->
        <div *ngIf="variant === 'sheet'" class="sm:hidden shrink-0 pt-2.5 pb-1" aria-hidden="true">
          <div class="mx-auto w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></div>
        </div>

        <!-- Header -->
        <div *ngIf="title" class="shrink-0 flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div class="min-w-0 flex-1">
            <h2 [id]="tituloId" class="display-section text-xl">{{ title }}</h2>
            <p *ngIf="subtitle" class="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{{ subtitle }}</p>
          </div>
          <ng-content select="[slot=header-actions]"></ng-content>
          <button
            *ngIf="dismissible"
            type="button"
            (click)="close()"
            class="btn-icon-sm -mr-1.5"
            aria-label="Cerrar"
          >
            <lucide-icon name="x" [size]="20"></lucide-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 min-h-0 overflow-y-auto" [class.p-6]="padding" [class.px-6]="padding && title" [class.py-5]="padding && title">
          <ng-content></ng-content>
        </div>

        <!-- Footer -->
        <div *ngIf="hasFooter" class="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40" [class.rounded-b-2xl]="variant === 'dialog'">
          <ng-content select="[slot=footer]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Hoja y cajón entran por transform (barato) y respetan reduced-motion. */
    @keyframes sheetIn  { from { transform: translateY(100%); } to { transform: none; } }
    @keyframes drawerIn { from { transform: translateX(100%); } to { transform: none; } }
    .animate-sheet-in  { animation: sheetIn 0.28s var(--ease-out-strong) both; }
    .animate-drawer-in { animation: drawerIn 0.28s var(--ease-out-strong) both; }
    @media (min-width: 640px) { .animate-sheet-in { animation: scaleFadeIn 0.22s var(--ease-out-strong) both; } }
    @media (prefers-reduced-motion: reduce) {
      .animate-sheet-in, .animate-drawer-in { animation: none; }
    }
  `],
})
export class ModalComponent implements AfterViewChecked, OnDestroy {
  /**
   * `title` es un @Input, pero también es un atributo HTML nativo que el
   * navegador interpreta como tooltip al pasar el mouse. Cuando el padre lo
   * pasa como texto plano (`title="…"`, sin corchetes — la forma más natural
   * de escribirlo), Angular deja ESE MISMO string como atributo real en
   * `<app-modal>`, y el usuario ve un tooltip nativo flotando sobre todo el
   * modal con el título repetido. Este binding lo anula siempre: el título
   * visible sigue siendo el `<h2>` de la cabecera, nunca un tooltip.
   */
  @HostBinding('attr.title') protected readonly hostTitleAttr = null;

  @Input() open: boolean = false;
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() size: ModalSize = 'md';
  @Input() variant: ModalVariant = 'dialog';
  @Input() dismissible: boolean = true;
  /** Si es false, el clic en el velo no cierra (formularios con datos a medias). */
  @Input() closeOnBackdrop: boolean = true;
  /**
   * Modo controlado: al pedir el cierre (X, Esc, velo) el modal NO se oculta
   * solo; solo emite `openChange(false)`/`closed` y el padre decide. Sirve para
   * formularios que pueden rechazar el cierre («cambios sin guardar»).
   */
  @Input() controlled: boolean = false;
  @Input() hasFooter: boolean = false;
  /** `data-testid` del diálogo entero (cuerpo y pie). En el host no sirve: el panel es fixed y el host no tiene caja. */
  @Input() testId: string | null = null;
  @Input() padding: boolean = true;
  /**
   * `suave` (por defecto): el fondo se sigue leyendo. `enfocado`: fondo
   * desenfocado y más oscuro, para fichas de consulta donde lo de atrás
   * (p. ej. una tabla llena de datos parecidos) distrae o confunde.
   */
  @Input() velo: 'suave' | 'enfocado' = 'suave';

  @Output() openChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;

  /** Id único por instancia: con dos modales abiertos, aria-labelledby no se pisa. */
  protected readonly tituloId = `modal-titulo-${++siguienteId}`;

  private estabaAbierto = false;
  private disparador: HTMLElement | null = null;

  ngAfterViewChecked(): void {
    if (this.open && !this.estabaAbierto) {
      this.estabaAbierto = true;
      abiertos.push(this);
      this.disparador = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // El foco entra al primer control del cuerpo; si no hay, al propio panel.
      queueMicrotask(() => {
        const p = this.panel?.nativeElement;
        if (!p) return;
        (p.querySelector<HTMLElement>('[autofocus], input, select, textarea') ?? p).focus({ preventScroll: true });
      });
    } else if (!this.open && this.estabaAbierto) {
      this.estabaAbierto = false;
      this.sacarDeLaPila();
      this.devolverFoco();
    }
  }

  ngOnDestroy(): void {
    this.sacarDeLaPila();
    if (this.estabaAbierto) this.devolverFoco();
  }

  private sacarDeLaPila(): void {
    const i = abiertos.indexOf(this);
    if (i >= 0) abiertos.splice(i, 1);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    // Con modales apilados, Esc cierra solo el de más arriba.
    if (this.open && this.dismissible && abiertos[abiertos.length - 1] === this) this.close();
  }

  /** Mantiene el Tab dentro del panel mientras está abierto. */
  @HostListener('keydown', ['$event'])
  atraparTab(e: KeyboardEvent) {
    if (!this.open || e.key !== 'Tab') return;
    const p = this.panel?.nativeElement;
    if (!p) return;
    const foco = Array.from(
      p.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(el => el.offsetParent !== null);
    if (foco.length === 0) { e.preventDefault(); p.focus(); return; }
    const primero = foco[0], ultimo = foco[foco.length - 1];
    const activo = document.activeElement;
    if (e.shiftKey && (activo === primero || activo === p)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus(); }
  }

  /** Posición del panel según la variante. Va en un solo getter: dos bindings
   *  `[class.justify-center]` en la misma plantilla se pisan entre sí. */
  protected get clasesContenedor(): string {
    switch (this.variant) {
      case 'sheet':  return 'items-end justify-center sm:items-center sm:p-4';
      case 'drawer': return 'justify-end';
      default:       return 'items-center justify-center p-4';
    }
  }

  close() {
    if (!this.controlled) this.open = false;
    this.openChange.emit(false);
    this.closed.emit();
  }

  private devolverFoco() {
    const d = this.disparador;
    this.disparador = null;
    if (d && document.contains(d)) queueMicrotask(() => d.focus({ preventScroll: true }));
  }
}

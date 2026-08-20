import {
  Component, ElementRef, EventEmitter, HostListener, Input, Output,
  ViewChild, computed, forwardRef, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ExhibidoresService } from '../services/exhibidores.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { GeoJSONPoint, PuntoSacada } from '../models/exhibidor.model';
import { SelectorUbicacionComponent } from './selector-ubicacion.component';

/**
 * Selector de punto de sacada con creación en línea.
 *
 * El problema que resuelve: en una congregación nueva no existe ningún punto
 * de sacada, así que un <select> normal sale vacío y el formulario de ubicación
 * queda sin salida — hay que cancelar, ir a otra pantalla, crear el punto y
 * volver a empezar. Aquí se crea sin abandonar el formulario: se escribe el
 * nombre en el mismo campo de búsqueda y aparece "Crear «…»".
 *
 * El alta rápida pide nombre, dirección y una posición en el mapa — todo
 * opcional salvo el nombre. Referencia y responsable se completan después en
 * "Puntos de sacada": son datos útiles pero nunca bloqueantes para dar de
 * alta una ubicación.
 */
@Component({
  selector: 'app-punto-sacada-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectorUbicacionComponent],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => PuntoSacadaPickerComponent),
    multi: true,
  }],
  template: `
    <div class="relative">
      <!-- ── Trigger ───────────────────────────────────────── -->
      <button type="button"
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left
                     transition-colors focus-ring-blue min-h-11
                     bg-white dark:bg-slate-800
                     border-slate-200 dark:border-slate-700
                     hover:border-slate-300 dark:hover:border-slate-600"
              [class.border-exh-500]="abierto()"
              [disabled]="disabled"
              [attr.aria-expanded]="abierto()"
              aria-haspopup="listbox"
              (click)="alternar()">
        <svg class="w-4 h-4 shrink-0" [class.text-exh-600]="seleccionado()"
             [class.text-slate-400]="!seleccionado()"
             fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/>
        </svg>

        <span class="flex-1 min-w-0">
          <span class="block text-sm truncate"
                [class.text-slate-800]="seleccionado()"
                [class.dark:text-slate-100]="seleccionado()"
                [class.text-slate-400]="!seleccionado()"
                [class.italic]="!seleccionado()">
            {{ seleccionado()?.nombre ?? 'Sin punto de sacada' }}
          </span>
          <span *ngIf="subtituloSeleccion() as sub"
                class="block text-xs text-slate-400 dark:text-slate-500 truncate">
            {{ sub }}
          </span>
        </span>

        <svg class="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200"
             [class.rotate-180]="abierto()"
             fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      <!-- ── Panel ─────────────────────────────────────────── -->
      <!-- Fondo slate-900 en oscuro (no slate-800, que es el del modal) y sombra
           marcada: sin eso el panel se funde con el diálogo y no se lee como
           una capa flotante. Misma receta que los pickers compartidos. -->
      <div *ngIf="abierto()"
           class="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border
                  bg-white dark:bg-slate-900
                  border-slate-200 dark:border-slate-800 origin-top panel-in panel-elev">

        <!-- Estado vacío: enseña qué es y deja crear el primero -->
        <div *ngIf="puntos.length === 0 && !creando()" class="p-4 text-center">
          <svg class="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" fill="none"
               stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/>
          </svg>
          <p class="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Aún no hay puntos de sacada
          </p>
          <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Es el lugar donde se guarda y se recoge el carrito.
            Varias ubicaciones pueden compartir el mismo.
          </p>
          <button type="button" class="btn-primary-blue mt-3 !py-1.5 !px-3 text-xs"
                  (click)="empezarCreacion('')">
            Crear el primero
          </button>
        </div>

        <!-- Lista + búsqueda -->
        <ng-container *ngIf="puntos.length > 0 && !creando()">
          <div class="p-2 border-b border-slate-100 dark:border-slate-700/60">
            <div class="relative">
              <svg class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                   fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.5-3.5"/>
              </svg>
              <input #buscador
                     class="w-full pl-8 pr-2 py-1.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-900/60
                            border border-transparent focus:border-exh-500 focus:outline-none
                            text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                     [ngModel]="busqueda()"
                     (ngModelChange)="busqueda.set($event)"
                     (keydown.enter)="onEnterBusqueda($event)"
                     placeholder="Buscar o escribir uno nuevo…"
                     aria-label="Buscar punto de sacada" />
            </div>
          </div>

          <div class="max-h-56 overflow-y-auto p-1" role="listbox">
            <!-- Opción: ninguno. Se esconde al buscar: no casa con lo tecleado. -->
            <button *ngIf="!busqueda().trim()"
                    type="button" role="option" [attr.aria-selected]="value === null"
                    class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm
                           transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    (click)="elegir(null)">
              <span class="w-4 shrink-0">
                <svg *ngIf="value === null" class="w-4 h-4 text-exh-600" fill="none"
                     stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
              </span>
              <span class="text-slate-500 dark:text-slate-400 italic">Sin punto de sacada</span>
            </button>

            <button *ngFor="let p of filtrados()" type="button" role="option"
                    [attr.aria-selected]="value === p.id_punto_sacada"
                    class="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left
                           transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    (click)="elegir(p.id_punto_sacada)">
              <span class="w-4 shrink-0 pt-0.5">
                <svg *ngIf="value === p.id_punto_sacada" class="w-4 h-4 text-exh-600" fill="none"
                     stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm text-slate-800 dark:text-slate-100 truncate">{{ p.nombre }}</span>
                <span class="block text-xs text-slate-400 dark:text-slate-500 truncate">
                  {{ p.direccion || 'Sin dirección' }}
                  <span *ngIf="!p.coordenadas" class="text-amber-600 dark:text-amber-500">
                    · sin ubicación en el mapa
                  </span>
                </span>
              </span>
            </button>

            <p *ngIf="filtrados().length === 0 && !nombreNuevo()"
               class="px-2.5 py-3 text-xs text-slate-400 italic text-center">
              Ningún punto coincide.
            </p>
          </div>

          <!-- Crear lo que se está escribiendo -->
          <button *ngIf="nombreNuevo() as nuevo" type="button"
                  class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold
                         border-t border-slate-100 dark:border-slate-700/60
                         text-exh-700 dark:text-exh-300
                         hover:bg-exh-50 dark:hover:bg-exh-950/50 transition-colors rounded-b-xl"
                  (click)="empezarCreacion(nuevo)">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Crear «{{ nuevo }}»
          </button>

          <!-- Alta desde cero cuando no se está escribiendo nada -->
          <button *ngIf="!nombreNuevo()" type="button"
                  class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium
                         border-t border-slate-100 dark:border-slate-700/60
                         text-slate-600 dark:text-slate-300
                         hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-b-xl"
                  (click)="empezarCreacion('')">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Nuevo punto de sacada
          </button>
        </ng-container>

        <!-- ── Alta rápida ─────────────────────────────────── -->
        <div *ngIf="creando()" class="p-3">
          <p class="eyebrow mb-2.5">Nuevo punto de sacada</p>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300" for="ps-nombre">
              Nombre <span class="text-red-500">*</span>
            </label>
            <input #nombreInput id="ps-nombre"
                   class="w-full px-3 py-2 rounded-lg text-sm
                          bg-white dark:bg-slate-900/60
                          border text-slate-800 dark:text-slate-100
                          placeholder:text-slate-400 focus:outline-none"
                   [class.border-slate-200]="!error()"
                   [class.dark:border-slate-700]="!error()"
                   [class.focus:border-exh-500]="!error()"
                   [class.border-red-400]="error()"
                   [ngModel]="nuevoNombre()"
                   (ngModelChange)="nuevoNombre.set($event); error.set(null)"
                   (keydown.enter)="guardar()"
                   placeholder="Ej. Casa de Norbert" />
            <p *ngIf="error() as e" class="text-xs text-red-600 dark:text-red-400">{{ e }}</p>
          </div>

          <div class="flex flex-col gap-1.5 mt-3">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300" for="ps-dir">
              Dirección <span class="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input id="ps-dir"
                   class="w-full px-3 py-2 rounded-lg text-sm
                          bg-white dark:bg-slate-900/60
                          border border-slate-200 dark:border-slate-700
                          text-slate-800 dark:text-slate-100
                          placeholder:text-slate-400 focus:border-exh-500 focus:outline-none"
                   [ngModel]="nuevaDireccion()"
                   (ngModelChange)="nuevaDireccion.set($event)"
                   (keydown.enter)="guardar()"
                   placeholder="Calle, barrio o referencia" />
          </div>

          <div class="flex flex-col gap-1.5 mt-3">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
              Posición en el mapa <span class="text-slate-400 font-normal">(opcional)</span>
            </label>
            <app-selector-ubicacion
              [value]="nuevaCoordenada()"
              (valueChange)="nuevaCoordenada.set($event)"
              [titulo]="nuevoNombre().trim() || 'Nuevo punto de sacada'"
              [puntosRef]="puntos"
            />
          </div>

          <p class="mt-2.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            El responsable se añade después desde
            <span class="font-medium text-slate-500 dark:text-slate-400">Puntos de sacada</span>.
          </p>

          <div class="flex justify-end gap-2 mt-3">
            <button type="button" class="btn-secondary !py-1.5 !px-3 text-xs" (click)="cancelarCreacion()">
              Cancelar
            </button>
            <button type="button" class="btn-primary-blue !py-1.5 !px-3 text-xs"
                    [disabled]="guardando() || !nuevoNombre().trim()"
                    (click)="guardar()">
              {{ guardando() ? 'Creando…' : 'Crear y seleccionar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* El keyframe y su uso viven en la misma hoja de estilos del componente:
       Angular no renombra @keyframes, pero depender de uno definido aquí desde
       una utilidad generada en la hoja global es frágil. */
    .panel-in { animation: sacadaIn 140ms cubic-bezier(0.16, 1, 0.3, 1) backwards; }

    .panel-elev { box-shadow: 0 8px 32px -4px rgba(0,0,0,0.16), 0 2px 8px -2px rgba(0,0,0,0.08); }
    :host-context(.dark) .panel-elev {
      box-shadow: 0 8px 32px -4px rgba(0,0,0,0.55), 0 2px 8px -2px rgba(0,0,0,0.35);
    }

    /* backwards, nunca both: con both el transform final queda aplicado, el
       panel crea un stacking context y atrapa cualquier popup superpuesto. */
    @keyframes sacadaIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.985); }
      to   { opacity: 1; transform: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .panel-in { animation: none; }
    }
  `],
})
export class PuntoSacadaPickerComponent implements ControlValueAccessor {
  /**
   * Lista actual de puntos. Va por señal, no por propiedad plana: los computed
   * de abajo dependen de ella y con un @Input() normal no se recalcularían al
   * añadir un punto nuevo (se quedarían con la lista vacía inicial).
   */
  private _puntos = signal<PuntoSacada[]>([]);
  @Input() set puntos(v: PuntoSacada[] | null) { this._puntos.set(v ?? []); }
  get puntos(): PuntoSacada[] { return this._puntos(); }

  @Input() idCongregacion: number | null = null;

  /** Deshabilitado por plantilla o por el formulario (CVA); manda cualquiera. */
  private _disabledInput = signal(false);
  private _disabledCva = signal(false);
  @Input() set disabled(v: boolean) { this._disabledInput.set(v); }
  get disabled(): boolean { return this._disabledInput() || this._disabledCva(); }

  /** Emite el punto recién creado para que el padre refresque su lista. */
  @Output() creado = new EventEmitter<PuntoSacada>();

  @ViewChild('buscador') buscadorRef?: ElementRef<HTMLInputElement>;
  @ViewChild('nombreInput') nombreRef?: ElementRef<HTMLInputElement>;

  private el = inject(ElementRef);
  private svc = inject(ExhibidoresService);
  private toast = inject(ToastService);

  abierto = signal(false);
  creando = signal(false);
  guardando = signal(false);
  busqueda = signal('');
  nuevoNombre = signal('');
  nuevaDireccion = signal('');
  nuevaCoordenada = signal<GeoJSONPoint | null>(null);
  error = signal<string | null>(null);

  /** Id seleccionado. Señal por el mismo motivo que _puntos. */
  private _value = signal<number | null>(null);
  get value(): number | null { return this._value(); }

  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  seleccionado = computed(() =>
    this._puntos().find(p => p.id_punto_sacada === this._value()) ?? null
  );

  subtituloSeleccion = computed(() => {
    const p = this.seleccionado();
    if (!p) return null;
    return p.direccion || (p.coordenadas ? 'Ubicado en el mapa' : 'Sin dirección');
  });

  private normalizar(s: string): string {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  filtrados = computed(() => {
    const q = this.normalizar(this.busqueda());
    if (!q) return this.puntos;
    return this.puntos.filter(p =>
      this.normalizar(p.nombre).includes(q) || this.normalizar(p.direccion ?? '').includes(q)
    );
  });

  /** Texto tecleado que no coincide exactamente con ningún punto existente. */
  nombreNuevo = computed(() => {
    const q = this.busqueda().trim();
    if (!q) return null;
    const existe = this.puntos.some(p => this.normalizar(p.nombre) === this.normalizar(q));
    return existe ? null : q;
  });

  @HostListener('document:click', ['$event'])
  alClicarFuera(ev: MouseEvent): void {
    if (!this.abierto()) return;
    const t = ev.target as Node | null;
    if (t && !this.el.nativeElement.contains(t)) this.cerrar();
  }

  @HostListener('document:keydown.escape')
  alPresionarEscape(): void {
    if (!this.abierto()) return;
    if (this.creando()) { this.cancelarCreacion(); return; }
    this.cerrar();
  }

  alternar(): void {
    if (this.disabled) return;
    this.abierto() ? this.cerrar() : this.abrir();
  }

  private abrir(): void {
    this.abierto.set(true);
    this.busqueda.set('');
    // Sin puntos todavía: el panel muestra el estado vacío, no hay buscador.
    if (this.puntos.length > 0) {
      requestAnimationFrame(() => this.buscadorRef?.nativeElement.focus());
    }
  }

  private cerrar(): void {
    this.abierto.set(false);
    this.creando.set(false);
    this.error.set(null);
    this.onTouched();
  }

  elegir(id: number | null): void {
    this._value.set(id);
    this.onChange(id);
    this.cerrar();
  }

  /** Enter en el buscador: si el texto no existe, va directo al alta. */
  onEnterBusqueda(ev: Event): void {
    ev.preventDefault();
    const nuevo = this.nombreNuevo();
    if (nuevo) { this.empezarCreacion(nuevo); return; }
    const primero = this.filtrados()[0];
    if (primero) this.elegir(primero.id_punto_sacada);
  }

  empezarCreacion(nombreInicial: string): void {
    this.creando.set(true);
    this.nuevoNombre.set(nombreInicial);
    this.nuevaDireccion.set('');
    this.nuevaCoordenada.set(null);
    this.error.set(null);
    requestAnimationFrame(() => {
      const input = this.nombreRef?.nativeElement;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
  }

  cancelarCreacion(): void {
    this.creando.set(false);
    this.error.set(null);
    if (this.puntos.length === 0) this.cerrar();
  }

  guardar(): void {
    const nombre = this.nuevoNombre().trim();
    if (!nombre) {
      this.error.set('Escribe un nombre para el punto.');
      return;
    }
    const duplicado = this.puntos.find(
      p => this.normalizar(p.nombre) === this.normalizar(nombre)
    );
    if (duplicado) {
      // No creamos un gemelo: seleccionamos el que ya existe y lo decimos.
      this.elegir(duplicado.id_punto_sacada);
      this.toast.info('Ya existía', `«${duplicado.nombre}» ya estaba creado; lo seleccioné.`);
      return;
    }

    this.guardando.set(true);
    this.svc.crearPuntoSacada(
      {
        nombre,
        direccion: this.nuevaDireccion().trim() || null,
        coordenadas: this.nuevaCoordenada(),
        referencia: null,
      },
      this.idCongregacion,
    ).subscribe({
      next: punto => {
        this.guardando.set(false);
        // Insertamos en la lista local antes de seleccionar: si esperáramos al
        // padre, seleccionado() no encontraría el punto y el trigger parpadearía
        // mostrando "Sin punto de sacada".
        this._puntos.update(l => [...l, punto].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.creado.emit(punto);
        this.elegir(punto.id_punto_sacada);
        this.toast.success('Punto de sacada creado', `«${punto.nombre}» quedó seleccionado.`);
      },
      error: err => {
        this.guardando.set(false);
        this.error.set(err?.error?.detail ?? 'No se pudo crear. Inténtalo de nuevo.');
      },
    });
  }

  // ── ControlValueAccessor ────────────────────────────────
  writeValue(v: number | null): void { this._value.set(v ?? null); }
  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this._disabledCva.set(isDisabled); }
}

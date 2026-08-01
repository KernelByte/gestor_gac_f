import { Component, Input, OnDestroy, OnInit, forwardRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { DiscursosService } from '../services/discursos.service';
import { GeoResultado, UbicacionSaliente } from '../models/discursos.models';

/**
 * Selector de ubicación del salón destino.
 *
 * Busca direcciones contra el proxy del backend (Photon/OSM) y genera el enlace
 * de ruta de Google Maps. También acepta que se pegue un enlace de Maps ya
 * existente, extrayendo las coordenadas cuando la URL las contiene.
 */
@Component({
  selector: 'app-ubicacion-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UbicacionPickerComponent),
    multi: true,
  }],
  template: `
    <!-- ===== Estado con ubicación seleccionada ===== -->
    @if (valor()?.url_mapa) {
      <div class="flex items-center gap-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-3 py-2"
        [class.h-11]="size === 'md'" [class.min-h-10]="size === 'sm'">
        <svg class="w-4 h-4 shrink-0 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <circle cx="12" cy="11" r="2.5"/>
        </svg>
        <span class="flex-1 min-w-0 truncate font-medium text-slate-700 dark:text-slate-200"
          [class]="size === 'md' ? 'text-sm' : 'text-xs'"
          [title]="valor()!.direccion_destino ?? valor()!.url_mapa!">
          {{ valor()!.direccion_destino || 'Enlace de mapa' }}
        </span>
        <a [href]="valor()!.url_mapa" target="_blank" rel="noopener noreferrer"
          class="shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[0.65rem] font-bold transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]">
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
          </svg>
          Abrir
        </a>
        @if (!disabled) {
          <button type="button" (click)="limpiar()" aria-label="Quitar ubicación"
            class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-violet-100 dark:hover:bg-violet-800/40 transition-[background-color,color] duration-150 ease-out">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        }
      </div>
    } @else if (disabled) {
      <!-- Sólo lectura y sin ubicación -->
      <div class="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 text-slate-400 dark:text-slate-500"
        [class]="size === 'md' ? 'h-11 text-sm' : 'h-10 text-xs'">
        Sin ubicación
      </div>
    } @else {
      <!-- ===== Buscador ===== -->
      <div class="relative ubic-dropdown">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          [value]="consulta()"
          (input)="onInput($any($event.target).value)"
          (focus)="abierto.set(true)"
          (keydown.enter)="$event.preventDefault(); usarPrimerResultado()"
          (blur)="onBlur($event)"
          [placeholder]="placeholder"
          class="w-full pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out"
          [class]="size === 'md' ? 'h-11 text-sm' : 'h-10 text-xs'">

        @if (abierto() && consulta().trim().length > 0) {
          <div class="ubic-dropdown absolute z-30 left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-black/10 overflow-hidden">
            @if (esEnlace()) {
              <button type="button" (mousedown)="usarEnlacePegado()"
                class="w-full flex items-center gap-2.5 px-3 py-3 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-[background-color] duration-100 ease-out">
                <svg class="w-4 h-4 shrink-0 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m5.5-5.5l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0"/>
                </svg>
                <span class="flex-1 min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200">Usar este enlace de mapa</span>
              </button>
            } @else if (buscando()) {
              <div class="px-4 py-3 text-xs text-slate-400">Buscando direcciones…</div>
            } @else if (resultados().length === 0) {
              <div class="px-4 py-3 text-xs text-slate-400">
                Sin resultados. También puedes pegar un enlace de Google Maps.
              </div>
            } @else {
              <div class="flex flex-col p-1.5 gap-0.5 max-h-52 overflow-y-auto simple-scrollbar">
                @for (r of resultados(); track r.label) {
                  <button type="button" (mousedown)="seleccionar(r)"
                    class="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-[background-color] duration-100 ease-out active:scale-[0.98]">
                    <svg class="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <circle cx="12" cy="11" r="2.5"/>
                    </svg>
                    <span class="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-200">{{ r.label }}</span>
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>
      <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1 pt-1">
        Busca el salón por dirección o pega un enlace de Google Maps.
      </p>
    }
  `,
})
export class UbicacionPickerComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() placeholder = 'Buscar dirección o pegar enlace…';
  @Input() size: 'md' | 'sm' = 'md';
  @Input() disabled = false;

  private svc = inject(DiscursosService);
  private consulta$ = new Subject<string>();

  readonly valor = signal<UbicacionSaliente | null>(null);
  readonly consulta = signal('');
  readonly resultados = signal<GeoResultado[]>([]);
  readonly buscando = signal(false);
  readonly abierto = signal(false);

  private onChange: (v: UbicacionSaliente | null) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.consulta$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((q) => {
          const texto = q.trim();
          if (texto.length < 3 || this.esUrl(texto)) {
            this.buscando.set(false);
            return of<GeoResultado[]>([]);
          }
          this.buscando.set(true);
          return this.svc.geocodificar(texto).pipe(catchError(() => of<GeoResultado[]>([])));
        }),
      )
      .subscribe((res) => {
        this.resultados.set(res);
        this.buscando.set(false);
      });
  }

  ngOnDestroy(): void {
    this.consulta$.complete();
  }

  // ── ControlValueAccessor ───────────────────────────────────────────────────
  writeValue(v: UbicacionSaliente | null): void {
    const nuevo = v && v.url_mapa ? v : null;
    const actual = this.valor();
    // El padre puede reconstruir el objeto en cada ciclo de detección. Si el
    // contenido es el mismo no tocamos ningún signal: hacerlo dispararía otro
    // ciclo y entraríamos en un bucle infinito de detección de cambios.
    if (nuevo?.url_mapa === actual?.url_mapa
      && nuevo?.direccion_destino === actual?.direccion_destino) {
      return;
    }
    this.valor.set(nuevo);
    this.consulta.set('');
    this.resultados.set([]);
  }
  registerOnChange(fn: (v: UbicacionSaliente | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  esEnlace(): boolean {
    return this.esUrl(this.consulta().trim());
  }

  onInput(v: string): void {
    this.consulta.set(v);
    this.abierto.set(true);
    this.consulta$.next(v);
  }

  onBlur(event: FocusEvent): void {
    const destino = event.relatedTarget as HTMLElement | null;
    if (destino?.closest('.ubic-dropdown')) return;
    this.abierto.set(false);
    this.onTouched();
  }

  usarPrimerResultado(): void {
    if (this.esEnlace()) { this.usarEnlacePegado(); return; }
    const primero = this.resultados()[0];
    if (primero) this.seleccionar(primero);
  }

  seleccionar(r: GeoResultado): void {
    this.aplicar({
      direccion_destino: r.label,
      url_mapa: `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}`,
      lat: r.lat,
      lon: r.lon,
    });
  }

  usarEnlacePegado(): void {
    const url = this.consulta().trim();
    if (!this.esUrl(url)) return;
    const coords = this.extraerCoords(url);
    this.aplicar({
      direccion_destino: this.etiquetaDeUrl(url),
      url_mapa: url,
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
    });
  }

  limpiar(): void {
    this.aplicar(null);
  }

  private aplicar(v: UbicacionSaliente | null): void {
    this.valor.set(v);
    this.consulta.set('');
    this.resultados.set([]);
    this.abierto.set(false);
    this.onChange(v);
    this.onTouched();
  }

  private esUrl(v: string): boolean {
    return /^https?:\/\//i.test(v);
  }

  /** Extrae lat/lon de las variantes habituales de URL de Google Maps. */
  private extraerCoords(url: string): { lat: number; lon: number } | null {
    const patrones = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /[?&](?:destination|query|q|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    ];
    for (const p of patrones) {
      const m = url.match(p);
      if (m) return { lat: +m[1], lon: +m[2] };
    }
    return null;
  }

  /** Nombre del lugar si la URL lo incluye (`/maps/place/<nombre>/`). */
  private etiquetaDeUrl(url: string): string {
    const m = url.match(/\/maps\/place\/([^/@?]+)/);
    if (m) {
      try {
        return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
      } catch {
        // URL mal codificada: caemos a la etiqueta genérica
      }
    }
    return 'Enlace de mapa';
  }
}

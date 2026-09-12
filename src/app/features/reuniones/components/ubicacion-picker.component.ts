import { Component, Input, forwardRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UbicacionSaliente } from '../models/discursos.models';

/**
 * Selector de ubicación del salón destino: dos campos independientes.
 *
 * "Dirección" es un campo de texto plano — se guarda tal cual se escribe, sin
 * buscador ni autocompletado. El segundo campo, "Ubicación GPS", es opcional y
 * solo acepta un enlace de Google Maps o un par de coordenadas pegado tal
 * cual — genera el enlace de ruta para el botón "Abrir". Cada campo se edita
 * y se borra por separado.
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
    @if (disabled) {
      <!-- ===== Sólo lectura ===== -->
      @if (direccion().trim() || gps()) {
        <div class="flex items-center gap-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-3 py-2"
          [class.h-11]="size === 'md'" [class.min-h-10]="size === 'sm'">
          <svg class="w-4 h-4 shrink-0 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <circle cx="12" cy="11" r="2.5"/>
          </svg>
          <span class="flex-1 min-w-0 truncate font-medium text-slate-700 dark:text-slate-200"
            [class]="size === 'md' ? 'text-sm' : 'text-xs'"
            [title]="direccion().trim() || etiquetaGps(gps())">
            {{ direccion().trim() || etiquetaGps(gps()) }}
          </span>
          @if (gps(); as g) {
            <a [href]="g.url_mapa" target="_blank" rel="noopener noreferrer"
              class="shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[0.65rem] font-bold transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
              Abrir
            </a>
          }
        </div>
      } @else {
        <div class="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 text-slate-400 dark:text-slate-500"
          [class]="size === 'md' ? 'h-11 text-sm' : 'h-10 text-xs'">
          Sin ubicación
        </div>
      }
    } @else {
      <div class="flex flex-col gap-1.5">
        <!-- ===== Dirección (texto plano, sin búsqueda) ===== -->
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <circle cx="12" cy="11" r="2.5"/>
          </svg>
          <input
            type="text"
            [value]="direccion()"
            (input)="onDireccionInput($any($event.target).value)"
            (blur)="emitir(); onTouched()"
            placeholder="Dirección del salón"
            class="w-full pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out"
            [class]="size === 'md' ? 'h-11 text-sm' : 'h-10 text-xs'">
        </div>

        <!-- ===== Ubicación GPS (opcional, campo aparte) ===== -->
        @if (gps(); as g) {
          <div class="flex items-center gap-2 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-3 py-2"
            [class.h-11]="size === 'md'" [class.min-h-10]="size === 'sm'">
            <svg class="w-4 h-4 shrink-0 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m5.5-5.5l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0"/>
            </svg>
            <span class="flex-1 min-w-0 truncate font-mono text-slate-700 dark:text-slate-200"
              [class]="size === 'md' ? 'text-sm' : 'text-xs'">
              {{ (g.lat !== null && g.lon !== null) ? (g.lat + ', ' + g.lon) : 'Enlace de mapa' }}
            </span>
            <a [href]="g.url_mapa" target="_blank" rel="noopener noreferrer"
              class="shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[0.65rem] font-bold transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
              Abrir
            </a>
            <button type="button" (click)="quitarGps()" aria-label="Quitar ubicación GPS"
              class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-violet-100 dark:hover:bg-violet-800/40 transition-[background-color,color] duration-150 ease-out">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        } @else {
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m5.5-5.5l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0"/>
            </svg>
            <input
              type="text"
              [value]="gpsTexto()"
              (input)="onGpsInput($any($event.target).value)"
              (keydown.enter)="$event.preventDefault(); aplicarGpsPegado()"
              (blur)="aplicarGpsPegado()"
              placeholder="Ubicación GPS (opcional): enlace o coordenadas de Google Maps"
              class="w-full pl-9 pr-3 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out"
              [class]="(size === 'md' ? 'h-11 text-sm' : 'h-10 text-xs') + ' ' + (gpsError() ? 'border-red-300 dark:border-red-700 focus:border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-violet-500')">
          </div>
          @if (gpsError()) {
            <p class="text-[0.65rem] text-red-500 px-1">No se reconoce como enlace ni como coordenadas (ej. 3.437654, -76.498410).</p>
          }
        }
        <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">
          La dirección se guarda tal como la escribas. La ubicación GPS es opcional y solo sirve para el botón "Abrir".
        </p>
      </div>
    }
  `,
})
export class UbicacionPickerComponent implements ControlValueAccessor {
  @Input() placeholder = 'Dirección del salón';
  @Input() size: 'md' | 'sm' = 'md';
  @Input() disabled = false;

  /** Texto de la dirección: es la fuente de verdad de `direccion_destino`, se guarda tal cual. */
  readonly direccion = signal('');
  /** Ubicación GPS confirmada (enlace + coordenadas), independiente de la dirección. */
  readonly gps = signal<{ url_mapa: string; lat: number | null; lon: number | null } | null>(null);

  readonly gpsTexto = signal('');
  readonly gpsError = signal(false);

  private onChangeFn: (v: UbicacionSaliente | null) => void = () => {};
  onTouched: () => void = () => {};

  // ── ControlValueAccessor ───────────────────────────────────────────────────
  writeValue(v: UbicacionSaliente | null): void {
    const direccionNueva = v?.direccion_destino ?? '';
    const gpsNuevo = v?.url_mapa ? { url_mapa: v.url_mapa, lat: v.lat ?? null, lon: v.lon ?? null } : null;
    const gpsActual = this.gps();
    // El padre puede reconstruir el objeto en cada ciclo de detección. Si el
    // contenido es el mismo no tocamos ningún signal: hacerlo dispararía otro
    // ciclo y entraríamos en un bucle infinito de detección de cambios.
    if (this.direccion() === direccionNueva && (gpsActual?.url_mapa ?? null) === (gpsNuevo?.url_mapa ?? null)) {
      return;
    }
    this.direccion.set(direccionNueva);
    this.gps.set(gpsNuevo);
    this.gpsTexto.set('');
    this.gpsError.set(false);
  }
  registerOnChange(fn: (v: UbicacionSaliente | null) => void): void { this.onChangeFn = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  etiquetaGps(g: { url_mapa: string; lat: number | null; lon: number | null } | null): string {
    if (!g) return '';
    return g.lat !== null && g.lon !== null ? `${g.lat}, ${g.lon}` : 'Enlace de mapa';
  }

  // ── Dirección ────────────────────────────────────────────────────────────
  onDireccionInput(v: string): void {
    this.direccion.set(v);
  }

  // ── Ubicación GPS ────────────────────────────────────────────────────────
  onGpsInput(v: string): void {
    this.gpsTexto.set(v);
    this.gpsError.set(false);
  }

  aplicarGpsPegado(): void {
    const texto = this.gpsTexto().trim();
    if (!texto) { this.gpsError.set(false); return; }

    if (this.esUrl(texto)) {
      const coords = this.extraerCoords(texto);
      this.gps.set({ url_mapa: texto, lat: coords?.lat ?? null, lon: coords?.lon ?? null });
      // Si aún no hay dirección escrita, se aprovecha el nombre de lugar que
      // trae la URL para no dejar el campo de dirección vacío.
      if (!this.direccion().trim()) {
        const etiqueta = this.etiquetaDeUrl(texto);
        if (etiqueta !== 'Enlace de mapa') this.direccion.set(etiqueta);
      }
      this.gpsTexto.set('');
      this.gpsError.set(false);
      this.emitir();
      return;
    }

    const coords = this.parsearCoordenadas(texto);
    if (coords) {
      this.gps.set({
        url_mapa: `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}`,
        lat: coords.lat,
        lon: coords.lon,
      });
      this.gpsTexto.set('');
      this.gpsError.set(false);
      this.emitir();
      return;
    }

    this.gpsError.set(true);
  }

  quitarGps(): void {
    this.gps.set(null);
    this.emitir();
  }

  emitir(): void {
    const direccion = this.direccion().trim() || null;
    const g = this.gps();
    const v: UbicacionSaliente | null = (direccion || g)
      ? { direccion_destino: direccion, url_mapa: g?.url_mapa ?? null, lat: g?.lat ?? null, lon: g?.lon ?? null }
      : null;
    this.onChangeFn(v);
  }

  private esUrl(v: string): boolean {
    return /^https?:\/\//i.test(v);
  }

  /**
   * Reconoce un par de coordenadas decimales pegado tal cual (con coma o solo
   * espacio de separador): el formato que deja "Copiar coordenadas" en Google
   * Maps o al mantener presionado un punto en la app. Exige decimales en
   * ambos números para no confundir un par de enteros sueltos con cualquier
   * otro texto corto.
   */
  private parsearCoordenadas(v: string): { lat: number; lon: number } | null {
    const m = v.match(/^(-?\d{1,3}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)$/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
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

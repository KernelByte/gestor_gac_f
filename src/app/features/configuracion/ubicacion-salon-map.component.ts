import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges,
  OnDestroy, Output, SimpleChanges, ViewChild, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { TerritoriosService } from '../territorios/services/territorios.service';

export interface UbicacionSalon { lat: number; lng: number; }

/** Encuadre cuando todavía no hay punto (centro de Colombia). */
const VISTA_POR_DEFECTO: { centro: L.LatLngExpression; zoom: number } = {
  centro: [4.711, -74.072],
  zoom: 6,
};
const ZOOM_CON_PUNTO = 17;
/** Por debajo de este zoom, al tener punto se acerca a ZOOM_CON_PUNTO. */
const ZOOM_MINIMO_CON_PUNTO = 15;
const COLOR_PIN = '#7c3aed';

/** Gota con la punta sobre la coordenada (iconAnchor = [W/2, W]). */
function iconoPin(): L.DivIcon {
  const w = 34;
  return L.divIcon({
    className: '',
    html: `<div style="width:${w}px;height:${w}px;background:${COLOR_PIN};
      border:2.5px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      box-shadow:0 2px 6px rgba(15,23,42,.35);"></div>`,
    iconSize: [w, w],
    iconAnchor: [w / 2, w],
  });
}

/**
 * Mini mapa para fijar el punto del Salón del Reino.
 * Clic en el mapa o arrastrar el pin = nueva ubicación; "Buscar" geocodifica
 * la dirección escrita. En solo lectura únicamente se muestra.
 */
@Component({
  selector: 'app-ubicacion-salon-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl border border-slate-300 dark:border-slate-700 overflow-hidden">
      <div #mapa role="application" aria-label="Mapa para marcar la ubicación del Salón del Reino" class="w-full h-[260px] sm:h-[300px] bg-slate-100 dark:bg-slate-800 z-0"></div>
    </div>

    <div class="flex flex-wrap items-center gap-2 mt-3">
      @if (!readonly) {
        @if (bloqueado()) {
          <button type="button" (click)="empezarCambio()"
            class="inline-flex items-center justify-center h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-[background-color,transform] duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/25">
            Cambiar ubicación
          </button>
        } @else {
          <button type="button" (click)="buscarDireccion()" [disabled]="buscando()"
            class="inline-flex items-center justify-center h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-[background-color,transform] duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/25">
            {{ buscando() ? 'Buscando…' : 'Buscar la dirección escrita' }}
          </button>
          @if (editando()) {
            <button type="button" (click)="terminarCambio()"
              class="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-brand-purple text-white text-sm font-semibold hover:bg-purple-700 active:scale-[0.98] transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/30">
              Listo
            </button>
            <button type="button" (click)="cancelarCambio()"
              class="inline-flex items-center justify-center h-11 px-4 rounded-xl text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/25 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              Cancelar
            </button>
          }
          @if (tienePunto()) {
            <button type="button" (click)="quitar()"
              class="inline-flex items-center justify-center h-11 px-4 rounded-xl text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/25 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
              Quitar ubicación
            </button>
          }
        }
      }
      @if (tienePunto()) {
        <a [href]="enlaceMapa()" target="_blank" rel="noopener"
          class="inline-flex items-center justify-center h-11 px-4 rounded-xl text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/25 text-brand-purple dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10">
          Abrir en Google Maps
        </a>
      }
    </div>

    @if (!readonly && !bloqueado()) {
      <div class="mt-3">
        <label for="coordenadas-salon" class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">O escriba las coordenadas</label>
        <div class="flex flex-wrap items-center gap-2">
          <input id="coordenadas-salon" type="text" inputmode="decimal" autocomplete="off"
            [value]="textoCoord()" (input)="textoCoord.set($any($event.target).value)" (keydown.enter)="[$event.preventDefault(), usarCoordenadas()]"
            placeholder="Ejemplo: 4.711000, -74.072000"
            class="flex-1 min-w-[220px] h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-base text-slate-800 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/25" />
          <button type="button" (click)="usarCoordenadas()"
            class="inline-flex items-center justify-center h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/25">
            Ubicar en el mapa
          </button>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Latitud y longitud separadas por coma. Puede copiarlas desde Google Maps (clic derecho sobre el lugar).</p>
      </div>
    }

    <p class="text-sm leading-relaxed mt-2" aria-live="polite" [ngClass]="aviso() ? 'text-amber-700 dark:text-amber-300 font-semibold' : 'text-slate-500 dark:text-slate-400'">
      @if (aviso()) { {{ aviso() }} }
      @else if (readonly) { {{ tienePunto() ? 'Ubicación guardada del Salón del Reino.' : 'Aún no se ha marcado la ubicación del Salón.' }} }
      @else if (bloqueado()) { La ubicación está protegida para que no se cambie por accidente. Pulse «Cambiar ubicación» si necesita moverla. }
      @else { Toque el mapa o arrastre el marcador para señalar dónde está el Salón del Reino. }
    </p>
  `,
})
export class UbicacionSalonMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() lat: number | null = null;
  @Input() lng: number | null = null;
  @Input() direccion: string | null = null;
  @Input() readonly = false;
  @Output() ubicacionCambio = new EventEmitter<UbicacionSalon | null>();

  @ViewChild('mapa', { static: true }) mapa!: ElementRef<HTMLDivElement>;

  private territorios = inject(TerritoriosService);
  private map: L.Map | null = null;
  private marcador: L.Marker | null = null;
  private tileLayer: L.TileLayer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;

  /** true mientras la persona ha pedido mover un punto que ya existía. */
  editando = signal(false);
  /** Punto vigente al pulsar «Cambiar ubicación», para poder cancelar. */
  private puntoAnterior: UbicacionSalon | null = null;
  buscando = signal(false);
  aviso = signal<string | null>(null);
  textoCoord = signal('');

  usarCoordenadas(): void {
    const partes = this.textoCoord().trim().split(/\s*[;,]\s*|\s+/).filter(Boolean);
    let nums: number[];
    if (this.textoCoord().includes(';')) {
      nums = this.textoCoord().split(';').map(t => parseFloat(t.trim().replace(',', '.')));
    } else {
      nums = partes.map(t => parseFloat(t));
    }
    if (nums.length !== 2 || nums.some(n => !isFinite(n))) {
      this.avisar('Escriba la latitud y la longitud separadas por coma, por ejemplo: 4.711, -74.072');
      return;
    }
    const [lat, lng] = nums;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      this.avisar('Esas coordenadas no son válidas. La latitud va de -90 a 90 y la longitud de -180 a 180.');
      return;
    }
    this.map?.setView([lat, lng], ZOOM_CON_PUNTO);
    this.emitir(lat, lng);
  }

  /**
   * Con un punto ya guardado el mapa está bloqueado: un clic suelto o un
   * arrastre sin querer no lo mueven. Sin punto no hay nada que proteger.
   */
  bloqueado(): boolean { return this.tienePunto() && !this.editando(); }
  private puedeEditar(): boolean { return !this.readonly && !this.bloqueado(); }

  empezarCambio(): void {
    this.puntoAnterior = this.tienePunto() ? { lat: this.lat!, lng: this.lng! } : null;
    this.editando.set(true);
    this.pintar(false);
  }

  terminarCambio(): void {
    this.editando.set(false);
    this.puntoAnterior = null;
    this.avisar(null);
    this.pintar(false);
  }

  cancelarCambio(): void {
    this.ubicacionCambio.emit(this.puntoAnterior);
    this.terminarCambio();
  }

  tienePunto(): boolean { return this.lat != null && this.lng != null; }
  enlaceMapa(): string { return `https://www.google.com/maps?q=${this.lat},${this.lng}`; }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapa.nativeElement, {
      center: VISTA_POR_DEFECTO.centro,
      zoom: VISTA_POR_DEFECTO.zoom,
      attributionControl: false,
    });
    this.setTile('osm');
    this.territorios.getTileProvider().subscribe({
      next: r => this.setTile(r.tile_provider || 'osm'),
      error: () => {},
    });
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.puedeEditar()) return;
      this.emitir(e.latlng.lat, e.latlng.lng);
    });
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapa.nativeElement);
    this.pintar(true);
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['lat'] || c['lng']) this.textoCoord.set(this.tienePunto() ? `${this.lat}, ${this.lng}` : '');
    if (this.map && (c['lat'] || c['lng'] || c['readonly'])) this.pintar(false);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.map?.remove();
    this.map = null;
  }

  private setTile(provider: string): void {
    if (!this.map) return;
    if (this.tileLayer) this.map.removeLayer(this.tileLayer);
    const url = provider === 'google'
      ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    this.tileLayer = L.tileLayer(url, { maxZoom: 19 }).addTo(this.map);
  }

  /** Redibuja el pin según lat/lng; `encuadrar` mueve la vista hasta él. */
  private pintar(encuadrar: boolean): void {
    if (!this.map) return;
    if (!this.tienePunto()) {
      this.marcador?.remove();
      this.marcador = null;
      this.map.scrollWheelZoom.enable();
      return;
    }
    const pos = L.latLng(this.lat!, this.lng!);
    if (!this.marcador) {
      this.marcador = L.marker(pos, { icon: iconoPin(), draggable: this.puedeEditar() }).addTo(this.map);
      this.marcador.on('dragend', () => {
        const p = this.marcador!.getLatLng();
        this.emitir(p.lat, p.lng);
      });
    } else {
      this.marcador.setLatLng(pos);
    }
    if (this.puedeEditar()) this.marcador.dragging?.enable(); else this.marcador.dragging?.disable();
    // La rueda solo hace zoom al editar: si no, desplazar la página sobre el mapa lo zoomea.
    if (this.puedeEditar()) this.map.scrollWheelZoom.enable(); else this.map.scrollWheelZoom.disable();
    // Un punto a escala de país no sirve para afinarlo: si el mapa está lejos
    // (p. ej. el primer clic con la vista por defecto) se acerca hasta la calle.
    // Si ya está cerca, se respeta el zoom que la persona eligió.
    if (encuadrar || this.map.getZoom() < ZOOM_MINIMO_CON_PUNTO) this.map.setView(pos, ZOOM_CON_PUNTO);
    else if (!this.map.getBounds().contains(pos)) this.map.panTo(pos);
  }

  private emitir(lat: number, lng: number): void {
    this.avisar(null);
    // Primer punto: seguir en edición para poder afinarlo hasta pulsar «Listo».
    if (!this.tienePunto()) { this.puntoAnterior = null; this.editando.set(true); }
    this.ubicacionCambio.emit({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
  }

  quitar(): void {
    this.avisar(null);
    this.ubicacionCambio.emit(null);
  }

  async buscarDireccion(): Promise<void> {
    const q = (this.direccion || '').trim();
    if (!q) { this.avisar('Escriba primero la dirección del Salón del Reino.'); return; }
    this.buscando.set(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=es`);
      const datos: { lat: string; lon: string }[] = await r.json();
      if (!datos.length) {
        this.avisar('No se encontró esa dirección. Toque el mapa para marcar el Salón a mano.');
        return;
      }
      const lat = parseFloat(datos[0].lat), lng = parseFloat(datos[0].lon);
      this.map?.setView([lat, lng], ZOOM_CON_PUNTO);
      this.emitir(lat, lng);
    } catch {
      this.avisar('No se pudo buscar la dirección. Toque el mapa para marcar el Salón a mano.');
    } finally {
      this.buscando.set(false);
    }
  }

  private avisar(msg: string | null): void {
    this.aviso.set(msg);
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    if (msg) this.temporizadorAviso = setTimeout(() => this.aviso.set(null), 6000);
  }
}

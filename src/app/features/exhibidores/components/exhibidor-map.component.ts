import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges,
  OnDestroy, Output, SimpleChanges, ViewChild, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { TerritoriosService } from '../../territorios/services/territorios.service';
import { UbicacionUsuarioService } from '../services/ubicacion-usuario.service';
import { GeoJSONPoint, PuntoSacada, UbicacionExhibidor } from '../models/exhibidor.model';

/** Azul de marca del módulo (styles.scss → --color-exh-600). */
const COLOR_UBICACION = '#165cfc';
/** Ubicación seleccionada: exh-800, para destacar sin cambiar de familia. */
const COLOR_UBICACION_SEL = '#123ca6';
/** Punto de sacada: neutro, es infraestructura de apoyo, no el punto de acción. */
const COLOR_SACADA = '#64748b';
/** Punto sin guardar. Ámbar deliberado: mismo código de "borrador" que badge-warning. */
const COLOR_PROVISIONAL = '#f59e0b';
/** "Tú estás aquí": verde, el mismo código que usa el mapa de territorios. */
const COLOR_USUARIO = '#10b981';

/** Encuadre por defecto cuando no hay nada mejor (centro de Colombia). */
const VISTA_POR_DEFECTO: { centro: L.LatLngExpression; zoom: number } = {
  centro: [4.711, -74.072],
  zoom: 13,
};

/**
 * Símbolo del carrito de exhibición, para el marcador azul de ubicaciones.
 * Va pegado crudo (no <lucide-icon>): el HTML de un L.divIcon vive fuera del
 * árbol de Angular, así que no hay forma de renderizar un componente ahí —
 * solo HTML/SVG plano. fill="#fff" fijo porque va sobre el círculo de marca,
 * igual que la letra blanca que reemplaza.
 */
const ICONO_EXHIBIDOR = `<svg viewBox="0 -960 960 960" width="17" height="17" fill="#fff"><path d="M633-280q50 0 85 35t35 85q0 50-35 85t-85 35q-44 0-77.5-26.5T516-135H292q-24.75 0-42.37-17.63Q232-170.25 232-195v-409q0-24.75 17.63-42.38Q267.25-664 292-664h281v-156h-24q-24.75 0-42.37-17.63Q489-855.25 489-880h144v600Zm-275 85v-409h-66v409h66Zm60-409v409h99q6.55-22.13 21.27-40.56Q553-254 573-265v-339H418Zm264.5 493.62q20.5-20.38 20.5-49.5t-20.38-49.62q-20.38-20.5-49.5-20.5t-49.62 20.38q-20.5 20.38-20.5 49.5t20.38 49.62Q603.76-90 632.88-90t49.62-20.38ZM633-165ZM418-400Zm-60 205v-409 409Zm60-409v409-409Z"/></svg>`;

/**
 * Casa: para el marcador del punto de sacada, tanto el guardado (círculo
 * gris) como el que se está colocando (gota ámbar) — es el mismo concepto en
 * dos estados, así que llevan el mismo símbolo. fill="#fff" por la misma
 * razón que ICONO_EXHIBIDOR: siempre va sobre un fondo de color.
 */
const ICONO_SACADA = `<svg viewBox="0 -960 960 960" width="17" height="17" fill="#fff"><path d="M201-160v-392L76-457l-36-47 440-336 178 136v-96h100v172l162 124-37 47-125-96v393H530v-240H430v240H201Zm60-60h109v-240h220v240h108v-378L480-765 261-598v378Zm134-350h170q0-33-25.5-54.5T480-646q-34 0-59.5 21.34T395-570Zm-25 350v-240h220v240-240H370v240Z"/></svg>`;

/** contenido: letra ("S") o HTML/SVG crudo (ver ICONO_EXHIBIDOR) — ambos son texto para el div. */
function iconoCirculo(color: string, contenido: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};
      border:2.5px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 12px system-ui">${contenido}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/**
 * Pin (gota), no círculo: mismo truco ya usado en territorio-map.component.ts
 * (border-radius 50% 50% 50% 0 + rotate -45deg). Los puntos ya guardados en
 * este módulo son siempre círculos (carrito azul, casa gris); reservar la
 * gota para "esto se está colocando ahora mismo" evita que un punto de
 * sacada en borrador se confunda con uno ya guardado — no hace falta leer
 * el ícono para distinguirlos, alcanza con la silueta.
 * iconAnchor = [W/2, W]: la punta de la gota (no su centro) cae exacto sobre
 * la coordenada, igual que en territorio-map.
 */
function iconoPin(color: string, contenido: string): L.DivIcon {
  const w = 30;
  return L.divIcon({
    className: '',
    html: `<div style="width:${w}px;height:${w}px;background:${color};
      border:2.5px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      box-shadow:0 2px 6px rgba(15,23,42,.35);
      display:flex;align-items:center;justify-content:center;">
      <span style="display:flex;transform:rotate(45deg);color:#fff;font:700 12px system-ui">${contenido}</span>
      </div>`,
    iconSize: [w, w],
    iconAnchor: [w / 2, w],
  });
}

/**
 * Mapa Leaflet de exhibidores: marcadores azules para puntos de exhibición,
 * grises para puntos de sacada, con línea punteada entre cada ubicación y
 * su sacada. En modo edición un clic en el mapa emite la coordenada.
 */
@Component({
  selector: 'app-exhibidor-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- La altura va en el envoltorio y el contenedor de Leaflet la hereda con
         h-full. Así height="100%" funciona: basta con que el host tenga una
         altura definida (p. ej. class="absolute inset-0") para que el mapa
         llene un panel flexible, sin romper los usos con altura fija en px. -->
    <div class="relative" [style.height]="height">
      <div #mapContainer class="w-full h-full overflow-hidden z-0"
           [class.rounded-xl]="redondeado"
           [class.cursor-crosshair]="modoSeleccion"></div>

      <!-- Ir a mi ubicación.
           Abajo-derecha, NUNCA arriba: estos mapas van embebidos en formularios
           de modal (200-300px de alto), y el modal pone su propio botón de
           cerrar (X) arriba-derecha. Con poco margen vertical ambos controles
           quedan pegados. Abajo-derecha también es la esquina estándar del
           botón "mi ubicación" en Google/Apple Maps, y coincide con el hueco
           que deja el control de zoom de Leaflet (arriba-izquierda).

           z-10, NO z-400: la escala de la app va --z-dropdown:30 hasta
           --z-toast:100 (ver styles.scss). Este botón solo necesita ganarle
           al mapa (z-0), nunca a un overlay de la app. Con z-400 el mapa
           grande de la página (que sigue montado detrás de cualquier modal)
           atravesaba el modal entero y su botón quedaba flotando encima —
           justo el bug reportado. -->
      <button *ngIf="ubicacionDisponible" type="button"
              class="absolute bottom-2 right-2 z-10 w-9 h-9 flex items-center justify-center
                     rounded-xl border shadow-md backdrop-blur-sm transition-all
                     bg-white/90 dark:bg-slate-800/90
                     border-slate-200 dark:border-slate-600
                     text-slate-600 dark:text-slate-300
                     hover:text-emerald-600 dark:hover:text-emerald-400
                     hover:border-emerald-300 dark:hover:border-emerald-700
                     hover:bg-emerald-50 dark:hover:bg-emerald-900/30
                     active:scale-95 disabled:opacity-60"
              [disabled]="buscandoUbicacion()"
              [title]="modoSeleccion ? 'Centrar en mi ubicación actual' : 'Ir a mi ubicación'"
              aria-label="Ir a mi ubicación"
              (click)="irAMiUbicacion()">
        <span *ngIf="buscandoUbicacion()"
              class="w-4 h-4 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin"></span>
        <svg *ngIf="!buscandoUbicacion()" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>
          <circle cx="12" cy="12" r="8"/>
        </svg>
      </button>

      <!-- Aviso de fallo, se desvanece solo -->
      <div *ngIf="avisoUbicacion() as aviso"
           class="absolute bottom-2 left-2 right-12 z-10 px-2.5 py-1.5 rounded-lg
                  text-xs font-medium shadow-md backdrop-blur-sm
                  bg-white/95 dark:bg-slate-800/95
                  text-amber-700 dark:text-amber-400
                  border border-amber-200 dark:border-amber-800/60">
        {{ aviso }}
      </div>
    </div>
  `,
  styles: [`:host { display: block; }`],
})
export class ExhibidorMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() ubicaciones: UbicacionExhibidor[] = [];
  @Input() puntosSacada: PuntoSacada[] = [];
  @Input() height = '420px';
  /** false cuando el mapa llena un panel a sangre y las esquinas redondeadas dejarían muescas. */
  @Input() redondeado = true;
  @Input() selectedId: number | null = null;
  /** true → un clic en el mapa emite la coordenada (para formularios). */
  @Input() modoSeleccion = false;
  /** Punto provisional a mostrar durante la edición. */
  @Input() puntoProvisional: GeoJSONPoint | null = null;
  /** Qué se está colocando con `puntoProvisional`, para elegir su icono. */
  @Input() tipoProvisional: 'exhibidor' | 'sacada' = 'exhibidor';
  /**
   * Centrar automáticamente en la ubicación del usuario cuando no hay nada
   * mejor que mostrar (ni marcadores ni punto en edición). Se activa sólo en
   * los mapas de selección: ahí el permiso se pide en el momento en que el
   * usuario decidió colocar un punto, que es cuando se entiende para qué es.
   */
  @Input() autoUbicar = false;

  @Output() ubicacionClick = new EventEmitter<number>();
  @Output() coordenadaSeleccionada = new EventEmitter<GeoJSONPoint>();

  private territoriosService = inject(TerritoriosService);
  private ubicacionUsuario = inject(UbicacionUsuarioService);
  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private capaMarcadores: L.LayerGroup | null = null;
  private marcadorProvisional: L.Marker | null = null;
  private marcadorUsuario: L.Marker | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private temporizadorAviso: ReturnType<typeof setTimeout> | null = null;

  /** El usuario ya movió el mapa o colocó un punto: no reencuadrar por su cuenta. */
  private usuarioTomoControl = false;
  /** Coordenadas con las que se hizo el último fitBounds (ver render()). */
  private firmaEncuadre = '';

  buscandoUbicacion = signal(false);
  avisoUbicacion = signal<string | null>(null);

  get ubicacionDisponible(): boolean {
    return this.ubicacionUsuario.disponible;
  }

  /**
   * Este mapa vive dentro de <app-modal>, y el contenido proyectado por
   * <ng-content> se instancia aunque el modal esté cerrado: ngAfterViewInit
   * corre con el contenedor a 0×0. Si inicializáramos Leaflet ahí, cachearía
   * ese tamaño y al abrir el modal el mapa saldría cortado (tiles solo en una
   * esquina). Por eso observamos el contenedor: inicializamos cuando tiene
   * tamaño real y revalidamos en cada cambio de tamaño posterior.
   */
  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.alCambiarTamano());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
    this.alCambiarTamano();
  }

  private alCambiarTamano(): void {
    const el = this.mapContainer.nativeElement;
    if (el.clientWidth === 0 || el.clientHeight === 0) return;
    if (!this.map) {
      this.initMap();
      return;
    }
    // El mapa ya existe (p. ej. el modal se cerró y se volvió a abrir, o el
    // usuario redimensionó la ventana): recalcular sin re-encuadrar para no
    // pisar el paneo/zoom que haya hecho.
    this.map.invalidateSize({ animate: false });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;  // aún sin tamaño; initMap() pintará el estado actual
    if (changes['ubicaciones'] || changes['puntosSacada'] || changes['selectedId']) {
      this.render();
    }
    if (changes['puntoProvisional']) {
      this.renderProvisional();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.map?.remove();
    this.map = null;
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: VISTA_POR_DEFECTO.centro,
      zoom: VISTA_POR_DEFECTO.zoom,
      attributionControl: false,
    });
    this.setTile('osm');

    // Cualquier gesto sobre el mapa cancela el reencuadre automático: nada
    // debe moverse bajo el cursor después de que el usuario tomó el control.
    this.map.on('dragstart zoomstart', () => { this.usuarioTomoControl = true; });
    this.territoriosService.getTileProvider().subscribe({
      next: res => this.setTile(res.tile_provider || 'osm'),
      error: () => {},
    });
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.modoSeleccion) return;
      this.usuarioTomoControl = true;
      this.coordenadaSeleccionada.emit({
        type: 'Point',
        coordinates: [e.latlng.lng, e.latlng.lat],
      });
    });
    this.render();
    this.renderProvisional();
    this.centrarEnUsuarioSiProcede();
  }

  /**
   * Encuadre inicial por prioridad: marcadores existentes > punto en edición >
   * ubicación del usuario > vista por defecto. Los dos primeros ya los cubren
   * render()/renderProvisional(), así que aquí sólo actuamos si no hicieron nada.
   *
   * Es deliberadamente no bloqueante: el mapa ya se pintó con la vista por
   * defecto y sólo se recentra si la posición llega ANTES de que el usuario
   * empiece a interactuar. Si tarda o se deniega, no pasa nada.
   */
  private centrarEnUsuarioSiProcede(): void {
    if (!this.autoUbicar) return;
    if (this.tieneReferenciaPropia()) return;
    if (!this.ubicacionUsuario.disponible) return;

    this.buscandoUbicacion.set(true);
    this.ubicacionUsuario.obtener().then(pos => {
      this.buscandoUbicacion.set(false);
      if (!pos || !this.map) return;
      // Entre la petición y la respuesta el usuario pudo mover el mapa o
      // colocar el punto; en ese caso su contexto manda.
      if (this.usuarioTomoControl || this.tieneReferenciaPropia()) return;
      this.map.setView([pos.lat, pos.lon], this.ubicacionUsuario.zoomParaPrecision(pos.precision));
      this.pintarMarcadorUsuario(pos.lat, pos.lon);
    });
  }

  /** ¿El mapa ya tiene algo propio que mostrar (marcadores o punto en edición)? */
  private tieneReferenciaPropia(): boolean {
    if (this.puntoProvisional) return true;
    return this.ubicaciones.some(u => u.coordenadas)
        || this.puntosSacada.some(p => p.coordenadas);
  }

  /** Acción explícita del botón: siempre vuela a la posición, aunque haya marcadores. */
  irAMiUbicacion(): void {
    if (!this.map || this.buscandoUbicacion()) return;
    this.usuarioTomoControl = true;
    this.buscandoUbicacion.set(true);
    this.avisoUbicacion.set(null);

    this.ubicacionUsuario.obtener(true).then(pos => {
      this.buscandoUbicacion.set(false);
      if (!pos) {
        this.mostrarAviso(
          this.ubicacionUsuario.mensajeDeFallo(this.ubicacionUsuario.ultimoFallo())
          ?? 'No se pudo obtener tu ubicación.',
        );
        return;
      }
      if (!this.map) return;
      this.map.flyTo(
        [pos.lat, pos.lon],
        this.ubicacionUsuario.zoomParaPrecision(pos.precision),
        { animate: true, duration: 0.9 },
      );
      this.pintarMarcadorUsuario(pos.lat, pos.lon);
      if (pos.precision > 1_000) {
        this.mostrarAviso(`Ubicación aproximada (±${Math.round(pos.precision / 1000)} km).`);
      }
    });
  }

  private pintarMarcadorUsuario(lat: number, lon: number): void {
    if (!this.map) return;
    if (this.marcadorUsuario) this.map.removeLayer(this.marcadorUsuario);
    this.marcadorUsuario = L.marker([lat, lon], {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${COLOR_USUARIO};
          border:3px solid #fff;box-shadow:0 0 0 4px rgba(16,185,129,.28)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
      interactive: false,
      zIndexOffset: -100,   // por debajo de los puntos que se están colocando
    })
      .bindTooltip('Estás aquí', { direction: 'top', offset: [0, -10] })
      .addTo(this.map);
  }

  private mostrarAviso(mensaje: string): void {
    this.avisoUbicacion.set(mensaje);
    if (this.temporizadorAviso) clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => this.avisoUbicacion.set(null), 5000);
  }

  private setTile(provider: string): void {
    if (!this.map) return;
    if (this.tileLayer) this.map.removeLayer(this.tileLayer);
    const url = provider === 'google'
      ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    this.tileLayer = L.tileLayer(url, { maxZoom: 19 }).addTo(this.map);
  }

  private latLng(p: GeoJSONPoint): L.LatLngExpression {
    return [p.coordinates[1], p.coordinates[0]];
  }

  private render(): void {
    if (!this.map) return;
    if (this.capaMarcadores) this.map.removeLayer(this.capaMarcadores);
    this.capaMarcadores = L.layerGroup().addTo(this.map);
    const bounds: L.LatLngExpression[] = [];

    const sacadasUsadas = new Map<number, PuntoSacada>();
    for (const p of this.puntosSacada) sacadasUsadas.set(p.id_punto_sacada, p);
    let posSeleccionada: L.LatLngExpression | null = null;

    for (const u of this.ubicaciones) {
      if (!u.coordenadas) continue;
      const pos = this.latLng(u.coordenadas);
      bounds.push(pos);
      const seleccionada = u.id_ubicacion_exhibidor === this.selectedId;
      if (seleccionada) posSeleccionada = pos;
      const marker = L.marker(pos, {
        icon: iconoCirculo(seleccionada ? COLOR_UBICACION_SEL : COLOR_UBICACION, ICONO_EXHIBIDOR),
        zIndexOffset: seleccionada ? 500 : 0,
      })
        .bindTooltip(u.nombre, { direction: 'top', offset: [0, -14] })
        .on('click', () => this.ubicacionClick.emit(u.id_ubicacion_exhibidor));
      this.capaMarcadores.addLayer(marker);

      // Línea punteada hacia el punto de sacada
      const sacada = u.id_punto_sacada ? sacadasUsadas.get(u.id_punto_sacada) : null;
      if (sacada?.coordenadas) {
        this.capaMarcadores.addLayer(
          L.polyline([pos, this.latLng(sacada.coordenadas)], {
            color: COLOR_SACADA, weight: 1.5, dashArray: '6 6', opacity: 0.7,
          }),
        );
      }
    }

    for (const p of this.puntosSacada) {
      if (!p.coordenadas) continue;
      const pos = this.latLng(p.coordenadas);
      bounds.push(pos);
      this.capaMarcadores.addLayer(
        L.marker(pos, { icon: iconoCirculo(COLOR_SACADA, ICONO_SACADA) })
          .bindTooltip(`Sacada: ${p.nombre}`, { direction: 'top', offset: [0, -14] }),
      );
    }

    // Reencuadrar sólo cuando el conjunto de coordenadas cambia de verdad.
    // Antes se hacía en cada render(), así que seleccionar una tarjeta de la
    // lista deshacía el paneo o el zoom que el usuario acabara de hacer.
    const firma = bounds.map(b => (b as number[]).join(',')).sort().join('|');
    const seReencuadroTodo = bounds.length > 0 && firma !== this.firmaEncuadre;
    if (seReencuadroTodo) {
      this.firmaEncuadre = firma;
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16 });
    }

    // Elegir una tarjeta de la lista debe MOSTRAR su marcador, no solo
    // resaltarlo: si ya está a la vista no tocamos el encuadre (igual que el
    // punto provisional), pero si quedó fuera de la pantalla actual, un color
    // más oscuro en un punto que no se ve no le dice nada al usuario.
    if (!seReencuadroTodo && posSeleccionada && !this.map.getBounds().contains(posSeleccionada)) {
      this.map.flyTo(posSeleccionada, Math.max(this.map.getZoom(), 15), { animate: true, duration: 0.6 });
    }
  }

  private renderProvisional(): void {
    if (!this.map) return;
    if (this.marcadorProvisional) {
      this.map.removeLayer(this.marcadorProvisional);
      this.marcadorProvisional = null;
    }
    if (this.puntoProvisional) {
      const pos = this.latLng(this.puntoProvisional);
      const icon = this.tipoProvisional === 'sacada'
        ? iconoPin(COLOR_PROVISIONAL, ICONO_SACADA)
        : iconoCirculo(COLOR_PROVISIONAL, '+');
      this.marcadorProvisional = L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(this.map);
      // Recentrar solo si el punto queda fuera de vista (p. ej. al editar una
      // ubicación existente). Si el usuario acaba de hacer clic, el punto ya
      // está a la vista y mover el mapa bajo el cursor desorienta.
      if (!this.map.getBounds().contains(pos)) {
        this.map.panTo(pos);
      }
    }
  }
}

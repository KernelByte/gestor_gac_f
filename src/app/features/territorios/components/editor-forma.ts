import { signal } from '@angular/core';
import * as L from 'leaflet';

type Anillos = L.LatLng[][];

const OPCIONES_ESQUINAS = { allowSelfIntersection: false, snappable: true, snapDistance: 15 };
const ESTILO = { color: '#1d4ed8', weight: 3, fillColor: '#60a5fa', fillOpacity: 0.35 };
/** Separación en píxeles entre el borde superior de la figura y el tirador de giro. */
const SEPARACION_TIRADOR = 36;

const ICONO_GIRAR = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;

/**
 * Edita una figura en el mapa sin modos: arrastrar la figura la mueve, arrastrar una esquina
 * cambia la forma (Geoman) y arrastrar el tirador redondo la gira. Cada gesto terminado queda
 * en un historial para «Deshacer». El componente solo lee `cambios` y pide `geometria()`.
 */
export class EditorForma {
  /** Gestos guardados en el historial: > 0 significa que hay algo sin guardar. */
  readonly cambios = signal(0);
  readonly capa: L.Polygon;

  private historial: Anillos[] = [];
  private actual: Anillos;
  private readonly tirador: L.Marker;
  private readonly guia: L.Polyline;
  private gesto: {
    tipo: 'mover' | 'girar';
    pointerId: number;
    inicio: L.Point;
    centro: L.Point;
    puntos: L.Point[][];
    mapaArrastrable: boolean;
  } | null = null;

  constructor(private readonly map: L.Map, anillos: Anillos) {
    this.capa = L.polygon(anillos, ESTILO);
    (this.capa as any)._capaAuxiliar = true;
    this.capa.addTo(map);
    this.actual = copiar(anillos);
    this.capa.pm.enable(OPCIONES_ESQUINAS);
    this.capa.on('pm:edit', this.confirmar, this);
    // Tocar la figura no debe llegar al mapa (ahí quitaría la selección).
    this.capa.on('click', L.DomEvent.stopPropagation);

    const cuerpo = this.capa.getElement() as HTMLElement | undefined;
    if (cuerpo) {
      cuerpo.style.cursor = 'move';
      L.DomEvent.on(cuerpo, 'pointerdown', (ev) => this.empezar('mover', ev as PointerEvent));
    }

    this.guia = L.polyline([], { color: '#1d4ed8', weight: 1.5, dashArray: '4 4', interactive: false, pmIgnore: true, snapIgnore: true } as any).addTo(map);
    this.tirador = L.marker(map.getCenter(), {
      icon: L.divIcon({
        className: '',
        html: `<div title="Arrastre para girar" style="width:36px;height:36px;border-radius:9999px;background:#fff;border:2px solid #1d4ed8;color:#1d4ed8;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(15,23,42,.25);cursor:grab;touch-action:none">${ICONO_GIRAR}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
      keyboard: false,
      zIndexOffset: 1000,
      pmIgnore: true,
      snapIgnore: true,
    } as any).addTo(map);
    const el = this.tirador.getElement();
    if (el) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.on(el, 'pointerdown', (ev) => this.empezar('girar', ev as PointerEvent));
    }

    map.on('zoomend', this.colocarTirador, this);
    this.capa.on('pm:markerdrag pm:edit', this.colocarTirador, this);
    this.colocarTirador();
  }

  geometria(): any {
    return (this.capa.toGeoJSON() as any).geometry;
  }

  deshacer(): void {
    const previo = this.historial.pop();
    if (!previo) return;
    this.actual = copiar(previo);
    this.ponerAnillos(previo);
    this.cambios.set(this.historial.length);
  }

  /**
   * Quita tirador, guía y eventos. Con `dejarVisible` la figura queda pintada (sin edición)
   * hasta que el mapa recargue lo guardado; si no, se borra.
   */
  destruir(dejarVisible: boolean): void {
    this.soltar();
    this.map.off('zoomend', this.colocarTirador, this);
    this.capa.pm.disable();
    this.capa.off('pm:edit', this.confirmar, this);
    this.capa.off('pm:markerdrag pm:edit', this.colocarTirador, this);
    this.capa.off('click', L.DomEvent.stopPropagation);
    this.map.removeLayer(this.tirador);
    this.map.removeLayer(this.guia);
    if (dejarVisible) {
      const cuerpo = this.capa.getElement() as HTMLElement | undefined;
      if (cuerpo) { L.DomEvent.off(cuerpo); cuerpo.style.cursor = ''; }
    } else {
      this.map.removeLayer(this.capa);
    }
  }

  // ── Gestos ─────────────────────────────────────────────────────────────

  private empezar(tipo: 'mover' | 'girar', ev: PointerEvent): void {
    if (ev.button > 0 || this.gesto) return;
    L.DomEvent.stop(ev);
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    const puntos = this.anillos().map((anillo) => anillo.map((ll) => this.map.latLngToLayerPoint(ll)));
    this.gesto = {
      tipo,
      pointerId: ev.pointerId,
      inicio: this.map.mouseEventToLayerPoint(ev as any),
      centro: centroide(puntos.flat()),
      puntos,
      mapaArrastrable: this.map.dragging.enabled(),
    };
    this.map.dragging.disable();
    // Durante el gesto las esquinas estorban y se recalcularían en cada movimiento.
    this.capa.pm.disable();
    document.addEventListener('pointermove', this.alMover);
    document.addEventListener('pointerup', this.alSoltar);
    document.addEventListener('pointercancel', this.alSoltar);
  }

  private readonly alMover = (ev: PointerEvent): void => {
    const g = this.gesto;
    if (!g || ev.pointerId !== g.pointerId) return;
    ev.preventDefault();
    const p = this.map.mouseEventToLayerPoint(ev as any);
    let nuevos: L.Point[][];
    if (g.tipo === 'mover') {
      const d = p.subtract(g.inicio);
      nuevos = g.puntos.map((anillo) => anillo.map((q) => q.add(d)));
    } else {
      const giro = Math.atan2(p.y - g.centro.y, p.x - g.centro.x) - Math.atan2(g.inicio.y - g.centro.y, g.inicio.x - g.centro.x);
      nuevos = g.puntos.map((anillo) => anillo.map((q) => rotar(q, g.centro, giro)));
    }
    this.capa.setLatLngs(nuevos.map((anillo) => anillo.map((q) => this.map.layerPointToLatLng(q))));
    this.colocarTirador();
  };

  private readonly alSoltar = (ev: PointerEvent): void => {
    if (!this.gesto || ev.pointerId !== this.gesto.pointerId) return;
    this.soltar();
    this.confirmar();
  };

  private soltar(): void {
    const g = this.gesto;
    if (!g) return;
    this.gesto = null;
    document.removeEventListener('pointermove', this.alMover);
    document.removeEventListener('pointerup', this.alSoltar);
    document.removeEventListener('pointercancel', this.alSoltar);
    if (g.mapaArrastrable) this.map.dragging.enable();
    this.capa.pm.enable(OPCIONES_ESQUINAS);
  }

  // ── Historial y tirador ────────────────────────────────────────────────

  /** Un gesto terminó: si la figura cambió, la versión anterior pasa al historial. */
  private confirmar(): void {
    const ahora = copiar(this.anillos());
    if (iguales(ahora, this.actual)) return;
    this.historial.push(this.actual);
    this.actual = ahora;
    this.cambios.set(this.historial.length);
  }

  private ponerAnillos(anillos: Anillos): void {
    this.capa.pm.disable();
    this.capa.setLatLngs(copiar(anillos));
    this.capa.pm.enable(OPCIONES_ESQUINAS);
    this.colocarTirador();
  }

  /** El tirador va centrado sobre la figura, un poco por encima de su borde superior. */
  private colocarTirador(): void {
    const puntos = this.anillos().flat().map((ll) => this.map.latLngToLayerPoint(ll));
    if (!puntos.length) return;
    const xs = puntos.map((p) => p.x);
    const arriba = Math.min(...puntos.map((p) => p.y));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const borde = this.map.layerPointToLatLng(L.point(cx, arriba));
    const tirador = this.map.layerPointToLatLng(L.point(cx, arriba - SEPARACION_TIRADOR));
    this.tirador.setLatLng(tirador);
    this.guia.setLatLngs([borde, tirador]);
  }

  private anillos(): Anillos {
    const ll = this.capa.getLatLngs() as any[];
    return Array.isArray(ll[0]) ? (ll as Anillos) : [ll as L.LatLng[]];
  }
}

function copiar(anillos: Anillos): Anillos {
  return anillos.map((anillo) => anillo.map((ll) => L.latLng(ll.lat, ll.lng)));
}

function iguales(a: Anillos, b: Anillos): boolean {
  return a.length === b.length && a.every((anillo, i) =>
    anillo.length === b[i].length && anillo.every((ll, j) => ll.equals(b[i][j], 1e-9)));
}

function centroide(puntos: L.Point[]): L.Point {
  const n = puntos.length || 1;
  return L.point(puntos.reduce((s, p) => s + p.x, 0) / n, puntos.reduce((s, p) => s + p.y, 0) / n);
}

function rotar(p: L.Point, c: L.Point, rad: number): L.Point {
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = p.x - c.x, dy = p.y - c.y;
  return L.point(c.x + dx * cos - dy * sin, c.y + dx * sin + dy * cos);
}

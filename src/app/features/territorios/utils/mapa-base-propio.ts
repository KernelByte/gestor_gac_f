import type * as Leaflet from 'leaflet';
import { environment } from '../../../../environments/environment';

/**
 * Mapa base propio: datos de OpenStreetMap convertidos a un archivo PMTiles
 * (ver la guía en docs de territorios) y dibujados con MapLibre GL dentro de
 * Leaflet. Leaflet sigue siendo quien maneja el dibujo de territorios y
 * manzanas; esto solo reemplaza la capa de fondo.
 *
 * MapLibre pesa mucho, así que se importa bajo demanda: quien usa OSM o Google
 * no lo descarga.
 */

const FUENTE_ETIQUETAS = 'Noto Sans Regular';
const FUENTE_LUGARES = 'Open Sans Semibold';

/** Estilo para las teselas con el esquema OpenMapTiles (el que genera Planetiler). */
function estiloBase(urlPmtiles: string, glyphs: string): any {
  const vias = (id: string, clases: string[], color: string, ancho: [number, number, number, number]) => ({
    id,
    type: 'line',
    source: 'osm',
    'source-layer': 'transportation',
    filter: ['in', ['get', 'class'], ['literal', clases]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], ancho[0], ancho[1], ancho[2], ancho[3]],
    },
  });

  return {
    version: 8,
    glyphs,
    sources: {
      osm: {
        type: 'vector',
        url: `pmtiles://${urlPmtiles}`,
        attribution: '© OpenMapTiles © OpenStreetMap contributors',
      },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': '#f3efe7' } },
      { id: 'cobertura', type: 'fill', source: 'osm', 'source-layer': 'landcover', paint: { 'fill-color': '#dfe9cf' } },
      { id: 'parque', type: 'fill', source: 'osm', 'source-layer': 'park', paint: { 'fill-color': '#cfe5b5' } },
      {
        id: 'uso-suelo', type: 'fill', source: 'osm', 'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial']]],
        paint: { 'fill-color': '#ece6da' },
      },
      { id: 'agua', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': '#a9d3ef' } },
      { id: 'rio', type: 'line', source: 'osm', 'source-layer': 'waterway', paint: { 'line-color': '#a9d3ef', 'line-width': 1.5 } },
      {
        id: 'edificios', type: 'fill', source: 'osm', 'source-layer': 'building', minzoom: 14,
        paint: { 'fill-color': '#d8cfc4', 'fill-outline-color': '#b9ada0' },
      },
      vias('via-servicio', ['service', 'track', 'path', 'minor'], '#ffffff', [13, 0.6, 18, 5]),
      vias('via-terciaria', ['tertiary', 'secondary'], '#fff7d6', [11, 1, 18, 9]),
      vias('via-primaria', ['primary', 'trunk', 'motorway'], '#fde08a', [8, 1, 18, 12]),
      {
        id: 'nombre-calle', type: 'symbol', source: 'osm', 'source-layer': 'transportation_name', minzoom: 14,
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': [FUENTE_ETIQUETAS], 'text-size': 12 },
        paint: { 'text-color': '#475569', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      },
      {
        id: 'numero-casa', type: 'symbol', source: 'osm', 'source-layer': 'housenumber', minzoom: 17,
        layout: { 'text-field': ['get', 'housenumber'], 'text-font': [FUENTE_ETIQUETAS], 'text-size': 10 },
        paint: { 'text-color': '#64748b', 'text-halo-color': '#fff', 'text-halo-width': 1 },
      },
      {
        id: 'lugares', type: 'symbol', source: 'osm', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood', 'hamlet']]],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': [FUENTE_LUGARES],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 12, 16, 16],
        },
        paint: { 'text-color': '#1e293b', 'text-halo-color': '#fff', 'text-halo-width': 2 },
      },
    ],
  };
}

type FabricaCapa = (opciones: { style: any }) => Leaflet.Layer;
let preparado: Promise<FabricaCapa> | null = null;

/** Carga MapLibre una sola vez y registra el protocolo pmtiles:// y el worker. */
function preparar(): Promise<FabricaCapa> {
  if (!preparado) {
    preparado = (async () => {
      const [maplibre, plugin, pmtiles] = await Promise.all([
        import('maplibre-gl'),
        import('@maplibre/maplibre-gl-leaflet'),
        import('pmtiles'),
      ]);
      // El worker se copia a /maplibre (angular.json): el empaquetador lo mueve de sitio
      // y MapLibre no lo encuentra por su cuenta.
      maplibre.setWorkerUrl(`${location.origin}/maplibre/maplibre-gl-worker.mjs`);
      // Existe en tiempo de ejecución, pero los tipos de la versión 6 no lo declaran.
      (maplibre as any).addProtocol('pmtiles', new pmtiles.Protocol().tile);
      return plugin.maplibreGL as unknown as FabricaCapa;
    })().catch((e) => {
      preparado = null;
      throw e;
    });
  }
  return preparado;
}

/** URL absoluta del archivo, para que MapLibre (que corre en un worker) la resuelva igual. */
function urlArchivo(): string {
  return new URL(environment.mapaPropio.pmtilesUrl, location.href).href;
}

/** Comprueba que el archivo responde por rangos; si no, no vale la pena montar la capa. */
async function archivoDisponible(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    return r.status === 206 || r.status === 200;
  } catch {
    return false;
  }
}

/** Clases de vía que cierran una manzana. Fuera: senderos, servidumbres y entradas a predios. */
const CLASES_QUE_CIERRAN = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'];

/**
 * Calles que el mapa propio tiene cargadas ahora mismo, como un MultiLineString.
 * Solo trae lo que está en pantalla: quien llama debe encuadrar antes la zona.
 * Devuelve null si la capa no es la propia (OSM/Google son imágenes, no datos).
 */
export async function callesDelMapa(capa: Leaflet.Layer | null): Promise<{ type: 'MultiLineString'; coordinates: number[][][] } | null> {
  const gl = (capa as any)?.getMaplibreMap?.();
  if (!gl) return null;
  // Espera a que terminen de llegar las teselas del encuadre actual (máx. 8 s).
  if (!gl.areTilesLoaded()) {
    await new Promise<void>((ok) => {
      const fin = setTimeout(ok, 8000);
      gl.once('idle', () => { clearTimeout(fin); ok(); });
    });
  }
  const features = gl.querySourceFeatures('osm', {
    sourceLayer: 'transportation',
    filter: ['any',
      ['in', ['get', 'class'], ['literal', CLASES_QUE_CIERRAN]],
      ['==', ['get', 'subclass'], 'pedestrian'],
    ],
  });
  const coordinates: number[][][] = [];
  for (const f of features) {
    const g = f.geometry;
    if (g.type === 'LineString') coordinates.push(g.coordinates);
    else if (g.type === 'MultiLineString') coordinates.push(...g.coordinates);
  }
  return { type: 'MultiLineString', coordinates };
}

/**
 * Crea la capa base propia lista para `addTo(map)`. Devuelve null si el
 * archivo no está disponible: quien llama debe volver a OSM.
 */
export async function crearCapaBasePropia(): Promise<Leaflet.Layer | null> {
  const url = urlArchivo();
  if (!(await archivoDisponible(url))) return null;
  const maplibreGL = await preparar();
  return maplibreGL({ style: estiloBase(url, environment.mapaPropio.glyphsUrl) });
}

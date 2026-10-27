import type * as Leaflet from 'leaflet';
import { environment } from '../../../../environments/environment';

/**
 * Mapa base propio: datos de OpenStreetMap en un archivo PMTiles de Colombia
 * (compilación de Protomaps que el Administrador descarga desde Configuración → Admin)
 * y dibujados con MapLibre GL dentro de Leaflet. Leaflet sigue siendo quien maneja el dibujo de territorios y
 * manzanas; esto solo reemplaza la capa de fondo.
 *
 * MapLibre pesa mucho, así que se importa bajo demanda: quien usa OSM o Google
 * no lo descarga.
 */

const FUENTE_ETIQUETAS = 'Noto-Sans-Regular';
const FUENTE_LUGARES = 'Noto-Sans-Medium';

/** Nombre en español si OpenStreetMap lo trae; si no, el nombre local. */
const NOMBRE = ['coalesce', ['get', 'name:es'], ['get', 'name']];

/** Estilo para las teselas «Protomaps Basemap» (capas: earth, water, landuse, buildings, roads, places). */
function estiloBase(urlPmtiles: string, glyphs: string): any {
  const via = (id: string, filtro: any, color: string, ancho: [number, number, number, number], minzoom = 0) => ({
    id, type: 'line', source: 'osm', 'source-layer': 'roads', minzoom, filter: filtro,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], ancho[0], ancho[1], ancho[2], ancho[3]],
    },
  });
  const tipo = (...kinds: string[]) => ['in', ['get', 'kind'], ['literal', kinds]];

  return {
    version: 8,
    glyphs,
    sources: {
      osm: {
        type: 'vector',
        url: `pmtiles://${urlPmtiles}`,
        attribution: '© OpenStreetMap contributors · Protomaps',
      },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': '#f3efe7' } },
      { id: 'tierra', type: 'fill', source: 'osm', 'source-layer': 'earth', paint: { 'fill-color': '#f3efe7' } },
      { id: 'cobertura', type: 'fill', source: 'osm', 'source-layer': 'landcover', paint: { 'fill-color': '#dfe9cf' } },
      {
        id: 'parque', type: 'fill', source: 'osm', 'source-layer': 'landuse',
        filter: tipo('park', 'forest', 'nature_reserve', 'grass', 'garden', 'golf_course', 'wood', 'pitch'),
        paint: { 'fill-color': '#cfe5b5' },
      },
      {
        id: 'uso-suelo', type: 'fill', source: 'osm', 'source-layer': 'landuse',
        filter: tipo('residential', 'commercial', 'industrial', 'retail', 'school', 'hospital', 'university'),
        paint: { 'fill-color': '#ece6da' },
      },
      { id: 'agua', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': '#a9d3ef' } },
      {
        id: 'rio', type: 'line', source: 'osm', 'source-layer': 'water',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#a9d3ef', 'line-width': 1.5 },
      },
      {
        id: 'edificios', type: 'fill', source: 'osm', 'source-layer': 'buildings', minzoom: 14,
        paint: { 'fill-color': '#d8cfc4', 'fill-outline-color': '#b9ada0' },
      },
      via('via-sendero', tipo('path'), '#ffffff', [15, 0.5, 18, 2.5], 15),
      via('via-servicio', ['all', tipo('minor_road'), ['==', ['get', 'kind_detail'], 'service']], '#ffffff', [14, 0.5, 18, 4], 14),
      via('via-local', ['all', tipo('minor_road'), ['!=', ['get', 'kind_detail'], 'service']], '#ffffff', [13, 0.8, 18, 6]),
      via('via-principal', tipo('major_road'), '#fff7d6', [10, 1, 18, 10]),
      via('via-autopista', tipo('highway'), '#fde08a', [7, 1, 18, 13]),
      {
        id: 'nombre-calle', type: 'symbol', source: 'osm', 'source-layer': 'roads', minzoom: 14,
        filter: ['has', 'name'],
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': [FUENTE_ETIQUETAS], 'text-size': 12 },
        paint: { 'text-color': '#475569', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      },
      {
        id: 'lugares', type: 'symbol', source: 'osm', 'source-layer': 'places',
        filter: ['has', 'name'],
        layout: {
          'text-field': NOMBRE,
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

/** Vías que cierran una manzana: autopistas, principales y locales. Fuera: servidumbres y senderos (salvo calles peatonales). */
const FILTRO_QUE_CIERRAN = ['any',
  ['in', ['get', 'kind'], ['literal', ['highway', 'major_road']]],
  ['all', ['==', ['get', 'kind'], 'minor_road'], ['!=', ['get', 'kind_detail'], 'service']],
  ['==', ['get', 'kind_detail'], 'pedestrian'],
];

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
  const features = gl.querySourceFeatures('osm', { sourceLayer: 'roads', filter: FILTRO_QUE_CIERRAN });
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
  // Absoluta, pero sin pasar por URL(): codificaría las llaves de {fontstack} y {range}.
  const glyphs = environment.mapaPropio.glyphsUrl.startsWith('/') ? location.origin + environment.mapaPropio.glyphsUrl : environment.mapaPropio.glyphsUrl;
  return maplibreGL({ style: estiloBase(url, glyphs) });
}

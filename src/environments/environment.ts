export const environment = {
  production: false,
  apiUrl: '/api',
  // Mapa base propio (OSM → Planetiler → PMTiles). Ver features/territorios/utils/mapa-base-propio.ts.
  mapaPropio: {
    pmtilesUrl: 'http://localhost:8099/colombia.pmtiles',
    // Fuentes de las etiquetas. Es un servidor de demostración de MapLibre: en producción hay que alojarlas.
    glyphsUrl: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },
};

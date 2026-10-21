export const environment = {
  production: true,
  apiUrl: '/api',
  // Mapa base propio (OSM → Planetiler → PMTiles). Ver features/territorios/utils/mapa-base-propio.ts.
  mapaPropio: {
    pmtilesUrl: '/maps/colombia.pmtiles',
    // Fuentes de las etiquetas. Es un servidor de demostración de MapLibre: en producción hay que alojarlas.
    glyphsUrl: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },
};

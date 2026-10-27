export const environment = {
  production: false,
  apiUrl: '/api',
  // Mapa base propio (OSM → Protomaps → PMTiles; el servidor lo descarga y lo sirve). Ver features/territorios/utils/mapa-base-propio.ts.
  mapaPropio: {
    pmtilesUrl: '/api/mapa/colombia.pmtiles',
    // Fuentes de las etiquetas, alojadas en la propia app (public/map-fonts).
    glyphsUrl: '/map-fonts/{fontstack}/{range}.pbf',
  },
};

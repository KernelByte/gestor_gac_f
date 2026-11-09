export const environment = {
  production: true,
  apiUrl: '/api',
  // Versión visible en el pie del login y de las pantallas de acceso.
  appVersion: '1.7',
  // Mapa base propio (OSM → Protomaps → PMTiles; el servidor lo descarga y lo sirve). Ver features/territorios/utils/mapa-base-propio.ts.
  mapaPropio: {
    pmtilesUrl: '/api/mapa/colombia.pmtiles',
    // Fuentes de las etiquetas, alojadas en la propia app (public/map-fonts).
    glyphsUrl: '/map-fonts/{fontstack}/{range}.pbf',
  },
};

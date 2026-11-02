import { estiloParaImprimir, cargarMaplibre } from './mapa-base-propio';

/**
 * «Tarjeta del mapa del territorio» (S-12-S) con el mapa de la tarjeta ya puesto.
 *
 * Las medidas salen del PDF oficial (S-12_S.pdf, 413,9 × 267,7 pt): título, «Localidad … Terr. núm. …»,
 * recuadro del mapa e instrucciones en el mismo lugar y con las mismas fuentes (Times en negrita).
 * El fondo (calles con sus nombres) se renderiza con MapLibre en alta resolución; el límite, las
 * manzanas y sus números van encima como vectores, para que salgan nítidos al imprimir.
 */

type Anillo = number[][];
type Poligono = Anillo[];

export interface DatosTarjetaS12 {
  codigo: string;
  localidad: string;
  /** Límite de la tarjeta (Polygon o MultiPolygon, lon/lat). */
  limite: any;
  /** Manzanas de la tarjeta (FeatureCollection con `numero_manzana`). */
  manzanas: any | null;
}

// ── Medidas del S-12-S (puntos tipográficos) ─────────────────────────────
const ANCHO = 413.9;
const ALTO = 267.7;
const IZQ = 28.4;
const DER = 385.5;
const CAJA = { x: IZQ, y: 62, w: DER - IZQ, h: 131 };
/** Las mismas tres líneas del formulario (las dos primeras justificadas). */
const INSTRUCCIONES = [
  'Sírvase mantener esta tarjeta en el sobre. No la manche, marque, ni doble. Cada vez que',
  'se haya trabajado completamente el territorio, infórmelo al hermano que atiende los',
  'archivos del territorio.',
];

/** Píxeles CSS del mapa por punto del PDF, y densidad del render: ~430 ppp en la tarjeta impresa. */
const PX_POR_PT = 2;
const DENSIDAD = 3;
const MARGEN_MAPA_PX = 26;
const TESELA = 512; // MapLibre: el mundo mide 512·2^zoom píxeles CSS

// ── Proyección (Web Mercator, la misma de MapLibre con rumbo e inclinación en 0) ──
const mercX = (lon: number) => (lon + 180) / 360;
const mercY = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

function poligonosDe(geom: any): Poligono[] {
  if (!geom) return [];
  if (geom.type === 'Feature') return poligonosDe(geom.geometry);
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

interface Vista { centro: [number, number]; zoom: number; aPt: (lon: number, lat: number) => [number, number] }

/** Encuadra el límite en el recuadro del mapa y devuelve cómo pasar lon/lat a puntos del PDF. */
function encuadre(poligonos: Poligono[]): Vista {
  const pts = poligonos.flatMap((p) => p[0] ?? []);
  const xs = pts.map(([lon]) => mercX(lon));
  const ys = pts.map(([, lat]) => mercY(lat));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const anchoPx = CAJA.w * PX_POR_PT;
  const altoPx = CAJA.h * PX_POR_PT;
  const escala = Math.min(
    (anchoPx - 2 * MARGEN_MAPA_PX) / Math.max((x1 - x0) * TESELA, 1e-9),
    (altoPx - 2 * MARGEN_MAPA_PX) / Math.max((y1 - y0) * TESELA, 1e-9),
  );
  const zoom = Math.min(Math.log2(escala), 18.5);
  const mundo = TESELA * 2 ** zoom;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const lon = cx * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180) / Math.PI;
  return {
    centro: [lon, lat],
    zoom,
    aPt: (lo, la) => [
      CAJA.x + ((mercX(lo) - cx) * mundo + anchoPx / 2) / PX_POR_PT,
      CAJA.y + ((mercY(la) - cy) * mundo + altoPx / 2) / PX_POR_PT,
    ],
  };
}

/** Capas de MapLibre que son texto (nombres de calles y lugares): se imprimen encima del dibujo. */
const CAPAS_NOMBRES = ['nombre-calle', 'lugares'];

interface Fondo {
  /** Calles, parques, edificios… sin nombres (JPEG). */
  base: string;
  /** Solo los nombres, con fondo transparente (PNG); null si el mapa no los separa (teselas OSM). */
  nombres: string | null;
}

/** Espera a que el mapa termine de dibujar lo que tiene pedido. */
function esperarDibujo(mapa: any, ms = 25000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const limite = setTimeout(() => reject(new Error('El mapa base tardó demasiado')), ms);
    mapa.once('idle', () => { clearTimeout(limite); resolve(); });
    mapa.once('error', (e: any) => { if (!mapa.loaded()) { clearTimeout(limite); reject(e?.error ?? e); } });
  });
}

/**
 * El mapa base en dos capas: primero las calles sin nombres (con un velo blanco fuera de la tarjeta)
 * y luego solo los nombres. Así el límite y las manzanas se dibujan entre las dos y no tapan ningún
 * nombre. Los números de las manzanas se reservan como obstáculos invisibles para que ningún nombre
 * de calle caiga debajo de una etiqueta.
 */
async function fondoDelMapa(vista: Vista, poligonos: Poligono[], numeros: { lonlat: [number, number]; texto: string }[]): Promise<Fondo> {
  const maplibre = await cargarMaplibre();
  // Fuera de la tarjeta el mapa queda aclarado: así el territorio resalta sin tapar las calles vecinas.
  const velo = {
    type: 'Feature', properties: {},
    geometry: { type: 'Polygon', coordinates: [[[-179, -85], [179, -85], [179, 85], [-179, 85], [-179, -85]], ...poligonos.map((p) => p[0])] },
  };
  const reservas = {
    type: 'FeatureCollection',
    features: numeros.map((n) => ({ type: 'Feature', properties: { t: n.texto }, geometry: { type: 'Point', coordinates: n.lonlat } })),
  };
  const style = await estiloParaImprimir(
    { velo: { type: 'geojson', data: velo }, reservas: { type: 'geojson', data: reservas } },
    [{ id: 'velo', type: 'fill', source: 'velo', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.5 } }],
  );
  const conNombres = style.layers.some((c: any) => CAPAS_NOMBRES.includes(c.id));
  if (conNombres) {
    // Arriba de todo: MapLibre coloca primero los textos de las capas superiores.
    style.layers.push({
      id: 'reserva-numeros', type: 'symbol', source: 'reservas',
      layout: {
        'text-field': ['get', 't'], 'text-font': ['Noto-Sans-Medium'], 'text-size': 15,
        'text-padding': 6, 'text-allow-overlap': true, 'text-ignore-placement': false,
      },
      paint: { 'text-opacity': 0 },
    });
  }

  const contenedor = document.createElement('div');
  Object.assign(contenedor.style, {
    position: 'fixed', left: '-10000px', top: '0',
    width: `${CAJA.w * PX_POR_PT}px`, height: `${CAJA.h * PX_POR_PT}px`,
  });
  document.body.appendChild(contenedor);
  let mapa: any = null;
  try {
    mapa = new maplibre.Map({
      container: contenedor, style, center: vista.centro, zoom: vista.zoom,
      interactive: false, attributionControl: false, fadeDuration: 0, pixelRatio: DENSIDAD,
      // Sin esto el lienzo WebGL se borra antes de poder leerlo.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    } as any);
    await esperarDibujo(mapa);
    if (!conNombres) return { base: mapa.getCanvas().toDataURL('image/jpeg', 0.92), nombres: null };

    const visibles = (ids: (id: string) => boolean) => {
      for (const c of mapa.getStyle().layers) mapa.setLayoutProperty(c.id, 'visibility', ids(c.id) ? 'visible' : 'none');
    };
    // 1) Todo menos los nombres.
    visibles((id) => !CAPAS_NOMBRES.includes(id));
    await esperarDibujo(mapa);
    const base = mapa.getCanvas().toDataURL('image/jpeg', 0.92);
    // 2) Solo los nombres (y las reservas, que son invisibles), sobre fondo transparente.
    visibles((id) => CAPAS_NOMBRES.includes(id) || id === 'reserva-numeros');
    await esperarDibujo(mapa);
    return { base, nombres: mapa.getCanvas().toDataURL('image/png') };
  } finally {
    mapa?.remove();
    contenedor.remove();
  }
}

/** Centro aproximado (por área) de un anillo lon/lat: para reservar el lugar del número. */
function centroLonLat(anillo: Anillo): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const f = anillo[j][0] * anillo[i][1] - anillo[i][0] * anillo[j][1];
    a += f; cx += (anillo[j][0] + anillo[i][0]) * f; cy += (anillo[j][1] + anillo[i][1]) * f;
  }
  return Math.abs(a) < 1e-15 ? [anillo[0][0], anillo[0][1]] : [cx / (3 * a), cy / (3 * a)];
}

/** Centro de un polígono ya proyectado (por área: cae dentro aunque la manzana sea irregular). */
function centroPt(anillo: [number, number][]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const f = anillo[j][0] * anillo[i][1] - anillo[i][0] * anillo[j][1];
    a += f; cx += (anillo[j][0] + anillo[i][0]) * f; cy += (anillo[j][1] + anillo[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = anillo.length;
    return [anillo.reduce((s, p) => s + p[0], 0) / n, anillo.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Genera el PDF S-12-S de la tarjeta y lo descarga. */
export async function descargarTarjetaS12(datos: DatosTarjetaS12): Promise<void> {
  const poligonos = poligonosDe(datos.limite);
  if (!poligonos.length) throw new Error('La tarjeta no tiene el límite dibujado.');
  const vista = encuadre(poligonos);

  // El fondo es lo único que puede fallar (sin red o sin mapa propio): sin él la tarjeta sale igual, solo con el dibujo.
  const manzanas = (datos.manzanas?.features ?? []).filter((f: any) => f?.geometry);
  const numeros = manzanas
    .map((f: any) => ({ texto: String(f.properties?.numero_manzana ?? '').trim(), anillo: poligonosDe(f.geometry)[0]?.[0] }))
    .filter((n: any) => n.texto && n.anillo)
    .map((n: any) => ({ texto: n.texto, lonlat: centroLonLat(n.anillo) }));
  let fondo: Fondo | null = null;
  try {
    fondo = await fondoDelMapa(vista, poligonos, numeros);
  } catch (e) {
    console.warn('Tarjeta S-12 sin mapa base:', e);
  }

  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: [ANCHO, ALTO], orientation: 'landscape' });
  pdf.setProperties({ title: `Tarjeta del mapa del territorio ${datos.codigo}`, subject: 'S-12-S' });
  pdf.setTextColor(0, 0, 0);

  // ── Encabezado ──
  pdf.setFont('times', 'bold');
  pdf.setFontSize(12.1);
  pdf.text('Tarjeta del mapa del territorio', ANCHO / 2, 31, { align: 'center' });

  pdf.setFontSize(10);
  pdf.text('Localidad', IZQ, 54.3);
  const terr = 'Terr. núm.';
  const xTerr = 268;
  pdf.text(terr, xTerr, 54.3);
  const finTerr = xTerr + pdf.getTextWidth(terr) + 2.5;
  const inicioLocalidad = IZQ + pdf.getTextWidth('Localidad') + 2;

  // Líneas de puntos, como en el formulario impreso.
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.45);
  pdf.setLineDashPattern([0.01, 1.35], 0);
  (pdf as any).setLineCap?.('round');
  pdf.line(inicioLocalidad, 55, xTerr - 3, 55);
  pdf.line(finTerr, 55, DER, 55);
  pdf.setLineDashPattern([], 0);
  (pdf as any).setLineCap?.('butt');

  // Lo que se escribiría a mano, en otra letra para que se distinga del formulario.
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(17, 24, 39);
  const espacioLocalidad = xTerr - 6 - inicioLocalidad;
  let localidad = datos.localidad || '';
  while (localidad && pdf.getTextWidth(localidad) > espacioLocalidad) localidad = localidad.slice(0, -2) + '…';
  pdf.text(localidad, inicioLocalidad + espacioLocalidad / 2, 53, { align: 'center' });
  pdf.text(datos.codigo, (finTerr + DER) / 2, 53, { align: 'center' });

  // ── Mapa ──
  if (fondo) {
    pdf.addImage(fondo.base, 'JPEG', CAJA.x, CAJA.y, CAJA.w, CAJA.h, undefined, 'FAST');
  } else {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(CAJA.x, CAJA.y, CAJA.w, CAJA.h, 'F');
  }

  const trazar = (anillo: [number, number][], estilo: 'S' | 'F' | 'FD') => {
    if (anillo.length < 2) return;
    const [x0, y0] = anillo[0];
    const pasos = anillo.slice(1).map(([x, y], i) => [x - anillo[i][0], y - anillo[i][1]]);
    pdf.lines(pasos, x0, y0, [1, 1], estilo, true);
  };
  const proyectar = (anillo: Anillo) => anillo.map(([lon, lat]) => vista.aPt(lon, lat));

  // Manzanas: contorno fino y su número en una etiqueta.
  pdf.setDrawColor(51, 65, 85);
  pdf.setLineWidth(0.6);
  for (const f of manzanas) for (const p of poligonosDe(f.geometry)) trazar(proyectar(p[0]), 'S');

  // Límite de la tarjeta: halo blanco y trazo oscuro encima (se lee igual en blanco y negro).
  for (const p of poligonos) {
    const anillo = proyectar(p[0]);
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(3.4);
    trazar(anillo, 'S');
    pdf.setDrawColor(76, 29, 149);
    pdf.setLineWidth(1.7);
    trazar(anillo, 'S');
  }

  // Los nombres de las calles encima del límite y las manzanas: ninguno queda tapado.
  if (fondo?.nombres) pdf.addImage(fondo.nombres, 'PNG', CAJA.x, CAJA.y, CAJA.w, CAJA.h, undefined, 'FAST');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.8);
  for (const f of manzanas) {
    const numero = String(f.properties?.numero_manzana ?? '').trim();
    const p = poligonosDe(f.geometry)[0];
    if (!numero || !p) continue;
    const [x, y] = centroPt(proyectar(p[0]));
    const w = pdf.getTextWidth(numero) + 4.6;
    pdf.setFillColor(51, 65, 85);
    pdf.roundedRect(x - w / 2, y - 4.2, w, 8.2, 2, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text(numero, x, y + 2.4, { align: 'center' });
  }

  // Norte arriba a la derecha y la atribución que exige OpenStreetMap.
  const nx = CAJA.x + CAJA.w - 11;
  const ny = CAJA.y + 12;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.4);
  pdf.circle(nx, ny, 7, 'FD');
  pdf.setFillColor(17, 24, 39);
  pdf.triangle(nx, ny - 5, nx - 2.6, ny + 0.6, nx + 2.6, ny + 0.6, 'F');
  pdf.setTextColor(17, 24, 39);
  pdf.setFontSize(4.6);
  pdf.text('N', nx, ny + 5, { align: 'center' });
  if (fondo) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(4);
    pdf.setTextColor(100, 116, 139);
    pdf.text('© OpenStreetMap', CAJA.x + 2.5, CAJA.y + CAJA.h - 2.5);
  }

  // Borde fino del recuadro: lo que está fuera no se ve.
  pdf.setDrawColor(148, 163, 184);
  pdf.setLineWidth(0.5);
  pdf.rect(CAJA.x, CAJA.y, CAJA.w, CAJA.h, 'S');

  // ── Pie, igual al formulario ──
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.9);
  pdf.text('(Pegue el mapa arriba o dibuje el territorio)', ANCHO / 2, 203.6, { align: 'center', charSpace: 0.25 });

  pdf.setFont('times', 'bold');
  pdf.setFontSize(9.1);
  INSTRUCCIONES.forEach((linea, i) => {
    const y = 214.6 + i * 9.07;
    const palabras = linea.split(' ');
    if (i === INSTRUCCIONES.length - 1 || palabras.length < 2) { pdf.text(linea, IZQ, y); return; }
    // Justificada a mano: el espacio sobrante se reparte entre las palabras.
    const ocupado = palabras.reduce((t, w) => t + pdf.getTextWidth(w), 0);
    const hueco = (CAJA.w - ocupado) / (palabras.length - 1);
    let x = IZQ;
    for (const w of palabras) { pdf.text(w, x, y); x += pdf.getTextWidth(w) + hueco; }
  });

  pdf.setFont('times', 'normal');
  pdf.setFontSize(6);
  pdf.text('S-12-S', 28.5, 248.3);
  pdf.text('6/72', 59.6, 248.3);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.2);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Impresa el ${new Date().toLocaleDateString('es-CO')}`, DER, 248.3, { align: 'right' });

  pdf.save(`S-12_${datos.codigo}.pdf`);
}

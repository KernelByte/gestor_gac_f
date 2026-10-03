/**
 * La hoja impresa del programa de Logística, como documento HTML completo.
 *
 * Es una función pura a propósito: el estudio pinta este mismo HTML en un
 * iframe para la vista previa y llama a `print()` sobre ese iframe, así que lo
 * que se ve es exactamente lo que sale por la impresora (mismas reglas @page,
 * mismos saltos de página). Nada del shell de la app se cuela en la hoja.
 */
import { MESES_ES } from '../models/logistica.models';
import {
  EstiloImpresion,
  FilaDiscursoImpresion,
  PAPEL_MM,
  tintaSeccion,
  SeccionesImpresion,
  VistaImprimibleOut,
} from '../models/logistica-impresion.models';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const ROTULOS: Record<string, string> = {
  acomodador_1: 'Acomodador 1',
  acomodador_2: 'Acomodador 2',
  vigilancia_1: 'Vigilancia 1',
  vigilancia_2: 'Vigilancia 2',
  microfono_1: 'Micrófono 1',
  microfono_2: 'Micrófono 2',
  plataforma: 'Plataforma',
  audio: 'Audio',
  video: 'Video',
};

/** Cuando un turno no tiene segundo (vigilancia_2 apagado), sobra el "1". */
const ROTULO_UNICO: Record<string, string> = {
  vigilancia_1: 'Vigilancia',
  microfono_1: 'Micrófono',
};

function esc(v: string | null | undefined): string {
  return (v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function celda(v: string | null | undefined): string {
  return v ? esc(v) : '<span class="vacio">—</span>';
}

/** '2026-10-06' → '06 de octubre'. Sin Date para no depender de la zona. */
export function fechaLarga(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} de ${MESES_ES[m - 1].toLowerCase()}`;
}

function diaSemana(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

export function nombreMes(ano: number, mes: number): string {
  return `${MESES_ES[mes - 1]} ${ano}`;
}

interface Columna { titulo: string; ancho?: string; clase?: 'c-fecha' | 'c-dia' }

/**
 * Una fila normal (una celda por columna) o una fecha sin reunión: sus
 * primeras celdas (fecha, día) y el motivo ocupando el resto del ancho.
 */
type Fila = string[] | { celdas: string[]; sinReunion: string };

/** Fila de una semana sin reunión (asamblea, congreso, Conmemoración). */
function filaSinReunion(celdas: string[], motivo: string | null | undefined): Fila {
  return {
    celdas,
    sinReunion: `<span class="sin-reunion-etq">Sin reunión</span>${motivo ? esc(motivo) : ''}`,
  };
}

type Seccion = keyof SeccionesImpresion;

function tabla(
  seccion: Seccion, titulo: string, columnas: Columna[], filas: Fila[], vacio: string,
): string {
  const colgroup = columnas.map((c) => `<col${c.ancho ? ` style="width:${c.ancho}"` : ''}>`).join('');
  const thead = columnas.map((c) => `<th scope="col">${esc(c.titulo)}</th>`).join('');
  const td = (c: string, i: number) => {
    const clase = columnas[i]?.clase;
    return `<td${clase ? ` class="${clase}"` : ''}>${c}</td>`;
  };
  const pintar = (f: Fila) => Array.isArray(f)
    ? `<tr>${f.map(td).join('')}</tr>`
    : `<tr class="sin-reunion">${f.celdas.map(td).join('')}`
      + `<td colspan="${columnas.length - f.celdas.length}">${f.sinReunion}</td></tr>`;
  const tbody = filas.length
    ? filas.map(pintar).join('')
    : `<tr><td class="sin-filas" colspan="${columnas.length}">${esc(vacio)}</td></tr>`;
  return `
    <section class="seccion" data-seccion="${seccion}">
      <h2>${esc(titulo)}</h2>
      <table>
        <colgroup>${colgroup}</colgroup>
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </section>`;
}

function tablaPuestos(
  seccion: Seccion, titulo: string, datos: VistaImprimibleOut, puestos: string[], extra?: { titulo: string; valor: (f: VistaImprimibleOut['reuniones'][number]) => string | null },
): string {
  const activos = puestos.filter((p) => datos.puestos_activos.includes(p));
  const unico = (p: string) => {
    const par = p.replace(/_1$/, '_2');
    return par !== p && !datos.puestos_activos.includes(par) ? ROTULO_UNICO[p] : undefined;
  };
  const columnas: Columna[] = [
    { titulo: 'Fecha', ancho: '17%', clase: 'c-fecha' },
    { titulo: 'Día', ancho: '11%', clase: 'c-dia' },
    ...(extra ? [{ titulo: extra.titulo }] : []),
    ...activos.map((p) => ({ titulo: unico(p) ?? ROTULOS[p] ?? p })),
  ];
  const filas = datos.reuniones.map((r): Fila => r.sin_reunion
    ? filaSinReunion([esc(fechaLarga(r.fecha)), esc(r.dia_semana)], r.motivo)
    : [
    esc(fechaLarga(r.fecha)),
    esc(r.dia_semana),
    ...(extra ? [celda(extra.valor(r))] : []),
    ...activos.map((p) => celda(r.puestos[p])),
  ]);
  return tabla(seccion, titulo, columnas, filas, 'Sin reuniones este mes.');
}

function tablaFinSemana(
  titulo: string, filas: VistaImprimibleOut['fin_semana'], vacio: string,
): string {
  return tabla(
    'fin_semana',
    titulo,
    [{ titulo: 'Fecha', ancho: '17%', clase: 'c-fecha' }, { titulo: 'Día', ancho: '11%', clase: 'c-dia' }, { titulo: 'Presidente' }, { titulo: 'Lector' }],
    filas.map((f): Fila => f.sin_reunion
      ? filaSinReunion([esc(fechaLarga(f.fecha)), esc(diaSemana(f.fecha))], f.motivo)
      : [esc(fechaLarga(f.fecha)), esc(diaSemana(f.fecha)), celda(f.presidente), celda(f.lector)]),
    vacio,
  );
}

function tablaDiscursos(titulo: string, discursos: FilaDiscursoImpresion[]): string {
  return tabla(
    'discursos',
    titulo,
    [
      { titulo: 'Fecha', ancho: '14%', clase: 'c-fecha' },
      { titulo: 'Discurso público', ancho: '38%' },
      { titulo: 'Orador', ancho: '17%' },
      { titulo: 'Congregación', ancho: '16%' },
      { titulo: 'Hospitalidad', ancho: '15%' },
    ],
    discursos.map((d): Fila => d.sin_reunion
      ? filaSinReunion([esc(fechaLarga(d.fecha))], d.motivo)
      : [
      esc(fechaLarga(d.fecha)),
      celda(d.titulo),
      celda(d.orador),
      celda(d.congregacion),
      celda(d.hospitalidad),
    ]),
    'Sin discursos programados.',
  );
}

/**
 * El color de cada tabla es lo único que se elige: de él se derivan, como en
 * la pantalla de Logística, el encabezado (el tono oscurecido, o un velo claro
 * con `encabezado_suave`), el título de la sección y su barra, las fechas, el
 * velo de las filas alternas y el borde. Se redefine --acento y compañía dentro
 * de cada sección, así el resto del CSS no sabe de colores concretos.
 */
function coloresTablas(e: EstiloImpresion): string {
  const claves = Object.keys(e.colores_tablas) as Seccion[];
  const tintas = claves.map((k) => tintaSeccion(e.colores_tablas[k]));
  const n = tintas.length;
  // El acento de la cabecera reúne los colores de todas las tablas: une la
  // cabecera con el resto de la hoja en vez de competir con ella.
  const tira = `
    body header::after {
      width: 120px;
      height: 4px;
      bottom: -2.5px;
      margin-left: -60px;
      background: linear-gradient(90deg, ${tintas.map((t, i) => `${t} ${(i * 100) / n}% ${((i + 1) * 100) / n}%`).join(', ')});
    }`;
  return tira + claves.map((k) => {
    const color = e.colores_tablas[k];
    const tinta = tintaSeccion(color);
    return `
    .seccion[data-seccion="${k}"] {
      --acento: ${tinta};
      --enc-fondo: ${e.encabezado_suave ? `color-mix(in oklch, ${color} 13%, white)` : tinta};
      --enc-texto: ${e.encabezado_suave ? tinta : '#ffffff'};
      --alterna: color-mix(in oklch, ${color} 9%, white);
      --borde: color-mix(in oklch, ${color} 30%, white);
    }`;
  }).join('');
}

/** El CSS de la hoja, a partir del estilo guardado. */
function css(e: EstiloImpresion, origen: string): string {
  const papel = PAPEL_MM[e.tamano_pagina];
  const size = `${e.tamano_pagina === 'carta' ? 'letter' : 'A4'} ${e.orientacion === 'vertical' ? 'portrait' : 'landscape'}`;
  const anchoMm = e.orientacion === 'vertical' ? papel.ancho : papel.alto;
  return `
    @font-face {
      font-family: 'Manrope';
      font-weight: 400 800;
      font-display: block;
      src: url('${origen}/fonts/manrope-latin.woff2') format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122;
    }
    @font-face {
      font-family: 'Manrope';
      font-weight: 400 800;
      font-display: block;
      src: url('${origen}/fonts/manrope-latin-ext.woff2') format('woff2');
      unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1EFF;
    }
    @page { size: ${size}; margin: ${e.margen_pagina}mm; }
    :root {
      --titulo: ${e.color_titulo};
      --texto: ${e.color_texto};
      --sub: color-mix(in srgb, ${e.color_titulo} 68%, white);
      --linea-cab: color-mix(in srgb, ${e.color_titulo} 16%, white);
      --pad: ${e.padding_vertical}px ${e.padding_horizontal}px;
      /* Valores de reserva fuera de una sección. */
      --acento: ${e.color_titulo};
      --enc-fondo: ${e.color_titulo};
      --enc-texto: #ffffff;
      --alterna: color-mix(in srgb, ${e.color_titulo} 6%, white);
      --borde: color-mix(in srgb, ${e.color_titulo} 22%, white);
    }${coloresTablas(e)}
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      background: #fff;
      color: var(--texto);
      font-family: 'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-font-smoothing: antialiased;
    }
    /* En pantalla la hoja simula el papel: mismo ancho y mismo margen que
       pondrá la impresora con @page. Al imprimir, el margen lo pone @page. */
    @media screen {
      body { width: ${anchoMm}mm; padding: ${e.margen_pagina}mm; }
    }
    /* ── Cabecera de la hoja ──
       Centrada, con un filete fino y un acento corto en el color de la línea
       de sección: marca sin pesar, como un membrete. */
    header {
      position: relative;
      text-align: center;
      padding-bottom: 7px;
      border-bottom: 1px solid var(--linea-cab);
      margin-bottom: ${Math.max(e.espacio_secciones, 4) + 2}px;
    }
    header::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -2px;
      width: 56px;
      height: 3px;
      margin-left: -28px;
      border-radius: 3px;
      background: var(--titulo);
    }
    header h1 {
      margin: 0;
      color: var(--titulo);
      font-size: ${e.tam_titulo}pt;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      line-height: 1.15;
    }
    header p {
      margin: 4px 0 0;
      font-size: ${Math.max(e.tam_titulo * 0.58, 6)}pt;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--sub);
    }
    header.nueva-hoja { break-before: page; page-break-before: always; }
    @media screen { header.nueva-hoja { margin-top: ${Math.max(e.espacio_secciones, 8) * 3}px; } }

    /* ── Secciones ── */
    .seccion { margin-top: ${e.espacio_secciones}px; break-inside: avoid; page-break-inside: avoid; }
    .seccion h2 {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 5px;
      padding: 1px 0;
      font-size: ${e.tam_seccion}pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--acento);
    }
    /* Barra de acento: identifica la sección sin un bloque de color entero. */
    .seccion h2::before {
      content: '';
      flex: none;
      width: 3px;
      height: 1.05em;
      border-radius: 2px;
      background: var(--acento);
    }

    /* ── Tablas ──
       Borde exterior redondeado, filetes horizontales y separadores
       verticales tenues: se sigue la fila con el ojo sin rejilla pesada. */
    table {
      width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid var(--borde);
      border-radius: 7px;
      overflow: hidden;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      padding: var(--pad);
      text-align: left;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    th {
      background: var(--enc-fondo);
      color: var(--enc-texto);
      font-size: ${e.tam_encabezado}pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding-top: calc(${e.padding_vertical}px + 1.5px);
      padding-bottom: calc(${e.padding_vertical}px + 1.5px);
      border-bottom: 1px solid var(--borde);
    }
    th + th { border-left: 1px solid color-mix(in srgb, var(--enc-texto) 18%, transparent); }
    td {
      font-size: ${e.tam_celda}pt;
      font-weight: 500;
      line-height: 1.3;
      border-top: 1px solid color-mix(in srgb, var(--borde) 70%, transparent);
    }
    tbody tr:first-child td { border-top: 0; }
    td + td { border-left: 1px solid color-mix(in srgb, var(--borde) 45%, transparent); }
    tbody tr:nth-child(even) td { background: var(--alterna); }
    /* Columna de fecha: lo primero que se busca en la hoja. */
    td.c-fecha {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--acento);
    }
    td.c-dia { color: color-mix(in srgb, var(--texto) 62%, transparent); font-weight: 600; }
    .vacio { color: color-mix(in srgb, var(--texto) 30%, transparent); }

    /* Semana sin reunión: el motivo ocupa el resto de la fila y se lee de un
       vistazo, sin parecer una celda vacía por olvido. */
    tr.sin-reunion td:last-child {
      font-style: italic;
      color: var(--acento);
      background: color-mix(in srgb, var(--acento) 7%, #fff);
    }
    .sin-reunion-etq {
      display: inline-block;
      margin-right: 6px;
      padding: 0 6px;
      border: 1px solid color-mix(in srgb, var(--acento) 55%, transparent);
      border-radius: 999px;
      font-style: normal;
      font-weight: 800;
      font-size: 0.8em;
      line-height: 1.6;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--acento);
      background: #fff;
    }
    .sin-filas { text-align: center; font-style: italic; color: color-mix(in srgb, var(--texto) 55%, transparent); }
  `;
}

/**
 * Documento completo de la hoja.
 *
 * `origen` es `location.origin`: el iframe se carga con `srcdoc` y ahí una URL
 * relativa no resuelve contra la app, así que la fuente necesita la absoluta.
 */
export function renderDocumentoImpresion(
  datos: VistaImprimibleOut, estilo: EstiloImpresion, origen: string,
): string {
  const s = estilo.secciones;
  // Dos hojas, como el programa que se reparte: la 1.ª con los puestos de
  // servicio y la 2.ª con el fin de semana y los discursos públicos.
  const partes: string[] = [];
  const segunda: string[] = [];

  if (s.acomodadores) {
    partes.push(tablaPuestos('acomodadores', 'Acomodadores y vigilancia', datos,
      ['acomodador_1', 'acomodador_2', 'vigilancia_1', 'vigilancia_2']));
  }
  if (s.microfono) {
    partes.push(tablaPuestos('microfono', 'Micrófono y plataforma', datos,
      ['microfono_1', 'microfono_2', 'plataforma']));
  }
  if (s.aseo_audio_video) {
    partes.push(tablaPuestos('aseo_audio_video', 'Aseo del salón, audio y video', datos, ['audio', 'video'],
      { titulo: 'Aseo del salón', valor: (r) => r.aseo }));
  }
  // Con el mes siguiente, la 2.ª hoja agrupa por tipo de tabla: los fines
  // de semana de ambos meses juntos y después los discursos de ambos meses,
  // para comparar de un vistazo en vez de saltar entre tablas intercaladas.
  const sig = datos.mes_siguiente;
  const etiqueta = (ano: number, mes: number) => (sig ? ` · ${nombreMes(ano, mes)}` : '');
  if (s.fin_semana) {
    // Sin fin de semana en el mes impreso no hay nada que listar; en el
    // siguiente sí se avisa, porque la tabla vacía significa "aún no publicado".
    if (datos.fin_semana.length) {
      segunda.push(tablaFinSemana(
        `Reunión del fin de semana${etiqueta(datos.ano, datos.mes)}`,
        datos.fin_semana, 'Sin reuniones de fin de semana.',
      ));
    }
    if (sig) {
      segunda.push(tablaFinSemana(
        `Reunión del fin de semana${etiqueta(sig.ano, sig.mes)}`,
        sig.fin_semana, `El programa de ${nombreMes(sig.ano, sig.mes)} aún no está publicado.`,
      ));
    }
  }
  if (s.discursos) {
    segunda.push(tablaDiscursos(
      sig ? `Discursos públicos${etiqueta(datos.ano, datos.mes)}` : 'Listado de discursos públicos',
      datos.discursos,
    ));
    if (sig) {
      segunda.push(tablaDiscursos(`Discursos públicos${etiqueta(sig.ano, sig.mes)}`, sig.discursos));
    }
  }

  const titulo = `${estilo.titulo} · ${nombreMes(datos.ano, datos.mes)}`;
  const subtitulo = (conSiguiente: boolean) => {
    const meses = conSiguiente && sig
      ? (sig.ano === datos.ano
        ? `Meses de ${MESES_ES[datos.mes - 1]} y ${MESES_ES[sig.mes - 1]} ${datos.ano}`
        : `Meses de ${nombreMes(datos.ano, datos.mes)} y ${nombreMes(sig.ano, sig.mes)}`)
      : `Mes de ${nombreMes(datos.ano, datos.mes)}`;
    return [datos.nombre_congregacion, meses].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');
  };
  const cabecera = (clase = '', conSiguiente = false) =>
    `<header${clase ? ` class="${clase}"` : ''}><h1>${esc(estilo.titulo)}</h1><p>${subtitulo(conSiguiente)}</p></header>`;

  // Sin la 1.ª hoja, la cabecera principal ya es la de la 2.ª.
  const soloSegunda = !partes.length && segunda.length > 0;
  if (partes.length && segunda.length) {
    // La 2.ª hoja repite la cabecera: suelta, también se entiende de qué mes es.
    partes.push(cabecera('nueva-hoja', true), ...segunda);
  } else {
    partes.push(...segunda);
  }
  if (!partes.length) {
    partes.push('<p class="sin-filas" style="margin-top:24px">No hay secciones seleccionadas.</p>');
  }

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(titulo)}</title>
<style>${css(estilo, origen)}</style>
</head>
<body>
  ${cabecera('', soloSegunda)}
  ${partes.join('\n')}
</body>
</html>`;
}

// ── Contraste ────────────────────────────────────────────────

function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** Relación de contraste WCAG entre dos colores hex (#rrggbb). */
export function contraste(a: string, b: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return 21;
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * El tono del encabezado (el color de la tabla oscurecido un 20 %) como hex,
 * solo para avisar de contraste: el CSS lo calcula con color-mix en oklch. En
 * sRGB oscurece algo menos, así que el aviso es conservador.
 */
export function aproximarTinta(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * 0.8).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

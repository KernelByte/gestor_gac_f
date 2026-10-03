/**
 * Estudio de impresión de Logística.
 *
 * El estilo se guarda por congregación (gac.logistica_estilo_impresion) y se
 * valida en el backend (`EstiloImpresion` de logistica_schemas.py). Estos
 * tipos y rangos lo reflejan: si cambian allí, cambian aquí.
 */

export type TamanoPaginaImpresion = 'carta' | 'a4';
export type OrientacionImpresion = 'vertical' | 'horizontal';

export interface SeccionesImpresion {
  acomodadores: boolean;
  microfono: boolean;
  aseo_audio_video: boolean;
  fin_semana: boolean;
  discursos: boolean;
}

export type ClaveTabla = keyof SeccionesImpresion;
export type ColoresTablas = Record<ClaveTabla, string>;

export interface EstiloImpresion {
  titulo: string;

  /** El color de cada tabla; de él se deriva todo lo demás (ver `tintaSeccion`). */
  colores_tablas: ColoresTablas;
  color_titulo: string;
  color_texto: string;
  /** Encabezado claro en vez de relleno sólido: gasta mucha menos tinta. */
  encabezado_suave: boolean;

  tam_titulo: number;
  tam_seccion: number;
  tam_encabezado: number;
  tam_celda: number;

  padding_vertical: number;
  padding_horizontal: number;
  espacio_secciones: number;

  margen_pagina: number;
  tamano_pagina: TamanoPaginaImpresion;
  orientacion: OrientacionImpresion;

  secciones: SeccionesImpresion;
  /** Añade a la 2.ª hoja el fin de semana y los discursos del mes siguiente. */
  incluir_mes_siguiente: boolean;
}

export interface EstiloImpresionOut {
  estilo: EstiloImpresion;
  por_defecto: boolean;
  actualizado_en: string | null;
}

export interface FilaReunionImpresion {
  fecha: string;
  dia_semana: string;
  tipo_reunion: 'entre_semana' | 'fin_semana' | string;
  puestos: Record<string, string | null>;
  aseo: string | null;
  /** Semana sin reunión (asamblea, congreso, Conmemoración) y su motivo. */
  sin_reunion: boolean;
  motivo: string | null;
}

export interface FilaFinSemanaImpresion {
  fecha: string;
  presidente: string | null;
  lector: string | null;
  /** Semana sin reunión (asamblea, congreso, Conmemoración) y su motivo. */
  sin_reunion: boolean;
  motivo: string | null;
}

export interface FilaDiscursoImpresion {
  fecha: string;
  titulo: string | null;
  orador: string | null;
  congregacion: string | null;
  hospitalidad: string | null;
  /** Semana sin reunión (asamblea, congreso, Conmemoración) y su motivo. */
  sin_reunion: boolean;
  motivo: string | null;
}

export interface VistaImprimibleOut {
  nombre_congregacion: string;
  ano: number;
  mes: number;
  estado: string;
  publicado_en: string | null;
  puestos_activos: string[];
  reuniones: FilaReunionImpresion[];
  fin_semana: FilaFinSemanaImpresion[];
  discursos: FilaDiscursoImpresion[];
  mes_siguiente: {
    ano: number;
    mes: number;
    fin_semana: FilaFinSemanaImpresion[];
    discursos: FilaDiscursoImpresion[];
  } | null;
}

/**
 * Los matices de cada sección en la pantalla de Logística (SECCION_COLOR de
 * reuniones-logistica.component.ts), refinados para papel: sin la saturación
 * eléctrica de pantalla y con un punto de gris, que los hace ver formales.
 *
 *   azul cielo → azul acero   esmeralda → jade
 *   azul de marca → azul real  verde azulado → verde mar
 *
 * Acomodadores y micrófono comparten color (los dos puestos que van juntos en
 * la sala); la pantalla no tiene colores para la 2.ª hoja, así que se toman el
 * azul de marca y el verde azulado que la app usa para el orador.
 */
export const COLORES_TABLAS_GAC: ColoresTablas = {
  acomodadores: '#1e78b4',
  microfono: '#1e78b4',
  aseo_audio_video: '#1f9a73',
  fin_semana: '#2f63d4',
  discursos: '#1d9a94',
};

/** Mismos valores que `EstiloImpresion()` del backend. */
export const ESTILO_IMPRESION_DEFECTO: EstiloImpresion = {
  titulo: 'Asignaciones teocráticas',
  colores_tablas: { ...COLORES_TABLAS_GAC },
  color_titulo: '#1f2a44',
  color_texto: '#1a2233',
  encabezado_suave: false,
  tam_titulo: 13,
  tam_seccion: 8,
  tam_encabezado: 7.5,
  tam_celda: 8.5,
  padding_vertical: 4,
  padding_horizontal: 6,
  espacio_secciones: 36,
  margen_pagina: 8,
  tamano_pagina: 'carta',
  orientacion: 'vertical',
  secciones: {
    acomodadores: true,
    microfono: true,
    aseo_audio_video: true,
    fin_semana: true,
    discursos: true,
  },
  incluir_mes_siguiente: false,
};

/** Los dos colores de texto que se pueden elegir (además del de cada tabla). */
export const CAMPOS_TEXTO_COLOR: { clave: 'color_titulo' | 'color_texto'; label: string; ayuda: string }[] = [
  { clave: 'color_titulo', label: 'Título de la hoja', ayuda: 'Asignaciones teocráticas y el mes' },
  { clave: 'color_texto', label: 'Texto de las tablas', ayuda: 'Nombres y datos' },
];

export type ClaveNumero =
  | 'tam_titulo' | 'tam_seccion' | 'tam_encabezado' | 'tam_celda'
  | 'padding_vertical' | 'padding_horizontal' | 'espacio_secciones'
  | 'margen_pagina';

export interface CampoNumero {
  clave: ClaveNumero;
  label: string;
  unidad: 'pt' | 'px' | 'mm';
  min: number;
  max: number;
  paso: number;
}

export const CAMPOS_TEXTO: CampoNumero[] = [
  { clave: 'tam_titulo', label: 'Título principal', unidad: 'pt', min: 6, max: 24, paso: 0.5 },
  { clave: 'tam_seccion', label: 'Títulos de sección', unidad: 'pt', min: 6, max: 24, paso: 0.5 },
  { clave: 'tam_encabezado', label: 'Encabezados de tabla', unidad: 'pt', min: 6, max: 24, paso: 0.5 },
  { clave: 'tam_celda', label: 'Texto de celdas', unidad: 'pt', min: 6, max: 24, paso: 0.5 },
];

export const CAMPOS_ESPACIADO: CampoNumero[] = [
  { clave: 'padding_vertical', label: 'Alto de fila', unidad: 'px', min: 0, max: 24, paso: 1 },
  { clave: 'padding_horizontal', label: 'Margen en celda', unidad: 'px', min: 0, max: 24, paso: 1 },
  { clave: 'espacio_secciones', label: 'Entre secciones', unidad: 'px', min: 0, max: 48, paso: 1 },
  { clave: 'margen_pagina', label: 'Margen de página', unidad: 'mm', min: 0, max: 25, paso: 1 },
];

export const SECCIONES_IMPRESION: { clave: keyof SeccionesImpresion; label: string }[] = [
  { clave: 'acomodadores', label: 'Acomodadores y vigilancia' },
  { clave: 'microfono', label: 'Micrófono y plataforma' },
  { clave: 'aseo_audio_video', label: 'Aseo, audio y video' },
  { clave: 'fin_semana', label: 'Presidente y lector' },
  { clave: 'discursos', label: 'Discursos públicos' },
];

export interface PresetImpresion {
  id: string;
  nombre: string;
  descripcion: string;
  /** El que se usa sin estilo guardado (y al restablecer). */
  predeterminado?: boolean;
  colores_tablas: ColoresTablas;
  color_titulo: string;
  color_texto: string;
  encabezado_suave?: boolean;
}

const todas = (c: string): ColoresTablas => ({
  acomodadores: c, microfono: c, aseo_audio_video: c, fin_semana: c, discursos: c,
});

/**
 * Estilos rápidos. Fijan los colores de las cinco tablas y de los dos textos;
 * después se pueden retocar tabla por tabla. Tamaños y página son decisiones de
 * quien imprime (cuánto cabe, qué papel tiene), no del aspecto.
 */
export const PRESETS_IMPRESION: PresetImpresion[] = [
  {
    id: 'gac',
    nombre: 'GAC',
    descripcion: 'Colores de la app',
    predeterminado: true,
    colores_tablas: { ...COLORES_TABLAS_GAC },
    color_titulo: '#1f2a44',
    color_texto: '#1a2233',
  },
  {
    id: 'clasico',
    nombre: 'Azul clásico',
    descripcion: 'Sobrio y legible',
    colores_tablas: todas('#26488a'),
    color_titulo: '#1e3a6e',
    color_texto: '#111827',
  },
  {
    id: 'oceano',
    nombre: 'Océano',
    descripcion: 'Azul profundo y fresco',
    colores_tablas: todas('#1b7aa6'),
    color_titulo: '#0c4a6e',
    color_texto: '#0f172a',
  },
  {
    id: 'verde',
    nombre: 'Verde azulado',
    descripcion: 'Natural y sereno',
    colores_tablas: todas('#1f8a7f'),
    color_titulo: '#115e59',
    color_texto: '#111827',
  },
  {
    id: 'grafito',
    nombre: 'Grafito',
    descripcion: 'Neutro y ejecutivo',
    colores_tablas: todas('#4b5563'),
    color_titulo: '#111827',
    color_texto: '#111827',
  },
  {
    id: 'tinta',
    nombre: 'Ahorro de tinta',
    descripcion: 'Encabezados claros',
    colores_tablas: todas('#374151'),
    color_titulo: '#111111',
    color_texto: '#111111',
    encabezado_suave: true,
  },
];

/** Tamaño de la hoja en mm (ancho × alto en vertical). */
export const PAPEL_MM: Record<TamanoPaginaImpresion, { ancho: number; alto: number; label: string }> = {
  carta: { ancho: 215.9, alto: 279.4, label: 'Carta' },
  a4: { ancho: 210, alto: 297, label: 'A4' },
};

/**
 * El tono oscurecido un 20 %, en la línea de `--sec-ink` de la pantalla de
 * Logística (que oscurece un 25 %): cian y esmeralda al 100 % se quedan en
 * ~3.5:1 sobre blanco, por debajo del mínimo, y en papel se lavan aún más. Con
 * 20 % el encabezado conserva más color y sigue pasando de 5.8:1 con texto
 * blanco. Es el color del encabezado, el título de la sección y las fechas.
 */
export const tintaSeccion = (color: string): string =>
  `color-mix(in oklch, ${color} 80%, black 20%)`;

export interface Territorio {
  id_territorio: number;
  id_congregacion?: number;
  codigo: string;
  nombre: string;
  estado_territorio: string;
  notas?: string;
  id_sector?: number | null;
  coordenada?: GeoJSONGeometry | null;
  /** Solo en la respuesta de guardar: el dibujo se recortó al límite de la congregación. */
  ajustado_al_limite?: boolean;
}

/** Barrio o sector que agrupa tarjetas. */
export interface Sector {
  id_sector: number;
  id_congregacion: number;
  nombre: string;
  color?: string | null;
  notas?: string | null;
  coordenada?: GeoJSONGeometry | null;
  tarjetas_count: number;
  /** Solo en la respuesta de guardar: el dibujo se recortó al límite de la congregación. */
  ajustado_al_limite?: boolean;
}

export interface SectoresRespuesta {
  sectores: Sector[];
  sin_sector: number;
}

export interface TarjetaSugerida {
  id_territorio: number;
  codigo: string;
  nombre: string;
  id_sector_actual: number | null;
  sector_actual: string | null;
}

/** Territorio de la congregación tal como lo entrega JW en su KML. */
export interface UnidadCongregacion {
  id_unidad?: number;
  nombre: string;
  tipo?: string | null;
  idioma?: string | null;
  ultima_actualizacion?: string | null;
  limite_norte?: string | null;
  limite_este?: string | null;
  limite_sur?: string | null;
  limite_oeste?: string | null;
  archivo_origen?: string | null;
  coordenada?: GeoJSONGeometry | null;
}

/** Colores que se ofrecen para los sectores (distintos a los de estado de las tarjetas). */
export const COLORES_SECTOR = ['#0ea5e9', '#14b8a6', '#8b5cf6', '#f59e0b', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

export interface Manzana {
  id_manzana: number;
  id_territorio: number;
  numero_manzana: string;
  coordenada?: GeoJSONGeometry | null;
  /** manual | calles (OpenStreetMap) | ia (marcada por la IA: "revisar"). */
  origen?: 'manual' | 'calles' | 'ia';
}

export interface Vivienda {
  id_vivienda: number;
  id_manzana: number;
  direccion?: string;
  numero?: string;
  edificio?: string;
  apartamento?: string;
  coordenadas?: GeoJSONGeometry | null;
  etiqueta?: string;
  no_visitar?: boolean;
  /** Tipo de aviso de la tarjeta; 'otro' son las direcciones antiguas sin clasificar. */
  tipo_aviso?: TipoAviso;
  /** Detalle del aviso (nombre histórico): «Perro bravo», «Lo pidió el dueño»… */
  motivo_no_visitar?: string | null;
  fecha_no_visitar?: string | null;
  fecha_revision?: string | null;
  /** "No visitar" sin confirmar desde hace más de un año. */
  por_revisar?: boolean;
  idioma?: string;
  notas?: string;
}

export type TipoAviso = 'no_visitar' | 'cuidado' | 'acceso' | 'horario' | 'otro';

/** Los avisos que se pueden crear (`otro` solo existe en datos antiguos). */
export const TIPOS_AVISO: ReadonlyArray<{
  id: Exclude<TipoAviso, 'otro'>;
  etiqueta: string;
  ayuda: string;
  ejemplo: string;
  /** Clases del distintivo (borde, fondo y texto), en claro y oscuro. */
  chip: string;
  /** Color para la tarjeta impresa (no usa Tailwind). */
  color: string;
}> = [
  { id: 'no_visitar', etiqueta: 'No visitar', ayuda: 'No se toca la puerta. Se confirma cada año.', ejemplo: 'Ej: Lo pidió el dueño',
    chip: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300', color: '#b91c1c' },
  { id: 'cuidado', etiqueta: 'Cuidado', ayuda: 'Perro bravo o zona insegura: ir acompañado.', ejemplo: 'Ej: Perro bravo en el patio',
    chip: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200', color: '#b45309' },
  { id: 'acceso', etiqueta: 'Acceso especial', ayuda: 'Conjunto cerrado, portero o timbre dañado.', ejemplo: 'Ej: Pedir permiso al portero',
    chip: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-900/20 dark:text-sky-200', color: '#0369a1' },
  { id: 'horario', etiqueta: 'Horario', ayuda: 'Solo atienden a ciertas horas o días.', ejemplo: 'Ej: Solo abren en la tarde',
    chip: 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800/60 dark:bg-violet-900/20 dark:text-violet-200', color: '#6d28d9' },
];

export function tipoAviso(id: TipoAviso | undefined | null) {
  return TIPOS_AVISO.find((t) => t.id === id) ?? null;
}

/** Vivienda tal como la devuelve GET /territorios/{id}/viviendas. */
export interface ViviendaDeTerritorio extends Vivienda {
  numero_manzana?: string | null;
}

/** Texto de una dirección para listas: "Calle 5 #12, Edif. Sol, Apto 3". */
export function textoDireccion(v: Vivienda): string {
  const partes = [
    [v.direccion, v.numero ? `#${v.numero}` : ''].filter(Boolean).join(' '),
    v.edificio ? `Edif. ${v.edificio}` : '',
    v.apartamento ? `Apto ${v.apartamento}` : '',
  ].filter(Boolean);
  return partes.join(', ') || 'Sin dirección';
}

export interface CoberturaManzana {
  id_cobertura_manzana: number;
  id_manzana: number;
  id_periodo?: number;
  estado?: string;
  porcentaje?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  id_publicador_cobertura?: number;
  notas?: string;
}

export interface Punto {
  id_punto: number;
  id_territorio: number;
  nombre?: string;
  tipo?: string; // 'Salida' | 'Lugar' | 'Otro'
  coordenadas?: GeoJSONGeometry | null;
  notas?: string;
}

export interface AsignacionTerritorio {
  id_asignacion: number;
  id_territorio: number;
  id_publicador: number;
  nombre_publicador?: string | null;
  fecha_asignacion: string;
  fecha_devolucion?: string | null;
  notas?: string | null;
  activa: boolean;
  /** Sin manzanas elegidas = la tarjeta completa. */
  completa?: boolean;
  ids_manzanas?: number[];
  numeros_manzanas?: string[];
}

/** Qué manzanas de la tarjeta están libres y quién tiene las demás. */
export interface OcupacionManzanas {
  hay_completa: boolean;
  manzanas: { id_manzana: number; numero: string; libre: boolean; asignada_a: { id_asignacion: number; nombre_publicador: string } | null }[];
}

export interface TerritorioStats {
  manzanas_count: number;
  viviendas_count: number;
  cobertura_promedio: number;
}

export interface SalidaPredicacion {
  id_salida: number;
  id_territorio: number;
  fecha_salida: string;
  id_capitan?: number | null;
  nombre_capitan?: string | null;
  id_punto_salida?: number | null;
  nombre_punto_salida?: string | null;
  /** Salida del programa (/horarios) de la que viene, si se registró desde ella. */
  id_horario?: number | null;
  notas?: string | null;
  manzanas_predicadas: number;
}

export interface CicloTerritorio {
  id_ciclo: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  completado: boolean;
  cierre_manual: boolean;
}

export interface ProgresoTerritorio {
  total_manzanas: number;
  manzanas_predicadas: number;
  manzanas_pendientes: number;
  porcentaje: number;
  ciclo?: CicloTerritorio | null;
}

/** Una fila de GET /territorios/resumen (alertas y orden por "más tiempo sin trabajar"). */
/** Qué le falta a la congregación para tener el territorio completo (sin tarjetas inactivas). */
export interface ProgresoConfiguracion {
  tiene_limite: boolean;
  barrios: number;
  barrios_sin_dibujar: number;
  tarjetas: number;
  tarjetas_con_limite: number;
  tarjetas_con_manzanas: number;
  primera_sin_limite: number | null;
  primera_sin_manzanas: number | null;
  manzanas_total: number;
  /** Cada tarjeta continúa donde terminó la anterior (1…N sin huecos ni cruces). */
  numeracion_en_orden: boolean;
}

export interface ResumenTerritorio {
  id_territorio: number;
  ultima_salida: string | null;
  dias_sin_trabajar: number | null;
  ciclo: CicloTerritorio | null;
  en_curso: boolean;
  porcentaje: number;
  ultimo_completado: string | null;
  asignado_a: string | null;
}

export interface RegistroS13Ciclo {
  /** «publicador»: se le asignó la tarjeta a una persona; «grupo»: una vuelta trabajada en las salidas. */
  tipo: 'publicador' | 'grupo';
  /** Fecha en que se asignó (publicador) o primera salida de la vuelta (grupo). */
  fecha_inicio: string;
  /** Fecha en que se completó: la devolución, o cuando quedó predicada toda la vuelta. */
  fecha_fin: string | null;
  asignado_a: string | null;
  capitanes: string[];
  /** Solo algunas manzanas de la tarjeta (asignación parcial). */
  parcial: boolean;
  /** La vuelta se dio por terminada a mano. */
  cierre_manual?: boolean;
}

export interface RegistroS13Territorio {
  /** Fecha más reciente en que la tarjeta quedó completa, hasta el final del año que se muestra. */
  ultima_completada: string | null;
  id_territorio: number;
  codigo: string;
  nombre: string;
  completado_antes: string | null;
  ciclos: RegistroS13Ciclo[];
}

export interface RegistroS13 {
  anio_servicio: number;
  desde: string;
  hasta: string;
  territorios: RegistroS13Territorio[];
}

/** "hace 3 meses" / "hoy" / "Nunca trabajado", para listas y selectores. */
export function textoDiasSinTrabajar(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return 'Nunca trabajado';
  if (dias <= 0) return 'hoy';
  if (dias < 30) return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  if (meses >= 12) return 'hace más de un año';
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
}

export interface GeoJSONGeometry {
  type: string;
  coordinates: any;
}

export interface GeoJSONFeature {
  type: 'Feature';
  id: number | string;
  properties: Record<string, any>;
  geometry: GeoJSONGeometry;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// ── Recorrido: orden de predicación y manzanas predicadas de toda la congregación ──
export type CriterioRecorrido = 'manzana' | 'tarjeta' | 'barrio';

export interface ConfigRecorrido {
  criterio: CriterioRecorrido;
  orden_barrios: number[];
  inicio: { id_manzana: number } | null;
  /** Cuántas manzanas se le sugieren a cada salida programada. */
  manzanas_por_salida: number;
}

/** Lo que le toca a una salida programada, según cómo va el recorrido. */
export interface SugerenciaSalida {
  origen: 'tarjeta' | 'barrio' | 'general';
  /** `a_medias`: se predicó solo una parte; le toca terminarla. */
  manzanas: Array<{ id_manzana: number; numero: string; codigo: string; a_medias?: boolean }>;
  aviso: string | null;
}

/** Una salida ya registrada (o una del programa que no se hizo), con lo que se predicó en cada tarjeta. */
export interface HistorialEntrada {
  tipo: 'salida' | 'no_salio';
  clave: string;
  fecha: string;
  hora: string | null;
  lugar: string | null;
  id_horario: number | null;
  capitan: string | null;
  tarjetas: Array<{ id_territorio: number; codigo: string; manzanas: Array<{ numero: string; a_medias: boolean; nota: string | null }> }>;
  completas: number;
  a_medias: number;
}

export interface HistorialRespuesta {
  entradas: HistorialEntrada[];
  hay_mas: boolean;
  resumen: { salidas: number; manzanas: number; a_medias: number; no_salio: number };
}

export interface PuntoSalidaOpcion {
  id_punto: number;
  nombre: string;
  id_territorio: number;
  codigo: string;
  id_sector: number | null;
}

export interface ManzanaRecorrido {
  id_manzana: number;
  numero: string;
  id_territorio: number;
  codigo: string;
  id_sector: number | null;
  barrio: string | null;
  /** «En Pausa» o «Inactivo» si la tarjeta está apartada: se ve en gris, sin lugar en el orden. */
  estado_tarjeta: string | null;
  /** Lugar en el orden del recorrido (1 = la primera); null si la tarjeta está apartada. */
  posicion: number | null;
  predicada: boolean;
  fecha_predicada: string | null;
  capitan: string | null;
  /** Predicada solo en parte (p. ej. por un lado): sigue pendiente. `nota` = lo que faltó. */
  parcial: { fecha: string | null; capitan: string | null; nota: string | null } | null;
  asignada_a: string | null;
  /** 1..10 en las próximas pendientes; null en las demás. */
  siguiente: number | null;
}

export interface RecorridoRespuesta {
  type: 'FeatureCollection';
  features: Array<GeoJSONFeature & { properties: ManzanaRecorrido }>;
  config: ConfigRecorrido;
  total: number;
  predicadas: number;
  /** Cuántas están a medias (cuentan como pendientes). */
  a_medias: number;
  siguiente_manzana: { id_manzana: number; numero: string; codigo: string } | null;
  barrios: Array<{ id_sector: number; nombre: string; color: string | null }>;
}

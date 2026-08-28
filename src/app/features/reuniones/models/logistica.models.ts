/** Cada cuánto cambia el grupo que hace el aseo del salón. */
export type AseoRotacion = 'reunion' | 'semana' | 'mes';

export interface GenerarLogisticaRequest {
  ano: number;
  mes: number;
  /** Ausente = usar la preferencia guardada de la congregación. */
  modo_aseo?: AseoRotacion;
}

export interface EditarLogisticaItemRequest {
  id_publicador: number | null;
}

export interface FechaTipoIn {
  fecha: string;
  tipo_reunion: string;
}

export interface EditarAseoRequest {
  /** Todas las fechas del bloque; una sola cuando la rotación es por reunión. */
  fechas: FechaTipoIn[];
  ids_grupo: number[];
}

export interface AseoPreferenciaOpcion {
  id: AseoRotacion;
  label: string;
  description: string;
}

export interface AseoPreferencia {
  key: string;
  value: AseoRotacion;
  default: AseoRotacion;
  label: string;
  description: string;
  options: AseoPreferenciaOpcion[];
}

export interface ConfiguracionAseoOut {
  preferencias: AseoPreferencia[];
  valores: Record<string, AseoRotacion>;
}

export interface ConfirmarLogisticaRequest {
  ano: number;
  mes: number;
}

export interface PublicadorBase {
  id_publicador: number;
  nombre_completo: string;
}

export interface LogisticaItemOut {
  id_logistica: number;
  fecha: string;
  tipo_reunion: string;
  puesto: string;
  publicador: PublicadorBase | null;
  confirmado: boolean;
  /** 'auto' = la puso el motor · 'manual' = la cambió una persona. */
  origen?: 'auto' | 'manual';
}

export interface GrupoBase {
  id_grupo: number;
  nombre_grupo: string;
}

export interface LogisticaAseoOut {
  id_logistica_aseo: number;
  fecha: string;
  tipo_reunion: string;
  grupo: GrupoBase;
  confirmado: boolean;
}

export interface FechaReunionOut {
  fecha: string;
  tipo_reunion: string;
  dia_semana: string;
}

/**
 * Tramo de fechas que comparte grupo de aseo. Lo arma el backend para que la
 * tabla y el PDF agrupen exactamente igual: una fila por reunión, por semana
 * del mes o una sola para todo el mes.
 */
export interface AseoBloqueOut {
  clave: string;
  indice: number;
  /** "Semana 2" / "Junio" / "09 Junio" */
  etiqueta: string;
  /** "09 – 13 Junio" */
  detalle: string;
  fechas: FechaReunionOut[];
  grupos: GrupoBase[];
  confirmado: boolean;
}

/**
 * Momentos por los que pasa un mes de logística.
 *
 * Antes solo existía el booleano `confirmado`, que no distinguía "guardado" de
 * "visible para la congregación" y dejaba el mes de solo lectura al confirmarlo.
 */
export type LogisticaEstado =
  | 'sin_generar'
  | 'borrador'
  | 'pendiente_revision'
  | 'cambios_sin_publicar'
  | 'publicado';

/**
 * Un puesto vacío que sí tiene a alguien capaz de cubrirlo.
 *
 * Se distingue del puesto vacío por falta de habilitados: aquel es una decisión
 * de configuración y no impide publicar; éste es un hueco real y sí lo impide.
 */
export interface ConflictoLogisticaItem {
  id_logistica: number;
  fecha: string;
  tipo_reunion: string;
  puesto: string;
  motivo: string;
}

/**
 * Una asignación ya guardada cuyo publicador tiene una ausencia registrada
 * que cubre esa fecha. No bloquea nada -solo se avisa en la celda-, a
 * diferencia de ConflictoLogisticaItem.
 */
export interface AusenciaLogisticaItem {
  id_logistica: number;
  fecha: string;
  tipo_reunion: string;
  puesto: string;
  id_publicador: number;
  motivo: string | null;
}

export interface LogisticaMesOut {
  ano: number;
  mes: number;
  id_congregacion: number;
  /** Se conserva para el PDF y la API pública. La pantalla usa `estado`. */
  confirmado: boolean;
  estado: LogisticaEstado;
  publicado_en: string | null;
  puede_descartar: boolean;
  /** Puestos vacíos que sí tienen a alguien capaz de cubrirlos. Bloquean publicar. */
  conflictos: number;
  /** Dónde están, para marcarlos en la tabla. */
  conflictos_detalle: ConflictoLogisticaItem[];
  /** Asignaciones ya guardadas cuyo publicador está de ausencia esa fecha. */
  ausencias_detalle: AusenciaLogisticaItem[];
  cobertura_total: number;
  cobertura_cubierta: number;
  fechas: FechaReunionOut[];
  asignaciones: LogisticaItemOut[];
  aseo: LogisticaAseoOut[];
  aseo_modo: AseoRotacion;
  aseo_bloques: AseoBloqueOut[];
}

export interface ConflictoParteOut {
  nombre_parte: string;
  tipo_reunion: string;
}

export interface ConflictoLogistica {
  tiene_conflicto: boolean;
  partes: ConflictoParteOut[];
}

export interface MesDisponible {
  ano: number;
  mes: number;
  estado?: LogisticaEstado;
}

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Permiso especial que habilita cada puesto, espejo de `_PUESTO_A_PERMISO`
 * en `logistica_service.py`.
 *
 * Se duplica aqui a proposito: el catalogo de puestos es una constante fija en
 * Python, no una tabla, y esta lista ya vive duplicada como PUESTOS_LABEL. Sirve
 * para saber que permiso activar cuando se asigna a alguien que no lo tiene.
 * Varios puestos comparten permiso (acomodador_1 y acomodador_2 -> acomodador).
 */
export const PUESTO_A_PERMISO: Record<string, string> = {
  acomodador_1: 'acomodador',
  acomodador_2: 'acomodador',
  vigilancia_1: 'vigilancia',
  vigilancia_2: 'vigilancia',
  microfono_1:  'microfono',
  microfono_2:  'microfono',
  plataforma:   'plataforma',
  audio:        'audio',
  video:        'video',
};

/** Nombre del permiso tal como aparece en Configuracion, para los mensajes. */
export const PERMISO_LABEL: Record<string, string> = {
  acomodador: 'Acomodador',
  vigilancia: 'Vigilancia',
  microfono:  'Micrófono',
  plataforma: 'Plataforma',
  audio:      'Audio',
  video:      'Video',
};

// ── Enlace público ──────────────────────────────────────────────────────

export interface EnlacePublicoLogistica {
  token: string;
  url_publica: string;
  fecha_expiracion: string;
  contador_accesos: number;
}

export interface GenerarEnlaceRequest {
  ano: number;
  mes: number;
  /** Ausente = 7 días después del fin de mes (default del servicio). */
  fecha_expiracion?: string | null;
}

export interface ActualizarEnlaceRequest {
  ano: number;
  mes: number;
  fecha_expiracion: string;
}

/** Lo que ve un publicador sin login al abrir el enlace público del mes. */
export interface LogisticaPublicoOut {
  nombre_congregacion: string;
  ano: number;
  mes: number;
  fechas: FechaReunionOut[];
  asignaciones: LogisticaItemOut[];
  aseo: LogisticaAseoOut[];
  expira_en: string;
}

// ── Opciones de impresión ───────────────────────────────────────────────

export type TamanoPagina = 'carta' | 'a4';
export type OrientacionPagina = 'vertical' | 'horizontal';

export interface OpcionesPdfLogistica {
  incluir_discursos?: boolean;
  tamano_pagina?: TamanoPagina;
  orientacion?: OrientacionPagina;
}

/** Reparto del mes, para comparar el antes y el después de un rebalanceo. */
export interface RebalanceoDispersion {
  min: number;
  max: number;
  brecha: number;
  promedio: number;
  /** Lo que de verdad dice si el reparto mejoró: ver `_dispersion` en el backend. */
  desviacion: number;
  personas: number;
}

export interface RebalanceoCambio {
  id_logistica: number;
  fecha: string;
  puesto: string;
  de: PublicadorBase;
  a: PublicadorBase;
}

export interface RebalanceoPropuesta {
  cambios: RebalanceoCambio[];
  antes: RebalanceoDispersion;
  despues: RebalanceoDispersion;
  aplicado: boolean;
  /** Casillas intocables por estar puestas a mano. */
  protegidas_manual: number;
}

export const PUESTOS_LABEL: Record<string, string> = {
  acomodador_1: 'Acomodador 1',
  acomodador_2: 'Acomodador 2',
  vigilancia_1: 'Vigilancia 1',
  vigilancia_2: 'Vigilancia 2',
  microfono_1:  'Micrófono 1',
  microfono_2:  'Micrófono 2',
  plataforma:   'Plataforma',
  audio:        'Audio',
  video:        'Video',
};

/** Cada cuánto cambia el grupo que hace el aseo del salón. */
export type AseoRotacion = 'reunion' | 'semana' | 'mes';

export interface GenerarLogisticaRequest {
  ano: number;
  mes: number;
}

export interface EditarLogisticaItemRequest {
  id_publicador: number | null;
  confirmar_conflicto?: boolean;
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

// ── Configuración de generación por congregación ────────────────────────

/**
 * Una preferencia de logística tal como la sirve el backend: su valor actual y
 * las opciones entre las que puede moverse. La forma es la misma para todas
 * -rotación de un puesto, del aseo, revisión antes de publicar- porque el
 * backend las serializa con un solo `serializar_prefs`.
 */
export interface PreferenciaLogistica {
  key: string;
  value: string;
  default: string;
  label: string;
  description: string;
  options: { id: string; label: string; description: string }[];
}

export interface ConfiguracionPreferenciasOut {
  preferencias: PreferenciaLogistica[];
  valores: Record<string, string>;
}

/** Solo lo que cambia; el backend valida clave y valor. */
export interface ActualizarPreferenciasRequest {
  cambios: Record<string, string>;
}

export const CLAVE_REQUIERE_REVISION = 'log_requiere_revision';

/** Misma clave que `CLAVE_ROTACION_ASEO` en preferencias.py. */
export const CLAVE_ROTACION_ASEO = 'log_aseo_rotacion';

/**
 * Puestos configurables y la clave donde vive su modo de rotación, en el orden
 * en que se muestran. Espejo de `CLAVES_ROTACION_PUESTO` en `preferencias.py`.
 */
export const PUESTO_ROTACION_CLAVES: { permiso: string; clave: string }[] = [
  { permiso: 'acomodador', clave: 'log_rotacion_acomodador' },
  { permiso: 'vigilancia', clave: 'log_rotacion_vigilancia' },
  { permiso: 'microfono',  clave: 'log_rotacion_microfono' },
  { permiso: 'plataforma', clave: 'log_rotacion_plataforma' },
  { permiso: 'audio',      clave: 'log_rotacion_audio' },
  { permiso: 'video',      clave: 'log_rotacion_video' },
];

/**
 * Cuántos turnos de vigilancia/micrófono genera el motor: algunas
 * congregaciones solo tienen una persona habilitada para el puesto. Espejo
 * de `CLAVES_CANTIDAD_PUESTO` en `preferencias.py`.
 */
export const CLAVE_CANTIDAD_VIGILANCIA = 'log_cantidad_vigilancia';
export const CLAVE_CANTIDAD_MICROFONO = 'log_cantidad_microfono';

export interface ConfirmarLogisticaRequest {
  ano: number;
  mes: number;
}

export interface PublicadorBase {
  id_publicador: number;
  nombre_completo: string;
  /** Última fecha (ISO) en que hizo este mismo puesto en esta congregación, o null si nunca. */
  ultima_vez?: string | null;
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
  /** Turnos vigentes ahora mismo para esta congregación (p. ej. sin `vigilancia_2` si solo usa uno). */
  puestos_activos: string[];
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

export interface DiscursoPublico {
  titulo: string | null;
  orador: string | null;
  congregacion_origen: string | null;
}

/** Presidente/lector/discurso de una fecha, igual cálculo que el mensaje de WhatsApp. */
export interface ProgramaDiaOut {
  fecha: string;
  presidente: string | null;
  lector: string | null;
  discurso: DiscursoPublico | null;
  hospitalidad: string | null;
}

/** Lo que ve un publicador sin login al abrir el enlace público del mes. */
export interface LogisticaPublicoOut {
  nombre_congregacion: string;
  ano: number;
  mes: number;
  fechas: FechaReunionOut[];
  asignaciones: LogisticaItemOut[];
  aseo: LogisticaAseoOut[];
  programa: ProgramaDiaOut[];
  actualizado_en: string | null;
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

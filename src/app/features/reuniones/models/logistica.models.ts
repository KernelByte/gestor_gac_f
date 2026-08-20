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

export interface LogisticaMesOut {
  ano: number;
  mes: number;
  id_congregacion: number;
  confirmado: boolean;
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
}

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

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

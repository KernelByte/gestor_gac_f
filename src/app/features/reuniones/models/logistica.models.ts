export interface GenerarLogisticaRequest {
  ano: number;
  mes: number;
}

export interface EditarLogisticaItemRequest {
  id_publicador: number | null;
}

export interface EditarAseoRequest {
  fecha: string;
  tipo_reunion: string;
  ids_grupo: number[];
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

export interface LogisticaMesOut {
  ano: number;
  mes: number;
  id_congregacion: number;
  confirmado: boolean;
  fechas: FechaReunionOut[];
  asignaciones: LogisticaItemOut[];
  aseo: LogisticaAseoOut[];
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

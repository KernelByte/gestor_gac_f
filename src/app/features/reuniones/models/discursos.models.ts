export interface GenerarDiscursosRequest {
  ano: number;
  mes: number;
}

export interface ConfirmarDiscursosRequest {
  ano: number;
  mes: number;
}

export interface CrearSalienteRequest {
  fecha: string;
  id_publicador?: number | null;
  congregacion_destino?: string | null;
  tema_discurso?: string | null;
  notas?: string | null;
}

export interface EditarSalienteRequest {
  id_publicador?: number | null;
  congregacion_destino?: string | null;
  tema_discurso?: string | null;
  notas?: string | null;
}

export interface EditarEntranteRequest {
  nombre_orador?: string | null;
  congregacion_origen?: string | null;
  titulo_discurso?: string | null;
  id_grupo_hospitalidad?: number | null;
  notas?: string | null;
}

export interface PublicadorSimple {
  id_publicador: number;
  nombre_completo: string;
}

export interface GrupoSimple {
  id_grupo: number;
  nombre_grupo: string;
}

export interface DiscursoSalienteOut {
  id_discurso_saliente: number;
  fecha: string;
  id_publicador: number | null;
  publicador: PublicadorSimple | null;
  congregacion_destino: string | null;
  tema_discurso: string | null;
  notas: string | null;
  confirmado: boolean;
  mes: number;
  ano: number;
}

export interface DiscursoEntranteOut {
  id_discurso_entrante: number;
  fecha: string;
  nombre_orador: string | null;
  congregacion_origen: string | null;
  titulo_discurso: string | null;
  id_grupo_hospitalidad: number | null;
  grupo_hospitalidad: GrupoSimple | null;
  notas: string | null;
  confirmado: boolean;
  mes: number;
  ano: number;
}

export interface DiscursosMesOut {
  ano: number;
  mes: number;
  id_congregacion: number;
  confirmado: boolean;
  fechas: string[];
  salientes: DiscursoSalienteOut[];
  entrantes: DiscursoEntranteOut[];
}

export interface MesDiscursosDisponible {
  ano: number;
  mes: number;
  confirmado: boolean;
}

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

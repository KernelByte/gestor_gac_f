export interface Periodo {
  id_periodo: number;
  codigo_ano: number;
  codigo_mes: number;
  descripcion: string | null;
}

export interface AsistenciaRecord {
  id_asistencia: number;
  id_periodo_asistencia: number;
  id_congregacion_asistencia: number;
  asistencia_semana_01: number | null;
  asistencia_semana_02: number | null;
  asistencia_semana_03: number | null;
  asistencia_semana_04: number | null;
  asistencia_semana_05: number | null;
  asistencia_tipo_reunion: number;
  total: number | null;
  promedio: number | null;
}

export interface AsistenciaUpsert {
  id_periodo_asistencia: number;
  id_congregacion_asistencia: number;
  asistencia_tipo_reunion: number;
  asistencia_semana_01?: number | null;
  asistencia_semana_02?: number | null;
  asistencia_semana_03?: number | null;
  asistencia_semana_04?: number | null;
  asistencia_semana_05?: number | null;
}

export interface ResumenMensualAsistencia {
  ano: number;
  mes: number;
  nombre_mes: string;
  midweek_reuniones: number;
  midweek_total: number | null;
  midweek_promedio: number | null;
  weekend_reuniones: number;
  weekend_total: number | null;
  weekend_promedio: number | null;
}

export interface ResumenAnualAsistencia {
  ano_servicio: number;
  id_congregacion: number;
  meses: ResumenMensualAsistencia[];
}

export interface FechaSemanaReunion {
  semana: number;
  fecha_entre_semana: string | null;
  fecha_fin_semana: string | null;
}

export interface FechasReunionesResponse {
  ano: number;
  mes: number;
  semanas: FechaSemanaReunion[];
}

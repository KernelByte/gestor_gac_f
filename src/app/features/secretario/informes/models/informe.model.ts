// Modelos para el módulo de informes

export interface Periodo {
   id_periodo: number;
   codigo_ano: string;
   codigo_mes: string;
   descripcion: string;
}

export interface InformeBase {
   id_informe?: number;
   id_informe_publicador: number;
   id_periodo_informe: number;
   participo: boolean | null;
   horas: number | null;
   cursos_biblicos: number | null;
   observaciones: string | null;
}

export interface InformeConPublicador {
   id_informe: number | null;
   id_publicador: number;
   nombre_completo: string;
   id_grupo: number | null;
   nombre_grupo: string | null;
   privilegio_activo: string | null;
   requiere_horas: boolean;
   participo: boolean | null;
   cursos_biblicos: number | null;
   horas: number | null;
   observaciones: string | null;
   tiene_informe: boolean;
}

export interface ResumenMensual {
   periodo_id: number;
   periodo_descripcion: string;
   total_publicadores: number;
   informes_recibidos: number;
   porcentaje_recibidos: number;
   total_cursos: number;
   total_horas_precursores: number;
   precursores_regulares_activos: number;
   precursores_auxiliares_activos: number;
   publicadores_list: InformeConPublicador[];
}

export interface InformeLoteItem {
   id_publicador: number;
   participo: boolean;
   cursos_biblicos: number;
   horas: number;
   observaciones: string | null;
}

export interface InformeLoteCreate {
   periodo_id: number;
   informes: InformeLoteItem[];
}

export interface InformeLoteResult {
   creados: number;
   actualizados: number;
   errores: { id_publicador: number; error: string }[];
}

export interface InformeMensualDetalle {
   periodo_id: number;
   mes: string;
   mes_num: number;
   ano: number;
   participo: boolean | null;
   cursos_biblicos: number | null;
   precursor_auxiliar: boolean;
   horas: number | null;
   observaciones: string | null;
}

export interface HistorialAnual {
   publicador_id: number;
   nombre_completo: string;
   estado: string;
   rol_actual: string | null;
   grupo: string | null;
   ano_servicio: string;
   total_horas: number;
   promedio_mensual: number;
   total_cursos: number;
   variacion_vs_anterior: number | null;
   detalle_mensual: InformeMensualDetalle[];
}

export interface DetalleActividadGrupo {
   titulo: string;
   cantidad_activos: number;
   cantidad_informaron: number;
   horas_totales: number;
   estudios_biblicos: number;
}

export interface AsistenciaReunion {
   tipo: string;
   descripcion: string;
   total: number;
   promedio: number;
   semanas_registradas: number;
}

export interface ResumenSucursal {
   periodo_id: number;
   periodo_descripcion: string;
   congregacion_id: number;
   congregacion_nombre: string;
   total_publicadores: number;
   total_informes: number;
   porcentaje_entregados: number;
   total_horas: number;
   variacion_horas_vs_anterior: number | null;
   total_estudios: number;
   promedio_estudios_por_publicador: number;
   publicadores_inactivos: number;
   detalle_publicadores: DetalleActividadGrupo;
   detalle_auxiliares: DetalleActividadGrupo;
   detalle_regulares: DetalleActividadGrupo;
   asistencia_entre_semana: AsistenciaReunion | null;
   asistencia_fin_semana: AsistenciaReunion | null;
}

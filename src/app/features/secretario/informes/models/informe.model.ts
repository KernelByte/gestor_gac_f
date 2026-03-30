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
   es_paux_mes: boolean; // Managed by frontend toggle
   tiene_informe: boolean;
   notificaciones_enviadas?: number;
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
   es_paux_mes?: boolean;
}

export interface InformeLoteCreate {
   periodo_id: number;
   informes: InformeLoteItem[];
}

export interface InformeLoteResult {
   procesados: number;
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
   cantidad_activos?: number;
   cantidad_informaron: number;
   cursos_biblicos: number;
   horas_totales: number;
   estudios_biblicos?: number;
   promedio_horas: number;
   promedio_horas_3m: number | null;
   promedio_horas_6m: number | null;
}

export interface AsistenciaReunion {
   tipo: string;
   descripcion: string;
   num_reuniones: number;
   total: number;
   promedio: number;
   porcentaje_publicadores: number;
   semanas_registradas?: number;
}

export interface ResumenSucursal {
   periodo_id: number;
   periodo_descripcion: string;
   congregacion_id: number;
   congregacion_nombre: string;

   detalle_publicadores: DetalleActividadGrupo;
   detalle_auxiliares: DetalleActividadGrupo;
   detalle_regulares: DetalleActividadGrupo;

   total_informaron: number;
   total_cursos_biblicos: number;
   total_horas: number;

   total_publicadores_activos: number;
   precursores_aux_count: number;
   precursores_aux_porcentaje: number;
   total_irregulares: number;
   total_irregulares_porcentaje: number;
   sin_informe_count: number;
   sin_informe_porcentaje: number;
   no_bautizados_count: number;
   no_bautizados_porcentaje: number;

   asistencia_entre_semana: AsistenciaReunion | null;
   asistencia_fin_semana: AsistenciaReunion | null;
}

// --- Historial Anual ---
export interface InformeHistorialItem {
   ano: number;
   mes_numero: number;
   mes_nombre: string;
   id_informe?: number;
   participo?: boolean;
   horas?: number;
   cursos_biblicos?: number;
   observaciones?: string;
   credito?: number;
   paux: boolean; // Precursor Auxiliar en ese mes
   es_regular?: boolean; // Precursor Regular en ese mes
}


export interface PublicadorHistorial {
   id_publicador: number;
   nombre_completo: string;
   grupo_numero?: number;
   es_precursor_regular: boolean;
   privilegio_actual?: string | null;
   informes: InformeHistorialItem[];
   // Totales anuales
   total_horas: number;
   total_cursos: number;
   total_meses_participo: number;
}

export interface HistorialAnualOut {
   ano: number;
   publicadores: PublicadorHistorial[];
}


// --- Edición de Historial ---
export interface InformeHistorialDetalle {
   id_publicador: number;
   ano: number;
   mes: number;
   participo: boolean;
   horas: number;
   cursos_biblicos: number;
   observaciones: string | null;
   privilegio: string | null;
}

export interface InformeHistorialEdit {
   id_publicador: number;
   ano: number;
   mes: number;
   participo: boolean;
   horas: number;
   cursos_biblicos: number;
   observaciones: string | null;
   privilegio: string | null;
}

export interface NotificarRequest {
   id_publicador: number;
   id_periodo: number;
}

export interface NotificarResponse {
   token: string;
   url_publica: string;
   telefono: string | null;
   mensaje_wa: string;
}



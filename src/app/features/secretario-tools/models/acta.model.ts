export type TipoReunion = 'ancianos' | 'trimestral' | 'comite_servicio' | 'otra';
export type EstadoActa = 'borrador' | 'finalizada';

export interface Acta {
  id_acta: number;
  id_congregacion: number;
  tipo_reunion: TipoReunion;
  titulo: string;
  fecha_reunion: string;
  notas_originales: string;
  contenido_redactado?: string | null;
  estado: EstadoActa;
  creado_en: string;
  actualizado_en: string;
}

export interface ActaCreate {
  id_congregacion: number;
  tipo_reunion: TipoReunion;
  titulo: string;
  fecha_reunion: string;
  notas_originales?: string;
  contenido_redactado?: string | null;
  estado?: EstadoActa;
}

export interface ActaUpdate {
  tipo_reunion?: TipoReunion;
  titulo?: string;
  fecha_reunion?: string;
  notas_originales?: string;
  contenido_redactado?: string | null;
  estado?: EstadoActa;
}

export interface RedactarIARequest {
  id_acta: number;
  instrucciones_extra?: string;
}

export interface RedactarIAResponse {
  contenido_redactado: string;
  tareas_creadas?: Tarea[];
}

export interface Tarea {
  id_tarea: number;
  id_congregacion: number;
  titulo: string;
  descripcion?: string | null;
  asignado_a?: number | null;
  asignado_a_nombre?: string | null;
  prioridad: 'baja' | 'media' | 'alta';
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
  fecha_limite?: string | null;
  origen_tipo?: string | null;
  origen_id?: number | null;
  creado_por?: number | null;
  creado_por_nombre?: string | null;
  creado_en: string;
  actualizado_en: string;
  completado_en?: string | null;
  subtareas_total?: number;
  subtareas_completadas?: number;
  subtareas?: Subtarea[];
}

export interface Subtarea {
  id_subtarea: number;
  id_tarea: number;
  titulo: string;
  completada: boolean;
  orden: number;
  completado_en?: string | null;
}

/** Alta desde Mis tareas: sin asignado, la tarea es para quien la crea. */
export interface TareaCreate {
  titulo: string;
  descripcion?: string | null;
  asignado_a?: number | null;
  prioridad: Tarea['prioridad'];
  fecha_limite?: string | null;
  subtareas?: string[];
}

export interface UsuarioAsignable {
  id_usuario: number;
  nombre: string;
}

/** Qué tareas listar: las mías (creadas + asignadas) o solo una de las dos. */
export type RolTarea = 'todas' | 'asignadas' | 'creadas';

export type TipoReunion = 'ancianos' | 'trimestral' | 'comite_servicio' | 'otra';
export type EstadoActa = 'borrador' | 'finalizada';

export interface Acta {
  id_acta: number;
  id_congregacion: number;
  tipo_reunion: TipoReunion;
  titulo: string;
  fecha_reunion: string;
  metadata_json?: ActaMetadata | null;
  notas_originales: string;
  contenido_redactado?: string | null;
  estado: EstadoActa;
  creado_en: string;
  actualizado_en: string;
}

export interface ActaMetadata {
  presidente?: string;
  lugar?: string;
  asistentes?: string[] | string;
  ausentes?: string[] | string;
  invitados?: string[] | string;
  [k: string]: any;
}

export interface ActaCreate {
  id_congregacion: number;
  tipo_reunion: TipoReunion;
  titulo: string;
  fecha_reunion: string;
  metadata_json?: ActaMetadata | null;
  notas_originales?: string;
  contenido_redactado?: string | null;
  estado?: EstadoActa;
}

export interface ActaUpdate {
  tipo_reunion?: TipoReunion;
  titulo?: string;
  fecha_reunion?: string;
  metadata_json?: ActaMetadata | null;
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
  creado_en: string;
  actualizado_en: string;
  completado_en?: string | null;
}

export interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  telefono?: string | null;
  id_congregacion_publicador?: number | null;
  id_grupo_publicador?: number | null;
  id_estado_publicador?: number | null;
}

// TODO: Añadir Value Objects y validaciones del dominio según necesidades.
export interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  direccion?: string | null;
  barrio?: string | null;
  telefono?: string | null;
  fecha_bautismo?: string | null;
  ungido?: boolean | null;
  fecha_nacimiento?: string | null;
  sexo?: string | null;
  consentimiento_datos?: boolean;
  id_congregacion_publicador?: number | null;
  id_grupo_publicador?: number | null;
  id_estado_publicador?: number | null;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

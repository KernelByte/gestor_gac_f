// TODO: Añadir Value Objects y validaciones del dominio según necesidades.
export interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  /** Alias propio. Vacío = seguir la regla de la congregación. Editable. */
  nombre_visible?: string | null;
  /** Nombre ya compuesto por el backend. De solo lectura. */
  nombre_mostrado?: string | null;
  direccion?: string | null;
  barrio?: string | null;
  telefono?: string | null;
  fecha_bautismo?: string | null;
  ungido?: boolean | null;
  fecha_nacimiento?: string | null;
  sexo?: string | null;
  consentimiento_datos?: boolean;
  archivo_consentimiento?: string | null;
  id_congregacion_publicador?: number | null;
  nombre_congregacion?: string | null;
  id_grupo_publicador?: number | null;
  id_estado_publicador?: number | null;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  fecha_inactividad?: string | null;
  fecha_inicio_informe?: string | null;
  fecha_inicio_efectivo?: string | null;
  origen_fecha_inicio_informe?: 'manual' | 'informe' | 'alta' | null;
  codigo_pin?: string | null;
  permite_login_simple?: boolean;
  /** Ya tiene un usuario del sistema (correo+contraseña): su acceso a la app es esa cuenta, no el PIN. */
  tiene_usuario_sistema?: boolean;
}

/** Lo principal que dejará de ver (o perderá) la persona al eliminar al publicador. */
export interface ImpactoEliminacion {
  usuario: {
    id_usuario: number;
    nombre_usuario?: string | null;
    correo_usuario?: string | null;
    rol_usuario?: string | null;
    /** false en Administrador / Gestor: la cuenta se conserva y solo se desvincula. */
    se_elimina: boolean;
  } | null;
  grupo: { id_grupo: number; nombre_grupo: string } | null;
  roles_grupo: { id_grupo: number; nombre_grupo: string; rol: 'capitan' | 'auxiliar' }[];
  privilegios_activos: string[];
  informes: number;
  /** Territorios, visitas, cobertura o exhibidor: se conserva el historial sin el nombre. */
  conserva_historial: boolean;
}

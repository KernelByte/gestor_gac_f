// Contrato de /reuniones-ancianos (backend: modules/secretario/reuniones_ancianos).
// Fechas "YYYY-MM-DD"; horas "HH:MM:SS" al leer (al enviar basta "HH:MM").

export type EstadoReunion = 'borrador' | 'convocada' | 'realizada';

/** Tipos de reunión de organización (backend: tipos.py). */
export type TipoReunion =
  | 'ancianos' | 'ancianos_sc' | 'ancianos_siervos' | 'comite_servicio' | 'precursores' | 'bautizados' | 'mantenimiento' | 'otra';
/** A quién convoca el tipo por defecto ('ninguno': se eligen a mano). */
export type GrupoTipo = 'ancianos' | 'ancianos_siervos' | 'comite_servicio' | 'precursores' | 'bautizados' | 'ninguno';
/** Grupo de una persona en el selector de convocados. */
export type GrupoPersona = 'anciano' | 'siervo' | 'precursor' | 'otro';

export interface TipoReunionInfo {
  clave: TipoReunion;
  /** Nombre corto: chips, filtros y pie del documento. */
  etiqueta: string;
  /** Título del programa cuando la reunión no tiene uno propio. */
  titulo: string;
  grupo: GrupoTipo;
  /** Si lo gestiona el secretario y, por tanto, lleva acta. */
  con_acta: boolean;
}

/** Espejo de TIPOS en el backend (GET /reuniones-ancianos/tipos devuelve lo mismo). */
export const TIPOS_REUNION: readonly TipoReunionInfo[] = [
  { clave: 'ancianos', etiqueta: 'Cuerpo de ancianos', titulo: 'Reunión del cuerpo de ancianos', grupo: 'ancianos', con_acta: true },
  { clave: 'ancianos_sc', etiqueta: 'Con el superintendente de circuito', titulo: 'Reunión de ancianos con el superintendente de circuito', grupo: 'ancianos', con_acta: true },
  { clave: 'ancianos_siervos', etiqueta: 'Ancianos y siervos ministeriales', titulo: 'Reunión de ancianos y siervos ministeriales', grupo: 'ancianos_siervos', con_acta: true },
  { clave: 'comite_servicio', etiqueta: 'Comité de Servicio', titulo: 'Reunión del Comité de Servicio', grupo: 'comite_servicio', con_acta: true },
  { clave: 'precursores', etiqueta: 'Precursores', titulo: 'Reunión con los precursores', grupo: 'precursores', con_acta: true },
  { clave: 'bautizados', etiqueta: 'Publicadores bautizados', titulo: 'Reunión con los publicadores bautizados', grupo: 'bautizados', con_acta: true },
  { clave: 'mantenimiento', etiqueta: 'Comité de mantenimiento', titulo: 'Reunión del comité de mantenimiento', grupo: 'ninguno', con_acta: false },
  { clave: 'otra', etiqueta: 'Otra reunión', titulo: 'Otra reunión', grupo: 'ninguno', con_acta: false },
];

export function tipoReunion(clave: string | null | undefined): TipoReunionInfo {
  return TIPOS_REUNION.find(t => t.clave === clave) ?? TIPOS_REUNION[0];
}

export const GRUPO_PERSONA_LABEL: Record<GrupoPersona, string> = {
  anciano: 'Ancianos',
  siervo: 'Siervos ministeriales',
  precursor: 'Precursores',
  otro: 'Otros publicadores',
};
export type EstadoParte = 'aceptada' | 'propuesta';

export interface ParteIn {
  /** La parte aceptada que se edita (conserva quién la propuso). Sin él, se crea una nueva. */
  id_parte?: number | null;
  titulo: string;
  id_publicador_responsable?: number | null;
  /** Responsable escrito a mano (no es de la congregación). Se ignora si va id. */
  responsable_texto?: string | null;
  minutos?: number | null;
  objetivo?: string | null;
  texto_biblico?: string | null;
  referencias?: string | null;
  temas: string[];
}

export interface ParteOut {
  id_parte: number;
  orden: number;
  titulo: string;
  id_publicador_responsable: number | null;
  responsable_texto: string | null;
  responsable_nombre: string | null;
  minutos: number | null;
  objetivo: string | null;
  texto_biblico: string | null;
  referencias: string | null;
  temas: string[];
  estado: EstadoParte;
  /** id_usuario de quien la propuso (solo en propuestas). */
  propuesto_por: number | null;
  propuesto_por_nombre: string | null;
  creado_en: string;
  /** El backend dice si este usuario puede descartarla (gestor o su autor). */
  puedo_descartar: boolean;
}

/** Partes aceptadas de una reunión, para buscar por temas desde el listado. */
export interface ParteBusqueda {
  titulo: string;
  responsable: string | null;
  /** Objetivo, texto bíblico, referencias y temas, uno por renglón. */
  texto: string;
}

/** Listado. total_minutos y num_partes cuentan solo las partes aceptadas. */
export interface ReunionResumen {
  id_reunion: number;
  id_congregacion: number;
  congregacion_nombre: string | null;
  tipo: TipoReunion;
  tipo_etiqueta: string;
  /** Ya resuelto: el propio o el del tipo. */
  titulo: string;
  /** El que se guardó; null = usa el del tipo. */
  titulo_propio: string | null;
  num_convocados: number;
  fecha: string;
  hora: string | null;
  lugar: string | null;
  estado: EstadoReunion;
  convocada_en: string | null;
  /** Cuándo se mandó el primer aviso. null en una convocada = confirmada, sin avisar. */
  avisada_en?: string | null;
  id_acta: number | null;
  id_publicador_secretario: number | null;
  secretario_nombre: string | null;
  total_minutos: number;
  num_partes: number;
  propuestas_pendientes: number;
  actualizado_en: string;
  /** Solo viene en el listado. */
  partes_busqueda?: ParteBusqueda[];
}

export interface ReunionOut extends ReunionResumen {
  id_publicador_oracion_inicial: number | null;
  oracion_inicial_nombre: string | null;
  id_publicador_oracion_final: number | null;
  oracion_final_nombre: string | null;
  creado_por: number | null;
  creado_en: string;
  /** Ordenados por grupo y nombre. */
  convocados: ConvocadoOut[];
  /** Aceptadas en orden y, al final, las propuestas pendientes. */
  partes: ParteOut[];
  puedo_editar: boolean;
  puedo_proponer: boolean;
  puedo_pasar_a_acta: boolean;
  acta_finalizada: boolean;
  /** Puede abrir la carta del acta (el documento final), no la pantalla de gestión de actas. */
  puedo_leer_acta: boolean;
}

export interface ConvocadoOut {
  id_publicador: number;
  nombre: string;
  grupo: GrupoPersona;
  /** Tiene cuenta activa. */
  tiene_usuario: boolean;
  /** Tiene la app (también quien entra con PIN). */
  tiene_app?: boolean;
  /** Le llega el aviso: tiene_usuario || tiene_app. Si falta, se calcula. */
  recibe_aviso?: boolean;
}

export interface ReunionIn {
  /** Solo lo envía el Administrador al crear. */
  id_congregacion?: number;
  /** null al crear = 'ancianos'; null al actualizar = sin cambio. */
  tipo?: TipoReunion | null;
  /** null o "" = el título del tipo. En 'otra' es obligatorio. */
  titulo?: string | null;
  /** Publicadores convocados. null al crear = el grupo del tipo; [] = nadie. */
  convocados?: number[] | null;
  fecha: string;
  hora?: string | null;
  lugar?: string | null;
  id_publicador_secretario?: number | null;
  id_publicador_oracion_inicial?: number | null;
  id_publicador_oracion_final?: number | null;
  partes: ParteIn[];
}

export interface ReunionUpdate extends Omit<ReunionIn, 'id_congregacion'> {
  /** Para detectar que otra persona guardó antes (409). */
  esperado_actualizado_en?: string;
}

export interface AncianoOpcion {
  id_publicador: number;
  nombre: string;
  tiene_usuario: boolean;
  tiene_app: boolean;
  /** Le llega el aviso: tiene_usuario || tiene_app. Si falta, se calcula. */
  recibe_aviso?: boolean;
}

/** GET /personas: publicadores activos de la congregación, por grupo y nombre. */
export interface PersonaOpcion extends AncianoOpcion {
  grupo: GrupoPersona;
  /** Lo convoca por defecto el tipo pedido. */
  por_defecto: boolean;
}

export interface SugerenciaReunion {
  hora: string | null;
  lugar: string | null;
  /** El secretario de la congregación, si lo hay y es anciano. */
  id_publicador_secretario?: number | null;
  /** Convocados por defecto del tipo pedido. */
  convocados?: number[];
}

export interface ConvocarResultado {
  notificados: number;
  sin_app: number;
  reunion: ReunionOut;
}

export interface PropuestaIn {
  titulo: string;
  objetivo?: string | null;
  minutos?: number | null;
}

export const ESTADO_REUNION_LABEL: Record<EstadoReunion, string> = {
  borrador: 'Borrador',
  convocada: 'Convocada',
  realizada: 'Realizada',
};

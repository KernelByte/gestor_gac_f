// Contrato de /reuniones-ancianos (backend: modules/secretario/reuniones_ancianos).
// Fechas "YYYY-MM-DD"; horas "HH:MM:SS" al leer (al enviar basta "HH:MM").

export type EstadoReunion = 'borrador' | 'convocada' | 'en_curso' | 'realizada' | 'cancelada';

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
  /** Sin categoría o con categoria_manual=false, el servidor la clasifica por el título. */
  id_categoria?: number | null;
  categoria_manual?: boolean;
  /** Indicación privada para el responsable: solo él y los gestores la ven. */
  nota_asignado?: string | null;
  cancelada?: boolean;
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
  id_categoria: number | null;
  categoria_manual: boolean;
  cancelada: boolean;
  /** Solo llega a los gestores y al responsable de la parte. */
  nota_asignado: string | null;
  /** El usuario actual es el responsable. */
  es_mia: boolean;
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
  /** El Coordinador solo abre el acta cuando el secretario la finaliza. */
  acta_estado?: 'borrador' | 'finalizada' | null;
  id_publicador_secretario: number | null;
  secretario_nombre: string | null;
  total_minutos: number;
  num_partes: number;
  propuestas_pendientes: number;
  actualizado_en: string;
  /** Solo viene en el listado. */
  partes_busqueda?: ParteBusqueda[];
  /** Partes a cargo del usuario actual. */
  mis_partes?: number;
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
  /** Convocados que después se eliminaron de GAC (solo en reuniones ya hechas): sus nombres. */
  convocados_eliminados?: string[];
  /** Aceptadas en orden y, al final, las propuestas pendientes. */
  partes: ParteOut[];
  otros_temas: string[];
  /** Papeles ya resueltos (si no se eligió a nadie: coordinador / secretario). */
  id_publicador_tiempo: number | null;
  tiempo_nombre: string | null;
  id_publicador_redactor: number | null;
  redactor_nombre: string | null;
  /** Lo guardado; null = el de siempre. */
  id_publicador_tiempo_propio: number | null;
  id_publicador_redactor_propio: number | null;
  colaboradores: number[];
  puedo_editar: boolean;
  /** Tiene cuenta: puede escribir sus notas privadas. */
  puedo_preparar: boolean;
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
  otros_temas?: string[];
  /** null = el de siempre (coordinador / secretario de la reunión). */
  id_publicador_tiempo?: number | null;
  id_publicador_redactor?: number | null;
  colaboradores?: number[];
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
  en_curso: 'En curso',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

// ─── Categorías ─────────────────────────────────────────────────────────────

/** Tokens de color (definidos en styles.scss como --cat-<color>): nunca un hex. */
export type ColorCategoria = 'indigo' | 'cyan' | 'amber' | 'green' | 'rose' | 'violet' | 'teal' | 'slate';
export const COLORES_CATEGORIA: readonly ColorCategoria[] = ['indigo', 'cyan', 'amber', 'green', 'rose', 'violet', 'teal', 'slate'];
export const ICONOS_CATEGORIA = [
  'book-open', 'hand-heart', 'gem', 'user-check', 'megaphone', 'clipboard-list',
  'flag', 'star', 'tag', 'users', 'calendar', 'file-text',
] as const;
export type IconoCategoria = typeof ICONOS_CATEGORIA[number];

export interface CategoriaOut {
  id_categoria: number;
  clave: string;
  etiqueta: string;
  plural: string;
  icono: IconoCategoria;
  color: ColorCategoria;
  palabras_clave: string[];
  /** La oración: no se archiva (las oraciones inicial y final cuentan en ella). */
  es_sistema: boolean;
  /** La que queda cuando ninguna palabra clave coincide. */
  por_defecto: boolean;
  activa: boolean;
  orden: number;
  /** Partes que la usan (solo para gestores). */
  usos: number;
}

export interface CategoriaIn {
  etiqueta: string;
  plural?: string | null;
  icono: IconoCategoria;
  color: ColorCategoria;
  palabras_clave: string[];
  por_defecto?: boolean;
}

export type CategoriaUpdate = Partial<CategoriaIn> & { activa?: boolean };

export interface NotaPersonal {
  /** null = la nota general de la reunión. */
  id_parte: number | null;
  texto: string;
  actualizado_en: string;
}

// ─── En vivo ────────────────────────────────────────────────────────────────

export type EstadoVivo = 'pendiente' | 'en_curso' | 'pausada' | 'terminada' | 'no_tratada';
export type TipoPunto = 'nota' | 'acuerdo';
export type AccionCrono = 'iniciar' | 'pausar' | 'terminar' | 'siguiente' | 'no_tratada';

export interface PuntoOut {
  id_punto: number;
  id_parte: number | null;
  tipo: TipoPunto;
  texto: string;
  orden: number;
  autor_nombre: string | null;
  es_mio: boolean;
  puedo_editar: boolean;
  /** Otra persona lo está escribiendo ahora (su nombre); null si está libre. */
  editando_nombre: string | null;
  id_publicador_responsable: number | null;
  responsable_nombre: string | null;
  fecha_limite: string | null;
  id_tarea: number | null;
  actualizado_en: string;
}

export interface PuntoIn {
  id_parte: number | null;
  tipo: TipoPunto;
  texto: string;
  id_publicador_responsable?: number | null;
  fecha_limite?: string | null;
}

export type PuntoUpdate = Partial<Omit<PuntoIn, 'id_parte'>>;

export interface ParteVivo {
  id_parte: number;
  orden: number;
  titulo: string;
  id_publicador_responsable: number | null;
  responsable_nombre: string | null;
  minutos: number | null;
  id_categoria: number | null;
  cancelada: boolean;
  objetivo: string | null;
  texto_biblico: string | null;
  referencias: string | null;
  temas: string[];
  nota_asignado: string | null;
  es_mia: boolean;
  estado_vivo: EstadoVivo;
  /** Segundos sin contar el tramo que corre; real = acumulado + (ahora − desde). */
  acumulado_seg: number;
  desde: string | null;
  iniciado_en: string | null;
  terminado_en: string | null;
}

export interface VivoOut {
  /** Hora del servidor: con ella cada pantalla corrige el desfase de su reloj. */
  ahora: string;
  id_reunion: number;
  titulo: string;
  tipo: TipoReunion;
  fecha: string;
  hora: string | null;
  lugar: string | null;
  estado: EstadoReunion;
  iniciada_en: string | null;
  pausada_en: string | null;
  finalizada_en: string | null;
  id_parte_actual: number | null;
  oracion_inicial_nombre: string | null;
  oracion_final_nombre: string | null;
  otros_temas: string[];
  partes: ParteVivo[];
  tiempo_nombre: string | null;
  redactor_nombre: string | null;
  colaboradores_nombres: string[];
  puntos: PuntoOut[];
  puedo_controlar: boolean;
  puedo_redactar: boolean;
  puedo_colaborar: boolean;
  puedo_preparar: boolean;
  con_acta: boolean;
  id_acta: number | null;
}

export interface FinalizarResultado {
  id_acta: number | null;
  tareas_creadas: number;
  acuerdos_sin_cuenta: number;
}

// ─── Participación ──────────────────────────────────────────────────────────

export interface ParticipacionConfig {
  configurada: boolean;
  fecha_corte: string | null;
  tipos_que_cuentan: TipoReunion[];
}

export interface ConteoCategoria {
  /** Lo que suma: max(saldo, documentadas) + nuevas (con fechas, solo las del rango). */
  total: number;
  saldo: number;
  documentadas: number;
  nuevas: number;
  programadas: number;
  habilitado: boolean;
  ultima: string | null;
}

export interface HermanoParticipacion {
  id_publicador: number;
  nombre: string;
  activo: boolean;
  retirado_en: string | null;
  es_anciano: boolean;
  /** Por id_categoria (las claves llegan como texto). */
  por_categoria: Record<string, ConteoCategoria>;
  total: number;
  ultima: string | null;
  dias: number | null;
  programadas: number;
}

export interface ParticipacionOut {
  config: ParticipacionConfig;
  categorias: CategoriaOut[];
  hermanos: HermanoParticipacion[];
  reuniones: number;
}

export interface ParticipacionItem {
  fecha: string;
  id_reunion: number;
  id_categoria: number | null;
  titulo: string;
  estado: 'realizada' | 'programada';
  en_saldo: boolean;
}

export interface HermanoIn {
  activo: boolean;
  retirado_en: string | null;
  categorias: { id_categoria: number; habilitado: boolean; saldo_inicial: number }[];
}

export interface Recomendado {
  id_publicador: number;
  nombre: string;
  sugerido: boolean;
  razon: string;
  veces: number;
  programadas: number;
  ultima: string | null;
  dias: number | null;
}

export interface RecomendacionOut {
  configurada: boolean;
  categoria: CategoriaOut | null;
  candidatos: Recomendado[];
  no_considerados: { id_publicador: number; nombre: string; motivo: string }[];
}

export interface MiConteoCategoria {
  id_categoria: number;
  etiqueta: string;
  plural: string;
  icono: string;
  color: string;
  total: number;
  programadas: number;
  ultima: string | null;
}

/** Lo que lleva el propio hermano en cada categoría. */
export interface MiParticipacion {
  configurada: boolean;
  categorias: MiConteoCategoria[];
}

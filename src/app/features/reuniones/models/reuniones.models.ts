export interface PlantillaOption {
  id_plantilla: number;
  nombre: string;
  tipo: string;
  mes_inicio?: number | null;
  ano_inicio?: number | null;
  mes_fin?: number | null;
  ano_fin?: number | null;
  /**
   * Los lunes (YYYY-MM-DD) de las semanas que cubre la guía, ordenados.
   * De aquí salen las fechas a generar: un lunes + el día de reunión de la
   * congregación. Vacío = plantilla comodín, sin semanas propias.
   */
  semanas_lunes?: string[];
}

/**
 * Quien queda a cargo de la Sala B durante toda la reunión.
 *
 * Espejo de `NOMBRE_RESPONSABLE_SALA_B` en `engine/hard_constraints.py`: el
 * backend crea la parte con ese nombre exacto y por él se la reconoce aquí.
 * No confundir con las partes de la guía que se dan en la otra sala, que
 * llevan "(Sala B)" en el nombre y sí son asignaciones de estudiante.
 */
export const NOMBRE_RESPONSABLE_SALA_B = 'Responsable de Sala B';

export interface CandidatoAlternativo {
  id_publicador: number;
  nombre_completo: string;
  score: number;
  notas_score: string[];
  sexo?: string;
}

export interface AsignacionDraft {
  id_programa_parte: number;
  id_asignacion?: number;
  nombre_parte?: string;
  seccion?: string;
  sala?: string;
  orden_visual?: number;
  duracion_minutos?: number;
  fuente_informacion?: string;
  /** El cántico que abre el Estudio de La Atalaya, cuando el PDF de la revista
   *  ya se importó para esa semana. Viene aparte de `fuente_informacion` para
   *  que cada pantalla decida si lo enseña. */
  cantico?: string | null;
  aplica_sala_b?: boolean;
  /** Si esta ranura espera a alguien. Las canciones y las partes fijas de la
   *  guía salen igual —el PDF las necesita— pero sin casilla que rellenar. */
  asignable?: boolean;
  id_publicador: number;
  nombre_completo: string;
  /** Solo para armar el enlace de WhatsApp de la papeleta S-89-S. */
  telefono?: string | null;
  /** Si esta ranura lleva papeleta S-89-S (Seamos Mejores Maestros / Lectura
   *  de la Biblia): lo decide el backend, con la misma heurística del PDF. */
  papeleta_s89?: boolean;
  es_reemplazo: boolean;
  es_ayudante?: boolean;
  /** 'sin_asignar' cuando la ranura está vacía. Las dos que importan son
   *  'borrador' y 'publicado': la misma fila, antes y después de publicar. */
  estado: 'sin_asignar' | 'borrador' | 'publicado';
  /** Solo vienen recién generada la semana: son los que calculó el motor. Al
   *  reabrir el mes no están y el panel los pide al abrirse. */
  alternativos?: CandidatoAlternativo[];
  /** Lo que el consejero registró sobre esta asignación después de la reunión.
   *  `null` mientras no haya nada apuntado; el backend siempre manda la clave. */
  seguimiento?: Seguimiento | null;
  _swapped?: boolean;
}

export interface EditarAsignacionRequest {
  id_publicador_nuevo: number;
}

export interface ProgramaSemana {
  id_programa: number;
  semana_iso: number;
  /** Año ISO que acompaña a semana_iso. Lo calcula el backend; nunca derivarlo
   *  de `fecha` con getFullYear(): en el borde de año no coinciden. */
  ano_iso?: number;
  fecha: string;
  titulo_guia: string | null;
  /** Estado de la semana entera: basta una asignación en borrador para que lo
   *  esté. Lo deriva el backend de sus propias filas. */
  estado?: 'borrador' | 'publicado';
  partes: AsignacionDraft[];
}

export interface GenerarAsignacionesResponse {
  tipo_reunion: string;
  semanas: ProgramaSemana[];
}

export interface GenerarAsignacionesRequest {
  tipo_reunion: string;
  fecha_inicio: string;
  fecha_fin: string;
  id_congregacion: number;
}

export interface ProgramaMensualCreateRequest {
  id_congregacion: number;
  tipo_reunion: string;
  mes: number;
  ano: number;
  /** Siempre completa: el ordinal de cada semana se calcula contra la guía
   *  entera. Lo que se autoriza a crear va en `meses_a_crear`. */
  semanas: string[];
  id_plantilla: number;
  /** Meses que el backend puede crear o reemplazar. Ausente = todos. */
  meses_a_crear?: { ano: number; mes: number }[];
}

export interface PublicarProgramaRequest {
  tipo_reunion: string;
  id_congregacion: number;
  /** Fecha de reunión de cada semana, que es como se identifica la semana de
   *  punta a punta. Antes viajaba un único `ano` para todas y las semanas del
   *  año siguiente se perdían en silencio al publicar un rango a caballo de
   *  fin de año. */
  fechas: string[];
}

export interface PublicarProgramaResponse {
  message: string;
  publicadas: number;
  /** Semanas que se pidieron publicar y no tenían nada en borrador. Si no
   *  viene vacío, algo se quedó fuera y hay que decirlo. */
  semanas_sin_borrador: string[];
  semanas_omitidas_sin_reunion: string[];
}

/** Una parte concreta que cargó una persona dentro de una misma reunión. */
export interface ParteRepetida {
  detalle: string;
  rol: string | null;
  sala: string | null;
}

export interface PersonaRecargada {
  id_publicador: number;
  nombre_completo: string;
  partes: ParteRepetida[];
}

export interface ReunionRecargada {
  fecha: string;
  /** Ranuras asignadas en esa reunión. */
  ranuras: number;
  /** Con cuánta gente cuenta la congregación para este tipo de reunión. */
  personas_disponibles: number;
  /** Partes por persona a partir de las cuales se avisa: sale de dividir las
   *  ranuras entre la gente disponible, así que en una congregación pequeña
   *  sube solo y repetir deja de ser motivo de aviso. */
  umbral: number;
  personas: PersonaRecargada[];
}

export interface RevisionPublicacionResponse {
  tiene_repeticiones: boolean;
  reuniones: ReunionRecargada[];
}

export interface PeriodoConfirmado {
  ano: number;
  mes: number;
  label: string;
  id_plantilla: number | null;
  nombre_plantilla: string | null;
  /** Los borradores también salen en la lista: antes vivían en caché y
   *  caducaban solos a las 72 h. */
  estado?: 'borrador' | 'publicado';
  /** Fechas (ISO) ya generadas de este mes. Una guía puede cruzar el mes o
   *  dejar una semana suelta sin generar, así que el mes solo no dice si está
   *  completo — hay que ver sus fechas. */
  fechas: string[];
}

/** Una semana que no se borró por estar ya publicada. Misma forma que la que
 *  devuelve generar, para poder reutilizar el mismo aviso. */
export interface ConservadoGuia {
  ano: number;
  semana_iso: number;
  fecha: string;
  titulo_guia?: string | null;
}

/** Una guía con programación generada. La unidad de navegación de entre
 *  semana: la guía se genera por semanas ISO y su última semana cae en el mes
 *  siguiente, así que listar por mes la partía en dos y borrar un mes se
 *  llevaba una semana que luego nadie sabía regenerar. */
export interface PeriodoGuia {
  clave: string;
  id_plantilla: number;
  nombre_plantilla: string;
  label: string;
  estado: 'borrador' | 'publicado';
  fechas: string[];
  fecha_inicio: string;
  fecha_fin: string;
  /** Semanas realmente generadas. */
  semanas: number;
  /** Semanas que la guía define. Si es mayor que `semanas`, faltan por
   *  generar y la pantalla lo dice: es el detector del hueco silencioso. */
  semanas_guia: number;
  /** Primer mes de la guía, por compatibilidad (PDF por defecto, papelera). */
  ano: number;
  mes: number;
  /** Los meses de calendario que toca la guía. El PDF y las papeletas se
   *  siguen pidiendo por (ano, mes), así que la fila los necesita. */
  meses: { ano: number; mes: number }[];
}

/** La fila que pinta el historial, venga de una guía (entre semana) o de un
 *  mes (fin de semana y programas sin guía asociada). */
export interface PeriodoNav {
  clave: string;
  tipo: 'guia' | 'mes';
  label: string;
  sublabel: string;
  estado: 'borrador' | 'publicado';
  fechas: string[];
  id_plantilla: number | null;
  /** Faltan semanas por generar respecto a lo que la guía define. */
  incompleta: boolean;
  ano: number;
  mes: number;
  meses: { ano: number; mes: number }[];
}

export interface ConflictoMes {
  ano: number;
  mes: number;
  label: string;
}

export interface ConflictosPlantillaResponse {
  tiene_conflictos: boolean;
  conflictos: ConflictoMes[];
  meses_faltantes: ConflictoMes[];
}

export interface GrupoPlantilla {
  id_plantilla: number | null;
  nombre_plantilla: string;
  periodos: PeriodoConfirmado[];
}

export interface GenerarMesForm {
  mes: number;
  ano: number;
  mes_fin: number;
  ano_fin: number;
  id_plantilla: number;
  /** null cuando la congregación no tiene configurado el día de reunión */
  dia_reunion: number | null;
}

// ──────────────────────────────────────────────────────
// CONFIGURACIÓN — MATRIZ DE PUBLICADORES
// ──────────────────────────────────────────────────────

export interface ColumnaPermiso {
  key: string;
  /** Encabezado corto de la columna. */
  label: string;
  /** Nombre completo del permiso (tooltip de la matriz y título en el reporte). */
  nombre_largo: string;
  solo_hombres: boolean;
}

export interface PublicadorMatrizItem {
  id_publicador: number;
  primer_nombre: string;
  primer_apellido: string;
  /** Ya resuelto por el backend (alias + regla de la congregación). */
  nombre_mostrado?: string | null;
  sexo: string;
  privilegios: string[];  // ['Anciano', 'Precursor Regular'] — all active
  permisos: Record<string, boolean>;
  nivel_oratoria?: number;
  id_grupo?: number | null;
  nombre_grupo?: string | null;
}

export interface GrupoMatrizOption {
  id_grupo: number;
  nombre_grupo: string;
}

export interface MatrizConfigResponse {
  publicadores: PublicadorMatrizItem[];
  columnas: ColumnaPermiso[];
  grupos: GrupoMatrizOption[];
}

/** Lo que el usuario elige en el diálogo "Reporte de permisos". */
export interface ReportePrivilegiosOpciones {
  formato: 'matriz' | 'resumen';
  agrupar_por: 'ninguno' | 'grupo' | 'privilegio';
  sexo: 'todos' | 'solo_hombres' | 'solo_mujeres';
  ids_grupo: number[];
  privilegio: string | null;
  permisos: string[];
  solo_con_permiso: boolean;
}

export interface CambioPermisoPublicador {
  id_publicador: number;
  permisos: Record<string, boolean>;
  nivel_oratoria?: number;
}

export interface UpdateMatrizRequest {
  id_congregacion: number;
  cambios: CambioPermisoPublicador[];
}

// ──────────────────────────────────────────────────────
// CONFIGURACIÓN — AUSENCIAS DE PUBLICADORES
// ──────────────────────────────────────────────────────

export interface AusenciaOut {
  id_ausencia: number;
  id_publicador: number;
  nombre_completo: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
}

export interface CrearAusenciaRequest {
  id_congregacion: number;
  id_publicador: number;
  fecha_inicio: string;
  fecha_fin: string;
  motivo?: string | null;
}

// ──────────────────────────────────────────────────────
// CONFIGURACIÓN — SEMANAS SIN REUNIÓN
// ──────────────────────────────────────────────────────

/** A qué reuniones afecta el evento (asamblea, congreso, Conmemoración). */
export type AlcanceSemana = 'entre_semana' | 'fin_semana' | 'ambas';

export interface SemanaSinReunion {
  id_semana_sin_reunion: number;
  ano_iso: number;
  semana_iso: number;
  alcance: AlcanceSemana;
  motivo: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  /** Cuántas asignaciones se borraron (o se borrarían, en dry_run). */
  borradas?: number | null;
}

export interface CrearSemanaSinReunionRequest {
  id_congregacion: number;
  /** Cualquier fecha de la semana: el backend deriva la semana ISO. */
  fecha: string;
  alcance: AlcanceSemana;
  motivo?: string | null;
  /** Solo informa cuánto se borraría, sin tocar nada. */
  dry_run?: boolean;
}

export interface ParteParsed {
  nombre_parte: string;
  seccion: string;
  duracion_minutos: number;
  privilegios_permitidos?: string[];
  requiere_pareja: boolean;
  aplica_sala_b: boolean;
  es_informativa: boolean;
  orden_visual: number;
  fuente_informacion?: string;
  semana_ordinal?: number;
}

export interface SemanaParsed {
  titulo_semana: string;
  lectura_semanal?: string;
  partes: ParteParsed[];
}

export interface MWBImportPreviewResponse {
  mensaje: string;
  semanas: SemanaParsed[];
}

export interface SemanaConfirm {
  semana_iso: number;
  ano: number;
  fecha_lunes: string;
  titulo_semana: string;
  lectura_semanal?: string;
  partes: ParteParsed[];
}

export interface MWBImportConfirmRequest {
  semanas: SemanaConfirm[];
}

export interface MWBImportConfirmResponse {
  mensaje: string;
  id_plantilla: number;
  partes_creadas: number;
}

/** Aviso previo del importador: si `en_uso_por` trae congregaciones,
 *  confirmar devolverá 409. */
export interface MWBDuplicadosResponse {
  existe: boolean;
  nombre: string;
  id_plantilla?: number;
  en_uso_por: { id_congregacion: number; nombre: string; programas: number }[];
}

// ──────────────────────────────────────────────────────
// PARÁMETROS DEL ALGORITMO
// ──────────────────────────────────────────────────────

export interface AlgorithmParam {
  key: string;
  value: number;
  label: string;
  description: string;
  min_val: number;
  max_val: number;
  default: number;
  step: number;
  category: 'peso_heuristico' | 'restriccion_dura' | 'ventana_tiempo';
}

export interface AlgorithmParamsResponse {
  parametros: AlgorithmParam[];
}

export interface AlgorithmParamsUpdate {
  id_congregacion: number;
  parametros: Record<string, number>;
}

export interface AlgoProfile {
  id: string;
  label: string;
  description: string;
}

export interface PlantillaParteDetail {
  id_parte?: number;
  nombre_parte: string;
  seccion: string;
  duracion_minutos?: number;
  privilegios_permitidos: string[];
  requiere_pareja: boolean;
  aplica_sala_b: boolean;
  es_informativa: boolean;
  orden_visual: number;
  fuente_informacion?: string;
  semana_ordinal?: number;
  titulo_semana?: string;
  lectura_semanal?: string;
}

export interface PlantillaDetailResponse {
  id_plantilla: number;
  nombre: string;
  tipo: string;
  tiene_sala_b: boolean;
  activo: boolean;
  partes: PlantillaParteDetail[];
}

export interface PlantillaUpdateRequest {
  nombre?: string;
  tiene_sala_b?: boolean;
  partes?: PlantillaParteDetail[];
}


// ──────────────────────────────────────────────────────
// SEGUIMIENTO DEL CONSEJERO
// ──────────────────────────────────────────────────────

export type AsistenciaSeguimiento = 'si' | 'no' | 'sustituido';
/** Contra la duración prevista de la parte. `null` cuando falta el tiempo real
 *  o la parte no tiene duración (canciones, partes fijas): de lo que no se ha
 *  medido no se dice nada. */
export type NivelTiempo = 'ok' | 'corto' | 'pasado';

export interface Seguimiento {
  id_seguimiento: number;
  id_asignacion: number;
  id_publicador: number;
  asistio?: AsistenciaSeguimiento | null;
  duracion_real_seg?: number | null;
  notas?: string | null;
  /** Lo calcula el servidor; no se guarda. */
  desviacion_seg?: number | null;
  nivel?: NivelTiempo | null;
}

/** Lo que se manda al guardar. Todo opcional: el seguimiento se rellena a
 *  trozos —el tiempo durante la reunión, las notas al día siguiente—. */
export interface SeguimientoPayload {
  id_congregacion: number;
  asistio?: AsistenciaSeguimiento | null;
  duracion_real_seg?: number | null;
  notas?: string | null;
}

export interface SeguimientoOcurrencia {
  id_asignacion: number;
  id_publicador: number;
  /** Viaja en la ocurrencia y no solo en la persona porque la vista por reunión
   *  las lista sueltas, fuera del publicador que las agrupa. */
  nombre_completo: string;
  fecha: string;
  detalle: string;
  /** 'Conductor', 'Lector', 'Ayudante'… o null si la parte la lleva una sola
   *  persona y su nombre ya basta. */
  papel?: string | null;
  sala?: string | null;
  es_ayudante: boolean;
  duracion_minutos?: number | null;
  seguimiento?: Seguimiento | null;
}

export interface SeguimientoRolDePersona {
  rol_key: string;
  etiqueta: string;
  veces: number;
  /** `null` cuando todas sus veces están por delante: "la última" no puede ser
   *  una reunión que aún no se ha celebrado. */
  ultima_fecha?: string | null;
  dias_desde_ultima?: number | null;
  proxima_fecha?: string | null;
  ocurrencias: SeguimientoOcurrencia[];
}

/** Cómo se le da el tiempo a alguien. `medidas` es el denominador honesto:
 *  solo cuenta lo cronometrado contra una duración prevista. */
export interface SeguimientoResumenTiempo {
  medidas: number;
  en_tiempo: number;
  pasado: number;
  corto: number;
  desviacion_media_seg?: number | null;
}

export interface SeguimientoPersona {
  id_publicador: number;
  nombre_completo: string;
  total: number;
  sin_seguimiento: number;
  ultima_fecha?: string | null;
  dias_desde_ultima?: number | null;
  /** La más cercana de sus partes futuras: dice que ya está cubierta. */
  proxima_fecha?: string | null;
  tiempo?: SeguimientoResumenTiempo | null;
  roles: SeguimientoRolDePersona[];
}

/** Una reunión ya celebrada con todo lo asignado en ella: la hoja de trabajo
 *  para apuntar los tiempos de una sentada al salir de la reunión. */
export interface SeguimientoReunion {
  fecha: string;
  total: number;
  registradas: number;
  partes: SeguimientoOcurrencia[];
}

/** Entre qué fechas hay algo, para poder explicar un rango vacío. */
export interface SeguimientoRangoDisponible {
  desde?: string | null;
  hasta?: string | null;
}

export interface SeguimientoPersonaDeRol {
  id_publicador: number;
  nombre_completo: string;
  veces: number;
  ultima_fecha?: string | null;
  dias_desde_ultima?: number | null;
  proxima_fecha?: string | null;
}

export interface SeguimientoRol {
  rol_key: string;
  etiqueta: string;
  total: number;
  personas: SeguimientoPersonaDeRol[];
}

export interface SeguimientoHistorialResponse {
  total_apariciones: number;
  total_personas: number;
  total_con_seguimiento: number;
  /** Ya celebradas y todavía sin registrar. */
  total_pendientes: number;
  tiempo: SeguimientoResumenTiempo;
  rango_disponible: SeguimientoRangoDisponible;
  reuniones: SeguimientoReunion[];
  personas: SeguimientoPersona[];
  roles: SeguimientoRol[];
}

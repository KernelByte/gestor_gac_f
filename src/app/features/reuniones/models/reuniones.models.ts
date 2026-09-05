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
  label: string;
  solo_hombres: boolean;
}

export interface PublicadorMatrizItem {
  id_publicador: number;
  primer_nombre: string;
  primer_apellido: string;
  sexo: string;
  privilegios: string[];  // ['Anciano', 'Precursor Regular'] — all active
  permisos: Record<string, boolean>;
  nivel_oratoria?: number;
}

export interface MatrizConfigResponse {
  publicadores: PublicadorMatrizItem[];
  columnas: ColumnaPermiso[];
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

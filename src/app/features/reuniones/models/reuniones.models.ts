export interface PlantillaOption {
  id_plantilla: number;
  nombre: string;
  tipo: string;
}

export interface CandidatoAlternativo {
  id_publicador: number;
  nombre_completo: string;
  score: number;
  notas_score: string[];
}

export interface AsignacionDraft {
  id_programa_parte: number;
  nombre_parte?: string;
  id_publicador: number;
  nombre_completo: string;
  es_reemplazo: boolean;
  estado: 'draft' | 'conflict' | 'confirmado';
  alternativos: CandidatoAlternativo[];
  _swapped?: boolean;
}

export interface ProgramaSemana {
  id_programa: number;
  semana_iso: number;
  fecha: string;
  titulo_guia: string | null;
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
  semanas: string[];
  id_plantilla: number;
}

export interface ConfirmarDraftRequest {
  tipo_reunion: string;
  semanas_iso: number[];
  ano: number;
  id_congregacion: number;
}

export interface GenerarMesForm {
  mes: number;
  ano: number;
  id_plantilla: number;
  dia_reunion: number;
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
}

export interface MatrizConfigResponse {
  publicadores: PublicadorMatrizItem[];
  columnas: ColumnaPermiso[];
}

export interface CambioPermisoPublicador {
  id_publicador: number;
  permisos: Record<string, boolean>;
}

export interface UpdateMatrizRequest {
  id_congregacion: number;
  cambios: CambioPermisoPublicador[];
}

export interface ParteParsed {
  nombre_parte: string;
  seccion: string;
  duracion_minutos: number;
  privilegios_permitidos: string[];
  requiere_pareja: boolean;
  aplica_sala_b: boolean;
  orden_visual: number;
}

export interface SemanaParsed {
  titulo_semana: string;
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
  partes: ParteParsed[];
}

export interface MWBImportConfirmRequest {
  id_congregacion: number;
  semanas: SemanaConfirm[];
}

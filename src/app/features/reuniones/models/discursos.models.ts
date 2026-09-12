export interface GenerarDiscursosRequest {
  ano: number;
  mes: number;
}

export interface ConfirmarDiscursosRequest {
  ano: number;
  mes: number;
}

/** Ubicación del salón destino: dirección legible + enlace de ruta en mapas. */
export interface UbicacionSaliente {
  direccion_destino: string | null;
  url_mapa: string | null;
  lat: number | null;
  lon: number | null;
}

/** Resultado del geocodificador (proxy backend → Photon/OSM). */
export interface GeoResultado {
  label: string;
  lat: number;
  lon: number;
}

export interface CrearSalienteRequest {
  fecha: string;
  id_publicador?: number | null;
  congregacion_destino?: string | null;
  tema_discurso?: string | null;
  hora?: string | null;
  direccion_destino?: string | null;
  url_mapa?: string | null;
  lat?: number | null;
  lon?: number | null;
  notas?: string | null;
}

export interface EditarSalienteRequest {
  id_publicador?: number | null;
  congregacion_destino?: string | null;
  tema_discurso?: string | null;
  hora?: string | null;
  direccion_destino?: string | null;
  url_mapa?: string | null;
  lat?: number | null;
  lon?: number | null;
  notas?: string | null;
}

export interface EditarEntranteRequest {
  nombre_orador?: string | null;
  congregacion_origen?: string | null;
  titulo_discurso?: string | null;
  id_grupo_hospitalidad?: number | null;
  notas?: string | null;
}

export interface PublicadorSimple {
  id_publicador: number;
  nombre_completo: string;
  telefono?: string | null;
}

export interface GrupoSimple {
  id_grupo: number;
  nombre_grupo: string;
}

export type EstadoDiscursoSaliente = 'programado' | 'realizada' | 'cancelado';

export interface DiscursoSalienteOut {
  id_discurso_saliente: number;
  fecha: string;
  id_publicador: number | null;
  publicador: PublicadorSimple | null;
  congregacion_destino: string | null;
  tema_discurso: string | null;
  /** Copia congelada del id de docs.jw.org al momento de escribir tema_discurso; null si no matcheó el catálogo. */
  meps_document_id: number | null;
  hora: string | null;
  direccion_destino: string | null;
  url_mapa: string | null;
  lat: number | null;
  lon: number | null;
  notas: string | null;
  confirmado: boolean;
  /** El discurso ya se dio: a mano, o automático al pasar la fecha/hora. */
  presentado: boolean;
  presentado_en: string | null;
  /** Fijado por una persona; el marcado automático ya no lo toca. */
  presentado_manual: boolean;
  /** Quién lo marcó. null con presentado=true significa que lo marcó el sistema. */
  presentado_por: string | null;
  /** La salida se canceló antes de la fecha. */
  cancelado: boolean;
  cancelado_en: string | null;
  cancelado_por: string | null;
  /** Derivado de presentado/cancelado. */
  estado: EstadoDiscursoSaliente;
  mes: number;
  ano: number;
}

export interface DiscursoEntranteOut {
  id_discurso_entrante: number;
  fecha: string;
  nombre_orador: string | null;
  congregacion_origen: string | null;
  titulo_discurso: string | null;
  id_grupo_hospitalidad: number | null;
  grupo_hospitalidad: GrupoSimple | null;
  notas: string | null;
  /** El MES está cerrado (lo pone «Confirmar mes»); bloquea la edición. */
  confirmado: boolean;
  /** El organizador llamó a la congregación de origen y le confirmaron el orador. */
  orador_confirmado: boolean;
  orador_confirmado_en: string | null;
  orador_confirmado_por: string | null;
  /** El discurso ya se dio: a mano, o automático al pasar la hora de la reunión. */
  presentado: boolean;
  presentado_en: string | null;
  /** Fijado por una persona; el marcado automático ya no lo toca. */
  presentado_manual: boolean;
  /** Quién lo marcó. null con presentado=true significa que lo marcó el sistema. */
  presentado_por: string | null;
  mes: number;
  ano: number;
}

export interface DiscursosMesOut {
  ano: number;
  mes: number;
  id_congregacion: number;
  confirmado: boolean;
  fechas: string[];
  salientes: DiscursoSalienteOut[];
  entrantes: DiscursoEntranteOut[];
}

export interface MesDiscursosDisponible {
  ano: number;
  mes: number;
  confirmado: boolean;
}

// ── Directorio de congregaciones de contacto ─────────────────────────────────

export interface ContactoPersona {
  id_contacto_persona: number;
  nombre: string;
  cargo: string | null;
  telefono: string | null;
  es_principal: boolean;
}

export interface CongregacionContacto {
  id_congregacion_contacto: number;
  nombre: string;
  dia_reunion_fin_semana: string | null;
  hora_reunion_fin_semana: string | null;
  direccion: string | null;
  url_mapa: string | null;
  lat: number | null;
  lon: number | null;
  notas: string | null;
  personas: ContactoPersona[];
}

export interface CrearCongregacionContactoRequest {
  nombre: string;
  dia_reunion_fin_semana?: string | null;
  hora_reunion_fin_semana?: string | null;
  direccion?: string | null;
  url_mapa?: string | null;
  lat?: number | null;
  lon?: number | null;
  notas?: string | null;
}

export interface EditarCongregacionContactoRequest {
  nombre?: string | null;
  dia_reunion_fin_semana?: string | null;
  hora_reunion_fin_semana?: string | null;
  direccion?: string | null;
  url_mapa?: string | null;
  lat?: number | null;
  lon?: number | null;
  notas?: string | null;
}

export interface CrearPersonaRequest {
  nombre: string;
  cargo?: string | null;
  telefono?: string | null;
  es_principal?: boolean;
}

export interface EditarPersonaRequest {
  nombre?: string | null;
  cargo?: string | null;
  telefono?: string | null;
  es_principal?: boolean | null;
}

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export interface TemaPublicador {
  id_tema: number;
  id_publicador: number;
  nombre_publicador: string;
  numero_tema: number | null;
  titulo: string;
  activo: boolean;
}

export interface CrearTemaRequest {
  id_publicador: number;
  numero_tema?: number | null;
  titulo: string;
}

export interface EditarTemaRequest {
  numero_tema?: number | null;
  titulo?: string;
  activo?: boolean;
}

/** Un bosquejo del S-34. El catálogo es global: no depende de la congregación. */
export interface CatalogoDiscurso {
  numero: number;
  titulo: string;
  idioma: string;
  activo: boolean;
}

/** Qué edición del S-34 está cargada y cuándo se importó. */
export interface CatalogoPublicacion {
  simbolo: string | null;
  titulo_publicacion: string | null;
  idioma: string;
  ano: number | null;
  archivo: string | null;
  total: number;
  importado_en: string | null;
}

export interface CatalogoResponse {
  publicacion: CatalogoPublicacion | null;
  discursos: CatalogoDiscurso[];
}

/** Un cántico de "Cantemos con gozo a Jehová". Himnario fijo, catálogo global. */
export interface CatalogoCantico {
  numero: number;
  titulo: string;
}

/** Qué archivo se cargó por última vez y cuándo. */
export interface CatalogoCanticosPublicacion {
  archivo: string | null;
  total: number;
  importado_en: string | null;
}

export interface CatalogoCanticosResponse {
  publicacion: CatalogoCanticosPublicacion | null;
  canticos: CatalogoCantico[];
}

export interface ResumenImportacionCanticos extends CatalogoCanticosResponse {
  total: number;
  insertados: number;
  actualizados: number;
  desactivados: number;
}

export interface ResumenImportacion extends CatalogoResponse {
  idioma: string;
  simbolo: string | null;
  titulo_publicacion: string | null;
  ano: number | null;
  total: number;
  insertados: number;
  actualizados: number;
  desactivados: number;
}

// ── Historial de discursos ───────────────────────────────────────────────────

export interface HistorialOcurrenciaEntrante {
  fecha: string;
  nombre_orador: string | null;
  congregacion_origen: string | null;
  presentado: boolean;
}

export interface HistorialDiscursoEntrante {
  numero: number | null;
  titulo: string;
  veces: number;
  ocurrencias: HistorialOcurrenciaEntrante[];
}

export interface HistorialEntrantesOut {
  desde: string | null;
  hasta: string | null;
  total_discursos: number;
  total_repetidos: number;
  items: HistorialDiscursoEntrante[];
}

/**
 * Aviso proactivo: discursos entrantes previos que coinciden con el título que
 * se está escribiendo, dentro de la ventana de meses del backend
 * (`MESES_ALERTA_REPETIDO`). Reutiliza la forma de `HistorialOcurrenciaEntrante`
 * porque son literalmente el mismo dato.
 */
export interface VerificarRepeticionOut {
  repeticiones: HistorialOcurrenciaEntrante[];
}

export interface HistorialOcurrenciaSaliente {
  fecha: string;
  congregacion_destino: string | null;
}

export interface HistorialTemaSaliente {
  numero: number | null;
  titulo: string;
  veces: number;
  ocurrencias: HistorialOcurrenciaSaliente[];
}

export interface HistorialOradorSaliente {
  id_publicador: number | null;
  nombre_completo: string;
  total: number;
  temas_distintos: number;
  temas: HistorialTemaSaliente[];
}

export interface HistorialSalientesOut {
  desde: string | null;
  hasta: string | null;
  total_discursos: number;
  items: HistorialOradorSaliente[];
}

/**
 * Modelos del módulo de Exhibidores (v2).
 * Coordenadas como GeoJSON Point, mismo contrato que territorios.
 */

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [lon, lat]
}

export interface PublicadorLiteRef {
  id_publicador: number;
  nombre_completo: string;
  sexo?: string;
}

// ── Catálogo ─────────────────────────────────────────────────

export interface PuntoSacada {
  id_punto_sacada: number;
  nombre: string;
  direccion: string | null;
  coordenadas: GeoJSONPoint | null;
  referencia: string | null;
  responsable: PublicadorLiteRef | null;
  activo: boolean;
}

export interface TurnoExhibidor {
  id_turno_exhibidor: number;
  id_ubicacion_exhibidor: number;
  dia_semana: number; // 0 = lunes … 6 = domingo
  dia_nombre: string;
  hora_inicio: string; // 'HH:MM'
  hora_fin: string;
  capacidad: number;
  notas: string | null;
  activo: boolean;
}

/**
 * Composición exigida por el punto. La pareja mixta (hombre + mujer) no se
 * configura aquí: solo se admite si las dos personas están vinculadas como
 * matrimonio o familia en la pestaña Participantes.
 */
export type ComposicionPareja = 'indistinto' | 'solo_varones' | 'solo_mujeres';

export interface UbicacionExhibidor {
  id_ubicacion_exhibidor: number;
  nombre: string;
  direccion: string | null;
  coordenadas: GeoJSONPoint | null;
  id_territorio: number | null;
  id_punto_sacada: number | null;
  punto_sacada: PuntoSacada | null;
  estado: 'activo' | 'mantenimiento';
  composicion: ComposicionPareja;
  requiere_fluidez: boolean;
  preferir_mezcla_edad: boolean;
  orden: number;
  notas: string | null;
  activo: boolean;
  turnos: TurnoExhibidor[];
}

export interface FechaBloqueada {
  id_fecha_bloqueada: number;
  fecha: string; // 'YYYY-MM-DD'
  motivo: string | null;
  id_ubicacion_exhibidor: number | null; // null = todas
  ubicacion_nombre: string | null;
}

// ── Programación ─────────────────────────────────────────────

export type EstadoAsignacion = 'asignado' | 'ausente' | 'reasignado';

export interface ExhibidorAsignacion {
  id_exhibidor_asignacion: number;
  id_turno_exhibidor: number;
  fecha: string;
  posicion: number;
  publicador: PublicadorLiteRef | null;
  estado: EstadoAsignacion;
  publicador_original: PublicadorLiteRef | null;
  motivo_ausencia: string | null;
  notas: string | null;
  confirmado: boolean;
}

export interface TurnoGrilla extends TurnoExhibidor {
  ubicacion_nombre: string;
  estado_ubicacion: string;
}

export interface ConflictoGeneracion {
  id_turno_exhibidor: number;
  ubicacion_nombre: string;
  fecha: string;
  posicion: number | null;
  motivo: string;
}

/** Cómo decide el generador el punto de cada persona dentro del periodo. */
export type ModoAsignacion = 'rotativo' | 'fijo';

/** Cada cuánto se arma y se confirma la programación. */
export type Periodicidad = 'mensual' | 'quincenal';

/** 1 = días 1–15, 2 = 16–fin de mes. */
export type Quincena = 1 | 2;

export interface QuincenaEstado {
  quincena: Quincena;
  nombre: string;
  generado: boolean;
  confirmado: boolean;
  cobertura: { total: number; cubiertas: number };
}

export interface ProgramacionMes {
  ano: number;
  mes: number;
  mes_nombre: string;
  generado: boolean;
  confirmado: boolean;
  cobertura: { total: number; cubiertas: number };
  modo: ModoAsignacion;
  periodicidad: Periodicidad;
  quincenas: QuincenaEstado[];
  turnos: TurnoGrilla[];
  asignaciones: ExhibidorAsignacion[];
  fechas_bloqueadas: { fecha: string; motivo: string | null; id_ubicacion_exhibidor: number | null }[];
  conflictos?: ConflictoGeneracion[];
}

export interface MesDisponible {
  ano: number;
  mes: number;
  mes_nombre: string;
  confirmado: boolean;
}

export interface CandidatoSlot {
  id_publicador: number;
  nombre: string;
  tiene_fluidez: boolean;
  es_precursor: boolean;
  elegible: boolean;
  score: number | null;
  notas: string[];
}

export interface CandidatosSlotResponse {
  slot: {
    fecha: string;
    dia_nombre: string;
    ubicacion_nombre: string;
    hora_inicio: string;
    hora_fin: string;
    posicion: number;
  };
  candidatos: CandidatoSlot[];
}

export interface MiTurno {
  fecha: string;
  dia_nombre: string;
  ubicacion_nombre: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
}

export interface ConflictoDetalle {
  tipo: string;
  detalle: string;
  fecha: string;
}

export interface ConflictoResponse {
  tiene_conflicto: boolean;
  asignaciones: ConflictoDetalle[];
}

// ── Participantes ────────────────────────────────────────────

/**
 * Franja del día en que la persona puede salir. Las dos marcadas (o ninguna)
 * = libre/todo el día; el backend las traduce a horas — ver engine/franjas.py.
 */
export type FranjaDia = 'manana' | 'tarde';

export interface Participante extends PublicadorLiteRef {
  es_exhibidor: boolean;
  tiene_fluidez: boolean;
  dias_disponibles: number[];
  franjas: FranjaDia[];
  max_turnos_mes: number | null;
  notas: string | null;
  activo: boolean;
  ubicaciones_vetadas: number[];
}

export interface ParticipanteUpdate {
  es_exhibidor: boolean;
  tiene_fluidez: boolean;
  dias_disponibles: number[];
  franjas: FranjaDia[];
  max_turnos_mes: number | null;
  notas: string | null;
  activo: boolean;
  ubicaciones_vetadas: number[];
}

export type AccionVinculo = 'siempre_juntos' | 'preferir_juntos' | 'nunca_juntos';
export type TipoVinculo = 'matrimonio' | 'hermanos' | 'otro';

export interface Vinculo {
  id_vinculo: number;
  publicador_a: PublicadorLiteRef;
  publicador_b: PublicadorLiteRef;
  tipo: TipoVinculo;
  accion: AccionVinculo;
}

export interface HistorialParticipante {
  id_publicador: number;
  nombre_completo: string;
  total_salidas: number;
  ultima_salida: string | null;
  puntos_distintos: number;
}

// ── Configuración ────────────────────────────────────────────

export interface ParametroAlgoritmo {
  key: string;
  value: number;
  label: string;
  description: string;
  min_val: number;
  max_val: number;
  default: number;
  step: number;
  category: string;
}

export interface PerfilAlgoritmo {
  id: string;
  label: string;
  description: string;
}

export interface OpcionPreferencia {
  id: string;
  label: string;
  description: string;
}

/** Preferencia enumerada de la congregación (modo de asignación, periodicidad…). */
export interface PreferenciaExhibidor {
  key: string;
  value: string;
  default: string;
  label: string;
  description: string;
  /** Solo se muestra si estas otras preferencias tienen estos valores. */
  solo_si: Record<string, string> | null;
  options: OpcionPreferencia[];
}

export interface PreferenciasResponse {
  preferencias: PreferenciaExhibidor[];
  valores: Record<string, string>;
}

export const DIAS_SEMANA = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
] as const;

export const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

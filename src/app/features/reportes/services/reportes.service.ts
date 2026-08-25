import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

export interface KPIItem {
  label: string;
  value: number;
  hint?: string | null;
}

export interface SeriePunto {
  label: string;
  value: number;
}

// ── Análisis de precursores (matriz por año de servicio) ──────────────

export type EstadoPrecursor = 'en_meta' | 'atencion' | 'riesgo' | 'exento';

/**
 * Consideración especial: exime del requisito de horas por edad avanzada o
 * salud delicada. Se otorga desde Publicadores › drawer › Privilegios.
 * No confundir con `horas_credito` (Betel, Salón de Asambleas), que son horas
 * reales acreditadas y siguen sumando también en meses exentos.
 */
export interface ConsideracionEspecial {
  motivo: string;
  motivo_label: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  descripcion?: string | null;
}

export interface MesColumna {
  anio: number;
  mes: number;
  label: string;
  cerrado: boolean;
}

export interface MesPrecursor {
  anio: number;
  mes: number;
  horas: number;
  horas_credito: number;
  total: number;
  cursos_biblicos: number;
  vigente: boolean;
  exento: boolean;   // consideración especial vigente ese mes (no genera meta)
  informado: boolean;
}

export interface TrimestreResumen {
  total: number;
  promedio: number;
  acu: number;
}

export interface PrecursorFila {
  id_publicador: number;
  nombre: string;
  mes_inicio_privilegio?: string | null;
  meses: MesPrecursor[];
  trimestres: TrimestreResumen[];
  total_anual: number;
  promedio: number;
  acu: number;
  meta_prorrateada: number;
  meses_vigentes: number;
  meses_exigibles: number;   // meses vigentes SIN consideración especial
  exento: boolean;           // todo el año cubierto por consideración especial
  consideracion?: ConsideracionEspecial | null;
  proyeccion_anual: number;
  cursos_total: number;
  estado: EstadoPrecursor;
  seguimientos_count: number;
}

export interface SeriePuntoMeta {
  label: string;
  value: number;
  meta: number;
}

export interface PrecursoresMatriz {
  anio_servicio: number;
  anios_disponibles: number[];
  meses: MesColumna[];
  kpis: KPIItem[];
  kpis_otros: { auxiliares?: number; especiales?: number };
  tendencia_horas: SeriePuntoMeta[];
  precursores: PrecursorFila[];
}

// ── Detalle de un precursor ────────────────────────────────────────────

export interface MesDetalle extends MesPrecursor {
  label: string;
  participo: boolean;
  observaciones?: string | null;
}

export interface PrecursorResumen {
  total_anual: number;
  promedio: number;
  acu: number;
  meta_prorrateada: number;
  meses_vigentes: number;
  meses_exigibles: number;
  exento: boolean;
  consideracion?: ConsideracionEspecial | null;
  horas_restantes: number;
  meses_restantes: number;
  promedio_necesario_restante: number;
  proyeccion_anual: number;
  estado: EstadoPrecursor;
  cursos_total: number;
  cursos_promedio: number;
}

export interface HistoricoAnio {
  anio_servicio: number;
  total: number;
  meta: number;
  cumplio: boolean;
  exento: boolean;  // año cubierto por consideración especial
}

export type TipoSeguimiento = 'reunion_ayuda' | 'decision_comite' | 'nota';

export interface Seguimiento {
  id_seguimiento: number;
  anio_servicio: number;
  fecha: string;
  tipo: TipoSeguimiento;
  descripcion: string;
  creado_por_nombre?: string | null;
  fecha_creacion?: string | null;
}

export interface SeguimientoCreate {
  fecha?: string | null;
  tipo: TipoSeguimiento;
  descripcion: string;
}

export interface PrecursorDetalle {
  id_publicador: number;
  nombre: string;
  anio_servicio: number;
  anios_disponibles: number[];
  grupo?: string | null;
  edad?: number | null;
  fecha_inicio_precursor?: string | null;
  antiguedad_anios?: number | null;
  mes_inicio_privilegio?: string | null;
  meses: MesDetalle[];
  resumen: PrecursorResumen;
  historico_anios: HistoricoAnio[];
  seguimientos: Seguimiento[];
}

// ── Otros dashboards ───────────────────────────────────────────────────

export interface ActividadMes {
  label: string;
  participaron: number;
  sin_informe: number;
}

export interface FlujoMes {
  label: string;
  nuevos_inactivos: number;
  reactivados: number;
}

export type EstadoRiesgo = 'atencion' | 'riesgo';

export interface RiesgoPublicador {
  id_publicador: number;
  nombre: string;
  grupo?: string | null;
  meses_sin_informar: number;
  ultimo_mes?: string | null;
  estado: EstadoRiesgo;
}

export interface SinBautizarItem {
  id_publicador: number;
  nombre: string;
  grupo?: string | null;
  publicador_desde?: string | null;
  meses_como_publicador?: number | null;
}

/** Reparto bautizados / no bautizados dentro de un grupo de predicación. */
export interface BautismoGrupo {
  grupo: string;
  total: number;
  bautizados: number;
  no_bautizados: number;
  pct_bautizados: number;
}

export interface GrupoCapacidad {
  grupo: string;
  publicadores: number;
  ancianos: number;
  siervos: number;
}

export interface PiramidePunto {
  rango: string;
  masculino: number;
  femenino: number;
}

export interface PublicadoresReporte {
  anio_servicio: number;
  anios_disponibles: number[];
  kpis: KPIItem[];
  // Demografía
  distribucion_genero: SeriePunto[];
  distribucion_edad: SeriePunto[];
  distribucion_grupo: SeriePunto[];
  piramide_edad: PiramidePunto[];
  edad_promedio_grupo: SeriePunto[];
  horas_por_edad: SeriePunto[];
  // Actividad
  actividad_mensual: ActividadMes[];
  riesgo_inactividad: RiesgoPublicador[];
  entrega_por_grupo: SeriePunto[];
  flujo_actividad: FlujoMes[];
  // Crecimiento
  bautismos_por_anio: SeriePunto[];
  antiguedad_bautismo: SeriePunto[];
  bautismo_por_grupo: BautismoGrupo[];
  /** Mismo reparto contando también a los publicadores inactivos. */
  bautismo_por_grupo_con_inactivos: BautismoGrupo[];
  sin_bautizar: SinBautizarItem[];
  cursos_mensuales: SeriePunto[];
  // Capacidad de servicio
  capacidad_grupos: GrupoCapacidad[];
  auxiliares_por_mes: SeriePunto[];
}

export interface PredicacionReporte {
  kpis: KPIItem[];
  horas_mensuales: SeriePunto[];
  cursos_mensuales: SeriePunto[];
  horas_por_grupo: SeriePunto[];
}

// ── Carga de trabajo de logística ──────────────────────────────────────

/**
 * Cuánto trabajo lleva alguien respecto al promedio del periodo consultado.
 * Es relativo a propósito: 4 tareas al mes son muchas donde hay treinta
 * habilitados y pocas donde hay seis.
 */
export type NivelCarga = 'baja' | 'normal' | 'alta';

export interface CargaAsignacion {
  fecha: string;
  puesto: string;
}

export interface CargaPersona {
  id_publicador: number;
  nombre: string;
  grupo?: string | null;
  sexo?: string | null;
  total: number;
  /** Clave de categoría ('audio', 'microfono'…) → veces que la cubrió. */
  por_categoria: Record<string, number>;
  nivel: NivelCarga;
  /** Distingue a quien nunca participó de quien participó y dejó de hacerlo. */
  ultima_fecha?: string | null;
  /** Detalle fecha + puesto de cada una de las `total` asignaciones. */
  asignaciones: CargaAsignacion[];
}

export interface CargaCategoria {
  categoria: string;
  total: number;
  personas: number;
  disponibles: number;
  /** Cuántos de los habilitados llegaron a cubrirla. Bajo = recae en los mismos. */
  reparto_pct: number;
}

export interface CargaGrupo {
  id_grupo: number;
  nombre: string;
  total: number;
  nivel: NivelCarga;
  ultima_fecha?: string | null;
}

export interface CargaGrupoOpcion {
  id_grupo: number;
  nombre_grupo: string;
}

export interface CargaPrivilegioOpcion {
  id_privilegio: number;
  nombre_privilegio: string;
}

export interface LogisticaCargaFiltros {
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  categoria?: string | null;
  id_publicador?: number | null;
  id_grupo?: number | null;
  sexo?: string | null;
  id_privilegio?: number | null;
}

export interface LogisticaCargaReporte {
  desde: string;
  hasta: string;
  periodo_label: string;
  promedio: number;
  kpis: KPIItem[];
  por_persona: CargaPersona[];
  por_categoria: CargaCategoria[];
  por_grupo: CargaGrupo[];
  grupos: CargaGrupoOpcion[];
  privilegios: CargaPrivilegioOpcion[];
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/reportes`;

  private anioParams(anioServicio?: number | null): HttpParams {
    let params = new HttpParams();
    if (anioServicio) params = params.set('anio_servicio', anioServicio);
    return params;
  }

  getPrecursores(anioServicio?: number | null): Observable<PrecursoresMatriz> {
    return this.http.get<PrecursoresMatriz>(`${this.base}/precursores`, {
      params: this.anioParams(anioServicio),
    });
  }

  getPrecursorDetalle(idPublicador: number, anioServicio?: number | null): Observable<PrecursorDetalle> {
    return this.http.get<PrecursorDetalle>(`${this.base}/precursores/${idPublicador}`, {
      params: this.anioParams(anioServicio),
    });
  }

  crearSeguimiento(idPublicador: number, payload: SeguimientoCreate): Observable<Seguimiento> {
    return this.http.post<Seguimiento>(`${this.base}/precursores/${idPublicador}/seguimientos`, payload);
  }

  eliminarSeguimiento(idPublicador: number, idSeguimiento: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/precursores/${idPublicador}/seguimientos/${idSeguimiento}`);
  }

  getPublicadores(anioServicio?: number | null): Observable<PublicadoresReporte> {
    return this.http.get<PublicadoresReporte>(`${this.base}/publicadores`, {
      params: this.anioParams(anioServicio),
    });
  }

  getPredicacion(): Observable<PredicacionReporte> {
    return this.http.get<PredicacionReporte>(`${this.base}/predicacion`);
  }

  private logisticaCargaParams(filtros: LogisticaCargaFiltros): HttpParams {
    let params = new HttpParams();
    // Un filtro sin elegir no debe viajar: el backend distingue "sin rango"
    // (usa su ventana por defecto) de un rango vacío.
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== undefined && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return params;
  }

  getLogisticaCarga(filtros: LogisticaCargaFiltros = {}): Observable<LogisticaCargaReporte> {
    return this.http.get<LogisticaCargaReporte>(`${this.base}/logistica`, {
      params: this.logisticaCargaParams(filtros),
    });
  }

  /** Mismos filtros que en pantalla — el .xlsx exporta exactamente lo que se ve. */
  exportarLogisticaXlsx(filtros: LogisticaCargaFiltros = {}): Observable<Blob> {
    return this.http.get(`${this.base}/logistica/exportar`, {
      params: this.logisticaCargaParams(filtros),
      responseType: 'blob',
    });
  }
}

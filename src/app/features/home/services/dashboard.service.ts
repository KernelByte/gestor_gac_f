import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';

/** Lo que el dashboard lee de /reuniones/resumen-movil (la misma fuente del Inicio móvil). */
export interface ParteResumen {
  nombre: string;
  es_mia: boolean;
  es_mia_ayudante: boolean;
  es_mia_sala_b: boolean;
  es_mia_ayudante_b: boolean;
}

export interface ReunionResumenMovil {
  tipo: 'entre_semana' | 'fin_semana';
  fecha: string | null;
  hora: string | null;
  dias_restantes: number | null;
  mis_partes: string[];
  secciones: { seccion: string; titulo: string; partes: ParteResumen[] }[];
  mi_discurso_saliente: { congregacion_destino: string | null; tema: string | null; hora: string | null } | null;
  discurso_publico: { titulo: string | null; orador: string | null } | null;
  logistica: {
    apoyo_auditorio: { rol: string; nombres: string[]; es_mia: boolean }[];
    tecnica: { rol: string; nombres: string[]; es_mia: boolean }[];
    aseo: string[];
    aseo_es_mio: boolean;
  } | null;
}

export interface ResumenMovil { reuniones: ReunionResumenMovil[] }

export interface MiInforme {
  periodo_id: number;
  periodo_descripcion: string | null;
  periodo_ano: number | null;
  periodo_mes: number | null;
  enviado: boolean;
  participo: boolean | null;
  horas: number | null;
  cursos_biblicos: number | null;
  requiere_horas: boolean;
  en_lista: boolean;
}

export interface PeriodoActivo { id_periodo: number }

export interface PlanLectura {
  plan: { id_plan: number; sesiones_total: number } | null;
  sesiones_completadas: number[];
  resumen: { porcentaje: number; racha: number; ultima_lectura: string | null } | null;
}

export interface SalidaPredicacion {
  id_horario: number;
  fecha: string;
  hora_inicio: string | null;
  lugar: string | null;
  punto: { nombre: string | null } | null;
  codigo_territorio: string | null;
  capitanes: { id_publicador: number; nombre: string }[];
  sin_salida: boolean;
  es_de_mi_grupo: boolean;
  soy_capitan: boolean;
}

export interface ProgramaPredicacion { encargado: boolean; salidas: SalidaPredicacion[] }

export interface MiPublicador { nombre_congregacion?: string | null; nombre_grupo?: string | null }

/** Fuentes del dashboard que no tenían servicio en la web. El resto usa los servicios de cada módulo. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private ctx = inject(CongregacionContextService);
  private api = environment.apiUrl;

  resumenMovil(): Observable<ResumenMovil> {
    return this.http.get<ResumenMovil>(`${this.api}/reuniones/resumen-movil`);
  }

  periodoActivo(): Observable<PeriodoActivo> {
    return this.http.get<PeriodoActivo>(`${this.api}/periodos/activo`);
  }

  miInforme(periodoId: number): Observable<MiInforme> {
    return this.http.get<MiInforme>(`${this.api}/informes/mi-informe`, {
      params: new HttpParams().set('periodo_id', periodoId),
    });
  }

  planLectura(): Observable<PlanLectura> {
    return this.http.get<PlanLectura>(`${this.api}/lectura-biblia/plan`);
  }

  miPublicador(): Observable<MiPublicador> {
    return this.http.get<MiPublicador>(`${this.api}/auth/me/publicador`);
  }

  /** El Administrador no tiene congregación propia: la toma del selector. */
  programaPredicacion(desde: string, hasta: string): Observable<ProgramaPredicacion> {
    let params = new HttpParams().set('desde', desde).set('hasta', hasta);
    const id = this.ctx.effectiveCongregacionId();
    if (id) params = params.set('id_congregacion', id);
    return this.http.get<ProgramaPredicacion>(`${this.api}/predicacion/programa`, { params });
  }
}

/** YYYY-MM-DD en hora local (no UTC: a las 8 p. m. en Colombia toISOString ya es mañana). */
export function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fechaLocal(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

export function diasHasta(iso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((fechaLocal(iso).getTime() - hoy.getTime()) / 86_400_000);
}

/** «Hoy», «Mañana», «Martes 11 de noviembre». */
export function diaLegible(iso: string): string {
  const d = diasHasta(iso);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Ayer';
  const t = fechaLocal(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "19:00" → "7:00 p. m." */
export function horaLegible(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function mesCorto(iso: string): string {
  return MESES[fechaLocal(iso).getMonth()].slice(0, 3);
}

/**
 * Factor de escala de la interfaz: el tamaño base (1rem) sube en pantallas 2K y 4K,
 * y todo lo medido en rem crece con él. Los cálculos en px deben multiplicarse por esto.
 */
export function escalaUI(): number {
  if (typeof document === 'undefined') return 1;
  return (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
}

/** Cuántas filas de `alto` px (a 16 px de base) caben en `disponible` (al menos `min`). */
export function filasQueCaben(disponible: number, alto: number, min = 1): number {
  return Math.max(min, Math.floor((disponible + 1) / (alto * escalaUI())));
}

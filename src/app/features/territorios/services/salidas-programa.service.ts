import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';

export interface PersonaRef { id_publicador: number; nombre: string; }
export interface GrupoRef { id_grupo: number; nombre: string; }
export interface GrupoOpcion extends GrupoRef { id_capitan?: number | null; }

/** Una salida del programa (/horarios). */
export interface SalidaProgramada {
  id_horario: number;
  fecha_programada: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  lugar?: string | null;
  notas?: string | null;
  id_territorio?: number | null;
  codigo_territorio?: string | null;
  nombre_territorio?: string | null;
  id_punto_salida?: number | null;
  nombre_punto_salida?: string | null;
  /** Barrio donde se predica (opcional): de él salen las manzanas que se sugieren. */
  id_sector?: number | null;
  nombre_barrio?: string | null;
  /** «No se salió»: la salida pasó y no se predicó; ya no cuenta como pendiente de registrar. */
  sin_salida?: boolean;
  /** Por Zoom: no se maneja territorio (ni manzanas que tocan ni «Por registrar»). */
  por_zoom?: boolean;
  /** Sin barrio pero con punto de salida: el barrio de ese punto, para proponerlo. */
  id_sector_sugerido?: number | null;
  /** Lo que se predicó en esta salida (Seguimiento). */
  registro?: RegistroSalida | null;
  capitanes: PersonaRef[];
  grupos: GrupoRef[];
}

export interface RegistroSalida {
  registrada: boolean;
  numeros: string[];
  manzanas: Array<{ id_manzana: number; numero: string; codigo: string }>;
  /** Hasta dónde llegaron, p. ej. «38 (T09)». */
  hasta: string | null;
}

/** Una fila de la semana tipo (1 = lunes). */
export interface FilaSemanaTipo {
  id_plantilla?: number;
  dia_semana: number;
  hora_inicio?: string | null;
  lugar?: string | null;
  notas?: string | null;
  por_zoom?: boolean;
  id_sector?: number | null;
  nombre_barrio?: string | null;
  id_punto_salida?: number | null;
  nombre_punto_salida?: string | null;
  capitanes: PersonaRef[];
  grupos: GrupoRef[];
}

/** Lo que se envía al guardar una salida o una fila de la semana tipo. */
export interface SalidaForm {
  fecha_programada?: string;
  dia_semana?: number;
  hora_inicio: string | null;
  lugar: string | null;
  notas: string | null;
  por_zoom?: boolean;
  id_territorio?: number | null;
  id_sector?: number | null;
  id_punto_salida?: number | null;
  capitanes: number[];
  grupos: number[];
}

/** Preferencias del programa: semana o mes, y si la congregación usa Zoom. */
export interface PreferenciasPrograma {
  periodo: Periodo;
  nombre_congregacion?: string | null;
  usa_zoom?: boolean;
  tiene_enlace_zoom?: boolean;
}

export type ModoCrear = 'nuevo' | 'faltantes' | 'reemplazar';
export type Periodo = 'semana' | 'mes';

/** Programa de salidas: qué días se predica, dónde, quién saca el grupo y en qué territorio. */
@Injectable({ providedIn: 'root' })
export class SalidasProgramaService {
  private http = inject(HttpClient);
  private ctx = inject(CongregacionContextService);
  private readonly url = '/api/horarios';

  private params(extra: Record<string, string> = {}): HttpParams {
    let p = new HttpParams({ fromObject: extra });
    const cong = this.ctx.effectiveCongregacionId();
    if (cong) p = p.set('id_congregacion', String(cong));
    return p;
  }

  listar(desde: string, hasta: string): Observable<SalidaProgramada[]> {
    return this.http.get<SalidaProgramada[]>(this.url, { params: this.params({ desde, hasta }) });
  }

  crear(f: SalidaForm): Observable<SalidaProgramada> {
    return this.http.post<SalidaProgramada>(this.url, { ...f, id_congregacion: this.ctx.effectiveCongregacionId() });
  }

  actualizar(id: number, f: SalidaForm): Observable<SalidaProgramada> {
    return this.http.put<SalidaProgramada>(`${this.url}/${id}`, f);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Borra todas las salidas del periodo. */
  borrarPeriodo(desde: string, hasta: string): Observable<{ borradas: number }> {
    return this.http.post<{ borradas: number }>(`${this.url}/borrar-periodo`, { desde, hasta }, { params: this.params() });
  }

  semanaTipo(): Observable<FilaSemanaTipo[]> {
    return this.http.get<FilaSemanaTipo[]>(`${this.url}/plantilla`, { params: this.params() });
  }

  guardarSemanaTipo(filas: SalidaForm[]): Observable<FilaSemanaTipo[]> {
    return this.http.put<FilaSemanaTipo[]>(`${this.url}/plantilla`, filas, { params: this.params() });
  }

  /**
   * Crea el programa del periodo con las salidas fijas.
   * nuevo: 409 si ya hay salidas · faltantes: agrega solo las que faltan · reemplazar: empieza de nuevo.
   */
  generar(desde: string, hasta: string, modo: ModoCrear = 'nuevo'): Observable<SalidaProgramada[]> {
    return this.http.post<SalidaProgramada[]>(`${this.url}/generar`, { desde, hasta, modo }, { params: this.params() });
  }

  /** Quienes tienen el permiso «Cap. Predicación» (Reuniones → Configuración). */
  capitanes(): Observable<PersonaRef[]> {
    return this.http.get<PersonaRef[]>(`${this.url}/capitanes`, { params: this.params() });
  }

  grupos(): Observable<GrupoOpcion[]> {
    return this.http.get<GrupoOpcion[]>(`${this.url}/grupos`, { params: this.params() });
  }

  periodo(): Observable<PreferenciasPrograma> {
    return this.http.get<PreferenciasPrograma>(`${this.url}/preferencias`, { params: this.params() });
  }

  guardarPeriodo(periodo: Periodo): Observable<{ periodo: Periodo }> {
    return this.http.put<{ periodo: Periodo }>(`${this.url}/preferencias`, { periodo }, { params: this.params() });
  }
}

// ── Fechas (siempre en hora local; 'YYYY-MM-DD') ─────────────────────────────

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function aIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

export function deIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Inicio y fin del periodo que contiene `ref`: semana lunes–domingo o mes calendario. */
export function rangoDe(ref: Date, periodo: Periodo): { desde: Date; hasta: Date } {
  if (periodo === 'mes') {
    return { desde: new Date(ref.getFullYear(), ref.getMonth(), 1), hasta: new Date(ref.getFullYear(), ref.getMonth() + 1, 0) };
  }
  const desde = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ((ref.getDay() + 6) % 7));
  return { desde, hasta: new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 6) };
}

export function moverPeriodo(ref: Date, periodo: Periodo, paso: number): Date {
  return periodo === 'mes'
    ? new Date(ref.getFullYear(), ref.getMonth() + paso, 1)
    : new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 7 * paso);
}

const fmtDiaMes = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' });
const fmtMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });

/** "Semana del 19 de octubre" / "Octubre de 2026". */
export function tituloPeriodo(desde: Date, periodo: Periodo): string {
  if (periodo === 'mes') {
    const t = fmtMes.format(desde);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return `Semana del ${fmtDiaMes.format(desde)}`;
}

/** "Martes 20 de octubre". */
export function tituloDia(iso: string): string {
  const d = deIso(iso);
  return `${DIAS[(d.getDay() + 6) % 7]} ${fmtDiaMes.format(d)}`;
}

/** "9:00 a. m." a partir de "09:00". */
export function horaLegible(h?: string | null): string {
  if (!h) return '';
  const [hh, mm] = h.split(':').map(Number);
  const sufijo = hh < 12 ? 'a. m.' : 'p. m.';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${sufijo}`;
}

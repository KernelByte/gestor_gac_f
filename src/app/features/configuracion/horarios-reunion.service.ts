import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { horaLegible } from '../reuniones/utils/mensajes-discursos';

/** Un horario de reunión con la fecha desde la que rige. */
export interface HorarioReunion {
   vigente_desde: string;
   dia_entre_semana: string | null;
   hora_entre_semana: string | null;
   dia_fin_semana: string | null;
   hora_fin_semana: string | null;
}

/** En diciembre y enero: preguntar si el horario cambia con el año. */
export interface RecordatorioHorario {
   ano: number;
   /** Ya empezó el año y no se registró nada: "¿se les olvidó?". */
   atrasado: boolean;
}

export interface ResumenHorarios {
   hoy: string;
   /** Lo más atrás que se puede fechar un cambio (unos tres meses). */
   fecha_minima: string;
   vigente: HorarioReunion | null;
   cambios_programados: HorarioReunion[];
   /** Un cambio que ya empezó pero todavía se puede deshacer. */
   cambio_reciente: HorarioReunion | null;
   recordatorio: RecordatorioHorario | null;
}

export interface ReunionesMovidas {
   programa: number;
   discursos: number;
   logistica: number;
   /** Cuántas de las reuniones movidas ya se celebraron. */
   ya_pasadas: number;
}

/**
 * Horarios de reunión con fecha (rotación anual en salones compartidos).
 * Backend: modules/configuracion/horarios_reunion_router.py.
 * Sin `idCongregacion`, la congregación del usuario; con él, rutas de Admin.
 */
@Injectable({ providedIn: 'root' })
export class HorariosReunionService {
   private http = inject(HttpClient);

   private base(idCongregacion?: number | null): string {
      return idCongregacion
         ? `${environment.apiUrl}/configuracion/admin/congregaciones/${idCongregacion}/horarios-reunion`
         : `${environment.apiUrl}/configuracion/horarios-reunion`;
   }

   resumen(idCongregacion?: number | null): Observable<ResumenHorarios> {
      return this.http.get<ResumenHorarios>(this.base(idCongregacion));
   }

   vistaPrevia(cambio: HorarioReunion, idCongregacion?: number | null): Observable<{ movidas: ReunionesMovidas }> {
      return this.http.post<{ movidas: ReunionesMovidas }>(`${this.base(idCongregacion)}/vista-previa`, cambio);
   }

   programar(cambio: HorarioReunion, idCongregacion?: number | null): Observable<ResumenHorarios> {
      return this.http.post<ResumenHorarios>(this.base(idCongregacion), cambio);
   }

   quitar(vigenteDesde: string, idCongregacion?: number | null): Observable<ResumenHorarios> {
      return this.http.delete<ResumenHorarios>(`${this.base(idCongregacion)}/${vigenteDesde}`);
   }

   /** «Nuestro horario sigue igual»: no se vuelve a preguntar ese año. */
   sinCambio(ano: number): Observable<ResumenHorarios> {
      return this.http.post<ResumenHorarios>(`${this.base()}/sin-cambio/${ano}`, {});
   }
}

const DIAS: Record<string, string> = {
   Lunes: 'Lunes', Martes: 'Martes', Miercoles: 'Miércoles', Jueves: 'Jueves',
   Viernes: 'Viernes', Sabado: 'Sábado', Domingo: 'Domingo',
};

export function diaTexto(dia: string | null): string {
   return dia ? (DIAS[dia] ?? dia) : 'Sin día';
}

/** "Jueves, 7:00 p. m." */
export function reunionTexto(dia: string | null, hora: string | null): string {
   const h = horaLegible(hora);
   return h ? `${diaTexto(dia)}, ${h}` : diaTexto(dia);
}

/** "19:30:00" → "19:30": como lo guarda el backend y lo da <input type="time">. */
export function hhmm(hora: string | null | undefined): string | null {
   return hora?.slice(0, 5) || null;
}

/** La pregunta de diciembre/enero, igual en Inicio y en Configuración. */
export function preguntaRecordatorio(r: RecordatorioHorario): string {
   return r.atrasado
      ? `Ya empezó ${r.ano}. ¿Cambió su horario de reuniones?`
      : `¿Cambia su horario de reuniones en enero de ${r.ano}?`;
}

export function explicacionRecordatorio(r: RecordatorioHorario): string {
   return r.atrasado
      ? 'Si cambió el 1 de enero y todavía no está registrado, regístrelo ahora. La app pondrá en el día correcto también las reuniones de estos días.'
      : 'Si comparten el Salón del Reino con otra congregación, el horario suele cambiar el 1 de enero. Regístrelo y la app lo aplicará sola ese día.';
}

/** "2027-01-01" → "viernes 1 de enero de 2027" */
export function fechaLarga(iso: string): string {
   if (!iso) return '';
   return new Date(iso + 'T00:00:00')
      .toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .replace(',', '');
}

type CamposHorario = Record<
   'dia_reunion_entre_semana' | 'hora_reunion_entre_semana' | 'dia_reunion_fin_semana' | 'hora_reunion_fin_semana',
   string | null | undefined
>;

/**
 * Solo los campos de día/hora que la persona cambió respecto de lo cargado.
 * Mandarlos siempre convertía cualquier guardado (p. ej. cambiar el enlace de
 * Zoom con la pestaña abierta desde diciembre) en "el horario es este desde
 * hoy", y deshacía una rotación de horario que ya había entrado en vigor.
 * Sin `original` (congregación nueva), van todos.
 */
export function camposHorarioCambiados(actual: CamposHorario, original: Partial<CamposHorario> | null | undefined): Partial<CamposHorario> {
   const campos = ['dia_reunion_entre_semana', 'hora_reunion_entre_semana', 'dia_reunion_fin_semana', 'hora_reunion_fin_semana'] as const;
   const out: Partial<CamposHorario> = {};
   for (const c of campos) {
      const nuevo = actual[c] || null;
      if (!original || nuevo !== (original[c] || null)) out[c] = nuevo;
   }
   return out;
}

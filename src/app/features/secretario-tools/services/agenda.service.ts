import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { EventoAgenda, Recordatorio, RecordatorioForm, Sugerencia } from '../models/agenda.model';

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private http = inject(HttpClient);
  private ctx = inject(CongregacionContextService);
  private url = `${environment.apiUrl}/secretario/agenda`;

  /** Solo el Administrador manda la congregación; el resto la toma el backend. */
  private cong(params: Record<string, string> = {}): Record<string, string> {
    const id = this.ctx.effectiveCongregacionId();
    return id ? { ...params, id_congregacion: String(id) } : params;
  }

  eventos(desde: string, hasta: string): Observable<EventoAgenda[]> {
    return this.http.get<EventoAgenda[]>(`${this.url}/eventos`, { params: this.cong({ desde, hasta }) });
  }

  proximos(): Observable<EventoAgenda[]> {
    return this.http.get<EventoAgenda[]>(`${this.url}/proximos`, { params: this.cong() });
  }

  recordatorios(): Observable<Recordatorio[]> {
    return this.http.get<Recordatorio[]>(`${this.url}/recordatorios`, { params: this.cong() });
  }

  crear(data: RecordatorioForm): Observable<Recordatorio> {
    const id = this.ctx.effectiveCongregacionId();
    return this.http.post<Recordatorio>(`${this.url}/recordatorios`, { ...data, id_congregacion: id });
  }

  actualizar(id: number, data: RecordatorioForm): Observable<Recordatorio> {
    return this.http.put<Recordatorio>(`${this.url}/recordatorios/${id}`, data);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/recordatorios/${id}`);
  }

  marcarHecho(id: number, fecha: string, hecho: boolean): Observable<void> {
    const opts = { params: { fecha } };
    return hecho
      ? this.http.post<void>(`${this.url}/recordatorios/${id}/hecho`, null, opts)
      : this.http.delete<void>(`${this.url}/recordatorios/${id}/hecho`, opts);
  }

  /** Marca o desmarca un evento automático (sin recordatorio propio) por su clave. */
  marcarHechoAuto(clave: string, hecho: boolean): Observable<void> {
    const params = this.cong({ clave });
    const url = `${this.url}/hechos`;
    return hecho ? this.http.post<void>(url, null, { params }) : this.http.delete<void>(url, { params });
  }

  sugerencias(): Observable<Sugerencia[]> {
    return this.http.get<Sugerencia[]>(`${this.url}/plantilla`, { params: this.cong() });
  }

  aplicarSugerencias(claves: string[]): Observable<Recordatorio[]> {
    const id = this.ctx.effectiveCongregacionId();
    return this.http.post<Recordatorio[]>(`${this.url}/plantilla/aplicar`, { claves, id_congregacion: id });
  }
}

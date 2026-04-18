import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Periodo,
  AsistenciaRecord,
  AsistenciaUpsert,
  ResumenAnualAsistencia,
  FechasReunionesResponse,
} from '../models/asistencia.models';

export interface CongregacionConfig {
  dia_reunion_entre_semana:  string | null;
  hora_reunion_entre_semana: string | null;
  dia_reunion_fin_semana:    string | null;
  hora_reunion_fin_semana:   string | null;
  usa_zoom?:                 number;
}

@Injectable({ providedIn: 'root' })
export class AsistenciaService {
  private http = inject(HttpClient);
  private readonly asistenciasUrl = `${environment.apiUrl}/asistencias`;
  private readonly periodosUrl = `${environment.apiUrl}/periodos`;

  getCongregacionConfig(): Observable<CongregacionConfig> {
    return this.http.get<CongregacionConfig>(`${environment.apiUrl}/configuracion/`);
  }

  getPeriodos(ano?: number): Observable<Periodo[]> {
    let params = new HttpParams().set('limit', 500);
    if (ano) params = params.set('ano', ano);
    return this.http.get<Periodo[]>(this.periodosUrl + '/', { params });
  }

  getAsistencias(periodoId: number, congregacionId: number): Observable<AsistenciaRecord[]> {
    const params = new HttpParams()
      .set('id_periodo', periodoId)
      .set('id_congregacion', congregacionId);
    return this.http.get<AsistenciaRecord[]>(this.asistenciasUrl + '/', { params });
  }

  upsertAsistencia(data: AsistenciaUpsert): Observable<AsistenciaRecord> {
    return this.http.put<AsistenciaRecord>(this.asistenciasUrl + '/upsert', data);
  }

  getResumenAnual(congregacionId: number, anoServicio: number): Observable<ResumenAnualAsistencia> {
    const params = new HttpParams()
      .set('congregacion_id', congregacionId)
      .set('ano_servicio', anoServicio);
    return this.http.get<ResumenAnualAsistencia>(this.asistenciasUrl + '/resumen-anual', { params });
  }

  getFechasReuniones(congregacionId: number, ano: number, mes: number): Observable<FechasReunionesResponse> {
    const params = new HttpParams()
      .set('congregacion_id', congregacionId)
      .set('ano', ano)
      .set('mes', mes);
    return this.http.get<FechasReunionesResponse>(this.asistenciasUrl + '/fechas-reuniones', { params });
  }

  exportarPdf(congregacionId: number, periodoId: number): Observable<Blob> {
    return this.http.get(
      `${this.asistenciasUrl}/exportar-pdf/${congregacionId}/${periodoId}`,
      { responseType: 'blob' }
    );
  }

  exportarS88Pdf(congregacionId: number, anoServicio: number): Observable<Blob> {
    return this.http.get(
      `${this.asistenciasUrl}/exportar-s88-pdf/${congregacionId}/${anoServicio}`,
      { responseType: 'blob' }
    );
  }
}

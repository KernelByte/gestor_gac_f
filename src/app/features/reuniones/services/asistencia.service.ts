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

@Injectable({ providedIn: 'root' })
export class AsistenciaService {
  private http = inject(HttpClient);
  private readonly asistenciasUrl = `${environment.apiUrl}/asistencias`;
  private readonly periodosUrl = `${environment.apiUrl}/periodos`;

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
}

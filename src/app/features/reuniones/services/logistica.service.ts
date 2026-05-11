import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ConfirmarLogisticaRequest,
  ConflictoLogistica,
  EditarAseoRequest,
  EditarLogisticaItemRequest,
  GenerarLogisticaRequest,
  GrupoBase,
  LogisticaItemOut,
  LogisticaMesOut,
  MesDisponible,
  PublicadorBase,
} from '../models/logistica.models';

@Injectable({ providedIn: 'root' })
export class LogisticaService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reuniones/logistica`;

  private congParams(idCong: number | null): HttpParams {
    let p = new HttpParams();
    if (idCong !== null) p = p.set('id_congregacion', idCong);
    return p;
  }

  getMeses(idCong: number | null): Observable<MesDisponible[]> {
    return this.http.get<MesDisponible[]>(`${this.base}/meses`, {
      params: this.congParams(idCong),
    });
  }

  generar(payload: GenerarLogisticaRequest, idCong: number | null): Observable<LogisticaMesOut> {
    return this.http.post<LogisticaMesOut>(`${this.base}/generar`, payload, {
      params: this.congParams(idCong),
    });
  }

  getMes(ano: number, mes: number, idCong: number | null): Observable<LogisticaMesOut> {
    let params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get<LogisticaMesOut>(`${this.base}/mes`, { params });
  }

  editarItem(idLogistica: number, payload: EditarLogisticaItemRequest): Observable<LogisticaItemOut> {
    return this.http.put<LogisticaItemOut>(`${this.base}/item/${idLogistica}`, payload);
  }

  editarAseo(payload: EditarAseoRequest, idCong: number | null): Observable<any> {
    return this.http.put<any>(`${this.base}/aseo`, payload, {
      params: this.congParams(idCong),
    });
  }

  confirmar(payload: ConfirmarLogisticaRequest, idCong: number | null): Observable<LogisticaMesOut> {
    return this.http.post<LogisticaMesOut>(`${this.base}/confirmar`, payload, {
      params: this.congParams(idCong),
    });
  }

  getCandidatos(puesto: string, idCong: number | null, incluirHermanas = false): Observable<PublicadorBase[]> {
    let params = this.congParams(idCong).set('puesto', puesto).set('incluir_hermanas', incluirHermanas);
    return this.http.get<PublicadorBase[]>(`${this.base}/candidatos`, { params });
  }

  buscarPublicadores(q: string, idCong: number | null): Observable<PublicadorBase[]> {
    if (!q || q.trim().length === 0) return of([]);
    let params = this.congParams(idCong).set('q', q.trim());
    return this.http.get<PublicadorBase[]>(`${this.base}/publicadores/buscar`, { params });
  }

  getGrupos(idCong: number | null): Observable<GrupoBase[]> {
    return this.http.get<GrupoBase[]>(`${this.base}/grupos`, {
      params: this.congParams(idCong),
    });
  }

  verificarConflicto(idPublicador: number, fecha: string): Observable<ConflictoLogistica> {
    const params = new HttpParams().set('id_publicador', idPublicador).set('fecha', fecha);
    return this.http.get<ConflictoLogistica>(`${this.base}/conflicto`, { params });
  }

  eliminarMes(ano: number, mes: number, idCong: number | null): Observable<{ ok: boolean }> {
    let params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.delete<{ ok: boolean }>(`${this.base}/mes`, { params });
  }

  descargarPdf(ano: number, mes: number, idCong: number | null): Observable<Blob> {
    let params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get(`${this.base}/pdf`, { params, responseType: 'blob' });
  }
}

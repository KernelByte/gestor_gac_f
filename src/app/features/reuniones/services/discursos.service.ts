import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ConfirmarDiscursosRequest,
  CrearSalienteRequest,
  DiscursosMesOut,
  DiscursoSalienteOut,
  DiscursoEntranteOut,
  EditarEntranteRequest,
  EditarSalienteRequest,
  GenerarDiscursosRequest,
  GrupoSimple,
  MesDiscursosDisponible,
  PublicadorSimple,
} from '../models/discursos.models';

@Injectable({ providedIn: 'root' })
export class DiscursosService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reuniones/discursos`;

  private congParams(idCong: number | null): HttpParams {
    let p = new HttpParams();
    if (idCong !== null) p = p.set('id_congregacion', idCong);
    return p;
  }

  getMeses(idCong: number | null): Observable<MesDiscursosDisponible[]> {
    return this.http.get<MesDiscursosDisponible[]>(`${this.base}/meses`, { params: this.congParams(idCong) });
  }

  generar(payload: GenerarDiscursosRequest, idCong: number | null): Observable<DiscursosMesOut> {
    return this.http.post<DiscursosMesOut>(`${this.base}/generar`, payload, { params: this.congParams(idCong) });
  }

  getMes(ano: number, mes: number, idCong: number | null): Observable<DiscursosMesOut> {
    const params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get<DiscursosMesOut>(`${this.base}/mes`, { params });
  }

  crearSaliente(payload: CrearSalienteRequest, idCong: number | null): Observable<DiscursoSalienteOut> {
    return this.http.post<DiscursoSalienteOut>(`${this.base}/salientes`, payload, { params: this.congParams(idCong) });
  }

  editarSaliente(id: number, payload: EditarSalienteRequest): Observable<DiscursoSalienteOut> {
    return this.http.put<DiscursoSalienteOut>(`${this.base}/salientes/${id}`, payload);
  }

  eliminarSaliente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/salientes/${id}`);
  }

  editarEntrante(id: number, payload: EditarEntranteRequest): Observable<DiscursoEntranteOut> {
    return this.http.put<DiscursoEntranteOut>(`${this.base}/entrantes/${id}`, payload);
  }

  confirmar(payload: ConfirmarDiscursosRequest, idCong: number | null): Observable<DiscursosMesOut> {
    return this.http.post<DiscursosMesOut>(`${this.base}/confirmar`, payload, { params: this.congParams(idCong) });
  }

  eliminarMes(ano: number, mes: number, idCong: number | null): Observable<{ ok: boolean }> {
    const params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.delete<{ ok: boolean }>(`${this.base}/mes`, { params });
  }

  getGrupos(idCong: number | null): Observable<GrupoSimple[]> {
    return this.http.get<GrupoSimple[]>(`${this.base}/grupos`, { params: this.congParams(idCong) });
  }

  getPublicadores(idCong: number | null): Observable<PublicadorSimple[]> {
    return this.http.get<PublicadorSimple[]>(`${this.base}/publicadores`, { params: this.congParams(idCong) });
  }

  descargarPdfEntrantes(ano: number, mes: number, idCong: number | null): Observable<Blob> {
    const params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get(`${this.base}/pdf/entrantes`, { params, responseType: 'blob' });
  }

  descargarPdfSalientes(ano: number, mes: number, idCong: number | null): Observable<Blob> {
    const params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get(`${this.base}/pdf/salientes`, { params, responseType: 'blob' });
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  PlantillaOption,
  PlantillaDetailResponse,
  PlantillaUpdateRequest,
  ProgramaSemana,
  AsignacionDraft,
  GenerarAsignacionesResponse,
  GenerarAsignacionesRequest,
  ProgramaMensualCreateRequest,
  ConfirmarDraftRequest,
  MatrizConfigResponse,
  UpdateMatrizRequest,
  MWBImportPreviewResponse,
  MWBImportConfirmRequest,
  AlgorithmParamsResponse,
  AlgorithmParamsUpdate,
} from '../models/reuniones.models';

@Injectable({ providedIn: 'root' })
export class ReunionesService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reuniones`;

  // ──────────────────────────────────────────────────
  // CONFIGURACIÓN — MATRIZ
  // ──────────────────────────────────────────────────

  getMatrizConfiguracion(idCong: number): Observable<MatrizConfigResponse> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.get<MatrizConfigResponse>(`${this.base}/configuracion/matriz`, { params });
  }

  updateMatrizConfiguracion(payload: UpdateMatrizRequest): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.base}/configuracion/matriz`, payload);
  }

  // ──────────────────────────────────────────────────
  // PLANTILLAS
  // ──────────────────────────────────────────────────

  getPlantillas(tipo: string, idCong: number): Observable<PlantillaOption[]> {
    const params = new HttpParams()
      .set('tipo', tipo)
      .set('id_congregacion', idCong);
    return this.http.get<PlantillaOption[]>(`${this.base}/plantillas`, { params });
  }

  getPlantillaDetail(idPlantilla: number): Observable<PlantillaDetailResponse> {
    return this.http.get<PlantillaDetailResponse>(`${this.base}/plantillas/${idPlantilla}`);
  }

  updatePlantilla(idPlantilla: number, payload: PlantillaUpdateRequest): Observable<PlantillaDetailResponse> {
    return this.http.put<PlantillaDetailResponse>(`${this.base}/plantillas/${idPlantilla}`, payload);
  }

  deletePlantilla(idPlantilla: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.base}/plantillas/${idPlantilla}`);
  }

  // ──────────────────────────────────────────────────
  // DRAFTS & GENERACIÓN
  // ──────────────────────────────────────────────────

  getDraft(
    tipo: string,
    ano: number,
    semanaIso: number,
    idCong: number
  ): Observable<ProgramaSemana | null> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http
      .get<any>(
        `${this.base}/asignaciones/draft/${tipo}/${ano}/${semanaIso}`,
        { params }
      )
      .pipe(
        map((r) =>
          r?.draft === null || r?.draft === undefined && Object.keys(r).length === 1
            ? null
            : this.normalizeSemana(r)
        )
      );
  }

  crearProgramaMensual(
    payload: ProgramaMensualCreateRequest
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/programas/mensual`,
      payload
    );
  }

  generarAsignaciones(
    payload: GenerarAsignacionesRequest
  ): Observable<GenerarAsignacionesResponse> {
    return this.http
      .post<any>(`${this.base}/asignaciones/generar`, payload)
      .pipe(
        map((r) => ({
          ...r,
          semanas: (r.semanas ?? []).map((s: any) => this.normalizeSemana(s)),
        }))
      );
  }

  confirmarDrafts(
    payload: ConfirmarDraftRequest
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/asignaciones/draft/confirmar`,
      payload
    );
  }

  importarMWB(file: File): Observable<MWBImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MWBImportPreviewResponse>(
      `${this.base}/programas/importar-mwb`,
      formData
    );
  }

  confirmarMWB(
    payload: MWBImportConfirmRequest
  ): Observable<{ mensaje: string; programas_creados: number }> {
    return this.http.post<{ mensaje: string; programas_creados: number }>(
      `${this.base}/programas/importar-mwb/confirm`,
      payload
    );
  }

  checkMWBDuplicates(
    payload: MWBImportConfirmRequest
  ): Observable<{ duplicados: Array<{ semana_iso: number; ano: number; titulo_guia: string; fecha: string | null }> }> {
    return this.http.post<{ duplicados: Array<{ semana_iso: number; ano: number; titulo_guia: string; fecha: string | null }> }>(
      `${this.base}/programas/importar-mwb/check-duplicates`,
      payload
    );
  }

  // ──────────────────────────────────────────────────
  // PARÁMETROS DEL ALGORITMO
  // ──────────────────────────────────────────────────

  getAlgorithmParams(): Observable<AlgorithmParamsResponse> {
    return this.http.get<AlgorithmParamsResponse>(`${this.base}/configuracion/parametros`);
  }

  updateAlgorithmParams(payload: AlgorithmParamsUpdate): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.base}/configuracion/parametros`, payload);
  }

  private normalizeSemana(raw: any): ProgramaSemana {
    const partes: AsignacionDraft[] = (
      raw.partes ?? raw.asignaciones ?? []
    ).map((p: any) => ({
      ...p,
      nombre_parte:
        p.nombre_parte ??
        p.nombre_personalizado ??
        p.nombre_parte_base ??
        '—',
    }));
    return { ...raw, partes };
  }
}

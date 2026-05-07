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
  CandidatoAlternativo,
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
  AlgoProfile,
  EditarAsignacionRequest,
  PeriodoConfirmado,
  ConflictosPlantillaResponse,
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

  deleteDraft(
    tipo: string,
    ano: number,
    semanaIso: number,
    idCong: number
  ): Observable<{ message: string }> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.delete<{ message: string }>(
      `${this.base}/asignaciones/draft/${tipo}/${ano}/${semanaIso}`,
      { params }
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
  // AYUDANTES (add / remove en draft)
  // ──────────────────────────────────────────────────

  agregarAyudante(idProgramaParte: number, idCongregacion: number, sexoFilter?: string): Observable<AsignacionDraft> {
    let params = new HttpParams().set('id_congregacion', idCongregacion);
    if (sexoFilter) params = params.set('sexo_filter', sexoFilter);
    return this.http.post<AsignacionDraft>(
      `${this.base}/programas/partes/${idProgramaParte}/ayudante`, {}, { params }
    );
  }

  swapDraftAsignacion(
    tipo: string,
    ano: number,
    semanaIso: number,
    idCongregacion: number,
    idProgramaParte: number,
    nombreParte: string,
    idPublicador: number,
    nombreCompleto: string,
  ): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(
      `${this.base}/asignaciones/draft/${tipo}/${ano}/${semanaIso}/asignacion`,
      { id_congregacion: idCongregacion, id_programa_parte: idProgramaParte, nombre_parte: nombreParte, id_publicador: idPublicador, nombre_completo: nombreCompleto }
    );
  }

  eliminarAyudante(idProgramaParte: number, idCongregacion: number): Observable<{ ok: boolean }> {
    const params = new HttpParams().set('id_congregacion', idCongregacion);
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/programas/partes/${idProgramaParte}/ayudante`, { params }
    );
  }

  // ──────────────────────────────────────────────────
  // PARÁMETROS DEL ALGORITMO
  // ──────────────────────────────────────────────────

  getAlgorithmParams(idCong: number): Observable<AlgorithmParamsResponse> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.get<AlgorithmParamsResponse>(`${this.base}/configuracion/parametros`, { params });
  }

  updateAlgorithmParams(payload: AlgorithmParamsUpdate): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.base}/configuracion/parametros`, payload);
  }

  getAlgorithmProfiles(idCong: number): Observable<{ perfiles: AlgoProfile[]; perfil_activo: string; algo_max_partes_cruzadas: number }> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.get<{ perfiles: AlgoProfile[]; perfil_activo: string; algo_max_partes_cruzadas: number }>(`${this.base}/configuracion/perfiles`, { params });
  }

  setAlgorithmProfile(perfilId: string, idCong: number): Observable<{ message: string; perfil_id: string }> {
    return this.http.put<{ message: string; perfil_id: string }>(`${this.base}/configuracion/perfil`, { perfil_id: perfilId, id_congregacion: idCong });
  }

  // ──────────────────────────────────────────────────
  // HISTORIAL CONFIRMADO
  // ──────────────────────────────────────────────────

  getPeriodosConfirmados(tipo: string, idCong: number): Observable<PeriodoConfirmado[]> {
    const params = new HttpParams()
      .set('tipo_reunion', tipo)
      .set('id_congregacion', idCong);
    return this.http.get<PeriodoConfirmado[]>(
      `${this.base}/asignaciones/periodos-confirmados`, { params }
    );
  }

  getHistorialConfirmado(
    tipo: string,
    ano: number,
    mes: number,
    idCong: number
  ): Observable<ProgramaSemana[]> {
    const params = new HttpParams()
      .set('tipo_reunion', tipo)
      .set('ano', ano)
      .set('mes', mes)
      .set('id_congregacion', idCong);
    return this.http
      .get<any[]>(`${this.base}/asignaciones/historial`, { params })
      .pipe(map((semanas) => semanas.map((s) => this.normalizeSemana(s))));
  }

  descargarProgramacionPdf(tipo: string, ano: number, mes: number, idCong: number): Observable<Blob> {
    const params = new HttpParams()
      .set('tipo_reunion', tipo)
      .set('ano', ano)
      .set('mes', mes)
      .set('id_congregacion', idCong);
    return this.http.get(`${this.base}/asignaciones/historial/pdf`, {
      params,
      responseType: 'blob',
    });
  }

  eliminarHistorialMes(tipo: string, ano: number, mes: number, idCong: number): Observable<{ eliminados: number }> {
    const params = new HttpParams()
      .set('tipo_reunion', tipo)
      .set('ano', ano)
      .set('mes', mes)
      .set('id_congregacion', idCong);
    return this.http.delete<{ eliminados: number }>(`${this.base}/asignaciones/historial`, { params });
  }

  eliminarHistorialPlantilla(idPlantilla: number, idCong: number): Observable<{ eliminados: number }> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.delete<{ eliminados: number }>(
      `${this.base}/programas/plantilla/${idPlantilla}`, { params }
    );
  }

  verificarConflictosPlantilla(payload: ProgramaMensualCreateRequest): Observable<ConflictosPlantillaResponse> {
    return this.http.post<ConflictosPlantillaResponse>(
      `${this.base}/programas/verificar-conflictos`, payload
    );
  }

  getCandidatosConfirmados(
    idAsignacion: number,
    idCong: number
  ): Observable<CandidatoAlternativo[]> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.get<CandidatoAlternativo[]>(
      `${this.base}/asignaciones/${idAsignacion}/candidatos`,
      { params }
    );
  }

  buscarPublicadoresCong(
    idCong: number,
    q: string
  ): Observable<{ id_publicador: number; nombre_completo: string; sexo?: string }[]> {
    const params = new HttpParams().set('id_congregacion', idCong).set('q', q);
    return this.http.get<{ id_publicador: number; nombre_completo: string; sexo?: string }[]>(
      `${this.base}/asignaciones/buscar-publicadores`,
      { params }
    );
  }

  editarAsignacion(
    idAsignacion: number,
    payload: EditarAsignacionRequest
  ): Observable<{ id_asignacion: number; id_publicador: number; nombre_completo: string }> {
    return this.http.patch<{ id_asignacion: number; id_publicador: number; nombre_completo: string }>(
      `${this.base}/asignaciones/${idAsignacion}`,
      payload
    );
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

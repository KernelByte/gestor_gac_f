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
  PublicarProgramaRequest,
  PublicarProgramaResponse,
  MatrizConfigResponse,
  UpdateMatrizRequest,
  MWBImportPreviewResponse,
  MWBImportConfirmRequest,
  MWBImportConfirmResponse,
  MWBDuplicadosResponse,
  AlgorithmParamsResponse,
  AlgorithmParamsUpdate,
  AlgoProfile,
  EditarAsignacionRequest,
  PeriodoConfirmado,
  ConflictosPlantillaResponse,
  AusenciaOut,
  CrearAusenciaRequest,
  SemanaSinReunion,
  CrearSemanaSinReunionRequest,
} from '../models/reuniones.models';

export interface PublicadorBusqueda {
  id_publicador: number;
  nombre_completo: string;
  sexo?: string;
  ausente?: boolean;
  ausencia_motivo?: string | null;
}

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
  // CONFIGURACIÓN — AUSENCIAS
  // ──────────────────────────────────────────────────

  getAusencias(idCong: number): Observable<AusenciaOut[]> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.get<AusenciaOut[]>(`${this.base}/configuracion/ausencias`, { params });
  }

  crearAusencia(payload: CrearAusenciaRequest): Observable<AusenciaOut> {
    return this.http.post<AusenciaOut>(`${this.base}/configuracion/ausencias`, payload);
  }

  eliminarAusencia(idAusencia: number, idCong: number): Observable<{ ok: boolean }> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.delete<{ ok: boolean }>(`${this.base}/configuracion/ausencias/${idAusencia}`, { params });
  }

  // ──────────────────────────────────────────────────
  // CONFIGURACIÓN — SEMANAS SIN REUNIÓN
  // ──────────────────────────────────────────────────

  getSemanasSinReunion(idCong: number): Observable<SemanaSinReunion[]> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.get<SemanaSinReunion[]>(`${this.base}/configuracion/semanas-sin-reunion`, { params });
  }

  crearSemanaSinReunion(payload: CrearSemanaSinReunionRequest): Observable<SemanaSinReunion> {
    return this.http.post<SemanaSinReunion>(`${this.base}/configuracion/semanas-sin-reunion`, payload);
  }

  eliminarSemanaSinReunion(idSemana: number, idCong: number): Observable<{ ok: boolean }> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.delete<{ ok: boolean }>(`${this.base}/configuracion/semanas-sin-reunion/${idSemana}`, { params });
  }

  // ──────────────────────────────────────────────────
  // PLANTILLAS
  // ──────────────────────────────────────────────────

  getPlantillas(tipo: string, idCong?: number | null): Observable<PlantillaOption[]> {
    // Las plantillas son globales: id_congregacion es opcional (solo lo usa el
    // backend para autorizar roles no globales, que siempre lo mandan).
    let params = new HttpParams().set('tipo', tipo);
    if (idCong != null) params = params.set('id_congregacion', idCong);
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
  // PROGRAMACIÓN (borrador y publicado)
  // ──────────────────────────────────────────────────
  //
  // Un solo lector para los dos estados: el borrador dejó de ser una copia en
  // caché y es una fila más, con `estado: 'borrador'`. Por eso ya no hay
  // getDraft/deleteDraft por semana, ni un endpoint distinto para el historial.

  getProgramaMes(
    tipo: string,
    ano: number,
    mes: number,
    idCong: number,
    soloPublicado = false,
  ): Observable<ProgramaSemana[]> {
    const params = new HttpParams()
      .set('id_congregacion', idCong)
      .set('solo_publicado', soloPublicado);
    return this.http
      .get<{ semanas: any[] }>(`${this.base}/programas/mes/${tipo}/${ano}/${mes}`, { params })
      .pipe(map((r) => (r.semanas ?? []).map((s) => this.normalizeSemana(s))));
  }

  borrarBorrador(
    tipo: string,
    idCong: number,
    fechas: string[]
  ): Observable<{ borradas: number }> {
    return this.http.request<{ borradas: number }>(
      'delete',
      `${this.base}/programas/mes/${tipo}/borrador`,
      { body: { id_congregacion: idCong, fechas } }
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

  publicarPrograma(
    payload: PublicarProgramaRequest
  ): Observable<PublicarProgramaResponse> {
    return this.http.post<PublicarProgramaResponse>(
      `${this.base}/programas/publicar`,
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
  ): Observable<MWBImportConfirmResponse> {
    return this.http.post<MWBImportConfirmResponse>(
      `${this.base}/programas/importar-mwb/confirm`,
      payload
    );
  }

  checkMWBDuplicates(
    payload: MWBImportConfirmRequest
  ): Observable<MWBDuplicadosResponse> {
    return this.http.post<MWBDuplicadosResponse>(
      `${this.base}/programas/importar-mwb/check-duplicates`,
      payload
    );
  }

  // ──────────────────────────────────────────────────
  // IMPORTACIÓN LA ATALAYA (fin de semana)
  //
  // A diferencia de MWB, esto no crea una plantilla nueva: agrega el tema
  // semanal a la plantilla de fin de semana que ya existe. Por eso no hay
  // check-duplicates — reimportar solo reemplaza el tema de esas semanas
  // puntuales, nunca la plantilla entera.
  // ──────────────────────────────────────────────────

  importarAtalaya(file: File): Observable<MWBImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MWBImportPreviewResponse>(
      `${this.base}/programas/importar-atalaya`,
      formData
    );
  }

  confirmarAtalaya(
    payload: MWBImportConfirmRequest
  ): Observable<MWBImportConfirmResponse> {
    return this.http.post<MWBImportConfirmResponse>(
      `${this.base}/programas/importar-atalaya/confirm`,
      payload
    );
  }

  eliminarTemaAtalaya(idPlantilla: number, semanaOrdinal: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${this.base}/plantillas/${idPlantilla}/temas-atalaya/${semanaOrdinal}`
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

  descargarPapeletasPdf(ano: number, mes: number, idCong: number, formato: 'x4' | 'x1'): Observable<Blob> {
    const params = new HttpParams()
      .set('ano', ano)
      .set('mes', mes)
      .set('id_congregacion', idCong)
      .set('formato', formato);
    return this.http.get(`${this.base}/asignaciones/historial/pdf-individual`, {
      params,
      responseType: 'blob',
    });
  }

  descargarPapeletaImagen(
    ano: number, mes: number, idCong: number, idProgramaParte: number, sala: string,
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('ano', ano)
      .set('mes', mes)
      .set('id_congregacion', idCong)
      .set('id_programa_parte', idProgramaParte)
      .set('sala', sala);
    return this.http.get(`${this.base}/asignaciones/papeleta-imagen`, {
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

  /** Borra sólo la Sala B (Auxiliar) confirmada de un mes de entre semana,
   *  sin tocar la Sala Principal. dryRun=true sólo cuenta, no borra. */
  eliminarSalaBConfirmada(ano: number, mes: number, idCong: number, dryRun = false): Observable<{ borradas: number }> {
    const params = new HttpParams()
      .set('ano', ano)
      .set('mes', mes)
      .set('id_congregacion', idCong)
      .set('dry_run', dryRun);
    return this.http.delete<{ borradas: number }>(`${this.base}/asignaciones/sala-b`, { params });
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

  getCandidatosAsignacion(
    idAsignacion: number,
    idCong: number
  ): Observable<CandidatoAlternativo[]> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.get<CandidatoAlternativo[]>(
      `${this.base}/asignaciones/${idAsignacion}/candidatos`,
      { params }
    );
  }

  /** Candidatos para una ranura VACÍA, que no tiene `id_asignacion` que pasar. */
  getCandidatosRanura(
    idProgramaParte: number,
    idCong: number,
    sala: 'Principal' | 'Auxiliar' = 'Principal',
    esAyudante = false,
  ): Observable<CandidatoAlternativo[]> {
    const params = new HttpParams()
      .set('id_congregacion', idCong)
      .set('sala', sala)
      .set('es_ayudante', esAyudante);
    return this.http.get<CandidatoAlternativo[]>(
      `${this.base}/partes/${idProgramaParte}/candidatos`,
      { params }
    );
  }

  /** `fecha` es opcional y solo sirve para marcar a quien esté ausente ese
   *  día: los ausentes siguen apareciendo, para poder forzarlos a conciencia. */
  buscarPublicadoresCong(
    idCong: number,
    q: string,
    fecha?: string,
  ): Observable<PublicadorBusqueda[]> {
    let params = new HttpParams().set('id_congregacion', idCong).set('q', q);
    if (fecha) params = params.set('fecha', fecha);
    return this.http.get<PublicadorBusqueda[]>(
      `${this.base}/asignaciones/buscar-publicadores`,
      { params }
    );
  }

  editarAsignacion(
    idAsignacion: number,
    payload: EditarAsignacionRequest,
    idCong: number,
  ): Observable<{ id_asignacion: number; id_publicador: number; nombre_completo: string }> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.patch<{ id_asignacion: number; id_publicador: number; nombre_completo: string }>(
      `${this.base}/asignaciones/${idAsignacion}`,
      payload,
      { params }
    );
  }

  /** Deja una ranura sin asignar, en borrador o publicada. */
  eliminarAsignacion(idAsignacion: number, idCongregacion: number): Observable<{ ok: boolean }> {
    const params = new HttpParams().set('id_congregacion', idCongregacion);
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/asignaciones/${idAsignacion}`, { params }
    );
  }

  /** Cubre una ranura vacía de un mes confirmado.
   *
   *  `sala` y `esAyudante` son obligatorios en la práctica aunque tengan valor
   *  por omisión: Principal, Sala B y sus ayudantes comparten
   *  `id_programa_parte`, así que sin ellos el servidor no sabe cuál de las
   *  cuatro se está rellenando. */
  crearAsignacion(
    idProgramaParte: number,
    idPublicador: number,
    idCong: number,
    sala: 'Principal' | 'Auxiliar' = 'Principal',
    esAyudante = false,
  ): Observable<{ id_asignacion: number; id_publicador: number; nombre_completo: string }> {
    const params = new HttpParams().set('id_congregacion', idCong);
    return this.http.post<{ id_asignacion: number; id_publicador: number; nombre_completo: string }>(
      `${this.base}/partes/${idProgramaParte}/asignacion`,
      { id_publicador: idPublicador, sala, es_ayudante: esAyudante },
      { params }
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

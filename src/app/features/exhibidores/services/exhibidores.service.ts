import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CandidatosSlotResponse, ConflictoResponse, ExhibidorAsignacion,
  FechaBloqueada, HistorialParticipante, MesDisponible, MiTurno,
  ParametroAlgoritmo, Participante, ParticipanteUpdate, PerfilAlgoritmo,
  PreferenciasResponse, ProgramacionMes, PuntoSacada, Quincena, TurnoExhibidor,
  UbicacionExhibidor, Vinculo,
} from '../models/exhibidor.model';

@Injectable({ providedIn: 'root' })
export class ExhibidoresService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/exhibidores`;

  private congParams(idCong: number | null): HttpParams {
    let p = new HttpParams();
    if (idCong !== null) p = p.set('id_congregacion', idCong);
    return p;
  }

  // ── Puntos de sacada ───────────────────────────────────────
  getPuntosSacada(idCong: number | null): Observable<PuntoSacada[]> {
    return this.http.get<PuntoSacada[]>(`${this.base}/puntos-sacada`, { params: this.congParams(idCong) });
  }

  crearPuntoSacada(data: Partial<PuntoSacada>, idCong: number | null): Observable<PuntoSacada> {
    return this.http.post<PuntoSacada>(`${this.base}/puntos-sacada`, data, { params: this.congParams(idCong) });
  }

  actualizarPuntoSacada(id: number, data: Partial<PuntoSacada>, idCong: number | null): Observable<PuntoSacada> {
    return this.http.put<PuntoSacada>(`${this.base}/puntos-sacada/${id}`, data, { params: this.congParams(idCong) });
  }

  eliminarPuntoSacada(id: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/puntos-sacada/${id}`, { params: this.congParams(idCong) });
  }

  /**
   * Dirección legible del punto marcado en el mapa. Va por el backend porque
   * la CSP del frontend es `connect-src 'self'` (no se puede llamar a Photon
   * desde el navegador). `direccion` es null si no hay nada cerca.
   */
  geocodificarInverso(lat: number, lon: number): Observable<{ direccion: string | null }> {
    const params = new HttpParams().set('lat', lat).set('lon', lon);
    return this.http.get<{ direccion: string | null }>(`${this.base}/geocodificar-inverso`, { params });
  }

  // ── Ubicaciones y turnos ───────────────────────────────────
  getUbicaciones(idCong: number | null): Observable<UbicacionExhibidor[]> {
    return this.http.get<UbicacionExhibidor[]>(`${this.base}/ubicaciones`, { params: this.congParams(idCong) });
  }

  crearUbicacion(data: any, idCong: number | null): Observable<UbicacionExhibidor> {
    return this.http.post<UbicacionExhibidor>(`${this.base}/ubicaciones`, data, { params: this.congParams(idCong) });
  }

  actualizarUbicacion(id: number, data: any, idCong: number | null): Observable<UbicacionExhibidor> {
    return this.http.put<UbicacionExhibidor>(`${this.base}/ubicaciones/${id}`, data, { params: this.congParams(idCong) });
  }

  eliminarUbicacion(id: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/ubicaciones/${id}`, { params: this.congParams(idCong) });
  }

  crearTurno(data: any, idCong: number | null): Observable<TurnoExhibidor> {
    return this.http.post<TurnoExhibidor>(`${this.base}/turnos`, data, { params: this.congParams(idCong) });
  }

  actualizarTurno(id: number, data: any, idCong: number | null): Observable<TurnoExhibidor> {
    return this.http.put<TurnoExhibidor>(`${this.base}/turnos/${id}`, data, { params: this.congParams(idCong) });
  }

  eliminarTurno(id: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/turnos/${id}`, { params: this.congParams(idCong) });
  }

  // ── Fechas bloqueadas ──────────────────────────────────────
  getFechasBloqueadas(idCong: number | null, ano?: number, mes?: number): Observable<FechaBloqueada[]> {
    let params = this.congParams(idCong);
    if (ano) params = params.set('ano', ano);
    if (mes) params = params.set('mes', mes);
    return this.http.get<FechaBloqueada[]>(`${this.base}/fechas-bloqueadas`, { params });
  }

  crearFechaBloqueada(
    data: { fecha: string; motivo?: string | null; id_ubicacion_exhibidor?: number | null },
    idCong: number | null,
  ): Observable<FechaBloqueada> {
    return this.http.post<FechaBloqueada>(`${this.base}/fechas-bloqueadas`, data, { params: this.congParams(idCong) });
  }

  eliminarFechaBloqueada(id: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/fechas-bloqueadas/${id}`, { params: this.congParams(idCong) });
  }

  // ── Programación ───────────────────────────────────────────
  getMeses(idCong: number | null): Observable<MesDisponible[]> {
    return this.http.get<MesDisponible[]>(`${this.base}/programacion/meses`, { params: this.congParams(idCong) });
  }

  getMes(ano: number, mes: number, idCong: number | null): Observable<ProgramacionMes> {
    const params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get<ProgramacionMes>(`${this.base}/programacion`, { params });
  }

  generar(
    ano: number, mes: number, regenerar: boolean, idCong: number | null,
    quincena: Quincena | null = null,
  ): Observable<ProgramacionMes> {
    return this.http.post<ProgramacionMes>(
      `${this.base}/programacion/generar`, { ano, mes, regenerar, quincena },
      { params: this.congParams(idCong) },
    );
  }

  editarItem(
    id: number, data: { id_publicador: number | null; notas?: string | null },
    idCong: number | null,
  ): Observable<ExhibidorAsignacion> {
    return this.http.put<ExhibidorAsignacion>(`${this.base}/programacion/item/${id}`, data, { params: this.congParams(idCong) });
  }

  marcarAusencia(
    id: number, data: { motivo?: string | null; id_publicador_reemplazo?: number | null },
    idCong: number | null,
  ): Observable<ExhibidorAsignacion> {
    return this.http.post<ExhibidorAsignacion>(`${this.base}/programacion/item/${id}/ausencia`, data, { params: this.congParams(idCong) });
  }

  getCandidatos(idAsignacion: number, idCong: number | null): Observable<CandidatosSlotResponse> {
    return this.http.get<CandidatosSlotResponse>(
      `${this.base}/programacion/item/${idAsignacion}/candidatos`,
      { params: this.congParams(idCong) },
    );
  }

  confirmar(
    ano: number, mes: number, idCong: number | null, quincena: Quincena | null = null,
  ): Observable<{ ok: boolean; confirmadas: number }> {
    return this.http.post<{ ok: boolean; confirmadas: number }>(
      `${this.base}/programacion/confirmar`, { ano, mes, quincena },
      { params: this.congParams(idCong) },
    );
  }

  eliminarMes(
    ano: number, mes: number, idCong: number | null, quincena: Quincena | null = null,
  ): Observable<{ ok: boolean; eliminadas: number }> {
    let params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    if (quincena !== null) params = params.set('quincena', quincena);
    return this.http.delete<{ ok: boolean; eliminadas: number }>(`${this.base}/programacion`, { params });
  }

  verificarConflicto(idPublicador: number, fecha: string, idCong: number | null): Observable<ConflictoResponse> {
    const params = this.congParams(idCong).set('id_publicador', idPublicador).set('fecha', fecha);
    return this.http.get<ConflictoResponse>(`${this.base}/programacion/conflicto`, { params });
  }

  descargarPdf(
    ano: number, mes: number, idCong: number | null, quincena: Quincena | null = null,
  ): Observable<Blob> {
    let params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    if (quincena !== null) params = params.set('quincena', quincena);
    return this.http.get(`${this.base}/programacion/pdf`, { params, responseType: 'blob' });
  }

  getMisTurnos(idCong: number | null, desde?: string, hasta?: string): Observable<MiTurno[]> {
    let params = this.congParams(idCong);
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<MiTurno[]>(`${this.base}/mis-turnos`, { params });
  }

  // ── Participantes ──────────────────────────────────────────
  getParticipantes(idCong: number | null): Observable<Participante[]> {
    return this.http.get<Participante[]>(`${this.base}/participantes`, { params: this.congParams(idCong) });
  }

  guardarParticipante(idPublicador: number, data: ParticipanteUpdate, idCong: number | null): Observable<Participante> {
    return this.http.put<Participante>(`${this.base}/participantes/${idPublicador}`, data, { params: this.congParams(idCong) });
  }

  getVinculos(idCong: number | null): Observable<Vinculo[]> {
    return this.http.get<Vinculo[]>(`${this.base}/vinculos`, { params: this.congParams(idCong) });
  }

  crearVinculo(
    data: { id_publicador_a: number; id_publicador_b: number; tipo: string; accion: string },
    idCong: number | null,
  ): Observable<Vinculo> {
    return this.http.post<Vinculo>(`${this.base}/vinculos`, data, { params: this.congParams(idCong) });
  }

  eliminarVinculo(id: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/vinculos/${id}`, { params: this.congParams(idCong) });
  }

  getHistorial(idCong: number | null): Observable<HistorialParticipante[]> {
    return this.http.get<HistorialParticipante[]>(`${this.base}/historial`, { params: this.congParams(idCong) });
  }

  // ── Configuración ──────────────────────────────────────────
  getParametros(idCong: number | null): Observable<{ parametros: ParametroAlgoritmo[] }> {
    return this.http.get<{ parametros: ParametroAlgoritmo[] }>(`${this.base}/configuracion/parametros`, { params: this.congParams(idCong) });
  }

  setParametros(parametros: Record<string, number>, idCong: number | null): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.base}/configuracion/parametros`, { parametros }, { params: this.congParams(idCong) });
  }

  getPerfiles(idCong: number | null): Observable<{ perfiles: PerfilAlgoritmo[]; perfil_activo: string | null }> {
    return this.http.get<{ perfiles: PerfilAlgoritmo[]; perfil_activo: string | null }>(`${this.base}/configuracion/perfiles`, { params: this.congParams(idCong) });
  }

  setPerfil(perfilId: string, idCong: number | null): Observable<{ ok: boolean; perfil_activo: string }> {
    return this.http.put<{ ok: boolean; perfil_activo: string }>(`${this.base}/configuracion/perfil`, { perfil_id: perfilId }, { params: this.congParams(idCong) });
  }

  /** Modo de asignación y periodicidad de la congregación. */
  getPreferencias(idCong: number | null): Observable<PreferenciasResponse> {
    return this.http.get<PreferenciasResponse>(`${this.base}/configuracion/preferencias`, { params: this.congParams(idCong) });
  }

  setPreferencias(
    preferencias: Record<string, string>, idCong: number | null,
  ): Observable<{ ok: boolean; valores: Record<string, string> }> {
    return this.http.put<{ ok: boolean; valores: Record<string, string> }>(
      `${this.base}/configuracion/preferencias`, { preferencias },
      { params: this.congParams(idCong) },
    );
  }
}

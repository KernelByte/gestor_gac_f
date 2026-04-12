import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Territorio,
  Manzana,
  Vivienda,
  CoberturaManzana,
  TerritorioStats,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  Sesion,
  AsignacionTerritorio,
  Punto,
  SalidaPredicacion,
  ProgresoTerritorio,
} from '../models/territorio.model';

@Injectable({ providedIn: 'root' })
export class TerritoriosService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/territorios`;

  // ── Territorios ──────────────────────────────────────────────────────
  getTerritorios(skip = 0, limit = 100): Observable<Territorio[]> {
    const params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString());
    return this.http.get<Territorio[]>(this.baseUrl, { params });
  }

  getTerritorio(id: number): Observable<Territorio> {
    return this.http.get<Territorio>(`${this.baseUrl}/${id}`);
  }

  getTerritoriosGeoJSON(): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(`${this.baseUrl}/geojson`);
  }

  getTerritorioGeoJSON(id: number): Observable<GeoJSONFeature> {
    return this.http.get<GeoJSONFeature>(`${this.baseUrl}/${id}/geojson`);
  }

  getTerritorioStats(id: number): Observable<TerritorioStats> {
    return this.http.get<TerritorioStats>(`${this.baseUrl}/${id}/stats`);
  }

  createTerritorio(data: Partial<Territorio>): Observable<Territorio> {
    return this.http.post<Territorio>(this.baseUrl, data);
  }

  updateTerritorio(id: number, data: Partial<Territorio>): Observable<Territorio> {
    return this.http.put<Territorio>(`${this.baseUrl}/${id}`, data);
  }

  deleteTerritorio(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // ── Manzanas ─────────────────────────────────────────────────────────
  getManzanas(idTerritorio: number): Observable<Manzana[]> {
    return this.http.get<Manzana[]>(`${this.baseUrl}/${idTerritorio}/manzanas`);
  }

  getManzanasGeoJSON(idTerritorio: number): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(`${this.baseUrl}/${idTerritorio}/manzanas/geojson`);
  }

  createManzana(idTerritorio: number, data: Partial<Manzana>): Observable<Manzana> {
    return this.http.post<Manzana>(`${this.baseUrl}/${idTerritorio}/manzanas`, data);
  }

  updateManzana(idTerritorio: number, idManzana: number, data: Partial<Manzana>): Observable<Manzana> {
    return this.http.put<Manzana>(`${this.baseUrl}/${idTerritorio}/manzanas/${idManzana}`, data);
  }

  deleteManzana(idTerritorio: number, idManzana: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/manzanas/${idManzana}`);
  }

  // ── Viviendas ────────────────────────────────────────────────────────
  getViviendas(idManzana: number): Observable<Vivienda[]> {
    return this.http.get<Vivienda[]>(`${environment.apiUrl}/manzanas/${idManzana}/viviendas`);
  }

  getViviendasGeoJSON(idManzana: number): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(`${environment.apiUrl}/manzanas/${idManzana}/viviendas/geojson`);
  }

  createVivienda(idManzana: number, data: Partial<Vivienda>): Observable<Vivienda> {
    return this.http.post<Vivienda>(`${environment.apiUrl}/manzanas/${idManzana}/viviendas`, data);
  }

  // ── Cobertura ────────────────────────────────────────────────────────
  getCoberturas(idManzana: number): Observable<CoberturaManzana[]> {
    return this.http.get<CoberturaManzana[]>(`${environment.apiUrl}/manzanas/${idManzana}/cobertura`);
  }

  createCobertura(idManzana: number, data: Partial<CoberturaManzana>): Observable<CoberturaManzana> {
    return this.http.post<CoberturaManzana>(`${environment.apiUrl}/manzanas/${idManzana}/cobertura`, data);
  }

  // ── Sesiones ─────────────────────────────────────────────────────────
  getSesiones(idTerritorio: number): Observable<Sesion[]> {
    return this.http.get<Sesion[]>(`${this.baseUrl}/${idTerritorio}/sesiones`);
  }

  createSesion(idTerritorio: number, data: Partial<Sesion>): Observable<Sesion> {
    return this.http.post<Sesion>(`${this.baseUrl}/${idTerritorio}/sesiones`, data);
  }

  updateSesion(idTerritorio: number, idSesion: number, data: Partial<Sesion>): Observable<Sesion> {
    return this.http.put<Sesion>(`${this.baseUrl}/${idTerritorio}/sesiones/${idSesion}`, data);
  }

  deleteSesion(idTerritorio: number, idSesion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/sesiones/${idSesion}`);
  }

  // ── Asignaciones ──────────────────────────────────────────────────────
  getAsignaciones(idTerritorio: number): Observable<AsignacionTerritorio[]> {
    return this.http.get<AsignacionTerritorio[]>(`${this.baseUrl}/${idTerritorio}/asignaciones`);
  }

  getAsignacionActiva(idTerritorio: number): Observable<AsignacionTerritorio | null> {
    return this.http.get<AsignacionTerritorio | null>(`${this.baseUrl}/${idTerritorio}/asignaciones/activa`);
  }

  createAsignacion(idTerritorio: number, data: { id_publicador: number; id_sesion?: number; fecha_asignacion: string; notas?: string }): Observable<AsignacionTerritorio> {
    return this.http.post<AsignacionTerritorio>(`${this.baseUrl}/${idTerritorio}/asignaciones`, data);
  }

  devolverAsignacion(idTerritorio: number, idAsignacion: number, data: { fecha_devolucion: string; notas?: string }): Observable<AsignacionTerritorio> {
    return this.http.put<AsignacionTerritorio>(`${this.baseUrl}/${idTerritorio}/asignaciones/${idAsignacion}/devolver`, data);
  }

  deleteAsignacion(idTerritorio: number, idAsignacion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/asignaciones/${idAsignacion}`);
  }

  // ── Puntos ───────────────────────────────────────────────────────────
  getPuntos(idTerritorio: number): Observable<Punto[]> {
    return this.http.get<Punto[]>(`${this.baseUrl}/${idTerritorio}/puntos`);
  }

  getPuntosGeoJSON(idTerritorio: number): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(`${this.baseUrl}/${idTerritorio}/puntos/geojson`);
  }

  createPunto(idTerritorio: number, data: Partial<Punto>): Observable<Punto> {
    return this.http.post<Punto>(`${this.baseUrl}/${idTerritorio}/puntos`, data);
  }

  updatePunto(idTerritorio: number, idPunto: number, data: Partial<Punto>): Observable<Punto> {
    return this.http.put<Punto>(`${this.baseUrl}/${idTerritorio}/puntos/${idPunto}`, data);
  }

  deletePunto(idTerritorio: number, idPunto: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/puntos/${idPunto}`);
  }

  // ── Salidas de Predicación ────────────────────────────────────────────
  getSalidas(idTerritorio: number): Observable<SalidaPredicacion[]> {
    return this.http.get<SalidaPredicacion[]>(`${this.baseUrl}/${idTerritorio}/salidas`);
  }

  getSalidaProgreso(idTerritorio: number): Observable<ProgresoTerritorio> {
    return this.http.get<ProgresoTerritorio>(`${this.baseUrl}/${idTerritorio}/salidas/progreso`);
  }

  createSalida(idTerritorio: number, data: Partial<SalidaPredicacion>): Observable<SalidaPredicacion> {
    return this.http.post<SalidaPredicacion>(`${this.baseUrl}/${idTerritorio}/salidas`, data);
  }

  updateSalida(idTerritorio: number, idSalida: number, data: Partial<SalidaPredicacion>): Observable<SalidaPredicacion> {
    return this.http.put<SalidaPredicacion>(`${this.baseUrl}/${idTerritorio}/salidas/${idSalida}`, data);
  }

  deleteSalida(idTerritorio: number, idSalida: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/salidas/${idSalida}`);
  }

  getManzanasSalida(idTerritorio: number, idSalida: number): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/${idTerritorio}/salidas/${idSalida}/manzanas`);
  }

  markManzanaPredicada(idTerritorio: number, idSalida: number, idManzana: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${idTerritorio}/salidas/${idSalida}/manzanas/${idManzana}`, {});
  }

  unmarkManzanaPredicada(idTerritorio: number, idSalida: number, idManzana: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/salidas/${idSalida}/manzanas/${idManzana}`);
  }

  // ── Tile Provider Config ─────────────────────────────────────────────
  getTileProvider(): Observable<{ tile_provider: string }> {
    return this.http.get<{ tile_provider: string }>(`${environment.apiUrl}/configuracion/tile-provider`);
  }

  updateTileProvider(provider: string): Observable<any> {
    return this.http.put(`${environment.apiUrl}/configuracion/tile-provider`, { tile_provider: provider });
  }
}

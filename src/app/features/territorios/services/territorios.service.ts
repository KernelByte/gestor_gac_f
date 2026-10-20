import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConNombre } from '../../../core/utils/nombre.util';
import {
  Territorio,
  Manzana,
  Vivienda,
  ViviendaDeTerritorio,
  CoberturaManzana,
  TerritorioStats,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  AsignacionTerritorio,
  Punto,
  SalidaPredicacion,
  ProgresoTerritorio,
  ResumenTerritorio,
  RegistroS13,
  CicloTerritorio,
} from '../models/territorio.model';

/** Publicador tal como lo necesitan los selectores de capitán y asignación. */
export interface PublicadorOpcion extends ConNombre {
  id_publicador: number;
}

@Injectable({ providedIn: 'root' })
export class TerritoriosService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/territorios`;

  // ── Territorios ──────────────────────────────────────────────────────
  getTerritorios(skip = 0, limit = 100, incluirInactivos = false): Observable<Territorio[]> {
    const params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString())
      .set('incluir_inactivos', String(incluirInactivos));
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
    // Con barra final: es la ruta canónica; sin ella FastAPI responde 307 y el redirect
    // no sobrevive al proxy de desarrollo.
    return this.http.get<Manzana[]>(`${this.baseUrl}/${idTerritorio}/manzanas/`);
  }

  getManzanasGeoJSON(idTerritorio: number): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(`${this.baseUrl}/${idTerritorio}/manzanas/geojson`);
  }

  createManzana(idTerritorio: number, data: Partial<Manzana>): Observable<Manzana> {
    return this.http.post<Manzana>(`${this.baseUrl}/${idTerritorio}/manzanas/`, data);
  }

  updateManzana(idTerritorio: number, idManzana: number, data: Partial<Manzana>): Observable<Manzana> {
    return this.http.put<Manzana>(`${this.baseUrl}/${idTerritorio}/manzanas/${idManzana}`, data);
  }

  deleteManzana(idTerritorio: number, idManzana: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/manzanas/${idManzana}`);
  }

  // ── Viviendas ────────────────────────────────────────────────────────
  getViviendas(idManzana: number): Observable<Vivienda[]> {
    return this.http.get<Vivienda[]>(`${environment.apiUrl}/manzanas/${idManzana}/viviendas/`);
  }

  getViviendasGeoJSON(idManzana: number): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(`${environment.apiUrl}/manzanas/${idManzana}/viviendas/geojson`);
  }

  createVivienda(idManzana: number, data: Partial<Vivienda>): Observable<Vivienda> {
    return this.http.post<Vivienda>(`${environment.apiUrl}/manzanas/${idManzana}/viviendas/`, data);
  }

  updateVivienda(idManzana: number, idVivienda: number, data: Partial<Vivienda>): Observable<Vivienda> {
    return this.http.put<Vivienda>(`${environment.apiUrl}/manzanas/${idManzana}/viviendas/${idVivienda}`, data);
  }

  deleteVivienda(idManzana: number, idVivienda: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/manzanas/${idManzana}/viviendas/${idVivienda}`);
  }

  revisarVivienda(idManzana: number, idVivienda: number): Observable<Vivienda> {
    return this.http.post<Vivienda>(`${environment.apiUrl}/manzanas/${idManzana}/viviendas/${idVivienda}/revisar`, {});
  }

  getViviendasTerritorio(idTerritorio: number): Observable<ViviendaDeTerritorio[]> {
    return this.http.get<ViviendaDeTerritorio[]>(`${this.baseUrl}/${idTerritorio}/viviendas`);
  }

  getNoVisitar(idTerritorio: number): Observable<ViviendaDeTerritorio[]> {
    return this.http.get<ViviendaDeTerritorio[]>(`${this.baseUrl}/${idTerritorio}/no-visitar`);
  }

  /** {id_territorio: cantidad} de "no visitar" que llevan más de un año sin revisarse. */
  getNoVisitarPorRevisar(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.baseUrl}/no-visitar/por-revisar`);
  }

  // ── Cobertura ────────────────────────────────────────────────────────
  getCoberturas(idManzana: number): Observable<CoberturaManzana[]> {
    return this.http.get<CoberturaManzana[]>(`${environment.apiUrl}/manzanas/${idManzana}/cobertura/`);
  }

  /**
   * Coberturas de todas las manzanas del territorio en una sola peticion,
   * agrupadas por id_manzana. Antes la pantalla pedia manzana por manzana.
   */
  getCoberturasDelTerritorio(idTerritorio: number): Observable<Record<number, CoberturaManzana[]>> {
    return this.http.get<Record<number, CoberturaManzana[]>>(`${this.baseUrl}/${idTerritorio}/coberturas`);
  }

  createCobertura(idManzana: number, data: Partial<CoberturaManzana>): Observable<CoberturaManzana> {
    return this.http.post<CoberturaManzana>(`${environment.apiUrl}/manzanas/${idManzana}/cobertura/`, data);
  }

  // ── Asignaciones ──────────────────────────────────────────────────────
  getAsignaciones(idTerritorio: number): Observable<AsignacionTerritorio[]> {
    return this.http.get<AsignacionTerritorio[]>(`${this.baseUrl}/${idTerritorio}/asignaciones/`);
  }

  getAsignacionActiva(idTerritorio: number): Observable<AsignacionTerritorio | null> {
    return this.http.get<AsignacionTerritorio | null>(`${this.baseUrl}/${idTerritorio}/asignaciones/activa`);
  }

  createAsignacion(idTerritorio: number, data: { id_publicador: number; fecha_asignacion: string; notas?: string }): Observable<AsignacionTerritorio> {
    return this.http.post<AsignacionTerritorio>(`${this.baseUrl}/${idTerritorio}/asignaciones/`, data);
  }

  devolverAsignacion(idTerritorio: number, idAsignacion: number, data: { fecha_devolucion: string; notas?: string }): Observable<AsignacionTerritorio> {
    return this.http.put<AsignacionTerritorio>(`${this.baseUrl}/${idTerritorio}/asignaciones/${idAsignacion}/devolver`, data);
  }

  deleteAsignacion(idTerritorio: number, idAsignacion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/asignaciones/${idAsignacion}`);
  }

  // ── Puntos ───────────────────────────────────────────────────────────
  getPuntos(idTerritorio: number): Observable<Punto[]> {
    return this.http.get<Punto[]>(`${this.baseUrl}/${idTerritorio}/puntos/`);
  }

  getPuntosGeoJSON(idTerritorio: number): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(`${this.baseUrl}/${idTerritorio}/puntos/geojson`);
  }

  createPunto(idTerritorio: number, data: Partial<Punto>): Observable<Punto> {
    return this.http.post<Punto>(`${this.baseUrl}/${idTerritorio}/puntos/`, data);
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

  getEstadoManzanas(idTerritorio: number): Observable<Record<string, { nombre_capitan: string; fecha_salida: string }>> {
    return this.http.get<Record<string, { nombre_capitan: string; fecha_salida: string }>>(
      `${this.baseUrl}/${idTerritorio}/salidas/estado-manzanas`
    );
  }

  markManzanaPredicada(idTerritorio: number, idSalida: number, idManzana: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${idTerritorio}/salidas/${idSalida}/manzanas/${idManzana}`, {});
  }

  unmarkManzanaPredicada(idTerritorio: number, idSalida: number, idManzana: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/salidas/${idSalida}/manzanas/${idManzana}`);
  }

  // ── Ciclos, resumen y registro S-13 ────────────────────────────────────
  getResumen(): Observable<ResumenTerritorio[]> {
    return this.http.get<ResumenTerritorio[]>(`${this.baseUrl}/resumen`);
  }

  getRegistroS13(anioServicio?: number): Observable<RegistroS13> {
    let params = new HttpParams();
    if (anioServicio) params = params.set('anio_servicio', String(anioServicio));
    return this.http.get<RegistroS13>(`${this.baseUrl}/registro-s13`, { params });
  }

  completarCiclo(idTerritorio: number): Observable<CicloTerritorio> {
    return this.http.post<CicloTerritorio>(`${this.baseUrl}/${idTerritorio}/ciclos/completar`, {});
  }

  // ── Publicadores (selectores de capitán y asignación) ────────────────
  getPublicadores(idCongregacion?: number | null): Observable<PublicadorOpcion[]> {
    let params = new HttpParams().set('limit', '1000');
    if (idCongregacion) params = params.set('id_congregacion', String(idCongregacion));
    return this.http.get<PublicadorOpcion[]>('/api/publicadores/', { params });
  }

  // ── Tile Provider Config ─────────────────────────────────────────────
  getTileProvider(): Observable<{ tile_provider: string }> {
    return this.http.get<{ tile_provider: string }>(`${environment.apiUrl}/configuracion/tile-provider`);
  }

  updateTileProvider(provider: string): Observable<any> {
    return this.http.put(`${environment.apiUrl}/configuracion/tile-provider`, { tile_provider: provider });
  }
}

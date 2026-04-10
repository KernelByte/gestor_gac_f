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

  // ── Tile Provider Config ─────────────────────────────────────────────
  getTileProvider(): Observable<{ tile_provider: string }> {
    return this.http.get<{ tile_provider: string }>(`${environment.apiUrl}/configuracion/tile-provider`);
  }

  updateTileProvider(provider: string): Observable<any> {
    return this.http.put(`${environment.apiUrl}/configuracion/tile-provider`, { tile_provider: provider });
  }
}

import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ExhibidoresService } from '../../exhibidores/services/exhibidores.service';
import { environment } from '../../../../environments/environment';
import { ConNombre } from '../../../core/utils/nombre.util';
import { SalidaProgramada } from './salidas-programa.service';
import { NumeracionManzanas } from '../utils/numeracion-manzanas.util';
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
  OcupacionManzanas,
  Punto,
  SalidaPredicacion,
  ProgresoTerritorio,
  ResumenTerritorio,
  DireccionHallada,
  ProgresoConfiguracion,
  RegistroS13,
  CicloTerritorio,
  Sector,
  SectoresRespuesta,
  TarjetaSugerida,
  UnidadCongregacion,
  RecorridoRespuesta,
  CriterioRecorrido,
  SugerenciaSalida,
  HistorialRespuesta,
  PuntoSalidaOpcion,
} from '../models/territorio.model';

export interface RenumeracionManzana {
  id_manzana: number;
  id_territorio: number;
  codigo: string | null;
  numero_anterior: string | null;
  numero_manzana: string;
}

export interface EstadoCalles {
  celdas_zona: number;
  celdas_listas: number;
  estado: 'en_curso' | 'listo' | 'error' | null;
  procesadas: number;
  total: number;
  mensaje: string | null;
  terminado: string | null;
}

export interface DibujoLoteFila {
  id_territorio: number;
  codigo: string | null;
  manzanas: number;
  origen: 'calles' | 'ia';
  aviso: string | null;
}

export interface DibujoLote {
  id_lote: number;
  fase: 'calles' | 'ia';
  estado: 'en_curso' | 'listo' | 'error';
  total: number;
  procesados: number;
  usos_ia: number;
  resultado: DibujoLoteFila[];
  mensaje: string | null;
  creado: string | null;
  terminado: string | null;
}

export interface DibujoLoteResumen {
  tarjetas: number;
  con_limite: number;
  sin_limite: number;
  sin_limite_codigos: (string | null)[];
  con_manzanas: number;
  pendientes_ia: { id_territorio: number; codigo: string | null }[];
  usos_ia_hoy: number;
  max_ia_por_dia: number;
  lote: DibujoLote | null;
}

/** Publicador tal como lo necesitan los selectores de capitán y asignación. */
export interface PublicadorOpcion extends ConNombre {
  id_publicador: number;
}

@Injectable({ providedIn: 'root' })
export class TerritoriosService {
  private http = inject(HttpClient);
  private ctx = inject(CongregacionContextService);
  /** Exhibidores dibuja este mismo límite en sus mapas y lo guarda en caché. */
  private exhibidores = inject(ExhibidoresService);
  private baseUrl = `${environment.apiUrl}/territorios`;
  private sectoresUrl = `${environment.apiUrl}/territorio-sectores`;
  private congregacionUrl = `${environment.apiUrl}/territorio-congregacion`;

  /** La congregación de los listados. Para el Administrador es la del selector;
   *  para los demás el backend usa siempre la suya. */
  private conCongregacion(params = new HttpParams()): HttpParams {
    const cong = this.ctx.effectiveCongregacionId();
    return cong ? params.set('id_congregacion', String(cong)) : params;
  }

  // ── Sectores y territorio de la congregación ─────────────────────────
  getSectores(): Observable<SectoresRespuesta> {
    return this.http.get<SectoresRespuesta>(this.sectoresUrl, { params: this.conCongregacion() });
  }
  crearSector(data: Partial<Sector>): Observable<Sector> {
    return this.http.post<Sector>(this.sectoresUrl, data, { params: this.conCongregacion() });
  }
  actualizarSector(id: number, data: Partial<Sector>): Observable<Sector> {
    return this.http.put<Sector>(`${this.sectoresUrl}/${id}`, data);
  }
  borrarSector(id: number): Observable<void> {
    return this.http.delete<void>(`${this.sectoresUrl}/${id}`);
  }
  sugerirTarjetas(id: number): Observable<TarjetaSugerida[]> {
    return this.http.get<TarjetaSugerida[]>(`${this.sectoresUrl}/${id}/sugerir-tarjetas`);
  }
  asignarTarjetas(id: number, ids: number[]): Observable<Sector> {
    return this.http.put<Sector>(`${this.sectoresUrl}/${id}/tarjetas`, { ids });
  }
  getCongregacionLimite(): Observable<UnidadCongregacion[]> {
    return this.http.get<UnidadCongregacion[]>(this.congregacionUrl, { params: this.conCongregacion() });
  }
  importarKml(archivo: File, guardar: boolean): Observable<{ unidades: UnidadCongregacion[] }> {
    const fd = new FormData();
    fd.append('archivo', archivo);
    return this.http.post<{ unidades: UnidadCongregacion[] }>(
      `${this.congregacionUrl}/importar-kml`, fd,
      { params: this.conCongregacion(new HttpParams().set('guardar', String(guardar))) },
    ).pipe(tap(() => { if (guardar) this.exhibidores.invalidarTerritorioLimite(); }));
  }
  estadoSugerenciasIa(id: number): Observable<EstadoSugerenciasIa> {
    return this.http.get<EstadoSugerenciasIa>(`${this.congregacionUrl}/${id}/sugerencias-ia`);
  }
  sugerirLimitesIa(id: number): Observable<SugerenciasLimitesIa> {
    return this.http.post<SugerenciasLimitesIa>(`${this.congregacionUrl}/${id}/sugerencias-ia`, {});
  }
  actualizarCongregacionLimite(id: number, data: Partial<UnidadCongregacion>): Observable<UnidadCongregacion> {
    return this.http.put<UnidadCongregacion>(`${this.congregacionUrl}/${id}`, data)
      .pipe(tap(() => this.exhibidores.invalidarTerritorioLimite()));
  }

  // ── Territorios ──────────────────────────────────────────────────────
  getTerritorios(skip = 0, limit = 100, incluirInactivos = false): Observable<Territorio[]> {
    const params = new HttpParams()
      .set('skip', skip.toString())
      .set('limit', limit.toString())
      .set('incluir_inactivos', String(incluirInactivos));
    return this.http.get<Territorio[]>(this.baseUrl, { params: this.conCongregacion(params) });
  }

  getTerritorio(id: number): Observable<Territorio> {
    return this.http.get<Territorio>(`${this.baseUrl}/${id}`);
  }

  getTerritoriosGeoJSON(): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(`${this.baseUrl}/geojson`, { params: this.conCongregacion() });
  }

  /** Centro del salón de la congregación, para abrir el editor donde se va a dibujar. */
  getMapaContexto(): Observable<{ centro: { lat: number; lng: number } | null }> {
    return this.http.get<{ centro: { lat: number; lng: number } | null }>(`${this.baseUrl}/mapa-contexto`, { params: this.conCongregacion() });
  }

  getTerritorioGeoJSON(id: number): Observable<GeoJSONFeature> {
    return this.http.get<GeoJSONFeature>(`${this.baseUrl}/${id}/geojson`);
  }

  getTerritorioStats(id: number): Observable<TerritorioStats> {
    return this.http.get<TerritorioStats>(`${this.baseUrl}/${id}/stats`);
  }

  createTerritorio(data: Partial<Territorio>): Observable<Territorio> {
    return this.http.post<Territorio>(this.baseUrl, data, { params: this.conCongregacion() });
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

  /** Manzanas propuestas a partir de las calles del mapa (no guarda nada). */
  proponerManzanas(idTerritorio: number, calles: any): Observable<GeoJSONFeatureCollection> {
    return this.http.post<GeoJSONFeatureCollection>(`${this.baseUrl}/${idTerritorio}/manzanas/proponer`, { calles });
  }

  createManzanasLote(idTerritorio: number, manzanas: { numero_manzana: string; coordenada: any }[]): Observable<Manzana[]> {
    return this.http.post<Manzana[]>(`${this.baseUrl}/${idTerritorio}/manzanas/lote`, { manzanas });
  }

  /** Calles de OpenStreetMap del recuadro (cuando el fondo es una imagen y no trae las vías). */
  callesEnBbox(idTerritorio: number, bbox: { s: number; w: number; n: number; e: number }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${idTerritorio}/manzanas/calles`, { bbox });
  }

  /** Cuadras cerradas por las calles, para armar el límite tocándolas. */
  cuadras(idTerritorio: number, calles: any): Observable<GeoJSONFeatureCollection> {
    return this.http.post<GeoJSONFeatureCollection>(`${this.baseUrl}/${idTerritorio}/manzanas/cuadras`, { calles });
  }

  /** Une las cuadras elegidas en el polígono del límite. No guarda nada. */
  unirCuadras(idTerritorio: number, poligonos: any[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${idTerritorio}/manzanas/unir`, { poligonos });
  }

  /** Renumera la secuencia de TODA la congregación (T01 del 1 al N, T02 sigue…). Con guardar=false es solo la vista previa. */
  renumerarManzanas(idTerritorio: number, guardar: boolean): Observable<RenumeracionManzana[]> {
    return this.http.post<RenumeracionManzana[]>(`${this.baseUrl}/${idTerritorio}/manzanas/renumerar`, { guardar });
  }

  /** Lo mismo sin elegir tarjeta: para el aviso general de la página. */
  renumerarSecuencia(guardar: boolean): Observable<RenumeracionManzana[]> {
    return this.http.post<RenumeracionManzana[]>(`${this.baseUrl}/renumerar-manzanas`, { guardar }, { params: this.conCongregacion() });
  }

  /** Números ya usados en la congregación y el que sigue para esta tarjeta. */
  getNumeracion(idTerritorio: number): Observable<NumeracionManzanas> {
    return this.http.get<NumeracionManzanas>(`${this.baseUrl}/${idTerritorio}/manzanas/numeracion`);
  }

  // ── Calles de OpenStreetMap guardadas para la zona de la congregación ──
  estadoCalles(): Observable<EstadoCalles> {
    return this.http.get<EstadoCalles>(`${this.congregacionUrl}/calles/estado`, { params: this.conCongregacion() });
  }
  /** Vuelve a bajar las calles de toda la zona (solo Administrador y Gestor). */
  actualizarCalles(): Observable<EstadoCalles> {
    return this.http.post<EstadoCalles>(`${this.congregacionUrl}/calles/descargar`, {}, { params: this.conCongregacion() });
  }

  // ── Dibujado avanzado de manzanas (solo Administrador y Gestor) ───────
  dibujoLoteResumen(): Observable<DibujoLoteResumen> {
    return this.http.get<DibujoLoteResumen>(`${this.baseUrl}/dibujo-manzanas/resumen`, { params: this.conCongregacion() });
  }
  dibujoLoteEstado(): Observable<DibujoLote | null> {
    return this.http.get<DibujoLote | null>(`${this.baseUrl}/dibujo-manzanas/estado`, { params: this.conCongregacion() });
  }
  iniciarDibujoCalles(): Observable<DibujoLote> {
    return this.http.post<DibujoLote>(`${this.baseUrl}/dibujo-manzanas/calles`, {}, { params: this.conCongregacion() });
  }
  iniciarDibujoIA(confirmar: number): Observable<DibujoLote> {
    return this.http.post<DibujoLote>(`${this.baseUrl}/dibujo-manzanas/ia`, { confirmar }, { params: this.conCongregacion() });
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

  /** Avisos de la tarjeta (no visitar, cuidado, acceso especial, horario), lo más grave primero. */
  getAvisos(idTerritorio: number): Observable<ViviendaDeTerritorio[]> {
    return this.http.get<ViviendaDeTerritorio[]>(`${this.baseUrl}/${idTerritorio}/avisos`);
  }

  getNoVisitar(idTerritorio: number): Observable<ViviendaDeTerritorio[]> {
    return this.http.get<ViviendaDeTerritorio[]>(`${this.baseUrl}/${idTerritorio}/no-visitar`);
  }

  /** {id_territorio: cantidad} de "no visitar" que llevan más de un año sin revisarse. */
  getNoVisitarPorRevisar(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.baseUrl}/no-visitar/por-revisar`);
  }

  /** En qué tarjeta está una dirección. Mínimo 3 letras; el servidor devuelve hasta 30. */
  buscarDirecciones(texto: string): Observable<DireccionHallada[]> {
    return this.http.get<DireccionHallada[]>(`${this.baseUrl}/direcciones/buscar`, { params: { q: texto } });
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

  getOcupacion(idTerritorio: number): Observable<OcupacionManzanas> {
    return this.http.get<OcupacionManzanas>(`${this.baseUrl}/${idTerritorio}/asignaciones/ocupacion`);
  }

  createAsignacion(idTerritorio: number, data: { id_publicador: number; fecha_asignacion: string; notas?: string; ids_manzanas?: number[] }): Observable<AsignacionTerritorio> {
    return this.http.post<AsignacionTerritorio>(`${this.baseUrl}/${idTerritorio}/asignaciones/`, data);
  }

  devolverAsignacion(idTerritorio: number, idAsignacion: number, data: { fecha_devolucion: string; notas?: string }): Observable<AsignacionTerritorio> {
    return this.http.put<AsignacionTerritorio>(`${this.baseUrl}/${idTerritorio}/asignaciones/${idAsignacion}/devolver`, data);
  }

  /** Corrige una asignación vigente (persona, fecha, nota o manzanas). */
  updateAsignacion(idTerritorio: number, idAsignacion: number, data: { id_publicador?: number; fecha_asignacion?: string; notas?: string; ids_manzanas?: number[] }): Observable<AsignacionTerritorio> {
    return this.http.put<AsignacionTerritorio>(`${this.baseUrl}/${idTerritorio}/asignaciones/${idAsignacion}`, data);
  }

  deleteAsignacion(idTerritorio: number, idAsignacion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${idTerritorio}/asignaciones/${idAsignacion}`);
  }

  // ── Puntos ───────────────────────────────────────────────────────────
  getPuntos(idTerritorio: number): Observable<Punto[]> {
    return this.http.get<Punto[]>(`${this.baseUrl}/${idTerritorio}/puntos/`);
  }

  /** Puntos de salida y lugares de todas las tarjetas de la congregación (mapa general). */
  getPuntosCongregacionGeoJSON(): Observable<GeoJSONFeatureCollection> {
    return this.http.get<GeoJSONFeatureCollection>(`${this.baseUrl}/puntos/geojson`, { params: this.conCongregacion() });
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
    return this.http.get<ResumenTerritorio[]>(`${this.baseUrl}/resumen`, { params: this.conCongregacion() });
  }

  getProgresoConfiguracion(): Observable<ProgresoConfiguracion> {
    return this.http.get<ProgresoConfiguracion>(`${this.baseUrl}/progreso`, { params: this.conCongregacion() });
  }

  getRegistroS13(anioServicio?: number): Observable<RegistroS13> {
    let params = new HttpParams();
    if (anioServicio) params = params.set('anio_servicio', String(anioServicio));
    return this.http.get<RegistroS13>(`${this.baseUrl}/registro-s13`, { params: this.conCongregacion(params) });
  }

  /** El mismo registro en el formulario oficial S-13-S (PDF A4). */
  getRegistroS13Pdf(anioServicio: number): Observable<Blob> {
    const params = new HttpParams().set('anio_servicio', String(anioServicio));
    return this.http.get(`${this.baseUrl}/registro-s13/pdf`, { params: this.conCongregacion(params), responseType: 'blob' });
  }

  completarCiclo(idTerritorio: number): Observable<CicloTerritorio> {
    return this.http.post<CicloTerritorio>(`${this.baseUrl}/${idTerritorio}/ciclos/completar`, {});
  }

  // ── Recorrido (orden de predicación y marcar manzanas desde el mapa) ──
  getRecorrido(): Observable<RecorridoRespuesta> {
    return this.http.get<RecorridoRespuesta>(`${this.baseUrl}/recorrido`, { params: this.conCongregacion() });
  }
  guardarConfigRecorrido(cfg: { criterio: CriterioRecorrido; orden_barrios: number[]; id_manzana_inicio: number | null; manzanas_por_salida?: number }): Observable<RecorridoRespuesta> {
    return this.http.put<RecorridoRespuesta>(`${this.baseUrl}/recorrido/config`, cfg, { params: this.conCongregacion() });
  }
  marcarRecorrido(cuerpo: { fecha: string; id_capitan: number | null; ids_manzanas: number[]; id_horario?: number | null; id_punto_salida?: number | null; parciales?: Array<{ id_manzana: number; nota: string | null }> }): Observable<RecorridoRespuesta> {
    return this.http.post<RecorridoRespuesta>(`${this.baseUrl}/recorrido/marcar`, cuerpo, { params: this.conCongregacion() });
  }
  /** Lo que le toca a cada salida programada sin registrar entre dos fechas (clave = id_horario). */
  getSugerencias(desde: string, hasta: string): Observable<Record<string, SugerenciaSalida>> {
    return this.http.get<Record<string, SugerenciaSalida>>(`${this.baseUrl}/recorrido/sugerencias`, { params: this.conCongregacion(new HttpParams().set('desde', desde).set('hasta', hasta)) });
  }
  /** Salidas programadas que ya pasaron y nadie registró, con lo que les tocaba. */
  getPorRegistrar(): Observable<Array<SalidaProgramada & { sugerencia: SugerenciaSalida }>> {
    return this.http.get<Array<SalidaProgramada & { sugerencia: SugerenciaSalida }>>(`${this.baseUrl}/recorrido/por-registrar`, { params: this.conCongregacion() });
  }
  /** Lo ya registrado, de lo más reciente a lo más antiguo, con filtros. */
  getHistorial(f: { desde?: string | null; hasta?: string | null; id_territorio?: number | null; id_capitan?: number | null; limite?: number }): Observable<HistorialRespuesta> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(f)) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return this.http.get<HistorialRespuesta>(`${this.baseUrl}/recorrido/historial`, { params: this.conCongregacion(p) });
  }
  /** «No se salió» (valor=true) o deshacerlo: saca la salida de «Por registrar» sin borrarla del programa. */
  marcarSinSalida(id_horario: number, valor = true): Observable<{ id_horario: number; sin_salida: boolean }> {
    return this.http.post<{ id_horario: number; sin_salida: boolean }>(`${this.baseUrl}/recorrido/horarios/${id_horario}/sin-salida`, { valor }, { params: this.conCongregacion() });
  }
  getPuntosSalida(): Observable<PuntoSalidaOpcion[]> {
    return this.http.get<PuntoSalidaOpcion[]>(`${this.baseUrl}/recorrido/puntos-salida`, { params: this.conCongregacion() });
  }
  desmarcarRecorrido(ids_manzanas: number[]): Observable<RecorridoRespuesta> {
    return this.http.post<RecorridoRespuesta>(`${this.baseUrl}/recorrido/desmarcar`, { ids_manzanas }, { params: this.conCongregacion() });
  }

  /** Corrige una manzana ya marcada: predicada ↔ a medias. */
  cambiarEstadoRecorrido(id_manzana: number, estado: 'predicada' | 'parcial', nota: string | null = null): Observable<RecorridoRespuesta> {
    return this.http.post<RecorridoRespuesta>(`${this.baseUrl}/recorrido/cambiar-estado`, { id_manzana, estado, nota }, { params: this.conCongregacion() });
  }

  /** Historial de vueltas de una tarjeta. */
  vueltasRecorrido(id_territorio: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/recorrido/vueltas/${id_territorio}`, { params: this.conCongregacion() });
  }

  /** Lo predicado en una vuelta pasada (solo para mirar en el mapa). */
  vueltaPasadaRecorrido(id_territorio: number, id_ciclo: number): Observable<{ features: any[]; ciclo: any }> {
    return this.http.get<{ features: any[]; ciclo: any }>(`${this.baseUrl}/recorrido/vueltas/${id_territorio}/${id_ciclo}`, { params: this.conCongregacion() });
  }

  /** Empieza otra vuelta en esas tarjetas (vacío: en todas). */
  nuevaVueltaRecorrido(ids_territorios: number[]): Observable<RecorridoRespuesta> {
    return this.http.post<RecorridoRespuesta>(`${this.baseUrl}/recorrido/nueva-vuelta`, { ids_territorios }, { params: this.conCongregacion() });
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

export type LadoLimite = 'norte' | 'este' | 'sur' | 'oeste';

export interface EstadoSugerenciasIa {
  habilitado: boolean;
  intentos_max: number;
  intentos_restantes: number;
}

export interface SugerenciasLimitesIa {
  sugerencias: Record<LadoLimite, { calles: string[]; texto: string }>;
  actuales: Record<LadoLimite, string | null>;
  intentos_max: number;
  intentos_restantes: number;
  aviso?: string;
}

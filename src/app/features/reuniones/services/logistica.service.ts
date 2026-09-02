import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ActualizarEnlaceRequest,
  ActualizarPreferenciasRequest,
  ConfiguracionPreferenciasOut,
  ConfirmarLogisticaRequest,
  ConflictoLogistica,
  EditarAseoRequest,
  EditarLogisticaItemRequest,
  EnlacePublicoLogistica,
  GenerarEnlaceRequest,
  GenerarLogisticaRequest,
  GrupoBase,
  LogisticaItemOut,
  LogisticaMesOut,
  MesDisponible,
  OpcionesPdfLogistica,
  PublicadorBase,
  RebalanceoPropuesta,
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

  /**
   * Hace visible el mes a la congregación.
   *
   * Responde 409 si quedan puestos vacíos que alguien podría cubrir: un hueco
   * resoluble no debe llegar publicado a la cartelera.
   */
  publicar(payload: ConfirmarLogisticaRequest, idCong: number | null): Observable<LogisticaMesOut> {
    return this.http.post<LogisticaMesOut>(`${this.base}/publicar`, payload, {
      params: this.congParams(idCong),
    });
  }

  /** Deshace las ediciones hechas después de la última publicación. */
  descartarCambios(payload: ConfirmarLogisticaRequest, idCong: number | null): Observable<LogisticaMesOut> {
    return this.http.post<LogisticaMesOut>(`${this.base}/descartar-cambios`, payload, {
      params: this.congParams(idCong),
    });
  }

  getCandidatos(puesto: string, idCong: number | null): Observable<PublicadorBase[]> {
    const params = this.congParams(idCong).set('puesto', puesto);
    return this.http.get<PublicadorBase[]>(`${this.base}/candidatos`, { params });
  }

  /**
   * Reparte la carga del mes. Con `aplicar: false` sólo devuelve la propuesta
   * y no escribe nada, para poder enseñarla antes de confirmar.
   */
  rebalancearMes(
    ano: number, mes: number, aplicar: boolean, idCong: number | null,
  ): Observable<RebalanceoPropuesta> {
    return this.http.post<RebalanceoPropuesta>(
      `${this.base}/rebalancear`,
      { ano, mes, aplicar },
      { params: this.congParams(idCong) },
    );
  }

  /**
   * Quién ya tiene algo asignado ese día en las otras programaciones
   * (entre semana, fin de semana, discursos salientes, exhibidores), como
   * { id_publicador: motivo }.
   *
   * No incluye logística: esa pantalla ya tiene el mes en memoria y la
   * resuelve al instante, sin quedar desfasada tras cada asignación.
   */
  getOcupados(fecha: string, idCong: number | null): Observable<Record<number, string>> {
    const params = this.congParams(idCong).set('fecha', fecha);
    return this.http.get<Record<number, string>>(`${this.base}/ocupados`, { params });
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

  /** Cómo genera esta congregación: rotación de cada puesto y revisión previa. */
  getConfiguracionPreferencias(idCong: number | null): Observable<ConfiguracionPreferenciasOut> {
    return this.http.get<ConfiguracionPreferenciasOut>(
      `${this.base}/configuracion/preferencias`,
      { params: this.congParams(idCong) },
    );
  }

  /** Guarda solo las claves que cambian y devuelve el estado ya persistido. */
  actualizarPreferencias(
    cambios: Record<string, string>, idCong: number | null,
  ): Observable<ConfiguracionPreferenciasOut> {
    return this.http.put<ConfiguracionPreferenciasOut>(
      `${this.base}/configuracion/preferencias`,
      { cambios } as ActualizarPreferenciasRequest,
      { params: this.congParams(idCong) },
    );
  }

  verificarConflicto(idPublicador: number, fecha: string): Observable<ConflictoLogistica> {
    const params = new HttpParams().set('id_publicador', idPublicador).set('fecha', fecha);
    return this.http.get<ConflictoLogistica>(`${this.base}/conflicto`, { params });
  }

  eliminarMes(ano: number, mes: number, idCong: number | null): Observable<{ ok: boolean }> {
    let params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.delete<{ ok: boolean }>(`${this.base}/mes`, { params });
  }

  descargarPdf(
    ano: number, mes: number, idCong: number | null, opciones: OpcionesPdfLogistica = {},
  ): Observable<Blob> {
    let params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    if (opciones.incluir_discursos) params = params.set('incluir_discursos', 'true');
    if (opciones.tamano_pagina) params = params.set('tamano_pagina', opciones.tamano_pagina);
    if (opciones.orientacion) params = params.set('orientacion', opciones.orientacion);
    return this.http.get(`${this.base}/pdf`, { params, responseType: 'blob' });
  }

  // ── Enlace público ──────────────────────────────────────────

  obtenerEnlace(
    ano: number, mes: number, idCong: number | null,
  ): Observable<EnlacePublicoLogistica | null> {
    let params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get<EnlacePublicoLogistica | null>(`${this.base}/enlace`, { params });
  }

  generarEnlace(
    payload: GenerarEnlaceRequest, idCong: number | null,
  ): Observable<EnlacePublicoLogistica> {
    return this.http.post<EnlacePublicoLogistica>(`${this.base}/enlace`, payload, {
      params: this.congParams(idCong),
    });
  }

  actualizarEnlaceExpiracion(
    payload: ActualizarEnlaceRequest, idCong: number | null,
  ): Observable<EnlacePublicoLogistica> {
    return this.http.patch<EnlacePublicoLogistica>(`${this.base}/enlace`, payload, {
      params: this.congParams(idCong),
    });
  }

  revocarEnlaces(
    ano: number, mes: number, idCong: number | null,
  ): Observable<{ revocados: number }> {
    return this.http.post<{ revocados: number }>(
      `${this.base}/revocar-enlaces`, { ano, mes }, { params: this.congParams(idCong) },
    );
  }

  // ── Compartir por WhatsApp ────────────────────────────────────

  /** Texto ya redactado por el backend, listo para editar y enviar. */
  resumenDia(fecha: string, idCong: number | null): Observable<{ mensaje: string }> {
    const params = this.congParams(idCong).set('fecha', fecha);
    return this.http.get<{ mensaje: string }>(`${this.base}/resumen-dia`, { params });
  }
}

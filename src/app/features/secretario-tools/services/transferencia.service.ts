import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AgregarMiembrosRequest, CongregacionBuscada, CompletarTransferenciaRequest, CongregacionDestino, ImpactoTraslado, Transferencia, TransferenciaCreate, TransferenciaUpdate } from '../models/transferencia.model';

@Injectable({ providedIn: 'root' })
export class TransferenciaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/transferencias`;

  list(filtros: { estado?: string; id_congregacion?: number } = {}): Observable<Transferencia[]> {
    return this.http.get<Transferencia[]>(`${this.url}/`, { params: filtros as any });
  }

  get(id: number): Observable<Transferencia> {
    return this.http.get<Transferencia>(`${this.url}/${id}`);
  }

  create(data: TransferenciaCreate): Observable<Transferencia> {
    return this.http.post<Transferencia>(`${this.url}/`, data);
  }

  update(id: number, data: TransferenciaUpdate): Observable<Transferencia> {
    return this.http.put<Transferencia>(`${this.url}/${id}`, data);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Congregaciones que coinciden con un nombre o número (solo Secretario y Administrador). */
  buscarCongregaciones(q: string): Observable<CongregacionBuscada[]> {
    return this.http.get<CongregacionBuscada[]>(`${this.url}/congregaciones`, { params: { q } });
  }

  /** Confirma a qué congregación de GAC corresponde un número antes de trasladar. */
  verificarCongregacion(numero: string): Observable<CongregacionDestino> {
    return this.http.get<CongregacionDestino>(`${this.url}/congregacion-destino`, { params: { numero } });
  }

  /** Sin `idsAgregar`: los miembros de la transferencia. Con ellos: los familiares que se quieren sumar. */
  impacto(id: number, idsAgregar?: number[]): Observable<ImpactoTraslado> {
    const params = idsAgregar?.length ? { id_publicadores: idsAgregar.join(',') } : undefined;
    return this.http.get<ImpactoTraslado>(`${this.url}/${id}/impacto`, { params });
  }

  /** Lista entera de quiénes van (solo mientras no se completa); el primero es la cabeza. */
  actualizarMiembros(id: number, id_publicadores: number[]): Observable<Transferencia> {
    return this.http.put<Transferencia>(`${this.url}/${id}/miembros`, { id_publicadores });
  }

  agregarMiembros(id: number, data: AgregarMiembrosRequest): Observable<Transferencia> {
    return this.http.post<Transferencia>(`${this.url}/${id}/agregar-miembros`, data);
  }

  completar(id: number, data: CompletarTransferenciaRequest): Observable<Transferencia> {
    return this.http.post<Transferencia>(`${this.url}/${id}/completar`, data);
  }

  redactarCarta(id: number, instrucciones_extra?: string): Observable<{ carta_redactada: string }> {
    return this.http.post<{ carta_redactada: string }>(`${this.url}/redactar-carta`, {
      id_transferencia: id,
      instrucciones_extra,
    });
  }

  /** Carta armada con las notas, sin IA. */
  cartaDesdeNotas(id: number): Observable<{ carta_redactada: string }> {
    return this.http.post<{ carta_redactada: string }>(`${this.url}/${id}/carta-desde-notas`, {});
  }

  /** ¿Se ofrece "Mejorar redacción"? Solo con IA local (los datos no salen a terceros). */
  mejoraDisponible(): Observable<{ disponible: boolean }> {
    return this.http.get<{ disponible: boolean }>(`${this.url}/mejora-redaccion`);
  }

  generarPaquete(id: number): Observable<Blob> {
    return this.http.post(`${this.url}/${id}/paquete`, {}, { responseType: 'blob' });
  }

  /** La carta guardada, también para la congregación que recibió el traslado. */
  cartaPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/carta.pdf`, { responseType: 'blob' });
  }

  previewCarta(id: number, carta_redactada?: string): Observable<Blob> {
    return this.http.post(`${this.url}/${id}/carta/preview`, { carta_redactada }, { responseType: 'blob' });
  }
}

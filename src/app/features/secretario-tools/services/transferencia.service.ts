import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Transferencia, TransferenciaCreate, TransferenciaUpdate } from '../models/transferencia.model';

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

  redactarCarta(id: number, instrucciones_extra?: string): Observable<{ carta_redactada: string }> {
    return this.http.post<{ carta_redactada: string }>(`${this.url}/redactar-carta`, {
      id_transferencia: id,
      instrucciones_extra,
    });
  }

  generarPaquete(id: number): Observable<Blob> {
    return this.http.post(`${this.url}/${id}/paquete`, {}, { responseType: 'blob' });
  }
}

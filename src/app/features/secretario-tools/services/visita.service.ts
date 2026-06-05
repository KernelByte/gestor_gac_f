import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AgendaRequest, EnvioCorreoRequest, TokenVisita, Visita, VisitaCreate, ArchivoAdjunto, VistaPublica } from '../models/visita.model';

@Injectable({ providedIn: 'root' })
export class VisitaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/visita-sc`;

  list(idCongregacion?: number): Observable<Visita[]> {
    const params: any = {};
    if (idCongregacion) params.id_congregacion = idCongregacion;
    return this.http.get<Visita[]>(`${this.url}/`, { params });
  }

  get(id: number): Observable<Visita> {
    return this.http.get<Visita>(`${this.url}/${id}`);
  }

  create(data: VisitaCreate): Observable<Visita> {
    return this.http.post<Visita>(`${this.url}/`, data);
  }

  update(id: number, data: Partial<VisitaCreate>): Observable<Visita> {
    return this.http.put<Visita>(`${this.url}/${id}`, data);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  // Agenda
  generarAgenda(data: AgendaRequest): Observable<Visita> {
    return this.http.post<Visita>(`${this.url}/agenda`, data);
  }

  descargarAgenda(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/agenda/descargar`, { responseType: 'blob' });
  }

  // Archivos
  listarArchivos(id: number): Observable<ArchivoAdjunto[]> {
    return this.http.get<ArchivoAdjunto[]>(`${this.url}/${id}/archivos`);
  }

  subirArchivo(id: number, archivo: File): Observable<ArchivoAdjunto> {
    const fd = new FormData();
    fd.append('archivo', archivo);
    return this.http.post<ArchivoAdjunto>(`${this.url}/${id}/archivos`, fd);
  }

  eliminarArchivo(id: number, nombre: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/archivos/${encodeURIComponent(nombre)}`);
  }

  descargarZip(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/zip`, { responseType: 'blob' });
  }

  getEnlaceActivo(id: number): Observable<TokenVisita | null> {
    return this.http.get<TokenVisita | null>(`${this.url}/${id}/enlace-temporal`);
  }

  crearEnlaceTemporal(id: number): Observable<TokenVisita> {
    return this.http.post<TokenVisita>(`${this.url}/${id}/enlace-temporal`, {});
  }

  revocarEnlaces(id: number): Observable<{ revocados: number }> {
    return this.http.post<{ revocados: number }>(`${this.url}/${id}/revocar-enlaces`, {});
  }

  enviarCorreo(data: EnvioCorreoRequest): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.url}/enviar-correo`, data);
  }

  // Público
  vistaPublica(token: string): Observable<VistaPublica> {
    return this.http.get<VistaPublica>(`${this.url}/public/${token}`);
  }

  descargarPublicoZip(token: string): Observable<Blob> {
    return this.http.get(`${this.url}/public/${token}/zip`, { responseType: 'blob' });
  }
}

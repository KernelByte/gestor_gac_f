import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

export interface PublicInformeInfo {
  valido: boolean;
  publicador_nombre: string;
  mes_nombre: string;
  ano: number;
  requiere_horas: boolean;
  informe_existente?: boolean;
  participo?: boolean;
  horas?: number;
  cursos_biblicos?: number;
  observaciones?: string;
}

export interface PublicInformeSubmit {
  participo: boolean;
  horas: number;
  cursos_biblicos: number;
  observaciones?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PublicInformeService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/informes/publico`;

  validarToken(token: string): Observable<PublicInformeInfo> {
    return this.http.get<PublicInformeInfo>(`${this.apiUrl}/${token}`);
  }

  registrarInforme(token: string, datos: PublicInformeSubmit): Observable<{status: string, message: string}> {
    return this.http.post<{status: string, message: string}>(`${this.apiUrl}/${token}`, datos);
  }
}

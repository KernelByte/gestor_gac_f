import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
   Periodo,
   ResumenMensual,
   InformeLoteCreate,
   InformeLoteResult,
   HistorialAnual,
   ResumenSucursal
} from '../models/informe.model';

@Injectable({ providedIn: 'root' })
export class InformesService {
   private http = inject(HttpClient);
   private apiUrl = `${environment.apiUrl}/informes`;
   private periodosUrl = `${environment.apiUrl}/periodos`;
   private gruposUrl = `${environment.apiUrl}/grupos`;

   // --- Periodos ---
   getPeriodos(): Observable<Periodo[]> {
      return this.http.get<Periodo[]>(this.periodosUrl);
   }

   getPeriodoActual(): Observable<Periodo> {
      const now = new Date();
      const ano = now.getFullYear();
      const mes = (now.getMonth() + 1).toString().padStart(2, '0');
      return this.http.get<Periodo>(`${this.periodosUrl}/by-ano-mes?ano=${ano}&mes=${mes}`);
   }

   // --- Resumen Mensual ---
   getResumenMensual(
      periodoId: number,
      congregacionId: number,
      grupoId?: number,
      soloSinInforme: boolean = false,
      search?: string
   ): Observable<ResumenMensual> {
      let params = new HttpParams()
         .set('periodo_id', periodoId.toString())
         .set('congregacion_id', congregacionId.toString())
         .set('solo_sin_informe', soloSinInforme.toString());

      if (grupoId) {
         params = params.set('grupo_id', grupoId.toString());
      }
      if (search) {
         params = params.set('search', search);
      }

      return this.http.get<ResumenMensual>(`${this.apiUrl}/resumen-mensual`, { params });
   }

   // --- Guardar en Lote ---
   guardarInformesLote(data: InformeLoteCreate): Observable<InformeLoteResult> {
      return this.http.post<InformeLoteResult>(`${this.apiUrl}/guardar-lote`, data);
   }

   // --- Historial Anual ---
   getHistorialAnual(publicadorId: number, anoServicio: number): Observable<HistorialAnual> {
      const params = new HttpParams()
         .set('publicador_id', publicadorId.toString())
         .set('ano_servicio', anoServicio.toString());

      return this.http.get<HistorialAnual>(`${this.apiUrl}/historial-anual`, { params });
   }

   // --- Resumen Sucursal ---
   getResumenSucursal(periodoId: number, congregacionId: number): Observable<ResumenSucursal> {
      const params = new HttpParams()
         .set('periodo_id', periodoId.toString())
         .set('congregacion_id', congregacionId.toString());

      return this.http.get<ResumenSucursal>(`${this.apiUrl}/resumen-sucursal`, { params });
   }

   // --- Export/Import Excel ---
   exportTemplate(periodoId: number, grupoId: number): Observable<Blob> {
      const params = new HttpParams()
         .set('periodo_id', periodoId.toString())
         .set('grupo_id', grupoId.toString());

      return this.http.get(`${this.apiUrl}/export-template`, {
         params,
         responseType: 'blob'
      });
   }

   importTemplate(file: File): Observable<any> {
      const formData = new FormData();
      formData.append('archivo', file);
      return this.http.post(`${this.apiUrl}/import-template`, formData);
   }
}

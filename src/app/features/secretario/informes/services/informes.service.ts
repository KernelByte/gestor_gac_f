<<<<<<< HEAD
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
   HistorialAnualOut,
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
   // --- Historial Anual ---
   getHistorialAnual(congregacionId: number, anoServicio: number, grupoId?: number, tipoVista: string = 'ano_servicio'): Observable<HistorialAnualOut> {
      let params = new HttpParams()
         .set('congregacion_id', congregacionId.toString())
         .set('ano_servicio', anoServicio.toString())
         .set('tipo_vista', tipoVista);

      if (grupoId) {
         params = params.set('grupo_id', grupoId.toString());
      }

      return this.http.get<HistorialAnualOut>(`${this.apiUrl}/historial-anual`, { params });
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

   exportTemplateCongregacion(periodoId: number, congregacionId: number): Observable<Blob> {
      const params = new HttpParams()
         .set('periodo_id', periodoId.toString())
         .set('congregacion_id', congregacionId.toString());

      return this.http.get(`${this.apiUrl}/export-template`, {
         params,
         responseType: 'blob'
      });
   }

   // --- Export Historial PDF ---
   exportHistorialPdf(
      congregacionId: number,
      anoServicio: number,
      viewType: string,
      filters: { grupoId?: number | null, soloPrecursores?: boolean, publicadorId?: number }
   ): Observable<Blob> {
      let params = new HttpParams()
         .set('congregacion_id', congregacionId.toString())
         .set('ano_servicio', anoServicio.toString())
         .set('tipo_vista', viewType);

      if (filters.grupoId) params = params.set('grupo_id', filters.grupoId.toString());
      if (filters.soloPrecursores) params = params.set('solo_precursores', 'true');
      if (filters.publicadorId) params = params.set('publicador_id', filters.publicadorId.toString());

      return this.http.get(`${this.apiUrl}/export-historial-pdf`, { params, responseType: 'blob' });
   }
}
=======
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
   HistorialAnualOut,
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
   // --- Historial Anual ---
   getHistorialAnual(congregacionId: number, anoServicio: number, grupoId?: number, tipoVista: string = 'ano_servicio'): Observable<HistorialAnualOut> {
      let params = new HttpParams()
         .set('congregacion_id', congregacionId.toString())
         .set('ano_servicio', anoServicio.toString())
         .set('tipo_vista', tipoVista);

      if (grupoId) {
         params = params.set('grupo_id', grupoId.toString());
      }

      return this.http.get<HistorialAnualOut>(`${this.apiUrl}/historial-anual`, { params });
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

   exportTemplateCongregacion(periodoId: number, congregacionId: number): Observable<Blob> {
      const params = new HttpParams()
         .set('periodo_id', periodoId.toString())
         .set('congregacion_id', congregacionId.toString());

      return this.http.get(`${this.apiUrl}/export-template`, {
         params,
         responseType: 'blob'
      });
   }

   // --- Export Historial PDF ---
   exportHistorialPdf(
      congregacionId: number,
      anoServicio: number,
      viewType: string,
      filters: { grupoId?: number | null, soloPrecursores?: boolean, publicadorId?: number }
   ): Observable<Blob> {
      let params = new HttpParams()
         .set('congregacion_id', congregacionId.toString())
         .set('ano_servicio', anoServicio.toString())
         .set('tipo_vista', viewType);

      if (filters.grupoId) params = params.set('grupo_id', filters.grupoId.toString());
      if (filters.soloPrecursores) params = params.set('solo_precursores', 'true');
      if (filters.publicadorId) params = params.set('publicador_id', filters.publicadorId.toString());

      return this.http.get(`${this.apiUrl}/export-historial-pdf`, { params, responseType: 'blob' });
   }
}
>>>>>>> 1593876472dea46a6f8e45e2a2ccc147b7c52275

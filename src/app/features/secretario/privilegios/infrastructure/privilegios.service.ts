import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../../environments/environment'; // Ajustar ruta según corresponda
import { Privilegio } from '../domain/models/privilegio';
import { PublicadorPrivilegio, PublicadorPrivilegioCreate, PublicadorPrivilegioUpdate } from '../domain/models/publicador-privilegio';
import { PrecursorConsideracion, PrecursorConsideracionCreate, PrecursorConsideracionUpdate } from '../domain/models/precursor-consideracion';
import { Observable, lastValueFrom, shareReplay } from 'rxjs';

@Injectable({
   providedIn: 'root'
})
export class PrivilegiosService {
   private http = inject(HttpClient);
   // Asumiendo que environment.apiUrl apunta a /api o similar
   // Rutas backend: /privilegios y /publicador-privilegios
   // Adjust paths if necessary. 
   // IMPORTANT: The backend routers define prefix="/privilegios" and prefix="/publicador-privilegios"
   // Assuming the globally configured base url includes /api if the backend expects it.

   // NOTE: En entornos previos, la URL base solía ser http://localhost:8000/api/v1 o similar.
   // Check proxy.conf.json or environment files if unsure. 
   // Assuming relative path '/api/...' works via proxy or absolute URL environment.

   private get baseUrl() {
      // Basic fix to avoid import errors if environment not found right away, 
      // but typically it is 'src/environments/environment.ts'
      return '/api';
   }

   // --- Catálogo de Privilegios (cached) ---

   private privilegios$: Observable<Privilegio[]> | null = null;

   getPrivilegios(): Observable<Privilegio[]> {
      if (!this.privilegios$) {
         this.privilegios$ = this.http.get<Privilegio[]>(`${this.baseUrl}/privilegios/`).pipe(
            shareReplay({ bufferSize: 1, refCount: true })
         );
      }
      return this.privilegios$;
   }

   refreshPrivilegios(): void {
      this.privilegios$ = null;
   }

   // --- Privilegios de Publicadores ---

   getPublicadorPrivilegios(idPublicador: number, activos?: boolean) {
      let params = new HttpParams().set('id_publicador', idPublicador);
      if (activos !== undefined) {
         params = params.set('activos', activos);
      }
      return this.http.get<PublicadorPrivilegio[]>(`${this.baseUrl}/publicador-privilegios/`, { params });
   }

   createPublicadorPrivilegio(payload: PublicadorPrivilegioCreate) {
      return this.http.post<PublicadorPrivilegio>(`${this.baseUrl}/publicador-privilegios/`, payload);
   }

   updatePublicadorPrivilegio(id: number, payload: PublicadorPrivilegioUpdate) {
      return this.http.put<PublicadorPrivilegio>(`${this.baseUrl}/publicador-privilegios/${id}`, payload);
   }

   deletePublicadorPrivilegio(id: number) {
      return this.http.delete<void>(`${this.baseUrl}/publicador-privilegios/${id}`);
   }

   isPrivilegioEliminable(id: number) {
      return this.http.get<{ eliminable: boolean; motivo: string | null }>(
         `${this.baseUrl}/publicador-privilegios/${id}/eliminable`
      );
   }

   // --- Consideraciones especiales (exención del requisito de horas) ---

   /** Sin idPublicador devuelve las de toda la congregación (para badges del listado). */
   getConsideraciones(idPublicador?: number, vigentes?: boolean, idCongregacion?: number | null) {
      let params = new HttpParams();
      if (idPublicador !== undefined) params = params.set('id_publicador', idPublicador);
      if (vigentes !== undefined) params = params.set('vigentes', vigentes);
      if (idCongregacion != null) params = params.set('id_congregacion', idCongregacion);
      return this.http.get<PrecursorConsideracion[]>(
         `${this.baseUrl}/precursor-consideraciones/`, { params }
      );
   }

   createConsideracion(payload: PrecursorConsideracionCreate) {
      return this.http.post<PrecursorConsideracion>(
         `${this.baseUrl}/precursor-consideraciones/`, payload
      );
   }

   updateConsideracion(id: number, payload: PrecursorConsideracionUpdate) {
      return this.http.put<PrecursorConsideracion>(
         `${this.baseUrl}/precursor-consideraciones/${id}`, payload
      );
   }

   deleteConsideracion(id: number) {
      return this.http.delete<void>(`${this.baseUrl}/precursor-consideraciones/${id}`);
   }
}

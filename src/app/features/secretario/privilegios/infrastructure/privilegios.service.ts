import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../../environments/environment'; // Ajustar ruta según corresponda
import { Privilegio } from '../domain/models/privilegio';
import { PublicadorPrivilegio, PublicadorPrivilegioCreate, PublicadorPrivilegioUpdate } from '../domain/models/publicador-privilegio';
import { lastValueFrom } from 'rxjs';

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

   // --- Catálogo de Privilegios ---

   getPrivilegios() {
      return this.http.get<Privilegio[]>(`${this.baseUrl}/privilegios/`);
   }

   // --- Privilegios de Publicadores ---

   getPublicadorPrivilegios(idPublicador: number) {
      const params = new HttpParams().set('id_publicador', idPublicador);
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
}

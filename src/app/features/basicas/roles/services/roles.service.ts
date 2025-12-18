import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Rol } from '../models/rol.model';
import { Observable } from 'rxjs';

@Injectable({
   providedIn: 'root' // Disponible en toda la app o solo en el módulo si prefieres
})
export class RolesService {
   private http = inject(HttpClient);
   private readonly API_URL = '/api/roles/';

   getRoles(): Observable<Rol[]> {
      return this.http.get<Rol[]>(this.API_URL);
   }

   getRol(id: number): Observable<Rol> {
      return this.http.get<Rol>(`${this.API_URL}/${id}`);
   }

   createRol(rol: Partial<Rol>): Observable<Rol> {
      return this.http.post<Rol>(this.API_URL, rol);
   }

   updateRol(id: number, rol: Partial<Rol>): Observable<Rol> {
      return this.http.put<Rol>(`${this.API_URL}/${id}`, rol);
   }

   deleteRol(id: number): Observable<void> {
      return this.http.delete<void>(`${this.API_URL}/${id}`);
   }
}

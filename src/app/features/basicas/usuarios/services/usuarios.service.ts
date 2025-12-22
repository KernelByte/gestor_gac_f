import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario, UsuarioCreate, UsuarioUpdate } from '../models/usuario.model';

export interface Rol {
   id_rol: number;
   descripcion_rol: string;
}

export interface Congregacion {
   id_congregacion: number;
   nombre_congregacion: string;
}

@Injectable({
   providedIn: 'root'
})
export class UsuariosService {
   private http = inject(HttpClient);
   private readonly API_URL = '/api/usuarios/';
   private readonly ROLES_URL = '/api/roles/';
   private readonly CONGREGACIONES_URL = '/api/congregaciones/';

   getUsuarios(q?: string): Observable<Usuario[]> {
      let params: any = {};
      if (q) params.q = q;
      return this.http.get<Usuario[]>(this.API_URL, { params });
   }

   createUsuario(usuario: UsuarioCreate): Observable<Usuario> {
      // Ensure we send plain object
      return this.http.post<Usuario>(this.API_URL, usuario);
   }

   updateUsuario(id: number, usuario: UsuarioUpdate): Observable<Usuario> {
      return this.http.put<Usuario>(`${this.API_URL}${id}`, usuario);
   }

   deleteUsuario(id: number): Observable<void> {
      return this.http.delete<void>(`${this.API_URL}${id}`);
   }

   getRoles(): Observable<Rol[]> {
      return this.http.get<Rol[]>(this.ROLES_URL);
   }

   getCongregaciones(): Observable<Congregacion[]> {
      return this.http.get<Congregacion[]>(this.CONGREGACIONES_URL);
   }
}

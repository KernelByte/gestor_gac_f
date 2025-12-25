import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario, UsuarioCreate, UsuarioUpdate } from '../models/usuario.model';

export interface Rol {
   id_rol: number;
   nombre_rol: string;
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

   getPublicadores(idCongregacion?: number): Observable<any[]> {
      let params: any = { limit: 1000 }; // Increase limit to fetch all publishers
      if (idCongregacion) params.id_congregacion = idCongregacion;
      return this.http.get<any[]>('/api/publicadores/', { params });
   }

   // ---- Endpoints seguros para Coordinador/Secretario ----

   /**
    * Obtiene usuarios de la congregación del usuario logueado.
    * Solo devuelve usuarios con rol "Usuario Publicador".
    * Requiere rol Coordinador o Secretario.
    */
   getUsuariosMiCongregacion(q?: string): Observable<Usuario[]> {
      let params: any = {};
      if (q) params.q = q;
      return this.http.get<Usuario[]>(`${this.API_URL}mi-congregacion`, { params });
   }

   /**
    * Crea un usuario con rol "Usuario Publicador" (forzado en el servidor).
    * Requiere rol Coordinador o Secretario.
    * El publicador debe pertenecer a la congregación del usuario logueado.
    */
   createUsuarioPublicador(usuario: UsuarioCreatePublicador): Observable<Usuario> {
      return this.http.post<Usuario>(`${this.API_URL}crear-publicador`, usuario);
   }
}

// Interface para creación restringida (sin campo de rol)
export interface UsuarioCreatePublicador {
   nombre: string;
   correo: string;
   contrasena: string;
   telefono?: string;
   tipo_identificacion?: string;
   id_identificacion?: string;
   id_usuario_publicador: number; // Requerido - debe pertenecer a la misma congregación
}


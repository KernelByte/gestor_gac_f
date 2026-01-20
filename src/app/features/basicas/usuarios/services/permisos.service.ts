import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface Permiso {
   id_permiso: number;
   codigo: string;
   nombre: string;
   descripcion?: string;
   categoria: string;
   icono?: string;
   orden?: number;
   activo: boolean;
}

export interface PermisoConEstado {
   id_permiso: number;
   codigo: string;
   nombre: string;
   descripcion?: string;
   icono?: string;
   asignado: boolean;
   alcance?: string; // e.g. 'todos', 'grupo:1', etc.
}

export interface PermisosPorCategoria {
   categoria: string;
   permisos: Permiso[];
}

@Injectable({
   providedIn: 'root'
})
export class PermisosService {
   private http = inject(HttpClient);
   private API_URL = `${environment.apiUrl}/permisos/`;

   /**
    * Obtiene todos los permisos del sistema
    */
   getPermisos(): Observable<Permiso[]> {
      return this.http.get<Permiso[]>(this.API_URL);
   }

   /**
    * Obtiene permisos agrupados por categoría
    */
   getPermisosPorCategoria(): Observable<PermisosPorCategoria[]> {
      return this.http.get<PermisosPorCategoria[]>(`${this.API_URL}categorias`);
   }

   /**
    * Obtiene permisos de un usuario con estado de asignación
    */
   getPermisosUsuario(idUsuario: number): Observable<PermisoConEstado[]> {
      return this.http.get<PermisoConEstado[]>(`${this.API_URL}usuarios/${idUsuario}`);
   }

   /**
    * Actualiza los permisos de un usuario
    */
   updatePermisosUsuario(idUsuario: number, permisos: number[]): Observable<Permiso[]> {
      return this.http.put<Permiso[]>(`${this.API_URL}usuarios/${idUsuario}`, { permisos });
   }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

/**
 * Forma del permiso dentro de su módulo. La rellenan solo los módulos repartidos
 * por pestaña (Publicadores, Informes); el resto llega con los tres campos en
 * null y se pinta como un interruptor suelto.
 *
 * 'alcance' no es una capacidad: es la opción "toda la congregación" de esa
 * pantalla. Cuando el permiso no está otorgado, el backend limita al usuario a
 * su propio grupo de predicación.
 */
export type AccionPermiso = 'ver' | 'editar' | 'alcance';

export interface Permiso {
   id_permiso: number;
   codigo: string;
   nombre: string;
   descripcion?: string;
   categoria: string;
   icono?: string;
   orden?: number;
   activo: boolean;
   modulo?: string | null;
   pantalla?: string | null;
   accion?: AccionPermiso | null;
}

export interface PermisoConEstado {
   id_permiso: number;
   codigo: string;
   nombre: string;
   descripcion?: string;
   icono?: string;
   asignado: boolean;
   modulo?: string | null;
   pantalla?: string | null;
   accion?: AccionPermiso | null;
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

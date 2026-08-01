import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, shareReplay, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Datos mínimos de un publicador para elegirlo en un formulario. */
export interface PublicadorLite {
  id_publicador: number;
  nombre_completo: string;
  telefono?: string | null;
  direccion?: string | null;
  nombre_grupo?: string | null;
}

/**
 * Listado de publicadores de una congregación para selectores/typeaheads.
 *
 * Cachea por congregación: un formulario puede tener varias filas con un
 * picker cada una y no tiene sentido que cada una repita la misma consulta.
 */
@Injectable({ providedIn: 'root' })
export class PublicadorLookupService {
  private http = inject(HttpClient);
  private cache = new Map<number, Observable<PublicadorLite[]>>();

  /**
   * Publicadores de la congregación indicada, ordenados por nombre.
   * Ante un error (p. ej. el usuario no tiene permiso de ver publicadores)
   * devuelve lista vacía: quien lo use debe poder seguir escribiendo a mano.
   */
  listar(idCongregacion: number): Observable<PublicadorLite[]> {
    const cached = this.cache.get(idCongregacion);
    if (cached) return cached;

    const req = this.http
      .get<any[]>(`${environment.apiUrl}/publicadores/`, {
        params: { id_congregacion: idCongregacion, limit: 1000, offset: 0 },
      })
      .pipe(
        map((dtos) => (dtos || []).map((d) => this.toLite(d))),
        map((list) => list.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))),
        catchError(() => of([] as PublicadorLite[])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cache.set(idCongregacion, req);
    return req;
  }

  /** Fuerza a releer la próxima vez (tras crear/editar publicadores). */
  invalidar(idCongregacion?: number) {
    if (idCongregacion === undefined) this.cache.clear();
    else this.cache.delete(idCongregacion);
  }

  private toLite(d: any): PublicadorLite {
    const nombre = [d.primer_nombre, d.segundo_nombre, d.primer_apellido, d.segundo_apellido]
      .filter((p) => (p ?? '').toString().trim())
      .join(' ');
    return {
      id_publicador: d.id_publicador,
      nombre_completo: nombre,
      telefono: d.telefono ?? null,
      direccion: d.direccion ?? null,
      nombre_grupo: d.nombre_grupo ?? null,
    };
  }
}

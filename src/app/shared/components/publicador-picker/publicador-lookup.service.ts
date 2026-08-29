import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, shareReplay, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { nombreLegal, nombreMostrado } from '../../../core/utils/nombre.util';

/** Datos mínimos de un publicador para elegirlo en un formulario. */
export interface PublicadorLite {
  id_publicador: number;
  /** El nombre con el que se muestra a la persona: alias o regla de la congregación. */
  nombre_completo: string;
  /**
   * Los cuatro campos de la ficha. Se lleva aparte para que el filtro del
   * picker encuentre a la persona tanto por su alias como por su nombre real:
   * quien escribe "Juan Pérez" no tiene por qué saber que aquí sale "Juanca".
   */
  nombre_legal: string;
  telefono?: string | null;
  direccion?: string | null;
  barrio?: string | null;
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
    return {
      id_publicador: d.id_publicador,
      nombre_completo: nombreMostrado(d),
      nombre_legal: nombreLegal(d),
      telefono: d.telefono ?? null,
      direccion: d.direccion ?? null,
      barrio: d.barrio ?? null,
      nombre_grupo: d.nombre_grupo ?? null,
    };
  }
}

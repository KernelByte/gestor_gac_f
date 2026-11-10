import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Puesto que quedó libre porque la persona asignada se trasladó a otra
 * congregación. Programación, Logística, Discursos, Exhibidores, Horarios y
 * Reuniones teocráticas lo
 * muestran en el hueco hasta que alguien lo ocupa (el backend lo da por
 * resuelto solo).
 */
export type ModuloVacante =
  | 'entre_semana' | 'fin_semana' | 'logistica' | 'discursos'
  | 'exhibidores' | 'exhibidor_punto' | 'horario_predicacion' | 'salida_predicacion'
  | 'reunion_teocratica';

export interface VacanteTraslado {
  id_vacante: number;
  modulo: ModuloVacante;
  referencia: Record<string, any>;
  fecha: string | null;
  descripcion: string | null;
  nombre_publicador: string;
  congregacion_destino: string | null;
}

@Injectable({ providedIn: 'root' })
export class VacantesTrasladoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/transferencias/vacantes`;

  /** Nunca falla: si no se pueden leer, el módulo simplemente no muestra avisos. */
  listar(modulos: ModuloVacante[], idCongregacion?: number | null): Observable<VacanteTraslado[]> {
    let params = new HttpParams().set('modulos', modulos.join(','));
    if (idCongregacion) params = params.set('id_congregacion', String(idCongregacion));
    return this.http.get<VacanteTraslado[]>(this.url, { params }).pipe(catchError(() => of([])));
  }
}

/** Mapa referencia -> vacante, con la clave que use el módulo (p. ej. id_logistica). */
export function vacantesPor(lista: VacanteTraslado[], clave: string): Map<number, VacanteTraslado> {
  const mapa = new Map<number, VacanteTraslado>();
  for (const v of lista) {
    const id = Number(v.referencia?.[clave]);
    if (!Number.isNaN(id)) mapa.set(id, v);
  }
  return mapa;
}

/** "Juan Pérez se trasladó a Cong. Norte. Asigna un reemplazo." */
export function textoVacante(v: VacanteTraslado): string {
  const destino = v.congregacion_destino ? ` a ${v.congregacion_destino}` : '';
  return `${v.nombre_publicador} se trasladó${destino}. Asigna un reemplazo.`;
}

/** Versión corta para la casilla: "Libre · Juan Pérez se trasladó". */
export function textoVacanteCorto(v: VacanteTraslado): string {
  return `Libre · ${v.nombre_publicador} se trasladó`;
}

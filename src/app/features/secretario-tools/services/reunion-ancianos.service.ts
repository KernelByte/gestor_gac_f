import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AncianoOpcion, ConvocarResultado, PersonaOpcion, TipoReunion, TipoReunionInfo, ParteOut, PropuestaIn, ReunionIn, ReunionOut, ReunionResumen,
  ReunionUpdate, SugerenciaReunion,
} from '../models/reunion-ancianos.model';

@Injectable({ providedIn: 'root' })
export class ReunionAncianosService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/reuniones-ancianos`;

  /** El Administrador no tiene congregación propia: la manda en estas llamadas. */
  private paramsCong(idCongregacion?: number | null): Record<string, number> {
    return idCongregacion ? { id_congregacion: idCongregacion } : {};
  }

  list(idCongregacion?: number | null): Observable<ReunionResumen[]> {
    return this.http.get<ReunionResumen[]>(`${this.url}/`, { params: this.paramsCong(idCongregacion) });
  }

  get(id: number): Observable<ReunionOut> {
    return this.http.get<ReunionOut>(`${this.url}/${id}`);
  }

  ancianos(idCongregacion?: number | null): Observable<AncianoOpcion[]> {
    return this.http.get<AncianoOpcion[]>(`${this.url}/ancianos`, { params: this.paramsCong(idCongregacion) });
  }

  /** Publicadores activos, con su grupo; `por_defecto` marca a los que convoca `tipo`. */
  personas(tipo?: TipoReunion | null, idCongregacion?: number | null): Observable<PersonaOpcion[]> {
    return this.http.get<PersonaOpcion[]>(`${this.url}/personas`, {
      params: { ...this.paramsCong(idCongregacion), ...(tipo ? { tipo } : {}) },
    });
  }

  tipos(): Observable<TipoReunionInfo[]> {
    return this.http.get<TipoReunionInfo[]>(`${this.url}/tipos`);
  }

  sugerencia(idCongregacion?: number | null, tipo?: TipoReunion | null): Observable<SugerenciaReunion> {
    return this.http.get<SugerenciaReunion>(`${this.url}/sugerencia`, {
      params: { ...this.paramsCong(idCongregacion), ...(tipo ? { tipo } : {}) },
    });
  }

  create(data: ReunionIn): Observable<ReunionOut> {
    return this.http.post<ReunionOut>(`${this.url}/`, data);
  }

  update(id: number, data: ReunionUpdate): Observable<ReunionOut> {
    return this.http.put<ReunionOut>(`${this.url}/${id}`, data);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** avisar=false: queda convocada (fija) sin avisar a nadie. */
  convocar(id: number, avisar = true): Observable<ConvocarResultado> {
    return this.http.post<ConvocarResultado>(`${this.url}/${id}/convocar`, { avisar });
  }

  proponer(id: number, data: PropuestaIn): Observable<ParteOut> {
    return this.http.post<ParteOut>(`${this.url}/${id}/propuestas`, data);
  }

  aceptarParte(id: number, idParte: number): Observable<ParteOut> {
    return this.http.post<ParteOut>(`${this.url}/${id}/partes/${idParte}/aceptar`, {});
  }

  /** Descarta una propuesta (o borra una parte, si es gestor). */
  eliminarParte(id: number, idParte: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/partes/${idParte}`);
  }

  pasarAActa(id: number): Observable<{ id_acta: number; creada: boolean }> {
    return this.http.post<{ id_acta: number; creada: boolean }>(`${this.url}/${id}/acta`, {});
  }

  /** La carta del acta (PDF): lo que leen los ancianos, sin entrar al módulo de Actas. */
  cartaActa(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/acta/carta`, { responseType: 'blob' });
  }

  exportarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/export`, { params: { formato: 'pdf' }, responseType: 'blob' });
  }
}

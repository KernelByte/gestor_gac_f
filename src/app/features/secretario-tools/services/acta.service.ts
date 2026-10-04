import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Acta, ActaCreate, ActaUpdate, RedactarIARequest, RedactarIAResponse, RolTarea, Subtarea, Tarea, TareaCreate, UsuarioAsignable } from '../models/acta.model';

@Injectable({ providedIn: 'root' })
export class ActaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/actas-reunion`;
  private urlTareas = `${environment.apiUrl}/tareas`;

  list(filtros: { tipo_reunion?: string; estado?: string; id_congregacion?: number } = {}): Observable<Acta[]> {
    return this.http.get<Acta[]>(`${this.url}/`, { params: filtros as any });
  }

  get(id: number): Observable<Acta> {
    return this.http.get<Acta>(`${this.url}/${id}`);
  }

  create(data: ActaCreate): Observable<Acta> {
    return this.http.post<Acta>(`${this.url}/`, data);
  }

  update(id: number, data: ActaUpdate): Observable<Acta> {
    return this.http.put<Acta>(`${this.url}/${id}`, data);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  redactarIA(req: RedactarIARequest): Observable<RedactarIAResponse> {
    return this.http.post<RedactarIAResponse>(`${this.url}/redactar-ia`, req);
  }

  exportar(id: number, formato: 'pdf' | 'docx'): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/export`, { params: { formato }, responseType: 'blob' });
  }

  // Tareas
  listarTareas(idActa: number): Observable<Tarea[]> {
    return this.http.get<Tarea[]>(`${this.url}/${idActa}/tareas`);
  }

  crearTarea(idActa: number, data: Partial<Tarea>): Observable<Tarea> {
    return this.http.post<Tarea>(`${this.url}/${idActa}/tareas`, data);
  }

  getTarea(idTarea: number): Observable<Tarea> {
    return this.http.get<Tarea>(`${this.urlTareas}/${idTarea}`);
  }

  updateTarea(idTarea: number, data: Partial<Tarea>): Observable<Tarea> {
    return this.http.put<Tarea>(`${this.urlTareas}/${idTarea}`, data);
  }

  actualizarEstadoTarea(idTarea: number, estado: Tarea['estado']): Observable<Tarea> {
    return this.http.patch<Tarea>(`${this.urlTareas}/${idTarea}/estado`, { estado });
  }

  eliminarTarea(idTarea: number): Observable<void> {
    return this.http.delete<void>(`${this.urlTareas}/${idTarea}`);
  }

  /** Tareas que el usuario creó o tiene asignadas (el backend no devuelve otras). */
  listarTareasGlobal(params: { rol_tarea?: RolTarea; estado?: string } = {}): Observable<Tarea[]> {
    const filtros: Record<string, string> = {};
    if (params.rol_tarea) filtros['rol_tarea'] = params.rol_tarea;
    if (params.estado) filtros['estado'] = params.estado;
    return this.http.get<Tarea[]>(`${this.urlTareas}/`, { params: filtros });
  }

  crearTareaGlobal(data: TareaCreate): Observable<Tarea> {
    return this.http.post<Tarea>(`${this.urlTareas}/`, data);
  }

  /** Usuarios activos de mi congregación a quienes puedo asignar (cualquier rol). */
  listarAsignables(): Observable<UsuarioAsignable[]> {
    return this.http.get<UsuarioAsignable[]>(`${this.urlTareas}/asignables`);
  }

  crearSubtarea(idTarea: number, titulo: string): Observable<Subtarea> {
    return this.http.post<Subtarea>(`${this.urlTareas}/${idTarea}/subtareas`, { titulo });
  }

  actualizarSubtarea(idTarea: number, idSubtarea: number, data: Partial<Pick<Subtarea, 'titulo' | 'completada' | 'orden'>>): Observable<Subtarea> {
    return this.http.patch<Subtarea>(`${this.urlTareas}/${idTarea}/subtareas/${idSubtarea}`, data);
  }

  eliminarSubtarea(idTarea: number, idSubtarea: number): Observable<void> {
    return this.http.delete<void>(`${this.urlTareas}/${idTarea}/subtareas/${idSubtarea}`);
  }
}

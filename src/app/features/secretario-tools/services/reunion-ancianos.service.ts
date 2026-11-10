import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  AccionCrono, AncianoOpcion, CategoriaIn, CategoriaOut, CategoriaUpdate, ConvocarResultado, FinalizarResultado, NotaPersonal,
  PuntoIn, PuntoOut, PuntoUpdate, VivoOut, HermanoIn, ParticipacionConfig, ParticipacionItem, ParticipacionOut, MiParticipacion, RecomendacionOut, PersonaOpcion, TipoReunion, TipoReunionInfo, ParteOut, PropuestaIn, ReunionIn, ReunionOut, ReunionResumen,
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

  /** Cancela; avisa solo si a los convocados ya se les había avisado. */
  cancelar(id: number, avisar = true): Observable<ConvocarResultado> {
    return this.http.post<ConvocarResultado>(`${this.url}/${id}/cancelar`, { avisar });
  }

  reabrir(id: number): Observable<ReunionOut> {
    return this.http.post<ReunionOut>(`${this.url}/${id}/reabrir`, {});
  }

  /** Nueva reunión en borrador con el mismo programa (sin responsables ni notas). */
  duplicar(id: number, fecha?: string | null): Observable<ReunionOut> {
    return this.http.post<ReunionOut>(`${this.url}/${id}/duplicar`, fecha ? { fecha } : {});
  }

  misNotas(id: number): Observable<NotaPersonal[]> {
    return this.http.get<NotaPersonal[]>(`${this.url}/${id}/mis-notas`);
  }

  /** Vacía, la borra (devuelve null). */
  guardarNota(id: number, idParte: number | null, texto: string): Observable<NotaPersonal | null> {
    return this.http.put<NotaPersonal | null>(`${this.url}/${id}/mis-notas`, { id_parte: idParte, texto });
  }

  /** Sube una imagen para «Mis notas»; el texto la cita con ![pie](imagen:ID). */
  subirImagenNota(id: number, archivo: File): Observable<{ id_imagen: number; ancho: number; alto: number }> {
    const fd = new FormData();
    fd.append('archivo', archivo, archivo.name || 'imagen');
    return this.http.post<{ id_imagen: number; ancho: number; alto: number }>(`${this.url}/${id}/mis-notas/imagenes`, fd);
  }

  imagenNota(id: number, idImagen: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/mis-notas/imagenes/${idImagen}`, { responseType: 'blob' });
  }

  categorias(idCongregacion?: number | null): Observable<CategoriaOut[]> {
    return this.http.get<CategoriaOut[]>(`${this.url}/categorias`, { params: this.paramsCong(idCongregacion) });
  }

  crearCategoria(data: CategoriaIn, idCongregacion?: number | null): Observable<CategoriaOut> {
    return this.http.post<CategoriaOut>(`${this.url}/categorias`, data, { params: this.paramsCong(idCongregacion) });
  }

  actualizarCategoria(idCategoria: number, data: CategoriaUpdate, idCongregacion?: number | null): Observable<CategoriaOut> {
    return this.http.put<CategoriaOut>(`${this.url}/categorias/${idCategoria}`, data, { params: this.paramsCong(idCongregacion) });
  }

  ordenarCategorias(ids: number[], idCongregacion?: number | null): Observable<CategoriaOut[]> {
    return this.http.put<CategoriaOut[]>(`${this.url}/categorias/orden`, { ids }, { params: this.paramsCong(idCongregacion) });
  }

  eliminarCategoria(idCategoria: number, idCongregacion?: number | null): Observable<void> {
    return this.http.delete<void>(`${this.url}/categorias/${idCategoria}`, { params: this.paramsCong(idCongregacion) });
  }

  // ── En vivo ──────────────────────────────────────────────────────────────

  vivo(id: number): Observable<VivoOut> {
    return this.http.get<VivoOut>(`${this.url}/${id}/vivo`);
  }

  iniciar(id: number): Observable<VivoOut> {
    return this.http.post<VivoOut>(`${this.url}/${id}/iniciar`, {});
  }

  crono(id: number, accion: AccionCrono, idParte?: number | null): Observable<VivoOut> {
    return this.http.post<VivoOut>(`${this.url}/${id}/crono`, { accion, id_parte: idParte ?? null });
  }

  receso(id: number, activo: boolean): Observable<VivoOut> {
    return this.http.post<VivoOut>(`${this.url}/${id}/receso`, { activo });
  }

  finalizar(id: number): Observable<FinalizarResultado> {
    return this.http.post<FinalizarResultado>(`${this.url}/${id}/finalizar`, {});
  }

  crearPunto(id: number, data: PuntoIn): Observable<PuntoOut> {
    return this.http.post<PuntoOut>(`${this.url}/${id}/puntos`, data);
  }

  actualizarPunto(id: number, idPunto: number, data: PuntoUpdate): Observable<PuntoOut> {
    return this.http.patch<PuntoOut>(`${this.url}/${id}/puntos/${idPunto}`, data);
  }

  /** La nota de un tema, una para todos: el servidor junta lo que otros guardaron desde `base`. */
  notaCompartida(id: number, idParte: number | null, base: string, texto: string): Observable<PuntoOut> {
    return this.http.put<PuntoOut>(`${this.url}/${id}/nota-compartida`, { id_parte: idParte, base, texto });
  }

  soltarPunto(id: number, idPunto: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/puntos/${idPunto}/soltar`, {});
  }

  borrarPunto(id: number, idPunto: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/puntos/${idPunto}`);
  }

  /** Ticket de un solo uso para el stream (el mismo de las notificaciones). */
  ticketStream(): Observable<{ ticket: string }> {
    return this.http.post<{ ticket: string }>(`${environment.apiUrl}/notificaciones/stream-ticket`, {});
  }

  urlStream(id: number, ticket: string): string {
    return `${this.url}/${id}/vivo/stream?ticket=${encodeURIComponent(ticket)}`;
  }

  // ── Participación ────────────────────────────────────────────────────────

  private filtrosPart(f: { desde?: string | null; hasta?: string | null; conRetirados?: boolean }, idCong?: number | null) {
    return {
      ...this.paramsCong(idCong),
      ...(f.desde ? { desde: f.desde } : {}),
      ...(f.hasta ? { hasta: f.hasta } : {}),
      ...(f.conRetirados ? { con_retirados: 'true' } : {}),
    };
  }

  /** ¿La congregación usa la reunión en vivo? Apagado hasta que el gestor lo encienda; lo comparten lista, editor y «Preparar». */
  readonly usarEnVivo = signal(false);

  cargarConfig(idCong?: number | null): Observable<{ usar_en_vivo: boolean }> {
    return this.http.get<{ usar_en_vivo: boolean }>(`${this.url}/config`, { params: this.paramsCong(idCong) })
      .pipe(tap(c => this.usarEnVivo.set(c.usar_en_vivo)));
  }

  guardarConfig(usarEnVivo: boolean, idCong?: number | null): Observable<{ usar_en_vivo: boolean }> {
    return this.http.put<{ usar_en_vivo: boolean }>(`${this.url}/config`, { usar_en_vivo: usarEnVivo }, { params: this.paramsCong(idCong) })
      .pipe(tap(c => this.usarEnVivo.set(c.usar_en_vivo)));
  }

  miParticipacion(): Observable<MiParticipacion> {
    return this.http.get<MiParticipacion>(`${this.url}/participacion/mia`);
  }

  participacion(f: { desde?: string | null; hasta?: string | null; conRetirados?: boolean } = {}, idCong?: number | null): Observable<ParticipacionOut> {
    return this.http.get<ParticipacionOut>(`${this.url}/participacion`, { params: this.filtrosPart(f, idCong) });
  }

  guardarConfigParticipacion(fechaCorte: string, tipos: string[], idCong?: number | null): Observable<ParticipacionConfig> {
    return this.http.put<ParticipacionConfig>(`${this.url}/participacion/config`, { fecha_corte: fechaCorte, tipos_que_cuentan: tipos },
      { params: this.paramsCong(idCong) });
  }

  exportarParticipacion(f: { desde?: string | null; hasta?: string | null; conRetirados?: boolean }, idCong?: number | null): Observable<Blob> {
    return this.http.get(`${this.url}/participacion/export`, { params: this.filtrosPart(f, idCong), responseType: 'blob' });
  }

  historialHermano(idPublicador: number, idCong?: number | null): Observable<ParticipacionItem[]> {
    return this.http.get<ParticipacionItem[]>(`${this.url}/participacion/hermanos/${idPublicador}`, { params: this.paramsCong(idCong) });
  }

  guardarHermano(idPublicador: number, data: HermanoIn, idCong?: number | null): Observable<void> {
    return this.http.put<void>(`${this.url}/participacion/hermanos/${idPublicador}`, data, { params: this.paramsCong(idCong) });
  }

  recomendar(idCategoria: number, fecha: string | null, ocupados: number[], idCong?: number | null): Observable<RecomendacionOut> {
    return this.http.get<RecomendacionOut>(`${this.url}/recomendar`, {
      params: { ...this.paramsCong(idCong), id_categoria: idCategoria, ...(fecha ? { fecha } : {}), ocupados: ocupados.join(',') },
    });
  }

  exportarPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/export`, { params: { formato: 'pdf' }, responseType: 'blob' });
  }
}

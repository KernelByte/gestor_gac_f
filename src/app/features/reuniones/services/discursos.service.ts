import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams, HttpRequest } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ArchivoCongregacionContacto,
  CatalogoResponse,
  CatalogoCanticosResponse,
  ResumenImportacion,
  ResumenImportacionCanticos,
  CongregacionContacto,
  ConfirmarDiscursosRequest,
  ContactoPersona,
  CrearCongregacionContactoRequest,
  CrearDiscursanteRequest,
  CrearPersonaRequest,
  CrearSalienteRequest,
  CrearTemaRequest,
  Discursante,
  DiscursosMesOut,
  DiscursoSalienteOut,
  DiscursoEntranteOut,
  EditarCongregacionContactoRequest,
  EditarDiscursanteRequest,
  EditarEntranteRequest,
  EditarPersonaRequest,
  EditarOradorLocalRequest,
  EditarSalienteRequest,
  EditarTemaRequest,
  GenerarDiscursosRequest,
  GeoResultado,
  GrupoSimple,
  HistorialEntrantesOut,
  HistorialSalientesOut,
  UbicacionSaliente,
  MesDiscursosDisponible,
  OradorLocal,
  PublicadorSimple,
  TemaPublicador,
  VerificarRepeticionOut,
} from '../models/discursos.models';

@Injectable({ providedIn: 'root' })
export class DiscursosService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reuniones/discursos`;

  private congParams(idCong: number | null): HttpParams {
    let p = new HttpParams();
    if (idCong !== null) p = p.set('id_congregacion', idCong);
    return p;
  }

  getMeses(idCong: number | null): Observable<MesDiscursosDisponible[]> {
    return this.http.get<MesDiscursosDisponible[]>(`${this.base}/meses`, { params: this.congParams(idCong) });
  }

  generar(payload: GenerarDiscursosRequest, idCong: number | null): Observable<DiscursosMesOut> {
    return this.http.post<DiscursosMesOut>(`${this.base}/generar`, payload, { params: this.congParams(idCong) });
  }

  getMes(ano: number, mes: number, idCong: number | null): Observable<DiscursosMesOut> {
    const params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get<DiscursosMesOut>(`${this.base}/mes`, { params });
  }

  crearSaliente(payload: CrearSalienteRequest, idCong: number | null): Observable<DiscursoSalienteOut> {
    return this.http.post<DiscursoSalienteOut>(`${this.base}/salientes`, payload, { params: this.congParams(idCong) });
  }

  editarSaliente(id: number, payload: EditarSalienteRequest, idCong: number | null): Observable<DiscursoSalienteOut> {
    return this.http.put<DiscursoSalienteOut>(`${this.base}/salientes/${id}`, payload, { params: this.congParams(idCong) });
  }

  eliminarSaliente(id: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/salientes/${id}`, { params: this.congParams(idCong) });
  }

  /**
   * Marca a mano que la salida ya se dio. Normalmente lo hace solo el backend
   * al pasar la fecha/hora de la reunión destino; esto sirve para adelantarlo
   * o deshacerlo.
   */
  marcarPresentadoSaliente(id: number, presentado: boolean, idCong: number | null): Observable<DiscursoSalienteOut> {
    return this.http.put<DiscursoSalienteOut>(
      `${this.base}/salientes/${id}/presentado`,
      { presentado },
      { params: this.congParams(idCong) },
    );
  }

  /** Cancela una salida antes de la fecha (o deshace la cancelación). */
  marcarCanceladoSaliente(id: number, cancelado: boolean, idCong: number | null): Observable<DiscursoSalienteOut> {
    return this.http.put<DiscursoSalienteOut>(
      `${this.base}/salientes/${id}/cancelar`,
      { cancelado },
      { params: this.congParams(idCong) },
    );
  }

  /** Busca direcciones (proxy backend, la CSP impide llamar al geocodificador directamente). */
  geocodificar(q: string): Observable<GeoResultado[]> {
    return this.http.get<GeoResultado[]>(`${this.base}/geocodificar`, { params: new HttpParams().set('q', q) });
  }

  /**
   * Última ubicación (y hora) registrada para una congregación destino con
   * ese nombre. Fallback basado en historial para congregaciones que aún no
   * están en el directorio de contacto (ver `getCongregacionesContacto`).
   */
  ubicacionSugerida(congregacion: string, idCong: number | null): Observable<Partial<UbicacionSaliente> & { hora?: string | null }> {
    const params = this.congParams(idCong).set('congregacion', congregacion);
    return this.http.get<Partial<UbicacionSaliente> & { hora?: string | null }>(`${this.base}/salientes/ubicacion-sugerida`, { params });
  }

  editarEntrante(id: number, payload: EditarEntranteRequest, idCong: number | null): Observable<DiscursoEntranteOut> {
    return this.http.put<DiscursoEntranteOut>(`${this.base}/entrantes/${id}`, payload, { params: this.congParams(idCong) });
  }

  /**
   * Confirmación telefónica del orador entrante. Endpoint aparte del de edición:
   * el backend sella quién y cuándo, y funciona con el mes ya cerrado.
   */
  confirmarOrador(id: number, confirmado: boolean, idCong: number | null): Observable<DiscursoEntranteOut> {
    return this.http.put<DiscursoEntranteOut>(
      `${this.base}/entrantes/${id}/confirmacion-orador`,
      { confirmado },
      { params: this.congParams(idCong) },
    );
  }

  /**
   * Marca a mano que el discurso ya se dio. Normalmente lo hace solo el backend
   * al pasar la hora de la reunión; esto sirve para adelantarlo o deshacerlo.
   */
  marcarPresentado(id: number, presentado: boolean, idCong: number | null): Observable<DiscursoEntranteOut> {
    return this.http.put<DiscursoEntranteOut>(
      `${this.base}/entrantes/${id}/presentado`,
      { presentado },
      { params: this.congParams(idCong) },
    );
  }

  confirmar(payload: ConfirmarDiscursosRequest, idCong: number | null): Observable<DiscursosMesOut> {
    return this.http.post<DiscursosMesOut>(`${this.base}/confirmar`, payload, { params: this.congParams(idCong) });
  }

  eliminarMes(ano: number, mes: number, idCong: number | null): Observable<{ ok: boolean }> {
    const params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.delete<{ ok: boolean }>(`${this.base}/mes`, { params });
  }

  getGrupos(idCong: number | null): Observable<GrupoSimple[]> {
    return this.http.get<GrupoSimple[]>(`${this.base}/grupos`, { params: this.congParams(idCong) });
  }

  getPublicadores(idCong: number | null, soloConferenciantes = true): Observable<PublicadorSimple[]> {
    const params = this.congParams(idCong).set('solo_conferenciantes', soloConferenciantes);
    return this.http.get<PublicadorSimple[]>(`${this.base}/publicadores`, { params });
  }

  buscarPublicadores(idCong: number | null, q: string): Observable<PublicadorSimple[]> {
    const params = this.congParams(idCong).set('q', q);
    return this.http.get<PublicadorSimple[]>(`${this.base}/publicadores/buscar`, { params });
  }

  descargarPdfEntrantes(ano: number, mes: number, idCong: number | null): Observable<Blob> {
    const params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get(`${this.base}/pdf/entrantes`, { params, responseType: 'blob' });
  }

  descargarPdfSalientes(ano: number, mes: number, idCong: number | null): Observable<Blob> {
    const params = this.congParams(idCong).set('ano', ano).set('mes', mes);
    return this.http.get(`${this.base}/pdf/salientes`, { params, responseType: 'blob' });
  }

  getTemas(idCong: number | null): Observable<TemaPublicador[]> {
    return this.http.get<TemaPublicador[]>(`${this.base}/temas`, { params: this.congParams(idCong) });
  }

  getTemasPublicador(idPublicador: number, idCong: number | null): Observable<TemaPublicador[]> {
    return this.http.get<TemaPublicador[]>(`${this.base}/temas/publicador/${idPublicador}`, { params: this.congParams(idCong) });
  }

  crearTema(payload: CrearTemaRequest, idCong: number | null): Observable<TemaPublicador> {
    return this.http.post<TemaPublicador>(`${this.base}/temas`, payload, { params: this.congParams(idCong) });
  }

  editarTema(id: number, payload: EditarTemaRequest, idCong: number | null): Observable<TemaPublicador> {
    return this.http.put<TemaPublicador>(`${this.base}/temas/${id}`, payload, { params: this.congParams(idCong) });
  }

  eliminarTema(id: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/temas/${id}`, { params: this.congParams(idCong) });
  }

  getOradoresLocales(idCong: number | null): Observable<OradorLocal[]> {
    return this.http.get<OradorLocal[]>(`${this.base}/oradores`, { params: this.congParams(idCong) });
  }

  editarOradorLocal(idPublicador: number, payload: EditarOradorLocalRequest, idCong: number | null): Observable<OradorLocal> {
    return this.http.put<OradorLocal>(`${this.base}/oradores/${idPublicador}`, payload, { params: this.congParams(idCong) });
  }

  // ── Directorio de congregaciones de contacto ──────────────────────────────

  getCongregacionesContacto(idCong: number | null): Observable<CongregacionContacto[]> {
    return this.http.get<CongregacionContacto[]>(`${this.base}/congregaciones-contacto`, { params: this.congParams(idCong) });
  }

  /**
   * El mismo directorio, pero compartido por todos los autocompletados.
   *
   * Es un signal y no un observable cacheado a propósito. Cada fecha del mes
   * monta su propio campo de congregación: con una petición por campo, cada
   * uno se quedaba con su copia privada de la lista, y dar de alta una
   * congregación desde una fecha no la hacía aparecer en las demás hasta
   * recargar la pantalla. Un observable con shareReplay ahorraría las
   * peticiones pero no arreglaría eso —quien ya se suscribió no vuelve a
   * recibir nada—; un signal sí avisa a todos.
   */
  private directorioClave: string | null = null;
  private _directorio = signal<CongregacionContacto[]>([]);

  /**
   * Directorio de una congregación, descargándolo la primera vez que se pide.
   *
   * La clave lleva el id porque un administrador puede cambiar de congregación
   * sin recargar, y cada una tiene su propio directorio: reutilizar el anterior
   * ofrecería congregaciones ajenas en el autocompletado.
   */
  directorioContacto(idCong: number | null) {
    const clave = String(idCong ?? 'propia');
    if (this.directorioClave !== clave) {
      this.directorioClave = clave;
      this._directorio.set([]);
      this.getCongregacionesContacto(idCong).subscribe({
        next: (r) => this._directorio.set(r ?? []),
        error: () => this._directorio.set([]),
      });
    }
    return this._directorio.asReadonly();
  }

  /** Añade al directorio compartido una congregación recién creada. */
  anadirADirectorio(c: CongregacionContacto): void {
    this._directorio.update(d => [...d, c]);
  }

  /**
   * Fuerza una recarga del directorio la próxima vez que se pida.
   *
   * La llama el CRUD de la pestaña Congregaciones: sin esto, renombrar o
   * borrar una congregación dejaría el autocompletado ofreciendo la versión
   * vieja durante el resto de la sesión.
   */
  invalidarDirectorioContacto(): void {
    this.directorioClave = null;
  }

  crearCongregacionContacto(payload: CrearCongregacionContactoRequest, idCong: number | null): Observable<CongregacionContacto> {
    return this.http.post<CongregacionContacto>(`${this.base}/congregaciones-contacto`, payload, { params: this.congParams(idCong) });
  }

  editarCongregacionContacto(id: number, payload: EditarCongregacionContactoRequest, idCong: number | null): Observable<CongregacionContacto> {
    return this.http.put<CongregacionContacto>(`${this.base}/congregaciones-contacto/${id}`, payload, { params: this.congParams(idCong) });
  }

  eliminarCongregacionContacto(id: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/congregaciones-contacto/${id}`, { params: this.congParams(idCong) });
  }

  crearContactoPersona(idCongContacto: number, payload: CrearPersonaRequest, idCong: number | null): Observable<ContactoPersona> {
    return this.http.post<ContactoPersona>(`${this.base}/congregaciones-contacto/${idCongContacto}/contactos`, payload, { params: this.congParams(idCong) });
  }

  editarContactoPersona(idCongContacto: number, idPersona: number, payload: EditarPersonaRequest, idCong: number | null): Observable<ContactoPersona> {
    return this.http.put<ContactoPersona>(`${this.base}/congregaciones-contacto/${idCongContacto}/contactos/${idPersona}`, payload, { params: this.congParams(idCong) });
  }

  eliminarContactoPersona(idCongContacto: number, idPersona: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/congregaciones-contacto/${idCongContacto}/contactos/${idPersona}`, { params: this.congParams(idCong) });
  }

  crearDiscursante(idCongContacto: number, payload: CrearDiscursanteRequest, idCong: number | null): Observable<Discursante> {
    return this.http.post<Discursante>(`${this.base}/congregaciones-contacto/${idCongContacto}/discursantes`, payload, { params: this.congParams(idCong) });
  }

  editarDiscursante(idCongContacto: number, idDiscursante: number, payload: EditarDiscursanteRequest, idCong: number | null): Observable<Discursante> {
    return this.http.put<Discursante>(`${this.base}/congregaciones-contacto/${idCongContacto}/discursantes/${idDiscursante}`, payload, { params: this.congParams(idCong) });
  }

  eliminarDiscursante(idCongContacto: number, idDiscursante: number, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/congregaciones-contacto/${idCongContacto}/discursantes/${idDiscursante}`, { params: this.congParams(idCong) });
  }

  listarArchivosCongregacionContacto(idCongContacto: number, idCong: number | null): Observable<ArchivoCongregacionContacto[]> {
    return this.http.get<ArchivoCongregacionContacto[]>(`${this.base}/congregaciones-contacto/${idCongContacto}/archivos`, { params: this.congParams(idCong) });
  }

  subirArchivoCongregacionContacto(idCongContacto: number, archivo: File, idCong: number | null): Observable<ArchivoCongregacionContacto> {
    const fd = new FormData();
    fd.append('archivo', archivo);
    return this.http.post<ArchivoCongregacionContacto>(`${this.base}/congregaciones-contacto/${idCongContacto}/archivos`, fd, { params: this.congParams(idCong) });
  }

  eliminarArchivoCongregacionContacto(idCongContacto: number, nombre: string, idCong: number | null): Observable<void> {
    return this.http.delete<void>(`${this.base}/congregaciones-contacto/${idCongContacto}/archivos/${encodeURIComponent(nombre)}`, { params: this.congParams(idCong) });
  }

  /** El endpoint exige el token de sesión, así que no sirve un <a href> directo: se trae como blob y se abre con una URL de objeto. */
  descargarArchivoCongregacionContacto(idCongContacto: number, nombre: string, idCong: number | null): Observable<Blob> {
    return this.http.get(`${this.base}/congregaciones-contacto/${idCongContacto}/archivos/${encodeURIComponent(nombre)}`, { params: this.congParams(idCong), responseType: 'blob' });
  }

  // ── Historial de discursos ────────────────────────────────────────────────

  getHistorialEntrantes(idCong: number | null, desde: string | null, hasta: string | null): Observable<HistorialEntrantesOut> {
    let params = this.congParams(idCong);
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<HistorialEntrantesOut>(`${this.base}/historial/entrantes`, { params });
  }

  getHistorialSalientes(idCong: number | null, desde: string | null, hasta: string | null): Observable<HistorialSalientesOut> {
    let params = this.congParams(idCong);
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<HistorialSalientesOut>(`${this.base}/historial/salientes`, { params });
  }

  /**
   * Aviso proactivo al escribir el título de un entrante: ¿esto ya se dio en
   * esta congregación hace poco? No bloquea nada, solo informa.
   */
  verificarRepeticion(
    titulo: string, fecha: string, excluirId: number, idCong: number | null,
  ): Observable<VerificarRepeticionOut> {
    const params = this.congParams(idCong).set('titulo', titulo).set('fecha', fecha).set('excluir_id', excluirId);
    return this.http.get<VerificarRepeticionOut>(`${this.base}/entrantes/repeticiones`, { params });
  }

  // ── Catálogo de discursos públicos (S-34) ──────────────────────────────────
  // Global: no lleva id_congregacion. Son ~200 registros, así que se descarga
  // entero una vez y el filtrado del autocompletado se hace en cliente.

  private catalogo$?: Observable<CatalogoResponse>;

  getCatalogo(): Observable<CatalogoResponse> {
    if (!this.catalogo$) {
      this.catalogo$ = this.http
        .get<CatalogoResponse>(`${this.base}/catalogo`)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.catalogo$;
  }

  /** Invalida la caché tras importar o vaciar, para que la próxima lectura sea fresca. */
  invalidarCatalogo(): void {
    this.catalogo$ = undefined;
  }

  /**
   * Sube el .jwpub. Devuelve los eventos de progreso porque el archivo ronda
   * los 72 MB y sin barra la pantalla parecería colgada.
   */
  importarCatalogo(file: File): Observable<HttpEvent<ResumenImportacion>> {
    const form = new FormData();
    form.append('archivo', file, file.name);
    const req = new HttpRequest<FormData>('POST', `${this.base}/catalogo/importar`, form, {
      reportProgress: true,
    });
    return this.http.request<ResumenImportacion>(req);
  }

  borrarCatalogo(): Observable<{ borrados: number }> {
    return this.http.delete<{ borrados: number }>(`${this.base}/catalogo`);
  }

  // ── Catálogo de cánticos ("Cantemos con gozo a Jehová") ────────────────────
  // Himnario fijo, 151 registros: igual que el catálogo de discursos, se
  // descarga entero una vez y se filtra en cliente.

  private catalogoCanticos$?: Observable<CatalogoCanticosResponse>;

  getCatalogoCanticos(): Observable<CatalogoCanticosResponse> {
    if (!this.catalogoCanticos$) {
      this.catalogoCanticos$ = this.http
        .get<CatalogoCanticosResponse>(`${this.base}/canticos/catalogo`)
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.catalogoCanticos$;
  }

  /** Invalida la caché tras importar o vaciar, para que la próxima lectura sea fresca. */
  invalidarCatalogoCanticos(): void {
    this.catalogoCanticos$ = undefined;
  }

  /** Sube el PDF "sin partitura" del himnario. Pesa unos pocos MB: sin barra de progreso. */
  importarCanticos(file: File): Observable<HttpEvent<ResumenImportacionCanticos>> {
    const form = new FormData();
    form.append('archivo', file, file.name);
    const req = new HttpRequest<FormData>('POST', `${this.base}/canticos/catalogo/importar`, form, {
      reportProgress: true,
    });
    return this.http.request<ResumenImportacionCanticos>(req);
  }

  borrarCanticos(): Observable<{ borrados: number }> {
    return this.http.delete<{ borrados: number }>(`${this.base}/canticos/catalogo`);
  }
}

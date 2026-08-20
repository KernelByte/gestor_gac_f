import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, finalize, tap } from 'rxjs';
import { environment } from '../../../../../environments/environment';

/** Credencial de integración tal como la ve el panel de administración. */
export interface ApiCliente {
  id_api_cliente: number;
  nombre: string;
  descripcion?: string | null;
  client_id: string;
  secret_prefijo: string;
  id_congregacion: number;
  congregacion?: string | null;
  scopes: string[];
  activo: boolean;
  revocado: boolean;
  ip_whitelist?: string[] | null;
  rate_limit_minuto: number;
  expira_en?: string | null;
  ultimo_uso?: string | null;
  creado_en: string;
}

/** El secreto sólo viaja aquí, y sólo una vez: al crear o al rotar. */
export interface ApiClienteConSecreto {
  cliente: ApiCliente;
  client_secret: string;
}

export interface ApiClientePayload {
  nombre: string;
  descripcion?: string | null;
  id_congregacion: number;
  scopes: string[];
  ip_whitelist?: string[] | null;
  rate_limit_minuto: number;
  expira_en?: string | null;
}

export type ApiClienteUpdate = Partial<Omit<ApiClientePayload, 'id_congregacion'>> & {
  activo?: boolean;
};

export interface ApiScope {
  codigo: string;
  nombre: string;
  descripcion: string;
  grupo: string;
  escritura: boolean;
}

export interface ApiLog {
  id_api_log: number;
  id_api_cliente?: number | null;
  cliente?: string | null;
  request_id: string;
  metodo: string;
  ruta: string;
  status_code: number;
  error_code?: string | null;
  duracion_ms: number;
  ip?: string | null;
  creado_en: string;
}

export interface ApiLogsPage {
  items: ApiLog[];
  pagina: number;
  tamano: number;
  total: number;
}

export interface ApiMetricas {
  ventana_horas: number;
  total_peticiones: number;
  total_errores: number;
  tasa_error: number;
  latencia_promedio_ms: number;
  latencia_maxima_ms: number;
}

export interface ApiLogsFiltro {
  id_api_cliente?: number | null;
  desde?: string | null;
  hasta?: string | null;
  solo_errores?: boolean;
  pagina?: number;
  tamano?: number;
}

@Injectable({ providedIn: 'root' })
export class ApiClientsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/config/api-clientes`;

  readonly clientes = signal<ApiCliente[]>([]);
  readonly scopes = signal<ApiScope[]>([]);
  readonly logs = signal<ApiLogsPage | null>(null);
  readonly metricas = signal<ApiMetricas | null>(null);

  readonly cargandoClientes = signal(false);
  readonly cargandoLogs = signal(false);
  readonly guardando = signal(false);

  // ── Credenciales ────────────────────────────────────────────────
  listar(busqueda?: string): Observable<ApiCliente[]> {
    this.cargandoClientes.set(true);
    const params = busqueda ? new HttpParams().set('q', busqueda) : undefined;
    return this.http.get<ApiCliente[]>(this.apiUrl, { params }).pipe(
      tap(lista => this.clientes.set(lista)),
      finalize(() => this.cargandoClientes.set(false)),
    );
  }

  cargarScopes(): Observable<ApiScope[]> {
    return this.http.get<ApiScope[]>(`${this.apiUrl}/scopes`).pipe(
      tap(lista => this.scopes.set(lista)),
    );
  }

  crear(payload: ApiClientePayload): Observable<ApiClienteConSecreto> {
    this.guardando.set(true);
    return this.http.post<ApiClienteConSecreto>(this.apiUrl, payload).pipe(
      tap(r => this.clientes.update(lista => [r.cliente, ...lista])),
      finalize(() => this.guardando.set(false)),
    );
  }

  actualizar(id: number, payload: ApiClienteUpdate): Observable<ApiCliente> {
    this.guardando.set(true);
    return this.http.put<ApiCliente>(`${this.apiUrl}/${id}`, payload).pipe(
      tap(c => this.reemplazar(c)),
      finalize(() => this.guardando.set(false)),
    );
  }

  rotarSecreto(id: number): Observable<ApiClienteConSecreto> {
    this.guardando.set(true);
    return this.http.post<ApiClienteConSecreto>(`${this.apiUrl}/${id}/rotar-secreto`, {}).pipe(
      tap(r => this.reemplazar(r.cliente)),
      finalize(() => this.guardando.set(false)),
    );
  }

  revocar(id: number): Observable<ApiCliente> {
    this.guardando.set(true);
    return this.http.post<ApiCliente>(`${this.apiUrl}/${id}/revocar`, {}).pipe(
      tap(c => this.reemplazar(c)),
      finalize(() => this.guardando.set(false)),
    );
  }

  eliminar(id: number): Observable<void> {
    this.guardando.set(true);
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.clientes.update(lista => lista.filter(c => c.id_api_cliente !== id))),
      finalize(() => this.guardando.set(false)),
    );
  }

  // ── Registros de consumo ────────────────────────────────────────
  cargarLogs(filtro: ApiLogsFiltro = {}): Observable<ApiLogsPage> {
    this.cargandoLogs.set(true);
    let params = new HttpParams()
      .set('pagina', String(filtro.pagina ?? 1))
      .set('tamano', String(filtro.tamano ?? 25));

    if (filtro.id_api_cliente) params = params.set('id_api_cliente', String(filtro.id_api_cliente));
    if (filtro.desde) params = params.set('desde', filtro.desde);
    if (filtro.hasta) params = params.set('hasta', filtro.hasta);
    if (filtro.solo_errores) params = params.set('solo_errores', 'true');

    return this.http.get<ApiLogsPage>(`${this.apiUrl}/logs`, { params }).pipe(
      tap(p => this.logs.set(p)),
      finalize(() => this.cargandoLogs.set(false)),
    );
  }

  cargarMetricas(horas = 24): Observable<ApiMetricas> {
    const params = new HttpParams().set('horas', String(horas));
    return this.http.get<ApiMetricas>(`${this.apiUrl}/metricas`, { params }).pipe(
      tap(m => this.metricas.set(m)),
    );
  }

  private reemplazar(cliente: ApiCliente): void {
    this.clientes.update(lista =>
      lista.map(c => (c.id_api_cliente === cliente.id_api_cliente ? cliente : c)),
    );
  }
}

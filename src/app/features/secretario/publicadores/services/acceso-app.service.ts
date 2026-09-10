import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export type EstadoAcceso =
  | 'usuario_sistema'
  | 'sin_acceso'
  | 'sin_invitacion'
  | 'invitacion_activa'
  | 'invitacion_vencida'
  | 'activo';

export type CanalEnvio = 'whatsapp' | 'correo' | 'qr' | 'enlace' | 'manual';

export interface InvitacionResumen {
  id_invitacion: number;
  fecha_creacion: string;
  fecha_expiracion: string;
  canal_envio: string | null;
  fecha_envio: string | null;
  fecha_primer_uso: string | null;
  fecha_canje: string | null;
  estado_invitacion: 'activa' | 'expirada' | 'canjeada' | 'revocada';
}

export interface AccesoAppItem {
  id_publicador: number;
  nombre: string;
  id_grupo: number | null;
  grupo: string | null;
  privilegio: string | null;
  estado: string | null;
  telefono: string | null;
  correo: string | null;
  permite_login_simple: boolean;
  codigo_pin: string | null;
  ultimo_ingreso_app: string | null;
  estado_acceso: EstadoAcceso;
  invitacion: InvitacionResumen | null;
  /** Ya tiene correo+contraseña: su camino de entrada es esa cuenta, no el PIN. */
  tiene_usuario_sistema: boolean;
}

export interface AccesoAppLista {
  codigo_seguridad: string | null;
  play_store_url: string;
  app_store_url: string;
  items: AccesoAppItem[];
}

export interface InvitacionGenerada {
  id_publicador: number;
  nombre: string;
  id_invitacion: number;
  url: string;
  expira_en: string;
  codigo_pin: string | null;
  telefono: string | null;
  correo: string | null;
  mensaje_whatsapp: string;
  qr_svg: string;
}

export interface PinRegenerado {
  id_publicador: number;
  nombre: string;
  codigo_pin: string;
}

export interface ResultadoLote {
  afectados: number;
  detalle: string[];
}

export interface InvitacionesGeneradas {
  invitaciones: InvitacionGenerada[];
  /** Nombres de quienes ya tienen usuario del sistema: no se les generó PIN. */
  omitidos: string[];
}

export interface FiltrosAcceso {
  q?: string | null;
  id_grupo?: number | null;
  id_privilegio?: number | null;
  estado_acceso?: EstadoAcceso | null;
}

@Injectable({ providedIn: 'root' })
export class AccesoAppService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/publicadores/acceso-app`;

  listar(filtros: FiltrosAcceso = {}): Observable<AccesoAppLista> {
    let params = new HttpParams();
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.id_grupo != null) params = params.set('id_grupo', filtros.id_grupo);
    if (filtros.id_privilegio != null) params = params.set('id_privilegio', filtros.id_privilegio);
    if (filtros.estado_acceso) params = params.set('estado_acceso', filtros.estado_acceso);
    return this.http.get<AccesoAppLista>(this.baseUrl, { params });
  }

  generarInvitaciones(
    ids: number[], diasValidez = 7, canal: CanalEnvio | null = null,
  ): Observable<InvitacionesGeneradas> {
    return this.http.post<InvitacionesGeneradas>(`${this.baseUrl}/invitaciones`, {
      ids_publicadores: ids, dias_validez: diasValidez, canal,
    });
  }

  marcarEnviada(idInvitacion: number, canal: CanalEnvio): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/invitaciones/${idInvitacion}/marcar-enviada`, { canal },
    );
  }

  revocar(idInvitacion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/invitaciones/${idInvitacion}`);
  }

  habilitar(ids: number[], habilitar: boolean): Observable<ResultadoLote> {
    return this.http.post<ResultadoLote>(`${this.baseUrl}/habilitar`, {
      ids_publicadores: ids, habilitar,
    });
  }

  regenerarPines(ids: number[]): Observable<PinRegenerado[]> {
    return this.http.post<PinRegenerado[]>(`${this.baseUrl}/regenerar-pin`, {
      ids_publicadores: ids,
    });
  }

  enviarCorreo(ids: number[]): Observable<ResultadoLote> {
    return this.http.post<ResultadoLote>(`${this.baseUrl}/enviar-correo`, {
      ids_publicadores: ids,
    });
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';

const API = `${environment.apiUrl}/auth/2fa`;

export interface EstadoDosPasos {
  activo: boolean;
  activado_en: string | null;
  obligatorio: boolean;
  codigos_restantes: number;
}

export interface InicioDosPasos {
  secreto: string;
  uri: string;
  qr_svg: string;
}

/** Configuración de la verificación en dos pasos del propio usuario. */
@Injectable({ providedIn: 'root' })
export class DosPasosService {
  private http = inject(HttpClient);
  private tokens = inject(TokenService);

  estado() {
    return this.http.get<EstadoDosPasos>(`${API}/estado`);
  }

  /** Pide la contraseña actual: un token robado no debe bastar para registrar un factor. */
  iniciar(password: string) {
    return this.http.post<InicioDosPasos>(`${API}/iniciar`, { password });
  }

  /** Activa y devuelve los códigos de recuperación. Trae una sesión nueva (sin `mfa_pendiente`). */
  activar(codigo: string) {
    return this.http.post<{ access_token: string; codigos_recuperacion: string[] }>(
      `${API}/activar`, { codigo }, { withCredentials: true },
    ).pipe(tap(res => this.tokens.setAccess(res.access_token)));
  }

  desactivar(password: string, codigo: string) {
    return this.http.post<{ detail: string }>(`${API}/desactivar`, { password, codigo });
  }

  regenerarCodigos(codigo: string) {
    return this.http.post<{ codigos_recuperacion: string[] }>(`${API}/codigos-recuperacion`, { codigo });
  }
}

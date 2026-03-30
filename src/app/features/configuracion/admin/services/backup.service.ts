import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Observable, tap, finalize } from 'rxjs';

export interface BackupHistorial {
   id_backup: number;
   tipo: string;
   id_congregacion: number | null;
   nombre_congregacion: string | null;
   nombre_archivo: string;
   tamano_mb: number | null;
   estado: string;
   mensaje_error: string | null;
   iniciado_por: string | null;
   enviado_por_email: boolean;
   email_destino: string | null;
   fecha_creacion: string;
}

export interface BackupCreate {
   tipo: 'completo' | 'congregacion';
   id_congregacion?: number;
   enviar_email: boolean;
   email_destino?: string;
}

export interface BackupProgramacion {
   habilitado: boolean;
   frecuencia_horas: number;
   tipo: string;
   id_congregacion: number | null;
   enviar_email: boolean;
   email_destino: string | null;
   ultima_ejecucion: string | null;
   proxima_ejecucion: string | null;
}

export interface ProgramacionUpdate {
   habilitado: boolean;
   frecuencia_horas: number;
   tipo: string;
   id_congregacion?: number | null;
   enviar_email: boolean;
   email_destino?: string | null;
}

@Injectable({
   providedIn: 'root'
})
export class BackupService {
   private http = inject(HttpClient);
   private apiUrl = `${environment.apiUrl}/config/backup`;

   historial = signal<BackupHistorial[]>([]);
   programacion = signal<BackupProgramacion | null>(null);
   loading = signal(false);

   ejecutarBackup(data: BackupCreate): Observable<BackupHistorial> {
      return this.http.post<BackupHistorial>(`${this.apiUrl}/ejecutar`, data);
   }

   getHistorial(limit = 50, offset = 0): Observable<BackupHistorial[]> {
      this.loading.set(true);
      return this.http.get<BackupHistorial[]>(`${this.apiUrl}/historial`, {
         params: { limit: limit.toString(), offset: offset.toString() }
      }).pipe(
         tap(h => this.historial.set(h)),
         finalize(() => this.loading.set(false))
      );
   }

   descargarBackup(id: number): Observable<Blob> {
      return this.http.get(`${this.apiUrl}/descargar/${id}`, {
         responseType: 'blob'
      });
   }

   eliminarBackup(id: number): Observable<void> {
      return this.http.delete<void>(`${this.apiUrl}/${id}`);
   }

   getProgramacion(): Observable<BackupProgramacion> {
      return this.http.get<BackupProgramacion>(`${this.apiUrl}/programacion`).pipe(
         tap(p => this.programacion.set(p))
      );
   }

   actualizarProgramacion(config: ProgramacionUpdate): Observable<BackupProgramacion> {
      return this.http.put<BackupProgramacion>(`${this.apiUrl}/programacion`, config).pipe(
         tap(p => this.programacion.set(p))
      );
   }
}

import {
  Injectable, inject, ApplicationRef, createComponent, EnvironmentInjector,
} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ConflictoAlertaDialogComponent } from '../components/conflicto-alerta-dialog.component';

export interface ConflictoAsignacion {
  tipo: 'entre_semana' | 'fin_semana' | 'logistica' | 'discurso_saliente';
  detalle: string;
  fecha: string;
}

export interface ConflictoResponse {
  tiene_conflicto: boolean;
  asignaciones: ConflictoAsignacion[];
}

export interface ExcluirConflicto {
  tipo: string;
  id: number;
}

@Injectable({ providedIn: 'root' })
export class ConflictosService {
  private http = inject(HttpClient);
  private appRef = inject(ApplicationRef);
  private envInjector = inject(EnvironmentInjector);
  private readonly base = `${environment.apiUrl}/reuniones/conflictos`;

  /**
   * Verifica si un publicador ya tiene asignaciones en una fecha concreta
   * revisando las 4 fuentes: entre/fin semana, logística y discursos salientes.
   * Si falla la petición devuelve sin conflicto para no bloquear la operación.
   */
  verificarConflicto(
    idPublicador: number,
    fecha: string,
    idCongregacion: number,
    excluir?: ExcluirConflicto,
  ): Observable<ConflictoResponse> {
    let params = new HttpParams()
      .set('id_publicador', idPublicador)
      .set('fecha', fecha)
      .set('id_congregacion', idCongregacion);

    if (excluir) {
      params = params.set('excluir_tipo', excluir.tipo).set('excluir_id', excluir.id);
    }

    return this.http.get<ConflictoResponse>(this.base, { params }).pipe(
      catchError((err) => {
        console.error('[ConflictosService] Error al verificar conflictos:', err);
        return of({ tiene_conflicto: false, asignaciones: [] });
      }),
    );
  }

  /**
   * Verifica conflictos y, si los hay, muestra un diálogo de alerta personalizado.
   * Retorna un Observable<boolean>: true si el usuario acepta o no hay conflicto,
   * false si cancela.
   */
  confirmarSiHayConflicto(
    idPublicador: number,
    fecha: string,
    idCongregacion: number,
    nombrePublicador: string,
    excluir?: ExcluirConflicto,
  ): Observable<boolean> {
    return this.verificarConflicto(idPublicador, fecha, idCongregacion, excluir).pipe(
      switchMap((resp) => {
        if (!resp.tiene_conflicto) return of(true);
        return from(this._mostrarDialogo(nombrePublicador, fecha, resp.asignaciones));
      }),
    );
  }

  /** Renderiza el componente de alerta de forma imperativa y retorna una Promesa. */
  private _mostrarDialogo(
    nombre: string,
    fecha: string,
    asignaciones: ConflictoAsignacion[],
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // Crear host div
      const hostEl = document.createElement('div');
      document.body.appendChild(hostEl);

      const ref = createComponent(ConflictoAlertaDialogComponent, {
        environmentInjector: this.envInjector,
        hostElement: hostEl,
      });

      // Pasar inputs
      ref.instance.nombre = nombre;
      ref.instance.fecha = fecha;
      ref.instance.asignaciones = asignaciones;

      // Escuchar respuesta
      ref.instance.resolved.subscribe((accept: boolean) => {
        ref.destroy();
        document.body.removeChild(hostEl);
        resolve(accept);
      });

      // Adjuntar a la app para que la detección de cambios funcione
      this.appRef.attachView(ref.hostView);
      ref.changeDetectorRef.detectChanges();
    });
  }
}

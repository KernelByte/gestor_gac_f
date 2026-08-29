import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CongregacionContextService } from '../congregacion-context/congregacion-context.service';
import { FORMATOS_NOMBRE, FormatoNombre } from './nombre.util';

/**
 * La regla con la que la congregación compone los nombres.
 *
 * Casi ninguna pantalla necesita esto: el backend ya manda `nombre_mostrado`
 * resuelto en sus respuestas. Hace falta sólo donde se compone un nombre que
 * todavía no existe en la base —la vista previa del formulario de publicador,
 * y las tarjetas de la pantalla de Ajustes—.
 *
 * Se lee una vez por sesión y se guarda en un signal; `refrescar()` lo relee
 * tras guardar Ajustes.
 */
@Injectable({ providedIn: 'root' })
export class FormatoNombreService {
  private http = inject(HttpClient);
  private ctx = inject(CongregacionContextService);

  /** 'completo' mientras no se sepa: es el comportamiento histórico. */
  readonly formato = signal<FormatoNombre>('completo');

  private cargadoPara: number | null = null;

  /** Carga el formato si aún no se conoce el de la congregación activa. */
  asegurarCargado(): void {
    const id = this.ctx.effectiveCongregacionId();
    if (id == null || this.cargadoPara === id) return;
    this.cargadoPara = id;
    this.refrescar();
  }

  /** Relee el formato. Llamar tras guardar la configuración. */
  refrescar(): void {
    const id = this.ctx.effectiveCongregacionId();
    if (id == null) return;
    this.http.get<any>(`${environment.apiUrl}/congregaciones/${id}`).subscribe({
      next: (c) => this.aplicar(c?.formato_nombre_visible),
      // Un fallo aquí sólo afecta a una vista previa: dejar 'completo' es
      // preferible a romper la pantalla que la muestra.
      error: () => {},
    });
  }

  /** Fija el formato sin ir al servidor (p. ej. al guardar Ajustes). */
  aplicar(valor: unknown): void {
    if (typeof valor === 'string' && (FORMATOS_NOMBRE as string[]).includes(valor)) {
      this.formato.set(valor as FormatoNombre);
    }
  }
}

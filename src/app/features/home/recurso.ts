import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

/**
 * listo  → hay datos
 * error  → falló de verdad: el panel lo dice y ofrece reintentar
 * oculto → 403/404: sin acceso o no aplica; el panel no se pinta
 */
export type EstadoRecurso = 'cargando' | 'listo' | 'error' | 'oculto';

export interface Recurso<T> {
  estado: () => EstadoRecurso;
  datos: () => T | null;
  cargar: () => void;
}

/** Un dato del dashboard con su propio estado. Debe crearse en contexto de inyección. */
export function recurso<T>(fuente: () => Observable<T>): Recurso<T> {
  const destroyRef = inject(DestroyRef);
  const estado = signal<EstadoRecurso>('cargando');
  const datos = signal<T | null>(null);

  const cargar = () => {
    estado.set('cargando');
    fuente().pipe(takeUntilDestroyed(destroyRef)).subscribe({
      next: d => { datos.set(d); estado.set('listo'); },
      error: err => {
        const status = err?.status;
        if (status === 403 || status === 404) {
          estado.set('oculto');
        } else {
          console.error('Dashboard: no se pudo cargar un panel', err);
          estado.set('error');
        }
      },
    });
  };

  return { estado: estado.asReadonly(), datos: datos.asReadonly(), cargar };
}

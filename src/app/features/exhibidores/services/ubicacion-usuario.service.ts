import { Injectable, signal } from '@angular/core';

export interface PosicionUsuario {
  lat: number;
  lon: number;
  /** Radio de incertidumbre en metros que reporta el navegador. */
  precision: number;
}

export type MotivoFallo =
  | 'no_soportado'
  | 'contexto_inseguro'
  | 'denegado'
  | 'no_disponible'
  | 'tiempo_agotado';

const MENSAJES: Record<MotivoFallo, string> = {
  no_soportado: 'Tu navegador no permite obtener la ubicación.',
  contexto_inseguro: 'La ubicación requiere una conexión segura (HTTPS).',
  denegado: 'Permiso de ubicación denegado.',
  no_disponible: 'No se pudo determinar tu ubicación.',
  tiempo_agotado: 'La ubicación tardó demasiado en responder.',
};

/**
 * Ubicación del usuario, resuelta una sola vez por sesión.
 *
 * En la pantalla de Exhibidores conviven tres mapas (el general y los dos de
 * los modales). Si cada uno llamara a getCurrentPosition por su cuenta, el
 * navegador podría mostrar varios diálogos de permiso y se harían peticiones
 * redundantes. Aquí la promesa en curso se comparte y el resultado se cachea;
 * si el usuario deniega el permiso no se vuelve a insistir en toda la sesión.
 */
@Injectable({ providedIn: 'root' })
export class UbicacionUsuarioService {
  /** Última posición conocida, o null si aún no se resolvió / falló. */
  readonly posicion = signal<PosicionUsuario | null>(null);
  /** Motivo del último fallo, para mostrarlo en la UI. */
  readonly ultimoFallo = signal<MotivoFallo | null>(null);
  readonly resolviendo = signal(false);

  private enCurso: Promise<PosicionUsuario | null> | null = null;
  /** Tras una denegación explícita no se vuelve a pedir: el navegador no
   *  mostraría el diálogo otra vez y sólo generaría esperas inútiles. */
  private denegadoEnSesion = false;

  mensajeDeFallo(motivo: MotivoFallo | null): string | null {
    return motivo ? MENSAJES[motivo] : null;
  }

  /** True si tiene sentido ofrecer el botón "Mi ubicación". */
  get disponible(): boolean {
    return typeof navigator !== 'undefined'
      && !!navigator.geolocation
      && (window.isSecureContext ?? true);
  }

  /**
   * Devuelve la posición del usuario, o null si no se puede obtener.
   * Nunca lanza: el llamador decide qué hacer con el null.
   *
   * @param forzar  ignora la caché y vuelve a preguntar (botón manual).
   */
  obtener(forzar = false): Promise<PosicionUsuario | null> {
    if (!forzar) {
      const cacheada = this.posicion();
      if (cacheada) return Promise.resolve(cacheada);
      if (this.denegadoEnSesion) return Promise.resolve(null);
      if (this.enCurso) return this.enCurso;
    }

    if (!navigator?.geolocation) {
      this.ultimoFallo.set('no_soportado');
      return Promise.resolve(null);
    }
    // En HTTP (p. ej. el VPS sin TLS) la API existe pero siempre falla.
    // Distinguirlo permite explicar el porqué en vez de decir "no disponible".
    if (window.isSecureContext === false) {
      this.ultimoFallo.set('contexto_inseguro');
      return Promise.resolve(null);
    }

    this.resolviendo.set(true);
    this.ultimoFallo.set(null);

    this.enCurso = new Promise<PosicionUsuario | null>(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const p: PosicionUsuario = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            precision: pos.coords.accuracy,
          };
          this.posicion.set(p);
          this.resolviendo.set(false);
          this.enCurso = null;
          resolve(p);
        },
        err => {
          const motivo: MotivoFallo =
            err.code === err.PERMISSION_DENIED ? 'denegado'
            : err.code === err.TIMEOUT ? 'tiempo_agotado'
            : 'no_disponible';
          if (motivo === 'denegado') this.denegadoEnSesion = true;
          this.ultimoFallo.set(motivo);
          this.resolviendo.set(false);
          this.enCurso = null;
          resolve(null);
        },
        { timeout: 8_000, maximumAge: 5 * 60_000, enableHighAccuracy: false },
      );
    });
    return this.enCurso;
  }

  /**
   * Zoom razonable según la precisión reportada. Con una posición derivada de
   * IP (varios km de error) acercarse a nivel de calle daría una falsa
   * sensación de exactitud.
   */
  zoomParaPrecision(precisionMetros: number): number {
    if (precisionMetros <= 100) return 16;
    if (precisionMetros <= 1_000) return 14;
    if (precisionMetros <= 10_000) return 12;
    return 11;
  }
}

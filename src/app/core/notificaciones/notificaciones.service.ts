import { Injectable, inject, signal, computed, OnDestroy, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from '../auth/token.service';
import { Notificacion } from './notificacion.model';

/**
 * Servicio de notificaciones internas del sistema GAC.
 *
 * Usa SSE (Server-Sent Events) vía Redis Pub/Sub para recibir
 * notificaciones en tiempo real, con auto-reconexión exponential backoff.
 *
 * Pausa la conexión cuando la pestaña está en background y
 * reconecta al volver al foreground.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService implements OnDestroy {
  private http = inject(HttpClient);
  private tokens = inject(TokenService);
  private zone = inject(NgZone);

  // ── Estado reactivo ─────────────────────────────────────────
  notificaciones = signal<Notificacion[]>([]);
  cargando = signal(false);
  count = computed(() => this.notificaciones().filter(n => !n.leida).length);

  // ── SSE internals ───────────────────────────────────────────
  private eventSource: EventSource | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: any = null;
  private visibilityHandler: (() => void) | null = null;
  private connected = false;
  /** Petición de ticket en vuelo: se cancela al cerrar para no abrir un stream huérfano. */
  private ticketSub: Subscription | null = null;

  /**
   * Inicia la conexión SSE y suscribe a eventos de visibilidad.
   * Llamar desde ShellPage.ngOnInit().
   */
  connectSSE(): void {
    const token = this.tokens.accessToken();
    if (!token) return;

    this._closeExisting();

    // EventSource no admite cabeceras: en vez de poner el JWT en la URL (queda
    // en los logs de acceso) se pide un ticket de un solo uso con el token en
    // la cabecera, vía el interceptor. Cada reconexión pide uno nuevo.
    this.ticketSub = this.http
      .post<{ ticket: string }>(`${environment.apiUrl}/notificaciones/stream-ticket`, {})
      .subscribe({
        next: ({ ticket }) => this._abrirStream(ticket),
        error: () => this._programarReconexion(),
      });

    // Suscribir al visibilitychange para pausar/reanudar
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => this._onVisibilityChange();
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private _programarReconexion(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connectSSE();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private _abrirStream(ticket: string): void {
    const url = `${environment.apiUrl}/notificaciones/stream?ticket=${encodeURIComponent(ticket)}`;

    // Ejecutar fuera de la zona de Angular para evitar innecesarios
    // ciclos de detección de cambios en cada evento SSE
    this.zone.runOutsideAngular(() => {
      this.eventSource = new EventSource(url);

      this.eventSource.addEventListener('notificacion', (event: MessageEvent) => {
        const notif: Notificacion = JSON.parse(event.data);
        this.zone.run(() => {
          this.reconnectDelay = 1000; // reset backoff
          this.notificaciones.update(current => {
            // Evitar duplicados
            if (current.some(n => n.id_notificacion === notif.id_notificacion)) {
              return current;
            }
            return [notif, ...current].sort(
              (a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
            );
          });
        });
      });

      this.eventSource.onerror = () => {
        // El ticket ya se gastó: reconectar pidiendo uno nuevo (con backoff),
        // no dejar que EventSource reintente la misma URL.
        this._closeExisting();
        this._programarReconexion();
      };

      this.eventSource.onopen = () => {
        this.connected = true;
        this.reconnectDelay = 1000; // reset
      };
    });
  }

  /**
   * Cierra la conexión SSE limpiamente.
   * Llamar desde ShellPage.ngOnDestroy().
   */
  disconnectSSE(): void {
    this._closeExisting();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.connected = false;
  }

  /**
   * Marca una notificación como leída (optimistic update).
   */
  marcarLeida(id: number): Observable<any> {
    // Optimistic update
    this.notificaciones.update(list =>
      list.map(n => n.id_notificacion === id ? { ...n, leida: true } : n)
    );
    return this.http.put(`${environment.apiUrl}/notificaciones/${id}/leer`, {});
  }

  /**
   * Marca todas las notificaciones como leídas.
   */
  marcarTodasLeidas(): Observable<any> {
    this.notificaciones.update(list =>
      list.map(n => ({ ...n, leida: true }))
    );
    return this.http.put(`${environment.apiUrl}/notificaciones/leer-todas`, {});
  }

  ngOnDestroy(): void {
    this.disconnectSSE();
  }

  // ── Privados ────────────────────────────────────────────────

  private _closeExisting(): void {
    this.ticketSub?.unsubscribe();
    this.ticketSub = null;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Pausa SSE cuando la pestaña va a background, reconecta al volver.
   * Optimización estándar de apps como Notion, Linear, GitHub.
   */
  private _onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      this._closeExisting();
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    } else if (document.visibilityState === 'visible') {
      // Al volver, reconectar inmediatamente
      this.reconnectDelay = 1000;
      this.connectSSE();
    }
  }
}

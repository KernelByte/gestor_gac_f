import { computed, inject, Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { ReunionAncianosService } from './reunion-ancianos.service';
import { AccionCrono, ParteVivo, VivoOut } from '../models/reunion-ancianos.model';

export type Conexion = 'conectando' | 'en-vivo' | 'sondeo' | 'sin-conexion';

const SONDEO_MS = 5000;
const REINTENTO_SSE_MS = 30_000;
/** Si el stream ya estaba abierto y se corta (el servidor lo renueva a los 30 min, cambio de red), se reabre enseguida. */
const REABRIR_SSE_MS = 2_000;
/** Con el stream abierto, una relectura de seguridad: una conexión puede morir en silencio tras un proxy. */
const SEGURIDAD_MS = 30_000;

/**
 * El estado compartido de una reunión en vivo, para la pantalla que la sigue.
 *
 * - Se suscribe al stream SSE de la reunión: cada evento dice «algo cambió» y
 *   aquí se vuelve a pedir GET /vivo (una sola petición aunque lleguen varios).
 *   Si el stream falla (o la sesión es de PIN, sin ticket), sondea cada 5 s y
 *   reintenta el stream cada 30 s.
 * - El reloj: `ahora()` es la hora del SERVIDOR (la del equipo más el desfase
 *   medido en cada respuesta), así todas las pantallas marcan lo mismo.
 * - Cada acción aplica la respuesta en cuanto llega; el evento que publica el
 *   servidor solo actualiza a los demás.
 *
 * Se provee en el componente de la pantalla: se crea y se destruye con ella.
 */
@Injectable()
export class ReunionVivoStore implements OnDestroy {
  private svc = inject(ReunionAncianosService);
  private zone = inject(NgZone);

  private id = 0;
  datos = signal<VivoOut | null>(null);
  error = signal<'no-encontrada' | 'error' | null>(null);
  conexion = signal<Conexion>('conectando');
  ocupado = signal(false);

  /** ms que hay que sumarle al reloj del equipo para tener la hora del servidor. */
  private desfase = 0;
  private tic = signal(Date.now());
  /** Hora del servidor, actualizada cuatro veces por segundo. */
  ahora = computed(() => this.tic() + this.desfase);

  private reloj: ReturnType<typeof setInterval> | null = null;
  private sondeo: ReturnType<typeof setInterval> | null = null;
  private reintento: ReturnType<typeof setTimeout> | null = null;
  private fuente: EventSource | null = null;
  private seguridad: ReturnType<typeof setInterval> | null = null;
  /** Hora del servidor de la última respuesta aplicada: una respuesta más vieja que llegue tarde no la pisa. */
  private ultimaHora = 0;
  private pidiendo = false;
  private otraVez = false;
  private destruido = false;
  private alVolver = () => { if (document.visibilityState === 'visible') this.refrescar(); };
  private alReconectar = () => {
    void this.refrescar();
    if (!this.fuente) this.conectar();
  };

  parteActual = computed<ParteVivo | null>(() => {
    const d = this.datos();
    return d?.partes.find(p => p.id_parte === d.id_parte_actual) ?? null;
  });

  async iniciar(id: number) {
    this.id = id;
    // El reloj corre fuera de Angular y solo entra para mover la señal.
    this.zone.runOutsideAngular(() => {
      this.reloj = setInterval(() => this.zone.run(() => this.tic.set(Date.now())), 250);
    });
    document.addEventListener('visibilitychange', this.alVolver);
    window.addEventListener('online', this.alReconectar);
    await this.refrescar();
    if (!this.error()) this.conectar();
  }

  ngOnDestroy() {
    this.destruido = true;
    if (this.reloj) clearInterval(this.reloj);
    this.pararSondeo();
    this.pararSeguridad();
    if (this.reintento) clearTimeout(this.reintento);
    this.fuente?.close();
    document.removeEventListener('visibilitychange', this.alVolver);
    window.removeEventListener('online', this.alReconectar);
  }

  /** Segundos reales de una parte, contando el tramo que corre ahora. */
  segundos(p: ParteVivo | null): number {
    if (!p) return 0;
    const extra = p.desde ? Math.max(0, (this.ahora() - Date.parse(p.desde)) / 1000) : 0;
    return Math.floor(p.acumulado_seg + extra);
  }

  /** Desde que empezó la reunión (sin descontar recesos: es lo que marca el reloj de pared). */
  transcurrido(): number {
    const d = this.datos();
    if (!d?.iniciada_en) return 0;
    const fin = d.finalizada_en ? Date.parse(d.finalizada_en) : this.ahora();
    return Math.max(0, Math.floor((fin - Date.parse(d.iniciada_en)) / 1000));
  }

  // ── Datos ────────────────────────────────────────────────────────────────

  aplicar(d: VivoOut) {
    // Una lectura que salió antes de un cambio puede llegar después de su respuesta: se descarta.
    const hora = Date.parse(d.ahora);
    if (hora < this.ultimaHora) return;
    this.ultimaHora = hora;
    // Desfase = hora del servidor menos la del equipo, al recibir la respuesta.
    this.desfase = Date.parse(d.ahora) - Date.now();
    this.tic.set(Date.now());
    this.datos.set(d);
    this.error.set(null);
  }

  /** Pide GET /vivo; si ya hay una en camino, la repite al terminar (nunca dos a la vez). */
  async refrescar(): Promise<void> {
    if (this.pidiendo) { this.otraVez = true; return; }
    this.pidiendo = true;
    try {
      this.aplicar(await firstValueFrom(this.svc.vivo(this.id)));
      // Una lectura que sale bien borra el «sin conexión»: el stream, si sigue abierto, o el sondeo.
      if (this.conexion() === 'sin-conexion') this.conexion.set(this.fuente ? 'en-vivo' : 'sondeo');
    } catch (e) {
      const err = e as HttpErrorResponse;
      if (err.status === 404 || err.status === 403) this.error.set('no-encontrada');
      else if (!this.datos()) this.error.set('error');
      else this.conexion.set('sin-conexion');
    } finally {
      this.pidiendo = false;
      if (this.otraVez) { this.otraVez = false; void this.refrescar(); }
    }
  }

  /** Corre una acción que devuelve el estado nuevo y lo aplica. Devuelve false si falló. */
  async accion(obs: Observable<VivoOut>): Promise<boolean> {
    this.ocupado.set(true);
    try {
      this.aplicar(await firstValueFrom(obs));
      return true;
    } catch {
      await this.refrescar();
      return false;
    } finally {
      this.ocupado.set(false);
    }
  }

  crono(accion: AccionCrono, idParte?: number | null) {
    return this.accion(this.svc.crono(this.id, accion, idParte));
  }

  receso(activo: boolean) {
    return this.accion(this.svc.receso(this.id, activo));
  }

  empezar() {
    return this.accion(this.svc.iniciar(this.id));
  }

  // ── Tiempo real ──────────────────────────────────────────────────────────

  private conectar() {
    if (this.destruido) return;
    if (this.reintento) { clearTimeout(this.reintento); this.reintento = null; }
    if (this.conexion() !== 'en-vivo') this.conexion.set('conectando');
    this.svc.ticketStream().subscribe({
      next: ({ ticket }) => this.abrir(ticket),
      // Sin ticket (sesión con PIN, o Redis caído): se sondea.
      error: () => this.modoSondeo(),
    });
  }

  private abrir(ticket: string) {
    if (this.destruido) return;
    this.fuente?.close();
    this.zone.runOutsideAngular(() => {
      const fuente = new EventSource(this.svc.urlStream(this.id, ticket));
      this.fuente = fuente;
      let abierta = false;
      fuente.addEventListener('listo', () => this.zone.run(() => {
        if (this.fuente !== fuente) return;
        abierta = true;
        this.pararSondeo();
        this.conexion.set('en-vivo');
        void this.refrescar();
        if (!this.seguridad) {
          this.zone.runOutsideAngular(() => {
            this.seguridad = setInterval(() => this.zone.run(() => {
              if (document.visibilityState === 'visible') void this.refrescar();
            }), SEGURIDAD_MS);
          });
        }
      }));
      fuente.addEventListener('cambio', () => this.zone.run(() => {
        if (this.fuente === fuente) void this.refrescar();
      }));
      fuente.onerror = () => this.zone.run(() => {
        // El ticket es de un solo uso: no se deja que EventSource reintente la misma URL.
        fuente.close();
        if (this.fuente !== fuente) return;
        this.fuente = null;
        // Se cortó uno que funcionaba: se reabre enseguida; si nunca abrió, se espera más.
        this.modoSondeo(abierta ? REABRIR_SSE_MS : REINTENTO_SSE_MS);
      });
    });
  }

  private modoSondeo(reintentoMs = REINTENTO_SSE_MS) {
    if (this.destruido) return;
    this.pararSeguridad();
    if (this.conexion() !== 'sin-conexion') this.conexion.set('sondeo');
    if (!this.sondeo) {
      this.zone.runOutsideAngular(() => {
        this.sondeo = setInterval(() => this.zone.run(() => {
          if (document.visibilityState === 'visible') void this.refrescar();
        }), SONDEO_MS);
      });
    }
    if (this.reintento) clearTimeout(this.reintento);
    this.reintento = setTimeout(() => this.conectar(), reintentoMs);
  }

  private pararSeguridad() {
    if (this.seguridad) { clearInterval(this.seguridad); this.seguridad = null; }
  }

  private pararSondeo() {
    if (this.sondeo) { clearInterval(this.sondeo); this.sondeo = null; }
  }
}

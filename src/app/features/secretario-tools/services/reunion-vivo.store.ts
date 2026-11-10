import { computed, inject, Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { ReunionAncianosService } from './reunion-ancianos.service';
import { AccionCrono, ParteVivo, VivoOut } from '../models/reunion-ancianos.model';

export type Conexion = 'conectando' | 'en-vivo' | 'sondeo' | 'sin-conexion';

const SONDEO_MS = 5000;
const REINTENTO_SSE_MS = 30_000;

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
  private pidiendo = false;
  private otraVez = false;
  private destruido = false;
  private alVolver = () => { if (document.visibilityState === 'visible') this.refrescar(); };

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
    await this.refrescar();
    if (!this.error()) this.conectar();
  }

  ngOnDestroy() {
    this.destruido = true;
    if (this.reloj) clearInterval(this.reloj);
    this.pararSondeo();
    if (this.reintento) clearTimeout(this.reintento);
    this.fuente?.close();
    document.removeEventListener('visibilitychange', this.alVolver);
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
    this.conexion.set('conectando');
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
      fuente.addEventListener('listo', () => this.zone.run(() => {
        this.pararSondeo();
        this.conexion.set('en-vivo');
        void this.refrescar();
      }));
      fuente.addEventListener('cambio', () => this.zone.run(() => void this.refrescar()));
      fuente.onerror = () => this.zone.run(() => {
        // El ticket es de un solo uso: no se deja que EventSource reintente la misma URL.
        fuente.close();
        if (this.fuente === fuente) this.fuente = null;
        this.modoSondeo();
      });
    });
  }

  private modoSondeo() {
    if (this.destruido) return;
    this.conexion.set('sondeo');
    if (!this.sondeo) {
      this.zone.runOutsideAngular(() => {
        this.sondeo = setInterval(() => this.zone.run(() => {
          if (document.visibilityState === 'visible') void this.refrescar();
        }), SONDEO_MS);
      });
    }
    if (this.reintento) clearTimeout(this.reintento);
    this.reintento = setTimeout(() => this.conectar(), REINTENTO_SSE_MS);
  }

  private pararSondeo() {
    if (this.sondeo) { clearInterval(this.sondeo); this.sondeo = null; }
  }
}

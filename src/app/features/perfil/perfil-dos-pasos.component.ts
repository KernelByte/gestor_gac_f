import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { DosPasosService, EstadoDosPasos } from '../../core/auth/dos-pasos.service';
import { AuthService } from '../../core/auth/auth.service';
import { ActivarDosPasosComponent } from '../../shared/components/dos-pasos/activar-dos-pasos.component';

/**
 * Verificación en dos pasos del propio usuario. Tarjeta de ancho completo en el Perfil:
 * a la izquierda el estado de la protección, a la derecha lo que se puede hacer.
 */
@Component({
  standalone: true,
  selector: 'app-perfil-dos-pasos',
  imports: [CommonModule, DatePipe, ActivarDosPasosComponent],
  template: `
    <section class="tarjeta" aria-labelledby="titulo-dos-pasos">
      <div *ngIf="!estado() && !errorCarga()" class="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-busy="true">
        <div class="skeleton h-40 rounded-2xl"></div>
        <div class="skeleton h-40 rounded-2xl"></div>
      </div>

      <p *ngIf="errorCarga()" role="alert" class="text-sm font-semibold text-red-600 dark:text-red-400">{{ errorCarga() }}</p>

      <div *ngIf="estado() as e" class="grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">

        <!-- Estado -->
        <div class="flex flex-col gap-5">
          <div class="flex items-start gap-4">
            <div class="escudo" [class.escudo-on]="e.activo" aria-hidden="true">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/>
                <path *ngIf="e.activo" d="M9 12l2 2 4-4"/>
                <path *ngIf="!e.activo" d="M12 9v4m0 3h.01"/>
              </svg>
            </div>
            <div class="min-w-0">
              <h2 id="titulo-dos-pasos" class="text-lg font-bold text-slate-800 dark:text-white leading-snug">Verificación en dos pasos</h2>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-300 max-w-prose">
                Además de tu contraseña, al entrar se te pedirá un número de 6 cifras que cambia cada pocos segundos en tu teléfono.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span class="estado" [class.estado-on]="e.activo">
              <span class="punto" aria-hidden="true"></span>
              {{ e.activo ? 'Activada' : 'No activada' }}
            </span>
            <span *ngIf="e.activo && e.activado_en" class="text-sm text-slate-500 dark:text-slate-400">
              desde el {{ e.activado_en | date:'d MMM yyyy':'':'es' }}
            </span>
          </div>

          <p *ngIf="!e.activo" class="text-sm text-slate-600 dark:text-slate-300">
            Sin este paso, cualquiera que conozca tu contraseña puede entrar a tu cuenta.
          </p>
          <p *ngIf="e.activo && e.obligatorio" class="text-sm text-slate-500 dark:text-slate-400">
            Para administradores es obligatoria y no se puede desactivar.
          </p>
        </div>

        <!-- Acciones -->
        <div class="min-w-0">

          <!-- Aún no activada: asistente -->
          <app-activar-dos-pasos *ngIf="!e.activo" (terminado)="alTerminar()"></app-activar-dos-pasos>

          <ng-container *ngIf="e.activo">

            <!-- Menú de acciones -->
            <ul *ngIf="modo() === 'ver'" class="filas">
              <li class="fila">
                <div class="min-w-0">
                  <p class="fila-titulo">Códigos de recuperación</p>
                  <p class="fila-desc" [class.fila-alerta]="e.codigos_restantes <= 2">
                    {{ textoCodigos(e.codigos_restantes) }}
                  </p>
                </div>
                <button type="button" class="btn-secondary" (click)="abrir('codigos')">Generar nuevos</button>
              </li>
              <li class="fila" *ngIf="!e.obligatorio">
                <div class="min-w-0">
                  <p class="fila-titulo">Desactivar</p>
                  <p class="fila-desc">Volverás a entrar solo con tu contraseña.</p>
                </div>
                <button type="button" class="btn-ghost-danger" (click)="abrir('desactivar')">Desactivar</button>
              </li>
            </ul>

            <!-- Nuevos códigos -->
            <div *ngIf="modo() === 'codigos'" class="panel">
              <ng-container *ngIf="!codigosNuevos().length">
                <h3 class="panel-titulo">Generar nuevos códigos</h3>
                <p class="panel-desc">Los códigos anteriores dejarán de servir. Confirma con el número que muestra tu aplicación.</p>
                <label for="pd-codigo" class="etiqueta">Código de 6 números</label>
                <input #c1 id="pd-codigo" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"
                  class="campo" (keydown.enter)="regenerar(c1.value)">
                <div class="botones">
                  <button type="button" class="btn-secondary" (click)="cancelar()">Cancelar</button>
                  <button type="button" class="btn-primary" [disabled]="trabajando()" (click)="regenerar(c1.value)">
                    {{ trabajando() ? 'Generando…' : 'Generar códigos' }}
                  </button>
                </div>
              </ng-container>
              <ng-container *ngIf="codigosNuevos().length">
                <h3 class="panel-titulo">Tus nuevos códigos</h3>
                <p class="aviso">Guárdalos ahora en un lugar seguro: no se volverán a mostrar.</p>
                <ul class="codigos">
                  <li *ngFor="let c of codigosNuevos()">{{ c }}</li>
                </ul>
                <div class="botones">
                  <button type="button" class="btn-secondary" (click)="descargar()">Descargar</button>
                  <button type="button" class="btn-primary" (click)="cerrarCodigos()">Ya los guardé</button>
                </div>
              </ng-container>
            </div>

            <!-- Desactivar -->
            <div *ngIf="modo() === 'desactivar'" class="panel">
              <h3 class="panel-titulo">Desactivar la verificación</h3>
              <p class="panel-desc">Tu cuenta quedará menos protegida. Para confirmar que eres tú, escribe tu contraseña y un código de la aplicación.</p>
              <label for="pd-pass" class="etiqueta">Contraseña</label>
              <input #pw id="pd-pass" type="password" class="campo campo-texto" autocomplete="current-password">
              <label for="pd-cod2" class="etiqueta mt-3">Código de 6 números</label>
              <input #c2 id="pd-cod2" inputmode="numeric" maxlength="11" placeholder="000000" class="campo"
                (keydown.enter)="desactivar(pw.value, c2.value)">
              <div class="botones">
                <button type="button" class="btn-secondary" (click)="cancelar()">Cancelar</button>
                <button type="button" class="btn-danger" [disabled]="trabajando()" (click)="desactivar(pw.value, c2.value)">
                  {{ trabajando() ? 'Desactivando…' : 'Desactivar' }}
                </button>
              </div>
            </div>
          </ng-container>

          <p *ngIf="error()" role="alert" class="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{{ error() }}</p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .tarjeta { background: #fff; border: 1px solid rgb(226 232 240); border-radius: 1rem; padding: 1.5rem;
      box-shadow: var(--shadow-soft); }
    @media (min-width: 1024px) { .tarjeta { padding: 2rem 2.5rem; } }
    :host-context(.dark) .tarjeta { background: rgb(15 23 42); border-color: rgb(30 41 59); box-shadow: none; }

    .escudo { flex-shrink: 0; width: 3rem; height: 3rem; border-radius: 9999px; display: grid; place-items: center;
      background: rgb(245 158 11 / .14); color: #b45309; }
    .escudo-on { background: rgb(16 185 129 / .14); color: #047857; }
    :host-context(.dark) .escudo { background: rgb(245 158 11 / .18); color: #fcd34d; }
    :host-context(.dark) .escudo-on { background: rgb(16 185 129 / .18); color: #6ee7b7; }

    .estado { display: inline-flex; align-items: center; gap: .5rem; height: 2rem; padding: 0 .875rem; border-radius: 9999px;
      font-size: .875rem; font-weight: 700; background: rgb(245 158 11 / .14); color: #92400e; }
    .estado-on { background: rgb(16 185 129 / .14); color: #065f46; }
    :host-context(.dark) .estado { color: #fcd34d; }
    :host-context(.dark) .estado-on { color: #6ee7b7; }
    .punto { width: .5rem; height: .5rem; border-radius: 9999px; background: currentColor; }

    .filas { list-style: none; margin: 0; padding: 0; border: 1px solid rgb(226 232 240); border-radius: 1rem; overflow: hidden; }
    :host-context(.dark) .filas { border-color: rgb(51 65 85); }
    .fila { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem 1rem; padding: 1rem 1.25rem; }
    .fila + .fila { border-top: 1px solid rgb(226 232 240); }
    :host-context(.dark) .fila + .fila { border-top-color: rgb(51 65 85); }
    .fila-titulo { font-size: .9375rem; font-weight: 700; color: rgb(30 41 59); }
    .fila-desc { margin-top: .125rem; font-size: .875rem; color: rgb(100 116 139); }
    :host-context(.dark) .fila-titulo { color: #f1f5f9; }
    :host-context(.dark) .fila-desc { color: rgb(148 163 184); }

    .panel { border: 1px solid rgb(226 232 240); border-radius: 1rem; padding: 1.25rem; animation: entra .22s cubic-bezier(.22,1,.36,1); }
    :host-context(.dark) .panel { border-color: rgb(51 65 85); }
    .panel-titulo { font-size: 1rem; font-weight: 700; color: rgb(30 41 59); }
    :host-context(.dark) .panel-titulo { color: #f1f5f9; }
    .panel-desc { margin: .25rem 0 1rem; font-size: .875rem; color: rgb(71 85 105); max-width: 60ch; }
    :host-context(.dark) .panel-desc { color: rgb(203 213 225); }
    .etiqueta { display: block; margin-bottom: .375rem; font-size: .875rem; font-weight: 700; color: rgb(51 65 85); }
    :host-context(.dark) .etiqueta { color: #e2e8f0; }
    .aviso { margin: .5rem 0 1rem; padding: .75rem 1rem; border-radius: .75rem; font-size: .875rem; font-weight: 600;
      background: rgb(245 158 11 / .12); color: #92400e; }
    :host-context(.dark) .aviso { color: #fcd34d; }

    .campo { width: 100%; height: 3rem; border-radius: .75rem; border: 1px solid rgb(203 213 225); background: rgb(248 250 252);
      text-align: center; font-family: ui-monospace, monospace; font-size: 1.25rem; letter-spacing: .35em; padding: 0 .75rem; color: rgb(15 23 42);
      transition: border-color .15s, box-shadow .15s; }
    .campo-texto { font-family: inherit; font-size: 1rem; letter-spacing: normal; text-align: left; }
    .campo:focus { outline: none; border-color: #6d28d9; box-shadow: 0 0 0 3px rgb(109 40 217 / .2); }
    :host-context(.dark) .campo { border-color: rgb(71 85 105); background: rgb(30 41 59); color: #fff; }

    .codigos { list-style: none; margin: 0 0 1rem; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem;
      font-family: ui-monospace, monospace; font-size: .9375rem; font-weight: 700; color: rgb(30 41 59); }
    @media (min-width: 640px) { .codigos { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    .codigos li { padding: .625rem .5rem; border-radius: .625rem; text-align: center; background: rgb(241 245 249); user-select: all; }
    :host-context(.dark) .codigos { color: #f1f5f9; }
    :host-context(.dark) .codigos li { background: rgb(30 41 59); }

    .botones { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .75rem; margin-top: 1.25rem; }
    .fila-alerta { color: #b45309; font-weight: 600; }
    :host-context(.dark) .fila-alerta { color: #fcd34d; }
    .etiqueta.mt-3 { margin-top: .75rem; }

    @keyframes entra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
  `],
})
export class PerfilDosPasosComponent implements OnInit {
  private svc = inject(DosPasosService);
  private auth = inject(AuthService);

  estado = signal<EstadoDosPasos | null>(null);
  modo = signal<'ver' | 'codigos' | 'desactivar'>('ver');
  error = signal<string | null>(null);
  errorCarga = signal<string | null>(null);
  trabajando = signal(false);
  codigosNuevos = signal<string[]>([]);

  ngOnInit() { this.cargar(); }

  cargar() {
    this.svc.estado().subscribe({
      next: e => { this.estado.set(e); this.errorCarga.set(null); },
      error: () => this.errorCarga.set('No se pudo cargar el estado de la verificación en dos pasos.'),
    });
  }

  textoCodigos(n: number) {
    if (n <= 0) return 'No te quedan códigos sin usar. Genera nuevos.';
    return n === 1 ? 'Te queda 1 código sin usar.' : `Te quedan ${n} códigos sin usar.`;
  }

  abrir(m: 'codigos' | 'desactivar') { this.error.set(null); this.modo.set(m); }
  cancelar() { this.error.set(null); this.modo.set('ver'); }

  async alTerminar() {
    this.modo.set('ver');
    this.cargar();
    try { await lastValueFrom(this.auth.me()); } catch { }
  }

  cerrarCodigos() {
    this.codigosNuevos.set([]);
    this.modo.set('ver');
    this.cargar();
  }

  descargar() {
    const texto = [
      'Códigos de recuperación - verificación en dos pasos',
      `Generados: ${new Date().toLocaleString('es-CO')}`,
      'Cada código sirve una sola vez.',
      '',
      ...this.codigosNuevos(),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigos-recuperacion.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async regenerar(codigo: string) {
    this.trabajando.set(true); this.error.set(null);
    try {
      const r = await lastValueFrom(this.svc.regenerarCodigos(codigo.trim()));
      this.codigosNuevos.set(r.codigos_recuperacion);
    } catch (e: any) {
      this.error.set(e?.error?.detail ?? 'No se pudo generar.');
    } finally { this.trabajando.set(false); }
  }

  async desactivar(password: string, codigo: string) {
    this.trabajando.set(true); this.error.set(null);
    try {
      await lastValueFrom(this.svc.desactivar(password, codigo.trim()));
      this.modo.set('ver');
      this.cargar();
      try { await lastValueFrom(this.auth.me()); } catch { }
    } catch (e: any) {
      this.error.set(e?.error?.detail ?? 'No se pudo desactivar.');
    } finally { this.trabajando.set(false); }
  }
}

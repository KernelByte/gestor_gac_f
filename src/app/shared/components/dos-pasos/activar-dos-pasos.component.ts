import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { lastValueFrom } from 'rxjs';
import { DosPasosService } from '../../../core/auth/dos-pasos.service';

/**
 * Pasos para activar la verificación en dos pasos, uno por pantalla:
 *   1. Contraseña (y qué aplicación instalar).
 *   2. Vincular la aplicación: abrirla con un toque (teléfono) o escanear el QR
 *      (computador) y escribir el número de 6 cifras.
 *   3. Códigos de recuperación, una sola vez, para descargar.
 * Lo usan el aviso obligatorio para administradores y el Perfil (dentro de un modal).
 */
@Component({
  standalone: true,
  selector: 'app-activar-dos-pasos',
  imports: [CommonModule],
  template: `
    <!-- Progreso: «Paso 2 de 3» y tres tramos -->
    <div class="progreso" role="group" [attr.aria-label]="'Paso ' + paso() + ' de 3'">
      <div class="flex items-baseline justify-between gap-3">
        <span class="paso-n">Paso {{ paso() }} de 3</span>
        <span class="paso-t">{{ etapas[paso() - 1] }}</span>
      </div>
      <div class="tramos" aria-hidden="true">
        <span *ngFor="let t of etapas; let i = index" [class.on]="paso() >= i + 1"></span>
      </div>
    </div>

    <!-- Paso 1 -->
    <div *ngIf="paso() === 1" class="cuerpo">
      <p class="texto">
        Necesitas <b>Google Authenticator</b> o <b>Microsoft Authenticator</b> en tu teléfono (son gratis).
        Si aún no la tienes, instálala primero.
      </p>
      <div>
        <label for="password-activar" class="etiqueta">Tu contraseña</label>
        <input id="password-activar" #p type="password" [value]="password()" (input)="password.set(p.value)"
          (keydown.enter)="empezar()" autocomplete="current-password" class="form-control" placeholder="Escríbela para continuar">
      </div>
      <button type="button" (click)="empezar()" [disabled]="cargando() || !password()" class="btn-primary btn-lg w-full">
        <span *ngIf="cargando()" class="spinner-sm"></span>
        {{ cargando() ? 'Preparando…' : 'Continuar' }}
      </button>
    </div>

    <!-- Paso 2 -->
    <div *ngIf="paso() === 2" class="cuerpo">
      <!-- Teléfono: un toque abre la aplicación con la cuenta ya cargada -->
      <a *ngIf="enlace()" [href]="enlace()" class="btn-secondary btn-lg w-full">Abrir en mi aplicación</a>

      <div class="vincular">
        <div class="qr" [innerHTML]="qr()" role="img" aria-label="Código QR para la aplicación"></div>
        <div class="min-w-0">
          <p class="texto"><b>¿Estás en un computador?</b> En la aplicación elige <i>añadir cuenta</i> y apunta la cámara al código.</p>
          <details class="mt-2">
            <summary class="enlace">Prefiero escribir una clave</summary>
            <p class="clave">{{ secreto() }}</p>
          </details>
        </div>
      </div>

      <div>
        <label for="codigo-activar" class="etiqueta">Número de 6 cifras que muestra la aplicación</label>
        <input id="codigo-activar" #c [value]="codigo()" (input)="codigo.set(c.value)" (keydown.enter)="activar()"
          inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="campo" placeholder="000000">
      </div>
      <button type="button" (click)="activar()" [disabled]="cargando() || codigo().trim().length !== 6" class="btn-primary btn-lg w-full">
        <span *ngIf="cargando()" class="spinner-sm"></span>
        {{ cargando() ? 'Comprobando…' : 'Activar' }}
      </button>
    </div>

    <!-- Paso 3 -->
    <div *ngIf="paso() === 3" class="cuerpo">
      <p class="aviso">
        Ya está activa. Guarda estos códigos: si pierdes el teléfono, cada uno te deja entrar una vez.
        <b>No se volverán a mostrar.</b>
      </p>
      <ul class="codigos">
        <li *ngFor="let c of codigos()">{{ c }}</li>
      </ul>
      <button type="button" (click)="descargarCodigos()" class="btn-secondary btn-lg w-full">Descargar códigos</button>
      <button type="button" (click)="terminado.emit()" class="btn-primary btn-lg w-full">Ya los guardé</button>
    </div>

    <p *ngIf="error()" role="alert" class="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{{ error() }}</p>
  `,
  styles: [`
    :host { display: block; }
    .progreso { margin-bottom: 1rem; }
    .paso-n { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--dash-texto-suave); }
    .paso-t { font-size: .875rem; font-weight: 700; color: var(--dash-tesela-fg); }
    .tramos { display: grid; grid-template-columns: repeat(3, 1fr); gap: .375rem; margin-top: .5rem; }
    .tramos span { height: .25rem; border-radius: 999px; background: var(--dash-borde);
      transition: background-color .28s cubic-bezier(.23, 1, .32, 1); }
    .tramos span.on { background: var(--accent); }

    .cuerpo { display: flex; flex-direction: column; gap: 1rem; animation: entra .22s cubic-bezier(.22,1,.36,1); }
    .texto { font-size: .875rem; line-height: 1.5; color: var(--dash-texto-suave); max-width: 62ch; }
    .texto b { color: var(--dash-tesela-fg); }
    .etiqueta { display: block; margin-bottom: .375rem; font-size: .875rem; font-weight: 600; color: var(--dash-tesela-fg); }
    .enlace { cursor: pointer; font-size: .875rem; font-weight: 600; color: var(--accent); }
    .mt-2 { margin-top: .5rem; }
    .clave { margin-top: .5rem; padding: .625rem .875rem; border-radius: .625rem; background: var(--dash-tesela); user-select: all; word-break: break-all;
      font-family: ui-monospace, monospace; font-size: .875rem; font-weight: 700; color: var(--dash-tesela-fg); }

    /* QR y su explicación: lado a lado si cabe, apilados si no (según el ancho del propio asistente) */
    :host { container-type: inline-size; }
    .vincular { display: flex; flex-direction: column; align-items: center; gap: .75rem; text-align: center; }
    .vincular .texto { margin-inline: auto; }
    @container (min-width: 30rem) { .vincular { flex-direction: row; text-align: left; gap: 1.25rem; } }
    .qr { flex-shrink: 0; padding: .5rem; background: #fff; border-radius: .75rem; border: 1px solid var(--dash-borde); }
    .qr ::ng-deep svg { display: block; width: 8.5rem; height: 8.5rem; }

    .campo { width: 100%; height: 3.25rem; border-radius: .75rem; border: 1px solid var(--dash-borde); background: var(--dash-hover); color: var(--dash-tesela-fg);
      text-align: center; font-family: ui-monospace, monospace; font-size: 1.5rem; letter-spacing: .4em; padding: 0 .75rem;
      transition: border-color .15s, box-shadow .15s; }
    .campo:focus { outline: none; border-color: var(--accent-focus); box-shadow: 0 0 0 3px var(--accent-ring); }

    .aviso { padding: .75rem 1rem; border-radius: .75rem; font-size: .875rem; line-height: 1.5;
      background: var(--estado-aviso-bg); color: var(--estado-aviso-fg); }
    .codigos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem;
      font-family: ui-monospace, monospace; font-size: .9375rem; font-weight: 700; color: var(--dash-tesela-fg); }
    .codigos li { padding: .625rem .5rem; border-radius: .625rem; text-align: center; background: var(--dash-tesela); user-select: all; }

    @keyframes entra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .cuerpo { animation: none; } .tramos span { transition: none; } }
  `],
})
export class ActivarDosPasosComponent {
  private svc = inject(DosPasosService);
  private sanitizer = inject(DomSanitizer);

  /** Se emite cuando el usuario confirma que guardó los códigos. */
  @Output() terminado = new EventEmitter<void>();
  /** Se emite en cuanto el backend activa (ya hay sesión nueva). */
  @Output() activado = new EventEmitter<void>();

  etapas = ['Tu contraseña', 'Vincular la aplicación', 'Guardar códigos'];
  paso = signal<1 | 2 | 3>(1);
  cargando = signal(false);
  error = signal<string | null>(null);
  qr = signal<SafeHtml>('');
  secreto = signal('');
  /** otpauth://… para abrir la aplicación de códigos en el mismo teléfono. */
  enlace = signal('');
  codigo = signal('');
  password = signal('');
  codigos = signal<string[]>([]);

  async empezar() {
    if (!this.password()) return;
    this.cargando.set(true); this.error.set(null);
    try {
      const r = await lastValueFrom(this.svc.iniciar(this.password()));
      this.password.set('');
      // SVG generado por el propio backend (reportlab), no por el usuario.
      const qrOk = typeof r.qr_svg === 'string' && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(r.qr_svg)
        && !/<script|<foreignObject|\son\w+\s*=|javascript:/i.test(r.qr_svg);
      this.qr.set(this.sanitizer.bypassSecurityTrustHtml(qrOk ? r.qr_svg : ''));
      this.secreto.set(r.secreto);
      // Solo se acepta el esquema otpauth: nunca otro enlace.
      this.enlace.set(typeof r.uri === 'string' && /^otpauth:\/\/totp\//i.test(r.uri) ? r.uri : '');
      this.paso.set(2);
    } catch (e: any) {
      this.error.set(e?.error?.detail ?? 'No se pudo empezar. Inténtalo otra vez.');
    } finally {
      this.cargando.set(false);
    }
  }

  async activar() {
    if (this.codigo().trim().length !== 6) return;
    this.cargando.set(true); this.error.set(null);
    try {
      const r = await lastValueFrom(this.svc.activar(this.codigo().trim()));
      this.codigos.set(r.codigos_recuperacion);
      this.paso.set(3);
      this.activado.emit();
    } catch (e: any) {
      this.codigo.set('');
      this.error.set(e?.error?.detail ?? 'El código no es correcto.');
    } finally {
      this.cargando.set(false);
    }
  }

  descargarCodigos() {
    const texto = [
      'Códigos de recuperación - verificación en dos pasos',
      `Generados: ${new Date().toLocaleString('es-CO')}`,
      'Cada código sirve una sola vez.',
      '',
      ...this.codigos(),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigos-recuperacion.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
}

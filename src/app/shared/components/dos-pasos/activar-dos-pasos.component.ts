import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { lastValueFrom } from 'rxjs';
import { DosPasosService } from '../../../core/auth/dos-pasos.service';

/**
 * Pasos para activar la verificación en dos pasos:
 *   1. Explicación + "Empezar".
 *   2. QR (o clave para escribir a mano) + código de 6 números.
 *   3. Códigos de recuperación, una sola vez, para descargar o imprimir.
 * Lo usan el aviso obligatorio para administradores y el Perfil.
 */
@Component({
  standalone: true,
  selector: 'app-activar-dos-pasos',
  imports: [CommonModule],
  template: `
    <!-- Indicador de progreso -->
    <ol class="progreso" aria-label="Progreso">
      <li *ngFor="let t of etapas; let i = index" [class.hecho]="paso() > i + 1" [class.actual]="paso() === i + 1"
        [attr.aria-current]="paso() === i + 1 ? 'step' : null">
        <span class="bola">
          <svg *ngIf="paso() > i + 1" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>
          <ng-container *ngIf="paso() <= i + 1">{{ i + 1 }}</ng-container>
        </span>
        <span class="rotulo">{{ t }}</span>
      </li>
    </ol>

    <!-- Paso 1 -->
    <div *ngIf="paso() === 1" class="cuerpo">
      <h3 class="titulo">Antes de empezar, necesitas una aplicación en tu teléfono</h3>
      <p class="texto">
        Instala <b>Google Authenticator</b> o <b>Microsoft Authenticator</b> (son gratuitas). Genera el número de 6 cifras
        que te pediremos cada vez que entres.
      </p>
      <button type="button" (click)="empezar()" [disabled]="cargando()" class="btn-principal">
        {{ cargando() ? 'Preparando…' : 'Ya la tengo, empezar' }}
      </button>
    </div>

    <!-- Paso 2 -->
    <div *ngIf="paso() === 2" class="cuerpo">
      <h3 class="titulo">Escanea el código y escribe el número que veas</h3>
      <div class="flex flex-wrap items-start gap-6">
        <div class="qr" [innerHTML]="qr()"></div>
        <div class="flex-1 min-w-[15rem] space-y-5">
          <div>
            <p class="texto">Abre la aplicación, elige <b>añadir cuenta</b> y apunta la cámara al código.</p>
            <details class="mt-2">
              <summary class="enlace">¿No puedes escanearlo?</summary>
              <p class="texto mt-2">Escribe esta clave en la aplicación:</p>
              <p class="clave">{{ secreto() }}</p>
            </details>
          </div>
          <div>
            <label for="codigo-activar" class="etiqueta">Número de 6 cifras</label>
            <input id="codigo-activar" #c [value]="codigo()" (input)="codigo.set(c.value)" (keydown.enter)="activar()"
              inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="campo" placeholder="000000">
          </div>
          <button type="button" (click)="activar()" [disabled]="cargando() || codigo().trim().length !== 6" class="btn-principal">
            {{ cargando() ? 'Comprobando…' : 'Activar verificación' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Paso 3 -->
    <div *ngIf="paso() === 3" class="cuerpo">
      <h3 class="titulo">Listo. Ahora guarda tus códigos de recuperación</h3>
      <p class="aviso">
        Si pierdes el teléfono, cada código te deja entrar una vez. <b>No se volverán a mostrar</b>, guárdalos en un lugar seguro.
      </p>
      <ul class="codigos">
        <li *ngFor="let c of codigos()">{{ c }}</li>
      </ul>
      <div class="flex flex-wrap justify-end gap-3">
        <button type="button" (click)="descargarCodigos()" class="btn-secundario">Descargar códigos</button>
        <button type="button" (click)="terminado.emit()" class="btn-principal">Ya los guardé</button>
      </div>
    </div>

    <p *ngIf="error()" role="alert" class="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{{ error() }}</p>
  `,
  styles: [`
    :host { display: block; }
    .progreso { list-style: none; margin: 0 0 1.5rem; padding: 0; display: flex; align-items: center; gap: .5rem; }
    .progreso li { display: flex; align-items: center; gap: .5rem; color: rgb(100 116 139); font-size: .875rem; font-weight: 600; }
    .progreso li + li::before { content: ''; width: 1.5rem; height: 2px; border-radius: 2px; background: rgb(203 213 225); margin-right: .25rem; }
    .bola { width: 1.75rem; height: 1.75rem; border-radius: 9999px; display: grid; place-items: center; font-size: .8125rem; font-weight: 800;
      background: rgb(241 245 249); color: rgb(100 116 139); transition: background-color .2s, color .2s; }
    .actual { color: rgb(30 41 59); }
    .actual .bola { background: #6d28d9; color: #fff; }
    .hecho .bola { background: rgb(16 185 129 / .18); color: #047857; }
    .rotulo { display: none; }
    .actual .rotulo { display: inline; }
    @media (min-width: 640px) { .rotulo { display: inline; } }
    :host-context(.dark) .progreso li { color: rgb(148 163 184); }
    :host-context(.dark) .progreso li + li::before { background: rgb(71 85 105); }
    :host-context(.dark) .bola { background: rgb(30 41 59); color: rgb(148 163 184); }
    :host-context(.dark) .actual { color: #f1f5f9; }
    :host-context(.dark) .actual .bola { background: #7c3aed; color: #fff; }
    :host-context(.dark) .hecho .bola { background: rgb(16 185 129 / .2); color: #6ee7b7; }

    .cuerpo { animation: entra .22s cubic-bezier(.22,1,.36,1); }
    .titulo { font-size: 1.0625rem; font-weight: 700; line-height: 1.35; color: rgb(30 41 59); margin-bottom: .75rem; }
    :host-context(.dark) .titulo { color: #f1f5f9; }
    .texto { font-size: .9375rem; line-height: 1.55; color: rgb(71 85 105); max-width: 62ch; }
    :host-context(.dark) .texto { color: rgb(203 213 225); }
    .cuerpo > .texto { margin-bottom: 1.25rem; }
    .enlace { cursor: pointer; font-size: .875rem; font-weight: 700; color: #6d28d9; }
    :host-context(.dark) .enlace { color: #c4b5fd; }
    .mt-2 { margin-top: .5rem; }
    .clave { margin-top: .5rem; padding: .625rem .875rem; border-radius: .625rem; background: rgb(241 245 249); user-select: all; word-break: break-all;
      font-family: ui-monospace, monospace; font-size: .875rem; font-weight: 700; color: rgb(30 41 59); }
    :host-context(.dark) .clave { background: rgb(30 41 59); color: #f1f5f9; }

    .qr { flex-shrink: 0; padding: .75rem; background: #fff; border-radius: 1rem; border: 1px solid rgb(226 232 240); }
    .qr ::ng-deep svg { display: block; width: 10.5rem; height: 10.5rem; }

    .etiqueta { display: block; margin-bottom: .375rem; font-size: .875rem; font-weight: 700; color: rgb(51 65 85); }
    :host-context(.dark) .etiqueta { color: #e2e8f0; }
    .campo { width: 100%; height: 3.25rem; border-radius: .75rem; border: 1px solid rgb(203 213 225); background: rgb(248 250 252); color: rgb(15 23 42);
      text-align: center; font-family: ui-monospace, monospace; font-size: 1.5rem; letter-spacing: .4em; padding: 0 .75rem;
      transition: border-color .15s, box-shadow .15s; }
    .campo:focus { outline: none; border-color: #6d28d9; box-shadow: 0 0 0 3px rgb(109 40 217 / .2); }
    :host-context(.dark) .campo { border-color: rgb(71 85 105); background: rgb(30 41 59); color: #fff; }

    .aviso { margin-bottom: 1rem; padding: .75rem 1rem; border-radius: .75rem; font-size: .9375rem; line-height: 1.5;
      background: rgb(245 158 11 / .12); color: #92400e; }
    :host-context(.dark) .aviso { color: #fcd34d; }
    .codigos { list-style: none; margin: 0 0 1.25rem; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem;
      font-family: ui-monospace, monospace; font-size: .9375rem; font-weight: 700; color: rgb(30 41 59); }
    @media (min-width: 640px) { .codigos { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    .codigos li { padding: .625rem .5rem; border-radius: .625rem; text-align: center; background: rgb(241 245 249); user-select: all; }
    :host-context(.dark) .codigos { color: #f1f5f9; }
    :host-context(.dark) .codigos li { background: rgb(30 41 59); }

    .btn-principal, .btn-secundario { min-height: 3rem; padding: 0 1.5rem; border-radius: .75rem; font-weight: 700; font-size: .9375rem;
      transition: background-color .15s, transform .12s cubic-bezier(.22,1,.36,1); }
    .btn-principal:active, .btn-secundario:active { transform: scale(.97); }
    .cuerpo > .btn-principal, .space-y-5 > .btn-principal { width: 100%; }
    .btn-principal { background: #6d28d9; color: #fff; }
    .btn-principal:hover:not(:disabled) { background: #5b21b6; }
    .btn-principal:disabled { opacity: .5; cursor: not-allowed; }
    .btn-secundario { border: 1px solid rgb(203 213 225); color: rgb(51 65 85); }
    .btn-secundario:hover { background: rgb(241 245 249); }
    :host-context(.dark) .btn-secundario { border-color: rgb(71 85 105); color: #e2e8f0; }
    :host-context(.dark) .btn-secundario:hover { background: rgb(30 41 59); }
    .btn-principal:focus-visible, .btn-secundario:focus-visible { outline: 2px solid #6d28d9; outline-offset: 2px; }

    @keyframes entra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .cuerpo { animation: none; } .bola, .btn-principal, .btn-secundario { transition: none; } }
  `],
})
export class ActivarDosPasosComponent {
  private svc = inject(DosPasosService);
  private sanitizer = inject(DomSanitizer);

  /** Se emite cuando el usuario confirma que guardó los códigos. */
  @Output() terminado = new EventEmitter<void>();
  /** Se emite en cuanto el backend activa (ya hay sesión nueva). */
  @Output() activado = new EventEmitter<void>();

  etapas = ['Aplicación', 'Escanear', 'Guardar códigos'];
  paso = signal<1 | 2 | 3>(1);
  cargando = signal(false);
  error = signal<string | null>(null);
  qr = signal<SafeHtml>('');
  secreto = signal('');
  codigo = signal('');
  codigos = signal<string[]>([]);

  async empezar() {
    this.cargando.set(true); this.error.set(null);
    try {
      const r = await lastValueFrom(this.svc.iniciar());
      // SVG generado por el propio backend (reportlab), no por el usuario.
      this.qr.set(this.sanitizer.bypassSecurityTrustHtml(r.qr_svg));
      this.secreto.set(r.secreto);
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

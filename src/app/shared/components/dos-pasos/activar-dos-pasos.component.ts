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
    <!-- Paso 1 -->
    <div *ngIf="paso() === 1" class="space-y-4">
      <ol class="space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <li class="flex gap-3"><span class="paso-num">1</span>
          <span>Instala en tu teléfono una aplicación de verificación, por ejemplo <b>Google Authenticator</b> o <b>Microsoft Authenticator</b> (son gratuitas).</span></li>
        <li class="flex gap-3"><span class="paso-num">2</span>
          <span>Pulsa <b>Empezar</b> y escanea con esa aplicación el código que aparecerá.</span></li>
        <li class="flex gap-3"><span class="paso-num">3</span>
          <span>Escribe el número de 6 cifras que te muestre la aplicación.</span></li>
      </ol>
      <button type="button" (click)="empezar()" [disabled]="cargando()" class="btn-principal">
        {{ cargando() ? 'Preparando…' : 'Empezar' }}
      </button>
    </div>

    <!-- Paso 2 -->
    <div *ngIf="paso() === 2" class="space-y-4">
      <div class="flex flex-col sm:flex-row items-center gap-4">
        <div class="shrink-0 p-3 bg-white rounded-2xl border border-slate-200 [&_svg]:w-44 [&_svg]:h-44" [innerHTML]="qr()"></div>
        <div class="text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <p>Escanea este código con la aplicación de verificación.</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">¿No puedes escanearlo? Escribe esta clave en la aplicación:</p>
          <p class="font-mono text-sm font-bold text-slate-800 dark:text-slate-100 break-all select-all bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">{{ secreto() }}</p>
        </div>
      </div>
      <div class="space-y-1.5">
        <label for="codigo-activar" class="block text-sm font-bold text-slate-700 dark:text-slate-200">Código de 6 números</label>
        <input id="codigo-activar" #c [value]="codigo()" (input)="codigo.set(c.value)" (keydown.enter)="activar()"
          inputmode="numeric" maxlength="6" autocomplete="one-time-code"
          class="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-mono text-xl tracking-[0.4em] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple"
          placeholder="000000">
      </div>
      <button type="button" (click)="activar()" [disabled]="cargando() || codigo().trim().length !== 6" class="btn-principal">
        {{ cargando() ? 'Comprobando…' : 'Activar' }}
      </button>
    </div>

    <!-- Paso 3 -->
    <div *ngIf="paso() === 3" class="space-y-4">
      <div class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        La verificación en dos pasos quedó activada.
      </div>
      <div class="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
        <b>Guarda estos códigos en un lugar seguro.</b> Si pierdes el teléfono, cada uno te deja entrar una vez.
        No se volverán a mostrar.
      </div>
      <ul class="grid grid-cols-2 gap-2 font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
        <li *ngFor="let c of codigos()" class="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-center select-all">{{ c }}</li>
      </ul>
      <div class="flex flex-col sm:flex-row gap-2">
        <button type="button" (click)="descargarCodigos()" class="btn-secundario">Descargar códigos</button>
        <button type="button" (click)="terminado.emit()" class="btn-principal">Ya los guardé</button>
      </div>
    </div>

    <p *ngIf="error()" role="alert" class="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{{ error() }}</p>
  `,
  styles: [`
    .paso-num { flex-shrink: 0; width: 1.75rem; height: 1.75rem; border-radius: 9999px; display: grid; place-items: center;
      font-weight: 800; font-size: .8125rem; background: rgb(109 40 217 / .1); color: #6d28d9; }
    :host-context(.dark) .paso-num { background: rgb(109 40 217 / .3); color: #ddd6fe; }
    .btn-principal { width: 100%; min-height: 3rem; border-radius: .875rem; background: #6d28d9; color: #fff; font-weight: 700; font-size: .9375rem;
      transition: background-color .15s; }
    .btn-principal:hover:not(:disabled) { background: #5b21b6; }
    .btn-principal:disabled { opacity: .5; cursor: not-allowed; }
    .btn-secundario { width: 100%; min-height: 3rem; border-radius: .875rem; border: 1px solid rgb(203 213 225); font-weight: 700; font-size: .9375rem; }
    :host-context(.dark) .btn-secundario { border-color: rgb(51 65 85); color: #e2e8f0; }
  `],
})
export class ActivarDosPasosComponent {
  private svc = inject(DosPasosService);
  private sanitizer = inject(DomSanitizer);

  /** Se emite cuando el usuario confirma que guardó los códigos. */
  @Output() terminado = new EventEmitter<void>();
  /** Se emite en cuanto el backend activa (ya hay sesión nueva). */
  @Output() activado = new EventEmitter<void>();

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

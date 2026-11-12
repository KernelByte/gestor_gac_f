import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { DosPasosService, EstadoDosPasos } from '../../core/auth/dos-pasos.service';
import { AuthService } from '../../core/auth/auth.service';
import { ActivarDosPasosComponent } from '../../shared/components/dos-pasos/activar-dos-pasos.component';
import { ModalComponent } from '../../shared/components';
import { PanelComponent } from '../home/components/panel.component';
import { ConfirmService } from '../../shared/components/confirm-dialog/confirm.service';
import { ToastService } from '../../shared/components/toast/toast.service';

type Modo = 'ver' | 'activar' | 'codigos' | 'desactivar';

/**
 * Verificación en dos pasos del propio usuario. Va dentro de un panel del Perfil
 * (que pone título e icono) y se queda corto a propósito: el estado y, debajo,
 * lo que se puede hacer. Todo lo que pide escribir algo (activar, nuevos
 * códigos, desactivar) se abre en una hoja que se adapta a la pantalla.
 */
@Component({
  standalone: true,
  selector: 'app-perfil-dos-pasos',
  imports: [CommonModule, DatePipe, ActivarDosPasosComponent, ModalComponent, PanelComponent],
  template: `
    <app-panel titulo="Verificación en dos pasos" icono="escudo" color="verde"
               subtitulo="Además de la contraseña, un código de tu teléfono.">
    <div class="cuerpo-2fa">
    <div *ngIf="!estado() && !errorCarga()" class="flex flex-col gap-3" aria-busy="true">
      <div class="skeleton h-6 w-32 rounded-full"></div>
      <div class="skeleton h-12 rounded-xl"></div>
    </div>

    <div *ngIf="errorCarga()" role="alert" class="flex flex-wrap items-center gap-3">
      <p class="text-sm font-semibold text-red-600 dark:text-red-400">{{ errorCarga() }}</p>
      <button type="button" class="btn-secondary btn-sm" (click)="cargar()">Reintentar</button>
    </div>

    <div *ngIf="estado() as e" class="flex flex-col gap-3">

      <!-- Estado: una línea -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="estado" [class.estado-on]="e.activo">
          <span class="punto" aria-hidden="true"></span>
          {{ e.activo ? 'Activada' : 'No activada' }}
        </span>
        <span *ngIf="e.activo && e.activado_en" class="nota">desde el {{ e.activado_en | date:'d MMM yyyy':'':'es' }}</span>
        <span *ngIf="e.activo && e.obligatorio" class="nota">· obligatoria para administradores</span>
      </div>

      <!-- Sin activar: un motivo y un botón -->
      <ng-container *ngIf="!e.activo">
        <p class="nota max-w-prose">Sin este paso, cualquiera que conozca tu contraseña puede entrar a tu cuenta. Toma 2 minutos.</p>
        <button type="button" class="btn-primary btn-lg sm:self-start" (click)="abrir('activar')">Activar verificación</button>
      </ng-container>

      <!-- Activada: acciones en filas -->
      <ul *ngIf="e.activo" class="filas">
        <li class="fila">
          <div class="min-w-0">
            <p class="fila-titulo">Códigos de recuperación</p>
            <p class="fila-desc" [class.fila-alerta]="e.codigos_restantes <= 2">{{ textoCodigos(e.codigos_restantes) }}</p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="abrir('codigos')">Generar nuevos</button>
        </li>
        <li class="fila" *ngIf="e.puede_recordar">
          <div class="min-w-0">
            <p class="fila-titulo">Dispositivos de confianza</p>
            <p class="fila-desc">{{ textoConfianza(e.dispositivos_confianza ?? 0) }}</p>
          </div>
          <button type="button" class="btn-secondary btn-sm" [disabled]="!e.dispositivos_confianza || trabajando()"
            (click)="quitarConfianza()">Quitar todos</button>
        </li>
        <li class="fila" *ngIf="!e.obligatorio">
          <div class="min-w-0">
            <p class="fila-titulo">Desactivar</p>
            <p class="fila-desc">Volverás a entrar solo con tu contraseña.</p>
          </div>
          <button type="button" class="btn-ghost-danger btn-sm" (click)="abrir('desactivar')">Desactivar</button>
        </li>
      </ul>

      <p *ngIf="error() && modo() === 'ver'" role="alert" class="text-sm font-semibold text-red-600 dark:text-red-400">{{ error() }}</p>
    </div>

    </div>
    </app-panel>

    <!-- Hoja: activar, nuevos códigos o desactivar. Va FUERA del panel: el panel
         contiene a los elementos fixed y recortaría la hoja. No se puede cerrar con códigos sin guardar. -->
    <app-modal style="display: contents" [open]="modo() !== 'ver'" variant="sheet" size="md" [title]="tituloHoja()"
               [dismissible]="!codigosSinGuardar()" [closeOnBackdrop]="false"
               (openChange)="$event || cancelar()">
      <ng-container *ngIf="modo() !== 'ver'">

        <app-activar-dos-pasos *ngIf="modo() === 'activar'"
          (activado)="activadoSinGuardar.set(true)" (terminado)="alTerminar()"></app-activar-dos-pasos>

        <!-- Nuevos códigos -->
        <div *ngIf="modo() === 'codigos'" class="hoja">
          <ng-container *ngIf="!codigosNuevos().length">
            <p class="nota">Los códigos anteriores dejarán de servir. Confirma con el número que muestra tu aplicación.</p>
            <div>
              <label for="pd-codigo" class="etiqueta">Número de 6 cifras</label>
              <input #c1 id="pd-codigo" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"
                class="campo" (keydown.enter)="regenerar(c1.value)">
            </div>
            <button type="button" class="btn-primary btn-lg w-full" [disabled]="trabajando()" (click)="regenerar(c1.value)">
              <span *ngIf="trabajando()" class="spinner-sm"></span>
              {{ trabajando() ? 'Generando…' : 'Generar códigos' }}
            </button>
          </ng-container>
          <ng-container *ngIf="codigosNuevos().length">
            <p class="aviso">Guárdalos ahora en un lugar seguro: <b>no se volverán a mostrar.</b></p>
            <ul class="codigos">
              <li *ngFor="let c of codigosNuevos()">{{ c }}</li>
            </ul>
            <button type="button" class="btn-secondary btn-lg w-full" (click)="descargar()">Descargar códigos</button>
            <button type="button" class="btn-primary btn-lg w-full" (click)="cerrarCodigos()">Ya los guardé</button>
          </ng-container>
        </div>

        <!-- Desactivar -->
        <div *ngIf="modo() === 'desactivar'" class="hoja">
          <p class="nota">Tu cuenta quedará menos protegida. Para confirmar que eres tú, escribe tu contraseña y un código de la aplicación.</p>
          <div>
            <label for="pd-pass" class="etiqueta">Contraseña</label>
            <input #pw id="pd-pass" type="password" class="form-control" autocomplete="current-password">
          </div>
          <div>
            <label for="pd-cod2" class="etiqueta">Número de 6 cifras</label>
            <input #c2 id="pd-cod2" inputmode="numeric" maxlength="11" placeholder="000000" class="campo"
              (keydown.enter)="desactivar(pw.value, c2.value)">
          </div>
          <button type="button" class="btn-danger btn-lg w-full" [disabled]="trabajando()" (click)="desactivar(pw.value, c2.value)">
            <span *ngIf="trabajando()" class="spinner-sm"></span>
            {{ trabajando() ? 'Desactivando…' : 'Desactivar verificación' }}
          </button>
          <button type="button" class="btn-ghost btn-lg w-full" (click)="cancelar()">Cancelar</button>
        </div>

        <p *ngIf="error()" role="alert" class="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{{ error() }}</p>
      </ng-container>
    </app-modal>
  `,
  styles: [`
    /* El host no pinta nada: su panel es la celda de la cuadrícula del Perfil. Si algo
       no cabe en el panel, se desplaza solo este contenido. */
    :host { display: contents; }
    .cuerpo-2fa { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
    app-panel { animation: entra-2fa 380ms cubic-bezier(0.22, 1, 0.36, 1) 240ms backwards; }
    @keyframes entra-2fa { from { opacity: 0; transform: translateY(10px); } }
    @media (prefers-reduced-motion: reduce) { app-panel { animation: none; } }
    .nota { font-size: .875rem; line-height: 1.5; color: var(--dash-texto-suave); }

    /* Estado con los tokens del dashboard; además del color lleva texto y punto. */
    .estado { display: inline-flex; align-items: center; gap: .375rem; padding: .125rem .625rem; border-radius: 9999px;
      font-size: .75rem; font-weight: 600; line-height: 1.25rem; background: var(--estado-aviso-bg); color: var(--estado-aviso-fg); }
    .estado-on { background: var(--estado-ok-bg); color: var(--estado-ok-fg); }
    .punto { width: .4375rem; height: .4375rem; border-radius: 9999px; background: currentColor; }

    .filas { list-style: none; margin: 0; padding: 0; }
    .fila { display: flex; align-items: center; justify-content: space-between; gap: .75rem 1rem; padding: .625rem 0; }
    .fila + .fila { border-top: 1px solid var(--dash-borde); }
    .fila-titulo { font-size: .875rem; font-weight: 600; color: var(--dash-tesela-fg); }
    .fila-desc { margin-top: .0625rem; font-size: .8125rem; line-height: 1.35; color: var(--dash-texto-suave); }
    .fila-alerta { color: var(--estado-aviso-fg); font-weight: 600; }
    .fila .btn-secondary, .fila .btn-ghost-danger { flex-shrink: 0; }

    /* Dentro de la hoja */
    .hoja { display: flex; flex-direction: column; gap: 1rem; }
    .etiqueta { display: block; margin-bottom: .375rem; font-size: .875rem; font-weight: 600; color: var(--dash-tesela-fg); }
    .campo { width: 100%; height: 3.25rem; border-radius: .75rem; border: 1px solid var(--dash-borde); background: var(--dash-hover); color: var(--dash-tesela-fg);
      text-align: center; font-family: ui-monospace, monospace; font-size: 1.5rem; letter-spacing: .4em; padding: 0 .75rem;
      transition: border-color .15s, box-shadow .15s; }
    .campo:focus { outline: none; border-color: var(--accent-focus); box-shadow: 0 0 0 3px var(--accent-ring); }
    .aviso { padding: .75rem 1rem; border-radius: .75rem; font-size: .875rem; line-height: 1.5;
      background: var(--estado-aviso-bg); color: var(--estado-aviso-fg); }
    .codigos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem;
      font-family: ui-monospace, monospace; font-size: .9375rem; font-weight: 700; color: var(--dash-tesela-fg); }
    .codigos li { padding: .625rem .5rem; border-radius: .625rem; text-align: center; background: var(--dash-tesela); user-select: all; }
  `],
})
export class PerfilDosPasosComponent implements OnInit {
  private svc = inject(DosPasosService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  estado = signal<EstadoDosPasos | null>(null);
  modo = signal<Modo>('ver');
  error = signal<string | null>(null);
  errorCarga = signal<string | null>(null);
  trabajando = signal(false);
  codigosNuevos = signal<string[]>([]);
  /** Ya se activó pero el usuario aún no confirmó haber guardado los códigos. */
  activadoSinGuardar = signal(false);

  /** Con códigos a la vista la hoja no se cierra sola: no se vuelven a mostrar. */
  codigosSinGuardar = computed(() => this.activadoSinGuardar() || this.codigosNuevos().length > 0);

  tituloHoja = computed(() => {
    switch (this.modo()) {
      case 'activar': return 'Activar verificación en dos pasos';
      case 'codigos': return this.codigosNuevos().length ? 'Tus nuevos códigos' : 'Generar nuevos códigos';
      case 'desactivar': return 'Desactivar la verificación';
      default: return '';
    }
  });

  ngOnInit() { this.cargar(); }

  cargar() {
    this.errorCarga.set(null);
    this.svc.estado().subscribe({
      next: e => { this.estado.set(e); this.errorCarga.set(null); },
      error: () => this.errorCarga.set('No se pudo cargar el estado de la verificación.'),
    });
  }

  textoCodigos(n: number) {
    if (n <= 0) return 'No te quedan códigos. Genera nuevos.';
    return n === 1 ? 'Te queda 1 código sin usar.' : `Te quedan ${n} códigos sin usar.`;
  }

  textoConfianza(n: number) {
    if (n <= 0) return 'Ninguno. Al entrar puedes marcar «Confiar en este dispositivo».';
    return n === 1 ? 'En 1 dispositivo no se pide el código.' : `En ${n} dispositivos no se pide el código.`;
  }

  async quitarConfianza() {
    const ok = await this.confirm.ask({
      title: '¿Quitar todos los dispositivos de confianza?',
      message: 'La próxima vez que entres desde cualquiera de ellos se te pedirá el código. Hazlo si perdiste un equipo o un teléfono.',
      confirmLabel: 'Quitar todos',
      severity: 'warning',
    });
    if (!ok) return;
    this.trabajando.set(true); this.error.set(null);
    try {
      await lastValueFrom(this.svc.quitarDispositivosConfianza());
      this.toast.success('Dispositivos de confianza quitados');
      this.cargar();
    } catch (e: any) {
      this.error.set(e?.error?.detail ?? 'No se pudieron quitar.');
    } finally { this.trabajando.set(false); }
  }

  abrir(m: Exclude<Modo, 'ver'>) { this.error.set(null); this.modo.set(m); }
  cancelar() { this.error.set(null); this.modo.set('ver'); }

  async alTerminar() {
    this.activadoSinGuardar.set(false);
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

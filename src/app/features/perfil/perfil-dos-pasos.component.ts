import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { DosPasosService, EstadoDosPasos } from '../../core/auth/dos-pasos.service';
import { AuthService } from '../../core/auth/auth.service';
import { ActivarDosPasosComponent } from '../../shared/components/dos-pasos/activar-dos-pasos.component';

/** Verificación en dos pasos del propio usuario, dentro de la tarjeta Seguridad del Perfil. */
@Component({
  standalone: true,
  selector: 'app-perfil-dos-pasos',
  imports: [CommonModule, DatePipe, ActivarDosPasosComponent],
  template: `
    <div>
      <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Verificación en dos pasos</p>

      <div *ngIf="!estado()" class="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>

      <ng-container *ngIf="estado() as e">
        <div class="flex items-center justify-between gap-3 p-3 rounded-xl border"
          [ngClass]="e.activo ? 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/40' : 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/40'">
          <div class="min-w-0">
            <p class="text-sm font-bold" [ngClass]="e.activo ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'">
              {{ e.activo ? 'Activada' : 'No activada' }}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <ng-container *ngIf="e.activo">Desde {{ e.activado_en | date:'d MMM yyyy':'':'es' }} · {{ e.codigos_restantes }} códigos de recuperación sin usar</ng-container>
              <ng-container *ngIf="!e.activo">Al entrar se pedirá también un código de tu teléfono.</ng-container>
            </p>
          </div>
          <button *ngIf="!e.activo && modo() === 'ver'" type="button" (click)="modo.set('activar')"
            class="shrink-0 min-h-[2.5rem] px-4 rounded-xl bg-brand-purple text-white text-sm font-bold hover:bg-purple-700 transition-colors">
            Activar
          </button>
        </div>

        <div *ngIf="modo() === 'activar'" class="mt-4">
          <app-activar-dos-pasos (terminado)="alTerminar()"></app-activar-dos-pasos>
          <button type="button" (click)="modo.set('ver')" class="mt-2 w-full text-sm font-semibold text-slate-500 py-2">Cancelar</button>
        </div>

        <div *ngIf="e.activo && modo() === 'ver'" class="mt-3 flex flex-wrap gap-2">
          <button type="button" (click)="modo.set('codigos')" class="btn-sec">Nuevos códigos de recuperación</button>
          <button *ngIf="!e.obligatorio" type="button" (click)="modo.set('desactivar')" class="btn-sec !text-red-600 dark:!text-red-400">Desactivar</button>
        </div>
        <p *ngIf="e.activo && e.obligatorio && modo() === 'ver'" class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Para administradores es obligatoria y no se puede desactivar.
        </p>

        <!-- Nuevos códigos -->
        <div *ngIf="modo() === 'codigos'" class="mt-4 space-y-3">
          <ng-container *ngIf="!codigosNuevos().length">
            <p class="text-sm text-slate-600 dark:text-slate-300">Escribe el código de tu aplicación. Los códigos anteriores dejarán de servir.</p>
            <input #c1 inputmode="numeric" maxlength="6" placeholder="000000" class="campo" aria-label="Código de 6 números">
            <div class="flex gap-2">
              <button type="button" class="btn-sec" (click)="modo.set('ver')">Cancelar</button>
              <button type="button" class="btn-pri" [disabled]="trabajando()" (click)="regenerar(c1.value)">Generar</button>
            </div>
          </ng-container>
          <ng-container *ngIf="codigosNuevos().length">
            <p class="text-sm font-semibold text-amber-700 dark:text-amber-300">Guárdalos ahora: no se volverán a mostrar.</p>
            <ul class="grid grid-cols-2 gap-2 font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
              <li *ngFor="let c of codigosNuevos()" class="bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-center select-all">{{ c }}</li>
            </ul>
            <button type="button" class="btn-pri" (click)="codigosNuevos.set([]); modo.set('ver'); cargar()">Ya los guardé</button>
          </ng-container>
        </div>

        <!-- Desactivar -->
        <div *ngIf="modo() === 'desactivar'" class="mt-4 space-y-3">
          <p class="text-sm text-slate-600 dark:text-slate-300">Para desactivarla escribe tu contraseña y un código de la aplicación.</p>
          <input #pw type="password" placeholder="Contraseña" class="campo !tracking-normal !text-left" aria-label="Contraseña" autocomplete="current-password">
          <input #c2 inputmode="numeric" maxlength="11" placeholder="000000" class="campo" aria-label="Código">
          <div class="flex gap-2">
            <button type="button" class="btn-sec" (click)="modo.set('ver')">Cancelar</button>
            <button type="button" class="btn-pri !bg-red-600" [disabled]="trabajando()" (click)="desactivar(pw.value, c2.value)">Desactivar</button>
          </div>
        </div>

        <p *ngIf="error()" role="alert" class="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">{{ error() }}</p>
      </ng-container>
    </div>
  `,
  styles: [`
    .btn-sec { min-height: 2.5rem; padding: 0 .875rem; border-radius: .75rem; border: 1px solid rgb(226 232 240); font-size: .8125rem; font-weight: 700; color: rgb(51 65 85); background: #fff; }
    :host-context(.dark) .btn-sec { border-color: rgb(51 65 85); color: #e2e8f0; background: transparent; }
    .btn-pri { flex: 1; min-height: 2.75rem; border-radius: .75rem; background: #6d28d9; color: #fff; font-size: .875rem; font-weight: 700; }
    .btn-pri:disabled { opacity: .5; }
    .campo { width: 100%; height: 2.75rem; border-radius: .75rem; border: 1px solid rgb(226 232 240); background: rgb(248 250 252);
      text-align: center; font-family: ui-monospace, monospace; font-size: 1.125rem; letter-spacing: .3em; padding: 0 .75rem; }
    :host-context(.dark) .campo { border-color: rgb(51 65 85); background: rgb(30 41 59); color: #fff; }
  `],
})
export class PerfilDosPasosComponent implements OnInit {
  private svc = inject(DosPasosService);
  private auth = inject(AuthService);

  estado = signal<EstadoDosPasos | null>(null);
  modo = signal<'ver' | 'activar' | 'codigos' | 'desactivar'>('ver');
  error = signal<string | null>(null);
  trabajando = signal(false);
  codigosNuevos = signal<string[]>([]);

  ngOnInit() { this.cargar(); }

  cargar() {
    this.svc.estado().subscribe({ next: e => this.estado.set(e), error: () => this.error.set('No se pudo cargar el estado.') });
  }

  async alTerminar() {
    this.modo.set('ver');
    this.cargar();
    try { await lastValueFrom(this.auth.me()); } catch { }
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

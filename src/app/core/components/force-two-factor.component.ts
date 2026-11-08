import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ModalComponent } from '../../shared/components';
import { ActivarDosPasosComponent } from '../../shared/components/dos-pasos/activar-dos-pasos.component';

/**
 * Aviso a pantalla completa para administradores sin verificación en dos
 * pasos mientras sea obligatoria. Igual que el cambio de contraseña
 * obligatorio: sin cerrar; el backend bloquea el resto de la API hasta activarla.
 */
@Component({
  standalone: true,
  selector: 'app-force-two-factor',
  imports: [CommonModule, ModalComponent, ActivarDosPasosComponent],
  template: `
    <app-modal [open]="true" size="md" [dismissible]="false" [closeOnBackdrop]="false" [padding]="false">
      <div aria-labelledby="titulo-2fa">
        <div class="px-6 sm:px-8 pt-7 pb-4 flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-brand-purple text-white flex items-center justify-center shrink-0">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>
            </svg>
          </div>
          <div>
            <span class="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-purple-200 mb-1.5">Acción requerida</span>
            <h2 id="titulo-2fa" class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Protege tu cuenta</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Los administradores deben activar la verificación en dos pasos: además de la contraseña,
              se pedirá un código de tu teléfono al entrar.
            </p>
          </div>
        </div>
        <div class="px-6 sm:px-8 pb-6">
          <app-activar-dos-pasos (terminado)="continuar()"></app-activar-dos-pasos>
          <button type="button" (click)="auth.logout()"
            class="mt-4 w-full text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 py-2">
            Cerrar sesión
          </button>
        </div>
      </div>
    </app-modal>
  `,
})
export class ForceTwoFactorComponent {
  auth = inject(AuthService);

  async continuar() {
    // /auth/me con la sesión nueva ya no trae mfa_pendiente: el aviso se cierra solo.
    try { await lastValueFrom(this.auth.me()); } catch { /* el interceptor maneja la sesión */ }
  }
}

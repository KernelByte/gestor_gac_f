import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { PasswordStrengthComponent } from '../../shared/components/password-strength/password-strength.component';
import { ModalComponent } from '../../shared/components';
import { lastValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-force-password-change',
  imports: [CommonModule, ReactiveFormsModule, PasswordStrengthComponent, ModalComponent],
  template: `
    <!-- Full-screen overlay — no backdrop click, no close button -->
    <app-modal [open]="true" size="md" [dismissible]="false" [closeOnBackdrop]="false" [padding]="false">
      <div class="relative overflow-hidden">

        <!-- Gradient Header -->
        <div class="relative overflow-hidden">
          <div class="absolute inset-0 bg-amber-50 dark:bg-amber-900/20"></div>
          <div class="relative px-8 pt-8 pb-6 flex items-start gap-4">
            <!-- Icon -->
            <div class="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <span class="inline-block px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 mb-1.5">
                Acción Requerida
              </span>
              <h2 class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Cambiar contraseña</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">El administrador requiere que establezcas una nueva contraseña para continuar.</p>
            </div>
          </div>
        </div>

        <!-- Form Body -->
        <div class="px-8 py-6">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">

            <!-- Nueva contraseña -->
            <div class="space-y-1">
              <label class="form-label">
                Nueva contraseña <span class="text-red-500">*</span>
              </label>
              <div class="relative group">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg class="h-4 w-4 text-slate-400 group-focus-within:text-brand-purple transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </div>
                <input [type]="showPassword() ? 'text' : 'password'" formControlName="nueva_contrasena"
                  class="form-control pl-9 pr-10"
                  [class.border-red-300]="form.get('nueva_contrasena')?.invalid && form.get('nueva_contrasena')?.touched"
                  placeholder="Mínimo 7 caracteres">
                <button type="button" (click)="showPassword.set(!showPassword())"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <svg *ngIf="!showPassword()" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                  <svg *ngIf="showPassword()" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              <p *ngIf="form.get('nueva_contrasena')?.errors?.['minlength'] && form.get('nueva_contrasena')?.touched"
                class="text-xs text-red-500 ml-1 font-bold">Mínimo 7 caracteres</p>
              <app-password-strength [password]="form.get('nueva_contrasena')?.value || ''" />
            </div>

            <!-- Confirmar contraseña -->
            <div class="space-y-1">
              <label class="form-label">
                Confirmar contraseña <span class="text-red-500">*</span>
              </label>
              <div class="relative group">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg class="h-4 w-4 text-slate-400 group-focus-within:text-brand-purple transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </div>
                <input [type]="showPassword() ? 'text' : 'password'" formControlName="confirmar"
                  class="form-control pl-9 pr-3"
                  [class.border-red-300]="form.hasError('mismatch') && form.get('confirmar')?.touched"
                  placeholder="Repite tu nueva contraseña">
              </div>
              <p *ngIf="form.hasError('mismatch') && form.get('confirmar')?.touched"
                class="text-xs text-red-500 ml-1 font-bold">Las contraseñas no coinciden</p>
            </div>

            <!-- Error general -->
            <div *ngIf="errorMsg()" class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 px-4 py-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p class="text-xs font-bold text-red-600 dark:text-red-400">{{ errorMsg() }}</p>
            </div>

            <!-- Info tip -->
            <div class="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20 px-4 py-3 flex items-start gap-2">
              <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p class="text-xs text-amber-700 dark:text-amber-400">Elige una contraseña segura que recuerdes. Esta será tu contraseña de acceso a partir de ahora.</p>
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div class="px-8 pb-8">
          <button (click)="onSubmit()" [disabled]="form.invalid || saving()"
            class="btn-primary btn-lg w-full">
            <span *ngIf="saving()" class="spinner-sm text-white"></span>
            {{ saving() ? 'Guardando...' : 'Establecer nueva contraseña' }}
          </button>
        </div>

      </div>
    </app-modal>
  `
})
export class ForcePasswordChangeComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private authStore = inject(AuthStore);

  saving = signal(false);
  errorMsg = signal<string | null>(null);
  showPassword = signal(false);

  form = this.fb.group({
    nueva_contrasena: ['', [Validators.required, Validators.minLength(7)]],
    confirmar: ['', Validators.required]
  }, { validators: this.passwordMatchValidator });

  passwordMatchValidator(g: AbstractControl) {
    return g.get('nueva_contrasena')?.value === g.get('confirmar')?.value
      ? null : { mismatch: true };
  }

  async onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    this.errorMsg.set(null);

    try {
      const { nueva_contrasena } = this.form.getRawValue();
      await lastValueFrom(this.authService.cambiarContrasenaObligatoria(nueva_contrasena!));

      // Actualizar el store local para quitar el flag
      const user = this.authStore.user();
      if (user) {
        this.authStore.setUser({ ...user, debe_cambiar_contrasena: false });
      }
    } catch (err: any) {
      this.errorMsg.set(err?.error?.detail || 'Error al actualizar la contraseña. Intenta de nuevo.');
    } finally {
      this.saving.set(false);
    }
  }
}

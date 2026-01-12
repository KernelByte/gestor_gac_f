import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { lastValueFrom } from 'rxjs';

@Component({
   selector: 'app-forgot-password',
   standalone: true,
   imports: [CommonModule, ReactiveFormsModule, RouterLink],
   templateUrl: './forgot-password.page.html',
})
export class ForgotPasswordPage {
   private fb = inject(FormBuilder);
   private authService = inject(AuthService);

   form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      codigo_seguridad: ['', [Validators.required, Validators.minLength(4)]]
   });

   loading = signal(false);
   success = signal(false);
   error = signal<string | null>(null);

   async onSubmit() {
      if (this.form.invalid || this.loading()) return;

      this.loading.set(true);
      this.error.set(null);

      try {
         const { email, codigo_seguridad } = this.form.getRawValue();
         await lastValueFrom(this.authService.forgotPassword(email!, codigo_seguridad!));
         this.success.set(true);
      } catch (err: any) {
         console.error(err);
         if (err.status === 400 || err.status === 403 || err.status === 404) {
            this.error.set(err.error?.detail || 'Datos incorrectos o acceso denegado');
         } else {
            this.error.set('Error en el servidor. Intente más tarde.');
         }
      } finally {
         this.loading.set(false);
      }
   }
}

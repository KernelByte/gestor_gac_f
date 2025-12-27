import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { lastValueFrom } from 'rxjs';

@Component({
   selector: 'app-reset-password',
   standalone: true,
   imports: [CommonModule, ReactiveFormsModule, RouterLink],
   templateUrl: './reset-password.page.html',
})
export class ResetPasswordPage implements OnInit {
   private fb = inject(FormBuilder);
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private authService = inject(AuthService);

   token = '';

   form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
   });

   loading = signal(false);
   success = signal(false);
   error = signal<string | null>(null);
   showPassword = signal(false);

   ngOnInit() {
      this.token = this.route.snapshot.queryParamMap.get('token') || '';
      if (!this.token) {
         this.error.set('Token inválido o no proporcionado.');
      }
   }

   async onSubmit() {
      if (this.form.invalid || !this.token || this.loading()) return;

      const { password, confirmPassword } = this.form.getRawValue();

      if (password !== confirmPassword) {
         this.error.set('Las contraseñas no coinciden.');
         return;
      }

      this.loading.set(true);
      this.error.set(null);

      try {
         await lastValueFrom(this.authService.resetPassword(this.token, password!));
         this.success.set(true);
      } catch (err: any) {
         console.error(err);
         this.error.set(err.error?.detail || 'Error al restablecer contraseña.');
      } finally {
         this.loading.set(false);
      }
   }
}

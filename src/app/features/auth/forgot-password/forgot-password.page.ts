import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { lastValueFrom } from 'rxjs';
import { AuthPieComponent } from '../auth-pie.component';

/** Recuperar contraseña: mismo diseño que el login (estilos en ../acceso.scss). */
@Component({
   selector: 'app-forgot-password',
   standalone: true,
   imports: [ReactiveFormsModule, RouterLink, AuthPieComponent],
   templateUrl: './forgot-password.page.html',
   styleUrl: '../acceso.scss',
})
export class ForgotPasswordPage {
   private fb = inject(FormBuilder);
   private authService = inject(AuthService);
   private host = inject<ElementRef<HTMLElement>>(ElementRef);

   form = this.fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
      codigo_seguridad: ['', [Validators.required, Validators.minLength(4)]]
   });

   loading = signal(false);
   /** Al aparecer la confirmación, el foco va a su título: el lector de
       pantalla la anuncia y el foco no se pierde con el botón que desaparece. */
   @ViewChild('confirmacion') set confirmacion(el: ElementRef<HTMLElement> | undefined) {
      if (el) queueMicrotask(() => el.nativeElement.focus());
   }

   enviado = signal(false);
   correoEnviado = signal('');
   error = signal<string | null>(null);
   verCodigo = signal(false);
   sacudir = signal(false);

   campoInvalido(campo: 'email' | 'codigo_seguridad'): boolean {
      const c = this.form.controls[campo];
      return c.touched && c.invalid;
   }

   async onSubmit() {
      if (this.loading()) return;
      if (this.form.invalid) {
         // El botón no se deshabilita: al pulsarlo se marca lo que falta.
         this.form.markAllAsTouched();
         this.error.set(null);
         this.sacudirFormulario();
         // El foco va al primer campo con error: el lector de pantalla lo anuncia.
         queueMicrotask(() => this.host.nativeElement.querySelector<HTMLInputElement>('input.ng-invalid')?.focus());
         return;
      }

      this.loading.set(true);
      this.error.set(null);

      try {
         const { email, codigo_seguridad } = this.form.getRawValue();
         await lastValueFrom(this.authService.forgotPassword(email.trim(), codigo_seguridad));
         this.correoEnviado.set(email.trim());
         this.enviado.set(true);
      } catch (err: any) {
         if (err.status === 400 || err.status === 403 || err.status === 404) {
            this.error.set(err.error?.detail || 'El correo o el código no coinciden.');
         } else {
            this.error.set('No se pudo enviar. Inténtalo de nuevo en unos minutos.');
         }
         this.sacudirFormulario();
      } finally {
         this.loading.set(false);
      }
   }

   private sacudirFormulario(): void {
      if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.sacudir.set(false);
      requestAnimationFrame(() => {
         this.sacudir.set(true);
         setTimeout(() => this.sacudir.set(false), 450);
      });
   }
}

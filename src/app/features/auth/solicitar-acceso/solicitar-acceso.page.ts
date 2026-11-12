import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthPieComponent } from '../auth-pie.component';

type Campo = 'nombre' | 'email' | 'congregacion' | 'telefono';

/** Teléfono: se aceptan espacios, guiones y paréntesis al escribir; cuentan los dígitos. */
function telefonoValido(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '');
  if (!v) return null;
  if (!/^\+?[0-9\s()-]*$/.test(v)) return { formato: true };
  return v.replace(/\D/g, '').length >= 7 ? null : { corto: true };
}

/** Solicitar acceso: mismo diseño que el login (estilos en ../acceso.scss). */
@Component({
  selector: 'app-solicitar-acceso',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthPieComponent],
  templateUrl: './solicitar-acceso.page.html',
  styleUrl: '../acceso.scss',
})
export class SolicitarAccesoPage {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    congregacion: ['', [Validators.required, Validators.minLength(5)]],
    telefono: ['', [Validators.required, telefonoValido]],
    observaciones: ['']
  });

  loading = signal(false);
  /** Al aparecer la confirmación, el foco va a su título: el lector de
      pantalla la anuncia y el foco no se pierde con el botón que desaparece. */
  @ViewChild('confirmacion') set confirmacion(el: ElementRef<HTMLElement> | undefined) {
     if (el) queueMicrotask(() => el.nativeElement.focus());
  }

  success = signal(false);
  error = signal<string | null>(null);
  rateLimited = signal(false);
  sacudir = signal(false);
  correoEnviado = signal('');

  constructor() {
    // En cuanto el formulario queda completo, el aviso desaparece.
    this.form.statusChanges.subscribe(s => { if (s === 'VALID') this.faltan.set(false); });
  }

  /** Faltan datos tras pulsar «Enviar»: el aviso general ocupa el lugar del subtítulo. */
  faltan = signal(false);

  /** Aviso general: error del servidor, o el resumen cuando faltan datos.
      El detalle de cada campo va junto al campo. */
  aviso(): string | null {
    if (this.error()) return this.error();
    return this.faltan() ? 'Revisa los campos marcados en rojo.' : null;
  }

  /** Dice cómo corregir el campo, con la regla concreta. Vacío si está bien. */
  mensajeCampo(campo: Campo): string {
    const c = this.form.controls[campo];
    if (!c.touched || c.valid) return '';
    switch (campo) {
      case 'nombre': return 'Escribe tu nombre completo (al menos 3 letras).';
      case 'email': return 'Escribe un correo válido, por ejemplo nombre@ejemplo.com.';
      case 'congregacion': return 'Escribe el nombre de la congregación (al menos 5 letras).';
      case 'telefono': return c.hasError('formato')
        ? 'Usa solo números; se permiten espacios y guiones.'
        : 'Escribe el teléfono con al menos 7 números.';
    }
  }

  campoInvalido(campo: Campo): boolean {
    return this.mensajeCampo(campo) !== '';
  }

  /** Une el error propio del campo con el aviso del servidor para el lector de pantalla. */
  descripcion(campo: Campo): string | null {
    const ids = [this.campoInvalido(campo) ? `err-${campo}` : null, this.error() ? 'form-aviso' : null];
    return ids.filter(Boolean).join(' ') || null;
  }

  onSubmit() {
    if (this.loading()) return;
    if (this.form.invalid) {
      // El botón no se deshabilita: al pulsarlo se marca lo que falta y el foco
      // va al primer campo con error.
      this.form.markAllAsTouched();
      this.error.set(null);
      this.rateLimited.set(false);
      this.faltan.set(true);
      this.sacudirFormulario();
      const primero = (Object.keys(this.form.controls) as (keyof typeof this.form.controls)[])
        .find(k => this.form.controls[k].invalid);
      if (primero) queueMicrotask(() => document.getElementById(primero)?.focus());
      return;
    }
    this.faltan.set(false);

    this.loading.set(true);
    this.error.set(null);
    this.rateLimited.set(false);

    const v = this.form.getRawValue();
    // El teléfono se guarda solo con números (y el + inicial, si lo hay).
    const telefono = v.telefono.trim().replace(/(?!^\+)\D/g, '');

    this.http.post(`${environment.apiUrl}/auth/request-access`, { ...v, telefono })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.correoEnviado.set(this.form.controls.email.value.trim());
          this.success.set(true);
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 429) {
            this.rateLimited.set(true);
            this.error.set(err.error?.detail || 'Ya tienes una solicitud pendiente. Espera 24 horas antes de intentarlo de nuevo.');
          } else {
            this.error.set(err.error?.detail || 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
          }
          this.sacudirFormulario();
        }
      });
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

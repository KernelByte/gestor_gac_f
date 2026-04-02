import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-solicitar-acceso',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './solicitar-acceso.page.html',
  styles: []
})
export class SolicitarAccesoPage {
  form: FormGroup;
  loading = signal(false);
  success = signal(false);
  error = signal<string | null>(null);
  rateLimited = signal(false);

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      congregacion: ['', [Validators.required, Validators.minLength(5)]],
      telefono: ['', [Validators.required, Validators.pattern('^[0-9]*$'), Validators.minLength(7)]],
      observaciones: ['']
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);
    this.rateLimited.set(false);

    this.http.post(`${environment.apiUrl}/auth/request-access`, this.form.value)
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set(true);
          // Redirigir al login después de 5 segundos
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 5000);
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 429) {
            this.rateLimited.set(true);
            this.error.set(err.error?.detail || 'Ya tienes una solicitud pendiente. Por favor espera 24 horas antes de intentarlo de nuevo.');
          } else {
            this.error.set(err.error?.detail || 'Ocurrió un error al enviar la solicitud. Por favor intenta de nuevo.');
          }
        }
      });
  }
}


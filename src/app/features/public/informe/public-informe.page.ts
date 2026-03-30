import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PublicInformeService, PublicInformeInfo } from './public-informe.service';

@Component({
  selector: 'app-public-informe',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './public-informe.page.html'
})
export class PublicInformePage implements OnInit {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private publicService = inject(PublicInformeService);

  token = signal<string>('');
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  success = signal<boolean>(false);
  info = signal<PublicInformeInfo | null>(null);
  saving = signal<boolean>(false);

  form: FormGroup = this.fb.group({
    participo: [false],
    horas: [0, [Validators.min(0)]],
    cursos_biblicos: [0, [Validators.min(0)]],
    observaciones: ['']
  });

  ngOnInit() {
    this.token.set(this.route.snapshot.paramMap.get('token') || '');
    if (!this.token()) {
      this.error.set('Enlace no válido.');
      this.loading.set(false);
      return;
    }

    this.publicService.validarToken(this.token()).subscribe({
      next: (data) => {
        this.info.set(data);
        
        // Cargar los datos existentes si trae los valores de la base de datos
        if (data.informe_existente) {
          this.form.patchValue({
            participo: data.participo,
            horas: data.horas,
            cursos_biblicos: data.cursos_biblicos,
            observaciones: data.observaciones
          });
        }
        
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'El enlace ha expirado o ya fue utilizado.');
        this.loading.set(false);
      }
    });
  }

  incrementar(campo: string) {
    const control = this.form.get(campo);
    if (control) {
      control.setValue((control.value || 0) + 1);
    }
  }

  decrementar(campo: string) {
    const control = this.form.get(campo);
    if (control && control.value > 0) {
      control.setValue(control.value - 1);
    }
  }

  enviarInforme() {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.publicService.registrarInforme(this.token(), this.form.value).subscribe({
      next: () => {
        this.success.set(true);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Ocurrió un error al enviar el informe.');
        this.saving.set(false);
      }
    });
  }

  cerrarVentana() {
    window.close();
    // Fallback si el navegador bloquea window.close()
    if (!window.closed) {
      alert('Ya puedes cerrar esta pestaña del navegador.');
    }
  }
}

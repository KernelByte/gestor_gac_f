import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/auth.store';
import { ModalComponent } from '../../shared/components';
import { mensajeError } from '../../shared/mensaje-error';

/**
 * Aviso de privacidad (art. 14, Decreto 1377 de 2013) que se pide aceptar al
 * entrar cuando la persona no ha aceptado la versión vigente de los términos.
 * No se puede cerrar sin aceptar; la aceptación queda registrada en el
 * servidor con fecha y versión (modules/basicas/legal).
 */
@Component({
  standalone: true,
  selector: 'app-aceptar-terminos',
  imports: [RouterLink, ModalComponent],
  template: `
    <app-modal [open]="true" size="md" [dismissible]="false" [closeOnBackdrop]="false"
               title="Antes de continuar" [hasFooter]="true" testId="aceptar-terminos">
      <div class="flex flex-col gap-4 body-lg">
        <p>
          GAC guarda datos suyos para que <strong class="font-semibold text-slate-900 dark:text-slate-100">su congregación</strong>
          organice las reuniones, los informes y las asignaciones.
        </p>
        <ul class="flex flex-col gap-2 text-sm">
          <li class="flex gap-2.5"><span class="punto" aria-hidden="true"></span>Solo los ven las personas de su congregación que están autorizadas.</li>
          <li class="flex gap-2.5"><span class="punto" aria-hidden="true"></span>No se usan de manera comercial ni para publicidad.</li>
          <li class="flex gap-2.5"><span class="punto" aria-hidden="true"></span>Para ver, corregir o borrar sus datos, hable con el secretario de su congregación.</li>
        </ul>
        <p class="text-sm">
          Lea la
          <a routerLink="/legal/privacidad" target="_blank" class="btn-link px-0">política de privacidad</a>,
          los <a routerLink="/legal/terminos" target="_blank" class="btn-link px-0">términos de uso</a>
          y <a routerLink="/legal/seguridad" target="_blank" class="btn-link px-0">cómo cuidamos su información</a>.
        </p>

        <label class="card-section flex items-start gap-3 cursor-pointer">
          <input type="checkbox" class="mt-1 w-5 h-5 shrink-0 cursor-pointer" [checked]="marcado()"
                 (change)="marcado.set($any($event.target).checked)" />
          <span class="text-sm font-medium text-slate-900 dark:text-slate-100">
            Leí y acepto los términos de uso y la política de privacidad.
          </span>
        </label>

        @if (error()) {
          <p class="text-sm text-red-600 dark:text-red-400" role="alert">{{ error() }}</p>
        }
      </div>

      <div slot="footer" class="flex justify-end">
        <button type="button" class="btn-primary" [disabled]="!marcado() || guardando()" (click)="aceptar()">
          @if (guardando()) { <span class="spinner-sm"></span> }
          Continuar
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .punto {
      flex: none; width: 0.375rem; height: 0.375rem; margin-top: 0.5rem; border-radius: 999px;
      background: var(--accent);
    }
  `],
})
export class AceptarTerminosComponent {
  private http = inject(HttpClient);
  private store = inject(AuthStore);

  marcado = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);

  async aceptar() {
    if (!this.marcado() || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    try {
      await lastValueFrom(this.http.post(`${environment.apiUrl}/legal/aceptar`, { canal: 'web' }));
      const u = this.store.user();
      if (u) this.store.setUser({ ...u, terminos_pendientes: false });
    } catch (e) {
      this.error.set(mensajeError(e, 'No se pudo guardar. Revise su conexión e intente de nuevo.'));
    } finally {
      this.guardando.set(false);
    }
  }
}

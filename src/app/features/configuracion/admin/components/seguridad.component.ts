import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { AuthStore } from '../../../../core/auth/auth.store';

const API = `${environment.apiUrl}/seguridad`;

interface EstadoSeguridad {
  dos_pasos: { obligatorio_admin: boolean; admins_total: number; admins_sin_2fa: { id: number; nombre: string }[] };
  respaldos: {
    llave_configurada: boolean; huella: string | null;
    sin_cifrar: number; sin_cifrar_mb: number; sin_cifrar_enviados_por_correo: number;
  };
  entorno: string;
  clave_cifrado_configurada: boolean;
}

interface UsuarioDosPasos {
  id_usuario: number; nombre: string; correo: string; rol: string;
  totp_activo: boolean; totp_activado_en: string | null;
}

/**
 * Pestaña Seguridad del panel de administración:
 *  1. Estado: lista de comprobación con lo que conviene corregir.
 *  2. Verificación en dos pasos: obligatoriedad y restablecer a otros.
 *  3. Respaldos cifrados: generar la llave (archivo .gacllave) y limpiar
 *     respaldos antiguos sin cifrar.
 */
@Component({
  selector: 'app-seguridad',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="h-full overflow-y-auto overscroll-contain">
   <div class="px-4 sm:px-6 lg:px-7 py-5 lg:py-6 max-w-6xl space-y-8">

    <div *ngIf="!estado() && !error()" class="space-y-3">
      <div class="h-6 w-56 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
      <div class="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
    </div>
    <p *ngIf="error()" role="alert" class="text-sm font-semibold text-red-600 dark:text-red-400">{{ error() }}</p>

    <ng-container *ngIf="estado() as e">

    <!-- 1. Estado -->
    <section aria-labelledby="seg-estado">
      <h2 id="seg-estado" class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Estado de la seguridad</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Lo que está bien y lo que conviene corregir.</p>
      <ul class="grid gap-2 md:grid-cols-2">
        <li *ngFor="let p of puntos()" class="flex items-start gap-3 p-4 rounded-2xl border"
          [ngClass]="p.ok ? 'border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-900/10'">
          <span class="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black"
            [ngClass]="p.ok ? 'bg-emerald-500' : 'bg-amber-500'" aria-hidden="true">{{ p.ok ? '✓' : '!' }}</span>
          <div class="min-w-0">
            <p class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ p.titulo }}</p>
            <p class="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{{ p.detalle }}</p>
          </div>
        </li>
      </ul>
    </section>

    <!-- 2. Verificación en dos pasos -->
    <section aria-labelledby="seg-2fa">
      <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 id="seg-2fa" class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Verificación en dos pasos</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Además de la contraseña, se pide un código del teléfono al entrar.</p>
        </div>
        <label class="flex items-center gap-3 cursor-pointer select-none p-2 -m-2 rounded-xl">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Obligatoria para administradores</span>
          <button type="button" role="switch" [attr.aria-checked]="e.dos_pasos.obligatorio_admin"
            (click)="cambiarObligatorio(!e.dos_pasos.obligatorio_admin)" [disabled]="trabajando()"
            class="relative w-12 h-7 rounded-full transition-colors duration-150"
            [ngClass]="e.dos_pasos.obligatorio_admin ? 'bg-brand-purple' : 'bg-slate-300 dark:bg-slate-600'">
            <span class="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-150"
              [class.translate-x-5]="e.dos_pasos.obligatorio_admin"></span>
          </button>
        </label>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <tr>
              <th scope="col" class="px-4 py-3">Usuario</th>
              <th scope="col" class="px-4 py-3 hidden md:table-cell">Rol</th>
              <th scope="col" class="px-4 py-3">Estado</th>
              <th scope="col" class="px-4 py-3 text-right"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr *ngFor="let u of usuarios()">
              <td class="px-4 py-3 min-w-0">
                <p class="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[14rem] sm:max-w-none">{{ u.nombre }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[14rem] sm:max-w-none">{{ u.correo }}</p>
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-slate-600 dark:text-slate-300">{{ u.rol }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold"
                  [ngClass]="u.totp_activo ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'">
                  {{ u.totp_activo ? 'Activada' : 'Sin activar' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <button *ngIf="u.totp_activo && u.id_usuario !== miId()" type="button" (click)="aRestablecer.set(u)"
                  class="min-h-[2.5rem] px-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-red-300 hover:text-red-600 transition-colors"
                  [attr.aria-label]="'Restablecer la verificación de ' + u.nombre">
                  Restablecer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
        "Restablecer" sirve cuando alguien perdió el teléfono: quita su verificación, cierra su sesión y deberá activarla de nuevo.
      </p>
    </section>

    <!-- 3. Respaldos cifrados -->
    <section aria-labelledby="seg-resp" class="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div class="lg:col-span-2">
        <h2 id="seg-resp" class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Respaldos cifrados</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Con una llave configurada, cada respaldo se guarda y se envía cifrado. Quien lo robe del servidor o del correo no podrá leerlo.
        </p>
      </div>

      <div class="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-4">
        <div>
          <p class="text-sm font-bold text-slate-800 dark:text-slate-100">Llave de respaldos</p>
          <p *ngIf="e.respaldos.llave_configurada" class="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Configurada. Huella: <span class="font-mono font-bold">{{ e.respaldos.huella }}</span>
          </p>
          <p *ngIf="!e.respaldos.llave_configurada" class="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Sin configurar: los respaldos se están guardando sin cifrar.
          </p>
        </div>

        <button *ngIf="!formLlave()" type="button" (click)="formLlave.set(true)"
          class="w-full min-h-[3rem] rounded-xl bg-brand-purple text-white font-bold text-sm hover:bg-purple-700 transition-colors">
          {{ e.respaldos.llave_configurada ? 'Cambiar la llave' : 'Crear la llave' }}
        </button>

        <form *ngIf="formLlave()" (submit)="$event.preventDefault(); generarLlave(f1.value, f2.value, pw.value)" class="space-y-3">
          <ol class="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-5">
            <li>Inventa una <b>frase</b> larga (mínimo 12 caracteres) que puedas recordar.</li>
            <li>Se descargará el archivo <b>respaldos.gacllave</b>. Guárdalo fuera del servidor (por ejemplo, en una memoria USB).</li>
            <li>Para restaurar un respaldo necesitarás <b>ese archivo y la frase</b>. Sin ellos, los respaldos no se pueden abrir.</li>
          </ol>
          <div *ngIf="e.respaldos.llave_configurada" class="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-200">
            Los respaldos ya hechos seguirán necesitando la llave anterior.
          </div>
          <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Frase
            <input #f1 type="password" minlength="12" required autocomplete="new-password" class="campo mt-1">
          </label>
          <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Repite la frase
            <input #f2 type="password" minlength="12" required autocomplete="new-password" class="campo mt-1">
          </label>
          <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Tu contraseña
            <input #pw type="password" required autocomplete="current-password" class="campo mt-1">
          </label>
          <div class="flex gap-2">
            <button type="button" (click)="formLlave.set(false)" class="flex-1 min-h-[3rem] rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-700 dark:text-slate-200">Cancelar</button>
            <button type="submit" [disabled]="trabajando()" class="flex-1 min-h-[3rem] rounded-xl bg-brand-purple text-white font-bold text-sm disabled:opacity-50">
              {{ trabajando() ? 'Creando…' : 'Crear y descargar' }}
            </button>
          </div>
        </form>
      </div>

      <div class="p-5 rounded-2xl border bg-white dark:bg-slate-800/40 space-y-3"
        [ngClass]="e.respaldos.sin_cifrar ? 'border-amber-200 dark:border-amber-900/50' : 'border-slate-200 dark:border-slate-700'">
        <p class="text-sm font-bold text-slate-800 dark:text-slate-100">Respaldos antiguos sin cifrar</p>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <ng-container *ngIf="e.respaldos.sin_cifrar; else ninguno">
            Hay <b>{{ e.respaldos.sin_cifrar }}</b> en el servidor ({{ e.respaldos.sin_cifrar_mb }} MB).
            Cualquiera con acceso al servidor podría leerlos.
          </ng-container>
          <ng-template #ninguno>No queda ninguno en el servidor.</ng-template>
        </p>
        <p *ngIf="e.respaldos.sin_cifrar_enviados_por_correo" class="text-sm text-slate-600 dark:text-slate-300">
          {{ e.respaldos.sin_cifrar_enviados_por_correo }} se enviaron por correo sin cifrar: bórralos también de esos buzones.
        </p>
        <button *ngIf="e.respaldos.sin_cifrar" type="button" (click)="confirmarBorrado.set(true)"
          class="w-full min-h-[3rem] rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          Eliminar respaldos sin cifrar
        </button>
      </div>
    </section>
    </ng-container>
   </div>
  </div>

  <!-- Confirmar restablecer -->
  <div *ngIf="aRestablecer() as u" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" (click)="aRestablecer.set(null)">
    <div role="alertdialog" aria-modal="true" class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-200 dark:border-slate-800" (click)="$event.stopPropagation()">
      <h3 class="text-lg font-bold text-slate-900 dark:text-white">¿Restablecer la verificación de {{ u.nombre }}?</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300">Se cerrará su sesión y tendrá que volver a configurarla con su teléfono. Hazlo solo si confirmaste con esa persona que perdió el teléfono.</p>
      <div class="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <button type="button" (click)="aRestablecer.set(null)" class="min-h-[2.75rem] px-4 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300">Cancelar</button>
        <button type="button" (click)="restablecer(u)" [disabled]="trabajando()" class="min-h-[2.75rem] px-4 rounded-xl bg-red-600 text-white font-bold text-sm disabled:opacity-50">Sí, restablecer</button>
      </div>
    </div>
  </div>

  <!-- Confirmar borrado de respaldos sin cifrar -->
  <div *ngIf="confirmarBorrado()" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" (click)="confirmarBorrado.set(false)">
    <div role="alertdialog" aria-modal="true" class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-slate-200 dark:border-slate-800" (click)="$event.stopPropagation()">
      <h3 class="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar {{ estado()?.respaldos?.sin_cifrar }} respaldos sin cifrar?</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Se borran del servidor y no se pueden recuperar.
        <b *ngIf="!estado()?.respaldos?.llave_configurada">Todavía no hay llave: después de esto no quedará ningún respaldo hasta que se haga uno nuevo.</b>
      </p>
      <div class="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <button type="button" (click)="confirmarBorrado.set(false)" class="min-h-[2.75rem] px-4 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300">Cancelar</button>
        <button type="button" (click)="eliminarSinCifrar()" [disabled]="trabajando()" class="min-h-[2.75rem] px-4 rounded-xl bg-red-600 text-white font-bold text-sm disabled:opacity-50">Sí, eliminar</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .campo { width: 100%; height: 2.75rem; border-radius: .75rem; border: 1px solid rgb(226 232 240); background: rgb(248 250 252);
      padding: 0 .875rem; font-size: .9375rem; font-weight: 500; color: rgb(15 23 42); }
    .campo:focus { outline: none; border-color: #6d28d9; box-shadow: 0 0 0 3px rgb(109 40 217 / .15); }
    :host-context(.dark) .campo { border-color: rgb(51 65 85); background: rgb(15 23 42); color: #fff; }
  `],
})
export class SeguridadComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private store = inject(AuthStore);

  estado = signal<EstadoSeguridad | null>(null);
  usuarios = signal<UsuarioDosPasos[]>([]);
  error = signal<string | null>(null);
  trabajando = signal(false);
  formLlave = signal(false);
  aRestablecer = signal<UsuarioDosPasos | null>(null);
  confirmarBorrado = signal(false);
  miId = computed(() => Number(this.store.user()?.id));

  puntos = computed(() => {
    const e = this.estado();
    if (!e) return [];
    const sin = e.dos_pasos.admins_sin_2fa;
    return [
      ...(e.clave_cifrado_configurada ? [] : [{
        ok: false,
        titulo: 'Falta la clave de cifrado del servidor',
        detalle: 'Sin GAC_CIFRADO_KEY nadie puede activar la verificación en dos pasos. Pide a quien administra el servidor que la configure.',
      }]),
      {
        ok: sin.length === 0,
        titulo: 'Verificación en dos pasos de administradores',
        detalle: sin.length === 0
          ? `Los ${e.dos_pasos.admins_total} administradores la tienen activa.`
          : `Sin activar: ${sin.map(a => a.nombre).join(', ')}.`
          + (e.dos_pasos.obligatorio_admin ? ' Se les pedirá al entrar.' : ''),
      },
      {
        ok: e.dos_pasos.obligatorio_admin,
        titulo: 'Obligatoria para administradores',
        detalle: e.dos_pasos.obligatorio_admin ? 'Ningún administrador puede entrar sin ella.' : 'Está apagada: un administrador podría entrar solo con la contraseña.',
      },
      {
        ok: e.respaldos.llave_configurada,
        titulo: 'Respaldos cifrados',
        detalle: e.respaldos.llave_configurada ? 'Los respaldos nuevos se guardan y se envían cifrados.' : 'Crea la llave para que los respaldos dejen de guardarse sin cifrar.',
      },
      {
        ok: e.respaldos.sin_cifrar === 0,
        titulo: 'Respaldos antiguos sin cifrar',
        detalle: e.respaldos.sin_cifrar === 0 ? 'No queda ninguno en el servidor.' : `Quedan ${e.respaldos.sin_cifrar} en el servidor.`,
      },
    ];
  });

  ngOnInit() { this.cargar(); }

  cargar() {
    this.http.get<EstadoSeguridad>(`${API}/estado`).subscribe({
      next: e => { this.estado.set(e); this.error.set(null); },
      error: () => this.error.set('No se pudo cargar el estado de seguridad.'),
    });
    this.http.get<UsuarioDosPasos[]>(`${API}/usuarios`).subscribe({ next: u => this.usuarios.set(u) });
  }

  async cambiarObligatorio(valor: boolean) {
    this.trabajando.set(true);
    try {
      await lastValueFrom(this.http.put(`${API}/dos-pasos/obligatorio`, { obligatorio: valor }));
      this.toast.success(valor ? 'Ahora es obligatoria para administradores' : 'Ya no es obligatoria para administradores');
      this.cargar();
    } catch (e: any) {
      this.toast.error('No se pudo cambiar', e?.error?.detail);
    } finally { this.trabajando.set(false); }
  }

  async restablecer(u: UsuarioDosPasos) {
    this.trabajando.set(true);
    try {
      await lastValueFrom(this.http.delete(`${API}/usuarios/${u.id_usuario}/dos-pasos`));
      this.toast.success('Verificación restablecida', `${u.nombre} deberá configurarla de nuevo.`);
      this.aRestablecer.set(null);
      this.cargar();
    } catch (e: any) {
      this.toast.error('No se pudo restablecer', e?.error?.detail);
    } finally { this.trabajando.set(false); }
  }

  async generarLlave(frase: string, repetida: string, password: string) {
    if (frase.length < 12) { this.toast.warning('La frase es muy corta', 'Usa al menos 12 caracteres.'); return; }
    if (frase !== repetida) { this.toast.warning('Las frases no coinciden'); return; }
    this.trabajando.set(true);
    try {
      const r: HttpResponse<Blob> = await lastValueFrom(this.http.post(`${API}/respaldos/llaves`,
        { frase, password }, { observe: 'response', responseType: 'blob' }));
      const url = URL.createObjectURL(r.body!);
      const a = document.createElement('a');
      a.href = url; a.download = 'respaldos.gacllave'; a.click();
      URL.revokeObjectURL(url);
      this.toast.success('Llave creada', 'Guarda el archivo descargado fuera del servidor y no olvides la frase.', 8000);
      this.formLlave.set(false);
      this.cargar();
    } catch (e: any) {
      let detalle = 'Revisa los datos.';
      try { detalle = JSON.parse(await (e?.error as Blob).text()).detail; } catch { }
      this.toast.error('No se pudo crear la llave', detalle);
    } finally { this.trabajando.set(false); }
  }

  async eliminarSinCifrar() {
    this.trabajando.set(true);
    try {
      const r = await lastValueFrom(this.http.delete<{ eliminados: number }>(`${API}/respaldos/sin-cifrar`));
      this.toast.success(`Se eliminaron ${r.eliminados} respaldos sin cifrar`);
      this.confirmarBorrado.set(false);
      this.cargar();
    } catch (e: any) {
      this.toast.error('No se pudieron eliminar', e?.error?.detail);
    } finally { this.trabajando.set(false); }
  }
}

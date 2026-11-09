import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Pie común de las pantallas de acceso (login, recuperar, restablecer,
 * solicitar acceso): Términos y Privacidad, año y versión. Seguridad no va
 * aquí: el login ya la enlaza con la línea del candado, y las tres páginas
 * legales se enlazan entre sí con sus pestañas.
 * Las pantallas de acceso son siempre oscuras, de ahí la paleta fija.
 */
@Component({
  standalone: true,
  selector: 'app-auth-pie',
  imports: [RouterLink],
  template: `
    <footer class="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 sm:gap-x-7 text-xs text-slate-500 font-medium tracking-wide w-full opacity-80 hover:opacity-100 transition-opacity">
      <a routerLink="/legal/terminos" class="hover:text-slate-300 transition-colors p-2">Términos</a>
      <a routerLink="/legal/privacidad" class="hover:text-slate-300 transition-colors p-2">Privacidad</a>
      <span class="text-slate-600 p-2">© {{ anio }} GAC • v{{ version }}</span>
    </footer>
  `,
})
export class AuthPieComponent {
  readonly anio = new Date().getFullYear();
  readonly version = environment.appVersion;
}

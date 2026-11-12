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
    <footer class="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-5 text-xs text-slate-400 font-medium tracking-wide w-full">
      <a routerLink="/legal/terminos" class="inline-flex items-center min-h-8 [@media(pointer:coarse)]:min-h-11 px-2 hover:text-slate-200 transition-colors">Términos</a>
      <a routerLink="/legal/privacidad" class="inline-flex items-center min-h-8 [@media(pointer:coarse)]:min-h-11 px-2 hover:text-slate-200 transition-colors">Privacidad</a>
      <span class="inline-flex items-center min-h-8 [@media(pointer:coarse)]:min-h-11 px-2">© {{ anio }} GAC • v{{ version }}</span>
    </footer>
  `,
})
export class AuthPieComponent {
  readonly anio = new Date().getFullYear();
  readonly version = environment.appVersion;
}

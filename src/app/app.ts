import { Component, NgZone, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { iniciarIndicadorDePestanas } from './shared/utils/tab-indicator';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('gestor_gac_f');

  constructor() {
    // Fuera de la zona: el indicador solo toca el DOM. Dentro, cada
    // requestAnimationFrame suyo disparaba una detección de cambios global; en
    // pantallas que recrean nodos al detectar cambios (el listado de
    // publicadores) eso volvía a activar su MutationObserver y congelaba la pestaña.
    inject(NgZone).runOutsideAngular(() => iniciarIndicadorDePestanas());
  }
}

import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div class="card" style="padding: 20px;">
      <h2 style="margin: 0 0 10px;">Inicio</h2>
      <p style="color: var(--muted); margin: 0;">
        Bienvenido al panel. Usa el menú lateral para navegar.
      </p>
    </div>
  `
})
export class HomePage {}

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Cabecera estándar de pantalla: título, subtítulo y acciones a la derecha.
 *
 * Pensada como primer elemento de cualquier página enrutada. El margen
 * exterior de la pantalla NO se define aquí: lo pone una sola vez el shell
 * (`layout/shell.page.ts` → `px-4 md:px-8 pt-4 md:pt-6 pb-6`). Una página no
 * debe añadir padding propio o acabará con margen doble respecto al resto.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Apila en móvil: con un título largo y dos botones, en una sola fila el
         título se comprime hasta partirse. shrink-0 para que la cabecera no
         ceda altura dentro de layouts con h-full/overflow-hidden. -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0"
         [class.mb-6]="spacing !== 'none'">
      <div class="min-w-0">
        <p *ngIf="eyebrow" class="eyebrow mb-1">{{ eyebrow }}</p>
        <h1 class="page-title">{{ title }}</h1>
        <!-- max-w-prose = 65ch, la medida legible. Sin límite, un párrafo
             largo se estira a 95+ caracteres por línea y cuesta seguirlo. -->
        <p *ngIf="subtitle" class="page-subtitle" [class.max-w-prose]="subtitleWide">{{ subtitle }}</p>
      </div>

      <!-- Slot de acciones. empty:hidden evita que el gap-4 deje un hueco
           fantasma en las páginas que no traen botones. -->
      <div class="flex items-center gap-3 shrink-0 empty:hidden">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle: string = '';
  /** Rótulo pequeño sobre el título (contexto: periodo, año de servicio…). */
  @Input() eyebrow: string = '';
  /** Limita el subtítulo a ~3xl cuando es un párrafo explicativo largo. */
  @Input() subtitleWide = false;
  /**
   * 'none' cuando el contenedor padre ya separa con `gap-*`; así no se suman
   * el gap del padre y el mb-6 de la cabecera.
   */
  @Input() spacing: 'default' | 'none' = 'default';
}

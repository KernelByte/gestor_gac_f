import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-start justify-between mb-6">
      <!-- Título y subtítulo -->
      <div>
        <h1 class="page-title">{{ title }}</h1>
        <p *ngIf="subtitle" class="page-subtitle">{{ subtitle }}</p>
      </div>

      <!-- Slot para botones de acción (btn-secondary, btn-primary, etc.) -->
      <div class="flex items-center gap-3 shrink-0 mt-0.5">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle: string = '';
}

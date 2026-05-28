import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TabItem {
  key: string;
  label: string;
  /** Clase SVG del ícono (opcional, se proyecta vía iconos Heroicons inline) */
  icon?: string;
}

/**
 * Color activo del tab según el módulo:
 *   orange → Publicadores / Secretario  (bg-orange-500)
 *   green  → Territorios               (bg-green-600)
 *   blue   → Exhibidores               (bg-blue-600)
 *   violet → Global / marca            (bg-violet-600)
 */
export type TabColor = 'orange' | 'green' | 'blue' | 'violet';

@Component({
  selector: 'app-tab-nav',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tab-nav mb-6">
      <button
        *ngFor="let tab of tabs"
        (click)="select(tab.key)"
        [class]="tab.key === activeTab ? activeClass : 'tab-item'"
      >
        <!-- Ícono proyectado por slot con nombre del tab -->
        <ng-content [select]="'[slot=' + tab.key + ']'" />
        {{ tab.label }}
      </button>
    </div>
  `,
})
export class TabNavComponent {
  @Input({ required: true }) tabs: TabItem[] = [];
  @Input() activeTab: string = '';
  @Input() color: TabColor = 'orange';
  @Output() tabChange = new EventEmitter<string>();

  select(key: string): void {
    this.activeTab = key;
    this.tabChange.emit(key);
  }

  get activeClass(): string {
    const colorMap: Record<TabColor, string> = {
      orange: 'tab-item-active bg-orange-500',
      green:  'tab-item-active bg-green-600',
      blue:   'tab-item-active bg-blue-600',
      violet: 'tab-item-active bg-violet-600',
    };
    return colorMap[this.color];
  }
}

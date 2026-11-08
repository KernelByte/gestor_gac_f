import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TabItem {
  key: string;
  label: string;
  /** Clase SVG del ícono (opcional, se proyecta vía iconos Heroicons inline) */
  icon?: string;
}

/**
 * Color activo del tab. Por defecto (`auto`) usa el acento del módulo
 * (`--accent`, ver `.tema-*` en styles.scss). Solo se fuerza un color cuando
 * la pantalla no está dentro de un tema de módulo.
 *   orange → Publicadores / Secretario
 *   green  → Territorios
 *   blue   → Exhibidores
 *   violet → Global / marca
 */
export type TabColor = 'auto' | 'orange' | 'green' | 'blue' | 'violet';

@Component({
  selector: 'app-tab-nav',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tab-nav mb-6" role="tablist" (keydown)="teclas($event)">
      <button
        *ngFor="let tab of tabs"
        type="button"
        role="tab"
        [attr.aria-selected]="tab.key === activeTab"
        [attr.tabindex]="tab.key === activeTab ? 0 : -1"
        (click)="select(tab.key)"
        [class]="tab.key === activeTab ? activeClass : 'tab-item'"
        [style.--accent]="tab.key === activeTab ? forzado?.accent : null"
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
  @Input() color: TabColor = 'auto';
  @Output() tabChange = new EventEmitter<string>();

  select(key: string): void {
    this.activeTab = key;
    this.tabChange.emit(key);
  }

  get activeClass(): string { return 'tab-item-active'; }

  /** Color forzado (sin tema de módulo); `auto` hereda --accent. */
  get forzado(): { accent: string } | null {
    const map: Record<Exclude<TabColor, 'auto'>, string> = {
      orange: 'var(--color-orange-500)',
      green:  'var(--color-green-600)',
      blue:   'var(--color-exh-600)',
      violet: 'var(--color-brand-purple)',
    };
    return this.color === 'auto' ? null : { accent: map[this.color] };
  }

  /** Flechas, Inicio y Fin cambian de pestaña (patrón WAI-ARIA tablist). */
  teclas(e: KeyboardEvent): void {
    const i = this.tabs.findIndex(t => t.key === this.activeTab);
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % this.tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + this.tabs.length) % this.tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = this.tabs.length - 1;
    else return;
    e.preventDefault();
    this.select(this.tabs[n].key);
    queueMicrotask(() => (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role=tab]')[n]?.focus());
  }
}

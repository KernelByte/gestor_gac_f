import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

export interface CommandItem {
  key: string;
  label: string;
  hint?: string;
  group?: string;
  route?: string | any[];
  action?: () => void;
  shortcut?: string;
}

const DEFAULT_COMMANDS: CommandItem[] = [
  { key: 'home',         label: 'Ir al Dashboard',           group: 'Navegación', route: '/' },
  { key: 'publicadores', label: 'Ver Publicadores',          group: 'Navegación', route: '/secretario/publicadores' },
  { key: 'territorios',  label: 'Ver Territorios',           group: 'Navegación', route: '/territorios' },
  { key: 'exhibidores',  label: 'Ver Exhibidores',           group: 'Navegación', route: '/exhibidores' },
  { key: 'reuniones',    label: 'Ver Reuniones',             group: 'Navegación', route: '/reuniones' },
  { key: 'reportes',     label: 'Ver Reportes',              group: 'Navegación', route: '/reportes' },
  { key: 'config',       label: 'Configuración',             group: 'Sistema',    route: '/configuracion' },
  { key: 'perfil',       label: 'Mi Perfil',                 group: 'Sistema',    route: '/perfil' },
  { key: 'design',       label: 'Sistema de Diseño',         group: 'Sistema',    route: '/design-system' },
];

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div
      *ngIf="open()"
      class="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fadeIn" (click)="close()"></div>

      <div class="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <!-- Search -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <lucide-icon name="search" [size]="20" class="text-gray-400 shrink-0"></lucide-icon>
          <input
            #searchInput
            [value]="query()"
            (input)="onQuery($event)"
            (keydown)="onKey($event)"
            class="flex-1 text-base bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500 text-gray-900 dark:text-slate-100"
            placeholder="Buscar comandos, ir a una página..."
            autofocus
          />
          <kbd class="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-slate-700 text-xs font-mono text-gray-500 dark:text-slate-400">ESC</kbd>
        </div>

        <!-- Results -->
        <div class="max-h-[50vh] overflow-y-auto py-2">
          <p *ngIf="filtered().length === 0" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
            Sin resultados para "{{ query() }}"
          </p>

          <ng-container *ngFor="let group of grouped(); let gi = index">
            <p class="eyebrow px-4 pt-3 pb-1">{{ group.name }}</p>
            <button
              *ngFor="let cmd of group.items; let i = index; trackBy: trackByKey"
              type="button"
              (click)="run(cmd)"
              (mouseenter)="setActive(absoluteIndex(gi, i))"
              class="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-slate-700/50"
              [class.bg-violet-50]="absoluteIndex(gi, i) === active()"
              [class.dark:bg-violet-950/40]="absoluteIndex(gi, i) === active()"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-slate-100">{{ cmd.label }}</p>
                <p *ngIf="cmd.hint" class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{{ cmd.hint }}</p>
              </div>
              <lucide-icon
                *ngIf="absoluteIndex(gi, i) === active()"
                name="arrow-right" [size]="16"
                class="text-violet-600 shrink-0"
              ></lucide-icon>
            </button>
          </ng-container>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 text-xs text-gray-500 dark:text-slate-400">
          <span class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-mono dark:text-slate-300">↑↓</kbd>
            navegar
          </span>
          <span class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 font-mono dark:text-slate-300">↵</kbd>
            seleccionar
          </span>
        </div>
      </div>
    </div>
  `,
})
export class CommandPaletteComponent {
  private router = inject(Router);

  open = signal(false);
  query = signal('');
  active = signal(0);
  commands = signal<CommandItem[]>(DEFAULT_COMMANDS);

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.commands();
    return this.commands().filter(c => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q));
  });

  grouped = computed(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const cmd of this.filtered()) {
      const g = cmd.group || 'Otros';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(cmd);
    }
    return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
  });

  trackByKey = (_: number, item: CommandItem) => item.key;

  absoluteIndex(groupIdx: number, itemIdx: number): number {
    const groups = this.grouped();
    let count = 0;
    for (let i = 0; i < groupIdx; i++) count += groups[i].items.length;
    return count + itemIdx;
  }

  @HostListener('document:keydown', ['$event'])
  onShortcut(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.toggle();
    }
  }

  toggle() {
    this.open.update(v => !v);
    if (this.open()) {
      this.query.set('');
      this.active.set(0);
    }
  }

  close() { this.open.set(false); }

  onQuery(e: Event) {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
  }

  setActive(i: number) { this.active.set(i); }

  onKey(e: KeyboardEvent) {
    const flat = this.filtered();
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.update(i => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); this.active.update(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter')     { e.preventDefault(); const cmd = flat[this.active()]; if (cmd) this.run(cmd); }
    else if (e.key === 'Escape')    { this.close(); }
  }

  run(cmd: CommandItem) {
    this.close();
    if (cmd.action) cmd.action();
    if (cmd.route) this.router.navigateByUrl(Array.isArray(cmd.route) ? cmd.route.join('/') : cmd.route);
  }
}

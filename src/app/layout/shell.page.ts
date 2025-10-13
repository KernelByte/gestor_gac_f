import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth/auth.store';
import { AuthService } from '../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive], // <-- agrega RouterLinkActive
  template: `
    <div class="flex flex-col min-h-screen">
      <div class="flex flex-1">
          <!-- Sidebar (fixed to top, full height) -->
          <aside
            [ngClass]="{
              'w-56': !collapsed(),
              'w-20': collapsed()
            }"
            class="fixed top-0 left-0 h-screen bg-slate-900 text-slate-100 transition-width duration-200 ease-in-out flex flex-col z-30"
          >
            <!-- Sidebar header: logo + app name + collapse button on right -->
            <div [ngClass]="{ 'justify-center': collapsed(), 'justify-between': !collapsed() }" class="flex items-center px-4 py-3 border-b border-slate-800">
              <div class="flex items-center gap-3" [ngClass]="{ 'justify-center w-full': collapsed() }">
                <!-- app logo -->
                <div class="w-8 h-8 rounded-md bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center font-extrabold">G</div>
                <span *ngIf="!collapsed()" class="font-semibold">Gestor GAC</span>
              </div>

              <!-- collapse button removed from sidebar header; control is in the navbar -->
            </div>

            <div class="flex-1 overflow-y-auto">
              <nav class="px-2 py-4 space-y-1">
                <a
                routerLink="/"
                routerLinkActive="bg-slate-800 text-white"
                [routerLinkActiveOptions]="{ exact: true }"
                [ngClass]="{ 'justify-center': collapsed(), 'justify-start': !collapsed() }"
                class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800"
                title="Inicio"
              >
                  <!-- home icon -->
                  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9.5L12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
                  </svg>
                  <span *ngIf="!collapsed()" class="text-sm">Inicio</span>
                </a>

              <a
                *ngIf="hasRole('Administrador')"
                routerLink="/roles"
                routerLinkActive="bg-slate-800 text-white"
                [ngClass]="{ 'justify-center': collapsed(), 'justify-start': !collapsed() }"
                class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800"
                title="Roles"
              >
                <!-- users icon -->
                <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
                </svg>
                <span *ngIf="!collapsed()" class="text-sm">Roles</span>
              </a>

              <!-- Modules group -->
              <div class="mt-4 border-t border-slate-800 pt-3 px-2">
                <div class="text-xs uppercase text-slate-400 px-3 mb-2" *ngIf="!collapsed()">Módulos</div>

                <a routerLink="/configuracion" routerLinkActive="bg-slate-800 text-white" [ngClass]="{ 'justify-center': collapsed(), 'justify-start': !collapsed() }" class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800" title="Configuración">
                  <!-- gear icon -->
                  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09c.7 0 1.27-.4 1.51-1a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06c.5.5 1.25.66 1.82.33.33-.2.66-.33 1-.33H9a1.65 1.65 0 001.51-1c.35-.83 1.14-1.41 2.02-1.41h.09a2 2 0 010 4h-.09c-.88 0-1.67.58-2.02 1.41-.2.48-.6.84-1.13 1.01" />
                  </svg>
                  <span *ngIf="!collapsed()" class="text-sm">Configuración</span>
                </a>

                <a routerLink="/exhibidores" routerLinkActive="bg-slate-800 text-white" [ngClass]="{ 'justify-center': collapsed(), 'justify-start': !collapsed() }" class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800" title="Exhibidores">
                  <!-- grid icon -->
                  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                  <span *ngIf="!collapsed()" class="text-sm">Exhibidores</span>
                </a>

                <a routerLink="/territorios" routerLinkActive="bg-slate-800 text-white" [ngClass]="{ 'justify-center': collapsed(), 'justify-start': !collapsed() }" class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800" title="Territorios">
                  <!-- map icon -->
                  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A2 2 0 013 15.382V5.618a2 2 0 011.553-1.894L9 1v19zM15 4l5.447 2.724A2 2 0 0121 8.618v9.764a2 2 0 01-1.553 1.894L15 23V4z" />
                  </svg>
                  <span *ngIf="!collapsed()" class="text-sm">Territorios</span>
                </a>

                <div class="px-0">
                  <button (click)="toggleSecretario()" [attr.aria-expanded]="secretarioOpen()" [ngClass]="{ 'justify-center': collapsed(), 'justify-start': !collapsed() }" class="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800" title="Secretario">
                    <!-- user icon -->
                    <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A9 9 0 1118.879 6.196 9 9 0 015.12 17.804z" />
                    </svg>
                    <span *ngIf="!collapsed()" class="text-sm flex-1 text-left">Secretario</span>
                    <svg *ngIf="!collapsed()" [style.transform]="secretarioOpen() ? 'rotate(90deg)' : 'rotate(0deg)'" class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                  </button>

                  <div *ngIf="secretarioOpen() && !collapsed()" class="mt-1 ml-6 pl-2 border-l border-slate-800 space-y-1">
                    <a routerLink="/secretario/publicadores" routerLinkActive="bg-slate-800 text-white" class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 text-sm">
                      <!-- book/users icon -->
                      <svg class="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20v-6m0 0a4 4 0 100-8 4 4 0 000 8z"/></svg>
                      <span>Publicadores</span>
                    </a>
                  </div>
                </div>
              </div>
            </nav>
          </div>

          <!-- Collapse hint / footer area -->
          <div class="px-3 py-3 border-t border-slate-800">
            <div *ngIf="!collapsed()" class="text-xs text-slate-400">Versión 1.0</div>
          </div>
        </aside>

        <!-- Main content (push right to leave space for fixed sidebar) -->
        <main class="flex-1 bg-slate-50 p-6" [style.marginLeft.px]="collapsed() ? 80 : 224" [style.paddingTop.px]="56">
          <!-- inner topbar inside main area (dark, matches sidebar) -> make it fixed and flush with sidebar -->
          <header class="h-14 flex items-center gap-3 px-4 border-b bg-slate-900 text-slate-100 fixed top-0 right-0 z-20" [style.left.px]="collapsed() ? 80 : 224">
            <div class="flex items-center gap-3">
              <button class="p-2 rounded-md hover:bg-slate-800" (click)="toggleSidebar()" aria-label="Toggle sidebar">
                <svg class="w-6 h-6 text-slate-100" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="4" y="6" width="16" height="2" rx="1" />
                  <rect x="4" y="11" width="16" height="2" rx="1" />
                  <rect x="4" y="16" width="16" height="2" rx="1" />
                </svg>
              </button>
              <div class="hidden sm:block font-medium">Dashboard</div>
            </div>

            <div class="flex-1"></div>

            <div class="flex items-center gap-3">
              <!-- theme toggle -->
              <button title="Cambiar tema" class="p-2 rounded-md hover:bg-slate-800" (click)="toggleTheme()" [attr.aria-pressed]="theme() === 'dark'">
                <ng-container *ngIf="theme() === 'dark'; else sunIcon">
                  <svg class="w-5 h-5 text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                </ng-container>
                <ng-template #sunIcon>
                  <svg class="w-5 h-5 text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36l-1.42-1.42M7.05 7.05L5.64 5.64M18.36 5.64l-1.42 1.42M7.05 16.95l-1.41 1.41"/></svg>
                </ng-template>
              </button>

              <!-- notifications -->
              <div class="relative">
                <button title="Notificaciones" class="p-2 rounded-md hover:bg-slate-800" (click)="toggleNotifications()" [attr.aria-expanded]="notificationsOpen()">
                  <svg class="w-5 h-5 text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                </button>
                <span *ngIf="!collapsed()" class="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-rose-500 text-white text-xs">3</span>

                <div *ngIf="notificationsOpen()" class="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg z-50 text-slate-800">
                  <div class="p-3 border-b font-semibold">Notificaciones</div>
                  <div class="p-3 text-sm text-slate-600">No hay notificaciones nuevas</div>
                </div>
              </div>

              <!-- user avatar and menu -->
              <div *ngIf="user() as u" class="relative">
                <button id="user-menu-button" class="flex items-center gap-2 p-1 rounded-md hover:bg-slate-800" (click)="toggleUserMenu()" aria-haspopup="true" [attr.aria-expanded]="userMenuOpen()">
                  <img src="/assets/images/avatar.png" alt="avatar" class="w-8 h-8 rounded-full border" />
                </button>

                <div *ngIf="userMenuOpen()" id="user-menu-panel" class="absolute right-0 mt-2 w-64 bg-slate-800 rounded-lg shadow-xl text-slate-100 z-40 overflow-hidden">
                  <div class="p-4 border-b border-slate-700">
                    <div class="text-sm font-semibold">{{ u.username }}</div>
                  </div>

                  <div class="p-2">
                    <button class="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-700 transition-colors text-sm" (click)="editProfile()">
                      <svg class="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v4m0 8v4m8-8h-4M4 12H0"/></svg>
                      <span>Editar perfil</span>
                    </button>

                    <button class="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-700 transition-colors text-sm" (click)="openSettings()">
                      <svg class="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317a1 1 0 011.35-.447l.073.04a8 8 0 013.63 3.63l.04.073a1 1 0 01-.447 1.35l-1.1.55a2 2 0 00-.9.9l-.55 1.1a1 1 0 01-1.35.447l-.073-.04a8 8 0 01-3.63-3.63l-.04-.073a1 1 0 01.447-1.35l1.1-.55a2 2 0 00.9-.9l.55-1.1z"/></svg>
                      <span>Configuración</span>
                    </button>

                    <button class="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-700 transition-colors text-sm" (click)="openSupport()">
                      <svg class="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 8a6 6 0 11-12 0 6 6 0 0112 0zM12 14v7"/></svg>
                      <span>Soporte</span>
                    </button>
                  </div>

                  <div class="p-3 border-t border-slate-700 bg-gradient-to-t from-transparent to-slate-800">
                    <button class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-rose-600 hover:bg-rose-700 transition-colors text-sm font-semibold" (click)="logout()">
                      <svg class="w-4 h-4 text-white opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7"/></svg>
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div class="mt-4">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [``]
})
export class ShellPage {
  private store = inject(AuthStore);
  private auth = inject(AuthService);

  // sidebar collapsed state (true => collapsed)
  collapsed = signal(false);
  // user menu open state
  userMenuOpen = signal(false);
  // secretario submenu
  secretarioOpen = signal(false);
  // notifications panel
  notificationsOpen = signal(false);
  // theme state: 'dark' | 'light'
  theme = signal<'dark' | 'light'>('dark');

  private outsideClickHandler = (e: MouseEvent) => {
    try {
      const btn = document.getElementById('user-menu-button');
      const menu = document.getElementById('user-menu-panel');
      const target = e.target as Node;
      if (this.userMenuOpen() && btn && menu && target) {
        if (!btn.contains(target) && !menu.contains(target)) {
          this.userMenuOpen.set(false);
        }
      }
    } catch (err) {
      // ignore
    }
  };

  user = computed(() => this.store.user());

  ngOnInit(): void {
    document.addEventListener('click', this.outsideClickHandler);
    // init theme from localStorage or prefers-color-scheme
    try {
      const saved = localStorage.getItem('app_theme');
      if (saved === 'light' || saved === 'dark') {
        this.theme.set(saved as 'light' | 'dark');
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.theme.set('dark');
      } else {
        this.theme.set('light');
      }
      this.applyTheme();
    } catch (e) {}
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.outsideClickHandler);
  }

  hasRole = (r: string) => {
    const u = this.store.user();
    const roles = u?.roles ?? (u?.rol ? [u.rol] : []);
    return roles.map(x => (x || '').toLowerCase()).includes(r.toLowerCase());
  };

  logout() { this.auth.logout(); }

  toggleSidebar() { this.collapsed.update(v => !v); }

  toggleUserMenu() { this.userMenuOpen.update(v => !v); }

  toggleSecretario() { this.secretarioOpen.update(v => !v); }

  toggleNotifications() { this.notificationsOpen.update(v => !v); }

  toggleTheme() {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
    try {
      localStorage.setItem('app_theme', this.theme());
    } catch {}
    this.applyTheme();
  }

  // user menu actions (stubs)
  editProfile() {
    // TODO: navigate to edit profile page
    console.log('editProfile');
    this.userMenuOpen.set(false);
  }

  openSettings() {
    // TODO: open account settings
    console.log('openSettings');
    this.userMenuOpen.set(false);
  }

  openSupport() {
    // TODO: open support/help
    console.log('openSupport');
    this.userMenuOpen.set(false);
  }

  private applyTheme() {
    const root = document.documentElement;
    if (!root) return;
    if (this.theme() === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }
}

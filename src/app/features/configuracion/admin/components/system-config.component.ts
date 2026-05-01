import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface SesionActiva {
  user_id: string;
  nombre: string;
  rol: string | null;
  tipo: 'usuario_completo' | 'publicador_simple';
  congregacion: string | null;
  correo?: string;
  ip?: string | null;
  login_at: string;
  last_activity: string;
  ttl_remaining: number;
}

interface SesionesResponse {
  total: number;
  sesiones: SesionActiva[];
}

@Component({
  selector: 'app-system-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="px-5 md:px-7 py-5 md:py-6 max-w-4xl h-full overflow-y-auto">

      <!-- SECCIÓN 1: Proveedor de Mapa (existente) -->
      <div class="mb-6">
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Ajustes Generales del Sistema</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Configuraciones globales que afectan a toda la aplicación.</p>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl bg-white dark:bg-slate-800/40 shadow-sm transition-colors duration-300">
        <div class="flex items-center gap-2.5 sm:w-48 shrink-0">
          <div class="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
             <svg class="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
             </svg>
          </div>
          <div>
             <span class="block text-sm font-bold text-slate-700 dark:text-slate-300">Proveedor de Mapa</span>
             <span class="block text-xs text-slate-400 dark:text-slate-500">Módulo de Territorios</span>
          </div>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <select
            [(ngModel)]="tileProvider"
            [disabled]="loading() || saving()"
            class="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm text-slate-900 dark:text-white font-semibold focus:border-teal-400 focus:ring-2 focus:ring-teal-400/15 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
          >
            <option value="osm">OpenStreetMap (OSM)</option>
            <option value="google">Google Maps</option>
          </select>
          <button (click)="saveSettings()" [disabled]="saving() || loading()" class="shrink-0 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50 touch-manipulation">
             <span *ngIf="saving()" class="w-4 h-4 inline-block border-2 border-white/30 border-t-white rounded-full animate-spin align-middle mr-1"></span>
             {{ saving() ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Toast Alert (Mapa) -->
      <div *ngIf="notification()" class="mt-5 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 transition-all"
           [ngClass]="notification()?.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
             [ngClass]="notification()?.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-800' : 'bg-rose-100 dark:bg-rose-800'">
           <svg *ngIf="notification()?.type === 'success'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
             <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
           </svg>
           <svg *ngIf="notification()?.type === 'error'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
             <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
           </svg>
        </div>
        <span>{{ notification()?.message }}</span>
      </div>

      <!-- ══════════════════════════════════════════════════════ -->
      <!-- SECCIÓN 2: Usuarios Conectados                       -->
      <!-- ══════════════════════════════════════════════════════ -->
      <div class="mt-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">Usuarios Conectados</h3>
              <p class="text-xs text-slate-400 dark:text-slate-500">
                <span *ngIf="!sessionsLoading() && sesiones().length > 0">
                  {{ sesiones().length }} {{ sesiones().length === 1 ? 'sesión activa' : 'sesiones activas' }} en este momento
                </span>
                <span *ngIf="!sessionsLoading() && sesiones().length === 0">Sin sesiones activas</span>
                <span *ngIf="sessionsLoading()">Cargando...</span>
              </p>
            </div>
          </div>

          <!-- Refresh button -->
          <button (click)="loadSessions()" [disabled]="sessionsLoading()"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/50 transition-all disabled:opacity-50 touch-manipulation">
            <svg class="w-4 h-4 transition-transform" [class.animate-spin]="sessionsLoading()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Actualizar
          </button>
        </div>

        <!-- Auto-refresh indicator -->
        <div class="flex items-center gap-2 mb-4 px-1">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span class="text-[0.625rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Actualización automática cada 30s
          </span>
        </div>

        <!-- Loading state -->
        <div *ngIf="sessionsLoading() && sesiones().length === 0" class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-[3px] border-violet-200 dark:border-violet-800 border-t-violet-600 dark:border-t-violet-400 rounded-full animate-spin"></div>
        </div>

        <!-- Sessions list -->
        <div *ngIf="!sessionsLoading() || sesiones().length > 0" class="space-y-2">
          <div *ngFor="let s of sesiones(); trackBy: trackSession"
            class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl border transition-all duration-300"
            [ngClass]="getActivityClass(s)">

            <!-- Avatar + Info -->
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <!-- Avatar -->
              <div class="relative shrink-0">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border-2"
                  [ngClass]="s.tipo === 'publicador_simple'
                    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700'
                    : 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-700'">
                  {{ (s.nombre || '?').charAt(0).toUpperCase() }}
                </div>
                <!-- Status dot -->
                <span class="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-800"
                  [ngClass]="getMinutesAgo(s.last_activity) < 5 ? 'bg-emerald-500' : getMinutesAgo(s.last_activity) < 30 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'">
                </span>
              </div>

              <!-- Name + metadata -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-[0.8125rem] font-bold text-slate-800 dark:text-white truncate">{{ s.nombre }}</p>
                  <span *ngIf="s.tipo === 'publicador_simple'"
                    class="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                    PIN
                  </span>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span *ngIf="s.rol" class="text-[0.6875rem] font-semibold text-slate-500 dark:text-slate-400">{{ s.rol }}</span>
                  <span *ngIf="s.rol && s.congregacion" class="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                  <span *ngIf="s.congregacion" class="text-[0.6875rem] text-slate-400 dark:text-slate-500">{{ s.congregacion }}</span>
                </div>
              </div>
            </div>

            <!-- Activity + IP + Kick -->
            <div class="flex items-center gap-3 sm:gap-4 shrink-0 pl-13 sm:pl-0">
              <div class="flex flex-col items-end gap-0.5">
                <span class="text-[0.6875rem] font-bold whitespace-nowrap"
                  [ngClass]="getMinutesAgo(s.last_activity) < 5 ? 'text-emerald-600 dark:text-emerald-400' : getMinutesAgo(s.last_activity) < 30 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'">
                  {{ getTimeAgoLabel(s.last_activity) }}
                </span>
                <span *ngIf="s.ip" class="text-[0.5625rem] text-slate-400 dark:text-slate-600 font-mono">{{ s.ip }}</span>
              </div>
              
              <!-- Botón Kick -->
              <button (click)="kickUser(s.user_id)" [disabled]="isKicking(s.user_id)" title="Cerrar sesión forzosamente"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-50">
                <svg *ngIf="!isKicking(s.user_id)" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span *ngIf="isKicking(s.user_id)" class="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></span>
              </button>
            </div>
          </div>

          <!-- Empty State -->
          <div *ngIf="sesiones().length === 0 && !sessionsLoading()"
            class="py-12 flex flex-col items-center justify-center text-center">
            <div class="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-8 h-8 text-slate-200 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h4 class="text-sm font-bold text-slate-900 dark:text-white mb-1">Sin sesiones activas</h4>
            <p class="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
              No hay usuarios conectados en este momento. Las sesiones aparecerán aquí cuando alguien inicie sesión.
            </p>
          </div>
        </div>

        <!-- Legend -->
        <div *ngIf="sesiones().length > 0" class="flex items-center gap-4 mt-4 px-1">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span class="text-[0.625rem] font-semibold text-slate-400 dark:text-slate-500">Activo (&lt; 5 min)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span class="text-[0.625rem] font-semibold text-slate-400 dark:text-slate-500">Inactivo (&lt; 30 min)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            <span class="text-[0.625rem] font-semibold text-slate-400 dark:text-slate-500">Ausente</span>
          </div>
        </div>
      </div>

      <!-- Modal de Confirmación para Cerrar Sesión -->
      <div *ngIf="userToKick()" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all border border-slate-200 dark:border-slate-800">
          <div class="p-6 sm:p-7">
            <div class="flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 mb-5">
              <svg class="w-6 h-6 text-rose-600 dark:text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">¿Cerrar sesión remotamente?</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 text-center">
              Esta acción eliminará la sesión activa del usuario. El próximo intento de renovar el token fallará y será forzado a iniciar sesión de nuevo.
            </p>
          </div>
          <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button (click)="cancelKick()" [disabled]="isKicking(userToKick()!)"
              class="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-xl transition-colors w-full sm:w-auto disabled:opacity-50 touch-manipulation">
              Cancelar
            </button>
            <button (click)="confirmKickUser()" [disabled]="isKicking(userToKick()!)"
              class="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-md transition-all w-full sm:w-auto disabled:opacity-50 touch-manipulation">
              <span *ngIf="isKicking(userToKick()!)" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              {{ isKicking(userToKick()!) ? 'Cerrando...' : 'Sí, cerrar sesión' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SystemConfigComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  // Map settings
  tileProvider = signal('osm');
  loading = signal(false);
  saving = signal(false);
  notification = signal<{ message: string, type: 'success' | 'error' } | null>(null);

  // Sessions
  sesiones = signal<SesionActiva[]>([]);
  sessionsLoading = signal(false);
  kickingSessions = signal<Set<string>>(new Set());
  userToKick = signal<string | null>(null);

  ngOnInit() {
    this.loadSettings();
    this.loadSessions();

    // Auto-refresh every 30 seconds
    this.pollInterval = setInterval(() => {
      this.loadSessions();
    }, 30_000);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ── Map Settings ──────────────────────────────────────
  loadSettings() {
    this.loading.set(true);
    this.http.get<{ tile_provider: string }>(`${environment.apiUrl}/configuracion/tile-provider`).subscribe({
      next: (res) => {
         this.tileProvider.set(res.tile_provider || 'osm');
         this.loading.set(false);
      },
      error: () => {
         this.tileProvider.set('osm');
         this.loading.set(false);
      }
    });
  }

  saveSettings() {
    this.saving.set(true);
    this.http.put(`${environment.apiUrl}/configuracion/tile-provider`, { tile_provider: this.tileProvider() }).subscribe({
      next: () => {
         this.saving.set(false);
         this.showNotification('Configuración guardada exitosamente', 'success');
      },
      error: () => {
         this.saving.set(false);
         this.showNotification('Error al guardar la configuración', 'error');
      }
    });
  }

  showNotification(message: string, type: 'success' | 'error') {
    this.notification.set({ message, type });
    setTimeout(() => this.notification.set(null), 4000);
  }

  // ── Active Sessions ──────────────────────────────────
  loadSessions() {
    this.sessionsLoading.set(true);
    this.http.get<SesionesResponse>(`${environment.apiUrl}/configuracion/admin/sesiones-activas`).subscribe({
      next: (res) => {
        this.sesiones.set(res.sesiones || []);
        this.sessionsLoading.set(false);
      },
      error: () => {
        this.sessionsLoading.set(false);
      }
    });
  }

  trackSession(_index: number, session: SesionActiva): string {
    return session.user_id;
  }

  getMinutesAgo(isoDate: string): number {
    if (!isoDate) return 999;
    const diff = Date.now() - new Date(isoDate).getTime();
    return Math.floor(diff / 60000);
  }

  getTimeAgoLabel(isoDate: string): string {
    const minutes = this.getMinutesAgo(isoDate);
    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  }

  getActivityClass(session: SesionActiva): string {
    const mins = this.getMinutesAgo(session.last_activity);
    if (mins < 5) {
      return 'bg-white dark:bg-slate-800/60 border-emerald-200/60 dark:border-emerald-800/40';
    }
    if (mins < 30) {
      return 'bg-white dark:bg-slate-800/40 border-amber-200/40 dark:border-amber-800/30';
    }
    return 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-700/30';
  }

  isKicking(userId: string): boolean {
    return this.kickingSessions().has(userId);
  }

  kickUser(userId: string) {
    this.userToKick.set(userId);
  }

  cancelKick() {
    this.userToKick.set(null);
  }

  confirmKickUser() {
    const userId = this.userToKick();
    if (!userId) return;

    const current = new Set(this.kickingSessions());
    current.add(userId);
    this.kickingSessions.set(current);

    this.http.delete(`${environment.apiUrl}/configuracion/admin/sesiones-activas/${userId}`).subscribe({
      next: () => {
        this.showNotification('Sesión cerrada forzosamente', 'success');
        this.loadSessions();
        const updated = new Set(this.kickingSessions());
        updated.delete(userId);
        this.kickingSessions.set(updated);
        this.userToKick.set(null);
      },
      error: (err) => {
        const msg = err.error?.detail || 'Error al cerrar la sesión';
        this.showNotification(msg, 'error');
        const updated = new Set(this.kickingSessions());
        updated.delete(userId);
        this.kickingSessions.set(updated);
        this.userToKick.set(null);
      }
    });
  }
}

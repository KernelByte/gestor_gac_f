import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-system-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="px-5 md:px-7 py-5 md:py-6 max-w-4xl h-full overflow-y-auto">
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
      
      <!-- Toast Alert -->
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
    </div>
  `
})
export class SystemConfigComponent implements OnInit {
  private http = inject(HttpClient);
  
  tileProvider = signal('osm');
  loading = signal(false);
  saving = signal(false);
  notification = signal<{ message: string, type: 'success' | 'error' } | null>(null);

  ngOnInit() {
    this.loadSettings();
  }

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
}

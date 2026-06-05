import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ThemeService } from '../../../core/services/theme.service';
import { EntregaPortalComponent } from '../../secretario-tools/visita-superintendente/components/entrega-portal.component';

interface VistaPublicaBasic {
  nombre_congregacion?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  nombre_superintendente?: string | null;
  expira_en: string;
}

@Component({
  standalone: true,
  selector: 'app-public-visita',
  imports: [CommonModule, EntregaPortalComponent],
  template: `
<div class="min-h-dvh flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">

  <!-- ───── HEADER (marca + tema) ───── -->
  <header class="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md">
    <div class="px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
      <!-- Marca -->
      <div class="flex items-center gap-3 min-w-0">
        <span class="grid place-items-center w-10 h-10 rounded-xl bg-violet-600 shadow-sm shadow-violet-600/30 shrink-0">
          <img src="images/LogoAppMorado.png" class="w-7 h-7" alt="GAC" />
        </span>
        <div class="min-w-0 leading-tight">
          <h1 class="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-50 truncate">
            Visita del Superintendente
          </h1>
          <p class="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <svg class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Enlace temporal seguro
          </p>
        </div>
      </div>

      <!-- Toggle de tema -->
      <button
        type="button"
        (click)="theme.toggleTheme()"
        [attr.aria-label]="theme.darkMode() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
        class="grid place-items-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-violet-600 dark:hover:text-violet-300 transition-colors">
        @if (theme.darkMode()) {
          <!-- Sol -->
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/>
          </svg>
        } @else {
          <!-- Luna -->
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/>
          </svg>
        }
      </button>
    </div>
  </header>

  <!-- Estado: cargando metadatos -->
  @if (loadingMeta()) {
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="text-center">
        <div class="loading-spin mx-auto mb-4"></div>
        <p class="text-sm text-slate-500 dark:text-slate-400">Verificando enlace…</p>
      </div>
    </div>
  }

  <!-- Estado: error de acceso -->
  @if (errorAcceso() && !loadingMeta()) {
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
        <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
          <svg class="w-7 h-7 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>
        <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Enlace no disponible</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ errorAcceso() }}</p>
      </div>
    </div>
  }

  <!-- Portal con todos los datos -->
  @if (token && meta() && !loadingMeta() && !errorAcceso()) {
    <div class="flex-1 flex flex-col min-h-0">
      <app-entrega-portal
        modo="publico"
        [token]="token"
        class="flex-1">
      </app-entrega-portal>
    </div>

    <footer class="text-center py-4 px-4 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900">
      Sistema GAC &mdash; Gestor de Actividades Congregacionales
    </footer>
  }

</div>
  `,
  styles: [`
    :host { display: block; }
    .loading-spin {
      width: 2.25rem; height: 2.25rem; border-radius: 50%;
      border: 3px solid rgba(148,163,184,0.35); border-top-color: #7c3aed;
      animation: spin 700ms linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class PublicVisitaPage implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  theme = inject(ThemeService);

  token = '';
  meta = signal<VistaPublicaBasic | null>(null);
  loadingMeta = signal(true);
  errorAcceso = signal<string | null>(null);

  ngOnInit() {
    this.token = this.route.snapshot.params['token'];
    this.http
      .get<VistaPublicaBasic>(`${environment.apiUrl}/visita-sc/public/${this.token}`)
      .subscribe({
        next: (d) => {
          this.meta.set(d);
          this.loadingMeta.set(false);
        },
        error: (e) => {
          this.errorAcceso.set(
            e?.error?.detail || 'El enlace es inválido o ha expirado.'
          );
          this.loadingMeta.set(false);
        },
      });
  }
}

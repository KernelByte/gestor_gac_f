import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIConfigService, AIConfig, ProcessConfig, ProviderConfig } from '../services/ai-config.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-ai-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 10px;
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }

    @keyframes shimmer {
      100% { transform: translateX(100%); }
    }
    .animate-shimmer {
      animation: shimmer 2s infinite;
    }

    .animate-slideIn {
      animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    .animate-float {
      animation: float 3s ease-in-out infinite;
    }

    .prompt-editor {
      tab-size: 2;
      line-height: 1.7;
    }
    .prompt-editor:focus {
      box-shadow: inset 0 0 0 1px #6d28d9, 0 0 0 4px rgba(109, 40, 217, 0.08);
    }

    .provider-card {
      transition: all 0.2s ease;
    }
    .provider-card:hover {
      background: rgba(109, 40, 217, 0.02);
    }
    .dark .provider-card:hover {
      background: rgba(109, 40, 217, 0.05);
    }
  `],
  template: `
    <div class="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 animate-fadeIn h-full overflow-y-auto overflow-x-hidden custom-scrollbar">

      <!-- Header -->
      <div class="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden">
        <!-- Decorative gradient accent -->
        <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-purple via-purple-400 to-brand-purple/20"></div>

        <div class="flex items-center gap-4">
          <div class="relative">
            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-purple to-purple-500 flex items-center justify-center shadow-lg shadow-brand-purple/20">
              <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900"></div>
          </div>
          <div>
            <h2 class="text-lg md:text-xl font-display font-black text-slate-900 dark:text-white tracking-tight">Cerebros de IA</h2>
            <p class="text-slate-400 dark:text-slate-500 text-xs font-medium mt-0.5">Modelos, APIs y prompts del sistema</p>
          </div>
        </div>

        <button (click)="saveChanges()" [disabled]="loading() || !config()"
          class="relative group overflow-hidden bg-brand-purple hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-purple-500/15 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none sm:w-auto w-full">
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
          <svg *ngIf="!loading()" class="w-4 h-4 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          <span *ngIf="loading()" class="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
          <span class="relative">{{ loading() ? 'Guardando...' : 'Guardar Configuración' }}</span>
        </button>
      </div>

      <div *ngIf="config()" class="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">

        <!-- Sidebar: Proveedores -->
        <div class="xl:col-span-1 space-y-4 order-2 xl:order-1">

          <!-- Provider Cards -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm overflow-hidden">
            <div class="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                <h3 class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Proveedores</h3>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                <span class="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Online</span>
              </div>
            </div>

            <div class="divide-y divide-slate-100 dark:divide-slate-800/80">
              <div *ngFor="let provider of objectKeys(config()!.providers)"
                class="provider-card p-5 space-y-3.5">

                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-colors"
                    [ngClass]="{
                      'bg-blue-50 dark:bg-blue-950/40 text-blue-500 ring-1 ring-blue-100 dark:ring-blue-900/40': provider === 'google',
                      'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-700': provider === 'openai',
                      'bg-orange-50 dark:bg-orange-950/40 text-orange-500 ring-1 ring-orange-100 dark:ring-orange-900/40': provider === 'anthropic',
                      'bg-purple-50 dark:bg-purple-950/40 text-purple-500 ring-1 ring-purple-100 dark:ring-purple-900/40': provider === 'open_source'
                    }">
                    <svg *ngIf="provider === 'google'" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.162-1.9 4.155-1.225 1.225-3.138 2.568-6.94 2.568-5.602 0-10.125-4.522-10.125-10.125s4.523-10.125 10.125-10.125c3.04 0 5.275 1.2 6.94 2.7l2.25-2.25C18.663 1.05 15.825 0 12.48 0 5.58 0 0 5.58 0 12.48s5.58 12.48 12.48 12.48c3.75 0 6.64-1.24 8.86-3.56 2.25-2.25 2.96-5.46 2.96-8.1 0-.78-.06-1.56-.16-2.32h-11.66z"/></svg>
                    <svg *ngIf="provider === 'openai'" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-4.71-3.13 6.04 6.04 0 0 0-5.41 1.954 6.04 6.04 0 0 0-5.41-1.954 6.046 6.046 0 0 0-4.71 3.13 5.98 5.98 0 0 0-.516 4.91 6.04 6.04 0 0 0 1.954 5.41 6.04 6.04 0 0 0-1.954 5.41 5.985 5.985 0 0 0 .516 4.91 6.046 6.046 0 0 0 4.71 3.13c1.11.163 2.24.033 3.286-.38a6.04 6.04 0 0 0 2.124-1.574 6.04 6.04 0 0 0 5.41 1.954 6.046 6.046 0 0 0 4.71-3.13 5.98 5.98 0 0 0 .516-4.91 6.04 6.04 0 0 0-1.954-5.41 6.04 6.04 0 0 0 1.954-5.41z"/></svg>
                    <span *ngIf="provider === 'anthropic'" class="font-black text-xs">Cl</span>
                    <svg *ngIf="provider === 'open_source'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">{{ provider === 'open_source' ? 'Open Source' : provider }}</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <div class="w-1 h-1 rounded-full" [ngClass]="getProvider(provider).api_key ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'"></div>
                      <span class="text-[10px] font-medium" [ngClass]="getProvider(provider).api_key ? 'text-emerald-500' : 'text-slate-400'">
                        {{ getProvider(provider).api_key ? 'Configurada' : 'Sin configurar' }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 pl-0.5">API Key</label>
                    <input type="password" [(ngModel)]="getProvider(provider).api_key"
                      class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-lg text-slate-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      placeholder="sk-••••••••••••••••">
                  </div>

                  <div class="animate-slideIn" *ngIf="provider === 'open_source'">
                    <label class="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 pl-0.5">Base URL</label>
                    <input type="text" [(ngModel)]="getProvider(provider).base_url"
                      class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-lg text-slate-900 dark:text-white font-medium text-[11px] focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all"
                      placeholder="https://api.provider.ai/v1">
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Security notice -->
          <div class="flex items-start gap-3 px-4 py-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/40">
            <svg class="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <p class="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
              Las API Keys se almacenan de forma segura y nunca se comparten con terceros.
            </p>
          </div>
        </div>

        <!-- Main Area: Procesos -->
        <div class="xl:col-span-3 space-y-5 order-1 xl:order-2">
          <div *ngFor="let proc_key of objectKeys(config()!.processes); let i = index"
            class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm flex flex-col min-h-0 transition-all duration-200 hover:shadow-md overflow-hidden animate-slideIn"
            [style.animation-delay]="i * 80 + 'ms'">

            <!-- Process Header -->
            <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="flex items-center gap-3.5">
                <div class="w-10 h-10 shrink-0 rounded-xl bg-brand-purple/8 dark:bg-brand-purple/10 flex items-center justify-center text-brand-purple ring-1 ring-brand-purple/10">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <div class="flex items-center gap-2.5">
                    <h4 class="text-base font-display font-bold text-slate-900 dark:text-white">{{ proc_key }}</h4>
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider ring-1 ring-emerald-200/60 dark:ring-emerald-800/40">
                      <div class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                      Activo
                    </span>
                  </div>
                  <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Motor: {{ config()!.processes[proc_key].provider | titlecase }} / {{ config()!.processes[proc_key].model || '—' }}</p>
                </div>
              </div>

              <div class="flex items-center gap-3 w-full md:w-auto">
                <div class="flex flex-col gap-1.5 flex-1 md:w-44">
                  <label class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-0.5">Proveedor</label>
                  <div class="relative">
                    <select [(ngModel)]="config()!.processes[proc_key].provider"
                      class="form-select !py-2.5 !text-xs !font-bold !rounded-lg">
                      <option *ngFor="let p of objectKeys(config()!.providers)" [value]="p">{{ p | titlecase }}</option>
                    </select>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5 flex-1 md:w-48">
                  <label class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-0.5">Modelo</label>
                  <input type="text" [(ngModel)]="config()!.processes[proc_key].model"
                    class="form-control !py-2.5 !text-xs !font-bold !rounded-lg font-mono"
                    placeholder="gemini-1.5-flash">
                </div>
              </div>
            </div>

            <!-- Prompt Editor -->
            <div class="p-5 sm:p-6 space-y-3">
              <div class="flex items-center justify-between">
                <label class="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                  System Prompt
                </label>
                <div class="flex items-center gap-3">
                  <span class="flex items-center gap-1 text-[10px] font-medium text-emerald-500">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Guardrails
                  </span>
                  <span class="flex items-center gap-1 text-[10px] font-medium text-blue-500">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    JSON
                  </span>
                </div>
              </div>
              <div class="relative">
                <textarea [(ngModel)]="config()!.processes[proc_key].prompt" rows="16"
                  class="prompt-editor w-full p-5 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-[13px] focus:border-brand-purple outline-none resize-none transition-all custom-scrollbar"
                  placeholder="Defina el comportamiento y formato esperado del modelo..."></textarea>
              </div>
              <div class="flex items-center justify-between px-1">
                <p class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  Optimizado para <span class="text-brand-purple font-bold">{{ config()!.processes[proc_key].provider | titlecase }}</span> · {{ config()!.processes[proc_key].model }}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Pulse loader if no config -->
      <div *ngIf="!config()" class="flex flex-col items-center justify-center py-28 sm:py-36">
        <div class="relative w-16 h-16 mb-5">
          <div class="absolute inset-0 border-[3px] border-slate-200 dark:border-slate-800 rounded-full"></div>
          <div class="absolute inset-0 border-[3px] border-t-brand-purple rounded-full animate-spin"></div>
        </div>
        <p class="font-bold text-slate-400 dark:text-slate-500 text-sm">Cargando configuración...</p>
      </div>
    </div>
  `
})
export class AIConfigComponent implements OnInit {
  private service = inject(AIConfigService);
  
  config = this.service.config;
  loading = this.service.loading;

  ngOnInit() {
    this.service.getConfig().subscribe();
  }

  objectKeys(obj: any) {
    return Object.keys(obj);
  }

  getProvider(name: string): ProviderConfig {
    return this.config()!.providers[name];
  }

  saveChanges() {
    if (this.config()) {
      this.service.saveConfig(this.config()!).subscribe({
        next: () => alert('Configuración guardada exitosamente.'),
        error: (err) => alert('Error al guardar: ' + err.message)
      });
    }
  }
}

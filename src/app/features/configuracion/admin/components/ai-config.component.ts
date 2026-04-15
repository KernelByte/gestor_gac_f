import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIConfigService, AIConfig, ProcessConfig, ProviderConfig } from '../services/ai-config.service';

@Component({
  selector: 'app-ai-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 10px;
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-slideIn {
      animation: slideIn 0.2s ease-out;
    }

    .prompt-editor {
      tab-size: 2;
      line-height: 1.7;
      height: 0;
      min-height: 0;
    }
    .prompt-editor:focus {
      box-shadow: inset 0 0 0 1px #6d28d9, 0 0 0 3px rgba(109, 40, 217, 0.08);
    }

    .provider-card {
      transition: background 0.15s ease;
    }
    .provider-card:hover {
      background: rgba(109, 40, 217, 0.02);
    }
    .dark .provider-card:hover {
      background: rgba(109, 40, 217, 0.04);
    }
  `],
  template: `
    <!-- Root: fills available height, no scroll on container -->
    <div class="h-full flex flex-col overflow-hidden bg-app-bg dark:bg-slate-950">

      <!-- Header bar -->
      <div class="shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60">
        <div class="flex items-center gap-2.5">
          <svg class="w-5 h-5 text-brand-purple shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 3a2 2 0 002 2h2a2 2 0 002-2M9 3a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <div>
            <h2 class="text-base font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">Cerebros de IA</h2>
            <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium leading-tight">Modelos, APIs y prompts del sistema</p>
          </div>
        </div>

        <button (click)="saveChanges()" [disabled]="loading() || !config()"
          class="relative group overflow-hidden bg-brand-purple hover:bg-purple-700 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none">
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
          <svg *ngIf="!loading()" class="w-4 h-4 relative shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span *ngIf="loading()" class="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full shrink-0"></span>
          <span class="relative">{{ loading() ? 'Guardando...' : 'Guardar' }}</span>
        </button>
      </div>

      <!-- Loading state -->
      <div *ngIf="!config()" class="flex-1 flex flex-col items-center justify-center">
        <div class="relative w-12 h-12 mb-4">
          <div class="absolute inset-0 border-[3px] border-slate-200 dark:border-slate-800 rounded-full"></div>
          <div class="absolute inset-0 border-[3px] border-t-brand-purple rounded-full animate-spin"></div>
        </div>
        <p class="font-bold text-slate-400 dark:text-slate-500 text-sm">Cargando configuración...</p>
      </div>

      <!-- 3-panel body -->
      <div *ngIf="config()" class="flex-1 min-h-0 flex gap-3 p-3">

        <!-- Panel izquierdo: Proveedores -->
        <div class="w-[205px] shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar">

          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
            <div class="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <h3 class="text-[0.6875rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Proveedores</h3>
            </div>

            <div class="divide-y divide-slate-100 dark:divide-slate-800/80">
              <div *ngFor="let provider of objectKeys(config()!.providers)"
                class="provider-card p-3 space-y-3">

                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-slate-100 dark:ring-slate-700/60 bg-white dark:bg-slate-800">
                    <!-- Google Gemini: 4-pointed star with brand gradient -->
                    <svg *ngIf="provider === 'google'" class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="gem-g" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stop-color="#1AA260"/>
                          <stop offset="35%" stop-color="#4285F4"/>
                          <stop offset="70%" stop-color="#EA4335"/>
                          <stop offset="100%" stop-color="#FBBC04"/>
                        </linearGradient>
                      </defs>
                      <path fill="url(#gem-g)" d="M12 2C11.7 7.2 9.1 10 2 12C9.1 14 11.7 16.8 12 22C12.3 16.8 14.9 14 22 12C14.9 10 12.3 7.2 12 2Z"/>
                    </svg>
                    <!-- OpenAI: knot logo -->
                    <svg *ngIf="provider === 'openai'" class="w-4 h-4" viewBox="0 0 24 24" fill="#10A37F">
                      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 8.05a4.475 4.475 0 0 1 2.33-1.977V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.06 14.218A4.5 4.5 0 0 1 2.34 8.051zm16.597 3.855l-5.843-3.387 2.02-1.164a.076.076 0 0 1 .072 0l4.583 2.648a4.5 4.5 0 0 1-.695 8.108v-5.526a.795.795 0 0 0-.137-.679zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.402V7.07a.07.07 0 0 1 .028-.061l4.576-2.644a4.5 4.5 0 0 1 6.934 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                    </svg>
                    <!-- Anthropic: asterisk/sunburst -->
                    <svg *ngIf="provider === 'anthropic'" class="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <g transform="translate(12,12)" fill="#D4674A">
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(0)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(30)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(60)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(90)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(120)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(150)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(180)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(210)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(240)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(270)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(300)"/>
                        <rect x="-1.1" y="-9.5" width="2.2" height="6.5" rx="1.1" transform="rotate(330)"/>
                      </g>
                    </svg>
                    <!-- Open Source -->
                    <svg *ngIf="provider === 'open_source'" class="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize block truncate">
                      {{ provider === 'open_source' ? 'Open Source' : provider }}
                    </span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <div class="w-1.5 h-1.5 rounded-full shrink-0"
                        [ngClass]="getProvider(provider).api_key ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'">
                      </div>
                      <span class="text-[0.625rem] font-medium"
                        [ngClass]="getProvider(provider).api_key ? 'text-emerald-500' : 'text-slate-400'">
                        {{ getProvider(provider).api_key ? 'Configurada' : 'Sin configurar' }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="space-y-2">
                  <div>
                    <label class="block text-[0.625rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 pl-0.5">API Key</label>
                    <div class="relative">
                      <input [type]="isKeyVisible(provider) ? 'text' : 'password'" [(ngModel)]="getProvider(provider).api_key"
                        class="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-lg text-slate-900 dark:text-white font-medium text-xs focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        placeholder="sk-••••••••••••••••">
                      <button type="button" (click)="toggleKeyVisibility(provider)"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        <!-- Eye off -->
                        <svg *ngIf="!isKeyVisible(provider)" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                        <!-- Eye -->
                        <svg *ngIf="isKeyVisible(provider)" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div *ngIf="provider === 'open_source'">
                    <label class="block text-[0.625rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 pl-0.5">Base URL</label>
                    <input type="text" [(ngModel)]="getProvider(provider).base_url"
                      class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-lg text-slate-900 dark:text-white font-medium text-[0.6875rem] focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all"
                      placeholder="https://api.provider.ai/v1">
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Security notice -->
          <div class="flex items-start gap-2.5 px-3 py-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/40">
            <svg class="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
              Las API Keys se almacenan de forma segura y nunca se comparten con terceros.
            </p>
          </div>

        </div>

        <!-- Panel centro: Lista de procesos -->
        <div class="w-[205px] shrink-0 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">

          <!-- Panel header -->
          <div class="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <span class="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Procesos</span>
            </div>
            <button (click)="openAddModal()"
              class="w-6 h-6 rounded-md bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple flex items-center justify-center transition-colors"
              title="Agregar proceso">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <!-- Process list -->
          <div class="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/60">
            <button *ngFor="let key of objectKeys(config()!.processes)"
              (click)="selectedProcessKey.set(key)"
              class="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 group transition-colors"
              [ngClass]="selectedProcessKey() === key
                ? 'bg-brand-purple/[0.07] dark:bg-brand-purple/10'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-bold truncate"
                  [ngClass]="selectedProcessKey() === key ? 'text-brand-purple' : 'text-slate-800 dark:text-slate-200'">
                  {{ key }}
                </div>
                <div *ngIf="config()!.processes[key].description"
                  class="text-[0.625rem] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {{ config()!.processes[key].description }}
                </div>
              </div>
              <!-- Delete button: visible on hover -->
              <button (click)="$event.stopPropagation(); deleteProcess(key)"
                class="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition-all shrink-0"
                title="Eliminar proceso">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </button>

            <!-- Empty state -->
            <div *ngIf="objectKeys(config()!.processes).length === 0"
              class="px-3 py-8 flex flex-col items-center gap-2 text-center">
              <svg class="w-8 h-8 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium">Sin procesos.<br>Usa "+" para agregar uno.</p>
            </div>
          </div>

        </div>

        <!-- Panel derecho: Editor -->
        <div class="flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">

          <!-- Editor con proceso seleccionado -->
          <ng-container *ngIf="selectedProcess() && selectedProcessKey(); else noSelection">

            <!-- Editor header -->
            <div class="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-3">
              <div class="flex-1 min-w-0">
                <div class="text-[0.625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Proceso activo</div>
                <h4 class="text-base font-display font-bold text-slate-900 dark:text-white truncate font-mono">{{ selectedProcessKey() }}</h4>
                <p *ngIf="selectedProcess()?.description"
                  class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {{ selectedProcess()!.description }}
                </p>
              </div>

              <!-- Provider select -->
              <div class="flex flex-col gap-1 w-36">
                <label class="text-[0.625rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Proveedor</label>
                <select [(ngModel)]="config()!.processes[selectedProcessKey()!].provider"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-lg text-slate-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all appearance-none cursor-pointer">
                  <option *ngFor="let p of objectKeys(config()!.providers)" [value]="p">
                    {{ p === 'open_source' ? 'Open Source' : (p | titlecase) }}
                  </option>
                </select>
              </div>

              <!-- Model select -->
              <div class="flex flex-col gap-1 w-52">
                <label class="text-[0.625rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Modelo</label>
                <select [(ngModel)]="config()!.processes[selectedProcessKey()!].model"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-lg text-slate-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all appearance-none cursor-pointer">
                  <option *ngFor="let m of getModelsForProvider(config()!.processes[selectedProcessKey()!].provider)" [value]="m.id">
                    {{ m.label }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Prompt editor (fills remaining height) -->
            <div class="flex-1 min-h-0 flex flex-col p-3 gap-2">
              <label class="shrink-0 flex items-center gap-1.5 text-[0.6875rem] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                System Prompt
              </label>
              <textarea [(ngModel)]="config()!.processes[selectedProcessKey()!].prompt"
                class="prompt-editor flex-1 w-full p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-[0.8125rem] focus:border-brand-purple outline-none resize-none transition-all custom-scrollbar"
                placeholder="Defina el comportamiento y formato esperado del modelo...">
              </textarea>
              <p class="shrink-0 text-[0.625rem] text-slate-400 dark:text-slate-500 font-medium px-1">
                Optimizado para <span class="text-brand-purple font-bold">{{ config()!.processes[selectedProcessKey()!].provider === 'open_source' ? 'Open Source' : (config()!.processes[selectedProcessKey()!].provider | titlecase) }}</span>
                · {{ config()!.processes[selectedProcessKey()!].model || '—' }}
              </p>
            </div>

          </ng-container>

          <!-- Sin selección -->
          <ng-template #noSelection>
            <div class="flex-1 flex flex-col items-center justify-center text-center gap-2">
              <svg class="w-10 h-10 text-slate-300 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <p class="text-sm font-bold text-slate-400 dark:text-slate-500">Selecciona un proceso</p>
              <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500">o crea uno nuevo con el botón "+"</p>
            </div>
          </ng-template>

        </div>

      </div>

    </div>

    <!-- Modal: Agregar Proceso -->
    <div *ngIf="showAddModal()"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      (click)="showAddModal.set(false)">
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-slideIn"
        (click)="$event.stopPropagation()" role="dialog" aria-modal="true">

        <!-- Modal header -->
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <svg class="w-4.5 h-4.5 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="text-base font-display font-bold text-slate-900 dark:text-white">Nuevo Proceso</h3>
          </div>
          <button (click)="showAddModal.set(false)"
            class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Modal body -->
        <div class="px-5 py-4 space-y-3.5">

          <!-- Error -->
          <div *ngIf="addError()"
            class="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs font-medium text-red-600 dark:text-red-400">
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ addError() }}
          </div>

          <!-- Identificador -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Identificador <span class="text-red-400">*</span>
            </label>
            <input type="text" [(ngModel)]="newKey"
              class="form-control !py-2 !text-sm font-mono"
              placeholder="ej: carta_servicio"
              (input)="addError.set(null)">
            <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 mt-1 ml-0.5">Solo letras, números y guiones bajos. No se puede modificar luego.</p>
          </div>

          <!-- Descripción -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Descripción <span class="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
            </label>
            <input type="text" [(ngModel)]="newDescription"
              class="form-control !py-2 !text-sm"
              placeholder="ej: Analiza cartas de servicio del campo">
          </div>

          <!-- Proveedor -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Proveedor</label>
            <select [(ngModel)]="newProvider" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-lg text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all appearance-none cursor-pointer">
              <option *ngFor="let p of objectKeys(config()!.providers)" [value]="p">
                {{ p === 'open_source' ? 'Open Source' : (p | titlecase) }}
              </option>
            </select>
          </div>

          <!-- Modelo -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Modelo</label>
            <select [(ngModel)]="newModel" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-lg text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all appearance-none cursor-pointer">
              <option value="" disabled>Selecciona un modelo</option>
              <option *ngFor="let m of getModelsForProvider(newProvider)" [value]="m.id">
                {{ m.label }}
              </option>
            </select>
          </div>

          <!-- System Prompt inicial -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              System Prompt <span class="text-slate-400 dark:text-slate-500 font-normal">(opcional, editable luego)</span>
            </label>
            <textarea [(ngModel)]="newPrompt" rows="5"
              class="w-full p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-xs focus:border-brand-purple outline-none resize-none transition-all custom-scrollbar"
              placeholder="Instrucciones del sistema..."></textarea>
          </div>

        </div>

        <!-- Modal footer -->
        <div class="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button (click)="showAddModal.set(false)"
            class="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button (click)="addProcess()"
            class="px-5 py-2 rounded-xl bg-brand-purple hover:bg-purple-700 text-white text-sm font-bold shadow-sm transition-colors">
            Agregar
          </button>
        </div>

      </div>
    </div>

    <!-- Toast notification -->
    <div *ngIf="toast()" class="fixed bottom-6 right-6 z-[100] animate-slideIn">
      <div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border"
        [ngClass]="toast()!.type === 'success'
          ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800'
          : 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-800'">
        <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          [ngClass]="toast()!.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'">
          <svg *ngIf="toast()!.type === 'success'" class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg *ngIf="toast()!.type === 'error'" class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <span class="text-sm font-bold"
          [ngClass]="toast()!.type === 'success' ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'">
          {{ toast()!.message }}
        </span>
        <button (click)="toast.set(null)"
          class="ml-1 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  `
})
export class AIConfigComponent implements OnInit, OnDestroy {
  private service = inject(AIConfigService);

  config = this.service.config;
  loading = this.service.loading;

  // Master-detail selection
  selectedProcessKey = signal<string | null>(null);

  // API key visibility toggle per provider
  shownKeys = signal<Set<string>>(new Set());
  toggleKeyVisibility(provider: string) {
    const s = new Set(this.shownKeys());
    s.has(provider) ? s.delete(provider) : s.add(provider);
    this.shownKeys.set(s);
  }
  isKeyVisible(provider: string): boolean {
    return this.shownKeys().has(provider);
  }

  // Add modal
  showAddModal = signal(false);
  addError = signal<string | null>(null);
  newKey = '';
  newDescription = '';
  newProvider = '';
  newModel = '';
  newPrompt = '';

  // Toast
  toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  private toastTimer: any = null;

  // Computed: selected process object
  selectedProcess = computed<ProcessConfig | null>(() => {
    const cfg = this.config();
    const key = this.selectedProcessKey();
    if (!cfg || !key) return null;
    return cfg.processes[key] ?? null;
  });

  ngOnInit() {
    this.service.getConfig().subscribe(() => {
      const cfg = this.config();
      if (cfg) {
        const keys = Object.keys(cfg.processes);
        if (keys.length > 0) this.selectedProcessKey.set(keys[0]);
      }
    });
  }

  ngOnDestroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  readonly providerModels: Record<string, { id: string; label: string }[]> = {
    google: [
      { id: 'gemini-2.5-pro-exp-03-25', label: 'Gemini 2.5 Pro (exp)' },
      { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash-lite',     label: 'Gemini 2.0 Flash Lite' },
    ],
    openai: [
      { id: 'gpt-5.4-mini',    label: 'GPT-5.4 Mini' },
      { id: 'gpt-4o',          label: 'GPT-4o' },
      { id: 'gpt-4o-mini',     label: 'GPT-4o Mini' },
      { id: 'o3-mini',         label: 'o3 Mini' },
      { id: 'o1',              label: 'o1' },
      { id: 'o1-mini',         label: 'o1 Mini' },
      { id: 'gpt-4-turbo',     label: 'GPT-4 Turbo' },
    ],
    anthropic: [
      { id: 'claude-opus-4-6',              label: 'Claude Opus 4.6' },
      { id: 'claude-sonnet-4-6',            label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001',    label: 'Claude Haiku 4.5' },
      { id: 'claude-3-5-sonnet-20241022',   label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022',    label: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229',       label: 'Claude 3 Opus' },
    ],
    open_source: [
      { id: 'meta-llama/llama-3.3-70b-instruct',   label: 'Llama 3.3 70B' },
      { id: 'meta-llama/llama-3.1-8b-instruct',    label: 'Llama 3.1 8B' },
      { id: 'deepseek/deepseek-r1',                label: 'DeepSeek R1' },
      { id: 'deepseek/deepseek-chat-v3-0324',      label: 'DeepSeek V3' },
      { id: 'mistralai/mistral-7b-instruct',       label: 'Mistral 7B' },
      { id: 'mistralai/mixtral-8x7b-instruct',     label: 'Mixtral 8x7B' },
      { id: 'qwen/qwen-2.5-72b-instruct',          label: 'Qwen 2.5 72B' },
    ],
  };

  getModelsForProvider(provider: string): { id: string; label: string }[] {
    return this.providerModels[provider] ?? [];
  }

  objectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  getProvider(name: string): ProviderConfig {
    return this.config()!.providers[name];
  }

  openAddModal() {
    this.newKey = '';
    this.newDescription = '';
    this.newModel = '';
    this.newPrompt = '';
    this.addError.set(null);
    const cfg = this.config();
    this.newProvider = cfg ? Object.keys(cfg.providers)[0] : '';
    this.showAddModal.set(true);
  }

  addProcess() {
    const key = this.newKey.trim();
    if (!key) { this.addError.set('El identificador no puede estar vacío.'); return; }
    if (!/^[a-z0-9_]+$/i.test(key)) { this.addError.set('Solo letras, números y guiones bajos. Sin espacios.'); return; }
    const cfg = this.config();
    if (!cfg) return;
    if (cfg.processes[key]) { this.addError.set('Ya existe un proceso con ese identificador.'); return; }

    const newProcess: ProcessConfig = {
      provider: this.newProvider || Object.keys(cfg.providers)[0],
      model: this.newModel.trim(),
      prompt: this.newPrompt.trim(),
      ...(this.newDescription.trim() && { description: this.newDescription.trim() })
    };

    const updated: AIConfig = {
      ...cfg,
      processes: { ...cfg.processes, [key]: newProcess }
    };
    this.service.config.set(updated);
    this.selectedProcessKey.set(key);
    this.showAddModal.set(false);
  }

  deleteProcess(key: string) {
    const cfg = this.config();
    if (!cfg) return;
    const { [key]: _, ...remaining } = cfg.processes as { [k: string]: ProcessConfig };
    const updated: AIConfig = { ...cfg, processes: remaining };
    this.service.config.set(updated);
    const keys = Object.keys(remaining);
    this.selectedProcessKey.set(keys[0] ?? null);
  }

  saveChanges() {
    if (this.config()) {
      this.service.saveConfig(this.config()!).subscribe({
        next: () => this.showToast('success', 'Configuración guardada correctamente.'),
        error: (err: any) => this.showToast('error', 'Error: ' + (err.error?.detail || err.message))
      });
    }
  }

  showToast(type: 'success' | 'error', message: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ type, message });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import {
   BackupService,
   BackupHistorial,
   BackupProgramacion,
} from '../services/backup.service';

interface CongregacionOption {
   id_congregacion: number;
   nombre_congregacion: string;
}

@Component({
   selector: 'app-db-backup',
   standalone: true,
   imports: [CommonModule, FormsModule],
   styles: [`
      .custom-scrollbar::-webkit-scrollbar { width: 5px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }

      @keyframes slideIn {
         from { opacity: 0; transform: translateY(8px); }
         to { opacity: 1; transform: translateY(0); }
      }
      .animate-slideIn { animation: slideIn 0.25s ease-out; }

      @keyframes pulse-ring {
         0% { transform: scale(0.8); opacity: 1; }
         100% { transform: scale(2); opacity: 0; }
      }
      .pulse-ring { animation: pulse-ring 1.5s ease-out infinite; }
   `],
   template: `
      <div class="h-full flex flex-col overflow-hidden bg-[#f3f4f6] dark:bg-slate-950">

         <!-- Header -->
         <div class="shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60">
            <div class="flex items-center gap-2.5">
               <svg class="w-5 h-5 text-brand-purple shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                     d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
               </svg>
               <div>
                  <h2 class="text-base font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">Respaldo de Base de Datos</h2>
                  <p class="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-tight">Copias de seguridad y programación automática</p>
               </div>
            </div>
         </div>

         <!-- Sub Navigation -->
         <div class="shrink-0 flex items-center gap-1 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60">
            <button (click)="setSection('backup')" type="button"
               class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
               [ngClass]="activeSection() === 'backup'
                  ? 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'">
               Crear Respaldo
            </button>
            <button (click)="setSection('historial')" type="button"
               class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
               [ngClass]="activeSection() === 'historial'
                  ? 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'">
               Historial
            </button>
            <button (click)="setSection('programacion')" type="button"
               class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
               [ngClass]="activeSection() === 'programacion'
                  ? 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'">
               Programar
            </button>
         </div>

         <!-- Content -->
         <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">

            <!-- Notification -->
            <div *ngIf="notification()" class="animate-slideIn rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
               [ngClass]="notification()!.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'">
               <svg *ngIf="notification()!.type === 'success'" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
               </svg>
               <svg *ngIf="notification()!.type === 'error'" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
               </svg>
               {{ notification()!.message }}
            </div>

            <!-- ===== CREAR RESPALDO ===== -->
            <div *ngIf="activeSection() === 'backup'" class="animate-slideIn space-y-4">

               <!-- Tipo de Backup -->
               <div class="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                  <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white mb-4">Tipo de Respaldo</h3>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <button (click)="tipoBackup.set('completo')" type="button"
                        class="p-4 rounded-xl border-2 transition-all text-left"
                        [ngClass]="tipoBackup() === 'completo'
                           ? 'border-brand-purple bg-brand-purple/5 dark:bg-brand-purple/10'
                           : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'">
                        <div class="flex items-center gap-3">
                           <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              [ngClass]="tipoBackup() === 'completo' ? 'bg-brand-purple/10 text-brand-purple' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'">
                              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                              </svg>
                           </div>
                           <div>
                              <p class="font-bold text-sm text-slate-900 dark:text-white">Base de datos completa</p>
                              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Toda la información del sistema</p>
                           </div>
                        </div>
                     </button>

                     <button (click)="tipoBackup.set('congregacion')" type="button"
                        class="p-4 rounded-xl border-2 transition-all text-left"
                        [ngClass]="tipoBackup() === 'congregacion'
                           ? 'border-brand-purple bg-brand-purple/5 dark:bg-brand-purple/10'
                           : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'">
                        <div class="flex items-center gap-3">
                           <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              [ngClass]="tipoBackup() === 'congregacion' ? 'bg-brand-purple/10 text-brand-purple' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'">
                              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                           </div>
                           <div>
                              <p class="font-bold text-sm text-slate-900 dark:text-white">Por congregaci&oacute;n</p>
                              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Datos de una congregaci&oacute;n espec&iacute;fica</p>
                           </div>
                        </div>
                     </button>
                  </div>

                  <!-- Congregacion Selector -->
                  <div *ngIf="tipoBackup() === 'congregacion'" class="mt-4 animate-slideIn">
                     <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Seleccionar Congregaci&oacute;n</label>
                     <select [(ngModel)]="congregacionSeleccionada"
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors">
                        <option [ngValue]="null" disabled>-- Selecciona una congregaci&oacute;n --</option>
                        <option *ngFor="let c of congregaciones()" [ngValue]="c.id_congregacion">
                           {{ c.nombre_congregacion }}
                        </option>
                     </select>
                  </div>
               </div>

               <!-- Email Options -->
               <div class="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                  <div class="flex items-center justify-between">
                     <div>
                        <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white">Enviar por correo</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enviar copia del respaldo al correo indicado</p>
                     </div>
                     <button (click)="enviarEmail.set(!enviarEmail())" type="button"
                        class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                        [ngClass]="enviarEmail() ? 'bg-brand-purple' : 'bg-slate-300 dark:bg-slate-600'">
                        <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                           [ngClass]="enviarEmail() ? 'translate-x-5' : 'translate-x-0'"></span>
                     </button>
                  </div>

                  <div *ngIf="enviarEmail()" class="mt-4 animate-slideIn">
                     <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Correo electr&oacute;nico</label>
                     <input [(ngModel)]="emailDestino" type="email" placeholder="ejemplo@correo.com"
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors">
                  </div>
               </div>

               <!-- Action Button -->
               <button (click)="ejecutarBackup()" type="button"
                  [disabled]="ejecutando() || (tipoBackup() === 'congregacion' && !congregacionSeleccionada())"
                  class="w-full bg-brand-purple hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-md shadow-brand-purple/20 transition-all flex items-center justify-center gap-2.5">
                  <svg *ngIf="!ejecutando()" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <svg *ngIf="ejecutando()" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                     <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                     <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  {{ ejecutando() ? 'Generando respaldo...' : 'Crear Respaldo' }}
               </button>

               <!-- Last Backup Info -->
               <div *ngIf="ultimoBackup()" class="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-4">
                  <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">&Uacute;ltimo respaldo</p>
                  <div class="flex items-center gap-3">
                     <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        [ngClass]="ultimoBackup()!.estado === 'completado' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'bg-red-100 dark:bg-red-900/40 text-red-600'">
                        <svg *ngIf="ultimoBackup()!.estado === 'completado'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <svg *ngIf="ultimoBackup()!.estado !== 'completado'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                     </div>
                     <div class="min-w-0 flex-1">
                        <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ ultimoBackup()!.nombre_archivo }}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">
                           {{ formatFecha(ultimoBackup()!.fecha_creacion) }}
                           <span *ngIf="ultimoBackup()!.tamano_mb"> &middot; {{ ultimoBackup()!.tamano_mb }} MB</span>
                        </p>
                     </div>
                  </div>
               </div>
            </div>

            <!-- ===== HISTORIAL ===== -->
            <div *ngIf="activeSection() === 'historial'" class="animate-slideIn space-y-3">

               <!-- Empty State -->
               <div *ngIf="!loadingHistorial() && historial().length === 0"
                  class="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-8 text-center">
                  <div class="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                     <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                           d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                     </svg>
                  </div>
                  <p class="text-sm font-bold text-slate-900 dark:text-white">Sin respaldos</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">A&uacute;n no se han creado respaldos de la base de datos</p>
               </div>

               <!-- Loading -->
               <div *ngIf="loadingHistorial()" class="flex items-center justify-center py-12">
                  <svg class="w-6 h-6 animate-spin text-brand-purple" fill="none" viewBox="0 0 24 24">
                     <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                     <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
               </div>

               <!-- Backup List -->
               <div *ngFor="let backup of historial()"
                  class="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-4 flex items-center gap-3">

                  <!-- Status Icon -->
                  <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                     [ngClass]="{
                        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600': backup.estado === 'completado',
                        'bg-red-100 dark:bg-red-900/40 text-red-600': backup.estado === 'error',
                        'bg-amber-100 dark:bg-amber-900/40 text-amber-600': backup.estado === 'en_progreso'
                     }">
                     <svg *ngIf="backup.estado === 'completado'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                     </svg>
                     <svg *ngIf="backup.estado === 'error'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                     </svg>
                     <svg *ngIf="backup.estado === 'en_progreso'" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                     </svg>
                  </div>

                  <!-- Info -->
                  <div class="min-w-0 flex-1">
                     <div class="flex items-center gap-2">
                        <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ backup.nombre_archivo }}</p>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0"
                           [ngClass]="backup.tipo === 'completo'
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                              : 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400'">
                           {{ backup.tipo === 'completo' ? 'Completo' : backup.nombre_congregacion || 'Congregaci\u00f3n' }}
                        </span>
                     </div>
                     <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {{ formatFecha(backup.fecha_creacion) }}
                        <span *ngIf="backup.tamano_mb"> &middot; {{ backup.tamano_mb }} MB</span>
                        <span *ngIf="backup.iniciado_por"> &middot; por {{ backup.iniciado_por }}</span>
                        <span *ngIf="backup.enviado_por_email" class="text-emerald-600 dark:text-emerald-400"> &middot; enviado a {{ backup.email_destino }}</span>
                     </p>
                     <p *ngIf="backup.mensaje_error" class="text-xs text-red-500 dark:text-red-400 mt-1 truncate">{{ backup.mensaje_error }}</p>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1 shrink-0">
                     <button *ngIf="backup.estado === 'completado'" (click)="descargarBackup(backup)" type="button"
                        class="p-2 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-brand-purple/5 dark:hover:bg-brand-purple/10 transition-colors" title="Descargar">
                        <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                     </button>
                     <button (click)="confirmarEliminar(backup)" type="button"
                        class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
                        <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                     </button>
                  </div>
               </div>
            </div>

            <!-- ===== PROGRAMACION ===== -->
            <div *ngIf="activeSection() === 'programacion'" class="animate-slideIn space-y-4">

               <!-- Enable Toggle -->
               <div class="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                  <div class="flex items-center justify-between">
                     <div>
                        <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white">Respaldo autom&aacute;tico</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Programar respaldos peri&oacute;dicos de la base de datos</p>
                     </div>
                     <button (click)="scheduleHabilitado.set(!scheduleHabilitado())" type="button"
                        class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                        [ngClass]="scheduleHabilitado() ? 'bg-brand-purple' : 'bg-slate-300 dark:bg-slate-600'">
                        <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                           [ngClass]="scheduleHabilitado() ? 'translate-x-5' : 'translate-x-0'"></span>
                     </button>
                  </div>
               </div>

               <!-- Schedule Config -->
               <div *ngIf="scheduleHabilitado()" class="animate-slideIn space-y-4">

                  <!-- Frequency -->
                  <div class="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                     <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Frecuencia</label>
                     <select [(ngModel)]="scheduleFrecuencia"
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors">
                        <option [ngValue]="6">Cada 6 horas</option>
                        <option [ngValue]="12">Cada 12 horas</option>
                        <option [ngValue]="24">Cada 24 horas (diario)</option>
                        <option [ngValue]="48">Cada 48 horas</option>
                        <option [ngValue]="72">Cada 72 horas</option>
                        <option [ngValue]="168">Cada 7 d&iacute;as (semanal)</option>
                     </select>
                  </div>

                  <!-- Type -->
                  <div class="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                     <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Tipo de respaldo</label>
                     <select [(ngModel)]="scheduleTipo"
                        class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors">
                        <option value="completo">Base de datos completa</option>
                        <option value="congregacion">Por congregaci&oacute;n</option>
                     </select>

                     <div *ngIf="scheduleTipo() === 'congregacion'" class="mt-3 animate-slideIn">
                        <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Congregaci&oacute;n</label>
                        <select [(ngModel)]="scheduleCongregacion"
                           class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors">
                           <option [ngValue]="null" disabled>-- Seleccionar --</option>
                           <option *ngFor="let c of congregaciones()" [ngValue]="c.id_congregacion">
                              {{ c.nombre_congregacion }}
                           </option>
                        </select>
                     </div>
                  </div>

                  <!-- Schedule Email -->
                  <div class="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                     <div class="flex items-center justify-between">
                        <div>
                           <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white">Enviar por correo</h3>
                           <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enviar copia autom&aacute;ticamente</p>
                        </div>
                        <button (click)="scheduleEmail.set(!scheduleEmail())" type="button"
                           class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                           [ngClass]="scheduleEmail() ? 'bg-brand-purple' : 'bg-slate-300 dark:bg-slate-600'">
                           <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                              [ngClass]="scheduleEmail() ? 'translate-x-5' : 'translate-x-0'"></span>
                        </button>
                     </div>
                     <div *ngIf="scheduleEmail()" class="mt-4 animate-slideIn">
                        <input [(ngModel)]="scheduleEmailDestino" type="email" placeholder="ejemplo@correo.com"
                           class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-colors">
                     </div>
                  </div>

                  <!-- Save Button -->
                  <button (click)="guardarProgramacion()" type="button"
                     [disabled]="guardandoProgramacion()"
                     class="w-full bg-brand-purple hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-md shadow-brand-purple/20 transition-all flex items-center justify-center gap-2.5">
                     <svg *ngIf="!guardandoProgramacion()" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                     </svg>
                     <svg *ngIf="guardandoProgramacion()" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                     </svg>
                     {{ guardandoProgramacion() ? 'Guardando...' : 'Guardar Programaci\u00f3n' }}
                  </button>
               </div>

               <!-- Schedule Status -->
               <div *ngIf="programacion()" class="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-4">
                  <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Estado de programaci&oacute;n</p>
                  <div class="space-y-2">
                     <div class="flex items-center justify-between">
                        <span class="text-xs text-slate-500 dark:text-slate-400">Estado</span>
                        <span class="text-xs font-bold" [ngClass]="programacion()!.habilitado ? 'text-emerald-600' : 'text-slate-400'">
                           {{ programacion()!.habilitado ? 'Activo' : 'Inactivo' }}
                        </span>
                     </div>
                     <div *ngIf="programacion()!.ultima_ejecucion" class="flex items-center justify-between">
                        <span class="text-xs text-slate-500 dark:text-slate-400">&Uacute;ltima ejecuci&oacute;n</span>
                        <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ formatFecha(programacion()!.ultima_ejecucion!) }}</span>
                     </div>
                     <div *ngIf="programacion()!.proxima_ejecucion" class="flex items-center justify-between">
                        <span class="text-xs text-slate-500 dark:text-slate-400">Pr&oacute;xima ejecuci&oacute;n</span>
                        <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ formatFecha(programacion()!.proxima_ejecucion!) }}</span>
                     </div>
                  </div>
               </div>
            </div>

         </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div *ngIf="backupAEliminar()" class="fixed inset-0 z-50 flex items-center justify-center p-4"
         (click)="backupAEliminar.set(null)">
         <div class="fixed inset-0 bg-black/50 backdrop-blur-sm"></div>
         <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm w-full animate-slideIn"
            (click)="$event.stopPropagation()">
            <div class="w-12 h-12 mx-auto rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
               <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
               </svg>
            </div>
            <h3 class="text-center text-base font-display font-bold text-slate-900 dark:text-white mb-2">Eliminar respaldo</h3>
            <p class="text-center text-sm text-slate-500 dark:text-slate-400 mb-6">
               Se eliminar&aacute; permanentemente el archivo<br>
               <span class="font-medium text-slate-700 dark:text-slate-300">{{ backupAEliminar()!.nombre_archivo }}</span>
            </p>
            <div class="flex gap-3">
               <button (click)="backupAEliminar.set(null)" type="button"
                  class="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancelar
               </button>
               <button (click)="eliminarBackup()" type="button"
                  class="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm transition-colors">
                  Eliminar
               </button>
            </div>
         </div>
      </div>
   `
})
export class DbBackupComponent implements OnInit {
   private backupService = inject(BackupService);
   private http = inject(HttpClient);

   // Section navigation
   activeSection = signal<'backup' | 'historial' | 'programacion'>('backup');

   // Notification
   notification = signal<{ message: string; type: 'success' | 'error' } | null>(null);

   // Backup creation
   tipoBackup = signal<'completo' | 'congregacion'>('completo');
   congregacionSeleccionada = signal<number | null>(null);
   enviarEmail = signal(false);
   emailDestino = signal('');
   ejecutando = signal(false);

   // Historial
   historial = signal<BackupHistorial[]>([]);
   loadingHistorial = signal(false);
   ultimoBackup = signal<BackupHistorial | null>(null);

   // Programacion
   programacion = signal<BackupProgramacion | null>(null);
   scheduleHabilitado = signal(false);
   scheduleFrecuencia = signal(24);
   scheduleTipo = signal<'completo' | 'congregacion'>('completo');
   scheduleCongregacion = signal<number | null>(null);
   scheduleEmail = signal(false);
   scheduleEmailDestino = signal('');
   guardandoProgramacion = signal(false);

   // Delete modal
   backupAEliminar = signal<BackupHistorial | null>(null);

   // Congregaciones list
   congregaciones = signal<CongregacionOption[]>([]);

   ngOnInit() {
      // Restore active section from localStorage
      const savedSection = localStorage.getItem('db_backup_active_section');
      if (savedSection && ['backup', 'historial', 'programacion'].includes(savedSection)) {
         this.activeSection.set(savedSection as any);
      }

      this.loadCongregaciones();
      this.loadHistorial();
      this.loadProgramacion();
   }

   setSection(section: 'backup' | 'historial' | 'programacion') {
      this.activeSection.set(section);
      localStorage.setItem('db_backup_active_section', section);
      
      if (section === 'historial') this.loadHistorial();
      if (section === 'programacion') this.loadProgramacion();
   }

   loadCongregaciones() {
      this.http.get<CongregacionOption[]>(`${environment.apiUrl}/configuracion/admin/congregaciones`)
         .subscribe({
            next: data => this.congregaciones.set(data),
            error: () => {}
         });
   }

   loadHistorial() {
      this.loadingHistorial.set(true);
      this.backupService.getHistorial().subscribe({
         next: data => {
            this.historial.set(data);
            this.loadingHistorial.set(false);
            if (data.length > 0) {
               this.ultimoBackup.set(data[0]);
            }
         },
         error: () => this.loadingHistorial.set(false)
      });
   }

   loadProgramacion() {
      this.backupService.getProgramacion().subscribe({
         next: config => {
            this.programacion.set(config);
            this.scheduleHabilitado.set(config.habilitado);
            this.scheduleFrecuencia.set(config.frecuencia_horas);
            this.scheduleTipo.set(config.tipo as 'completo' | 'congregacion');
            this.scheduleCongregacion.set(config.id_congregacion);
            this.scheduleEmail.set(config.enviar_email);
            this.scheduleEmailDestino.set(config.email_destino || '');
         },
         error: () => {}
      });
   }

   ejecutarBackup() {
      this.ejecutando.set(true);
      this.notification.set(null);

      this.backupService.ejecutarBackup({
         tipo: this.tipoBackup(),
         id_congregacion: this.tipoBackup() === 'congregacion' ? this.congregacionSeleccionada()! : undefined,
         enviar_email: this.enviarEmail(),
         email_destino: this.enviarEmail() ? this.emailDestino() : undefined,
      }).subscribe({
         next: result => {
            this.ejecutando.set(false);
            if (result.estado === 'completado') {
               this.showNotification('Respaldo creado exitosamente', 'success');
            } else {
               this.showNotification(`Error: ${result.mensaje_error || 'Error desconocido'}`, 'error');
            }
            this.ultimoBackup.set(result);
            this.loadHistorial();
         },
         error: err => {
            this.ejecutando.set(false);
            this.showNotification(err.error?.detail || 'Error al crear el respaldo', 'error');
         }
      });
   }

   descargarBackup(backup: BackupHistorial) {
      this.backupService.descargarBackup(backup.id_backup).subscribe({
         next: blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = backup.nombre_archivo;
            a.click();
            window.URL.revokeObjectURL(url);
         },
         error: () => this.showNotification('Error al descargar el archivo', 'error')
      });
   }

   confirmarEliminar(backup: BackupHistorial) {
      this.backupAEliminar.set(backup);
   }

   eliminarBackup() {
      const backup = this.backupAEliminar();
      if (!backup) return;

      this.backupService.eliminarBackup(backup.id_backup).subscribe({
         next: () => {
            this.backupAEliminar.set(null);
            this.showNotification('Respaldo eliminado', 'success');
            this.loadHistorial();
         },
         error: () => {
            this.backupAEliminar.set(null);
            this.showNotification('Error al eliminar el respaldo', 'error');
         }
      });
   }

   guardarProgramacion() {
      this.guardandoProgramacion.set(true);

      this.backupService.actualizarProgramacion({
         habilitado: this.scheduleHabilitado(),
         frecuencia_horas: this.scheduleFrecuencia(),
         tipo: this.scheduleTipo(),
         id_congregacion: this.scheduleTipo() === 'congregacion' ? this.scheduleCongregacion() : null,
         enviar_email: this.scheduleEmail(),
         email_destino: this.scheduleEmail() ? this.scheduleEmailDestino() : null,
      }).subscribe({
         next: config => {
            this.guardandoProgramacion.set(false);
            this.programacion.set(config);
            this.showNotification('Programaci\u00f3n guardada correctamente', 'success');
         },
         error: () => {
            this.guardandoProgramacion.set(false);
            this.showNotification('Error al guardar la programaci\u00f3n', 'error');
         }
      });
   }

   formatFecha(fecha: string): string {
      const d = new Date(fecha);
      return d.toLocaleDateString('es-ES', {
         day: '2-digit', month: 'short', year: 'numeric',
         hour: '2-digit', minute: '2-digit'
      });
   }

   private showNotification(message: string, type: 'success' | 'error') {
      this.notification.set({ message, type });
      setTimeout(() => this.notification.set(null), 5000);
   }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { ModalComponent, ConfirmDialogComponent, AvisoComponent } from '../../../../shared/components';
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
   imports: [CommonModule, FormsModule, RouterLink, ModalComponent, ConfirmDialogComponent, AvisoComponent],
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
      <div class="h-full flex flex-col overflow-hidden bg-app-bg dark:bg-slate-950">

         <!-- Header -->
         <div class="shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60">
            <div class="flex items-center gap-2.5">
               <svg class="w-5 h-5 text-brand-purple shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                     d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
               </svg>
               <div>
                  <h2 class="text-base font-display font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Respaldo de Base de Datos</h2>
                  <p class="text-xs text-slate-400 dark:text-slate-500 font-medium leading-tight">Copias de seguridad y programación automática</p>
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
            <button (click)="setSection('restaurar')" type="button"
               class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
               [ngClass]="activeSection() === 'restaurar'
                  ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'">
               Restaurar
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

            <!-- Sin llave: los respaldos quedan en claro y no salen por correo -->
            <app-aviso *ngIf="llaveConfigurada() === false" tone="warning" title="Falta la llave de respaldos" class="block">
               Los respaldos se están guardando sin cifrar y no se envían por correo hasta que cree la llave.
               <a routerLink="/admin/configuracion" [queryParams]="{ tab: 'seguridad' }"
                  class="font-bold underline underline-offset-2">Crear la llave en Seguridad</a>
            </app-aviso>

            <!-- ===== CREAR RESPALDO ===== -->
            <div *ngIf="activeSection() === 'backup'" class="animate-slideIn space-y-4">

               <!-- Tipo de Backup -->
               <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
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
                        class="form-select w-full">
                        <option [ngValue]="null" disabled>-- Selecciona una congregaci&oacute;n --</option>
                        <option *ngFor="let c of congregaciones()" [ngValue]="c.id_congregacion">
                           {{ c.nombre_congregacion }}
                        </option>
                     </select>
                  </div>
               </div>

               <!-- Email Options -->
               <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                  <div class="flex items-center justify-between">
                     <div>
                        <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white">Enviar por correo</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enviar copia del respaldo al correo indicado. Solo se envían respaldos cifrados.</p>
                     </div>
                     <button (click)="enviarEmail.set(!enviarEmail())" type="button"
                        class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                        [ngClass]="enviarEmail() ? 'bg-brand-purple' : 'bg-slate-300 dark:bg-slate-600'">
                        <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                           [ngClass]="enviarEmail() ? 'translate-x-5' : 'translate-x-0'"></span>
                     </button>
                  </div>

                  <datalist id="correos-admin">
                     <option *ngFor="let c of correosAdmin()" [value]="c"></option>
                  </datalist>
                  <div *ngIf="enviarEmail()" class="mt-4 animate-slideIn">
                     <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Correo electr&oacute;nico</label>
                     <input [(ngModel)]="emailDestino" type="email" list="correos-admin" placeholder="ejemplo@correo.com"
                        class="form-control w-full">
                     <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Puedes escribir cualquier correo. Los respaldos programados solo se envían a correos de administradores.</p>
                  </div>
               </div>

               <!-- Action Button -->
               <button (click)="ejecutarBackup()" type="button"
                  [disabled]="ejecutando() || (tipoBackup() === 'congregacion' && !congregacionSeleccionada())"
                  class="w-full btn-primary">
                  <svg *ngIf="!ejecutando()" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span *ngIf="ejecutando()" class="spinner" aria-hidden="true"></span>
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
                  class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-8 text-center">
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
                  <span class="spinner text-brand-purple" aria-hidden="true"></span>
               </div>

               <!-- Backup List -->
               <div *ngFor="let backup of historial()"
                  class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-4 flex items-center gap-3">

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
                     <span *ngIf="backup.estado === 'en_progreso'" class="spinner-sm" aria-hidden="true"></span>
                  </div>

                  <!-- Info -->
                  <div class="min-w-0 flex-1">
                     <div class="flex items-center gap-2">
                        <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ backup.nombre_archivo }}</p>
                        <span class="px-2 py-0.5 rounded-full text-xs font-bold uppercase shrink-0"
                           [ngClass]="backup.tipo === 'completo'
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                              : 'bg-violet-100 dark:bg-violet-900/40 text-brand-purple dark:text-violet-400'">
                           {{ backup.tipo === 'completo' ? 'Completo' : backup.nombre_congregacion || 'Congregaci\u00f3n' }}
                        </span>
                        <span *ngIf="backup.cifrado" class="px-2 py-0.5 rounded-full text-xs font-bold shrink-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                           title="Cifrado: para restaurarlo se necesita el archivo de llave y su frase">Cifrado</span>
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
                  <div class="row-actions shrink-0">
                     <button *ngIf="backup.estado === 'completado'" (click)="descargarBackup(backup)" type="button"
                        aria-label="Descargar" class="btn-icon-sm" title="Descargar">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                     </button>
                     <button (click)="confirmarEliminar(backup)" type="button"
                        aria-label="Eliminar" class="btn-icon-sm tone-danger" title="Eliminar">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                     </button>
                  </div>
               </div>
            </div>

            <!-- ===== PROGRAMACION ===== -->
            <div *ngIf="activeSection() === 'programacion'" class="animate-slideIn space-y-4">

               <!-- Enable Toggle -->
               <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                  <div class="flex items-center justify-between">
                     <div>
                        <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white">Respaldo autom&aacute;tico</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Programar respaldos peri&oacute;dicos de la base de datos</p>
                     </div>
                     <button (click)="toggleHabilitado()" type="button"
                        class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                        [ngClass]="scheduleHabilitado() ? 'bg-brand-purple' : 'bg-slate-300 dark:bg-slate-600'">
                        <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                           [ngClass]="scheduleHabilitado() ? 'translate-x-5' : 'translate-x-0'"></span>
                     </button>
                  </div>
               </div>

               <!-- Schedule Config -->
               <div *ngIf="scheduleHabilitado()" class="animate-slideIn space-y-4">

                  <!-- Horarios -->
                  <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                     <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Horarios (hora de Colombia)</label>
                     <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">El respaldo corre cada d&iacute;a a estas horas. M&iacute;nimo 2.</p>
                     <div class="space-y-2">
                        <div *ngFor="let h of scheduleHorarios(); let i = index; trackBy: trackByIndex" class="flex items-center gap-2">
                           <input type="time" [ngModel]="h" (ngModelChange)="updateHorario(i, $event)"
                              class="form-control flex-1">
                           <button type="button" (click)="removeHorario(i)" [disabled]="scheduleHorarios().length <= 2"
                              class="shrink-0 w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-red-500 hover:border-red-300 disabled:opacity-30 transition-colors flex items-center justify-center">
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                           </button>
                        </div>
                     </div>
                     <button type="button" (click)="addHorario()"
                        class="mt-3 text-xs font-bold text-brand-purple hover:text-brand-purple flex items-center gap-1.5">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        Agregar horario
                     </button>
                  </div>

                  <!-- Type -->
                  <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                     <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Tipo de respaldo</label>
                     <select [(ngModel)]="scheduleTipo"
                        class="form-select w-full">
                        <option value="completo">Base de datos completa</option>
                        <option value="congregacion">Por congregaci&oacute;n</option>
                     </select>

                     <div *ngIf="scheduleTipo() === 'congregacion'" class="mt-3 animate-slideIn">
                        <label class="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Congregaci&oacute;n</label>
                        <select [(ngModel)]="scheduleCongregacion"
                           class="form-select w-full">
                           <option [ngValue]="null" disabled>-- Seleccionar --</option>
                           <option *ngFor="let c of congregaciones()" [ngValue]="c.id_congregacion">
                              {{ c.nombre_congregacion }}
                           </option>
                        </select>
                     </div>
                  </div>

                  <!-- Schedule Email -->
                  <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                     <div class="flex items-center justify-between">
                        <div>
                           <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white">Enviar por correo</h3>
                           <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enviar copia autom&aacute;ticamente. Solo se env&iacute;an respaldos cifrados.</p>
                        </div>
                        <button (click)="scheduleEmail.set(!scheduleEmail())" type="button"
                           class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                           [ngClass]="scheduleEmail() ? 'bg-brand-purple' : 'bg-slate-300 dark:bg-slate-600'">
                           <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                              [ngClass]="scheduleEmail() ? 'translate-x-5' : 'translate-x-0'"></span>
                        </button>
                     </div>
                     <div *ngIf="scheduleEmail()" class="mt-4 animate-slideIn">
                        <input [(ngModel)]="scheduleEmailDestino" type="email" list="correos-admin" placeholder="ejemplo@correo.com"
                           class="form-control w-full">
                     </div>
                  </div>

                  <!-- Save Button -->
                  <button (click)="guardarProgramacion()" type="button"
                     [disabled]="guardandoProgramacion()"
                     class="w-full btn-primary">
                     <svg *ngIf="!guardandoProgramacion()" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                     </svg>
                     <span *ngIf="guardandoProgramacion()" class="spinner" aria-hidden="true"></span>
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
                     <div *ngIf="programacion()!.horarios?.length" class="flex items-center justify-between">
                        <span class="text-xs text-slate-500 dark:text-slate-400">Horarios (Colombia)</span>
                        <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ programacion()!.horarios.join(' · ') }}</span>
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

            <!-- ===== RESTAURAR ===== -->
            <div *ngIf="activeSection() === 'restaurar'" class="animate-slideIn space-y-4">

               <!-- Warning -->
               <div class="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex gap-3">
                  <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                     <p class="text-xs font-bold text-amber-800 dark:text-amber-300">Atenci&oacute;n: esta acci&oacute;n modifica datos en el sistema</p>
                     <p class="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        <strong>Backup completo:</strong> reemplaza todo el esquema de la base de datos (congregaciones, publicadores, informes, usuarios, etc.).<br>
                        <strong>Backup por congregaci&oacute;n:</strong> sobrescribe los datos de esa congregaci&oacute;n espec&iacute;fica (publicadores, grupos, informes, asistencias, contactos y privilegios).
                     </p>
                  </div>
               </div>

               <!-- Upload from file -->
               <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
                  <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white mb-1">Subir archivo de respaldo</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">Acepta archivos <code class="bg-slate-100 dark:bg-slate-700 px-1 rounded">.bin</code> (cifrado), <code class="bg-slate-100 dark:bg-slate-700 px-1 rounded">.dump</code> (backup completo) o <code class="bg-slate-100 dark:bg-slate-700 px-1 rounded">.sql</code> (backup por congregaci&oacute;n)</p>

                  <label class="flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors"
                     [ngClass]="archivoSubir()
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 py-4'
                        : 'border-slate-300 dark:border-slate-600 hover:border-brand-purple hover:bg-brand-purple/5 dark:hover:bg-brand-purple/10 py-6'">
                     <input type="file" accept=".bin,.dump,.sql" class="hidden" (change)="onArchivoSeleccionado($event)" [disabled]="subiendoArchivo()">

                     <ng-container *ngIf="!archivoSubir()">
                        <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Haz clic para seleccionar un archivo</span>
                     </ng-container>

                     <ng-container *ngIf="archivoSubir()">
                        <svg class="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400">{{ archivoSubir()!.name }}</span>
                        <span class="text-xs text-slate-400">{{ formatTamano(archivoSubir()!.size) }} &middot; clic para cambiar</span>
                     </ng-container>
                  </label>

                  <div *ngIf="archivoSubir()" class="flex gap-2 mt-3">
                     <button (click)="archivoSubir.set(null)" type="button" [disabled]="subiendoArchivo()"
                        class="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40">
                        Quitar
                     </button>
                     <button (click)="confirmarRestaurarArchivo()" type="button" [disabled]="subiendoArchivo()"
                        class="flex-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                        <span *ngIf="subiendoArchivo()" class="spinner-sm" aria-hidden="true"></span>
                        {{ subiendoArchivo() ? 'Restaurando...' : 'Restaurar este archivo' }}
                     </button>
                  </div>
               </div>

               <!-- Divider -->
               <div class="flex items-center gap-3">
                  <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                  <span class="text-xs text-slate-400 font-medium">o desde el historial</span>
                  <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
               </div>

               <!-- Empty State -->
               <div *ngIf="!loadingHistorial() && backupsRestaurables().length === 0"
                  class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-8 text-center">
                  <div class="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                     <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                     </svg>
                  </div>
                  <p class="text-sm font-bold text-slate-900 dark:text-white">Sin respaldos disponibles</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Crea un respaldo primero para poder restaurarlo</p>
               </div>

               <!-- Loading -->
               <div *ngIf="loadingHistorial()" class="flex items-center justify-center py-12">
                  <span class="spinner text-brand-purple" aria-hidden="true"></span>
               </div>

               <!-- Backup list -->
               <div *ngFor="let backup of backupsRestaurables()"
                  class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-4 flex items-center gap-3">

                  <!-- Icon -->
                  <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600">
                     <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                     </svg>
                  </div>

                  <!-- Info -->
                  <div class="min-w-0 flex-1">
                     <div class="flex items-center gap-2">
                        <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ backup.nombre_archivo }}</p>
                        <span class="px-2 py-0.5 rounded-full text-xs font-bold uppercase shrink-0"
                           [ngClass]="backup.tipo === 'completo'
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                              : 'bg-violet-100 dark:bg-violet-900/40 text-brand-purple dark:text-violet-400'">
                           {{ backup.tipo === 'completo' ? 'Completo' : backup.nombre_congregacion || 'Congregaci\u00f3n' }}
                        </span>
                        <span *ngIf="backup.cifrado" class="px-2 py-0.5 rounded-full text-xs font-bold shrink-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                           title="Cifrado: para restaurarlo se necesita el archivo de llave y su frase">Cifrado</span>
                     </div>
                     <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {{ formatFecha(backup.fecha_creacion) }}
                        <span *ngIf="backup.tamano_mb"> &middot; {{ backup.tamano_mb }} MB</span>
                        <span *ngIf="backup.iniciado_por"> &middot; por {{ backup.iniciado_por }}</span>
                     </p>
                  </div>

                  <!-- Restore Button -->
                  <button (click)="confirmarRestaurar(backup)" type="button"
                     [disabled]="restoringId() !== null"
                     class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                     [ngClass]="restoringId() === backup.id_backup
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 border-amber-200 dark:border-amber-800 cursor-wait'
                        : restoringId() !== null
                           ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-600 text-slate-400'
                           : 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'">
                     <span *ngIf="restoringId() === backup.id_backup" class="flex items-center gap-1.5">
                        <span class="spinner-sm" aria-hidden="true"></span>
                        Restaurando...
                     </span>
                     <span *ngIf="restoringId() !== backup.id_backup">Restaurar</span>
                  </button>
               </div>

            </div>

         </div>
      </div>

      <!-- Eliminar respaldo -->
      @if (backupAEliminar(); as b) {
         <app-confirm-dialog
            [open]="true"
            title="Eliminar respaldo"
            [message]="'Se eliminará permanentemente el archivo\n' + b.nombre_archivo"
            confirmLabel="Eliminar"
            severity="danger"
            [busy]="eliminando()"
            (confirmed)="eliminarBackup()"
            (openChange)="$event || backupAEliminar.set(null)"
         ></app-confirm-dialog>
      }

      <!-- Restaurar un respaldo del historial -->
      @if (showRestoreConfirm(); as r) {
         <app-modal [open]="true" size="sm" title="Restaurar respaldo" [hasFooter]="true" (closed)="showRestoreConfirm.set(null)">
            <p class="text-sm text-slate-600 dark:text-slate-400">
               Se restaurará el archivo:<br>
               <span class="font-semibold text-slate-800 dark:text-slate-200">{{ r.nombre_archivo }}</span>
            </p>
            <app-aviso tone="warning" [dense]="true" class="block mt-3">
               @if (r.tipo === 'completo') {
                  Esto reemplazará <strong>toda</strong> la base de datos con el estado del respaldo.
               } @else {
                  Se sobrescribirán los datos de la congregación <strong>{{ r.nombre_congregacion }}</strong> con los del respaldo.
               }
            </app-aviso>
            @if (r.cifrado) {
            <div class="mt-4 space-y-3 text-left">
               <p class="text-sm text-slate-600 dark:text-slate-300">Este respaldo está cifrado. Sube el archivo de llave y escribe su frase.</p>
               <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300">Archivo de llave (.gacllave)
                  <input type="file" accept=".gacllave,application/json" (change)="onLlaveSeleccionada($event)"
                     class="mt-1 block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:font-semibold">
               </label>
               <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300">Frase
                  <input type="password" [value]="fraseRestaurar()" (input)="fraseRestaurar.set($any($event.target).value)" autocomplete="off" class="form-control mt-1">
               </label>
            </div>
            }
            <ng-container slot="footer">
               <button type="button" class="btn-secondary" (click)="showRestoreConfirm.set(null)">Cancelar</button>
               <button type="button" class="btn-primary" style="--accent:#b45309;--accent-hover:#92400e" (click)="ejecutarRestaurar(r)" [disabled]="r.cifrado && !llaveLista()">Sí, restaurar</button>
            </ng-container>
         </app-modal>
      }

      <!-- Restaurar desde un archivo subido -->
      @if (showRestoreArchivoConfirm()) {
         <app-modal [open]="true" size="sm" title="Restaurar desde archivo" [hasFooter]="true" (closed)="showRestoreArchivoConfirm.set(false)">
            <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ archivoSubir()?.name }}</p>
            <app-aviso tone="warning" [dense]="true" class="block mt-3">
               @if (archivoSubir()?.name?.endsWith('.dump')) {
                  Esto reemplazará <strong>toda</strong> la base de datos con el contenido de este archivo.
               } @else if (archivoSubir()?.name?.endsWith('.sql')) {
                  Se sobrescribirán los datos de la congregación contenidos en este archivo.
               } @else if (archivoSubir()?.name?.endsWith('.bin')) {
                  Si es un respaldo completo, reemplazará <strong>toda</strong> la base de datos.
               }
            </app-aviso>
            @if (archivoSubir()?.name?.endsWith('.bin')) {
            <div class="mt-4 space-y-3 text-left">
               <p class="text-sm text-slate-600 dark:text-slate-300">Este respaldo está cifrado. Sube el archivo de llave y escribe su frase.</p>
               <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300">Archivo de llave (.gacllave)
                  <input type="file" accept=".gacllave,application/json" (change)="onLlaveSeleccionada($event)"
                     class="mt-1 block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:font-semibold">
               </label>
               <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300">Frase
                  <input type="password" [value]="fraseRestaurar()" (input)="fraseRestaurar.set($any($event.target).value)" autocomplete="off" class="form-control mt-1">
               </label>
            </div>
            }
            <ng-container slot="footer">
               <button type="button" class="btn-secondary" (click)="showRestoreArchivoConfirm.set(false)">Cancelar</button>
               <button type="button" class="btn-primary" style="--accent:#b45309;--accent-hover:#92400e" (click)="ejecutarRestaurarArchivo()" [disabled]="!!archivoSubir()?.name?.endsWith('.bin') && !llaveLista()">Sí, restaurar</button>
            </ng-container>
         </app-modal>
      }
   `
})
export class DbBackupComponent implements OnInit {
   private backupService = inject(BackupService);
   private http = inject(HttpClient);

   // Section navigation
   activeSection = signal<'backup' | 'historial' | 'programacion' | 'restaurar'>('backup');

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
   scheduleHorarios = signal<string[]>(['06:00', '18:00']);
   scheduleTipo = signal<'completo' | 'congregacion'>('completo');
   scheduleCongregacion = signal<number | null>(null);
   scheduleEmail = signal(false);
   scheduleEmailDestino = signal('');
   guardandoProgramacion = signal(false);

   // Delete modal
   backupAEliminar = signal<BackupHistorial | null>(null);
   eliminando = signal(false);
   private notificationTimer: ReturnType<typeof setTimeout> | null = null;

   // Restore from historial
   restoringId = signal<number | null>(null);
   showRestoreConfirm = signal<BackupHistorial | null>(null);

   // Restore from file upload
   archivoSubir = signal<File | null>(null);
   subiendoArchivo = signal(false);
   showRestoreArchivoConfirm = signal(false);

   // Congregaciones list
   congregaciones = signal<CongregacionOption[]>([]);

   backupsRestaurables = () => this.historial().filter(b => b.estado === 'completado');

   /** null mientras carga: así el aviso no parpadea. */
   llaveConfigurada = signal<boolean | null>(null);

   ngOnInit() {
      this.http.get<{ llave_configurada: boolean }>(`${environment.apiUrl}/seguridad/estado`).subscribe({
         next: e => this.llaveConfigurada.set(!!e.llave_configurada),
         error: () => { },
      });
      // Correos permitidos para enviar respaldos (el backend rechaza cualquier otro).
      this.http.get<{ correo: string; rol: string }[]>(`${environment.apiUrl}/seguridad/usuarios`).subscribe({
         next: us => this.correosAdmin.set(us.filter(u => u.rol?.toLowerCase() === 'administrador').map(u => u.correo)),
         error: () => { },
      });
      // Restore active section from localStorage
      const savedSection = localStorage.getItem('db_backup_active_section');
      if (savedSection && ['backup', 'historial', 'programacion', 'restaurar'].includes(savedSection)) {
         this.activeSection.set(savedSection as any);
      }

      this.loadCongregaciones();
      this.loadHistorial();
      this.loadProgramacion();
   }

   setSection(section: 'backup' | 'historial' | 'programacion' | 'restaurar') {
      this.activeSection.set(section);
      localStorage.setItem('db_backup_active_section', section);

      if (section === 'historial') this.loadHistorial();
      if (section === 'programacion') this.loadProgramacion();
      if (section === 'restaurar') this.loadHistorial();
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
            this.scheduleHorarios.set(
               config.horarios?.length ? [...config.horarios] : ['06:00', '18:00']
            );
            this.scheduleTipo.set(config.tipo as 'completo' | 'congregacion');
            this.scheduleCongregacion.set(config.id_congregacion);
            this.scheduleEmail.set(config.enviar_email);
            this.scheduleEmailDestino.set(config.email_destino || '');
         },
         error: () => {}
      });
   }

   trackByIndex(i: number): number {
      return i;
   }

   addHorario() {
      this.scheduleHorarios.update(hs => [...hs, '12:00']);
   }

   removeHorario(i: number) {
      this.scheduleHorarios.update(hs => hs.length <= 2 ? hs : hs.filter((_, idx) => idx !== i));
   }

   updateHorario(i: number, valor: string) {
      this.scheduleHorarios.update(hs => hs.map((h, idx) => idx === i ? valor : h));
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
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
         },
         error: () => this.showNotification('Error al descargar el archivo', 'error')
      });
   }

   confirmarEliminar(backup: BackupHistorial) {
      this.backupAEliminar.set(backup);
   }

   eliminarBackup() {
      const backup = this.backupAEliminar();
      if (!backup || this.eliminando()) return;
      this.eliminando.set(true);

      this.backupService.eliminarBackup(backup.id_backup).subscribe({
         next: () => {
            this.eliminando.set(false);
            this.backupAEliminar.set(null);
            this.showNotification('Respaldo eliminado', 'success');
            this.loadHistorial();
         },
         error: () => {
            this.eliminando.set(false);
            this.backupAEliminar.set(null);
            this.showNotification('Error al eliminar el respaldo', 'error');
         }
      });
   }

   toggleHabilitado() {
      const nuevo = !this.scheduleHabilitado();
      this.scheduleHabilitado.set(nuevo);
      // Al apagar no queda formulario ni botón "Guardar": persistir de inmediato.
      if (!nuevo) this.guardarProgramacion();
   }

   guardarProgramacion() {
      this.guardandoProgramacion.set(true);

      this.backupService.actualizarProgramacion({
         habilitado: this.scheduleHabilitado(),
         horarios: this.scheduleHorarios(),
         tipo: this.scheduleTipo(),
         id_congregacion: this.scheduleTipo() === 'congregacion' ? this.scheduleCongregacion() : null,
         enviar_email: this.scheduleEmail(),
         email_destino: this.scheduleEmail() ? this.scheduleEmailDestino() : null,
      }).subscribe({
         next: config => {
            this.guardandoProgramacion.set(false);
            this.programacion.set(config);
            this.scheduleHorarios.set([...config.horarios]);
            this.showNotification('Programaci\u00f3n guardada correctamente', 'success');
         },
         error: err => {
            this.guardandoProgramacion.set(false);
            const detail = err?.error?.detail;
            const msg = typeof detail === 'string'
               ? detail
               : Array.isArray(detail) && detail[0]?.msg
                  ? detail[0].msg
                  : 'Error al guardar la programaci\u00f3n';
            this.showNotification(msg, 'error');
         }
      });
   }

   confirmarRestaurar(backup: BackupHistorial) {
      this.limpiarLlave();
      this.showRestoreConfirm.set(backup);
   }

   // Llave de respaldos cifrados: solo en memoria mientras dura el modal.
   llaveRestaurar = signal<File | null>(null);
   fraseRestaurar = signal('');
   llaveLista = computed(() => !!this.llaveRestaurar() && this.fraseRestaurar().length > 0);
   correosAdmin = signal<string[]>([]);

   onLlaveSeleccionada(event: Event) {
      const input = event.target as HTMLInputElement;
      this.llaveRestaurar.set(input.files?.[0] ?? null);
   }

   private limpiarLlave() {
      this.llaveRestaurar.set(null);
      this.fraseRestaurar.set('');
   }

   ejecutarRestaurar(backup: BackupHistorial) {
      this.showRestoreConfirm.set(null);
      this.restoringId.set(backup.id_backup);
      this.notification.set(null);

      const llave = this.llaveRestaurar(), frase = this.fraseRestaurar();
      this.limpiarLlave();
      this.backupService.restaurarBackup(backup.id_backup, llave, frase).subscribe({
         next: result => {
            this.restoringId.set(null);
            this.showNotification(result.mensaje, 'success');
            this.loadHistorial();
            this.loadProgramacion();
         },
         error: err => {
            this.restoringId.set(null);
            this.showNotification(err.error?.detail || 'Error al restaurar el respaldo', 'error');
         }
      });
   }

   onArchivoSeleccionado(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0] ?? null;
      this.archivoSubir.set(file);
      // reset para permitir reseleccionar el mismo archivo
      input.value = '';
   }

   confirmarRestaurarArchivo() {
      if (!this.archivoSubir()) return;
      this.limpiarLlave();
      this.showRestoreArchivoConfirm.set(true);
   }

   ejecutarRestaurarArchivo() {
      const archivo = this.archivoSubir();
      if (!archivo) return;
      this.showRestoreArchivoConfirm.set(false);
      this.subiendoArchivo.set(true);
      this.notification.set(null);

      const llave = this.llaveRestaurar(), frase = this.fraseRestaurar();
      this.limpiarLlave();
      this.backupService.restaurarDesdeArchivo(archivo, llave, frase).subscribe({
         next: result => {
            this.subiendoArchivo.set(false);
            this.archivoSubir.set(null);
            this.showNotification(result.mensaje, 'success');
            this.loadHistorial();
            this.loadProgramacion();
         },
         error: err => {
            this.subiendoArchivo.set(false);
            this.showNotification(err.error?.detail || 'Error al restaurar el archivo', 'error');
         }
      });
   }

   formatTamano(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
   }

   formatFecha(fecha: string): string {
      const d = new Date(fecha);
      return d.toLocaleDateString('es-ES', {
         day: '2-digit', month: 'short', year: 'numeric',
         hour: '2-digit', minute: '2-digit',
         timeZone: 'America/Bogota'
      });
   }

   private showNotification(message: string, type: 'success' | 'error') {
      if (this.notificationTimer) clearTimeout(this.notificationTimer);
      this.notification.set({ message, type });
      this.notificationTimer = setTimeout(() => this.notification.set(null), 5000);
   }
}

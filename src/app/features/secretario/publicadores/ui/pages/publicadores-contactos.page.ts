import { Component, inject, signal, computed, effect, untracked, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { PublicadoresFacade } from '../../application/publicadores.facade';
import { Publicador } from '../../domain/models/publicador';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../../../core/congregacion-context/congregacion-context.service';
import { getInitialAvatarStyle } from '../../../../../core/utils/avatar-style.util';

interface ContactoEmergencia {
    id_contacto_emergencia?: number;
    id_publicador: number;
    nombre: string;
    telefono?: string;
    parentesco?: string;
    direccion?: string;
    etiqueta?: string;
    es_principal?: boolean;
    solo_urgencias?: boolean;
}

interface Toast {
    type: 'success' | 'error';
    message: string;
}

@Component({
    standalone: true,
    selector: 'app-publicadores-contactos',
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    template: `
    <div class="h-full flex flex-col md:flex-row gap-0 md:gap-6 relative overflow-hidden">

      <!-- TOAST -->
      <div *ngIf="toast()" class="fixed bottom-6 right-6 z-[100] animate-toastIn pointer-events-none">
        <div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold"
             [ngClass]="toast()!.type === 'success'
                 ? 'bg-white dark:bg-slate-800 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                 : 'bg-white dark:bg-slate-800 border-red-100 dark:border-red-800 text-red-600 dark:text-red-400'">
          <svg *ngIf="toast()!.type === 'success'" class="w-4 h-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          <svg *ngIf="toast()!.type === 'error'" class="w-4 h-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          <span>{{ toast()!.message }}</span>
        </div>
      </div>

      <!-- Mobile FAB — only visible on mobile (< md) when a publisher is selected -->
      <button *ngIf="canEditContactos() && selectedPublicador()"
          (click)="initNewContacto()"
          aria-label="Añadir contacto de emergencia"
          class="md:hidden fixed right-5 z-50 w-14 h-14 bg-brand-orange text-white rounded-full shadow-lg shadow-orange-500/30 hover:bg-orange-600 active:scale-95 transition-[background-color,transform,bottom] duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2"
          [style.bottom.px]="fabBottomPx()">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <!-- ═══════════════════════════════════════════════════════
           SIDEBAR
           Mobile  (< md):  full-width, hidden when publisher selected
           Tablet  (md–lg):  280px, always visible beside panel
           Desktop (≥ lg):   380px, always visible
      ════════════════════════════════════════════════════════════ -->
      <div class="flex-none w-full md:w-[280px] lg:w-[380px] flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl shadow-sm border-x md:border border-slate-200 dark:border-slate-800 overflow-hidden"
           [ngClass]="selectedPublicador() ? 'hidden md:flex h-full' : 'flex h-full'">

        <!-- Sidebar Header -->
        <div class="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm sticky top-0 z-10">
          <!-- Desktop/Tablet heading row -->
          <div class="hidden md:flex items-center justify-between mb-3">
            <h3 class="font-display font-bold text-slate-800 dark:text-white text-lg">Directorio</h3>
            <button (click)="exportarPDF()" [disabled]="downloadingPdf()" aria-label="Exportar lista de contactos como PDF"
                class="p-2 -mr-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exportar Lista de Contactos (PDF)">
              <svg *ngIf="!downloadingPdf()" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <div *ngIf="downloadingPdf()" class="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin"></div>
            </button>
          </div>

          <!-- Mobile-only label (replaces "Directorio" heading) -->
          <p class="md:hidden text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Contactos de emergencia</p>

          <div class="relative group">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="w-4 h-4 text-slate-400 group-focus-within:text-brand-orange transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            <input type="text" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
                placeholder="Buscar publicador..."
                class="w-full pl-9 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 outline-none transition-all shadow-sm"
                [class.pr-8]="searchQuery()" [class.pr-3]="!searchQuery()">
            <button *ngIf="searchQuery()" (click)="searchQuery.set('')"
                aria-label="Limpiar búsqueda"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="flex flex-wrap justify-between gap-1.5 mt-3">
            <button (click)="toggleFilter('all')"
                class="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs font-bold transition-[background-color,border-color,color] duration-150 border shrink-0 flex items-center justify-center"
                [ngClass]="activeFilters().has('all') ? 'bg-slate-800 dark:bg-slate-100 border-slate-800 dark:border-white text-white dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'">
              Todos
            </button>
            <button (click)="toggleFilter('active')"
                class="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs font-bold transition-[background-color,border-color,color] duration-150 border shrink-0 flex items-center justify-center gap-1"
                [ngClass]="activeFilters().has('active') ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'">
              <span class="w-1 h-1 rounded-full shrink-0" [ngClass]="activeFilters().has('active') ? 'bg-emerald-500' : 'bg-emerald-400'"></span>
              Activos
            </button>
            <button (click)="toggleFilter('inactive')"
                class="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs font-bold transition-[background-color,border-color,color] duration-150 border shrink-0 flex items-center justify-center"
                [ngClass]="activeFilters().has('inactive') ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'">
              Inactivos
            </button>
            <button (click)="toggleFilter('no-phone')" title="Publicadores sin ningún contacto de emergencia con teléfono registrado"
                class="flex-none px-2 py-1.5 rounded-lg text-xs font-bold transition-[background-color,border-color,color] duration-150 border shrink-0 flex items-center justify-center gap-1"
                [ngClass]="activeFilters().has('no-phone') ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'">
              <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              Sin Teléfono
            </button>
          </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto simple-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
          <div *ngIf="vm().loading && vm().list.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-400">
            <div class="w-6 h-6 border-2 border-slate-200 border-t-brand-orange rounded-full animate-spin mb-3"></div>
            <span class="text-xs font-bold">Cargando directorio...</span>
          </div>

          <div class="divide-y divide-slate-100 dark:divide-slate-800/80">
            <button *ngFor="let p of filteredList(); trackBy: trackByPublicador"
                (click)="selectPublicador(p)"
                class="w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-3 group relative"
                [ngClass]="selectedPublicador()?.id_publicador === p.id_publicador
                    ? 'bg-orange-50 dark:bg-orange-950/20'
                    : 'bg-white dark:bg-slate-900'">

              <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-semibold text-xs shadow-sm"
                   [ngClass]="getAvatarStyle(p)">
                {{ getInitials(p) }}
              </div>

              <div class="min-w-0 flex-1">
                <h4 class="text-sm font-bold truncate leading-tight transition-colors"
                    [ngClass]="selectedPublicador()?.id_publicador === p.id_publicador ? 'text-brand-orange' : 'text-slate-800 dark:text-slate-200 group-hover:text-brand-orange'">
                  {{ p.primer_nombre }} {{ p.primer_apellido }}
                </h4>
                <p class="text-xs font-medium truncate flex items-center gap-1.5 mt-0.5"
                   [ngClass]="p.telefono ? 'text-slate-500 dark:text-slate-400' : 'text-amber-500 dark:text-amber-400'">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0 flex-none"
                        [ngClass]="p.id_estado_publicador === 1 ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'"></span>
                  {{ p.telefono || 'Sin teléfono' }}
                </p>
              </div>

              <svg *ngIf="selectedPublicador()?.id_publicador === p.id_publicador"
                   class="w-3.5 h-3.5 shrink-0 text-brand-orange/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>

            <div *ngIf="filteredList().length === 0 && !vm().loading" class="p-8 text-center">
              <p class="text-sm font-bold text-slate-500">No se encontraron resultados</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Intenta con otro nombre o cambia el filtro activo</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {{ filteredList().length }} miembros
          </span>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════
           MAIN PANEL
           Mobile  (< md):  hidden until publisher selected, then full screen + slide-in
           Tablet+ (≥ md):  always visible beside sidebar
      ════════════════════════════════════════════════════════════ -->
      <div class="flex-1 flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl shadow-sm border-x md:border border-slate-200 dark:border-slate-800 overflow-hidden relative"
           [ngClass]="!selectedPublicador() ? 'hidden md:flex' : 'flex h-full'">

        <!-- EMPTY STATE — no publisher selected (tablet/desktop only) -->
        <div *ngIf="!selectedPublicador()" class="flex-1 w-full h-full flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 z-10 select-none">
          <div class="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-6">
            <svg class="w-8 h-8 text-brand-orange/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
            </svg>
          </div>
          <h2 class="text-xl font-display font-black text-slate-800 dark:text-white tracking-tight">Selecciona un publicador</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 max-w-[280px] text-center mt-2 leading-relaxed">
            Elige un nombre del directorio para ver y gestionar sus contactos de emergencia.
          </p>
          <div class="hidden md:flex items-center gap-1.5 mt-8 text-[0.625rem] text-slate-300 dark:text-slate-700 font-black uppercase tracking-widest">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Directorio
          </div>
        </div>

        <!-- DETAIL VIEW -->
        <div *ngIf="selectedPublicador() as p" class="flex flex-col h-full animate-panelIn relative">

          <!-- Publisher Header -->
          <div class="relative bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 md:p-6 lg:p-8 md:pb-10 shrink-0 flex items-center gap-3 sticky top-0 z-20 md:static md:flex-col md:items-start md:gap-5 overflow-hidden">
            <!-- Ambient background blob (tablet/desktop) -->
            <div class="hidden md:block absolute top-0 right-0 w-56 h-56 rounded-full bg-orange-50/70 dark:bg-orange-900/10 blur-3xl -translate-y-16 translate-x-16 pointer-events-none"></div>

            <div class="flex items-center gap-3 md:gap-5 min-w-0 flex-1 w-full md:w-auto relative">
              <!-- Back button: mobile only (< md) -->
              <button (click)="selectedPublicador.set(null)" aria-label="Volver a la lista"
                  class="md:hidden p-2 -ml-2 shrink-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-brand-orange/30 outline-none transition-[background-color,transform] duration-150 active:scale-90">
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>

              <!-- Avatar -->
              <div class="w-10 h-10 md:w-16 md:h-16 rounded-2xl shadow-sm flex items-center justify-center text-sm md:text-xl font-display font-bold shrink-0"
                   [ngClass]="getAvatarStyle(p)">
                {{ getInitials(p) }}
              </div>

              <!-- Name + meta -->
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-2 md:gap-3">
                  <h1 class="text-base md:text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-none truncate">
                    {{ p.primer_nombre }} {{ p.primer_apellido }}
                  </h1>
                  <span *ngIf="p.id_estado_publicador === 1"
                        class="hidden md:inline shrink-0 text-[0.625rem] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 uppercase tracking-wide">
                    Activo
                  </span>
                </div>
                <div class="flex items-center gap-1.5 mt-1" title="Teléfono personal">
                  <svg class="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ p.telefono || 'Sin teléfono personal' }}</span>
                </div>
              </div>
            </div>

            <!-- Add button — tablet/desktop only (mobile uses fixed FAB above) -->
            <div class="hidden md:block md:absolute md:right-6 lg:right-8 md:bottom-8 z-10">
              <button *ngIf="canEditContactos()" (click)="initNewContacto()" aria-label="Añadir contacto de emergencia"
                  class="group flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-orange text-white rounded-xl font-bold shadow-md shadow-orange-500/25 hover:bg-orange-600 hover:shadow-orange-600/35 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.95]"
                  title="Añadir Contacto">
                <span class="group-hover:rotate-90 transition-transform duration-200">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </span>
                <span class="text-sm">Añadir Contacto</span>
              </button>
            </div>
          </div>

          <!-- CONTENT BODY -->
          <div class="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/50 p-4 md:p-6 lg:p-8 relative">

            <!-- Form overlay / bottom-sheet on mobile -->
            <div *ngIf="showForm()" class="fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:mb-8 animate-fadeInUp flex flex-col justify-end md:block">
              <div class="absolute inset-0 bg-black/40 backdrop-blur-sm md:hidden" (click)="cancelForm()"></div>
              <div class="relative w-full bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-xl border-t md:border border-slate-200 dark:border-slate-800 overflow-hidden max-w-3xl mx-auto h-[85vh] md:h-auto flex flex-col md:block">

                <!-- Header — shows which contact is being edited -->
                <div class="px-6 py-4 border-b border-orange-600/20 flex justify-between items-start bg-brand-orange">
                  <div>
                    <h3 class="font-display font-bold text-white">
                      {{ editingContacto() ? 'Editar contacto' : 'Nuevo contacto de emergencia' }}
                    </h3>
                    <p *ngIf="editingContacto()" class="text-xs text-orange-100 mt-0.5">
                      {{ editingContacto()!.nombre }}
                      <span *ngIf="editingContacto()!.parentesco" class="text-orange-200"> · {{ editingContacto()!.parentesco }}</span>
                    </p>
                  </div>
                  <button (click)="cancelForm()" aria-label="Cerrar formulario"
                      class="p-2 mt-0.5 hover:bg-orange-600 rounded-full transition-colors text-orange-100 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                <div class="p-4 flex-1 overflow-y-auto max-h-[70vh] md:max-h-none" [formGroup]="form">

                  <!-- Core fields -->
                  <div class="grid grid-cols-12 gap-3 mb-4">
                    <div class="col-span-12 space-y-1">
                      <label class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                        Nombre completo <span class="text-red-400">*</span>
                      </label>
                      <input formControlName="nombre"
                             (blur)="form.get('nombre')!.markAsTouched()"
                             class="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-1 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-all"
                             [ngClass]="isNombreInvalid()
                                 ? 'border border-red-400 dark:border-red-500 focus:ring-red-400 focus:border-red-400'
                                 : 'border border-slate-200 dark:border-slate-700 focus:ring-brand-orange focus:border-brand-orange'"
                             placeholder="Nombre del contacto">
                      <p *ngIf="isNombreInvalid()" class="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                        <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                        El nombre es obligatorio
                      </p>
                    </div>

                    <div class="col-span-6 space-y-1">
                      <label class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Parentesco</label>
                      <div class="relative">
                        <!-- Backdrop to close dropdown on outside click -->
                        <div *ngIf="showParentescoDropdown()" class="fixed inset-0 z-10" (click)="closeParentescoDropdown()"></div>
                        <!-- Search input -->
                        <input type="text"
                               [value]="parentescoSearch()"
                               (input)="onParentescoInput($event)"
                               (focus)="openParentescoDropdown()"
                               placeholder="Buscar parentesco..."
                               autocomplete="off"
                               class="w-full h-10 pl-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"/>
                        <!-- Chevron -->
                        <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <svg class="w-4 h-4 transition-transform duration-150" [class.rotate-180]="showParentescoDropdown()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                        <!-- Dropdown -->
                        <div *ngIf="showParentescoDropdown()"
                             class="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto py-1">
                          <ng-container *ngFor="let grupo of filteredParentescos()">
                            <ng-container *ngIf="grupo.opciones.length > 0">
                              <div class="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky top-0 bg-white dark:bg-slate-800">{{ grupo.grupo }}</div>
                              <button *ngFor="let opcion of grupo.opciones"
                                      type="button"
                                      (mousedown)="selectParentesco(opcion)"
                                      class="w-full text-left px-4 py-2 text-sm transition-colors"
                                      [ngClass]="form.get('parentesco')?.value === opcion
                                        ? 'bg-orange-50 dark:bg-orange-900/20 text-brand-orange font-semibold'
                                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'">
                                {{ opcion }}
                              </button>
                            </ng-container>
                          </ng-container>
                          <div *ngIf="noParentescoResults()" class="px-4 py-3 text-sm text-slate-400 text-center">Sin resultados</div>
                        </div>
                      </div>
                    </div>

                    <div class="col-span-6 space-y-1">
                      <label class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Teléfono</label>
                      <input formControlName="telefono" inputmode="tel"
                             class="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                             placeholder="0412-555-0000">
                    </div>

                    <!-- Dirección: collapsible — collapsed by default, auto-expands when editing a contact that has a value -->
                    <div class="col-span-12">
                      <button *ngIf="!showDireccion()" type="button" (click)="showDireccion.set(true)"
                          class="group flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-brand-orange transition-colors py-1.5">
                        <svg class="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Añadir dirección o notas
                      </button>
                      <div *ngIf="showDireccion()" class="space-y-1 animate-fadeIn">
                        <label class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center justify-between">
                          <span>Dirección · Notas</span>
                          <button type="button"
                              (click)="showDireccion.set(false); form.get('direccion')!.setValue(''); form.get('direccion')!.markAsDirty()"
                              class="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-500 transition-colors"
                              aria-label="Quitar campo de dirección">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        </label>
                        <input formControlName="direccion"
                               class="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                               placeholder="Dirección o información adicional">
                      </div>
                    </div>
                  </div>

                  <!-- Toggle rows: Principal + Solo urgencias
                       Each row is a full-width tappable label — 44px min height, visible description, color-coded state
                  -->
                  <div class="space-y-2 mb-4">

                    <!-- Principal toggle -->
                    <label class="flex items-center gap-4 px-4 py-3.5 rounded-xl cursor-pointer select-none transition-all duration-150"
                           [ngClass]="form.get('es_principal')?.value
                               ? 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/50'
                               : 'bg-slate-50 dark:bg-slate-800/60 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'">
                      <input formControlName="es_principal" type="checkbox" class="sr-only peer">
                      <!-- Toggle pill -->
                      <span class="relative flex-none inline-flex items-center w-10 h-[22px] rounded-full transition-colors duration-200 focus-within:ring-2 focus-within:ring-emerald-400/50"
                            [ngClass]="form.get('es_principal')?.value ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'">
                        <span class="absolute w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
                              [ngClass]="form.get('es_principal')?.value ? 'translate-x-[20px]' : 'translate-x-[2px]'"></span>
                      </span>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-bold leading-tight transition-colors"
                           [ngClass]="form.get('es_principal')?.value ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'">
                          Principal
                        </p>
                        <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Primera persona a llamar en una emergencia</p>
                      </div>
                      <svg *ngIf="form.get('es_principal')?.value" class="w-4 h-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </label>

                    <!-- Solo urgencias toggle -->
                    <label class="flex items-center gap-4 px-4 py-3.5 rounded-xl cursor-pointer select-none transition-all duration-150"
                           [ngClass]="form.get('solo_urgencias')?.value
                               ? 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50'
                               : 'bg-slate-50 dark:bg-slate-800/60 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'">
                      <input formControlName="solo_urgencias" type="checkbox" class="sr-only peer">
                      <!-- Toggle pill -->
                      <span class="relative flex-none inline-flex items-center w-10 h-[22px] rounded-full transition-colors duration-200"
                            [ngClass]="form.get('solo_urgencias')?.value ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'">
                        <span class="absolute w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
                              [ngClass]="form.get('solo_urgencias')?.value ? 'translate-x-[20px]' : 'translate-x-[2px]'"></span>
                      </span>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-bold leading-tight transition-colors"
                           [ngClass]="form.get('solo_urgencias')?.value ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'">
                          Solo urgencias
                        </p>
                        <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Contactar únicamente en situaciones críticas</p>
                      </div>
                    </label>
                  </div>

                  <!-- Dirty-state discard warning — appears inline above buttons when user tries to cancel with unsaved changes -->
                  <div *ngIf="showDiscardWarning()" class="flex items-center justify-between gap-3 px-4 py-3 mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 animate-fadeIn">
                    <p class="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                      ¿Descartar los cambios?
                    </p>
                    <div class="flex items-center gap-1 shrink-0">
                      <button (click)="discardChanges()"
                          class="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400">
                        Descartar
                      </button>
                      <button (click)="showDiscardWarning.set(false)"
                          class="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300">
                        Seguir editando
                      </button>
                    </div>
                  </div>

                  <!-- Action buttons -->
                  <div class="flex gap-3">
                    <button (click)="cancelForm()" class="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-slate-300">Cancelar</button>
                    <button (click)="save()" class="flex-[2] h-11 rounded-xl bg-brand-orange text-white font-bold text-sm shadow-md shadow-orange-500/20 hover:bg-orange-600 active:scale-[0.97] transition-[background-color,box-shadow,transform] duration-150 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2">
                      {{ editingContacto() ? 'Guardar cambios' : 'Guardar contacto' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- CARDS GRID
                 mobile:  1 col
                 tablet:  1 col (main panel is ~488px beside 280px sidebar — tight for 2)
                 desktop: 2 cols at lg, 3 cols at xl
            -->
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5 max-w-6xl mx-auto items-start">

              <!-- Empty state: no contacts yet -->
              <div *ngIf="contactos().length === 0 && !showForm()"
                   class="lg:col-span-2 xl:col-span-3 flex flex-col items-center justify-center p-10 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <svg class="w-7 h-7 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                  </svg>
                </div>
                <p class="font-display font-bold text-slate-700 dark:text-slate-300 mb-1">Sin contactos de emergencia</p>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center max-w-[260px]">Añade al menos uno para poder actuar rápido ante una emergencia.</p>
                <button *ngIf="canEditContactos()" (click)="initNewContacto()"
                    class="px-5 py-2 bg-brand-orange text-white rounded-full font-bold text-sm shadow-md shadow-orange-500/20 hover:bg-orange-600 active:scale-[0.97] transition-[background-color,box-shadow,transform] duration-150 focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                  Añadir ahora
                </button>
              </div>

              <!-- CONTACT CARD -->
              <div *ngFor="let c of contactos(); trackBy: trackByContacto"
                   class="contact-card group relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-5 transition-opacity duration-200"
                   [ngClass]="[
                     c.es_principal
                       ? 'border border-emerald-200 dark:border-emerald-900/40 shadow-sm hover:shadow-lg hover:shadow-emerald-50 dark:hover:shadow-black/70 hover:border-emerald-300 dark:hover:border-emerald-800/50'
                       : 'border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/70 hover:border-orange-200 dark:hover:border-slate-700',
                     removingId() === c.id_contacto_emergencia ? 'animate-cardExit' : '',
                     editingContacto() && editingContacto()!.id_contacto_emergencia === c.id_contacto_emergencia
                       ? 'ring-2 ring-brand-orange/40 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950'
                       : '',
                     editingContacto() && editingContacto()!.id_contacto_emergencia !== c.id_contacto_emergencia
                       ? 'opacity-40 pointer-events-none'
                       : ''
                   ]">

                <!-- Row 1: Parentesco + badges (left) — Action buttons (right, in flow) -->
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span class="text-[0.625rem] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {{ c.parentesco || 'Familiar' }}
                    </span>
                    <span *ngIf="c.es_principal"
                          class="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[0.625rem] font-black uppercase tracking-wide border border-emerald-200 dark:border-emerald-800">
                      Principal
                    </span>
                    <span *ngIf="c.solo_urgencias"
                          class="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[0.625rem] font-black uppercase tracking-wide border border-amber-200 dark:border-amber-800/50">
                      Solo urgencias
                    </span>
                  </div>

                  <!-- Action buttons — in-flow (right of parentesco row, never over the name) -->
                  <div *ngIf="canEditContactos()" class="action-buttons shrink-0 -mt-0.5 -mr-1">
                    <div *ngIf="pendingDeleteId() === c.id_contacto_emergencia"
                         class="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 shadow-md border border-red-100 dark:border-red-900 animate-fadeIn">
                      <span class="text-xs font-bold text-slate-600 dark:text-slate-300 mr-1 whitespace-nowrap">¿Eliminar?</span>
                      <button (click)="confirmDelete(c)" aria-label="Confirmar eliminación del contacto"
                          class="px-2.5 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-red-400">Sí</button>
                      <button (click)="pendingDeleteId.set(null)" aria-label="Cancelar eliminación"
                          class="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400">No</button>
                    </div>
                    <div *ngIf="pendingDeleteId() !== c.id_contacto_emergencia"
                         class="flex gap-0.5 bg-white dark:bg-slate-800/90 rounded-lg p-0.5 shadow-sm border border-slate-200 dark:border-slate-700">
                      <button (click)="edit(c)" aria-label="Editar contacto"
                          class="p-2 text-slate-400 hover:text-brand-orange hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button (click)="pendingDeleteId.set(c.id_contacto_emergencia ?? null)" aria-label="Eliminar contacto"
                          class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-300">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Row 2: Name — hero, full width, no right padding needed -->
                <h4 class="font-display font-black text-slate-900 dark:text-white text-xl leading-tight mb-4 group-hover:text-brand-orange transition-colors duration-150">
                  {{ c.nombre }}
                </h4>

                <div class="h-px bg-slate-100 dark:bg-slate-800 mb-4"></div>

                <!-- Row 3: Phone -->
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 transition-colors">
                    <svg class="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-brand-orange transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                  </div>
                  <span class="font-bold text-sm text-slate-700 dark:text-slate-300 tracking-wide">
                    {{ c.telefono || 'Sin teléfono' }}
                  </span>
                </div>

                <!-- Row 4: Address -->
                <div *ngIf="c.direccion" class="flex items-start gap-2 mt-3 text-xs text-slate-400 dark:text-slate-500">
                  <svg class="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <span class="leading-snug">{{ c.direccion }}</span>
                </div>
              </div>

              <!-- Añadir otro — divider CTA -->
              <div *ngIf="canEditContactos() && contactos().length > 0"
                   class="lg:col-span-2 xl:col-span-3 flex items-center gap-4 py-1">
                <div class="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                <button (click)="initNewContacto()" aria-label="Añadir otro contacto de emergencia"
                    class="group inline-flex items-center gap-2 text-sm font-bold text-slate-400 dark:text-slate-600 hover:text-brand-orange transition-colors focus:outline-none focus:ring-2 focus:ring-brand-orange/30 rounded px-1 py-0.5">
                  <svg class="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Añadir otro contacto
                </button>
                <div class="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
              </div>

            </div>

            <!-- Loading Overlay -->
            <div *ngIf="loadingContactos" class="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-[2px] z-20 flex items-center justify-center">
              <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                <div class="w-10 h-10 border-4 border-slate-100 dark:border-slate-700 border-t-brand-orange rounded-full animate-spin"></div>
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400">{{ savingContactos ? 'Guardando...' : 'Cargando...' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    :host { display: block; height: 100%; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

    /* ── Shared keyframes ─────────────────────────────────── */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px) scale(0.995); }
      to   { opacity: 1; transform: translateY(0)   scale(1);     }
    }
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(24px) scale(0.99); }
      to   { opacity: 1; transform: translateX(0)    scale(1);    }
    }
    @keyframes fadeInUp {
      /* Bottom-sheet / form enter: overshoots 2px then settles */
      from { opacity: 0; transform: translateY(20px); }
      80%  { opacity: 1; transform: translateY(-2px);  }
      to   { opacity: 1; transform: translateY(0);     }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(14px) scale(0.96); }
      to   { opacity: 1; transform: translateX(0)    scale(1);    }
    }
    @keyframes cardEnter {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    @keyframes cardExit {
      0%   { opacity: 1; transform: scale(1)    translateY(0);  }
      30%  { opacity: 1; transform: scale(0.97) translateY(2px);}
      100% { opacity: 0; transform: scale(0.93) translateY(6px);}
    }

    /* ── Named animation classes ──────────────────────────── */
    .animate-fadeIn    { animation: fadeIn    0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fadeInUp  { animation: fadeInUp  0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-toastIn   { animation: toastIn   0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-cardExit  { animation: cardExit  0.28s cubic-bezier(0.55, 0, 1, 0.45) forwards; pointer-events: none; }

    /*
     * animate-panelIn: slide from right on mobile, fade on tablet+.
     * Single class, responsive via @media — no JS breakpoint detection needed.
     */
    .animate-panelIn { animation: slideInRight 0.34s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @media (min-width: 768px) {
      .animate-panelIn { animation: fadeIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    }

    /* ── Contact card stagger + hover ─────────────────────── */
    .contact-card {
      animation: cardEnter 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
      will-change: transform, opacity;
      /* Hover lift — use transform so it's GPU-composited */
      transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .contact-card:hover { transform: translateY(-2px); }
    /* Override lift when card is being removed */
    .contact-card.animate-cardExit:hover { transform: none; }

    /* Stagger delays — 35ms increments, covers up to 9 cards */
    .contact-card:nth-child(1)  { animation-delay:   0ms; }
    .contact-card:nth-child(2)  { animation-delay:  35ms; }
    .contact-card:nth-child(3)  { animation-delay:  70ms; }
    .contact-card:nth-child(4)  { animation-delay: 105ms; }
    .contact-card:nth-child(5)  { animation-delay: 140ms; }
    .contact-card:nth-child(6)  { animation-delay: 175ms; }
    .contact-card:nth-child(7)  { animation-delay: 210ms; }
    .contact-card:nth-child(8)  { animation-delay: 245ms; }
    .contact-card:nth-child(9)  { animation-delay: 280ms; }

    /* Action buttons: fade in on hover (in-flow, no slide needed) */
    .contact-card .action-buttons {
      opacity: 0;
      transition: opacity 0.18s ease;
    }
    .contact-card:hover .action-buttons {
      opacity: 1;
    }
    /* On touch devices: always visible (no hover) */
    @media (hover: none) {
      .contact-card .action-buttons {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .animate-fadeIn, .animate-panelIn, .animate-fadeInUp,
      .animate-toastIn, .animate-cardExit,
      .contact-card { animation: none !important; opacity: 1; transform: none !important; }
      .contact-card { transition: none !important; }
      .contact-card .action-buttons { opacity: 1 !important; }
    }
  `]
})
export class PublicadoresContactosComponent {
    private facade = inject(PublicadoresFacade);
    private authStore = inject(AuthStore);
    private congregacionContext = inject(CongregacionContextService);
    private http = inject(HttpClient);
    private fb = inject(FormBuilder);
    private destroyRef = inject(DestroyRef);

    vm = this.facade.vm;

    // UI State
    searchQuery = signal('');
    activeFilters = signal<Set<string>>(new Set(['all']));
    selectedPublicador = signal<Publicador | null>(null);
    downloadingPdf = signal(false);

    // Toast feedback
    toast = signal<Toast | null>(null);
    private toastTimer: ReturnType<typeof setTimeout> | null = null;

    // Inline delete confirmation
    pendingDeleteId = signal<number | null>(null);

    // ID of the card currently playing its exit animation
    removingId = signal<number | null>(null);

    // Fixed FAB bottom offset — tracks virtual keyboard on iOS
    fabBottomPx = signal(24);

    // Controls collapsible Dirección field in the form
    showDireccion = signal(false);

    // Shown when user tries to cancel with unsaved changes
    showDiscardWarning = signal(false);

    // Contacts Data
    contactos = signal<ContactoEmergencia[]>([]);
    loadingContactos = false;
    savingContactos = false;

    private hasEmergencyPhoneMap = signal<Map<number, boolean>>(new Map());
    private estados = signal<any[]>([]);

    // Form State
    showForm = signal(false);
    editingContacto = signal<ContactoEmergencia | null>(null);
    form: FormGroup;

    // Parentesco combobox
    readonly PARENTESCOS = [
        { grupo: 'Pareja',           opciones: ['Esposo', 'Esposa', 'Compañero/a de vida'] },
        { grupo: 'Padres e hijos',   opciones: ['Madre', 'Padre', 'Hijo', 'Hija'] },
        { grupo: 'Hermanos',         opciones: ['Hermano', 'Hermana'] },
        { grupo: 'Abuelos y nietos', opciones: ['Abuelo', 'Abuela', 'Nieto', 'Nieta'] },
        { grupo: 'Tíos y sobrinos',  opciones: ['Tío', 'Tía', 'Sobrino', 'Sobrina'] },
        { grupo: 'Políticos',        opciones: ['Suegro', 'Suegra', 'Yerno', 'Nuera', 'Cuñado', 'Cuñada'] },
        { grupo: 'Primos',           opciones: ['Primo', 'Prima'] },
        { grupo: 'Otros',            opciones: ['Amigo', 'Amiga', 'Vecino', 'Vecina', 'Otro'] },
    ];
    parentescoSearch = signal('');
    showParentescoDropdown = signal(false);
    filteredParentescos = computed(() => {
        const q = this.parentescoSearch().toLowerCase().trim();
        if (!q) return this.PARENTESCOS;
        return this.PARENTESCOS.map(g => ({ ...g, opciones: g.opciones.filter(o => o.toLowerCase().includes(q)) }));
    });
    noParentescoResults = computed(() => this.filteredParentescos().every(g => g.opciones.length === 0));

    openParentescoDropdown() { this.showParentescoDropdown.set(true); }
    closeParentescoDropdown() {
        this.showParentescoDropdown.set(false);
        this.parentescoSearch.set(this.form.get('parentesco')?.value || '');
    }
    onParentescoInput(event: Event) {
        this.parentescoSearch.set((event.target as HTMLInputElement).value);
        this.showParentescoDropdown.set(true);
    }
    selectParentesco(value: string) {
        this.form.get('parentesco')?.setValue(value);
        this.form.get('parentesco')?.markAsDirty();
        this.parentescoSearch.set(value);
        this.showParentescoDropdown.set(false);
    }

    canEditContactos = computed(() => {
        const user = this.authStore.user();
        const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
        return this.congregacionContext.isAdmin() ||
               roles.includes('secretario') ||
               this.authStore.hasPermission('contactos.editar');
    });

    isScopedToGroup = computed(() => {
        const user = this.authStore.user();
        const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
        const isPrivileged = this.congregacionContext.isAdmin() ||
                             roles.includes('secretario');
        return !isPrivileged && !this.authStore.hasPermission('contactos.ver_todos');
    });

    isNombreInvalid = computed(() => {
        const ctrl = this.form.get('nombre');
        return ctrl ? ctrl.invalid && ctrl.touched : false;
    });

    filteredList = computed(() => {
        let list = this.vm().list;

        const q = this.searchQuery().toLowerCase();
        if (q.trim()) {
            list = list.filter(p =>
                p.primer_nombre.toLowerCase().includes(q) ||
                p.primer_apellido.toLowerCase().includes(q)
            );
        }

        const filters = this.activeFilters();

        if (filters.has('all')) {
            return list;
        }

        const activeStates = this.estados().filter(e => {
            const n = e.nombre_estado.toLowerCase();
            return n.includes('activo') && !n.includes('inactivo');
        });
        const activeIds = new Set(activeStates.map(e => e.id_estado));

        if (activeIds.size === 0) {
            activeIds.add(1);
        }

        let statusFiltered = list;
        const wantsActive = filters.has('active');
        const wantsInactive = filters.has('inactive');

        if (wantsActive && !wantsInactive) {
            statusFiltered = list.filter(p => p.id_estado_publicador !== null && activeIds.has(p.id_estado_publicador));
        } else if (!wantsActive && wantsInactive) {
            statusFiltered = list.filter(p => p.id_estado_publicador === null || !activeIds.has(p.id_estado_publicador));
        }

        list = statusFiltered;

        if (filters.has('no-phone')) {
            const map = this.hasEmergencyPhoneMap();
            list = list.filter(p => !map.get(Number(p.id_publicador)));
        }

        return list;
    });

    constructor() {
        this.form = this.fb.group({
            nombre: ['', Validators.required],
            parentesco: [''],
            telefono: [''],
            direccion: [''],
            es_principal: [false],
            solo_urgencias: [false]
        });

        this.loadEstados();

        // Track virtual keyboard height to keep mobile FAB visible above it
        if (typeof window !== 'undefined' && window.visualViewport) {
            const onViewportResize = () => {
                const keyboardHeight = window.innerHeight - window.visualViewport!.height;
                this.fabBottomPx.set(keyboardHeight > 50 ? keyboardHeight + 16 : 24);
            };
            window.visualViewport.addEventListener('resize', onViewportResize);
            this.destroyRef.onDestroy(() => {
                window.visualViewport?.removeEventListener('resize', onViewportResize);
            });
        }

        effect(() => {
            const user = this.authStore.user();
            const effectiveId = this.congregacionContext.effectiveCongregacionId();
            if (!user) return;

            untracked(() => {
                const params: any = { limit: 1000, offset: 0 };
                if (effectiveId != null) params.id_congregacion = effectiveId;
                if (this.isScopedToGroup()) {
                    const idGrupo = user.id_grupo_publicador;
                    if (idGrupo != null) params.id_grupo = idGrupo;
                }
                this.facade.load(params);
                this.loadEmergencyContactsMap();
            });
        });

        effect(async () => {
            const p = this.selectedPublicador();
            if (p) {
                this.loadingContactos = true;
                this.showForm.set(false);
                this.pendingDeleteId.set(null);
                try {
                    const res = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', {
                        params: { id_publicador: p.id_publicador }
                    }));
                    this.contactos.set(res || []);
                } catch (e) {
                    console.error(e);
                    this.contactos.set([]);
                } finally {
                    this.loadingContactos = false;
                }
            } else {
                this.contactos.set([]);
            }
        });
    }

    // ── Toast helper ────────────────────────────────────────
    private showToast(type: Toast['type'], message: string) {
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toast.set({ type, message });
        this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
    }

    // ── Form helpers ─────────────────────────────────────────
    cancelForm() {
        if (this.form.dirty) {
            this.showDiscardWarning.set(true);
        } else {
            this.showDiscardWarning.set(false);
            this.showDireccion.set(false);
            this.showForm.set(false);
        }
    }

    discardChanges() {
        this.showDiscardWarning.set(false);
        this.showDireccion.set(false);
        this.form.markAsPristine();
        this.showForm.set(false);
    }

    async loadEstados() {
        try {
            const res = await lastValueFrom(this.http.get<any[]>('/api/estados/'));
            this.estados.set(res || []);
        } catch (e) {
            console.error('Error loading estados', e);
        }
    }

    async loadEmergencyContactsMap() {
        try {
            const effectiveId = this.congregacionContext.effectiveCongregacionId();
            const params: any = { limit: 10000, offset: 0 };

            if (effectiveId != null) {
                params.id_congregacion = effectiveId;
            }

            const allContacts = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', { params }));

            const map = new Map<number, boolean>();
            if (allContacts) {
                for (const c of allContacts) {
                    const pid = Number(c.id_publicador);
                    const s = String(c.telefono || '').trim();
                    const hasPhone = s.length > 0 && /\d/.test(s);

                    if (!map.has(pid)) {
                        map.set(pid, hasPhone);
                    } else if (hasPhone) {
                        map.set(pid, true);
                    }
                }
            }
            this.hasEmergencyPhoneMap.set(map);
        } catch (err) {
            console.error('Could not load emergency contacts index', err);
        }
    }

    toggleFilter(f: string) {
        const current = new Set(this.activeFilters());

        if (f === 'all') {
            this.activeFilters.set(new Set(['all']));
            return;
        }

        if (current.has('all')) {
            current.delete('all');
        }

        if (f === 'active') {
            if (current.has('active')) current.delete('active');
            else {
                current.add('active');
                current.delete('inactive');
            }
        } else if (f === 'inactive') {
            if (current.has('inactive')) current.delete('inactive');
            else {
                current.add('inactive');
                current.delete('active');
            }
        } else {
            if (current.has(f)) current.delete(f);
            else current.add(f);
        }

        if (current.size === 0) {
            current.add('all');
        }

        this.activeFilters.set(current);
    }

    selectPublicador(p: Publicador) {
        this.selectedPublicador.set(p);
    }

    getInitials(p: Publicador): string {
        return (p.primer_nombre.charAt(0) + p.primer_apellido.charAt(0)).toUpperCase();
    }

    getAvatarStyle(p: Publicador): string {
        const name = [p.primer_nombre, p.primer_apellido].filter(Boolean).join(' ');
        return getInitialAvatarStyle(name);
    }

    async exportarPDF() {
        const idCong = this.congregacionContext.effectiveCongregacionId();
        if (idCong == null) return;

        this.downloadingPdf.set(true);
        try {
            const blob = await lastValueFrom(this.http.get('/api/export/contactos-emergencia/pdf', {
                params: { id_congregacion: idCong },
                responseType: 'blob'
            }));

            if (blob) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Contactos_Emergencia.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
                this.showToast('success', 'PDF descargado correctamente');
            }
        } catch (e) {
            console.error(e);
            this.showToast('error', 'No se pudo exportar el PDF. Intenta de nuevo.');
        } finally {
            this.downloadingPdf.set(false);
        }
    }

    // ── CRUD Contacts ────────────────────────────────────────

    initNewContacto() {
        this.editingContacto.set(null);
        this.form.reset({ es_principal: false, solo_urgencias: false });
        this.parentescoSearch.set('');
        this.showParentescoDropdown.set(false);
        this.showDireccion.set(false);
        this.showDiscardWarning.set(false);
        this.showForm.set(true);
    }

    edit(c: ContactoEmergencia) {
        this.editingContacto.set(c);
        this.form.patchValue(c);
        this.parentescoSearch.set(c.parentesco || '');
        this.showParentescoDropdown.set(false);
        this.showDireccion.set(!!c.direccion);
        this.showDiscardWarning.set(false);
        this.showForm.set(true);
    }

    async save() {
        this.form.markAllAsTouched();
        if (this.form.invalid) return;

        const val = this.form.value;
        const pub = this.selectedPublicador();
        if (!pub) return;

        this.loadingContactos = true;
        this.savingContactos = true;
        try {
            if (this.editingContacto()) {
                const id = this.editingContacto()!.id_contacto_emergencia;
                await lastValueFrom(this.http.put('/api/contactos-emergencia/' + id, val));
                this.showToast('success', 'Contacto actualizado');
            } else {
                const payload = { ...val, id_publicador: pub.id_publicador };
                await lastValueFrom(this.http.post('/api/contactos-emergencia/', payload));
                this.showToast('success', 'Contacto guardado');
            }
            this.form.markAsPristine();
            this.showDiscardWarning.set(false);
            this.showDireccion.set(false);
            this.showForm.set(false);
            const res = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', {
                params: { id_publicador: pub.id_publicador }
            }));
            this.contactos.set(res || []);
            await this.loadEmergencyContactsMap();

        } catch (e) {
            console.error(e);
            this.showToast('error', 'No se pudo guardar. Verifica tu conexión e intenta de nuevo.');
        } finally {
            this.loadingContactos = false;
            this.savingContactos = false;
        }
    }

    async confirmDelete(c: ContactoEmergencia) {
        const pub = this.selectedPublicador();
        if (!pub) return;

        // Play exit animation before touching the DOM or the API
        this.pendingDeleteId.set(null);
        this.removingId.set(c.id_contacto_emergencia ?? null);
        await new Promise(r => setTimeout(r, 290));
        this.removingId.set(null);

        this.loadingContactos = true;
        this.savingContactos = true;
        try {
            await lastValueFrom(this.http.delete('/api/contactos-emergencia/' + c.id_contacto_emergencia));
            const res = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', {
                params: { id_publicador: pub.id_publicador }
            }));
            this.contactos.set(res || []);
            await this.loadEmergencyContactsMap();
            this.showToast('success', `Contacto eliminado`);

        } catch (e) {
            console.error(e);
            this.showToast('error', 'No se pudo eliminar. Intenta de nuevo.');
        } finally {
            this.loadingContactos = false;
            this.savingContactos = false;
        }
    }

    trackByPublicador(index: number, p: Publicador) {
        return p.id_publicador;
    }

    trackByContacto(index: number, c: ContactoEmergencia) {
        return c.id_contacto_emergencia;
    }
}

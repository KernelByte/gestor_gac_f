import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { PublicadoresFacade } from '../../application/publicadores.facade'; // Reuse facade to get list
import { Publicador } from '../../domain/models/publicador';
import { AuthStore } from '../../../../../core/auth/auth.store';

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

@Component({
    standalone: true,
    selector: 'app-publicadores-contactos',
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    template: `
    <div class="h-full flex flex-col lg:flex-row gap-6 relative overflow-hidden">
        
        <!-- SIDEBAR (List) -->
        <!-- Logic: On mobile, hidden if a contact is selected. On Desktop, always visible (flex). -->
        <div class="flex-none w-full lg:w-[420px] flex flex-col bg-white lg:rounded-2xl shadow-sm border-x lg:border border-slate-200 overflow-hidden transition-all duration-300"
             [ngClass]="selectedPublicador() ? 'hidden lg:flex h-full' : 'flex h-full'">
            
            <!-- Floating Header -->
            <div class="p-5 border-b border-slate-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10">
                <div class="flex items-center justify-between mb-4 hidden lg:flex">
                    <h3 class="font-display font-bold text-slate-800 text-lg">Directorio</h3>
                    <button 
                        (click)="exportarPDF()" 
                        [disabled]="downloadingPdf()"
                        class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors relative disabled:opacity-50 disabled:cursor-not-allowed" 
                        title="Exportar Lista de Contactos (PDF)">
                        <svg *ngIf="!downloadingPdf()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <div *ngIf="downloadingPdf()" class="w-5 h-5 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin"></div>
                    </button>
                </div>
                
                <!-- Search Bar -->
                <div class="relative group">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-orange">
                        <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <input 
                        type="text" 
                        [ngModel]="searchQuery()" 
                        (ngModelChange)="searchQuery.set($event)"
                        placeholder="Buscar publicador..." 
                        class="w-full pl-11 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 outline-none transition-all shadow-sm"
                    >
                </div>
                
                <!-- Filter Pills (Scrollable) -->
                <div class="flex gap-2 mt-4 overflow-x-auto no-scrollbar pb-1 mask-linear-fade">
                    <button (click)="toggleFilter('all')"
                        class="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border shrink-0"
                        [ngClass]="activeFilters().has('all') ? 'bg-slate-800 border-slate-800 text-white shadow-md shadow-slate-900/10' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'">
                        Todos
                    </button>
                    <button (click)="toggleFilter('active')"
                        class="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border shrink-0 flex items-center gap-1.5"
                        [ngClass]="activeFilters().has('active') ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200'">
                        <span class="w-1.5 h-1.5 rounded-full" [ngClass]="activeFilters().has('active') ? 'bg-emerald-500' : 'bg-emerald-400'"></span>
                        Activos
                    </button>
                    <button (click)="toggleFilter('inactive')"
                        class="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border shrink-0"
                        [ngClass]="activeFilters().has('inactive') ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'">
                        Inactivos
                    </button>
                    <button (click)="toggleFilter('no-phone')"
                        class="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border shrink-0 flex items-center gap-1.5"
                        [ngClass]="activeFilters().has('no-phone') ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200'">
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        Sin Teléfono
                    </button>
                </div>
            </div>

            <!-- List Members -->
            <div class="flex-1 overflow-y-auto simple-scrollbar bg-slate-50/50">
                <div *ngIf="vm().loading && vm().list.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div class="w-6 h-6 border-2 border-slate-200 border-t-brand-orange rounded-full animate-spin mb-3"></div>
                    <span class="text-xs font-bold">Cargando directorio...</span>
                </div>

                <div class="space-y-px">
                    <button 
                        *ngFor="let p of filteredList()"
                        (click)="selectPublicador(p)"
                        class="w-full text-left p-4 hover:bg-slate-50 transition-all flex items-center gap-4 group relative"
                        [ngClass]="selectedPublicador()?.id_publicador === p.id_publicador 
                            ? 'bg-slate-50 relative before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-brand-orange before:rounded-r-full' 
                            : 'bg-white'"
                    >
                        <!-- Avatar (Pastel Colors) -->
                        <div class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-bold text-sm shadow-sm transition-colors"
                            [ngClass]="getAvatarClass(p.id_publicador)">
                            {{ getInitials(p) }}
                        </div>
                        
                        <div class="min-w-0 flex-1">
                            <h4 class="text-sm font-bold text-slate-800 truncate leading-tight mb-1 group-hover:text-brand-orange transition-colors">
                                {{ p.primer_nombre }} {{ p.primer_apellido }}
                            </h4>
                            <p class="text-xs text-slate-400 font-medium truncate flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                {{ p.telefono || 'Sin teléfono' }}
                            </p>
                        </div>
                    </button>
                    
                    <!-- Empty State for Search -->
                     <div *ngIf="filteredList().length === 0 && !vm().loading" class="p-8 text-center">
                        <p class="text-sm font-bold text-slate-500">No se encontraron resultados</p>
                        <p class="text-xs text-slate-400 mt-1">Intenta con otro nombre</p>
                     </div>
                </div>
            </div>
            
            <!-- Footer Status -->
            <div class="p-3 bg-slate-50 border-t border-slate-200 text-center">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {{ filteredList().length }} Miembros
                </span>
            </div>
        </div>

        <!-- MAIN CONTENT (Islands Style) -->
        <div class="flex-1 flex flex-col bg-white lg:rounded-2xl shadow-sm border-x lg:border border-slate-200 overflow-hidden relative transition-all duration-300"
             [ngClass]="!selectedPublicador() ? 'hidden lg:flex' : 'flex h-full'">
            
            <!-- EMPTY STATE -->
            <!-- EMPTY STATE -->
            <div *ngIf="!selectedPublicador()" class="flex-1 w-full h-full flex flex-col items-center justify-center p-8 bg-white z-10">
                <div class="w-24 h-24 bg-orange-50/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-orange-100 flex items-center justify-center mb-8">
                    <svg class="w-10 h-10 text-orange-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                </div>
                <h2 class="text-xl font-bold text-slate-900 tracking-tight">Selecciona un miembro</h2>
                <p class="text-slate-500 max-w-xs text-center mt-2 text-sm leading-relaxed">
                    Selecciona un publicador de la lista para gestionar sus contactos de emergencia.
                </p>
            </div>

            <!-- DETAIL VIEW -->
            <div *ngIf="selectedPublicador() as p" class="flex flex-col h-full animate-fadeIn relative">
                
                <!-- Navbar Mobile Back Button -->
                <div class="lg:hidden p-4 bg-white border-b border-slate-100 flex items-center gap-3">
                    <button (click)="selectedPublicador.set(null)" class="p-2 -ml-2 hover:bg-slate-50 rounded-lg text-slate-600">
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <span class="font-bold text-slate-800">Volver a la lista</span>
                </div>

                <!-- Header Profile -->
                <div class="relative bg-white border-b border-slate-100 p-5 md:p-8 md:pb-12 overflow-hidden shadow-sm shrink-0">
                     <!-- Deco BG -->
                     <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-orange-50 to-transparent rounded-bl-full -mr-12 -mt-12 opacity-60 pointer-events-none"></div>
                     <div class="absolute bottom-0 left-0 w-32 h-32 bg-slate-50 rounded-tr-full -ml-8 -mb-8 pointer-events-none"></div>
                     
                     <div class="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
                        <div class="flex items-center gap-4 md:gap-6">
                            <!-- Avatar Large -->
                            <div class="w-16 h-16 md:w-20 md:h-20 rounded-2xl shadow-xl flex items-center justify-center text-xl md:text-2xl font-display font-black ring-4 ring-white shrink-0"
                                 [ngClass]="getAvatarClass(p.id_publicador)">
                                {{ getInitials(p) }}
                            </div>
                            <div>
                                <h1 class="text-xl md:text-3xl font-display font-black text-slate-900 tracking-tight leading-tight">{{ p.primer_nombre }} {{ p.primer_apellido }}</h1>
                                <div class="flex flex-wrap items-center gap-3 md:gap-4 mt-2">
                                    <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] md:text-xs font-bold border border-slate-200" title="Número de teléfono personal">
                                        <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                        <span class="text-slate-400 font-normal mr-1 hidden sm:inline">Personal:</span>
                                        {{ p.telefono || 'N/A' }}
                                    </div>
                                    <span class="text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100" *ngIf="p.id_estado_publicador === 1">Activo</span>
                                </div>
                            </div>
                        </div>

                        <!-- Add Button -->
                        <button (click)="initNewContacto()" class="w-full md:w-auto group flex items-center justify-center gap-2 px-6 py-3 bg-brand-orange text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:bg-orange-600 hover:shadow-orange-600/40 active:scale-95 transition-all">
                            <span class="bg-white/20 p-1 rounded-lg group-hover:rotate-90 transition-transform duration-300">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </span>
                            <span>Añadir Contacto</span>
                        </button>
                     </div>
                </div>

                <!-- CONTENT BODY -->
                <div class="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-8 relative">
                    
                    <!-- Form Overlay / Inline -->
                    <div *ngIf="showForm()" class="fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:mb-8 animate-fadeInUp flex flex-col justify-end md:block">
                        <!-- Backdrop for mobile -->
                        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm md:hidden" (click)="showForm.set(false)"></div>
                        
                        <!-- Form Container -->
                        <div class="relative w-full bg-white rounded-t-3xl md:rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-xl md:shadow-slate-900/5 border-t md:border border-slate-200 overflow-hidden max-w-3xl mx-auto h-[85vh] md:h-auto flex flex-col md:block">
                            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                 <h3 class="font-bold text-slate-800 flex items-center gap-2">
                                     <span class="w-2 h-2 rounded-full bg-brand-orange"></span>
                                     {{ editingContacto() ? 'Editar Información' : 'Nuevo Contacto de Emergencia' }}
                                 </h3>
                                 <button (click)="showForm.set(false)" class="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                                 </button>
                            </div>
                            <!-- Reusing form logic with improved classes -->
                             <div class="p-4 flex-1 overflow-y-auto max-h-[70vh] md:max-h-none" [formGroup]="form">
                                 <div class="grid grid-cols-12 gap-3 mb-4">
                                     <!-- Name Full Width -->
                                     <div class="col-span-12 space-y-1">
                                         <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nombre <span class="text-red-400">*</span></label>
                                         <input formControlName="nombre" class="w-full h-8 px-2 bg-slate-50 border-slate-200 rounded text-sm focus:bg-white focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-300" placeholder="Nombre del contacto">
                                     </div>
                                     
                                     <!-- Parentesco & Phone on same line (6 cols each on mobile too if space allows, otherwise 12) -->
                                     <div class="col-span-6 space-y-1">
                                         <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Parentesco</label>
                                         <input formControlName="parentesco" class="w-full h-8 px-2 bg-slate-50 border-slate-200 rounded text-sm focus:bg-white focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-300" placeholder="Ej: Madre">
                                     </div>
                                     
                                     <div class="col-span-6 space-y-1">
                                         <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Teléfono</label>
                                         <input formControlName="telefono" class="w-full h-8 px-2 bg-slate-50 border-slate-200 rounded text-sm focus:bg-white focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-300" placeholder="Teléfono">
                                     </div>

                                     <!-- Address Full Width -->
                                     <div class="col-span-12 space-y-1">
                                         <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Dirección</label>
                                         <input formControlName="direccion" class="w-full h-8 px-2 bg-slate-50 border-slate-200 rounded text-sm focus:bg-white focus:ring-1 focus:ring-brand-orange focus:border-brand-orange transition-all outline-none placeholder:text-slate-300" placeholder="Dirección o notas...">
                                     </div>
                                 </div>
                                 
                                 <!-- Checkboxes Compact Row -->
                                 <div class="flex items-center justify-between gap-2 p-3 bg-slate-50/80 rounded-lg border border-slate-100 mb-4">
                                     <label class="flex items-center gap-2 cursor-pointer">
                                         <input formControlName="es_principal" type="checkbox" class="w-3.5 h-3.5 rounded text-brand-orange focus:ring-brand-orange border-slate-300">
                                         <span class="text-xs font-bold text-slate-600">Principal</span>
                                     </label>
                                     <div class="h-4 w-px bg-slate-200"></div>
                                     <label class="flex items-center gap-2 cursor-pointer">
                                         <input formControlName="solo_urgencias" type="checkbox" class="w-3.5 h-3.5 rounded text-slate-600 focus:ring-slate-500 border-slate-300">
                                         <span class="text-xs font-bold text-slate-600">Solo Urgencias</span>
                                     </label>
                                 </div>

                                 <!-- Single Action Buttons Row -->
                                 <div class="flex gap-2">
                                     <button (click)="showForm.set(false)" class="flex-1 h-9 rounded-lg border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-50 transition-all">Cancelar</button>
                                     <button (click)="save()" class="flex-[2] h-9 rounded-lg bg-slate-900 text-white font-bold text-xs shadow hover:bg-slate-800 active:scale-95 transition-all">
                                        {{ editingContacto() ? 'Guardar Cambios' : 'Guardar Contacto' }}
                                     </button>
                                 </div>
                            </div>
                        </div>
                    </div>

                    <!-- Contact Cards Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-6xl mx-auto items-start">
                        
                        <!-- Empty State Small (if no contacts) -->
                        <div *ngIf="contactos().length === 0 && !showForm()" class="md:col-span-2 xl:col-span-3 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                             <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                <svg class="w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v16m8-8H4"/></svg>
                             </div>
                             <p class="font-bold text-slate-600 mb-1">Sin contactos de emergencia</p>
                             <p class="text-sm text-slate-400 mb-6">Añade al menos un contacto para seguridad.</p>
                             <button (click)="initNewContacto()" class="px-6 py-2 bg-white border border-slate-200 rounded-full font-bold text-sm text-slate-700 hover:border-brand-orange hover:text-brand-orange transition-colors">
                                Añadir Ahora
                             </button>
                        </div>
                        
                        <!-- Card Item -->
                        <div *ngFor="let c of contactos()" class="group bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 hover:border-orange-100 transition-all duration-300 relative overflow-hidden">
                             <!-- Action Buttons (Static on mobile, Hover on Desktop) -->
                             <div class="absolute top-4 right-4 flex gap-1 transform translate-x-0 lg:translate-x-12 lg:group-hover:translate-x-0 transition-transform duration-300 bg-white/80 backdrop-blur rounded-lg p-1 shadow-sm border border-slate-100 z-10">
                                 <button (click)="edit(c)" class="p-2 text-slate-400 hover:text-brand-orange hover:bg-orange-50 rounded-md transition-colors" title="Editar">
                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                 </button>
                                 <button (click)="delete(c)" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Eliminar">
                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                 </button>
                             </div>

                             <div class="flex items-start justify-between mb-4">
                                 <div class="flex items-center gap-4">
                                     <!-- Initials -->
                                     <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-100 flex items-center justify-center text-xl font-bold text-slate-400 group-hover:from-orange-50 group-hover:to-orange-100 group-hover:text-brand-orange transition-all">
                                         {{ c.nombre.charAt(0).toUpperCase() }}
                                     </div>
                                     <div>
                                         <h4 class="font-bold text-slate-800 text-lg leading-tight group-hover:text-brand-orange transition-colors">{{ c.nombre }}</h4>
                                         <p class="text-sm font-medium text-slate-400">{{ c.parentesco || 'Familiar' }}</p>
                                     </div>
                                 </div>
                             </div>

                             <div class="space-y-3">
                                 <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-100 transition-all">
                                     <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm">
                                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                     </div>
                                     <span class="font-bold text-sm text-slate-700">{{ c.telefono || 'Sin teléfono' }}</span>
                                 </div>
                                 
                                 <div *ngIf="c.direccion" class="flex items-start gap-3 p-3 text-sm text-slate-500">
                                     <svg class="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                     <span class="leading-snug">{{ c.direccion }}</span>
                                 </div>
                             </div>

                             <!-- Tags -->
                             <div class="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-50">
                                 <span *ngIf="c.es_principal" class="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] uppercase font-black tracking-wide border border-emerald-100">Principal</span>
                                 <span *ngIf="c.solo_urgencias" class="px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] uppercase font-black tracking-wide">Solo Urgencias</span>
                             </div>
                        </div>

                        <!-- Quick Add Card -->
                        <button (click)="initNewContacto()" class="group flex flex-col items-center justify-center min-h-[280px] rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-orange hover:bg-orange-50/20 transition-all p-6 text-center">
                            <div class="w-14 h-14 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-300 group-hover:scale-110 group-hover:text-brand-orange group-hover:border-orange-200 transition-all mb-4">
                                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </div>
                            <h4 class="font-bold text-slate-400 group-hover:text-brand-orange transition-colors">Añadir otro</h4>
                        </button>

                    </div>
                    
                    <!-- Loading Overlay for Detail -->
                    <div *ngIf="loadingContactos" class="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-20 flex items-center justify-center">
                        <div class="bg-white p-4 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                            <div class="w-10 h-10 border-4 border-slate-100 border-t-brand-orange rounded-full animate-spin"></div>
                            <span class="text-xs font-bold text-slate-500">Actualizando...</span>
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
    .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
    .animate-fadeInUp { animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class PublicadoresContactosComponent {
    private facade = inject(PublicadoresFacade);
    private authStore = inject(AuthStore);
    private http = inject(HttpClient);
    private fb = inject(FormBuilder);

    vm = this.facade.vm;

    // UI State
    searchQuery = signal('');
    // Valid filters: 'active', 'inactive', 'no-phone'
    // 'all' is represented by empty set or specific check
    activeFilters = signal<Set<string>>(new Set(['all']));
    selectedPublicador = signal<Publicador | null>(null);
    downloadingPdf = signal(false);

    // Contacts Data
    contactos = signal<ContactoEmergencia[]>([]);
    loadingContactos = false;

    // Cache for filter Logic
    // Map<publicadorId, boolean> -> true if has at least one emergency contact with phone
    private hasEmergencyPhoneMap = signal<Map<number, boolean>>(new Map());
    private estados = signal<any[]>([]);

    // Form State
    showForm = signal(false);
    editingContacto = signal<ContactoEmergencia | null>(null);
    form: FormGroup;

    // Public List filtering logic
    filteredList = computed(() => {
        let list = this.vm().list;

        // 1. Text Search
        const q = this.searchQuery().toLowerCase();
        if (q.trim()) {
            list = list.filter(p =>
                p.primer_nombre.toLowerCase().includes(q) ||
                p.primer_apellido.toLowerCase().includes(q)
            );
        }

        // 2. Filters
        const filters = this.activeFilters();

        if (filters.has('all')) {
            return list;
        }

        // Apply Status Filters dynamically
        // Find ALL states that are considered "Active" (name includes 'activo')
        // CRITICAL FIX: "Inactivo" contains "activo", so we must explicitly exclude it.
        const activeStates = this.estados().filter(e => {
            const n = e.nombre_estado.toLowerCase();
            return n.includes('activo') && !n.includes('inactivo');
        });
        const activeIds = new Set(activeStates.map(e => e.id_estado));

        // Check if we found any, otherwise fallback to standard logic (maybe ID 1?) 
        // useful if api fails or hasn't loaded yet.
        if (activeIds.size === 0) {
            activeIds.add(1);
        }

        let statusFiltered = list;
        const wantsActive = filters.has('active');
        const wantsInactive = filters.has('inactive');

        if (wantsActive && !wantsInactive) {
            // Users with ANY of the active IDs
            statusFiltered = list.filter(p => p.id_estado_publicador !== null && activeIds.has(p.id_estado_publicador));
        } else if (!wantsActive && wantsInactive) {
            // Users with NONE of the active IDs (implied inactive)
            statusFiltered = list.filter(p => p.id_estado_publicador === null || !activeIds.has(p.id_estado_publicador));
        }

        list = statusFiltered;

        // Apply Attribute Filters (AND logic)
        if (filters.has('no-phone')) {
            // "Sin Teléfono [Emergencia]"
            // Show only those who DO NOT have an emergency phone
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
            // etiqueta removed
            direccion: [''],
            es_principal: [false],
            solo_urgencias: [false]
        });

        this.loadEstados();

        // Auto load data on init - ONCE
        let listLoaded = false;
        effect(() => {
            const user = this.authStore.user();
            if (!listLoaded && this.vm().list.length === 0 && user) {
                listLoaded = true;
                const params: any = { limit: 100, offset: 0 };
                if (user.id_congregacion) params.id_congregacion = user.id_congregacion;
                this.facade.load(params);
            }
        }, { allowSignalWrites: true });

        // Load ALL emergency contacts mapping for filtering - ONCE
        let mapLoaded = false;
        effect(() => {
            const user = this.authStore.user();
            if (!mapLoaded && user) {
                mapLoaded = true;
                this.loadEmergencyContactsMap();
            }
        }, { allowSignalWrites: true });

        // Auto load contacts when selection changes
        effect(async () => {
            const p = this.selectedPublicador();
            if (p) {
                this.loadingContactos = true;
                this.showForm.set(false);
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
        }, { allowSignalWrites: true });
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
            const user = this.authStore.user();
            const params: any = { limit: 10000, offset: 0 };

            if (user?.id_congregacion) {
                params.id_congregacion = user.id_congregacion;
            }

            // Fetch ALL contacts to build the Index
            const allContacts = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', { params }));

            const map = new Map<number, boolean>();
            if (allContacts) {
                for (const c of allContacts) {
                    const pid = Number(c.id_publicador);
                    const s = String(c.telefono || '').trim();
                    // Must have content AND at least one digit to be a "real" phone
                    const hasPhone = s.length > 0 && /\d/.test(s);

                    // Logic: If ANY of their contacts has a phone, they are "Good".
                    if (!map.has(pid)) {
                        map.set(pid, hasPhone);
                    } else if (hasPhone) {
                        // If we found a valid phone for a user who previously had "false" (bad contact), update to true
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

        // If clicking a specific filter, remove 'all'
        if (current.has('all')) {
            current.delete('all');
        }

        // Exclusive Logic for Status
        if (f === 'active') {
            if (current.has('active')) current.delete('active');
            else {
                current.add('active');
                current.delete('inactive'); // Remove opposing status
            }
        } else if (f === 'inactive') {
            if (current.has('inactive')) current.delete('inactive');
            else {
                current.add('inactive');
                current.delete('active'); // Remove opposing status
            }
        } else {
            // General Generic Toggle
            if (current.has(f)) current.delete(f);
            else current.add(f);
        }

        // If empty, revert to all
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

    getAvatarClass(id: number): string {
        const COLORS = [
            'bg-blue-50 text-blue-600',
            'bg-emerald-50 text-emerald-600',
            'bg-orange-50 text-orange-600',
            'bg-purple-50 text-purple-600',
            'bg-cyan-50 text-cyan-600',
            'bg-rose-50 text-rose-600',
            'bg-indigo-50 text-indigo-600'
        ];
        return COLORS[Math.abs(id) % COLORS.length];
    }

    async exportarPDF() {
        const user = this.authStore.user();
        if (!user?.id_congregacion) return;

        this.downloadingPdf.set(true);
        try {
            const blob = await lastValueFrom(this.http.get('/api/export/contactos-emergencia/pdf', {
                params: { id_congregacion: user.id_congregacion },
                responseType: 'blob'
            }));

            if (blob) {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Contactos_Emergencia.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error(e);
            alert('Error al exportar PDF');
        } finally {
            this.downloadingPdf.set(false);
        }
    }

    // --- CRUD Contacts ---

    initNewContacto() {
        this.editingContacto.set(null);
        this.form.reset({ es_principal: false, solo_urgencias: false });
        this.showForm.set(true);
    }

    edit(c: ContactoEmergencia) {
        this.editingContacto.set(c);
        this.form.patchValue(c);
        this.showForm.set(true);
    }

    async save() {
        if (this.form.invalid) return;
        const val = this.form.value;
        const pub = this.selectedPublicador();
        if (!pub) return;

        this.loadingContactos = true;
        try {
            if (this.editingContacto()) {
                const id = this.editingContacto()!.id_contacto_emergencia;
                await lastValueFrom(this.http.put('/api/contactos-emergencia/' + id, val));
            } else {
                const payload = { ...val, id_publicador: pub.id_publicador };
                await lastValueFrom(this.http.post('/api/contactos-emergencia/', payload));
            }
            this.showForm.set(false);
            // Reload local list
            const res = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', {
                params: { id_publicador: pub.id_publicador }
            }));
            this.contactos.set(res || []);

            // Refresh Global Filter
            await this.loadEmergencyContactsMap();

        } catch (e) {
            alert('Error al guardar');
        } finally {
            this.loadingContactos = false;
        }
    }

    async delete(c: ContactoEmergencia) {
        if (!confirm('¿Eliminar contacto?')) return;
        const pub = this.selectedPublicador();
        if (!pub) return;

        this.loadingContactos = true;
        try {
            await lastValueFrom(this.http.delete('/api/contactos-emergencia/' + c.id_contacto_emergencia));
            const res = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', {
                params: { id_publicador: pub.id_publicador }
            }));
            this.contactos.set(res || []);

            // Refresh Global Filter
            await this.loadEmergencyContactsMap();

        } catch (e) {
            alert('Error al eliminar');
        } finally {
            this.loadingContactos = false;
        }
    }
}

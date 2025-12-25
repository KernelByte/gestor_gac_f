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
        <div class="flex-none w-full lg:w-96 flex flex-col bg-white lg:rounded-2xl shadow-sm border-x lg:border border-slate-200 overflow-hidden transition-all duration-300"
             [ngClass]="selectedPublicador() ? 'hidden lg:flex h-full' : 'flex h-full'">
            
            <!-- Floating Header -->
            <div class="p-5 border-b border-slate-100 bg-white/95 backdrop-blur-sm sticky top-0 z-10">
                <h3 class="font-display font-bold text-slate-800 text-lg mb-4 hidden lg:block">Directorio</h3>
                
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
                    <button (click)="filterType.set('all')"
                        class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0"
                        [ngClass]="filterType() === 'all' ? 'bg-slate-800 border-slate-800 text-white shadow-md shadow-slate-900/20' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'">
                        Todos
                    </button>
                    <button (click)="filterType.set('active')"
                        class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0"
                        [ngClass]="filterType() === 'active' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-600'">
                        Activos
                    </button>
                    <button (click)="filterType.set('inactive')"
                        class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0"
                        [ngClass]="filterType() === 'inactive' ? 'bg-red-500 border-red-500 text-white shadow-md shadow-red-500/20' : 'bg-white border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600'">
                        Inactivos
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
            <div *ngIf="!selectedPublicador()" class="flex-1 w-full h-full flex flex-col items-center justify-center p-8 bg-slate-50/50 z-10">
                <div class="w-32 h-32 bg-white rounded-3xl shadow-xl shadow-slate-200/60 flex items-center justify-center mb-6 ring-4 ring-slate-50 transform rotate-3 transition-transform hover:rotate-0 duration-500">
                    <svg class="w-16 h-16 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h2 class="text-2xl font-display font-black text-slate-800 tracking-tight">Selecciona un miembro</h2>
                <p class="text-slate-500 max-w-sm text-center mt-3 text-lg leading-relaxed">
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
                <div class="relative bg-white border-b border-slate-100 p-8 pb-12 overflow-hidden shadow-sm shrink-0">
                     <!-- Deco BG -->
                     <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-orange-50 to-transparent rounded-bl-full -mr-12 -mt-12 opacity-60"></div>
                     <div class="absolute bottom-0 left-0 w-32 h-32 bg-slate-50 rounded-tr-full -ml-8 -mb-8"></div>
                     
                     <div class="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
                        <div class="flex items-center gap-6">
                            <!-- Avatar Large -->
                            <div class="w-20 h-20 rounded-2xl shadow-xl flex items-center justify-center text-2xl font-display font-black ring-4 ring-white"
                                 [ngClass]="getAvatarClass(p.id_publicador)">
                                {{ getInitials(p) }}
                            </div>
                            <div>
                                <h1 class="text-3xl font-display font-black text-slate-900 tracking-tight">{{ p.primer_nombre }} {{ p.primer_apellido }}</h1>
                                <div class="flex items-center gap-4 mt-2">
                                    <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200" title="Número de teléfono personal">
                                        <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                        <span class="text-slate-400 font-normal mr-1">Personal:</span>
                                        {{ p.telefono || 'N/A' }}
                                    </div>
                                    <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100" *ngIf="p.id_estado_publicador === 1">Activo</span>
                                </div>
                            </div>
                        </div>

                        <!-- Add Button -->
                        <button (click)="initNewContacto()" class="group flex items-center gap-2 px-6 py-3 bg-brand-orange text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:bg-orange-600 hover:shadow-orange-600/40 active:scale-95 transition-all">
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
                    <div *ngIf="showForm()" class="mb-8 animate-fadeInUp">
                        <!-- Same form structure but enhanced styles -->
                        <div class="bg-white rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200 overflow-hidden max-w-3xl mx-auto">
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
                            <div class="p-6 md:p-8" [formGroup]="form">
                                 <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                     <div class="space-y-2">
                                         <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre Completo <span class="text-red-400">*</span></label>
                                         <input formControlName="nombre" class="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 outline-none transition-all" placeholder="Nombre del contacto">
                                     </div>
                                     <div class="space-y-2">
                                         <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Parentesco</label>
                                         <input formControlName="parentesco" class="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 outline-none transition-all" placeholder="Ej: Madre, Esposo">
                                     </div>
                                     <div class="space-y-2">
                                         <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Teléfono</label>
                                         <input formControlName="telefono" class="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 outline-none transition-all" placeholder="+57...">
                                     </div>
                                     <div class="space-y-2">
                                         <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Etiqueta Visual</label>
                                         <div class="relative">
                                            <select formControlName="etiqueta" class="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 outline-none transition-all appearance-none cursor-pointer">
                                                <option value="">-- Seleccionar --</option>
                                                <option value="Esposa/o">Esposa/o</option>
                                                <option value="Hijo/a">Hijo/a</option>
                                                <option value="Padre/Madre">Padre/Madre</option>
                                                <option value="Trabajo">Trabajo</option>
                                            </select>
                                            <svg class="w-4 h-4 text-slate-400 absolute right-4 top-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                                         </div>
                                     </div>
                                     <div class="md:col-span-2 space-y-2">
                                         <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Dirección / Notas</label>
                                         <textarea formControlName="direccion" class="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 outline-none transition-all resize-none" placeholder="Dirección física o indicaciones especiales..."></textarea>
                                     </div>
                                 </div>
                                 
                                 <div class="flex flex-wrap gap-6 pt-6 border-t border-slate-100">
                                     <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                                         <input formControlName="es_principal" type="checkbox" class="w-5 h-5 rounded text-brand-orange focus:ring-brand-orange border-slate-300">
                                         <div class="flex flex-col">
                                            <span class="font-bold text-sm text-slate-700">Contacto Principal</span>
                                            <span class="text-[10px] text-slate-400">Llamar primero en emergencia</span>
                                         </div>
                                     </label>
                                     <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                                         <input formControlName="solo_urgencias" type="checkbox" class="w-5 h-5 rounded text-slate-600 focus:ring-slate-500 border-slate-300">
                                         <div class="flex flex-col">
                                            <span class="font-bold text-sm text-slate-700">Solo Urgencias</span>
                                            <span class="text-[10px] text-slate-400">No contactar por otros motivos</span>
                                         </div>
                                     </label>
                                 </div>

                                 <div class="flex justify-end gap-3 mt-8">
                                     <button (click)="showForm.set(false)" class="px-6 h-12 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-all">Cancelar</button>
                                     <button (click)="save()" class="px-8 h-12 rounded-xl bg-slate-900 text-white font-bold shadow-lg hover:bg-slate-800 hover:shadow-xl active:scale-95 transition-all">
                                        {{ editingContacto() ? 'Guardar Cambios' : 'Crear Contacto' }}
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
                             <!-- Action Buttons (Floating) -->
                             <div class="absolute top-4 right-4 flex gap-1 transform translate-x-12 group-hover:translate-x-0 transition-transform duration-300 bg-white/80 backdrop-blur rounded-lg p-1 shadow-sm border border-slate-100">
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
                                 <span *ngIf="c.etiqueta" class="px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 text-[10px] uppercase font-black tracking-wide">{{ c.etiqueta }}</span>
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
    filterType = signal<'all' | 'active' | 'inactive'>('all');
    selectedPublicador = signal<Publicador | null>(null);

    // Contacts Data
    contactos = signal<ContactoEmergencia[]>([]);
    loadingContactos = false;

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

        // 2. Status Filter
        if (this.filterType() === 'active') {
            // Assuming id_estado 1 is active, adjust if needed (usually checking name is safer but id is faster)
            // Or using a simple heuristic if 'Activo' str is not available here easily without joining
            // If the facade provides populated Publicador with estado name, better.
            // For now, let's assume standard IDs: 1=Activo, 2=Inactivo
            list = list.filter(p => p.id_estado_publicador === 1);
        } else if (this.filterType() === 'inactive') {
            list = list.filter(p => p.id_estado_publicador !== 1);
        }

        return list;
    });

    constructor() {
        this.form = this.fb.group({
            nombre: ['', Validators.required],
            parentesco: [''],
            telefono: [''],
            etiqueta: [''],
            direccion: [''],
            es_principal: [false],
            solo_urgencias: [false]
        });

        // Auto load data on init
        effect(() => {
            // Just trigger load if empty
            const user = this.authStore.user();
            if (this.vm().list.length === 0 && user) {
                const params: any = { limit: 100, offset: 0 };
                if (user.id_congregacion) params.id_congregacion = user.id_congregacion;
                this.facade.load(params);
            }
        });

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
        });
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
            // Reload
            const res = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', {
                params: { id_publicador: pub.id_publicador }
            }));
            this.contactos.set(res || []);
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
        } catch (e) {
            alert('Error al eliminar');
        } finally {
            this.loadingContactos = false;
        }
    }
}

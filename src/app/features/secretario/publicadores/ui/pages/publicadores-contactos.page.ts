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
    <div class="flex h-[calc(100vh-220px)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        <!-- Sidebar: List of Publishers -->
        <div class="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
            <!-- Search -->
            <div class="p-4 border-b border-slate-100 bg-white">
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <input 
                        type="text" 
                        [ngModel]="searchQuery()" 
                        (ngModelChange)="searchQuery.set($event)"
                        placeholder="Buscar miembro..." 
                        class="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
                    >
                </div>
                
                <!-- Filter Chips -->
                <div class="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
                    <button 
                        (click)="filterType.set('all')"
                        class="px-3 py-1 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap"
                        [ngClass]="filterType() === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'"
                    >Todos</button>
                    <button 
                        (click)="filterType.set('active')"
                        class="px-3 py-1 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap"
                        [ngClass]="filterType() === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'"
                    >Activos</button>
                    <button 
                        (click)="filterType.set('inactive')"
                         class="px-3 py-1 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap"
                        [ngClass]="filterType() === 'inactive' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'"
                    >Inactivos</button>
                </div>
            </div>

            <!-- List -->
            <div class="flex-1 overflow-y-auto">
                <div *ngIf="vm().loading && vm().list.length === 0" class="p-8 text-center text-slate-400 text-xs">Cargando...</div>
                
                <button 
                    *ngFor="let p of filteredList()"
                    (click)="selectPublicador(p)"
                    class="w-full text-left p-4 hover:bg-white border-b border-transparent hover:border-slate-100 transition-all flex items-center gap-3 group relative"
                    [ngClass]="{'bg-white shadow-sm border-l-4 !border-l-brand-purple border-y-slate-100 z-10': selectedPublicador()?.id_publicador === p.id_publicador}"
                >
                    <!-- Avatar -->
                    <div 
                        class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-slate-200 text-xs font-bold transition-colors"
                        [ngClass]="selectedPublicador()?.id_publicador === p.id_publicador ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-purple-50 group-hover:text-purple-600'"
                    >
                        {{ getInitials(p) }}
                    </div>
                    
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-slate-800 truncate" [class.text-brand-purple]="selectedPublicador()?.id_publicador === p.id_publicador">
                            {{ p.primer_nombre }} {{ p.primer_apellido }}
                        </p>
                        <p class="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full" [ngClass]="p.id_estado_publicador === 1 ? 'bg-emerald-500' : 'bg-slate-300'"></span>
                            {{ p.telefono || 'Sin teléfono' }}
                        </p>
                    </div>

                    <div *ngIf="selectedPublicador()?.id_publicador === p.id_publicador" class="absolute right-4 text-brand-purple">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    </div>
                </button>
            </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
            
            <div *ngIf="!selectedPublicador()" class="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center animate-fadeIn">
                <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <svg class="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                </div>
                <h3 class="text-lg font-bold text-slate-600">Selecciona un miembro</h3>
                <p class="text-sm max-w-xs mt-2">Selecciona un publicador de la lista para gestionar sus contactos de emergencia.</p>
            </div>

            <div *ngIf="selectedPublicador() as p" class="flex-1 flex flex-col h-full animate-fadeIn">
                
                <!-- Header User -->
                <div class="bg-white px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-5">
                       <!-- Avatar Big -->
                       <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-100 shadow-sm flex items-center justify-center text-xl font-black text-slate-500">
                          {{ getInitials(p) }}
                       </div>
                       <div>
                           <h2 class="text-2xl font-black text-slate-900 tracking-tight">{{ p.primer_nombre }} {{ p.primer_apellido }}</h2>
                           <div class="flex items-center gap-3 mt-1 text-sm text-slate-500 font-medium">
                               <span class="flex items-center gap-1.5" *ngIf="p.telefono">
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                  {{ p.telefono }}
                               </span>
                               <span class="flex items-center gap-1.5" *ngIf="!p.telefono">
                                  Sin teléfono personal
                               </span>
                           </div>
                       </div>
                    </div>
                    
                    <button 
                        (click)="initNewContacto()"
                        class="px-5 h-11 bg-[#6D28D9] hover:bg-[#5b21b6] text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-900/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        Añadir Contacto
                    </button>
                </div>

                <!-- Scrollable Content -->
                <div class="flex-1 overflow-y-auto p-8">
                    
                    <!-- Info Banner -->
                    <div class="p-4 bg-blue-50/80 border border-blue-100 rounded-xl flex gap-3 text-blue-800 mb-8 max-w-4xl">
                        <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                        <p class="text-sm font-medium leading-relaxed">
                            En caso de emergencia, se llamará a los contactos en el orden mostrado a continuación. Asegúrate de mantener esta información actualizada.
                        </p>
                    </div>

                    <!-- Form Inline -->
                    <div *ngIf="showForm()" class="mb-8 max-w-4xl animate-fadeInUp">
                        <div class="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                             <div class="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                 <h3 class="font-bold text-slate-800">{{ editingContacto() ? 'Editar Contacto' : 'Nuevo Contacto' }}</h3>
                                 <button (click)="showForm.set(false)" class="p-1 rounded-full hover:bg-slate-200 text-slate-400">
                                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                 </button>
                             </div>
                             <div class="p-6" [formGroup]="form">
                                 <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                     <div>
                                         <label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Nombre Completo</label>
                                         <input formControlName="nombre" type="text" placeholder="Ej. Marta Pérez" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-purple-400 focus:ring-4 focus:ring-purple-50 outline-none transition-all">
                                     </div>
                                     <div>
                                         <label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Parentesco</label>
                                         <div class="relative">
                                             <input formControlName="parentesco" type="text" placeholder="Ej. Esposa, Hijo, Vecina" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-purple-400 focus:ring-4 focus:ring-purple-50 outline-none transition-all">
                                         </div>
                                     </div>
                                      <div>
                                         <label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Teléfono</label>
                                         <input formControlName="telefono" type="text" placeholder="+57 300 ..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-purple-400 focus:ring-4 focus:ring-purple-50 outline-none transition-all">
                                     </div>
                                     <div>
                                         <label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Etiqueta Visual</label>
                                         <select formControlName="etiqueta" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-purple-400 focus:ring-4 focus:ring-purple-50 outline-none transition-all">
                                             <option value="">-- Ninguna --</option>
                                             <option value="Esposa/o">Esposa/o</option>
                                             <option value="Hijo/a">Hijo/a</option>
                                             <option value="Padre/Madre">Padre/Madre</option>
                                             <option value="Vecino/a">Vecino/a</option>
                                             <option value="Trabajo">Trabajo</option>
                                         </select>
                                     </div>
                                     <div class="md:col-span-2">
                                         <label class="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Dirección / Notas Adicionales</label>
                                         <input formControlName="direccion" type="text" placeholder="Dirección física o notas importantes..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-purple-400 focus:ring-4 focus:ring-purple-50 outline-none transition-all">
                                     </div>
                                 </div>
                                 
                                 <div class="flex items-center gap-6 pt-2 border-t border-slate-50">
                                     <label class="flex items-center gap-3 cursor-pointer group">
                                         <div class="relative flex items-center">
                                            <input formControlName="es_principal" type="checkbox" class="peer sr-only">
                                            <div class="w-10 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6D28D9]"></div>
                                         </div>
                                         <span class="text-sm font-medium text-slate-700 group-hover:text-purple-700 transition-colors">Contacto Principal</span>
                                     </label>

                                     <label class="flex items-center gap-3 cursor-pointer group">
                                         <div class="relative flex items-center">
                                            <input formControlName="solo_urgencias" type="checkbox" class="peer sr-only">
                                            <div class="w-10 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-800"></div>
                                         </div>
                                         <span class="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">Solo Urgencias</span>
                                     </label>
                                 </div>

                                 <div class="flex justify-end gap-3 mt-6">
                                     <button (click)="showForm.set(false)" class="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all">Cancelar</button>
                                     <button (click)="save()" class="px-6 py-2.5 rounded-xl font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/10 active:scale-95 transition-all">
                                        {{ editingContacto() ? 'Actualizar Contacto' : 'Guardar Contacto' }}
                                     </button>
                                 </div>
                             </div>
                        </div>
                    </div>

                    <!-- Grid Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
                        
                        <!-- Cards -->
                        <div *ngFor="let c of contactos()" class="group bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all relative">
                            <!-- Helper Initials -->
                            <div class="flex justify-between items-start mb-4">
                               <div class="flex items-center gap-3">
                                   <div class="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-lg font-bold text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                                       {{ c.nombre.charAt(0).toUpperCase() }}
                                   </div>
                                   <div>
                                       <div class="flex items-center gap-2">
                                           <h4 class="font-bold text-slate-900">{{ c.nombre }}</h4>
                                           <span *ngIf="c.etiqueta" class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wide">{{ c.etiqueta }}</span>
                                           <span *ngIf="c.es_principal" class="px-2 py-0.5 rounded bg-green-50 text-green-700 text-[10px] uppercase font-bold tracking-wide">Principal</span>
                                       </div>
                                       <p class="text-xs font-medium text-slate-400 mt-0.5">{{ c.parentesco || 'Familiar' }}</p>
                                   </div>
                               </div>
                               
                               <!-- Actions -->
                               <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button (click)="edit(c)" class="p-1.5 text-slate-300 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                                   <button (click)="delete(c)" class="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                               </div>
                            </div>

                            <!-- Details -->
                            <div class="space-y-2">
                                <div class="flex items-center gap-3 text-sm text-slate-700 font-medium p-2 rounded-lg bg-slate-50 group-hover:bg-white border border-transparent group-hover:border-slate-100 transition-all">
                                    <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                    {{ c.telefono || 'Sin teléfono' }}
                                </div>
                                <div *ngIf="c.direccion" class="flex items-start gap-3 text-sm text-slate-500 p-2 rounded-lg">
                                    <svg class="w-4 h-4 text-slate-400 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                    {{ c.direccion }}
                                </div>
                                <div *ngIf="c.solo_urgencias" class="flex items-center gap-2 text-[10px] font-bold text-slate-500 pt-1">
                                    <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                                    Trabajo (Solo urgencias)
                                </div>
                            </div>
                        </div>

                        <!-- Add Button Card -->
                        <button (click)="initNewContacto()" class="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-purple-300 hover:bg-purple-50/30 transition-all group min-h-[220px]">
                            <div class="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:scale-110 group-hover:bg-purple-100 group-hover:text-purple-600 transition-all mb-3">
                                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                            </div>
                            <span class="font-bold text-slate-400 group-hover:text-purple-700 transition-colors">Añadir otro contacto</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Loading Overlay -->
             <div *ngIf="loadingContactos" class="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 transition-opacity duration-200">
                <div class="w-8 h-8 rounded-full border-2 border-slate-100 border-t-purple-600 animate-spin"></div>
            </div>

        </div>
    </div>
  `,
    styles: [`
    :host { display: block; }
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

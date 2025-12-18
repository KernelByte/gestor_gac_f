import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PublicadoresFacade } from '../../application/publicadores.facade';
import { Publicador } from '../../domain/models/publicador';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

interface Estado {
  id_estado: number;
  tipo: string;
  nombre_estado: string;
}

interface Grupo {
  id_grupo: number;
  nombre_grupo: string;
  capitan_grupo?: string;
}

type TabType = 'personal' | 'teocratico';

@Component({
  standalone: true,
  selector: 'app-publicadores-page',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="h-full flex flex-col w-full max-w-[1600px] mx-auto p-4 sm:p-8 bg-gray-50/50">
      
      <!-- Top Header Area -->
      <div class="shrink-0 flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Gestión de Miembros</h1>
          <p class="text-slate-500 mt-1 max-w-2xl">Administra la información, privilegios y grupos de servicio de los publicadores de la congregación.</p>
        </div>
        <button 
          (click)="openCreateForm()"
          class="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-[#5B3C88] hover:bg-[#4a2f73] text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
          Novo Miembro
        </button>
      </div>

      <!-- Search & Filter Card -->
      <div class="shrink-0 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 mb-6 flex flex-col xl:flex-row items-center gap-4">
        <!-- Search Input -->
        <div class="relative w-full xl:max-w-md">
           <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
           </div>
           <input 
              type="text" 
              [(ngModel)]="searchQuery"
              (input)="onSearch()"
              placeholder="Buscar por nombre, teléfono o grupo..." 
              class="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-slate-700 font-medium placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#5B3C88]/20 transition-all outline-none"
           >
        </div>

        <!-- Filter Chips (Static styling for demo based on image, mapped to real functionality where possible) -->
        <div class="flex items-center gap-2 overflow-x-auto w-full pb-1 xl:pb-0 no-scrollbar">
           <button 
              (click)="selectedEstado = null; onFilterChange()"
              [class.bg-[#5B3C88]]="selectedEstado === null"
              [class.text-white]="selectedEstado === null"
              [class.bg-slate-100]="selectedEstado !== null"
              [class.text-slate-600]="selectedEstado !== null"
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors"
            >
              Todos <span class="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{{ vm().list.length }}</span>
           </button>
           
           <button 
              *ngFor="let e of estadosPublicador()"
              (click)="selectedEstado = e.id_estado; onFilterChange()"
              [class.bg-[#5B3C88]]="selectedEstado === e.id_estado"
              [class.text-white]="selectedEstado === e.id_estado"
              [class.bg-slate-50]="selectedEstado !== e.id_estado"
              [class.text-slate-600]="selectedEstado !== e.id_estado"
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-slate-100 transition-colors"
           >
              {{ e.nombre_estado }}
           </button>
        </div>

        <div class="h-8 w-px bg-slate-200 hidden xl:block"></div>

        <button class="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors xl:ml-auto">
           <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
        </button>
      </div>

      <!-- Main Table Card -->
      <div class="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div class="flex-1 overflow-auto simple-scrollbar relative">
           
           <!-- Loading Overlay -->
           <div *ngIf="vm().loading" class="absolute inset-0 z-20 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
              <div class="w-8 h-8 rounded-full border-2 border-slate-100 border-t-[#5B3C88] animate-spin"></div>
           </div>

           <table class="w-full text-left border-collapse">
              <thead class="sticky top-0 bg-white z-10 box-decoration-clone">
                 <tr class="border-b border-slate-100">
                    <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nombre</th>
                    <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Grupo</th>
                    <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fecha Nac.</th>
                    <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fecha Bau.</th>
                    <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Teléfono</th>
                    <th class="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                    <th class="px-4 py-5 w-10"></th>
                 </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                 <tr *ngFor="let p of vm().list; trackBy: trackById" class="group hover:bg-slate-50/80 transition-all">
                    
                    <!-- Nombre -->
                    <td class="px-6 py-4 relative">
                       <!-- Left Accent Border on Hover/Active -->
                       <div class="absolute left-0 top-0 bottom-0 w-[4px] bg-[#5B3C88] opacity-0 group-hover:opacity-100 transition-opacity rounded-r-full"></div>
                       
                       <div class="flex items-center gap-4 pl-2">
                          <div 
                              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-transparent group-hover:ring-[#5B3C88]/10 transition-all text-white text-xs font-bold"
                              [ngStyle]="{'background-color': getAvatarColor(p.id_publicador)}"
                          >
                             {{ getInitials(p) }}
                          </div>
                          <div>
                             <p class="text-sm font-bold text-slate-800">{{ p.primer_nombre }} {{ p.primer_apellido }}</p>
                             <p class="text-xs text-slate-400 mt-0.5">{{ p.segundo_nombre }} {{ p.segundo_apellido }}</p>
                          </div>
                       </div>
                    </td>

                    <!-- Grupo -->
                    <td class="px-6 py-4">
                       <div class="flex items-center gap-2 text-slate-600">
                          <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          <span class="text-sm font-medium">{{ getGrupoNombre(p.id_grupo_publicador) || 'Sin Grupo' }}</span>
                       </div>
                    </td>

                    <!-- Fecha Nacimiento -->
                    <td class="px-6 py-4">
                       <span class="text-sm text-slate-600 font-medium">{{ formatDate(p.fecha_nacimiento) }}</span>
                    </td>

                    <!-- Fecha Bautismo -->
                    <td class="px-6 py-4">
                       <span class="text-sm text-slate-600 font-medium">{{ formatDate(p.fecha_bautismo) }}</span>
                    </td>

                    <!-- Teléfono -->
                    <td class="px-6 py-4">
                       <span class="text-sm text-slate-600 font-mono">{{ p.telefono || '—' }}</span>
                    </td>

                    <!-- Estado -->
                    <td class="px-6 py-4">
                        <span 
                            class="inline-flex items-center gap-2 text-xs font-bold"
                            [ngClass]="getEstadoTextClass(p.id_estado_publicador)"
                        >
                            <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getEstadoDotClass(p.id_estado_publicador)"></span>
                            {{ getEstadoNombre(p.id_estado_publicador) }}
                        </span>
                    </td>

                    <!-- Actions -->
                    <td class="px-6 py-4 text-right">
                       <div class="relative group/menu">
                          <button class="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                             <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/></svg>
                          </button>
                          <!-- Floating Menu (Simulated for this demo, usually better with a directive or overlay) -->
                          <div class="absolute right-0 top-8 w-32 bg-white rounded-xl shadow-xl border border-slate-100 p-1 opacity-0 group-hover/menu:opacity-100 invisible group-hover/menu:visible transition-all z-20 flex flex-col">
                             <button (click)="openEditForm(p)" class="text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-purple-50 hover:text-purple-700 rounded-lg">Editar</button>
                             <button (click)="confirmDelete(p)" class="text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg">Eliminar</button>
                          </div>
                       </div>
                    </td>
                 </tr>

                 <!-- Empty State -->
                 <tr *ngIf="vm().list.length === 0 && !vm().loading">
                    <td colspan="7" class="py-20 text-center">
                        <div class="flex flex-col items-center">
                            <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                               <svg class="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
                            </div>
                            <h3 class="text-slate-900 font-bold">No se encontraron miembros</h3>
                            <p class="text-slate-500 text-sm mt-1">Intenta con otros términos de búsqueda.</p>
                        </div>
                    </td>
                 </tr>
              </tbody>
           </table>
        </div>

        <!-- Pagination Footer -->
        <div class="p-6 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
            <span class="text-xs font-medium text-slate-500">Mostrando <span class="font-bold text-slate-800">{{ vm().list.length }}</span> registros</span>
            <div class="flex gap-2">
                 <button 
                  (click)="prevPage()" 
                  [disabled]="vm().params.offset === 0"
                  class="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-[#5B3C88] hover:border-[#5B3C88]/30 disabled:opacity-50 transition-all font-bold"
                 >
                   <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                 </button>
                 <button 
                  (click)="nextPage()" 
                  [disabled]="vm().list.length < (vm().params.limit || 20)"
                  class="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-[#5B3C88] hover:border-[#5B3C88]/30 disabled:opacity-50 transition-all font-bold"
                 >
                   <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                 </button>
            </div>
        </div>
      </div>

       <!-- Side Panel (Styled like the reference image) -->
      <div 
        *ngIf="panelOpen()"
        class="fixed inset-0 z-50 overflow-hidden"
      >
        <div class="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px] transition-opacity duration-300" (click)="closePanel()"></div>
        
        <div class="absolute inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl transform transition-transform duration-500 cubic-bezier(0.25, 1, 0.5, 1) flex flex-col overflow-hidden"
          [ngClass]="{ 'translate-x-0': panelOpen(), 'translate-x-full': !panelOpen() }"
        >
          <!-- Title & Close -->
           <div class="px-8 pt-8 pb-4 shrink-0">
              <div class="flex items-start justify-between">
                  <div>
                      <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {{ editingPublicador() ? 'EDITAR PERFIL' : 'NUEVO MIEMBRO' }}
                      </p>
                      <h2 class="text-2xl font-black text-slate-900 truncate max-w-[300px]" *ngIf="editingPublicador()">
                          {{ editingPublicador()?.primer_nombre }} {{ editingPublicador()?.primer_apellido }}
                      </h2>
                      <h2 class="text-2xl font-black text-slate-900" *ngIf="!editingPublicador()">Crear Registro</h2>
                  </div>
                  <button (click)="closePanel()" class="p-2 -mr-2 text-slate-400 hover:text-slate-600 transition-colors">
                      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
              </div>

               <!-- Avatar Large Circle -->
               <div class="mt-6 flex justify-center">
                    <div 
                        class="w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-3xl font-black"
                        [ngStyle]="{'background-color': editingPublicador() ? getAvatarColor(editingPublicador()!.id_publicador) : '#e2e8f0'}"
                    >
                         <span *ngIf="editingPublicador()">{{ getInitials(editingPublicador()) }}</span>
                         <svg *ngIf="!editingPublicador()" class="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    </div>
               </div>
           </div>

           <!-- Tabs -->
           <div class="px-8 border-b border-slate-100 flex gap-8 shrink-0">
               <button 
                  (click)="activeTab.set('personal')" 
                  class="pb-3 text-sm font-bold transition-colors relative"
                  [ngClass]="activeTab() === 'personal' ? 'text-[#5B3C88]' : 'text-slate-400 hover:text-slate-600'"
               >
                  Personal
                  <span *ngIf="activeTab() === 'personal'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B3C88]"></span>
               </button>
               <button 
                  (click)="activeTab.set('teocratico')" 
                  class="pb-3 text-sm font-bold transition-colors relative"
                  [ngClass]="activeTab() === 'teocratico' ? 'text-[#5B3C88]' : 'text-slate-400 hover:text-slate-600'"
               >
                  Teocrático
                  <span *ngIf="activeTab() === 'teocratico'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5B3C88]"></span>
               </button>
           </div>

           <!-- Form Content -->
           <div class="flex-1 overflow-y-auto px-8 py-6 simple-scrollbar">
              <form [formGroup]="publicadorForm" (ngSubmit)="onSubmit()" class="space-y-6">
                
                <!-- TAB: PERSONAL -->
                <div *ngIf="activeTab() === 'personal'" class="space-y-5 animate-fadeIn">
                     <!-- Nombre Completo Input Style (Full Width) -->
                     <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Nombre Completo</label>
                        <div class="grid grid-cols-2 gap-3">
                             <input formControlName="primer_nombre" placeholder="Nombre 1" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all">
                             <input formControlName="segundo_nombre" placeholder="Nombre 2" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all">
                             <input formControlName="primer_apellido" placeholder="Apellido 1" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all">
                             <input formControlName="segundo_apellido" placeholder="Apellido 2" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all">
                        </div>
                     </div>

                     <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Teléfono</label>
                            <input formControlName="telefono" placeholder="+57 300 123 4567" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all">
                        </div>
                         <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Dirección / Barrio</label>
                            <input formControlName="direccion" placeholder="Calle 123 # 45-67" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all">
                        </div>
                     </div>

                     <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Fecha Nacimiento</label>
                            <input type="date" formControlName="fecha_nacimiento" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all">
                        </div>
                         <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Sexo</label>
                            <select formControlName="sexo" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all cursor-pointer">
                                <option value="">Seleccionar</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                            </select>
                        </div>
                     </div>

                     <!-- Estado Radio Group -->
                     <div>
                        <label class="block text-xs font-bold text-slate-500 mb-2 ml-1">Estado</label>
                         <div class="flex items-center gap-6">
                             <label class="flex items-center gap-2 cursor-pointer">
                                 <input type="radio" value="1" class="w-5 h-5 text-[#5B3C88] border-slate-300 focus:ring-[#5B3C88]" [checked]="getEstadoNombre(publicadorForm.get('id_estado_publicador')?.value)?.includes('Activo')" (change)="setEstado('Activo')">
                                 <span class="text-sm font-medium text-slate-700">Activo</span>
                             </label>
                              <label class="flex items-center gap-2 cursor-pointer">
                                 <input type="radio" value="2" class="w-5 h-5 text-[#5B3C88] border-slate-300 focus:ring-[#5B3C88]" [checked]="getEstadoNombre(publicadorForm.get('id_estado_publicador')?.value)?.includes('Inactivo')" (change)="setEstado('Inactivo')">
                                 <span class="text-sm font-medium text-slate-700">Inactivo</span>
                             </label>
                         </div>
                     </div>
                </div>

                <!-- TAB: TEOCRÁTICO -->
                <div *ngIf="activeTab() === 'teocratico'" class="space-y-5 animate-fadeIn">
                      
                      <!-- Privilegios Alert/Box -->
                      <div class="p-4 bg-purple-50 rounded-xl border border-purple-100 flex flex-col gap-2">
                          <span class="text-xs font-bold text-purple-800 uppercase tracking-wide">Privilegios Actuales</span>
                          <div class="flex gap-2 flex-wrap">
                               <button 
                                type="button" 
                                (click)="toggleUngido()"
                                [class.bg-purple-600]="publicadorForm.get('ungido')?.value"
                                [class.text-white]="publicadorForm.get('ungido')?.value"
                                [class.bg-white]="!publicadorForm.get('ungido')?.value"
                                [class.text-purple-700]="!publicadorForm.get('ungido')?.value"
                                class="px-3 py-1.5 rounded-lg border border-purple-200 text-xs font-bold shadow-sm transition-all"
                               >
                                  Ungido
                               </button>
                               <span class="px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-purple-400 text-xs font-bold border-dashed cursor-not-allowed" title="Próximamente">
                                  + Agregar Privilegio
                               </span>
                          </div>
                      </div>

                      <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Grupo de Servicio</label>
                            <select formControlName="id_grupo_publicador" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all cursor-pointer">
                                <option [ngValue]="null">Sin asignar</option>
                                <option *ngFor="let g of grupos()" [ngValue]="g.id_grupo">{{ g.nombre_grupo }}</option>
                            </select>
                      </div>

                      <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Fecha Bautismo</label>
                             <input type="date" formControlName="fecha_bautismo" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Estado (Detallado)</label>
                            <select formControlName="id_estado_publicador" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-[#5B3C88]/30 focus:ring-4 focus:ring-[#5B3C88]/5 outline-none transition-all cursor-pointer">
                                <option [ngValue]="null">Seleccionar</option>
                                <option *ngFor="let e of estadosPublicador()" [ngValue]="e.id_estado">{{ e.nombre_estado }}</option>
                            </select>
                        </div>
                      </div>
                </div>

              </form>
           </div>

           <!-- Panel Footer -->
           <div class="p-8 border-t border-slate-100 flex items-center justify-end gap-4 bg-white shrink-0">
               <button (click)="closePanel()" class="px-6 py-3 rounded-xl hover:bg-slate-50 text-slate-500 font-bold text-sm transition-colors">Cancelar</button>
               <button (click)="onSubmit()" [disabled]="publicadorForm.invalid || saving()" class="px-8 py-3 rounded-xl bg-[#5B3C88] text-white font-bold text-sm hover:bg-[#4a2f73] shadow-lg shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-50">
                   Guardar Cambios
               </button>
           </div>
        </div>
      </div>

       <!-- Delete Modal (Clean) -->
      <div *ngIf="deleteModalOpen()" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity" (click)="closeDeleteModal()"></div>
          <div class="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-fadeInUp">
             <h3 class="text-lg font-bold text-slate-900 mb-2">¿Eliminar miembro?</h3>
             <p class="text-sm text-slate-500 mb-6">Esta acción eliminará permanentemente a <strong class="text-slate-900">{{ publicadorToDelete()?.primer_nombre }}</strong> de la base de datos.</p>
             <div class="flex gap-3 justify-end">
                <button (click)="closeDeleteModal()" class="px-4 py-2 rounded-lg text-slate-600 font-bold text-sm hover:bg-slate-50">Cancelar</button>
                <button (click)="executeDelete()" class="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700">Eliminar</button>
             </div>
          </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
    }
    .simple-scrollbar::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    .simple-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .simple-scrollbar::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 4px;
    }
    .simple-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #cbd5e1;
    }
    .animate-fadeIn {
        animation: fadeIn 0.3s ease-out forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateX(10px); }
        to { opacity: 1; transform: translateX(0); }
    }
    .animate-fadeInUp {
        animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .box-decoration-clone {
        box-decoration-break: clone;
    }
    /* Hide scrollbar for Chrome, Safari and Opera */
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
    /* Hide scrollbar for IE, Edge and Firefox */
    .no-scrollbar {
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
    }
  `]
})
export class PublicadoresPage implements OnInit {
  private facade = inject(PublicadoresFacade);
  private authStore = inject(AuthStore);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);

  vm = this.facade.vm;

  // UI State
  panelOpen = signal(false);
  deleteModalOpen = signal(false);
  saving = signal(false);
  editingPublicador = signal<Publicador | null>(null);
  publicadorToDelete = signal<Publicador | null>(null);
  activeTab = signal<TabType>('personal');

  // Filter State
  searchQuery = '';
  selectedGrupo: number | null = null;
  selectedEstado: number | null = null;

  // Auxiliary Data
  estados = signal<Estado[]>([]);
  grupos = signal<Grupo[]>([]);

  // Form
  publicadorForm: FormGroup;

  constructor() {
    this.publicadorForm = this.fb.group({
      primer_nombre: ['', [Validators.required, Validators.maxLength(100)]],
      segundo_nombre: ['', Validators.maxLength(100)],
      primer_apellido: ['', [Validators.required, Validators.maxLength(100)]],
      segundo_apellido: ['', Validators.maxLength(100)],
      sexo: [''],
      fecha_nacimiento: [null],
      telefono: [''],
      direccion: [''],
      barrio: [''],
      fecha_bautismo: [null],
      ungido: [false],
      id_grupo_publicador: [null],
      id_estado_publicador: [null, Validators.required],
      consentimiento_datos: [false]
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.loadAuxiliaryData();
  }

  // Computed values
  estadosPublicador = computed(() => {
    return this.estados().filter(e => e.tipo === 'Teocratico');
  });

  // Data Loading
  loadData() {
    this.facade.load({ limit: 20, offset: 0 });
  }

  async loadAuxiliaryData() {
    try {
      // Added trailing slashes to match service configuration
      const estados = await lastValueFrom(this.http.get<Estado[]>('/api/estados/'));
      this.estados.set(estados || []);
      const grupos = await lastValueFrom(this.http.get<Grupo[]>('/api/grupos/'));
      this.grupos.set(grupos || []);

      // Debug log to verify data integrity
      console.log('Aux Data Loaded:', { estados: estados, grupos: grupos });
    } catch (error) {
      console.error('Error loading auxiliary data:', error);
    }
  }

  // Search & Filters
  private searchDebounce: any;
  onSearch() {
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.facade.load({
        q: this.searchQuery || undefined,
        id_grupo: this.selectedGrupo || undefined,
        id_estado: this.selectedEstado || undefined,
        offset: 0
      });
    }, 300);
  }

  onFilterChange() {
    this.facade.load({
      q: this.searchQuery || undefined,
      id_grupo: this.selectedGrupo || undefined,
      id_estado: this.selectedEstado || undefined,
      offset: 0
    });
  }

  // Pagination
  prevPage() {
    const offset = Math.max(0, (this.vm().params.offset || 0) - (this.vm().params.limit || 20));
    this.facade.load({ offset });
  }

  nextPage() {
    const offset = (this.vm().params.offset || 0) + (this.vm().params.limit || 20);
    this.facade.load({ offset });
  }

  // Panel
  openCreateForm() {
    this.editingPublicador.set(null);
    this.activeTab.set('personal');
    this.publicadorForm.reset({
      consentimiento_datos: false,
      ungido: false,
      id_grupo_publicador: null,
      id_estado_publicador: null
    });
    this.panelOpen.set(true);
  }

  openEditForm(p: Publicador) {
    console.log('Editing Publicador:', p); // Debug log
    this.editingPublicador.set(p);
    this.activeTab.set('personal');
    this.publicadorForm.patchValue({
      primer_nombre: p.primer_nombre,
      segundo_nombre: p.segundo_nombre || '',
      primer_apellido: p.primer_apellido,
      segundo_apellido: p.segundo_apellido || '',
      sexo: p.sexo || '',
      fecha_nacimiento: p.fecha_nacimiento || null,
      telefono: p.telefono || '',
      direccion: p.direccion || '',
      barrio: p.barrio || '',
      fecha_bautismo: p.fecha_bautismo || null,
      ungido: p.ungido ?? false,
      id_grupo_publicador: p.id_grupo_publicador || null,
      id_estado_publicador: p.id_estado_publicador || null,
      consentimiento_datos: p.consentimiento_datos || false
    });
    this.panelOpen.set(true);
  }

  closePanel() {
    this.panelOpen.set(false);
    this.editingPublicador.set(null);
  }

  toggleUngido() {
    const current = this.publicadorForm.get('ungido')?.value;
    this.publicadorForm.get('ungido')?.setValue(!current);
  }

  // Helper to set estado from Radio buttons quick action in side panel
  setEstado(type: 'Activo' | 'Inactivo') {
    const estado = this.estadosPublicador().find(e => e.nombre_estado.includes(type));
    if (estado) {
      this.publicadorForm.get('id_estado_publicador')?.setValue(estado.id_estado);
    }
  }

  async onSubmit() {
    if (this.publicadorForm.invalid) return;

    this.saving.set(true);
    const data = this.publicadorForm.value;

    const user = this.authStore.user();
    const id_congregacion = user?.id_congregacion;

    if (!id_congregacion && !this.editingPublicador()) {
      alert('No se pudo determinar la congregación del usuario.');
      this.saving.set(false);
      return;
    }

    try {
      if (this.editingPublicador()) {
        await this.facade.update(this.editingPublicador()!.id_publicador, data);
      } else {
        await this.facade.create({ ...data, id_congregacion_publicador: id_congregacion });
      }
      this.closePanel();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      this.saving.set(false);
    }
  }

  // Delete
  confirmDelete(p: Publicador) {
    this.publicadorToDelete.set(p);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal() {
    this.deleteModalOpen.set(false);
    this.publicadorToDelete.set(null);
  }

  async executeDelete() {
    const p = this.publicadorToDelete();
    if (p) {
      await this.facade.remove(p.id_publicador);
      this.closeDeleteModal();
    }
  }

  // Helpers
  trackById(index: number, item: Publicador) {
    return item.id_publicador;
  }

  getInitials(p: Publicador | null): string {
    if (!p) return '';
    const first = p.primer_nombre?.charAt(0) || '';
    const last = p.primer_apellido?.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  getAvatarColor(id: number): string {
    const COLORS = [
      '#EF476F', // Red/Pink
      '#FFD166', // Yellow
      '#06D6A0', // Green
      '#118AB2', // Blue
      '#073B4C', // Dark Blue
      '#9D4EDD', // Purple
      '#FF9F1C', // Orange
      '#26547C', // Navy
      '#F72585', // Hot Pink
      '#4895EF'  // Sky Blue
    ];
    return COLORS[id % COLORS.length];
  }

  getGrupoNombre(id: number | string | null | undefined): string {
    if (!id) return 'Sin Grupo'; // Better default text
    // Use loose equality (==) to handle potential string/number mismatches in API response
    const grupo = this.grupos().find(g => g.id_grupo == id);
    return grupo?.nombre_grupo || 'Sin Grupo';
  }

  getEstadoNombre(id: number | string | null | undefined): string {
    if (!id) return 'Sin estado';
    const estado = this.estados().find(e => e.id_estado == id);
    return estado?.nombre_estado || 'Sin estado';
  }

  getEstadoTextClass(id: number | string | null | undefined): string {
    const nombre = this.getEstadoNombre(id)?.toLowerCase() || '';
    if (nombre.includes('inactivo')) return 'text-red-500';
    if (nombre.includes('activo')) return 'text-emerald-500';
    return 'text-slate-400';
  }

  getEstadoDotClass(id: number | string | null | undefined): string {
    const nombre = this.getEstadoNombre(id)?.toLowerCase() || '';
    if (nombre.includes('inactivo')) return 'bg-red-500';
    if (nombre.includes('activo')) return 'bg-emerald-500';
    return 'bg-slate-300';
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return '—';
    try {
      // Just extract YYYY-MM-DD to avoid timezone shifts
      const d = new Date(date);
      // Use UTC methods to prevent day shifting if the date is stored as pure date (YYYY-MM-DD)
      // but parsed as UTC midnight
      // If date string is '2025-05-15', new Date() might parse it as UTC, then local display might define it as prev day.
      // A safer bet for simple dates:
      const userTimezoneOffset = d.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(d.getTime() + userTimezoneOffset);

      return adjustedDate.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return date;
    }
  }
}

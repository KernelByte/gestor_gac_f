import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InformesService } from './services/informes.service';
import { GruposService } from '../grupos/services/grupos.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ResumenMensual, InformeConPublicador, InformeLoteItem, Periodo, HistorialAnual, ResumenSucursal } from './models/informe.model';

import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { PrivilegiosService } from '../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../privilegios/domain/models/publicador-privilegio';
import { saveAs } from 'file-saver';

@Component({
  standalone: true,
  selector: 'app-informes-main',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col gap-4 h-full overflow-hidden p-1">
      <!-- Tabs Navigation -->
      <div class="shrink-0 flex items-center gap-1 sm:gap-2 bg-white rounded-2xl p-1.5 sm:p-2 shadow-sm border border-slate-200/60 overflow-x-auto">
        <button *ngFor="let tab of visibleTabs()" 
          (click)="activeTab.set(tab.id)"
          class="px-3 py-2 sm:px-5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0"
          [ngClass]="activeTab() === tab.id 
            ? 'bg-brand-purple text-white shadow-lg shadow-purple-500/20' 
            : 'text-slate-500 hover:bg-slate-50'"
        >
          <span class="flex items-center gap-1.5 sm:gap-2">
            <span [innerHTML]="tab.icon"></span>
            <span class="hidden xs:inline">{{ tab.label }}</span>
            <span class="xs:hidden">{{ tab.label.split(' ')[0] }}</span>
          </span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <!-- Tab 1: Entrada Mensual -->
        <ng-container *ngIf="activeTab() === 'entrada'">
          <div class="flex flex-col gap-4 h-full">
            <!-- Summary Cards (Hidden on mobile for more vertical space) -->\r\n            <div class=\"shrink-0 hidden sm:grid sm:grid-cols-3 gap-2 sm:gap-4\">
              <div class="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-200/60">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Informes Recibidos</p>
                    <p class="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 sm:mt-1">
                      {{ resumen()?.informes_recibidos || 0 }}<span class="text-base sm:text-lg text-slate-400">/ {{ resumen()?.total_publicadores || 0 }}</span>
                    </p>
                  </div>
                  <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-100 flex items-center justify-center">
                    <svg class="w-5 h-5 sm:w-6 sm:h-6 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                </div>
              </div>
              <div class="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-200/60">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total Cursos</p>
                    <p class="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 sm:mt-1">{{ resumen()?.total_cursos || 0 }}</p>
                  </div>
                  <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-emerald-100 flex items-center justify-center">
                    <svg class="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                  </div>
                </div>
              </div>
              <div class="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-200/60">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Horas (Precursores)</p>
                    <p class="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 sm:mt-1">{{ resumen()?.total_horas_precursores || 0 | number }}</p>
                  </div>
                  <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-orange-100 flex items-center justify-center">
                    <svg class="w-5 h-5 sm:w-6 sm:h-6 text-brand-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Filters Bar (Custom Dropdowns) -->
            <div class="shrink-0 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200/60 relative z-20">
              
              <!-- Backdrop para cerrar dropdowns al hacer click fuera -->
              <div *ngIf="activeDropdown()" (click)="closeDropdown()" class="fixed inset-0 z-10 cursor-default"></div>

              <!-- Fila 1: Selectores de Periodo -->
              <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                <!-- Selector MES -->
                <div class="relative z-20" [class.pointer-events-none]="isRestrictedUser()" [class.opacity-50]="isRestrictedUser()">
                  <button (click)="!isRestrictedUser() && toggleDropdown('mes')" 
                  class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-sm font-bold text-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-brand-purple/20 min-w-[140px] justify-between"
                  [class.cursor-not-allowed]="isRestrictedUser()">
                  <span>{{ getMesLabel(selectedMes) }}</span>
                  <svg class="w-4 h-4 text-slate-400 transition-transform duration-200" [class.rotate-180]="activeDropdown() === 'mes'" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <!-- Dropdown Menu -->
                <div *ngIf="activeDropdown() === 'mes'" 
                  class="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-fadeInOriginTop">
                  <div class="max-h-64 overflow-y-auto simple-scrollbar p-1.5">
                    <button *ngFor="let m of meses" 
                      (click)="selectMes(m.value)"
                      class="w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-between group"
                      [ngClass]="selectedMes === m.value ? 'bg-brand-purple/10 text-brand-purple' : 'text-slate-600 hover:bg-slate-50'">
                      {{ m.label }}
                      <svg *ngIf="selectedMes === m.value" class="w-4 h-4 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Selector AÑO -->
              <div class="relative z-20" [class.pointer-events-none]="isRestrictedUser()" [class.opacity-50]="isRestrictedUser()">
                <button (click)="!isRestrictedUser() && toggleDropdown('ano')" 
                  class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-sm font-bold text-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-brand-purple/20 min-w-[100px] justify-between"
                  [class.cursor-not-allowed]="isRestrictedUser()">
                  <span>{{ selectedAno }}</span>
                  <svg class="w-4 h-4 text-slate-400 transition-transform duration-200" [class.rotate-180]="activeDropdown() === 'ano'" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <!-- Dropdown Menu -->
                <div *ngIf="activeDropdown() === 'ano'" 
                  class="absolute top-full left-0 mt-2 w-32 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-fadeInOriginTop">
                  <div class="max-h-64 overflow-y-auto simple-scrollbar p-1.5">
                    <button *ngFor="let a of anos" 
                      (click)="selectAno(a)"
                      class="w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-between"
                      [ngClass]="selectedAno === a ? 'bg-brand-purple/10 text-brand-purple' : 'text-slate-600 hover:bg-slate-50'">
                      {{ a }}
                      <svg *ngIf="selectedAno === a" class="w-4 h-4 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              <!-- View Switcher (Hidden for restricted users) -->
                <div *ngIf="!isRestrictedUser()" class="flex rounded-xl bg-slate-100 p-0.5 sm:p-1">
                  <button (click)="setVista(false)" [class.bg-white]="!vistaGrupo()" [class.shadow-sm]="!vistaGrupo()" class="px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all text-slate-600">Congregación</button>
                  <button (click)="setVista(true)" [class.bg-white]="vistaGrupo()" [class.shadow-sm]="vistaGrupo()" class="px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all text-slate-600">Por Grupos</button>
                </div>

                <!-- Selector GRUPO (Condicional - oculto para usuarios restringidos si ya tiene grupo asignado) -->
                <div *ngIf="vistaGrupo() && !isRestrictedUser()" class="relative z-20">
                   <button (click)="toggleDropdown('grupo')" 
                    class="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-transparent hover:border-slate-200 text-xs sm:text-sm font-bold text-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-brand-purple/20 min-w-[120px] sm:min-w-[180px] justify-between">
                  <span class="truncate max-w-[140px]">{{ getGrupoLabel(selectedGrupo) }}</span>
                  <svg class="w-4 h-4 text-slate-400 transition-transform duration-200" [class.rotate-180]="activeDropdown() === 'grupo'" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <!-- Dropdown Menu -->
                <div *ngIf="activeDropdown() === 'grupo'" 
                  class="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-fadeInOriginTop">
                  <div class="max-h-64 overflow-y-auto simple-scrollbar p-1.5">
                    <button (click)="selectGrupo(null)"
                      class="w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors mb-1"
                      [ngClass]="selectedGrupo === null ? 'bg-brand-purple/10 text-brand-purple' : 'text-slate-600 hover:bg-slate-50'">
                      Todos los grupos
                    </button>
                    <button *ngFor="let g of grupos()" 
                      (click)="selectGrupo(g.id_grupo)"
                      class="w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-between"
                      [ngClass]="selectedGrupo === g.id_grupo ? 'bg-brand-purple/10 text-brand-purple' : 'text-slate-600 hover:bg-slate-50'">
                      <span>{{ g.nombre_grupo }}</span>
                      <svg *ngIf="selectedGrupo === g.id_grupo" class="w-4 h-4 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    </button>
                  </div>
                </div>
                </div>
              </div> <!-- Cierre Fila 1 -->

              <!-- Fila 2: Búsqueda y Filtro (en móvil aparece debajo) -->
              <div class="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto sm:ml-auto">
                <!-- Search -->
                <div class="relative group flex-1 sm:flex-none">
                  <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="loadResumen()" placeholder="Buscar..." class="pl-9 pr-3 py-2 sm:py-2.5 rounded-xl bg-slate-50 border border-transparent hover:bg-white hover:border-slate-200 focus:bg-white focus:border-brand-purple/30 text-sm w-full sm:w-56 lg:w-64 focus:ring-4 focus:ring-brand-purple/5 transition-all outline-none">
                  <svg class="w-4 h-4 text-slate-400 group-hover:text-brand-purple absolute left-3 top-1/2 -translate-y-1/2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
                <!-- Toggle Sin Informe -->
                <label class="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl cursor-pointer select-none transition-all duration-300 ring-2"
                       [ngClass]="soloSinInforme 
                         ? 'bg-brand-purple/10 ring-brand-purple/30 shadow-lg shadow-purple-500/10' 
                         : 'bg-slate-50 hover:bg-slate-100 ring-transparent hover:ring-slate-200'">
                   <div class="relative">
                      <input type="checkbox" [(ngModel)]="soloSinInforme" (ngModelChange)="loadResumen()" class="peer sr-only">
                      <div class="w-9 sm:w-11 h-5 sm:h-6 bg-slate-300 rounded-full peer peer-checked:bg-brand-purple transition-colors duration-300 shadow-inner"></div>
                      <div class="absolute top-0.5 left-0.5 w-4 sm:w-5 h-4 sm:h-5 bg-white rounded-full shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] peer-checked:translate-x-4 sm:peer-checked:translate-x-5 flex items-center justify-center">
                         <svg class="w-2.5 sm:w-3 h-2.5 sm:h-3 text-brand-purple opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                   </div>
                   <div class="flex items-center gap-1.5 sm:gap-2">
                      <svg class="w-3.5 sm:w-4 h-3.5 sm:h-4 transition-colors duration-300" [ngClass]="soloSinInforme ? 'text-brand-purple' : 'text-slate-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span class="text-xs sm:text-sm font-bold transition-colors duration-300" [ngClass]="soloSinInforme ? 'text-brand-purple' : 'text-slate-600'">Sin informe</span>
                   </div>
                </label>
              </div> <!-- Cierre Fila 2 -->
            </div>

            <!-- Data List/Table Container -->\r\n            <div class=\"flex-1 min-h-0 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden\">\r\n              <div class=\"flex-1 overflow-y-auto simple-scrollbar\">\r\n                \r\n                <!-- Desktop Table (hidden on mobile) -->\r\n                <table class=\"hidden md:table w-full text-left border-separate border-spacing-0\">\r\n                  <thead class=\"sticky top-0 z-10 bg-white/95 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)]\">\r\n                    <tr>\r\n                      <th class=\"px-6 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100\">Publicador</th>\r\n                      <th class=\"px-4 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest text-center w-28 border-b border-slate-100\">Participó</th>\r\n                      <th class=\"px-4 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest text-center w-24 border-b border-slate-100\">Horas</th>\r\n                      <th class=\"px-4 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest text-center w-24 border-b border-slate-100\">Estudios</th>\r\n                      <th class=\"px-4 py-4 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100\">Observaciones</th>\r\n                    </tr>\r\n                  </thead>\r\n                  <tbody>\r\n                    <tr *ngFor=\"let pub of resumen()?.publicadores_list || []; let odd = odd; trackBy: trackByPub\" \r\n                        class=\"group transition-all duration-200\"\r\n                        [ngClass]=\"odd ? 'bg-slate-50/50 hover:bg-slate-100/80' : 'bg-white hover:bg-slate-50/80'\">\r\n                      <!-- Publicador -->\r\n                      <td class=\"px-6 py-3\">\r\n                        <div class=\"flex items-center gap-3\">\r\n                          <div class=\"relative\">\r\n                             <div class=\"w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm ring-1 ring-black/5\"\r\n                                [ngClass]=\"getAvatarClass(pub.id_publicador)\">\r\n                                {{ getInitials(pub.nombre_completo) }}\r\n                             </div>\r\n                             <div *ngIf=\"getInformeValue(pub, 'participo')\" class=\"absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center\">\r\n                                <svg class=\"w-2 h-2 text-white\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"4\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5 13l4 4L19 7\" /></svg>\r\n                             </div>\r\n                          </div>\r\n                          <div>\r\n                            <p class=\"font-bold text-slate-900 text-sm\">{{ pub.nombre_completo }}</p>\r\n                            <div class=\"flex flex-wrap gap-1 items-center\">\r\n                               <ng-container *ngFor=\"let role of getRoles(pub)\">\r\n                                    <span *ngIf=\"role.type === 'pill'\" class=\"inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider\" [ngClass]=\"role.class\">\r\n                                        {{ role.label }}\r\n                                    </span>\r\n                                    <span *ngIf=\"role.type === 'text'\" class=\"text-[9px] uppercase tracking-wider\" [ngClass]=\"role.class\">\r\n                                        {{ role.label }}\r\n                                    </span>\r\n                               </ng-container>\r\n                            </div>\r\n                          </div>\r\n                        </div>\r\n                      </td>\r\n                      \r\n                      <!-- Participó -->\r\n                      <td class=\"px-4 py-3 text-center align-middle\">\r\n                        <div class=\"flex justify-center\">\r\n                            <label class=\"relative flex items-center justify-center cursor-pointer p-1\">\r\n                                <input type=\"checkbox\" \r\n                                    [checked]=\"getInformeValue(pub, 'participo')\" \r\n                                    (change)=\"updateInforme(pub, 'participo', $event)\"\r\n                                    class=\"peer sr-only\">\r\n                                <div class=\"w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-brand-purple transition-all duration-300\"></div>\r\n                                <div class=\"absolute w-4 h-4 bg-white rounded-full shadow-sm left-2 peer-checked:translate-x-4 transition-transform duration-300 flex items-center justify-center\">\r\n                                    <svg class=\"w-2.5 h-2.5 text-brand-purple opacity-0 peer-checked:opacity-100 transition-opacity\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"3\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5 13l4 4L19 7\" /></svg>\r\n                                </div>\r\n                            </label>\r\n                        </div>\r\n                      </td>\r\n\r\n                      <!-- Horas -->\r\n                      <td class=\"px-4 py-3 text-center\">\r\n                         <div *ngIf=\"pub.requiere_horas\">\r\n                            <input type=\"number\" min=\"0\" placeholder=\"0\"\r\n                                [value]=\"getInformeValue(pub, 'horas') || ''\" \r\n                                (input)=\"updateInforme(pub, 'horas', $event)\"\r\n                                class=\"w-16 px-2 py-1.5 rounded-lg bg-orange-50/50 border border-orange-100 text-center text-sm font-bold text-brand-orange placeholder:text-orange-200/50 focus:bg-white focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 transition-all\">\r\n                         </div>\r\n                         <div *ngIf=\"!pub.requiere_horas\" class=\"flex justify-center opacity-30\">\r\n                            <div class=\"h-0.5 w-4 bg-slate-400 rounded-full\"></div>\r\n                         </div>\r\n                      </td>\r\n\r\n                      <!-- Estudios -->\r\n                      <td class=\"px-4 py-3 text-center\">\r\n                        <input type=\"number\" min=\"0\" placeholder=\"0\"\r\n                            [value]=\"getInformeValue(pub, 'cursos') || ''\" \r\n                            (input)=\"updateInforme(pub, 'cursos', $event)\"\r\n                            class=\"w-16 px-0 py-1.5 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-brand-purple text-center text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:ring-0 transition-all\">\r\n                      </td>\r\n\r\n                      <!-- Notas -->\r\n                      <td class=\"px-4 py-3\">\r\n                        <input type=\"text\" placeholder=\"Nota...\"\r\n                            [value]=\"getInformeValue(pub, 'notas') || ''\" \r\n                            (input)=\"updateInforme(pub, 'notas', $event)\"\r\n                            class=\"w-full px-3 py-1.5 bg-transparent rounded-lg border border-transparent hover:bg-white hover:border-slate-200 focus:bg-white focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/5 text-sm transition-all placeholder:text-slate-300\">\r\n                      </td>\r\n                    </tr>\r\n                  </tbody>\r\n                </table>\r\n\r\n                <!-- Mobile Cards (visible only on mobile) -->\r\n                <div class=\"md:hidden divide-y divide-slate-100\">\r\n                  <div *ngFor=\"let pub of resumen()?.publicadores_list || []; trackBy: trackByPub\" \r\n                       class=\"p-3 hover:bg-slate-50/80 transition-colors\">\r\n                    <!-- Header: Avatar + Name -->\r\n                    <div class=\"flex items-center gap-3 mb-3\">\r\n                      <div class=\"relative\">\r\n                         <div class=\"w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm ring-1 ring-black/5\"\r\n                            [ngClass]=\"getAvatarClass(pub.id_publicador)\">\r\n                            {{ getInitials(pub.nombre_completo) }}\r\n                         </div>\r\n                         <div *ngIf=\"getInformeValue(pub, 'participo')\" class=\"absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center\">\r\n                            <svg class=\"w-2 h-2 text-white\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"4\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5 13l4 4L19 7\" /></svg>\r\n                         </div>\r\n                      </div>\r\n                      <div class=\"flex-1 min-w-0\">\r\n                        <p class=\"font-bold text-slate-900 text-sm truncate\">{{ pub.nombre_completo }}</p>\r\n                        <div class=\"flex flex-wrap gap-1\">\r\n                           <ng-container *ngFor=\"let role of getRoles(pub)\">\r\n                                <span *ngIf=\"role.type === 'pill'\" class=\"inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase\" [ngClass]=\"role.class\">\r\n                                    {{ role.label }}\r\n                                </span>\r\n                                <span *ngIf=\"role.type === 'text'\" class=\"text-[8px] uppercase\" [ngClass]=\"role.class\">\r\n                                    {{ role.label }}\r\n                                </span>\r\n                           </ng-container>\r\n                        </div>\r\n                      </div>\r\n                      <!-- Participó Toggle (inline) -->\r\n                      <label class=\"relative cursor-pointer shrink-0\">\r\n                          <input type=\"checkbox\" \r\n                              [checked]=\"getInformeValue(pub, 'participo')\" \r\n                              (change)=\"updateInforme(pub, 'participo', $event)\"\r\n                              class=\"peer sr-only\">\r\n                          <div class=\"w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-brand-purple transition-all\"></div>\r\n                          <div class=\"absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform flex items-center justify-center\">\r\n                              <svg class=\"w-2.5 h-2.5 text-brand-purple opacity-0 peer-checked:opacity-100\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"3\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5 13l4 4L19 7\" /></svg>\r\n                          </div>\r\n                      </label>\r\n                    </div>\r\n                    \r\n                    <!-- Input Row: Horas, Estudios, Notas -->\r\n                    <div class=\"flex items-center gap-2\">\r\n                      <!-- Horas -->\r\n                      <div *ngIf=\"pub.requiere_horas\" class=\"flex items-center gap-1.5 bg-orange-50 rounded-lg px-2 py-1.5\">\r\n                        <svg class=\"w-3.5 h-3.5 text-brand-orange shrink-0\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"2\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z\"/></svg>\r\n                        <input type=\"number\" min=\"0\" placeholder=\"0\"\r\n                            [value]=\"getInformeValue(pub, 'horas') || ''\" \r\n                            (input)=\"updateInforme(pub, 'horas', $event)\"\r\n                            class=\"w-12 bg-transparent text-center text-sm font-bold text-brand-orange placeholder:text-orange-300 focus:outline-none\">\r\n                      </div>\r\n                      \r\n                      <!-- Estudios -->\r\n                      <div class=\"flex items-center gap-1.5 bg-emerald-50 rounded-lg px-2 py-1.5\">\r\n                        <svg class=\"w-3.5 h-3.5 text-emerald-600 shrink-0\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"2\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253\"/></svg>\r\n                        <input type=\"number\" min=\"0\" placeholder=\"0\"\r\n                            [value]=\"getInformeValue(pub, 'cursos') || ''\" \r\n                            (input)=\"updateInforme(pub, 'cursos', $event)\"\r\n                            class=\"w-10 bg-transparent text-center text-sm font-bold text-emerald-700 placeholder:text-emerald-300 focus:outline-none\">\r\n                      </div>\r\n                      \r\n                      <!-- Notas -->\r\n                      <div class=\"flex-1\">\r\n                        <input type=\"text\" placeholder=\"Nota...\"\r\n                            [value]=\"getInformeValue(pub, 'notas') || ''\" \r\n                            (input)=\"updateInforme(pub, 'notas', $event)\"\r\n                            class=\"w-full px-2.5 py-1.5 bg-slate-50 rounded-lg border border-transparent focus:bg-white focus:border-brand-purple/30 text-sm transition-all placeholder:text-slate-400\">\r\n                      </div>\r\n                    </div>\r\n                  </div>\r\n                </div>\r\n\r\n              </div>\r\n              \r\n              <!-- Footer -->\r\n              <div class=\"shrink-0 px-3 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80\">\r\n                <!-- Mobile: Stacked layout -->\r\n                <div class=\"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3\">\r\n                  <span class=\"text-xs text-slate-500 text-center sm:text-left\">\r\n                    Mostrando <span class=\"font-bold text-slate-700\">{{ resumen()?.publicadores_list?.length || 0 }}</span> publicadores\r\n                  </span>\r\n                  \r\n                  <!-- Buttons -->\r\n                  <div class=\"flex flex-col sm:flex-row gap-2 sm:gap-3\">\r\n                    <!-- Excel buttons row -->\r\n                    <div class=\"flex gap-2\">\r\n                      <button (click)=\"exportarExcel()\" class=\"flex-1 sm:flex-none px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs sm:text-sm hover:bg-white transition-all flex items-center justify-center gap-1.5 sm:gap-2\">\r\n                        <svg class=\"w-4 h-4\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12\"/></svg>\r\n                        <span class=\"hidden sm:inline\">Descargar</span>\r\n                        <span class=\"sm:hidden\">Bajar</span>\r\n                      </button>\r\n                      <input type=\"file\" #fileInput accept=\".xlsx\" (change)=\"importarExcel($event)\" class=\"hidden\">\r\n                      <button (click)=\"fileInput.click()\" [disabled]=\"saving()\" class=\"flex-1 sm:flex-none px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs sm:text-sm hover:bg-white transition-all flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50\">\r\n                         <svg class=\"w-4 h-4\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l4-4m0 0l4 4m-4-4v12\"/></svg>\r\n                         <span class=\"hidden sm:inline\">Subir</span>\r\n                         <span class=\"sm:hidden\">Subir</span>\r\n                      </button>\r\n                    </div>\r\n                    <!-- Save button (full width on mobile) -->\r\n                    <button (click)=\"guardarTodo()\" [disabled]=\"saving()\" class=\"w-full sm:w-auto px-4 sm:px-6 py-2.5 rounded-xl bg-brand-purple text-white font-bold text-sm hover:bg-purple-700 shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50\">\r\n                      <svg *ngIf=\"!saving()\" class=\"w-4 h-4\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4\"/></svg>\r\n                      <svg *ngIf=\"saving()\" class=\"w-4 h-4 animate-spin\" fill=\"none\" viewBox=\"0 0 24 24\"><circle class=\"opacity-25\" cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" stroke-width=\"4\"></circle><path class=\"opacity-75\" fill=\"currentColor\" d=\"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z\"></path></svg>\r\n                      {{ saving() ? 'Guardando...' : 'Guardar Todo' }}\r\n                    </button>\r\n                  </div>\r\n                </div>\r\n              </div>\r\n            </div>
          </div>
        </ng-container>

        <!-- Tab 2: Historial (Placeholder) -->
        <ng-container *ngIf="activeTab() === 'historial'">
          <div class="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 h-full flex items-center justify-center">
            <div class="text-center">
              <div class="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-10 h-10 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              </div>
              <h3 class="text-xl font-bold text-slate-900">Historial Anual de Informes</h3>
              <p class="text-slate-500 mt-2">Próximamente disponible</p>
            </div>
          </div>
        </ng-container>

        <!-- Tab 3: Resumen Sucursal (Placeholder) -->
        <ng-container *ngIf="activeTab() === 'sucursal'">
          <div class="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 h-full flex items-center justify-center">
            <div class="text-center">
              <div class="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-10 h-10 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <h3 class="text-xl font-bold text-slate-900">Resumen para Sucursal</h3>
              <p class="text-slate-500 mt-2">Próximamente disponible</p>
            </div>
          </div>
        </ng-container>
      </div>

      <!-- Toast Notification -->
      <div 
        *ngIf="toastMessage()" 
        class="fixed bottom-6 right-6 z-[100] animate-fadeInUp max-w-md"
      >
        <div 
          class="flex items-start gap-3 px-5 py-4 rounded-xl shadow-xl border backdrop-blur-sm"
          [ngClass]="toastMessage()?.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : toastMessage()?.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'"
        >
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            [ngClass]="toastMessage()?.type === 'success' ? 'bg-emerald-500' : toastMessage()?.type === 'error' ? 'bg-red-500' : 'bg-blue-500'"
          >
            <svg *ngIf="toastMessage()?.type === 'success'" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <svg *ngIf="toastMessage()?.type === 'error'" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            <svg *ngIf="toastMessage()?.type === 'info'" class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="flex-1">
            <p class="text-sm font-bold">{{ toastMessage()?.title }}</p>
            <p *ngIf="toastMessage()?.text" class="text-xs mt-1 opacity-80 whitespace-pre-line">{{ toastMessage()?.text }}</p>
          </div>
          <button (click)="toastMessage.set(null)" class="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`:host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }`]
})
export class InformesMainPage implements OnInit {
  private informesService = inject(InformesService);
  private gruposService = inject(GruposService);

  private authStore = inject(AuthStore);
  private http = inject(HttpClient);
  private privilegiosService = inject(PrivilegiosService);

  tabs = [
    { id: 'entrada', label: 'Entrada Mensual', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>' },
    { id: 'historial', label: 'Historial Anual', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>' },
    { id: 'sucursal', label: 'Resumen Sucursal', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' }
  ];

  activeTab = signal('entrada');
  activeDropdown = signal<string | null>(null);
  resumen = signal<ResumenMensual | null>(null);
  grupos = signal<any[]>([]);
  saving = signal(false);
  vistaGrupo = signal(false);
  toastMessage = signal<{ title: string, text?: string, type: 'success' | 'error' | 'info' } | null>(null);

  selectedMes = (new Date().getMonth() === 0 ? '12' : new Date().getMonth().toString());
  selectedAno = (new Date().getMonth() === 0 ? (new Date().getFullYear() - 1).toString() : new Date().getFullYear().toString());
  selectedGrupo: number | null = null;
  searchQuery = '';
  soloSinInforme = false;

  localChanges: Map<number, Partial<InformeLoteItem>> = new Map();

  // Privilegios Loading
  privilegios = signal<Privilegio[]>([]);
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map());

  // Restricted user detection: Publicador sin roles privilegiados
  isRestrictedUser = computed(() => {
    const user = this.authStore.user();
    if (!user) return true;
    const roles = user.roles ?? (user.rol ? [user.rol] : []);
    const rolesLower = roles.map(r => (r || '').toLowerCase());
    // Si tiene Administrador, Coordinador o Secretario -> NO restringido
    if (rolesLower.includes('administrador') || rolesLower.includes('coordinador') || rolesLower.includes('secretario')) {
      return false;
    }
    return true; // Solo Publicador u otros roles menores -> Restringido
  });

  visibleTabs = computed(() => {
    if (this.isRestrictedUser()) {
      return this.tabs.filter(t => t.id === 'entrada');
    }
    return this.tabs;
  });

  meses = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ];
  anos = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

  async ngOnInit() {
    // Primero inicializar para usuarios restringidos (precargar grupo)
    await this.initializeForRestrictedUser();
    // Luego cargar datos (ya con el grupo correcto si es restringido)
    this.loadResumen();
    this.loadGrupos();
    this.loadPrivilegiosData();
  }

  private async initializeForRestrictedUser() {
    if (this.isRestrictedUser()) {
      // Precargar grupo del publicador
      const user = this.authStore.user();
      if (user?.id_usuario_publicador) {
        // Necesitamos obtener el grupo del publicador desde el backend
        try {
          const publicador = await lastValueFrom(
            this.http.get<any>(`/api/publicadores/${user.id_usuario_publicador}`)
          );
          if (publicador?.id_grupo_publicador) {
            this.selectedGrupo = publicador.id_grupo_publicador;
            this.vistaGrupo.set(true);
            console.log('Restricted user group set to:', this.selectedGrupo);
          }
        } catch (e) {
          console.error('Error loading publicador data for restricted user:', e);
        }
      }
    }
  }

  async loadPrivilegiosData() {
    try {
      // 1. Load Catalog
      const catalog = await lastValueFrom(this.privilegiosService.getPrivilegios());
      this.privilegios.set(catalog);

      // 2. Load Assignments
      const allPrivilegios = await lastValueFrom(this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/'));

      const today = new Date().toISOString().split('T')[0];
      const privilegiosMap = new Map<number, number[]>();

      for (const pp of (allPrivilegios || [])) {
        // Filter active privileges
        if (!pp.fecha_fin || pp.fecha_fin >= today) {
          if (!privilegiosMap.has(pp.id_publicador)) {
            privilegiosMap.set(pp.id_publicador, []);
          }
          privilegiosMap.get(pp.id_publicador)!.push(pp.id_privilegio);
        }
      }
      this.publicadorPrivilegiosMap.set(privilegiosMap);

    } catch (error) {
      console.error('Error loading privileges data:', error);
    }
  }

  setVista(isGrupo: boolean) {
    this.vistaGrupo.set(isGrupo);
    if (!isGrupo) {
      this.selectGrupo(null);
    } else {
      if (this.selectedGrupo === null) {
        this.loadResumen();
      }
    }
  }

  loadGrupos() {
    const congregacionId = this.authStore.user()?.id_congregacion;
    this.gruposService.getGrupos({ congregacion_id: congregacionId }).subscribe({
      next: (data) => this.grupos.set(data),
      error: (err) => console.error('Error loading groups:', err)
    });
  }

  // --- Dropdown Logic ---
  toggleDropdown(id: string) {
    this.activeDropdown.update(current => current === id ? null : id);
  }

  closeDropdown() {
    this.activeDropdown.set(null);
  }

  selectMes(mes: string) {
    this.selectedMes = mes;
    this.closeDropdown();
    this.loadResumen();
  }

  selectAno(ano: string) {
    this.selectedAno = ano;
    this.closeDropdown();
    this.loadResumen();
  }

  selectGrupo(grupoId: number | null) {
    this.selectedGrupo = grupoId;
    this.closeDropdown();
    this.loadResumen();
  }

  getMesLabel(mesValue: string): string {
    return this.meses.find(m => m.value === mesValue)?.label || 'Mes';
  }

  getGrupoLabel(grupoId: number | null): string {
    if (!grupoId) return 'Todos los grupos';
    return this.grupos().find(g => g.id_grupo === grupoId)?.nombre_grupo || 'Seleccionar Grupo';
  }

  loadResumen() {
    const congregacionId = this.authStore.user()?.id_congregacion || 1;
    const periodoId = this.getPeriodoId();
    if (!periodoId) return;

    this.informesService.getResumenMensual(
      periodoId, congregacionId, this.selectedGrupo || undefined, this.soloSinInforme, this.searchQuery || undefined
    ).subscribe({
      next: (data) => this.resumen.set(data),
      error: (err) => console.error('Error loading resumen:', err)
    });
  }

  getPeriodoId(): number {
    const base = (parseInt(this.selectedAno) - 2010) * 12;
    return base + parseInt(this.selectedMes);
  }

  getInformeValue(pub: InformeConPublicador, field: string): any {
    const local = this.localChanges.get(pub.id_publicador);
    if (local) {
      if (field === 'participo') return local.participo ?? pub.participo ?? false;
      if (field === 'cursos') return local.cursos_biblicos ?? pub.cursos_biblicos ?? 0;
      if (field === 'horas') return local.horas ?? pub.horas ?? 0;
      if (field === 'notas') return local.observaciones ?? pub.observaciones ?? '';
    }
    if (field === 'participo') return pub.participo ?? false;
    if (field === 'cursos') return pub.cursos_biblicos ?? 0;
    if (field === 'horas') return pub.horas ?? 0;
    if (field === 'notas') return pub.observaciones ?? '';
    return null;
  }

  updateInforme(pub: InformeConPublicador, field: string, event: Event) {
    const existing = this.localChanges.get(pub.id_publicador) || { id_publicador: pub.id_publicador, participo: pub.participo ?? false, cursos_biblicos: pub.cursos_biblicos ?? 0, horas: pub.horas ?? 0, observaciones: pub.observaciones };

    if (field === 'participo') existing.participo = (event.target as HTMLInputElement).checked;
    else if (field === 'cursos') existing.cursos_biblicos = parseInt((event.target as HTMLInputElement).value) || 0;
    else if (field === 'horas') existing.horas = parseInt((event.target as HTMLInputElement).value) || 0;
    else if (field === 'notas') existing.observaciones = (event.target as HTMLInputElement).value || null;

    this.localChanges.set(pub.id_publicador, existing);
  }

  guardarTodo() {
    if (this.localChanges.size === 0) return;
    this.saving.set(true);

    const items: InformeLoteItem[] = Array.from(this.localChanges.values()).map(c => ({
      id_publicador: c.id_publicador!,
      participo: c.participo ?? false,
      cursos_biblicos: c.cursos_biblicos ?? 0,
      horas: c.horas ?? 0,
      observaciones: c.observaciones ?? null
    }));

    this.informesService.guardarInformesLote({ periodo_id: this.getPeriodoId(), informes: items }).subscribe({
      next: () => { this.localChanges.clear(); this.loadResumen(); this.saving.set(false); },
      error: () => this.saving.set(false)
    });
  }

  async exportarExcel() {
    this.saving.set(true);
    const periodo = `${this.selectedAno}-${this.getMesLabel(this.selectedMes)}`;
    const congregacionId = this.authStore.user()?.id_congregacion;

    if (this.selectedGrupo) {
      // Descargar por grupo
      const g = this.grupos().find(gx => gx.id_grupo === this.selectedGrupo);
      const nombreGrupo = g ? g.nombre_grupo : 'Grupo';
      this.informesService.exportTemplate(this.getPeriodoId(), this.selectedGrupo).subscribe({
        next: (blob) => {
          const filename = `Informe_${nombreGrupo}_${periodo}.xlsx`;
          saveAs(blob, filename);
          this.saving.set(false);
        },
        error: (err) => {
          console.error('Error descargando plantilla', err);
          alert('Error al descargar la plantilla desde el servidor.');
          this.saving.set(false);
        }
      });
    } else {
      // Descargar toda la congregación
      this.informesService.exportTemplateCongregacion(this.getPeriodoId(), congregacionId!).subscribe({
        next: (blob) => {
          const filename = `Informe_Congregacion_${periodo}.xlsx`;
          saveAs(blob, filename);
          this.saving.set(false);
        },
        error: (err) => {
          console.error('Error descargando plantilla', err);
          alert('Error al descargar la plantilla desde el servidor.');
          this.saving.set(false);
        }
      });
    }
  }

  importarExcel(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.saving.set(true);

    this.informesService.importTemplate(file).subscribe({
      next: (result: any) => {
        const title = `${result.tipo_plantilla}: ${result.nombre_origen || 'Importación'}`;
        let text = `📅 Período: ${result.periodo}\n`;
        text += `• Creados: ${result.creados}\n`;
        text += `• Actualizados: ${result.actualizados}`;
        if (result.omitidos > 0) {
          text += `\n• Omitidos: ${result.omitidos}`;
        }

        if (result.errores && result.errores.length > 0) {
          text += `\n\n⚠️ Errores:\n`;
          for (const e of result.errores.slice(0, 3)) {
            text += `Fila ${e.fila}: ${e.error}\n`;
          }
        }

        this.showToast(title, result.omitidos > 0 ? 'info' : 'success', text);
        input.value = '';
        this.loadResumen();
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Error importando plantilla:', err);
        const detail = err.error?.detail || 'Error desconocido al importar';
        this.showToast('Error de importación', 'error', detail);
        input.value = '';
        this.saving.set(false);
      }
    });
  }

  showToast(title: string, type: 'success' | 'error' | 'info' = 'success', text?: string) {
    this.toastMessage.set({ title, type, text });
    setTimeout(() => this.toastMessage.set(null), type === 'error' ? 8000 : 5000);
  }

  trackByPub = (_: number, pub: InformeConPublicador) => pub.id_publicador;
  getInitials = (name: string) => name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

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

  getRoles(pub: InformeConPublicador): { label: string, type: 'pill' | 'text', class: string }[] {
    const roles: { label: string, type: 'pill' | 'text', class: string }[] = [];

    // 1. Try to get from loaded map (accurate assignments)
    const assignedIds = this.publicadorPrivilegiosMap().get(pub.id_publicador);
    const catalog = this.privilegios();

    if (assignedIds && assignedIds.length > 0 && catalog.length > 0) {
      // Map Ids to Names
      const roleNames = assignedIds.map(id => catalog.find(pr => pr.id_privilegio === id)?.nombre_privilegio?.toLowerCase() || '').filter(Boolean);

      if (roleNames.some(r => r.includes('regular'))) {
        roles.push({ label: 'PRECURSOR REGULAR', type: 'pill', class: 'bg-purple-100 text-purple-700' });
      }
      if (roleNames.some(r => r.includes('auxiliar'))) {
        roles.push({ label: 'PRECURSOR AUXILIAR', type: 'pill', class: 'bg-amber-100 text-amber-700' });
      }
      if (roleNames.some(r => r.includes('especial'))) {
        roles.push({ label: 'PRECURSOR ESPECIAL', type: 'pill', class: 'bg-rose-100 text-rose-700' });
      }
      if (roleNames.some(r => r.includes('anciano'))) {
        roles.push({ label: 'ANCIANO', type: 'pill', class: 'bg-indigo-100 text-indigo-700' });
      }
      if (roleNames.some(r => r.includes('siervo') || r.includes('ministerial'))) {
        roles.push({ label: 'SIERVO MINISTERIAL', type: 'pill', class: 'bg-yellow-100 text-yellow-800' });
      }

    } else {
      // 2. Fallback to 'privilegio_activo' string from backend report summary
      const p = pub.privilegio_activo?.toLowerCase() || '';

      if (p.includes('regular')) {
        roles.push({ label: 'PRECURSOR REGULAR', type: 'pill', class: 'bg-purple-100 text-purple-700' });
      }
      if (p.includes('auxiliar')) {
        roles.push({ label: 'PRECURSOR AUXILIAR', type: 'pill', class: 'bg-amber-100 text-amber-700' });
      }
      if (p.includes('anciano')) {
        roles.push({ label: 'ANCIANO', type: 'pill', class: 'bg-indigo-100 text-indigo-700' });
      }
      if (p.includes('siervo') || p.includes('ministerial')) {
        roles.push({ label: 'SIERVO MINISTERIAL', type: 'pill', class: 'bg-yellow-100 text-yellow-800' });
      }
      if (p.includes('especial')) {
        roles.push({ label: 'PRECURSOR ESPECIAL', type: 'pill', class: 'bg-rose-100 text-rose-700' });
      }
    }

    if (roles.length === 0) {
      roles.push({ label: 'PUBLICADOR', type: 'text', class: 'text-slate-400 font-medium text-[10px] uppercase tracking-wide' });
    }

    return roles;
  }
}

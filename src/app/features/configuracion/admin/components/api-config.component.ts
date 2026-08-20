import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import {
  ApiCliente,
  ApiClientePayload,
  ApiClientsService,
  ApiLogsFiltro,
  ApiScope,
} from '../services/api-clients.service';

interface CongregacionOpcion {
  id_congregacion: number;
  nombre_congregacion: string;
}

type Seccion = 'credenciales' | 'actividad' | 'guia';

/** Estado del formulario lateral de alta/edición. */
interface FormularioCredencial {
  nombre: string;
  descripcion: string;
  id_congregacion: number | null;
  scopes: string[];
  ip_whitelist: string;
  rate_limit_minuto: number;
  expira_en: string;
}

const FORMULARIO_VACIO: FormularioCredencial = {
  nombre: '',
  descripcion: '',
  id_congregacion: null,
  scopes: [],
  ip_whitelist: '',
  rate_limit_minuto: 60,
  expira_en: '',
};

@Component({
  selector: 'app-api-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }

    @keyframes apiFadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: none; }
    }
    /* backwards, no both: 'both' deja un transform en la matriz identidad y
       crea un stacking context que atrapa los paneles superpuestos. */
    .animate-fadeUp { animation: apiFadeUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) backwards; }

    @keyframes apiSlideIn {
      from { opacity: 0; transform: translateX(16px); }
      to   { opacity: 1; transform: none; }
    }
    .animate-slidePanel { animation: apiSlideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) backwards; }

    @keyframes apiShimmer {
      100% { transform: translateX(100%); }
    }
    .skeleton { position: relative; overflow: hidden; }
    .skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(148,163,184,0.18), transparent);
      animation: apiShimmer 1.4s infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .animate-fadeUp, .animate-slidePanel, .skeleton::after { animation: none; }
    }
  `],
  template: `
    <div class="h-full flex flex-col overflow-hidden bg-app-bg dark:bg-slate-950">

      <!-- ═══ Cabecera ═══ -->
      <div class="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60">
        <div class="flex items-center gap-2.5 min-w-0">
          <svg class="w-5 h-5 text-brand-purple shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          <div class="min-w-0">
            <h2 class="text-base font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">Integraciones API</h2>
            <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium leading-tight truncate">
              Credenciales de acceso para sistemas externos
            </p>
          </div>
        </div>

        <button type="button" (click)="abrirCreacion()"
          class="group inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl bg-brand-purple hover:bg-purple-700 text-white text-sm font-bold shadow-sm transition-all duration-200 active:translate-y-px touch-manipulation">
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nueva integración
        </button>
      </div>

      <!-- ═══ Sub-navegación ═══ -->
      <div class="shrink-0 flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60">
        <button *ngFor="let s of secciones" type="button" (click)="setSeccion(s.id)"
          class="shrink-0 px-3 min-h-[36px] rounded-lg text-xs font-bold transition-all touch-manipulation"
          [ngClass]="seccion() === s.id
            ? 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'">
          {{ s.etiqueta }}
        </button>
      </div>

      <!-- ═══ Contenido ═══ -->
      <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-4">

        <!-- ─────────── CREDENCIALES ─────────── -->
        <div *ngIf="seccion() === 'credenciales'" class="animate-fadeUp space-y-4">

          <div class="relative">
            <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input type="search" [(ngModel)]="busqueda" (ngModelChange)="filtrar()"
              placeholder="Buscar por nombre o client_id..."
              class="w-full min-h-[44px] ps-10 pe-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all">
          </div>

          <!-- Carga: esqueletos con la forma de las filas reales -->
          <div *ngIf="svc.cargandoClientes()" class="space-y-2" aria-busy="true" aria-live="polite">
            <div *ngFor="let _ of [1,2,3]"
              class="skeleton h-[92px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60"></div>
          </div>

          <!-- Vacío: explica el primer paso en lugar de decir "sin datos" -->
          <div *ngIf="!svc.cargandoClientes() && clientesFiltrados().length === 0"
            class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-6 py-12 text-center">
            <svg class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
            <h3 class="mt-4 text-sm font-display font-bold text-slate-700 dark:text-slate-200">
              {{ busqueda ? 'Ninguna coincidencia' : 'Todavía no hay integraciones' }}
            </h3>
            <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              {{ busqueda
                ? 'Prueba con otro nombre o con el client_id completo.'
                : 'Crea una credencial para que otro sistema consulte y programe las reuniones de una congregación. El secreto se muestra una sola vez.' }}
            </p>
            <button *ngIf="!busqueda" type="button" (click)="abrirCreacion()"
              class="mt-5 inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-brand-purple hover:bg-brand-purple/5 transition-colors touch-manipulation">
              Crear la primera
            </button>
          </div>

          <!-- Lista -->
          <div *ngIf="!svc.cargandoClientes() && clientesFiltrados().length > 0"
            class="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 overflow-hidden">

            <article *ngFor="let c of clientesFiltrados(); let i = index"
              class="animate-fadeUp p-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              [style.animation-delay.ms]="i * 35">

              <div class="flex flex-col mbp:flex-row mbp:items-center gap-4">

                <!-- Identidad -->
                <div class="flex items-start gap-3 min-w-0 flex-1">
                  <span class="mt-0.5 w-2 h-2 rounded-full shrink-0"
                    [ngClass]="estadoPunto(c)"
                    [attr.aria-label]="estadoTexto(c)"></span>

                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 class="text-sm font-display font-bold text-slate-900 dark:text-white truncate">{{ c.nombre }}</h3>
                      <span class="text-[0.625rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        [ngClass]="estadoChip(c)">{{ estadoTexto(c) }}</span>
                    </div>

                    <p *ngIf="c.descripcion" class="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{{ c.descripcion }}</p>

                    <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]">
                      <button type="button" (click)="copiar(c.client_id, 'client_id')"
                        class="group inline-flex items-center gap-1.5 font-mono text-slate-500 dark:text-slate-400 hover:text-brand-purple transition-colors"
                        title="Copiar client_id">
                        {{ c.client_id }}
                        <svg class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                      <span class="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                      <span class="text-slate-500 dark:text-slate-400 truncate">{{ c.congregacion || 'Congregación #' + c.id_congregacion }}</span>
                    </div>
                  </div>
                </div>

                <!-- Permisos -->
                <div class="flex flex-wrap gap-1.5 mbp:w-[280px] mbp16:w-[340px] shrink-0">
                  <span *ngFor="let s of c.scopes"
                    class="text-[0.625rem] font-semibold px-2 py-0.5 rounded-md"
                    [ngClass]="esEscritura(s)
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'">
                    {{ etiquetaScope(s) }}
                  </span>
                  <span *ngIf="c.scopes.length === 0" class="text-[0.6875rem] text-slate-400 italic">Sin permisos asignados</span>
                </div>

                <!-- Métricas -->
                <div class="flex items-center gap-5 shrink-0 mbp:w-[150px]">
                  <div>
                    <p class="text-[0.5625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Último uso</p>
                    <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{{ ultimoUso(c) }}</p>
                  </div>
                  <div>
                    <p class="text-[0.5625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Límite</p>
                    <p class="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">{{ c.rate_limit_minuto }}/min</p>
                  </div>
                </div>

                <!-- Acciones -->
                <div class="flex items-center gap-1 shrink-0">
                  <button type="button" (click)="abrirEdicion(c)" title="Editar permisos y límites"
                    class="w-10 h-10 grid place-items-center rounded-lg text-slate-400 hover:text-brand-purple hover:bg-brand-purple/5 transition-colors touch-manipulation">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button type="button" (click)="confirmar('rotar', c)" title="Rotar el secreto"
                    class="w-10 h-10 grid place-items-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-500/5 transition-colors touch-manipulation">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button *ngIf="!c.revocado" type="button" (click)="confirmar('revocar', c)" title="Revocar el acceso"
                    class="w-10 h-10 grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-500/5 transition-colors touch-manipulation">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </button>
                  <button type="button" (click)="confirmar('eliminar', c)" title="Eliminar definitivamente"
                    class="w-10 h-10 grid place-items-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-500/5 transition-colors touch-manipulation">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>

        <!-- ─────────── ACTIVIDAD ─────────── -->
        <div *ngIf="seccion() === 'actividad'" class="animate-fadeUp space-y-4">

          <!-- Métricas: sin tarjetas, separadas por líneas -->
          <div class="grid grid-cols-2 mbp:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/60">
            <div *ngFor="let m of tarjetasMetricas()" class="bg-white dark:bg-slate-900 px-4 py-4">
              <p class="text-[0.5625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{{ m.etiqueta }}</p>
              <p class="mt-1 text-2xl font-display font-black tabular-nums leading-none" [ngClass]="m.tono">{{ m.valor }}</p>
              <p class="mt-1 text-[0.625rem] text-slate-400 dark:text-slate-500">{{ m.nota }}</p>
            </div>
          </div>

          <!-- Filtros -->
          <div class="flex flex-wrap items-end gap-3">
            <div class="flex-1 min-w-[180px]">
              <label for="filtro-cliente" class="block text-[0.625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Integración</label>
              <select id="filtro-cliente" [(ngModel)]="filtro.id_api_cliente" (ngModelChange)="recargarLogs()"
                class="w-full min-h-[40px] px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all">
                <option [ngValue]="null">Todas</option>
                <option *ngFor="let c of svc.clientes()" [ngValue]="c.id_api_cliente">{{ c.nombre }}</option>
              </select>
            </div>
            <div>
              <label for="filtro-desde" class="block text-[0.625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Desde</label>
              <input id="filtro-desde" type="date" [(ngModel)]="filtro.desde" (ngModelChange)="recargarLogs()"
                class="min-h-[40px] px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all">
            </div>
            <div>
              <label for="filtro-hasta" class="block text-[0.625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Hasta</label>
              <input id="filtro-hasta" type="date" [(ngModel)]="filtro.hasta" (ngModelChange)="recargarLogs()"
                class="min-h-[40px] px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all">
            </div>
            <button type="button" (click)="alternarSoloErrores()"
              class="min-h-[40px] px-4 rounded-xl text-sm font-bold border transition-colors touch-manipulation"
              [ngClass]="filtro.solo_errores
                ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'">
              Solo errores
            </button>
          </div>

          <div *ngIf="svc.cargandoLogs()" class="space-y-1.5" aria-busy="true">
            <div *ngFor="let _ of [1,2,3,4,5,6]" class="skeleton h-11 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60"></div>
          </div>

          <div *ngIf="!svc.cargandoLogs() && (svc.logs()?.items?.length ?? 0) === 0"
            class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-6 py-12 text-center">
            <h3 class="text-sm font-display font-bold text-slate-700 dark:text-slate-200">Sin peticiones registradas</h3>
            <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Cada llamada a <span class="font-mono">/api/v1</span> queda registrada aquí con su código de estado y su duración. Los registros se conservan 90 días.
            </p>
          </div>

          <!-- Tabla en pantallas anchas; tarjetas en móvil.
               Una tabla de 5 columnas en 390 px sólo se puede leer arrastrando,
               así que en móvil se reordena el mismo dato en vertical. -->
          <div *ngIf="!svc.cargandoLogs() && (svc.logs()?.items?.length ?? 0) > 0"
            class="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 overflow-hidden">

            <ul class="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              <li *ngFor="let l of svc.logs()!.items" class="p-3.5">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="min-w-0 text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
                    <span class="font-bold me-1.5" [ngClass]="tonoMetodo(l.metodo)">{{ l.metodo }}</span>{{ l.ruta }}
                  </p>
                  <span class="shrink-0 text-xs font-bold font-mono tabular-nums" [ngClass]="tonoEstado(l.status_code)">{{ l.status_code }}</span>
                </div>
                <div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.6875rem] text-slate-500 dark:text-slate-400">
                  <span class="tabular-nums">{{ l.creado_en | date:'dd MMM HH:mm:ss' }}</span>
                  <span class="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                  <span class="font-mono tabular-nums">{{ l.duracion_ms }} ms</span>
                  <span *ngIf="l.cliente" class="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                  <span *ngIf="l.cliente" class="truncate max-w-[150px]">{{ l.cliente }}</span>
                </div>
                <p *ngIf="l.error_code" class="mt-1 text-[0.6875rem] font-mono text-amber-600 dark:text-amber-400">{{ l.error_code }}</p>
              </li>
            </ul>

            <div class="hidden md:block overflow-x-auto custom-scrollbar">
              <table class="w-full min-w-[720px] text-left">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-800">
                    <th scope="col" class="px-4 py-2.5 text-[0.5625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Cuándo</th>
                    <th scope="col" class="px-4 py-2.5 text-[0.5625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Integración</th>
                    <th scope="col" class="px-4 py-2.5 text-[0.5625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Petición</th>
                    <th scope="col" class="px-4 py-2.5 text-[0.5625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Resultado</th>
                    <th scope="col" class="px-4 py-2.5 text-[0.5625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right">Duración</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr *ngFor="let l of svc.logs()!.items" class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">{{ l.creado_en | date:'dd MMM HH:mm:ss' }}</td>
                    <td class="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[160px] truncate">{{ l.cliente || '—' }}</td>
                    <td class="px-4 py-2.5">
                      <span class="text-[0.625rem] font-bold font-mono me-1.5" [ngClass]="tonoMetodo(l.metodo)">{{ l.metodo }}</span>
                      <span class="text-xs font-mono text-slate-600 dark:text-slate-400">{{ l.ruta }}</span>
                    </td>
                    <td class="px-4 py-2.5 whitespace-nowrap">
                      <span class="text-xs font-bold font-mono tabular-nums" [ngClass]="tonoEstado(l.status_code)">{{ l.status_code }}</span>
                      <span *ngIf="l.error_code" class="ms-2 text-[0.625rem] font-mono text-slate-400 dark:text-slate-500">{{ l.error_code }}</span>
                    </td>
                    <td class="px-4 py-2.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 text-right">{{ l.duracion_ms }} ms</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
              <p class="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {{ rangoMostrado() }} de {{ svc.logs()!.total }}
              </p>
              <div class="flex items-center gap-1">
                <button type="button" (click)="cambiarPagina(-1)" [disabled]="(filtro.pagina ?? 1) <= 1"
                  class="w-10 h-10 grid place-items-center rounded-lg border border-slate-200 dark:border-slate-700/60 text-slate-500 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation"
                  aria-label="Página anterior">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button type="button" (click)="cambiarPagina(1)" [disabled]="!hayPaginaSiguiente()"
                  class="w-10 h-10 grid place-items-center rounded-lg border border-slate-200 dark:border-slate-700/60 text-slate-500 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation"
                  aria-label="Página siguiente">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ─────────── GUÍA ─────────── -->
        <div *ngIf="seccion() === 'guia'" class="animate-fadeUp max-w-[75ch] space-y-6">

          <section>
            <h3 class="text-sm font-display font-black text-slate-900 dark:text-white">Cómo se conecta un sistema externo</h3>
            <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Entrega al integrador el <span class="font-mono text-slate-700 dark:text-slate-300">client_id</span> y el
              <span class="font-mono text-slate-700 dark:text-slate-300">client_secret</span>. La credencial ya sabe sobre qué
              congregación opera, así que ningún endpoint recibe ese dato.
            </p>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Referencia completa e interactiva en
              <a [href]="urlDocs" target="_blank" rel="noopener"
                class="font-semibold text-brand-purple hover:underline underline-offset-2">{{ urlDocs }}</a>.
            </p>
          </section>

          <section *ngFor="let paso of pasosGuia">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{{ paso.titulo }}</h4>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{{ paso.detalle }}</p>
            <div class="mt-2 relative group">
              <pre class="overflow-x-auto custom-scrollbar rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 p-4 text-[0.6875rem] leading-relaxed font-mono text-slate-300"><code>{{ paso.codigo }}</code></pre>
              <button type="button" (click)="copiar(paso.codigo, 'ejemplo')"
                class="absolute top-2 end-2 min-h-[32px] px-2.5 rounded-lg bg-slate-800/90 text-[0.625rem] font-bold text-slate-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity touch-manipulation">
                Copiar
              </button>
            </div>
          </section>

          <section>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Errores</h4>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Todo fallo devuelve la misma forma. El integrador debe programar contra
              <span class="font-mono text-slate-700 dark:text-slate-300">error.code</span>, que es estable; el mensaje puede reformularse.
            </p>
            <pre class="mt-2 overflow-x-auto custom-scrollbar rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 p-4 text-[0.6875rem] leading-relaxed font-mono text-slate-300"><code>{{ ejemploError }}</code></pre>
          </section>
        </div>
      </div>

      <!-- ═══ Panel lateral: alta / edición ═══ -->
      <div *ngIf="panelAbierto()" class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="titulo-panel">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" (click)="cerrarPanel()" aria-hidden="true"></div>

        <div class="animate-slidePanel relative w-full sm:max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col">

          <div class="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 id="titulo-panel" class="text-base font-display font-black text-slate-900 dark:text-white">
              {{ editando() ? 'Editar integración' : 'Nueva integración' }}
            </h3>
            <button type="button" (click)="cerrarPanel()" aria-label="Cerrar"
              class="w-10 h-10 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-manipulation">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">

            <div class="flex flex-col gap-2">
              <label for="f-nombre" class="text-xs font-bold text-slate-600 dark:text-slate-300">Nombre <span class="text-red-500">*</span></label>
              <input id="f-nombre" type="text" [(ngModel)]="form.nombre" maxlength="120"
                placeholder="Ej. Portal de Circuito VAL-06"
                class="min-h-[44px] px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all">
              <p *ngIf="errores().nombre" class="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{{ errores().nombre }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <label for="f-descripcion" class="text-xs font-bold text-slate-600 dark:text-slate-300">Descripción</label>
              <textarea id="f-descripcion" [(ngModel)]="form.descripcion" rows="2" maxlength="500"
                placeholder="Para qué se usa esta credencial"
                class="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all resize-none"></textarea>
            </div>

            <div class="flex flex-col gap-2">
              <label for="f-congregacion" class="text-xs font-bold text-slate-600 dark:text-slate-300">Congregación <span class="text-red-500">*</span></label>
              <select id="f-congregacion" [(ngModel)]="form.id_congregacion" [disabled]="editando() !== null"
                class="min-h-[44px] px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all disabled:opacity-60">
                <option [ngValue]="null" disabled>Selecciona una congregación</option>
                <option *ngFor="let c of congregaciones()" [ngValue]="c.id_congregacion">{{ c.nombre_congregacion }}</option>
              </select>
              <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500 leading-relaxed">
                {{ editando()
                  ? 'La congregación no se puede cambiar: crearía acceso retroactivo a datos de otra.'
                  : 'La credencial sólo verá y modificará datos de esta congregación.' }}
              </p>
              <p *ngIf="errores().congregacion" class="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{{ errores().congregacion }}</p>
            </div>

            <fieldset class="flex flex-col gap-2">
              <legend class="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Permisos <span class="text-red-500">*</span></legend>

              <div *ngFor="let grupo of scopesPorGrupo()" class="mb-1">
                <p class="text-[0.625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">{{ grupo.nombre }}</p>
                <div class="space-y-1.5">
                  <label *ngFor="let s of grupo.scopes"
                    class="flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors"
                    [ngClass]="form.scopes.includes(s.codigo)
                      ? 'border-brand-purple/40 bg-brand-purple/5 dark:bg-brand-purple/10'
                      : 'border-slate-200 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-800/60'">
                    <input type="checkbox" [checked]="form.scopes.includes(s.codigo)" (change)="alternarScope(s.codigo)"
                      class="mt-0.5 w-4 h-4 rounded accent-[#6d28d9] shrink-0">
                    <span class="min-w-0">
                      <span class="flex items-center gap-1.5">
                        <span class="text-xs font-bold text-slate-800 dark:text-slate-100">{{ s.nombre }}</span>
                        <span *ngIf="s.escritura" class="text-[0.5625rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">Escritura</span>
                      </span>
                      <span class="block mt-0.5 text-[0.6875rem] text-slate-500 dark:text-slate-400 leading-relaxed">{{ s.descripcion }}</span>
                    </span>
                  </label>
                </div>
              </div>
              <p *ngIf="errores().scopes" class="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{{ errores().scopes }}</p>
            </fieldset>

            <details class="rounded-xl border border-slate-200 dark:border-slate-700/70">
              <summary class="min-h-[44px] flex items-center px-3 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                Opciones avanzadas
              </summary>
              <div class="px-3 pb-3 pt-1 space-y-4 border-t border-slate-100 dark:border-slate-800">

                <div class="flex flex-col gap-2 pt-3">
                  <label for="f-limite" class="text-xs font-bold text-slate-600 dark:text-slate-300">Peticiones por minuto</label>
                  <input id="f-limite" type="number" min="1" max="6000" [(ngModel)]="form.rate_limit_minuto"
                    class="min-h-[44px] px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all">
                </div>

                <div class="flex flex-col gap-2">
                  <label for="f-ips" class="text-xs font-bold text-slate-600 dark:text-slate-300">IPs autorizadas</label>
                  <input id="f-ips" type="text" [(ngModel)]="form.ip_whitelist"
                    placeholder="192.0.2.10, 203.0.113.0/24"
                    class="min-h-[44px] px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all">
                  <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500">Separadas por comas. Admite rangos CIDR. En blanco, sin restricción de origen.</p>
                </div>

                <div class="flex flex-col gap-2">
                  <label for="f-expira" class="text-xs font-bold text-slate-600 dark:text-slate-300">Caduca el</label>
                  <input id="f-expira" type="date" [(ngModel)]="form.expira_en"
                    class="min-h-[44px] px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-purple/15 focus:border-brand-purple outline-none transition-all">
                  <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500">En blanco, sin caducidad.</p>
                </div>
              </div>
            </details>
          </div>

          <div class="shrink-0 flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" (click)="cerrarPanel()"
              class="min-h-[44px] px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-manipulation">
              Cancelar
            </button>
            <button type="button" (click)="guardar()" [disabled]="svc.guardando()"
              class="min-h-[44px] px-5 rounded-xl bg-brand-purple hover:bg-purple-700 text-white text-sm font-bold shadow-sm transition-all active:translate-y-px disabled:opacity-40 disabled:pointer-events-none touch-manipulation inline-flex items-center gap-2">
              <span *ngIf="svc.guardando()" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true"></span>
              {{ editando() ? 'Guardar cambios' : 'Crear y generar secreto' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ Secreto recién generado ═══ -->
      <div *ngIf="secretoNuevo()" class="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-secreto">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" aria-hidden="true"></div>

        <div class="animate-fadeUp relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-2xl overflow-hidden">
          <div class="px-5 sm:px-6 py-5 border-b border-slate-100 dark:border-slate-800">
            <h3 id="titulo-secreto" class="text-base font-display font-black text-slate-900 dark:text-white">Guarda estas credenciales ahora</h3>
            <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              El secreto se guarda cifrado y no se puede volver a consultar. Si lo pierdes, tendrás que rotarlo y
              actualizar el sistema externo.
            </p>
          </div>

          <div class="px-5 sm:px-6 py-5 space-y-4">
            <div class="flex flex-col gap-1.5">
              <span class="text-[0.625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">client_id</span>
              <div class="flex items-center gap-2">
                <code class="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 text-xs font-mono text-slate-800 dark:text-slate-200 break-all">{{ secretoNuevo()!.cliente.client_id }}</code>
                <button type="button" (click)="copiar(secretoNuevo()!.cliente.client_id, 'client_id')"
                  class="shrink-0 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700/70 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation">
                  Copiar
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <span class="text-[0.625rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">client_secret</span>
              <div class="flex items-center gap-2">
                <code class="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50 text-xs font-mono text-amber-900 dark:text-amber-200 break-all">
                  {{ secretoVisible() ? secretoNuevo()!.client_secret : enmascarado(secretoNuevo()!.client_secret) }}
                </code>
                <button type="button" (click)="secretoVisible.set(!secretoVisible())"
                  [attr.aria-label]="secretoVisible() ? 'Ocultar secreto' : 'Mostrar secreto'"
                  class="shrink-0 w-11 h-11 grid place-items-center rounded-xl border border-slate-200 dark:border-slate-700/70 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation">
                  <svg *ngIf="!secretoVisible()" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg *ngIf="secretoVisible()" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
                <button type="button" (click)="copiar(secretoNuevo()!.client_secret, 'client_secret')"
                  class="shrink-0 min-h-[44px] px-3 rounded-xl bg-brand-purple hover:bg-purple-700 text-white text-xs font-bold transition-colors touch-manipulation">
                  Copiar
                </button>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
            <button type="button" (click)="cerrarSecreto()"
              class="min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold transition-all active:translate-y-px touch-manipulation">
              Ya las guardé
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ Confirmación ═══ -->
      <div *ngIf="confirmacion()" class="fixed inset-0 z-[60] grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="titulo-confirmacion">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" (click)="confirmacion.set(null)" aria-hidden="true"></div>

        <div class="animate-fadeUp relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-2xl p-6">
          <h3 id="titulo-confirmacion" class="text-base font-display font-black text-slate-900 dark:text-white">{{ confirmacion()!.titulo }}</h3>
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{{ confirmacion()!.mensaje }}</p>

          <div class="mt-6 flex items-center justify-end gap-2">
            <button type="button" (click)="confirmacion.set(null)"
              class="min-h-[44px] px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-manipulation">
              Cancelar
            </button>
            <button type="button" (click)="ejecutarConfirmacion()" [disabled]="svc.guardando()"
              class="min-h-[44px] px-5 rounded-xl text-white text-sm font-bold transition-all active:translate-y-px disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
              [ngClass]="confirmacion()!.destructivo ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'">
              {{ confirmacion()!.accionTexto }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ApiConfigComponent implements OnInit {
  readonly svc = inject(ApiClientsService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  readonly secciones: { id: Seccion; etiqueta: string }[] = [
    { id: 'credenciales', etiqueta: 'Credenciales' },
    { id: 'actividad', etiqueta: 'Actividad' },
    { id: 'guia', etiqueta: 'Guía de integración' },
  ];

  readonly seccion = signal<Seccion>('credenciales');
  readonly congregaciones = signal<CongregacionOpcion[]>([]);
  readonly panelAbierto = signal(false);
  readonly editando = signal<ApiCliente | null>(null);
  readonly secretoNuevo = signal<{ cliente: ApiCliente; client_secret: string } | null>(null);
  readonly secretoVisible = signal(false);
  readonly errores = signal<{ nombre?: string; congregacion?: string; scopes?: string }>({});
  readonly confirmacion = signal<{
    titulo: string;
    mensaje: string;
    accionTexto: string;
    destructivo: boolean;
    ejecutar: () => void;
  } | null>(null);

  busqueda = '';
  form: FormularioCredencial = { ...FORMULARIO_VACIO };
  filtro: ApiLogsFiltro = { pagina: 1, tamano: 25, solo_errores: false, id_api_cliente: null };

  readonly urlDocs = `${window.location.origin}/api/v1/docs`;

  private readonly termino = signal('');

  readonly clientesFiltrados = computed(() => {
    const t = this.termino().trim().toLowerCase();
    const lista = this.svc.clientes();
    if (!t) return lista;
    return lista.filter(c =>
      c.nombre.toLowerCase().includes(t) ||
      c.client_id.toLowerCase().includes(t) ||
      (c.descripcion ?? '').toLowerCase().includes(t),
    );
  });

  /** Agrupa los scopes por área para que el formulario se lea de un vistazo. */
  readonly scopesPorGrupo = computed(() => {
    const grupos = new Map<string, ApiScope[]>();
    for (const s of this.svc.scopes()) {
      const lista = grupos.get(s.grupo) ?? [];
      lista.push(s);
      grupos.set(s.grupo, lista);
    }
    return [...grupos.entries()].map(([nombre, scopes]) => ({ nombre, scopes }));
  });

  readonly tarjetasMetricas = computed(() => {
    const m = this.svc.metricas();
    const tasa = m ? Math.round(m.tasa_error * 1000) / 10 : 0;
    return [
      { etiqueta: 'Peticiones', valor: m ? String(m.total_peticiones) : '—', nota: 'últimas 24 h', tono: 'text-slate-900 dark:text-white' },
      { etiqueta: 'Errores', valor: m ? String(m.total_errores) : '—', nota: `${tasa}% del total`, tono: (m?.total_errores ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white' },
      { etiqueta: 'Latencia media', valor: m ? `${m.latencia_promedio_ms}` : '—', nota: 'milisegundos', tono: 'text-slate-900 dark:text-white' },
      { etiqueta: 'Pico', valor: m ? `${m.latencia_maxima_ms}` : '—', nota: 'milisegundos', tono: 'text-slate-900 dark:text-white' },
    ];
  });

  readonly pasosGuia = [
    {
      titulo: '1. Obtener el token',
      detalle: 'Dura 30 minutos. Guárdalo en memoria y renuévalo cuando caduque.',
      codigo: `curl -X POST ${window.location.origin}/api/v1/auth/token \\
  -H 'Content-Type: application/json' \\
  -d '{"client_id":"gac_ci_...","client_secret":"gac_sk_..."}'`,
    },
    {
      titulo: '2. Consultar un mes de logística',
      detalle: 'La congregación se deduce del token; no se envía como parámetro.',
      codigo: `curl '${window.location.origin}/api/v1/reuniones/logistica/mes?ano=2026&mes=8' \\
  -H 'Authorization: Bearer <token>'`,
    },
    {
      titulo: '3. Crear un discurso saliente',
      detalle: 'Exige Idempotency-Key. Reintentar con la misma clave no duplica el registro.',
      codigo: `curl -X POST ${window.location.origin}/api/v1/reuniones/discursos/salientes \\
  -H 'Authorization: Bearer <token>' \\
  -H 'Idempotency-Key: 6f1c3a90-2f4e-4a0b-9d31-8c7e1f5a2b44' \\
  -H 'Content-Type: application/json' \\
  -d '{"fecha":"2026-08-09","congregacion_destino":"Palmira Norte","tema_discurso":"..."}'`,
    },
  ];

  readonly ejemploError = `{
  "success": false,
  "error": {
    "code": "PUBLICADOR_SIN_PERMISO",
    "message": "El publicador no tiene habilitado el permiso 'microfono'.",
    "details": [{ "field": "id_publicador", "issue": "sin permiso microfono" }],
    "request_id": "8f3c2d10-4b7a-4c11-9e02-5a6d8b1f0c33"
  }
}`;

  ngOnInit(): void {
    this.svc.listar().subscribe({ error: () => this.toast.error('No se pudieron cargar las integraciones') });
    this.svc.cargarScopes().subscribe({ error: () => this.toast.error('No se pudo cargar el catálogo de permisos') });
    this.http
      .get<CongregacionOpcion[]>(`${environment.apiUrl}/configuracion/admin/congregaciones`)
      .subscribe({
        next: lista => this.congregaciones.set(lista),
        error: () => this.toast.error('No se pudieron cargar las congregaciones'),
      });
  }

  // ── Navegación ──────────────────────────────────────────────────
  setSeccion(s: Seccion): void {
    this.seccion.set(s);
    // Siempre se recarga al entrar: el registro cambia con cada llamada del
    // sistema externo, y una vista cacheada de hace diez minutos es peor que
    // no tener vista, porque parece actual.
    if (s === 'actividad') {
      this.recargarLogs();
    }
  }

  filtrar(): void {
    this.termino.set(this.busqueda);
  }

  // ── Panel ───────────────────────────────────────────────────────
  abrirCreacion(): void {
    this.editando.set(null);
    this.errores.set({});
    this.form = {
      ...FORMULARIO_VACIO,
      // Con una sola congregación, preseleccionarla evita un clic sin decisión.
      id_congregacion: this.congregaciones().length === 1 ? this.congregaciones()[0].id_congregacion : null,
    };
    this.panelAbierto.set(true);
  }

  abrirEdicion(c: ApiCliente): void {
    this.editando.set(c);
    this.errores.set({});
    this.form = {
      nombre: c.nombre,
      descripcion: c.descripcion ?? '',
      id_congregacion: c.id_congregacion,
      scopes: [...c.scopes],
      ip_whitelist: (c.ip_whitelist ?? []).join(', '),
      rate_limit_minuto: c.rate_limit_minuto,
      expira_en: c.expira_en ? c.expira_en.slice(0, 10) : '',
    };
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void {
    this.panelAbierto.set(false);
    this.editando.set(null);
  }

  alternarScope(codigo: string): void {
    const actuales = this.form.scopes;
    this.form.scopes = actuales.includes(codigo)
      ? actuales.filter(s => s !== codigo)
      : [...actuales, codigo];
  }

  guardar(): void {
    if (!this.validar()) return;

    const ips = this.form.ip_whitelist
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const base = {
      nombre: this.form.nombre.trim(),
      descripcion: this.form.descripcion.trim() || null,
      scopes: this.form.scopes,
      ip_whitelist: ips.length ? ips : null,
      rate_limit_minuto: Number(this.form.rate_limit_minuto) || 60,
      // El backend espera un instante; se fija el fin del día indicado para que
      // la credencial siga viva durante toda esa jornada.
      expira_en: this.form.expira_en ? `${this.form.expira_en}T23:59:59` : null,
    };

    const enEdicion = this.editando();
    if (enEdicion) {
      this.svc.actualizar(enEdicion.id_api_cliente, base).subscribe({
        next: () => {
          this.toast.success('Integración actualizada');
          this.cerrarPanel();
        },
        error: e => this.toast.error('No se pudo guardar', this.mensajeError(e)),
      });
      return;
    }

    const payload: ApiClientePayload = { ...base, id_congregacion: this.form.id_congregacion! };
    this.svc.crear(payload).subscribe({
      next: r => {
        this.cerrarPanel();
        this.secretoVisible.set(false);
        this.secretoNuevo.set(r);
      },
      error: e => this.toast.error('No se pudo crear la integración', this.mensajeError(e)),
    });
  }

  private validar(): boolean {
    const errores: { nombre?: string; congregacion?: string; scopes?: string } = {};
    if (this.form.nombre.trim().length < 3) {
      errores.nombre = 'Indica un nombre de al menos 3 caracteres.';
    }
    if (!this.editando() && !this.form.id_congregacion) {
      errores.congregacion = 'Selecciona la congregación a la que dará acceso.';
    }
    if (this.form.scopes.length === 0) {
      errores.scopes = 'Marca al menos un permiso; una credencial sin permisos no sirve para nada.';
    }
    this.errores.set(errores);
    return Object.keys(errores).length === 0;
  }

  // ── Secreto ─────────────────────────────────────────────────────
  cerrarSecreto(): void {
    this.secretoNuevo.set(null);
    this.secretoVisible.set(false);
  }

  enmascarado(secreto: string): string {
    return `${secreto.slice(0, 10)}${'•'.repeat(Math.max(secreto.length - 10, 0))}`;
  }

  copiar(texto: string, que: string): void {
    navigator.clipboard?.writeText(texto).then(
      () => this.toast.success('Copiado', `Se copió el ${que} al portapapeles.`),
      () => this.toast.error('No se pudo copiar', 'Selecciona el texto y cópialo manualmente.'),
    );
  }

  // ── Confirmaciones ──────────────────────────────────────────────
  confirmar(accion: 'rotar' | 'revocar' | 'eliminar', c: ApiCliente): void {
    const config = {
      rotar: {
        titulo: 'Rotar el secreto',
        mensaje: `Se generará un secreto nuevo para «${c.nombre}» y el actual dejará de funcionar de inmediato. El sistema externo fallará hasta que lo actualices.`,
        accionTexto: 'Rotar secreto',
        destructivo: false,
        ejecutar: () =>
          this.svc.rotarSecreto(c.id_api_cliente).subscribe({
            next: r => {
              this.confirmacion.set(null);
              this.secretoVisible.set(false);
              this.secretoNuevo.set(r);
            },
            error: e => this.toast.error('No se pudo rotar el secreto', this.mensajeError(e)),
          }),
      },
      revocar: {
        titulo: 'Revocar el acceso',
        mensaje: `«${c.nombre}» dejará de poder llamar a la API ahora mismo, incluso con un token vigente. Podrás reactivarla más adelante desde la edición.`,
        accionTexto: 'Revocar',
        destructivo: true,
        ejecutar: () =>
          this.svc.revocar(c.id_api_cliente).subscribe({
            next: () => {
              this.confirmacion.set(null);
              this.toast.success('Acceso revocado');
            },
            error: e => this.toast.error('No se pudo revocar', this.mensajeError(e)),
          }),
      },
      eliminar: {
        titulo: 'Eliminar la integración',
        mensaje: `Se borrará «${c.nombre}» y sus registros de consumo. Esta acción no se puede deshacer.`,
        accionTexto: 'Eliminar',
        destructivo: true,
        ejecutar: () =>
          this.svc.eliminar(c.id_api_cliente).subscribe({
            next: () => {
              this.confirmacion.set(null);
              this.toast.success('Integración eliminada');
            },
            error: e => this.toast.error('No se pudo eliminar', this.mensajeError(e)),
          }),
      },
    }[accion];

    this.confirmacion.set(config);
  }

  ejecutarConfirmacion(): void {
    this.confirmacion()?.ejecutar();
  }

  // ── Actividad ───────────────────────────────────────────────────
  recargarLogs(): void {
    this.filtro.pagina = 1;
    this.cargarLogs();
  }

  alternarSoloErrores(): void {
    this.filtro.solo_errores = !this.filtro.solo_errores;
    this.recargarLogs();
  }

  cambiarPagina(delta: number): void {
    this.filtro.pagina = Math.max((this.filtro.pagina ?? 1) + delta, 1);
    this.cargarLogs();
  }

  private cargarLogs(): void {
    this.svc.cargarLogs(this.filtro).subscribe({
      error: () => this.toast.error('No se pudieron cargar los registros'),
    });
    this.svc.cargarMetricas().subscribe({ error: () => {} });
  }

  hayPaginaSiguiente(): boolean {
    const p = this.svc.logs();
    if (!p) return false;
    return p.pagina * p.tamano < p.total;
  }

  rangoMostrado(): string {
    const p = this.svc.logs();
    if (!p || p.total === 0) return '0';
    const inicio = (p.pagina - 1) * p.tamano + 1;
    const fin = Math.min(p.pagina * p.tamano, p.total);
    return `${inicio}–${fin}`;
  }

  // ── Presentación ────────────────────────────────────────────────
  estadoTexto(c: ApiCliente): string {
    if (c.revocado) return 'Revocada';
    if (!c.activo) return 'Inactiva';
    if (c.expira_en && new Date(c.expira_en) <= new Date()) return 'Caducada';
    return 'Activa';
  }

  estadoPunto(c: ApiCliente): string {
    switch (this.estadoTexto(c)) {
      case 'Activa': return 'bg-emerald-500';
      case 'Caducada': return 'bg-amber-500';
      default: return 'bg-slate-300 dark:bg-slate-600';
    }
  }

  estadoChip(c: ApiCliente): string {
    switch (this.estadoTexto(c)) {
      case 'Activa': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
      case 'Caducada': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
    }
  }

  ultimoUso(c: ApiCliente): string {
    if (!c.ultimo_uso) return 'Nunca';
    const minutos = Math.floor((Date.now() - new Date(c.ultimo_uso).getTime()) / 60000);
    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `Hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return dias < 30 ? `Hace ${dias} d` : new Date(c.ultimo_uso).toLocaleDateString('es');
  }

  esEscritura(codigo: string): boolean {
    return codigo.endsWith(':write');
  }

  etiquetaScope(codigo: string): string {
    const s = this.svc.scopes().find(x => x.codigo === codigo);
    return s ? s.nombre : codigo;
  }

  tonoMetodo(metodo: string): string {
    switch (metodo) {
      case 'GET': return 'text-sky-600 dark:text-sky-400';
      case 'POST': return 'text-emerald-600 dark:text-emerald-400';
      case 'PUT': return 'text-amber-600 dark:text-amber-400';
      case 'DELETE': return 'text-red-600 dark:text-red-400';
      default: return 'text-slate-500';
    }
  }

  tonoEstado(status: number): string {
    if (status >= 500) return 'text-red-600 dark:text-red-400';
    if (status >= 400) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  }

  private mensajeError(e: unknown): string {
    const detalle = (e as { error?: { detail?: unknown } })?.error?.detail;
    if (typeof detalle === 'string') return detalle;
    return 'Revisa los datos e inténtalo de nuevo.';
  }
}

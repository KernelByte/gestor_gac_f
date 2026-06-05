import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../toast/toast.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ConflictoCandidato {
  id_publicador: number;
  nombre_completo: string;
  fecha_nacimiento: string | null;
  fecha_bautismo: string | null;
  nombre_grupo: string;
  estado: string | null;
}

export interface ConflictoPrivilegioActivo {
  id_privilegio: number;
  nombre: string;
  fecha_inicio: string | null;
}

export interface ConflictoFila {
  fila: number;
  tipo: 'ambiguo' | 'similar' | 'fechas_distintas' | 'privilegios_ambiguos' | 'privilegio_sexo_invalido';
  datos_excel: {
    nombre_completo: string;
    fecha_nacimiento: string | null;
    fecha_bautismo: string | null;
    grupo: number | null;
  };
  candidatos: ConflictoCandidato[];
  /** Solo presente en tipo === 'privilegios_ambiguos' */
  privilegios_activos?: ConflictoPrivilegioActivo[];
  /** Solo presente en tipo === 'privilegio_sexo_invalido' */
  sexo_excel?: string;
  privilegios_incompatibles?: string[];
}

type ResolucionAccion = 'actualizar' | 'insertar' | 'descartar' | 'mantener' | 'cerrar_todos' | 'eliminar' | 'omitir' | 'aplicar';

interface Resolucion {
  accion: ResolucionAccion;
  id_publicador?: number | null;
}

type Phase = 'select' | 'analyzing' | 'review' | 'importing' | 'done';

const TIPO_LABEL: Record<ConflictoFila['tipo'], string> = {
  ambiguo:                    'Nombre duplicado',
  similar:                    'Nombre similar',
  fechas_distintas:           'Fechas contradictorias',
  privilegios_ambiguos:       'Privilegios sin información',
  privilegio_sexo_invalido:   'Privilegio incompatible con el sexo',
};

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-import-publicadores-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div *ngIf="visible"
     class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
     (click)="onOverlayClick($event)">

  <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
       (click)="$event.stopPropagation()">

    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
        </div>
        <div>
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Cargar Plantilla</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ phaseLabel() }}</p>
        </div>
      </div>
      <button (click)="close()" class="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Body scrollable -->
    <div class="flex-1 overflow-y-auto px-6 py-5 no-scrollbar">

      <!-- ══ PHASE: select ══ -->
      <ng-container *ngIf="phase() === 'select'">
        <!-- Info banner -->
        <div class="mb-4 flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm">
          <svg class="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="text-blue-700 dark:text-blue-300">
            El archivo se analizará primero. Si hay nombres ambiguos o similares, podrás decidir fila por fila antes de aplicar los cambios.
          </span>
        </div>

        <!-- Drop zone -->
        <div (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onFileDrop($event)"
             [class.border-purple-500]="isDragOver()" [class.bg-purple-50]="isDragOver()"
             class="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all hover:border-purple-400 dark:hover:border-purple-500"
             (click)="fileInput.click()">
          <svg class="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="font-bold text-slate-700 dark:text-slate-300">Arrastra el archivo aquí</p>
          <p class="text-sm text-slate-400">o haz clic para seleccionarlo</p>
          <p class="text-xs text-slate-400">.xls o .xlsx — máximo 5 MB</p>
          <input #fileInput type="file" accept=".xls,.xlsx" class="hidden" (change)="onFileSelected($event)">
        </div>

        <!-- Error -->
        <div *ngIf="errorMsg()" class="mt-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {{ errorMsg() }}
        </div>

        <!-- Botón plantilla vacía -->
        <button (click)="downloadTemplate()"
                class="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Descargar plantilla vacía
        </button>
      </ng-container>

      <!-- ══ PHASE: analyzing ══ -->
      <ng-container *ngIf="phase() === 'analyzing'">
        <div class="py-16 flex flex-col items-center gap-4">
          <div class="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <p class="font-bold text-slate-700 dark:text-slate-300">Analizando {{ selectedFileName() }}…</p>
          <p class="text-sm text-slate-400">Buscando coincidencias y conflictos</p>
        </div>
      </ng-container>

      <!-- ══ PHASE: review ══ -->
      <ng-container *ngIf="phase() === 'review'">
        <!-- Resumen previo -->
        <div class="grid grid-cols-3 gap-3 mb-5">
          <div class="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/40 text-center">
            <div class="text-xl font-black text-emerald-600 dark:text-emerald-400">{{ analisisResumen()?.nuevos || 0 }}</div>
            <div class="text-[0.65rem] font-bold text-emerald-600/70 uppercase tracking-wide">Nuevos</div>
          </div>
          <div class="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100 dark:border-blue-900/40 text-center">
            <div class="text-xl font-black text-blue-600 dark:text-blue-400">{{ analisisResumen()?.actualizaciones || 0 }}</div>
            <div class="text-[0.65rem] font-bold text-blue-600/70 uppercase tracking-wide">Actualizaciones</div>
          </div>
          <div class="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 border border-amber-100 dark:border-amber-900/40 text-center">
            <div class="text-xl font-black text-amber-600 dark:text-amber-400">{{ conflictos().length }}</div>
            <div class="text-[0.65rem] font-bold text-amber-600/70 uppercase tracking-wide">Conflictos</div>
          </div>
        </div>

        <!-- Instrucción -->
        <p class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
          Revisa cada conflicto y elige qué hacer:
        </p>

        <!-- Lista de conflictos -->
        <div class="space-y-4 mb-6">
          <div *ngFor="let c of conflictos(); let ci = index"
               class="border rounded-2xl overflow-hidden"
               [class.border-amber-200]="c.tipo === 'ambiguo'"
               [class.dark:border-amber-800]="c.tipo === 'ambiguo'"
               [class.border-blue-200]="c.tipo === 'similar'"
               [class.dark:border-blue-800]="c.tipo === 'similar'"
               [class.border-rose-200]="c.tipo === 'fechas_distintas'"
               [class.dark:border-rose-800]="c.tipo === 'fechas_distintas'"
               [class.border-indigo-200]="c.tipo === 'privilegios_ambiguos'"
               [class.dark:border-indigo-800]="c.tipo === 'privilegios_ambiguos'"
               [class.border-orange-200]="c.tipo === 'privilegio_sexo_invalido'"
               [class.dark:border-orange-800]="c.tipo === 'privilegio_sexo_invalido'">

            <!-- Header del conflicto -->
            <div class="flex items-center justify-between px-4 py-3"
                 [class.bg-amber-50]="c.tipo === 'ambiguo'"
                 [class.dark:bg-amber-900/20]="c.tipo === 'ambiguo'"
                 [class.bg-blue-50]="c.tipo === 'similar'"
                 [class.dark:bg-blue-900/20]="c.tipo === 'similar'"
                 [class.bg-rose-50]="c.tipo === 'fechas_distintas'"
                 [class.dark:bg-rose-900/20]="c.tipo === 'fechas_distintas'"
                 [class.bg-indigo-50]="c.tipo === 'privilegios_ambiguos'"
                 [class.dark:bg-indigo-900/20]="c.tipo === 'privilegios_ambiguos'"
                 [class.bg-orange-50]="c.tipo === 'privilegio_sexo_invalido'"
                 [class.dark:bg-orange-900/20]="c.tipo === 'privilegio_sexo_invalido'">
              <div>
                <span class="text-xs font-black uppercase tracking-widest"
                      [class.text-amber-600]="c.tipo === 'ambiguo'"
                      [class.text-blue-600]="c.tipo === 'similar'"
                      [class.text-rose-600]="c.tipo === 'fechas_distintas'"
                      [class.text-indigo-600]="c.tipo === 'privilegios_ambiguos'"
                      [class.text-orange-600]="c.tipo === 'privilegio_sexo_invalido'">
                  {{ tipoLabel(c.tipo) }}
                </span>
                <p class="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {{ c.datos_excel.nombre_completo }}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  <span *ngIf="c.datos_excel.fecha_nacimiento">Nac: {{ c.datos_excel.fecha_nacimiento }}</span>
                  <span *ngIf="c.datos_excel.fecha_nacimiento && c.datos_excel.fecha_bautismo"> · </span>
                  <span *ngIf="c.datos_excel.fecha_bautismo">Baut: {{ c.datos_excel.fecha_bautismo }}</span>
                  <span *ngIf="!c.datos_excel.fecha_nacimiento && !c.datos_excel.fecha_bautismo" class="italic">Sin fechas en el Excel</span>
                </p>
              </div>
              <!-- Indicador de resolución -->
              <div *ngIf="resoluciones()[c.tipo === 'privilegios_ambiguos' ? privKey(c.fila) : c.tipo === 'privilegio_sexo_invalido' ? sexKey(c.fila) : c.fila]"
                   class="text-xs font-bold px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                ✓ Resuelto
              </div>
            </div>

            <!-- ── Opciones: conflictos de IDENTIDAD (ambiguo / similar / fechas_distintas) ── -->
            <div *ngIf="c.tipo !== 'privilegios_ambiguos'" class="px-4 py-3 bg-white dark:bg-slate-900 space-y-2">
              <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Coincidencias en el sistema:</p>
              <label *ngFor="let cand of c.candidatos"
                     class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                     [class.border-purple-300]="isSelected(c.fila, 'actualizar', cand.id_publicador)"
                     [class.bg-purple-50]="isSelected(c.fila, 'actualizar', cand.id_publicador)"
                     [class.dark:bg-purple-900/20]="isSelected(c.fila, 'actualizar', cand.id_publicador)"
                     [class.border-slate-200]="!isSelected(c.fila, 'actualizar', cand.id_publicador)"
                     [class.dark:border-slate-700]="!isSelected(c.fila, 'actualizar', cand.id_publicador)"
                     (click)="setResolucion(c.fila, 'actualizar', cand.id_publicador)">
                <input type="radio" [name]="'fila-' + c.fila" class="mt-0.5 accent-purple-600"
                       [checked]="isSelected(c.fila, 'actualizar', cand.id_publicador)"
                       (click)="$event.stopPropagation()">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ cand.nombre_completo }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                    <span *ngIf="cand.fecha_nacimiento">Nac: {{ cand.fecha_nacimiento }}</span>
                    <span *ngIf="cand.fecha_nacimiento && cand.fecha_bautismo"> · </span>
                    <span *ngIf="cand.fecha_bautismo">Baut: {{ cand.fecha_bautismo }}</span>
                    <span *ngIf="cand.nombre_grupo"> · {{ cand.nombre_grupo }}</span>
                  </p>
                </div>
                <span class="text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0">Actualizar</span>
              </label>
              <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                     [class.border-emerald-300]="isSelected(c.fila, 'insertar')"
                     [class.bg-emerald-50]="isSelected(c.fila, 'insertar')"
                     [class.dark:bg-emerald-900/20]="isSelected(c.fila, 'insertar')"
                     [class.border-slate-200]="!isSelected(c.fila, 'insertar')"
                     [class.dark:border-slate-700]="!isSelected(c.fila, 'insertar')"
                     (click)="setResolucion(c.fila, 'insertar')">
                <input type="radio" [name]="'fila-' + c.fila" class="accent-emerald-600"
                       [checked]="isSelected(c.fila, 'insertar')"
                       (click)="$event.stopPropagation()">
                <span class="text-sm font-bold text-slate-700 dark:text-slate-300 flex-1">Insertar como nuevo publicador</span>
                <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">Nuevo</span>
              </label>
              <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                     [class.border-slate-400]="isSelected(c.fila, 'descartar')"
                     [class.bg-slate-100]="isSelected(c.fila, 'descartar')"
                     [class.dark:bg-slate-800]="isSelected(c.fila, 'descartar')"
                     [class.border-slate-200]="!isSelected(c.fila, 'descartar')"
                     [class.dark:border-slate-700]="!isSelected(c.fila, 'descartar')"
                     (click)="setResolucion(c.fila, 'descartar')">
                <input type="radio" [name]="'fila-' + c.fila" class="accent-slate-500"
                       [checked]="isSelected(c.fila, 'descartar')"
                       (click)="$event.stopPropagation()">
                <span class="text-sm font-bold text-slate-500 flex-1">Descartar esta fila</span>
                <span class="text-xs font-bold text-slate-400 shrink-0">Omitir</span>
              </label>
            </div>

            <!-- ── Opciones: conflicto de PRIVILEGIOS ── -->
            <div *ngIf="c.tipo === 'privilegios_ambiguos'" class="px-4 py-3 bg-white dark:bg-slate-900 space-y-2">
              <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Privilegios activos en el sistema (no aparecen en la plantilla):
              </p>
              <div class="mb-3 flex flex-wrap gap-2">
                <span *ngFor="let priv of c.privilegios_activos"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  {{ priv.nombre }}
                  <span class="text-indigo-400 dark:text-indigo-500 font-normal" *ngIf="priv.fecha_inicio">desde {{ priv.fecha_inicio }}</span>
                </span>
              </div>
              <!-- Mantener -->
              <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                     [class.border-emerald-300]="isSelected(privKey(c.fila), 'mantener')"
                     [class.bg-emerald-50]="isSelected(privKey(c.fila), 'mantener')"
                     [class.dark:bg-emerald-900/20]="isSelected(privKey(c.fila), 'mantener')"
                     [class.border-slate-200]="!isSelected(privKey(c.fila), 'mantener')"
                     [class.dark:border-slate-700]="!isSelected(privKey(c.fila), 'mantener')"
                     (click)="setResolucion(privKey(c.fila), 'mantener')">
                <input type="radio" [name]="'priv-' + c.fila" class="accent-emerald-600"
                       [checked]="isSelected(privKey(c.fila), 'mantener')"
                       (click)="$event.stopPropagation()">
                <div class="flex-1">
                  <span class="text-sm font-bold text-slate-700 dark:text-slate-300">Mantener privilegios existentes</span>
                  <p class="text-xs text-slate-400 mt-0.5">Los privilegios en BD se conservan tal como están</p>
                </div>
                <span class="text-xs font-bold text-emerald-600 shrink-0">Conservar</span>
              </label>
              <!-- Cerrar todos -->
              <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                     [class.border-rose-300]="isSelected(privKey(c.fila), 'cerrar_todos')"
                     [class.bg-rose-50]="isSelected(privKey(c.fila), 'cerrar_todos')"
                     [class.dark:bg-rose-900/20]="isSelected(privKey(c.fila), 'cerrar_todos')"
                     [class.border-slate-200]="!isSelected(privKey(c.fila), 'cerrar_todos')"
                     [class.dark:border-slate-700]="!isSelected(privKey(c.fila), 'cerrar_todos')"
                     (click)="setResolucion(privKey(c.fila), 'cerrar_todos')">
                <input type="radio" [name]="'priv-' + c.fila" class="accent-rose-600"
                       [checked]="isSelected(privKey(c.fila), 'cerrar_todos')"
                       (click)="$event.stopPropagation()">
                <div class="flex-1">
                  <span class="text-sm font-bold text-slate-700 dark:text-slate-300">Cerrar todos los privilegios</span>
                  <p class="text-xs text-slate-400 mt-0.5">Se registra fecha_fin = hoy en todos los privilegios activos</p>
                </div>
                <span class="text-xs font-bold text-rose-600 shrink-0">Cerrar</span>
              </label>
              <!-- Eliminar permanentemente -->
              <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                     [class.border-red-400]="isSelected(privKey(c.fila), 'eliminar')"
                     [class.bg-red-50]="isSelected(privKey(c.fila), 'eliminar')"
                     [class.dark:bg-red-900/20]="isSelected(privKey(c.fila), 'eliminar')"
                     [class.border-slate-200]="!isSelected(privKey(c.fila), 'eliminar')"
                     [class.dark:border-slate-700]="!isSelected(privKey(c.fila), 'eliminar')"
                     (click)="setResolucion(privKey(c.fila), 'eliminar')">
                <input type="radio" [name]="'priv-' + c.fila" class="accent-red-600"
                       [checked]="isSelected(privKey(c.fila), 'eliminar')"
                       (click)="$event.stopPropagation()">
                <div class="flex-1">
                  <span class="text-sm font-bold text-slate-700 dark:text-slate-300">Eliminar privilegio(s)</span>
                  <p class="text-xs text-red-500 mt-0.5">Borra el registro definitivamente — sin historial</p>
                </div>
                <span class="text-xs font-bold text-red-600 shrink-0">Eliminar</span>
              </label>
              <!-- Ignorar este conflicto -->
              <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                     [class.border-slate-400]="isSelected(privKey(c.fila), 'descartar')"
                     [class.bg-slate-100]="isSelected(privKey(c.fila), 'descartar')"
                     [class.dark:bg-slate-800]="isSelected(privKey(c.fila), 'descartar')"
                     [class.border-slate-200]="!isSelected(privKey(c.fila), 'descartar')"
                     [class.dark:border-slate-700]="!isSelected(privKey(c.fila), 'descartar')"
                     (click)="setResolucion(privKey(c.fila), 'descartar')">
                <input type="radio" [name]="'priv-' + c.fila" class="accent-slate-500"
                       [checked]="isSelected(privKey(c.fila), 'descartar')"
                       (click)="$event.stopPropagation()">
                <span class="text-sm font-bold text-slate-500 flex-1">Ignorar este conflicto</span>
                <span class="text-xs font-bold text-slate-400 shrink-0">Ignorar</span>
              </label>
            </div>

            <!-- ── Opciones: conflicto de SEXO EN PRIVILEGIOS ── -->
            <div *ngIf="c.tipo === 'privilegio_sexo_invalido'" class="px-4 py-3 bg-white dark:bg-slate-900 space-y-2">
              <div class="mb-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
                <p class="font-bold mb-1">⚠ Privilegio reservado para hombres</p>
                <p>
                  <strong>{{ c.datos_excel.nombre_completo }}</strong> tiene sexo
                  <strong>{{ c.sexo_excel === 'F' ? 'Femenino' : c.sexo_excel }}</strong>
                  en la plantilla, pero se le asignaron privilegios que solo pueden tener hombres:
                </p>
                <div class="flex flex-wrap gap-1.5 mt-2">
                  <span *ngFor="let priv of c.privilegios_incompatibles"
                        class="px-2 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-xs font-bold text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
                    {{ priv }}
                  </span>
                </div>
              </div>
              <!-- Omitir los privilegios incompatibles -->
              <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                     [class.border-emerald-300]="isSelected(sexKey(c.fila), 'omitir')"
                     [class.bg-emerald-50]="isSelected(sexKey(c.fila), 'omitir')"
                     [class.dark:bg-emerald-900/20]="isSelected(sexKey(c.fila), 'omitir')"
                     [class.border-slate-200]="!isSelected(sexKey(c.fila), 'omitir')"
                     [class.dark:border-slate-700]="!isSelected(sexKey(c.fila), 'omitir')"
                     (click)="setResolucion(sexKey(c.fila), 'omitir')">
                <input type="radio" [name]="'sex-' + c.fila" class="accent-emerald-600"
                       [checked]="isSelected(sexKey(c.fila), 'omitir')"
                       (click)="$event.stopPropagation()">
                <div class="flex-1">
                  <span class="text-sm font-bold text-slate-700 dark:text-slate-300">Omitir privilegios incompatibles</span>
                  <p class="text-xs text-slate-400 mt-0.5">Los demás datos del publicador se actualizan normalmente; solo se excluyen estos privilegios</p>
                </div>
                <span class="text-xs font-bold text-emerald-600 shrink-0">Corregir</span>
              </label>
              <!-- Aplicar de todas formas -->
              <label class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                     [class.border-orange-300]="isSelected(sexKey(c.fila), 'aplicar')"
                     [class.bg-orange-50]="isSelected(sexKey(c.fila), 'aplicar')"
                     [class.dark:bg-orange-900/20]="isSelected(sexKey(c.fila), 'aplicar')"
                     [class.border-slate-200]="!isSelected(sexKey(c.fila), 'aplicar')"
                     [class.dark:border-slate-700]="!isSelected(sexKey(c.fila), 'aplicar')"
                     (click)="setResolucion(sexKey(c.fila), 'aplicar')">
                <input type="radio" [name]="'sex-' + c.fila" class="accent-orange-600"
                       [checked]="isSelected(sexKey(c.fila), 'aplicar')"
                       (click)="$event.stopPropagation()">
                <div class="flex-1">
                  <span class="text-sm font-bold text-slate-700 dark:text-slate-300">Aplicar de todas formas</span>
                  <p class="text-xs text-slate-400 mt-0.5">Asignar el privilegio aunque no coincida con el sexo registrado</p>
                </div>
                <span class="text-xs font-bold text-orange-600 shrink-0">Forzar</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Progreso de resoluciones -->
        <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
          <span>{{ resolucionesCount() }} de {{ conflictos().length }} conflictos resueltos</span>
          <span *ngIf="!todosResueltos()" class="text-amber-500 font-bold">Completa todos para continuar</span>
        </div>
        <div class="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-5 overflow-hidden">
          <div class="h-full bg-purple-500 rounded-full transition-all duration-300"
               [style.width.%]="(resolucionesCount() / conflictos().length) * 100"></div>
        </div>

        <!-- Acciones -->
        <div class="flex gap-3">
          <button (click)="resetToSelect()"
                  class="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            ← Volver
          </button>
          <button (click)="confirmar()" [disabled]="!todosResueltos()"
                  class="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all"
                  [class.bg-purple-600]="todosResueltos()"
                  [class.hover:bg-purple-700]="todosResueltos()"
                  [class.bg-slate-300]="!todosResueltos()"
                  [class.cursor-not-allowed]="!todosResueltos()">
            Confirmar importación
          </button>
        </div>
      </ng-container>

      <!-- ══ PHASE: importing ══ -->
      <ng-container *ngIf="phase() === 'importing'">
        <div class="py-16 flex flex-col items-center gap-4">
          <div class="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <p class="font-bold text-slate-700 dark:text-slate-300">Aplicando cambios…</p>
        </div>
      </ng-container>

      <!-- ══ PHASE: done ══ -->
      <ng-container *ngIf="phase() === 'done'">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">Importación completada</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ finalResult()?.resumen?.msg }}</p>
          </div>
        </div>

        <!-- Stats publicadores -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/50 text-center">
            <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">{{ finalResult()?.resumen?.insertados || 0 }}</div>
            <div class="text-[0.65rem] font-bold text-emerald-600/70 uppercase tracking-wide">Insertados</div>
          </div>
          <div class="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50 text-center">
            <div class="text-2xl font-black text-blue-600 dark:text-blue-400">{{ finalResult()?.resumen?.actualizados || 0 }}</div>
            <div class="text-[0.65rem] font-bold text-blue-600/70 uppercase tracking-wide">Actualizados</div>
          </div>
          <div class="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/50 text-center">
            <div class="text-2xl font-black text-amber-600 dark:text-amber-400">{{ finalResult()?.resumen?.omitidos || 0 }}</div>
            <div class="text-[0.65rem] font-bold text-amber-600/70 uppercase tracking-wide">Omitidos</div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center">
            <div class="text-2xl font-black text-slate-600 dark:text-slate-300">{{ finalResult()?.resumen?.descartados || 0 }}</div>
            <div class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wide">Descartados</div>
          </div>
        </div>

        <!-- Conflictos pendientes (sin resolución) -->
        <div *ngIf="(finalResult()?.resumen?.conflictos_pendientes || 0) > 0"
             class="mb-4 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {{ finalResult()?.resumen?.conflictos_pendientes }} fila(s) omitida(s) por conflicto sin resolución.
        </div>

        <!-- Errores -->
        <div *ngIf="(finalResult()?.resumen?.errores || 0) > 0"
             class="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {{ finalResult()?.resumen?.errores }} fila(s) con error de base de datos.
        </div>

        <!-- Informes históricos -->
        <div *ngIf="(finalResult()?.resumen?.informes_insertados || 0) + (finalResult()?.resumen?.informes_actualizados || 0) > 0"
             class="mb-4">
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Informes Históricos</p>
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/50 text-center">
              <div class="text-lg font-black text-indigo-600 dark:text-indigo-400">{{ finalResult()?.resumen?.informes_insertados || 0 }}</div>
              <div class="text-[0.6rem] font-bold text-indigo-600/70 uppercase tracking-wide">Creados</div>
            </div>
            <div class="bg-cyan-50 dark:bg-cyan-900/10 rounded-xl p-3 border border-cyan-100 dark:border-cyan-900/50 text-center">
              <div class="text-lg font-black text-cyan-600 dark:text-cyan-400">{{ finalResult()?.resumen?.informes_actualizados || 0 }}</div>
              <div class="text-[0.6rem] font-bold text-cyan-600/70 uppercase tracking-wide">Actualizados</div>
            </div>
            <div class="bg-rose-50 dark:bg-rose-900/10 rounded-xl p-3 border border-rose-100 dark:border-rose-900/50 text-center">
              <div class="text-lg font-black text-rose-600 dark:text-rose-400">{{ finalResult()?.resumen?.informes_errores || 0 }}</div>
              <div class="text-[0.6rem] font-bold text-rose-600/70 uppercase tracking-wide">Errores</div>
            </div>
          </div>
        </div>

        <!-- Total filas -->
        <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between mb-6">
          <span class="text-sm font-bold text-slate-600 dark:text-slate-400">Total filas procesadas</span>
          <span class="text-lg font-black text-slate-900 dark:text-white">{{ finalResult()?.resumen?.filas || 0 }}</span>
        </div>

        <button (click)="close()"
                class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all">
          Cerrar
        </button>
      </ng-container>

    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display: contents; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `],
})
export class ImportPublicadoresModalComponent implements OnChanges {
  private http    = inject(HttpClient);
  private toast   = inject(ToastService);

  /** Si es null/undefined, el endpoint no manda id_congregacion (usa el scope del token). */
  @Input() idCongregacion: number | null = null;
  @Input() visible = false;

  @Output() closed   = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

  // ── State ──────────────────────────────────────────────────────────────────
  phase             = signal<Phase>('select');
  selectedFileName  = signal<string | null>(null);
  isDragOver        = signal(false);
  errorMsg          = signal<string | null>(null);
  analisisResumen   = signal<any | null>(null);
  conflictos        = signal<ConflictoFila[]>([]);
  resoluciones      = signal<Record<string, Resolucion>>({});
  finalResult       = signal<any | null>(null);

  private pendingFile: File | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && !changes['visible'].currentValue) {
      this.resetAll();
    }
  }

  // ── Labels ─────────────────────────────────────────────────────────────────
  phaseLabel(): string {
    switch (this.phase()) {
      case 'select':    return 'Selecciona el archivo Excel';
      case 'analyzing': return 'Analizando archivo…';
      case 'review':    return `Revisa ${this.conflictos().length} conflicto(s)`;
      case 'importing': return 'Aplicando cambios…';
      case 'done':      return 'Importación completada';
    }
  }

  tipoLabel(tipo: ConflictoFila['tipo']): string {
    return TIPO_LABEL[tipo] ?? tipo;
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  onDragOver(e: DragEvent) {
    e.preventDefault(); e.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(e: DragEvent) {
    e.preventDefault(); e.stopPropagation();
    this.isDragOver.set(false);
  }

  onFileDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation();
    this.isDragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.handleFile(file);
  }

  private handleFile(file: File) {
    this.errorMsg.set(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xls') && !name.endsWith('.xlsx')) {
      this.errorMsg.set('Formato no soportado. Solo se aceptan archivos .xls o .xlsx');
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 5) {
      this.errorMsg.set(`El archivo excede 5 MB (${sizeMB.toFixed(2)} MB).`);
      return;
    }
    this.pendingFile = file;
    this.selectedFileName.set(file.name);
    this.analyzeFile(file);
  }

  // ── Fase 1: Analizar ───────────────────────────────────────────────────────
  private analyzeFile(file: File) {
    this.phase.set('analyzing');
    const formData = new FormData();
    formData.append('archivo', file);

    const url = this.buildUrl('/import/congregaciones/analizar');
    this.http.post<any>(url, formData).subscribe({
      next: (res) => {
        const resumen = res.resumen;
        this.analisisResumen.set(resumen);
        const conflictos: ConflictoFila[] = resumen.conflictos ?? [];
        this.conflictos.set(conflictos);
        this.resoluciones.set({});

        if (conflictos.length === 0) {
          // Sin conflictos: aplicar directamente
          this.applyImport(file, {});
        } else {
          this.phase.set('review');
        }
      },
      error: (err) => {
        this.errorMsg.set(err.error?.detail || err.message || 'Error inesperado al analizar el archivo.');
        this.phase.set('select');
      },
    });
  }

  // ── Fase 2: Confirmar ──────────────────────────────────────────────────────
  confirmar() {
    if (!this.pendingFile || !this.todosResueltos()) return;
    this.applyImport(this.pendingFile, this.resoluciones());
  }

  private applyImport(file: File, resoluciones: Record<number, Resolucion>) {
    this.phase.set('importing');
    const formData = new FormData();
    formData.append('archivo', file);
    if (Object.keys(resoluciones).length > 0) {
      formData.append('resoluciones', JSON.stringify(resoluciones));
    }

    const url = this.buildUrl('/import/congregaciones');
    this.http.post<any>(url, formData).subscribe({
      next: (res) => {
        this.finalResult.set(res);
        this.phase.set('done');
        this.imported.emit();
        const r = res?.resumen;
        const partes: string[] = [];
        if (r?.insertados)   partes.push(`${r.insertados} insertado${r.insertados !== 1 ? 's' : ''}`);
        if (r?.actualizados) partes.push(`${r.actualizados} actualizado${r.actualizados !== 1 ? 's' : ''}`);
        if (r?.descartados)  partes.push(`${r.descartados} descartado${r.descartados !== 1 ? 's' : ''}`);
        if (r?.conflictos_pendientes) partes.push(`${r.conflictos_pendientes} omitido${r.conflictos_pendientes !== 1 ? 's' : ''} sin resolución`);
        this.toast.success(
          'Importación completada',
          partes.length ? partes.join(' · ') : 'Sin cambios detectados',
          6000,
        );
      },
      error: (err) => {
        const msg = err.error?.detail || err.message || 'Error inesperado al importar.';
        this.errorMsg.set(msg);
        this.phase.set('select');
        this.toast.error('Error en la importación', msg, 6000);
      },
    });
  }

  private buildUrl(path: string): string {
    const base = `${environment.apiUrl}${path}`;
    return this.idCongregacion != null
      ? `${base}?id_congregacion=${this.idCongregacion}`
      : base;
  }

  // ── Resoluciones ───────────────────────────────────────────────────────────

  /** Clave de resolución para conflictos de identidad de publicador. */
  private idKey(fila: number): string { return String(fila); }
  /** Clave de resolución para conflictos de privilegios. */
  privKey(fila: number): string { return `priv_${fila}`; }
  /** Clave de resolución para conflictos de sexo en privilegios. */
  sexKey(fila: number): string { return `sex_${fila}`; }

  setResolucion(key: string | number, accion: ResolucionAccion, idPublicador?: number) {
    this.resoluciones.update((prev) => ({
      ...prev,
      [String(key)]: { accion, id_publicador: idPublicador ?? null },
    }));
  }

  isSelected(key: string | number, accion: ResolucionAccion, idPublicador?: number): boolean {
    const r = this.resoluciones()[String(key)];
    if (!r || r.accion !== accion) return false;
    if (accion === 'actualizar') return r.id_publicador === (idPublicador ?? null);
    return true;
  }

  resolucionesCount(): number {
    return Object.keys(this.resoluciones()).length;
  }

  todosResueltos(): boolean {
    return this.resolucionesCount() >= this.conflictos().length;
  }

  // ── Navegación ─────────────────────────────────────────────────────────────
  resetToSelect() {
    this.pendingFile = null;
    this.selectedFileName.set(null);
    this.errorMsg.set(null);
    this.analisisResumen.set(null);
    this.conflictos.set([]);
    this.resoluciones.set({});
    this.phase.set('select');
  }

  private resetAll() {
    this.resetToSelect();
    this.finalResult.set(null);
  }

  close() {
    const wasImported = this.phase() === 'done';
    this.resetAll();
    this.closed.emit();
    if (wasImported) this.imported.emit();
  }

  onOverlayClick(e: MouseEvent) {
    if (this.phase() === 'analyzing' || this.phase() === 'importing') return;
    this.close();
  }

  // ── Plantilla vacía ────────────────────────────────────────────────────────
  downloadTemplate() {
    // Con congregación: descargar export completo (trae datos existentes o ID sugerido si está vacía).
    // Sin congregación: plantilla genérica en blanco.
    const url = this.idCongregacion != null
      ? `${environment.apiUrl}/export/congregacion/${this.idCongregacion}`
      : `${environment.apiUrl}/export/plantilla`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objUrl   = URL.createObjectURL(blob);
        const a        = document.createElement('a');
        a.href         = objUrl;
        a.download     = 'Plantilla_Importacion_GAC.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      },
      error: () => this.errorMsg.set('Error al descargar la plantilla.'),
    });
  }
}

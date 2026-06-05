import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TransferenciaService } from '../../services/transferencia.service';
import { Transferencia } from '../../models/transferencia.model';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { environment } from '../../../../../environments/environment';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; msg: string; }

interface PublicadorLite {
  id_publicador: number;
  primer_nombre: string;
  primer_apellido: string;
  segundo_apellido?: string | null;
  archivo_consentimiento?: string | null;
}

@Component({
  standalone: true,
  selector: 'app-transferencias',
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ── TOASTS ── -->
    <div class="toast-container fixed bottom-6 right-6 flex flex-col gap-2 z-[100] pointer-events-none w-max max-w-[90vw]" aria-live="polite" aria-atomic="false">
      <div *ngFor="let n of notifications()"
           [class]="n.type === 'success' ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200' :
                    n.type === 'error'   ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/80 text-red-800 dark:text-red-200' :
                    'border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/80 text-violet-800 dark:text-violet-200'"
           class="animate-fadeInUp flex items-center gap-3 p-3.5 rounded-xl border shadow-lg pointer-events-auto transition-all" role="alert">
        <span class="flex items-center justify-center w-5 h-5 shrink-0" aria-hidden="true">
          <svg *ngIf="n.type === 'success'" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <svg *ngIf="n.type === 'error'"   class="w-5 h-5 text-red-600 dark:text-red-400"     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <svg *ngIf="n.type === 'info'"    class="w-5 h-5 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </span>
        <span class="text-sm font-semibold leading-none">{{ n.msg }}</span>
        <button class="flex items-center justify-center w-6 h-6 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer" (click)="dismissToast(n.id)" aria-label="Cerrar notificación">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- ── PUB DROPDOWN PANEL (fuera del modal para evitar backdrop-filter containing block) ── -->
    <ng-container *ngIf="pubDropOpen()">
      <div class="pub-drop-backdrop" style="position:fixed;inset:0;z-index:9998" (click)="pubDropOpen.set(false)"></div>
      <div class="pub-dropdown-panel"
           style="position:fixed;z-index:9999"
           [style.top.px]="pubDropPos().top"
           [style.left.px]="pubDropPos().left"
           [style.width.px]="pubDropPos().width">
        <div class="pub-search-wrap">
          <svg class="pub-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="pub-search-input" type="text" placeholder="Buscar por nombre…"
                 [ngModel]="pubSearch()" (ngModelChange)="pubSearch.set($event)"
                 (click)="$event.stopPropagation()" autocomplete="off" />
          <button *ngIf="pubSearch()" type="button" class="pub-search-clear" (click)="pubSearch.set(''); $event.stopPropagation()" aria-label="Limpiar">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="pub-dropdown-list">
          <button *ngFor="let p of publicadoresBuscados()" type="button"
                  class="pub-dropdown-item"
                  [class.pub-dropdown-item--selected]="form.id_publicadores.includes(p.id_publicador)"
                  (click)="selectPub(p.id_publicador); $event.stopPropagation()">
            <span class="pub-item-avatar shrink-0">{{ inicialesPub(p) }}</span>
            <span class="pub-item-name">{{ p.primer_nombre }} {{ p.primer_apellido }}</span>
            <span *ngIf="!p.archivo_consentimiento" class="pub-item-badge">Sin consent.</span>
            <svg *ngIf="form.id_publicadores.includes(p.id_publicador)" class="pub-item-check ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          </button>
          <div *ngIf="publicadoresBuscados().length === 0" class="pub-dropdown-item pub-dropdown-item--placeholder">
            <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Sin resultados para "{{ pubSearch() }}"
          </div>
        </div>
      </div>
    </ng-container>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!-- MODAL WIZARD                                                  -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    <div *ngIf="creando()" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title"
         (click)="onOverlayClick($event)">

      <!-- Dialog card -->
      <div class="modal-dialog" (click)="$event.stopPropagation()">

        <!-- Progress bar — top of dialog -->
        <div class="modal-progress-track" role="presentation">
          <div class="modal-progress-fill" [style.width.%]="(wizardPaso() / 3) * 100"></div>
        </div>

        <!-- ── Dialog Header ── -->
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="wizard-step-icon" [class.wizard-step-icon--1]="wizardPaso() === 1" [class.wizard-step-icon--2]="wizardPaso() === 2" [class.wizard-step-icon--3]="wizardPaso() === 3">
              <svg *ngIf="wizardPaso() === 1" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <svg *ngIf="wizardPaso() === 2" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <svg *ngIf="wizardPaso() === 3" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </div>
            <div>
              <p class="modal-step-label">Paso {{ wizardPaso() }} de 3</p>
              <h2 id="modal-title" class="modal-title">
                {{ wizardPaso() === 1 ? '¿Quién se transfiere?' : wizardPaso() === 2 ? '¿A dónde va?' : 'Notas para la carta' }}
              </h2>
            </div>
          </div>
          <button (click)="cerrarWizard()" class="modal-close-btn" aria-label="Cerrar">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- ── Stepper ── -->
        <div class="modal-stepper" role="progressbar" [attr.aria-valuenow]="wizardPaso()" aria-valuemin="1" aria-valuemax="3">
          <div class="wizard-step" [class.wizard-step--active]="wizardPaso() === 1" [class.wizard-step--done]="wizardPaso() > 1">
            <div class="wizard-step__bubble">
              <svg *ngIf="wizardPaso() > 1" class="wizard-step__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
              <span *ngIf="wizardPaso() <= 1">1</span>
            </div>
            <span class="wizard-step__label">¿Quién?</span>
          </div>
          <div class="wizard-step-track"><div class="wizard-step-fill" [class.wizard-step-fill--done]="wizardPaso() > 1"></div></div>
          <div class="wizard-step" [class.wizard-step--active]="wizardPaso() === 2" [class.wizard-step--done]="wizardPaso() > 2">
            <div class="wizard-step__bubble">
              <svg *ngIf="wizardPaso() > 2" class="wizard-step__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
              <span *ngIf="wizardPaso() <= 2">2</span>
            </div>
            <span class="wizard-step__label">Destino</span>
          </div>
          <div class="wizard-step-track"><div class="wizard-step-fill" [class.wizard-step-fill--done]="wizardPaso() > 2"></div></div>
          <div class="wizard-step" [class.wizard-step--active]="wizardPaso() === 3">
            <div class="wizard-step__bubble"><span>3</span></div>
            <span class="wizard-step__label">Notas</span>
          </div>
        </div>

        <!-- ── Step content (scrollable) ── -->
        <div class="modal-body">
          <div [class]="'wizard-body wizard-body--' + wizardDir()">

            <!-- PASO 1 -->
            <div *ngIf="wizardPaso() === 1" class="wizard-step-content flex flex-col gap-5">
              <div class="wizard-help">
                <svg class="w-4 h-4 text-violet-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <p class="text-xs text-slate-600 dark:text-slate-400">Selecciona si es un publicador individual o una familia entera (hasta 3 miembros). Para una familia, agrega a cada miembro por separado.</p>
              </div>
              <div class="field-group" style="--field-i:0">
                <label class="form-label">Tipo de transferencia</label>
                <div class="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-full">
                  <button type="button" (click)="setTipoFamiliar(false)"
                          [class]="!form.es_familiar ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 font-semibold'"
                          class="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs rounded-lg transition-all cursor-pointer">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Individual
                  </button>
                  <button type="button" (click)="setTipoFamiliar(true)"
                          [class]="form.es_familiar ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm font-bold' : 'text-slate-500 dark:text-slate-400 font-semibold'"
                          class="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs rounded-lg transition-all cursor-pointer">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path stroke-linecap="round" stroke-linejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    Familiar (hasta 3)
                  </button>
                </div>
              </div>
              <div class="field-group" style="--field-i:1">
                <label class="form-label">
                  {{ form.es_familiar ? 'Miembros de la familia' : 'Publicador' }} <span class="text-red-500">*</span>
                </label>
                <div *ngIf="form.es_familiar && form.id_publicadores.length > 0" class="flex flex-wrap gap-1.5 mb-2">
                  <div *ngFor="let pid of form.id_publicadores; let i = index" class="miembro-chip">
                    <span class="pub-item-avatar" style="width:1.5rem;height:1.5rem;font-size:0.625rem">{{ iniciales(pid) }}</span>
                    <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">{{ nombrePublicador(pid) }}</span>
                    <span *ngIf="pubLacksConsent(pid)" class="pub-item-badge" style="font-size:0.55rem;padding:0.1rem 0.3rem">SC</span>
                    <button type="button" class="ml-0.5 text-slate-400 hover:text-red-500 transition cursor-pointer" (click)="quitarMiembro(i)" aria-label="Quitar miembro">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
                <div *ngIf="!form.es_familiar || form.id_publicadores.length < 3"
                     class="pub-dropdown" [class.pub-dropdown--open]="pubDropOpen()">
                  <button type="button" class="pub-dropdown-trigger" #pubTrigger (click)="openPubDrop(pubTrigger)">
                    @if (!form.es_familiar && form.id_publicadores[0]) {
                      <span class="pub-item-avatar shrink-0">{{ iniciales(form.id_publicadores[0]) }}</span>
                      <span class="pub-drop-name">{{ nombrePublicador(form.id_publicadores[0]) }}</span>
                      <span *ngIf="pubLacksConsent(form.id_publicadores[0])" class="pub-item-badge ml-1">Sin consent.</span>
                    } @else if (form.es_familiar) {
                      <span class="pub-drop-placeholder">Agregar miembro…</span>
                    } @else {
                      <span class="pub-drop-placeholder">Selecciona un publicador…</span>
                    }
                    <svg class="pub-drop-chevron ml-auto shrink-0" [class.rotate-180]="pubDropOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </div>
                <p *ngIf="form.es_familiar && form.id_publicadores.length >= 3" class="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Máximo 3 miembros. Quita uno para agregar otro.</p>
              </div>
              <div *ngIf="form.es_familiar && form.id_publicadores.length > 0" class="field-group animate-scale-in" style="--field-i:2">
                <label class="form-label">Nombre de la familia <span class="text-slate-400 font-normal">(opcional)</span></label>
                <input class="form-control" [(ngModel)]="form.etiqueta_familia" [placeholder]="sugerenciaEtiqueta() || 'Ej. Familia Narváez'" />
                <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Aparecerá en la lista y en el nombre del archivo ZIP.</p>
              </div>
              <div *ngIf="wizardFaltaConsentimiento()" class="consent-alert animate-scale-in">
                <svg class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span class="text-xs leading-normal">Uno o más publicadores <strong>no tienen consentimiento de privacidad firmado</strong>. Obtén la firma física antes de procesar (RGPD).</span>
              </div>
            </div>

            <!-- PASO 2 -->
            <div *ngIf="wizardPaso() === 2" class="wizard-step-content flex flex-col gap-5">
              <div class="wizard-help">
                <svg class="w-4 h-4 text-violet-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <p class="text-xs text-slate-600 dark:text-slate-400">Indica a qué congregación se transfieren y el correo del secretario destino para enviarle la documentación.</p>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="field-group" style="--field-i:0">
                  <label class="form-label">Congregación destino <span class="text-red-500">*</span></label>
                  <input class="form-control" [(ngModel)]="form.congregacion_destino" placeholder="Ej. Congregación Centro" />
                </div>
                <div class="field-group" style="--field-i:1">
                  <label class="form-label">Correo del secretario destino</label>
                  <input class="form-control" type="email" [(ngModel)]="form.correo_congregacion_destino" placeholder="secretario@congregacion.org" autocomplete="email" />
                </div>
              </div>
            </div>

            <!-- PASO 3 -->
            <div *ngIf="wizardPaso() === 3" class="wizard-step-content flex flex-col gap-5">
              <div class="wizard-help wizard-help--violet">
                <svg class="w-4 h-4 text-violet-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 21l5.096-.813 12.39-12.39-4.283-4.283-12.39 12.39zm0 0v-4.283L22.203 1.95a2.025 2.025 0 0 1 2.864 2.864L14.096 15.904h-4.283z"/></svg>
                <p class="text-xs text-slate-600 dark:text-slate-400">
                  <strong class="text-violet-700 dark:text-violet-300">Al crear, la IA redactará automáticamente la carta de presentación.</strong>
                  Escribe notas detalladas sobre {{ form.es_familiar ? 'los miembros' : 'el publicador' }} para que la carta sea más completa y personal.
                </p>
              </div>
              <div class="field-group" style="--field-i:0">
                <label class="form-label">Motivo de la transferencia</label>
                <input class="form-control" [(ngModel)]="form.motivo" placeholder="Ej. Cambio de residencia, trabajo, matrimonio..." />
              </div>
              <div class="field-group" style="--field-i:1">
                <label class="form-label flex justify-between items-center w-full">
                  <span>Notas para la carta de presentación <span class="text-red-500">*</span></span>
                  <span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Obligatorio</span>
                </label>
                <textarea rows="6" class="form-control"
                          [(ngModel)]="form.notas_para_carta"
                          [placeholder]="form.es_familiar
                            ? 'Describe a cada miembro: antigüedad, privilegios, fortalezas espirituales, por qué se transfieren…'
                            : 'Antigüedad en la congregación, privilegios (siervo ministerial, anciano, pionero), fortalezas espirituales, apoyo a las reuniones y ministerio, personalidad, situación familiar…'">
                </textarea>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Mientras más detalle incluyas, mejor y más completa será la carta redactada por IA.</p>
              </div>
            </div>

          </div>
        </div><!-- /modal-body -->

        <!-- ── Footer de navegación ── -->
        <div class="modal-footer">
          <button *ngIf="wizardPaso() > 1" type="button" (click)="wizardAnterior()"
                  class="btn-secondary cursor-pointer">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Atrás
          </button>
          <div class="wizard-dots" aria-hidden="true">
            <span class="wizard-dot" [class.wizard-dot--active]="wizardPaso() === 1" [class.wizard-dot--done]="wizardPaso() > 1"></span>
            <span class="wizard-dot" [class.wizard-dot--active]="wizardPaso() === 2" [class.wizard-dot--done]="wizardPaso() > 2"></span>
            <span class="wizard-dot" [class.wizard-dot--active]="wizardPaso() === 3"></span>
          </div>
          <button *ngIf="wizardPaso() < 3" type="button"
                  [disabled]="!wizardPasoValido()"
                  (click)="wizardSiguiente()"
                  class="btn-wizard-next cursor-pointer">
            Siguiente
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button *ngIf="wizardPaso() === 3" type="button"
                  [disabled]="!form.notas_para_carta.trim() || creandoTransferencia()"
                  (click)="crear()"
                  class="btn-wizard-create cursor-pointer">
            <span *ngIf="!creandoTransferencia()" class="flex items-center gap-2">
              <svg class="w-4 h-4 text-purple-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 21l5.096-.813 12.39-12.39-4.283-4.283-12.39 12.39zm0 0v-4.283L22.203 1.95a2.025 2.025 0 0 1 2.864 2.864L14.096 15.904h-4.283z"/></svg>
              Crear y redactar carta
            </span>
            <span *ngIf="creandoTransferencia()" class="flex items-center gap-2">
              <span class="wizard-create-spinner"></span>
              {{ creandoFase() }}
            </span>
          </button>
        </div>

      </div><!-- /modal-dialog -->
    </div>
    <!-- /MODAL WIZARD -->

    <div class="h-full flex flex-col overflow-hidden">
    <div class="flex-1 flex flex-col m-1 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 min-h-0">

      <!-- ── HEADER ── -->
      <header class="hero-grad text-white shrink-0">
        <div class="relative z-10 px-4 sm:px-6 lg:px-10 py-4 sm:py-5 hero-inner">
          <div>
            <div class="hero-eyebrow">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4"/></svg>
              <span>Módulo Secretario</span>
            </div>
            <h1 class="hero-title">Transferencias</h1>
            <p class="hero-desc">Gestiona y genera la documentación cuando un publicador se transfiere de congregación.</p>
          </div>
          <button (click)="abrirWizard()" class="btn-hero group hero-btn-desktop" type="button">
            <svg class="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
            <span>Nueva transferencia</span>
          </button>
        </div>
      </header>

      <!-- ── BODY ── -->
      <div class="flex-1 px-4 pt-4 pb-4 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col gap-4">

        <!-- ── WORKSPACE: lista + detalle ── -->
        <div class="workspace flex-1 min-h-0"
             [class.workspace--with-detail]="seleccionada()"
             [class.workspace--mobile-detail]="mobileView() === 'detalle'">

          <!-- ── LIST PANEL ── -->
          <section class="card list-panel overflow-hidden flex flex-col">
            <div class="list-panel__head flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 gap-3 flex-wrap">
              <h2 class="font-display font-bold text-base text-slate-800 dark:text-slate-200 leading-none">Transferencias</h2>
              <!-- Filter pills -->
              <div class="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl shrink-0">
                <button (click)="filtro.set('todos')" class="filter-pill" [class.filter-pill--active]="filtro() === 'todos'" type="button">
                  Todos <span class="filter-count">{{ items().length }}</span>
                </button>
                <button (click)="filtro.set('borrador')" class="filter-pill" [class.filter-pill--active]="filtro() === 'borrador'" type="button">
                  Borradores <span class="filter-count filter-count--warn">{{ countBorradores() }}</span>
                </button>
                <button (click)="filtro.set('finalizada')" class="filter-pill" [class.filter-pill--active]="filtro() === 'finalizada'" type="button">
                  Finalizadas <span class="filter-count filter-count--ok">{{ countFinalizadas() }}</span>
                </button>
              </div>
            </div>

            <!-- Desktop table -->
            <div class="hidden md:flex md:flex-col flex-1 min-h-0">
            <div class="flex-1 overflow-y-auto overflow-x-auto min-h-0">
              <table class="w-full border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-slate-100 dark:border-slate-800">
                    <th class="px-5 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" scope="col">Publicador</th>
                    <th class="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" scope="col">Destino</th>
                    <th class="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" scope="col">Estado</th>
                    <th class="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" scope="col">Carta IA</th>
                    <th class="px-4 py-3 w-8" scope="col" aria-label="Acciones"></th>
                  </tr>
                </thead>
                <tbody>
                  @if (loading()) {
                    @for (sk of [1,2,3]; track sk) {
                      <tr class="border-b border-slate-100 dark:border-slate-800/60">
                        <td class="px-5 py-3.5"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0"></div><div class="flex flex-col gap-1.5"><div class="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div><div class="h-2 w-16 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse"></div></div></div></td>
                        <td class="px-4 py-3.5"><div class="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div></td>
                        <td class="px-4 py-3.5"><div class="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div></td>
                        <td class="px-4 py-3.5"><div class="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div></td>
                        <td></td>
                      </tr>
                    }
                  }
                  <tr *ngFor="let t of itemsFiltrados(); let idx = index"
                      (click)="abrir(t)"
                      [class.list-row--selected]="seleccionada()?.id_transferencia === t.id_transferencia"
                      class="stagger-item list-row"
                      [style]="'--i: ' + idx">
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-bold font-display text-xs flex items-center justify-center shrink-0">
                          {{ t.es_familiar ? inicialEtiqueta(t) : iniciales(t.id_publicador) }}
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span class="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm leading-tight">{{ etiquetaTransferencia(t) }}</span>
                          <span class="text-[0.7rem] text-slate-400 dark:text-slate-500 truncate mt-0.5 leading-none">
                            <span *ngIf="t.es_familiar">{{ t.miembros.length || 1 }} miembros</span>
                            <span *ngIf="!t.es_familiar && t.motivo">{{ t.motivo }}</span>
                            <span *ngIf="!t.es_familiar && !t.motivo" class="italic">Sin motivo registrado</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3.5">
                      <div class="flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-slate-350 dark:text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span class="truncate max-w-[140px] text-sm font-medium text-slate-700 dark:text-slate-300 leading-none">{{ t.congregacion_destino || '—' }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3.5">
                      <span [class]="t.estado === 'borrador' ? 'badge-warning' : 'badge-active'" class="text-[11px] px-2.5 py-1 rounded-lg font-semibold leading-none">
                        {{ t.estado === 'borrador' ? 'Borrador' : 'Finalizada' }}
                      </span>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="carta-badge" [class.carta-badge--done]="t.carta_redactada" [class.carta-badge--pending]="!t.carta_redactada">
                        <svg *ngIf="t.carta_redactada"  class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                        <svg *ngIf="!t.carta_redactada" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 21l5.096-.813 12.39-12.39-4.283-4.283-12.39 12.39z"/></svg>
                        {{ t.carta_redactada ? 'Lista' : 'Pendiente' }}
                      </span>
                    </td>
                    <td class="px-4 py-3.5 text-right">
                      <svg class="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-violet-400 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </td>
                  </tr>
                  <tr *ngIf="!loading() && itemsFiltrados().length === 0" class="empty-state-row">
                    <td colspan="5" class="empty-state-cell">
                      <div class="empty-state">
                        <!-- Ilustración -->
                        <div class="empty-state__illustration" aria-hidden="true">
                          <div class="empty-state__doc empty-state__doc--back"></div>
                          <div class="empty-state__doc empty-state__doc--front">
                            <svg class="w-5 h-5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4"/></svg>
                          </div>
                        </div>
                        <!-- Copy -->
                        <h3 class="empty-state__title">Todavía no hay transferencias registradas</h3>
                        <p class="empty-state__desc">Cuando un publicador cambia de congregación, crea una transferencia para generar la documentación oficial (carta de presentación + tarjeta de servicio).</p>
                        <!-- CTA -->
                        <button (click)="abrirWizard()" type="button" class="empty-state__cta">
                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                          Crear primera transferencia
                        </button>
                        <!-- Hint flecha apuntando al hero button (desktop) -->
                        <p class="empty-state__hint hidden md:block">
                          <svg class="inline w-3 h-3 mr-0.5 -rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                          O usa el botón <strong>+ Nueva transferencia</strong> del encabezado
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div><!-- /inner scroll -->
            </div><!-- /desktop table wrapper -->

            <!-- Mobile card list -->
            <div class="mobile-cards md:hidden flex flex-col gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/10">
              @if (loading()) {
                @for (sk of [1,2,3]; track sk) {
                  <div class="flex items-center gap-3 p-4 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <div class="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse shrink-0"></div>
                    <div class="flex-1 flex flex-col gap-2"><div class="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div><div class="h-2 w-20 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse"></div></div>
                  </div>
                }
              }
              <div *ngFor="let t of itemsFiltrados()"
                   (click)="abrir(t)"
                   [class.border-violet-500]="seleccionada()?.id_transferencia === t.id_transferencia"
                   [class.bg-violet-50/20]="seleccionada()?.id_transferencia === t.id_transferencia"
                   [class.dark:bg-violet-950/10]="seleccionada()?.id_transferencia === t.id_transferencia"
                   class="flex items-center gap-3 p-4 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer active:scale-[0.99] shadow-sm">
                <div class="avatar-initials w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-950/50 text-violet-750 dark:text-violet-350 font-bold font-display text-sm flex items-center justify-center shrink-0">
                  {{ t.es_familiar ? inicialEtiqueta(t) : iniciales(t.id_publicador) }}
                </div>
                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-slate-900 dark:text-slate-100 truncate text-sm leading-none">{{ etiquetaTransferencia(t) }}</span>
                    <span [class]="t.estado === 'borrador' ? 'badge-warning' : 'badge-active'" class="text-[10px] px-2 py-0.5 rounded-full leading-none font-semibold">
                      {{ t.estado === 'borrador' ? 'Borrador' : 'Finalizada' }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <svg class="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span class="truncate">{{ t.congregacion_destino }}</span>
                    <span *ngIf="t.es_familiar" class="text-slate-300 dark:text-slate-655">•</span>
                    <span *ngIf="t.es_familiar" class="truncate font-normal">{{ t.miembros.length || 1 }} miembros</span>
                  </div>
                </div>
                <div class="text-slate-300 dark:text-slate-650 shrink-0">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
              <div *ngIf="!loading() && itemsFiltrados().length === 0" class="empty-state" style="min-height: 320px">
                <div class="empty-state__illustration" aria-hidden="true">
                  <div class="empty-state__doc empty-state__doc--back"></div>
                  <div class="empty-state__doc empty-state__doc--front">
                    <svg class="w-5 h-5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4"/></svg>
                  </div>
                </div>
                <h3 class="empty-state__title">Sin transferencias registradas</h3>
                <p class="empty-state__desc">Cuando un publicador cambia de congregación, crea aquí su transferencia.</p>
                <button (click)="abrirWizard()" type="button" class="empty-state__cta">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  Crear transferencia
                </button>
              </div>
            </div>
          </section>

          <!-- ── DETAIL PANEL ── -->
          <aside *ngIf="seleccionada() as t" class="card p-5 detail-panel overflow-hidden flex flex-col">

            <!-- Mobile back button -->
            <button class="md:hidden flex items-center justify-center gap-1.5 w-full py-3 mb-4 text-sm font-semibold text-violet-650 dark:text-violet-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer" (click)="cerrarDetalle()">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
              Volver al listado
            </button>

            <!-- Inline delete confirmation -->
            <div *ngIf="confirmandoEliminar()" class="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl animate-scale-in" role="alertdialog" aria-labelledby="confirm-title">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-650 dark:text-red-400 flex items-center justify-center shrink-0" aria-hidden="true">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </div>
                <div class="flex flex-col gap-0.5">
                  <p id="confirm-title" class="text-sm font-bold text-red-855 dark:text-red-200">¿Eliminar esta transferencia?</p>
                  <p class="text-xs text-red-700/80 dark:text-red-400/90 leading-tight">Esta acción no se puede deshacer y borrará los registros permanentemente.</p>
                </div>
              </div>
              <div class="flex gap-2 shrink-0 self-end sm:self-center">
                <button class="btn-secondary px-3 py-1.5 text-xs h-9 min-h-0 cursor-pointer" (click)="confirmandoEliminar.set(false)">Cancelar</button>
                <button class="btn-ghost-danger px-3 py-1.5 text-xs bg-red-600 text-white hover:bg-red-700 border border-transparent font-bold h-9 min-h-0 cursor-pointer" (click)="confirmarEliminar()">Eliminar</button>
              </div>
            </div>

            <!-- Detail Header -->
            <header class="detail-head flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-3">
                <!-- Avatar familiar: avatares apilados -->
                <div *ngIf="t.es_familiar && t.miembros && t.miembros.length > 1" class="family-avatars shrink-0">
                  <div *ngFor="let m of t.miembros.slice(0,3); let i = index"
                       class="family-avatar" [style]="'z-index:' + (10 - i) + '; transform: translateX(' + (i * -6) + 'px)'">
                    {{ m.nombre_completo.charAt(0) }}{{ m.nombre_completo.split(' ').slice(-1)[0].charAt(0) }}
                  </div>
                </div>
                <!-- Avatar individual -->
                <div *ngIf="!t.es_familiar || !t.miembros || t.miembros.length <= 1"
                     class="avatar-initials w-11 h-11 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-bold font-display text-sm flex items-center justify-center shrink-0 shadow-md">
                  {{ iniciales(t.id_publicador) }}
                </div>
                <div class="min-w-0">
                  <h2 class="font-display font-bold text-lg text-slate-900 dark:text-white leading-tight truncate">{{ etiquetaTransferencia(t) }}</h2>
                  <div class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{{ t.es_familiar ? 'Familia' : 'Transferencia' }} a</span>
                    <strong class="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[130px]">{{ t.congregacion_destino }}</strong>
                  </div>
                </div>
              </div>
              <button (click)="cerrarDetalle()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer" aria-label="Cerrar detalle">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </header>

            <!-- Navigation Tabs -->
            <nav class="tab-nav mb-5 w-full flex justify-start gap-1 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl" role="tablist" aria-label="Secciones de la transferencia">
              <button (click)="activeTab.set('info')" [class]="activeTab() === 'info' ? 'tab-item-active bg-violet-600 text-white shadow-sm' : 'tab-item text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'" class="flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer" role="tab" [attr.aria-selected]="activeTab() === 'info'">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Info
              </button>
              <button (click)="activeTab.set('notas')" [class]="activeTab() === 'notas' ? 'tab-item-active bg-violet-600 text-white shadow-sm' : 'tab-item text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'" class="flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer relative" role="tab" [attr.aria-selected]="activeTab() === 'notas'">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                Notas
                <span *ngIf="!seleccionada()?.notas_para_carta && activeTab() !== 'notas'" class="tab-dot tab-dot--warn" aria-hidden="true"></span>
              </button>
              <button (click)="activeTab.set('carta')" [class]="activeTab() === 'carta' ? 'tab-item-active bg-violet-600 text-white shadow-sm' : 'tab-item text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'" class="flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer relative" role="tab" [attr.aria-selected]="activeTab() === 'carta'">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M13 3v6h6"/></svg>
                Carta
                <span *ngIf="!seleccionada()?.carta_redactada && activeTab() !== 'carta'" class="tab-dot tab-dot--warn" aria-hidden="true"></span>
              </button>
            </nav>

            <!-- Tab content wrapper — scrolls internally -->
            <div class="flex-1 min-h-0 overflow-y-auto pb-2">

            <!-- Tab 1: Info -->
            <div *ngIf="activeTab() === 'info'" class="flex flex-col gap-0 animate-scale-in detail-info-tab">

              <!-- ── Alerta de consentimiento ── -->
              <div *ngIf="selectedLacksConsent()" class="detail-alert detail-alert--warn mb-4">
                <svg class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <p class="text-xs font-bold leading-none mb-0.5">Sin consentimiento legal</p>
                  <p class="text-[0.68rem] leading-snug opacity-85">Uno o más miembros no tienen consentimiento firmado. Obtén la firma antes de procesar.</p>
                </div>
              </div>

              <!-- ── Sección 1: Resumen de estado ── -->
              <div class="detail-section">
                <p class="detail-section__label">Estado actual</p>
                <div class="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl w-full">
                  <button (click)="t.estado = 'borrador'"
                          [class]="t.estado === 'borrador' ? 'detail-estado-btn--active' : 'detail-estado-btn--idle'"
                          class="detail-estado-btn flex-1 cursor-pointer">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Borrador
                  </button>
                  <button (click)="t.estado = 'finalizada'"
                          [class]="t.estado === 'finalizada' ? 'detail-estado-btn--done' : 'detail-estado-btn--idle'"
                          class="detail-estado-btn flex-1 cursor-pointer">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Finalizada
                  </button>
                </div>
              </div>

              <!-- ── Sección 2: Miembros (familiar) ── -->
              <div *ngIf="t.es_familiar && t.miembros && t.miembros.length > 0" class="detail-section">
                <p class="detail-section__label">Miembros del grupo familiar</p>
                <div class="flex flex-col gap-1.5">
                  <div *ngFor="let m of t.miembros; let i = index"
                       class="detail-member-row">
                    <span class="detail-member-index">{{ i + 1 }}</span>
                    <div class="pub-item-avatar shrink-0" style="width:1.875rem;height:1.875rem;font-size:0.625rem">
                      {{ m.nombre_completo.charAt(0) }}{{ m.nombre_completo.split(' ').slice(-1)[0].charAt(0) }}
                    </div>
                    <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1 min-w-0 truncate">{{ m.nombre_completo }}</span>
                    <span *ngIf="m.falta_consentimiento" class="pub-item-badge shrink-0">SC</span>
                  </div>
                </div>
              </div>

              <!-- ── Sección 3: Destino ── -->
              <div class="detail-section">
                <p class="detail-section__label">Congregación de destino</p>
                <div class="flex flex-col gap-3">
                  <div class="field-group" style="margin:0">
                    <label class="form-label">
                      <svg class="w-3 h-3 text-slate-400 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      Nombre de la congregación <span class="text-red-500">*</span>
                    </label>
                    <input class="form-control" [(ngModel)]="t.congregacion_destino" placeholder="Ej. Congregación Centro" />
                  </div>
                  <div class="field-group" style="margin:0">
                    <label class="form-label">
                      <svg class="w-3 h-3 text-slate-400 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Correo del secretario destino
                    </label>
                    <input class="form-control" type="email" [(ngModel)]="t.correo_congregacion_destino" placeholder="secretario@congregacion.org" autocomplete="off" />
                  </div>
                </div>
              </div>

              <!-- ── Sección 4: Datos adicionales ── -->
              <div class="detail-section">
                <p class="detail-section__label">Datos adicionales</p>
                <div class="flex flex-col gap-3">
                  <div class="field-group" style="margin:0">
                    <label class="form-label">Motivo</label>
                    <input class="form-control" [(ngModel)]="t.motivo" placeholder="Cambio de residencia, trabajo, matrimonio…" />
                  </div>
                  <div class="field-group" style="margin:0">
                    <label class="form-label">Fecha de transferencia</label>
                    <input class="form-control" type="date" [(ngModel)]="t.fecha_transferencia" />
                  </div>
                </div>
              </div>

              <!-- ── Acciones ── -->
              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 mt-1">
                <button (click)="guardarTodo()" [disabled]="guardandoTodo()"
                        class="btn-primary-violet w-full h-10 min-h-0 text-xs justify-center font-bold shadow-md cursor-pointer">
                  <span *ngIf="!guardandoTodo()" class="flex items-center gap-1.5 justify-center">
                    <svg class="w-3.5 h-3.5 text-purple-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                    Guardar cambios
                  </span>
                  <span *ngIf="guardandoTodo()" class="flex items-center gap-1.5 justify-center">
                    <span class="spinner spinner-xs text-white"></span> Guardando…
                  </span>
                </button>
                <button (click)="confirmandoEliminar.set(true)"
                        class="btn-ghost-danger w-full h-9 min-h-0 text-xs mt-2 cursor-pointer justify-center">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  Eliminar transferencia
                </button>
              </div>
            </div>

            <!-- Tab 2: Notas -->
            <div *ngIf="activeTab() === 'notas'" class="flex flex-col gap-4 animate-scale-in">
              <div class="field-group">
                <label class="form-label flex justify-between items-center w-full">
                  <span>Notas sobre {{ t.es_familiar ? 'los miembros' : 'el publicador' }}</span>
                  <span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Base para la carta</span>
                </label>
                <textarea rows="7" class="form-control text-sm leading-relaxed" [(ngModel)]="t.notas_para_carta"
                          [placeholder]="t.es_familiar ? 'Describe a cada miembro de la familia: antigüedad, privilegios, fortalezas espirituales, por qué se transfieren...' : 'Describe las fortalezas espirituales del publicador: antigüedad, privilegios, personalidad, apoyo a las reuniones y ministerio...'"></textarea>
              </div>
              <div class="flex flex-col sm:flex-row gap-2 mt-2">
                <button (click)="guardarNotas()" [disabled]="guardandoNotas()" class="btn-secondary flex-1 h-10 min-h-0 text-xs justify-center cursor-pointer">
                  <span *ngIf="!guardandoNotas()" class="flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                    Guardar notas
                  </span>
                  <span *ngIf="guardandoNotas()" class="flex items-center gap-1.5"><span class="spinner spinner-xs text-slate-700 dark:text-slate-200"></span> Guardando…</span>
                </button>
                <button (click)="redactarCarta()" [disabled]="redactando() || !t.notas_para_carta" class="btn-primary-violet flex-1 font-bold shadow-md h-10 min-h-0 text-xs justify-center cursor-pointer" [title]="!t.notas_para_carta ? 'Añade notas primero' : ''">
                  <span *ngIf="!redactando()" class="flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-purple-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 21l5.096-.813 12.39-12.39-4.283-4.283-12.39 12.39zm0 0v-4.283L22.203 1.95a2.025 2.025 0 0 1 2.864 2.864L14.096 15.904h-4.283z"/></svg>
                    Redactar con IA
                  </span>
                  <span *ngIf="redactando()" class="flex items-center gap-1.5"><span class="spinner spinner-xs text-white"></span> Redactando…</span>
                </button>
              </div>
              <div *ngIf="redactando()" class="mt-4 p-4 rounded-xl bg-violet-50/70 dark:bg-violet-950/10 border border-violet-100 dark:border-violet-900/30 flex flex-col gap-3 animate-pulse">
                <div class="flex items-center gap-2.5">
                  <span class="spinner spinner-sm text-violet-650 dark:text-violet-400"></span>
                  <span class="text-xs font-bold text-violet-850 dark:text-violet-300">Asistente IA escribiendo la carta...</span>
                </div>
                <div class="w-full bg-violet-100 dark:bg-violet-900/50 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-violet-650 dark:bg-violet-400 h-full w-2/3 rounded-full animate-progress-fast"></div>
                </div>
                <span class="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  Redactando carta de presentación con tono formal y respetuoso. Al terminar, la pestaña "Carta" se abrirá automáticamente.
                </span>
              </div>
            </div>

            <!-- Tab 3: Carta -->
            <div *ngIf="activeTab() === 'carta'" class="flex flex-col gap-4 animate-scale-in">
              <div class="field-group">
                <div class="flex justify-between items-center w-full mb-1">
                  <label class="form-label mb-0">Carta redactada</label>
                  <button *ngIf="t.carta_redactada" (click)="copiarCarta(t.carta_redactada!)" class="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-750 flex items-center gap-1 bg-violet-50 dark:bg-violet-950/40 px-2 py-1 rounded-md border border-violet-100 dark:border-violet-900/20 transition cursor-pointer">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copiar texto
                  </button>
                </div>
                <textarea rows="9" class="form-control font-mono text-[11px] leading-relaxed select-all" [(ngModel)]="t.carta_redactada"
                          placeholder="El texto de la carta aparecerá aquí una vez redactado por IA. Puedes revisarlo y editarlo."></textarea>
              </div>
              <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button (click)="guardarTodo()" [disabled]="guardandoTodo()" class="btn-secondary px-3 py-2 text-xs h-9 min-h-0 cursor-pointer">
                  <span *ngIf="!guardandoTodo()" class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                    Guardar
                  </span>
                  <span *ngIf="guardandoTodo()" class="flex items-center gap-1.5"><span class="spinner spinner-xs text-slate-700 dark:text-slate-200"></span>…</span>
                </button>
                <button (click)="generarPaquete()" [disabled]="!t.carta_redactada || generando()" class="btn-primary-violet flex-1 font-bold shadow-md text-xs h-9 min-h-0 justify-center cursor-pointer">
                  <span *ngIf="!generando()" class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-purple-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Descargar ZIP
                  </span>
                  <span *ngIf="generando()" class="flex items-center gap-1.5"><span class="spinner spinner-xs text-white"></span> Generando…</span>
                </button>
              </div>
            </div>

            </div><!-- /tab content scroll wrapper -->

          </aside>
        </div><!-- /workspace -->
      </div><!-- /body -->
    </div><!-- /rounded wrapper -->
    </div><!-- /outer -->
  `,
  styles: [`
    :host { display: block; height: 100%; }

    /* ── Hero ── */
    .hero-grad {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 60%, #a855f7 100%);
      box-shadow: 0 6px 20px -6px rgba(109,40,217,0.4);
    }
    .hero-eyebrow {
      display: flex; align-items: center; gap: 0.375rem;
      color: rgba(196,181,253,0.9); font-size: 0.6rem; text-transform: uppercase;
      letter-spacing: 0.18em; font-weight: 600; margin-bottom: 0.25rem;
    }
    .hero-title  { font-size: 1.375rem; font-weight: 800; line-height: 1.15; color: #fff; letter-spacing: -0.02em; }
    .hero-desc   { color: rgba(237,233,254,0.65); font-size: 0.75rem; margin-top: 0.125rem; line-height: 1.35; }
    @media (min-width: 1024px) { .hero-title { font-size: 1.5rem; } }
    .hero-inner  { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 1.5rem; }
    .hero-btn-desktop { display: none; }
    @media (min-width: 768px) { .hero-btn-desktop { display: inline-flex; } }
    @media (max-width: 767px) { .hero-desc { display: none; } }
    @media (max-width: 479px) { .hero-eyebrow { display: none; } .hero-title { font-size: 1.25rem; } }

    /* ══════════════════════════════════════════════════════════
       MODAL OVERLAY
       ══════════════════════════════════════════════════════════ */

    @keyframes overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes dialogIn {
      from { opacity: 0; transform: translateY(20px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .modal-overlay {
      position: fixed; inset: 0; z-index: 200;
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      background: rgba(15, 10, 30, 0.6);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      animation: overlayIn 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .modal-dialog {
      position: relative;
      display: flex; flex-direction: column;
      width: 100%; max-width: 540px;
      max-height: calc(100dvh - 2rem);
      background: #fff;
      border-radius: 1.25rem;
      box-shadow: 0 32px 80px -12px rgba(0,0,0,0.28), 0 8px 24px -4px rgba(0,0,0,0.12);
      overflow: hidden;
      animation: dialogIn 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    :host-context(.dark) .modal-dialog {
      background: #12172a;
      box-shadow: 0 32px 80px -12px rgba(0,0,0,0.6), 0 8px 24px -4px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,58,237,0.12);
    }

    /* Progress bar */
    .modal-progress-track {
      position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: rgba(124,58,237,0.1); z-index: 1;
    }
    .modal-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #7c3aed, #a855f7);
      transition: width 380ms cubic-bezier(0.22, 1, 0.36, 1);
      border-radius: 0 2px 2px 0;
    }

    /* Header */
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.375rem 1.5rem 0;
      flex-shrink: 0;
    }
    .modal-step-label {
      font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.15em; color: #7c3aed; line-height: 1; margin-bottom: 0.2rem;
    }
    :host-context(.dark) .modal-step-label { color: #a78bfa; }
    .modal-title {
      font-family: var(--font-display, inherit);
      font-size: 1.0625rem; font-weight: 800; color: #0f172a; line-height: 1.2;
    }
    :host-context(.dark) .modal-title { color: #f1f5f9; }
    .modal-close-btn {
      display: flex; align-items: center; justify-content: center;
      width: 2rem; height: 2rem; border-radius: 0.5rem; border: none; cursor: pointer;
      color: #94a3b8; background: transparent; flex-shrink: 0;
      transition: color 130ms ease, background 130ms ease;
    }
    .modal-close-btn:hover { color: #64748b; background: #f1f5f9; }
    :host-context(.dark) .modal-close-btn:hover { color: #cbd5e1; background: rgba(255,255,255,0.07); }

    /* Stepper inside modal */
    .modal-stepper {
      display: flex; align-items: flex-start;
      padding: 1rem 1.5rem 0;
      flex-shrink: 0;
    }

    /* Scrollable step content */
    .modal-body {
      flex: 1; min-height: 0; overflow-y: auto;
      padding: 1.25rem 1.5rem;
    }

    /* Footer */
    .modal-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.5rem;
      border-top: 1px solid #f1f5f9;
      background: #fafafa;
      flex-shrink: 0;
    }
    :host-context(.dark) .modal-footer {
      border-top-color: rgba(51,65,85,0.5);
      background: rgba(15,23,42,0.6);
    }

    /* Mobile: full height modal */
    @media (max-width: 479px) {
      .modal-overlay { padding: 0; align-items: flex-end; }
      .modal-dialog  { max-width: 100%; border-radius: 1.25rem 1.25rem 0 0; max-height: 92dvh; }
    }

    /* ══════════════════════════════════════════════════════════
       WIZARD — Animations & Visual Design
       ══════════════════════════════════════════════════════════ */

    /* ── Keyframes ── */
    @keyframes wizardSlideUp {
      from { opacity: 0; transform: translateY(18px) scale(0.985); }
      to   { opacity: 1; transform: translateY(0)    scale(1); }
    }
    @keyframes stepEnterForward {
      from { opacity: 0; transform: translateX(28px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes stepEnterBack {
      from { opacity: 0; transform: translateX(-28px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes fieldStagger {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes stepBubbleComplete {
      0%   { transform: scale(1); }
      45%  { transform: scale(1.3); box-shadow: 0 0 0 6px rgba(124,58,237,0.15); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(124,58,237,0); }
    }
    @keyframes checkDraw {
      from { stroke-dashoffset: 20; opacity: 0; }
      to   { stroke-dashoffset: 0;  opacity: 1; }
    }
    @keyframes progressFill {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }
    @keyframes spinnerRing {
      to { transform: rotate(360deg); }
    }
    @keyframes iconPop {
      0%   { transform: scale(0.6) rotate(-10deg); opacity: 0; }
      70%  { transform: scale(1.12) rotate(3deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); }
    }

    /* Scrollable content area */
    .wizard-body {
      flex: 1;
      min-height: 0;
    }

    /* ── Top progress bar ── */
    .wizard-progress-bar {
      position: absolute; top: 0; left: 0;
      height: 3px; background: linear-gradient(90deg, #7c3aed, #a855f7);
      border-radius: 0 2px 0 0;
      transition: width 380ms cubic-bezier(0.22, 1, 0.36, 1);
      transform-origin: left;
    }

    /* ── Step icon in header ── */
    .wizard-step-icon {
      width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      animation: iconPop 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .wizard-step-icon--1 { background: #ede9fe; color: #6d28d9; }
    .wizard-step-icon--2 { background: #dbeafe; color: #1d4ed8; }
    .wizard-step-icon--3 { background: #f0fdf4; color: #15803d; }
    :host-context(.dark) .wizard-step-icon--1 { background: rgba(109,40,217,0.2); color: #c4b5fd; }
    :host-context(.dark) .wizard-step-icon--2 { background: rgba(29,78,216,0.2);  color: #93c5fd; }
    :host-context(.dark) .wizard-step-icon--3 { background: rgba(21,128,61,0.2);  color: #86efac; }

    /* ── Stepper ── */
    .wizard-steps {
      display: flex; align-items: flex-start; gap: 0;
      padding: 0 0.25rem;
    }
    .wizard-step {
      display: flex; flex-direction: column; align-items: center;
      gap: 0.3rem; flex: none; min-width: 0;
    }
    .wizard-step__bubble {
      width: 1.875rem; height: 1.875rem; border-radius: 50%;
      border: 2px solid #e2e8f0; background: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.7rem; font-weight: 700; color: #94a3b8;
      transition: border-color 250ms ease, background 250ms ease,
                  color 250ms ease, box-shadow 250ms ease;
      flex-shrink: 0;
    }
    .wizard-step__label {
      font-size: 0.6rem; font-weight: 600; color: #94a3b8; white-space: nowrap;
      transition: color 250ms ease;
    }
    .wizard-step--active .wizard-step__bubble {
      border-color: #7c3aed; color: #7c3aed; background: #f5f3ff;
      box-shadow: 0 0 0 4px rgba(124,58,237,0.1);
    }
    .wizard-step--active .wizard-step__label { color: #6d28d9; font-weight: 700; }
    .wizard-step--done   .wizard-step__bubble {
      border-color: #7c3aed; background: #7c3aed; color: #fff;
      animation: stepBubbleComplete 450ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .wizard-step--done   .wizard-step__label { color: #7c3aed; }

    /* Checkmark SVG animation */
    .wizard-step__check {
      width: 0.8rem; height: 0.8rem;
      stroke-dasharray: 20; stroke-dashoffset: 20;
      animation: checkDraw 350ms cubic-bezier(0.22, 1, 0.36, 1) 180ms forwards;
    }

    /* Connector track + fill */
    .wizard-step-track {
      flex: 1; height: 2px; background: #e2e8f0;
      margin: 0 0.25rem; margin-bottom: 1.4rem;
      overflow: hidden; border-radius: 2px; min-width: 0;
    }
    .wizard-step-fill {
      height: 100%; width: 100%;
      background: linear-gradient(90deg, #7c3aed, #a855f7);
      transform: scaleX(0); transform-origin: left;
      transition: transform 400ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .wizard-step-fill--done { transform: scaleX(1); }

    :host-context(.dark) .wizard-step__bubble  { background: #1e293b; border-color: #334155; color: #64748b; }
    :host-context(.dark) .wizard-step--active .wizard-step__bubble { background: rgba(109,40,217,0.15); border-color: #7c3aed; color: #a78bfa; box-shadow: 0 0 0 4px rgba(124,58,237,0.12); }
    :host-context(.dark) .wizard-step--done .wizard-step__bubble   { background: #7c3aed; border-color: #7c3aed; color: #fff; }
    :host-context(.dark) .wizard-step-track { background: #334155; }

    /* ── Step content directional transitions ── */
    .wizard-body--forward .wizard-step-content {
      animation: stepEnterForward 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .wizard-body--back .wizard-step-content {
      animation: stepEnterBack 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    /* ── Field stagger within each step ── */
    .wizard-step-content .field-group,
    .wizard-step-content .wizard-help,
    .wizard-step-content .consent-alert {
      animation: fieldStagger 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: calc(var(--field-i, 0) * 55ms + 80ms);
    }
    .wizard-step-content .wizard-help { --field-i: -1; }
    .wizard-step-content .consent-alert { animation-delay: 220ms; }

    /* ── Wizard help box ── */
    .wizard-help {
      display: flex; align-items: flex-start; gap: 0.5rem;
      padding: 0.625rem 0.875rem; border-radius: 0.75rem;
      background: #f8fafc; border: 1px solid #e2e8f0;
    }
    .wizard-help--violet { background: #f5f3ff; border-color: #ddd6fe; }
    .consent-alert {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.875rem 1rem; border-radius: 0.75rem;
      background: #fffbeb; border: 1px solid #fde68a;
      color: #92400e;
    }
    :host-context(.dark) .wizard-help         { background: #1e293b; border-color: #334155; }
    :host-context(.dark) .wizard-help--violet { background: rgba(109,40,217,0.08); border-color: rgba(109,40,217,0.2); }
    :host-context(.dark) .consent-alert       { background: rgba(251,191,36,0.06); border-color: rgba(251,191,36,0.2); color: #fbbf24; }


    /* ── Wizard step dots ── */
    .wizard-dots { display: flex; align-items: center; gap: 0.375rem; }
    .wizard-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #e2e8f0;
      transition: all 250ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .wizard-dot--active { width: 18px; border-radius: 3px; background: #7c3aed; }
    .wizard-dot--done   { background: #7c3aed; opacity: 0.4; }
    :host-context(.dark) .wizard-dot { background: #334155; }
    :host-context(.dark) .wizard-dot--active { background: #7c3aed; }

    /* ── Wizard buttons ── */
    .btn-wizard-next {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.5rem 1.25rem; font-size: 0.8125rem; font-weight: 700;
      border-radius: 0.75rem; border: none; cursor: pointer;
      background: #7c3aed; color: #fff;
      box-shadow: 0 2px 8px rgba(109,40,217,0.35), 0 1px 2px rgba(0,0,0,0.1);
      transition: background 150ms ease, transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
    }
    .btn-wizard-next:hover:not(:disabled) {
      background: #6d28d9;
      box-shadow: 0 4px 16px rgba(109,40,217,0.45), 0 1px 2px rgba(0,0,0,0.1);
      transform: translateY(-1px);
    }
    .btn-wizard-next:active { transform: scale(0.97); }
    .btn-wizard-next:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }

    .btn-wizard-create {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5625rem 1.25rem; font-size: 0.8125rem; font-weight: 700;
      border-radius: 0.75rem; border: none; cursor: pointer;
      background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 60%, #9333ea 100%);
      color: #fff;
      box-shadow: 0 4px 16px rgba(109,40,217,0.4), 0 1px 2px rgba(0,0,0,0.15);
      transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
    }
    .btn-wizard-create:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(109,40,217,0.5), 0 2px 4px rgba(0,0,0,0.15);
    }
    .btn-wizard-create:active { transform: scale(0.97); }
    .btn-wizard-create:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }

    .wizard-create-spinner {
      width: 0.875rem; height: 0.875rem; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      animation: spinnerRing 0.7s linear infinite;
      display: inline-block;
    }

    /* ── Chips de miembros ── */
    .miembro-chip {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.25rem 0.5rem 0.25rem 0.25rem; border-radius: 0.625rem;
      background: #f5f3ff; border: 1px solid #ddd6fe;
      animation: fieldStagger 0.22s cubic-bezier(0.22,1,0.36,1) forwards;
    }
    :host-context(.dark) .miembro-chip { background: rgba(109,40,217,0.12); border-color: rgba(109,40,217,0.25); }

    /* ── Avatares apilados (familia en detalle) ── */
    .family-avatars {
      display: flex; align-items: center; position: relative;
      width: calc(44px + 2 * 6px); height: 44px;
    }
    .family-avatar {
      position: relative; width: 2.25rem; height: 2.25rem; border-radius: 0.625rem;
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: #fff; font-weight: 700; font-size: 0.6875rem;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 2px #fff;
    }
    :host-context(.dark) .family-avatar { box-shadow: 0 0 0 2px #1e293b; }

    /* ── Filter pills ── */
    .filter-pill {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.3125rem 0.625rem; font-size: 0.6875rem; font-weight: 600;
      border-radius: 0.5rem; cursor: pointer; transition: all 150ms ease;
      color: #64748b; white-space: nowrap;
    }
    .filter-pill--active { background: #fff; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); }
    :host-context(.dark) .filter-pill { color: #94a3b8; }
    :host-context(.dark) .filter-pill--active { background: #1e293b; color: #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    @media (hover: hover) { .filter-pill:not(.filter-pill--active):hover { background: rgba(255,255,255,0.6); color: #475569; } }
    .filter-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1.125rem; height: 1.125rem; padding: 0 0.25rem;
      background: #e2e8f0; color: #475569;
      border-radius: 0.375rem; font-size: 0.625rem; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .filter-count--warn { background: rgba(251,146,60,0.15); color: #c2410c; }
    .filter-count--ok   { background: rgba(16,185,129,0.12); color: #065f46; }
    :host-context(.dark) .filter-count { background: #334155; color: #94a3b8; }
    :host-context(.dark) .filter-count--warn { background: rgba(251,146,60,0.15); color: #fb923c; }
    :host-context(.dark) .filter-count--ok   { background: rgba(16,185,129,0.12); color: #34d399; }

    /* ── Tab dots ── */
    .tab-dot { position: absolute; top: 0.3rem; right: 0.3rem; width: 6px; height: 6px; border-radius: 50%; }
    .tab-dot--warn { background: #f59e0b; }

    /* ── Btn hero ── */
    .btn-hero {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.625rem 1.125rem; font-size: 0.8125rem; font-weight: 600;
      border-radius: 0.75rem; cursor: pointer; user-select: none;
      background: rgba(255,255,255,0.15); color: #fff;
      border: 1px solid rgba(255,255,255,0.30);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      text-shadow: 0 1px 2px rgba(0,0,0,0.15);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2);
      transition: transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
    }
    @media (hover: hover) and (pointer: fine) {
      .btn-hero:hover { background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.45); box-shadow: 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3); transform: translateY(-1px); }
    }
    .btn-hero:active { transform: scale(0.97); }

    /* ── Workspace ── */
    .workspace {
      display: grid; grid-template-columns: 1fr; gap: 1.25rem;
      align-items: start;
    }
    /* On desktop: workspace fills remaining height, panels stretch */
    @media (min-width: 1024px) {
      .workspace {
        align-items: stretch;
        height: 100%;
      }
      .workspace--with-detail { grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr); }
      /* List panel: fill and scroll table internally */
      .list-panel {
        height: 100%;
        overflow: hidden;
      }
      /* Detail panel: fill height, scroll content internally */
      .detail-panel {
        height: 100%;
        overflow: hidden;
      }
    }
    @media (max-width: 1023px) { .workspace--mobile-detail .list-panel { display: none; } }

    /* ── Stagger animation ── */
    .stagger-item {
      animation: staggerIn 0.36s cubic-bezier(0.23, 1, 0.32, 1) forwards;
      animation-delay: min(calc(var(--i, 0) * 28ms), 280ms);
      opacity: 0;
    }

    .toast-container { pointer-events: none; }
    textarea { resize: vertical; }

    /* ── Custom publisher dropdown ─────────────────────────── */
    .pub-dropdown { position: relative; }
    .pub-drop-backdrop { position: fixed; inset: 0; z-index: 40; }
    .pub-dropdown-trigger {
      width: 100%; display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.75rem; border-radius: 0.625rem; cursor: pointer;
      border: 1px solid #e2e8f0; background: #fff; text-align: left;
      font-size: 0.875rem; color: #1e293b; min-height: 2.5rem;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .pub-dropdown--open .pub-dropdown-trigger,
    .pub-dropdown-trigger:focus-visible { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); outline: none; }
    .pub-drop-name        { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e293b; }
    .pub-drop-placeholder { flex: 1; color: #94a3b8; font-size: 0.875rem; }
    .pub-drop-chevron     { width: 1rem; height: 1rem; color: #94a3b8; transition: transform 160ms cubic-bezier(0.23,1,0.32,1); }
    .pub-dropdown-panel {
      z-index: 9999;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 0.875rem;
      box-shadow: 0 8px 24px -4px rgba(0,0,0,0.12), 0 4px 8px -2px rgba(0,0,0,0.06);
      overflow: hidden;
      animation: staggerIn 0.18s cubic-bezier(0.23,1,0.32,1) forwards;
    }
    .pub-dropdown-item {
      width: 100%; display: flex; align-items: center; gap: 0.625rem;
      padding: 0.5rem 0.75rem; font-size: 0.8125rem; cursor: pointer; text-align: left;
      transition: background 100ms ease; color: #1e293b; border: none; background: transparent;
    }
    .pub-dropdown-item:hover { background: #f8fafc; }
    .pub-dropdown-item--selected { background: #f5f3ff; }
    .pub-dropdown-item--placeholder { color: #94a3b8; font-style: italic; font-size: 0.8rem; }
    .pub-item-avatar {
      width: 1.875rem; height: 1.875rem; border-radius: 0.4375rem;
      background: #ede9fe; color: #5b21b6; font-weight: 700; font-size: 0.6875rem;
      display: inline-flex; align-items: center; justify-content: center;
      font-family: var(--font-display, inherit);
    }
    .pub-item-name  { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Buscador dentro del panel */
    .pub-search-wrap {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      position: sticky; top: 0; background: #fff; z-index: 1;
    }
    .pub-search-icon { width: 0.875rem; height: 0.875rem; color: #94a3b8; shrink: 0; flex-shrink: 0; }
    .pub-search-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 0.8rem; color: #1e293b; padding: 0;
    }
    .pub-search-input::placeholder { color: #94a3b8; }
    .pub-search-clear {
      display: flex; align-items: center; justify-content: center;
      width: 1.25rem; height: 1.25rem; border-radius: 50%;
      background: #e2e8f0; color: #64748b; cursor: pointer; border: none;
      transition: background 100ms ease;
    }
    .pub-search-clear:hover { background: #cbd5e1; }
    .pub-dropdown-list { overflow-y: auto; max-height: 11rem; }

    :host-context(.dark) .pub-search-wrap { background: #1e293b; border-bottom-color: #334155; }
    :host-context(.dark) .pub-search-input { color: #f1f5f9; }
    :host-context(.dark) .pub-search-clear { background: #334155; color: #94a3b8; }
    :host-context(.dark) .pub-search-clear:hover { background: #475569; }

    .pub-item-badge {
      font-size: 0.625rem; font-weight: 600; padding: 0.1875rem 0.4rem;
      background: rgba(251,146,60,0.15); color: #c2410c; border-radius: 0.3125rem; white-space: nowrap;
    }
    .pub-item-check { width: 1rem; height: 1rem; color: #7c3aed; }
    :host-context(.dark) .pub-dropdown-trigger            { background: #0f172a; border-color: #334155; color: #f1f5f9; }
    :host-context(.dark) .pub-dropdown--open .pub-dropdown-trigger,
    :host-context(.dark) .pub-dropdown-trigger:focus-visible { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.18); }
    :host-context(.dark) .pub-drop-name        { color: #f1f5f9; }
    :host-context(.dark) .pub-dropdown-panel   { background: #1e293b; border-color: #334155; box-shadow: 0 8px 24px -4px rgba(0,0,0,0.4), 0 4px 8px -2px rgba(0,0,0,0.25); z-index: 9999; }
    :host-context(.dark) .pub-dropdown-item    { color: #f1f5f9; }
    :host-context(.dark) .pub-dropdown-item:hover { background: #334155; }
    :host-context(.dark) .pub-dropdown-item--selected { background: rgba(109,40,217,0.15); }
    :host-context(.dark) .pub-item-avatar { background: rgba(109,40,217,0.2); color: #c4b5fd; }
    :host-context(.dark) .pub-item-check  { color: #a78bfa; }
    /* ─────────────────────────────────────────────────────── */

    .empty-state-row { }
    .empty-state-cell { }
    .empty-state-cell .empty-state { min-height: 360px; }

    /* ── Empty state ─────────────────────────────────────────── */
    @keyframes emptyFloat {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-5px); }
    }
    @keyframes emptyFadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 3.5rem 1.5rem;
      text-align: center;
      animation: emptyFadeIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    /* Ilustración de documentos apilados */
    .empty-state__illustration {
      position: relative; width: 4rem; height: 4rem; margin-bottom: 1.25rem;
      animation: emptyFloat 3.5s ease-in-out infinite;
    }
    .empty-state__doc {
      position: absolute; border-radius: 0.625rem;
      display: flex; align-items: center; justify-content: center;
    }
    .empty-state__doc--back {
      width: 3rem; height: 3.5rem;
      background: #ddd6fe; top: 0.25rem; right: 0;
      transform: rotate(6deg);
    }
    .empty-state__doc--front {
      width: 3.25rem; height: 3.75rem;
      background: #ede9fe; top: 0; left: 0;
      box-shadow: 0 4px 12px rgba(109,40,217,0.2);
    }
    :host-context(.dark) .empty-state__doc--back  { background: rgba(109,40,217,0.15); }
    :host-context(.dark) .empty-state__doc--front { background: rgba(109,40,217,0.22); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }

    .empty-state__title {
      font-family: var(--font-display, inherit);
      font-weight: 700; font-size: 0.9375rem;
      color: #1e293b; margin-bottom: 0.375rem;
    }
    :host-context(.dark) .empty-state__title { color: #f1f5f9; }

    .empty-state__desc {
      font-size: 0.8rem; color: #64748b; max-width: 26rem; line-height: 1.55;
      margin-bottom: 1.25rem;
    }
    :host-context(.dark) .empty-state__desc { color: #94a3b8; }

    .empty-state__cta {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.625rem 1.25rem; border-radius: 0.75rem;
      font-size: 0.8125rem; font-weight: 700; cursor: pointer;
      background: #7c3aed; color: #fff; border: none;
      box-shadow: 0 4px 12px rgba(109,40,217,0.35);
      transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
    }
    .empty-state__cta:hover {
      background: #6d28d9;
      box-shadow: 0 6px 18px rgba(109,40,217,0.45);
      transform: translateY(-1px);
    }
    .empty-state__cta:active { transform: scale(0.97); }

    .empty-state__hint {
      margin-top: 0.75rem; font-size: 0.7rem; color: #94a3b8;
    }
    :host-context(.dark) .empty-state__hint { color: #475569; }
    /* ─────────────────────────────────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .stagger-item, .animate-scale-in, .animate-fadeInUp {
        animation: none !important; opacity: 1 !important; transform: none !important;
      }
      .empty-state__illustration { animation: none; }
      .empty-state { animation: none; opacity: 1; }
    }

    /* ── List rows ───────────────────────────────────────────── */
    .list-row {
      border-bottom: 1px solid #f1f5f9;
      transition: background 120ms ease;
      cursor: pointer;
    }
    .list-row:hover { background: rgba(124,58,237,0.04); }
    .list-row--selected { background: rgba(124,58,237,0.06) !important; }
    :host-context(.dark) .list-row { border-bottom-color: rgba(51,65,85,0.5); }
    :host-context(.dark) .list-row:hover { background: rgba(124,58,237,0.07); }
    :host-context(.dark) .list-row--selected { background: rgba(124,58,237,0.1) !important; }

    /* ── Carta badge ─────────────────────────────────────────── */
    .carta-badge {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.25rem 0.625rem; border-radius: 0.5rem;
      font-size: 0.6875rem; font-weight: 600; line-height: 1;
    }
    .carta-badge--done {
      background: rgba(16,185,129,0.1); color: #065f46;
    }
    .carta-badge--pending {
      background: rgba(148,163,184,0.12); color: #64748b;
    }
    :host-context(.dark) .carta-badge--done    { background: rgba(16,185,129,0.12); color: #34d399; }
    :host-context(.dark) .carta-badge--pending { background: rgba(51,65,85,0.5);   color: #64748b; }

    /* ── Detail Info Tab ──────────────────────────────────────── */

    /* Alerta de aviso (consent, etc.) */
    .detail-alert {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.75rem 0.875rem; border-radius: 0.75rem;
      font-size: 0.75rem;
    }
    .detail-alert--warn {
      background: #fffbeb; border: 1px solid #fde68a;
      color: #92400e;
    }
    :host-context(.dark) .detail-alert--warn {
      background: rgba(251,191,36,0.07); border-color: rgba(251,191,36,0.2); color: #fbbf24;
    }

    /* Secciones con etiqueta y contenido */
    .detail-section {
      padding: 1rem 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .detail-section:last-of-type {
      border-bottom: none;
    }
    :host-context(.dark) .detail-section { border-bottom-color: rgba(51,65,85,0.5); }

    .detail-section__label {
      font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 0.625rem;
    }
    :host-context(.dark) .detail-section__label { color: #64748b; }

    /* Estado toggle */
    .detail-estado-btn {
      display: flex; align-items: center; justify-content: center; gap: 0.375rem;
      padding: 0.5rem 0.75rem; font-size: 0.75rem; font-weight: 600;
      border-radius: 0.5rem; border: none; transition: all 150ms ease;
    }
    .detail-estado-btn--idle   { color: #64748b; }
    .detail-estado-btn--active { background: #fff; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: 700; }
    .detail-estado-btn--done   { background: #fff; color: #059669; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: 700; }
    :host-context(.dark) .detail-estado-btn--active { background: #334155; color: #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    :host-context(.dark) .detail-estado-btn--done   { background: #334155; color: #34d399; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }

    /* Fila de miembro en lista familiar */
    .detail-member-row {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.5rem 0.625rem; border-radius: 0.625rem;
      background: #f8fafc;
      transition: background 100ms ease;
    }
    :host-context(.dark) .detail-member-row { background: rgba(30,41,59,0.6); }

    .detail-member-index {
      font-size: 0.6rem; font-weight: 700; color: #94a3b8;
      width: 1rem; text-align: center; flex-shrink: 0;
    }
  `]
})
export class TransferenciasPage implements OnInit {
  private svc = inject(TransferenciaService);
  private http = inject(HttpClient);
  private ctx = inject(CongregacionContextService);

  // ── Datos ───────────────────────────────────────────────────
  items        = signal<Transferencia[]>([]);
  publicadores = signal<PublicadorLite[]>([]);
  loading      = signal(true);

  // ── Selección / detalle ─────────────────────────────────────
  seleccionada        = signal<Transferencia | null>(null);
  confirmandoEliminar = signal(false);
  mobileView          = signal<'lista' | 'detalle'>('lista');
  activeTab           = signal<'info' | 'notas' | 'carta'>('info');

  // ── Estados de operación ─────────────────────────────────────
  redactando     = signal(false);
  generando      = signal(false);
  guardandoNotas = signal(false);
  guardandoTodo  = signal(false);

  // ── Wizard ──────────────────────────────────────────────────
  creando             = signal(false);
  wizardPaso          = signal<1|2|3>(1);
  wizardDir           = signal<'forward' | 'back'>('forward');
  creandoTransferencia = signal(false);
  creandoFase         = signal('Creando…');
  pubDropOpen         = signal(false);
  pubDropPos          = signal<{top: number; left: number; width: number}>({top: 0, left: 0, width: 0});
  pubSearch           = signal('');

  // ── Filtro lista ─────────────────────────────────────────────
  filtro = signal<'todos' | 'borrador' | 'finalizada'>('todos');

  // ── Toasts ──────────────────────────────────────────────────
  notifications = signal<Toast[]>([]);
  private _toastId = 0;

  // ── Formulario del wizard ────────────────────────────────────
  form: {
    es_familiar:                boolean;
    id_publicadores:            number[];
    etiqueta_familia:           string;
    congregacion_destino:       string;
    correo_congregacion_destino: string;
    motivo:                     string;
    notas_para_carta:           string;
  } = this._resetForm();

  private _resetForm() {
    return {
      es_familiar:                false,
      id_publicadores:            [] as number[],
      etiqueta_familia:           '',
      congregacion_destino:       '',
      correo_congregacion_destino: '',
      motivo:                     '',
      notas_para_carta:           '',
    };
  }

  // ── Computeds ───────────────────────────────────────────────
  itemsFiltrados = computed(() => {
    const f = this.filtro();
    if (f === 'todos') return this.items();
    return this.items().filter(t => t.estado === f);
  });

  /** Publicadores no seleccionados aún en el wizard */
  publicadoresDisponibles(): PublicadorLite[] {
    const sel = this.form.id_publicadores;
    if (!this.form.es_familiar) return this.publicadores();
    return this.publicadores().filter(p => !sel.includes(p.id_publicador));
  }

  /** Publicadores filtrados por búsqueda dentro del dropdown */
  publicadoresBuscados(): PublicadorLite[] {
    const q = this.pubSearch().toLowerCase().trim();
    const base = this.publicadoresDisponibles();
    if (!q) return base;
    return base.filter(p =>
      `${p.primer_nombre} ${p.primer_apellido} ${p.segundo_apellido ?? ''}`.toLowerCase().includes(q)
    );
  }

  /** Sugerencia automática de etiqueta "Familia Apellido" */
  sugerenciaEtiqueta(): string {
    const ids = this.form.id_publicadores;
    if (ids.length < 2) return '';
    const pubs = this.publicadores().filter(p => ids.includes(p.id_publicador));
    const apellidos = [...new Set(pubs.map(p => p.primer_apellido).filter(Boolean))];
    return apellidos.length === 1 ? `Familia ${apellidos[0]}` : '';
  }

  /** ¿Algún miembro del wizard carece de consentimiento? */
  wizardFaltaConsentimiento(): boolean {
    return this.form.id_publicadores.some(id => this.pubLacksConsent(id));
  }

  /** ¿El primer publicador seleccionado carece de consentimiento? */
  formLacksConsent(): boolean {
    const id = this.form.id_publicadores[0];
    if (!id) return false;
    return this.pubLacksConsent(id);
  }

  selectedLacksConsent = computed(() => {
    const t = this.seleccionada();
    if (!t) return false;
    if (t.miembros?.length) return t.miembros.some(m => m.falta_consentimiento);
    const p = this.publicadores().find(x => x.id_publicador === t.id_publicador);
    return p ? !p.archivo_consentimiento : false;
  });

  /** Validación por paso del wizard */
  wizardPasoValido(): boolean {
    const p = this.wizardPaso();
    if (p === 1) return this.form.id_publicadores.length > 0;
    if (p === 2) return !!this.form.congregacion_destino?.trim();
    return !!this.form.notas_para_carta?.trim();
  }

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit() {
    this.svc.list().subscribe({
      next: t => { this.items.set(t); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast('error', 'No se pudieron cargar las transferencias'); },
    });
    const idCong  = this.ctx.effectiveCongregacionId();
    const params: any = {};
    if (idCong) params.id_congregacion = idCong;
    this.http.get<PublicadorLite[]>(`${environment.apiUrl}/publicadores/`, { params }).subscribe({
      next:  p => this.publicadores.set(p),
      error: () => this.toast('error', 'No se pudieron cargar los publicadores'),
    });
  }

  // ── Wizard helpers ───────────────────────────────────────────
  abrirWizard() {
    this.form = this._resetForm();
    this.wizardPaso.set(1);
    this.creando.set(true);
  }

  cerrarWizard() {
    this.creando.set(false);
    this.pubDropOpen.set(false);
  }

  onOverlayClick(e: MouseEvent) {
    if (!this.creandoTransferencia()) this.cerrarWizard();
  }

  openPubDrop(trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect();
    this.pubDropPos.set({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    this.pubDropOpen.set(!this.pubDropOpen());
  }

  wizardSiguiente() {
    const p = this.wizardPaso();
    if (p < 3) { this.wizardDir.set('forward'); this.wizardPaso.set((p + 1) as 1 | 2 | 3); }
  }

  wizardAnterior() {
    const p = this.wizardPaso();
    if (p > 1) { this.wizardDir.set('back'); this.wizardPaso.set((p - 1) as 1 | 2 | 3); }
  }

  setTipoFamiliar(familiar: boolean) {
    this.form.es_familiar = familiar;
    if (!familiar && this.form.id_publicadores.length > 1) {
      this.form.id_publicadores = [this.form.id_publicadores[0]];
    }
    this.form.etiqueta_familia = '';
  }

  selectPub(id: number | null) {
    this.pubDropOpen.set(false);
    this.pubSearch.set('');
    if (id === null) {
      this.form.id_publicadores = [];
      return;
    }
    if (this.form.es_familiar) {
      if (!this.form.id_publicadores.includes(id) && this.form.id_publicadores.length < 3) {
        this.form.id_publicadores = [...this.form.id_publicadores, id];
        // Autocompletar etiqueta si está vacía
        if (!this.form.etiqueta_familia) {
          const sug = this.sugerenciaEtiqueta();
          if (sug) this.form.etiqueta_familia = sug;
        }
      }
    } else {
      this.form.id_publicadores = [id];
    }
  }

  quitarMiembro(idx: number) {
    this.form.id_publicadores = this.form.id_publicadores.filter((_, i) => i !== idx);
  }

  // ── Crear transferencia + auto-redactar carta ─────────────────
  crear() {
    const idCong = this.ctx.effectiveCongregacionId();
    if (!idCong) { this.toast('error', 'Selecciona una congregación.'); return; }
    if (!this.form.notas_para_carta?.trim()) { this.toast('error', 'Las notas son obligatorias.'); return; }

    this.creandoTransferencia.set(true);
    this.creandoFase.set('Creando…');

    this.svc.create({
      id_publicadores:            this.form.id_publicadores,
      id_congregacion_origen:     idCong,
      congregacion_destino:       this.form.congregacion_destino,
      correo_congregacion_destino: this.form.correo_congregacion_destino || undefined,
      etiqueta_familia:           this.form.etiqueta_familia || undefined,
      motivo:                     this.form.motivo || undefined,
      notas_para_carta:           this.form.notas_para_carta,
    }).subscribe({
      next: (t) => {
        this.items.update(a => [t, ...a]);
        this.cerrarWizard();
        this.form = this._resetForm();
        this.abrir(t);
        this.toast('info', 'Transferencia creada. Redactando carta con IA…');
        this.creandoFase.set('Redactando carta…');

        // Auto-redactar carta después de crear
        this.svc.redactarCarta(t.id_transferencia).subscribe({
          next: (res) => {
            this.seleccionada.update(x => x ? { ...x, carta_redactada: res.carta_redactada } : x);
            this.items.update(arr => arr.map(x =>
              x.id_transferencia === t.id_transferencia ? { ...x, carta_redactada: res.carta_redactada } : x
            ));
            this.creandoTransferencia.set(false);
            this.activeTab.set('carta');
            this.toast('success', '✓ Carta redactada y lista para revisar.');
          },
          error: () => {
            this.creandoTransferencia.set(false);
            this.toast('error', 'Transferencia creada, pero no se pudo redactar la carta automáticamente. Puedes hacerlo desde la pestaña Notas.');
          },
        });
      },
      error: (e) => {
        this.creandoTransferencia.set(false);
        this.toast('error', e?.error?.detail || 'Error al crear la transferencia');
      },
    });
  }

  // ── Detalle ─────────────────────────────────────────────────
  abrir(t: Transferencia) {
    this.seleccionada.set({ ...t });
    this.confirmandoEliminar.set(false);
    this.activeTab.set('info');
    this.mobileView.set('detalle');
  }

  cerrarDetalle() {
    this.seleccionada.set(null);
    this.confirmandoEliminar.set(false);
    this.mobileView.set('lista');
  }

  // ── Guardar ──────────────────────────────────────────────────
  guardarNotas() {
    const t = this.seleccionada();
    if (!t) return;
    this.guardandoNotas.set(true);
    this.svc.update(t.id_transferencia, { notas_para_carta: t.notas_para_carta }).subscribe({
      next: updated => {
        this.seleccionada.set(updated);
        this.items.update(arr => arr.map(x => x.id_transferencia === updated.id_transferencia ? updated : x));
        this.guardandoNotas.set(false);
        this.toast('success', 'Notas guardadas.');
      },
      error: (e) => {
        this.guardandoNotas.set(false);
        this.toast('error', e?.error?.detail || 'Error al guardar las notas');
      },
    });
  }

  guardarTodo() {
    const t = this.seleccionada();
    if (!t) return;
    this.guardandoTodo.set(true);
    this.svc.update(t.id_transferencia, {
      notas_para_carta:            t.notas_para_carta,
      carta_redactada:             t.carta_redactada,
      congregacion_destino:        t.congregacion_destino,
      correo_congregacion_destino: t.correo_congregacion_destino,
      motivo:                      t.motivo,
      fecha_transferencia:         t.fecha_transferencia,
      estado:                      t.estado,
    }).subscribe({
      next: updated => {
        this.seleccionada.set(updated);
        this.items.update(arr => arr.map(x => x.id_transferencia === updated.id_transferencia ? updated : x));
        this.guardandoTodo.set(false);
        this.toast('success', 'Transferencia guardada.');
      },
      error: (e) => {
        this.guardandoTodo.set(false);
        this.toast('error', e?.error?.detail || 'Error al guardar');
      },
    });
  }

  // ── IA ───────────────────────────────────────────────────────
  redactarCarta() {
    const t = this.seleccionada();
    if (!t) return;
    this.guardarNotas();
    this.redactando.set(true);
    this.svc.redactarCarta(t.id_transferencia).subscribe({
      next: (res) => {
        this.seleccionada.update(x => x ? { ...x, carta_redactada: res.carta_redactada } : x);
        this.redactando.set(false);
        this.activeTab.set('carta');
        this.toast('success', 'Carta redactada correctamente.');
      },
      error: (e) => {
        this.redactando.set(false);
        this.toast('error', e?.error?.detail || 'Error al redactar la carta');
      },
    });
  }

  // ── ZIP ──────────────────────────────────────────────────────
  generarPaquete() {
    const t = this.seleccionada();
    if (!t) return;
    this.generando.set(true);
    this.svc.update(t.id_transferencia, {
      notas_para_carta: t.notas_para_carta,
      carta_redactada:  t.carta_redactada,
      congregacion_destino: t.congregacion_destino,
      motivo:  t.motivo,
      estado:  t.estado,
    }).subscribe({
      next: (updated) => {
        this.seleccionada.set(updated);
        this.items.update(arr => arr.map(x => x.id_transferencia === updated.id_transferencia ? updated : x));
        this.svc.generarPaquete(t.id_transferencia).subscribe({
          next: (blob) => {
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `transferencia_${this.etiquetaTransferencia(t).replace(/\s+/g, '_')}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            this.generando.set(false);
            this.toast('success', 'Paquete generado y descargado.');
          },
          error: (e) => {
            this.generando.set(false);
            this.toast('error', e?.error?.detail || 'Error al generar el paquete');
          },
        });
      },
      error: (e) => {
        this.generando.set(false);
        this.toast('error', e?.error?.detail || 'Error al guardar antes de generar el paquete');
      },
    });
  }

  // ── Eliminar ─────────────────────────────────────────────────
  confirmarEliminar() {
    const t = this.seleccionada();
    if (!t) return;
    this.svc.remove(t.id_transferencia).subscribe({
      next: () => {
        this.items.update(arr => arr.filter(x => x.id_transferencia !== t.id_transferencia));
        this.cerrarDetalle();
        this.toast('success', 'Transferencia eliminada.');
      },
      error: (e) => {
        this.confirmandoEliminar.set(false);
        this.toast('error', e?.error?.detail || 'Error al eliminar');
      },
    });
  }

  // ── Portapapeles ─────────────────────────────────────────────
  copiarCarta(texto: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        this.toast('success', 'Carta copiada al portapapeles.');
      }).catch(() => this._copiarFallback(texto));
    } else {
      this._copiarFallback(texto);
    }
  }

  private _copiarFallback(texto: string) {
    const ta       = document.createElement('textarea');
    ta.value       = texto;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.toast('success', 'Carta copiada al portapapeles.');
    } catch {
      this.toast('info', 'Selecciona el texto de la carta y cópialo manualmente.');
    } finally {
      document.body.removeChild(ta);
    }
  }

  // ── Helpers de vista ─────────────────────────────────────────
  nombrePublicador(id: number): string {
    const p = this.publicadores().find(x => x.id_publicador === id);
    return p ? `${p.primer_nombre} ${p.primer_apellido}` : `#${id}`;
  }

  iniciales(id: number): string {
    const p = this.publicadores().find(x => x.id_publicador === id);
    if (!p) return '#';
    return ((p.primer_nombre || '').charAt(0) + (p.primer_apellido || '').charAt(0)).toUpperCase() || '#';
  }

  inicialesPub(p: PublicadorLite): string {
    return ((p.primer_nombre || '').charAt(0) + (p.primer_apellido || '').charAt(0)).toUpperCase() || '#';
  }

  pubLacksConsent(id: number): boolean {
    const p = this.publicadores().find(x => x.id_publicador === id);
    return p ? !p.archivo_consentimiento : false;
  }

  /** Etiqueta para mostrar en la lista: familia o nombre individual */
  etiquetaTransferencia(t: Transferencia): string {
    if (t.es_familiar && t.etiqueta_familia) return t.etiqueta_familia;
    if (t.es_familiar && t.miembros?.length) return t.miembros[0].nombre_completo;
    return this.nombrePublicador(t.id_publicador);
  }

  /** Iniciales para avatar familiar (primera letra de la etiqueta "F" o "FA") */
  inicialEtiqueta(t: Transferencia): string {
    const etiqueta = t.etiqueta_familia || '';
    const words    = etiqueta.trim().split(/\s+/);
    if (words.length >= 2) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    if (words[0]) return words[0].substring(0, 2).toUpperCase();
    return t.miembros?.length ? this.iniciales(t.id_publicador) : '#';
  }

  countBorradores():  number { return this.items().filter(t => t.estado === 'borrador').length; }
  countFinalizadas(): number { return this.items().filter(t => t.estado === 'finalizada').length; }

  // ── Toasts ───────────────────────────────────────────────────
  toast(type: ToastType, msg: string, duration = 4500) {
    const id = ++this._toastId;
    this.notifications.update(n => [...n, { id, type, msg }]);
    setTimeout(() => this.dismissToast(id), duration);
  }

  dismissToast(id: number) {
    this.notifications.update(n => n.filter(x => x.id !== id));
  }
}

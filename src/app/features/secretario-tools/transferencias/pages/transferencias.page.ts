import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TransferenciaService } from '../../services/transferencia.service';
import { CompletarTransferenciaRequest, CongregacionBuscada, CongregacionDestino, ImpactoMiembro, Transferencia } from '../../models/transferencia.model';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { environment } from '../../../../../environments/environment';
import { inicialesDe, nombreLegal, nombreMostrado } from '../../../../core/utils/nombre.util';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; msg: string; }

interface PublicadorLite {
  id_publicador: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
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
            <span class="pub-item-name">{{ nombreMostrado(p) }}</span>
            <span *ngIf="!p.archivo_consentimiento" class="pub-item-badge">Sin consentimiento</span>
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

        <!-- ── Dialog Header ── -->
        <div class="modal-header">
          <div class="min-w-0">
            <p class="modal-step-label">Nueva transferencia · Paso {{ wizardPaso() }} de 3</p>
            <h2 id="modal-title" class="modal-title">
              {{ wizardPaso() === 1 ? '¿Quién se va de la congregación?' : wizardPaso() === 2 ? '¿A qué congregación se muda?' : 'Notas para la carta de presentación' }}
            </h2>
          </div>
          <button (click)="cerrarWizard()" class="modal-close-btn" aria-label="Cerrar" [disabled]="creandoTransferencia()">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- ── Stepper ── -->
        <ol class="modal-stepper" aria-label="Pasos de la nueva transferencia">
          <li class="wizard-step" [class.wizard-step--active]="wizardPaso() === 1" [class.wizard-step--done]="wizardPaso() > 1" [attr.aria-current]="wizardPaso() === 1 ? 'step' : null">
            <div class="wizard-step__bubble">
              <svg *ngIf="wizardPaso() > 1" class="wizard-step__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
              <span *ngIf="wizardPaso() <= 1">1</span>
            </div>
            <span class="wizard-step__label">Persona</span>
          </li>
          <li class="wizard-step-track" aria-hidden="true"><div class="wizard-step-fill" [class.wizard-step-fill--done]="wizardPaso() > 1"></div></li>
          <li class="wizard-step" [class.wizard-step--active]="wizardPaso() === 2" [class.wizard-step--done]="wizardPaso() > 2" [attr.aria-current]="wizardPaso() === 2 ? 'step' : null">
            <div class="wizard-step__bubble">
              <svg *ngIf="wizardPaso() > 2" class="wizard-step__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
              <span *ngIf="wizardPaso() <= 2">2</span>
            </div>
            <span class="wizard-step__label">Destino</span>
          </li>
          <li class="wizard-step-track" aria-hidden="true"><div class="wizard-step-fill" [class.wizard-step-fill--done]="wizardPaso() > 2"></div></li>
          <li class="wizard-step" [class.wizard-step--active]="wizardPaso() === 3" [attr.aria-current]="wizardPaso() === 3 ? 'step' : null">
            <div class="wizard-step__bubble"><span>3</span></div>
            <span class="wizard-step__label">Carta</span>
          </li>
        </ol>

        <!-- ── Step content (scrollable) ── -->
        <div class="modal-body">
          <div [class]="'wizard-body wizard-body--' + wizardDir()">

            <!-- PASO 1: una o varias personas. Con dos o más es una familia. -->
            <div *ngIf="wizardPaso() === 1" class="wizard-step-content flex flex-col gap-5">
              <p class="wizard-lead">Elige a la persona. Si se muda toda la familia, agrégalos a todos (hasta {{ maxMiembros }}) y saldrá una sola carta.</p>

              <ul *ngIf="form.id_publicadores.length" class="flex flex-col gap-2" aria-label="Personas que se transfieren">
                <li *ngFor="let pid of form.id_publicadores; let i = index" class="persona-row">
                  <span class="pub-item-avatar shrink-0">{{ iniciales(pid) }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ nombrePublicador(pid) }}</p>
                    <p *ngIf="pubLacksConsent(pid)" class="text-xs font-medium text-amber-700 dark:text-amber-400">Falta el consentimiento firmado</p>
                  </div>
                  <button type="button" class="persona-row__quitar" (click)="quitarMiembro(i)" [attr.aria-label]="'Quitar a ' + nombrePublicador(pid)">
                    Quitar
                  </button>
                </li>
              </ul>

              <div *ngIf="form.id_publicadores.length < maxMiembros" class="field-group" style="--field-i:0">
                <label *ngIf="!form.id_publicadores.length" class="form-label" id="label-persona">Persona que se transfiere <span class="text-red-500">*</span></label>
                <div class="pub-dropdown" [class.pub-dropdown--open]="pubDropOpen()">
                  <button type="button" class="pub-dropdown-trigger" #pubTrigger (click)="openPubDrop(pubTrigger)"
                          [class.pub-dropdown-trigger--agregar]="form.id_publicadores.length > 0"
                          [attr.aria-labelledby]="form.id_publicadores.length ? null : 'label-persona'" aria-haspopup="listbox" [attr.aria-expanded]="pubDropOpen()">
                    @if (form.id_publicadores.length) {
                      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
                      <span class="flex-1">Agregar otro miembro de la familia</span>
                    } @else {
                      <span class="pub-drop-placeholder">Buscar y elegir…</span>
                      <svg class="pub-drop-chevron ml-auto shrink-0" [class.rotate-180]="pubDropOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    }
                  </button>
                </div>
              </div>
              <p *ngIf="form.id_publicadores.length >= maxMiembros" class="text-xs text-slate-500 dark:text-slate-400">Ya son {{ maxMiembros }} personas, el máximo. Quita a alguien para agregar a otro.</p>

              <div *ngIf="form.id_publicadores.length > 1" class="field-group animate-scale-in" style="--field-i:1">
                <label class="form-label" for="wiz-familia">Nombre de la familia <span class="text-slate-400 font-normal">(opcional)</span></label>
                <input id="wiz-familia" class="form-control" [(ngModel)]="form.etiqueta_familia" [placeholder]="sugerenciaEtiqueta() || 'Ej. Familia Narváez'" />
                <p class="field-help">Así aparecerá en la lista de transferencias.</p>
              </div>

              <div *ngIf="wizardFaltaConsentimiento()" class="consent-alert animate-scale-in" role="note">
                <svg class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span class="text-xs leading-normal">Puedes seguir, pero antes de enviar sus datos a otra congregación necesitas su <strong>consentimiento firmado</strong>.</span>
              </div>
            </div>

            <!-- PASO 2 -->
            <div *ngIf="wizardPaso() === 2" class="wizard-step-content flex flex-col gap-5">
              <p class="wizard-lead">A esta congregación se le enviará la carta de presentación.</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="field-group" style="--field-i:0">
                  <label class="form-label" for="wiz-destino">Nombre de la congregación <span class="text-red-500">*</span></label>
                  <input id="wiz-destino" class="form-control" [(ngModel)]="form.congregacion_destino" placeholder="Ej. Congregación Centro" />
                </div>
                <div class="field-group" style="--field-i:1">
                  <label class="form-label" for="wiz-correo">Correo de su secretario <span class="text-slate-400 font-normal">(opcional)</span></label>
                  <input id="wiz-correo" class="form-control" type="email" inputmode="email" [(ngModel)]="form.correo_congregacion_destino" placeholder="secretario@congregacion.org" autocomplete="email" />
                </div>
              </div>
              <p class="field-help">Si esa congregación también usa GAC, al final podrás pasarle a la persona con todo su historial.</p>
            </div>

            <!-- PASO 3 -->
            <div *ngIf="wizardPaso() === 3" class="wizard-step-content flex flex-col gap-5">
              <p class="wizard-lead">Con estas notas se arma la carta de presentación. Luego podrás revisarla, corregirla o mejorar su redacción.</p>
              <div class="field-group" style="--field-i:0">
                <label class="form-label" for="wiz-notas">Notas sobre {{ form.id_publicadores.length > 1 ? 'cada miembro' : 'la persona' }} <span class="text-red-500">*</span></label>
                <textarea id="wiz-notas" rows="6" class="form-control"
                          [(ngModel)]="form.notas_para_carta"
                          [placeholder]="form.id_publicadores.length > 1
                            ? 'Por cada miembro: cuánto tiempo lleva aquí, privilegios, cómo apoya las reuniones y la predicación…'
                            : 'Cuánto tiempo lleva aquí, privilegios (siervo ministerial, anciano, precursor), cómo apoya las reuniones y la predicación, situación familiar…'">
                </textarea>
                <p class="field-help">Mientras más detalles, mejor saldrá la carta.</p>
              </div>
              <div class="field-group" style="--field-i:1">
                <label class="form-label" for="wiz-motivo">Motivo del cambio <span class="text-slate-400 font-normal">(opcional)</span></label>
                <input id="wiz-motivo" class="form-control" [(ngModel)]="form.motivo" placeholder="Ej. Cambio de casa, trabajo, matrimonio…" />
              </div>
            </div>

          </div>
        </div><!-- /modal-body -->

        <!-- ── Footer de navegación ── -->
        <div class="modal-footer">
          <button *ngIf="wizardPaso() === 1" type="button" (click)="cerrarWizard()" class="btn-wizard-back">Cancelar</button>
          <button *ngIf="wizardPaso() > 1" type="button" (click)="wizardAnterior()" class="btn-wizard-back" [disabled]="creandoTransferencia()">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Atrás
          </button>
          <button *ngIf="wizardPaso() < 3" type="button"
                  [disabled]="!wizardPasoValido()"
                  (click)="wizardSiguiente()"
                  class="btn-wizard-next">
            Continuar
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button *ngIf="wizardPaso() === 3" type="button"
                  [disabled]="!form.notas_para_carta.trim() || creandoTransferencia()"
                  (click)="crear()"
                  class="btn-wizard-next">
            <span *ngIf="!creandoTransferencia()">Crear la carta</span>
            <span *ngIf="creandoTransferencia()" class="flex items-center gap-2">
              <span class="wizard-create-spinner"></span>
              {{ creandoFase() }}
            </span>
          </button>
        </div>

      </div><!-- /modal-dialog -->
    </div>
    <!-- /MODAL WIZARD -->

    <!-- ── MODAL: Vista previa de la carta ── -->
    <div *ngIf="mostrandoPreview()" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title" (click)="cerrarPreview()">
      <div class="modal-dialog carta-preview-dialog" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 id="preview-modal-title" class="modal-title">Vista previa de la carta</h2>
          <button (click)="cerrarPreview()" class="modal-close-btn" aria-label="Cerrar vista previa">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <iframe *ngIf="previewUrl()" [src]="previewUrl()" class="carta-preview-iframe" title="Vista previa de la carta"></iframe>
      </div>
    </div>
    <!-- /MODAL PREVIEW -->

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
              <div class="filter-pills-wrap flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl shrink-0">
                <button (click)="filtro.set('todos')" class="filter-pill" [class.filter-pill--active]="filtro() === 'todos'" type="button">
                  Todos <span class="filter-count">{{ items().length }}</span>
                </button>
                <button (click)="filtro.set('borrador')" class="filter-pill" [class.filter-pill--active]="filtro() === 'borrador'" type="button">
                  Borradores <span class="filter-count filter-count--warn">{{ countBorradores() }}</span>
                </button>
                <button (click)="filtro.set('finalizada')" class="filter-pill" [class.filter-pill--active]="filtro() === 'finalizada'" type="button">
                  Finalizadas <span class="filter-count filter-count--ok">{{ countFinalizadas() }}</span>
                </button>
                <button *ngIf="countRecibidas() > 0" (click)="filtro.set('recibidas')" class="filter-pill" [class.filter-pill--active]="filtro() === 'recibidas'" type="button">
                  Recibidas <span class="filter-count filter-count--ok">{{ countRecibidas() }}</span>
                </button>
              </div>
            </div>

            <!-- Desktop / wide-panel table -->
            <div class="list-table-wrap flex-1 min-h-0">
            <div class="flex-1 overflow-y-auto overflow-x-auto min-h-0">
              <table class="w-full border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-slate-100 dark:border-slate-800">
                    <th class="px-5 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" scope="col">Publicador</th>
                    <th class="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" scope="col">Destino</th>
                    <th class="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" scope="col">Estado</th>
                    <th class="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500" scope="col">Carta</th>
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
                          {{ inicialesTransferencia(t) }}
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
                        <svg class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span class="truncate max-w-[140px] text-sm font-medium text-slate-700 dark:text-slate-300 leading-none">{{ esIngreso(t) ? 'Desde ' + (t.congregacion_origen_nombre || '—') : (t.congregacion_destino || '—') }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3.5">
                      <span [class]="badgeEstadoCls(t)" class="text-[11px] px-2.5 py-1 rounded-lg font-semibold leading-none">
                        {{ badgeEstadoTxt(t) }}
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

            <!-- Compact card list (mobile + narrow panel) -->
            <div class="mobile-cards flex-col gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/10">
              @if (loading()) {
                @for (sk of [1,2,3]; track sk) {
                  <div class="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
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
                   class="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer active:scale-[0.99] shadow-sm">
                <div class="avatar-initials w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-bold font-display text-sm flex items-center justify-center shrink-0">
                  {{ inicialesTransferencia(t) }}
                </div>
                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-slate-900 dark:text-slate-100 truncate text-sm leading-none">{{ etiquetaTransferencia(t) }}</span>
                    <span [class]="badgeEstadoCls(t)" class="text-[10px] px-2 py-0.5 rounded-full leading-none font-semibold">
                      {{ badgeEstadoTxt(t) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <svg class="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span class="truncate">{{ esIngreso(t) ? 'Desde ' + (t.congregacion_origen_nombre || '—') : t.congregacion_destino }}</span>
                    <span *ngIf="t.es_familiar" class="text-slate-300 dark:text-slate-600">•</span>
                    <span *ngIf="t.es_familiar" class="truncate font-normal">{{ t.miembros.length || 1 }} miembros</span>
                  </div>
                </div>
                <div class="text-slate-300 dark:text-slate-600 shrink-0">
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
          <aside *ngIf="seleccionada() as t" class="card p-4 sm:p-5 detail-panel overflow-hidden flex flex-col">

            <!-- Mobile back button -->
            <button class="md:hidden flex items-center justify-center gap-1.5 w-full py-3 mb-4 text-sm font-semibold text-violet-600 dark:text-violet-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer" (click)="cerrarDetalle()">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
              Volver al listado
            </button>

            <!-- Inline delete confirmation -->
            <div *ngIf="confirmandoEliminar()" class="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl animate-scale-in" role="alertdialog" aria-labelledby="confirm-title">
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0" aria-hidden="true">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </div>
                <div class="flex flex-col gap-0.5">
                  <p id="confirm-title" class="text-sm font-bold text-red-800 dark:text-red-200">¿Borrar esta transferencia?</p>
                  <p class="text-xs text-red-700 dark:text-red-300 leading-snug">Se borran sus notas y su carta. {{ t.procesada_en ? 'El historial del traslado se pierde.' : 'La persona sigue en la congregación.' }} No se puede deshacer.</p>
                </div>
              </div>
              <div class="flex gap-2 shrink-0 self-end sm:self-center">
                <button class="btn-wizard-back" (click)="confirmandoEliminar.set(false)">Cancelar</button>
                <button class="btn-confirmar btn-confirmar--peligro" (click)="confirmarEliminar()">Sí, borrar</button>
              </div>
            </div>

            <!-- Detail Header -->
            <header class="detail-head flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <!-- Avatar familiar: avatares apilados -->
                <div *ngIf="t.es_familiar && t.miembros && t.miembros.length > 1" class="family-avatars"
                     role="img" [attr.aria-label]="'Miembros: ' + nombresMiembros(t)" [attr.title]="nombresMiembros(t)">
                  <span *ngFor="let m of t.miembros.slice(0,3); let i = index" class="family-avatar"
                        [style.--i]="i" aria-hidden="true">{{ inicialesDeNombre(m.nombre_completo) }}</span>
                  <span *ngIf="t.miembros.length > 3" class="family-avatar family-avatar--mas" [style.--i]="3" aria-hidden="true">+{{ t.miembros.length - 3 }}</span>
                </div>
                <!-- Avatar individual -->
                <div *ngIf="!t.es_familiar || !t.miembros || t.miembros.length <= 1"
                     class="avatar-initials w-11 h-11 rounded-xl bg-violet-600 text-white font-bold font-display text-sm flex items-center justify-center shrink-0">
                  {{ inicialesTransferencia(t) }}
                </div>
                <div class="min-w-0">
                  <h2 class="font-display font-bold text-lg text-slate-900 dark:text-white leading-tight line-clamp-2 break-words">{{ etiquetaTransferencia(t) }}</h2>
                  <div class="detail-subtitle">
                    <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    <strong class="detail-subtitle__dest">{{ esIngreso(t) ? 'Desde ' + (t.congregacion_origen_nombre || 'otra congregación') : (t.congregacion_destino || 'Sin destino') }}</strong>
                    <span *ngIf="t.es_familiar" class="detail-subtitle__tag">{{ (t.miembros?.length || 1) }} miembros</span>
                  </div>
                </div>
              </div>
              <button (click)="cerrarDetalle()" class="hidden md:flex items-center justify-center w-11 h-11 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer" aria-label="Cerrar detalle">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </header>

            <!-- Navigation Tabs -->
            <nav *ngIf="!esIngreso(t)" class="tab-nav mb-5 w-full flex justify-start gap-1 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl" role="tablist" aria-label="Secciones de la transferencia">
              <button (click)="activeTab.set('info')" [class]="activeTab() === 'info' ? 'tab-item-active bg-violet-600 text-white shadow-sm' : 'tab-item text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'" class="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-1 text-sm font-bold rounded-lg transition-all cursor-pointer" role="tab" [attr.aria-selected]="activeTab() === 'info'">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Info
              </button>
              <button (click)="activeTab.set('notas')" [class]="activeTab() === 'notas' ? 'tab-item-active bg-violet-600 text-white shadow-sm' : 'tab-item text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'" class="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-1 text-sm font-bold rounded-lg transition-all cursor-pointer relative" role="tab" [attr.aria-selected]="activeTab() === 'notas'">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                Notas
                <span *ngIf="!seleccionada()?.notas_para_carta && activeTab() !== 'notas'" class="tab-dot tab-dot--warn" aria-hidden="true"></span>
              </button>
              <button (click)="activeTab.set('carta')" [class]="activeTab() === 'carta' ? 'tab-item-active bg-violet-600 text-white shadow-sm' : 'tab-item text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'" class="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-1 text-sm font-bold rounded-lg transition-all cursor-pointer relative" role="tab" [attr.aria-selected]="activeTab() === 'carta'">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M13 3v6h6"/></svg>
                Carta
                <span *ngIf="!seleccionada()?.carta_redactada && activeTab() !== 'carta'" class="tab-dot tab-dot--warn" aria-hidden="true"></span>
              </button>
            </nav>

            <!-- Tab content wrapper — scrolls internally -->
            <div class="flex-1 min-h-0 overflow-y-auto pb-2">

            <!-- ── Ingreso: lo recibió esta congregación (solo lectura) ── -->
            <div *ngIf="esIngreso(t)" class="animate-scale-in flex flex-col gap-5">
              <div class="detail-alert border-sky-200 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-950/20 text-sky-800 dark:text-sky-200">
                <svg class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div>
                  <p class="text-xs font-bold leading-tight mb-0.5">{{ (t.miembros?.length || 0) > 1 ? 'Llegaron' : 'Llegó' }} desde {{ t.congregacion_origen_nombre || 'otra congregación' }}</p>
                  <p class="text-xs leading-snug">{{ t.procesada_en | date:"d 'de' MMMM 'de' y" }}. Ya {{ (t.miembros?.length || 0) > 1 ? 'aparecen' : 'aparece' }} en tu lista de publicadores, con su consentimiento y su historial de informes.</p>
                </div>
              </div>

              <section class="detail-section" aria-labelledby="ing-miembros">
                <h3 id="ing-miembros" class="detail-section__label">{{ (t.miembros?.length || 0) > 1 ? 'Quiénes llegaron' : 'Quién llegó' }}</h3>
                <ul class="flex flex-col gap-1.5">
                  <li *ngFor="let m of t.miembros" class="detail-member-row">
                    <span class="pub-item-avatar shrink-0">{{ inicialesDeNombre(m.nombre_completo) }}</span>
                    <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1 min-w-0 break-words leading-snug">{{ m.nombre_completo }}</span>
                  </li>
                </ul>
              </section>

              <section class="detail-section" aria-labelledby="ing-carta">
                <h3 id="ing-carta" class="detail-section__label">Carta de presentación</h3>
                <p *ngIf="!t.carta_redactada" class="text-sm text-slate-500 dark:text-slate-400">Esta transferencia no trae carta.</p>
                <ng-container *ngIf="t.carta_redactada">
                  <p class="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line mb-3">{{ t.carta_redactada }}</p>
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="btn-buscar" (click)="verCartaRecibida()" [disabled]="cargandoPreview()">
                      {{ cargandoPreview() ? 'Abriendo…' : 'Ver carta en PDF' }}
                    </button>
                    <button type="button" class="btn-buscar" (click)="copiarCarta(t.carta_redactada!)">Copiar texto</button>
                  </div>
                </ng-container>
              </section>
            </div>

            <!-- Tab 1: Info -->
            <div *ngIf="!esIngreso(t) && activeTab() === 'info'" class="animate-scale-in detail-info-tab">

              <div class="info-alertas">
              <!-- ── Alerta de consentimiento ── -->
              <div *ngIf="selectedLacksConsent()" class="detail-alert detail-alert--warn mb-4">
                <svg class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <p class="text-xs font-bold leading-tight mb-0.5">Falta el consentimiento firmado</p>
                  <p class="text-xs leading-snug">{{ t.es_familiar ? 'Algún miembro no lo ha firmado' : 'No lo ha firmado' }}. Consíguelo antes de enviar sus datos a otra congregación.</p>
                </div>
              </div>

              <!-- ── Banner de resultado (transferencia ya completada) ── -->
              <div *ngIf="t.procesada_en" class="detail-alert mb-4"
                   [ngClass]="t.accion_realizada === 'trasladado'
                     ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200'
                     : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300'">
                <svg *ngIf="t.accion_realizada === 'trasladado'" class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <svg *ngIf="t.accion_realizada !== 'trasladado'" class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                <div>
                  <p class="text-xs font-bold leading-tight mb-0.5">Transferencia completada</p>
                  <p class="text-xs leading-snug">{{ resultadoTexto(t) }}. {{ t.accion_realizada === 'trasladado'
                    ? 'Se conserva como historial; solo puedes rehacer la carta y el paquete.'
                    : 'Este registro se conserva como historial y ya no se puede editar.' }}</p>
                </div>
              </div>

              <!-- ── Tras sumar a un familiar: la carta y el paquete deben rehacerse ── -->
              <div *ngIf="paqueteDesactualizado(t)" class="detail-alert detail-alert--warn mb-4">
                <svg class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div class="flex flex-col gap-2 min-w-0">
                  <div>
                    <p class="text-xs font-bold leading-tight mb-0.5">Falta el paquete con toda la familia</p>
                    <p class="text-xs leading-snug">Revisa que la carta mencione a {{ nombresMiembros(t) }} y vuelve a descargar el paquete para enviarlo.</p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="btn-buscar" (click)="activeTab.set('notas')">Rehacer la carta</button>
                    <button type="button" class="btn-buscar" (click)="generarPaquete()" [disabled]="!t.carta_redactada || generando()">
                      {{ generando() ? 'Descargando…' : 'Descargar el paquete' }}
                    </button>
                  </div>
                </div>
              </div>
              </div>

              <!-- ── Pasos: dónde está esta transferencia y qué sigue ── -->
              <section *ngIf="!t.procesada_en" class="detail-section info-pasos" aria-labelledby="pasos-titulo">
                <h3 id="pasos-titulo" class="detail-section__label">Pasos</h3>
                <ol class="pasos">
                  <li class="paso" [class.paso--hecho]="!!t.notas_para_carta" [class.paso--actual]="pasoActual(t) === 1">
                    <span class="paso__marca" aria-hidden="true">
                      <svg *ngIf="t.notas_para_carta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                      <span *ngIf="!t.notas_para_carta">1</span>
                    </span>
                    <span class="paso__titulo">Escribir notas sobre {{ t.es_familiar ? 'la familia' : 'la persona' }}<span class="sr-only">{{ t.notas_para_carta ? ' (hecho)' : '' }}</span></span>
                    <button type="button" class="paso__accion" (click)="activeTab.set('notas')">{{ t.notas_para_carta ? 'Ver' : 'Escribir' }}</button>
                  </li>
                  <li class="paso" [class.paso--hecho]="!!t.carta_redactada" [class.paso--actual]="pasoActual(t) === 2">
                    <span class="paso__marca" aria-hidden="true">
                      <svg *ngIf="t.carta_redactada" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                      <span *ngIf="!t.carta_redactada">2</span>
                    </span>
                    <span class="paso__titulo">Revisar la carta de presentación<span class="sr-only">{{ t.carta_redactada ? ' (hecho)' : '' }}</span></span>
                    <button type="button" class="paso__accion" (click)="activeTab.set('carta')">Revisar</button>
                  </li>
                  <li class="paso" [class.paso--hecho]="!!t.archivo_zip" [class.paso--actual]="pasoActual(t) === 3">
                    <span class="paso__marca" aria-hidden="true">
                      <svg *ngIf="t.archivo_zip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                      <span *ngIf="!t.archivo_zip">3</span>
                    </span>
                    <span class="paso__titulo">Descargar el paquete (carta y tarjeta)<span class="sr-only">{{ t.archivo_zip ? ' (hecho)' : '' }}</span></span>
                    <button type="button" class="paso__accion" (click)="generarPaquete()" [disabled]="!t.carta_redactada || generando()"
                            [title]="!t.carta_redactada ? 'Primero revisa la carta' : ''">
                      {{ generando() ? 'Descargando…' : (t.archivo_zip ? 'Otra vez' : 'Descargar') }}
                    </button>
                  </li>
                  <li class="paso" [class.paso--actual]="pasoActual(t) === 4">
                    <span class="paso__marca" aria-hidden="true"><span>4</span></span>
                    <span class="paso__titulo">Completar la transferencia</span>
                    <button type="button" class="paso__accion" (click)="irACompletar()">Ir</button>
                  </li>
                </ol>
              </section>

              <!-- ── Datos ── -->
              <section class="detail-section info-datos" aria-labelledby="datos-titulo">
                <h3 id="datos-titulo" class="detail-section__label">Datos</h3>
                <div class="flex flex-col gap-4">
                  <div *ngIf="t.es_familiar && t.miembros && t.miembros.length > 0">
                    <p class="form-label">Miembros de la familia</p>
                    <ul class="flex flex-col gap-1.5">
                      <li *ngFor="let m of t.miembros" class="detail-member-row">
                        <span class="pub-item-avatar shrink-0">{{ inicialesDeNombre(m.nombre_completo) }}</span>
                        <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1 min-w-0 truncate">{{ m.nombre_completo }}</span>
                        <span *ngIf="m.falta_consentimiento" class="pub-item-badge shrink-0">Sin consentimiento</span>
                      </li>
                    </ul>
                  </div>
                  <div class="field-group" style="margin:0">
                    <label class="form-label" for="det-destino">Congregación a la que se muda <span class="text-red-500">*</span></label>
                    <input id="det-destino" class="form-control" [(ngModel)]="t.congregacion_destino" [disabled]="!!t.procesada_en" placeholder="Ej. Congregación Centro" />
                  </div>
                  <div class="field-group" style="margin:0">
                    <label class="form-label" for="det-correo">Correo de su secretario</label>
                    <input id="det-correo" class="form-control" type="email" inputmode="email" [(ngModel)]="t.correo_congregacion_destino" [disabled]="!!t.procesada_en" placeholder="secretario@congregacion.org" autocomplete="off" />
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="field-group" style="margin:0">
                      <label class="form-label" for="det-motivo">Motivo</label>
                      <input id="det-motivo" class="form-control" [(ngModel)]="t.motivo" [disabled]="!!t.procesada_en" placeholder="Cambio de casa, trabajo…" />
                    </div>
                    <div class="field-group" style="margin:0">
                      <label class="form-label" for="det-fecha">Fecha</label>
                      <input id="det-fecha" class="form-control" type="date" [(ngModel)]="t.fecha_transferencia" [disabled]="!!t.procesada_en" />
                    </div>
                  </div>
                  <button *ngIf="!t.procesada_en" type="button" (click)="guardarTodo()" [disabled]="guardandoTodo()" class="btn-guardar-datos">
                    <span *ngIf="guardandoTodo()" class="spinner spinner-xs"></span>
                    {{ guardandoTodo() ? 'Guardando…' : 'Guardar cambios' }}
                  </button>
                </div>
              </section>

              <!-- ── Último paso: completar (trasladar o eliminar) ── -->
              <section *ngIf="!t.procesada_en" id="seccion-completar" class="completar info-completar" aria-labelledby="completar-titulo">
                <p class="completar__eyebrow">Último paso</p>
                <h3 id="completar-titulo" class="completar__titulo">Completar la transferencia</h3>
                <p class="completar__desc">
                  Hazlo cuando {{ t.es_familiar ? 'la familia' : 'la persona' }} ya se haya mudado: saldrá de la lista de publicadores de esta congregación.
                  Sus informes de los meses que estuvo aquí siguen contando aquí.
                </p>

                <button *ngIf="!mostrarCompletar()" type="button" class="btn-completar" (click)="abrirCompletar()">
                  Empezar
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>

                <div *ngIf="mostrarCompletar()" class="flex flex-col gap-5 mt-1 animate-scale-in">
                  <fieldset class="flex flex-col gap-2.5">
                    <legend class="completar__pregunta">¿La congregación a la que se muda usa GAC?</legend>
                    <label class="opcion" [class.opcion--activa]="completarAccion() === 'trasladar'">
                      <input type="radio" name="accion-completar" class="opcion__input" value="trasladar"
                             [checked]="completarAccion() === 'trasladar'" (change)="elegirAccion('trasladar')" />
                      <span class="opcion__radio" aria-hidden="true"></span>
                      <span class="opcion__cuerpo">
                        <span class="opcion__titulo">Sí, usa GAC: trasladar</span>
                        <span class="opcion__desc">Pasa a esa congregación con sus informes, su tarjeta y su historial.</span>
                      </span>
                    </label>
                    <label class="opcion opcion--peligro" [class.opcion--activa]="completarAccion() === 'eliminar'">
                      <input type="radio" name="accion-completar" class="opcion__input" value="eliminar"
                             [checked]="completarAccion() === 'eliminar'" (change)="elegirAccion('eliminar')" />
                      <span class="opcion__radio" aria-hidden="true"></span>
                      <span class="opcion__cuerpo">
                        <span class="opcion__titulo">No usa GAC: eliminar de GAC</span>
                        <span class="opcion__desc">Se borran sus datos de GAC. Antes descarga el paquete para enviárselo a esa congregación.</span>
                      </span>
                    </label>
                  </fieldset>

                  <!-- Trasladar -->
                  <div *ngIf="completarAccion() === 'trasladar'" class="flex flex-col gap-5 animate-scale-in">
                    <div *ngIf="!t.carta_redactada" class="consent-alert" role="note">
                      <svg class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      <div class="flex flex-col gap-2.5 min-w-0">
                        <p class="text-xs leading-normal"><strong>Falta la carta de presentación.</strong> La otra congregación la recibe por GAC, así que debe estar lista antes de trasladar.</p>
                        <button type="button" class="btn-buscar self-start" (click)="activeTab.set(t.notas_para_carta ? 'carta' : 'notas')">Ir a la carta</button>
                      </div>
                    </div>
                    <p *ngIf="t.carta_redactada" class="field-help" style="margin:0">La carta de presentación también le llegará a esa congregación por GAC.</p>

                    <div class="sub-paso">
                      <span class="sub-paso__num" aria-hidden="true">1</span>
                      <div class="flex-1 min-w-0 flex flex-col gap-2">
                        <label class="sub-paso__titulo" for="numero-cong-destino">Congregación a la que se muda</label>
                        <div class="combo">
                          <input id="numero-cong-destino" class="form-control" type="search" autocomplete="off"
                                 placeholder="Escribe su nombre o su número"
                                 role="combobox" aria-autocomplete="list" aria-controls="cong-resultados"
                                 [attr.aria-expanded]="mostrarResultados()" aria-describedby="numero-estado"
                                 [ngModel]="numeroCongDestino()" (ngModelChange)="onNumeroChange($event)"
                                 (keydown.enter)="elegirPrimeraCongregacion($event)" />
                          <ul *ngIf="mostrarResultados()" id="cong-resultados" class="combo__lista" role="listbox" aria-label="Congregaciones encontradas">
                            <li *ngFor="let c of resultadosCong()" role="option">
                              <button type="button" class="combo__opcion" (click)="elegirCongregacion(c)">
                                <span class="combo__nombre">{{ c.nombre_congregacion }}</span>
                                <span class="combo__numero">N.º {{ c.numero_congregacion }}</span>
                              </button>
                            </li>
                          </ul>
                        </div>
                        <div id="numero-estado" aria-live="polite">
                          <p *ngIf="verificandoDestino()" class="destino-estado">
                            <span class="spinner spinner-xs"></span> Buscando…
                          </p>
                          <p *ngIf="destinoVerificado() as d" class="destino-estado"
                             [class.destino-estado--ok]="!d.es_la_misma" [class.destino-estado--error]="d.es_la_misma">
                            <svg *ngIf="!d.es_la_misma" class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            {{ d.es_la_misma ? 'Ese número es de esta misma congregación.' : d.nombre_congregacion + ' · N.º ' + d.numero_congregacion }}
                          </p>
                          <p *ngIf="errorDestino()" class="destino-estado destino-estado--error">{{ errorDestino() }}</p>
                          <p *ngIf="sinResultados()" class="field-help" style="margin:0">
                            No encontramos ninguna congregación con eso en GAC. Revisa el nombre o el número, o si no usa GAC elige "eliminar de GAC".
                          </p>
                          <p *ngIf="!verificandoDestino() && !destinoVerificado() && !errorDestino() && !sinResultados() && !mostrarResultados()" class="field-help" style="margin:0">
                            Escribe al menos 2 letras o números y elige la congregación de la lista.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div class="sub-paso">
                      <span class="sub-paso__num" aria-hidden="true">2</span>
                      <div class="flex-1 min-w-0 flex flex-col gap-3">
                        <p class="sub-paso__titulo">Privilegios que conserva</p>
                        <p *ngIf="cargandoImpacto()" class="destino-estado"><span class="spinner spinner-xs"></span> Revisando sus privilegios…</p>
                        <div *ngFor="let mi of impacto()" class="flex flex-col gap-1">
                          <p *ngIf="impacto().length > 1" class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ mi.nombre_completo }}</p>
                          <fieldset *ngIf="mi.privilegios.length" class="flex flex-col">
                            <legend class="sr-only">Privilegios de {{ mi.nombre_completo }}</legend>
                            <label *ngFor="let pr of mi.privilegios" class="privilegio">
                              <input type="checkbox" class="privilegio__check"
                                     [checked]="privilegiosConservar().has(pr.id_publicador_privilegio)"
                                     (change)="togglePrivilegio(pr.id_publicador_privilegio)" />
                              <span class="flex-1 text-sm text-slate-700 dark:text-slate-200">{{ pr.nombre_privilegio }}</span>
                              <span class="text-xs text-slate-500 dark:text-slate-400">desde {{ pr.fecha_inicio | date:'MMM yyyy' }}</span>
                            </label>
                          </fieldset>
                          <p *ngIf="!mi.privilegios.length" class="text-sm text-slate-500 dark:text-slate-400">No tiene privilegios vigentes.</p>
                        </div>
                        <p *ngIf="tienePrivilegios()" class="field-help" style="margin:0">Los que desmarques terminan hoy. La nueva congregación podrá volver a darlos.</p>
                      </div>
                    </div>

                    <div *ngIf="lineasImpactoTodas().length" class="sub-paso">
                      <span class="sub-paso__num" aria-hidden="true">3</span>
                      <div class="flex-1 min-w-0 flex flex-col gap-2">
                        <p class="sub-paso__titulo">Lo que pasará en esta congregación</p>
                        <ul class="flex flex-col gap-1.5">
                          <li *ngFor="let l of lineasImpactoTodas()" class="impacto-linea">{{ l }}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <!-- Eliminar -->
                  <div *ngIf="completarAccion() === 'eliminar'" class="flex flex-col gap-4 animate-scale-in">
                    <div *ngIf="!t.archivo_zip" class="consent-alert" role="note">
                      <svg class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      <div class="flex flex-col gap-2.5 min-w-0">
                        <p class="text-xs leading-normal"><strong>Aún no has descargado el paquete.</strong> Después de eliminar ya no se podrá generar la tarjeta.</p>
                        <button *ngIf="t.carta_redactada" type="button" class="btn-buscar self-start" (click)="generarPaquete()" [disabled]="generando()">
                          {{ generando() ? 'Descargando…' : 'Descargar el paquete ahora' }}
                        </button>
                        <button *ngIf="!t.carta_redactada" type="button" class="btn-buscar self-start" (click)="activeTab.set('carta')">Primero revisa la carta</button>
                      </div>
                    </div>
                    <label class="confirmacion">
                      <input type="checkbox" class="privilegio__check" [checked]="confirmaEliminar()" (change)="confirmaEliminar.set(!confirmaEliminar())" />
                      <span class="text-xs text-slate-700 dark:text-slate-200">
                        Entiendo que {{ etiquetaTransferencia(t) }} se {{ t.es_familiar ? 'borrarán' : 'borrará' }} de GAC junto con su acceso a la app, y que no se puede deshacer.
                      </span>
                    </label>
                  </div>

                  <div *ngIf="completarAccion()" class="completar__acciones">
                    <button type="button" class="btn-wizard-back" (click)="cancelarCompletar()" [disabled]="completando()">Cancelar</button>
                    <button type="button" class="btn-confirmar" [class.btn-confirmar--peligro]="completarAccion() === 'eliminar'"
                            [disabled]="!completarValido() || completando()" (click)="ejecutarCompletar()">
                      <span *ngIf="completando()" class="wizard-create-spinner"></span>
                      {{ textoConfirmar(t) }}
                    </button>
                  </div>
                  <button *ngIf="!completarAccion()" type="button" class="btn-wizard-back self-start" (click)="cancelarCompletar()">Cancelar</button>
                </div>
              </section>

              <!-- ── Traslado hecho: sumar a un familiar que faltó ── -->
              <section *ngIf="puedeAgregarFamiliar(t)" id="seccion-agregar" class="completar info-completar" aria-labelledby="agregar-titulo">
                <p class="completar__eyebrow">¿Faltó alguien?</p>
                <h3 id="agregar-titulo" class="completar__titulo">Agregar un familiar que faltó</h3>
                <p class="completar__desc">
                  Si alguien más de la familia también se mudó y no lo incluiste, agrégalo aquí.
                  Pasará a {{ t.congregacion_destino || 'la misma congregación' }} y quedará en esta transferencia.
                </p>

                <button *ngIf="!mostrarAgregar()" type="button" class="btn-completar" (click)="abrirAgregar()">
                  Agregar un familiar
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                </button>

                <div *ngIf="mostrarAgregar()" class="flex flex-col gap-5 mt-1 animate-scale-in">
                  <div class="sub-paso">
                    <span class="sub-paso__num" aria-hidden="true">1</span>
                    <div class="flex-1 min-w-0 flex flex-col gap-2">
                      <label class="sub-paso__titulo" for="agregar-buscar">¿Quién faltó?</label>
                      <ul *ngIf="agregarIds().length" class="flex flex-col gap-1.5">
                        <li *ngFor="let pid of agregarIds()" class="detail-member-row">
                          <span class="pub-item-avatar shrink-0">{{ iniciales(pid) }}</span>
                          <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1 min-w-0 break-words leading-snug">{{ nombrePublicador(pid) }}</span>
                          <button type="button" class="persona-row__quitar" (click)="quitarAgregar(pid)" [attr.aria-label]="'Quitar a ' + nombrePublicador(pid)">Quitar</button>
                        </li>
                      </ul>
                      <ng-container *ngIf="cupoAgregar(t) > 0">
                        <input id="agregar-buscar" class="form-control" type="search" autocomplete="off"
                               [placeholder]="agregarIds().length ? 'Buscar a alguien más' : 'Escribe su nombre'" aria-describedby="agregar-ayuda"
                               [ngModel]="agregarBusqueda()" (ngModelChange)="agregarBusqueda.set($event)" />
                        <ul class="flex flex-col gap-1" role="list">
                          <li *ngFor="let p of candidatosAgregar(t)">
                            <button type="button" class="candidato" (click)="elegirAgregar(p.id_publicador)">
                              <span class="pub-item-avatar shrink-0">{{ inicialesPub(p) }}</span>
                              <span class="flex-1 min-w-0 break-words text-left leading-snug">{{ nombreMostrado(p) }}</span>
                              <span class="candidato__accion">Agregar</span>
                            </button>
                          </li>
                        </ul>
                        <p *ngIf="ayudaAgregar(t) as ayuda" id="agregar-ayuda" class="field-help" style="margin:0">{{ ayuda }}</p>
                      </ng-container>
                      <p *ngIf="cupoAgregar(t) <= 0" class="field-help" style="margin:0">
                        Ya son {{ maxMiembros }} personas, el máximo. Para los demás crea otra transferencia.
                      </p>
                    </div>
                  </div>

                  <div *ngIf="agregarIds().length" class="sub-paso animate-scale-in">
                    <span class="sub-paso__num" aria-hidden="true">2</span>
                    <div class="flex-1 min-w-0 flex flex-col gap-3">
                      <p class="sub-paso__titulo">Privilegios que conserva</p>
                      <p *ngIf="cargandoImpacto()" class="destino-estado"><span class="spinner spinner-xs"></span> Revisando sus privilegios…</p>
                      <div *ngFor="let mi of impacto()" class="flex flex-col gap-1">
                        <p *ngIf="impacto().length > 1" class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ mi.nombre_completo }}</p>
                        <fieldset *ngIf="mi.privilegios.length" class="flex flex-col">
                          <legend class="sr-only">Privilegios de {{ mi.nombre_completo }}</legend>
                          <label *ngFor="let pr of mi.privilegios" class="privilegio">
                            <input type="checkbox" class="privilegio__check"
                                   [checked]="privilegiosConservar().has(pr.id_publicador_privilegio)"
                                   (change)="togglePrivilegio(pr.id_publicador_privilegio)" />
                            <span class="flex-1 text-sm text-slate-700 dark:text-slate-200">{{ pr.nombre_privilegio }}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400">desde {{ pr.fecha_inicio | date:'MMM yyyy' }}</span>
                          </label>
                        </fieldset>
                        <p *ngIf="!mi.privilegios.length" class="text-sm text-slate-500 dark:text-slate-400">No tiene privilegios vigentes.</p>
                      </div>
                      <p *ngIf="tienePrivilegios()" class="field-help" style="margin:0">Los que desmarques terminan hoy. La nueva congregación podrá volver a darlos.</p>
                    </div>
                  </div>

                  <div *ngIf="agregarIds().length && lineasImpactoTodas().length" class="sub-paso animate-scale-in">
                    <span class="sub-paso__num" aria-hidden="true">3</span>
                    <div class="flex-1 min-w-0 flex flex-col gap-2">
                      <p class="sub-paso__titulo">Lo que pasará en esta congregación</p>
                      <ul class="flex flex-col gap-1.5">
                        <li *ngFor="let l of lineasImpactoTodas()" class="impacto-linea">{{ l }}</li>
                      </ul>
                    </div>
                  </div>

                  <div class="completar__acciones">
                    <button type="button" class="btn-wizard-back" (click)="cancelarAgregar()" [disabled]="agregando()">Cancelar</button>
                    <button type="button" class="btn-confirmar" (click)="ejecutarAgregar()"
                            [disabled]="!agregarIds().length || cargandoImpacto() || agregando()">
                      <span *ngIf="agregando()" class="wizard-create-spinner"></span>
                      {{ agregando() ? 'Procesando…' : 'Trasladar a ' + (t.congregacion_destino || 'la misma congregación') }}
                    </button>
                  </div>
                </div>
              </section>

              <!-- ── Borrar el registro (no afecta al publicador) ── -->
              <div class="info-borrar pt-4">
                <button (click)="confirmandoEliminar.set(true)" class="btn-borrar-registro">
                  Borrar esta transferencia
                </button>
              </div>
            </div>

            <!-- Tab 2: Notas -->
            <div *ngIf="!esIngreso(t) && activeTab() === 'notas'" class="flex flex-col gap-4 animate-scale-in">
              <div class="field-group">
                <label class="form-label flex justify-between items-center w-full">
                  <span>Notas sobre {{ t.es_familiar ? 'los miembros' : 'el publicador' }}</span>
                  <span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Base para la carta</span>
                </label>
                <textarea rows="7" class="form-control text-sm leading-relaxed" [(ngModel)]="t.notas_para_carta" [disabled]="soloLectura(t)"
                          [placeholder]="t.es_familiar ? 'Describe a cada miembro de la familia: antigüedad, privilegios, fortalezas espirituales, por qué se transfieren...' : 'Describe las fortalezas espirituales del publicador: antigüedad, privilegios, personalidad, apoyo a las reuniones y ministerio...'"></textarea>
              </div>
              <div class="flex flex-col sm:flex-row gap-2 mt-2">
                <button (click)="guardarNotas()" [disabled]="guardandoNotas() || soloLectura(t)" class="btn-secondary flex-1 h-10 min-h-0 text-xs justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <span *ngIf="!guardandoNotas()" class="flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                    Guardar notas
                  </span>
                  <span *ngIf="guardandoNotas()" class="flex items-center gap-1.5"><span class="spinner spinner-xs text-slate-700 dark:text-slate-200"></span> Guardando…</span>
                </button>
                <button (click)="armarCarta()" [disabled]="armando() || redactando() || !t.notas_para_carta || soloLectura(t)" class="btn-primary-violet flex-1 font-bold shadow-md h-10 min-h-0 text-xs justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" [title]="!t.notas_para_carta ? 'Añade notas primero' : ''">
                  <span *ngIf="!armando()">{{ t.carta_redactada ? 'Volver a crear la carta' : 'Crear la carta con mis notas' }}</span>
                  <span *ngIf="armando()" class="flex items-center gap-1.5"><span class="spinner spinner-xs text-white"></span> Creando…</span>
                </button>
              </div>

              <!-- Mejorar redacción: opcional, solo con IA local -->
              <div *ngIf="mejoraDisponible() && !soloLectura(t)" class="mejora">
                <div class="mejora__fila">
                  <button type="button" (click)="mejorarRedaccion()" [disabled]="redactando() || armando() || !t.notas_para_carta" class="btn-buscar">
                    <span *ngIf="!redactando()">Mejorar redacción</span>
                    <span *ngIf="redactando()" class="flex items-center gap-1.5"><span class="spinner spinner-xs"></span> Mejorando…</span>
                  </button>
                  <button type="button" class="mejora__ayuda" (click)="ayudaMejora.set(!ayudaMejora())"
                          [attr.aria-expanded]="ayudaMejora()" aria-controls="mejora-ayuda" aria-label="¿Cómo funciona Mejorar redacción?">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </button>
                </div>
                <p id="mejora-ayuda" class="mejora__texto" [class.mejora__texto--abierto]="ayudaMejora()">
                  Pule el texto con una inteligencia artificial local, que funciona en un equipo propio de GAC. Tus notas no se envían a servicios de terceros.
                  {{ t.carta_redactada ? 'Reemplaza el texto actual de la carta.' : '' }}
                </p>
                <p *ngIf="!ayudaMejora()" class="mejora__pista">Opcional. Usa una IA local: tus datos no salen de GAC.</p>
                <p *ngIf="errorMejora()" class="mejora__error" role="alert">{{ errorMejora() }}</p>
                <button *ngIf="cartaAnterior() !== null" type="button" class="mejora__deshacer" (click)="deshacerMejora()">Volver a la versión anterior</button>
              </div>
              <div *ngIf="redactando()" class="mt-4 p-4 rounded-xl bg-violet-50/70 dark:bg-violet-950/10 border border-violet-100 dark:border-violet-900/30 flex flex-col gap-3 animate-pulse">
                <div class="flex items-center gap-2.5">
                  <span class="spinner spinner-sm text-violet-600 dark:text-violet-400"></span>
                  <span class="text-xs font-bold text-violet-800 dark:text-violet-300">Mejorando la redacción…</span>
                </div>
                <div class="w-full bg-violet-100 dark:bg-violet-900/50 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-violet-600 dark:bg-violet-400 h-full w-2/3 rounded-full animate-progress-fast"></div>
                </div>
                <span class="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  Pulimos el texto de la carta con tono formal y respetuoso. Al terminar, se abrirá la pestaña "Carta".
                </span>
              </div>
            </div>

            <!-- Tab 3: Carta -->
            <div *ngIf="!esIngreso(t) && activeTab() === 'carta'" class="flex flex-col gap-4 animate-scale-in">
              <div class="field-group">
                <div class="flex justify-between items-center w-full mb-1">
                  <label class="form-label mb-0">Carta redactada</label>
                  <button *ngIf="t.carta_redactada" (click)="copiarCarta(t.carta_redactada!)" class="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 flex items-center gap-1 bg-violet-50 dark:bg-violet-950/40 px-2 py-1 rounded-md border border-violet-100 dark:border-violet-900/20 transition cursor-pointer">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copiar texto
                  </button>
                </div>
                <textarea rows="9" class="form-control font-mono text-[11px] leading-relaxed select-all" [(ngModel)]="t.carta_redactada" [disabled]="soloLectura(t)"
                          placeholder="Aquí aparecerá la carta. Créala desde la pestaña Notas; después puedes editarla libremente."></textarea>
              </div>
              <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button (click)="guardarTodo()" [disabled]="guardandoTodo() || soloLectura(t)" class="btn-secondary px-3 py-2 text-xs h-9 min-h-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <span *ngIf="!guardandoTodo()" class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                    Guardar
                  </span>
                  <span *ngIf="guardandoTodo()" class="flex items-center gap-1.5"><span class="spinner spinner-xs text-slate-700 dark:text-slate-200"></span>…</span>
                </button>
                <button (click)="previsualizarCarta()" [disabled]="!t.carta_redactada || cargandoPreview()" class="btn-secondary px-3 py-2 text-xs h-9 min-h-0 cursor-pointer">
                  <span *ngIf="!cargandoPreview()" class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Vista previa
                  </span>
                  <span *ngIf="cargandoPreview()" class="flex items-center gap-1.5"><span class="spinner spinner-xs text-slate-700 dark:text-slate-200"></span>…</span>
                </button>
                <button (click)="generarPaquete()" [disabled]="!t.carta_redactada || generando() || soloLectura(t)" class="btn-primary-violet flex-1 font-bold shadow-md text-xs h-9 min-h-0 justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        [title]="soloLectura(t) ? 'La transferencia ya fue completada.' : ''">
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
    .hero-title  { font-family: var(--font-display); font-size: 1.375rem; font-weight: 800; line-height: 1.15; color: #fff; letter-spacing: -0.02em; }
    .hero-desc   { color: rgba(237,233,254,0.65); font-size: 0.75rem; margin-top: 0.125rem; line-height: 1.35; }
    @media (min-width: 1024px) { .hero-title { font-size: 1.5rem; } }
    .hero-inner  { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 1rem; }
    .hero-btn-desktop { display: inline-flex; }
    @media (max-width: 767px) { .hero-desc { display: none; } }
    @media (max-width: 479px) {
      .hero-eyebrow { display: none; }
      .hero-title { font-size: 1.2rem; }
      .hero-inner { gap: 0.625rem; }
    }

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

    /* Header */
    .modal-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      padding: 1.5rem 1.5rem 0;
      flex-shrink: 0;
    }
    .modal-step-label {
      font-size: 0.75rem; font-weight: 600; color: #6d28d9; line-height: 1.2; margin-bottom: 0.25rem;
    }
    :host-context(.dark) .modal-step-label { color: #a78bfa; }
    .modal-title {
      font-family: var(--font-display, inherit);
      font-size: 1.0625rem; font-weight: 700; color: #0f172a; line-height: 1.3;
      text-wrap: balance;
    }
    :host-context(.dark) .modal-title { color: #f1f5f9; }
    .modal-close-btn {
      display: flex; align-items: center; justify-content: center;
      width: 2.5rem; height: 2.5rem; margin: -0.5rem -0.5rem 0 0; border-radius: 0.625rem; border: none; cursor: pointer;
      color: #94a3b8; background: transparent; flex-shrink: 0;
      transition: color 130ms ease, background 130ms ease;
    }
    .modal-close-btn:hover { color: #64748b; background: #f1f5f9; }
    :host-context(.dark) .modal-close-btn:hover { color: #cbd5e1; background: rgba(255,255,255,0.07); }

    /* Stepper inside modal */
    .modal-stepper {
      display: flex; align-items: flex-start;
      padding: 1.25rem 1.5rem 0; margin: 0; list-style: none;
      flex-shrink: 0;
    }

    /* Scrollable step content */
    .modal-body {
      flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
      padding: 1.5rem;
    }

    /* Footer */
    .modal-footer {
      display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid #f1f5f9;
      background: #fafafa;
      flex-shrink: 0;
    }
    :host-context(.dark) .modal-footer {
      border-top-color: rgba(51,65,85,0.5);
      background: rgba(15,23,42,0.6);
    }

    /* Vista previa de la carta */
    .carta-preview-dialog {
      max-width: 720px;
      width: 100%;
      height: 90dvh;
    }
    .carta-preview-iframe {
      flex: 1;
      min-height: 0;
      width: 100%;
      border: 0;
      background: #fff;
    }

    /* Teléfono: hoja inferior, botones a lo ancho y al alcance del pulgar */
    @media (max-width: 639px) {
      .modal-overlay { padding: 0; align-items: flex-end; }
      .modal-dialog  { max-width: 100%; border-radius: 1.25rem 1.25rem 0 0; max-height: 94dvh; }
      .modal-header  { padding: 1.25rem 1.25rem 0; }
      .modal-stepper { padding: 1rem 1.25rem 0; }
      .modal-body    { padding: 1.25rem; }
      .modal-footer  { padding: 0.875rem 1.25rem calc(0.875rem + env(safe-area-inset-bottom)); }
      .modal-footer > button { flex: 1; justify-content: center; }
      .btn-wizard-next, .btn-wizard-back, .btn-confirmar, .btn-completar, .btn-buscar, .btn-guardar-datos,
      .pub-dropdown-trigger, .pub-dropdown-item, .persona-row__quitar, .btn-borrar-registro { min-height: 2.75rem; }
      .paso__accion { min-height: 2.75rem; }
      .privilegio { min-height: 2.75rem; }
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
    @keyframes spinnerRing {
      to { transform: rotate(360deg); }
    }
    /* Scrollable content area */
    .wizard-body {
      flex: 1;
      min-height: 0;
    }

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
      font-size: 0.75rem; font-weight: 700; color: #64748b;
      transition: border-color 250ms ease, background 250ms ease,
                  color 250ms ease, box-shadow 250ms ease;
      flex-shrink: 0;
    }
    .wizard-step__label {
      font-size: 0.75rem; font-weight: 600; color: #64748b; white-space: nowrap;
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
      margin: 0 0.5rem; margin-top: 0.9rem;
      overflow: hidden; border-radius: 2px; min-width: 0;
    }
    .wizard-step-fill {
      height: 100%; width: 100%;
      background: #7c3aed;
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
    .wizard-step-content .consent-alert {
      animation: fieldStagger 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: calc(var(--field-i, 0) * 55ms + 80ms);
    }
    .wizard-step-content .consent-alert { animation-delay: 220ms; }

    /* ── Texto guía de cada paso y ayudas bajo los campos ── */
    .wizard-lead { font-size: 0.875rem; line-height: 1.5; color: #475569; max-width: 60ch; }
    :host-context(.dark) .wizard-lead { color: #cbd5e1; }
    .field-help { font-size: 0.75rem; line-height: 1.5; color: #64748b; margin-top: 0.375rem; }
    :host-context(.dark) .field-help { color: #94a3b8; }

    /* Persona elegida en el paso 1 */
    .persona-row {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.625rem 0.5rem 0.625rem 0.75rem; border-radius: 0.875rem;
      border: 1px solid #e2e8f0; background: #fff;
      animation: fieldStagger 0.22s cubic-bezier(0.22,1,0.36,1) both;
    }
    :host-context(.dark) .persona-row { border-color: #334155; background: #0f172a; }
    .persona-row__quitar {
      min-height: 2.5rem; padding: 0 0.75rem; border-radius: 0.625rem; border: none; cursor: pointer;
      font-size: 0.75rem; font-weight: 600; color: #64748b; background: transparent;
      transition: color 150ms ease, background-color 150ms ease;
    }
    .persona-row__quitar:hover { color: #b91c1c; background: #fef2f2; }
    :host-context(.dark) .persona-row__quitar:hover { color: #fca5a5; background: rgba(239,68,68,0.1); }
    .pub-dropdown-trigger--agregar {
      border-style: dashed !important; color: #6d28d9 !important; font-weight: 600; justify-content: flex-start;
    }
    :host-context(.dark) .pub-dropdown-trigger--agregar { color: #c4b5fd !important; }
    .consent-alert {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 0.875rem 1rem; border-radius: 0.75rem;
      background: #fffbeb; border: 1px solid #fde68a;
      color: #92400e;
    }
    :host-context(.dark) .consent-alert       { background: rgba(251,191,36,0.06); border-color: rgba(251,191,36,0.2); color: #fbbf24; }


    /* ── Wizard buttons ── */
    .btn-wizard-next, .btn-wizard-back {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
      min-height: 2.5rem; padding: 0 1rem; font-size: 0.875rem; font-weight: 600;
      border-radius: 0.5rem; cursor: pointer;
      transition: background-color 150ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease;
    }
    .btn-wizard-next { margin-left: auto; border: none; background: #6d28d9; color: #fff; }
    .btn-wizard-back { border: 1px solid #d1d5db; background: #fff; color: #374151; font-weight: 500; }
    :host-context(.dark) .btn-wizard-back { border-color: #334155; background: transparent; color: #e2e8f0; }
    @media (hover: hover) and (pointer: fine) {
      .btn-wizard-next:hover:not(:disabled) { background: #5b21b6; }
      .btn-wizard-back:hover:not(:disabled) { background: #f8fafc; }
      :host-context(.dark) .btn-wizard-back:hover:not(:disabled) { background: rgba(255,255,255,0.05); }
    }
    .btn-wizard-next:active:not(:disabled), .btn-wizard-back:active:not(:disabled) { transform: scale(0.97); }
    .btn-wizard-next:disabled, .btn-wizard-back:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-wizard-next:focus-visible, .btn-wizard-back:focus-visible { outline: 2px solid #7c3aed; outline-offset: 2px; }

    .wizard-create-spinner {
      width: 0.875rem; height: 0.875rem; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      animation: spinnerRing 0.7s linear infinite;
      display: inline-block;
    }

    /* ── Avatares apilados (familia en detalle) ──
       Círculos que se montan unos sobre otros con un anillo del color del panel
       para separarlos. flex-shrink: 0 es lo que evita que el contenedor los
       aplaste. Cada avatar queda sobre el anterior (orden natural del DOM) y el
       solape es corto: así las iniciales, centradas, nunca quedan tapadas. */
    @keyframes avatarIn {
      from { opacity: 0; transform: scale(0.9); }
      to   { opacity: 1; transform: scale(1); }
    }
    .family-avatars { display: flex; align-items: center; flex-shrink: 0; padding-left: 0.125rem; }
    .family-avatar {
      position: relative; flex-shrink: 0;
      width: 2.5rem; height: 2.5rem; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; line-height: 1; letter-spacing: 0.01em; color: #fff;
      background: #5b21b6;
      box-shadow: 0 0 0 2px #fff;
      margin-left: -0.5rem;
      animation: avatarIn 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
      animation-delay: calc(var(--i, 0) * 40ms);
    }
    .family-avatar:first-child { margin-left: 0; }
    .family-avatar:nth-child(even) { background: #7c3aed; }
    .family-avatar--mas { background: #e2e8f0 !important; color: #475569; }
    :host-context(.dark) .family-avatar { box-shadow: 0 0 0 2px #1e293b; }
    :host-context(.dark) .family-avatar--mas { background: #334155 !important; color: #cbd5e1; }
    @media (prefers-reduced-motion: reduce) { .family-avatar { animation: none; } }

    /* ── Filter pills ── */
    /* Con cuatro chips y el detalle abierto no caben: se acomodan en dos filas en vez de cortarse. */
    .filter-pills-wrap { flex-wrap: wrap; max-width: 100%; }
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
      white-space: nowrap; flex-shrink: 0;
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
    @media (max-width: 479px) {
      .btn-hero { padding: 0.5rem 0.8rem; font-size: 0.75rem; gap: 0.35rem; border-radius: 0.625rem; }
    }

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
      /* Detail keeps a usable minimum width so the carta/notes never get cramped */
      .workspace--with-detail { grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); }
      /* List panel: fill and scroll list internally */
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
    @media (min-width: 1280px) {
      .workspace--with-detail { grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); }
    }
    @media (max-width: 1023px) { .workspace--mobile-detail .list-panel { display: none; } }

    /* ── Adaptive list: table ⇆ compact cards, driven by the PANEL's own width ──
       (container query, not viewport). This guarantees the list never triggers a
       horizontal scrollbar when the detail panel narrows it on a MacBook 14"/16". */
    .list-panel { container-type: inline-size; container-name: listpanel; }
    .list-table-wrap { display: none; flex-direction: column; }
    .mobile-cards    { display: flex; flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    @container listpanel (min-width: 720px) {
      .list-table-wrap { display: flex; }
      .mobile-cards    { display: none; }
    }
    /* Filter pills: fill the row on a narrow panel so labels never clip */
    @container listpanel (max-width: 468px) {
      .filter-pills-wrap { width: 100%; }
      .filter-pill { flex: 1 1 0; justify-content: center; padding-left: 0.4rem; padding-right: 0.4rem; }
    }

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
      min-height: 2.5rem; padding: 0.5rem 0.75rem; font-size: 0.8125rem; cursor: pointer; text-align: left;
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
      font-size: 0.8125rem; color: #1e293b; padding: 0.25rem 0;
    }
    .pub-search-input::placeholder { color: #94a3b8; }
    .pub-search-clear {
      display: flex; align-items: center; justify-content: center;
      width: 1.25rem; height: 1.25rem; border-radius: 50%;
      background: #e2e8f0; color: #64748b; cursor: pointer; border: none;
      transition: background 100ms ease;
    }
    .pub-search-clear:hover { background: #cbd5e1; }
    .pub-dropdown-list { overflow-y: auto; max-height: min(18rem, 45dvh); overscroll-behavior: contain; }

    :host-context(.dark) .pub-search-wrap { background: #1e293b; border-bottom-color: #334155; }
    :host-context(.dark) .pub-search-input { color: #f1f5f9; }
    :host-context(.dark) .pub-search-clear { background: #334155; color: #94a3b8; }
    :host-context(.dark) .pub-search-clear:hover { background: #475569; }

    .pub-item-badge {
      font-size: 0.6875rem; font-weight: 600; padding: 0.125rem 0.4rem;
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
      font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; color: #64748b; margin-bottom: 0.625rem;
    }
    :host-context(.dark) .detail-section__label { color: #94a3b8; }

    /* Fila de miembro en lista familiar */
    .detail-member-row {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.5rem 0.625rem; border-radius: 0.625rem;
      background: #f8fafc;
      transition: background 100ms ease;
    }
    :host-context(.dark) .detail-member-row { background: rgba(30,41,59,0.6); }

    /* ── Mejorar redacción (opcional) ── */
    .mejora { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem 0.875rem; border-radius: 0.75rem; border: 1px dashed #cbd5e1; }
    :host-context(.dark) .mejora { border-color: #334155; }
    .mejora__fila { display: flex; align-items: center; gap: 0.5rem; }
    .mejora__ayuda {
      display: inline-flex; align-items: center; justify-content: center;
      width: 2.5rem; height: 2.5rem; border-radius: 0.5rem; color: #6d28d9; background: transparent; cursor: pointer;
      transition: background 120ms ease;
    }
    .mejora__ayuda:hover { background: #f5f3ff; }
    .mejora__ayuda:focus-visible { outline: 2px solid #7c3aed; outline-offset: 2px; }
    :host-context(.dark) .mejora__ayuda { color: #c4b5fd; }
    :host-context(.dark) .mejora__ayuda:hover { background: rgba(109,40,217,0.15); }
    .mejora__texto { display: none; font-size: 0.8125rem; line-height: 1.5; color: #475569; margin: 0; }
    .mejora__texto--abierto { display: block; }
    :host-context(.dark) .mejora__texto { color: #cbd5e1; }
    .mejora__pista { font-size: 0.75rem; color: #64748b; margin: 0; }
    :host-context(.dark) .mejora__pista { color: #94a3b8; }
    .mejora__error { font-size: 0.8125rem; line-height: 1.5; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 0.5rem; padding: 0.5rem 0.625rem; margin: 0; }
    :host-context(.dark) .mejora__error { color: #fcd34d; background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); }
    .mejora__deshacer { align-self: flex-start; font-size: 0.8125rem; font-weight: 600; color: #6d28d9; text-decoration: underline; cursor: pointer; min-height: 2.5rem; }
    :host-context(.dark) .mejora__deshacer { color: #c4b5fd; }
    @media (max-width: 639px) { .mejora__ayuda { width: 2.75rem; height: 2.75rem; } }

    /* ── Búsqueda de la congregación destino ── */
    .combo { position: relative; }
    .combo__lista {
      position: absolute; left: 0; right: 0; top: calc(100% + 0.25rem); z-index: 20;
      max-height: 15rem; overflow-y: auto; padding: 0.25rem; list-style: none; margin: 0;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
      box-shadow: 0 8px 24px -8px rgba(15,23,42,0.18);
    }
    :host-context(.dark) .combo__lista { background: #1e293b; border-color: #334155; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.5); }
    .combo__opcion {
      display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%;
      min-height: 2.75rem; padding: 0.375rem 0.625rem; border-radius: 0.5rem; text-align: left; cursor: pointer;
      font-size: 0.875rem; color: #1e293b; background: transparent;
      transition: background 100ms ease;
    }
    .combo__opcion:hover, .combo__opcion:focus-visible { background: #f5f3ff; outline: none; }
    :host-context(.dark) .combo__opcion { color: #e2e8f0; }
    :host-context(.dark) .combo__opcion:hover, :host-context(.dark) .combo__opcion:focus-visible { background: rgba(109,40,217,0.18); }
    .combo__nombre { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
    .combo__numero { font-size: 0.75rem; color: #64748b; white-space: nowrap; flex-shrink: 0; }
    :host-context(.dark) .combo__numero { color: #94a3b8; }

    .badge-recibida { background: #e0f2fe; color: #075985; }
    :host-context(.dark) .badge-recibida { background: rgba(14,165,233,0.15); color: #7dd3fc; }

    /* Candidato al buscar un familiar que faltó: toda la fila es el botón */
    .candidato {
      display: flex; align-items: center; gap: 0.625rem; width: 100%;
      min-height: 2.75rem; padding: 0.375rem 0.625rem; border-radius: 0.625rem;
      font-size: 0.875rem; font-weight: 600; color: #1e293b;
      background: transparent; border: 1px solid #e2e8f0; cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, transform 100ms ease;
    }
    .candidato:hover { background: #f5f3ff; border-color: #ddd6fe; }
    .candidato:active { transform: scale(0.99); }
    .candidato:focus-visible { outline: 2px solid #7c3aed; outline-offset: 2px; }
    .candidato__accion { font-size: 0.75rem; font-weight: 700; color: #6d28d9; }
    :host-context(.dark) .candidato { color: #e2e8f0; border-color: #334155; }
    :host-context(.dark) .candidato:hover { background: rgba(109,40,217,0.12); border-color: #5b21b6; }
    :host-context(.dark) .candidato__accion { color: #c4b5fd; }
    @media (prefers-reduced-motion: reduce) { .candidato { transition: none; } .candidato:active { transform: none; } }

    /* ── Detail header subtitle — single clean line "→ Destino · N miembros" ── */
    .detail-subtitle {
      display: flex; align-items: center; gap: 0.375rem;
      margin-top: 0.15rem; min-width: 0; font-size: 0.75rem; color: #64748b;
    }
    :host-context(.dark) .detail-subtitle { color: #94a3b8; }
    .detail-subtitle > svg { color: #8b5cf6; flex-shrink: 0; }
    .detail-subtitle__dest {
      font-weight: 600; color: #334155; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    :host-context(.dark) .detail-subtitle__dest { color: #e2e8f0; }
    .detail-subtitle__tag {
      flex-shrink: 0; font-size: 0.625rem; font-weight: 700; line-height: 1;
      padding: 0.2rem 0.4rem; border-radius: 0.375rem;
      background: #ede9fe; color: #6d28d9;
    }
    :host-context(.dark) .detail-subtitle__tag { background: rgba(109,40,217,0.22); color: #c4b5fd; }

    /* ── Detalle: una columna estrecha, dos cuando hay ancho ──────
       Se decide por el ancho del propio panel (no de la ventana): con el
       listado a un lado, el detalle puede ser ancho aunque la pantalla no lo sea. */
    .detail-panel { container-type: inline-size; container-name: detalle; }
    .detail-info-tab { display: flex; flex-direction: column; }
    .detail-section { padding: 1.25rem 0; }
    .pasos { gap: 0.375rem; }
    @container detalle (min-width: 700px) {
      .detail-info-tab {
        display: grid; align-content: start;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
        column-gap: 2.5rem;
        /* El sobrante de la tarjeta alta de la derecha lo absorbe "datos", no "pasos" */
        grid-template-rows: auto auto 1fr auto;
        grid-template-areas:
          "alertas alertas"
          "pasos   completar"
          "datos   completar"
          "borrar  borrar";
      }
      .info-alertas  { grid-area: alertas; }
      .info-pasos    { grid-area: pasos; }
      .info-datos    { grid-area: datos; border-bottom: none; }
      .info-completar{ grid-area: completar; align-self: start; margin-top: 1.25rem; }
      .info-borrar   { grid-area: borrar; }
      /* Solo lectura: sin "Completar", los datos ocupan todo el ancho */
      .detail-info-tab:not(:has(.info-completar)) { grid-template-areas: "alertas alertas" "datos datos" "borrar borrar"; }
    }

    /* ── Guía de pasos ─────────────────────────────────────────── */
    .pasos { display: flex; flex-direction: column; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
    .paso {
      display: flex; align-items: center; gap: 0.75rem;
      min-height: 2.75rem; padding: 0.25rem 0.375rem 0.25rem 0.5rem; border-radius: 0.625rem;
      transition: background-color 200ms ease;
    }
    .paso--actual { background: #f5f3ff; }
    :host-context(.dark) .paso--actual { background: rgba(124,58,237,0.12); }
    .paso__marca {
      width: 1.5rem; height: 1.5rem; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; color: #64748b;
      border: 2px solid #cbd5e1; background: #fff;
      transition: background-color 250ms ease, border-color 250ms ease, color 250ms ease;
    }
    .paso__marca svg { width: 0.75rem; height: 0.75rem; }
    .paso--actual .paso__marca { border-color: #7c3aed; color: #6d28d9; }
    .paso--hecho .paso__marca  { border-color: #059669; background: #059669; color: #fff; }
    :host-context(.dark) .paso__marca { background: #0f172a; border-color: #475569; color: #94a3b8; }
    :host-context(.dark) .paso--actual .paso__marca { border-color: #a78bfa; color: #c4b5fd; }
    :host-context(.dark) .paso--hecho .paso__marca  { border-color: #10b981; background: #10b981; color: #052e16; }
    .paso__titulo { flex: 1; min-width: 0; font-size: 0.8125rem; line-height: 1.35; color: #334155; }
    .paso--hecho .paso__titulo { color: #64748b; }
    .paso--actual .paso__titulo { font-weight: 700; color: #1e1b4b; }
    :host-context(.dark) .paso__titulo { color: #cbd5e1; }
    :host-context(.dark) .paso--hecho .paso__titulo { color: #94a3b8; }
    :host-context(.dark) .paso--actual .paso__titulo { color: #f5f3ff; }
    .paso__accion {
      min-height: 2.25rem; min-width: 4.25rem; padding: 0 0.75rem; border-radius: 0.5rem; flex-shrink: 0;
      font-size: 0.75rem; font-weight: 600; cursor: pointer;
      color: #6d28d9; background: transparent; border: 1px solid transparent;
      transition: background-color 150ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1);
    }
    .paso--actual .paso__accion { background: #6d28d9; color: #fff; }
    @media (hover: hover) and (pointer: fine) {
      .paso__accion:hover:not(:disabled) { background: #ede9fe; }
      .paso--actual .paso__accion:hover:not(:disabled) { background: #5b21b6; }
      :host-context(.dark) .paso__accion:hover:not(:disabled) { background: rgba(124,58,237,0.18); }
    }
    .paso__accion:active:not(:disabled) { transform: scale(0.97); }
    .paso__accion:disabled { opacity: 0.45; cursor: not-allowed; }
    :host-context(.dark) .paso__accion { color: #c4b5fd; }
    :host-context(.dark) .paso--actual .paso__accion { background: #7c3aed; color: #fff; }

    .btn-guardar-datos {
      align-self: flex-start; display: inline-flex; align-items: center; gap: 0.5rem;
      min-height: 2.5rem; padding: 0 1rem; border-radius: 0.5rem; cursor: pointer;
      font-size: 0.875rem; font-weight: 500; color: #374151; background: #fff; border: 1px solid #d1d5db;
      transition: background-color 150ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1);
    }
    .btn-guardar-datos:active:not(:disabled) { transform: scale(0.97); }
    .btn-guardar-datos:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (hover: hover) and (pointer: fine) { .btn-guardar-datos:hover:not(:disabled) { background: #f8fafc; } }
    :host-context(.dark) .btn-guardar-datos { color: #e2e8f0; background: transparent; border-color: #334155; }

    /* ── Completar la transferencia ────────────────────────────── */
    .completar {
      margin-top: 0.5rem; padding: 1.25rem; border-radius: 1rem;
      border: 1px solid #ddd6fe; background: #faf8ff;
      scroll-margin-top: 1rem;
    }
    :host-context(.dark) .completar { border-color: rgba(124,58,237,0.3); background: rgba(124,58,237,0.06); }
    @media (max-width: 639px) {
      .completar { padding: 1rem; margin-left: -0.25rem; margin-right: -0.25rem; }
      .opcion { padding: 0.875rem; gap: 0.75rem; }
    }
    .completar__eyebrow { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6d28d9; margin-bottom: 0.25rem; }
    :host-context(.dark) .completar__eyebrow { color: #c4b5fd; }
    .completar__titulo { font-family: var(--font-display, inherit); font-size: 1rem; font-weight: 700; color: #1e1b4b; line-height: 1.3; }
    :host-context(.dark) .completar__titulo { color: #f5f3ff; }
    .completar__desc { font-size: 0.8125rem; line-height: 1.5; color: #475569; margin: 0.375rem 0 1rem; max-width: 60ch; }
    :host-context(.dark) .completar__desc { color: #cbd5e1; }
    .completar__pregunta { font-size: 0.875rem; font-weight: 600; color: #1e293b; margin-bottom: 0.25rem; }
    :host-context(.dark) .completar__pregunta { color: #f1f5f9; }
    .completar__acciones { display: flex; gap: 0.75rem; padding-top: 0.25rem; }
    .completar__acciones > button { flex: 1; }
    @media (min-width: 640px) { .completar__acciones { justify-content: flex-end; } .completar__acciones > button { flex: none; } }

    .btn-completar {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
      width: 100%; min-height: 2.5rem; border-radius: 0.5rem; border: none; cursor: pointer;
      font-size: 0.875rem; font-weight: 600; background: #6d28d9; color: #fff;
      transition: background-color 150ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1);
    }
    @media (hover: hover) and (pointer: fine) { .btn-completar:hover { background: #5b21b6; } }
    .btn-completar:active { transform: scale(0.98); }

    /* Opción grande tipo radio: toda la tarjeta es el área de toque */
    .opcion {
      position: relative; display: flex; align-items: flex-start; gap: 0.875rem;
      padding: 0.75rem 0.875rem; border-radius: 0.75rem; cursor: pointer;
      border: 1.5px solid #e2e8f0; background: #fff;
      transition: border-color 180ms ease, background-color 180ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1);
    }
    .opcion:active { transform: scale(0.99); }
    @media (hover: hover) and (pointer: fine) { .opcion:hover { border-color: #c4b5fd; } }
    .opcion--activa { border-color: #7c3aed; background: #f5f3ff; }
    .opcion--peligro.opcion--activa { border-color: #dc2626; background: #fef2f2; }
    :host-context(.dark) .opcion { border-color: #334155; background: #0f172a; }
    :host-context(.dark) .opcion--activa { border-color: #a78bfa; background: rgba(124,58,237,0.12); }
    :host-context(.dark) .opcion--peligro.opcion--activa { border-color: #f87171; background: rgba(239,68,68,0.1); }
    .opcion__input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .opcion:has(.opcion__input:focus-visible) { outline: 2px solid #7c3aed; outline-offset: 2px; }
    .opcion__radio {
      width: 1.125rem; height: 1.125rem; border-radius: 50%; flex-shrink: 0; margin-top: 0.125rem;
      border: 2px solid #94a3b8; background: #fff;
      transition: border-color 180ms ease, box-shadow 180ms cubic-bezier(0.23,1,0.32,1);
    }
    .opcion--activa .opcion__radio { border-color: #7c3aed; box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 9px #7c3aed; }
    .opcion--peligro.opcion--activa .opcion__radio { border-color: #dc2626; box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 9px #dc2626; }
    :host-context(.dark) .opcion__radio { background: #0f172a; border-color: #64748b; }
    :host-context(.dark) .opcion--activa .opcion__radio { border-color: #a78bfa; box-shadow: inset 0 0 0 3px #0f172a, inset 0 0 0 9px #a78bfa; }
    :host-context(.dark) .opcion--peligro.opcion--activa .opcion__radio { border-color: #f87171; box-shadow: inset 0 0 0 3px #0f172a, inset 0 0 0 9px #f87171; }
    .opcion__cuerpo { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
    .opcion__titulo { font-size: 0.875rem; font-weight: 600; color: #1e293b; line-height: 1.3; }
    .opcion__desc { font-size: 0.75rem; line-height: 1.5; color: #475569; }
    :host-context(.dark) .opcion__titulo { color: #f1f5f9; }
    :host-context(.dark) .opcion__desc { color: #cbd5e1; }

    /* Sub-pasos numerados del traslado */
    .sub-paso { display: flex; gap: 0.75rem; }
    .sub-paso__num {
      width: 1.375rem; height: 1.375rem; border-radius: 50%; flex-shrink: 0; margin-top: 0.0625rem;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.6875rem; font-weight: 700; background: #ede9fe; color: #5b21b6;
    }
    :host-context(.dark) .sub-paso__num { background: rgba(124,58,237,0.25); color: #ddd6fe; }
    .sub-paso__titulo { font-size: 0.875rem; font-weight: 600; color: #1e293b; line-height: 1.35; }
    :host-context(.dark) .sub-paso__titulo { color: #f1f5f9; }

    .btn-buscar {
      min-height: 2.5rem; padding: 0 0.875rem; border-radius: 0.5rem; cursor: pointer; flex-shrink: 0;
      font-size: 0.8125rem; font-weight: 500; color: #5b21b6; background: #fff; border: 1px solid #c4b5fd;
      transition: background-color 150ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1);
    }
    .btn-buscar:active:not(:disabled) { transform: scale(0.97); }
    .btn-buscar:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (hover: hover) and (pointer: fine) { .btn-buscar:hover:not(:disabled) { background: #f5f3ff; } }
    :host-context(.dark) .btn-buscar { color: #ddd6fe; background: transparent; border-color: rgba(167,139,250,0.5); }

    .destino-estado { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: #475569; }
    .destino-estado--ok { font-weight: 700; color: #047857; }
    .destino-estado--error { font-weight: 600; color: #b91c1c; }
    :host-context(.dark) .destino-estado { color: #cbd5e1; }
    :host-context(.dark) .destino-estado--ok { color: #34d399; }
    :host-context(.dark) .destino-estado--error { color: #fca5a5; }

    .privilegio, .confirmacion {
      display: flex; align-items: center; gap: 0.75rem;
      min-height: 2.5rem; padding: 0.25rem 0.5rem; margin: 0 -0.5rem; border-radius: 0.5rem; cursor: pointer;
      transition: background-color 150ms ease;
    }
    .confirmacion { align-items: flex-start; padding: 0.75rem; margin: 0; border: 1px solid #fecaca; background: #fff; }
    :host-context(.dark) .confirmacion { border-color: rgba(248,113,113,0.35); background: transparent; }
    @media (hover: hover) and (pointer: fine) {
      .privilegio:hover { background: rgba(124,58,237,0.06); }
    }
    .privilegio__check { width: 1.125rem; height: 1.125rem; flex-shrink: 0; accent-color: #6d28d9; cursor: pointer; }
    .confirmacion .privilegio__check { accent-color: #dc2626; margin-top: 0.125rem; }

    .impacto-linea { position: relative; padding-left: 1rem; font-size: 0.8125rem; line-height: 1.5; color: #475569; }
    .impacto-linea::before {
      content: ''; position: absolute; left: 0; top: 0.55em;
      width: 0.375rem; height: 0.375rem; border-radius: 50%; background: #a78bfa;
    }
    :host-context(.dark) .impacto-linea { color: #cbd5e1; }

    .btn-confirmar {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
      min-height: 2.5rem; padding: 0 1rem; border-radius: 0.5rem; border: none; cursor: pointer;
      font-size: 0.875rem; font-weight: 600; background: #6d28d9; color: #fff;
      transition: background-color 150ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease;
    }
    .btn-confirmar--peligro { background: #dc2626; }
    @media (hover: hover) and (pointer: fine) {
      .btn-confirmar:hover:not(:disabled) { background: #5b21b6; }
      .btn-confirmar--peligro:hover:not(:disabled) { background: #b91c1c; }
    }
    .btn-confirmar:active:not(:disabled) { transform: scale(0.97); }
    .btn-confirmar:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn-confirmar:focus-visible, .btn-completar:focus-visible, .paso__accion:focus-visible,
    .btn-buscar:focus-visible, .btn-guardar-datos:focus-visible, .btn-borrar-registro:focus-visible {
      outline: 2px solid #7c3aed; outline-offset: 2px;
    }

    .btn-borrar-registro {
      min-height: 2.5rem; padding: 0 0.75rem; margin-left: -0.75rem; border-radius: 0.5rem; border: none; cursor: pointer;
      font-size: 0.8125rem; font-weight: 500; color: #b91c1c; background: transparent;
      transition: background-color 150ms ease;
    }
    @media (hover: hover) and (pointer: fine) { .btn-borrar-registro:hover { background: #fef2f2; } }
    :host-context(.dark) .btn-borrar-registro { color: #fca5a5; }
    :host-context(.dark) .btn-borrar-registro:hover { background: rgba(239,68,68,0.1); }

    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

    @media (prefers-reduced-motion: reduce) {
      .paso, .paso__marca, .opcion, .opcion__radio, .persona-row { transition: none; animation: none; }
    }

    /* ── iOS / touch polish ──────────────────────────────────────
       • Inputs at 16px on phones so Safari never auto-zooms on focus.
       • Kill the grey tap-flash on iOS.
       • Momentum scrolling + safe-area insets for notch / home-indicator. */
    @media (max-width: 767px) {
      :host input, :host textarea, :host select,
      .form-control, .pub-search-input { font-size: 16px; }
    }
    :host * { -webkit-tap-highlight-color: transparent; }
    .modal-body, .pub-dropdown-list { -webkit-overflow-scrolling: touch; }
    .toast-container {
      bottom: calc(1.5rem + env(safe-area-inset-bottom));
      right:  calc(1.5rem + env(safe-area-inset-right));
    }
    @media (max-width: 479px) {
      .modal-dialog { padding-bottom: env(safe-area-inset-bottom); }
    }
  `]
})
export class TransferenciasPage implements OnInit, OnDestroy {
  /** Expuesto a la plantilla: las funciones sueltas no son accesibles desde el HTML. */
  readonly nombreMostrado = nombreMostrado;
  /** Igual que MAX_MIEMBROS en el backend (transferencia_schema.py). */
  readonly maxMiembros = 8;

  private svc = inject(TransferenciaService);
  private http = inject(HttpClient);
  private ctx = inject(CongregacionContextService);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);

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
  armando        = signal(false);
  mejoraDisponible = signal(false);
  ayudaMejora    = signal(false);
  errorMejora    = signal<string | null>(null);
  /** Carta anterior a la última mejora, para poder volver. */
  cartaAnterior  = signal<string | null>(null);

  // ── Vista previa de la carta ─────────────────────────────────
  cargandoPreview  = signal(false);
  mostrandoPreview = signal(false);
  previewUrl       = signal<SafeResourceUrl | null>(null);
  private previewObjectUrl: string | null = null;

  // ── Wizard ──────────────────────────────────────────────────
  creando             = signal(false);
  wizardPaso          = signal<1|2|3>(1);
  wizardDir           = signal<'forward' | 'back'>('forward');
  creandoTransferencia = signal(false);
  creandoFase         = signal('Creando…');
  pubDropOpen         = signal(false);
  pubDropPos          = signal<{top: number; left: number; width: number}>({top: 0, left: 0, width: 0});
  pubSearch           = signal('');

  // ── Completar transferencia (trasladar / eliminar) ───────────
  mostrarCompletar    = signal(false);
  completarAccion     = signal<'trasladar' | 'eliminar' | null>(null);
  numeroCongDestino   = signal('');
  completando         = signal(false);
  impacto             = signal<ImpactoMiembro[]>([]);
  cargandoImpacto     = signal(false);
  privilegiosConservar = signal<Set<number>>(new Set());
  verificandoDestino  = signal(false);
  resultadosCong      = signal<CongregacionBuscada[]>([]);
  consultaCongHecha   = signal(false);
  private busquedaCongTimer: ReturnType<typeof setTimeout> | null = null;
  destinoVerificado   = signal<CongregacionDestino | null>(null);
  errorDestino        = signal<string | null>(null);
  confirmaEliminar    = signal(false);

  // ── Agregar a un familiar que faltó (traslado ya hecho) ──────
  mostrarAgregar      = signal(false);
  agregarIds          = signal<number[]>([]);
  agregarBusqueda     = signal('');
  agregando           = signal(false);

  // ── Filtro lista ─────────────────────────────────────────────
  filtro = signal<'todos' | 'borrador' | 'finalizada' | 'recibidas'>('todos');

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
    if (f === 'recibidas') return this.items().filter(t => this.esIngreso(t));
    return this.items().filter(t => !this.esIngreso(t) && t.estado === f);
  });

  /** Publicadores no seleccionados aún en el wizard */
  publicadoresDisponibles(): PublicadorLite[] {
    const sel = this.form.id_publicadores;
    return this.publicadores().filter(p => !sel.includes(p.id_publicador));
  }

  /** Publicadores filtrados por búsqueda dentro del dropdown */
  publicadoresBuscados(): PublicadorLite[] {
    const q = this.pubSearch().toLowerCase().trim();
    const base = this.publicadoresDisponibles();
    if (!q) return base;
    return base.filter(p =>
      (nombreMostrado(p) + ' ' + nombreLegal(p)).toLowerCase().includes(q)
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
    this.svc.mejoraDisponible().subscribe({ next: r => this.mejoraDisponible.set(r.disponible), error: () => this.mejoraDisponible.set(false) });
    this.svc.list().subscribe({
      next: t => {
        this.items.set(t);
        this.loading.set(false);
        // Desde una notificación: /transferencias?id=123 abre esa transferencia.
        const id = Number(this.route.snapshot.queryParamMap.get('id'));
        const abierta = id ? t.find(x => x.id_transferencia === id) : undefined;
        if (abierta) {
          if (this.esIngreso(abierta)) this.filtro.set('recibidas');
          this.abrir(abierta);
        }
      },
      error: () => { this.loading.set(false); this.toast('error', 'No se pudieron cargar las transferencias'); },
    });
    const idCong  = this.ctx.effectiveCongregacionId();
    const params: any = {};
    if (idCong) params.id_congregacion = idCong;
    params.limit = 1000;
    this.http.get<PublicadorLite[]>(`${environment.apiUrl}/publicadores/`, { params }).subscribe({
      next:  p => this.publicadores.set(p),
      error: () => this.toast('error', 'No se pudieron cargar los publicadores'),
    });
  }

  ngOnDestroy() {
    if (this.busquedaCongTimer) clearTimeout(this.busquedaCongTimer);
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
  }

  // ── Wizard helpers ───────────────────────────────────────────
  abrirWizard() {
    this.form = this._resetForm();
    this.wizardPaso.set(1);
    this.creando.set(true);
  }

  cerrarWizard() {
    if (this.creandoTransferencia()) return;
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

  /**
   * Agrega una persona. No hay que elegir antes "individual" o "familiar":
   * con dos o más es una familia (el backend lo deduce igual del número).
   */
  selectPub(id: number | null) {
    this.pubDropOpen.set(false);
    this.pubSearch.set('');
    if (id === null) return;
    if (!this.form.id_publicadores.includes(id) && this.form.id_publicadores.length < this.maxMiembros) {
      this.form.id_publicadores = [...this.form.id_publicadores, id];
      this.form.es_familiar = this.form.id_publicadores.length > 1;
      if (this.form.es_familiar && !this.form.etiqueta_familia) {
        const sug = this.sugerenciaEtiqueta();
        if (sug) this.form.etiqueta_familia = sug;
      }
    }
  }

  quitarMiembro(idx: number) {
    this.form.id_publicadores = this.form.id_publicadores.filter((_, i) => i !== idx);
    this.form.es_familiar = this.form.id_publicadores.length > 1;
    if (!this.form.es_familiar) this.form.etiqueta_familia = '';
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
      fecha_transferencia:        new Date().toISOString().slice(0, 10),
      notas_para_carta:           this.form.notas_para_carta,
    }).subscribe({
      next: (t) => {
        this.items.update(a => [t, ...a]);
        // Mientras se arma la carta seguimos "creando"; el diálogo se cierra igual.
        this.creando.set(false);
        this.pubDropOpen.set(false);
        this.form = this._resetForm();
        this.abrir(t);
        this.creandoFase.set('Armando la carta…');

        // La carta se arma con las notas; mejorar la redacción es opcional.
        this.svc.cartaDesdeNotas(t.id_transferencia).subscribe({
          next: (res) => {
            this.ponerCarta(t.id_transferencia, res.carta_redactada);
            this.creandoTransferencia.set(false);
            this.activeTab.set('carta');
            this.toast('success', 'Transferencia creada. Carta lista para revisar.');
          },
          error: () => {
            this.creandoTransferencia.set(false);
            this.toast('error', 'Transferencia creada, pero no se pudo armar la carta. Puedes hacerlo desde la pestaña Notas.');
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
    this.cancelarCompletar();
    this.cancelarAgregar();
    this.errorMejora.set(null);
    this.cartaAnterior.set(null);
    this.ayudaMejora.set(false);
    this.activeTab.set('info');
    this.mobileView.set('detalle');
  }

  cerrarDetalle() {
    this.seleccionada.set(null);
    this.confirmandoEliminar.set(false);
    this.cancelarCompletar();
    this.cancelarAgregar();
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

  // ── Carta ────────────────────────────────────────────────────
  /** Carta armada con las notas tal cual, sin IA. */
  armarCarta() {
    const t = this.seleccionada();
    if (!t || this.armando()) return;
    this.armando.set(true);
    this.errorMejora.set(null);
    this.cartaAnterior.set(null);
    // Primero se guardan las notas: la carta se arma con lo que está en el servidor.
    this.svc.update(t.id_transferencia, { notas_para_carta: t.notas_para_carta }).subscribe({
      next: () => this.svc.cartaDesdeNotas(t.id_transferencia).subscribe({
        next: (res) => {
          this.ponerCarta(t.id_transferencia, res.carta_redactada);
          this.armando.set(false);
          this.activeTab.set('carta');
          this.toast('success', 'Carta lista para revisar.');
        },
        error: (e) => {
          this.armando.set(false);
          this.toast('error', e?.error?.detail || 'No se pudo crear la carta');
        },
      }),
      error: (e) => {
        this.armando.set(false);
        this.toast('error', e?.error?.detail || 'No se pudieron guardar las notas');
      },
    });
  }

  /** Opcional: pule la redacción con la IA local. Si no está encendida, solo avisa. */
  mejorarRedaccion() {
    const t = this.seleccionada();
    if (!t || this.redactando()) return;
    const previa = t.carta_redactada || null;
    this.errorMejora.set(null);
    this.redactando.set(true);
    this.svc.update(t.id_transferencia, { notas_para_carta: t.notas_para_carta }).subscribe({
      next: () => this.svc.redactarCarta(t.id_transferencia).subscribe({
        next: (res) => {
          this.cartaAnterior.set(previa);
          this.ponerCarta(t.id_transferencia, res.carta_redactada);
          this.redactando.set(false);
          this.activeTab.set('carta');
          this.toast('success', 'Redacción mejorada. Revísala antes de usarla.');
        },
        error: (e) => {
          this.redactando.set(false);
          this.errorMejora.set(e?.status === 503
            ? (e?.error?.detail || 'El servicio de redacción no está encendido en este momento. Prueba más tarde si lo deseas.')
            : (e?.error?.detail || 'No se pudo mejorar la redacción. Tu carta no cambió.'));
        },
      }),
      error: (e) => {
        this.redactando.set(false);
        this.errorMejora.set(e?.error?.detail || 'No se pudieron guardar las notas.');
      },
    });
  }

  deshacerMejora() {
    const t = this.seleccionada();
    const previa = this.cartaAnterior();
    if (!t || previa === null) return;
    this.svc.update(t.id_transferencia, { carta_redactada: previa }).subscribe({
      next: (u) => {
        this.ponerCarta(t.id_transferencia, u.carta_redactada || '');
        this.cartaAnterior.set(null);
        this.toast('success', 'Volviste a la versión anterior.');
      },
      error: (e) => this.toast('error', e?.error?.detail || 'No se pudo volver a la versión anterior'),
    });
  }

  private ponerCarta(id: number, carta: string) {
    this.seleccionada.update(x => x && x.id_transferencia === id ? { ...x, carta_redactada: carta } : x);
    this.items.update(arr => arr.map(x => x.id_transferencia === id ? { ...x, carta_redactada: carta } : x));
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
            const marca = (x: Transferencia) => x.id_transferencia === t.id_transferencia
              ? { ...x, archivo_zip: x.archivo_zip || 'descargado' } : x;
            this.seleccionada.update(x => x ? marca(x) : x);
            this.items.update(arr => arr.map(marca));
            this.toast('success', 'Paquete descargado.');
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

  // ── Vista previa de la carta ─────────────────────────────────
  previsualizarCarta() {
    const t = this.seleccionada();
    if (!t?.carta_redactada) return;
    this.cargandoPreview.set(true);
    this.svc.previewCarta(t.id_transferencia, t.carta_redactada).subscribe({
      next: (blob) => {
        if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
        this.previewObjectUrl = URL.createObjectURL(blob);
        this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));
        this.cargandoPreview.set(false);
        this.mostrandoPreview.set(true);
      },
      error: (e) => {
        this.cargandoPreview.set(false);
        this.toast('error', e?.error?.detail || 'Error al generar la vista previa');
      },
    });
  }

  /** Ingreso: abre la carta tal como la guardó la congregación de origen. */
  verCartaRecibida() {
    const t = this.seleccionada();
    if (!t) return;
    this.cargandoPreview.set(true);
    this.svc.cartaPdf(t.id_transferencia).subscribe({
      next: (blob) => {
        if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
        this.previewObjectUrl = URL.createObjectURL(blob);
        this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));
        this.cargandoPreview.set(false);
        this.mostrandoPreview.set(true);
      },
      error: (e) => {
        this.cargandoPreview.set(false);
        this.toast('error', e?.error?.detail || 'No se pudo abrir la carta');
      },
    });
  }

  cerrarPreview() {
    this.mostrandoPreview.set(false);
    this.previewUrl.set(null);
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
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

  // ── Completar transferencia (trasladar / eliminar) ───────────
  /** Sin opción preseleccionada: trasladar o eliminar es una decisión consciente. */
  abrirCompletar() {
    this.cancelarCompletar();
    this.mostrarCompletar.set(true);
  }

  cancelarCompletar() {
    this.mostrarCompletar.set(false);
    this.completarAccion.set(null);
    this.numeroCongDestino.set('');
    this.impacto.set([]);
    this.privilegiosConservar.set(new Set());
    this.destinoVerificado.set(null);
    this.errorDestino.set(null);
    this.resultadosCong.set([]);
    this.consultaCongHecha.set(false);
    this.verificandoDestino.set(false);
    if (this.busquedaCongTimer) clearTimeout(this.busquedaCongTimer);
    this.confirmaEliminar.set(false);
  }

  elegirAccion(accion: 'trasladar' | 'eliminar') {
    this.completarAccion.set(accion);
    if (accion === 'trasladar' && !this.impacto().length && !this.cargandoImpacto()) this.cargarImpacto();
  }

  /** Desde la guía de pasos: abre el bloque de completar y lo trae a la vista. */
  irACompletar() {
    if (!this.mostrarCompletar()) this.abrirCompletar();
    setTimeout(() => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('seccion-completar')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  }

  /** Primer paso sin hacer: 1 notas, 2 carta, 3 paquete, 4 completar. */
  pasoActual(t: Transferencia): number {
    if (!t.notas_para_carta) return 1;
    if (!t.carta_redactada) return 2;
    if (!t.archivo_zip) return 3;
    return 4;
  }

  /** Escribe el nombre o el número: busca solo, sin botón. */
  onNumeroChange(valor: string) {
    this.numeroCongDestino.set(valor);
    // Otro texto: la elección anterior ya no vale.
    this.destinoVerificado.set(null);
    this.errorDestino.set(null);
    this.resultadosCong.set([]);
    this.consultaCongHecha.set(false);
    if (this.busquedaCongTimer) clearTimeout(this.busquedaCongTimer);

    const q = valor.trim();
    if (q.length < 2) { this.verificandoDestino.set(false); return; }
    this.verificandoDestino.set(true);
    this.busquedaCongTimer = setTimeout(() => this.buscarCongregacion(q), 250);
  }

  private buscarCongregacion(q: string) {
    this.svc.buscarCongregaciones(q).subscribe({
      next: (lista) => {
        // Si mientras tanto siguió escribiendo, esta respuesta ya no aplica.
        if (this.numeroCongDestino().trim() !== q) return;
        this.resultadosCong.set(lista);
        this.consultaCongHecha.set(true);
        this.verificandoDestino.set(false);
      },
      error: (e) => {
        if (this.numeroCongDestino().trim() !== q) return;
        this.errorDestino.set(e?.error?.detail || 'No se pudo buscar la congregación. Inténtalo de nuevo.');
        this.verificandoDestino.set(false);
      },
    });
  }

  elegirCongregacion(c: CongregacionBuscada) {
    if (this.busquedaCongTimer) clearTimeout(this.busquedaCongTimer);
    this.numeroCongDestino.set(c.nombre_congregacion);
    this.resultadosCong.set([]);
    this.errorDestino.set(null);
    this.destinoVerificado.set({
      id_congregacion: c.id_congregacion,
      nombre_congregacion: c.nombre_congregacion,
      numero_congregacion: c.numero_congregacion,
      es_la_misma: false,
    });
  }

  /** Enter con una sola coincidencia (p. ej. al pegar un número) la elige. */
  elegirPrimeraCongregacion(ev: Event) {
    ev.preventDefault();
    const lista = this.resultadosCong();
    if (lista.length === 1) this.elegirCongregacion(lista[0]);
  }

  mostrarResultados(): boolean {
    return this.resultadosCong().length > 0 && !this.destinoVerificado();
  }

  sinResultados(): boolean {
    return this.consultaCongHecha() && !this.resultadosCong().length && !this.destinoVerificado()
      && !this.verificandoDestino() && !this.errorDestino();
  }

  tienePrivilegios(): boolean {
    return this.impacto().some(m => m.privilegios.length > 0);
  }

  /** Lo que pasará, sumando a todos los miembros (en familia se dice una vez). */
  lineasImpactoTodas(): string[] {
    const miembros = this.impacto();
    if (miembros.length <= 1) return miembros.length ? this.lineasImpacto(miembros[0]) : [];
    const lineas: string[] = [];
    for (const mi of miembros) {
      for (const l of this.lineasImpacto(mi)) {
        const texto = l.startsWith('Quienes programan') ? l : `${mi.nombre_completo}: ${l.charAt(0).toLowerCase()}${l.slice(1)}`;
        if (!lineas.includes(texto)) lineas.push(texto);
      }
    }
    // El aviso a quienes programan, una sola vez y al final.
    const aviso = lineas.filter(l => l.startsWith('Quienes programan'));
    return [...lineas.filter(l => !l.startsWith('Quienes programan')), ...aviso.slice(0, 1)];
  }

  textoConfirmar(t: Transferencia): string {
    if (this.completando()) return 'Procesando…';
    if (this.completarAccion() === 'eliminar') return 'Eliminar de GAC';
    const d = this.destinoVerificado();
    return d && !d.es_la_misma ? `Trasladar a ${d.nombre_congregacion}` : 'Trasladar';
  }

  /** Privilegios vigentes y lo que se liberará; todos los privilegios marcados por defecto. */
  private cargarImpacto() {
    const t = this.seleccionada();
    if (!t) return;
    this.cargandoImpacto.set(true);
    this.impacto.set([]);
    this.svc.impacto(t.id_transferencia).subscribe({
      next: (res) => {
        this.impacto.set(res.miembros);
        this.privilegiosConservar.set(new Set(
          res.miembros.flatMap(m => m.privilegios.map(p => p.id_publicador_privilegio))
        ));
        this.cargandoImpacto.set(false);
      },
      error: () => this.cargandoImpacto.set(false),
    });
  }

  togglePrivilegio(id: number) {
    const s = new Set(this.privilegiosConservar());
    s.has(id) ? s.delete(id) : s.add(id);
    this.privilegiosConservar.set(s);
  }

  lineasImpacto(mi: ImpactoMiembro): string[] {
    const a = mi.asignaciones_futuras || {};
    const n = (k: string) => a[k] || 0;
    const plural = (c: number, uno: string, varios: string) => `${c} ${c === 1 ? uno : varios}`;
    const lineas: string[] = [];
    if (mi.rol_cambiara) {
      lineas.push(`Su acceso pasa de ${mi.rol_usuario} a Publicador. La nueva congregación le dará los permisos que correspondan.`);
    }
    const reunion = n('entre_semana') + n('fin_semana');
    if (reunion) lineas.push(`Quedan libres ${plural(reunion, 'parte', 'partes')} de las reuniones ya programadas.`);
    if (n('logistica')) lineas.push(`Quedan libres ${plural(n('logistica'), 'puesto', 'puestos')} de logística.`);
    if (n('discursos')) lineas.push(`Quedan sin orador ${plural(n('discursos'), 'discurso saliente', 'discursos salientes')}.`);
    if (n('exhibidores')) lineas.push(`Quedan libres ${plural(n('exhibidores'), 'turno', 'turnos')} de exhibidores.`);
    if (n('horarios')) lineas.push(`Quedan sin capitán ${plural(n('horarios'), 'salida', 'salidas')} de predicación.`);
    if (n('tareas')) lineas.push(`Quedan sin responsable ${plural(n('tareas'), 'tarea', 'tareas')}.`);
    if (mi.territorios_sin_devolver) lineas.push(`Se devuelven ${plural(mi.territorios_sin_devolver, 'territorio', 'territorios')} que tenía asignados.`);
    if (lineas.length > (mi.rol_cambiara ? 1 : 0)) {
      lineas.push('Quienes programan cada parte recibirán un aviso para asignar un reemplazo.');
    }
    return lineas;
  }

  completarValido(): boolean {
    const a = this.completarAccion();
    if (a === 'trasladar') {
      const d = this.destinoVerificado();
      return !!d && !d.es_la_misma && !this.cargandoImpacto() && !!this.seleccionada()?.carta_redactada;
    }
    return a === 'eliminar' && this.confirmaEliminar();
  }

  ejecutarCompletar() {
    const t = this.seleccionada();
    const accion = this.completarAccion();
    if (!t || !accion || !this.completarValido()) return;
    this.completando.set(true);
    const body: CompletarTransferenciaRequest = accion === 'trasladar'
      ? {
          accion,
          numero_congregacion: this.destinoVerificado()?.numero_congregacion || this.numeroCongDestino().trim(),
          privilegios_conservar: [...this.privilegiosConservar()],
        }
      : { accion, opcion_usuario: 'eliminar_con_usuario' };
    this.svc.completar(t.id_transferencia, body).subscribe({
      next: (updated) => {
        this.seleccionada.set(updated);
        this.items.update(arr => arr.map(x => x.id_transferencia === updated.id_transferencia ? updated : x));
        // Ya no están en esta congregación: que no salgan al buscar familiares.
        const idsMovidos = (updated.miembros || []).map(m => m.id_publicador);
        this.publicadores.update(ps => ps.filter(p => !idsMovidos.includes(p.id_publicador)));
        this.completando.set(false);
        this.cancelarCompletar();
        this.toast('success', updated.accion_realizada === 'trasladado'
          ? `Publicador trasladado a ${updated.congregacion_destino || 'la congregación destino'}.`
          : 'Publicador eliminado del sistema. El registro se conserva como historial.');
      },
      error: (e) => {
        this.completando.set(false);
        this.toast('error', e?.error?.detail || 'No se pudo completar la transferencia');
      },
    });
  }

  // ── Agregar a un familiar que faltó ──────────────────────────
  /** Eliminados no se pueden tocar; un traslado hecho todavía deja rehacer la carta. */
  soloLectura(t: Transferencia): boolean {
    return !!t.procesada_en && t.accion_realizada !== 'trasladado';
  }

  puedeAgregarFamiliar(t: Transferencia): boolean {
    return !!t.procesada_en && t.accion_realizada === 'trasladado' && !!t.id_congregacion_destino;
  }

  /** Familia trasladada sin paquete: se sumó alguien después (o nunca se descargó). */
  paqueteDesactualizado(t: Transferencia): boolean {
    return this.puedeAgregarFamiliar(t) && (t.miembros?.length || 0) > 1 && !t.archivo_zip;
  }

  cupoAgregar(t: Transferencia): number {
    return this.maxMiembros - (t.miembros?.length || 0) - this.agregarIds().length;
  }

  /** Quienes siguen en esta congregación; primero los del mismo apellido. */
  candidatosAgregar(t: Transferencia): PublicadorLite[] {
    const fuera = new Set([
      ...(t.miembros || []).map(m => m.id_publicador).filter((x): x is number => x != null),
      ...this.agregarIds(),
    ]);
    const apellidos = new Set(
      (t.miembros || []).map(m => (m.nombre_completo || '').trim().split(/\s+/).pop()?.toLowerCase()).filter(Boolean)
    );
    const q = this.agregarBusqueda().toLowerCase().trim();
    const mismoApellido = (p: PublicadorLite) =>
      apellidos.has((p.primer_apellido || '').toLowerCase()) || apellidos.has((p.segundo_apellido || '').toLowerCase());
    const libres = this.publicadores().filter(p => !fuera.has(p.id_publicador));
    // Sin escribir nada solo se sugieren los del mismo apellido; así la lista no abruma.
    if (!q) return libres.filter(mismoApellido).slice(0, 4);
    return libres
      .filter(p => (nombreMostrado(p) + ' ' + nombreLegal(p)).toLowerCase().includes(q))
      .sort((a, b) => Number(mismoApellido(b)) - Number(mismoApellido(a)))
      .slice(0, 5);
  }

  ayudaAgregar(t: Transferencia): string {
    const hay = this.candidatosAgregar(t).length > 0;
    if (this.agregarBusqueda().trim()) return hay ? '' : 'Nadie con ese nombre en esta congregación.';
    return hay ? 'Tienen el mismo apellido. Si no es ninguno, escribe su nombre.' : '';
  }

  abrirAgregar() {
    this.cancelarAgregar();
    this.mostrarAgregar.set(true);
    setTimeout(() => document.getElementById('agregar-buscar')?.focus());
  }

  cancelarAgregar() {
    this.mostrarAgregar.set(false);
    this.agregarIds.set([]);
    this.agregarBusqueda.set('');
    this.impacto.set([]);
    this.privilegiosConservar.set(new Set());
  }

  elegirAgregar(id: number) {
    const t = this.seleccionada();
    if (!t || this.agregarIds().includes(id) || this.cupoAgregar(t) <= 0) return;
    this.agregarIds.update(ids => [...ids, id]);
    this.agregarBusqueda.set('');
    this.cargarImpactoAgregar();
  }

  quitarAgregar(id: number) {
    this.agregarIds.update(ids => ids.filter(x => x !== id));
    this.cargarImpactoAgregar();
  }

  /** Igual que al completar: privilegios vigentes, todos marcados, y lo que se liberará. */
  private cargarImpactoAgregar() {
    const t = this.seleccionada();
    const ids = this.agregarIds();
    if (!t || !ids.length) {
      this.impacto.set([]);
      this.privilegiosConservar.set(new Set());
      this.cargandoImpacto.set(false);
      return;
    }
    this.cargandoImpacto.set(true);
    this.svc.impacto(t.id_transferencia, ids).subscribe({
      next: (res) => {
        // Si mientras tanto cambió la selección, esta respuesta ya no aplica.
        if (this.agregarIds().join(',') !== ids.join(',')) return;
        this.impacto.set(res.miembros);
        this.privilegiosConservar.set(new Set(
          res.miembros.flatMap(m => m.privilegios.map(p => p.id_publicador_privilegio))
        ));
        this.cargandoImpacto.set(false);
      },
      error: (e) => {
        this.cargandoImpacto.set(false);
        this.toast('error', e?.error?.detail || 'No se pudo revisar a esa persona');
      },
    });
  }

  ejecutarAgregar() {
    const t = this.seleccionada();
    const ids = this.agregarIds();
    if (!t || !ids.length || this.agregando()) return;
    this.agregando.set(true);
    this.svc.agregarMiembros(t.id_transferencia, {
      id_publicadores: ids,
      privilegios_conservar: [...this.privilegiosConservar()],
    }).subscribe({
      next: (updated) => {
        const nombres = ids.map(id => this.nombrePublicador(id)).join(' y ');
        this.seleccionada.set(updated);
        this.items.update(arr => arr.map(x => x.id_transferencia === updated.id_transferencia ? updated : x));
        // Ya no están en esta congregación.
        this.publicadores.update(ps => ps.filter(p => !ids.includes(p.id_publicador)));
        this.agregando.set(false);
        this.cancelarAgregar();
        this.toast('success', `${nombres} ${ids.length > 1 ? 'pasaron' : 'pasó'} a ${updated.congregacion_destino || 'la congregación destino'}. Ahora rehaz la carta y el paquete.`);
      },
      error: (e) => {
        this.agregando.set(false);
        this.toast('error', e?.error?.detail || 'No se pudo agregar a la transferencia');
      },
    });
  }

  /** Texto del resultado cuando la transferencia ya fue procesada */
  resultadoTexto(t: Transferencia): string {
    if (!t.procesada_en) return '';
    const varios = (t.miembros?.length || 0) > 1;
    return t.accion_realizada === 'trasladado'
      ? `${varios ? 'Trasladados' : 'Publicador trasladado'} a ${t.congregacion_destino || 'la congregación destino'}`
      : (varios ? 'Eliminados del sistema' : 'Publicador eliminado del sistema');
  }

  /** Etiqueta del badge de estado en la lista (considera si ya fue procesada) */
  badgeEstadoTxt(t: Transferencia): string {
    if (this.esIngreso(t)) return 'Recibida';
    if (t.procesada_en) return t.accion_realizada === 'trasladado' ? 'Trasladada' : 'Eliminada';
    return t.estado === 'borrador' ? 'Borrador' : 'Finalizada';
  }
  badgeEstadoCls(t: Transferencia): string {
    if (this.esIngreso(t)) return 'badge-recibida';
    if (t.procesada_en) return t.accion_realizada === 'trasladado' ? 'badge-active' : 'badge-warning';
    return t.estado === 'borrador' ? 'badge-warning' : 'badge-active';
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
  nombrePublicador(id: number | null): string {
    if (id == null) return '—';
    const p = this.publicadores().find(x => x.id_publicador === id);
    return p ? nombreMostrado(p) : `#${id}`;
  }

  iniciales(id: number | null): string {
    if (id == null) return '#';
    const p = this.publicadores().find(x => x.id_publicador === id);
    if (!p) return '#';
    return inicialesDe(p);
  }

  /** "Ana, Luis y Marta" para el aria-label y el tooltip del grupo de avatares. */
  nombresMiembros(t: Transferencia): string {
    const n = (t.miembros || []).map(m => m.nombre_completo).filter(Boolean);
    if (n.length < 2) return n.join('');
    return `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
  }

  /** Iniciales a partir de un nombre completo (para snapshots sin publicador vivo) */
  inicialesDeNombre(nombre: string): string {
    const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '#';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /** Iniciales para el avatar de una transferencia, robusto tras eliminar al publicador */
  inicialesTransferencia(t: Transferencia): string {
    if (t.es_familiar) return this.inicialEtiqueta(t);
    const snap = t.miembros?.length ? t.miembros[0].nombre_completo : '';
    if (snap) return this.inicialesDeNombre(snap);
    return this.iniciales(t.id_publicador);
  }

  inicialesPub(p: PublicadorLite): string {
    return inicialesDe(p);
  }

  pubLacksConsent(id: number): boolean {
    const p = this.publicadores().find(x => x.id_publicador === id);
    return p ? !p.archivo_consentimiento : false;
  }

  /** Etiqueta para mostrar en la lista: familia o nombre individual.
   *  Usa el snapshot del miembro para seguir siendo legible tras eliminar al publicador. */
  etiquetaTransferencia(t: Transferencia): string {
    if (t.es_familiar && t.etiqueta_familia) return t.etiqueta_familia;
    if (t.miembros?.length && t.miembros[0].nombre_completo) return t.miembros[0].nombre_completo;
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

  countBorradores():  number { return this.items().filter(t => !this.esIngreso(t) && t.estado === 'borrador').length; }
  countFinalizadas(): number { return this.items().filter(t => !this.esIngreso(t) && t.estado === 'finalizada').length; }
  countRecibidas():   number { return this.items().filter(t => this.esIngreso(t)).length; }

  /** La recibió esta congregación por un traslado en GAC: solo se consulta. */
  esIngreso(t: Transferencia | null | undefined): boolean { return t?.direccion === 'ingreso'; }

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

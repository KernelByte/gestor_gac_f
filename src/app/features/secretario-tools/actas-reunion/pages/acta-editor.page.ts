import {
  Component, inject, signal, computed, OnInit, OnDestroy, HostListener, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActaService } from '../../services/acta.service';
import { Acta, Tarea } from '../../models/acta.model';
import { TareaDetailPanelComponent } from '../../tareas/components/tarea-detail-panel.component';

type MobileTab = 'info' | 'notas' | 'acta' | 'tareas';

@Component({
  standalone: true,
  selector: 'app-acta-editor',
  imports: [CommonModule, FormsModule, TareaDetailPanelComponent],
  template: `
  <div *ngIf="acta() as a"
       class="editor-root"
       [class.dark-root]="false">

    <!-- ══════════════ HEADER ══════════════ -->
    <header class="editor-header">

      <!-- Fila superior: breadcrumb de navegación -->
      <div class="header-nav">
        <button (click)="volver()" class="nav-back" type="button" title="Volver a actas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Volver
        </button>
      </div>

      <!-- Fila principal: título · fecha · acciones -->
      <div class="header-main">
        <div class="header-left">
          <h1 class="header-acta-title">{{ a.titulo }}</h1>
          <span class="estado-pill" [class.estado-final]="a.estado === 'finalizada'" [class.estado-draft]="a.estado !== 'finalizada'">
            <span class="estado-dot"></span>
            {{ a.estado === 'finalizada' ? 'Finalizada' : 'Borrador' }}
          </span>
        </div>

        <div class="header-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" class="icon-muted"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span class="acta-fecha">{{ formatFecha(a.fecha_reunion) }}</span>
        </div>

        <div class="header-actions">
          <!-- Estado: acción principal visible en todas las pantallas -->
          <div class="estado-mobile-wrap" style="position:relative">
              <button type="button" class="btn-estado-mobile"
                      (click)="estadoOpen = !estadoOpen"
                      (blur)="onEstadoBlur()"
                      [class.is-borrador]="a.estado !== 'finalizada'"
                      [class.is-finalizada]="a.estado === 'finalizada'">
                @if (a.estado !== 'finalizada') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  <span>Finalizar</span>
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  <span>Finalizada</span>
                }
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"
                     [style.transform]="estadoOpen ? 'rotate(180deg)' : ''" style="transition:transform 150ms; opacity:0.7">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              @if (estadoOpen && !isMobileMode()) {
                <div class="estado-dropdown estado-dropdown-left">
                  <div class="estado-dropdown-header">Estado de la reunión</div>
                  <button type="button" class="estado-option"
                          [class.is-selected]="a.estado !== 'finalizada'"
                          (click)="setEstado(a, 'borrador')">
                    <span class="edo-dot dot-draft"></span>
                    <span class="edo-option-text">
                      <span class="edo-option-label">Borrador</span>
                      <span class="edo-option-sub">Seguir editando el acta</span>
                    </span>
                    @if (a.estado !== 'finalizada') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14" style="margin-left:auto;flex-shrink:0;color:#6d28d9"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    }
                  </button>
                  <button type="button" class="estado-option"
                          [class.is-selected]="a.estado === 'finalizada'"
                          (click)="setEstado(a, 'finalizada')">
                    <span class="edo-dot dot-final"></span>
                    <span class="edo-option-text">
                      <span class="edo-option-label">Finalizar y cerrar</span>
                      <span class="edo-option-sub">El acta queda en solo lectura</span>
                    </span>
                    @if (a.estado === 'finalizada') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14" style="margin-left:auto;flex-shrink:0;color:#6d28d9"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    }
                  </button>
                </div>
              }
          </div>

          @if (savedAgo() !== null && !hasUnsaved()) {
            <span class="saved-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="11" height="11"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              Guardado {{ savedAgo() }}
            </span>
          }
          <button (click)="exportar('pdf')" class="btn-export btn-export-pdf" type="button" title="Exportar como PDF">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M10 12.5c0-.828.672-1.5 1.5-1.5h1a1.5 1.5 0 010 3h-1v2"/></svg>
            <span class="btn-export-label">PDF</span>
          </button>
          <button (click)="exportar('docx')" class="btn-export btn-export-word" type="button" title="Exportar como Word">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 13l1.5 4 1.5-4 1.5 4 1.5-4"/></svg>
            <span class="btn-export-label">Word</span>
          </button>
          <button (click)="guardar()" [disabled]="guardando() || isReadonly()" class="btn-save"
                  [class.has-unsaved]="hasUnsaved()" type="button" title="Guardar (Ctrl+S)">
            @if (guardando()) {
              <span class="spinner"></span> Guardando…
            } @else {
              @if (hasUnsaved()) { <span class="unsaved-dot"></span> }
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              Guardar
            }
          </button>
        </div>
      </div>
    </header>

    <!-- ══════════════ ESTADO BOTTOM SHEET (móvil) ══════════════ -->
    <!-- Fuera del header para evitar que backdrop-filter rompa position:fixed -->
    @if (estadoOpen && isMobileMode()) {
      <div class="estado-backdrop" (click)="estadoOpen = false"></div>
      <div class="estado-bottomsheet">
        <div class="estado-bs-handle"></div>
        <div class="estado-bs-title">Estado de la reunión</div>
        <button type="button" class="estado-bs-option"
                [class.is-selected]="acta()!.estado !== 'finalizada'"
                (click)="setEstado(acta()!, 'borrador'); estadoOpen = false">
          <span class="edo-dot dot-draft"></span>
          <span class="edo-option-text">
            <span class="edo-option-label">Borrador</span>
            <span class="edo-option-sub">Seguir editando el acta</span>
          </span>
          @if (acta()!.estado !== 'finalizada') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16" style="margin-left:auto;flex-shrink:0;color:#6d28d9"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          }
        </button>
        <button type="button" class="estado-bs-option"
                [class.is-selected]="acta()!.estado === 'finalizada'"
                (click)="setEstado(acta()!, 'finalizada'); estadoOpen = false">
          <span class="edo-dot dot-final"></span>
          <span class="edo-option-text">
            <span class="edo-option-label">Finalizar y cerrar</span>
            <span class="edo-option-sub">El acta queda en solo lectura</span>
          </span>
          @if (acta()!.estado === 'finalizada') {
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16" style="margin-left:auto;flex-shrink:0;color:#6d28d9"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          }
        </button>
      </div>
    }

    <!-- ══════════════ BANNER READONLY ══════════════ -->
    @if (isReadonly()) {
      <div class="readonly-banner">
        <span class="readonly-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </span>
        <span>Acta finalizada &mdash; solo lectura. Para editar, cambia el estado a <strong>Borrador</strong>.</span>
      </div>
    }

    <!-- ══════════════ MOBILE TABS ══════════════ -->
    <nav class="mobile-tabs-bar" role="tablist" aria-label="Secciones">
      @for (t of mobileTabs; track t.id) {
        <button type="button" role="tab"
                [attr.aria-selected]="activeTab() === t.id"
                (click)="activeTab.set(t.id)"
                class="mobile-tab"
                [class.is-active]="activeTab() === t.id">
          @if (t.id === 'info') {
            <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8h.01M12 12v4"/></svg>
          } @else if (t.id === 'notas') {
            <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          } @else if (t.id === 'acta') {
            <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          } @else if (t.id === 'tareas') {
            <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          }
          {{ t.label }}
        </button>
      }
    </nav>

    <!-- ══════════════ ÁREA DE TRABAJO ══════════════ -->
    <div class="workspace">

      <!-- Barra de metadata del acta -->
      <div class="meta-bar" [class.tab-hidden]="isMobileMode() && activeTab() !== 'info'">
        <label class="meta-field">
          <span class="meta-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            Presidente
          </span>
          <div class="meta-input-wrap">
            <input class="meta-input" [(ngModel)]="meta.presidente" (ngModelChange)="markDirty()" placeholder="Sin asignar" [disabled]="isReadonly()" />
            <svg class="meta-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </div>
        </label>

        <div class="meta-divider"></div>

        <label class="meta-field">
          <span class="meta-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Lugar
          </span>
          <div class="meta-input-wrap">
            <input class="meta-input" [(ngModel)]="meta.lugar" (ngModelChange)="markDirty()" placeholder="Sin especificar" [disabled]="isReadonly()" />
            <svg class="meta-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </div>
        </label>

        <div class="meta-divider"></div>

        @if (false) {
          <div class="meta-field meta-field-sm" style="position:relative">
            <span class="meta-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><circle cx="12" cy="12" r="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.071 4.929a10 10 0 010 14.142M4.929 4.929a10 10 0 000 14.142"/></svg>
              Estado
            </span>
            <div class="meta-input-wrap" style="cursor:pointer" (click)="estadoOpen = !estadoOpen">
              <button type="button" class="estado-trigger" (blur)="onEstadoBlur()">
                <span class="estado-trigger-dot" [class.dot-final]="a.estado === 'finalizada'" [class.dot-draft]="a.estado !== 'finalizada'"></span>
                <span class="estado-trigger-text">{{ a.estado === 'finalizada' ? 'Finalizada' : 'Borrador' }}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"
                     [style.transform]="estadoOpen ? 'rotate(180deg)' : ''" style="transition:transform 150ms; margin-left:auto; color:var(--text-muted)">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
            </div>
            @if (estadoOpen) {
              <div class="estado-dropdown">
                <button type="button" class="estado-option"
                        [class.is-selected]="a.estado !== 'finalizada'"
                        (click)="setEstado(a, 'borrador')">
                  <span class="edo-dot dot-draft"></span>
                  Borrador
                  @if (a.estado !== 'finalizada') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12" style="margin-left:auto;color:#6d28d9"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  }
                </button>
                <button type="button" class="estado-option"
                        [class.is-selected]="a.estado === 'finalizada'"
                        (click)="setEstado(a, 'finalizada')">
                  <span class="edo-dot dot-final"></span>
                  Finalizada
                  @if (a.estado === 'finalizada') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12" style="margin-left:auto;color:#6d28d9"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  }
                </button>
              </div>
            }
          </div>
        }

        <div class="meta-field meta-field-asistentes">
          <span class="meta-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a2 2 0 11-4 0 2 2 0 014 0zM7 16a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            Asistentes
          </span>
          <div class="meta-input-wrap asistentes-row">
            @for (asis of asistentesArr().slice(0, 3); track asis; let i = $index) {
              <span class="avatar-chip" [style.--i]="i" [title]="asis">
                {{ initials(asis) }}
              </span>
            }
            @if (asistentesArr().length > 3) {
              <span class="avatar-more">+{{ asistentesArr().length - 3 }} más</span>
            }
            @if (asistentesArr().length === 0) {
              <span class="asistentes-empty">Sin asistentes</span>
            }
            <div class="asistentes-add-wrap" [style.display]="isReadonly() ? 'none' : ''">
              @if (addingAsistente) {
                <input class="asistentes-add-input"
                       [(ngModel)]="nuevoAsistente"
                       (keydown.enter)="agregarAsistente(); $event.preventDefault()"
                       (keydown.escape)="addingAsistente = false; nuevoAsistente = ''"
                       (blur)="onAddAsistenteBlur()"
                       placeholder="Nombre…"
                       #addInput />
              }
              <button class="btn-add-person" type="button" (click)="toggleAddAsistente()"
                      [title]="addingAsistente ? 'Cancelar' : 'Agregar asistente'">
                @if (!addingAsistente) {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5 19.5a7 7 0 0114 0"/><line x1="19" y1="8" x2="19" y2="14" stroke-linecap="round"/><line x1="16" y1="11" x2="22" y2="11" stroke-linecap="round"/></svg>
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                }
              </button>
            </div>
            @for (asis of asistentesArr(); track asis) {
              <button class="chip-remove-hidden" (click)="quitarAsistente(asis)" type="button" style="display:none"></button>
            }
          </div>
        </div>
      </div>

    <!-- ══════════════ EDITOR COLUMNS ══════════════ -->
    <div class="editor-columns">

      <!-- ── Notas rápidas ── -->
      <div class="editor-col col-notas" [class.tab-hidden]="isMobileMode() && activeTab() !== 'notas'" [class.is-active]="activeTab() === 'notas'">
        <div class="col-header">
          <div class="col-icon col-icon-amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </div>
          <div class="col-header-text">
            <h3 class="col-title">Notas rápidas</h3>
          </div>
          <button (click)="redactarIA()" [disabled]="redactando() || !a.notas_originales || isReadonly()"
                  class="btn-ia" type="button"
                  [title]="isReadonly() ? 'El acta está finalizada' : (!a.notas_originales ? 'Escribe notas primero para generar el acta' : 'Generar acta con IA (Ctrl+Enter)')">
            @if (redactando()) {
              <span class="spinner"></span>
              Generando…
            } @else {
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 2l1.09 3.26L16.5 6l-3.41.74L12 10l-1.09-3.26L7.5 6l3.41-.74L12 2zm6 10l.73 2.18L21 15l-2.27.82L18 18l-.73-2.18L15 15l2.27-.82L18 12zm-12 0l.73 2.18L9 15l-2.27.82L6 18l-.73-2.18L3 15l2.27-.82L6 12z"/></svg>
              Generar acta
            }
          </button>
        </div>
        <div class="col-body">
          <textarea class="col-textarea font-mono"
                    [(ngModel)]="a.notas_originales"
                    (ngModelChange)="markDirty()"
                    [disabled]="isReadonly()"
                    placeholder="Escribe notas durante la reunión aquí…&#10;&#10;• Punto 1:&#10;• Punto 2:&#10;• Acuerdo:"></textarea>
        </div>
      </div>

      <!-- ── Acta redactada ── -->
      <div class="editor-col col-acta" [class.tab-hidden]="isMobileMode() && activeTab() !== 'acta'" [class.is-active]="activeTab() === 'acta'">
        <div class="col-header">
          <div class="col-icon col-icon-purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 13h6M9 17h4"/></svg>
          </div>
          <div class="col-header-text">
            <h3 class="col-title">Acta redactada</h3>
            <p class="col-subtitle">Documento formal</p>
          </div>
          <span class="col-hint">Clic para editar</span>
        </div>
        <div class="col-body acta-body">
          @if (!a.contenido_redactado && !actaFocused()) {
            <div class="acta-empty-overlay" (click)="!isReadonly() && focusActa()">
              <div class="acta-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <p class="acta-empty-title">Sin acta aún</p>
              <p class="acta-empty-sub">Escribe tus notas y presiona <strong>Generar acta</strong>.</p>
              @if (isMobileMode()) {
                <button class="btn-go-notas" type="button"
                        (click)="$event.stopPropagation(); activeTab.set('notas')">
                  ← Ir a Notas
                </button>
              }
            </div>
          }
          @if (!actaFocused()) {
            <div class="acta-preview"
                 (click)="!isReadonly() && focusActa()"
                 [innerHTML]="actaHtml()"
                 [title]="isReadonly() ? '' : 'Clic para editar'"
                 [style.cursor]="isReadonly() ? 'default' : 'text'">
            </div>
          }
          <textarea #actaTextarea
                    class="col-textarea"
                    [class.acta-textarea-hidden]="!actaFocused()"
                    [(ngModel)]="a.contenido_redactado"
                    (ngModelChange)="markDirty()"
                    (blur)="onActaBlur()"
                    placeholder="Escribe el acta aquí..."></textarea>
        </div>
      </div>

      <!-- ── Tareas y seguimiento ── -->
      <div class="editor-col col-tareas" [class.tab-hidden]="isMobileMode() && activeTab() !== 'tareas'" [class.is-active]="activeTab() === 'tareas'">
        <div class="col-header">
          <div class="col-icon col-icon-emerald">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div class="col-header-text">
            <h3 class="col-title">Tareas</h3>
            <p class="col-subtitle">Seguimiento</p>
          </div>
          <span class="task-count">{{ tareas().length }}</span>
          <button (click)="agregandoTarea.set(!agregandoTarea())" class="btn-add-task" type="button" [disabled]="isReadonly()">
            <svg [class.rotate-45]="agregandoTarea()" style="transition: transform 200ms ease-out" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>

        @if (agregandoTarea()) {
          <div class="task-form">
            <input class="field" placeholder="Título de la tarea *" [(ngModel)]="tareaForm.titulo" />
            <div class="task-form-row">
              <input type="date" class="field" [(ngModel)]="tareaForm.fecha_limite" />
              <select class="field" [(ngModel)]="tareaForm.prioridad">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <textarea class="field" rows="2" placeholder="Descripción (opcional)" [(ngModel)]="tareaForm.descripcion"></textarea>
            <div class="task-form-actions">
              <button (click)="agregandoTarea.set(false)" class="btn-ghost-xs" type="button">Cancelar</button>
              <button (click)="crearTarea()" [disabled]="!tareaForm.titulo" class="btn-primary-xs" type="button">Crear</button>
            </div>
          </div>
        }

        <div class="col-body">
          @if (tareas().length) {
            <ul class="task-list">
              @for (t of tareas(); track t.id_tarea; let i = $index) {
                <li class="task-item" [class.task-done]="t.estado === 'completada'"
                    [attr.data-prio]="t.prioridad" [style.--stagger]="i * 25 + 'ms'">

                  <button class="task-status-btn" [attr.data-estado]="t.estado" type="button"
                          [title]="'Cambiar estado'" (click)="cambiarEstado(t, nextEstado(t.estado))">
                    @if (t.estado === 'completada') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    } @else if (t.estado === 'en_progreso') {
                      <svg viewBox="0 0 24 24" fill="currentColor" width="8" height="8"><circle cx="12" cy="12" r="6"/></svg>
                    } @else if (t.estado === 'cancelada') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    } @else {
                      <!-- empty circle for pendiente -->
                    }
                  </button>

                  <div class="task-body" (click)="verTarea(t)">
                    <span class="task-title" [class.task-title-done]="t.estado === 'completada'">{{ t.titulo }}</span>
                    <div class="task-meta">
                      <span class="prio-pip" [attr.data-prio]="t.prioridad"></span>
                      <span class="task-meta-text">{{ estadoShort(t.estado) }}</span>
                      @if (t.fecha_limite) {
                        <span class="task-meta-sep">·</span>
                        <span class="task-meta-text">{{ t.fecha_limite }}</span>
                      }
                    </div>
                  </div>

                  @if (!isReadonly()) {
                    <button (click)="eliminarTarea(t)" class="btn-remove-task" type="button" aria-label="Eliminar">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  }
                </li>
              }
            </ul>
          } @else {
            <div class="task-empty">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              <p>Sin tareas</p>
              <button (click)="agregandoTarea.set(true)" class="btn-primary-xs mt-2" type="button">+ Nueva tarea</button>
            </div>
          }
        </div>
      </div>
    </div>
    </div><!-- /workspace -->

    <!-- ══════════════ MOBILE SAVE INDICATOR ══════════════ -->
    <div class="mobile-save-strip" aria-live="polite">
      @if (guardando()) {
        <span class="save-chip save-chip-saving">
          <span class="spinner"></span> Guardando…
        </span>
      } @else if (hasUnsaved()) {
        <span class="save-chip save-chip-pending">
          <span class="save-pending-dot"></span> Guardando en breve
        </span>
      } @else if (savedAgo() !== null) {
        <span class="save-chip save-chip-done">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          Guardado
        </span>
      }
    </div>

    <!-- ══════════════ MODAL: Eliminar tarea ══════════════ -->
    @if (tareaAEliminar(); as tDel) {
      <div class="confirm-overlay" (click)="cancelarEliminarTarea()">
        <div class="confirm-dialog" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="confirm-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/>
            </svg>
          </div>
          <h3 class="confirm-title">Eliminar tarea</h3>
          <p class="confirm-message">Esta acción no se puede deshacer.</p>
          <p class="confirm-target">"{{ tDel.titulo }}"</p>
          <div class="confirm-actions">
            <button class="confirm-btn confirm-btn-ghost" type="button"
                    [disabled]="eliminandoTarea()" (click)="cancelarEliminarTarea()">Cancelar</button>
            <button class="confirm-btn confirm-btn-danger" type="button"
                    [disabled]="eliminandoTarea()" (click)="confirmarEliminarTarea()">
              @if (eliminandoTarea()) { Eliminando… } @else { Eliminar }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Drawer de tarea (desktop) -->
    @if (tareaDrawerId()) {
      <div class="tarea-drawer-overlay" (click)="tareaDrawerId.set(null)"></div>
      <div class="tarea-drawer">
        <app-tarea-detail-panel
          [tareaId]="tareaDrawerId()!"
          [modoDrawer]="true"
          (cerrar)="tareaDrawerId.set(null)"
          (tareaActualizada)="onTareaActualizadaEnDrawer($event)"
          (tareaEliminada)="onTareaEliminadaEnDrawer($event)"
        />
      </div>
    }

  </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       VARIABLES & HOST
    ═══════════════════════════════════════════ */
    :host {
      display: block;
      height: 100%;
      font-family: 'Manrope', 'Urbanist', system-ui, sans-serif;
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
      /* Brand tokens */
      --brand-purple: #6D28D9;
      --brand-purple-hover: #5B21B6;
      --brand-amber: #F59E0B;
      --brand-emerald: #10B981;
      --brand-rose: #F43F5E;
      --radius-card: 1rem;
      --radius-input: 0.75rem;
      /* Light mode defaults */
      --bg: #f3f4f6;
      --surface: #ffffff;
      --surface-hover: #f8fafc;
      --surface-2: #f8fafc;
      --border: #e2e8f0;
      --border-hover: #a78bfa;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --purple: #6d28d9;
      --purple-light: #ede9fe;
      --purple-text: #6d28d9;
      --amber: #f59e0b;
      --emerald: #10b981;
      --header-bg: #ffffff;
      --header-border: #e2e8f0;
      --meta-bg: #f8fafc;
      --meta-border: #e2e8f0;
      --col-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
    }
    :host-context(.dark) {
      --bg: #020618;
      --surface: #0a1120;
      --surface-hover: #0e1829;
      --surface-2: #020618;
      --border: rgba(148,163,184,0.08);
      --border-hover: #7c3aed;
      --text-primary: #e2e8f0;
      --text-secondary: #94a3b8;
      --text-muted: #475569;
      --purple-light: rgba(109,40,217,0.15);
      --purple-text: #a78bfa;
      --header-bg: rgba(13,21,38,0.85);
      --header-border: rgba(148,163,184,0.07);
      --meta-bg: rgba(6,11,22,0.7);
      --meta-border: rgba(148,163,184,0.06);
      --col-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3);
    }

    /* ═══════════════════════════════════════════
       ROOT GRID — ZERO SCROLL IN DESKTOP
    ═══════════════════════════════════════════ */
    .editor-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg);
      overflow: hidden;
      position: relative;
    }
    .editor-header { flex-shrink: 0; }
    .mobile-tabs-bar { flex-shrink: 0; }
    .workspace {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
      background: var(--bg);
    }
    :host-context(.dark) .editor-root { background: #020618; }

    /* ═══════════════════════════════════════════
       HEADER
    ═══════════════════════════════════════════ */
    .editor-header {
      background: transparent;
      border-bottom: none;
      position: relative;
    }

    .header-nav {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1.25rem 0;
    }
    .nav-back {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.3rem 0.75rem 0.3rem 0.5rem;
      font-size: 0.8rem; font-weight: 500;
      color: var(--text-secondary);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      cursor: pointer;
      transition: background 150ms, border-color 150ms, color 150ms, box-shadow 150ms;
    }
    .nav-back:hover {
      background: rgba(124,58,237,0.06);
      border-color: rgba(124,58,237,0.3);
      color: var(--purple-text);
      box-shadow: 0 0 0 3px rgba(124,58,237,0.08);
    }
    .nav-back:active { transform: scale(0.96); }

    .header-main {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.375rem 1.25rem 0.625rem;
    }
    .header-left {
      display: flex; align-items: center; gap: 0.625rem;
      flex-shrink: 0;
    }
    .header-acta-title {
      font-size: 1.0625rem; font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 360px;
    }
    .header-center {
      display: flex; align-items: center; gap: 0.5rem;
      flex: 1; justify-content: center;
    }
    .acta-fecha {
      font-size: 0.875rem; font-weight: 600;
      color: var(--text-secondary);
    }
    .icon-muted { color: var(--text-muted); flex-shrink: 0; }

    .estado-pill {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.125rem 0.5rem; font-size: 0.6rem; font-weight: 700;
      border-radius: 999px; letter-spacing: 0.05em; text-transform: uppercase;
      border: 1px solid transparent;
    }
    .estado-dot {
      width: 0.35rem; height: 0.35rem; border-radius: 999px; background: currentColor;
      animation: pulse-dot 2s ease-in-out infinite;
    }
    @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .estado-final { background: rgba(16,185,129,0.1); color: #10b981; border-color: rgba(16,185,129,0.25); }
    .estado-draft  { background: rgba(245,158,11,0.1);  color: #f59e0b; border-color: rgba(245,158,11,0.25); }
    :host-context(.dark) .estado-final { background: rgba(16,185,129,0.12); color: #34d399; border-color: rgba(52,211,153,0.2); }
    :host-context(.dark) .estado-draft  { background: rgba(245,158,11,0.12);  color: #fbbf24; border-color: rgba(251,191,36,0.2); }

    .header-actions {
      display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;
    }

    .saved-label {
      display: inline-flex; align-items: center; gap: 0.25rem;
      font-size: 0.675rem; color: var(--text-muted); white-space: nowrap;
    }

    /* ── Botones exportar ── */
    .btn-export {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.375rem 0.75rem; font-size: 0.75rem; font-weight: 500;
      border-radius: 0.5rem; cursor: pointer;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      transition: background 150ms, border-color 150ms, color 150ms, transform 150ms, box-shadow 150ms;
    }
    :host-context(.dark) .btn-export { background: rgba(255,255,255,0.04); border-color: rgba(148,163,184,0.12); }
    @media (hover: hover) {
      .btn-export-pdf:hover  { background: rgba(220,38,38,0.06);  border-color: rgba(220,38,38,0.3);  color: #dc2626; }
      .btn-export-word:hover { background: rgba(37,99,235,0.06);  border-color: rgba(37,99,235,0.3);  color: #2563eb; }
    }
    .btn-export:active { transform: scale(0.95); }

    /* ── Botón guardar ── */
    .btn-save {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.375rem 1rem; font-size: 0.8125rem; font-weight: 500;
      border-radius: 0.625rem; cursor: pointer;
      background: var(--brand-purple);
      color: #fff;
      box-shadow: 0 1px 2px rgba(109,40,217,0.18);
      transition: background 160ms var(--ease-out), box-shadow 160ms var(--ease-out), transform 160ms var(--ease-out);
    }
    .btn-save.has-unsaved { background: #7c3aed; }
    @media (hover: hover) {
      .btn-save:hover:not(:disabled) { background: var(--brand-purple-hover); box-shadow: 0 4px 14px rgba(109,40,217,0.28); }
    }
    .btn-save:active { transform: scale(0.97); }
    .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

    .unsaved-dot {
      width: 0.4rem; height: 0.4rem; border-radius: 999px;
      background: #fbbf24; flex-shrink: 0;
    }
    .kbd {
      display: inline-block; padding: 0.0625rem 0.3rem;
      font-size: 0.6rem; font-family: ui-monospace, monospace;
      background: rgba(0,0,0,0.15); border-radius: 0.25rem;
      border: 1px solid rgba(255,255,255,0.2);
    }

    /* ═══════════════════════════════════════════
       READONLY BANNER — emerald
    ═══════════════════════════════════════════ */
    .readonly-banner {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.5rem 1.25rem;
      background: rgba(16,185,129,0.07);
      border-bottom: 1px solid rgba(16,185,129,0.18);
      font-size: 0.75rem; color: #047857;
      letter-spacing: 0.01em; flex-shrink: 0;
    }
    :host-context(.dark) .readonly-banner {
      background: rgba(16,185,129,0.1);
      border-bottom-color: rgba(52,211,153,0.2);
      color: #6ee7b7;
    }
    .readonly-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.375rem; height: 1.375rem; border-radius: 50%;
      background: rgba(16,185,129,0.12); color: #10b981; flex-shrink: 0;
    }
    :host-context(.dark) .readonly-icon { background: rgba(52,211,153,0.15); color: #34d399; }
    .readonly-banner strong { font-weight: 700; color: inherit; }

    /* ═══════════════════════════════════════════
       META BAR
    ═══════════════════════════════════════════ */
    .meta-bar {
      display: flex;
      align-items: stretch;
      gap: 0;
      flex-wrap: nowrap;
      margin: 0.5rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.875rem;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      flex-shrink: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .meta-bar::-webkit-scrollbar { display: none; }
    :host-context(.dark) .meta-bar {
      background: var(--surface);
      border-color: var(--border);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .meta-divider {
      width: 1px;
      background: var(--border);
      flex-shrink: 0;
      align-self: stretch;
    }

    .meta-field {
      display: flex; flex-direction: column; gap: 0.2rem;
      padding: 0.5rem 0.75rem;
      flex-shrink: 0; cursor: text;
    }
    .meta-field-sm { min-width: 130px; }
    .meta-field-asistentes { flex: 1; min-width: 0; }

    .meta-label {
      display: flex; align-items: center; gap: 0.25rem;
      font-size: 0.6rem; font-weight: 600;
      color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase;
    }

    .meta-input-wrap {
      display: flex; align-items: center;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 0.4rem;
      padding: 0.3rem 0.5rem;
      gap: 0.3rem;
      transition: border-color 150ms, box-shadow 150ms;
    }
    .meta-field:focus-within .meta-input-wrap {
      border-color: #7c3aed;
      box-shadow: 0 0 0 2px rgba(124,58,237,0.1);
    }
    :host-context(.dark) .meta-input-wrap { background: var(--bg); border-color: rgba(148,163,184,0.12); }
    :host-context(.dark) .meta-field:focus-within .meta-input-wrap {
      border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,0.15);
    }
    .meta-edit-icon { display: none; }

    .meta-input {
      background: transparent;
      border: none; outline: none; padding: 0;
      font-size: 0.8rem; font-weight: 400;
      font-family: inherit; color: var(--text-primary);
      min-width: 100px; flex: 1;
    }
    .meta-input::placeholder { color: var(--text-muted); font-weight: 400; }

    /* Trigger del dropdown de estado */
    .estado-trigger {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.8125rem; font-weight: 400; font-family: inherit;
      color: var(--text-primary); cursor: pointer; width: 100%;
      background: transparent; border: none; outline: none; padding: 0; text-align: left;
    }
    .estado-trigger-dot, .edo-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; flex-shrink: 0; }
    .dot-draft { background: #f59e0b; }
    .dot-final { background: #10b981; }
    .estado-trigger-text { flex: 1; text-align: left; }

    /* ── Estado mobile action button ── */
    .btn-estado-mobile {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 600;
      border-radius: 0.625rem; cursor: pointer; font-family: inherit;
      transition: background 150ms, box-shadow 150ms, transform 150ms;
      min-height: 2.25rem; white-space: nowrap;
    }
    .btn-estado-mobile:active { transform: scale(0.96); }
    .btn-estado-mobile.is-borrador {
      background: rgba(245,158,11,0.12); color: #b45309;
      border: 1.5px solid rgba(245,158,11,0.35);
    }
    .btn-estado-mobile.is-borrador:hover { background: rgba(245,158,11,0.18); box-shadow: 0 0 0 3px rgba(245,158,11,0.15); }
    .btn-estado-mobile.is-finalizada {
      background: rgba(16,185,129,0.1); color: #047857;
      border: 1.5px solid rgba(16,185,129,0.3);
    }
    .btn-estado-mobile.is-finalizada:hover { background: rgba(16,185,129,0.16); }
    :host-context(.dark) .btn-estado-mobile.is-borrador {
      background: rgba(245,158,11,0.12); color: #fbbf24; border-color: rgba(251,191,36,0.3);
    }
    :host-context(.dark) .btn-estado-mobile.is-finalizada {
      background: rgba(16,185,129,0.1); color: #34d399; border-color: rgba(52,211,153,0.25);
    }

    /* Dropdown alineado a la derecha (para no salirse del viewport) */
    .estado-dropdown-left {
      right: 0; left: auto;
    }

    .estado-dropdown {
      position: absolute; top: calc(100% + 6px); left: 0; min-width: 260px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 0.75rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06);
      z-index: 100; overflow: hidden;
      animation: dropIn 150ms var(--ease-out) both;
    }
    :host-context(.dark) .estado-dropdown { box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3); }
    @keyframes dropIn { from { opacity:0; transform:translateY(-6px) scale(0.97); } to { opacity:1; transform:none; } }

    .estado-dropdown-header {
      padding: 0.625rem 1rem 0.375rem;
      font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--text-muted);
    }
    .estado-option {
      display: flex; align-items: center; gap: 0.75rem;
      width: 100%; padding: 0.75rem 1rem;
      font-size: 0.8125rem; font-weight: 500; font-family: inherit;
      color: var(--text-primary); background: transparent; border: none;
      cursor: pointer; text-align: left; transition: background 120ms;
    }
    .estado-option:hover { background: var(--surface-hover); }
    .estado-option.is-selected { color: #6d28d9; font-weight: 600; }
    :host-context(.dark) .estado-option:hover { background: rgba(255,255,255,0.05); }
    .estado-option + .estado-option { border-top: 1px solid var(--border); }
    .edo-option-text { display: flex; flex-direction: column; gap: 0.125rem; flex: 1; min-width: 0; }
    .edo-option-label { font-size: 0.875rem; font-weight: 600; line-height: 1.2; }
    .edo-option-sub { font-size: 0.75rem; font-weight: 400; color: var(--text-muted); line-height: 1.3; }
    .estado-option.is-selected .edo-option-label { color: #6d28d9; }
    .estado-backdrop { display: none; }
    .estado-bottomsheet { display: none; }
    .estado-bs-handle { display: none; }

    /* ── Asistentes avatares ── */
    .asistentes-row { display: flex; align-items: center; gap: 0; min-height: 1.75rem; }
    .avatar-chip {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.875rem; height: 1.875rem; border-radius: 50%;
      font-size: 0.6rem; font-weight: 700; letter-spacing: 0.02em;
      border: 2px solid var(--surface); margin-left: -0.4rem; flex-shrink: 0;
      cursor: default; user-select: none;
    }
    .avatar-chip:first-child { margin-left: 0; }
    .avatar-chip:nth-child(1) { background: #818cf8; color: #fff; }
    .avatar-chip:nth-child(2) { background: #34d399; color: #fff; }
    .avatar-chip:nth-child(3) { background: #f472b6; color: #fff; }
    :host-context(.dark) .avatar-chip { border-color: var(--surface); }

    .avatar-more { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); margin-left: 0.5rem; white-space: nowrap; }
    .asistentes-empty { font-size: 0.8rem; color: var(--text-muted); }

    .asistentes-add-wrap { display: flex; align-items: center; gap: 0.375rem; margin-left: 0.5rem; }
    .asistentes-add-input {
      border: 1px solid var(--border); border-radius: 0.375rem;
      padding: 0.25rem 0.5rem; font-size: 0.8rem;
      color: var(--text-primary); background: var(--surface);
      width: 120px; outline: none;
      transition: border-color 150ms, box-shadow 150ms;
      animation: slideInInput 150ms var(--ease-out) both;
    }
    @keyframes slideInInput { from { opacity: 0; width: 0; } to { opacity: 1; width: 120px; } }
    .asistentes-add-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); }
    :host-context(.dark) .asistentes-add-input { background: rgba(255,255,255,0.05); border-color: rgba(148,163,184,0.15); }

    .btn-add-person {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.875rem; height: 1.875rem; border-radius: 50%;
      border: 1.5px dashed var(--border); color: var(--text-muted);
      transition: border-color 150ms, color 150ms, background 150ms; flex-shrink: 0;
    }
    @media (hover: hover) {
      .btn-add-person:hover { border-color: #7c3aed; color: #7c3aed; background: rgba(124,58,237,0.06); border-style: solid; }
    }

    /* ═══════════════════════════════════════════
       MOBILE TABS BAR — pill style
    ═══════════════════════════════════════════ */
    .mobile-tabs-bar {
      display: none;
      overflow-x: auto;
      scrollbar-width: none;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0.5rem 0.75rem;
      gap: 0.375rem;
    }
    .mobile-tabs-bar::-webkit-scrollbar { display: none; }

    .mobile-tab {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.5rem 0.875rem;
      font-size: 0.8125rem; font-weight: 600;
      color: var(--text-muted);
      border-radius: 0.75rem;
      border: none;
      background: transparent;
      transition: color 160ms var(--ease-out), background-color 160ms var(--ease-out), transform 150ms var(--ease-out);
      white-space: nowrap; cursor: pointer;
      min-height: 2.5rem;
    }
    .mobile-tab:active { transform: scale(0.97); }
    @media (hover: hover) {
      .mobile-tab:hover:not(.is-active) {
        color: var(--text-secondary);
        background: rgba(15,23,42,0.05);
      }
      :host-context(.dark) .mobile-tab:hover:not(.is-active) {
        color: var(--text-secondary);
        background: rgba(255,255,255,0.05);
      }
    }
    .mobile-tab.is-active {
      color: #fff;
      background: var(--brand-purple);
      box-shadow: 0 2px 8px rgba(109,40,217,0.3);
    }
    :host-context(.dark) .mobile-tab.is-active { box-shadow: 0 2px 10px rgba(109,40,217,0.4); }

    .tab-icon { flex-shrink: 0; }

    /* ═══════════════════════════════════════════
       SHARED FIELD
    ═══════════════════════════════════════════ */
    .field {
      width: 100%;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-input); padding: 0.4rem 0.625rem;
      font-size: 0.8125rem; color: var(--text-primary);
      transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out), background-color 160ms;
    }
    :host-context(.dark) .field { background: rgba(255,255,255,0.04); border-color: rgba(148,163,184,0.1); }
    .field:focus {
      outline: none; border-color: #7c3aed;
      box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
    }
    :host-context(.dark) .field:focus {
      border-color: #7c3aed;
      box-shadow: 0 0 0 3px rgba(124,58,237,0.2), 0 0 12px rgba(124,58,237,0.1);
    }
    select.field {
      appearance: none; -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.625rem center;
      background-size: 0.875rem;
      padding-right: 2rem;
      cursor: pointer;
    }
    :host-context(.dark) select.field {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
    }

    /* Chips input */
    .chips-input {
      display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center;
      min-height: 34px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 0.5rem; padding: 0.25rem 0.625rem;
      transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    :host-context(.dark) .chips-input { background: rgba(255,255,255,0.04); border-color: rgba(148,163,184,0.1); }
    .chips-input:focus-within { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.15); }

    .chip {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.125rem 0.5rem; font-size: 0.7rem; font-weight: 500;
      background: rgba(124,58,237,0.1); color: var(--purple-text);
      border: 1px solid rgba(124,58,237,0.2); border-radius: 999px;
      animation: chipIn 180ms var(--ease-out) both;
    }
    @keyframes chipIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: none; } }
    .chip-remove {
      display: inline-flex; align-items: center; justify-content: center;
      width: 0.875rem; height: 0.875rem; font-size: 0.75rem; line-height: 1;
      color: currentColor; opacity: 0.6; border-radius: 999px;
      transition: opacity 120ms, background 120ms;
    }
    .chip-remove:hover { opacity: 1; background: rgba(124,58,237,0.25); }
    .chip-input { border: none; outline: none; background: transparent; font-size: 0.8rem; color: var(--text-primary); padding: 0; }
    .chip-input::placeholder { color: var(--text-muted); }

    /* ═══════════════════════════════════════════
       EDITOR COLUMNS — CORE ZERO-SCROLL LAYOUT
    ═══════════════════════════════════════════ */
    .editor-columns {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) minmax(0, 1.4fr) minmax(240px, 0.9fr);
      grid-template-rows: 1fr;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem 1rem;
      flex: 1 1 0;
      min-height: 0;
      overflow: hidden;
    }

    .editor-col {
      display: flex; flex-direction: column;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      overflow: hidden; min-height: 0;
      box-shadow: var(--col-shadow);
      transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
    }
    :host-context(.dark) .editor-col { background: var(--surface); }
    .editor-col:focus-within { outline: none; }
    .col-notas:focus-within { border-color: #f59e0b; box-shadow: var(--col-shadow), 0 0 0 1px #f59e0b, 0 0 20px rgba(245,158,11,0.10); }
    .col-acta:focus-within   { border-color: #7c3aed; box-shadow: var(--col-shadow), 0 0 0 1px #7c3aed, 0 0 20px rgba(124,58,237,0.10); }
    .col-tareas:focus-within  { border-color: #14b8a6; box-shadow: var(--col-shadow), 0 0 0 1px #14b8a6, 0 0 20px rgba(20,184,166,0.10); }

    .col-notas  { border-top: 2px solid #f59e0b; }
    .col-acta   { border-top: 2px solid #7c3aed; }
    .col-tareas { border-top: 2px solid #14b8a6; }
    :host-context(.dark) .col-notas  { border-top-color: #d97706; }
    :host-context(.dark) .col-acta   { border-top-color: #6d28d9; }
    :host-context(.dark) .col-tareas { border-top-color: #0d9488; }

    /* Column header */
    .col-header {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.625rem 1rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    :host-context(.dark) .col-header { background: rgba(0,0,0,0.1); }

    .col-header-text { flex: 1; min-width: 0; }
    .col-title { font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
    .col-subtitle { font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; margin-top: 0.05rem; }

    .col-hint {
      font-size: 0.625rem; color: var(--text-muted);
      background: var(--surface-2); border: 1px solid var(--border);
      padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-weight: 500;
      letter-spacing: 0.02em;
    }

    /* Column icon badge */
    .col-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.875rem; height: 1.875rem; border-radius: 0.625rem; flex-shrink: 0;
    }
    .col-icon-amber  { background: rgba(245,158,11,0.12); color: #d97706; border: 1px solid rgba(245,158,11,0.2); }
    .col-icon-purple { background: rgba(124,58,237,0.1);  color: #7c3aed; border: 1px solid rgba(124,58,237,0.2); }
    .col-icon-emerald{ background: rgba(20,184,166,0.1);  color: #0d9488; border: 1px solid rgba(20,184,166,0.2); }
    :host-context(.dark) .col-icon-amber   { background: rgba(245,158,11,0.1);  color: #fbbf24; border-color: rgba(251,191,36,0.18); }
    :host-context(.dark) .col-icon-purple  { background: rgba(124,58,237,0.12); color: #a78bfa; border-color: rgba(167,139,250,0.2); }
    :host-context(.dark) .col-icon-emerald { background: rgba(20,184,166,0.1);  color: #2dd4bf; border-color: rgba(45,212,191,0.18); }

    .task-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1.125rem; height: 1.125rem; padding: 0 0.3rem;
      font-size: 0.6rem; font-weight: 700;
      background: rgba(16,185,129,0.12); color: #10b981;
      border: 1px solid rgba(16,185,129,0.2); border-radius: 999px;
    }
    :host-context(.dark) .task-count { background: rgba(16,185,129,0.1); color: #34d399; border-color: rgba(52,211,153,0.18); }

    /* Column scrollable body */
    .col-body { flex: 1; overflow-y: auto; min-height: 0; }
    .col-body::-webkit-scrollbar { width: 4px; }
    .col-body::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.15); border-radius: 999px; }
    .col-body::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.35); }
    .col-body::-webkit-scrollbar-track { background: transparent; }
    :host-context(.dark) .col-body::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.1); }
    :host-context(.dark) .col-body::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.25); }

    /* Textareas fill the column body */
    .col-textarea {
      width: 100%; height: 100%;
      padding: 0.875rem 1rem;
      font-size: 0.9375rem; line-height: 1.7;
      color: var(--text-primary);
      background: transparent; border: none; outline: none; resize: none;
      caret-color: #7c3aed;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .col-textarea::placeholder { color: var(--text-muted); opacity: 0.6; font-style: italic; }
    .font-mono { font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 0.875rem; }
    .col-textarea:disabled { opacity: 0.6; cursor: not-allowed; }

    /* ── IA Button — brand purple ── */
    .btn-ia {
      display: inline-flex; align-items: center; gap: 0.375rem;
      margin-left: auto;
      padding: 0.375rem 0.875rem; font-size: 0.8125rem; font-weight: 600;
      background: linear-gradient(135deg, #6d28d9, #7c3aed);
      color: #fff;
      border: 1px solid transparent; border-radius: 0.625rem; cursor: pointer;
      box-shadow: 0 1px 6px rgba(109,40,217,0.25);
      transition: background 160ms var(--ease-out), box-shadow 160ms var(--ease-out), transform 160ms var(--ease-out);
    }
    @media (hover: hover) {
      .btn-ia:hover:not(:disabled) {
        background: linear-gradient(135deg, #5b21b6, #6d28d9);
        box-shadow: 0 4px 14px rgba(109,40,217,0.4);
      }
    }
    .btn-ia:active { transform: scale(0.97); }
    .btn-ia:disabled { opacity: 0.45; cursor: not-allowed; }
    .kbd-ia {
      display: inline-block; padding: 0.0625rem 0.25rem;
      font-size: 0.6rem; font-family: ui-monospace, monospace;
      background: rgba(0,0,0,0.25); border-radius: 0.25rem;
      border: 1px solid rgba(255,255,255,0.15);
    }

    /* ── Add task button ── */
    .btn-add-task {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.5rem; height: 1.5rem; border-radius: 0.375rem;
      color: #34d399; background: rgba(16,185,129,0.1);
      border: 1px solid rgba(52,211,153,0.2);
      transition: transform 160ms var(--ease-out), background-color 160ms, box-shadow 160ms;
    }
    .btn-add-task:active { transform: scale(0.88); }
    @media (hover: hover) {
      .btn-add-task:hover { background: rgba(16,185,129,0.2); box-shadow: 0 0 8px rgba(52,211,153,0.2); }
    }

    /* ═══════════════════════════════════════════
       TASK FORM
    ═══════════════════════════════════════════ */
    .task-form {
      padding: 0.625rem 0.75rem;
      border-bottom: 1px solid var(--border);
      display: flex; flex-direction: column; gap: 0.375rem;
      background: var(--meta-bg);
      animation: slideDown 200ms var(--ease-out) both;
      flex-shrink: 0;
    }
    :host-context(.dark) .task-form { background: rgba(0,0,0,0.2); }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

    .task-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; }
    .task-form-actions { display: flex; justify-content: flex-end; gap: 0.375rem; margin-top: 0.125rem; }

    .btn-ghost-xs, .btn-primary-xs {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.3125rem 0.625rem; font-size: 0.7rem; font-weight: 600;
      border-radius: 0.375rem; cursor: pointer;
      transition: transform 160ms var(--ease-out), background-color 160ms;
    }
    .btn-ghost-xs { color: var(--text-muted); }
    .btn-primary-xs {
      background: linear-gradient(135deg, #5b21b6, #7c3aed);
      color: #fff; box-shadow: 0 1px 6px rgba(124,58,237,0.3);
    }
    @media (hover: hover) {
      .btn-ghost-xs:hover { background: rgba(100,116,139,0.1); color: var(--text-secondary); }
      .btn-primary-xs:hover:not(:disabled) { background: linear-gradient(135deg, #4c1d95, #6d28d9); box-shadow: 0 2px 10px rgba(109,40,217,0.4); }
    }
    .btn-ghost-xs:active, .btn-primary-xs:active { transform: scale(0.97); }
    .btn-primary-xs:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ═══════════════════════════════════════════
       TASK LIST — card items
    ═══════════════════════════════════════════ */
    .task-list { list-style: none; padding: 0.5rem; margin: 0; display: flex; flex-direction: column; gap: 0.375rem; }

    .task-item {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      background: var(--surface);
      animation: rowIn 220ms var(--ease-out) both;
      animation-delay: var(--stagger, 0ms);
      transition: background 140ms, border-color 140ms, transform 140ms;
      cursor: default;
    }
    @media (hover: hover) {
      .task-item:hover { background: rgba(99,102,241,0.03); border-color: rgba(109,40,217,0.2); }
    }
    :host-context(.dark) .task-item { background: rgba(255,255,255,0.02); }
    :host-context(.dark) .task-item:hover { background: rgba(99,102,241,0.06); border-color: rgba(109,40,217,0.3); }
    .task-item.task-done { opacity: 0.48; }

    /* Status button */
    .task-status-btn {
      flex-shrink: 0; width: 1.375rem; height: 1.375rem;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 1.5px solid var(--border);
      background: transparent; cursor: pointer;
      transition: border-color 140ms, background 140ms, color 140ms;
      color: transparent;
    }
    .task-status-btn[data-estado="pendiente"]:hover { border-color: #6366f1; }
    .task-status-btn[data-estado="en_progreso"] { border-color: #3b82f6; color: #3b82f6; }
    .task-status-btn[data-estado="completada"]  { border-color: #10b981; background: #10b981; color: #fff; }
    .task-status-btn[data-estado="cancelada"]   { border-color: #94a3b8; color: #94a3b8; }

    .task-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.125rem; cursor: pointer; }
    .task-body:hover .task-title { color: #6366f1; }

    .task-title {
      font-size: 0.8125rem; font-weight: 500; color: var(--text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      transition: color 120ms; line-height: 1.45;
    }
    .task-title-done { text-decoration: line-through; color: var(--text-muted) !important; }

    .task-meta { display: flex; align-items: center; gap: 0.3rem; }
    .prio-pip { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
    .prio-pip[data-prio="alta"]  { background: #f43f5e; }
    .prio-pip[data-prio="media"] { background: #f59e0b; }
    .prio-pip[data-prio="baja"]  { background: #14b8a6; }
    .task-meta-text { font-size: 0.6875rem; color: var(--text-muted); }
    .task-meta-sep  { font-size: 0.6875rem; color: var(--border); }

    .btn-remove-task {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.375rem; height: 1.375rem; border-radius: 0.375rem;
      color: var(--text-muted); flex-shrink: 0;
      opacity: 0; transition: opacity 140ms, color 140ms, background 140ms;
    }
    .task-item:hover .btn-remove-task { opacity: 1; }
    .btn-remove-task:hover { background: rgba(244,63,94,0.1); color: #f43f5e; }
    .btn-remove-task:active { transform: scale(0.88); }

    .task-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 2rem 1rem; text-align: center;
      color: var(--text-muted); font-size: 0.75rem; gap: 0.375rem;
    }
    .task-empty svg { opacity: 0.3; margin-bottom: 0.25rem; }
    .task-empty p { font-weight: 500; font-size: 0.8rem; }

    /* ═══════════════════════════════════════════
       ACTA EMPTY STATE
    ═══════════════════════════════════════════ */
    .acta-body { position: relative; }
    .acta-empty-overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.375rem; padding: 2rem; text-align: center;
      pointer-events: auto; cursor: text; z-index: 1;
    }
    .acta-empty-icon {
      width: 2.5rem; height: 2.5rem; border-radius: 0.75rem;
      background: rgba(124,58,237,0.06); border: 1px solid rgba(124,58,237,0.1);
      display: flex; align-items: center; justify-content: center;
      color: rgba(124,58,237,0.35); margin-bottom: 0.5rem;
    }
    :host-context(.dark) .acta-empty-icon {
      background: rgba(124,58,237,0.05); border-color: rgba(167,139,250,0.08);
      color: rgba(167,139,250,0.3);
    }
    .acta-empty-title { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
    .acta-empty-sub { font-size: 0.6875rem; color: var(--text-muted); opacity: 0.7; line-height: 1.5; max-width: 18rem; }
    .acta-empty-sub strong { color: var(--purple-text); font-weight: 600; opacity: 1; }

    .btn-go-notas {
      margin-top: 0.875rem;
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.5rem 1.125rem; font-size: 0.8125rem; font-weight: 600;
      background: rgba(124,58,237,0.08); color: #7c3aed;
      border: 1px solid rgba(124,58,237,0.2); border-radius: 0.625rem;
      cursor: pointer; font-family: inherit;
      transition: background 150ms, box-shadow 150ms;
      min-height: 2.75rem;
    }
    .btn-go-notas:active { background: rgba(124,58,237,0.14); transform: scale(0.97); }
    :host-context(.dark) .btn-go-notas {
      background: rgba(124,58,237,0.1); color: #a78bfa;
      border-color: rgba(167,139,250,0.2);
    }

    /* ═══════════════════════════════════════════
       ACTA PREVIEW — Markdown renderizado
    ═══════════════════════════════════════════ */
    .acta-preview {
      padding: 1.25rem 1.375rem;
      font-size: 0.875rem; line-height: 1.8;
      color: var(--text-primary); cursor: text;
      min-height: 100%; word-break: break-word; overflow-y: auto;
    }
    .acta-preview:hover { background: rgba(124,58,237,0.012); }
    .acta-preview > *:first-child { margin-top: 0; }
    .acta-preview h1 { font-size: 1rem; font-weight: 700; line-height: 1.3; border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; margin: 1.5rem 0 0.625rem; color: var(--text-primary); }
    .acta-preview h2 { font-size: 0.9rem; font-weight: 700; line-height: 1.35; margin: 1.375rem 0 0.5rem; color: var(--text-primary); }
    .acta-preview h3 { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin: 1.125rem 0 0.375rem; }
    .acta-preview p { margin: 0 0 0.875rem; }
    .acta-preview strong { font-weight: 700; color: var(--text-primary); }
    .acta-preview em { font-style: italic; color: var(--text-secondary); }
    .acta-preview ul { margin: 0.25rem 0 0.875rem; padding-left: 1.375rem; list-style: none; }
    .acta-preview ul li { position: relative; padding-left: 0.875rem; margin-bottom: 0.35rem; }
    .acta-preview ul li::before { content: ''; position: absolute; left: 0; top: 0.7em; width: 0.3rem; height: 0.3rem; border-radius: 50%; background: var(--purple-text); opacity: 0.6; }
    .acta-preview ol { margin: 0.25rem 0 0.875rem; padding-left: 1.5rem; list-style: decimal; }
    .acta-preview ol li { margin-bottom: 0.35rem; }
    .acta-preview ol li::marker { color: var(--purple-text); font-weight: 600; font-size: 0.75rem; }
    .acta-preview hr { border: none; border-top: 1px solid var(--border); margin: 1.25rem 0; }

    .acta-textarea-hidden {
      position: absolute !important; opacity: 0 !important; pointer-events: none !important;
      width: 1px !important; height: 1px !important; overflow: hidden !important;
    }

    .btn-ia-empty {
      display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1rem;
      padding: 0.5rem 1.125rem; font-size: 0.8rem; font-weight: 600;
      background: linear-gradient(135deg, #5b21b6, #7c3aed);
      color: #fff; border-radius: 0.5rem; cursor: pointer;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 2px 10px -2px rgba(109,40,217,0.5);
      transition: transform 160ms var(--ease-out), box-shadow 160ms, opacity 160ms;
    }
    @media (hover: hover) {
      .btn-ia-empty:hover:not(:disabled) { box-shadow: 0 4px 20px -4px rgba(109,40,217,0.65); transform: translateY(-1px); }
    }
    .btn-ia-empty:active { transform: scale(0.97); }
    .btn-ia-empty:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ═══════════════════════════════════════════
       MOBILE SAVE INDICATOR — floating chip
    ═══════════════════════════════════════════ */
    .mobile-save-strip {
      display: none;
      position: fixed; bottom: 1rem; right: 1rem;
      z-index: 30; pointer-events: none;
    }
    .save-chip {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem; font-weight: 600; font-family: inherit;
      border-radius: 999px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.12);
      animation: chipPop 200ms var(--ease-out) both;
    }
    @keyframes chipPop { from { opacity: 0; transform: translateY(6px) scale(0.95); } to { opacity: 1; transform: none; } }
    .save-chip-saving {
      background: var(--surface); color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .save-chip-pending {
      background: rgba(245,158,11,0.1); color: #b45309;
      border: 1px solid rgba(245,158,11,0.25);
    }
    .save-chip-done {
      background: rgba(16,185,129,0.1); color: #047857;
      border: 1px solid rgba(16,185,129,0.25);
      animation: chipPop 200ms var(--ease-out) both, chipFade 400ms ease-out 2.5s both;
    }
    @keyframes chipFade { to { opacity: 0; transform: translateY(4px); } }
    :host-context(.dark) .save-chip-saving { background: var(--surface); border-color: var(--border); }
    :host-context(.dark) .save-chip-pending { background: rgba(245,158,11,0.1); color: #fbbf24; border-color: rgba(251,191,36,0.2); }
    :host-context(.dark) .save-chip-done { background: rgba(16,185,129,0.1); color: #34d399; border-color: rgba(52,211,153,0.2); }
    .save-pending-dot {
      width: 0.45rem; height: 0.45rem; border-radius: 50%;
      background: #f59e0b;
      animation: pendingPulse 1.4s ease-in-out infinite;
    }
    @keyframes pendingPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }

    /* ═══════════════════════════════════════════
       SPINNER
    ═══════════════════════════════════════════ */
    .spinner {
      width: 0.8rem; height: 0.8rem; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: spin 600ms linear infinite; display: inline-block; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ═══════════════════════════════════════════
       TABLET (768–1279px)
    ═══════════════════════════════════════════ */
    @media (max-width: 1279px) and (min-width: 768px) {
      .editor-columns {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr auto;
        padding: 0.75rem 1rem 0.875rem;
      }
      .col-tareas {
        grid-column: 1 / -1;
        max-height: 240px;
        flex-direction: row;
        border-radius: 0.75rem;
      }
      .col-tareas .col-header {
        flex-direction: column; align-items: flex-start;
        width: 160px; border-bottom: none; border-right: 1px solid var(--border);
        flex-shrink: 0;
      }
      .col-tareas .task-form { flex-direction: row; flex-wrap: wrap; padding: 0.5rem; }
      .header-inner { padding: 0 1rem; }
      /* Meta bar: scroll horizontal sin wrap para no ocupar 2 filas */
      .meta-bar { overflow-x: auto; flex-wrap: nowrap; }
      .meta-field { min-width: 130px; flex-shrink: 0; }
      /* Botones exportar: solo ícono en tablet para ahorrar espacio en header */
      .btn-export-label { display: none; }
      .btn-export { padding: 0.375rem 0.625rem; min-width: 2.25rem; justify-content: center; }
    }

    /* ═══════════════════════════════════════════
       MOBILE (< 768px)
    ═══════════════════════════════════════════ */
    @media (max-width: 767px) {
      /* ── Estado: bottom sheet nativo en móvil ── */
      .estado-backdrop {
        display: block;
        position: fixed; inset: 0; z-index: 98;
        background: rgba(0,0,0,0.4);
        animation: bsFadeIn 180ms ease both;
      }
      @keyframes bsFadeIn { from { opacity: 0; } to { opacity: 1; } }

      .estado-bottomsheet {
        display: block;
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 99;
        background: var(--surface);
        border-radius: 1.25rem 1.25rem 0 0;
        box-shadow: 0 -8px 40px rgba(0,0,0,0.2);
        padding-bottom: env(safe-area-inset-bottom, 0.75rem);
        animation: bsSlideUp 240ms cubic-bezier(0.32,0.72,0,1) both;
        overflow: hidden;
      }
      @keyframes bsSlideUp { from { transform: translateY(100%); opacity: 0.5; } to { transform: translateY(0); opacity: 1; } }

      .estado-bs-handle {
        display: block;
        width: 2.5rem; height: 0.25rem;
        background: var(--border);
        border-radius: 99px;
        margin: 0.625rem auto 0;
      }

      .estado-bs-title {
        padding: 0.625rem 1.25rem 0.75rem;
        font-size: 0.6875rem; font-weight: 700;
        letter-spacing: 0.07em; text-transform: uppercase;
        color: var(--text-muted); text-align: center;
      }

      .estado-bs-option {
        display: flex; align-items: center; gap: 0.875rem;
        width: 100%; padding: 1rem 1.25rem;
        min-height: 4.25rem;
        font-size: 0.875rem; font-weight: 500; font-family: inherit;
        color: var(--text-primary); background: transparent; border: none;
        cursor: pointer; text-align: left;
        transition: background 120ms;
        touch-action: manipulation;
      }
      .estado-bs-option:active { background: var(--surface-hover); }
      .estado-bs-option + .estado-bs-option { border-top: 1px solid var(--border); }
      .estado-bs-option.is-selected .edo-option-label { color: #6d28d9; font-weight: 700; }
      .edo-dot { width: 0.625rem; height: 0.625rem; flex-shrink: 0; }
      .edo-option-label { font-size: 1rem; font-weight: 600; }
      .edo-option-sub { font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.125rem; }

      .readonly-banner { display: none; }

      /* ── Anti-zoom iOS: all inputs ≥ 16px ── */
      .meta-input,
      .field,
      .col-textarea,
      .asistentes-add-input,
      .chip-input {
        font-size: 1rem !important;
      }
      .field { min-height: 2.75rem; }

      /* Full-height flex layout: editor-root fills viewport, workspace fills remaining */
      .editor-root { overflow: hidden; }
      .workspace { flex: 1 1 0; min-height: 0; overflow: hidden; }

      .mobile-tabs-bar { display: flex; }
      .mobile-save-strip { display: block; }

      /* ── Single-row compact navigation bar ── */
      .editor-header {
        position: sticky; top: 0; z-index: 20;
        /* Colapsa las dos filas en una sola barra horizontal */
        display: flex; flex-direction: row; align-items: center;
        min-height: 3.25rem; /* 52px — estándar nav bar nativo */
        padding: 0;
        background: rgba(255,255,255,0.96);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--border);
        box-shadow: 0 1px 0 var(--border);
      }
      :host-context(.dark) .editor-header {
        background: rgba(10,17,32,0.96);
      }

      /* Back button: columna izquierda */
      .header-nav {
        padding: 0 0.25rem 0 0.75rem;
        flex-shrink: 0; display: flex; align-items: center;
      }
      .nav-back {
        padding: 0.5rem 0.625rem 0.5rem 0.375rem;
        font-size: 0.75rem;
        gap: 0.25rem;
        border-radius: 0.625rem;
      }

      /* Título + badge: columna central (flex: 1) */
      .header-main {
        flex: 1; min-width: 0;
        padding: 0 0.75rem 0 0.375rem;
        gap: 0.5rem; align-items: center;
      }
      .header-left {
        flex: 1; min-width: 0;
        flex-direction: row; align-items: center; gap: 0.5rem;
      }
      .header-acta-title {
        font-size: 0.875rem; font-weight: 700;
        max-width: none;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      /* Pill redundante: el botón Finalizar ya comunica el estado */
      .estado-pill { display: none; }
      .header-center { display: none; }
      /* header-actions visible solo para el botón de estado */
      .header-actions { display: flex; align-items: center; flex-shrink: 0; gap: 0; }
      .btn-export, .btn-save, .saved-label { display: none !important; }

      /* Sticky tabs — ahora a 52px del top en lugar de 76px */
      .mobile-tabs-bar {
        position: sticky; top: 3.25rem; z-index: 19;
        background: rgba(255,255,255,0.96);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      :host-context(.dark) .mobile-tabs-bar {
        background: rgba(10,17,32,0.96);
      }

      .meta-bar { flex-direction: column; padding: 0.75rem 1rem; margin: 0.5rem 0.75rem; }
      .meta-field { width: 100%; flex-direction: row; align-items: center; padding: 0.375rem 0; }
      .meta-label { min-width: 5rem; flex-shrink: 0; }
      .meta-divider { width: 100%; height: 1px; }
      .meta-field-asistentes { flex-direction: column; align-items: flex-start; }

      .editor-columns {
        display: flex; flex-direction: column;
        flex: 1 1 0; min-height: 0;
        padding: 0; overflow: hidden;
      }

      .editor-col {
        display: none;
        border-radius: 0;
        border-left: none; border-right: none; border-top: none;
      }
      .editor-col.is-active {
        display: flex;
        flex: 1 1 0; min-height: 0;
        animation: panelIn 200ms var(--ease-out) both;
      }
      @keyframes panelIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

      /* Clearance so save chip doesn't cover last content */
      .editor-col.is-active .col-body { padding-bottom: 4rem; }

      .tab-hidden { display: none !important; }

      /* col-header wraps on mobile: btn-ia drops to its own row */
      .col-header { flex-wrap: wrap; row-gap: 0.5rem; padding-bottom: 0.625rem; }
      .btn-ia { margin-left: 0; width: 100%; justify-content: center; }
      /* Keyboard shortcut badge is irrelevant on touch */
      .kbd-ia { display: none; }

      .col-tareas .col-header { padding: 0.75rem 1rem 0.625rem; flex-wrap: wrap; }
      .task-list { padding: 0.5rem; }

      /* Show remove buttons always on mobile (no hover) */
      .btn-remove-task { opacity: 1; }

      /* Faster tap response on all interactive elements */
      button, [role="tab"] { touch-action: manipulation; }

      /* ── Task list: títulos legibles en mobile ── */
      .task-title {
        white-space: normal;
        line-height: 1.4;
        word-break: break-word;
      }
      .task-item {
        align-items: flex-start;
        padding: 0.75rem 0.625rem;
      }
      .task-body { gap: 0.3rem; }

      /* ── Touch targets: mínimo 44px (2.75rem) ── */
      .task-status-btn {
        min-width: 2.5rem; min-height: 2.5rem;
        margin-top: 0.0625rem; /* alinea con primera línea de texto */
        flex-shrink: 0;
      }
      .btn-remove-task {
        min-width: 2.5rem; min-height: 2.5rem;
        border-radius: 0.5rem;
        flex-shrink: 0;
        margin-top: -0.125rem;
      }
      .btn-add-task {
        min-width: 2.5rem; min-height: 2.5rem;
        border-radius: 0.625rem;
      }

      /* ── Task form: una columna en mobile ── */
      .task-form-row { grid-template-columns: 1fr; }
      .task-form-actions { gap: 0.5rem; }
      .btn-ghost-xs, .btn-primary-xs {
        flex: 1; justify-content: center;
        padding: 0.625rem 1rem;
        font-size: 0.8125rem; min-height: 2.75rem;
      }
    }

    /* ═══════════════════════════════════════════
       REDUCED MOTION
    ═══════════════════════════════════════════ */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* ═══════════════════════════════════════════
       MISC UTILITIES
    ═══════════════════════════════════════════ */
    @keyframes rowIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    .line-through { text-decoration: line-through; }
    .mt-2 { margin-top: 0.5rem; }
    .rotate-45 { transform: rotate(45deg); }
    .meta-input:disabled { opacity: 0.55; cursor: not-allowed; }
    .w-5 { width: 1.25rem; } .h-5 { height: 1.25rem; }
    .w-6 { width: 1.5rem; }  .h-6 { height: 1.5rem; }

    /* ═══════════════════════════════════════════
       CONFIRM MODAL (eliminar tarea)
    ═══════════════════════════════════════════ */
    .confirm-overlay {
      position: fixed; inset: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
      background: rgba(8, 10, 14, 0.55);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      animation: overlayIn 160ms ease-out;
    }
    @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

    .confirm-dialog {
      width: 100%; max-width: 360px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, rgba(0,0,0,0.08));
      border-radius: 1rem; padding: 1.5rem 1.5rem 1.25rem;
      box-shadow: 0 20px 50px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04);
      text-align: center;
      animation: dialogIn 200ms cubic-bezier(0.16, 1, 0.3, 1); font-family: inherit;
    }
    @keyframes dialogIn { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .confirm-icon-wrap {
      width: 44px; height: 44px; margin: 0 auto 0.875rem;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; background: rgba(239,68,68,0.1); color: #ef4444;
    }
    .confirm-title { font-size: 1.0625rem; font-weight: 600; color: var(--text-primary); margin: 0 0 0.25rem; letter-spacing: -0.01em; }
    .confirm-message { font-size: 0.8125rem; color: var(--text-muted); margin: 0 0 0.625rem; }
    .confirm-target {
      font-size: 0.8125rem; color: var(--text-primary); margin: 0 0 1.25rem;
      padding: 0.5rem 0.75rem; background: rgba(0,0,0,0.03); border-radius: 8px;
      word-break: break-word; font-weight: 500;
      max-height: 4.5rem; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    }
    :host-context(.dark) .confirm-target { background: rgba(255,255,255,0.04); }

    .confirm-actions { display: flex; gap: 0.5rem; }
    .confirm-btn {
      flex: 1; padding: 0.625rem 1rem; border-radius: 0.625rem;
      font-size: 0.8125rem; font-weight: 600; font-family: inherit;
      border: 1px solid transparent; cursor: pointer;
      transition: all 140ms ease-out;
    }
    .confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .confirm-btn-ghost {
      background: transparent; border-color: var(--border, rgba(0,0,0,0.12)); color: var(--text-primary);
    }
    .confirm-btn-ghost:hover:not(:disabled) { background: rgba(0,0,0,0.04); }
    :host-context(.dark) .confirm-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.05); }
    .confirm-btn-danger { background: #ef4444; color: #fff; box-shadow: 0 1px 2px rgba(239,68,68,0.3); }
    .confirm-btn-danger:hover:not(:disabled) { background: #dc2626; transform: translateY(-1px); box-shadow: 0 4px 10px -2px rgba(239,68,68,0.45); }
    .confirm-btn-danger:active:not(:disabled) { transform: translateY(0); }

    /* ═══════════════════════════════════════════
       TAREA DRAWER (desktop)
    ═══════════════════════════════════════════ */
    .tarea-drawer-overlay {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(8, 10, 14, 0.35);
      animation: overlayIn 180ms ease-out;
    }
    .tarea-drawer {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: min(480px, 100vw);
      background: var(--surface, #fff);
      border-left: 1px solid var(--border, #e2e8f0);
      overflow-y: auto;
      z-index: 201;
      animation: drawerIn 240ms cubic-bezier(0.23, 1, 0.32, 1);
      display: flex;
      flex-direction: column;
      padding: 1.25rem;
    }
    :host-context(.dark) .tarea-drawer { background: #0a1120; border-color: #1e2d45; }
    @keyframes drawerIn {
      from { transform: translateX(100%); opacity: 0.4; }
      to   { transform: translateX(0);    opacity: 1; }
    }
  `]
})
export class ActaEditorPage implements OnInit, OnDestroy {
  private svc = inject(ActaService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('actaTextarea') actaTextareaRef!: ElementRef<HTMLTextAreaElement>;

  acta = signal<Acta | null>(null);
  isReadonly = computed(() => this.acta()?.estado === 'finalizada');
  tareas = signal<Tarea[]>([]);
  meta: any = {};
  asistentesArr = signal<string[]>([]);
  nuevoAsistente = '';
  guardando = signal(false);
  redactando = signal(false);
  agregandoTarea = signal(false);
  tareaForm: any = { titulo: '', descripcion: '', prioridad: 'media', fecha_limite: null };
  tareaAEliminar = signal<Tarea | null>(null);
  eliminandoTarea = signal(false);
  tareaDrawerId = signal<number | null>(null);

  hasUnsaved = signal(false);
  savedAgo = signal<string | null>(null);
  activeTab = signal<MobileTab>('notas');
  isMobileMode = signal(false);
  addingAsistente = false;
  estadoOpen = false;
  actaFocused = signal(false);
  actaHtml = computed<SafeHtml>(() => this.markdownToHtml(this.acta()?.contenido_redactado ?? ''));

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savedAt: Date | null = null;
  private savedAgoTimer: ReturnType<typeof setInterval> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  mobileTabs: { id: MobileTab; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'notas', label: 'Notas' },
    { id: 'acta', label: 'Acta' },
    { id: 'tareas', label: 'Tareas' },
  ];

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (!this.isReadonly()) this.guardar(); }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this.redactarIA(); }
  }

  ngOnInit() {
    const id = Number(this.route.snapshot.params['id']);
    this.svc.get(id).subscribe(a => {
      this.acta.set(a);
      this.meta = a.metadata_json || {};
      const asis = this.meta.asistentes;
      this.asistentesArr.set(Array.isArray(asis) ? asis : (asis ? String(asis).split(',').map((s: string) => s.trim()).filter(Boolean) : []));
    });
    this.svc.listarTareas(id).subscribe(t => this.tareas.set(t));

    this.resizeObserver = new ResizeObserver(() => {
      this.isMobileMode.set(window.innerWidth < 768);
    });
    this.resizeObserver.observe(document.documentElement);
    this.isMobileMode.set(window.innerWidth < 768);

    this.savedAgoTimer = setInterval(() => this.updateSavedAgo(), 10_000);
  }

  ngOnDestroy() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.savedAgoTimer) clearInterval(this.savedAgoTimer);
    this.resizeObserver?.disconnect();
  }

  markDirty() {
    if (this.isReadonly()) return;
    this.hasUnsaved.set(true);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const delay = window.innerWidth < 768 ? 1500 : 3000;
    this.saveTimer = setTimeout(() => this.guardar(true), delay);
  }

  private updateSavedAgo() {
    if (!this.savedAt) return;
    const secs = Math.round((Date.now() - this.savedAt.getTime()) / 1000);
    if (secs < 60) this.savedAgo.set(`hace ${secs}s`);
    else this.savedAgo.set(`hace ${Math.round(secs / 60)}min`);
  }

  tipoLabel(t: string): string {
    return ({ ancianos: 'Ancianos', trimestral: 'Trimestral', comite_servicio: 'Comité', otra: 'Otra' } as Record<string, string>)[t] || t;
  }

  formatFecha(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  volver() { this.router.navigate(['/secretario-tools/actas-reunion']); }

  guardar(auto = false) {
    const a = this.acta();
    if (!a) return;
    if (!auto) this.guardando.set(true);
    const metadata_json = { ...this.meta, asistentes: this.asistentesArr() };
    this.svc.update(a.id_acta, {
      titulo: a.titulo,
      fecha_reunion: a.fecha_reunion,
      tipo_reunion: a.tipo_reunion,
      notas_originales: a.notas_originales,
      contenido_redactado: a.contenido_redactado,
      estado: a.estado,
      metadata_json,
    }).subscribe({
      next: (updated) => {
        this.acta.set(updated);
        this.guardando.set(false);
        this.hasUnsaved.set(false);
        this.savedAt = new Date();
        this.savedAgo.set('hace 0s');
      },
      error: (e) => {
        if (!auto) alert(e?.error?.detail || 'Error al guardar');
        this.guardando.set(false);
      },
    });
  }

  redactarIA() {
    const a = this.acta();
    if (!a || !a.notas_originales) return;
    this.guardar(true);
    this.redactando.set(true);
    this.acta.update(x => x ? { ...x, contenido_redactado: '' } : x);
    this.svc.redactarIA({ id_acta: a.id_acta }).subscribe({
      next: (res) => {
        this.acta.update(x => x ? { ...x, contenido_redactado: res.contenido_redactado } : x);
        this.svc.listarTareas(a.id_acta).subscribe(t => this.tareas.set(t));
        this.redactando.set(false);
        this.hasUnsaved.set(true);
        this.actaFocused.set(false);
        if (this.isMobileMode()) this.activeTab.set('acta');
      },
      error: (e) => { alert(e?.error?.detail || 'Error al redactar con IA'); this.redactando.set(false); },
    });
  }

  exportar(formato: 'pdf' | 'docx') {
    const a = this.acta();
    if (!a) return;
    this.svc.exportar(a.id_acta, formato).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${a.titulo.replace(/\s+/g, '_')}.${formato}`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  focusActa() {
    this.actaFocused.set(true);
    setTimeout(() => this.actaTextareaRef?.nativeElement?.focus(), 0);
  }

  onActaBlur() {
    this.actaFocused.set(false);
  }

  markdownToHtml(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
      .replace(/_([^_\n]+?)_/g, '<em>$1</em>')
      .replace(/^---+$/gm, '<hr>')
      .replace(/((?:^[ \t]*[-*] .+\n?)+)/gm, block => {
        const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*[-*] /, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
      })
      .replace(/((?:^[ \t]*\d+\. .+\n?)+)/gm, block => {
        const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*\d+\. /, '')}</li>`).join('');
        return `<ol>${items}</ol>`;
      });
    html = html.split(/\n{2,}/).map(block => {
      const t = block.trim();
      if (!t) return '';
      if (/^<(h[1-3]|ul|ol|hr)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  }

  setEstado(a: any, val: string) {
    a.estado = val;
    this.estadoOpen = false;
    this.hasUnsaved.set(true);
    this.guardar();
  }

  onEstadoBlur() {
    setTimeout(() => { this.estadoOpen = false; }, 150);
  }

  toggleAddAsistente() {
    this.addingAsistente = !this.addingAsistente;
    if (!this.addingAsistente) this.nuevoAsistente = '';
  }

  onAddAsistenteBlur() {
    setTimeout(() => {
      if (this.nuevoAsistente.trim()) this.agregarAsistente();
      else { this.addingAsistente = false; this.nuevoAsistente = ''; }
    }, 150);
  }

  agregarAsistente() {
    const val = this.nuevoAsistente.trim();
    if (!val) return;
    this.asistentesArr.update(arr => arr.includes(val) ? arr : [...arr, val]);
    this.nuevoAsistente = '';
    this.addingAsistente = false;
    this.markDirty();
  }

  quitarAsistente(name: string) {
    this.asistentesArr.update(arr => arr.filter(a => a !== name));
    this.markDirty();
  }

  crearTarea() {
    const a = this.acta()!;
    this.svc.crearTarea(a.id_acta, this.tareaForm).subscribe({
      next: (t) => {
        this.tareas.update(arr => [t, ...arr]);
        this.tareaForm = { titulo: '', descripcion: '', prioridad: 'media', fecha_limite: null };
        this.agregandoTarea.set(false);
      },
      error: (e) => alert(e?.error?.detail || 'Error'),
    });
  }

  cambiarEstado(t: Tarea, estado: Tarea['estado']) {
    this.svc.actualizarEstadoTarea(t.id_tarea, estado).subscribe(updated => {
      this.tareas.update(arr => arr.map(x => x.id_tarea === t.id_tarea ? updated : x));
    });
  }

  eliminarTarea(t: Tarea) {
    this.tareaAEliminar.set(t);
  }

  confirmarEliminarTarea() {
    const t = this.tareaAEliminar();
    if (!t) return;
    this.eliminandoTarea.set(true);
    this.svc.eliminarTarea(t.id_tarea).subscribe({
      next: () => {
        this.tareas.update(arr => arr.filter(x => x.id_tarea !== t.id_tarea));
        this.tareaAEliminar.set(null);
        this.eliminandoTarea.set(false);
      },
      error: () => { this.eliminandoTarea.set(false); },
    });
  }

  cancelarEliminarTarea() {
    if (this.eliminandoTarea()) return;
    this.tareaAEliminar.set(null);
  }

  estadoShort(e: Tarea['estado']): string {
    return { pendiente: 'Pendiente', en_progreso: 'En curso', completada: 'Lista', cancelada: 'Cancelada' }[e] ?? e;
  }

  nextEstado(e: Tarea['estado']): Tarea['estado'] {
    const cycle: Tarea['estado'][] = ['pendiente', 'en_progreso', 'completada'];
    const i = cycle.indexOf(e);
    return i >= 0 ? cycle[(i + 1) % cycle.length] : 'pendiente';
  }

  verTarea(t: Tarea) {
    if (window.innerWidth >= 768) {
      this.tareaDrawerId.set(t.id_tarea);
    } else {
      const a = this.acta();
      this.router.navigate(
        ['/secretario-tools/tareas', t.id_tarea],
        { queryParams: { desde: 'acta-editor', ...(a ? { origen_acta: a.id_acta } : {}) } },
      );
    }
  }

  onTareaActualizadaEnDrawer(updated: Tarea) {
    this.tareas.update(list => list.map(t => t.id_tarea === updated.id_tarea ? updated : t));
  }

  onTareaEliminadaEnDrawer(id: number) {
    this.tareas.update(list => list.filter(t => t.id_tarea !== id));
    this.tareaDrawerId.set(null);
  }
}

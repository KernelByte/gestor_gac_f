import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import {
  EmptyStateComponent,
  StatCardComponent,
  TabNavComponent,
  ToastService,
  ModalComponent,
  ConfirmDialogComponent,
  AvatarComponent,
  BreadcrumbsComponent,
  ProgressComponent,
  DropdownComponent,
  TooltipDirective,
  TabItem,
} from '../../shared/components';

@Component({
  selector: 'app-design-system',
  standalone: true,
  imports: [
    CommonModule,
    EmptyStateComponent,
    StatCardComponent,
    TabNavComponent,
    ModalComponent,
    ConfirmDialogComponent,
    AvatarComponent,
    BreadcrumbsComponent,
    ProgressComponent,
    DropdownComponent,
    TooltipDirective,
    LucideAngularModule,
  ],
  template: `
    <div class="max-w-6xl mx-auto py-2 pb-20">

      <!-- Hero badge -->
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-xs font-semibold mb-3">
        <span class="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
        INTERNO · DESIGN SYSTEM v2
      </div>

      <h1 class="display-hero mb-2">Sistema de Diseño GAC</h1>
      <p class="text-base text-gray-500 dark:text-slate-400 max-w-2xl leading-relaxed mb-10">
        Catálogo vivo de componentes, tipografía, color y patrones. Esta página sirve como referencia
        tanto para humanos como para IA al diseñar nuevas pantallas.
      </p>

      <!-- Breadcrumbs -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Breadcrumbs</h2>
        <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">Navegación contextual.</p>
        <div class="card-elevated p-5">
          <app-breadcrumbs [items]="[
            { label: 'Inicio', link: '/' },
            { label: 'Secretario', link: '/secretario/publicadores' },
            { label: 'Detalle publicador' }
          ]"></app-breadcrumbs>
        </div>
      </section>

      <!-- Paleta -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Paleta</h2>
        <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">Violeta es marca global. Naranja/Verde/Azul son por módulo.</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="card-elevated p-4">
            <div class="h-16 rounded-lg gradient-brand mb-3"></div>
            <p class="eyebrow">Marca · Violet</p>
            <p class="data-num text-xs mt-0.5">#6d28d9</p>
          </div>
          <div class="card-elevated p-4">
            <div class="h-16 rounded-lg gradient-orange mb-3"></div>
            <p class="eyebrow">Publicadores</p>
            <p class="data-num text-xs mt-0.5">#f97316</p>
          </div>
          <div class="card-elevated p-4">
            <div class="h-16 rounded-lg gradient-green mb-3"></div>
            <p class="eyebrow">Territorios</p>
            <p class="data-num text-xs mt-0.5">#059669</p>
          </div>
          <div class="card-elevated p-4">
            <div class="h-16 rounded-lg gradient-blue mb-3"></div>
            <p class="eyebrow">Exhibidores</p>
            <p class="data-num text-xs mt-0.5">#2563eb</p>
          </div>
        </div>
      </section>

      <!-- Tipografía -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Tipografía</h2>
        <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">Urbanist (display) · Manrope (body) · JetBrains Mono (datos).</p>
        <div class="card-elevated p-6 space-y-4">
          <div><span class="eyebrow">.display-hero</span><p class="display-hero">Hero Display</p></div>
          <div><span class="eyebrow">.display-title</span><p class="display-title">Título de Página</p></div>
          <div><span class="eyebrow">.display-section</span><p class="display-section">Sección</p></div>
          <div><span class="eyebrow">.section-title</span><p class="section-title">Título de bloque</p></div>
          <div><span class="eyebrow">.data-num · mono</span><p class="data-num text-2xl">1,247 · 03/14/2026 · #4521</p></div>
        </div>
      </section>

      <!-- Botones -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Botones</h2>
        <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">CTA primario varía por módulo. Sombra tintada + microinteracción.</p>
        <div class="card-elevated p-6 flex flex-wrap gap-3">
          <button class="btn-primary-violet focus-ring">Guardar (violet)</button>
          <button class="btn-primary-orange focus-ring-orange">Nuevo Publicador</button>
          <button class="btn-primary-green focus-ring-green">Nuevo Territorio</button>
          <button class="btn-primary-blue focus-ring-blue">Nuevo Exhibidor</button>
          <button class="btn-secondary focus-ring">Secundario</button>
          <button class="btn-ghost-danger focus-ring">Eliminar</button>
        </div>
      </section>

      <!-- Badges -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Badges</h2>
        <div class="card-elevated p-6 flex flex-wrap gap-2">
          <span class="badge-role">Precursor Regular</span>
          <span class="badge-active">Activo</span>
          <span class="badge-inactive">Inactivo</span>
          <span class="badge-warning">Pendiente</span>
          <span class="badge-neutral">Sin asignar</span>
          <span class="badge-live">En vivo</span>
        </div>
      </section>

      <!-- Avatares -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Avatares</h2>
        <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">Color generado por hash del nombre.</p>
        <div class="card-elevated p-6 flex items-center gap-4 flex-wrap">
          <app-avatar name="María González" size="xs"></app-avatar>
          <app-avatar name="Carlos Pérez" size="sm"></app-avatar>
          <app-avatar name="Ana Rodríguez" size="md"></app-avatar>
          <app-avatar name="Juan Martínez" size="lg"></app-avatar>
          <app-avatar name="Sofía Hernández" size="md"></app-avatar>
          <app-avatar name="Luis Sánchez" size="md"></app-avatar>
        </div>
      </section>

      <!-- Stat Cards -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Stat Cards</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <app-stat-card variant="minimal" label="Publicadores" value="215"></app-stat-card>
          <app-stat-card variant="minimal" label="Grupos" value="12" sub="2 sin encargado"></app-stat-card>
          <app-stat-card variant="standard" color="green" label="Territorios" value="42"></app-stat-card>
          <app-stat-card variant="standard" color="blue" label="Exhibidores" value="8"></app-stat-card>
        </div>
      </section>

      <!-- Progress -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Progress</h2>
        <div class="grid md:grid-cols-2 gap-4">
          <div class="card-elevated p-6 space-y-4">
            <app-progress variant="linear" [value]="72" label="Avance del mes" color="violet"></app-progress>
            <app-progress variant="linear" [value]="40" label="Territorios cubiertos" color="green"></app-progress>
            <app-progress variant="linear" [value]="92" label="Informes recibidos" color="orange"></app-progress>
          </div>
          <div class="card-elevated p-6 flex items-center justify-around">
            <app-progress variant="circular" [value]="72" color="violet"></app-progress>
            <app-progress variant="circular" [value]="40" color="green" [size]="72"></app-progress>
            <app-progress variant="circular" [value]="92" color="orange" [size]="88" [stroke]="8"></app-progress>
          </div>
        </div>
      </section>

      <!-- Tabs -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Tab Navigation</h2>
        <div class="card-elevated p-6">
          <app-tab-nav [tabs]="tabs" [activeTab]="activeTab()" color="orange" (tabChange)="activeTab.set($event)"></app-tab-nav>
        </div>
      </section>

      <!-- Dropdown + Tooltip -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Dropdown · Tooltip</h2>
        <div class="card-elevated p-6 flex items-center gap-6 flex-wrap">
          <app-dropdown [items]="dropdownItems" (itemClick)="onDropdown($event)">
            <button slot="trigger" class="btn-secondary">
              Acciones
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
              </svg>
            </button>
          </app-dropdown>

          <button [appTooltip]="'Pasa el mouse para ver el tooltip'" class="btn-secondary">Hover aquí</button>
          <button [appTooltip]="'Acción rápida: editar registro'" tooltipPlacement="bottom" class="btn-primary-violet">Tooltip abajo</button>
        </div>
      </section>

      <!-- Toasts -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Toasts</h2>
        <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">Aparecen abajo a la derecha. Auto-dismiss a los 4s.</p>
        <div class="card-elevated p-6 flex flex-wrap gap-3">
          <button (click)="toast.success('Publicador creado', 'Se agregó correctamente')" class="btn-primary-green focus-ring-green">Success</button>
          <button (click)="toast.error('Error de conexión', 'Verifica tu internet')" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition active:scale-95">Error</button>
          <button (click)="toast.warning('Atención', 'Hay cambios sin guardar')" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition active:scale-95">Warning</button>
          <button (click)="toast.info('Sugerencia', 'Usa Ctrl+K para buscar')" class="btn-primary-blue focus-ring-blue">Info</button>
        </div>
      </section>

      <!-- Modal + Confirm -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Modales</h2>
        <div class="card-elevated p-6 flex flex-wrap gap-3">
          <button (click)="modalOpen.set(true)" class="btn-primary-violet focus-ring">Abrir Modal</button>
          <button (click)="confirmOpen.set(true)" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition active:scale-95">Confirmar eliminación</button>
        </div>

        <app-modal [open]="modalOpen()" (openChange)="modalOpen.set($event)" title="Editar publicador" subtitle="Actualiza la información personal" [hasFooter]="true" size="md">
          <div class="space-y-4">
            <div>
              <label class="form-label">Nombre completo</label>
              <input class="form-control" placeholder="Carlos Pérez" />
            </div>
            <div>
              <label class="form-label">Grupo</label>
              <select class="form-select"><option>Grupo #1</option><option>Grupo #2</option></select>
            </div>
          </div>
          <ng-container slot="footer">
            <button (click)="modalOpen.set(false)" class="btn-secondary">Cancelar</button>
            <button (click)="onSave()" class="btn-primary-violet">Guardar</button>
          </ng-container>
        </app-modal>

        <app-confirm-dialog
          [open]="confirmOpen()"
          (openChange)="confirmOpen.set($event)"
          title="¿Eliminar publicador?"
          message="Esta acción no se puede deshacer."
          confirmLabel="Sí, eliminar"
          severity="danger"
          (confirmed)="onConfirm()"
        ></app-confirm-dialog>
      </section>

      <!-- Forms -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Formularios</h2>
        <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">Inputs con estados: default, focus, helper, error, disabled.</p>
        <div class="card-elevated p-6 grid md:grid-cols-2 gap-6">
          <div class="field-group">
            <label class="form-label" for="ds-name">Nombre completo</label>
            <input id="ds-name" class="form-control" placeholder="Carlos Pérez" />
            <p class="form-helper">Aparece en la lista de publicadores.</p>
          </div>

          <div class="field-group">
            <label class="form-label" for="ds-email">Email</label>
            <input id="ds-email" type="email" class="form-control is-invalid" value="email-invalido" />
            <p class="form-error">
              <lucide-icon name="alert-circle" [size]="12"></lucide-icon>
              Formato de email inválido
            </p>
          </div>

          <div class="field-group">
            <label class="form-label" for="ds-grupo">Grupo</label>
            <select id="ds-grupo" class="form-select">
              <option>Grupo #1 — María González</option>
              <option>Grupo #2 — Carlos Pérez</option>
              <option>Grupo #3 — Ana Rodríguez</option>
            </select>
          </div>

          <div class="field-group">
            <label class="form-label" for="ds-id">ID del publicador</label>
            <input id="ds-id" class="form-control" value="PUB-00421" disabled />
            <p class="form-helper">Asignado automáticamente al crear.</p>
          </div>
        </div>
      </section>

      <!-- Loading states -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Estados de carga</h2>
        <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">Spinner, skeleton con shimmer, botón en loading.</p>
        <div class="card-elevated p-6 grid md:grid-cols-3 gap-6">

          <!-- Spinners -->
          <div>
            <p class="eyebrow mb-3">Spinners</p>
            <div class="flex items-center gap-4">
              <span class="spinner-xs text-violet-600"></span>
              <span class="spinner-sm text-violet-600"></span>
              <span class="spinner text-violet-600"></span>
              <span class="spinner text-orange-500"></span>
            </div>
          </div>

          <!-- Skeleton -->
          <div>
            <p class="eyebrow mb-3">Skeleton</p>
            <div class="space-y-2">
              <div class="skeleton h-3 w-3/4"></div>
              <div class="skeleton h-3 w-full"></div>
              <div class="skeleton h-3 w-1/2"></div>
            </div>
          </div>

          <!-- Button loading -->
          <div>
            <p class="eyebrow mb-3">Button loading</p>
            <button
              (click)="simulateLoading()"
              [class.btn-loading]="loading()"
              class="btn-primary-violet focus-ring w-full justify-center"
            >Guardar cambios</button>
            <p class="text-xs text-gray-400 dark:text-slate-500 mt-2">Click para simular request (1.5s).</p>
          </div>
        </div>
      </section>

      <!-- Empty states -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Estados vacíos</h2>
        <div class="grid md:grid-cols-3 gap-4">
          <div class="card-elevated">
            <app-empty-state
              variant="empty"
              title="Sin publicadores"
              description="Aún no se han agregado publicadores."
              actionLabel="Agregar primero"
              (action)="toast.success('Demo', 'Acción primaria')"
            ></app-empty-state>
          </div>
          <div class="card-elevated">
            <app-empty-state
              variant="error"
              title="Algo salió mal"
              description="No se pudo cargar la información."
              actionLabel="Reintentar"
              secondaryLabel="Cancelar"
              (action)="toast.info('Demo', 'Reintentando...')"
            ></app-empty-state>
          </div>
          <div class="card-elevated">
            <app-empty-state
              variant="success"
              title="¡Todo en orden!"
              description="No hay tareas pendientes."
            ></app-empty-state>
          </div>
        </div>
      </section>

      <!-- Hero card -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Hero Card</h2>
        <div class="hero-card">
          <p class="text-violet-100 text-sm font-medium relative z-10">Buenos días</p>
          <h1 class="display-title text-white relative z-10">Hola, María 👋</h1>
          <p class="text-violet-100 text-sm mt-1 max-w-md relative z-10">Aquí tienes el resumen de actividad de hoy.</p>
        </div>
      </section>

      <!-- Command palette -->
      <section class="mb-12">
        <h2 class="display-section mb-1">Command Palette</h2>
        <div class="card-elevated p-6">
          <p class="text-sm text-gray-700 dark:text-slate-300">Presiona <kbd class="px-2 py-1 rounded-md bg-gray-100 dark:bg-slate-700 text-xs font-mono border border-gray-200 dark:border-slate-600 dark:text-slate-300">Ctrl</kbd> + <kbd class="px-2 py-1 rounded-md bg-gray-100 dark:bg-slate-700 text-xs font-mono border border-gray-200 dark:border-slate-600 dark:text-slate-300">K</kbd> para abrir.</p>
          <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">Búsqueda global de páginas y comandos.</p>
        </div>
      </section>

      <p class="text-xs text-gray-400 dark:text-slate-500 text-center mt-16">
        Sistema de Diseño GAC v2 · Actualizado {{ today }}
      </p>
    </div>
  `,
})
export class DesignSystemPage {
  toast = inject(ToastService);

  activeTab = signal('listado');
  tabs: TabItem[] = [
    { key: 'listado', label: 'Listado' },
    { key: 'grupos', label: 'Grupos' },
    { key: 'contactos', label: 'Contactos' },
  ];

  modalOpen = signal(false);
  confirmOpen = signal(false);
  loading = signal(false);

  simulateLoading() {
    this.loading.set(true);
    setTimeout(() => {
      this.loading.set(false);
      this.toast.success('Listo', 'Cambios guardados correctamente');
    }, 1500);
  }

  dropdownItems = [
    { key: 'edit', label: 'Editar' },
    { key: 'duplicate', label: 'Duplicar' },
    { key: 'divider', label: '', divider: true },
    { key: 'delete', label: 'Eliminar', danger: true },
  ];

  today = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

  onDropdown(key: string) { this.toast.info('Acción', `Seleccionaste: ${key}`); }
  onSave() { this.modalOpen.set(false); this.toast.success('Guardado', 'Los cambios fueron aplicados'); }
  onConfirm() { this.toast.success('Eliminado', 'El publicador fue eliminado'); }
}

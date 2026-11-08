import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  EmptyStateComponent,
  StatCardComponent,
  TabNavComponent,
  ToastService,
  ModalComponent,
  ModalVariant,
  ConfirmDialogComponent,
  ConfirmService,
  AvisoComponent,
  AvatarComponent,
  BreadcrumbsComponent,
  ProgressComponent,
  DropdownComponent,
  TooltipDirective,
  PageHeaderComponent,
  TabItem,
} from '../../shared/components';
import { SelectPickerComponent } from '../../shared/components/select-picker/select-picker.component';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '../../shared/components/time-picker/time-picker.component';

type Tema = 'violeta' | 'publicadores' | 'territorios' | 'exhibidores';

@Component({
  selector: 'app-design-system',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    EmptyStateComponent, StatCardComponent, TabNavComponent, ModalComponent, ConfirmDialogComponent,
    AvisoComponent, AvatarComponent, BreadcrumbsComponent, ProgressComponent, DropdownComponent,
    TooltipDirective, PageHeaderComponent, SelectPickerComponent, DatePickerComponent, TimePickerComponent,
  ],
  template: `
    <div class="max-w-6xl mx-auto py-2 pb-20" [ngClass]="temaClase()">

      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 text-xs font-semibold mb-3">
        <span class="w-1.5 h-1.5 rounded-full bg-violet-600"></span>
        INTERNO · SISTEMA DE DISEÑO v3
      </div>
      <h1 class="display-hero mb-2">Sistema de Diseño GAC</h1>
      <p class="text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed mb-6">
        Una receta por función. Antes de escribir un botón, un modal o un aviso a mano, búscalo aquí.
        Cada sección dice qué usar y qué no.
      </p>

      <!-- Índice + tema de módulo (sticky) -->
      <div class="md:sticky md:top-0 md:z-30 -mx-1 px-1 py-3 mb-8 md:bg-[var(--color-app-bg)]/95 md:dark:bg-slate-950/95 border-b border-slate-200 dark:border-slate-800">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <nav class="flex gap-1.5 max-w-full overflow-x-auto md:flex-wrap md:overflow-visible pb-1 md:pb-0" aria-label="Secciones">
            @for (s of secciones; track s.id) {
              <a [href]="'#' + s.id" (click)="ir($event, s.id)" class="chip-filtro shrink-0 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800">{{ s.titulo }}</a>
            }
          </nav>
          <div class="flex items-center gap-2 max-w-full overflow-x-auto">
            <span class="eyebrow">Tema</span>
            <div class="segmented" role="radiogroup" aria-label="Tema de módulo">
              @for (t of temas; track t.key) {
                <button type="button" role="radio" class="segmented-item" [attr.aria-checked]="tema() === t.key" (click)="tema.set(t.key)">{{ t.label }}</button>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- ═════════ FUNDAMENTOS ═════════ -->
      <section id="fundamentos" class="mb-14 scroll-mt-24">
        <h2 class="display-section mb-1">Fundamentos</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">
          El violeta de marca es el valor por defecto. Cada módulo se pone un <code class="data-num">.tema-*</code> en su
          contenedor raíz y todo lo interactivo (botón primario, pestaña activa, interruptor, foco) toma ese color solo.
          Cambia el tema arriba para verlo.
        </p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div class="card-padded"><div class="h-14 rounded-xl gradient-brand mb-3"></div><p class="eyebrow">Violeta · global</p><p class="data-num text-xs mt-0.5">brand-purple #6d28d9</p></div>
          <div class="card-padded"><div class="h-14 rounded-xl gradient-orange mb-3"></div><p class="eyebrow">Naranja principal · Publicadores</p><p class="data-num text-xs mt-0.5">brand-orange #f97316</p></div>
          <div class="card-padded"><div class="h-14 rounded-xl gradient-green mb-3"></div><p class="eyebrow">Territorios</p><p class="data-num text-xs mt-0.5">green-600 (bosque)</p></div>
          <div class="card-padded"><div class="h-14 rounded-xl gradient-blue mb-3"></div><p class="eyebrow">Exhibidores</p><p class="data-num text-xs mt-0.5">exh-600</p></div>
        </div>
        <div class="grid md:grid-cols-3 gap-4">
          <div class="card-padded">
            <p class="eyebrow mb-3">Radios</p>
            <div class="flex items-end gap-3">
              <div class="w-16 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl grid place-items-center text-xs">12</div>
              <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl grid place-items-center text-xs">16</div>
              <div class="px-3 h-7 bg-slate-100 dark:bg-slate-800 rounded-full grid place-items-center text-xs">pill</div>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-400 mt-3">Controles 12 px · tarjetas y modales 16 px · insignias pill.</p>
          </div>
          <div class="card-padded">
            <p class="eyebrow mb-3">Superficies</p>
            <div class="flex gap-2">
              <div class="flex-1 h-14 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid place-items-center text-xs">tarjeta</div>
              <div class="flex-1 h-14 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 grid place-items-center text-xs">interior</div>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-400 mt-3">Oscuro: slate-900 con borde slate-800.</p>
          </div>
          <div class="card-padded">
            <p class="eyebrow mb-3">Movimiento</p>
            <p class="text-sm text-slate-700 dark:text-slate-300">Presión <span class="data-num">scale(.97)</span> en 120 ms. Entradas de 200–280 ms con <span class="data-num">ease-out-strong</span>. Solo transform y opacidad.</p>
            <p class="text-xs text-slate-600 dark:text-slate-400 mt-3">Todo respeta «reducir movimiento».</p>
          </div>
        </div>
        <div class="card-padded mt-4 space-y-4">
          <p class="eyebrow">Escala tipográfica · una sola para todo el portal</p>
          <div><span class="eyebrow">.display-hero · 48 · solo portada y acceso</span><p class="display-hero">Hero</p></div>
          <div><span class="eyebrow">.page-title · 24 · h1 de cada pantalla</span><p class="page-title">Título de pantalla</p></div>
          <div><span class="eyebrow">.section-title · 18 · h2 de un bloque</span><p class="section-title">Título de sección</p></div>
          <div><span class="eyebrow">.card-title · 16 · h3 de tarjeta, panel o diálogo</span><p class="card-title">Título de tarjeta</p></div>
          <div><span class="eyebrow">.body-lg · 16 · texto destacado</span><p class="body-lg">Texto destacado o de lectura larga.</p></div>
          <div><span class="eyebrow">texto base · text-sm · 14</span><p class="text-sm text-slate-700 dark:text-slate-300">Todo el contenido de la interfaz: filas, campos, descripciones.</p></div>
          <div><span class="eyebrow">.caption · text-xs · 12 · mínimo absoluto</span><p class="caption">Fechas, ayudas, contadores e insignias.</p></div>
          <div><span class="eyebrow">.data-num · cifras tabulares</span><p class="data-num text-xl">1.247 · 14/03/2026 · #4521</p></div>
          <p class="uso"><b>Usar:</b> <code>.page-title</code> (vía <code>app-page-header</code>), <code>.section-title</code>, <code>.card-title</code>, <code>.caption</code>. Urbanist solo en títulos y cifras grandes; Manrope en todo lo demás. Pesos: título <code>bold</code>, énfasis <code>semibold</code>, texto <code>medium</code>.</p>
          <p class="uso"><b>No usar:</b> <code>text-[13px]</code>, <code>text-[15px]</code> ni otros tamaños sueltos; <code>font-black</code>; títulos de pantalla con tamaño propio; texto menor a 12 px.</p>
        </div>
      </section>

      <!-- ═════════ BOTONES ═════════ -->
      <section id="botones" class="mb-14 scroll-mt-24">
        <h2 class="display-section mb-1">Botones</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Un solo primario por pantalla. El color lo da el tema; los sufijos <code class="data-num">-orange / -green / -blue / -violet</code> solo fuerzan un color fuera de un módulo.</p>
        <div class="card-padded space-y-5">
          <div class="flex flex-wrap items-center gap-3">
            <button class="btn-primary">Guardar</button>
            <button class="btn-secondary">Secundario</button>
            <button class="btn-ghost">Fantasma</button>
            <button class="btn-danger">Eliminar</button>
            <button class="btn-ghost-danger">Quitar</button>
            <button class="btn-link">Ver detalle</button>
            <button class="btn-primary" disabled>Deshabilitado</button>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button class="btn-primary btn-sm">Pequeño · 32</button>
            <button class="btn-primary">Normal · 40</button>
            <button class="btn-primary btn-lg">Grande · 48</button>
            <button class="btn-primary" [class.btn-loading]="cargando()" (click)="simularCarga()">Guardar cambios</button>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button class="btn-icon" aria-label="Editar" [appTooltip]="'btn-icon · 40 (barras de herramientas)'"><lucide-icon name="square-pen"></lucide-icon></button>
            <button class="btn-icon-sm" aria-label="Editar" [appTooltip]="'btn-icon-sm · 36 (filas de listado)'"><lucide-icon name="square-pen"></lucide-icon></button>
            <button class="btn-icon-lg" aria-label="Editar" [appTooltip]="'btn-icon-lg · 44 (barras móviles)'"><lucide-icon name="square-pen"></lucide-icon></button>
            <button class="btn-icon-edit" aria-label="Editar"><lucide-icon name="square-pen"></lucide-icon></button>
            <button class="btn-icon-delete" aria-label="Eliminar"><lucide-icon name="trash-2" [size]="16"></lucide-icon></button>
          </div>
        </div>
        <p class="uso mt-3"><b>Usar:</b> <code>.btn-primary</code> + tema. <b>No usar:</b> <code>bg-orange-500 rounded-xl px-4 py-2…</code> a mano, ni clases locales como <code>.btn-sec</code>. Un botón de icono siempre lleva <code>aria-label</code>.</p>
        <div class="card-padded mt-4">
          <h3 class="card-title mb-3">Acciones de fila</h3>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">María Pérez</span>
            <div class="row-actions">
              <button class="btn-icon-sm tone-success" aria-label="Enviar correo"><lucide-icon name="mail"></lucide-icon></button>
              <button class="btn-icon-sm tone-success" aria-label="Escribir por WhatsApp"><lucide-icon name="message-circle"></lucide-icon></button>
              <button class="btn-icon-sm tone-warning" aria-label="Permisos"><lucide-icon name="lock"></lucide-icon></button>
              <button class="btn-icon-sm tone-danger" aria-label="Eliminar"><lucide-icon name="trash-2"></lucide-icon></button>
              <button class="btn-tonal">Editar</button>
            </div>
          </div>
          <p class="uso mt-3"><b>Usar:</b> <code>.row-actions</code> + <code>.btn-icon-sm</code> (con <code>tone-success</code>, <code>tone-warning</code> o <code>tone-danger</code>) + <code>.btn-tonal</code> para la acción principal con texto. <b>No usar:</b> botones <code>w-8 h-8</code> hechos a mano ni clases locales como <code>.icon-btn</code>.</p>
        </div>
      </section>

      <!-- ═════════ FORMULARIOS ═════════ -->
      <section id="formularios" class="mb-14 scroll-mt-24">
        <h2 class="display-section mb-1">Formularios</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Campos de 44 px, foco con el acento del módulo.</p>
        <div class="card-padded grid md:grid-cols-2 gap-6">
          <div class="field-group">
            <label class="form-label" for="ds-name">Nombre completo</label>
            <input id="ds-name" class="form-control" placeholder="Carlos Pérez" />
            <p class="form-helper">Aparece en la lista de publicadores.</p>
          </div>
          <div class="field-group">
            <label class="form-label" for="ds-email">Correo</label>
            <input id="ds-email" type="email" class="form-control is-invalid" value="correo-invalido" />
            <p class="form-error"><lucide-icon name="alert-circle" [size]="12"></lucide-icon> Escribe un correo válido, por ejemplo nombre&#64;correo.com</p>
          </div>
          <div class="field-group">
            <label class="form-label" for="ds-grupo">Grupo (select nativo)</label>
            <select id="ds-grupo" class="form-select"><option>Grupo 1</option><option>Grupo 2</option></select>
          </div>
          <div class="field-group">
            <label class="form-label" for="ds-id">Código</label>
            <input id="ds-id" class="form-control" value="PUB-00421" disabled />
          </div>
          <div class="field-group md:col-span-2">
            <label class="form-label" for="ds-nota">Nota</label>
            <textarea id="ds-nota" class="form-control" rows="2" placeholder="Escribe aquí"></textarea>
          </div>
          <div class="field-group md:col-span-2">
            <span class="form-label">Buscador</span>
            <label class="search-field">
              <lucide-icon name="search" [size]="16"></lucide-icon>
              <input class="search-input" placeholder="Buscar publicador" aria-label="Buscar publicador" />
            </label>
          </div>
          <div class="flex items-center gap-3">
            <button type="button" class="switch" role="switch" [attr.aria-checked]="interruptor()" aria-label="Recordatorios" (click)="interruptor.set(!interruptor())"><span class="toggle-thumb"></span></button>
            <span class="text-sm text-slate-700 dark:text-slate-300">Recordatorios {{ interruptor() ? 'activados' : 'desactivados' }}</span>
          </div>
          <label class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" class="w-4 h-4" checked /> Casilla con el color del módulo
          </label>
        </div>
        <div class="card-padded mt-4">
          <p class="eyebrow mb-3">Selectores propios (usar en lugar de los nativos cuando hay búsqueda o fechas)</p>
          <div class="grid md:grid-cols-3 gap-4">
            <app-select-picker [options]="['Grupo 1', 'Grupo 2', 'Grupo 3']" [(ngModel)]="selGrupo" placeholder="Grupo" ariaLabel="Grupo" />
            <app-date-picker [(ngModel)]="selFecha" />
            <app-time-picker [(ngModel)]="selHora" />
          </div>
        </div>
        <p class="uso mt-3"><b>Usar:</b> <code>.form-control</code>, <code>.form-select</code>, <code>.search-field</code>, <code>.switch</code>. <b>No usar:</b> inputs con <code>ring-brand-orange</code> ni interruptores hechos con <code>peer-checked</code>.</p>
      </section>

      <!-- ═════════ INSIGNIAS, SEGMENTADO, PESTAÑAS ═════════ -->
      <section id="navegacion" class="mb-14 scroll-mt-24">
        <h2 class="display-section mb-1">Insignias · Segmentado · Pestañas</h2>
        <div class="card-padded space-y-6">
          <div class="flex flex-wrap gap-2">
            <span class="badge-role">Precursor regular</span>
            <span class="badge-active">Activo</span>
            <span class="badge-inactive">Inactivo</span>
            <span class="badge-warning">Pendiente</span>
            <span class="badge-info">Confirmado</span>
            <span class="badge-neutral">Sin asignar</span>
            <span class="badge-live">En vivo</span>
          </div>
          <div>
            <p class="eyebrow mb-2">Segmentado · el mismo diseño, compacto, para cambiar de vista dentro de una barra de herramientas</p>
            <div class="segmented" role="tablist" aria-label="Vista">
              @for (v of vistas; track v) {
                <button type="button" role="tab" class="segmented-item" [attr.aria-selected]="vista() === v" (click)="vista.set(v)">{{ v }}</button>
              }
            </div>
          </div>
          <div>
            <p class="eyebrow mb-2">Pestañas · navegan entre secciones de la página</p>
            <app-tab-nav [tabs]="tabs" [activeTab]="activeTab()" (tabChange)="activeTab.set($event)"></app-tab-nav>
          </div>
          <div>
            <p class="eyebrow mb-2">Pestañas compactas · una por color de módulo (<code class="data-num">.tab-nav.tab-compact</code>)</p>
            <div class="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              @for (m of pestanasModulo; track m.tema) {
                <div [class]="m.tema">
                  <p class="caption mb-1.5">{{ m.nombre }} · <span class="data-num">{{ m.token }}</span></p>
                  <div class="tab-nav tab-compact" role="tablist" [attr.aria-label]="m.nombre">
                    @for (t of ['Listado','Grupos','Contactos','Acceso app']; track t; let i = $index) {
                      <button type="button" role="tab" class="tab-item" [attr.aria-selected]="tabModulo() === i" (click)="tabModulo.set(i)">{{ t }}</button>
                    }
                  </div>
                </div>
              }
            </div>
            <p class="uso mt-3">Barras de módulo con 4 o más pestañas: pista <code>p-1.5</code>, pestañas de 36 px, texto de 12 px en negrita. El color lo da el tema del módulo (<code>.tema-*</code> en el contenedor raíz); nunca se escribe a mano.</p>
          </div>
          <div>
            <p class="eyebrow mb-2">Filtros rápidos</p>
            <div class="flex flex-wrap gap-2">
              @for (f of filtros; track f) {
                <button type="button" class="chip-filtro" [class]="filtro() === f ? 'border-transparent text-white' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'" [style.background-color]="filtro() === f ? 'var(--accent)' : null" (click)="filtro.set(f)">{{ f }}</button>
              }
            </div>
          </div>
        </div>
        <p class="uso mt-3"><b>Un solo diseño de pestañas:</b> canal hundido (borde y sombra interior) con la pestaña activa rellena con el color del módulo y su resplandor; las pestañas viven dentro del canal, no flotan. El relleno se desliza solo de una pestaña a otra (<code>shared/utils/tab-indicator.ts</code>): no hay que hacer nada, basta marcar la activa. Para barras con 4 o más pestañas, añade <code>tab-compact</code> a <code>.tab-nav</code> (pestañas de 36 px, texto de 12 px). <b>Usar:</b> <code>.tab-nav</code> + <code>.tab-item</code> (o <code>&lt;app-tab-nav&gt;</code>) para secciones y <code>.segmented</code> + <code>.segmented-item</code> para vistas; la activa lleva <code>aria-selected="true"</code> y el número va en <code>.tab-count</code>. <b>No usar:</b> pills sueltas <code>bg-brand-purple shadow-md</code>, pestañas subrayadas ni clases locales como <code>.seg-btn</code>.</p>
      </section>

      <!-- ═════════ TARJETAS, KPI, TABLA ═════════ -->
      <section id="superficies" class="mb-14 scroll-mt-24">
        <h2 class="display-section mb-1">Tarjetas · KPI · Tabla</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <app-stat-card variant="minimal" label="Publicadores" value="215"></app-stat-card>
          <app-stat-card variant="minimal" label="Grupos" value="12" sub="2 sin encargado"></app-stat-card>
          <app-stat-card variant="standard" color="green" label="Territorios" value="42"></app-stat-card>
          <app-stat-card variant="standard" color="blue" label="Exhibidores" value="8"></app-stat-card>
        </div>
        <div class="grid md:grid-cols-3 gap-4 mb-4">
          <div class="card-padded"><p class="eyebrow mb-1">.card-padded</p><p class="text-sm text-slate-700 dark:text-slate-300">Superficie estándar.</p></div>
          <button type="button" class="card-interactive p-6 text-left"><p class="eyebrow mb-1">.card-interactive</p><p class="text-sm text-slate-700 dark:text-slate-300">Se pulsa: cambia borde y sombra.</p></button>
          <div class="card-selected p-6"><p class="eyebrow mb-1">.card-selected</p><p class="text-sm text-slate-700 dark:text-slate-300">Elegida, con el acento del módulo.</p></div>
        </div>
        <div class="table-wrapper">
          <table class="w-full">
            <thead><tr><th class="table-header-cell">Publicador</th><th class="table-header-cell">Grupo</th><th class="table-header-cell">Estado</th><th class="table-header-cell text-right">Acciones</th></tr></thead>
            <tbody>
              @for (r of filas; track r.n) {
                <tr class="table-row">
                  <td class="table-cell"><div class="flex items-center gap-3"><app-avatar [name]="r.n" size="sm"></app-avatar><span class="font-medium">{{ r.n }}</span></div></td>
                  <td class="table-cell">{{ r.g }}</td>
                  <td class="table-cell"><span [class]="r.a ? 'badge-active' : 'badge-neutral'">{{ r.a ? 'Activo' : 'Inactivo' }}</span></td>
                  <td class="table-cell"><div class="row-actions"><button class="btn-icon-sm" aria-label="Editar" title="Editar"><lucide-icon name="square-pen"></lucide-icon></button><button class="btn-icon-sm tone-danger" aria-label="Eliminar" title="Eliminar"><lucide-icon name="trash-2"></lucide-icon></button></div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="uso mt-3"><b>Usar:</b> <code>.card-*</code> y <code>.table-*</code>. <b>No usar:</b> <code>bg-white dark:bg-slate-800 rounded-2xl shadow-sm</code> a mano, ni desenfoque (<code>backdrop-blur</code>) en tarjetas.</p>
      </section>

      <!-- ═════════ SUPERPUESTOS Y AVISOS ═════════ -->
      <section id="superpuestos" class="mb-14 scroll-mt-24">
        <h2 class="display-section mb-1">Modales · Confirmaciones · Toasts · Avisos</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Un solo velo, una sola escala de capas, foco atrapado y devuelto al cerrar. Esc y clic fuera cierran.</p>
        <div class="card-padded space-y-5">
          <div class="flex flex-wrap gap-3">
            <button class="btn-primary" (click)="abrirModal('dialog')">Modal centrado</button>
            <button class="btn-secondary" (click)="abrirModal('sheet')">Hoja inferior</button>
            <button class="btn-secondary" (click)="abrirModal('drawer')">Cajón lateral</button>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="btn-danger" (click)="confirmOpen.set(true)">Confirmar con spinner</button>
            <button class="btn-secondary" (click)="preguntar()">confirm.ask()</button>
            <button class="btn-secondary" (click)="avisar()">confirm.notify()</button>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="btn-secondary" (click)="toast.success('Publicador creado', 'Se agregó correctamente')">Toast éxito</button>
            <button class="btn-secondary" (click)="toast.error('No se pudo guardar', 'Revisa tu conexión')">Toast error</button>
            <button class="btn-secondary" (click)="toast.warning('Atención', 'Hay cambios sin guardar')">Toast aviso</button>
            <button class="btn-secondary" (click)="toast.info('Sugerencia', 'Usa Ctrl+K para buscar')">Toast info</button>
          </div>
          <div class="grid md:grid-cols-2 gap-3">
            <app-aviso tone="info" title="Recuerda">El informe se entrega a más tardar el día 7.</app-aviso>
            <app-aviso tone="success">Los cambios se guardaron.</app-aviso>
            <app-aviso tone="warning" title="Faltan informes">Hay 3 publicadores sin entregar.</app-aviso>
            <app-aviso tone="danger" [dismissible]="true">No se pudo conectar con el servidor.</app-aviso>
            <app-aviso tone="warning" [dense]="true">Versión compacta, para filas y paneles angostos.</app-aviso>
          </div>
        </div>
        <p class="uso mt-3"><b>Usar:</b> <code>&lt;app-modal variant&gt;</code>, <code>await confirm.ask()</code> en lugar de <code>confirm()</code>, <code>toast</code> para resultados y <code>&lt;app-aviso&gt;</code> para mensajes dentro de la pantalla. <b>No usar:</b> <code>fixed inset-0</code> a mano, <code>confirm()</code> / <code>alert()</code> nativos, ni un sistema de toast propio.</p>

        <app-modal [open]="modalOpen()" (openChange)="modalOpen.set($event)" [variant]="modalVariante()" [title]="'Editar publicador'" subtitle="Actualiza la información personal" [hasFooter]="true" size="md">
          <div class="space-y-4">
            <div><label class="form-label" for="m-n">Nombre completo</label><input id="m-n" class="form-control" placeholder="Carlos Pérez" /></div>
            <div><label class="form-label" for="m-g">Grupo</label><select id="m-g" class="form-select"><option>Grupo 1</option><option>Grupo 2</option></select></div>
            <app-aviso tone="info" [dense]="true">Prueba Tab: el foco se queda dentro. Al cerrar, vuelve al botón.</app-aviso>
          </div>
          <ng-container slot="footer">
            <button class="btn-secondary" (click)="modalOpen.set(false)">Cancelar</button>
            <button class="btn-primary" (click)="guardarModal()">Guardar</button>
          </ng-container>
        </app-modal>

        <app-confirm-dialog
          [open]="confirmOpen()" (openChange)="confirmOpen.set($event)"
          title="¿Eliminar publicador?" message="Esta acción no se puede deshacer."
          confirmLabel="Sí, eliminar" severity="danger" [busy]="borrando()"
          (confirmed)="borrar()"
        ></app-confirm-dialog>
      </section>

      <!-- ═════════ CARGA Y VACÍOS ═════════ -->
      <section id="estados" class="mb-14 scroll-mt-24">
        <h2 class="display-section mb-1">Carga y estados vacíos</h2>
        <div class="card-padded grid md:grid-cols-3 gap-6 mb-4">
          <div><p class="eyebrow mb-3">Spinner</p><div class="flex items-center gap-4 text-slate-500"><span class="spinner-xs"></span><span class="spinner-sm"></span><span class="spinner"></span><span class="spinner" style="color: var(--accent)"></span></div></div>
          <div><p class="eyebrow mb-3">Esqueleto</p><div class="space-y-2"><div class="skeleton h-3 w-3/4"></div><div class="skeleton h-3 w-full"></div><div class="skeleton h-3 w-1/2"></div></div></div>
          <div><p class="eyebrow mb-3">Progreso</p><app-progress variant="linear" [value]="72" label="Avance del mes"></app-progress></div>
        </div>
        <div class="grid md:grid-cols-3 gap-4 mb-4">
          <div class="card"><app-empty-state variant="empty" title="Sin publicadores" description="Aún no se han agregado publicadores." actionLabel="Agregar primero"></app-empty-state></div>
          <div class="card"><app-empty-state variant="error" title="Algo salió mal" description="No se pudo cargar la información." actionLabel="Reintentar"></app-empty-state></div>
          <div class="card"><app-empty-state variant="success" title="¡Todo en orden!" description="No hay tareas pendientes."></app-empty-state></div>
        </div>
        <div class="card"><app-empty-state [compact]="true" title="Sin resultados" description="prueba con otro nombre" actionLabel="Limpiar búsqueda"></app-empty-state></div>
        <p class="uso mt-3"><b>Usar:</b> <code>.spinner</code>, <code>.skeleton</code>, <code>&lt;app-empty-state&gt;</code> (<code>compact</code> dentro de listas). <b>No usar:</b> <code>animate-spin</code> con SVG propio, <code>animate-pulse</code> en bloques grises ni textos sueltos tipo «No hay datos».</p>
      </section>

      <!-- ═════════ ESTRUCTURA ═════════ -->
      <section id="estructura" class="mb-14 scroll-mt-24">
        <h2 class="display-section mb-1">Cabecera · Migas · Avatar · Menús</h2>
        <div class="card-padded space-y-6">
          <app-page-header title="Publicadores" subtitle="Gestiona a las personas de la congregación." spacing="none">
            <button class="btn-secondary">Importar</button>
            <button class="btn-primary">Nuevo publicador</button>
          </app-page-header>
          <app-breadcrumbs [items]="[{ label: 'Inicio', link: '/' }, { label: 'Secretario', link: '/secretario/publicadores' }, { label: 'Detalle publicador' }]"></app-breadcrumbs>
          <div class="flex items-center gap-4 flex-wrap">
            <app-avatar name="María González" size="xs"></app-avatar>
            <app-avatar name="Carlos Pérez" size="sm"></app-avatar>
            <app-avatar name="Ana Rodríguez" size="md"></app-avatar>
            <app-avatar name="Juan Martínez" size="lg"></app-avatar>
            <app-dropdown [items]="menu" (itemClick)="toast.info('Acción', 'Elegiste: ' + $event)">
              <button slot="trigger" class="btn-secondary">Acciones <lucide-icon name="chevron-down" [size]="16"></lucide-icon></button>
            </app-dropdown>
            <button class="btn-secondary" [appTooltip]="'Pasa el mouse para ver el tooltip'">Tooltip</button>
          </div>
        </div>
        <p class="uso mt-3"><b>Usar:</b> <code>&lt;app-page-header&gt;</code> como primer elemento de cada pantalla. <b>No usar:</b> un <code>h1</code> con tamaño propio ni bandas de degradado copiadas.</p>
      </section>

      <p class="text-xs text-slate-500 text-center mt-16">Sistema de Diseño GAC v3 · {{ today }}</p>
    </div>
  `,
  styles: [`
    .uso { font-size: 0.8125rem; line-height: 1.5; color: var(--color-slate-600); }
    .uso code { font-family: var(--font-mono); font-size: 0.75rem; background: var(--color-slate-100); padding: 1px 5px; border-radius: 6px; color: var(--color-slate-800); }
    :host-context(.dark) .uso { color: var(--color-slate-400); }
    :host-context(.dark) .uso code { background: var(--color-slate-800); color: var(--color-slate-200); }
  `],
})
export class DesignSystemPage {
  toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  secciones = [
    { id: 'fundamentos', titulo: 'Fundamentos' }, { id: 'botones', titulo: 'Botones' }, { id: 'formularios', titulo: 'Formularios' },
    { id: 'navegacion', titulo: 'Insignias y pestañas' }, { id: 'superficies', titulo: 'Tarjetas y tabla' },
    { id: 'superpuestos', titulo: 'Modales y avisos' }, { id: 'estados', titulo: 'Carga y vacíos' }, { id: 'estructura', titulo: 'Estructura' },
  ];
  temas: { key: Tema; label: string }[] = [
    { key: 'violeta', label: 'Violeta' }, { key: 'publicadores', label: 'Publicadores' },
    { key: 'territorios', label: 'Territorios' }, { key: 'exhibidores', label: 'Exhibidores' },
  ];
  tema = signal<Tema>('violeta');
  temaClase() { return this.tema() === 'violeta' ? '' : 'tema-' + this.tema(); }

  activeTab = signal('listado');
  tabModulo = signal(0);
  pestanasModulo = [
    { tema: 'tema-reuniones', nombre: 'Violeta · app, Informes, Reuniones, Herramientas', token: 'brand-purple #6d28d9' },
    { tema: 'tema-publicadores', nombre: 'Naranja · Publicadores', token: 'brand-orange #f97316' },
    { tema: 'tema-territorios', nombre: 'Verde · Territorios', token: 'green-600' },
    { tema: 'tema-exhibidores', nombre: 'Azul · Exhibidores', token: 'exh-600' },
    { tema: 'tema-agenda', nombre: 'Rosa · Mi Agenda', token: '#e11d48' },
  ];
  tabs: TabItem[] = [{ key: 'listado', label: 'Listado' }, { key: 'grupos', label: 'Grupos' }, { key: 'contactos', label: 'Contactos' }];
  vistas = ['Mes', 'Semana', 'Día'];
  vista = signal('Mes');
  filtros = ['Todos', 'Hoy', 'Esta semana'];
  filtro = signal('Todos');
  interruptor = signal(true);
  selGrupo = ''; selFecha = ''; selHora = '';
  filas = [{ n: 'María González', g: 'Grupo 1', a: true }, { n: 'Carlos Pérez', g: 'Grupo 2', a: true }, { n: 'Ana Rodríguez', g: 'Grupo 3', a: false }];

  modalOpen = signal(false);
  modalVariante = signal<ModalVariant>('dialog');
  confirmOpen = signal(false);
  borrando = signal(false);
  cargando = signal(false);

  menu = [
    { key: 'edit', label: 'Editar' }, { key: 'duplicate', label: 'Duplicar' },
    { key: 'divider', label: '', divider: true }, { key: 'delete', label: 'Eliminar', danger: true },
  ];
  today = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

  ir(e: Event, id: string) { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  abrirModal(v: ModalVariant) { this.modalVariante.set(v); this.modalOpen.set(true); }
  guardarModal() { this.modalOpen.set(false); this.toast.success('Guardado', 'Los cambios fueron aplicados'); }
  simularCarga() { this.cargando.set(true); setTimeout(() => this.cargando.set(false), 1500); }
  borrar() { this.borrando.set(true); setTimeout(() => { this.borrando.set(false); this.confirmOpen.set(false); this.toast.success('Eliminado', 'El publicador fue eliminado'); }, 1200); }
  async preguntar() {
    const ok = await this.confirm.ask({ title: '¿Descartar los cambios?', message: 'Tienes cambios sin guardar.', confirmLabel: 'Descartar', severity: 'warning' });
    this.toast.info('confirm.ask()', ok ? 'Respondió que sí' : 'Respondió que no');
  }
  async avisar() {
    await this.confirm.notify({ title: 'No se pudo guardar', message: 'Revisa tu conexión e inténtalo de nuevo.' });
    this.toast.info('confirm.notify()', 'Se cerró el aviso');
  }
}

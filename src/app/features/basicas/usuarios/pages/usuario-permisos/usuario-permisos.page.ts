import { Component, inject, signal, computed, OnInit, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';

import { PermisosService, PermisoConEstado } from '../../services/permisos.service';
import { UsuariosService } from '../../services/usuarios.service';
import { Usuario } from '../../models/usuario.model';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { etiquetaRol } from '../../../../../core/auth/rol-label';

// Permisos que Coordinador/Secretario no pueden otorgar (mismo criterio que
// permiso_router.py: los 'admin.*' tienen alcance sobre todas las congregaciones)
const PERMISOS_RESTRINGIDOS_CONG = new Set(['publicadores.editar']);
const PREFIJOS_RESTRINGIDOS_CONG = ['admin.'];

type Tema = 'amber' | 'purple' | 'emerald' | 'blue' | 'slate';

/**
 * El color del módulo solo tiñe su icono: sirve para orientarse (es el mismo
 * color que el módulo tiene en el menú). Los controles van todos en el violeta
 * de marca, así "encendido" se lee igual en toda la pantalla.
 */
const TEMAS_POR_CATEGORIA: Record<string, Tema> = {
   'Publicadores': 'amber',
   'Grupos': 'amber',
   'Informes': 'purple',
   'Territorios': 'emerald',
   'Reuniones': 'purple',
   'Exhibidores': 'blue',
   'Reportes': 'blue',
   'Tareas': 'emerald'
};

// Orden de las secciones: primero lo que más se reparte.
const ORDEN_CATEGORIAS = [
   'Publicadores',
   'Informes',
   'Reuniones',
   'Territorios',
   'Exhibidores',
   'Reportes',
   'Tareas',
   'Configuración',
   'Administración'
];

/** Nivel de acceso de una pantalla con Ver y Editar. */
export type Nivel = 'ninguno' | 'ver' | 'editar';

/**
 * Una pestaña del módulo con sus permisos ya emparejados.
 *
 * 'alcance' no es una capacidad sino el radio de acción de la pantalla: cuando
 * está otorgado el usuario ve toda la congregación, y cuando no, solo su propio
 * grupo de predicación. Por eso se dibuja como selector y no como interruptor.
 */
/**
 * Alcances que no son «de quién ve los datos»: el de Predicación dice en qué
 * salidas registra, y solo existe con «Ver y editar» (registrar).
 */
const ALCANCES_DE_EDICION: Record<string, { etiqueta: string; propio: string; todos: string }> = {
   'territorios.predicacion_todos': { etiqueta: 'Registra en:', propio: 'Solo sus salidas', todos: 'Todas las salidas' },
};
const ALCANCE_DE_DATOS = { etiqueta: 'Ve los datos de:', propio: 'Solo su grupo', todos: 'Toda la congregación' };

interface PantallaPermisos {
   nombre: string;
   ver?: PermisoConEstado;
   editar?: PermisoConEstado;
   alcance?: PermisoConEstado;
}

interface CategoriaPermisos {
   categoria: string;
   /** id estable para el ancla del índice. */
   ancla: string;
   icono: SafeHtml;
   tema: Tema;
   /** Bloques por pestaña (Publicadores, Informes). */
   pantallas: PantallaPermisos[];
   /** Permisos que no pertenecen a ninguna pantalla: interruptores sueltos. */
   sueltos: PermisoConEstado[];
   /** Todos los permisos que cuentan para el contador (excluye alcances). */
   contables: PermisoConEstado[];
}

@Component({
   selector: 'app-usuario-permisos',
   standalone: true,
   imports: [CommonModule, RouterLink, ModalComponent],
   animations: [
      trigger('fadeIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(6px)' }),
            animate('220ms cubic-bezier(0.23, 1, 0.32, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
         ])
      ]),
      // Barra de guardado y avisos: entran desde abajo y salen más rápido de lo
      // que entran, para que el guardado se sienta inmediato.
      trigger('slideUp', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(16px)' }),
            animate('240ms cubic-bezier(0.23, 1, 0.32, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
         ]),
         transition(':leave', [
            animate('160ms ease-in', style({ opacity: 0, transform: 'translateY(12px)' }))
         ])
      ]),
      // La línea de alcance aparece al dar acceso a la pantalla. Solo transform y
      // opacity para que el navegador no tenga que recalcular el layout.
      trigger('revealScope', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(-4px)' }),
            animate('180ms cubic-bezier(0.23, 1, 0.32, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
         ])
      ])
   ],
   templateUrl: './usuario-permisos.page.html',
   styles: [`
      :host { display: block; height: 100%; overflow: hidden;
         --u-marca: var(--color-brand-purple); --u-marca-hover: color-mix(in oklab, var(--color-brand-purple) 85%, black); --u-marca-suave: #f5f3ff; --u-marca-suave-hover: #ede9fe;
         --u-marca-texto: var(--color-brand-purple); --u-control: #4b5563; --u-panel: #fff; --u-linea: rgb(17 24 39 / 0.06);
         --u-texto: #111827; --u-texto-2: #374151; --u-apagado: #d1d5db; }
      :host-context(.dark) { --u-marca-suave: rgb(139 92 246 / 0.14); --u-marca-suave-hover: rgb(139 92 246 / 0.24);
         --u-marca-texto: #c4b5fd; --u-control: #cbd5e1; --u-panel: rgb(15 23 42 / 0.72); --u-linea: rgb(148 163 184 / 0.1);
         --u-texto: #f1f5f9; --u-texto-2: #e2e8f0; --u-apagado: #475569; }

      .simple-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
      .simple-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .simple-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      :host-context(.dark) .simple-scrollbar::-webkit-scrollbar-thumb { background: #334155; }

      /* ── Cabecera ─────────────────────────────────────────────────────── */
      .volver { display: inline-flex; align-items: center; gap: 0.375rem; height: 2rem; padding-right: 0.5rem;
         font-size: 0.875rem; font-weight: 600; color: var(--dash-texto-suave); border-radius: 0.375rem;
         transition: color 150ms ease; }
      .volver svg { width: 1rem; height: 1rem; transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1); }
      .volver:hover { color: var(--u-marca-texto); }
      .volver:hover svg { transform: translateX(-2px); }
      .avatar { width: 3rem; height: 3rem; flex-shrink: 0; display: grid; place-items: center; border-radius: 0.875rem;
         background: var(--u-marca); color: #fff; font-weight: 800; font-size: 1rem; letter-spacing: 0.02em; }
      .badge-rol { display: inline-flex; align-items: center; padding: 0.125rem 0.625rem; border-radius: 999px;
         font-size: 0.75rem; font-weight: 700; background: var(--estado-info-bg); color: var(--estado-info-fg); }

      /* Buscador: mismo aspecto que el de Gestión de Usuarios */
      /* Sobre el fondo gris de la página el buscador va en blanco con borde
         fino, como los paneles; el de Usuarios vive dentro de un panel. */
      .buscador { position: relative; height: 2.75rem; border-radius: 0.625rem; background: var(--u-panel);
         border: 1px solid rgb(17 24 39 / 0.1); transition: border-color 150ms ease, background-color 150ms ease; }
      .buscador:focus-within { background: white; border-color: var(--u-marca); }
      :host-context(.dark) .buscador { border-color: rgb(148 163 184 / 0.14); }
      :host-context(.dark) .buscador:focus-within { background: rgb(15 23 42); }
      .buscador-ic { position: absolute; inset: 0 auto 0 0; width: 2.75rem; display: grid; place-items: center; color: var(--u-control); pointer-events: none; }
      .buscador:focus-within .buscador-ic { color: var(--u-marca-texto); }
      .buscador input { width: 100%; height: 100%; padding: 0 2.75rem; background: transparent; border: 0; outline: 0;
         font-size: 1rem; font-weight: 500; color: var(--u-texto); }
      .buscador input::placeholder { color: var(--u-control); opacity: 1; }
      .buscador-x { position: absolute; inset: 0 0 0 auto; width: 2.75rem; display: grid; place-items: center; color: var(--u-control); }
      .buscador-x:hover { color: #dc2626; }

      /* ── Paneles con el lenguaje del dashboard ─────────────────────────── */
      .panel { background: var(--u-panel); border: 1px solid rgb(17 24 39 / 0.07); border-radius: 0.75rem; }
      :host-context(.dark) .panel { border-color: rgb(148 163 184 / 0.14); }

      /* Índice lateral */
      .indice-t { font-size: 0.75rem; font-weight: 600; color: var(--dash-texto-suave); }
      .barra { height: 0.375rem; border-radius: 999px; background: var(--dash-tesela); overflow: hidden; }
      .barra > i { display: block; height: 100%; border-radius: inherit; background: var(--u-marca);
         transform-origin: left; transition: transform 400ms cubic-bezier(0.23, 1, 0.32, 1); }
      .ind-btn { width: 100%; display: flex; align-items: center; gap: 0.625rem; height: 2.5rem; padding: 0 0.625rem;
         border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; color: var(--u-texto-2); text-align: left;
         transition: background-color 150ms ease, color 150ms ease; }
      .ind-btn:hover { background: var(--dash-hover); }
      .ind-btn.on { background: var(--z-suave-h); color: var(--z-fg); }
      .ind-btn .n { margin-left: auto; font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--dash-texto-suave); }
      .ind-btn .n.tiene { color: var(--z-fg); }
      .ind-btn .ic { width: 1.75rem; height: 1.75rem; padding: 0.375rem; border-radius: 0.5rem; flex-shrink: 0; }
      .link-quitar { font-size: 0.8125rem; font-weight: 600; color: var(--dash-texto-suave); padding: 0.375rem 0.25rem; border-radius: 0.375rem; }
      .link-quitar:hover { color: #dc2626; text-decoration: underline; text-underline-offset: 3px; }

      /* Tira de módulos en pantallas estrechas */
      .chips { display: flex; gap: 0.375rem; overflow-x: auto; scrollbar-width: none; padding: 0.5rem 0.625rem;
         margin-bottom: 0.75rem; border-radius: 0.75rem; background: var(--u-panel); border: 1px solid rgb(17 24 39 / 0.07); }
      :host-context(.dark) .chips { border-color: rgb(148 163 184 / 0.14); }
      .chips::-webkit-scrollbar { display: none; }
      /* Con el índice lateral a la vista la tira sobra. Va aquí y no como
         'lg:hidden' porque el display de .chips le ganaría a la utilidad. */
      @media (min-width: 1280px) { .chips { display: none; } }
      .chip { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.375rem; height: 2.25rem; padding: 0 0.75rem;
         border-radius: 999px; font-size: 0.8125rem; font-weight: 600; background: var(--dash-tesela); color: var(--u-texto-2);
         transition: background-color 150ms ease, color 150ms ease; }
      .chip.on { background: var(--z-main); color: #fff; }
      .chip b { font-variant-numeric: tabular-nums; font-weight: 700; opacity: 0.75; }
      @media (pointer: coarse) { .chip { height: 2.75rem; } }

      /* Iconos de módulo teñidos */
      .tono-amber   { background: #fef3c7; color: #b45309; }
      .tono-purple  { background: #ede9fe; color: var(--color-brand-purple); }
      .tono-emerald { background: #d1fae5; color: #047857; }
      .tono-blue    { background: #dbeafe; color: #1d4ed8; }
      .tono-slate   { background: #f1f5f9; color: #475569; }
      :host-context(.dark) .tono-amber   { background: rgb(245 158 11 / 0.16); color: #fcd34d; }
      :host-context(.dark) .tono-purple  { background: rgb(139 92 246 / 0.2); color: #c4b5fd; }
      :host-context(.dark) .tono-emerald { background: rgb(16 185 129 / 0.16); color: #6ee7b7; }
      :host-context(.dark) .tono-blue    { background: rgb(59 130 246 / 0.18); color: #93c5fd; }
      :host-context(.dark) .tono-slate   { background: rgb(71 85 105 / 0.4); color: #cbd5e1; }

      /* ── Secciones ─────────────────────────────────────────────────────── */
      /* Cada módulo es su propia tarjeta, separada de la anterior, con una
         cabecera del color del módulo: así se sabe dónde empieza y acaba. */
      .seccion { overflow: hidden; margin-bottom: 1rem; scroll-margin-top: 0.5rem; border-color: rgb(17 24 39 / 0.12); }
      :host-context(.dark) .seccion { border-color: rgb(148 163 184 / 0.22); }
      /* Cada módulo trae su paleta: --z-main para los controles encendidos,
         --z-bg/--z-fg para la cabecera y --z-suave para las filas con acceso.
         Los principales llevan texto blanco, por eso son los tonos 700. */
      .zona-amber   { --z-main: #b45309; --z-main-h: #92400e; --z-bg: #fde68a; --z-fg: #78350f; --z-suave: #fffbeb; --z-suave-h: #fef3c7; }
      .zona-purple  { --z-main: var(--color-brand-purple); --z-main-h: color-mix(in oklab, var(--color-brand-purple) 85%, black); --z-bg: #ddd6fe; --z-fg: #4c1d95; --z-suave: #f5f3ff; --z-suave-h: #ede9fe; }
      .zona-emerald { --z-main: #047857; --z-main-h: #065f46; --z-bg: #a7f3d0; --z-fg: #064e3b; --z-suave: #ecfdf5; --z-suave-h: #d1fae5; }
      .zona-blue    { --z-main: #1d4ed8; --z-main-h: #1e40af; --z-bg: #bfdbfe; --z-fg: #1e3a8a; --z-suave: #eff6ff; --z-suave-h: #dbeafe; }
      .zona-slate   { --z-main: #475569; --z-main-h: #334155; --z-bg: #cbd5e1; --z-fg: #1e293b; --z-suave: #f8fafc; --z-suave-h: #f1f5f9; }
      :host-context(.dark) .zona-amber   { --z-main: #b45309; --z-main-h: #d97706; --z-bg: rgb(245 158 11 / 0.26);  --z-fg: #fde68a; --z-suave: rgb(245 158 11 / 0.1);  --z-suave-h: rgb(245 158 11 / 0.18); }
      :host-context(.dark) .zona-purple  { --z-main: #7c3aed; --z-main-h: #8b5cf6; --z-bg: rgb(139 92 246 / 0.3);  --z-fg: #ddd6fe; --z-suave: rgb(139 92 246 / 0.12); --z-suave-h: rgb(139 92 246 / 0.2); }
      :host-context(.dark) .zona-emerald { --z-main: #059669; --z-main-h: #10b981; --z-bg: rgb(16 185 129 / 0.26);  --z-fg: #a7f3d0; --z-suave: rgb(16 185 129 / 0.1);  --z-suave-h: rgb(16 185 129 / 0.18); }
      :host-context(.dark) .zona-blue    { --z-main: #2563eb; --z-main-h: #3b82f6; --z-bg: rgb(59 130 246 / 0.28);  --z-fg: #bfdbfe; --z-suave: rgb(59 130 246 / 0.1);  --z-suave-h: rgb(59 130 246 / 0.18); }
      :host-context(.dark) .zona-slate   { --z-main: #64748b; --z-main-h: #94a3b8; --z-bg: rgb(71 85 105 / 0.55);   --z-fg: #e2e8f0; --z-suave: rgb(71 85 105 / 0.2);   --z-suave-h: rgb(71 85 105 / 0.32); }
      .sec-cab { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; background: var(--z-bg); color: var(--z-fg); }
      .sec-ic { width: 2.25rem; height: 2.25rem; padding: 0.5rem; border-radius: 0.625rem; flex-shrink: 0;
         background: rgb(255 255 255 / 0.65) !important; color: var(--z-fg) !important; }
      :host-context(.dark) .sec-ic { background: rgb(0 0 0 / 0.25) !important; }
      .sec-t { font-family: var(--font-display, inherit); font-size: 1.125rem; font-weight: 800; color: var(--z-fg); line-height: 1.2; }
      .sec-n { font-size: 0.8125rem; font-weight: 600; color: var(--z-fg); opacity: 0.8; font-variant-numeric: tabular-nums; }
      .sec-n b { font-weight: 800; }
      .btn-q { height: 2rem; padding: 0 0.625rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 700; color: var(--z-fg);
         transition: background-color 150ms ease; white-space: nowrap; }
      .btn-q:hover { background: rgb(255 255 255 / 0.6); }
      :host-context(.dark) .btn-q:hover { background: rgb(0 0 0 / 0.2); }
      .btn-q:disabled { opacity: 0.35; pointer-events: none; }
      @media (pointer: coarse) { .btn-q { height: 2.75rem; } }

      /* ── Fila ──────────────────────────────────────────────────────────── */
      .filas { container-type: inline-size; }
      .fila { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 1.25rem;
         padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--u-linea); transition: background-color 150ms ease; }
      .fila > .alcance { grid-column: 1 / -1; }
      .fila:last-child { border-bottom: 0; }
      .fila.on + .fila.on { border-top-color: transparent; }
      .fila.clicable { cursor: pointer; }
      .fila.on { background: var(--z-suave); }
      .fila:not(.on) .fila-t { color: var(--u-texto-2); font-weight: 500; }
      @media (hover: hover) and (pointer: fine) { .fila.clicable:hover { background: var(--dash-hover); } .fila.on.clicable:hover { background: var(--z-suave-h); } }
      .fila-txt { min-width: 0; }
      .fila-t { display: flex; align-items: center; flex-wrap: wrap; gap: 0.375rem 0.5rem; font-size: 0.9375rem; font-weight: 600;
         color: var(--u-texto); line-height: 1.3; }
      .fila-d { margin-top: 0.125rem; font-size: 0.8125rem; line-height: 1.45; color: var(--dash-texto-suave);
         white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fila-aviso { margin-top: 0.375rem; display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; font-weight: 600;
         color: var(--estado-aviso-fg); }
      .fila-aviso svg { width: 0.875rem; height: 0.875rem; }
      .marca-cambio { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0 0.5rem; border-radius: 999px; font-size: 0.6875rem;
         font-weight: 700; line-height: 1.25rem; background: var(--z-bg); color: var(--z-fg);
         animation: aparece 200ms cubic-bezier(0.23, 1, 0.32, 1); }
      .marca-cambio::before { content: ''; width: 0.375rem; height: 0.375rem; border-radius: 999px; background: currentColor; }
      @keyframes aparece { from { opacity: 0; transform: scale(0.9); } }

      /* Interruptor */
      .sw { position: relative; flex-shrink: 0; width: 2.75rem; height: 1.625rem; border-radius: 999px; background: var(--u-apagado);
         transition: background-color 200ms ease; }
      .sw::after { content: ''; position: absolute; top: 0.1875rem; left: 0.1875rem; width: 1.25rem; height: 1.25rem; border-radius: 999px;
         background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.2); transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1); }
      .sw[aria-checked="true"] { background: var(--z-main, var(--u-marca)); }
      .sw[aria-checked="true"]::after { transform: translateX(1.125rem); }
      .sw:active::after { width: 1.5rem; }
      .sw[aria-checked="true"]:active::after { transform: translateX(0.875rem); }
      .sw:disabled { opacity: 0.45; cursor: not-allowed; }
      /* El área táctil crece sin cambiar el dibujo */
      .sw::before { content: ''; position: absolute; inset: -0.5625rem -0.25rem; }

      /* Segmentado de nivel: diseño global .segmented; aquí solo tamaño de iconos y táctil */
      .segmented { flex-shrink: 0; }
      .segmented-item svg { width: 0.875rem; height: 0.875rem; flex-shrink: 0; }
      @media (pointer: coarse) { .segmented-item { min-height: 2.5rem; } }

      /* Alcance: segunda línea de la fila */
      .alcance { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem 0.75rem; margin-top: 0.625rem; }
      @container (max-width: 34rem) { .alcance { margin-top: 0; } }
      .alcance-l { font-size: 0.8125rem; font-weight: 600; color: var(--u-texto-2); }

      /* En una columna estrecha el control baja bajo el texto y ocupa todo el
         ancho: el segmentado de 3 opciones no cabe al lado de la descripción. */
      @container (max-width: 34rem) {
         .fila.con-seg { grid-template-columns: minmax(0, 1fr); row-gap: 0.625rem; }
         .fila.con-seg .segmented { width: 100%; }
         .fila.con-seg .segmented-item { flex: 1; padding: 0 0.375rem; }
         .fila-d { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
         .sec-cab { padding: 0.75rem 1rem; }
         .fila { padding: 0.875rem 1rem; }
      }

      /* ── Barra de guardado ─────────────────────────────────────────────── */
      .guardar-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0.75rem 0.75rem 1.25rem;
         border-radius: 0.875rem; background: #1e1b2e; color: #f8fafc; box-shadow: 0 12px 32px -8px rgb(17 24 39 / 0.35); }
      :host-context(.dark) .guardar-bar { background: #f8fafc; color: #111827; }
      .guardar-bar .txt { flex: 1; min-width: 0; font-size: 0.875rem; font-weight: 600; }
      .guardar-bar .txt span { display: block; font-size: 0.75rem; font-weight: 500; opacity: 0.7; }
      /* La barra se mide contra el panel de la lista, no contra la ventana:
         con el menú lateral abierto el panel puede ser estrecho en un portátil. */
      .lista { container-type: inline-size; container-name: lista; }
      @container lista (max-width: 36rem) {
         .guardar-bar { gap: 0.25rem; padding: 0.5rem 0.5rem 0.5rem 1rem; }
         .guardar-bar .txt span { display: none; }
         .guardar-bar .btn-descartar { padding: 0 0.75rem; }
      }
      .btn-descartar { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
         height: 2.75rem; padding: 0 1.125rem; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 700; white-space: nowrap;
         color: inherit; background: transparent; transition: background-color 150ms ease, transform 160ms cubic-bezier(0.23, 1, 0.32, 1); }
      .btn-descartar:hover { background: rgb(255 255 255 / 0.1); }
      :host-context(.dark) .btn-descartar:hover { background: rgb(0 0 0 / 0.06); }
      .btn-descartar:active { transform: scale(0.97); }
      .btn-descartar:disabled { opacity: 0.6; }

      .aviso { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.75rem;
         font-size: 0.875rem; font-weight: 600; box-shadow: 0 12px 32px -8px rgb(17 24 39 / 0.25); }
      .aviso.ok { background: var(--estado-ok-bg); color: var(--estado-ok-fg); }
      .aviso.error { background: var(--estado-alerta-bg); color: var(--estado-alerta-fg); }
      :host-context(.dark) .aviso { background: rgb(15 23 42); border: 1px solid rgb(148 163 184 / 0.2); }
      .aviso svg { width: 1.25rem; height: 1.25rem; flex-shrink: 0; }
      .aviso span { display: block; font-weight: 500; opacity: 0.85; font-size: 0.8125rem; }

      .vacio-box { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 3.5rem 1.5rem; }
      .vacio-ic { width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: 0.75rem; background: var(--dash-tesela); color: var(--dash-texto-suave); }
      .vacio-ic svg { width: 1.375rem; height: 1.375rem; }

      .seccion .sw:focus-visible, .seccion .segmented-item:focus-visible, .seccion .btn-q:focus-visible { outline-color: var(--z-main); }
      .volver:focus-visible, .ind-btn:focus-visible, .chip:focus-visible, .btn-q:focus-visible, .sw:focus-visible,
      .segmented-item:focus-visible, .btn-descartar:focus-visible, .link-quitar:focus-visible,
      .buscador-x:focus-visible { outline: 2px solid var(--u-marca); outline-offset: 2px; }

      @media (prefers-reduced-motion: reduce) {
         .sw, .sw::after, .segmented-item, .barra > i, .volver svg, .marca-cambio { transition: none !important; animation: none !important; }
      }
   `]
})
export class UsuarioPermisosPage implements OnInit {
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private permisosService = inject(PermisosService);
   private usuariosService = inject(UsuariosService);
   private sanitizer = inject(DomSanitizer);
   private authStore = inject(AuthStore);

   @ViewChild('scroller') private scroller?: ElementRef<HTMLElement>;

   /** Coordinador/Secretario tienen restricciones sobre qué permisos pueden otorgar */
   readonly esCongRole = computed(() => {
      const user = this.authStore.user();
      const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
      return roles.some(r => ['coordinador', 'secretario'].includes(r));
   });

   /** Gestor de la congregación: reparte permisos en su congregación (incluido
    *  publicadores.editar) pero nunca los de administración del sistema. */
   readonly esGestor = computed(() => {
      this.authStore.user();
      return this.authStore.isGestor();
   });

   /** Devuelve true si el permiso NO puede ser modificado por el usuario actual.
    *  Espejo de _es_restringido_para_cong (backend, permiso_router.py). */
   isPermisoRestringido(codigo: string): boolean {
      const esAdminPrefijo = PREFIJOS_RESTRINGIDOS_CONG.some(p => codigo.startsWith(p));
      if (this.esGestor()) return esAdminPrefijo;
      return this.esCongRole() && (PERMISOS_RESTRINGIDOS_CONG.has(codigo) || esAdminPrefijo);
   }

   loading = signal(true);
   saving = signal(false);
   showSuccess = signal(false);
   showError = signal(false);
   busqueda = signal('');
   seccionActiva = signal<string | null>(null);
   confirmarSalida = signal(false);

   usuario = signal<Usuario | null>(null);
   permisos = signal<PermisoConEstado[]>([]);
   permisosOriginales = signal<Set<number>>(new Set());

   categorias = computed<CategoriaPermisos[]>(() => {
      const porCategoria = new Map<string, PermisoConEstado[]>();

      for (const p of this.permisos()) {
         // 'modulo' reúne categorías que en la app son pestañas del mismo sitio
         // (Publicadores + Grupos + Contactos). Si el permiso no lo trae, se
         // cae al nombre derivado del prefijo del código.
         const catKey = p.modulo || this.getCategoriaNombre(p.codigo);
         const lista = porCategoria.get(catKey);
         if (lista) lista.push(p);
         else porCategoria.set(catKey, [p]);
      }

      return Array.from(porCategoria.entries())
         .sort(([a], [b]) => {
            const indexA = ORDEN_CATEGORIAS.indexOf(a);
            const indexB = ORDEN_CATEGORIAS.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
         })
         .map(([cat, permisos]) => ({
            categoria: cat,
            ancla: 'mod-' + cat.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-'),
            icono: this.getCategoryIcon(cat),
            tema: TEMAS_POR_CATEGORIA[cat] || 'slate',
            pantallas: this.agruparPorPantalla(permisos),
            sueltos: permisos.filter(p => !p.pantalla),
            // Los alcances no son capacidades: contarlos haría que "3 de 5"
            // no coincidiera con los controles que se ven en pantalla.
            contables: permisos.filter(p => p.accion !== 'alcance')
         }));
   });

   /**
    * Empareja los permisos de una misma pestaña en un solo bloque, conservando
    * el orden en el que llegan del backend (categoria, orden).
    */
   private agruparPorPantalla(permisos: PermisoConEstado[]): PantallaPermisos[] {
      const porPantalla = new Map<string, PantallaPermisos>();

      for (const p of permisos) {
         if (!p.pantalla) continue;

         let bloque = porPantalla.get(p.pantalla);
         if (!bloque) {
            bloque = { nombre: p.pantalla };
            porPantalla.set(p.pantalla, bloque);
         }

         if (p.accion === 'editar') bloque.editar = p;
         else if (p.accion === 'alcance') bloque.alcance = p;
         else bloque.ver = p;
      }

      return Array.from(porPantalla.values());
   }

   filteredCategorias = computed(() => {
      const query = this.normalizar(this.busqueda());
      if (!query) return this.categorias();

      const coincide = (p?: PermisoConEstado) => !!p && (
         this.normalizar(p.nombre).includes(query) ||
         this.normalizar(p.descripcion ?? '').includes(query) ||
         p.codigo.toLowerCase().includes(query)
      );

      return this.categorias()
         .map(cat => {
            // Si el texto es el nombre del módulo, se muestra entero.
            if (this.normalizar(cat.categoria).includes(query)) return cat;
            return {
               ...cat,
               // Una pantalla entra entera si coincide su nombre o cualquiera de
               // sus permisos: partir el bloque dejaría un "Editar" sin su "Ver".
               pantallas: cat.pantallas.filter(pan =>
                  this.normalizar(pan.nombre).includes(query) ||
                  coincide(pan.ver) || coincide(pan.editar) || coincide(pan.alcance)
               ),
               sueltos: cat.sueltos.filter(coincide)
            };
         })
         .filter(cat => cat.pantallas.length > 0 || cat.sueltos.length > 0);
   });

   private normalizar(t: string): string {
      return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
   }

   totalAsignados = computed(() =>
      this.permisos().filter(p => p.asignado && p.accion !== 'alcance').length
   );
   totalPermisos = computed(() => this.permisos().filter(p => p.accion !== 'alcance').length);

   hasChanges = computed(() => this.changesCount() > 0);

   changesCount = computed(() => {
      const originales = this.permisosOriginales();
      return this.permisos().filter(p => originales.has(p.id_permiso) !== p.asignado).length;
   });

   /**
    * Lo que se enviará al guardar. Los alcances viajan como un permiso más: su
    * `asignado` es directamente la opción "toda la congregación" del selector.
    */
   private idsActivos(): Set<number> {
      return new Set(this.permisos().filter(p => p.asignado).map(p => p.id_permiso));
   }

   async ngOnInit() {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (!id) {
         this.router.navigate(['/usuarios']);
         return;
      }

      await this.loadData(id);
   }

   async loadData(idUsuario: number) {
      this.loading.set(true);
      try {
         const [usuarios, permisos] = await Promise.all([
            lastValueFrom(this.usuariosService.getUsuarios()),
            lastValueFrom(this.permisosService.getPermisosUsuario(idUsuario))
         ]);

         const usuario = usuarios.find(u => u.id_usuario === idUsuario);
         if (!usuario) {
            this.router.navigate(['/usuarios']);
            return;
         }

         // Un alcance sin su "Ver" encendido no significa nada: el backend
         // nunca llega a consultarlo. Se normaliza al cargar para que la
         // pantalla no muestre un radio de acción que en realidad no aplica.
         const verPorPantalla = new Map<string, boolean>();
         const editarPorPantalla = new Map<string, boolean>();
         for (const p of permisos) {
            if (p.accion === 'ver' && p.pantalla) {
               verPorPantalla.set(`${p.modulo}:${p.pantalla}`, p.asignado);
            }
            if (p.accion === 'editar' && p.pantalla) {
               editarPorPantalla.set(`${p.modulo}:${p.pantalla}`, p.asignado);
            }
         }
         for (const p of permisos) {
            const clave = `${p.modulo}:${p.pantalla}`;
            const base = ALCANCES_DE_EDICION[p.codigo] ? editarPorPantalla : verPorPantalla;
            if (p.accion === 'alcance' && p.pantalla && !base.get(clave)) {
               p.asignado = false;
            }
         }

         this.usuario.set(usuario);
         this.permisos.set(permisos);
         this.permisosOriginales.set(this.idsActivos());
      } catch (err: any) {
         // El backend restringe esta pantalla a los usuarios bajo el alcance de
         // quien la abre: misma congregación y rol bajo su mando. Llegando por
         // URL a cualquier otro responde 403; se vuelve al listado, igual que
         // cuando el usuario no existe.
         if (err?.status === 403 || err?.status === 404) {
            this.router.navigate(['/usuarios']);
            return;
         }
         console.error('Error loading data', err);
      } finally {
         this.loading.set(false);
      }
   }

   // ── Cambios ───────────────────────────────────────────────────────────────

   /** Aplica un cambio de estado a un conjunto de permisos por id. */
   private setAsignado(ids: Set<number>, valor: boolean) {
      this.permisos.update(list =>
         list.map(p => ids.has(p.id_permiso) && p.asignado !== valor ? { ...p, asignado: valor } : p)
      );
   }

   /** Interruptor de un permiso suelto o de una pantalla que solo tiene "Ver". */
   // Los computed devuelven objetos nuevos en cada cambio: sin trackBy se recrea
   // todo el DOM y el scroll vuelve arriba.
   trackCat = (_: number, c: CategoriaPermisos) => c.categoria;
   trackPan = (_: number, p: PantallaPermisos) => p.nombre;
   trackPerm = (_: number, p: PermisoConEstado) => p.id_permiso;

   togglePermiso(permiso: PermisoConEstado, pan?: PantallaPermisos) {
      // Un permiso restringido se puede quitar, pero no dar: el backend solo
      // valida lo que se AÑADE (permiso_router.update_usuario_permisos).
      if (this.isPermisoRestringido(permiso.codigo) && !permiso.asignado) return;

      const ids = new Set([permiso.id_permiso]);
      // Quitar la pantalla apaga también su alcance, para no dejar guardado
      // un radio de acción invisible.
      if (permiso.asignado && pan?.alcance) ids.add(pan.alcance.id_permiso);
      this.setAsignado(ids, !permiso.asignado);
   }

   /**
    * Un control está bloqueado solo si ENCENDERLO otorgaría un permiso que
    * este rol no puede dar. Quitar sí se puede: el backend solo valida lo que
    * se añade, y bloquear también el apagado impedía, por ejemplo, que un
    * Gestor retirara un permiso de administración que alguien tenía de antes.
    */
   estaBloqueado(p?: PermisoConEstado): boolean {
      return !!p && this.isPermisoRestringido(p.codigo) && !p.asignado;
   }

   /** Nivel actual de una pantalla con Ver y Editar. */
   nivel(pan: PantallaPermisos): Nivel {
      if (!pan.ver?.asignado) return 'ninguno';
      return pan.editar?.asignado ? 'editar' : 'ver';
   }

   /** "Ver y editar" no se puede elegir si falta poder dar cualquiera de los dos. */
   nivelBloqueado(pan: PantallaPermisos, nivel: Nivel): boolean {
      if (nivel === 'ninguno') return false;
      if (nivel === 'ver') return this.estaBloqueado(pan.ver);
      return this.estaBloqueado(pan.ver) || this.estaBloqueado(pan.editar);
   }

   /**
    * Ver y Editar de una misma pantalla no son independientes: editar sin poder
    * ver no existe, y quitar la lectura arrastra todo lo demás. Por eso se elige
    * un nivel y no dos casillas.
    */
   setNivel(pan: PantallaPermisos, nivel: Nivel) {
      if (this.nivelBloqueado(pan, nivel) || this.nivel(pan) === nivel) return;

      const on = new Set<number>();
      const off = new Set<number>();
      const add = (s: Set<number>, p?: PermisoConEstado) => { if (p) s.add(p.id_permiso); };

      if (nivel === 'ninguno') {
         add(off, pan.ver); add(off, pan.editar); add(off, pan.alcance);
      } else if (nivel === 'ver') {
         add(on, pan.ver); add(off, pan.editar);
         if (pan.alcance && ALCANCES_DE_EDICION[pan.alcance.codigo]) add(off, pan.alcance);
      } else {
         add(on, pan.ver); add(on, pan.editar);
      }

      this.permisos.update(list =>
         list.map(p => {
            if (on.has(p.id_permiso) && !p.asignado) return { ...p, asignado: true };
            if (off.has(p.id_permiso) && p.asignado) return { ...p, asignado: false };
            return p;
         })
      );
   }

   /** El selector de alcance se ve con la pantalla abierta; el de edición, solo con «Ver y editar». */
   alcanceVisible(pan: PantallaPermisos): boolean {
      if (!pan.alcance) return false;
      return ALCANCES_DE_EDICION[pan.alcance.codigo] ? !!pan.editar?.asignado : !!pan.ver?.asignado;
   }

   textosAlcance(pan: PantallaPermisos) {
      return (pan.alcance && ALCANCES_DE_EDICION[pan.alcance.codigo]) || ALCANCE_DE_DATOS;
   }

   /** El selector de alcance: true = toda la congregación, false = solo su grupo. */
   setAlcance(pan: PantallaPermisos, todaLaCongregacion: boolean) {
      if (!pan.alcance) return;
      if (todaLaCongregacion && this.estaBloqueado(pan.alcance)) return;
      this.setAsignado(new Set([pan.alcance.id_permiso]), todaLaCongregacion);
   }

   /** Ids de una categoría que este usuario sí puede modificar. */
   private idsOtorgables(cat: CategoriaPermisos): Set<number> {
      const ids = new Set<number>();
      const agregar = (p?: PermisoConEstado) => {
         if (p && !this.isPermisoRestringido(p.codigo)) ids.add(p.id_permiso);
      };
      for (const pan of cat.pantallas) {
         agregar(pan.ver);
         agregar(pan.editar);
         // "Dar todo" no amplía el alcance: ver toda la congregación es una
         // decisión aparte que conviene tomar a conciencia.
      }
      cat.sueltos.forEach(agregar);
      return ids;
   }

   /** Ids de una categoría que se pueden quitar: todos, incluidos alcances y restringidos. */
   private idsDeCategoria(cat: CategoriaPermisos): Set<number> {
      const ids = new Set<number>();
      for (const pan of cat.pantallas) {
         for (const p of [pan.ver, pan.editar, pan.alcance]) if (p) ids.add(p.id_permiso);
      }
      cat.sueltos.forEach(p => ids.add(p.id_permiso));
      return ids;
   }

   darTodos(cat: CategoriaPermisos) {
      this.setAsignado(this.idsOtorgables(cat), true);
   }

   quitarTodos(cat: CategoriaPermisos) {
      this.setAsignado(this.idsDeCategoria(cat), false);
   }

   /** Quita todos los accesos del usuario. Se puede deshacer con "Descartar". */
   quitarTodo() {
      this.setAsignado(new Set(this.permisos().map(p => p.id_permiso)), false);
   }

   descartar() {
      const originales = this.permisosOriginales();
      this.permisos.update(list =>
         list.map(p => originales.has(p.id_permiso) !== p.asignado ? { ...p, asignado: originales.has(p.id_permiso) } : p)
      );
   }

   async guardar() {
      if (this.saving() || !this.usuario()) return;

      this.saving.set(true);
      try {
         const activeIds = Array.from(this.idsActivos());

         await lastValueFrom(
            this.permisosService.updatePermisosUsuario(this.usuario()!.id_usuario!, activeIds)
         );

         this.permisosOriginales.set(new Set(activeIds));

         this.showError.set(false);
         this.showSuccess.set(true);
         setTimeout(() => this.showSuccess.set(false), 3500);
      } catch (err) {
         console.error('Error saving permissions', err);
         this.showError.set(true);
         setTimeout(() => this.showError.set(false), 5000);
      } finally {
         this.saving.set(false);
      }
   }

   // ── Salir sin guardar ─────────────────────────────────────────────────────

   @HostListener('window:beforeunload', ['$event'])
   onBeforeUnload(e: BeforeUnloadEvent): void {
      if (this.hasChanges()) e.preventDefault();
   }

   /** Resolución pendiente del aviso "¿Salir sin guardar?" mientras el guard espera. */
   private resolverSalida: ((salir: boolean) => void) | null = null;

   /** Lo llama el canDeactivate de la ruta: cubre el menú lateral y el botón Volver. */
   puedeSalir(): boolean | Promise<boolean> {
      if (!this.hasChanges()) return true;
      this.confirmarSalida.set(true);
      return new Promise<boolean>(resolve => { this.resolverSalida = resolve; });
   }

   responderSalida(salir: boolean) {
      this.confirmarSalida.set(false);
      this.resolverSalida?.(salir);
      this.resolverSalida = null;
   }

   // ── Índice de módulos ─────────────────────────────────────────────────────

   irA(cat: CategoriaPermisos) {
      const root = this.scroller?.nativeElement;
      const el = root?.querySelector<HTMLElement>(`#${cat.ancla}`);
      if (!root || !el) return;
      const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      root.scrollTo({ top: el.offsetTop - root.offsetTop, behavior: reducir ? 'auto' : 'smooth' });
      this.seccionActiva.set(cat.ancla);
   }

   private rafScroll = 0;

   /** Marca en el índice la sección que ocupa la parte alta de la lista. */
   onScroll() {
      if (this.rafScroll) return;
      this.rafScroll = requestAnimationFrame(() => {
         this.rafScroll = 0;
         const root = this.scroller?.nativeElement;
         if (!root) return;
         const tope = root.scrollTop + root.offsetTop + 80;
         let actual: string | null = null;
         root.querySelectorAll<HTMLElement>('[data-seccion]').forEach(s => {
            if (s.offsetTop <= tope) actual = s.id;
         });
         // Al final de la lista la última sección puede no llegar arriba.
         if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) {
            const todas = root.querySelectorAll<HTMLElement>('[data-seccion]');
            actual = todas[todas.length - 1]?.id ?? actual;
         }
         this.seccionActiva.set(actual);
      });
   }

   // ── Presentación ──────────────────────────────────────────────────────────

   getAssignedCount(cat: CategoriaPermisos): number {
      return cat.contables.filter(p => p.asignado).length;
   }

   /** La fila tiene algún cambio sin guardar. */
   cambiado(...ps: (PermisoConEstado | undefined)[]): boolean {
      const originales = this.permisosOriginales();
      return ps.some(p => !!p && originales.has(p.id_permiso) !== p.asignado);
   }

   cambiadoPantalla(pan: PantallaPermisos): boolean {
      return this.cambiado(pan.ver, pan.editar, pan.alcance);
   }

   /** Descripción que acompaña al nivel elegido: dice qué permite exactamente. */
   descripcionPantalla(pan: PantallaPermisos): string {
      if (this.nivel(pan) === 'editar' && pan.editar?.descripcion) return pan.editar.descripcion;
      return pan.ver?.descripcion || pan.editar?.descripcion || '';
   }

   /** Mensaje visible cuando quien edita no puede dar un acceso. */
   avisoRestringido(...ps: (PermisoConEstado | undefined)[]): string | null {
      const p = ps.find(x => !!x && this.isPermisoRestringido(x.codigo));
      if (!p) return null;
      const dar = p.accion === 'editar' ? 'dar permiso de edición' : 'dar este acceso';
      return p.asignado
        ? `Puedes quitarlo, pero solo un administrador puede volver a ${dar}`
        : `Solo un administrador puede ${dar}`;
   }

   getInitials(u: Usuario): string {
      return u.nombre?.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
   }

   getRolName(u: Usuario): string {
      if (u.rol) return etiquetaRol(u.rol);
      if (u.id_rol_usuario === 6) return 'Usuario Publicador';
      return 'Sin Rol';
   }

   getCategoriaNombre(codigo: string): string {
      const prefijo = codigo.split('.')[0];
      const nombres: Record<string, string> = {
         'publicadores': 'Publicadores',
         'grupos': 'Grupos',
         'contactos': 'Contactos',
         'informes': 'Informes',
         'territorios': 'Territorios',
         'reuniones': 'Reuniones',
         'exhibidores': 'Exhibidores',
         'reportes': 'Reportes',
         'tareas': 'Tareas',
         'configuracion': 'Configuración',
         'admin': 'Administración'
      };
      return nombres[prefijo] || prefijo.charAt(0).toUpperCase() + prefijo.slice(1);
   }

   private iconosCategoriaCache = new Map<string, SafeHtml>();

   getCategoryIcon(categoria: string): SafeHtml {
      const enCache = this.iconosCategoriaCache.get(categoria);
      if (enCache) return enCache;

      const iconos: Record<string, string> = {
         'Publicadores': '<path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>',
         'Informes': '<path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
         'Territorios': '<path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>',
         'Reuniones': '<path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
         'Exhibidores': '<path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>',
         'Reportes': '<path d="M3 3v18h18M7 15l4-4 4 4 6-6"/>',
         'Tareas': '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>',
         'Configuración': '<path d="M10.3 4.3c.4-1.8 3-1.8 3.4 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 001 2.5c1.8.4 1.8 3 0 3.4a1.7 1.7 0 00-1 2.6c.9 1.5-.9 3.3-2.4 2.4a1.7 1.7 0 00-2.6 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 00-2.5-1c-1.6.9-3.3-.9-2.4-2.4a1.7 1.7 0 00-1.1-2.6c-1.8-.4-1.8-3 0-3.4a1.7 1.7 0 001.1-2.5c-.9-1.6.8-3.3 2.4-2.4a1.7 1.7 0 002.5-1.1z"/><circle cx="12" cy="12" r="3"/>',
         'Administración': '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>'
      };

      const paths = iconos[categoria] || '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>';
      const generado = this.sanitizer.bypassSecurityTrustHtml(
         `<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
      );
      this.iconosCategoriaCache.set(categoria, generado);
      return generado;
   }
}

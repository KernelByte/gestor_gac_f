import { Component, computed, inject, OnDestroy, AfterViewInit, signal, Renderer2, ViewChild, ElementRef, NgZone, effect, HostListener } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { lastValueFrom, forkJoin } from 'rxjs';
import { PrivilegiosService } from '../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../privilegios/domain/models/publicador-privilegio';
import { AuthStore } from '../../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { nombreLegal, nombreMostrado } from '../../../../core/utils/nombre.util';
import {
  NuevoPublicadorWizardComponent,
  NuevoPublicadorResult,
  WizardGrupo,
} from '../../publicadores/ui/components/nuevo-publicador-wizard/nuevo-publicador-wizard.component';

// Interfaces simplificadas para la vista
interface Grupo {
  id_grupo: number;
  nombre_grupo: string;
  capitan_grupo?: string | null;
  auxiliar_grupo?: string | null;
  /** Vínculo real al publicador; el backend deriva el texto de arriba de él. */
  id_capitan?: number | null;
  id_auxiliar?: number | null;
  cantidad_publicadores?: number;
  id_congregacion_grupo?: number;
}

type Rol = 'capitan' | 'auxiliar';

/** Lo que se compara para saber si un encargado cambió desde la última carga/guardado. */
interface LideresIniciales {
  capitan: string | null | undefined;
  auxiliar: string | null | undefined;
  id_capitan: number | null | undefined;
  id_auxiliar: number | null | undefined;
}

/** Foto del tablero para poder deshacer. Las listas son inmutables: basta con guardar la referencia. */
interface Instantanea {
  publicadores: Publicador[];
  grupos: Grupo[];
  eliminados: ReadonlySet<number>;
}

/**
 * Borrador de la asignación (gac.grupos_borrador). Lo que se arma en el tablero
 * se guarda aquí y solo llega a la congregación al publicar.
 */
interface GrupoEnBorrador {
  /** Negativo = grupo nuevo que aún no existe. */
  id_grupo: number;
  nombre_grupo: string;
  id_capitan: number | null;
  id_auxiliar: number | null;
  eliminado: boolean;
}

interface ContenidoBorrador {
  grupos: GrupoEnBorrador[];
  publicadores: Record<string, { id_grupo: number | null; orden: number | null }>;
}

interface BorradorRespuesta {
  contenido: ContenidoBorrador;
  base: ContenidoBorrador;
  version: number;
  actualizado_por: string | null;
  fecha_actualizacion: string;
}

type BorradorMeta = Omit<BorradorRespuesta, 'contenido' | 'base'>;

/** Algo que el borrador y alguien por fuera cambiaron distinto. */
interface ConflictoBorrador {
  clave: string;
  tipo: 'publicador' | 'capitan' | 'auxiliar' | 'nombre' | 'grupo_eliminado' | 'grupo_con_publicadores';
  titulo: string;
  /** Qué hacer, solo en los bloqueantes. */
  detalle?: string;
  base: string | null;
  vivo: string | null;
  propuesto: string | null;
  bloqueante: boolean;
}

interface Estado {
  id_estado: number;
  tipo: string;
  nombre_estado: string;
}

interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  /** Alias propio de la persona. Ver core/utils/nombre.util.ts */
  nombre_visible?: string | null;
  /** Nombre ya compuesto por el backend. */
  nombre_mostrado?: string | null;
  id_grupo_publicador?: number | null;
  orden_en_grupo?: number | null;
  id_congregacion_publicador?: number;
  id_estado_publicador?: number | null;
  sexo?: string;
  rol?: any;
  privilegio?: any;
  privilegios_activos?: number[];
}

// Configuracion de etiquetas de privilegio. A nivel de modulo: es inmutable y
// antes se reconstruia dentro de getPrivilegioTags en cada llamada.
const PRIVILEGIO_CONFIG: { [key: string]: { label: string; class: string } } = {
  'anciano': {
    label: 'Anciano',
    class: 'text-indigo-700 bg-indigo-100/90 border border-indigo-200/60 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-500/40 rounded-full'
  },
  'siervo ministerial': {
    label: 'Siervo Ministerial',
    class: 'text-amber-800 bg-amber-100/90 border border-amber-200/60 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-500/40 rounded-full'
  },
  'precursor regular': {
    label: 'Precursor Regular',
    class: 'text-purple-700 bg-purple-100/90 border border-purple-200/60 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-500/40 rounded-full'
  },
  'precursor auxiliar': {
    label: 'Precursor Auxiliar',
    class: 'text-amber-700 bg-amber-100/90 border border-amber-200/50 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-500/40 rounded-full'
  },
};

@Component({
  standalone: true,
  selector: 'app-asignacion-grupos',
  imports: [CommonModule, NuevoPublicadorWizardComponent],
  templateUrl: './asignacion-grupos.page.html',
  styles: [`
    :host { display: block; height: 100vh; height: 100dvh; }
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    /* Toast: sube desde abajo con un leve scale para sentirse "aterrizado" */
    @keyframes slideInBottom {
      from { transform: translateY(20px) scale(0.97); opacity: 0; }
      to   { transform: translateY(0)    scale(1);    opacity: 1; }
    }
    .slide-in-bottom {
      animation: slideInBottom 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    /* Modals: usados en el template como animate-fade-in-up (previamente sin definición) */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    .animate-fade-in-up {
      animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    /* Stagger de columnas al cargar el tablero */
    .kanban-col { animation: colEnter 0.35s cubic-bezier(0.23, 1, 0.32, 1) both; }
    .kanban-col:nth-child(1) { animation-delay: 0ms;  }
    .kanban-col:nth-child(2) { animation-delay: 40ms; }
    .kanban-col:nth-child(3) { animation-delay: 80ms; }
    .kanban-col:nth-child(4) { animation-delay: 120ms;}
    .kanban-col:nth-child(5) { animation-delay: 160ms;}
    .kanban-col:nth-child(6) { animation-delay: 200ms;}
    @keyframes colEnter {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0);    }
    }

    /* Aviso de "este es el grupo que tocaste" tras saltar desde la barra de equilibrio:
       el borde completo se ilumina con un solo pulso suave. Todo se dibuja hacia
       adentro (la columna recorta lo que sobresale) y solo anima opacity. */
    .col-flash::after {
      content: ''; position: absolute; inset: 0; border-radius: inherit;
      pointer-events: none; z-index: 5;
      border: 2px solid rgba(249,115,22,.85);
      box-shadow: inset 0 0 0 1px rgba(249,115,22,.25), inset 0 0 26px rgba(249,115,22,.22);
      animation: colFlash 2s cubic-bezier(0.4, 0, 0.2, 1) 200ms both;
    }
    @keyframes colFlash {
      0%   { opacity: 0; }
      30%  { opacity: 1; }
      55%  { opacity: 1; }
      100% { opacity: 0; }
    }

    /* ═══════════════════════════════════════
       ANIMACIÓN INMERSIVA - Efecto "Foco"
       Zoom suave + desenfoque que aclara
    ═══════════════════════════════════════ */
    /* Sin blur: animar filter en una superficie a pantalla completa cuesta caro y no aporta. */
    @keyframes immersiveEnter {
      from { opacity: 0; transform: scale(0.985); }
      to   { opacity: 1; transform: scale(1); }
    }
    ::ng-deep .immersive-in {
      animation: immersiveEnter 0.24s cubic-bezier(0.23, 1, 0.32, 1) forwards !important;
    }

    /* Indicador de inserción de columna: barra azul en el borde izquierdo sin mover el layout */
    .column-drop-target {
      box-shadow: -5px 0 0 0 #3b82f6, -10px 0 22px -2px rgba(59,130,246,0.35) !important;
    }

    /* Scrollbar oscuro para columnas en modo inmersivo */
    .immersive-scroll::-webkit-scrollbar { height: 4px; width: 4px; }
    .immersive-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 4px; }
    .immersive-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    .immersive-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }

    /* ═══════════════════════════════════════
       OVERRIDES GLOBALES - Modo Pantalla Completa
       Elimina todos los márgenes/padding/overflow
       del shell para que el fixed llene el viewport
    ═══════════════════════════════════════ */
    ::ng-deep body.gac-fullscreen-active app-shell aside,
    ::ng-deep body.gac-fullscreen-active app-shell header {
      display: none !important;
    }

    /* Quitar margen del sidebar en el wrapper de contenido */
    ::ng-deep body.gac-fullscreen-active app-shell aside + div {
      margin-left: 0 !important;
    }

    /* Quitar márgenes laterales y bottom del main */
    ::ng-deep body.gac-fullscreen-active app-shell main {
      margin: 0 !important;
      padding: 0 !important;
      height: 100vh !important;
      max-height: 100vh !important;
      overflow: visible !important;
    }

    /* Quitar overflow-hidden del router-container para no recortar el fixed */
    ::ng-deep body.gac-fullscreen-active app-shell .router-container {
      height: 100vh !important;
      overflow: visible !important;
    }

    /* Asegurar que el contenedor del shell no oculte contenido */
    ::ng-deep body.gac-fullscreen-active app-shell > div {
      overflow: visible !important;
    }

    /* Tarjeta que aparece en una lista (al moverla o deshacer): entra sin salto. */
    .card-enter { animation: cardEnter 180ms cubic-bezier(0.23, 1, 0.32, 1) backwards; }
    @keyframes cardEnter {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    /* Check de selección: aparece con un pequeño escalado, sin rebote. */
    .check-in { animation: checkIn 140ms cubic-bezier(0.23, 1, 0.32, 1) both; }
    @keyframes checkIn { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
    /* Menú de la tarjeta: crece desde su esquina, nunca desde el centro. */
    /* Popover: anula los estilos del navegador (centrado, borde, relleno); la
       posición la fija onMenuToggle junto al botón. */
    .menu-pop[popover] { position: fixed; inset: auto; margin: 0; padding: 0; color: inherit; overflow-x: hidden; }
    .menu-pop:popover-open { transform-origin: top right; animation: menuIn 140ms cubic-bezier(0.23, 1, 0.32, 1) both; }
    .menu-pop[data-dir="up"]:popover-open { transform-origin: bottom right; animation-name: menuInUp; }
    @keyframes menuInUp { from { opacity: 0; transform: scale(0.96) translateY(2px); } to { opacity: 1; transform: none; } }
    @keyframes menuIn { from { opacity: 0; transform: scale(0.96) translateY(-2px); } to { opacity: 1; transform: none; } }
    .rail-in { animation: railIn 180ms cubic-bezier(0.23, 1, 0.32, 1) 60ms backwards; }
    @keyframes railIn { from { opacity: 0; } to { opacity: 1; } }
    .undo-in { animation: undoIn 160ms cubic-bezier(0.23, 1, 0.32, 1) both; }
    @keyframes undoIn {
      from { opacity: 0; transform: scale(0.92); }
      to   { opacity: 1; transform: scale(1); }
    }

    @keyframes colFlashStatic { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }

    @media (prefers-reduced-motion: reduce) {
      .card-enter, .undo-in, .check-in, .rail-in, .menu-pop:popover-open { animation: none; }
      .col-sin-asignar { transition: none; }
      .eq-bar { transition: none; }
      .slide-in-bottom,
      .animate-fade-in-up,
      .kanban-col { animation: none; opacity: 1; transform: none; }
      ::ng-deep .immersive-in { animation: none !important; }
      .drop-zone-overlay { animation: none !important; }
      .col-flash::after { animation: colFlashStatic 2s ease-out both; }
    }

    /* ═══════════════════════════════════════
       DROP ZONE — Indicador de zona de soltar
    ═══════════════════════════════════════ */
    @keyframes dropZoneEnter {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    /* Zona de soltar: aparece y se queda quieta. El rebote y el parpadeo distraían
       justo cuando hace falta precisión. */
    .drop-zone-overlay { animation: dropZoneEnter 0.15s ease-out forwards; }
  `]
})
export class AsignacionGruposPage implements AfterViewInit, OnDestroy {
  /** Expuesto a la plantilla: las funciones sueltas no son accesibles desde el HTML. */
  readonly nombreMostrado = nombreMostrado;


  /** trackBy: evita recrear el DOM de toda la lista en cada cambio. */
  trackByGrupoId = (_: number, g: any) => g.id_grupo;
  trackByPublicadorId = (_: number, p: Publicador) => p.id_publicador;
  trackByEq = (_: number, b: { id: number }) => b.id;

  private http = inject(HttpClient);
  private router = inject(Router);
  private privilegiosService = inject(PrivilegiosService);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private authStore = inject(AuthStore);
  protected congregacionContext = inject(CongregacionContextService);

  constructor() {
    this.restaurarPantallaCompleta();
    effect(() => {
      this.congregacionContext.effectiveCongregacionId();
      this.loadData();
    });
  }

  // Data
  grupos = signal<Grupo[]>([]);
  publicadores = signal<Publicador[]>([]);

  // ── Borrador ─────────────────────────────────────────────────────────────
  /** Grupos tal como están publicados en la congregación, sin el borrador encima. */
  gruposPublicados = signal<Grupo[]>([]);
  /** Grupos reales que el borrador elimina: dejan de verse como columna. */
  gruposEliminados = signal<ReadonlySet<number>>(new Set());
  /** Borrador guardado en el servidor (null = no hay). */
  borrador = signal<BorradorMeta | null>(null);
  /** Contenido tal como quedó en la última carga o guardado; sirve para saber si hay algo sin guardar. */
  private fotoGuardada = signal('');
  /** Ids para grupos creados en el tablero que aún no existen. */
  private siguienteIdTemporal = -1;

  // Privilegios Data
  privilegiosCatalogo = signal<Privilegio[]>([]);
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map()); // id_publicador -> id_privilegio[]

  // UI State
  isDraggingOver = signal<'unassigned' | number | null>(null);
  draggedPublishers: Publicador[] = []; // Changed from single item to array
  isSaving = signal(false);
  showSuccessMessage = signal(false);
  showExitConfirmation = signal(false); // Modal state
  isFullScreen = signal(false);
  showInactivePublishers = signal(true);
  estadosPublicador = signal<Estado[]>([]);
  /** Término de búsqueda por grupo (solo para filtrar la lista mostrada en cada card). */
  groupSearchTerms = signal<Record<number, string>>({});
  canScrollLeft = signal(false);
  canScrollRight = signal(false);
  activeColumnIndex = signal(0);
  private resizeObserver: ResizeObserver | null = null;
  private dragOverTimer: ReturnType<typeof setTimeout> | null = null;

  // Selection State
  selectedPublishersIds = signal<Set<number>>(new Set());

  // Auto-Scroll Logic
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  private ngZone = inject(NgZone);
  private autoScrollFrameId: number | null = null;
  private currentDragX = 0;
  private isAutoScrolling = false;
  isDraggingContent = signal(false);

  onContainerDragOver(e: DragEvent) {
    e.preventDefault();
    if (this.draggedPublishers.length === 0 && !this.draggingLeaderCard) return;
    this.currentDragX = e.clientX;
    this.checkAutoScroll();
  }

  checkAutoScroll() {
    if (this.isAutoScrolling) return;

    this.isAutoScrolling = true;
    this.ngZone.runOutsideAngular(() => {
      const loop = () => {
        if (!this.draggedPublishers.length && !this.draggingLeaderCard) {
          this.isAutoScrolling = false;
          return;
        }

        const container = this.scrollContainer?.nativeElement;
        if (!container) {
          this.isAutoScrolling = false;
          return;
        }

        const rect = container.getBoundingClientRect();
        const edgeZone = 100;
        const speed = 12;

        if (this.currentDragX < rect.left + edgeZone) {
          container.scrollLeft -= speed;
        } else if (this.currentDragX > rect.right - edgeZone) {
          container.scrollLeft += speed;
        }

        if ((this.draggedPublishers.length > 0 || this.draggingLeaderCard) && this.isAutoScrolling) {
          this.autoScrollFrameId = requestAnimationFrame(loop);
        } else {
          this.isAutoScrolling = false;
        }
      };
      loop();
    });
  }

  /** Origen del drag para reordenar dentro del grupo. */
  dragSourceGroupId = signal<number | null>(null);
  dragSourceIndex = signal<number | null>(null);

  onDragEnd() {
    this.isDraggingContent.set(false);
    this.isAutoScrolling = false;
    if (this.autoScrollFrameId) {
      cancelAnimationFrame(this.autoScrollFrameId);
      this.autoScrollFrameId = null;
    }
    if (this.dragOverTimer) { clearTimeout(this.dragOverTimer); this.dragOverTimer = null; }
    this.draggedPublishers = [];
    this.draggingLeaderCard = null;
    this.dragSourceGroupId.set(null);
    this.dragSourceIndex.set(null);
    this.selectedPublishersIds.set(new Set());
    this.isDraggingOver.set(null);
    this.isDraggingOverLeader.set(null);
  }

  private escKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  toggleShowInactivePublishers() {
    this.showInactivePublishers.update(v => !v);
  }

  /** sessionStorage: recargar la pestaña conserva el modo; salir de la pantalla lo olvida (ver ngOnDestroy). */
  private static readonly CLAVE_PANTALLA_COMPLETA = 'gac.asignacion.pantallaCompleta';

  private recordarPantallaCompleta(activa: boolean): void {
    try {
      if (activa) sessionStorage.setItem(AsignacionGruposPage.CLAVE_PANTALLA_COMPLETA, '1');
      else sessionStorage.removeItem(AsignacionGruposPage.CLAVE_PANTALLA_COMPLETA);
    } catch { /* sin almacenamiento: el modo solo dura hasta recargar */ }
  }

  /** Tras recargar con el modo activo, lo vuelve a poner sin pasar por el botón. */
  private restaurarPantallaCompleta(): void {
    let activa = false;
    try { activa = sessionStorage.getItem(AsignacionGruposPage.CLAVE_PANTALLA_COMPLETA) === '1'; } catch { /* nada */ }
    if (activa && !this.isFullScreen()) this.toggleFullScreen();
  }

  toggleFullScreen() {
    this.isFullScreen.update(v => !v);
    this.recordarPantallaCompleta(this.isFullScreen());
    if (this.isFullScreen()) {
      this.renderer.addClass(this.document.body, 'gac-fullscreen-active');
      this.escKeyHandler = (e: KeyboardEvent) => {
        // Si esa misma pulsación ya cerró un modal o menú (onKeydown la marca),
        // o hay un asistente abierto, no se sale además de pantalla completa.
        if (e.key === 'Escape' && !e.defaultPrevented && !this.wizardAbierto()) this.toggleFullScreen();
      };
      this.document.addEventListener('keydown', this.escKeyHandler);
    } else {
      this.renderer.removeClass(this.document.body, 'gac-fullscreen-active');
      if (this.escKeyHandler) {
        this.document.removeEventListener('keydown', this.escKeyHandler);
        this.escKeyHandler = null;
      }
    }
  }

  ngOnDestroy() {
    this.document.removeEventListener('scroll', this.onScrollCerrarMenus, true);
    window.removeEventListener('resize', this.onScrollCerrarMenus);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer.removeClass(this.document.body, 'gac-fullscreen-active');
    if (this.escKeyHandler) {
      this.document.removeEventListener('keydown', this.escKeyHandler);
    }
    // Se sale de la pantalla (menú, Volver…): la próxima visita empieza en modo normal.
    // Una recarga no pasa por aquí, y por eso conserva el modo.
    this.recordarPantallaCompleta(false);
  }

  /** Columnas reales del tablero, en orden (0 = Sin Asignar, 1+ = grupos). */
  private columnas(): HTMLElement[] {
    return Array.from(this.scrollContainer?.nativeElement.querySelectorAll<HTMLElement>('.kanban-col') ?? []);
  }

  /** Scroll directo a una columna por índice (0 = Sin Asignar, 1+ = grupos). */
  scrollToColumn(index: number) {
    const el = this.scrollContainer?.nativeElement;
    const col = this.columnas()[index];
    if (!el || !col) return;
    el.scrollTo({ left: Math.max(0, col.offsetLeft - 16), behavior: 'smooth' });
    const grupo = index > 0 ? this.grupos()[index - 1] : null;
    if (grupo) this.destacarGrupo(grupo.id_grupo);
  }

  /** Grupo con el borde encendido tras saltar a su columna (null = ninguno). */
  grupoDestacado = signal<number | null>(null);
  private destacadoTimer?: ReturnType<typeof setTimeout>;

  private destacarGrupo(id: number) {
    clearTimeout(this.destacadoTimer);
    // Se apaga un instante para que tocar el mismo grupo dos veces reinicie el efecto.
    this.grupoDestacado.set(null);
    requestAnimationFrame(() => {
      this.grupoDestacado.set(id);
      this.destacadoTimer = setTimeout(() => this.grupoDestacado.set(null), 2400);
    });
  }

  /** Navegación horizontal: desplaza una "página" a izquierda o derecha. */
  scrollHorizontal(direction: 'left' | 'right') {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    const step = Math.max(200, el.clientWidth * 0.6);
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  }

  activeColumnName = computed(() => {
    const idx = this.activeColumnIndex();
    if (idx === 0) return 'Sin Asignar';
    return this.grupos()[idx - 1]?.nombre_grupo ?? '';
  });

  /** Actualiza si se puede scroll a izquierda/derecha (para mostrar/ocultar botones). */
  updateScrollNavState() {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    this.canScrollLeft.set(scrollLeft > 2);
    this.canScrollRight.set(scrollLeft < maxScroll - 2);

    // Columna activa para los puntos del móvil: la que queda más cerca del borde izquierdo.
    const cols = this.columnas();
    if (cols.length && scrollWidth > clientWidth) {
      let mejor = 0, dist = Infinity;
      cols.forEach((c, i) => { const d = Math.abs(c.offsetLeft - 16 - scrollLeft); if (d < dist) { dist = d; mejor = i; } });
      this.activeColumnIndex.set(mejor);
    } else {
      this.activeColumnIndex.set(0);
    }
  }

  isDraggingOverLeader = signal<{ groupId: number, role: 'capitan' | 'auxiliar' } | null>(null);

  // ── Eliminación de grupo ─────────────────────────────────────────────────
  deleteGroupConfirm = signal<number | null>(null);
  isDeletingGroup = signal(false);
  deleteGroupBlockReason = signal<string | null>(null);

  /** Motivo por el que no se puede borrar cada grupo (null = se puede). Cuenta todos, también inactivos ocultos. */
  private readonly bloqueosBorrado = computed(() => {
    const total = new Map<number, number>();
    for (const p of this.publicadores()) {
      if (p.id_grupo_publicador != null) total.set(p.id_grupo_publicador, (total.get(p.id_grupo_publicador) ?? 0) + 1);
    }
    const res = new Map<number, string | null>();
    for (const g of this.grupos()) {
      const reasons: string[] = [];
      if (this.tieneLider(g, 'capitan')) reasons.push('tiene un Capitán asignado');
      if (this.tieneLider(g, 'auxiliar')) reasons.push('tiene un Auxiliar asignado');
      const count = total.get(g.id_grupo) ?? 0;
      if (count > 0) reasons.push(`tiene ${count} publicador${count > 1 ? 'es' : ''} asignado${count > 1 ? 's' : ''}`);
      res.set(g.id_grupo, reasons.length ? reasons.join(', ') : null);
    }
    return res;
  });

  canDeleteGroup(groupId: number): boolean {
    return this.bloqueosBorrado().has(groupId) && this.bloqueosBorrado().get(groupId) === null;
  }

  getDeleteBlockReason(groupId: number): string | null {
    return this.bloqueosBorrado().get(groupId) ?? null;
  }

  requestDeleteGroup(groupId: number) {
    const reason = this.getDeleteBlockReason(groupId);
    if (reason) {
      this.deleteGroupBlockReason.set(reason);
      return;
    }
    this.deleteGroupConfirm.set(groupId);
  }

  /** Solo en el borrador: el grupo desaparece de la congregación al publicar. */
  confirmDeleteGroup() {
    const id = this.deleteGroupConfirm();
    if (id === null) return;
    const nombre = this.getDeleteGroupName();
    this.deleteGroupConfirm.set(null);
    this.registrarHistorial();
    this.grupos.update(list => list.filter(g => g.id_grupo !== id));
    // Un grupo nuevo que nunca se publicó simplemente deja de existir.
    if (id > 0) this.gruposEliminados.update(s => new Set(s).add(id));
    this.mostrarAviso(id > 0 ? `${nombre} se eliminará al publicar` : `${nombre} quitado del borrador`);
  }

  /** Grupo nuevo en el borrador; se crea en la congregación al publicar. */
  agregarGrupo() {
    this.registrarHistorial();
    const usados = new Set(this.grupos().map(g => g.nombre_grupo.trim().toLowerCase()));
    let n = this.grupos().length + 1;
    while (usados.has(`grupo # ${n}`)) n++;
    const id = this.siguienteIdTemporal--;
    this.grupos.update(list => [...list, {
      id_grupo: id, nombre_grupo: `Grupo # ${n}`,
      id_capitan: null, id_auxiliar: null, capitan_grupo: null, auxiliar_grupo: null,
    }]);
    setTimeout(() => {
      this.updateScrollNavState();
      this.scrollToColumn(this.grupos().length);
    }, 60);
  }

  cancelDeleteGroup() {
    this.deleteGroupConfirm.set(null);
    this.deleteGroupBlockReason.set(null);
  }

  getDeleteGroupName(): string {
    const id = this.deleteGroupConfirm();
    if (id === null) return '';
    return this.grupos().find(g => g.id_grupo === id)?.nombre_grupo ?? '';
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Reordenamiento de columnas de grupo ──────────────────────────────────
  draggingColumnId = signal<number | null>(null);
  dragOverColumnId = signal<number | null>(null);
  private columnDragLeaveTimer: ReturnType<typeof setTimeout> | null = null;

  onColumnDragStart(e: DragEvent, groupId: number) {
    this.draggingColumnId.set(groupId);
    this.isDraggingContent.set(true);

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'column-' + groupId);

      // Ghost personalizado: tarjeta inclinada que sigue el cursor
      const grupo = this.grupos().find(g => g.id_grupo === groupId);
      const ghost = this.document.createElement('div');
      ghost.style.cssText = [
        'position:fixed', 'top:-9999px', 'left:-9999px',
        'width:220px', 'padding:10px 14px 10px 12px',
        'border-radius:14px',
        'background:linear-gradient(135deg,#f97316,#ea580c)',
        'color:white', 'font-weight:700', 'font-size:13px',
        'font-family:system-ui,-apple-system,sans-serif',
        'transform:rotate(-3deg) scale(1.04)',
        'box-shadow:0 20px 50px rgba(0,0,0,0.4),0 4px 14px rgba(234,88,12,0.5)',
        'letter-spacing:-0.01em', 'pointer-events:none',
        'display:flex', 'align-items:center', 'gap:8px',
      ].join(';');

      // Icono grip dentro del ghost
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', '12'); svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 12 16');
      svg.setAttribute('fill', 'rgba(255,255,255,0.6)');
      svg.style.flexShrink = '0';
      [[4,3],[8,3],[4,8],[8,8],[4,13],[8,13]].forEach(([cx, cy]) => {
        const c = document.createElementNS(svgNS, 'circle');
        c.setAttribute('cx', String(cx)); c.setAttribute('cy', String(cy)); c.setAttribute('r', '1.5');
        svg.appendChild(c);
      });
      const span = document.createElement('span');
      span.textContent = grupo?.nombre_grupo ?? 'Grupo';
      ghost.appendChild(svg);
      ghost.appendChild(span);

      this.document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 110, 22);
      setTimeout(() => {
        if (this.document.body.contains(ghost)) this.document.body.removeChild(ghost);
      }, 100);
    }
  }

  onColumnDragEnd() {
    if (this.columnDragLeaveTimer) { clearTimeout(this.columnDragLeaveTimer); this.columnDragLeaveTimer = null; }
    this.draggingColumnId.set(null);
    this.dragOverColumnId.set(null);
    this.isDraggingContent.set(false);
  }

  onColumnDragOver(e: DragEvent, groupId: number) {
    if (!this.draggingColumnId()) return;
    e.preventDefault();
    e.stopPropagation();
    if (groupId !== this.draggingColumnId()) {
      this.dragOverColumnId.set(groupId);
    }
  }

  onColumnDragLeave(groupId: number) {
    if (this.dragOverColumnId() === groupId) {
      this.dragOverColumnId.set(null);
    }
  }

  onColumnDrop(e: DragEvent, targetGroupId: number) {
    const fromId = this.draggingColumnId();
    this.draggingColumnId.set(null);
    this.dragOverColumnId.set(null);
    this.isDraggingContent.set(false);
    if (fromId === null || fromId === targetGroupId) return;
    this.grupos.update(list => {
      const arr = [...list];
      const fromIdx = arr.findIndex(g => g.id_grupo === fromId);
      const toIdx = arr.findIndex(g => g.id_grupo === targetGroupId);
      if (fromIdx === -1 || toIdx === -1) return list;
      const [removed] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, removed);
      return arr;
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  /** Encargado que se está arrastrando por su tarjeta (no por la lista de publicadores). */
  private draggingLeaderCard: { fromGroupId: number; fromRole: Rol; publicador: Publicador } | null = null;

  // Estado de la última carga/guardado, para saber qué está pendiente.
  initialState = signal(new Map<number, number | null>());
  initialLeaderState = signal(new Map<number, LideresIniciales>());
  /** Posición de cada publicador dentro de su grupo según la BD. */
  initialOrden = signal(new Map<number, number | null>());

  /** Grupos cuyo orden interno se cambió arrastrando y aún no se guarda. */
  gruposConOrdenPendiente = computed(() => {
    const inicial = this.initialOrden();
    const ids = new Set<number>();
    for (const p of this.publicadores()) {
      if (p.id_grupo_publicador == null) continue;
      if ((p.orden_en_grupo ?? null) !== (inicial.get(p.id_publicador) ?? null)) ids.add(p.id_grupo_publicador);
    }
    return ids;
  });

  pendingChangesCount = computed(() => {
    let count = 0;
    const initialMap = this.initialState();
    for (const p of this.publicadores()) {
      if (initialMap.get(p.id_publicador) !== (p.id_grupo_publicador || null)) count++;
    }
    for (const g of this.grupos()) {
      if (this.isLeaderModified(g.id_grupo, 'capitan')) count++;
      if (this.isLeaderModified(g.id_grupo, 'auxiliar')) count++;
    }
    const r = this.resumenEstructura();
    return count + this.gruposConOrdenPendiente().size + r.nuevos + r.renombrados + r.eliminados;
  });

  /** Grupos nuevos, renombrados y eliminados respecto a lo publicado. */
  resumenEstructura = computed(() => {
    const publicados = new Map(this.gruposPublicados().map(g => [g.id_grupo, g.nombre_grupo]));
    let nuevos = 0, renombrados = 0;
    for (const g of this.grupos()) {
      if (g.id_grupo < 0) nuevos++;
      else if (publicados.has(g.id_grupo) && publicados.get(g.id_grupo) !== g.nombre_grupo.trim()) renombrados++;
    }
    return { nuevos, renombrados, eliminados: this.gruposEliminados().size };
  });

  /** Lo que hay que mandar al servidor: el tablero completo, en orden estable para poder compararlo. */
  private contenidoActual = computed<ContenidoBorrador>(() => {
    const publicados = new Map(this.gruposPublicados().map(g => [g.id_grupo, g]));
    const grupos: GrupoEnBorrador[] = [
      ...this.grupos().map(g => ({
        id_grupo: g.id_grupo, nombre_grupo: g.nombre_grupo.trim(),
        id_capitan: g.id_capitan ?? null, id_auxiliar: g.id_auxiliar ?? null, eliminado: false,
      })),
      ...[...this.gruposEliminados()].map(id => ({
        id_grupo: id, nombre_grupo: publicados.get(id)?.nombre_grupo ?? `Grupo ${id}`,
        id_capitan: null, id_auxiliar: null, eliminado: true,
      })),
    ].sort((a, b) => a.id_grupo - b.id_grupo);
    const publicadores: ContenidoBorrador['publicadores'] = {};
    for (const p of [...this.publicadores()].sort((a, b) => a.id_publicador - b.id_publicador)) {
      publicadores[p.id_publicador] = { id_grupo: p.id_grupo_publicador ?? null, orden: p.orden_en_grupo ?? null };
    }
    return { grupos, publicadores };
  });

  /** Hay cambios en el tablero que todavía no están en el borrador del servidor. */
  hayCambiosSinGuardar = computed(() => JSON.stringify(this.contenidoActual()) !== this.fotoGuardada());

  /** Se puede publicar si el borrador (guardado o por guardar) difiere de la congregación. */
  puedePublicar = computed(() => (this.borrador() !== null || this.hayCambiosSinGuardar()) && this.pendingChangesCount() > 0);

  // ── Deshacer ─────────────────────────────────────────────────────────────
  /** Todo cambio queda pendiente hasta Guardar, así que deshacer es solo volver a la foto anterior. */
  private historial = signal<Instantanea[]>([]);
  puedeDeshacer = computed(() => this.historial().length > 0);
  /** Aviso breve tras una acción con efecto no evidente (p. ej. mover a un encargado). */
  aviso = signal<string | null>(null);
  private avisoTimer: ReturnType<typeof setTimeout> | null = null;
  errorMsg = signal<string | null>(null);
  errorRecargar = signal(false);
  exito = signal<{ titulo: string; texto: string }>({ titulo: '', texto: '' });

  private registrarHistorial(): void {
    this.historial.update(h => [...h.slice(-49), { publicadores: this.publicadores(), grupos: this.grupos(), eliminados: this.gruposEliminados() }]);
  }

  deshacer(): void {
    const h = this.historial();
    if (!h.length) return;
    const ultima = h[h.length - 1];
    this.historial.set(h.slice(0, -1));
    this.publicadores.set(ultima.publicadores);
    this.grupos.set(ultima.grupos);
    this.gruposEliminados.set(ultima.eliminados);
    this.selectedPublishersIds.set(new Set());
    this.ocultarAviso();
  }

  private mostrarAviso(texto: string): void {
    this.aviso.set(texto);
    if (this.avisoTimer) clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => this.aviso.set(null), 5000);
  }

  ocultarAviso(): void {
    if (this.avisoTimer) { clearTimeout(this.avisoTimer); this.avisoTimer = null; }
    this.aviso.set(null);
  }

  /** Con `recargar` el aviso ofrece traer la versión del servidor y no se cierra solo. */
  private mostrarError(texto: string, recargar = false): void {
    this.errorMsg.set(texto);
    this.errorRecargar.set(recargar);
    if (!recargar) setTimeout(() => { if (this.errorMsg() === texto) this.errorMsg.set(null); }, 6000);
  }

  /** Descarta lo local y vuelve a cargar borrador y congregación del servidor. */
  async recargarDesdeServidor() {
    this.errorMsg.set(null);
    this.errorRecargar.set(false);
    await this.loadData();
  }

  private exitoTimer: ReturnType<typeof setTimeout> | null = null;
  private mostrarExito(titulo: string, texto: string): void {
    this.exito.set({ titulo, texto });
    this.showSuccessMessage.set(true);
    if (this.exitoTimer) clearTimeout(this.exitoTimer);
    this.exitoTimer = setTimeout(() => this.showSuccessMessage.set(false), 4000);
  }

  /** Ctrl/Cmd+Z deshace, salvo si se está escribiendo en un campo. Escape cierra lo que esté abierto. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.cerrarCapaAbierta()) { e.preventDefault(); return; }
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!this.puedeDeshacer()) return;
    e.preventDefault();
    this.deshacer();
  }

  /** Cierra el modal o menú más alto. Devuelve true si había algo que cerrar. */
  private cerrarCapaAbierta(): boolean {
    if (this.showExitConfirmation()) { this.cancelExit(); return true; }
    if (this.wizardAbierto()) return true; // el asistente gestiona su propio Escape
    if (this.borradorInfoAbierto()) { this.borradorInfoAbierto.set(false); return true; }
    if (this.publicarAbierto()) { this.cerrarPublicar(); return true; }
    if (this.descartarAbierto()) { if (!this.isDiscarding()) this.descartarAbierto.set(false); return true; }
    if (this.deleteGroupConfirm() !== null || this.deleteGroupBlockReason()) { this.cancelDeleteGroup(); return true; }
    // El navegador cierra el popover con Escape antes o después de que llegue aquí:
    // si se acaba de cerrar, esta pulsación ya se gastó en eso.
    if (this.cerrarMenus() || Date.now() - this.menuCerradoEn < 80) return true;
    if (this.selectedPublishersIds().size) { this.clearSelection(); return true; }
    return false;
  }

  // ── Columna "Sin asignar" contraíble ─────────────────────────────────────
  private static readonly CLAVE_CONTRAIDO = 'gac.asignacion.sinAsignarContraido';
  /** Se recuerda entre visitas: quien contrae la columna suele querer seguir sin ella. */
  sinAsignarContraido = signal(AsignacionGruposPage.leerContraido());

  private static leerContraido(): boolean {
    try { return localStorage.getItem(AsignacionGruposPage.CLAVE_CONTRAIDO) === '1'; } catch { return false; }
  }

  toggleSinAsignar(): void {
    const nuevo = !this.sinAsignarContraido();
    this.sinAsignarContraido.set(nuevo);
    try { localStorage.setItem(AsignacionGruposPage.CLAVE_CONTRAIDO, nuevo ? '1' : '0'); } catch { /* sin almacenamiento: solo dura la sesión */ }
    // Los anchos cambian: recalcula flechas y columna activa cuando termina la transición.
    setTimeout(() => this.updateScrollNavState(), 230);
  }

  /** Con una selección activa la tira funciona como destino; si no, expande. */
  onRailClick(): void {
    if (this.selectedPublishersIds().size > 0) this.moveSelectedToGroup(null);
    else this.toggleSinAsignar();
  }

  // ── Menú de acciones de la tarjeta (popover) ─────────────────────────────
  menuAbiertoId = signal<number | null>(null);
  private menuCerradoEn = 0;

  /** Coloca el menú junto a su botón; si no cabe debajo, lo abre hacia arriba. */
  onMenuToggle(e: ToggleEvent, btn: HTMLElement, id: number): void {
    const pop = e.target as HTMLElement;
    if (e.newState !== 'open') {
      if (this.menuAbiertoId() === id) this.menuAbiertoId.set(null);
      this.menuCerradoEn = Date.now();
      return;
    }
    this.menuAbiertoId.set(id);
    const r = btn.getBoundingClientRect();
    const h = pop.offsetHeight, w = pop.offsetWidth, gap = 4, margen = 8;
    const vh = window.innerHeight, vw = window.innerWidth;
    const arriba = vh - r.bottom < h + gap + margen && r.top > vh - r.bottom;
    const top = arriba ? Math.max(margen, r.top - h - gap) : Math.min(r.bottom + gap, vh - h - margen);
    pop.style.top = `${top}px`;
    pop.style.left = `${Math.max(margen, Math.min(r.right - w, vw - w - margen))}px`;
    pop.dataset['dir'] = arriba ? 'up' : 'down';
  }

  /** Cierra los menús abiertos. Devuelve true si había alguno. */
  private cerrarMenus(): boolean {
    const abiertos = this.document.querySelectorAll<HTMLElement>('.menu-pop:popover-open');
    abiertos.forEach(m => m.hidePopover());
    return abiertos.length > 0;
  }

  /** Al desplazar una columna o la página, el menú quedaría flotando lejos de su tarjeta. */
  private readonly onScrollCerrarMenus = (e: Event) => {
    if ((e.target as HTMLElement | null)?.closest?.('.menu-pop')) return;
    this.cerrarMenus();
  };

  /** Desde el menú de la tarjeta: alternativa al arrastre para táctil y teclado. */
  hacerLider(p: Publicador, groupId: number, role: Rol, event: Event): void {
    event.stopPropagation();
    this.cerrarMenus();
    this.asignarLider(groupId, role, p);
  }

  /**
   * Cuántos mueve el menú de la tarjeta: si la tarjeta forma parte de una
   * selección de varios, el menú actúa sobre toda la selección (como el
   * arrastre); si no, solo sobre esa persona. 1 = acción individual.
   */
  cantidadMenu(p: Publicador): number {
    const sel = this.selectedPublishersIds();
    return sel.size > 1 && sel.has(p.id_publicador) ? sel.size : 1;
  }

  /** En selección múltiple se ofrecen todos los grupos salvo uno donde ya estén todos. */
  destinoDisponible(p: Publicador, groupId: number | null): boolean {
    if (this.cantidadMenu(p) === 1) return p.id_grupo_publicador !== groupId && !(groupId === null && !p.id_grupo_publicador);
    const sel = this.selectedPublishersIds();
    return this.publicadores().some(x => sel.has(x.id_publicador) && (x.id_grupo_publicador ?? null) !== groupId);
  }

  moverA(p: Publicador, groupId: number | null, event: Event): void {
    event.stopPropagation();
    this.cerrarMenus();
    const varios = this.cantidadMenu(p) > 1;
    const n = varios ? this.selectedPublishersIds().size : 1;
    if (!varios) this.selectedPublishersIds.set(new Set([p.id_publicador]));
    this.moveSelectedToGroup(groupId);
    const destino = groupId == null ? 'Sin asignar' : (this.grupos().find(g => g.id_grupo === groupId)?.nombre_grupo ?? '');
    this.mostrarAviso(varios ? `${n} publicadores movidos a ${destino}` : `${nombreMostrado(p)} movido a ${destino}`);
  }

  /** Teclado: Enter/Espacio sobre una tarjeta la selecciona, como el clic. */
  onCardKeydown(e: KeyboardEvent, p: Publicador): void {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.togglePublisherSelection(p); }
  }

  /** Cierra la pestaña o recarga con cambios sin guardar: el navegador pide confirmación. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.hayCambiosSinGuardar()) e.preventDefault();
  }

  // ── Equilibrio entre grupos ──────────────────────────────────────────────
  /** Lo justo para ver de un vistazo si un grupo quedó muy cargado o sin capitán. */
  equilibrio = computed(() => {
    const grupos = this.grupos();
    const porGrupo = new Map<number, number>();
    for (const p of this.visiblePublicadores()) {
      if (p.id_grupo_publicador != null) porGrupo.set(p.id_grupo_publicador, (porGrupo.get(p.id_grupo_publicador) ?? 0) + 1);
    }
    const barras = grupos.map(g => ({
      id: g.id_grupo,
      nombre: g.nombre_grupo,
      miembros: porGrupo.get(g.id_grupo) ?? 0,
      sinCapitan: !g.capitan_grupo && !g.id_capitan,
    }));
    const total = barras.reduce((a, b) => a + b.miembros, 0);
    const media = barras.length ? total / barras.length : 0;
    const max = Math.max(1, ...barras.map(b => b.miembros));
    return {
      barras: barras.map(b => ({
        ...b,
        alto: Math.max(8, Math.round((b.miembros / max) * 100)),
        // Fuera de ±30 % de la media se marca, sin más: es una pista, no una regla.
        desbalanceado: media > 0 && Math.abs(b.miembros - media) / media > 0.3,
      })),
      media: Math.round(media),
      mediaAlto: Math.round((media / max) * 100),
      sinCapitan: barras.filter(b => b.sinCapitan).length,
    };
  });

  tituloBarra(b: { nombre: string; miembros: number; sinCapitan: boolean; desbalanceado: boolean }): string {
    const partes = [`${b.nombre}: ${b.miembros} ${b.miembros === 1 ? 'miembro' : 'miembros'}`];
    if (b.desbalanceado) partes.push(b.miembros > this.equilibrio().media ? 'por encima de la media' : 'por debajo de la media');
    if (b.sinCapitan) partes.push('sin capitán');
    return partes.join(' · ');
  }

  // IDs de estados considerados "activos" (nombre contiene "activo" y no "inactivo")
  activeEstadoIds = computed(() => {
    const estados = this.estadosPublicador();
    return new Set(
      estados
        .filter(e => {
          const n = (e.nombre_estado || '').toLowerCase();
          return n.includes('activo') && !n.includes('inactivo');
        })
        .map(e => e.id_estado)
    );
  });

  visiblePublicadores = computed(() => {
    const list = this.publicadores();
    if (this.showInactivePublishers()) return list;
    const activeIds = this.activeEstadoIds();
    return list.filter(p => p.id_estado_publicador == null || activeIds.has(p.id_estado_publicador));
  });

  unassignedPublishers = computed(() =>
    this.visiblePublicadores().filter(p => !p.id_grupo_publicador).sort((a, b) => this.porNombreVisible(a, b))
  );


  ngAfterViewInit() {
    this.document.addEventListener('scroll', this.onScrollCerrarMenus, true);
    window.addEventListener('resize', this.onScrollCerrarMenus);
    this.updateScrollNavState();
    const el = this.scrollContainer?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateScrollNavState());
      this.resizeObserver.observe(el);
    }
  }

  async loadData() {
    try {
      const congId = this.congregacionContext.effectiveCongregacionId();

      let params = '?limit=1000';
      if (congId != null) {
        params += `&id_congregacion=${congId}`;
      }

      const [gruposData, pubsData, privilegiosData, estadosData, borradorData] = await Promise.all([
        lastValueFrom(this.http.get<Grupo[]>(`/api/grupos/${params}`)),
        lastValueFrom(this.http.get<Publicador[]>(`/api/publicadores/${params}`)),
        lastValueFrom(this.privilegiosService.getPrivilegios()),
        lastValueFrom(this.http.get<Estado[]>('/api/estados/')).catch(() => []),
        // Sin permiso de edición el servidor responde 403: se ve lo publicado y nada más.
        lastValueFrom(this.http.get<BorradorRespuesta | null>('/api/grupos/borrador', { params: this.paramsCongregacion() })).catch(() => null),
      ]);
      this.estadosPublicador.set(estadosData || []);

      let gruposFiltrados = gruposData || [];
      let publicadoresFiltrados = pubsData || [];

      // Filtrado adicional en cliente por seguridad (si el backend devolvió de más)
      if (congId) {
        gruposFiltrados = gruposFiltrados.filter(g => g.id_congregacion_grupo === congId);
        publicadoresFiltrados = publicadoresFiltrados.filter(p => p.id_congregacion_publicador === congId);
      } else {
        // En caso de estar en una vista "global" sin tener id_congregacion (raro en produccion, pero posible en dev)
        // intentamos filtrar si hay publicadores que no coincidan con los grupos visibles
        const gruposIds = new Set(gruposFiltrados.map(g => g.id_grupo));
        // Opcional: filtrar publicadores que pertenezcan a grupos que no tenemos, o dejarlos como "sin asignar"
      }

      this.gruposPublicados.set(gruposFiltrados);
      this.privilegiosCatalogo.set(privilegiosData || []);

      // Guardar estado inicial para detectar cambios
      const newInitialState = new Map<number, number | null>();
      publicadoresFiltrados.forEach(p => {
        newInitialState.set(p.id_publicador, p.id_grupo_publicador || null);
      });
      this.initialState.set(newInitialState);

      this.initialLeaderState.set(this.fotoLideres(gruposFiltrados));
      this.initialOrden.set(new Map(publicadoresFiltrados.map(p => [p.id_publicador, p.orden_en_grupo ?? null])));
      this.historial.set([]);

      // Lo de arriba es lo publicado (contra eso se marcan los cambios); el
      // tablero muestra el borrador encima, si lo hay.
      const tablero = borradorData
        ? this.aplicarBorrador(borradorData.contenido, borradorData.base, gruposFiltrados, publicadoresFiltrados)
        : { grupos: gruposFiltrados, publicadores: publicadoresFiltrados, eliminados: new Set<number>() };

      await this.loadAllPublicadorPrivilegios(publicadoresFiltrados);
      this.grupos.set(tablero.grupos);
      this.gruposEliminados.set(tablero.eliminados);
      this.publicadores.set(tablero.publicadores);
      this.borrador.set(borradorData ? this.metaBorrador(borradorData) : null);
      this.fotoGuardada.set(JSON.stringify(this.contenidoActual()));

      setTimeout(() => this.updateScrollNavState(), 120);
    } catch (err) {
      console.error('Error cargando datos', err);
      this.mostrarError('No se pudieron cargar los grupos. Recarga la página para intentarlo de nuevo.');
    }
  }

  // Cargar privilegios de todos los publicadores de forma eficiente
  async loadAllPublicadorPrivilegios(publicadores: Publicador[]) {
    try {
      const allPrivilegios = await lastValueFrom(
        this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/', { params: { limit: 500, activos: true } })
      );



      const today = new Date().toISOString().split('T')[0];
      const privilegiosMap = new Map<number, number[]>();

      for (const pp of (allPrivilegios || [])) {
        if (!pp.fecha_fin || pp.fecha_fin >= today) {
          if (!privilegiosMap.has(pp.id_publicador)) {
            privilegiosMap.set(pp.id_publicador, []);
          }
          privilegiosMap.get(pp.id_publicador)!.push(pp.id_privilegio);
        }
      }



      this.publicadorPrivilegiosMap.set(privilegiosMap);
    } catch (err) {
      console.error('❌ Error cargando privilegios de publicadores', err);
    }
  }

  // Helpers

  getGroupSearch(groupId: number): string {
    return this.groupSearchTerms()[groupId] ?? '';
  }

  setGroupSearch(groupId: number, value: string): void {
    this.groupSearchTerms.update(prev => ({ ...prev, [groupId]: value ?? '' }));
  }


  // ── Encargados ───────────────────────────────────────────────────────────

  private readonly publicadoresPorId = computed(() => new Map(this.publicadores().map(p => [p.id_publicador, p])));

  /**
   * Publicador que ocupa el rol. Manda el id; el texto solo se usa para grupos
   * antiguos que aún no tienen el vínculo (ver scripts/backfill_capitanes_grupo.py).
   */
  liderDe(grupo: Grupo, role: Rol): Publicador | null {
    const id = role === 'capitan' ? grupo.id_capitan : grupo.id_auxiliar;
    if (id) return this.publicadoresPorId().get(id) ?? null;
    const texto = role === 'capitan' ? grupo.capitan_grupo : grupo.auxiliar_grupo;
    return texto ? this.publicadoresPorNombre().get(texto.toLowerCase().trim()) ?? null : null;
  }

  tieneLider(grupo: Grupo, role: Rol): boolean {
    return role === 'capitan' ? !!(grupo.id_capitan || grupo.capitan_grupo) : !!(grupo.id_auxiliar || grupo.auxiliar_grupo);
  }

  /** Nombre para pintar: el del publicador vinculado o, si no se reconoce, el texto guardado. */
  nombreLider(grupo: Grupo, role: Rol): string {
    const p = this.liderDe(grupo, role);
    if (p) return nombreMostrado(p);
    return (role === 'capitan' ? grupo.capitan_grupo : grupo.auxiliar_grupo) ?? '';
  }

  liderTags(grupo: Grupo, role: Rol): { label: string; class: string }[] {
    const p = this.liderDe(grupo, role);
    return p ? this.getPrivilegioTags(p) : [];
  }

  private conLider(g: Grupo, role: Rol, p: Publicador | null): Grupo {
    return role === 'capitan'
      ? { ...g, id_capitan: p?.id_publicador ?? null, capitan_grupo: p ? nombreMostrado(p) : null }
      : { ...g, id_auxiliar: p?.id_publicador ?? null, auxiliar_grupo: p ? nombreMostrado(p) : null };
  }

  /**
   * Pone a `p` como capitán/auxiliar de un grupo. Para que el dato quede
   * coherente: deja de ocupar cualquier otro rol (en este u otro grupo) y pasa
   * a ser miembro de ese grupo si aún no lo era.
   */
  private asignarLider(groupId: number, role: Rol, p: Publicador): void {
    const destino = this.grupos().find(g => g.id_grupo === groupId);
    if (!destino) return;
    const actual = this.liderDe(destino, role);
    if (actual?.id_publicador === p.id_publicador) return;

    this.registrarHistorial();
    let dejoRol: string | null = null;
    this.grupos.update(list => list.map(g => {
      let r = g;
      for (const rol of ['capitan', 'auxiliar'] as Rol[]) {
        if (g.id_grupo === groupId && rol === role) continue;
        if (this.liderDe(g, rol)?.id_publicador === p.id_publicador) {
          r = this.conLider(r, rol, null);
          if (g.id_grupo !== groupId) dejoRol = `${rol === 'capitan' ? 'capitán' : 'auxiliar'} de ${g.nombre_grupo}`;
        }
      }
      return g.id_grupo === groupId ? this.conLider(r, role, p) : r;
    }));

    const cambiaDeGrupo = p.id_grupo_publicador !== groupId;
    if (cambiaDeGrupo) {
      this.publicadores.update(list => list.map(x => x.id_publicador === p.id_publicador ? { ...x, id_grupo_publicador: groupId } : x));
    }

    const rolTxt = role === 'capitan' ? 'capitán' : 'auxiliar';
    const extras: string[] = [];
    if (actual) extras.push(`reemplaza a ${nombreMostrado(actual)}`);
    if (dejoRol) extras.push(`deja de ser ${dejoRol}`);
    else if (cambiaDeGrupo) extras.push('se movió a este grupo');
    this.mostrarAviso(`${nombreMostrado(p)} es ${rolTxt} de ${destino.nombre_grupo}${extras.length ? ' · ' + extras.join(', ') : ''}`);
  }

  onDragStartLeaderCard(e: DragEvent, grupo: Grupo, role: Rol) {
    const publicador = this.liderDe(grupo, role);
    // Un encargado escrito a mano que no casa con ninguna ficha no se puede mover.
    if (!publicador) { e.preventDefault(); return; }
    this.draggedPublishers = [];
    this.draggingLeaderCard = { fromGroupId: grupo.id_grupo, fromRole: role, publicador };
    this.isDraggingContent.set(true);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'leader-card');
    }
  }

  /** Encargado soltado en la lista de un grupo (o en Sin asignar): deja el rol y queda como publicador ahí. */
  private liderAPublicador(fromGroupId: number, fromRole: Rol, p: Publicador, targetGroupId: number | null): void {
    this.registrarHistorial();
    this.grupos.update(list => list.map(g => g.id_grupo === fromGroupId ? this.conLider(g, fromRole, null) : g));
    this.publicadores.update(list => list.map(x => x.id_publicador === p.id_publicador ? { ...x, id_grupo_publicador: targetGroupId } : x));
    const desde = this.grupos().find(g => g.id_grupo === fromGroupId)?.nombre_grupo ?? '';
    const hacia = targetGroupId == null ? 'Sin asignar' : (this.grupos().find(g => g.id_grupo === targetGroupId)?.nombre_grupo ?? '');
    this.mostrarAviso(`${nombreMostrado(p)} ya no es ${fromRole === 'capitan' ? 'capitán' : 'auxiliar'} de ${desde} · queda en ${hacia}`);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Edición inline del nombre del grupo ──────────────────────────────────
  editingGroupId = signal<number | null>(null);
  editingGroupName = signal<string>('');
  isSavingGroupName = signal(false);

  startEditGroupName(grupo: Grupo, event: Event) {
    event.stopPropagation();
    this.editingGroupId.set(grupo.id_grupo);
    this.editingGroupName.set(grupo.nombre_grupo);
    // Espera un tick para que el input esté en el DOM
    setTimeout(() => {
      const el = document.getElementById(`group-name-input-${grupo.id_grupo}`) as HTMLInputElement | null;
      if (el) { el.focus(); el.select(); }
    }, 50);
  }

  cancelEditGroupName() {
    this.editingGroupId.set(null);
    this.editingGroupName.set('');
  }

  /** Solo en el borrador: el nombre cambia en la congregación al publicar. */
  saveGroupName(grupo: Grupo) {
    const newName = this.editingGroupName().trim().slice(0, 200);
    if (!newName || newName === grupo.nombre_grupo) {
      this.cancelEditGroupName();
      return;
    }
    const repetido = this.grupos().some(g => g.id_grupo !== grupo.id_grupo && g.nombre_grupo.trim().toLowerCase() === newName.toLowerCase());
    if (repetido) {
      this.mostrarError(`Ya hay un grupo llamado "${newName}".`);
      return;
    }
    this.registrarHistorial();
    this.grupos.update(list =>
      list.map(g => g.id_grupo === grupo.id_grupo ? { ...g, nombre_grupo: newName } : g)
    );
    this.cancelEditGroupName();
  }

  onGroupNameKeydown(event: KeyboardEvent, grupo: Grupo) {
    if (event.key === 'Enter') { event.preventDefault(); this.saveGroupName(grupo); }
    if (event.key === 'Escape') { event.preventDefault(); this.cancelEditGroupName(); }
  }
  // ─────────────────────────────────────────────────────────────────────────

  isDraggingOverRole(groupId: number, role: 'capitan' | 'auxiliar'): boolean {
    const d = this.isDraggingOverLeader();
    return d?.groupId === groupId && d?.role === role;
  }

  /** True si el publicador es el capitán o auxiliar de este grupo (evita duplicado en lista). */
  isPublicadorLeaderInGroup(p: Publicador, group: Grupo): boolean {
    return this.liderDe(group, 'capitan')?.id_publicador === p.id_publicador
      || this.liderDe(group, 'auxiliar')?.id_publicador === p.id_publicador;
  }

  /**
   * Miembros por grupo, ya ordenados y sin lideres, calculados de una sola vez.
   *
   * La plantilla llama a estos helpers desde un *ngFor anidado dentro del
   * *ngFor de grupos, asi que antes cada ciclo de deteccion de cambios repetia
   * un filter+sort de la lista completa de publicadores por cada grupo. Al
   * derivarlo con computed solo se recalcula cuando cambian los publicadores
   * visibles o los grupos.
   */
  private readonly miembrosSinLideresPorGrupo = computed(() => {
    const porGrupo = new Map<number, Publicador[]>();
    for (const p of this.visiblePublicadores()) {
      const id = p.id_grupo_publicador;
      if (id == null) continue;
      const lista = porGrupo.get(id);
      if (lista) lista.push(p); else porGrupo.set(id, [p]);
    }

    const resultado = new Map<number, Publicador[]>();
    for (const group of this.grupos()) {
      const miembros = (porGrupo.get(group.id_grupo) ?? [])
        .sort((a, b) => {
          const oa = a.orden_en_grupo ?? 999999;
          const ob = b.orden_en_grupo ?? 999999;
          if (oa !== ob) return oa - ob;
          return this.porNombreVisible(a, b);
        })
        .filter(p => !this.isPublicadorLeaderInGroup(p, group));
      resultado.set(group.id_grupo, miembros);
    }
    return resultado;
  });

  /** Los mismos miembros, ya aplicado el buscador propio de cada tarjeta. */
  private readonly miembrosFiltradosPorGrupo = computed(() => {
    const terminos = this.groupSearchTerms();
    const resultado = new Map<number, Publicador[]>();
    for (const [groupId, miembros] of this.miembrosSinLideresPorGrupo()) {
      const term = (terminos[groupId] ?? '').trim().toLowerCase();
      resultado.set(groupId, !term ? miembros : miembros.filter(p => {
        // Encuentra tanto por el nombre que se ve en la tarjeta como por el
        // de la ficha: quien busca "Juan Pérez" no tiene por qué saber que
        // aquí sale "Juanca".
        const full = (nombreMostrado(p) + ' ' + nombreLegal(p)).toLowerCase();
        return full.includes(term);
      }));
    }
    return resultado;
  });

  /** Miembros del grupo excluyendo capitán y auxiliar (solo para mostrar en la lista de cards). */
  getGroupMembersExcludingLeaders(groupId: number): Publicador[] {
    return this.miembrosSinLideresPorGrupo().get(groupId) ?? [];
  }

  /** Miembros del grupo (sin líderes) filtrados por el término de búsqueda de esa card. */
  getFilteredGroupMembers(groupId: number): Publicador[] {
    return this.miembrosFiltradosPorGrupo().get(groupId) ?? [];
  }

  cardClass(p: Publicador): string {
    if (this.isSelected(p.id_publicador)) return 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/40 shadow-sm cursor-pointer z-10';
    if (this.isInactivePublisher(p)) return 'bg-red-50/60 dark:bg-red-500/5 border-red-200/70 dark:border-red-500/20 cursor-grab';
    return 'bg-white dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 cursor-grab';
  }

  isModified(p: Publicador): boolean {
    const original = this.initialState().get(p.id_publicador);
    const current = p.id_grupo_publicador || null;
    return original !== current;
  }

  /** True si el publicador tiene estado y no es "activo" (p. ej. Inactivo). */
  isInactivePublisher(p: Publicador): boolean {
    if (p.id_estado_publicador == null) return false;
    return !this.activeEstadoIds().has(p.id_estado_publicador);
  }


  // Obtener tags de privilegios para mostrar en la tarjeta del publicador
  /**
   * Orden alfabético por el nombre que se ve en pantalla (alias si lo hay), sin
   * distinguir mayúsculas ni tildes. Así una tarjeta nunca parece fuera de lugar.
   */
  private porNombreVisible(a: Publicador, b: Publicador): number {
    return nombreMostrado(a).localeCompare(nombreMostrado(b), 'es', { sensitivity: 'base' })
      || a.id_publicador - b.id_publicador;
  }

  /**
   * Etiquetas ya calculadas por publicador. La plantilla las pide varias veces
   * por fila (capitan, auxiliar y cada miembro) en cada ciclo de deteccion de
   * cambios, y antes cada llamada reconstruia el objeto de configuracion y
   * recorria el catalogo con .find() por cada privilegio.
   */
  private readonly etiquetasPorPublicador = computed(() => {
    const privilegiosMap = this.publicadorPrivilegiosMap();
    const catalogo = this.privilegiosCatalogo();
    const porId = new Map<number, { label: string; class: string }[]>();
    const nombrePorId = new Map<number, string>();
    for (const pr of catalogo) {
      nombrePorId.set(pr.id_privilegio, (pr.nombre_privilegio || '').toLowerCase().trim());
    }
    const entradasConfig = Object.entries(PRIVILEGIO_CONFIG);
    for (const [idPublicador, privilegiosIds] of privilegiosMap) {
      const tags: { label: string; class: string }[] = [];
      for (const idPrivilegio of privilegiosIds) {
        const nombreLower = nombrePorId.get(idPrivilegio);
        if (!nombreLower) continue;
        for (const [key, config] of entradasConfig) {
          if (nombreLower.includes(key)) {
            tags.push(config);
            break;
          }
        }
      }
      porId.set(idPublicador, tags);
    }
    return porId;
  });

  getPrivilegioTags(p: Publicador): { label: string; class: string }[] {
    return this.etiquetasPorPublicador().get(p.id_publicador) ?? [];
  }


  /**
   * Indice nombre-escrito -> publicador, con las cuatro variantes de nombre que
   * ya se comparaban antes. La plantilla busca al capitan y al auxiliar de cada
   * grupo por su nombre, y sin indice cada busqueda recorria linealmente la
   * lista completa de publicadores, cuatro veces por fila y por ciclo.
   */
  private readonly publicadoresPorNombre = computed(() => {
    const indice = new Map<string, Publicador>();
    for (const p of this.publicadores()) {
      const variantes = [
        `${p.primer_nombre} ${p.primer_apellido} `,
        `${p.primer_nombre} ${p.segundo_nombre || ''} ${p.primer_apellido} `.replace(/\s+/g, ' '),
        `${p.primer_nombre} ${p.primer_apellido} ${p.segundo_apellido || ''} `.replace(/\s+/g, ' '),
        `${p.primer_nombre} ${p.segundo_nombre || ''} ${p.primer_apellido} ${p.segundo_apellido || ''} `.replace(/\s+/g, ' '),
        // El alias y el nombre mostrado: si a alguien se le nombró capitán
        // desde una pantalla que ya mostraba su alias, esa es la cadena que
        // quedó escrita y ninguna variante de los cuatro campos la encontraría.
        nombreMostrado(p),
        p.nombre_visible ?? ''
      ].filter(Boolean).map(n => n.toLowerCase().trim());
      // El primero que registra cada variante gana, igual que hacia el .find().
      for (const v of variantes) {
        if (!indice.has(v)) indice.set(v, p);
      }
    }
    return indice;
  });


  goBack() {
    this.performExit();
  }

  /** Resolución pendiente del modal "¿Salir sin guardar?" mientras el guard espera. */
  private resolverSalida: ((salir: boolean) => void) | null = null;

  /**
   * Lo llama el canDeactivate de la ruta, así cubre también el menú lateral y
   * no solo el botón Volver.
   */
  puedeSalir(): boolean | Promise<boolean> {
    if (!this.hayCambiosSinGuardar()) return true;
    this.showExitConfirmation.set(true);
    return new Promise<boolean>(resolve => { this.resolverSalida = resolve; });
  }

  confirmExit() {
    this.showExitConfirmation.set(false);
    this.resolverSalida?.(true);
    this.resolverSalida = null;
  }

  cancelExit() {
    this.showExitConfirmation.set(false);
    this.resolverSalida?.(false);
    this.resolverSalida = null;
  }

  private performExit() {
    this.router.navigate(['/secretario/publicadores'], { queryParams: { tab: 'grupos' } });
  }

  toggleSelectAll(groupId: number | 'unassigned') {
    const currentSelected = this.selectedPublishersIds();
    let targets: number[] = [];

    if (groupId === 'unassigned') {
      targets = this.unassignedPublishers().map(p => p.id_publicador);
    } else {
      targets = this.getGroupMembersExcludingLeaders(groupId).map(p => p.id_publicador);
    }

    // Check if ALL targets are currently selected
    const allSelected = targets.length > 0 && targets.every(id => currentSelected.has(id));

    // Clear everything first (single source selection model)
    const newSelected = new Set<number>();

    if (!allSelected) {
      targets.forEach(id => newSelected.add(id));
    }

    this.selectedPublishersIds.set(newSelected);
  }

  clearSelection() {
    this.selectedPublishersIds.set(new Set());
  }

  isSelected(id: number): boolean {
    return this.selectedPublishersIds().has(id);
  }

  togglePublisherSelection(p: Publicador, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const current = new Set(this.selectedPublishersIds());
    if (current.has(p.id_publicador)) {
      current.delete(p.id_publicador);
    } else {
      current.add(p.id_publicador);
    }
    this.selectedPublishersIds.set(current);
  }

  moveSelectedToGroup(targetGroupId: number | null) {
    const selectedIds = this.selectedPublishersIds();
    if (selectedIds.size === 0) return;
    if (!this.publicadores().some(p => selectedIds.has(p.id_publicador) && p.id_grupo_publicador !== targetGroupId)) {
      this.selectedPublishersIds.set(new Set());
      return;
    }
    this.registrarHistorial();

    this.publicadores.update(current => {
      return current.map(p => {
        if (selectedIds.has(p.id_publicador)) {
          if (p.id_grupo_publicador !== targetGroupId) {
            return { ...p, id_grupo_publicador: targetGroupId };
          }
        }
        return p;
      });
    });

    // Clear selection after move
    this.selectedPublishersIds.set(new Set());
  }

  // Drag & Drop Logic
  onDragStart(e: DragEvent, p: Publicador, sourceGroupId?: number | null, sourceIndex?: number) {
    let items: Publicador[] = [];

    if (this.isSelected(p.id_publicador)) {
      const ids = this.selectedPublishersIds();
      items = this.publicadores().filter(pub => ids.has(pub.id_publicador));
    } else {
      this.selectedPublishersIds.set(new Set());
      items = [p];
    }

    this.draggedPublishers = items;
    this.dragSourceGroupId.set(sourceGroupId ?? null);
    this.dragSourceIndex.set(sourceIndex ?? null);

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(items.map(i => i.id_publicador)));
    }
    this.isDraggingContent.set(true);
  }

  /** Drop sobre una tarjeta de publicador: reordenar dentro del mismo grupo. */
  onDropOnPublisherCard(e: DragEvent, groupId: number, targetIndex: number) {
    this.isDraggingOver.set(null);
    if (this.draggedPublishers.length === 0) return;
    const sourceGroupId = this.dragSourceGroupId();
    const items = this.draggedPublishers;

    // Reordenar dentro del mismo grupo (un solo publicador)
    if (sourceGroupId === groupId && items.length === 1) {
      e.preventDefault();
      e.stopPropagation();
      const members = this.getGroupMembersExcludingLeaders(groupId);
      const filtered = this.getFilteredGroupMembers(groupId);
      const sourceIdx = members.findIndex(m => m.id_publicador === items[0].id_publicador);
      if (sourceIdx === -1) return;
      // targetIndex es el índice en la lista filtrada; mapear a posición en lista completa
      const targetMember = filtered[targetIndex];
      const insertAtInFull = targetMember
        ? members.findIndex(m => m.id_publicador === targetMember.id_publicador)
        : members.length;
      const reordered = [...members];
      const [removed] = reordered.splice(sourceIdx, 1);
      let insertAt = insertAtInFull >= 0 ? insertAtInFull : members.length;
      if (insertAt > sourceIdx) insertAt--;
      reordered.splice(insertAt, 0, removed);

      const idOrder = reordered.map(m => m.id_publicador);
      if (idOrder.every((id, i) => members[i]?.id_publicador === id)) return;
      this.registrarHistorial();
      this.publicadores.update(list =>
        list.map(p => {
          const pos = idOrder.indexOf(p.id_publicador);
          if (pos === -1) return p;
          return { ...p, orden_en_grupo: pos };
        })
      );
      this.draggedPublishers = [];
      this.dragSourceGroupId.set(null);
      this.dragSourceIndex.set(null);
      this.isDraggingContent.set(false);
      return;
    }

    // Mover entre grupos: dejar que el drop en la columna lo maneje (no hacer nada aquí para no duplicar)
  }

  onDragOver(e: DragEvent, targetId: number | 'unassigned') {
    e.preventDefault();
    // Cancelar cualquier timer de dragleave pendiente para evitar parpadeo al pasar sobre hijos
    if (this.dragOverTimer) { clearTimeout(this.dragOverTimer); this.dragOverTimer = null; }
    // Si se está reordenando una columna, gestionar ese estado
    if (this.draggingColumnId()) {
      if (this.columnDragLeaveTimer) {
        clearTimeout(this.columnDragLeaveTimer);
        this.columnDragLeaveTimer = null;
      }
      if (targetId !== 'unassigned' && targetId !== this.draggingColumnId()) {
        this.dragOverColumnId.set(targetId as number);
      }
      return;
    }
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    this.isDraggingOver.set(targetId);
  }

  onDragLeave() {
    // Debounce para evitar parpadeo cuando el cursor entra en un elemento hijo de la columna
    if (this.dragOverTimer) clearTimeout(this.dragOverTimer);
    this.dragOverTimer = setTimeout(() => {
      this.isDraggingOver.set(null);
      this.dragOverTimer = null;
    }, 60);

    if (this.draggingColumnId()) {
      if (this.columnDragLeaveTimer) clearTimeout(this.columnDragLeaveTimer);
      this.columnDragLeaveTimer = setTimeout(() => {
        this.dragOverColumnId.set(null);
        this.columnDragLeaveTimer = null;
      }, 80);
    } else {
      this.dragOverColumnId.set(null);
    }
  }

  onDrop(e: DragEvent, targetGroupId: number | null) {
    e.preventDefault();
    this.isDraggingOver.set(null);

    // Si se está reordenando una columna
    if (this.draggingColumnId()) {
      this.onColumnDrop(e, targetGroupId as number);
      return;
    }

    // Si se arrastra una tarjeta de encargado hacia la zona de publicadores
    if (this.draggingLeaderCard) {
      const { fromGroupId, fromRole, publicador } = this.draggingLeaderCard;
      this.draggingLeaderCard = null;
      this.isDraggingContent.set(false);
      this.liderAPublicador(fromGroupId, fromRole, publicador, targetGroupId);
      return;
    }

    if (this.draggedPublishers.length === 0) return;

    const items = this.draggedPublishers;
    this.draggedPublishers = [];
    this.selectedPublishersIds.set(new Set()); // Clear selection

    const idsToMove = new Set(items.map(p => p.id_publicador));
    if (!items.some(p => p.id_grupo_publicador !== targetGroupId)) return;
    this.registrarHistorial();

    this.publicadores.update(current => {
      return current.map(p => {
        if (idsToMove.has(p.id_publicador)) {
          if (p.id_grupo_publicador !== targetGroupId) {
            return { ...p, id_grupo_publicador: targetGroupId };
          }
        }
        return p;
      });
    });
  }

  // --- Leader Drag & Drop ---

  onDragOverLeader(e: DragEvent, groupId: number, role: 'capitan' | 'auxiliar') {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    this.isDraggingOverLeader.set({ groupId, role });
    this.isDraggingOver.set(null);
  }

  onDragLeaveLeader() {
    this.isDraggingOverLeader.set(null);
  }

  onDropLeader(e: DragEvent, groupId: number, role: 'capitan' | 'auxiliar') {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingOverLeader.set(null);

    // Tarjeta de encargado (otro rol u otro grupo) o un publicador de cualquier lista.
    let p: Publicador | null = null;
    if (this.draggingLeaderCard) {
      p = this.draggingLeaderCard.publicador;
      this.draggingLeaderCard = null;
      this.isDraggingContent.set(false);
    } else if (this.draggedPublishers.length === 1) {
      p = this.draggedPublishers[0];
      this.draggedPublishers = [];
    } else if (this.draggedPublishers.length > 1) {
      this.mostrarAviso('Suelta a una sola persona en el puesto de encargado');
      return;
    }
    if (p) this.asignarLider(groupId, role, p);
  }

  /** Quitar es reversible (Deshacer y nada se guarda hasta Guardar), así que no pide confirmación. */
  removeLeader(groupId: number, role: Rol) {
    const g = this.grupos().find(x => x.id_grupo === groupId);
    if (!g || !this.tieneLider(g, role)) return;
    const nombre = this.nombreLider(g, role);
    this.registrarHistorial();
    this.grupos.update(list => list.map(x => x.id_grupo === groupId ? this.conLider(x, role, null) : x));
    this.mostrarAviso(`${nombre} ya no es ${role === 'capitan' ? 'capitán' : 'auxiliar'} de ${g.nombre_grupo}`);
  }

  private fotoLideres(grupos: Grupo[]): Map<number, LideresIniciales> {
    return new Map(grupos.map(g => [g.id_grupo, {
      capitan: g.capitan_grupo, auxiliar: g.auxiliar_grupo, id_capitan: g.id_capitan, id_auxiliar: g.id_auxiliar,
    }]));
  }

  isLeaderModified(groupId: number, role: Rol): boolean {
    const group = this.grupos().find(g => g.id_grupo === groupId);
    const initial = this.initialLeaderState().get(groupId);
    if (!group || !initial) return false;

    if (role === 'capitan') {
      return (group.id_capitan ?? null) !== (initial.id_capitan ?? null) || (group.capitan_grupo || '') !== (initial.capitan || '');
    }
    return (group.id_auxiliar ?? null) !== (initial.id_auxiliar ?? null) || (group.auxiliar_grupo || '') !== (initial.auxiliar || '');
  }

  /**
   * Miembros y precursores por grupo en una pasada. La plantilla los pide
   * varias veces por columna en cada ciclo; antes cada llamada filtraba y
   * ordenaba la lista completa de publicadores.
   */
  private readonly resumenPorGrupo = computed(() => {
    const catalogo = this.privilegiosCatalogo();
    const privs = this.publicadorPrivilegiosMap();
    const esPrecursor = new Set(catalogo.filter(pr => (pr.nombre_privilegio || '').toLowerCase().includes('precursor')).map(pr => pr.id_privilegio));
    const res = new Map<number, { miembros: number; precursores: number }>();
    for (const p of this.visiblePublicadores()) {
      const id = p.id_grupo_publicador;
      if (id == null) continue;
      const r = res.get(id) ?? { miembros: 0, precursores: 0 };
      r.miembros++;
      if ((privs.get(p.id_publicador) ?? []).some(x => esPrecursor.has(x))) r.precursores++;
      res.set(id, r);
    }
    return res;
  });

  miembrosCount(groupId: number): number {
    return this.resumenPorGrupo().get(groupId)?.miembros ?? 0;
  }

  getPrecursoresCount(groupId: number): number {
    return this.resumenPorGrupo().get(groupId)?.precursores ?? 0;
  }

  // ── Alta de publicador sin salir de la pantalla ──────────────────────────
  // Mismo asistente que la pantalla de Publicadores. El publicador se crea al
  // momento en la congregación (es un registro real, no puede vivir en el
  // borrador) y SIN grupo; el grupo elegido se pone en el tablero como un
  // movimiento más del borrador, que se aplica al publicar como el resto.

  /** Igual que el backend (POST /publicadores): estos roles o el permiso 'publicadores.editar'. */
  puedeCrearPublicadores = computed(() => {
    const user = this.authStore.user();
    const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
    const porRol = roles.some(r => ['administrador', 'secretario'].includes(r));
    return porRol || this.authStore.hasPermission('publicadores.editar');
  });

  wizardAbierto = signal(false);
  creandoPublicador = signal(false);

  /** Los grupos del tablero, también los nuevos del borrador. */
  gruposWizard = computed<WizardGrupo[]>(() =>
    this.grupos().map(g => ({
      id_grupo: g.id_grupo,
      nombre_grupo: g.nombre_grupo,
      capitan_grupo: this.tieneLider(g, 'capitan') ? this.nombreLider(g, 'capitan') : undefined,
    }))
  );

  /** Mismos privilegios que ofrece el alta en Publicadores (sin los de logística). */
  privilegiosWizard = computed(() => {
    const excluidos = ['audio', 'vigilancia', 'acomodador', 'video', 'micrófono', 'microfono', 'plataforma'];
    return this.privilegiosCatalogo().filter(p => !excluidos.includes((p.nombre_privilegio || '').toLowerCase()));
  });

  estadoActivoId = computed(() =>
    this.estadosPublicador().find(e => (e.nombre_estado || '').toLowerCase() === 'activo')?.id_estado
    ?? [...this.activeEstadoIds()][0] ?? null
  );

  abrirNuevoPublicador(): void {
    if (!this.puedeCrearPublicadores()) return;
    this.wizardAbierto.set(true);
  }

  async onPublicadorCreado(result: NuevoPublicadorResult): Promise<void> {
    if (this.creandoPublicador()) return;
    const idCongregacion = this.congregacionContext.effectiveCongregacionId();
    if (idCongregacion == null) {
      this.mostrarError('Selecciona una congregación en la barra superior.');
      return;
    }
    const grupoElegido = (result.publicador['id_grupo_publicador'] as number | null) ?? null;

    this.creandoPublicador.set(true);
    try {
      const creado = await lastValueFrom(this.http.post<Publicador>('/api/publicadores/', {
        ...result.publicador,
        id_congregacion_publicador: idCongregacion,
        id_grupo_publicador: null,
      }));
      this.wizardAbierto.set(false);

      let fallidos = 0;
      for (const priv of result.privilegios) {
        try {
          await lastValueFrom(this.privilegiosService.createPublicadorPrivilegio({ id_publicador: creado.id_publicador, ...priv }));
        } catch { fallidos++; }
      }

      // Entra como está publicado (sin grupo): no es un cambio del borrador.
      this.initialState.update(m => new Map(m).set(creado.id_publicador, null));
      this.initialOrden.update(m => new Map(m).set(creado.id_publicador, null));
      const nuevo: Publicador = { ...creado, id_grupo_publicador: null, orden_en_grupo: null };
      this.publicadores.update(list => [...list, nuevo]);
      // La foto guardada lo incluye tal cual, para no marcar "sin guardar" por existir.
      try {
        const foto = JSON.parse(this.fotoGuardada()) as ContenidoBorrador;
        foto.publicadores[creado.id_publicador] = { id_grupo: null, orden: null };
        this.fotoGuardada.set(JSON.stringify(foto));
      } catch { /* sin foto previa: quedará como cambio sin guardar, que es inofensivo */ }
      if (result.privilegios.length) await this.loadAllPublicadorPrivilegios(this.publicadores());

      const nombre = nombreMostrado(creado);
      const destino = grupoElegido != null ? this.grupos().find(g => g.id_grupo === grupoElegido) : undefined;
      if (destino) {
        this.registrarHistorial();
        this.publicadores.update(list => list.map(x => x.id_publicador === creado.id_publicador ? { ...x, id_grupo_publicador: destino.id_grupo } : x));
        this.mostrarAviso(`${nombre} se creó y quedó en ${destino.nombre_grupo} en el borrador · se asigna al publicar`);
        const idx = this.grupos().findIndex(g => g.id_grupo === destino.id_grupo);
        setTimeout(() => this.scrollToColumn(idx + 1), 60);
      } else {
        this.mostrarAviso(`${nombre} se creó y está en Sin asignar`);
        setTimeout(() => this.scrollToColumn(0), 60);
      }
      if (fallidos > 0) {
        this.mostrarError(`${nombre} se creó, pero no se ${fallidos === 1 ? 'pudo registrar un privilegio' : 'pudieron registrar los privilegios'}. Añádelo desde su ficha.`);
      }
    } catch (err) {
      this.mostrarError(this.detalleError(err, 'No se pudo crear el publicador.'));
    } finally {
      this.creandoPublicador.set(false);
    }
  }

  // ── Borrador: guardar, publicar, descartar ───────────────────────────────

  private paramsCongregacion(): Record<string, number> {
    const id = this.congregacionContext.effectiveCongregacionId();
    return id != null ? { id_congregacion: id } : {};
  }

  private metaBorrador(r: BorradorRespuesta): BorradorMeta {
    return { version: r.version, actualizado_por: r.actualizado_por, fecha_actualizacion: r.fecha_actualizacion };
  }

  /** Mensaje del backend (`detail`) o el de respaldo. */
  private detalleError(err: unknown, respaldo: string): string {
    const d = (err as { error?: { detail?: unknown } })?.error?.detail;
    return typeof d === 'string' ? d : respaldo;
  }

  /**
   * Pone el borrador encima de lo publicado, pero solo lo que el borrador
   * cambió respecto a su base. Lo demás se queda como está publicado hoy: si
   * alguien cambió algo por fuera (ficha, pestaña Grupos, detalle del grupo), el
   * valor viejo que guarda el borrador no debe volver a verse ni a contarse.
   */
  private aplicarBorrador(c: ContenidoBorrador, base: ContenidoBorrador, grupos: Grupo[], pubs: Publicador[]) {
    const porId = new Map(pubs.map(p => [p.id_publicador, p]));
    const nombreDe = (id: number | null) => {
      const p = id != null ? porId.get(id) : undefined;
      return p ? nombreMostrado(p) : null;
    };
    // Encargado propuesto que ya no está (eliminado o trasladado): vacante.
    const vigente = (id: number | null) => (id != null && porId.has(id) ? id : null);
    const baseGrupos = new Map(base.grupos.map(x => [x.id_grupo, x]));
    const conDatos = (g: Grupo, dOriginal: GrupoEnBorrador): Grupo => {
      const b = baseGrupos.get(dOriginal.id_grupo);
      // Un campo que el borrador no cambió respecto a su base toma el valor vivo.
      const cap = b && dOriginal.id_capitan === b.id_capitan ? (g.id_capitan ?? null) : vigente(dOriginal.id_capitan);
      const aux = b && dOriginal.id_auxiliar === b.id_auxiliar ? (g.id_auxiliar ?? null) : vigente(dOriginal.id_auxiliar);
      const nombre = b && dOriginal.nombre_grupo === b.nombre_grupo ? g.nombre_grupo : dOriginal.nombre_grupo;
      const d = { ...dOriginal, nombre_grupo: nombre, id_capitan: cap, id_auxiliar: aux };
      return {
      ...g,
      nombre_grupo: d.nombre_grupo,
      id_capitan: d.id_capitan,
      id_auxiliar: d.id_auxiliar,
      // El texto solo se rehace si el encargado cambió: un capitán antiguo
      // guardado solo como texto (sin id) no debe perderse.
      capitan_grupo: d.id_capitan !== (g.id_capitan ?? null) ? nombreDe(d.id_capitan) : g.capitan_grupo,
      auxiliar_grupo: d.id_auxiliar !== (g.id_auxiliar ?? null) ? nombreDe(d.id_auxiliar) : g.auxiliar_grupo,
      };
    };

    const enBorrador = new Map(c.grupos.map(g => [g.id_grupo, g]));
    const vivos = new Set(grupos.map(g => g.id_grupo));
    const eliminados = new Set<number>();
    const resultado: Grupo[] = [];
    for (const g of grupos) {
      const d = enBorrador.get(g.id_grupo);
      if (!d) resultado.push(g);
      else if (d.eliminado) eliminados.add(g.id_grupo);
      else resultado.push(conDatos(g, d));
    }
    // Grupos nuevos del borrador, y los que alguien eliminó por fuera mientras
    // el borrador aún los usa (al publicar se avisa).
    for (const d of c.grupos) {
      if (d.eliminado || vivos.has(d.id_grupo)) continue;
      resultado.push(conDatos({ id_grupo: d.id_grupo, nombre_grupo: d.nombre_grupo }, d));
    }
    this.siguienteIdTemporal = Math.min(0, ...c.grupos.map(g => g.id_grupo)) - 1;

    const publicadores = pubs.map(p => {
      const d = c.publicadores[p.id_publicador];
      if (!d) return p;
      const b = base.publicadores[p.id_publicador];
      // Grupo y orden por separado: solo se aplica lo que el borrador movió.
      const grupoCambiado = !b || d.id_grupo !== b.id_grupo;
      const ordenCambiado = !b || d.orden !== b.orden;
      return {
        ...p,
        id_grupo_publicador: grupoCambiado ? d.id_grupo : p.id_grupo_publicador,
        orden_en_grupo: ordenCambiado && !(grupoCambiado === false && d.id_grupo !== p.id_grupo_publicador) ? d.orden : p.orden_en_grupo,
      };
    });
    return { grupos: resultado, publicadores, eliminados };
  }

  /** Guarda el tablero como borrador. No toca la congregación. */
  async guardarBorrador(): Promise<boolean> {
    if (this.isSaving()) return false;
    const contenido = this.contenidoActual();
    this.isSaving.set(true);
    this.errorMsg.set(null);
    try {
      const r = await lastValueFrom(this.http.put<BorradorRespuesta>(
        '/api/grupos/borrador',
        { contenido, version: this.borrador()?.version ?? null },
        { params: this.paramsCongregacion() },
      ));
      this.borrador.set(this.metaBorrador(r));
      this.fotoGuardada.set(JSON.stringify(contenido));
      return true;
    } catch (err) {
      const conflicto = (err as { status?: number })?.status === 409;
      this.mostrarError(this.detalleError(err, 'No se pudo guardar el borrador.'), conflicto);
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }

  async onGuardarBorrador() {
    if (await this.guardarBorrador()) {
      this.mostrarExito('Borrador guardado', 'La congregación no cambia hasta que publiques.');
    }
  }

  // Modal de publicar
  publicarAbierto = signal(false);
  conflictos = signal<ConflictoBorrador[]>([]);
  /** Claves de conflicto en las que se mantiene lo que ya está publicado. */
  conservarVivo = signal<ReadonlySet<string>>(new Set());
  cargandoConflictos = signal(false);
  isPublishing = signal(false);
  hayBloqueantes = computed(() => this.conflictos().some(c => c.bloqueante));

  /** Resumen para el modal de publicar, contado contra lo publicado. */
  resumenPublicacion = computed(() => {
    const inicial = this.initialState();
    let movidos = 0;
    for (const p of this.publicadores()) {
      if (inicial.get(p.id_publicador) !== (p.id_grupo_publicador || null)) movidos++;
    }
    let encargados = 0;
    for (const g of this.grupos()) {
      if (this.isLeaderModified(g.id_grupo, 'capitan')) encargados++;
      if (this.isLeaderModified(g.id_grupo, 'auxiliar')) encargados++;
    }
    return { movidos, encargados, orden: this.gruposConOrdenPendiente().size, ...this.resumenEstructura() };
  });

  /** Publicar guarda antes lo pendiente: lo que se publica es siempre el borrador del servidor. */
  async abrirPublicar() {
    if (this.hayCambiosSinGuardar() && !(await this.guardarBorrador())) return;
    if (!this.borrador()) return;
    this.conservarVivo.set(new Set());
    this.conflictos.set([]);
    this.publicarAbierto.set(true);
    this.cargandoConflictos.set(true);
    try {
      const lista = await lastValueFrom(this.http.get<ConflictoBorrador[]>(
        '/api/grupos/borrador/conflictos', { params: this.paramsCongregacion() }));
      this.conflictos.set(lista ?? []);
    } catch {
      this.publicarAbierto.set(false);
      this.mostrarError('No se pudo revisar si hubo cambios por fuera del borrador. Inténtalo de nuevo.');
    } finally {
      this.cargandoConflictos.set(false);
    }
  }

  cerrarPublicar() {
    if (this.isPublishing()) return;
    this.publicarAbierto.set(false);
  }

  elegirEnConflicto(clave: string, conservarActual: boolean) {
    this.conservarVivo.update(s => {
      const n = new Set(s);
      if (conservarActual) n.add(clave); else n.delete(clave);
      return n;
    });
  }

  async publicar() {
    const b = this.borrador();
    if (!b || this.isPublishing() || this.hayBloqueantes()) return;
    this.isPublishing.set(true);
    try {
      await lastValueFrom(this.http.post(
        '/api/grupos/borrador/publicar',
        { version: b.version, conservar_vivo: [...this.conservarVivo()] },
        { params: this.paramsCongregacion() },
      ));
      this.publicarAbierto.set(false);
      await this.loadData();
      this.mostrarExito('Grupos publicados', 'La congregación ya tiene la nueva asignación.');
    } catch (err) {
      const conflicto = (err as { status?: number })?.status === 409;
      this.mostrarError(this.detalleError(err, 'No se pudo publicar el borrador. No se aplicó ningún cambio.'), conflicto);
    } finally {
      this.isPublishing.set(false);
    }
  }

  // Descartar
  descartarAbierto = signal(false);
  /** Panel con el detalle del borrador, abierto desde la pastilla de la cabecera. */
  borradorInfoAbierto = signal(false);
  isDiscarding = signal(false);

  async confirmarDescartar() {
    if (this.isDiscarding()) return;
    this.isDiscarding.set(true);
    try {
      if (this.borrador()) {
        await lastValueFrom(this.http.delete('/api/grupos/borrador', { params: this.paramsCongregacion() }));
      }
      this.descartarAbierto.set(false);
      await this.loadData();
      this.mostrarExito('Borrador descartado', 'El tablero vuelve a mostrar lo publicado.');
    } catch (err) {
      this.mostrarError(this.detalleError(err, 'No se pudo descartar el borrador.'));
    } finally {
      this.isDiscarding.set(false);
    }
  }

  /** "hace 5 min", "ayer 18:40"… para la franja del borrador. */
  haceCuanto(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const t = new Date(fecha.endsWith('Z') || fecha.includes('+') ? fecha : fecha + 'Z').getTime();
    const min = Math.round((Date.now() - t) / 60000);
    if (!isFinite(min)) return '';
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    return new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }
}

import { Component, computed, inject, OnInit, OnDestroy, AfterViewInit, signal, Renderer2, ViewChild, ElementRef, NgZone, effect } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { lastValueFrom, forkJoin } from 'rxjs';
import { PrivilegiosService } from '../../privilegios/infrastructure/privilegios.service';
import { GruposService } from '../services/grupos.service';
import { Privilegio } from '../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../privilegios/domain/models/publicador-privilegio';
import { AuthStore } from '../../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';

// Interfaces simplificadas para la vista
interface Grupo {
  id_grupo: number;
  nombre_grupo: string;
  capitan_grupo?: string | null;
  auxiliar_grupo?: string | null;
  cantidad_publicadores?: number;
  id_congregacion_grupo?: number;
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
  id_grupo_publicador?: number | null;
  orden_en_grupo?: number | null;
  id_congregacion_publicador?: number;
  id_estado_publicador?: number | null;
  sexo?: string;
  rol?: any;
  privilegio?: any;
  privilegios_activos?: number[];
}

@Component({
  standalone: true,
  selector: 'app-asignacion-grupos',
  imports: [CommonModule],
  templateUrl: './asignacion-grupos.page.html',
  styles: [`
    :host { display: block; height: 100vh; }
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

    /* ═══════════════════════════════════════
       ANIMACIÓN INMERSIVA - Efecto "Foco"
       Zoom suave + desenfoque que aclara
    ═══════════════════════════════════════ */
    @keyframes immersiveEnter {
      0%   { opacity: 0; transform: scale(1.06); filter: blur(16px) brightness(1.3); }
      40%  { opacity: 0.9; filter: blur(2px) brightness(1.05); }
      100% { opacity: 1; transform: scale(1); filter: blur(0) brightness(1); }
    }
    ::ng-deep .immersive-in {
      animation: immersiveEnter 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
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

    @media (prefers-reduced-motion: reduce) {
      .slide-in-bottom,
      .animate-fade-in-up,
      .kanban-col { animation: none; opacity: 1; transform: none; }
      ::ng-deep .immersive-in { animation: none !important; }
    }
  `]
})
export class AsignacionGruposPage implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private privilegiosService = inject(PrivilegiosService);
  private gruposService = inject(GruposService);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private authStore = inject(AuthStore);
  private congregacionContext = inject(CongregacionContextService);

  constructor() {
    effect(() => {
      this.congregacionContext.effectiveCongregacionId();
      this.loadData();
    });
  }

  // Data
  grupos = signal<Grupo[]>([]);
  publicadores = signal<Publicador[]>([]);

  // Privilegios Data
  privilegiosCatalogo = signal<Privilegio[]>([]);
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map()); // id_publicador -> id_privilegio[]

  // UI State
  isDraggingOver = signal<'unassigned' | number | null>(null);
  draggedPublishers: Publicador[] = []; // Changed from single item to array
  draggedLeader: { type: 'capitan' | 'auxiliar', groupId: number, publicador: Publicador } | null = null;
  isSaving = signal(false);
  showSuccessMessage = signal(false);
  showExitConfirmation = signal(false); // Modal state
  removeLeaderConfirm = signal<{ groupId: number; role: 'capitan' | 'auxiliar' } | null>(null);
  isFullScreen = signal(false);
  showInactivePublishers = signal(true);
  estadosPublicador = signal<Estado[]>([]);
  /** Término de búsqueda por grupo (solo para filtrar la lista mostrada en cada card). */
  groupSearchTerms = signal<Record<number, string>>({});
  canScrollLeft = signal(false);
  canScrollRight = signal(false);
  private resizeObserver: ResizeObserver | null = null;

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
    if (this.draggedPublishers.length === 0 && !this.draggedLeader && !this.draggingLeaderCard) return;
    this.currentDragX = e.clientX;
    this.checkAutoScroll();
  }

  checkAutoScroll() {
    if (this.isAutoScrolling) return;

    this.isAutoScrolling = true;
    this.ngZone.runOutsideAngular(() => {
      const loop = () => {
        if (!this.draggedPublishers.length && !this.draggedLeader && !this.draggingLeaderCard) {
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

        if ((this.draggedPublishers.length > 0 || this.draggedLeader || this.draggingLeaderCard) && this.isAutoScrolling) {
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
    this.draggedPublishers = [];
    this.draggedLeader = null;
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

  toggleFullScreen() {
    this.isFullScreen.update(v => !v);
    if (this.isFullScreen()) {
      this.renderer.addClass(this.document.body, 'gac-fullscreen-active');
      this.escKeyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.toggleFullScreen();
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
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer.removeClass(this.document.body, 'gac-fullscreen-active');
    if (this.escKeyHandler) {
      this.document.removeEventListener('keydown', this.escKeyHandler);
    }
  }

  /** Navegación horizontal: desplaza una "página" a izquierda o derecha. */
  scrollHorizontal(direction: 'left' | 'right') {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    const step = Math.max(200, el.clientWidth * 0.6);
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  }

  /** Actualiza si se puede scroll a izquierda/derecha (para mostrar/ocultar botones). */
  updateScrollNavState() {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    this.canScrollLeft.set(scrollLeft > 2);
    this.canScrollRight.set(scrollLeft < maxScroll - 2);
  }

  isDraggingOverLeader = signal<{ groupId: number, role: 'capitan' | 'auxiliar' } | null>(null);

  // ── Eliminación de grupo ─────────────────────────────────────────────────
  deleteGroupConfirm = signal<number | null>(null);
  isDeletingGroup = signal(false);
  deleteGroupBlockReason = signal<string | null>(null);

  canDeleteGroup(groupId: number): boolean {
    const group = this.grupos().find(g => g.id_grupo === groupId);
    if (!group) return false;
    if (group.capitan_grupo || group.auxiliar_grupo) return false;
    return !this.publicadores().some(p => p.id_grupo_publicador === groupId);
  }

  getDeleteBlockReason(groupId: number): string | null {
    const group = this.grupos().find(g => g.id_grupo === groupId);
    if (!group) return null;
    const reasons: string[] = [];
    if (group.capitan_grupo) reasons.push('tiene un Capitán asignado');
    if (group.auxiliar_grupo) reasons.push('tiene un Auxiliar asignado');
    const count = this.publicadores().filter(p => p.id_grupo_publicador === groupId).length;
    if (count > 0) reasons.push(`tiene ${count} publicador${count > 1 ? 'es' : ''} asignado${count > 1 ? 's' : ''}`);
    if (reasons.length === 0) return null;
    return reasons.join(', ');
  }

  requestDeleteGroup(groupId: number) {
    const reason = this.getDeleteBlockReason(groupId);
    if (reason) {
      this.deleteGroupBlockReason.set(reason);
      return;
    }
    this.deleteGroupConfirm.set(groupId);
  }

  async confirmDeleteGroup() {
    const id = this.deleteGroupConfirm();
    if (id === null) return;
    this.deleteGroupConfirm.set(null);
    this.isDeletingGroup.set(true);
    try {
      await lastValueFrom(this.gruposService.deleteGrupo(id));
      this.grupos.update(list => list.filter(g => g.id_grupo !== id));
      this.initialLeaderState.update(map => { const m = new Map(map); m.delete(id); return m; });
    } catch (err) {
      console.error('Error al eliminar el grupo', err);
    } finally {
      this.isDeletingGroup.set(false);
    }
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

  /** Señal para el modal de confirmación al mover un encargado arrastrando su tarjeta. */
  leaderMoveConfirm = signal<{
    fromGroupId: number;
    fromRole: 'capitan' | 'auxiliar';
    toGroupId: number;
    toRole: 'capitan' | 'auxiliar';
    leaderName: string;
  } | null>(null);
  /** Datos del encargado que está siendo arrastrado en ese momento. */
  private draggingLeaderCard: { fromGroupId: number; fromRole: 'capitan' | 'auxiliar'; name: string } | null = null;

  /** Modal de confirmación cuando un encargado se mueve a la zona de publicadores. */
  leaderToPubConfirm = signal<{
    fromGroupId: number;
    fromRole: 'capitan' | 'auxiliar';
    targetGroupId: number | null;
    leaderName: string;
  } | null>(null);

  // Convertimos los estados iniciales a señales para que pendingChangesCount reaccione a sus cambios
  initialState = signal(new Map<number, number | null>());
  initialLeaderState = signal(new Map<number, { capitan: string | null | undefined, auxiliar: string | null | undefined }>());
  pendingLeaderChanges = new Map<number, { capitan?: string | null, auxiliar?: string | null }>();

  // Computed
  pendingChangesCount = computed(() => {
    let count = 0;
    const initialMap = this.initialState();
    const initialLeaderMap = this.initialLeaderState();

    // Cambios en publicadores
    for (const p of this.publicadores()) {
      const original = initialMap.get(p.id_publicador);
      const current = p.id_grupo_publicador || null;
      if (original !== current) {
        count++;
      }
    }
    // Cambios en líderes
    for (const g of this.grupos()) {
      const initial = initialLeaderMap.get(g.id_grupo);
      if (initial) {
        if ((g.capitan_grupo || '') !== (initial.capitan || '')) count++;
        if ((g.auxiliar_grupo || '') !== (initial.auxiliar || '')) count++;
      }
    }
    return count;
  });

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
    this.visiblePublicadores().filter(p => !p.id_grupo_publicador).sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre))
  );

  draggingAvatars = computed(() => {
    return this.publicadores().filter(p => this.isModified(p)).slice(0, 5);
  });

  ngOnInit() {

  }

  ngAfterViewInit() {
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

      const [gruposData, pubsData, privilegiosData, estadosData] = await Promise.all([
        lastValueFrom(this.http.get<Grupo[]>(`/api/grupos/${params}`)),
        lastValueFrom(this.http.get<Publicador[]>(`/api/publicadores/${params}`)),
        lastValueFrom(this.privilegiosService.getPrivilegios()),
        lastValueFrom(this.http.get<Estado[]>('/api/estados/')).catch(() => [])
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

      this.grupos.set(gruposFiltrados);
      this.privilegiosCatalogo.set(privilegiosData || []);

      // Guardar estado inicial para detectar cambios
      const newInitialState = new Map<number, number | null>();
      publicadoresFiltrados.forEach(p => {
        newInitialState.set(p.id_publicador, p.id_grupo_publicador || null);
      });
      this.initialState.set(newInitialState);

      // Guardar estado inicial de líderes
      const newInitialLeaderState = new Map<number, { capitan: string | null | undefined, auxiliar: string | null | undefined }>();
      this.pendingLeaderChanges.clear();
      gruposFiltrados.forEach(g => {
        newInitialLeaderState.set(g.id_grupo, {
          capitan: g.capitan_grupo,
          auxiliar: g.auxiliar_grupo
        });
      });
      this.initialLeaderState.set(newInitialLeaderState);

      await this.loadAllPublicadorPrivilegios(publicadoresFiltrados);
      this.publicadores.set(publicadoresFiltrados);

      setTimeout(() => this.updateScrollNavState(), 120);
    } catch (err) {
      console.error('Error cargando datos', err);
      alert('Error al cargar datos. Ver consola.');
    }
  }

  // Cargar privilegios de todos los publicadores de forma eficiente
  async loadAllPublicadorPrivilegios(publicadores: Publicador[]) {
    try {
      const allPrivilegios = await lastValueFrom(
        this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/')
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
  getGroupMembers(groupId: number): Publicador[] {
    return this.visiblePublicadores()
      .filter(p => p.id_grupo_publicador === groupId)
      .sort((a, b) => {
        const oa = a.orden_en_grupo ?? 999999;
        const ob = b.orden_en_grupo ?? 999999;
        if (oa !== ob) return oa - ob;
        return (a.primer_apellido || '').localeCompare(b.primer_apellido || '') || (a.primer_nombre || '').localeCompare(b.primer_nombre || '');
      });
  }

  getGroupSearch(groupId: number): string {
    return this.groupSearchTerms()[groupId] ?? '';
  }

  setGroupSearch(groupId: number, value: string): void {
    this.groupSearchTerms.update(prev => ({ ...prev, [groupId]: value ?? '' }));
  }

  /** Nombre en el mismo formato que se guarda en capitan_grupo/auxiliar_grupo. */
  getPublicadorLeaderName(p: Publicador): string {
    return `${p.primer_nombre} ${p.primer_apellido}${p.segundo_apellido ? ' ' + p.segundo_apellido : ''}`.trim();
  }

  // ── Drag & Drop de tarjetas de encargados ────────────────────────────────

  onDragStartLeaderCard(e: DragEvent, grupo: Grupo, role: 'capitan' | 'auxiliar') {
    const name = role === 'capitan' ? grupo.capitan_grupo : grupo.auxiliar_grupo;
    if (!name) return;
    this.draggedPublishers = [];
    this.draggingLeaderCard = { fromGroupId: grupo.id_grupo, fromRole: role, name };
    this.isDraggingContent.set(true);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'leader-card');
    }
  }

  getLeaderMoveConfirmDetails() {
    const m = this.leaderMoveConfirm();
    if (!m) return null;
    const fromGroup = this.grupos().find(g => g.id_grupo === m.fromGroupId);
    const toGroup = this.grupos().find(g => g.id_grupo === m.toGroupId);
    const roleLabel = (r: 'capitan' | 'auxiliar') => r === 'capitan' ? 'Capitán' : 'Auxiliar';
    const currentTarget = m.toRole === 'capitan' ? toGroup?.capitan_grupo : toGroup?.auxiliar_grupo;
    return {
      leaderName: m.leaderName,
      fromGroupName: fromGroup?.nombre_grupo ?? '',
      fromRoleLabel: roleLabel(m.fromRole),
      toGroupName: toGroup?.nombre_grupo ?? '',
      toRoleLabel: roleLabel(m.toRole),
      currentTargetName: currentTarget || null,
    };
  }

  async confirmLeaderMove() {
    const m = this.leaderMoveConfirm();
    if (!m) return;
    this.leaderMoveConfirm.set(null);
    const { fromGroupId, fromRole, toGroupId, toRole, leaderName } = m;

    this.grupos.update(list => list.map(g => {
      if (g.id_grupo === fromGroupId && g.id_grupo === toGroupId) {
        // Mismo grupo, solo cambio de rol
        const updated: Grupo = { ...g };
        if (fromRole === 'capitan') updated.capitan_grupo = null; else updated.auxiliar_grupo = null;
        if (toRole === 'capitan') updated.capitan_grupo = leaderName; else updated.auxiliar_grupo = leaderName;
        return updated;
      }
      if (g.id_grupo === fromGroupId) {
        return { ...g, [fromRole === 'capitan' ? 'capitan_grupo' : 'auxiliar_grupo']: null };
      }
      if (g.id_grupo === toGroupId) {
        return { ...g, [toRole === 'capitan' ? 'capitan_grupo' : 'auxiliar_grupo']: leaderName };
      }
      return g;
    }));

    // Guardar inmediatamente los grupos afectados en la BD
    try {
      const affectedIds = [...new Set([fromGroupId, toGroupId])];
      await Promise.all(affectedIds.map(id => {
        const g = this.grupos().find(gr => gr.id_grupo === id);
        if (!g) return Promise.resolve();
        return lastValueFrom(this.http.put(`/api/grupos/${id}`, {
          capitan_grupo: g.capitan_grupo || null,
          auxiliar_grupo: g.auxiliar_grupo || null,
        }));
      }));
      // Resetear el estado inicial para que los indicadores de "modificado" desaparezcan
      this.initialLeaderState.update(map => {
        const newMap = new Map(map);
        [...new Set([fromGroupId, toGroupId])].forEach(id => {
          const g = this.grupos().find(gr => gr.id_grupo === id);
          if (g) newMap.set(id, { capitan: g.capitan_grupo, auxiliar: g.auxiliar_grupo });
        });
        return newMap;
      });
    } catch (err) {
      console.error('Error al guardar el movimiento del encargado', err);
    }
  }

  cancelLeaderMove() {
    this.leaderMoveConfirm.set(null);
  }

  /** Busca un publicador cuyo nombre normalizado coincida con el nombre del encargado. */
  private findPublicadorByLeaderName(leaderName: string): Publicador | undefined {
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const target = norm(leaderName);
    return this.publicadores().find(p => norm(this.getPublicadorLeaderName(p)) === target);
  }

  getLeaderToPubConfirmDetails() {
    const m = this.leaderToPubConfirm();
    if (!m) return null;
    const fromGroup = this.grupos().find(g => g.id_grupo === m.fromGroupId);
    const toGroup = m.targetGroupId != null ? this.grupos().find(g => g.id_grupo === m.targetGroupId) : null;
    return {
      leaderName: m.leaderName,
      fromGroupName: fromGroup?.nombre_grupo ?? '',
      fromRoleLabel: m.fromRole === 'capitan' ? 'Capitán' : 'Auxiliar',
      toGroupName: toGroup?.nombre_grupo ?? 'Sin Asignar',
    };
  }

  async confirmLeaderToPub() {
    const m = this.leaderToPubConfirm();
    if (!m) return;
    this.leaderToPubConfirm.set(null);
    const { fromGroupId, fromRole, targetGroupId, leaderName } = m;

    // 1. Quitar del slot de encargado
    this.grupos.update(list => list.map(g => {
      if (g.id_grupo === fromGroupId) {
        return { ...g, [fromRole === 'capitan' ? 'capitan_grupo' : 'auxiliar_grupo']: null };
      }
      return g;
    }));

    // 2. Mover al publicador al grupo destino (si lo encontramos por nombre)
    const pub = this.findPublicadorByLeaderName(leaderName);
    if (pub) {
      this.publicadores.update(list =>
        list.map(p => p.id_publicador === pub.id_publicador
          ? { ...p, id_grupo_publicador: targetGroupId }
          : p
        )
      );
    }

    // 3. Guardar en la BD inmediatamente
    try {
      const fromGroup = this.grupos().find(g => g.id_grupo === fromGroupId);
      const saves: Promise<any>[] = [];

      if (fromGroup) {
        saves.push(lastValueFrom(this.http.put(`/api/grupos/${fromGroupId}`, {
          capitan_grupo: fromGroup.capitan_grupo || null,
          auxiliar_grupo: fromGroup.auxiliar_grupo || null,
        })));
      }

      if (pub) {
        saves.push(lastValueFrom(this.http.put(`/api/publicadores/${pub.id_publicador}`, {
          id_grupo_publicador: targetGroupId,
        })));
      }

      await Promise.all(saves);

      // Resetear estado inicial para que los indicadores de "modificado" desaparezcan
      this.initialLeaderState.update(map => {
        const newMap = new Map(map);
        const g = this.grupos().find(gr => gr.id_grupo === fromGroupId);
        if (g) newMap.set(fromGroupId, { capitan: g.capitan_grupo, auxiliar: g.auxiliar_grupo });
        return newMap;
      });
      if (pub) {
        this.initialState.update(map => {
          const newMap = new Map(map);
          newMap.set(pub.id_publicador, targetGroupId);
          return newMap;
        });
      }
    } catch (err) {
      console.error('Error al guardar el movimiento del encargado a publicadores', err);
    }
  }

  cancelLeaderToPub() {
    this.leaderToPubConfirm.set(null);
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

  async saveGroupName(grupo: Grupo) {
    const newName = this.editingGroupName().trim();
    if (!newName || newName === grupo.nombre_grupo) {
      this.cancelEditGroupName();
      return;
    }
    this.isSavingGroupName.set(true);
    try {
      await lastValueFrom(this.gruposService.updateGrupo(grupo.id_grupo, { nombre_grupo: newName }));
      this.grupos.update(list =>
        list.map(g => g.id_grupo === grupo.id_grupo ? { ...g, nombre_grupo: newName } : g)
      );
      this.cancelEditGroupName();
    } catch (err) {
      console.error('Error al guardar el nombre del grupo', err);
    } finally {
      this.isSavingGroupName.set(false);
    }
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
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const name = norm(this.getPublicadorLeaderName(p));
    const cap = norm(group.capitan_grupo || '');
    const aux = norm(group.auxiliar_grupo || '');
    return (cap.length > 0 && name === cap) || (aux.length > 0 && name === aux);
  }

  /** Miembros del grupo excluyendo capitán y auxiliar (solo para mostrar en la lista de cards). */
  getGroupMembersExcludingLeaders(groupId: number): Publicador[] {
    const group = this.grupos().find(g => g.id_grupo === groupId);
    if (!group) return [];
    return this.getGroupMembers(groupId).filter(p => !this.isPublicadorLeaderInGroup(p, group));
  }

  /** Miembros del grupo (sin líderes) filtrados por el término de búsqueda de esa card. */
  getFilteredGroupMembers(groupId: number): Publicador[] {
    const members = this.getGroupMembersExcludingLeaders(groupId);
    const term = (this.getGroupSearch(groupId) || '').trim().toLowerCase();
    if (!term) return members;
    return members.filter(p => {
      const full = [
        p.primer_nombre,
        p.segundo_nombre ?? '',
        p.primer_apellido,
        p.segundo_apellido ?? ''
      ].join(' ').toLowerCase();
      return full.includes(term);
    });
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

  getInitials(p: Publicador): string {
    return (p.primer_nombre.charAt(0) + p.primer_apellido.charAt(0)).toUpperCase();
  }

  getAvatarColor(id: number): string {
    const colors = ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#9D4EDD', '#FF9F1C'];
    return colors[id % colors.length];
  }

  getGroupColorClass(id: number): string {
    const colors = ['bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500'];
    return colors[id % colors.length];
  }

  // Obtener tags de privilegios para mostrar en la tarjeta del publicador
  getPrivilegioTags(p: Publicador): { label: string; class: string }[] {
    const tags: { label: string; class: string }[] = [];
    const privilegiosMap = this.publicadorPrivilegiosMap();
    const privilegiosIds = privilegiosMap.get(p.id_publicador) || [];
    const catalogo = this.privilegiosCatalogo();

    const privilegioConfig: { [key: string]: { label: string; class: string } } = {
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

    for (const idPrivilegio of privilegiosIds) {
      const privilegio = catalogo.find(pr => pr.id_privilegio === idPrivilegio);
      if (privilegio) {
        const nombreLower = privilegio.nombre_privilegio.toLowerCase().trim();
        for (const [key, config] of Object.entries(privilegioConfig)) {
          if (nombreLower.includes(key)) {
            tags.push(config);
            break;
          }
        }
      }
    }

    return tags;
  }

  getPrivilegioTagsByName(nombreCompleto: string | null | undefined): { label: string; class: string }[] {
    if (!nombreCompleto) return [];

    const nombreBuscado = nombreCompleto.toLowerCase().trim();

    const publicador = this.publicadores().find(p => {
      const nombres = [
        `${p.primer_nombre} ${p.primer_apellido} `,
        `${p.primer_nombre} ${p.segundo_nombre || ''} ${p.primer_apellido} `.replace(/\s+/g, ' '),
        `${p.primer_nombre} ${p.primer_apellido} ${p.segundo_apellido || ''} `.replace(/\s+/g, ' '),
        `${p.primer_nombre} ${p.segundo_nombre || ''} ${p.primer_apellido} ${p.segundo_apellido || ''} `.replace(/\s+/g, ' ')
      ].map(n => n.toLowerCase().trim());

      return nombres.some(n => n === nombreBuscado);
    });

    if (!publicador) return [];

    return this.getPrivilegioTags(publicador);
  }

  goBack() {
    if (this.pendingChangesCount() > 0) {
      this.showExitConfirmation.set(true);
      return;
    }
    this.performExit();
  }

  confirmExit() {
    this.showExitConfirmation.set(false);
    this.performExit();
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
  async onDropOnPublisherCard(e: DragEvent, groupId: number, targetIndex: number) {
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

      try {
        await lastValueFrom(this.http.put(`/api/grupos/${groupId}/orden-publicadores`, { id_publicadores: idOrder }));
      } catch (err) {
        console.error('Error al guardar el orden', err);
      }
      return;
    }

    // Mover entre grupos: dejar que el drop en la columna lo maneje (no hacer nada aquí para no duplicar)
  }

  onDragOver(e: DragEvent, targetId: number | 'unassigned') {
    e.preventDefault();
    // Si se está reordenando una columna, gestionar ese estado
    if (this.draggingColumnId()) {
      // Cancelar cualquier timer de dragleave pendiente
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
    this.isDraggingOver.set(null);
    // Para el reordenamiento de columnas usamos debounce para evitar parpadeos
    // causados por entrar/salir de elementos hijos
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
      const { fromGroupId, fromRole, name } = this.draggingLeaderCard;
      this.draggingLeaderCard = null;
      this.isDraggingContent.set(false);
      this.leaderToPubConfirm.set({ fromGroupId, fromRole, targetGroupId, leaderName: name });
      return;
    }

    if (this.draggedPublishers.length === 0) return;

    const items = this.draggedPublishers;
    this.draggedPublishers = [];
    this.selectedPublishersIds.set(new Set()); // Clear selection

    const idsToMove = new Set(items.map(p => p.id_publicador));
    let changed = false;

    // Check if change is needed before updating signals
    // But since we iterate map, we can just do it.

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

    // Caso 1: se está arrastrando una tarjeta de encargado
    if (this.draggingLeaderCard) {
      const { fromGroupId, fromRole, name } = this.draggingLeaderCard;
      this.draggingLeaderCard = null;
      this.isDraggingContent.set(false);
      // Sin cambio si se suelta en el mismo slot
      if (fromGroupId === groupId && fromRole === role) return;
      this.leaderMoveConfirm.set({ fromGroupId, fromRole, toGroupId: groupId, toRole: role, leaderName: name });
      return;
    }

    // Caso 2: se arrastra un publicador al slot de encargado (comportamiento existente)
    if (this.draggedPublishers.length !== 1) return;

    const p = this.draggedPublishers[0];
    this.draggedPublishers = [];

    const fullName = `${p.primer_nombre} ${p.primer_apellido}${p.segundo_apellido ? ' ' + p.segundo_apellido : ''}`.trim();

    this.grupos.update(currentGrupos => {
      return currentGrupos.map(g => {
        if (g.id_grupo === groupId) {
          if (role === 'capitan') {
            return { ...g, capitan_grupo: fullName };
          } else {
            return { ...g, auxiliar_grupo: fullName };
          }
        }
        return g;
      });
    });
  }

  removeLeader(groupId: number, role: 'capitan' | 'auxiliar') {
    this.removeLeaderConfirm.set({ groupId, role });
  }

  confirmRemoveLeader() {
    const data = this.removeLeaderConfirm();
    if (!data) return;
    const { groupId, role } = data;
    this.removeLeaderConfirm.set(null);

    this.grupos.update(currentGrupos => {
      return currentGrupos.map(g => {
        if (g.id_grupo === groupId) {
          if (role === 'capitan') {
            return { ...g, capitan_grupo: null };
          } else {
            return { ...g, auxiliar_grupo: null };
          }
        }
        return g;
      });
    });
  }

  getRemoveLeaderConfirmRoleLabel(): string {
    const data = this.removeLeaderConfirm();
    if (!data) return '';
    return data.role === 'capitan' ? 'Capitán' : 'Auxiliar';
  }

  getRemoveLeaderConfirmGroupName(): string {
    const data = this.removeLeaderConfirm();
    if (!data) return '';
    const g = this.grupos().find(gr => gr.id_grupo === data.groupId);
    return g?.nombre_grupo ?? '';
  }

  isLeaderModified(groupId: number, role: 'capitan' | 'auxiliar'): boolean {
    const group = this.grupos().find(g => g.id_grupo === groupId);
    const initial = this.initialLeaderState().get(groupId);
    if (!group || !initial) return false;

    if (role === 'capitan') {
      return (group.capitan_grupo || '') !== (initial.capitan || '');
    } else {
      return (group.auxiliar_grupo || '') !== (initial.auxiliar || '');
    }
  }

  getPrecursoresCount(groupId: number): number {
    const members = this.getGroupMembers(groupId);
    let count = 0;
    const catalogo = this.privilegiosCatalogo();
    const map = this.publicadorPrivilegiosMap();

    for (const p of members) {
      const ids = map.get(p.id_publicador);
      if (ids) {
        const isPrec = ids.some(id => {
          const priv = catalogo.find(pr => pr.id_privilegio === id);
          return priv && priv.nombre_privilegio.toLowerCase().includes('precursor');
        });
        if (isPrec) count++;
      }
    }
    return count;
  }

  // Save
  async saveChanges() {
    console.log('Saving changes...');
    const modifiedPubs = this.publicadores().filter(p => this.isModified(p));

    const modifiedGroups = this.grupos().filter(g =>
      this.isLeaderModified(g.id_grupo, 'capitan') || this.isLeaderModified(g.id_grupo, 'auxiliar')
    );

    if (modifiedPubs.length === 0 && modifiedGroups.length === 0) return;

    this.isSaving.set(true);
    try {
      const promises: Promise<any>[] = [];

      // 1. Save Publisher Changes
      if (modifiedPubs.length > 0) {
        const pubPromises = modifiedPubs.map(p => {
          const payload = {
            id_grupo_publicador: p.id_grupo_publicador
          };
          return lastValueFrom(this.http.put(`/api/publicadores/${p.id_publicador}`, payload));
        });
        promises.push(...pubPromises);
      }

      // 2. Save Group Leader Changes
      if (modifiedGroups.length > 0) {
        const groupPromises = modifiedGroups.map(g => {
          const payload = {
            capitan_grupo: g.capitan_grupo,
            auxiliar_grupo: g.auxiliar_grupo
          };
          return lastValueFrom(this.http.put(`/api/grupos/${g.id_grupo}`, payload));
        });
        promises.push(...groupPromises);
      }

      await Promise.all(promises);

      // Update initial state to match current state (This triggers pendingChangesCount to drop to 0)
      const newInitialState = new Map<number, number | null>();
      this.publicadores().forEach(p => {
        newInitialState.set(p.id_publicador, p.id_grupo_publicador || null);
      });
      this.initialState.set(newInitialState);

      const newInitialLeaderState = new Map<number, { capitan: string | null | undefined, auxiliar: string | null | undefined }>();
      this.grupos().forEach(g => {
        newInitialLeaderState.set(g.id_grupo, {
          capitan: g.capitan_grupo,
          auxiliar: g.auxiliar_grupo
        });
      });
      this.initialLeaderState.set(newInitialLeaderState);

      // Show success message
      this.showSuccessMessage.set(true);
      setTimeout(() => {
        this.showSuccessMessage.set(false);
      }, 4000);

    } catch (err) {
      console.error('Error saving changes', err);
      alert('Error al guardar cambios. Intenta nuevamente.');
    } finally {
      this.isSaving.set(false);
    }
  }
}

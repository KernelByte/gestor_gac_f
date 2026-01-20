import { Component, computed, inject, OnInit, signal, OnDestroy, Renderer2, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { lastValueFrom, forkJoin } from 'rxjs';
import { PrivilegiosService } from '../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../privilegios/domain/models/publicador-privilegio';
import { AuthStore } from '../../../../core/auth/auth.store';

// Interfaces simplificadas para la vista
interface Grupo {
  id_grupo: number;
  nombre_grupo: string;
  capitan_grupo?: string | null;
  auxiliar_grupo?: string | null;
  cantidad_publicadores?: number;
  id_congregacion_grupo?: number;
}

interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  id_grupo_publicador?: number | null;
  id_congregacion_publicador?: number;
  sexo?: string;
  // Ajustar según la respuesta real de tu API si hay privilegio/rol
  rol?: any;
  privilegio?: any;
  // Privilegios activos del publicador (cargados desde el frontend)
  privilegios_activos?: number[]; // Array de id_privilegio
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
    
    @keyframes slideInBottom {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .slide-in-bottom {
      animation: slideInBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    /* Global FullScreen Override Styles */
    ::ng-deep body.gac-fullscreen-active app-shell aside,
    ::ng-deep body.gac-fullscreen-active app-shell header {
      display: none !important;
    }
    
    ::ng-deep body.gac-fullscreen-active app-shell aside + div {
      margin-left: 0 !important;
    }
    
    ::ng-deep body.gac-fullscreen-active app-shell main {
      padding: 0 !important;
      height: 100vh !important;
    }
    
    ::ng-deep body.gac-fullscreen-active app-shell .router-container {
      height: 100vh !important;
    }
  `]
})
export class AsignacionGruposPage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private privilegiosService = inject(PrivilegiosService);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private authStore = inject(AuthStore);

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
  isFullScreen = signal(false); // Estado para pantalla completa

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
    if (this.draggedPublishers.length === 0 && !this.draggedLeader) return;
    this.currentDragX = e.clientX;
    this.checkAutoScroll();
  }

  checkAutoScroll() {
    if (this.isAutoScrolling) return;

    this.isAutoScrolling = true;
    this.ngZone.runOutsideAngular(() => {
      const loop = () => {
        if (!this.draggedPublishers.length && !this.draggedLeader) {
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

        if ((this.draggedPublishers.length > 0 || this.draggedLeader) && this.isAutoScrolling) {
          this.autoScrollFrameId = requestAnimationFrame(loop);
        } else {
          this.isAutoScrolling = false;
        }
      };
      loop();
    });
  }

  onDragEnd() {
    this.isDraggingContent.set(false);
    this.isAutoScrolling = false;
    if (this.autoScrollFrameId) {
      cancelAnimationFrame(this.autoScrollFrameId);
      this.autoScrollFrameId = null;
    }
    // Clean up drag state if not handled by drop
    this.draggedPublishers = [];
    this.draggedLeader = null;
    this.selectedPublishersIds.set(new Set());
    this.isDraggingOver.set(null);
    this.isDraggingOverLeader.set(null);
  }

  toggleFullScreen() {
    this.isFullScreen.update(v => !v);
    if (this.isFullScreen()) {
      this.renderer.addClass(this.document.body, 'gac-fullscreen-active');
    } else {
      this.renderer.removeClass(this.document.body, 'gac-fullscreen-active');
    }
  }

  ngOnDestroy() {
    this.renderer.removeClass(this.document.body, 'gac-fullscreen-active');
  }
  isDraggingOverLeader = signal<{ groupId: number, role: 'capitan' | 'auxiliar' } | null>(null);

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

  unassignedPublishers = computed(() =>
    this.publicadores().filter(p => !p.id_grupo_publicador).sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre))
  );

  draggingAvatars = computed(() => {
    return this.publicadores().filter(p => this.isModified(p)).slice(0, 5);
  });

  ngOnInit() {
    console.log('AsignacionGruposPage loaded - Kanban Compact Version');
    this.loadData();
  }

  async loadData() {
    try {
      const user = this.authStore.user();
      const congId = user?.id_congregacion;

      let params = '?limit=1000';
      if (congId) {
        params += `&id_congregacion=${congId}`;
      }

      const [gruposData, pubsData, privilegiosData] = await Promise.all([
        lastValueFrom(this.http.get<Grupo[]>(`/api/grupos/${params}`)),
        lastValueFrom(this.http.get<Publicador[]>(`/api/publicadores/${params}`)),
        lastValueFrom(this.privilegiosService.getPrivilegios())
      ]);

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

      console.log('📌 Privilegios cargados desde API:', allPrivilegios);
      console.log('📌 Catálogo de privilegios:', this.privilegiosCatalogo());

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

      console.log('📌 Mapa de privilegios por publicador:', Object.fromEntries(privilegiosMap));

      this.publicadorPrivilegiosMap.set(privilegiosMap);
    } catch (err) {
      console.error('❌ Error cargando privilegios de publicadores', err);
    }
  }

  // Helpers
  getGroupMembers(groupId: number): Publicador[] {
    return this.publicadores()
      .filter(p => p.id_grupo_publicador === groupId)
      .sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre));
  }

  isModified(p: Publicador): boolean {
    const original = this.initialState().get(p.id_publicador);
    const current = p.id_grupo_publicador || null;
    return original !== current;
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
        class: 'text-indigo-700 bg-indigo-100 shadow-sm'
      },
      'siervo ministerial': {
        label: 'Siervo Ministerial',
        class: 'text-yellow-800 bg-yellow-100 shadow-sm'
      },
      'precursor regular': {
        label: 'Precursor Regular',
        class: 'text-purple-700 bg-purple-100 shadow-sm'
      },
      'precursor auxiliar': {
        label: 'Precursor Auxiliar',
        class: 'text-amber-700 bg-amber-100 shadow-sm'
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
      targets = this.getGroupMembers(groupId).map(p => p.id_publicador);
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
  onDragStart(e: DragEvent, p: Publicador) {
    let items: Publicador[] = [];

    if (this.isSelected(p.id_publicador)) {
      const ids = this.selectedPublishersIds();
      items = this.publicadores().filter(pub => ids.has(pub.id_publicador));
    } else {
      this.selectedPublishersIds.set(new Set()); // Clear selection if dragging unselected
      items = [p];
    }

    this.draggedPublishers = items;

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(items.map(i => i.id_publicador)));

      // Optional: Set drag image customized if multiple
      if (items.length > 1) {
        // Attempt to show count? For now default.
      }
    }
    this.isDraggingContent.set(true);
  }

  onDragOver(e: DragEvent, targetId: number | 'unassigned') {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    this.isDraggingOver.set(targetId);
  }

  onDragLeave() {
    this.isDraggingOver.set(null);
  }

  onDrop(e: DragEvent, targetGroupId: number | null) {
    e.preventDefault();
    this.isDraggingOver.set(null);

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

    if (this.draggedPublishers.length !== 1) return; // Only allow single drop

    const p = this.draggedPublishers[0];
    this.draggedPublishers = [];

    const fullName = `${p.primer_nombre} ${p.primer_apellido}${p.segundo_apellido ? ' ' + p.segundo_apellido : ''} `.trim();

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
    if (!confirm(`¿Estás seguro de quitar al ${role} de este grupo ? `)) return;

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

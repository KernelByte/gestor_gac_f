import { Component, computed, inject, OnInit, signal, OnDestroy, Renderer2 } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { lastValueFrom, forkJoin } from 'rxjs';
import { PrivilegiosService } from '../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../privilegios/domain/models/publicador-privilegio';

// Interfaces simplificadas para la vista
interface Grupo {
  id_grupo: number;
  nombre_grupo: string;
  capitan_grupo?: string;
  auxiliar_grupo?: string;
  cantidad_publicadores?: number;
}

interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  id_grupo_publicador?: number | null;
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

  // Data
  grupos = signal<Grupo[]>([]);
  publicadores = signal<Publicador[]>([]);

  // Privilegios Data
  privilegiosCatalogo = signal<Privilegio[]>([]);
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map()); // id_publicador -> id_privilegio[]

  // UI State
  isDraggingOver = signal<'unassigned' | number | null>(null);
  draggedItem: Publicador | null = null;
  draggedLeader: { type: 'capitan' | 'auxiliar', groupId: number, publicador: Publicador } | null = null;
  isSaving = signal(false);
  showSuccessMessage = signal(false);
  showExitConfirmation = signal(false); // Modal state
  isFullScreen = signal(false); // Estado para pantalla completa

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
  initialLeaderState = signal(new Map<number, { capitan: string | undefined, auxiliar: string | undefined }>());
  pendingLeaderChanges = new Map<number, { capitan?: string, auxiliar?: string }>();

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
      const [gruposData, pubsData, privilegiosData] = await Promise.all([
        lastValueFrom(this.http.get<Grupo[]>('/api/grupos/')),
        lastValueFrom(this.http.get<Publicador[]>('/api/publicadores/')),
        lastValueFrom(this.privilegiosService.getPrivilegios())
      ]);

      this.grupos.set(gruposData || []);
      this.privilegiosCatalogo.set(privilegiosData || []);

      // Guardar estado inicial para detectar cambios
      const newInitialState = new Map<number, number | null>();
      (pubsData || []).forEach(p => {
        newInitialState.set(p.id_publicador, p.id_grupo_publicador || null);
      });
      this.initialState.set(newInitialState);

      // Guardar estado inicial de líderes
      const newInitialLeaderState = new Map<number, { capitan: string | undefined, auxiliar: string | undefined }>();
      this.pendingLeaderChanges.clear();
      (gruposData || []).forEach(g => {
        newInitialLeaderState.set(g.id_grupo, {
          capitan: g.capitan_grupo,
          auxiliar: g.auxiliar_grupo
        });
      });
      this.initialLeaderState.set(newInitialLeaderState);

      await this.loadAllPublicadorPrivilegios(pubsData || []);
      this.publicadores.set(pubsData || []);

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

  getPrivilegioTagsByName(nombreCompleto: string | undefined): { label: string; class: string }[] {
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

  // Drag & Drop Logic
  onDragStart(e: DragEvent, p: Publicador) {
    this.draggedItem = p;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(p));
    }
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

    if (!this.draggedItem) return;

    const p = this.draggedItem;
    const oldGroupId = p.id_grupo_publicador;

    this.draggedItem = null;

    if (oldGroupId !== targetGroupId) {
      this.publicadores.update(current => {
        return current.map(item => {
          if (item.id_publicador === p.id_publicador) {
            return { ...item, id_grupo_publicador: targetGroupId };
          }
          return item;
        });
      });
    }
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

    if (!this.draggedItem) return;
    const p = this.draggedItem;
    this.draggedItem = null;

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
            return { ...g, capitan_grupo: undefined };
          } else {
            return { ...g, auxiliar_grupo: undefined };
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

      const newInitialLeaderState = new Map<number, { capitan: string | undefined, auxiliar: string | undefined }>();
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

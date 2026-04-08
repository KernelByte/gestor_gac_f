import { Component, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InformesService } from './services/informes.service';
import { GruposService } from '../grupos/services/grupos.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { ResumenMensual, InformeConPublicador, InformeLoteItem, Periodo, HistorialAnual, ResumenSucursal } from './models/informe.model';
import { InformesStatsComponent } from './components/informes-stats/informes-stats.component';
import { InformesFiltersComponent } from './components/informes-filters/informes-filters.component';
import { InformesTableComponent } from './components/informes-table/informes-table.component';
import { InformesHistorialComponent } from './components/informes-historial/informes-historial.component';
import { ResumenSucursalComponent } from './components/resumen-sucursal/resumen-sucursal.component';


import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { PrivilegiosService } from '../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../privilegios/domain/models/publicador-privilegio';
import { saveAs } from 'file-saver';

@Component({
  standalone: true,
  selector: 'app-informes-main',
  imports: [CommonModule, FormsModule, InformesStatsComponent, InformesFiltersComponent, InformesTableComponent, InformesHistorialComponent, ResumenSucursalComponent],
  templateUrl: './informes-main.page.html',
  styles: [`:host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }`]
})
export class InformesMainPage implements OnInit {
  private informesService = inject(InformesService);
  private gruposService = inject(GruposService);

  public authStore = inject(AuthStore);
  public congregacionContext = inject(CongregacionContextService);
  private http = inject(HttpClient);

  private privilegiosService = inject(PrivilegiosService);

  activeTab = signal(localStorage.getItem('informes_activeTab') || 'entrada');

  constructor() {
    effect(() => {
      this.congregacionContext.effectiveCongregacionId();
      this.loadGrupos();
      this.loadResumen();
    });

    effect(() => {
      localStorage.setItem('informes_activeTab', this.activeTab());
    });

    effect(() => {
      const visible = this.visibleTabs();
      const current = this.activeTab();
      if (visible.length > 0 && !visible.some(t => t.id === current)) {
        this.activeTab.set(visible[0].id);
      }
    }, { allowSignalWrites: true });
  }

  tabs = [
    { id: 'entrada', label: 'Entrada Mensual', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>' },
    { id: 'historial', label: 'Historial Anual', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>' },
    { id: 'sucursal', label: 'Resumen Sucursal', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' }
  ];

  activeDropdown = signal<string | null>(null);
  resumen = signal<ResumenMensual | null>(null);
  grupos = signal<any[]>([]);
  saving = signal(false);
  vistaGrupo = signal(false);
  toastMessage = signal<{ title: string, text?: string, type: 'success' | 'error' | 'info' } | null>(null);

  selectedMes = (new Date().getMonth() === 0 ? '12' : new Date().getMonth().toString());
  selectedAno = (new Date().getMonth() === 0 ? (new Date().getFullYear() - 1).toString() : new Date().getFullYear().toString());
  selectedGrupo: number | null = null;
  searchQuery = '';
  soloSinInforme = false;

  localChanges: Map<number, Partial<InformeLoteItem>> = new Map();

  // Privilegios Loading
  privilegios = signal<Privilegio[]>([]);
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map());
  historialGroupId = signal<number | null>(null);

  // Restricted user detection: Publicador sin roles privilegiados
  private isPrivilegedRole = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    const roles = user.roles ?? (user.rol ? [user.rol] : []);
    const rolesLower = roles.map(r => (r || '').toLowerCase());
    return rolesLower.includes('administrador') ||
      rolesLower.includes('secretario') ||
      rolesLower.includes('coordinador') ||
      rolesLower.includes('superintendente de servicio');
  });

  private isAdminOrSecretario = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    const roles = user.roles ?? (user.rol ? [user.rol] : []);
    const rolesLower = roles.map(r => (r || '').toLowerCase());
    return rolesLower.includes('administrador') || rolesLower.includes('secretario');
  });

  canEditAllGroups = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    // Solo Administrador y Secretario tienen acceso total por defecto.
    // Otros roles (Coordinador, etc.) requieren permiso explícito para editar todos los grupos.
    if (this.isAdminOrSecretario()) return true;
    return user.permisos?.includes('informes.editar_todos') ?? false;
  });

  canAccessAllGroups = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    if (this.isAdminOrSecretario()) return true;
    return (user.permisos?.includes('informes.editar_todos') || user.permisos?.includes('informes.ver_todos')) ?? false;
  });

  canEditInformes = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    if (this.isPrivilegedRole()) return true;
    return (user.permisos?.includes('informes.editar') ?? false) || this.canEditAllGroups();
  });

  canViewInformes = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    if (this.isPrivilegedRole()) return true;
    return (user.permisos?.includes('informes.ver') ?? false) || this.canEditInformes();
  });

  canEditHistorial = computed(() => this.isAdminOrSecretario());

  canViewHistorial = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    if (this.isAdminOrSecretario()) return true;
    return user.permisos?.includes('informes.historial') ?? false;
  });

  canViewResumenSucursalAllGroups = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    if (this.isAdminOrSecretario()) return true;
    return user.permisos?.includes('informes.enviar_todos') ?? false;
  });

  canViewResumenSucursal = computed(() => {
    const user = this.authStore.user();
    if (!user) return false;
    if (this.isAdminOrSecretario()) return true;
    return (user.permisos?.includes('informes.enviar') ?? false) || this.canViewResumenSucursalAllGroups();
  });

  isRestrictedUser = computed(() => !this.canAccessAllGroups());

  visibleTabs = computed(() => {
    let tabs = this.tabs;

    if (!this.canViewInformes()) {
      tabs = tabs.filter(t => t.id !== 'entrada');
    }

    if (!this.canViewHistorial()) {
      tabs = tabs.filter(t => t.id !== 'historial');
    }

    if (!this.canViewResumenSucursal()) {
      tabs = tabs.filter(t => t.id !== 'sucursal');
    }

    if (this.isRestrictedUser()) {
      tabs = tabs.filter(t => t.id === 'entrada' || t.id === 'historial' || t.id === 'sucursal');
    }

    return tabs;
  });

  meses = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ];
  anos = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

  async ngOnInit() {
    if (!this.canViewInformes() && !this.canViewHistorial() && !this.canViewResumenSucursal()) {
      this.showToast('Acceso restringido', 'error', 'No tienes permiso para ver el módulo de informes.');
      return;
    }
    // Restaurar preferencia de filtro "Sin Informe"
    const savedFilter = localStorage.getItem('informes_soloSinInforme');
    if (savedFilter !== null) {
      this.soloSinInforme = savedFilter === 'true';
    }

    // Primero inicializar para usuarios restringidos (precargar grupo)
    await this.initializeForRestrictedUser();
    await this.loadHistorialGroupIdIfNeeded();
    this.loadPrivilegiosData();
  }

  private _cachedUserPublicador: any = null;

  private async getUserPublicador(): Promise<any> {
    if (this._cachedUserPublicador) return this._cachedUserPublicador;
    const user = this.authStore.user();
    if (!user?.id_usuario_publicador) return null;
    try {
      this._cachedUserPublicador = await lastValueFrom(
        this.http.get<any>(`/api/publicadores/${user.id_usuario_publicador}`)
      );
      return this._cachedUserPublicador;
    } catch (e) {
      console.error('Error loading publicador data:', e);
      return null;
    }
  }

  private async initializeForRestrictedUser() {
    if (this.isRestrictedUser()) {
      const publicador = await this.getUserPublicador();
      if (publicador?.id_grupo_publicador) {
        this.selectedGrupo = publicador.id_grupo_publicador;
        this.vistaGrupo.set(true);
        this.historialGroupId.set(publicador.id_grupo_publicador);
      }
    }
  }

  private async loadHistorialGroupIdIfNeeded() {
    if (this.canEditHistorial()) return;
    if (!this.canViewHistorial() && !(this.canViewResumenSucursal() && !this.canViewResumenSucursalAllGroups())) return;
    if (this.historialGroupId()) return;

    const publicador = await this.getUserPublicador();
    if (publicador?.id_grupo_publicador) {
      this.historialGroupId.set(publicador.id_grupo_publicador);
    }
  }

  async loadPrivilegiosData() {
    try {
      // Load catalog and assignments in parallel
      const [catalog, allPrivilegios] = await Promise.all([
        lastValueFrom(this.privilegiosService.getPrivilegios()),
        lastValueFrom(this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/')),
      ]);
      this.privilegios.set(catalog);

      const today = new Date().toISOString().split('T')[0];
      const privilegiosMap = new Map<number, number[]>();

      for (const pp of (allPrivilegios || [])) {
        // Filter active privileges
        if (!pp.fecha_fin || pp.fecha_fin >= today) {
          if (!privilegiosMap.has(pp.id_publicador)) {
            privilegiosMap.set(pp.id_publicador, []);
          }
          privilegiosMap.get(pp.id_publicador)!.push(pp.id_privilegio);
        }
      }
      this.publicadorPrivilegiosMap.set(privilegiosMap);

    } catch (error) {
      console.error('Error loading privileges data:', error);
    }
  }

  setVista(isGrupo: boolean) {
    this.vistaGrupo.set(isGrupo);
    if (!isGrupo) {
      this.selectGrupo(null);
    } else {
      if (this.selectedGrupo === null) {
        this.loadResumen();
      }
    }
  }

  loadGrupos() {
    const congregacionId = this.congregacionContext.effectiveCongregacionId();
    const params = congregacionId != null ? { congregacion_id: congregacionId } : {};
    this.gruposService.getGrupos(params).subscribe({
      next: (data) => this.grupos.set(data),
      error: (err) => console.error('Error loading groups:', err)
    });
  }

  // --- Dropdown Logic ---
  toggleDropdown(id: string) {
    this.activeDropdown.update(current => current === id ? null : id);
  }

  closeDropdown() {
    this.activeDropdown.set(null);
  }

  onSoloSinInformeChange(value: boolean) {
    this.soloSinInforme = value;
    localStorage.setItem('informes_soloSinInforme', value.toString());
    this.loadResumen();
  }

  selectMes(mes: string) {
    this.selectedMes = mes;
    this.closeDropdown();
    this.loadResumen();
  }

  selectAno(ano: string) {
    this.selectedAno = ano;
    this.closeDropdown();
    this.loadResumen();
  }

  selectGrupo(grupoId: number | null) {
    this.selectedGrupo = grupoId;
    this.closeDropdown();
    this.loadResumen();
  }

  getMesLabel(mesValue: string): string {
    return this.meses.find(m => m.value === mesValue)?.label || 'Mes';
  }

  getGrupoLabel(grupoId: number | null): string {
    if (!grupoId) return 'Todos los grupos';
    return this.grupos().find(g => g.id_grupo === grupoId)?.nombre_grupo || 'Seleccionar Grupo';
  }

  loadResumen() {
    if (!this.canViewInformes()) return;
    const congregacionId = this.congregacionContext.effectiveCongregacionId() ?? 0;
    const periodoId = this.getPeriodoId();
    if (!periodoId) return;

    this.informesService.getResumenMensual(
      periodoId, congregacionId, this.selectedGrupo || undefined, this.soloSinInforme, this.searchQuery || undefined
    ).subscribe({
      next: (data) => this.resumen.set(data),
      error: (err) => console.error('Error loading resumen:', err)
    });
  }

  getPeriodoId(): number {
    const base = (parseInt(this.selectedAno) - 2010) * 12;
    return base + parseInt(this.selectedMes);
  }

  handleInformeChange(event: { pub: InformeConPublicador, field: string, value: any }) {
    if (!this.canEditInformes()) return;
    const { pub, field, value } = event;
    const existingEntry = this.localChanges.get(pub.id_publicador);
    const existing = existingEntry ? { ...existingEntry } : { id_publicador: pub.id_publicador, participo: pub.participo ?? false, cursos_biblicos: pub.cursos_biblicos ?? 0, horas: pub.horas ?? 0, observaciones: pub.observaciones };

    if (field === 'participo') {
      existing.participo = value;
      // Si se desmarca, limpiar los otros campos
      if (!value) {
        existing.horas = 0;
        existing.cursos_biblicos = 0;
        existing.observaciones = null;
      }
    }
    else if (field === 'es_paux') existing.es_paux_mes = value;
    else if (field === 'cursos') existing.cursos_biblicos = value;
    else if (field === 'horas') existing.horas = value;
    else if (field === 'notas') existing.observaciones = value;

    // Create a new map to properly trigger Angular Change Detection
    const newChanges = new Map(this.localChanges);
    newChanges.set(pub.id_publicador, existing);
    this.localChanges = newChanges;
  }

  guardarTodo() {
    if (!this.canEditInformes()) return;
    if (this.localChanges.size === 0) return;
    this.saving.set(true);

    const items: InformeLoteItem[] = Array.from(this.localChanges.values()).map(c => ({
      id_publicador: c.id_publicador!,
      participo: c.participo ?? false,
      cursos_biblicos: c.cursos_biblicos ?? 0,
      horas: c.horas ?? 0,
      observaciones: c.observaciones ?? null,
      es_paux_mes: c.es_paux_mes // Nuevo campo opcional
    }));

    this.informesService.guardarInformesLote({ periodo_id: this.getPeriodoId(), informes: items }).subscribe({
      next: (result) => {
        this.localChanges.clear();
        this.loadResumen();
        this.saving.set(false);
        this.showToast('Cambios guardados', 'success', `Se procesaron ${result.procesados} informes.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.showToast('Error al guardar', 'error', err.error?.detail || 'No se pudieron guardar los cambios.');
      }
    });
  }

  async exportarExcel() {
    this.saving.set(true);
    try {
      const periodo = `${this.selectedAno}-${this.getMesLabel(this.selectedMes)}`;
      const congregacionId = this.congregacionContext.effectiveCongregacionId() ?? 1;

      if (this.selectedGrupo) {
        // Descargar por grupo
        const g = this.grupos().find(gx => gx.id_grupo === this.selectedGrupo);
        const nombreGrupo = g ? g.nombre_grupo : 'Grupo';
        this.informesService.exportTemplate(this.getPeriodoId(), this.selectedGrupo).subscribe({
          next: (blob) => {
            const filename = `Informe_${nombreGrupo}_${periodo}.xlsx`;
            saveAs(blob, filename);
            this.saving.set(false);
          },
          error: (err) => {
            console.error('Error descargando plantilla', err);
            this.showToast('Error', 'error', 'Error al descargar la plantilla desde el servidor.');
            this.saving.set(false);
          }
        });
      } else {
        // Descargar toda la congregación
        if (!congregacionId) {
          throw new Error("No se pudo identificar la congregación del usuario.");
        }
        this.informesService.exportTemplateCongregacion(this.getPeriodoId(), congregacionId).subscribe({
          next: (blob) => {
            const filename = `Informe_Congregacion_${periodo}.xlsx`;
            saveAs(blob, filename);
            this.saving.set(false);
          },
          error: (err) => {
            console.error('Error descargando plantilla', err);
            this.showToast('Error', 'error', 'Error al descargar la plantilla desde el servidor.');
            this.saving.set(false);
          }
        });
      }
    } catch (e: any) {
      console.error("Error en exportarExcel:", e);
      this.showToast('Error', 'error', e.message || 'Ocurrió un error inesperado al exportar.');
      this.saving.set(false);
    }
  }

  importarExcel(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.saving.set(true);

    this.informesService.importTemplate(file).subscribe({
      next: (result: any) => {
        const title = `${result.tipo_plantilla}: ${result.nombre_origen || 'Importación'}`;
        let text = `📅 Período: ${result.periodo}\n`;
        text += `• Creados: ${result.creados}\n`;
        text += `• Actualizados: ${result.actualizados}`;
        if (result.omitidos > 0) {
          text += `\n• Omitidos: ${result.omitidos}`;
        }

        if (result.errores && result.errores.length > 0) {
          text += `\n\n⚠️ Errores:\n`;
          for (const e of result.errores.slice(0, 3)) {
            text += `Fila ${e.fila}: ${e.error}\n`;
          }
        }

        this.showToast(title, result.omitidos > 0 ? 'info' : 'success', text);
        input.value = '';
        this.loadResumen();
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Error importando plantilla:', err);
        const detail = err.error?.detail || 'Error desconocido al importar';
        this.showToast('Error de importación', 'error', detail);
        input.value = '';
        this.saving.set(false);
      }
    });
  }

  notificarWhatsApp(pub: InformeConPublicador) {
    const periodoId = this.getPeriodoId();
    if (!periodoId) return;

    this.saving.set(true);
    this.informesService.generarTokenNotificacion({
      id_publicador: pub.id_publicador,
      id_periodo: periodoId
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        const encodedMsg = encodeURIComponent(res.mensaje_wa);

        let waUrl = `https://wa.me/?text=${encodedMsg}`;
        if (res.telefono && res.telefono.trim() !== '') {
          // Limpiar teléfono (quitar +, espacios, guiones)
          const cleanPhone = res.telefono.replace(/[\+\-\s()]/g, '');
          waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

          // Abrir WhatsApp en nueva pestaña
          window.open(waUrl, '_blank');
          this.showToast('Enlace generado', 'success', 'Se ha abierto WhatsApp para enviar el mensaje.');

          // Actualizar contador visualmente
          pub.notificaciones_enviadas = (pub.notificaciones_enviadas || 0) + 1;
        } else {
          // Si no tiene teléfono, mostrar error explicativo
          this.showToast('Sin Teléfono', 'error', 'El publicador no tiene un número configurado. Por favor, edita su ficha y agrega su teléfono primero.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        const detail = err.error?.detail || 'No se pudo generar el enlace de WhatsApp.';
        this.showToast('Error', 'error', detail);
      }
    });
  }

  showToast(title: string, type: 'success' | 'error' | 'info' = 'success', text?: string) {
    this.toastMessage.set({ title, type, text });
    setTimeout(() => this.toastMessage.set(null), type === 'error' ? 8000 : 5000);
  }
}

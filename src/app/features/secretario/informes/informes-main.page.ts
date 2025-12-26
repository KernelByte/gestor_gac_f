import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InformesService } from './services/informes.service';
import { GruposService } from '../grupos/services/grupos.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ResumenMensual, InformeConPublicador, InformeLoteItem, Periodo, HistorialAnual, ResumenSucursal } from './models/informe.model';
import { InformesStatsComponent } from './components/informes-stats/informes-stats.component';
import { InformesFiltersComponent } from './components/informes-filters/informes-filters.component';
import { InformesTableComponent } from './components/informes-table/informes-table.component';

import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { PrivilegiosService } from '../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../privilegios/domain/models/publicador-privilegio';
import { saveAs } from 'file-saver';

@Component({
  standalone: true,
  selector: 'app-informes-main',
  imports: [CommonModule, FormsModule, InformesStatsComponent, InformesFiltersComponent, InformesTableComponent],
  templateUrl: './informes-main.page.html',
  styles: [`:host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }`]
})
export class InformesMainPage implements OnInit {
  private informesService = inject(InformesService);
  private gruposService = inject(GruposService);

  private authStore = inject(AuthStore);
  private http = inject(HttpClient);
  private privilegiosService = inject(PrivilegiosService);

  tabs = [
    { id: 'entrada', label: 'Entrada Mensual', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>' },
    { id: 'historial', label: 'Historial Anual', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>' },
    { id: 'sucursal', label: 'Resumen Sucursal', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' }
  ];

  activeTab = signal('entrada');
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

  // Restricted user detection: Publicador sin roles privilegiados
  isRestrictedUser = computed(() => {
    const user = this.authStore.user();
    if (!user) return true;
    const roles = user.roles ?? (user.rol ? [user.rol] : []);
    const rolesLower = roles.map(r => (r || '').toLowerCase());
    // Si tiene Administrador, Coordinador o Secretario -> NO restringido
    if (rolesLower.includes('administrador') || rolesLower.includes('coordinador') || rolesLower.includes('secretario')) {
      return false;
    }

    // Si tiene permiso explícito de "Ver Todos los Grupos" (Scope global)
    if (user.permisos?.includes('informes.editar_todos')) {
      return false;
    }

    return true; // Solo Publicador u otros roles menores -> Restringido
  });

  visibleTabs = computed(() => {
    if (this.isRestrictedUser()) {
      return this.tabs.filter(t => t.id === 'entrada');
    }
    return this.tabs;
  });

  meses = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ];
  anos = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

  async ngOnInit() {
    // Primero inicializar para usuarios restringidos (precargar grupo)
    await this.initializeForRestrictedUser();
    // Luego cargar datos (ya con el grupo correcto si es restringido)
    this.loadResumen();
    this.loadGrupos();
    this.loadPrivilegiosData();
  }

  private async initializeForRestrictedUser() {
    if (this.isRestrictedUser()) {
      // Precargar grupo del publicador
      const user = this.authStore.user();
      if (user?.id_usuario_publicador) {
        // Necesitamos obtener el grupo del publicador desde el backend
        try {
          const publicador = await lastValueFrom(
            this.http.get<any>(`/api/publicadores/${user.id_usuario_publicador}`)
          );
          if (publicador?.id_grupo_publicador) {
            this.selectedGrupo = publicador.id_grupo_publicador;
            this.vistaGrupo.set(true);
            console.log('Restricted user group set to:', this.selectedGrupo);
          }
        } catch (e) {
          console.error('Error loading publicador data for restricted user:', e);
        }
      }
    }
  }

  async loadPrivilegiosData() {
    try {
      // 1. Load Catalog
      const catalog = await lastValueFrom(this.privilegiosService.getPrivilegios());
      this.privilegios.set(catalog);

      // 2. Load Assignments
      const allPrivilegios = await lastValueFrom(this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/'));

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
    const congregacionId = this.authStore.user()?.id_congregacion;
    this.gruposService.getGrupos({ congregacion_id: congregacionId }).subscribe({
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
    const congregacionId = this.authStore.user()?.id_congregacion || 1;
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
    const { pub, field, value } = event;
    const existing = this.localChanges.get(pub.id_publicador) || { id_publicador: pub.id_publicador, participo: pub.participo ?? false, cursos_biblicos: pub.cursos_biblicos ?? 0, horas: pub.horas ?? 0, observaciones: pub.observaciones };

    if (field === 'participo') {
      existing.participo = value;
      // Si se desmarca, limpiar los otros campos
      if (!value) {
        existing.horas = 0;
        existing.cursos_biblicos = 0;
        existing.observaciones = null;
      }
    }
    else if (field === 'cursos') existing.cursos_biblicos = value;
    else if (field === 'horas') existing.horas = value;
    else if (field === 'notas') existing.observaciones = value;

    this.localChanges.set(pub.id_publicador, existing);
  }

  guardarTodo() {
    if (this.localChanges.size === 0) return;
    this.saving.set(true);

    const items: InformeLoteItem[] = Array.from(this.localChanges.values()).map(c => ({
      id_publicador: c.id_publicador!,
      participo: c.participo ?? false,
      cursos_biblicos: c.cursos_biblicos ?? 0,
      horas: c.horas ?? 0,
      observaciones: c.observaciones ?? null
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
    const periodo = `${this.selectedAno}-${this.getMesLabel(this.selectedMes)}`;
    const congregacionId = this.authStore.user()?.id_congregacion;

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
          alert('Error al descargar la plantilla desde el servidor.');
          this.saving.set(false);
        }
      });
    } else {
      // Descargar toda la congregación
      this.informesService.exportTemplateCongregacion(this.getPeriodoId(), congregacionId!).subscribe({
        next: (blob) => {
          const filename = `Informe_Congregacion_${periodo}.xlsx`;
          saveAs(blob, filename);
          this.saving.set(false);
        },
        error: (err) => {
          console.error('Error descargando plantilla', err);
          alert('Error al descargar la plantilla desde el servidor.');
          this.saving.set(false);
        }
      });
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

  showToast(title: string, type: 'success' | 'error' | 'info' = 'success', text?: string) {
    this.toastMessage.set({ title, type, text });
    setTimeout(() => this.toastMessage.set(null), type === 'error' ? 8000 : 5000);
  }
}

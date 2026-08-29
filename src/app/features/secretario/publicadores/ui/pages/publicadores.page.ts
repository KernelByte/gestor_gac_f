import { Component, inject, OnInit, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PublicadoresFacade } from '../../application/publicadores.facade';
import { DeleteOpcion, Publicador, UsuarioVinculado } from '../../domain/models/publicador';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../../../core/congregacion-context/congregacion-context.service';
import { HttpClient } from '@angular/common/http';
import { forkJoin, lastValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PrivilegiosService } from '../../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../../privilegios/domain/models/publicador-privilegio';
import {
  MOTIVOS_CONSIDERACION,
  MotivoConsideracion,
  PrecursorConsideracion,
} from '../../../privilegios/domain/models/precursor-consideracion';
import { DatePickerComponent } from '../../../../../shared/components/date-picker/date-picker.component';
import { whatsappUrl } from '../../../../../shared/whatsapp';
import { getInitialAvatarStyle } from '../../../../../core/utils/avatar-style.util';
import {
  NuevoPublicadorWizardComponent,
  NuevoPublicadorResult,
} from '../components/nuevo-publicador-wizard/nuevo-publicador-wizard.component';
import { environment } from '../../../../../../environments/environment';

interface Estado {
  id_estado: number;
  tipo: string;
  nombre_estado: string;
}

interface Grupo {
  id_grupo: number;
  nombre_grupo: string;
  capitan_grupo?: string;
}

type TabType = 'personal' | 'teocratico' | 'emergencia';

interface ContactoEmergencia {
  id_contacto_emergencia?: number;
  id_publicador: number;
  nombre: string;
  telefono?: string;
  parentesco?: string;
  direccion?: string;
  etiqueta?: string;
  es_principal?: boolean;
  solo_urgencias?: boolean;
}

interface Congregacion {
  id_congregacion: number;
  nombre_congregacion: string;
}

interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  adminOnly?: boolean;
  optional?: boolean;
}

@Component({
  standalone: true,
  selector: 'app-publicadores-list',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePickerComponent, NuevoPublicadorWizardComponent],
  templateUrl: './publicadores.page.html',
  styleUrl: './publicadores.page.scss',
})
export class PublicadoresListComponent implements OnInit {
  private facade = inject(PublicadoresFacade);
  private authStore = inject(AuthStore);
  // Público: la plantilla pasa la congregación en contexto al asistente de alta.
  congregacionContext = inject(CongregacionContextService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private privilegiosService = inject(PrivilegiosService);
  vm = this.facade.vm;
  Math = Math;

  // UI State
  panelOpen = signal(false);
  deleteModalOpen = signal(false);
  saving = signal(false);
  exporting = signal(false);
  showExportMenu = signal(false);
  showMoreOptions = signal(false);

  // Asistente de alta. El panel lateral quedó sólo para editar: crear y editar
  // son tareas distintas y compartían un formulario de ~25 campos.
  wizardOpen = signal(false);
  creating = signal(false);
  /** Último publicador creado, para resaltar su fila en la lista. */
  justCreatedId = signal<number | null>(null);
  viewingPublicador = signal<Publicador | null>(null);
  editingPublicador = signal<Publicador | null>(null);
  publicadorToDelete = signal<Publicador | null>(null);
  contactoToDelete = signal<ContactoEmergencia | null>(null);
  deleteContactoModalOpen = signal(false);
  isDeletingContacto = signal(false);
  activeTab = signal<TabType>('personal');

  // Consentimiento PDF State
  uploadingPdf = signal(false);
  pdfError = signal<string | null>(null);

  // Client-Side Filter & Pagination State
  searchQuery = signal('');
  selectedEstado = signal<number | null>(null);
  selectedGrupo: number | null = null;

  currentPage = signal(1);
  pageSize = 20;

  // Advanced Filters
  showAdvancedFilters = signal(false);
  selectedGruposFilter = signal<number[]>([]);
  selectedPrivilegiosFilter = signal<number[]>([]);
  selectedSexoFilter = signal<string[]>([]);
  selectedConsentimientoFilter = signal<boolean | null>(null);
  selectedBarriosFilter = signal<string[]>([]);

  sortOrder = signal<{ col: string; dir: 'asc' | 'desc' }[]>([]);

  activeFiltersCount = computed(() =>
    this.selectedGruposFilter().length +
    this.selectedPrivilegiosFilter().length +
    this.selectedSexoFilter().length +
    (this.selectedConsentimientoFilter() !== null ? 1 : 0) +
    this.selectedBarriosFilter().length
  );

  hasCustomView = computed(() => {
    if (this.activeFiltersCount() > 0) return true;
    if (this.sortOrder().length > 0) return true;
    const current = this.columnConfig();
    const defaults = this.MOVEABLE_COLUMNS_DEFAULT;
    if (current.length !== defaults.length) return true;
    return current.some((col, i) => col.id !== defaults[i].id || col.visible !== defaults[i].visible);
  });

  uniqueBarrios = computed(() => {
    const barrios = this.rawList()
      .map(p => p.barrio)
      .filter((b): b is string => !!b && b.trim().length > 0);
    return [...new Set(barrios)].sort((a, b) => a.localeCompare(b, 'es'));
  });

  privilegiosEnCongregacion = computed(() => {
    const map = this.publicadorPrivilegiosMap();
    const pubIds = new Set(this.rawList().map(p => p.id_publicador));
    const usedIds = new Set<number>();
    for (const [pubId, privIds] of map.entries()) {
      if (pubIds.has(pubId)) privIds.forEach(id => usedIds.add(id));
    }
    return this.privilegios().filter(p => usedIds.has(p.id_privilegio));
  });

  // ─── Column Manager ──────────────────────────────────────────────────────
  private readonly COL_STORAGE_KEY = 'gac_pub_col_v3';
  private _draggedColIdx: number | null = null;
  draggedColId = signal<string | null>(null);
  showColumnManager = signal(false);
  columnConfig = signal<TableColumn[]>([]);

  readonly MOVEABLE_COLUMNS_DEFAULT: TableColumn[] = [
    { id: 'congregacion', label: 'Congregación', visible: true, adminOnly: true },
    { id: 'grupo', label: 'Grupo', visible: true },
    { id: 'fecha_nacimiento', label: 'Fecha Nac.', visible: true },
    { id: 'fecha_bautismo', label: 'Fecha Bau.', visible: true },
    { id: 'telefono', label: 'Teléfono', visible: true },
    { id: 'sexo', label: 'Sexo', visible: false, optional: true },
    { id: 'direccion', label: 'Dirección', visible: false, optional: true },
    { id: 'barrio', label: 'Barrio', visible: false, optional: true },
    { id: 'consentimiento_datos', label: 'Consentimiento', visible: false, optional: true },
    { id: 'fecha_inicio_informe', label: 'Inicio Inf.', visible: false, optional: true },
    { id: 'fecha_inactividad', label: 'Inactividad', visible: false, optional: true },
    { id: 'fecha_creacion', label: 'Fecha Registro', visible: false, optional: true },
  ];

  visibleMoveableColumns = computed(() => {
    const isAdmin = this.isAdminOrGestor();
    return this.columnConfig().filter(col => col.visible && (!col.adminOnly || isAdmin));
  });

  columnManagerList = computed(() => {
    const isAdmin = this.isAdminOrGestor();
    return this.columnConfig().filter(col => !col.adminOnly || isAdmin);
  });

  hasOptionalColumnsVisible = computed(() =>
    this.columnConfig().some(col => col.optional && col.visible)
  );

  totalVisibleColCount = computed(() =>
    1 + this.visibleMoveableColumns().length + 1 + 1
  );

  // Auxiliary Data
  estados = signal<Estado[]>([]);
  grupos = signal<Grupo[]>([]);
  congregaciones = signal<Congregacion[]>([]);
  contactos = signal<ContactoEmergencia[]>([]);
  quickViewContactos = signal<ContactoEmergencia[]>([]);
  showContactoForm = signal(false);
  startEditingContacto = signal(false);
  sexoDropdownOpen = signal(false);
  editingContacto = signal<ContactoEmergencia | null>(null);

  // Privileges Data for List View
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map());

  // Toast Notification
  toastMessage = signal<{
    text: string,
    type: 'success' | 'error' | 'warning',
    actions?: { label: string, run: () => void }[]
  } | null>(null);

  // Modal de confirmación para privilegios
  privilegioToDelete = signal<number | null>(null);
  deletePrivilegioModalOpen = signal(false);

  confirmDeletePrivilegio(id: number) {
    this.privilegioToDelete.set(id);
    this.deletePrivilegioModalOpen.set(true);
  }

  closeDeletePrivilegioModal() {
    this.deletePrivilegioModalOpen.set(false);
    this.privilegioToDelete.set(null);
  }

  // Inline close (fecha_fin) for active privileges
  closingPrivilegioId = signal<number | null>(null);
  closingPrivilegioFechaFin = signal<string>('');

  startClosingPrivilegio(id: number) {
    this.closingPrivilegioId.set(id);
    this.closingPrivilegioFechaFin.set('');
  }

  cancelClosingPrivilegio() {
    this.closingPrivilegioId.set(null);
    this.closingPrivilegioFechaFin.set('');
  }

  confirmClosingPrivilegio() {
    const id = this.closingPrivilegioId();
    const fecha = this.closingPrivilegioFechaFin();
    const pub = this.editingPublicador();
    if (!id || !fecha || !pub) return;

    this.privilegiosService.updatePublicadorPrivilegio(id, { fecha_fin: fecha }).subscribe({
      next: () => {
        this.loadPublicadorPrivilegios(pub.id_publicador);
        this.showToast('Privilegio cerrado correctamente', 'success');
        this.cancelClosingPrivilegio();
      },
      error: (err) => this.showToast('Error: ' + (err.error?.detail || err.message), 'error')
    });
  }

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  showToast(
    text: string,
    type: 'success' | 'error' | 'warning' = 'success',
    actions?: { label: string, run: () => void }[]
  ) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set({ text, type, actions });
    // Con acciones hay que leer y decidir: 3 s no alcanzan.
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), actions?.length ? 8000 : 3000);
  }

  runToastAction(accion: { label: string, run: () => void }) {
    this.toastMessage.set(null);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    accion.run();
  }

  // ── Login Simple (PIN) ────────────────────────────────────────────────────
  savingPin = signal(false);

  async regenerarPin(idPublicador: number) {
    if (this.savingPin()) return;
    this.savingPin.set(true);
    try {
      const updated = await lastValueFrom(
        this.http.patch<any>(`/api/publicadores/${idPublicador}/regenerar-pin`, {})
      );
      const current = this.editingPublicador();
      if (current) {
        this.editingPublicador.set({ ...current, codigo_pin: updated.codigo_pin });
      }
      this.facade.load();
      this.showToast(`Nuevo PIN: ${updated.codigo_pin}`, 'success');
    } catch {
      this.showToast('Error al regenerar el PIN', 'error');
    } finally {
      this.savingPin.set(false);
    }
  }

  sendingWhatsapp = signal(false);

  enviarCredencialesWhatsapp() {
    const pub = this.editingPublicador();
    if (!pub || !pub.codigo_pin) return;
    
    this.sendingWhatsapp.set(true);
    
    // Obtenemos la configuracion para el codigo de la congregacion
    this.http.get<any>(`${environment.apiUrl}/configuracion/`).subscribe({
      next: (config) => {
        this.sendingWhatsapp.set(false);
        const codigoCongregacion = config.codigo_seguridad || 'No configurado';
        const pin = pub.codigo_pin;
        const nombre = pub.primer_nombre || 'Publicador';
        
        let telefono = pub.telefono;
        if (!telefono) {
            this.showToast('El publicador no tiene un teléfono registrado.', 'error');
            return;
        }

        telefono = telefono.replace(/\D/g, '');
        if (!telefono.startsWith('57') && telefono.length === 10) {
            telefono = '57' + telefono;
        }

        const mensaje = `Hola ${nombre},\n\nTus datos de acceso a la App Móvil son:\n\n*Código de Congregación:* ${codigoCongregacion}\n*CÓDIGO PIN:* ${pin}\n\nPuedes ingresar de forma segura usando estos datos.`;
        
        window.open(whatsappUrl(mensaje, telefono), '_blank');
      },
      error: (err) => {
        console.error('Error obteniendo código de congregación:', err);
        this.sendingWhatsapp.set(false);
        this.showToast('No se pudo obtener el código de congregación.', 'error');
      }
    });
  }

  copyPin(pin?: string | null) {
    if (!pin) return;
    navigator.clipboard.writeText(pin).then(() => {
      this.showToast(`PIN copiado: ${pin}`, 'success');
    }).catch(() => {
      this.showToast('No se pudo copiar el PIN', 'error');
    });
  }

  // Role Check - Solo admin y gestor pueden ver el ID
  isAdminOrGestor = computed(() => {
    const user = this.authStore.user();
    const rol = user?.rol?.toLowerCase() || '';
    return rol.includes('admin') || rol.includes('gestor');
  });

  isSecretario = computed(() => {
    const user = this.authStore.user();
    const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
    return roles.includes('secretario');
  });

  canEditPublicadores = computed(() =>
    this.isAdminOrGestor() || this.isSecretario() || this.authStore.hasPermission('publicadores.editar')
  );

  canExportPublicadores = computed(() => {
    const user = this.authStore.user();
    const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
    return roles.some(r => ['administrador', 'gestor aplicación', 'coordinador', 'secretario', 'superintendente de servicio', 'publicador'].includes(r));
  });

  isScopedToGroup = computed(() =>
    !this.isAdminOrGestor() && !this.isSecretario() && !this.authStore.hasPermission('publicadores.ver_todos')
  );

  // Form
  publicadorForm: FormGroup;
  contactoForm: FormGroup;

  // Privilegios Signals
  privilegios = signal<Privilegio[]>([]);

  private readonly PRIVILEGIOS_EXCLUIDOS_ASIGNACION = [
    'audio', 'vigilancia', 'acomodador', 'video', 'micrófono', 'microfono', 'plataforma'
  ];

  // Orden lógico del selector: primero los cargos, luego el precursorado.
  // Evita que "Precursor Regular" y "Siervo Ministerial" queden pegados
  // (el backend devuelve el catálogo alfabéticamente) y se elija uno por otro.
  private readonly ORDEN_PRIVILEGIOS_ASIGNABLES = [
    'superintendente', 'anciano', 'siervo ministerial',
    'precursor especial', 'precursor regular', 'precursor auxiliar',
  ];

  private ordenPrivilegio(nombre: string): number {
    const i = this.ORDEN_PRIVILEGIOS_ASIGNABLES.indexOf(nombre.toLowerCase());
    return i === -1 ? this.ORDEN_PRIVILEGIOS_ASIGNABLES.length : i;
  }

  privilegiosAsignables = computed(() =>
    this.privilegios()
      .filter(p =>
        !this.PRIVILEGIOS_EXCLUIDOS_ASIGNACION.includes(p.nombre_privilegio.toLowerCase())
      )
      .slice()
      .sort((a, b) => this.ordenPrivilegio(a.nombre_privilegio) - this.ordenPrivilegio(b.nombre_privilegio))
  );

  /** true en el primer "precursor…" de la lista: el template dibuja un separador antes. */
  esInicioGrupoPrecursor(p: Privilegio, index: number): boolean {
    if (!p.nombre_privilegio.toLowerCase().includes('precursor')) return false;
    const prev = this.privilegiosAsignables()[index - 1];
    return !prev || !prev.nombre_privilegio.toLowerCase().includes('precursor');
  }

  publicadorPrivilegios = signal<PublicadorPrivilegio[]>([]);
  /** Privilegios de la Vista Rápida: signal aparte para no pisar los del panel de edición. */
  quickViewPrivilegios = signal<PublicadorPrivilegio[]>([]);
  /** true mientras se cargan los privilegios del publicador en edición. */
  privilegiosLoading = signal(false);
  /** Secuencia de peticiones: descarta respuestas que llegan fuera de orden. */
  private privilegiosReqSeq = 0;
  // Cache de eliminabilidad por id_publicador_privilegio (lo consulta el backend)
  eliminableMap = signal<Map<number, { eliminable: boolean; motivo: string | null }>>(new Map());

  isPrivilegioEliminable(id: number): boolean {
    const entry = this.eliminableMap().get(id);
    // Default conservador: hasta saber, asumimos NO eliminable (el botón queda deshabilitado).
    return entry?.eliminable ?? false;
  }

  motivoNoEliminable(id: number): string {
    return this.eliminableMap().get(id)?.motivo ?? 'Verificando…';
  }
  newPrivilegio = signal<{ id_privilegio: number | null, fecha_inicio: string, fecha_fin: string | null }>({
    id_privilegio: null,
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: null
  });

  // Grupos de privilegios mutuamente excluyentes. Debe coincidir con el backend:
  // publicador_privilegio_service.GRUPOS_EXCLUSIVOS (solo uno activo por grupo).
  private readonly GRUPOS_EXCLUSIVOS_PRIVILEGIOS: string[][] = [
    ['precursor regular', 'precursor auxiliar'],
    ['anciano', 'siervo ministerial'],
  ];

  privilegioConflictoMsg = computed<string | null>(() => {
    const id = this.newPrivilegio().id_privilegio;
    if (!id) return null;

    const nombre = this.getPrivilegioNombre(Number(id)).toLowerCase();
    const activos = this.publicadorPrivilegios().filter(p => !p.fecha_fin);

    if (activos.some(p => p.id_privilegio === Number(id))) {
      return `El publicador ya tiene "${this.getPrivilegioNombre(Number(id))}" activo. Usá "Finalizar" si querés cerrarlo.`;
    }

    const grupo = this.GRUPOS_EXCLUSIVOS_PRIVILEGIOS.find(g => g.includes(nombre));
    if (grupo) {
      const enConflicto = activos.find(p =>
        p.id_privilegio !== Number(id) &&
        grupo.includes(this.getPrivilegioNombre(p.id_privilegio).toLowerCase())
      );
      if (enConflicto) {
        const nombreConflicto = this.getPrivilegioNombre(enConflicto.id_privilegio);
        return `El publicador ya tiene "${nombreConflicto}" activo. Cerralo primero (botón "Finalizar").`;
      }
    }

    return null;
  });

  // ── Consideración especial (exención del requisito de horas) ──────────────
  // Solo aplica a precursores regulares: por edad avanzada o salud delicada
  // conservan el nombramiento sin tener que cumplir las 50 h/mes.
  // NO tiene relación con las horas de crédito (Betel, Salón de Asambleas).
  readonly motivosConsideracion = MOTIVOS_CONSIDERACION;

  consideraciones = signal<PrecursorConsideracion[]>([]);
  newConsideracion = signal<{ motivo: MotivoConsideracion; fecha_inicio: string; descripcion: string }>({
    motivo: 'salud',
    fecha_inicio: new Date().toISOString().split('T')[0],
    descripcion: ''
  });
  motivoDropdownOpen = signal(false);
  closingConsideracionId = signal<number | null>(null);
  closingConsideracionFechaFin = signal<string>('');
  consideracionToDelete = signal<number | null>(null);

  /** El publicador editado es (o fue) precursor regular. */
  esPrecursorRegular = computed(() =>
    this.publicadorPrivilegios().some(p =>
      this.getPrivilegioNombre(p.id_privilegio).toLowerCase().includes('precursor regular')
    )
  );

  /** Consideración vigente (sin fecha_fin) del publicador editado. */
  consideracionVigente = computed(() =>
    this.consideraciones().find(c => !c.fecha_fin) ?? null
  );

  getMotivoLabel(motivo: MotivoConsideracion): string {
    return MOTIVOS_CONSIDERACION.find(m => m.value === motivo)?.label ?? motivo;
  }

  updateNewConsideracion(field: 'motivo' | 'fecha_inicio' | 'descripcion', value: any) {
    this.newConsideracion.update(prev => ({ ...prev, [field]: value }));
  }

  selectMotivo(motivo: MotivoConsideracion) {
    this.updateNewConsideracion('motivo', motivo);
    this.motivoDropdownOpen.set(false);
  }

  canAddConsideracion(): boolean {
    const c = this.newConsideracion();
    return !!c.fecha_inicio && !!c.motivo && !this.consideracionVigente();
  }

  loadConsideraciones(id: number) {
    this.privilegiosService.getConsideraciones(id).subscribe({
      next: (data) => this.consideraciones.set(data),
      error: (err) => console.error('Error cargando consideraciones especiales', err)
    });
  }

  addConsideracion() {
    const pub = this.editingPublicador();
    if (!pub || !this.canAddConsideracion()) return;

    const data = this.newConsideracion();
    this.privilegiosService.createConsideracion({
      id_publicador: pub.id_publicador,
      fecha_inicio: data.fecha_inicio,
      motivo: data.motivo,
      descripcion: data.descripcion?.trim() || null
    }).subscribe({
      next: () => {
        this.loadConsideraciones(pub.id_publicador);
        this.newConsideracion.set({
          motivo: 'salud',
          fecha_inicio: new Date().toISOString().split('T')[0],
          descripcion: ''
        });
        this.showToast('Consideración especial otorgada', 'success');
      },
      error: (err) => this.showToast(
        'Error: ' + (err.error?.detail || 'No se pudo otorgar la consideración'), 'error'
      )
    });
  }

  startClosingConsideracion(id: number) {
    this.closingConsideracionId.set(id);
    this.closingConsideracionFechaFin.set('');
  }

  cancelClosingConsideracion() {
    this.closingConsideracionId.set(null);
    this.closingConsideracionFechaFin.set('');
  }

  confirmClosingConsideracion() {
    const id = this.closingConsideracionId();
    const fecha = this.closingConsideracionFechaFin();
    const pub = this.editingPublicador();
    if (!id || !fecha || !pub) return;

    this.privilegiosService.updateConsideracion(id, { fecha_fin: fecha }).subscribe({
      next: () => {
        this.loadConsideraciones(pub.id_publicador);
        this.showToast('Consideración finalizada. Vuelve a aplicar el requisito de horas.', 'success');
        this.cancelClosingConsideracion();
      },
      error: (err) => this.showToast('Error: ' + (err.error?.detail || err.message), 'error')
    });
  }

  confirmDeleteConsideracion(id: number) {
    this.consideracionToDelete.set(id);
  }

  closeDeleteConsideracionModal() {
    this.consideracionToDelete.set(null);
  }

  executeDeleteConsideracion() {
    const id = this.consideracionToDelete();
    const pub = this.editingPublicador();
    if (id === null || !pub) return;

    this.privilegiosService.deleteConsideracion(id).subscribe({
      next: () => {
        this.loadConsideraciones(pub.id_publicador);
        this.showToast('Consideración eliminada', 'success');
        this.closeDeleteConsideracionModal();
      },
      error: (err) => {
        this.showToast('Error al eliminar: ' + (err.error?.detail || err.message), 'error');
        this.closeDeleteConsideracionModal();
      }
    });
  }

  constructor() {
    effect(() => {
      this.congregacionContext.effectiveCongregacionId();
      untracked(() => {
        this.loadData();
        this.loadAuxiliaryData();
      });
    });
    // Configurar validaciones de contraseña si fuera necesario
    this.publicadorForm = this.fb.group({
      primer_nombre: ['', [Validators.required, Validators.maxLength(100)]],
      segundo_nombre: ['', Validators.maxLength(100)],
      primer_apellido: ['', [Validators.required, Validators.maxLength(100)]],
      segundo_apellido: ['', Validators.maxLength(100)],
      sexo: [''],
      fecha_nacimiento: [null],
      telefono: [''],
      direccion: [''],
      barrio: [''],
      fecha_bautismo: [null],
      ungido: [false],
      id_grupo_publicador: [null],
      id_congregacion_publicador: [null],
      id_estado_publicador: [null, Validators.required],
      consentimiento_datos: [false],
      fecha_inicio_informe: [null],
      permite_login_simple: [true]
    });

    this.contactoForm = this.fb.group({
      nombre: ['', Validators.required],
      parentesco: [''],
      telefono: [''],
      direccion: [''],
      etiqueta: [''],
      es_principal: [false],
      solo_urgencias: [false]
    });
  }

  ngOnInit(): void {
    this.initColumnConfig();
  }

  // Computed values
  estadosPublicador = computed(() => {
    return this.estados().filter(e => e.tipo === 'Teocratico');
  });

  rawList = computed(() => this.vm().list);

  // Modern Search Helper: Multi-term, full-text match
  matchesSearch(p: Publicador, q: string): boolean {
    const terms = q.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return true;

    const searchableText = [
      p.primer_nombre,
      p.segundo_nombre,
      p.primer_apellido,
      p.segundo_apellido,
      p.telefono
    ].filter(Boolean).join(' ').toLowerCase();

    return terms.every(term => searchableText.includes(term));
  }

  // Filter Logic
  filteredList = computed(() => {
    let list = this.rawList();
    const q = this.searchQuery();
    const estadoId = this.selectedEstado();

    if (q && q.trim()) {
      list = list.filter(p => this.matchesSearch(p, q));
    }

    if (estadoId !== null) {
      list = list.filter(p => p.id_estado_publicador === estadoId);
    }

    // Filter by Grupo (Multi-select)
    const grupoIds = this.selectedGruposFilter();
    if (grupoIds.length > 0) {
      list = list.filter(p => p.id_grupo_publicador && grupoIds.includes(p.id_grupo_publicador));
    }

    // Filter by Privileges (Multi-select)
    const privIds = this.selectedPrivilegiosFilter();
    if (privIds.length > 0) {
      const map = this.publicadorPrivilegiosMap();
      list = list.filter(p => {
        const userPrivs = map.get(p.id_publicador) || [];
        // Check if user has ANY of the selected privileges
        return privIds.some(id => userPrivs.includes(id));
      });
    }

    // Filter by Sexo (Multi-select: M / F)
    const sexos = this.selectedSexoFilter();
    if (sexos.length > 0) {
      list = list.filter(p => p.sexo && sexos.includes(p.sexo));
    }

    // Filter by Barrio (Multi-select)
    const barrios = this.selectedBarriosFilter();
    if (barrios.length > 0) {
      list = list.filter(p => p.barrio && barrios.includes(p.barrio));
    }

    // Filter by Consentimiento (true / false / null=sin filtro)
    const consent = this.selectedConsentimientoFilter();
    if (consent !== null) {
      list = list.filter(p => !!p.consentimiento_datos === consent);
    }

    return list;
  });

  // Filter Helpers
  toggleGrupoFilter(id: number) {
    this.selectedGruposFilter.update(current => {
      if (current.includes(id)) return current.filter(x => x !== id);
      return [...current, id];
    });
    this.currentPage.set(1);
  }

  togglePrivilegioFilter(id: number) {
    this.selectedPrivilegiosFilter.update(current => {
      if (current.includes(id)) return current.filter(x => x !== id);
      return [...current, id];
    });
    this.currentPage.set(1);
  }

  clearFilters() {
    this.selectedGruposFilter.set([]);
    this.selectedPrivilegiosFilter.set([]);
    this.selectedSexoFilter.set([]);
    this.selectedConsentimientoFilter.set(null);
    this.selectedBarriosFilter.set([]);
    this.showAdvancedFilters.set(false);
    this.currentPage.set(1);
  }

  toggleSexoFilter(sexo: string) {
    this.selectedSexoFilter.update(current =>
      current.includes(sexo) ? current.filter(s => s !== sexo) : [...current, sexo]
    );
    this.currentPage.set(1);
  }

  setConsentimientoFilter(value: boolean) {
    const current = this.selectedConsentimientoFilter();
    this.selectedConsentimientoFilter.set(current === value ? null : value);
    this.currentPage.set(1);
  }

  toggleBarrioFilter(barrio: string) {
    this.selectedBarriosFilter.update(current =>
      current.includes(barrio) ? current.filter(b => b !== barrio) : [...current, barrio]
    );
    this.currentPage.set(1);
  }

  // ─── Sort Helpers ────────────────────────────────────────────────────────
  getSortIndex(col: string): number {
    return this.sortOrder().findIndex(s => s.col === col);
  }

  getSortDir(col: string): 'asc' | 'desc' {
    return this.sortOrder().find(s => s.col === col)?.dir ?? 'asc';
  }

  getSortColLabel(col: string): string {
    const all: { id: string; label: string }[] = [
      { id: 'nombre', label: 'Nombre' },
      { id: 'estado', label: 'Estado' },
      ...this.MOVEABLE_COLUMNS_DEFAULT,
    ];
    return all.find(c => c.id === col)?.label ?? col;
  }

  toggleSort(col: string, event: MouseEvent) {
    const isShift = event.shiftKey;
    const current = this.sortOrder();
    const idx = current.findIndex(s => s.col === col);

    if (idx >= 0) {
      const updated = [...current];
      updated[idx] = { col, dir: updated[idx].dir === 'asc' ? 'desc' : 'asc' };
      this.sortOrder.set(updated);
    } else if (isShift && current.length > 0) {
      this.sortOrder.set([...current, { col, dir: 'asc' }]);
    } else {
      this.sortOrder.set([{ col, dir: 'asc' }]);
    }
    this.currentPage.set(1);
  }

  resetSort() {
    this.sortOrder.set([]);
    this.currentPage.set(1);
  }

  removeSortCriteria(index: number) {
    this.sortOrder.set(this.sortOrder().filter((_, j) => j !== index));
    this.currentPage.set(1);
  }

  // ─── Column Manager Methods ───────────────────────────────────────────────
  initColumnConfig() {
    try {
      const stored = localStorage.getItem(this.COL_STORAGE_KEY);
      if (stored) {
        const parsed: TableColumn[] = JSON.parse(stored);
        const merged = this.MOVEABLE_COLUMNS_DEFAULT.map(def => {
          const found = parsed.find(p => p.id === def.id);
          return found ? { ...def, visible: found.visible } : def;
        });
        const storedIds = parsed.map(p => p.id);
        const ordered = [
          ...parsed.filter(p => merged.some(m => m.id === p.id)).map(p => merged.find(m => m.id === p.id)!),
          ...merged.filter(m => !storedIds.includes(m.id))
        ];
        this.columnConfig.set(ordered);
      } else {
        this.columnConfig.set([...this.MOVEABLE_COLUMNS_DEFAULT]);
      }
    } catch {
      this.columnConfig.set([...this.MOVEABLE_COLUMNS_DEFAULT]);
    }
  }

  saveColumnConfig() {
    try { localStorage.setItem(this.COL_STORAGE_KEY, JSON.stringify(this.columnConfig())); } catch { }
  }

  toggleColumnVisibility(id: string) {
    this.columnConfig.update(cols => cols.map(col => col.id === id ? { ...col, visible: !col.visible } : col));
    this.saveColumnConfig();
  }

  resetColumns() {
    this.columnConfig.set([...this.MOVEABLE_COLUMNS_DEFAULT]);
    this.saveColumnConfig();
  }

  resetAll() {
    this.clearFilters();
    this.resetColumns();
    this.resetSort();
  }

  // ─── Vista Rápida ────────────────────────────────────────────────────────
  openQuickView(p: Publicador) {
    this.viewingPublicador.set(p);
    this.loadQuickViewPrivilegios(p.id_publicador);
    this.loadQuickViewContactos(p.id_publicador);
  }

  closeQuickView() {
    this.viewingPublicador.set(null);
    this.quickViewContactos.set([]);
    this.quickViewPrivilegios.set([]);
  }

  async loadQuickViewContactos(idPublicador: number) {
    try {
      const res = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', {
        params: { id_publicador: idPublicador }
      }));
      this.quickViewContactos.set(res || []);
    } catch (e) {
      console.error('Error loading contactos emergencia (quick view)', e);
      this.quickViewContactos.set([]);
    }
  }

  editFromQuickView() {
    const p = this.viewingPublicador();
    if (!p) return;
    this.closeQuickView();
    this.openEditForm(p);
  }

  // ─── Exportación ─────────────────────────────────────────────────────────
  exportData(format: 'excel' | 'pdf') {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.showExportMenu.set(false);

    // Columnas visibles en el mismo orden que la tabla: Nombre, [dinámicas], Estado
    const allColumns = [
      { id: 'nombre', label: 'Nombre' },
      ...this.visibleMoveableColumns().map(c => ({ id: c.id, label: c.label })),
      { id: 'estado', label: 'Estado' },
    ];

    // Serializar cada fila con los valores ya formateados (igual a como se muestran en pantalla)
    const rows = this.sortedList().map(p => {
      const row: Record<string, string> = {};
      for (const col of allColumns) {
        row[col.id] = this.getExportCellValue(p, col.id);
      }
      return row;
    });

    const titulo = 'Listado de Publicadores';
    const endpoint = `/api/publicadores/export/${format}`;

    this.http.post(endpoint, { columns: allColumns, rows, titulo }, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const ext = format === 'excel' ? 'xlsx' : 'pdf';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${titulo.replace(/ /g, '_')}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
      },
    });
  }

  private getExportCellValue(p: Publicador, colId: string): string {
    switch (colId) {
      case 'nombre': return this.getFullName(p);
      case 'congregacion': return p.nombre_congregacion ?? '';
      case 'grupo': return this.getGrupoNombre(p.id_grupo_publicador);
      case 'fecha_nacimiento': return p.fecha_nacimiento ? this.formatDateExport(p.fecha_nacimiento) : '';
      case 'fecha_bautismo': return p.fecha_bautismo ? this.formatDateExport(p.fecha_bautismo) : '';
      case 'fecha_inicio_informe': return p.fecha_inicio_informe ? this.formatDateExport(p.fecha_inicio_informe) : '';
      case 'fecha_inactividad': return p.fecha_inactividad ? this.formatDateExport(p.fecha_inactividad) : '';
      case 'telefono': return p.telefono ?? '';
      case 'sexo': return p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : (p.sexo ?? '');
      case 'direccion': return p.direccion ?? '';
      case 'barrio': return p.barrio ?? '';
      case 'consentimiento_datos': return p.consentimiento_datos ? 'Sí' : 'No';
      case 'fecha_creacion': return p.fecha_creacion ? this.formatDateExport(p.fecha_creacion) : '';
      case 'estado': return this.getEstadoNombre(p.id_estado_publicador);
      default: return '';
    }
  }

  formatDateExport(dateStr: string): string {
    if (!dateStr) return '';
    try {
      // Parse YYYY-MM-DD or full ISO string without timezone shift
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
      }
      const d = new Date(dateStr);
      const userTimezoneOffset = d.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(d.getTime() + userTimezoneOffset);
      return adjustedDate.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  onColDragStart(index: number, event: DragEvent) {
    this._draggedColIdx = index;
    this.draggedColId.set(this.columnConfig()[index]?.id ?? null);
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; }
  }

  onColDragOver(index: number, event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) { event.dataTransfer.dropEffect = 'move'; }
  }

  onColDrop(targetIndex: number) {
    if (this._draggedColIdx === null || this._draggedColIdx === targetIndex) {
      this._draggedColIdx = null;
      this.draggedColId.set(null);
      return;
    }
    const cols = [...this.columnConfig()];
    const [moved] = cols.splice(this._draggedColIdx, 1);
    cols.splice(targetIndex, 0, moved);
    this.columnConfig.set(cols);
    this.saveColumnConfig();
    this._draggedColIdx = null;
    this.draggedColId.set(null);
  }

  onColDragEnd() {
    this._draggedColIdx = null;
    this.draggedColId.set(null);
  }

  trackColById(_: number, col: TableColumn) { return col.id; }

  isMobileColVisible(colId: string): boolean {
    return this.columnConfig().some(col => col.id === colId && col.visible);
  }

  // Pagination Logic
  private getSortValue(p: Publicador, col: string): string | number {
    switch (col) {
      case 'nombre': return this.getFullName(p).toLowerCase();
      case 'congregacion': return p.nombre_congregacion?.toLowerCase() ?? '';
      case 'grupo': return this.getGrupoNombre(p.id_grupo_publicador).toLowerCase();
      case 'fecha_nacimiento': return p.fecha_nacimiento ? new Date(p.fecha_nacimiento).getTime() : 0;
      case 'fecha_bautismo': return p.fecha_bautismo ? new Date(p.fecha_bautismo).getTime() : 0;
      case 'fecha_inicio_informe': return p.fecha_inicio_informe ? new Date(p.fecha_inicio_informe).getTime() : 0;
      case 'fecha_inactividad': return p.fecha_inactividad ? new Date(p.fecha_inactividad).getTime() : 0;
      case 'telefono': return (p.telefono ?? '').toLowerCase();
      case 'sexo': return (p.sexo ?? '').toLowerCase();
      case 'direccion': return (p.direccion ?? '').toLowerCase();
      case 'barrio': return (p.barrio ?? '').toLowerCase();
      case 'consentimiento_datos': return p.consentimiento_datos ? 1 : 0;
      case 'fecha_creacion': return p.fecha_creacion ? new Date(p.fecha_creacion).getTime() : 0;
      case 'estado': return this.getEstadoNombre(p.id_estado_publicador).toLowerCase();
      default: return '';
    }
  }

  sortedList = computed(() => {
    const order = this.sortOrder();
    const list = [...this.filteredList()];
    if (order.length === 0) return list;

    return list.sort((a, b) => {
      for (const { col, dir } of order) {
        const valA = this.getSortValue(a, col);
        const valB = this.getSortValue(b, col);
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  });

  pagedList = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.sortedList().slice(start, end);
  });

  // Stats Logic for Chips (Dynamic - based on search-filtered list)
  estadosWithCounts = computed(() => {
    // Base list for counting: apply search but NOT estado filter
    let baseList = this.rawList();
    const q = this.searchQuery();
    if (q && q.trim()) {
      baseList = baseList.filter(p => this.matchesSearch(p, q));
    }
    return this.estadosPublicador().map(e => ({
      ...e,
      count: baseList.filter(p => p.id_estado_publicador === e.id_estado).length
    }));
  });

  // Total filtered count for "Todos" chip
  totalFilteredCount = computed(() => {
    let baseList = this.rawList();
    const q = this.searchQuery();
    if (q && q.trim()) {
      baseList = baseList.filter(p => this.matchesSearch(p, q));
    }
    return baseList.length;
  });

  // Data Loading
  loadData() {
    const effectiveId = this.congregacionContext.effectiveCongregacionId();
    const params: any = { limit: 1000, offset: 0 };
    if (effectiveId != null) {
      params.id_congregacion = effectiveId;
    }
    if (this.isScopedToGroup()) {
      const idGrupo = this.authStore.user()?.id_grupo_publicador;
      if (idGrupo != null) {
        params.id_grupo = idGrupo;
      }
    }
    this.facade.load(params);
  }

  async loadAuxiliaryData() {
    this.loadPrivilegiosCatalog(); // Cargar catálogo de privilegios

    try {
      const effectiveId = this.congregacionContext.effectiveCongregacionId();
      const params: any = {};
      if (effectiveId != null) {
        params.id_congregacion = effectiveId;
      }

      // Added trailing slashes to match service configuration
      const requests: any[] = [
        lastValueFrom(this.http.get<Estado[]>('/api/estados/')),
        lastValueFrom(this.http.get<Grupo[]>('/api/grupos/', { params })),
        lastValueFrom(this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/', { params: { limit: 500, ...(effectiveId != null ? { id_congregacion: effectiveId } : {}) } }))
      ];

      if (this.isAdminOrGestor()) {
        requests.push(lastValueFrom(this.http.get<Congregacion[]>('/api/congregaciones/')));
      }

      const results = await Promise.all(requests);

      const estados = results[0];
      const grupos = results[1];
      const allPrivilegios = results[2];

      if (this.isAdminOrGestor() && results[3]) {
        this.congregaciones.set(results[3]);
      }

      this.estados.set(estados || []);
      this.grupos.set(grupos || []);

      // Process Privileges Map for List View
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

      // Debug log to verify data integrity

    } catch (error) {
      console.error('Error loading auxiliary data:', error);
    }
  }

  loadPrivilegiosCatalog() {
    this.privilegiosService.getPrivilegios().subscribe({
      next: (data) => this.privilegios.set(data),
      error: (err) => console.error('Error cargando privilegios', err)
    });
  }

  loadPublicadorPrivilegios(id: number) {
    // Guarda de secuencia: si mientras esta petición está en vuelo se dispara
    // otra (p.ej. el usuario abre otro publicador), descartamos la respuesta
    // tardía para no mostrar los privilegios de un publicador que ya no es el
    // que se está editando. Ese desfase permitía enviar el privilegio equivocado.
    const seq = ++this.privilegiosReqSeq;
    this.privilegiosLoading.set(true);
    // Obtenemos todos los registros (sin filtrar por activos)
    this.privilegiosService.getPublicadorPrivilegios(id).subscribe({
      next: (data) => {
        if (seq !== this.privilegiosReqSeq) return; // respuesta obsoleta
        // Agrupar por id_privilegio y quedarnos solo con el más reciente o el activo
        const latestPrivsMap = new Map<number, any>();
        data.forEach(pp => {
          const existing = latestPrivsMap.get(pp.id_privilegio);
          if (!existing) {
            latestPrivsMap.set(pp.id_privilegio, pp);
          } else {
            // Si el actual no tiene fecha_fin (es activo), lo preferimos
            if (!pp.fecha_fin) {
              latestPrivsMap.set(pp.id_privilegio, pp);
            } 
            // Si el existente también tiene fecha_fin, nos quedamos con el más reciente
            else if (existing.fecha_fin) {
              if (new Date(pp.fecha_inicio).getTime() > new Date(existing.fecha_inicio).getTime()) {
                latestPrivsMap.set(pp.id_privilegio, pp);
              }
            }
          }
        });
        
        const filteredData = Array.from(latestPrivsMap.values());
        this.publicadorPrivilegios.set(filteredData);

        // Update GLOBAL MAP so the list updates immediately
        const today = new Date().toISOString().split('T')[0];
        const activePrivs = data
          .filter(pp => !pp.fecha_fin || pp.fecha_fin >= today)
          .map(pp => pp.id_privilegio);

        this.publicadorPrivilegiosMap.update(map => {
          map.set(id, activePrivs);
          return new Map(map); // Force signal update
        });

        // Cargar estado de eliminabilidad para cada registro visible.
        // Con forkJoin las respuestas se agrupan y el mapa se escribe una sola
        // vez: antes cada respuesta reemplazaba el Map entero y disparaba su
        // propio ciclo de deteccion de cambios.
        this.eliminableMap.set(new Map());
        if (filteredData.length) {
          forkJoin(
            filteredData.map(pp =>
              this.privilegiosService.isPrivilegioEliminable(pp.id_publicador_privilegio).pipe(
                // Si uno falla no debe tumbar al resto: default conservador.
                catchError(() => of(null))
              )
            )
          ).subscribe(resultados => {
            const mapa = new Map<number, any>();
            filteredData.forEach((pp, i) => {
              const res = resultados[i];
              if (res !== null) mapa.set(pp.id_publicador_privilegio, res);
            });
            this.eliminableMap.set(mapa);
          });
        }

        // Consideración especial (solo relevante si es precursor regular)
        this.loadConsideraciones(id);
        this.privilegiosLoading.set(false);
      },
      error: (err) => {
        if (seq === this.privilegiosReqSeq) this.privilegiosLoading.set(false);
        console.error('Error cargando privilegios de publicador', err);
      }
    });
  }

  /** Carga los privilegios para la Vista Rápida en su propio signal (no toca el panel de edición). */
  loadQuickViewPrivilegios(id: number) {
    this.quickViewPrivilegios.set([]);
    this.privilegiosService.getPublicadorPrivilegios(id).subscribe({
      next: (data) => {
        const latest = new Map<number, PublicadorPrivilegio>();
        data.forEach(pp => {
          const existing = latest.get(pp.id_privilegio);
          if (!existing || (!pp.fecha_fin) ||
              (existing.fecha_fin && new Date(pp.fecha_inicio).getTime() > new Date(existing.fecha_inicio).getTime())) {
            latest.set(pp.id_privilegio, pp);
          }
        });
        this.quickViewPrivilegios.set(Array.from(latest.values()));
      },
      error: (err) => {
        console.error('Error cargando privilegios (vista rápida)', err);
        this.quickViewPrivilegios.set([]);
      }
    });
  }


  // Search & Filters
  // Search & Filters (Purely Client Side Updates)
  onSearch(value: string) {
    this.searchQuery.set(value);
    this.currentPage.set(1); // Reset to first page
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage() {
    if (this.currentPage() * this.pageSize < this.filteredList().length) {
      this.currentPage.update(p => p + 1);
    }
  }

  // ── Alta: asistente ───────────────────────────────────────────────────────

  /** Estado "Activo", que es con el que nace todo publicador nuevo. */
  estadoActivoId = computed(() =>
    this.estadosPublicador().find(e => e.nombre_estado.includes('Activo'))?.id_estado ?? null
  );

  openWizard() {
    this.wizardOpen.set(true);
  }

  closeWizard() {
    this.wizardOpen.set(false);
  }

  /**
   * Alta en dos fases: el publicador primero, sus privilegios después, porque
   * éstos necesitan un id_publicador que hasta aquí no existe.
   *
   * Si el publicador se crea pero falla algún privilegio no se deshace nada:
   * el registro válido se queda y se avisa de lo que falta por completar.
   */
  async onWizardCreated(result: NuevoPublicadorResult) {
    if (this.creating()) return;

    const idCongregacion = this.congregacionContext.effectiveCongregacionId();
    if (idCongregacion == null) {
      this.showToast('Selecciona una congregación en la barra superior.', 'error');
      return;
    }

    this.creating.set(true);
    try {
      const creado = await this.facade.create({
        ...result.publicador,
        id_congregacion_publicador: idCongregacion,
      } as any);

      this.wizardOpen.set(false);
      this.justCreatedId.set(creado.id_publicador);
      setTimeout(() => {
        if (this.justCreatedId() === creado.id_publicador) this.justCreatedId.set(null);
      }, 4000);

      const fallidos = await this.asignarPrivilegiosIniciales(creado.id_publicador, result.privilegios);
      const nombre = `${creado.primer_nombre} ${creado.primer_apellido}`.trim();

      const acciones = [
        { label: 'Completar ficha', run: () => this.openEditForm(creado) },
        { label: 'Crear otro', run: () => this.openWizard() },
      ];

      if (fallidos > 0) {
        this.showToast(
          `Se creó a ${nombre}, pero no se pudo registrar ${fallidos === 1 ? 'un privilegio' : 'los privilegios'}. Añádelo desde su ficha.`,
          'warning',
          acciones
        );
      } else {
        this.showToast(`${nombre} se creó correctamente`, 'success', acciones);
      }
    } catch (error: any) {
      console.error('Error creating publicador:', error);
      this.showToast('Error: ' + (error?.error?.detail || 'No se pudo crear el publicador'), 'error');
    } finally {
      this.creating.set(false);
    }
  }

  /** Devuelve cuántos privilegios no se pudieron registrar. */
  private async asignarPrivilegiosIniciales(
    idPublicador: number,
    privilegios: { id_privilegio: number; fecha_inicio: string; fecha_fin: string | null }[]
  ): Promise<number> {
    let fallidos = 0;
    for (const priv of privilegios) {
      try {
        await lastValueFrom(
          this.privilegiosService.createPublicadorPrivilegio({ id_publicador: idPublicador, ...priv })
        );
      } catch (err) {
        console.error('Error asignando privilegio', priv, err);
        fallidos++;
      }
    }
    return fallidos;
  }

  openEditForm(p: Publicador) {
    console.log('Editing Publicador:', p); // Debug log
    this.editingPublicador.set(p);
    this.activeTab.set('personal');
    this.publicadorForm.patchValue({
      primer_nombre: p.primer_nombre,
      segundo_nombre: p.segundo_nombre || '',
      primer_apellido: p.primer_apellido,
      segundo_apellido: p.segundo_apellido || '',
      sexo: p.sexo || '',
      fecha_nacimiento: p.fecha_nacimiento || null,
      telefono: p.telefono || '',
      direccion: p.direccion || '',
      barrio: p.barrio || '',
      fecha_bautismo: p.fecha_bautismo || null,
      ungido: p.ungido ?? false,
      id_grupo_publicador: p.id_grupo_publicador || null,
      id_congregacion_publicador: p.id_congregacion_publicador || null,
      id_estado_publicador: p.id_estado_publicador || null,
      consentimiento_datos: p.consentimiento_datos || false,
      fecha_inicio_informe: p.fecha_inicio_informe || null,
      permite_login_simple: p.permite_login_simple ?? true
    });
    this.resetConsideracionesState();
    this.resetPrivilegiosPanelState(); // Evita arrastrar la selección/lista del publicador anterior
    this.loadPublicadorPrivilegios(p.id_publicador); // Fetch privileges + consideraciones
    this.loadContactos(); // Fetch emergency contacts for this publisher
    this.panelOpen.set(true);
  }

  /**
   * Limpia el estado del bloque de privilegios al abrir/cerrar el panel.
   * Sin esto, `newPrivilegio` y `publicadorPrivilegios` conservaban los datos
   * del publicador anterior y se podía enviar el privilegio equivocado.
   */
  private resetPrivilegiosPanelState() {
    this.publicadorPrivilegios.set([]);
    this.eliminableMap.set(new Map());
    this.newPrivilegio.set({
      id_privilegio: null,
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: null
    });
    this.privilegeDropdownOpen.set(false);
    this.cancelClosingPrivilegio();
  }

  /** Limpia el estado de consideraciones al abrir/cerrar el drawer. */
  private resetConsideracionesState() {
    this.consideraciones.set([]);
    this.motivoDropdownOpen.set(false);
    this.consideracionToDelete.set(null);
    this.cancelClosingConsideracion();
    this.newConsideracion.set({
      motivo: 'salud',
      fecha_inicio: new Date().toISOString().split('T')[0],
      descripcion: ''
    });
  }

  closePanel() {
    this.panelOpen.set(false);
    this.editingPublicador.set(null);
    this.privilegiosReqSeq++; // invalida respuestas de privilegios en vuelo
    this.privilegiosLoading.set(false);
    this.resetPrivilegiosPanelState(); // Clear privileges + selección on close
    this.resetConsideracionesState();
    this.contactos.set([]); // Clear emergency contacts on close
    this.showContactoForm.set(false); // Hide contact form
    this.publicadorForm.reset();
  }

  // Dirty Check - Warn user if there are unsaved changes
  tryClosePanel() {
    if (this.publicadorForm.dirty) {
      const confirmClose = confirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres cerrar?');
      if (confirmClose) {
        this.closePanel();
      }
    } else {
      this.closePanel();
    }
  }

  toggleUngido() {
    const current = this.publicadorForm.get('ungido')?.value;
    this.publicadorForm.get('ungido')?.setValue(!current);
  }

  // Helper to set estado from Radio buttons quick action in side panel
  setEstado(type: 'Activo' | 'Inactivo') {
    const estado = this.estadosPublicador().find(e => e.nombre_estado.includes(type));
    if (estado) {
      this.publicadorForm.get('id_estado_publicador')?.setValue(estado.id_estado);
    }
  }


  capitalizeInput(controlName: string) {
    const control = this.publicadorForm.get(controlName);
    if (control && control.value) {
      const value = control.value.toString();
      if (value.length > 0) {
        const newValue = value.charAt(0).toUpperCase() + value.slice(1);
        if (value !== newValue) {
          control.setValue(newValue, { emitEvent: false });
        }
      }
    }
  }

  tabHasErrors(tab: 'personal' | 'teocratico'): boolean {
    if (!this.publicadorForm) return false;
    const tabFields: Record<string, string[]> = {
      personal: ['primer_nombre', 'primer_apellido'],
      teocratico: ['id_estado_publicador']
    };
    return (tabFields[tab] || []).some(field => {
      const c = this.publicadorForm.get(field);
      return c?.invalid && c?.touched;
    });
  }

  /** Guarda la ficha. El panel es sólo de edición: dar de alta va por el
   *  asistente (openWizard), que pide únicamente lo imprescindible. */
  async onSubmit() {
    const editingPub = this.editingPublicador();
    if (!editingPub) return;

    this.publicadorForm.markAllAsTouched();
    if (this.publicadorForm.invalid) return;

    this.saving.set(true);
    const rawData = this.publicadorForm.value;

    // Transform data for API compatibility
    const nuevoEstadoNombre = this.getEstadoNombre(rawData.id_estado_publicador).toLowerCase();
    const estadoAnteriorNombre = this.getEstadoNombre(editingPub.id_estado_publicador).toLowerCase();

    let fechaInactividad: string | null | undefined = undefined;
    if (nuevoEstadoNombre.includes('inactivo') && !estadoAnteriorNombre.includes('inactivo')) {
      fechaInactividad = new Date().toISOString().split('T')[0];
    } else if (!nuevoEstadoNombre.includes('inactivo') && estadoAnteriorNombre.includes('inactivo')) {
      fechaInactividad = null;
    }

    const data: any = {
      ...rawData,
      // Convert ungido boolean to string for backend
      ungido: rawData.ungido ? 'Sí' : null,
      // Convert empty strings to null for optional fields
      segundo_nombre: rawData.segundo_nombre || null,
      segundo_apellido: rawData.segundo_apellido || null,
      telefono: rawData.telefono || null,
      direccion: rawData.direccion || null,
      barrio: rawData.barrio || null,
      fecha_nacimiento: rawData.fecha_nacimiento || null,
      fecha_bautismo: rawData.fecha_bautismo || null,
      sexo: rawData.sexo || null,
      id_grupo_publicador: rawData.id_grupo_publicador || null
    };

    if (fechaInactividad !== undefined) {
      data.fecha_inactividad = fechaInactividad;
    }

    try {
      await this.facade.update(editingPub.id_publicador, data);
      this.closePanel();
      this.showToast('Cambios guardados correctamente', 'success');
    } catch (error) {
      console.error('Error saving:', error);
      this.showToast('Error al guardar los cambios', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  // Delete
  isDeleting = signal(false);
  checkingUsuarioVinculado = signal(false);
  deleteStep = signal<'checking' | 'simple' | 'linked-choice' | 'confirm-delete-both' | 'reassign-picker'>('checking');
  usuarioVinculado = signal<UsuarioVinculado | null>(null);
  deleteOpcionElegida = signal<DeleteOpcion | null>(null);
  publicadoresParaReasignar = signal<Publicador[]>([]);
  publicadorReasignadoId = signal<number | null>(null);
  busquedaReasignar = signal('');
  publicadoresFiltradosReasignar = computed(() => {
    const q = this.busquedaReasignar().toLowerCase().trim();
    if (!q) return this.publicadoresParaReasignar();
    return this.publicadoresParaReasignar().filter(p => {
      const nombre = `${p.primer_nombre} ${p.segundo_nombre ?? ''} ${p.primer_apellido} ${p.segundo_apellido ?? ''}`.toLowerCase();
      return nombre.includes(q);
    });
  });

  async confirmDelete(p: Publicador) {
    this.publicadorToDelete.set(p);
    this.deleteModalOpen.set(true);
    this.deleteStep.set('checking');
    this.checkingUsuarioVinculado.set(true);
    try {
      const info = await this.facade.checkUsuarioVinculado(p.id_publicador);
      this.usuarioVinculado.set(info);
      this.deleteStep.set(info.tiene_usuario_vinculado ? 'linked-choice' : 'simple');
    } catch {
      this.showToast('Error al verificar usuario vinculado', 'error');
      this.closeDeleteModal();
    } finally {
      this.checkingUsuarioVinculado.set(false);
    }
  }

  closeDeleteModal() {
    if (this.isDeleting()) return;
    this.deleteModalOpen.set(false);
    this.publicadorToDelete.set(null);
    this.usuarioVinculado.set(null);
    this.deleteStep.set('checking');
    this.deleteOpcionElegida.set(null);
    this.publicadoresParaReasignar.set([]);
    this.publicadorReasignadoId.set(null);
    this.busquedaReasignar.set('');
  }

  selectDeleteOpcion(opcion: DeleteOpcion) {
    if (opcion === 'eliminar_con_usuario') {
      this.deleteStep.set('confirm-delete-both');
    } else if (opcion === 'reasignar_usuario') {
      const pub = this.publicadorToDelete();
      const todos = this.facade.vm().list.filter(
        p => p.id_publicador !== pub?.id_publicador
      );
      this.publicadoresParaReasignar.set(todos);
      this.deleteStep.set('reassign-picker');
    } else {
      this.deleteOpcionElegida.set(opcion);
    }
  }

  async executeDelete() {
    const p = this.publicadorToDelete();
    if (!p) return;

    const step = this.deleteStep();
    const opcion: DeleteOpcion = step === 'simple' || !this.usuarioVinculado()?.tiene_usuario_vinculado
      ? 'sin_usuario'
      : step === 'confirm-delete-both'
        ? 'eliminar_con_usuario'
        : (this.deleteOpcionElegida() ?? 'eliminar_con_usuario');

    if (opcion === 'reasignar_usuario') {
      const nuevoId = this.publicadorReasignadoId();
      if (!nuevoId) {
        this.showToast('Debes seleccionar un publicador para reasignar el usuario', 'error');
        return;
      }
      this.isDeleting.set(true);
      try {
        await this.facade.removeWithOpcion(p.id_publicador, opcion, nuevoId);
        this.showToast('Publicador eliminado y usuario reasignado correctamente', 'success');
        this.closeDeleteModal();
      } catch (err: any) {
        this.showToast(err?.error?.detail || 'No se pudo eliminar el publicador', 'error');
      } finally {
        this.isDeleting.set(false);
      }
      return;
    }

    this.isDeleting.set(true);
    try {
      await this.facade.removeWithOpcion(p.id_publicador, opcion);
      this.showToast('Publicador eliminado correctamente', 'success');
      this.closeDeleteModal();
    } catch (err: any) {
      console.error('Error deleting publicador:', err);
      const msg = err?.error?.detail || 'No se pudo eliminar el publicador';
      this.showToast(msg, 'error');
    } finally {
      this.isDeleting.set(false);
    }
  }

  // Helpers
  compareFn(c1: any, c2: any): boolean {
    return c1 == c2;
  }

  trackById(index: number, item: Publicador) {
    return item.id_publicador;
  }

  trackPrivilegeById(index: number, item: PublicadorPrivilegio) {
    return item.id_publicador_privilegio;
  }

  trackConsideracionById(index: number, item: PrecursorConsideracion) {
    return item.id_consideracion;
  }

  trackGroupById(index: number, item: Grupo) {
    return item.id_grupo;
  }

  getInitials(p: Publicador | null): string {
    if (!p) return '';
    const first = p.primer_nombre?.charAt(0) || '';
    const last = p.primer_apellido?.charAt(0) || '';
    return (first + last).toUpperCase();
  }

  getAvatarStyle(name: string): string {
    return getInitialAvatarStyle(name || '');
  }

  getRoles(p: Publicador): { label: string, short: string, type: 'pill' | 'text', class: string }[] {
    const privilegiosIds = this.publicadorPrivilegiosMap().get(p.id_publicador) || [];
    const catalogo = this.privilegios();

    const roleNames = privilegiosIds.map(id => catalogo.find(pr => pr.id_privilegio === id)?.nombre_privilegio?.toLowerCase() || '').filter(Boolean);

    // Order: Precursor R > Precursor A > Anciano > Ministerial > Publicador
    const roles: { label: string, short: string, type: 'pill' | 'text', class: string }[] = [];

    if (roleNames.some(r => r.includes('precursor regular'))) {
      roles.push({ label: 'PRECURSOR REGULAR', short: 'Prec. Regular', type: 'pill', class: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' });
    }
    // La consideración especial no se muestra aquí a propósito: es un dato
    // sensible (edad avanzada o salud delicada) y el listado se proyecta y se
    // comparte. Sigue visible donde hace falta para interpretar las horas:
    // el historial de informes y el reporte de precursores.
    if (roleNames.some(r => r.includes('precursor auxiliar'))) {
      roles.push({ label: 'PRECURSOR AUXILIAR', short: 'Prec. Auxiliar', type: 'pill', class: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' });
    }
    if (roleNames.some(r => r.includes('anciano'))) {
      roles.push({ label: 'ANCIANO', short: 'Anciano', type: 'pill', class: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' });
    }
    if (roleNames.some(r => r.includes('siervo'))) {
      roles.push({ label: 'SIERVO MINISTERIAL', short: 'S. Ministerial', type: 'pill', class: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' });
    }

    // Default if no specific roles
    if (roles.length === 0) {
      // No mostrar nada si no tiene privilegios especiales (es publicador por defecto)
    }

    return roles;
  }

  getFullName(p: Publicador): string {
    return [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
      .filter(n => n && n.trim())
      .join(' ');
  }

  getYearsSince(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const from = new Date(dateStr);
    if (isNaN(from.getTime())) return null;
    const now = new Date();
    let years = now.getFullYear() - from.getFullYear();
    const monthDiff = now.getMonth() - from.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < from.getDate())) years--;
    return years >= 0 ? years : null;
  }

  getGrupoNombre(id: number | string | null | undefined): string {
    if (!id) return 'Sin Grupo';
    // Use loose equality (==) to handle potential string/number mismatches in API response
    const grupo = this.grupos().find(g => g.id_grupo == id);
    return grupo ? grupo.nombre_grupo : 'Sin Grupo';
  }

  // Sexo Display Helper
  getSexoDisplayName(): string {
    const value = this.publicadorForm.get('sexo')?.value;
    if (value === 'M') return 'Masculino';
    if (value === 'F') return 'Femenino';
    return 'Seleccionar';
  }

  // Custom Dropdown State
  privilegeDropdownOpen = signal(false);

  togglePrivilegeDropdown() {
    this.privilegeDropdownOpen.update(v => !v);
  }

  selectNewPrivilege(p: Privilegio) {
    this.updateNewPrivilegio('id_privilegio', p.id_privilegio);
    this.privilegeDropdownOpen.set(false);
  }

  getSelectedPrivilegeName(): string {
    const id = this.newPrivilegio().id_privilegio;
    if (!id) return 'Seleccionar Privilegio...';
    return this.getPrivilegioNombre(id);
  }

  // Estado Dropdown State
  estadoDropdownOpen = signal(false);

  toggleEstadoDropdown() {
    this.estadoDropdownOpen.update(v => !v);
  }

  selectEstado(id: number | null) {
    this.publicadorForm.get('id_estado_publicador')?.setValue(id);
    this.estadoDropdownOpen.set(false);
  }

  getSelectedEstadoName(): string {
    const id = this.publicadorForm.get('id_estado_publicador')?.value;
    if (!id) return 'Seleccionar';
    const estado = this.estadosPublicador().find(e => e.id_estado == id);
    return estado?.nombre_estado || 'Seleccionar';
  }

  getEstadoNombre(id: number | string | null | undefined): string {
    if (!id) return 'Sin estado';
    const estado = this.estados().find(e => e.id_estado == id);
    return estado?.nombre_estado || 'Sin estado';
  }

  getEstadoTextClass(id: number | string | null | undefined): string {
    const nombre = this.getEstadoNombre(id)?.toLowerCase() || '';
    if (nombre.includes('inactivo')) return 'text-red-500';
    if (nombre.includes('activo')) return 'text-emerald-500';
    return 'text-slate-400';
  }

  getEstadoDotClass(id: number | string | null | undefined): string {
    const nombre = this.getEstadoNombre(id)?.toLowerCase() || '';
    if (nombre.includes('inactivo')) return 'bg-red-500';
    if (nombre.includes('activo')) return 'bg-emerald-500';
    return 'bg-slate-300';
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return '—';
    try {
      // Extract date parts directly from ISO string to avoid timezone issues
      const parts = date.split('T')[0].split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
      }
      // Fallback for other formats
      const d = new Date(date);
      const userTimezoneOffset = d.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(d.getTime() + userTimezoneOffset);
      const dd = String(adjustedDate.getDate()).padStart(2, '0');
      const mm = String(adjustedDate.getMonth() + 1).padStart(2, '0');
      const yyyy = adjustedDate.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return date;
    }
  }

  // --- Emergencia Logic ---

  async loadContactos() {
    const pub = this.editingPublicador();
    if (!pub) return;
    try {
      const res = await lastValueFrom(this.http.get<ContactoEmergencia[]>('/api/contactos-emergencia/', {
        params: { id_publicador: pub.id_publicador }
      }));
      this.contactos.set(res || []);
    } catch (e) {
      console.error('Error loading contactos', e);
      this.contactos.set([]);
    }
  }

  initNewContacto() {
    this.editingContacto.set(null);
    this.contactoForm.reset({ es_principal: false, solo_urgencias: false });
    this.showContactoForm.set(true);
  }

  editContacto(c: ContactoEmergencia) {
    this.editingContacto.set(c);
    this.contactoForm.patchValue({
      nombre: c.nombre,
      parentesco: c.parentesco,
      telefono: c.telefono,
      direccion: c.direccion,
      etiqueta: c.etiqueta,
      es_principal: c.es_principal,
      solo_urgencias: c.solo_urgencias
    });
    this.showContactoForm.set(true);
  }

  async saveContacto() {
    if (this.contactoForm.invalid) return;

    const val = this.contactoForm.value;
    const pub = this.editingPublicador();
    if (!pub) return;

    try {
      if (this.editingContacto()) {
        const id = this.editingContacto()!.id_contacto_emergencia;
        await lastValueFrom(this.http.put('/api/contactos-emergencia/' + id, val));
      } else {
        const payload = { ...val, id_publicador: pub.id_publicador };
        await lastValueFrom(this.http.post('/api/contactos-emergencia/', payload));
      }
      this.showContactoForm.set(false);
      this.loadContactos();
    } catch (e) {
      console.error('Error saving contacto', e);
      alert('Error al guardar contacto');
    }
  }

  confirmDeleteContacto(c: ContactoEmergencia) {
    this.contactoToDelete.set(c);
    this.deleteContactoModalOpen.set(true);
  }

  closeDeleteContactoModal() {
    this.contactoToDelete.set(null);
    this.deleteContactoModalOpen.set(false);
  }

  async executeDeleteContacto() {
    const c = this.contactoToDelete();
    if (!c) return;
    this.isDeletingContacto.set(true);
    try {
      await lastValueFrom(this.http.delete('/api/contactos-emergencia/' + c.id_contacto_emergencia));
      this.loadContactos();
      this.closeDeleteContactoModal();
    } catch (e) {
      this.showToast('Error al eliminar el contacto', 'error');
    } finally {
      this.isDeletingContacto.set(false);
    }
  }
  // --- Privilegios Helpers ---

  getPrivilegioNombre(id: number): string {
    const priv = this.privilegios().find(p => p.id_privilegio === id);
    return priv ? priv.nombre_privilegio : 'Desconocido';
  }

  updateNewPrivilegio(field: string, value: any) {
    // Si value es string de evento, extraer? No, ngModelChange da el valor.
    // Manejar inputs dates vacíos
    this.newPrivilegio.update(prev => ({ ...prev, [field]: value }));
  }

  isAuxiliarySelected(): boolean {
    const id = this.newPrivilegio().id_privilegio;
    if (!id) return false;
    const nombre = this.getPrivilegioNombre(Number(id));
    return nombre.toLowerCase().includes('auxiliar');
  }

  canAddPrivilegio(): boolean {
    const p = this.newPrivilegio();
    // Mientras cargan los privilegios del publicador no validamos contra datos
    // frescos: bloqueamos para no enviar una asignación que el backend rechazará.
    if (this.privilegiosLoading()) return false;
    return !!p.id_privilegio && !!p.fecha_inicio && !this.privilegioConflictoMsg();
  }

  addPrivilegio() {
    const pub = this.editingPublicador();
    if (!pub || !this.canAddPrivilegio()) return;

    const privData = this.newPrivilegio();
    const payload: any = {
      id_publicador: pub.id_publicador,
      id_privilegio: Number(privData.id_privilegio),
      fecha_inicio: privData.fecha_inicio,
      fecha_fin: privData.fecha_fin || null
    };

    // Si NO es auxiliar, forzar fecha_fin a null por regla de negocio (salvo que el usuario quiera cerrar un rango, pero 'Asignar' implica iniciar)
    // El usuario dijo: "Para precursor regular no se llena la fecha fin".
    if (!this.isAuxiliarySelected()) {
      payload.fecha_fin = null;
    }

    this.privilegiosService.createPublicadorPrivilegio(payload).subscribe({
      next: () => {
        this.loadPublicadorPrivilegios(pub.id_publicador);
        // Reset form
        this.newPrivilegio.set({
          id_privilegio: null,
          fecha_inicio: new Date().toISOString().split('T')[0],
          fecha_fin: null
        });
        this.privilegeDropdownOpen.set(false);
        this.showToast('Privilegio asignado correctamente', 'success');
      },
      error: (err) => {
        this.showToast('Error: ' + (err.error?.detail || 'No se pudo asignar el privilegio'), 'error');
      }
    });
  }

  deletePublicadorPrivilegio(id: number) {
    const pub = this.editingPublicador();
    if (!pub) return;

    this.privilegiosService.deletePublicadorPrivilegio(id).subscribe({
      next: () => {
        this.loadPublicadorPrivilegios(pub.id_publicador);
        this.showToast('Privilegio eliminado', 'success');
      },
      error: (err) => {
        if (err?.status === 409) {
          // El backend rechazó el delete porque hay informes en el rango.
          // Refrescamos el estado de eliminable y dirigimos al usuario a Finalizar.
          this.eliminableMap.update(map => {
            map.set(id, { eliminable: false, motivo: err.error?.detail ?? null });
            return new Map(map);
          });
          this.showToast(err.error?.detail || 'No se puede eliminar: usá Finalizar para conservar el historial.', 'error');
          this.startClosingPrivilegio(id);
        } else {
          this.showToast('Error al eliminar: ' + (err.error?.detail || err.message), 'error');
        }
      }
    });
  }

  executeDeletePrivilegio() {
    const id = this.privilegioToDelete();
    if (id !== null) {
      this.deletePublicadorPrivilegio(id);
      this.closeDeletePrivilegioModal();
    }
  }

  // ─── Consentimiento PDF Handlers ─────────────────────────────────────────

  async onConsentimientoPdfSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validar tipo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.pdfError.set('Solo se permiten archivos PDF o imágenes (JPG, PNG, WEBP).');
      input.value = '';
      return;
    }

    // Validar tamaño (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      this.pdfError.set('El archivo excede el tamaño máximo de 10 MB.');
      input.value = '';
      return;
    }

    const pub = this.editingPublicador();
    if (!pub) return;

    this.uploadingPdf.set(true);
    this.pdfError.set(null);

    try {
      const updated = await this.facade.uploadConsentimientoPdf(pub.id_publicador, file);
      // Actualizar publicador en edición con el nuevo estado
      this.editingPublicador.set({ ...pub, ...updated });
      
      // Sincronizar el formulario para que al hacer Guardar Cambios no lo sobreescriba a falso
      this.publicadorForm.patchValue({
         consentimiento_datos: updated.consentimiento_datos
      });

      this.showToast('Consentimiento PDF subido correctamente', 'success');
    } catch (err: any) {
      this.pdfError.set(err?.error?.detail || err?.message || 'Error al subir el archivo.');
    } finally {
      this.uploadingPdf.set(false);
      input.value = ''; // Reset input para permitir subir el mismo archivo
    }
  }

  async downloadConsentimientoPdf() {
    const pub = this.editingPublicador();
    if (!pub) return;

    try {
      const blob = await this.facade.downloadConsentimientoPdf(pub.id_publicador);
      // Abrir en nueva pestaña
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Liberar URL después de un momento
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      this.showToast(err?.error?.detail || 'Error al descargar el archivo.', 'error');
    }
  }

  async deleteConsentimientoPdf() {
    const pub = this.editingPublicador();
    if (!pub) return;

    try {
      const updated = await this.facade.deleteConsentimientoPdf(pub.id_publicador);
      this.editingPublicador.set({ ...pub, ...updated });

      // Sincronizar el formulario para que al hacer Guardar Cambios envíe falso
      this.publicadorForm.patchValue({
         consentimiento_datos: updated.consentimiento_datos
      });

      this.showToast('Consentimiento PDF eliminado', 'success');
    } catch (err: any) {
      this.showToast(err?.error?.detail || 'Error al eliminar el archivo.', 'error');
    }
  }

  async viewConsentimientoPdfFromQuickView() {
    const pub = this.viewingPublicador();
    if (!pub) return;

    try {
      const blob = await this.facade.downloadConsentimientoPdf(pub.id_publicador);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      this.showToast(err?.error?.detail || 'Error al descargar el archivo.', 'error');
    }
  }

}

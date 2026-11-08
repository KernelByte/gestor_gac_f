import { Component, signal, computed, inject, OnInit, AfterViewInit, ElementRef, HostListener, ViewChild, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { trigger, transition, style, animate } from '@angular/animations';
import { Router, ActivatedRoute } from '@angular/router';
import { getInitialAvatarStyle } from '../../../core/utils/avatar-style.util';
import { AIConfigComponent } from './components/ai-config.component';
import { DbBackupComponent } from './components/db-backup.component';
import { SystemConfigComponent } from './components/system-config.component';
import { ApiConfigComponent } from './components/api-config.component';
import { SeguridadComponent } from './components/seguridad.component';
import { FestivosComponent } from './components/festivos.component';
import { CambioHorarioComponent } from '../cambio-horario.component';
import { camposHorarioCambiados } from '../horarios-reunion.service';
import { ModalComponent, ConfirmDialogComponent, AvisoComponent, ToastService, ConfirmService } from '../../../shared/components';
import { ImportPublicadoresModalComponent } from '../../../shared/components/import-publicadores/import-publicadores-modal.component';

/**
 * Pestañas del panel. Única fuente de verdad: el tipo `AdminTab` se deriva de
 * esta lista, así que añadir una pestaña ya no obliga a tocar la unión de tipos,
 * el array de validación y la firma de setTab por separado.
 */
export const ADMIN_TABS = [
   'congregaciones', 'auditoria', 'solicitudes', 'ai',
   'base-datos', 'sistema', 'apis', 'festivos', 'seguridad',
] as const;

export type AdminTab = typeof ADMIN_TABS[number];

/** Etiqueta e icono (paths SVG 24x24, trazo) de cada pestaña, en el orden de ADMIN_TABS. */
const ADMIN_TAB_META: Record<AdminTab, { label: string; paths: string[]; danger?: boolean }> = {
   congregaciones: { label: 'Congregaciones', paths: ['M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'] },
   auditoria: { label: 'Auditoría', paths: ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'] },
   solicitudes: { label: 'Solicitudes', paths: ['M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'] },
   ai: { label: 'Motores IA', paths: ['M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'] },
   'base-datos': { label: 'Base de Datos', paths: ['M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'] },
   sistema: { label: 'Sistema', paths: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'] },
   apis: { label: 'APIs', paths: ['M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244'] },
   festivos: { label: 'Festivos', paths: ['M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'] },
   seguridad: { label: 'Seguridad', paths: ['M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'], danger: true },
};

interface CongregacionUrl {
   id_url: number;
   id_congregacion: number;
   clave: string;
   url: string;
   descripcion: string | null;
}

interface CongregacionAdmin {
   id_congregacion: number;
   nombre_congregacion: string;
   circuito: string;
   direccion: string;
   codigo_seguridad: string;
   tiene_sala_b: number;
   usa_zoom: number;
   miembros: number; // Computed field from backend?
   dia_reunion_entre_semana: string | null;
   hora_reunion_entre_semana: string | null;
   dia_reunion_fin_semana: string | null;
   hora_reunion_fin_semana: string | null;
}

interface ImportResult {
   success: boolean;
   detalle: string;
   resumen: {
      status: string;
      msg: string;
      filas: number;
      insertados: number;
      actualizados: number;
      omitidos: number;
      errores: number;
      informes_insertados: number;
      informes_actualizados: number;
      informes_errores: number;
      asistencias_insertadas: number;
      asistencias_actualizadas: number;
      asistencias_errores: number;
      header_index_detectado: number;
      columnas_mapeadas: Record<string, string | null>;
   };
}

interface SolicitudAcceso {
   id_solicitud: number;
   nombre: string;
   email: string;
   congregacion: string;
   telefono: string;
   observaciones: string | null;
   estado: string;
   creado_en: string | null;
   procesado_en: string | null;
}

@Component({
   selector: 'app-admin-config',
   standalone: true,
   imports: [CommonModule, FormsModule, ReactiveFormsModule, AIConfigComponent, DbBackupComponent, SystemConfigComponent, ApiConfigComponent, SeguridadComponent, FestivosComponent, ImportPublicadoresModalComponent, CambioHorarioComponent, ModalComponent, ConfirmDialogComponent, AvisoComponent],
   templateUrl: './admin-config.page.html',
   styles: [`
     .scrollbar-hide::-webkit-scrollbar { display: none; }
     .scrollbar-hide { scrollbar-width: none; }
     /* Desvanecido en el borde por el que quedan pestañas ocultas */
     .admin-tabs [role=tablist] { --fs: 0px; --fe: 0px;
       -webkit-mask-image: linear-gradient(to right, transparent, #000 var(--fs), #000 calc(100% - var(--fe)), transparent);
               mask-image: linear-gradient(to right, transparent, #000 var(--fs), #000 calc(100% - var(--fe)), transparent); }
     .admin-tabs.fade-start [role=tablist] { --fs: 2rem; }
     .admin-tabs.fade-end [role=tablist] { --fe: 2rem; }
   `],
   animations: [
      trigger('slidePanel', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateX(100%)' }),
            animate('500ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
         ]),
         transition(':leave', [
            animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'translateX(100%)' }))
         ])
      ]),
      trigger('fadeIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(10px)' }),
            animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
         ])
      ])
   ]
})
export class AdminConfigPage implements OnInit, AfterViewInit {

   /** trackBy: evita recrear el DOM de toda la lista en cada cambio. */
   trackByCongregacion = (_: number, c: any) => c.id_congregacion;

   private http = inject(HttpClient);
   private fb = inject(FormBuilder);
   private router = inject(Router);
   private route = inject(ActivatedRoute);
   private destroyRef = inject(DestroyRef);
   private API_URL = `${environment.apiUrl}/configuracion/admin`;

   activeTab = signal<AdminTab>('congregaciones');
   readonly tabs = ADMIN_TABS.map(id => ({ id, ...ADMIN_TAB_META[id] }));
   tabFade = signal({ start: false, end: false });
   @ViewChild('tabsScroller') private tabsScroller?: ElementRef<HTMLElement>;
   loading = signal(false);
   loadError = signal(false);

   // Data Signals
   congregaciones = signal<CongregacionAdmin[]>([]);

   searchTerm = signal('');

   // Import Modal Signals
   showImportModal = signal(false);
   /** ID de la congregación sobre la que se importa (null = sin selección). */
   selectedImportCongregacionId = signal<number | null>(null);
   selectedImportCongregacionName = signal<string | null>(null);

   // Create/Edit Panel Signals
   panelOpen = signal(false);
   creating = signal(false);
   editingCongregation = signal<CongregacionAdmin | null>(null);

   congregationForm!: FormGroup;
   urlForm!: FormGroup;

   // URL Signals
   congregacionUrls = signal<CongregacionUrl[]>([]);
   loadingUrls = signal(false);
   showUrlForm = signal(false);
   editingUrlClave = signal<string | null>(null);
   savingUrl = signal(false);
   deletingUrlKey = signal<string | null>(null);
   urlToDelete = signal<string | null>(null);

   // Notification Signal
   private toastSvc = inject(ToastService);
   private confirm = inject(ConfirmService);

   // Export signal
   exportingId = signal<number | null>(null);

   // Delete confirmation modal
   congregationToDelete = signal<CongregacionAdmin | null>(null);
   deletingCongregation = signal(false);
   /** Texto que el admin escribe para confirmar el borrado en cascada. */
   deleteConfirmText = signal('');
   readonly deleteConfirmed = computed(() => {
      const c = this.congregationToDelete();
      return !!c && this.deleteConfirmText().trim().toLowerCase() === c.nombre_congregacion.trim().toLowerCase();
   });

   // Solicitudes signals
   solicitudes = signal<SolicitudAcceso[]>([]);
   solicitudesLoading = signal(false);
   solicitudFilter = signal<string>('todas');
   updatingSolicitudId = signal<number | null>(null);

   ngOnInit() {
      // Initialize form
      this.initForm();

      // Reactive tab handling from query params
      this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
         const tabParam = params['tab'];
         const savedTab = localStorage.getItem('admin_active_tab');
         const tabToSet = (tabParam || savedTab || 'congregaciones') as AdminTab;

         if (tabToSet && (ADMIN_TABS as readonly string[]).includes(tabToSet)) {
            this.activeTab.set(tabToSet);
            localStorage.setItem('admin_active_tab', tabToSet);
            // En pantallas estrechas la barra de pestañas hace scroll: que la activa quede a la vista.
            setTimeout(() => document.getElementById(`admin-tab-${tabToSet}`)
               ?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
            
            // Load specific data based on tab
            if (tabToSet === 'solicitudes') {
               this.loadSolicitudes();
            } else if (tabToSet === 'congregaciones') {
               this.loadCongregaciones();
            }
         }
      });
   }

   initForm() {
      this.congregationForm = this.fb.group({
         nombre_congregacion: ['', [Validators.required]],
         circuito: ['', [Validators.required]],
         direccion: ['', [Validators.required]],
         codigo_seguridad: [''],
         tiene_sala_b: [false],
         usa_zoom: [true],
         dia_reunion_entre_semana: [''],
         hora_reunion_entre_semana: [''],
         dia_reunion_fin_semana: [''],
         hora_reunion_fin_semana: ['']
      });

      this.urlForm = this.fb.group({
         clave: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[a-z0-9_]+$/i)]],
         url: ['', [Validators.required, Validators.pattern('https?://.+')]],
         descripcion: ['', [Validators.maxLength(200)]]
      });
   }

   setTab(tab: AdminTab) {
      // Solo se navega: la suscripción a queryParams activa la pestaña y carga sus datos
      // (antes se cargaba aquí y otra vez allí, duplicando las peticiones).
      this.activeTab.set(tab);
      localStorage.setItem('admin_active_tab', tab);

      // Update URL query parameters
      this.router.navigate([], {
         relativeTo: this.route,
         queryParams: { tab: tab },
         queryParamsHandling: 'merge',
         replaceUrl: true
      });

   }

   ngAfterViewInit() {
      // Tras el primer render: medir si la barra de pestañas desborda.
      setTimeout(() => this.updateTabFade());
   }

   @HostListener('window:resize')
   updateTabFade() {
      const el = this.tabsScroller?.nativeElement;
      if (!el) return;
      const start = el.scrollLeft > 4;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      const prev = this.tabFade();
      if (prev.start !== start || prev.end !== end) this.tabFade.set({ start, end });
   }

   /** Flechas/Inicio/Fin entre pestañas (patrón WAI-ARIA tablist). */
   onTabKeydown(event: KeyboardEvent) {
      const i = ADMIN_TABS.indexOf(this.activeTab());
      const n = ADMIN_TABS.length;
      const next = ({ ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 } as Record<string, number>)[event.key];
      if (next === undefined) return;
      event.preventDefault();
      this.setTab(ADMIN_TABS[next]);
      const tablist = (event.currentTarget as HTMLElement);
      const btn = tablist.querySelector<HTMLElement>(`#admin-tab-${ADMIN_TABS[next]}`);
      btn?.focus();
      btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
   }

   loadCongregaciones() {
      this.loading.set(true);
      this.loadError.set(false);
      this.http.get<CongregacionAdmin[]>(`${this.API_URL}/congregaciones`)
         .subscribe({
            next: (data) => {
               this.congregaciones.set(data);
               this.loading.set(false);
            },
            error: (err: any) => {
               console.error(err);
               this.loadError.set(true);
               this.loading.set(false);
            }
         });
   }

   get totalCount() {
      return this.congregaciones().length;
   }

   getCongregacionAvatarStyle(nombre: string): string {
      return getInitialAvatarStyle(nombre);
   }

   /**
    * computed en vez de getter: la plantilla lo lee en dos vistas a la vez
    * (rejilla y tabla) y en varios *ngIf, asi que el filtro se recalculaba
    * entero en cada ciclo de deteccion de cambios. Ahora solo cuando cambian
    * las congregaciones o el termino de busqueda.
    */
   readonly filteredCongregations = computed(() => {
      const term = this.searchTerm().toLowerCase();
      return this.congregaciones().filter(c =>
         c.nombre_congregacion.toLowerCase().includes(term) ||
         (c.direccion || '').toLowerCase().includes(term) ||
         (c.circuito || '').toLowerCase().includes(term)
      );
   });

   editCongregation(id: number) {
      const cong = this.congregaciones().find(c => c.id_congregacion === id);
      if (cong) {
         this.editingCongregation.set(cong);
         this.congregationForm.patchValue({
            nombre_congregacion: cong.nombre_congregacion,
            circuito: cong.circuito,
            direccion: cong.direccion || '',
            codigo_seguridad: cong.codigo_seguridad,
            tiene_sala_b: !!cong.tiene_sala_b,
            usa_zoom: !!cong.usa_zoom,
            dia_reunion_entre_semana: cong.dia_reunion_entre_semana || '',
            hora_reunion_entre_semana: cong.hora_reunion_entre_semana || '',
            dia_reunion_fin_semana: cong.dia_reunion_fin_semana || '',
            hora_reunion_fin_semana: cong.hora_reunion_fin_semana || ''
         });
         this.loadCongregacionUrls(id);
         this.panelOpen.set(true);
      }
   }

   /** Un cambio de horario que empieza hoy cambia el día/hora del formulario: se recarga. */
   recargarTrasCambioHorario() {
      const id = this.editingCongregation()?.id_congregacion;
      if (!id) return;
      this.http.get<CongregacionAdmin[]>(`${this.API_URL}/congregaciones`).subscribe({
         next: (data) => {
            this.congregaciones.set(data);
            this.editCongregation(id);
         },
      });
   }

   // ===== Import Modal Methods =====
   openImportModal() {
      this.selectedImportCongregacionId.set(null);
      this.selectedImportCongregacionName.set(null);
      this.showImportModal.set(true);
   }

   openImportModalForCongregacion(id: number, nombre: string) {
      this.selectedImportCongregacionId.set(id);
      this.selectedImportCongregacionName.set(nombre);
      this.showImportModal.set(true);
   }

   closeImportModal() {
      this.showImportModal.set(false);
      this.selectedImportCongregacionId.set(null);
      this.selectedImportCongregacionName.set(null);
   }

   onImportDone() {
      this.showImportModal.set(false);
      this.selectedImportCongregacionId.set(null);
      this.selectedImportCongregacionName.set(null);
      this.loadCongregaciones();
   }



   // ===== URLs Methods =====
   loadCongregacionUrls(id: number) {
      this.loadingUrls.set(true);
      this.http.get<CongregacionUrl[]>(`${this.API_URL}/congregaciones/${id}/urls`).subscribe({
         next: (urls) => {
            this.congregacionUrls.set(urls);
            this.loadingUrls.set(false);
         },
         error: (err: any) => {
            console.error('Error loading URLs:', err);
            this.loadingUrls.set(false);
            this.showNotification('Error al cargar URLs de la congregación', 'error');
         }
      });
   }

   openUrlForm(urlObj?: CongregacionUrl) {
      if (urlObj) {
         this.editingUrlClave.set(urlObj.clave);
         this.urlForm.patchValue({
            clave: urlObj.clave,
            url: urlObj.url,
            descripcion: urlObj.descripcion
         });
         this.urlForm.get('clave')?.disable();
      } else {
         this.editingUrlClave.set(null);
         this.urlForm.reset();
         this.urlForm.get('clave')?.enable();
      }
      this.showUrlForm.set(true);
   }

   closeUrlForm() {
      this.showUrlForm.set(false);
      this.urlForm.reset();
      this.editingUrlClave.set(null);
   }

   saveUrl() {
      if (this.urlForm.invalid || !this.editingCongregation()) return;
      
      this.savingUrl.set(true);
      const congId = this.editingCongregation()!.id_congregacion;
      const formData = this.urlForm.getRawValue(); // gets disabled fields too
      
      this.http.post<CongregacionUrl>(`${this.API_URL}/congregaciones/${congId}/urls`, formData).subscribe({
         next: () => {
            this.savingUrl.set(false);
            this.closeUrlForm();
            this.loadCongregacionUrls(congId);
            this.showNotification('URL guardada correctamente', 'success');
         },
         error: (err: any) => {
            console.error('Error saving URL:', err);
            this.savingUrl.set(false);
            this.showNotification(err.error?.detail || 'Error al guardar la URL', 'error');
         }
      });
   }

   deleteUrl(clave: string) {
      if (!this.editingCongregation()) return;
      this.urlToDelete.set(clave);
   }

   confirmDeleteUrl() {
      const clave = this.urlToDelete();
      if (!clave || !this.editingCongregation()) return;

      const congId = this.editingCongregation()!.id_congregacion;
      this.deletingUrlKey.set(clave);

      this.http.delete(`${this.API_URL}/congregaciones/${congId}/urls/${encodeURIComponent(clave)}`).subscribe({
         next: () => {
            this.urlToDelete.set(null);
            this.deletingUrlKey.set(null);
            this.loadCongregacionUrls(congId);
            this.showNotification('URL eliminada', 'success');
         },
         error: (err: any) => {
            console.error('Error deleting URL:', err);
            this.urlToDelete.set(null);
            this.deletingUrlKey.set(null);
            this.showNotification('Error al eliminar la URL', 'error');
         }
      });
   }

   // ===== Panel Methods =====
   private readonly formDefaults = {
      nombre_congregacion: '', circuito: '', direccion: '', codigo_seguridad: '',
      tiene_sala_b: false, usa_zoom: true,
      dia_reunion_entre_semana: '', hora_reunion_entre_semana: '',
      dia_reunion_fin_semana: '', hora_reunion_fin_semana: ''
   };

   /** Cierre por fondo/Escape: si hay cambios sin guardar, pregunta antes de descartarlos. */
   async requestClosePanel() {
      if (this.congregationForm.dirty) {
         const descartar = await this.confirm.ask({
            title: 'Hay cambios sin guardar',
            message: '¿Descartarlos?',
            confirmLabel: 'Descartar',
            severity: 'warning',
         });
         if (!descartar) return;
      }
      this.closePanel();
   }

   openCreatePanel() {
      this.editingCongregation.set(null);
      this.congregationForm.reset(this.formDefaults);
      this.panelOpen.set(true);
   }

   closePanel() {
      this.panelOpen.set(false);
      this.congregationForm.reset(this.formDefaults);
      this.editingCongregation.set(null);
      this.congregacionUrls.set([]);
      this.showUrlForm.set(false);
      this.urlForm.reset();
      this.editingUrlClave.set(null);
   }

   saveCongregation() {
      if (this.congregationForm.invalid) return;

      this.creating.set(true);
      const data = this.congregationForm.value;

      // Prepare payload
      const payload = {
         nombre_congregacion: data.nombre_congregacion,
         circuito: data.circuito,
         direccion: data.direccion,
         codigo_seguridad: data.codigo_seguridad,
         tiene_sala_b: data.tiene_sala_b ? 1 : 0,
         usa_zoom: data.usa_zoom ? 1 : 0,
         ...camposHorarioCambiados(data, this.editingCongregation()),
      };

      let req;
      if (this.editingCongregation()) {
         // Update
         const id = this.editingCongregation()!.id_congregacion;
         req = this.http.put(`${this.API_URL}/congregaciones/${id}`, payload);
      } else {
         // Create
         req = this.http.post(`${this.API_URL}/congregaciones`, payload);
      }

      const isEditing = !!this.editingCongregation();

      req.subscribe({
         next: () => {
            this.creating.set(false);
            this.closePanel();
            this.loadCongregaciones();
            this.showNotification(
               isEditing ? 'Congregación actualizada exitosamente' : 'Congregación creada exitosamente',
               'success'
            );
         },
         error: (err: any) => {
            console.error(err);
            this.creating.set(false);
            this.showNotification(
               err.error?.detail || 'Error al guardar la congregación',
               'error'
            );
         }
      });
   }

   showNotification(message: string, type: 'success' | 'error') {
      if (type === 'success') this.toastSvc.success(message);
      else this.toastSvc.error(message);
   }

   // ===== Export Method =====
   exportCongregation(id: number, name: string) {
      this.exportingId.set(id);

      this.http.get(`${environment.apiUrl}/export/congregacion/${id}`, {
         responseType: 'blob'
      }).subscribe({
         next: (blob) => {
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${name.replace(/\s+/g, '_')}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            this.exportingId.set(null);
         },
         error: (err: any) => {
            console.error('Export error:', err);
            this.showNotification('Error al exportar la congregación', 'error');
            this.exportingId.set(null);
         }
      });
   }

   confirmDeleteCongregation(cong: CongregacionAdmin) {
      this.deleteConfirmText.set('');
      this.congregationToDelete.set(cong);
   }

   closeDeleteModal() {
      if (!this.deletingCongregation()) this.congregationToDelete.set(null);
   }

   executeDeleteCongregation() {
      const cong = this.congregationToDelete();
      if (!cong || !this.deleteConfirmed()) return;
      this.deletingCongregation.set(true);
      this.http.delete(`${this.API_URL}/congregaciones/${cong.id_congregacion}`).subscribe({
         next: () => {
            this.congregationToDelete.set(null);
            this.deletingCongregation.set(false);
            this.loadCongregaciones();
            this.showNotification('Congregación eliminada correctamente', 'success');
         },
         error: (err: any) => {
            console.error('Delete congregation error:', err);
            this.deletingCongregation.set(false);
            this.showNotification(
               err?.error?.detail || 'No se pudo eliminar la congregación',
               'error'
            );
         }
      });
   }

   // ===== Solicitudes de Acceso =====
   loadSolicitudes() {
      this.solicitudesLoading.set(true);
      // Siempre se piden todas: los contadores deben ser globales y el filtro se aplica en cliente.
      this.http.get<SolicitudAcceso[]>(`${environment.apiUrl}/solicitudes/`).subscribe({
         next: (data) => {
            this.solicitudes.set(data);
            this.solicitudesLoading.set(false);
         },
         error: (err: any) => {
            console.error('Error loading solicitudes:', err);
            this.solicitudesLoading.set(false);
         }
      });
   }

   readonly filteredSolicitudes = computed(() => {
      const f = this.solicitudFilter();
      return f === 'todas' ? this.solicitudes() : this.solicitudes().filter(s => s.estado === f);
   });

   /**
    * Antes era un getter: devolvia un objeto nuevo en cada lectura, asi que los
    * bindings de la plantilla siempre veian un valor distinto. Con computed se
    * recalcula solo cuando cambia la lista.
    */
   readonly solicitudStats = computed(() => {
      const all = this.solicitudes();
      return {
         total: all.length,
         pendientes: all.filter(s => s.estado === 'pendiente').length,
         aprobadas: all.filter(s => s.estado === 'aprobada').length,
         rechazadas: all.filter(s => s.estado === 'rechazada').length,
      };
   });

   setSolicitudFilter(filter: string) {
      this.solicitudFilter.set(filter);
   }

   cambiarEstadoSolicitud(id: number, nuevoEstado: string) {
      this.updatingSolicitudId.set(id);
      this.http.put(`${environment.apiUrl}/solicitudes/${id}/estado`, { estado: nuevoEstado }).subscribe({
         next: () => {
            this.updatingSolicitudId.set(null);
            this.loadSolicitudes();
            this.showNotification(
               `Solicitud ${nuevoEstado === 'aprobada' ? 'aprobada' : 'rechazada'} exitosamente`,
               'success'
            );
         },
         error: (err: any) => {
            console.error('Error updating solicitud:', err);
            this.updatingSolicitudId.set(null);
            this.showNotification(
               err?.error?.detail || 'Error al actualizar la solicitud',
               'error'
            );
         }
      });
   }
}

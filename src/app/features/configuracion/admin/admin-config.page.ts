import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { trigger, transition, style, animate } from '@angular/animations';
import { Router, ActivatedRoute } from '@angular/router';
import { getInitialAvatarStyle } from '../../../core/utils/avatar-style.util';
import { AIConfigComponent } from './components/ai-config.component';
import { DbBackupComponent } from './components/db-backup.component';

interface CongregacionAdmin {
   id_congregacion: number;
   nombre_congregacion: string;
   circuito: string;
   direccion: string;
   codigo_seguridad: string;
   tiene_sala_b: number;
   usa_zoom: number;
   miembros: number; // Computed field from backend?
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
   imports: [CommonModule, FormsModule, ReactiveFormsModule, AIConfigComponent, DbBackupComponent],
   templateUrl: './admin-config.page.html',
   styles: [`
     .scrollbar-hide::-webkit-scrollbar { display: none; }
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
export class AdminConfigPage implements OnInit {
   private http = inject(HttpClient);
   private fb = inject(FormBuilder);
   private router = inject(Router);
   private route = inject(ActivatedRoute);
   private API_URL = `${environment.apiUrl}/configuracion/admin`;

   activeTab = signal<'congregaciones' | 'auditoria' | 'seguridad' | 'ai' | 'base-datos' | 'solicitudes'>('congregaciones');
   loading = signal(false);

   // Data Signals
   congregaciones = signal<CongregacionAdmin[]>([]);

   searchTerm = signal('');

   // Import Modal Signals
   showImportModal = signal(false);
   importing = signal(false);
   importResult = signal<ImportResult | null>(null);
   importError = signal<string | null>(null);
   selectedFileName = signal<string | null>(null);
   isDragOver = signal(false);
   // ID de congregación seleccionada para importar directamente (modo Admin por ID)
   selectedImportCongregacionId = signal<number | null>(null);
   selectedImportCongregacionName = signal<string | null>(null);

   // Create/Edit Panel Signals
   panelOpen = signal(false);
   creating = signal(false);
   editingCongregation = signal<CongregacionAdmin | null>(null);

   congregationForm!: FormGroup;

   // Notification Signal
   notification = signal<{ message: string, type: 'success' | 'error' } | null>(null);

   // Export signal
   exportingId = signal<number | null>(null);

   // Delete confirmation modal
   congregationToDelete = signal<CongregacionAdmin | null>(null);
   deletingCongregation = signal(false);

   // Solicitudes signals
   solicitudes = signal<SolicitudAcceso[]>([]);
   solicitudesLoading = signal(false);
   solicitudFilter = signal<string>('todas');
   updatingSolicitudId = signal<number | null>(null);

   ngOnInit() {
      // Initialize form
      this.initForm();

      // Reactive tab handling from query params
      this.route.queryParams.subscribe(params => {
         const tabParam = params['tab'];
         const savedTab = localStorage.getItem('admin_active_tab');
         const tabToSet = (tabParam || savedTab || 'congregaciones') as any;
         const validTabs = ['congregaciones', 'auditoria', 'seguridad', 'ai', 'base-datos', 'solicitudes'];

         if (tabToSet && validTabs.includes(tabToSet)) {
            this.activeTab.set(tabToSet);
            localStorage.setItem('admin_active_tab', tabToSet);
            
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
         usa_zoom: [true]
      });
   }

   setTab(tab: 'congregaciones' | 'auditoria' | 'seguridad' | 'ai' | 'base-datos' | 'solicitudes') {
      this.activeTab.set(tab);
      localStorage.setItem('admin_active_tab', tab);

      // Update URL query parameters
      this.router.navigate([], {
         relativeTo: this.route,
         queryParams: { tab: tab },
         queryParamsHandling: 'merge',
         replaceUrl: true
      });

      if (tab === 'congregaciones') this.loadCongregaciones();
      if (tab === 'solicitudes') this.loadSolicitudes();
   }

   loadCongregaciones() {
      this.loading.set(true);
      this.http.get<CongregacionAdmin[]>(`${this.API_URL}/congregaciones`)
         .subscribe({
            next: (data) => {
               this.congregaciones.set(data);
               this.loading.set(false);
            },
            error: (err: any) => {
               console.error(err);
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

   get filteredCongregations() {
      const term = this.searchTerm().toLowerCase();
      return this.congregaciones().filter(c =>
         c.nombre_congregacion.toLowerCase().includes(term) ||
         (c.direccion || '').toLowerCase().includes(term) ||
         (c.circuito || '').toLowerCase().includes(term)
      );
   }

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
            usa_zoom: !!cong.usa_zoom
         });
         this.panelOpen.set(true);
      }
   }

   // ===== Import Modal Methods =====
   openImportModal() {
      this.selectedImportCongregacionId.set(null);
      this.selectedImportCongregacionName.set(null);
      this.showImportModal.set(true);
      this.importResult.set(null);
      this.importError.set(null);
      this.selectedFileName.set(null);
   }

   openImportModalForCongregacion(id: number, nombre: string) {
      this.selectedImportCongregacionId.set(id);
      this.selectedImportCongregacionName.set(nombre);
      this.showImportModal.set(true);
      this.importResult.set(null);
      this.importError.set(null);
      this.selectedFileName.set(null);
   }

   closeImportModal() {
      const wasSuccess = this.importResult()?.success;
      this.showImportModal.set(false);
      this.importResult.set(null);
      this.importError.set(null);
      this.selectedFileName.set(null);
      this.isDragOver.set(false);
      this.selectedImportCongregacionId.set(null);
      this.selectedImportCongregacionName.set(null);
      if (wasSuccess) {
         this.loadCongregaciones();
      }
   }

   onDragOver(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      this.isDragOver.set(true);
   }

   onDragLeave(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      this.isDragOver.set(false);
   }

   onFileDrop(event: DragEvent) {
      event.preventDefault();
      event.stopPropagation();
      this.isDragOver.set(false);

      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
         this.processFile(files[0]);
      }
   }

   onFileSelected(event: Event) {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
         this.processFile(input.files[0]);
      }
   }

   private processFile(file: File) {
      // Validate extension
      const name = file.name.toLowerCase();
      if (!name.endsWith('.xls') && !name.endsWith('.xlsx')) {
         this.importError.set('Formato no soportado. Solo se aceptan archivos .xls o .xlsx');
         return;
      }

      // Validate size (5MB max)
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > 5) {
         this.importError.set(`El archivo excede el tamaño máximo permitido (5 MB). Tamaño: ${sizeMB.toFixed(2)} MB`);
         return;
      }

      this.selectedFileName.set(file.name);
      this.uploadFile(file);
   }

   private uploadFile(file: File) {
      this.importing.set(true);
      this.importError.set(null);
      this.importResult.set(null);

      const formData = new FormData();
      formData.append('archivo', file);

      const idCong = this.selectedImportCongregacionId();
      const url = idCong
         ? `${environment.apiUrl}/import/congregaciones?id_congregacion=${idCong}`
         : `${environment.apiUrl}/import/congregaciones`;

      this.http.post<ImportResult>(url, formData)
         .subscribe({
            next: (result) => {
               this.importResult.set(result);
               this.importing.set(false);
               if (result.success) {
                  this.loadCongregaciones();
               }
            },
            error: (err: any) => {
               console.error('Import error:', err);
               const message = err.error?.detail || err.message || 'Error inesperado al procesar el archivo';
               this.importError.set(message);
               this.importing.set(false);
            }
         });
   }



   // ===== Panel Methods =====
   openCreatePanel() {
      this.editingCongregation.set(null);
      this.congregationForm.reset();
      this.panelOpen.set(true);
   }

   closePanel() {
      this.panelOpen.set(false);
      this.congregationForm.reset();
      this.editingCongregation.set(null);
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
         usa_zoom: data.usa_zoom ? 1 : 0
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
      this.notification.set({ message, type });
      setTimeout(() => {
         this.notification.set(null);
      }, 3000);
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
            alert('Error al exportar la congregación');
            this.exportingId.set(null);
         }
      });
   }

   downloadTemplate() {
      this.http.get(`${environment.apiUrl}/export/plantilla`, {
         responseType: 'blob'
      }).subscribe({
         next: (blob: Blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Plantilla_Importacion_GAC.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
         },
         error: (err: any) => {
            console.error('Template download error:', err);
            alert('Error al descargar la plantilla');
         }
      });
   }

   confirmDeleteCongregation(cong: CongregacionAdmin) {
      this.congregationToDelete.set(cong);
   }

   closeDeleteModal() {
      if (!this.deletingCongregation()) this.congregationToDelete.set(null);
   }

   executeDeleteCongregation() {
      const cong = this.congregationToDelete();
      if (!cong) return;
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
      const filter = this.solicitudFilter();
      let url = `${environment.apiUrl}/solicitudes/`;
      if (filter !== 'todas') {
         url += `?estado=${filter}`;
      }
      this.http.get<SolicitudAcceso[]>(url).subscribe({
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

   get filteredSolicitudes() {
      return this.solicitudes();
   }

   get solicitudStats() {
      const all = this.solicitudes();
      return {
         total: all.length,
         pendientes: all.filter(s => s.estado === 'pendiente').length,
         aprobadas: all.filter(s => s.estado === 'aprobada').length,
         rechazadas: all.filter(s => s.estado === 'rechazada').length,
      };
   }

   setSolicitudFilter(filter: string) {
      this.solicitudFilter.set(filter);
      this.loadSolicitudes();
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

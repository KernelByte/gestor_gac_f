import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface CongregacionAdmin {
   id_congregacion: number;
   nombre_congregacion: string;
   circuito: string;
   ciudad: string;
   miembros: number;
   direccion?: string;
}

interface SystemVars {
   maintenance_mode: boolean;
   allow_backups: boolean;
   backup_frequency: number;
   global_message: string;
   max_upload_size: number;
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
      header_index_detectado: number;
      columnas_mapeadas: Record<string, string | null>;
   };
}

@Component({
   selector: 'app-admin-config',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './admin-config.page.html',
   styles: []
})
export class AdminConfigPage implements OnInit {
   private http = inject(HttpClient);
   private API_URL = `${environment.apiUrl}/configuracion/admin`;

   activeTab = signal<'congregaciones' | 'variables' | 'auditoria' | 'api' | 'seguridad'>('congregaciones');
   loading = signal(false);

   // Data Signals
   congregaciones = signal<CongregacionAdmin[]>([]);

   systemVars = signal<SystemVars>({
      maintenance_mode: false,
      allow_backups: true,
      backup_frequency: 24,
      global_message: '',
      max_upload_size: 10
   });

   searchTerm = signal('');

   // Import Modal Signals
   showImportModal = signal(false);
   importing = signal(false);
   importResult = signal<ImportResult | null>(null);
   importError = signal<string | null>(null);
   selectedFileName = signal<string | null>(null);
   isDragOver = signal(false);

   // Export signal
   exportingId = signal<number | null>(null);

   ngOnInit() {
      this.loadCongregaciones();
      this.loadSystemVars();
   }

   setTab(tab: 'congregaciones' | 'variables' | 'auditoria' | 'api' | 'seguridad') {
      this.activeTab.set(tab);
      if (tab === 'congregaciones') this.loadCongregaciones();
      if (tab === 'variables') this.loadSystemVars();
   }

   loadCongregaciones() {
      this.loading.set(true);
      this.http.get<CongregacionAdmin[]>(`${this.API_URL}/congregaciones`)
         .subscribe({
            next: (data) => {
               this.congregaciones.set(data);
               this.loading.set(false);
            },
            error: (err) => {
               console.error(err);
               this.loading.set(false);
            }
         });
   }

   loadSystemVars() {
      this.http.get<SystemVars>(`${this.API_URL}/variables`)
         .subscribe({
            next: (data) => {
               this.systemVars.set(data);
            },
            error: (err) => console.error(err)
         });
   }

   get totalCount() {
      return this.congregaciones().length;
   }

   get filteredCongregations() {
      const term = this.searchTerm().toLowerCase();
      return this.congregaciones().filter(c =>
         c.nombre_congregacion.toLowerCase().includes(term) ||
         (c.ciudad || '').toLowerCase().includes(term) ||
         (c.circuito || '').toLowerCase().includes(term)
      );
   }

   editCongregation(id: number) {
      console.log('Edit congregation', id);
      // TODO: Implement navigation to edit detail if needed
   }

   saveVariables() {
      this.loading.set(true);
      this.http.put(`${this.API_URL}/variables`, this.systemVars())
         .subscribe({
            next: () => {
               // Success Feedback
               alert('Configuración del sistema actualizada correctamente.');
               this.loading.set(false);
            },
            error: (err) => {
               console.error(err);
               alert('Error al guardar configuración.');
               this.loading.set(false);
            }
         });
   }

   // ===== Import Modal Methods =====
   openImportModal() {
      this.showImportModal.set(true);
      this.importResult.set(null);
      this.importError.set(null);
      this.selectedFileName.set(null);
   }

   closeImportModal() {
      this.showImportModal.set(false);
      this.importResult.set(null);
      this.importError.set(null);
      this.selectedFileName.set(null);
      this.isDragOver.set(false);
      // Reload congregations if import was successful
      if (this.importResult()?.success) {
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

      this.http.post<ImportResult>(`${environment.apiUrl}/import/congregaciones`, formData)
         .subscribe({
            next: (result) => {
               this.importResult.set(result);
               this.importing.set(false);
               // Reload congregations on success
               if (result.success) {
                  this.loadCongregaciones();
               }
            },
            error: (err) => {
               console.error('Import error:', err);
               const message = err.error?.detail || err.message || 'Error inesperado al procesar el archivo';
               this.importError.set(message);
               this.importing.set(false);
            }
         });
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
         error: (err) => {
            console.error('Export error:', err);
            alert('Error al exportar la congregación');
            this.exportingId.set(null);
         }
      });
   }
}

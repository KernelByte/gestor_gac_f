import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/auth/auth.store';
import { TerritoriosService } from '../territorios/services/territorios.service';

interface Configuracion {
   id_congregacion: number;
   nombre_congregacion: string;
   circuito: string;
   direccion: string;
   codigo_seguridad: string;
   tiene_sala_b: boolean | number;
   usa_zoom: boolean | number;
   dia_reunion_entre_semana:  string;
   hora_reunion_entre_semana: string;
   dia_reunion_fin_semana:    string;
   hora_reunion_fin_semana:   string;
}

@Component({
   selector: 'app-configuracion',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './configuracion.page.html',
   styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .animate-fadeIn { animation: fadeIn 0.35s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  `],
   animations: [
      trigger('slideIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateX(100%)' }),
            animate('400ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
         ]),
         transition(':leave', [
            animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(100%)' }))
         ])
      ])
   ]
})
export class ConfiguracionPage implements OnInit {
   private http = inject(HttpClient);
   private auth = inject(AuthStore);
   private territoriosService = inject(TerritoriosService);
   private API_URL = `${environment.apiUrl}/configuracion/`;

   config: Configuracion = {
      id_congregacion: 0,
      nombre_congregacion: '',
      circuito: '',
      direccion: '',
      codigo_seguridad: '',
      tiene_sala_b: false,
      usa_zoom: true,
      dia_reunion_entre_semana:  '',
      hora_reunion_entre_semana: '',
      dia_reunion_fin_semana:    '',
      hora_reunion_fin_semana:   '',
   };

   // Clone to check for changes
   originalConfig: Configuracion | null = null;

   loading = signal(true);
   saving = signal(false);
   showSecurityCode = signal(false);
   generatingCode = signal(false);
   notification = signal<{ message: string, type: 'success' | 'error' } | null>(null);
   dropdownEntreOpen  = signal(false);
   dropdownFinOpen    = signal(false);
   timePickerEntreOpen = signal(false);

   // Tile provider
   tileProvider = 'osm';
   savingTileProvider = signal(false);
   timePickerFinOpen   = signal(false);

   readonly diasEntreSemana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
   readonly diasFinSemana   = ['Sabado', 'Domingo'];
   readonly diasLabel: Record<string, string> = {
      Lunes: 'Lunes', Martes: 'Martes', Miercoles: 'Miércoles',
      Jueves: 'Jueves', Viernes: 'Viernes', Sabado: 'Sábado', Domingo: 'Domingo'
   };
   readonly horas12  = ['12','01','02','03','04','05','06','07','08','09','10','11'];
   readonly minutos  = ['00','05','10','15','20','25','30','35','40','45','50','55'];
   readonly periodos = ['AM','PM'];

   selectDiaEntre(dia: string) {
      this.config.dia_reunion_entre_semana = dia;
      this.dropdownEntreOpen.set(false);
   }

   selectDiaFin(dia: string) {
      this.config.dia_reunion_fin_semana = dia;
      this.dropdownFinOpen.set(false);
   }

   // ── 24h helpers ──────────────────────────────────────────
   private to24(h12: string, periodo: string): string {
      let h = parseInt(h12, 10);
      if (periodo === 'AM') { h = h === 12 ? 0 : h; }
      else                  { h = h === 12 ? 12 : h + 12; }
      return String(h).padStart(2, '0');
   }

   getMinuto(time: string) { return time ? time.split(':')[1] : ''; }

   get12Hour(time: string): string {
      if (!time) return '12';
      const h = parseInt(time.split(':')[0], 10);
      const h12 = h % 12 || 12;
      return String(h12).padStart(2, '0');
   }

   getPeriodo(time: string): string {
      if (!time) return 'AM';
      return parseInt(time.split(':')[0], 10) < 12 ? 'AM' : 'PM';
   }

   setHoraEntre(h12: string) {
      const m  = this.getMinuto(this.config.hora_reunion_entre_semana) || '00';
      const p  = this.getPeriodo(this.config.hora_reunion_entre_semana);
      this.config.hora_reunion_entre_semana = `${this.to24(h12, p)}:${m}`;
   }
   setMinutoEntre(m: string) {
      const h24 = this.config.hora_reunion_entre_semana
         ? this.config.hora_reunion_entre_semana.split(':')[0] : '07';
      this.config.hora_reunion_entre_semana = `${h24}:${m}`;
   }
   setPeriodoEntre(p: string) {
      const h12 = this.get12Hour(this.config.hora_reunion_entre_semana);
      const m   = this.getMinuto(this.config.hora_reunion_entre_semana) || '00';
      this.config.hora_reunion_entre_semana = `${this.to24(h12, p)}:${m}`;
   }

   setHoraFin(h12: string) {
      const m  = this.getMinuto(this.config.hora_reunion_fin_semana) || '00';
      const p  = this.getPeriodo(this.config.hora_reunion_fin_semana);
      this.config.hora_reunion_fin_semana = `${this.to24(h12, p)}:${m}`;
   }
   setMinutoFin(m: string) {
      const h24 = this.config.hora_reunion_fin_semana
         ? this.config.hora_reunion_fin_semana.split(':')[0] : '09';
      this.config.hora_reunion_fin_semana = `${h24}:${m}`;
   }
   setPeriodoFin(p: string) {
      const h12 = this.get12Hour(this.config.hora_reunion_fin_semana);
      const m   = this.getMinuto(this.config.hora_reunion_fin_semana) || '00';
      this.config.hora_reunion_fin_semana = `${this.to24(h12, p)}:${m}`;
   }

   formatDisplay(time: string): string {
      if (!time) return '--:--';
      const h12 = this.get12Hour(time);
      const m   = this.getMinuto(time);
      const p   = this.getPeriodo(time);
      return `${h12}:${m} ${p}`;
   }

   ngOnInit() {
      this.loadConfig();
      this.loadTileProvider();
   }

   loadTileProvider() {
      this.territoriosService.getTileProvider().subscribe({
         next: (res) => this.tileProvider = res.tile_provider || 'osm',
         error: () => this.tileProvider = 'osm',
      });
   }

   saveTileProvider() {
      this.savingTileProvider.set(true);
      this.territoriosService.updateTileProvider(this.tileProvider).subscribe({
         next: () => {
            this.savingTileProvider.set(false);
            this.showNotification('Proveedor de mapa actualizado', 'success');
         },
         error: () => {
            this.savingTileProvider.set(false);
            this.showNotification('Error al actualizar el proveedor de mapa', 'error');
         },
      });
   }

   loadConfig() {
      this.loading.set(true);
      this.http.get<Configuracion>(this.API_URL)
         .subscribe({
            next: (data) => {
               this.config = data;
               this.originalConfig = { ...data }; // Clone initial state
               this.loading.set(false);
            },
            error: (err) => {
               console.error('Error cargando configuración', err);
               this.loading.set(false);
            }
         });
   }

   save() {
      if (!this.canEdit()) return;

      this.saving.set(true);
      // Send only updateable fields
      const payload = {
         nombre_congregacion:       this.config.nombre_congregacion,
         circuito:                  this.config.circuito,
         direccion:                 this.config.direccion,
         codigo_seguridad:          this.config.codigo_seguridad,
         tiene_sala_b:              this.config.tiene_sala_b ? 1 : 0,
         usa_zoom:                  this.config.usa_zoom ? 1 : 0,
         dia_reunion_entre_semana:  this.config.dia_reunion_entre_semana  || null,
         hora_reunion_entre_semana: this.config.hora_reunion_entre_semana || null,
         dia_reunion_fin_semana:    this.config.dia_reunion_fin_semana    || null,
         hora_reunion_fin_semana:   this.config.hora_reunion_fin_semana   || null,
      };

      this.http.put<Configuracion>(this.API_URL, payload)
         .subscribe({
            next: (data) => {
               this.config = data;
               this.originalConfig = { ...data }; // Update original state
               this.saving.set(false);
               this.showNotification('Configuración guardada exitosamente', 'success');
            },
            error: (err) => {
               console.error('Error guardando configuración', err);
               this.saving.set(false);
               this.showNotification(
                  err.error?.detail || 'Error al guardar la configuración',
                  'error'
               );
            }
         });
   }

   showNotification(message: string, type: 'success' | 'error' = 'success') {
      this.notification.set({ message, type });
      setTimeout(() => {
         this.notification.set(null);
      }, 4000);
   }

   regenerateSecurityCode() {
      if (!this.canEdit()) return;

      this.generatingCode.set(true);
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 7; i++) {
         result += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      // Optimistic update
      const oldCode = this.config.codigo_seguridad;
      this.config.codigo_seguridad = result;
      this.showSecurityCode.set(true); // Show the new code

      // Generate payload with just the code
      this.http.put<Configuracion>(this.API_URL, { codigo_seguridad: result })
         .subscribe({
            next: (data) => {
               this.config = data;

               // IMPORTANT: Update originalConfig's security code so "Save Changes" 
               // remains disabled (user doesn't need to save manually)
               if (this.originalConfig) {
                  this.originalConfig.codigo_seguridad = data.codigo_seguridad;
               }

               this.generatingCode.set(false);
               this.showNotification('Código de seguridad actualizado', 'success');
            },
            error: (err) => {
               console.error('Error actualizando código', err);
               this.config.codigo_seguridad = oldCode; // Revert on error
               this.generatingCode.set(false);
               this.showNotification('Error al regenerar el código', 'error');
            }
         });
   }

   hasChanges(): boolean {
      if (!this.originalConfig) return false;
      return this.config.nombre_congregacion !== this.originalConfig.nombre_congregacion ||
         this.config.circuito !== this.originalConfig.circuito ||
         this.config.direccion !== this.originalConfig.direccion ||
         this.config.codigo_seguridad !== this.originalConfig.codigo_seguridad ||
         !!this.config.tiene_sala_b !== !!this.originalConfig.tiene_sala_b ||
         !!this.config.usa_zoom !== !!this.originalConfig.usa_zoom ||
         (this.config.dia_reunion_entre_semana  || '') !== (this.originalConfig.dia_reunion_entre_semana  || '') ||
         (this.config.hora_reunion_entre_semana || '') !== (this.originalConfig.hora_reunion_entre_semana || '') ||
         (this.config.dia_reunion_fin_semana    || '') !== (this.originalConfig.dia_reunion_fin_semana    || '') ||
         (this.config.hora_reunion_fin_semana   || '') !== (this.originalConfig.hora_reunion_fin_semana   || '');
   }

   canEdit() {
      const user = this.auth.user();
      if (!user) return false;

      // Roles with implicit access (matching backend logic)
      const allowedRoles = ['Administrador', 'Gestor Aplicación', 'Coordinador', 'Secretario'];
      if (user.rol && allowedRoles.includes(user.rol)) {
         return true;
      }

      return this.auth.hasPermission('configuracion.editar');
   }
}

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/auth/auth.store';

interface Configuracion {
   id_congregacion: number;
   nombre_congregacion: string;
   circuito: string;
   direccion: string;
   codigo_seguridad: string;
}

@Component({
   selector: 'app-configuracion',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './configuracion.page.html',
   styles: [`
    :host { display: block; }
    .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class ConfiguracionPage implements OnInit {
   private http = inject(HttpClient);
   private auth = inject(AuthStore);
   private API_URL = `${environment.apiUrl}/configuracion/`;

   config: Configuracion = {
      id_congregacion: 0,
      nombre_congregacion: '',
      circuito: '',
      direccion: '',
      codigo_seguridad: ''
   };

   // Clone to check for changes
   originalConfig: Configuracion | null = null;

   loading = signal(true);
   saving = signal(false);
   showSecurityCode = signal(false);
   generatingCode = signal(false);

   ngOnInit() {
      this.loadConfig();
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
         nombre_congregacion: this.config.nombre_congregacion,
         circuito: this.config.circuito,
         direccion: this.config.direccion,
         codigo_seguridad: this.config.codigo_seguridad
      };

      this.http.put<Configuracion>(this.API_URL, payload)
         .subscribe({
            next: (data) => {
               this.config = data;
               this.originalConfig = { ...data }; // Update original state
               this.saving.set(false);
            },
            error: (err) => {
               console.error('Error guardando configuración', err);
               this.saving.set(false);
            }
         });
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
            },
            error: (err) => {
               console.error('Error actualizando código', err);
               this.config.codigo_seguridad = oldCode; // Revert on error
               this.generatingCode.set(false);
            }
         });
   }

   hasChanges(): boolean {
      if (!this.originalConfig) return false;
      return this.config.nombre_congregacion !== this.originalConfig.nombre_congregacion ||
         this.config.circuito !== this.originalConfig.circuito ||
         this.config.direccion !== this.originalConfig.direccion ||
         this.config.codigo_seguridad !== this.originalConfig.codigo_seguridad;
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

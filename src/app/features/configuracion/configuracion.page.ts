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

   loading = signal(true);
   saving = signal(false);

   ngOnInit() {
      this.loadConfig();
   }

   loadConfig() {
      this.loading.set(true);
      this.http.get<Configuracion>(this.API_URL)
         .subscribe({
            next: (data) => {
               this.config = data;
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
               this.saving.set(false);
            },
            error: (err) => {
               console.error('Error guardando configuración', err);
               this.saving.set(false);
            }
         });
   }

   canEdit() {
      return this.auth.hasPermission('configuracion.editar');
   }
}

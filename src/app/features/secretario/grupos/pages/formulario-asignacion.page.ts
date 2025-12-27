import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PrivilegiosService } from '../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../privilegios/domain/models/publicador-privilegio';

interface Publicador {
   id_publicador: number;
   primer_nombre: string;
   primer_apellido: string;
   id_grupo_publicador?: number | null;
   id_estado_publicador?: number;
   rol?: any;
   selected?: boolean;
}

interface Grupo {
   id_grupo: number;
   nombre_grupo: string;
   capitan_grupo?: string;
}

@Component({
   standalone: true,
   selector: 'app-formulario-asignacion',
   imports: [CommonModule, FormsModule],
   templateUrl: './formulario-asignacion.page.html',
   styles: [`
     :host { display: block; height: 100vh; }
     .custom-scrollbar::-webkit-scrollbar { width: 5px; }
     .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
     .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
     .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `]
})
export class FormularioAsignacionPage implements OnInit {
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private http = inject(HttpClient);

   grupoId: number | null = null;
   grupo = signal<Grupo | null>(null);

   // Arrays originales
   availablePublishers = signal<Publicador[]>([]);
   groupMembers = signal<Publicador[]>([]);

   // Privilegios
   privilegiosCatalogo = signal<Privilegio[]>([]);
   publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map()); // id_publicador -> id_privilegio[]

   private authStore = inject(AuthStore);
   private privilegiosService = inject(PrivilegiosService);


   // Search
   searchAvailable = '';
   searchGroup = '';

   saving = signal(false);

   // Initial State Tracking for Diff
   initialMap = new Map<number, number | null>();

   ngOnInit() {
      this.route.paramMap.subscribe(params => {
         const id = params.get('id');
         if (id) {
            this.grupoId = +id;
            this.loadData();
         }
      });
   }

   async loadData() {
      if (!this.grupoId) return;
      try {
         const user = this.authStore.user();
         const params: any = {};
         if (user?.id_congregacion) {
            params.id_congregacion = user.id_congregacion;
         }
         // Asegurar traer todos los registros (evitar paginación por defecto)
         params.skip = 0;
         params.limit = 1000;

         const [grupoRes, allPubs, privilegiosData] = await Promise.all([
            lastValueFrom(this.http.get<Grupo>(`/api/grupos/${this.grupoId}`)),
            lastValueFrom(this.http.get<Publicador[]>('/api/publicadores/', { params })),
            lastValueFrom(this.privilegiosService.getPrivilegios())
         ]);

         this.grupo.set(grupoRes);
         this.privilegiosCatalogo.set(privilegiosData || []);

         // Load privileges map efficiently
         await this.loadAllPublicadorPrivilegios(allPubs || []); // Assuming this populates publicadorPrivilegiosMap

         const members: Publicador[] = [];
         const available: Publicador[] = [];

         allPubs.forEach(p => {
            this.initialMap.set(p.id_publicador, p.id_grupo_publicador || null);

            // Safer comparison: convert both to numbers to avoid string/number mismatch
            if (p.id_grupo_publicador != null && Number(p.id_grupo_publicador) === Number(this.grupoId)) {
               members.push({ ...p, selected: false });
            } else if (!p.id_grupo_publicador) {
               available.push({ ...p, selected: false });
            }
         });

         this.groupMembers.set(members);
         this.availablePublishers.set(available);

      } catch (err) {
         console.error(err);
         alert('Error cargando datos del grupo o publicadores.');
         this.goBack();
      }
   }

   filteredAvailable() {
      return this.availablePublishers().filter(p =>
         (p.primer_nombre + ' ' + p.primer_apellido).toLowerCase().includes(this.searchAvailable.toLowerCase())
      ).sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre));
   }

   filteredGroupMembers() {
      return this.groupMembers().filter(p =>
         (p.primer_nombre + ' ' + p.primer_apellido).toLowerCase().includes(this.searchGroup.toLowerCase())
      ).sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre));
   }

   toggleSelection(p: Publicador) {
      p.selected = !p.selected;
   }

   moveToGroup() {
      const selected = this.availablePublishers().filter(p => p.selected);
      const remaining = this.availablePublishers().filter(p => !p.selected);

      selected.forEach(p => { p.selected = false; p.id_grupo_publicador = this.grupoId; });

      this.availablePublishers.set(remaining);
      this.groupMembers.update(curr => [...curr, ...selected]);
   }

   moveToAvailable() {
      const selected = this.groupMembers().filter(p => p.selected);
      const remaining = this.groupMembers().filter(p => !p.selected);

      selected.forEach(p => { p.selected = false; p.id_grupo_publicador = null; });

      this.groupMembers.set(remaining);
      this.availablePublishers.update(curr => [...curr, ...selected]);
   }

   showSuccess = signal(false);

   async save() {
      this.saving.set(true);
      try {
         const allCurrent = [...this.availablePublishers(), ...this.groupMembers()];
         const modified: Publicador[] = [];

         for (const p of allCurrent) {
            const initialGrp = this.initialMap.get(p.id_publicador);
            const currentGrp = p.id_grupo_publicador || null;
            if (initialGrp !== currentGrp) {
               modified.push(p);
            }
         }

         if (modified.length === 0) {
            this.goBack();
            return;
         }

         await Promise.all(modified.map(p =>
            lastValueFrom(this.http.put(`/api/publicadores/${p.id_publicador}`, {
               id_grupo_publicador: p.id_grupo_publicador
            }))
         ));

         // Show Modern Success State
         this.showSuccess.set(true);
         setTimeout(() => {
            this.goBack();
         }, 1500);

      } catch (err) {
         console.error(err);
         alert('Error guardando cambios.');
      } finally {
         this.saving.set(false);
      }
   }

   getInitials(p: Publicador): string {
      return (p.primer_nombre.charAt(0) + p.primer_apellido.charAt(0)).toUpperCase();
   }

   getAvatarClass(id: number): string {
      const COLORS = [
         'bg-blue-50 text-blue-600',
         'bg-emerald-50 text-emerald-600',
         'bg-orange-50 text-orange-600',
         'bg-purple-50 text-purple-600',
         'bg-cyan-50 text-cyan-600',
         'bg-rose-50 text-rose-600',
         'bg-indigo-50 text-indigo-600'
      ];
      return COLORS[Math.abs(id) % COLORS.length];
   }

   goBack() {
      this.router.navigate(['/secretario/publicadores'], { queryParams: { tab: 'grupos' } });
   }

   // --- Logic for Privileges ---

   async loadAllPublicadorPrivilegios(publicadores: Publicador[]) {
      try {
         const allPrivilegios = await lastValueFrom(
            this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/')
         );

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
      } catch (err) {
         console.error('❌ Error cargando privilegios de publicadores', err);
      }
   }

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
}

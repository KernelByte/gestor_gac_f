import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResumenMensual, InformeConPublicador, InformeLoteItem } from '../../models/informe.model';
import { Privilegio } from '../../../privilegios/domain/models/privilegio';

@Component({
   selector: 'app-informes-table',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './informes-table.component.html',
   host: {
      'class': 'flex-1 min-h-0 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden'
   }
})
export class InformesTableComponent {
   @Input() resumen: ResumenMensual | null = null;
   @Input() saving: boolean = false;

   @Input() privilegios: Privilegio[] = [];
   @Input() publicadorPrivilegiosMap: Map<number, number[]> = new Map();
   @Input() localChanges: Map<number, Partial<InformeLoteItem>> = new Map();

   @Output() informeChange = new EventEmitter<{ pub: InformeConPublicador, field: string, value: any }>();
   @Output() save = new EventEmitter<void>();
   @Output() exportExcel = new EventEmitter<void>();
   @Output() importExcel = new EventEmitter<Event>();

   trackByPub = (_: number, pub: InformeConPublicador) => pub.id_publicador;

   getInitials(name: string): string {
      return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
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

   getRoles(pub: InformeConPublicador): { label: string, type: 'pill' | 'text', class: string }[] {
      const roles: { label: string, type: 'pill' | 'text', class: string }[] = [];

      // 1. Try to get from loaded map (accurate assignments)
      const assignedIds = this.publicadorPrivilegiosMap.get(pub.id_publicador);
      const catalog = this.privilegios;

      if (assignedIds && assignedIds.length > 0 && catalog.length > 0) {
         // Map Ids to Names
         const roleNames = assignedIds.map(id => catalog.find(pr => pr.id_privilegio === id)?.nombre_privilegio?.toLowerCase() || '').filter(Boolean);

         if (roleNames.some(r => r.includes('regular'))) {
            roles.push({ label: 'PRECURSOR REGULAR', type: 'pill', class: 'bg-purple-100 text-purple-700' });
         }
         if (roleNames.some(r => r.includes('auxiliar'))) {
            roles.push({ label: 'PRECURSOR AUXILIAR', type: 'pill', class: 'bg-amber-100 text-amber-700' });
         }
         if (roleNames.some(r => r.includes('especial'))) {
            roles.push({ label: 'PRECURSOR ESPECIAL', type: 'pill', class: 'bg-rose-100 text-rose-700' });
         }
         if (roleNames.some(r => r.includes('anciano'))) {
            roles.push({ label: 'ANCIANO', type: 'pill', class: 'bg-indigo-100 text-indigo-700' });
         }
         if (roleNames.some(r => r.includes('siervo') || r.includes('ministerial'))) {
            roles.push({ label: 'SIERVO MINISTERIAL', type: 'pill', class: 'bg-yellow-100 text-yellow-800' });
         }

      } else {
         // 2. Fallback to 'privilegio_activo' string from backend report summary
         const p = pub.privilegio_activo?.toLowerCase() || '';

         if (p.includes('regular')) {
            roles.push({ label: 'PRECURSOR REGULAR', type: 'pill', class: 'bg-purple-100 text-purple-700' });
         }
         if (p.includes('auxiliar')) {
            roles.push({ label: 'PRECURSOR AUXILIAR', type: 'pill', class: 'bg-amber-100 text-amber-700' });
         }
         if (p.includes('anciano')) {
            roles.push({ label: 'ANCIANO', type: 'pill', class: 'bg-indigo-100 text-indigo-700' });
         }
         if (p.includes('siervo') || p.includes('ministerial')) {
            roles.push({ label: 'SIERVO MINISTERIAL', type: 'pill', class: 'bg-yellow-100 text-yellow-800' });
         }
         if (p.includes('especial')) {
            roles.push({ label: 'PRECURSOR ESPECIAL', type: 'pill', class: 'bg-rose-100 text-rose-700' });
         }
      }

      if (roles.length === 0) {
         roles.push({ label: 'PUBLICADOR', type: 'text', class: 'text-slate-400 font-medium text-[10px] uppercase tracking-wide' });
      }

      return roles;
   }

   getInformeValue(pub: InformeConPublicador, field: string): any {
      const local = this.localChanges.get(pub.id_publicador);
      if (local) {
         if (field === 'participo') return local.participo ?? pub.participo ?? false;
         if (field === 'cursos') return local.cursos_biblicos ?? pub.cursos_biblicos ?? 0;
         if (field === 'horas') return local.horas ?? pub.horas ?? 0;
         if (field === 'notas') return local.observaciones ?? pub.observaciones ?? '';
      }
      if (field === 'participo') return pub.participo ?? false;
      if (field === 'cursos') return pub.cursos_biblicos ?? 0;
      if (field === 'horas') return pub.horas ?? 0;
      if (field === 'notas') return pub.observaciones ?? '';
      return null;
   }

   onUpdateInforme(pub: InformeConPublicador, field: string, event: Event) {
      let value: any;
      if (field === 'participo') value = (event.target as HTMLInputElement).checked;
      else if (field === 'cursos') value = parseInt((event.target as HTMLInputElement).value) || 0;
      else if (field === 'horas') value = parseInt((event.target as HTMLInputElement).value) || 0;
      else if (field === 'notas') value = (event.target as HTMLInputElement).value || null;

      this.informeChange.emit({ pub, field, value });
   }
}

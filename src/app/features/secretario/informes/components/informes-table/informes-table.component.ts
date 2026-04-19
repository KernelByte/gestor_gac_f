import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResumenMensual, InformeConPublicador, InformeLoteItem } from '../../models/informe.model';
import { Privilegio } from '../../../privilegios/domain/models/privilegio';
import { getInitialAvatarStyle } from '../../../../../core/utils/avatar-style.util';

@Component({
   selector: 'app-informes-table',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './informes-table.component.html',
   host: {
      'class': 'flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex flex-col overflow-hidden'
   },
   styles: [`
      @keyframes rowIn {
         from { opacity: 0; transform: translateY(6px); }
         to   { opacity: 1; transform: translateY(0); }
      }
      tbody tr:nth-child(1)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 0ms; }
      tbody tr:nth-child(2)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 25ms; }
      tbody tr:nth-child(3)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 50ms; }
      tbody tr:nth-child(4)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 75ms; }
      tbody tr:nth-child(5)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 100ms; }
      tbody tr:nth-child(6)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 125ms; }
      tbody tr:nth-child(7)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 150ms; }
      tbody tr:nth-child(8)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 175ms; }
      tbody tr:nth-child(9)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 200ms; }
      tbody tr:nth-child(10) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 225ms; }
      tbody tr:nth-child(11) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 250ms; }
      tbody tr:nth-child(12) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 275ms; }
      tbody tr:nth-child(13) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 300ms; }
      tbody tr:nth-child(14) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 325ms; }
      tbody tr:nth-child(15) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 350ms; }
      tbody tr:nth-child(16) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 375ms; }
      tbody tr:nth-child(17) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 400ms; }
      tbody tr:nth-child(18) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 425ms; }
      tbody tr:nth-child(19) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 450ms; }
      tbody tr:nth-child(20) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 475ms; }
      tbody tr:nth-child(n+21) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 475ms; }
      .mobile-cards > *:nth-child(1)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 0ms; }
      .mobile-cards > *:nth-child(2)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 25ms; }
      .mobile-cards > *:nth-child(3)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 50ms; }
      .mobile-cards > *:nth-child(4)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 75ms; }
      .mobile-cards > *:nth-child(5)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 100ms; }
      .mobile-cards > *:nth-child(6)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 125ms; }
      .mobile-cards > *:nth-child(7)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 150ms; }
      .mobile-cards > *:nth-child(8)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 175ms; }
      .mobile-cards > *:nth-child(9)  { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 200ms; }
      .mobile-cards > *:nth-child(10) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 225ms; }
      @media (prefers-reduced-motion: reduce) {
         tbody tr { animation: none !important; opacity: 1; }
         .mobile-cards > * { animation: none !important; opacity: 1; }
      }
   `]
})
export class InformesTableComponent {
   @Input() resumen: ResumenMensual | null = null;
   @Input() saving: boolean = false;
   @Input() canEdit: boolean = true;

   @Input() privilegios: Privilegio[] = [];
   @Input() publicadorPrivilegiosMap: Map<number, number[]> = new Map();
   @Input() localChanges: Map<number, Partial<InformeLoteItem>> = new Map();

   @Output() informeChange = new EventEmitter<{ pub: InformeConPublicador, field: string, value: any }>();
   @Output() save = new EventEmitter<void>();
   @Output() exportExcel = new EventEmitter<void>();
   @Output() importExcel = new EventEmitter<Event>();
   @Output() notifyWhatsApp = new EventEmitter<InformeConPublicador>();

   trackByPub = (_: number, pub: InformeConPublicador) => pub.id_publicador;

   getInitials(name: string): string {
      if (!name) return '';
      return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
   }

   getAvatarStyle(nombre: string): string {
      return getInitialAvatarStyle(nombre || '');
   }

   getRoles(pub: InformeConPublicador): { label: string, type: 'pill' | 'text', class: string }[] {
      const roles: { label: string, type: 'pill' | 'text', class: string }[] = [];
      if (!pub) return roles;

      // 1. Try to get from loaded map (accurate assignments)
      const assignedIds = this.publicadorPrivilegiosMap.get(pub.id_publicador);
      const catalog = this.privilegios || [];

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
         roles.push({ label: 'PUBLICADOR', type: 'text', class: 'text-slate-400 font-medium text-[0.625rem] uppercase tracking-wide' });
      }

      return roles;
   }

   getPioneerRoles(pub: InformeConPublicador): { label: string, type: 'pill' | 'text', class: string }[] {
      return this.getRoles(pub).filter(role => role.label.includes('PRECURSOR'));
   }

   getInformeValue(pub: InformeConPublicador, field: string): any {
      if (!pub) return null;
      const local = this.localChanges.get(pub.id_publicador);
      if (local) {
         if (field === 'participo') return local.participo ?? pub.participo ?? false;
         if (field === 'es_paux') return local.es_paux_mes ?? pub.es_paux_mes ?? false;
         if (field === 'cursos') return local.cursos_biblicos ?? pub.cursos_biblicos ?? 0;
         if (field === 'horas') return local.horas ?? pub.horas ?? 0;
         if (field === 'notas') return local.observaciones ?? pub.observaciones ?? '';
      }
      if (field === 'participo') return pub.participo ?? false;
      if (field === 'es_paux') return pub.es_paux_mes ?? false;
      if (field === 'cursos') return pub.cursos_biblicos ?? 0;
      if (field === 'horas') return pub.horas ?? 0;
      if (field === 'notas') return pub.observaciones ?? '';
      return null;
   }

   onUpdateInforme(pub: InformeConPublicador, field: string, event: Event) {
      if (!this.canEdit) return;
      if (!pub) return;
      let value: any;
      const el = event.target as HTMLInputElement;
      if (field === 'participo') {
         value = el.type === 'radio' ? el.value === 'true' : el.checked;
         // Auto-focus logic: If participating AND (Precursor or Paux)
         if (value) {
            // Auto-expand mobile card when they mark as participated
            this.expandedCards.add(pub.id_publicador);

            const roles = this.getRoles(pub);
            const isPioneer = roles.some(r => r.label.includes('PRECURSOR'));
            const isPaux = this.getInformeValue(pub, 'es_paux');

            if (isPioneer || isPaux) {
               setTimeout(() => this.focusHours(pub.id_publicador), 50);
            }
         }
      }
      else if (field === 'cursos') value = parseInt(el.value) || 0;
      else if (field === 'horas') value = parseInt(el.value) || 0;
      else if (field === 'notas') value = el.value || null;

      this.informeChange.emit({ pub, field, value });
   }

   getBonusHours(pub: InformeConPublicador): number | null {
      if (!pub) return null;
      const roles = this.getRoles(pub);
      const isRegular = roles.some(r => r.label === 'PRECURSOR REGULAR');
      if (!isRegular) return null;

      const hours = this.getInformeValue(pub, 'horas') || 0;
      const notes = this.getInformeValue(pub, 'notas') || '';

      if (typeof notes !== 'string') return null;

      const match = notes.match(/(\d+)/);
      if (!match) return null;

      const obsHours = parseInt(match[1], 10);
      if (isNaN(obsHours) || obsHours <= 0) return null;

      const target = 55;
      if (hours >= target) return null;

      const gap = target - hours;
      const bonus = Math.min(obsHours, gap);

      return bonus > 0 ? bonus : null;
   }

   togglePaux(pub: InformeConPublicador) {
      if (!this.canEdit) return;
      if (!pub || !this.getInformeValue(pub, 'participo')) return;

      const current = this.getInformeValue(pub, 'es_paux');
      const newValue = !current;
      this.informeChange.emit({ pub, field: 'es_paux', value: newValue });

      if (newValue && this.getInformeValue(pub, 'participo')) {
         setTimeout(() => this.focusHours(pub.id_publicador), 50);
      }
   }

   // Modal State
   showValidationModal = false;
   validationModalPublicadores: string[] = [];

   closeValidationModal() {
      this.showValidationModal = false;
      this.validationModalPublicadores = [];
   }

   onSave() {
      if (!this.canEdit) return;
      // Validation: Check for Auxiliary Pioneers with 0 hours
      const publishers0Hours = (this.resumen?.publicadores_list || []).filter(pub => {
         const isPaux = this.getInformeValue(pub, 'es_paux');
         const participated = this.getInformeValue(pub, 'participo');
         const hours = this.getInformeValue(pub, 'horas') || 0;

         return participated && isPaux && hours <= 0;
      });

      if (publishers0Hours.length > 0) {
         this.validationModalPublicadores = publishers0Hours.map(p => p.nombre_completo);
         this.showValidationModal = true;
         return;
      }

      this.save.emit();
   }

   isRegular(pub: InformeConPublicador): boolean {
      const roles = this.getRoles(pub);
      return roles.some(r => r.label === 'PRECURSOR REGULAR' || r.label.includes('REGULAR'));
   }

   private focusHours(id: number) {
      const el = document.getElementById(`horas-${id}`);
      if (el) {
         el.focus({ preventScroll: true });
         (el as HTMLInputElement).select?.();
      }
   }

   // Mobile expansion state
   expandedCards: Set<number> = new Set();

   toggleCard(id: number, event?: Event) {
      if (event) {
         event.stopPropagation();
      }
      if (this.expandedCards.has(id)) {
         this.expandedCards.delete(id);
      } else {
         this.expandedCards.add(id);
      }
   }

   isCardExpanded(id: number): boolean {
      return this.expandedCards.has(id);
   }

}

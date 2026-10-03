import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResumenMensual, InformeConPublicador, InformeLoteItem } from '../../models/informe.model';
import { Privilegio } from '../../../privilegios/domain/models/privilegio';
import { getInitialAvatarStyle } from '../../../../../core/utils/avatar-style.util';

type RolEtiqueta = { label: string, class: string };

/** Colores de las etiquetas de privilegio, con su variante oscura. */
const ROL_CLASES = {
   regular:  'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
   auxiliar: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
   especial: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
   anciano:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
   siervo:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
};

@Component({
   selector: 'app-informes-table',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './informes-table.component.html',
   host: {
      'class': 'flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 flex flex-col overflow-hidden'
   },
   styles: [`
      /* Auto-save status pill: fade text in on state change */
      @keyframes statusIn {
         from { opacity: 0; transform: translateY(3px); }
         to   { opacity: 1; transform: translateY(0); }
      }
      .autosave-status span {
         animation: statusIn 0.18s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .autosave-status svg {
         animation: statusIn 0.18s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @media (prefers-reduced-motion: reduce) {
         .autosave-status span,
         .autosave-status svg { animation: none !important; }
      }
   `]
})
export class InformesTableComponent implements OnChanges {
   @Input() resumen: ResumenMensual | null = null;
   @Input() autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
   @Input() hasPendingChanges: boolean = false;
   /** Filas cuyo autoguardado falló y siguen sin guardarse. */
   @Input() failedSaveCount: number = 0;
   @Input() canEdit: boolean = true;

   @Input() privilegios: Privilegio[] = [];
   @Input() publicadorPrivilegiosMap: Map<number, number[]> = new Map();
   @Input() localChanges: Map<number, Partial<InformeLoteItem>> = new Map();

   @Output() informeChange = new EventEmitter<{ pub: InformeConPublicador, field: string, value: any }>();
   @Output() notifyWhatsApp = new EventEmitter<InformeConPublicador>();

   trackByPub = (_: number, pub: InformeConPublicador) => pub.id_publicador;

   /**
    * Roles ya calculados por publicador. La plantilla llama a getRoles y
    * getPioneerRoles decenas de veces por fila y en cada ciclo de deteccion de
    * cambios; sin esta cache cada llamada rehacia .map().find().filter() sobre
    * el catalogo completo de privilegios. Se recalcula solo cuando cambian las
    * entradas de las que depende.
    */
   private rolesPorPublicador = new Map<number, RolEtiqueta[]>();
   private precursoresPorPublicador = new Map<number, RolEtiqueta[]>();

   ngOnChanges(changes: SimpleChanges): void {
      if (changes['resumen'] || changes['privilegios'] || changes['publicadorPrivilegiosMap']) {
         this.rolesPorPublicador.clear();
         this.precursoresPorPublicador.clear();
      }
   }

   getInitials(name: string): string {
      if (!name) return '';
      return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
   }

   getAvatarStyle(nombre: string): string {
      return getInitialAvatarStyle(nombre || '');
   }

   getRoles(pub: InformeConPublicador): RolEtiqueta[] {
      if (!pub) return [];
      const enCache = this.rolesPorPublicador.get(pub.id_publicador);
      if (enCache) return enCache;
      const calculados = this.calcularRoles(pub);
      this.rolesPorPublicador.set(pub.id_publicador, calculados);
      return calculados;
   }

   private calcularRoles(pub: InformeConPublicador): RolEtiqueta[] {
      const roles: RolEtiqueta[] = [];
      if (!pub) return roles;

      // 1. Try to get from loaded map (accurate assignments)
      const assignedIds = this.publicadorPrivilegiosMap.get(pub.id_publicador);
      const catalog = this.privilegios || [];

      if (assignedIds && assignedIds.length > 0 && catalog.length > 0) {
         // Map Ids to Names
         const roleNames = assignedIds.map(id => catalog.find(pr => pr.id_privilegio === id)?.nombre_privilegio?.toLowerCase() || '').filter(Boolean);

         if (roleNames.some(r => r.includes('regular'))) {
            roles.push({ label: 'PRECURSOR REGULAR', class: ROL_CLASES.regular });
         }
         if (roleNames.some(r => r.includes('auxiliar'))) {
            roles.push({ label: 'PRECURSOR AUXILIAR', class: ROL_CLASES.auxiliar });
         }
         if (roleNames.some(r => r.includes('especial'))) {
            roles.push({ label: 'PRECURSOR ESPECIAL', class: ROL_CLASES.especial });
         }
         if (roleNames.some(r => r.includes('anciano'))) {
            roles.push({ label: 'ANCIANO', class: ROL_CLASES.anciano });
         }
         if (roleNames.some(r => r.includes('siervo') || r.includes('ministerial'))) {
            roles.push({ label: 'SIERVO MINISTERIAL', class: ROL_CLASES.siervo });
         }

      } else {
         // 2. Fallback to 'privilegio_activo' string from backend report summary
         const p = pub.privilegio_activo?.toLowerCase() || '';

         if (p.includes('regular')) {
            roles.push({ label: 'PRECURSOR REGULAR', class: ROL_CLASES.regular });
         }
         if (p.includes('auxiliar')) {
            roles.push({ label: 'PRECURSOR AUXILIAR', class: ROL_CLASES.auxiliar });
         }
         if (p.includes('anciano')) {
            roles.push({ label: 'ANCIANO', class: ROL_CLASES.anciano });
         }
         if (p.includes('siervo') || p.includes('ministerial')) {
            roles.push({ label: 'SIERVO MINISTERIAL', class: ROL_CLASES.siervo });
         }
         if (p.includes('especial')) {
            roles.push({ label: 'PRECURSOR ESPECIAL', class: ROL_CLASES.especial });
         }
      }

      // Sin etiqueta para el publicador sin privilegio: es el caso por defecto
      // y repetir "PUBLICADOR" en cada fila solo añadía ruido.
      return roles;
   }

   getPioneerRoles(pub: InformeConPublicador): RolEtiqueta[] {
      if (!pub) return [];
      const enCache = this.precursoresPorPublicador.get(pub.id_publicador);
      if (enCache) return enCache;
      const soloPrecursores = this.getRoles(pub).filter(role => role.label.includes('PRECURSOR'));
      this.precursoresPorPublicador.set(pub.id_publicador, soloPrecursores);
      return soloPrecursores;
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
            const roles = this.getRoles(pub);
            const isPioneer = roles.some(r => r.label.includes('PRECURSOR'));
            const isPaux = this.getInformeValue(pub, 'es_paux');

            if (isPioneer || isPaux) {
               this.expandedCards.add(pub.id_publicador);
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

   // Animation state
   confirmingPubs = new Set<number>();

   triggerConfirm(pubId: number) {
     this.confirmingPubs.add(pubId);
     setTimeout(() => this.confirmingPubs.delete(pubId), 300);
   }

   get totalPublicadores(): number {
      return this.resumen?.publicadores_list?.length ?? 0;
   }

   /** Cuenta con los cambios locales, para que el progreso responda al instante. */
   get totalReportados(): number {
      return (this.resumen?.publicadores_list ?? []).filter(p => this.getInformeValue(p, 'participo')).length;
   }

   isRegular(pub: InformeConPublicador): boolean {
      const roles = this.getRoles(pub);
      return roles.some(r => r.label === 'PRECURSOR REGULAR' || r.label.includes('REGULAR'));
   }

   /** Enfoca el campo de horas visible: la tabla (escritorio) o la tarjeta (móvil). */
   private focusHours(id: number) {
      const el = [`horas-${id}`, `horas-m-${id}`]
         .map(i => document.getElementById(i))
         .find(e => !!e && e.offsetParent !== null);
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

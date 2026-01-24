import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResumenMensual } from '../../models/informe.model';

@Component({
   selector: 'app-informes-stats',
   standalone: true,
   imports: [CommonModule],
   templateUrl: './informes-stats.component.html',
   styles: [`:host { display: block; }`]
})
export class InformesStatsComponent {
   @Input() resumen: ResumenMensual | null = null;
   get regularHours(): number {
      if (!this.resumen?.publicadores_list) return 0;
      return this.resumen.publicadores_list
         .filter(p => this.isRegular(p))
         .reduce((acc, p) => acc + (p.horas || 0), 0);
   }

   get auxiliaryHours(): number {
      if (!this.resumen?.publicadores_list) return 0;
      return this.resumen.publicadores_list
         .filter(p => this.isAuxiliary(p))
         .reduce((acc, p) => acc + (p.horas || 0), 0);
   }

   get missingReportsCount(): number {
      if (!this.resumen) return 0;
      return (this.resumen.total_publicadores || 0) - (this.resumen.informes_recibidos || 0);
   }

   private isRegular(p: any): boolean {
      const priv = (p.privilegio_activo || '').toUpperCase();
      return priv.includes('REGULAR');
   }

   private isAuxiliary(p: any): boolean {
      const priv = (p.privilegio_activo || '').toUpperCase();
      return priv.includes('AUXILIAR') || p.es_paux_mes === true;
   }
}

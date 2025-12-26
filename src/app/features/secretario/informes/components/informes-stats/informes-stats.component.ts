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
}

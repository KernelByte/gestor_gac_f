import { Component } from '@angular/core';
import { ReunionesProgramacionComponent } from './reuniones-entre-semana.component';

@Component({
  selector: 'app-programacion-wrapper',
  standalone: true,
  imports: [ReunionesProgramacionComponent],
  template: `<app-reuniones-programacion class="block h-full" />`,
})
export class ProgramacionWrapperComponent {}


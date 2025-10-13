import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PublicadoresFacade } from '../../application/publicadores.facade';

@Component({
  standalone: true,
  selector: 'app-publicadores-page',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4">
      <div class="mb-4 flex items-center gap-2">
        <input [(ngModel)]="q" placeholder="Buscar..." class="px-3 py-2 rounded bg-white/5" />
        <button (click)="load()" class="px-3 py-2 bg-blue-600 rounded">Buscar</button>
        <div class="ml-auto">
          <button (click)="exportExcel()" class="px-2 py-1 bg-slate-700 rounded">Exportar Excel</button>
        </div>
      </div>

      <div *ngIf="vm().loading">Cargando...</div>
      <div *ngIf="vm().error" class="text-red-400">{{ vm().error }}</div>

      <table *ngIf="!vm().loading" class="w-full">
        <thead>
          <tr><th>Nombre</th><th>Apellido</th><th>Teléfono</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of vm().list">
            <td>{{ p.primer_nombre }} {{ p.segundo_nombre || '' }}</td>
            <td>{{ p.primer_apellido }} {{ p.segundo_apellido || '' }}</td>
            <td>{{ p.telefono || '—' }}</td>
            <td>
              <button (click)="edit(p)">Editar</button>
              <button (click)="remove(p.id_publicador)">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="mt-3">
        <button (click)="prev()">Anterior</button>
        <button (click)="next()">Siguiente</button>
      </div>
    </div>
  `
})
export class PublicadoresPage implements OnInit {
  facade = inject(PublicadoresFacade);
  vm = this.facade.vm;
  q = '';

  ngOnInit(): void {
    this.facade.load();
  }

  load() {
    this.facade.load({ q: this.q, limit: 10, offset: 0 });
  }

  edit(p: any) {
    const nuevo = prompt('Editar primer nombre', p.primer_nombre);
    if (nuevo !== null) this.facade.update(p.id_publicador, { primer_nombre: nuevo });
  }

  remove(id: number) {
    if (confirm('Confirmar eliminación')) this.facade.remove(id);
  }

  prev() {
    const offset = Math.max(0, (this.vm().params.offset || 0) - (this.vm().params.limit || 10));
    this.facade.load({ offset });
  }

  next() {
    const offset = (this.vm().params.offset || 0) + (this.vm().params.limit || 10);
    this.facade.load({ offset });
  }

  async exportExcel() {
    const blob = await this.facade.exportExcel();
    if (blob instanceof Blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'publicadores.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}

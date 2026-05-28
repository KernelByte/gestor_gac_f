import { Component, Input, Output, EventEmitter, ContentChildren, QueryList, AfterContentInit, Directive, TemplateRef, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  hidden?: boolean;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-wrapper">
      <!-- Tabla -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <!-- Header -->
          <thead>
            <tr class="border-b border-gray-100">
              <th
                *ngFor="let col of visibleColumns"
                class="table-header-cell"
                [style.width]="col.width || 'auto'"
                [class.text-center]="col.align === 'center'"
                [class.text-right]="col.align === 'right'"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>

          <!-- Body -->
          <tbody>
            <!-- Estado vacío -->
            <tr *ngIf="!loading && rows.length === 0">
              <td [attr.colspan]="visibleColumns.length" class="px-4 py-12 text-center">
                <div class="flex flex-col items-center gap-3">
                  <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round"
                        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                    </svg>
                  </div>
                  <p class="text-sm font-semibold text-gray-700">{{ emptyTitle }}</p>
                  <p *ngIf="emptyDescription" class="text-xs text-gray-400">{{ emptyDescription }}</p>
                </div>
              </td>
            </tr>

            <!-- Skeleton loading -->
            <ng-container *ngIf="loading">
              <tr *ngFor="let i of skeletonRows" class="border-b border-gray-100 last:border-0">
                <td *ngFor="let col of visibleColumns" class="table-cell">
                  <div class="h-4 bg-gray-100 rounded animate-pulse" style="width:60%"></div>
                </td>
              </tr>
            </ng-container>

            <!-- Filas reales — proyectar contenido via ng-content -->
            <ng-content select="tbody" *ngIf="!loading && rows.length > 0" />
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div
        *ngIf="pagination && !loading && rows.length > 0"
        class="flex items-center justify-between px-4 py-3 border-t border-gray-100"
      >
        <p class="text-sm text-gray-400">
          Mostrando
          <span class="font-medium text-gray-600">{{ rangeStart }}–{{ rangeEnd }}</span>
          de
          <span class="font-medium text-gray-600">{{ pagination.total }}</span>
          {{ itemLabel }}
        </p>

        <div class="flex items-center gap-1">
          <button
            (click)="prevPage()"
            [disabled]="pagination.page <= 1"
            class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition text-sm"
          >‹</button>

          <span class="px-2 text-xs text-gray-500">
            {{ pagination.page }} / {{ totalPages }}
          </span>

          <button
            (click)="nextPage()"
            [disabled]="pagination.page >= totalPages"
            class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition text-sm"
          >›</button>
        </div>
      </div>
    </div>
  `,
})
export class DataTableComponent {
  @Input({ required: true }) columns: TableColumn[] = [];
  @Input() rows: any[] = [];
  @Input() loading: boolean = false;
  @Input() pagination: PaginationState | null = null;
  @Input() emptyTitle: string = 'Sin resultados';
  @Input() emptyDescription: string = '';
  @Input() itemLabel: string = 'registros';

  @Output() pageChange = new EventEmitter<number>();

  get visibleColumns(): TableColumn[] {
    return this.columns.filter(c => !c.hidden);
  }

  get skeletonRows(): number[] {
    return Array.from({ length: 5 }, (_, i) => i);
  }

  get totalPages(): number {
    if (!this.pagination) return 1;
    return Math.ceil(this.pagination.total / this.pagination.pageSize);
  }

  get rangeStart(): number {
    if (!this.pagination) return 1;
    return (this.pagination.page - 1) * this.pagination.pageSize + 1;
  }

  get rangeEnd(): number {
    if (!this.pagination) return this.rows.length;
    return Math.min(this.pagination.page * this.pagination.pageSize, this.pagination.total);
  }

  prevPage(): void {
    if (this.pagination && this.pagination.page > 1) {
      this.pageChange.emit(this.pagination.page - 1);
    }
  }

  nextPage(): void {
    if (this.pagination && this.pagination.page < this.totalPages) {
      this.pageChange.emit(this.pagination.page + 1);
    }
  }
}

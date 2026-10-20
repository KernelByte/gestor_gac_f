import { Component, ViewEncapsulation, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerritoriosService } from '../services/territorios.service';
import { RegistroS13 } from '../models/territorio.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

/**
 * Registro de asignación de territorio (S-13) por año de servicio (sep–ago).
 * Se arma solo con las salidas y las vueltas completadas; no hay que llevarlo a mano.
 */
@Component({
  standalone: true,
  selector: 'app-registro-s13-page',
  imports: [CommonModule, FormsModule, DatePipe, PageHeaderComponent],
  encapsulation: ViewEncapsulation.None,
  styles: [`
    @media print {
      body * { visibility: hidden !important; }
      #registro-s13, #registro-s13 * { visibility: visible !important; }
      #registro-s13 { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; color: #0f172a !important; background: #fff !important; }
      .no-imprimir { display: none !important; }
      #registro-s13 table { font-size: 10pt; }
      #registro-s13 tr { break-inside: avoid; }
    }
  `],
  template: `
    <div>
      <div class="no-imprimir">
        <app-page-header
          title="Registro de territorios (S-13)"
          subtitle="Cuándo se terminó de trabajar cada territorio y quién lo trabajó">
          <button type="button" (click)="imprimir()" [disabled]="!data()"
            class="btn-primary-green focus-ring-green whitespace-nowrap disabled:opacity-50">
            Imprimir
          </button>
        </app-page-header>

        <div class="flex flex-wrap items-center gap-3 mb-4">
          <label for="anio-servicio" class="text-sm font-semibold text-slate-700 dark:text-slate-300">Año de servicio</label>
          <select id="anio-servicio" [ngModel]="anio()" (ngModelChange)="cambiarAnio($event)"
            class="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100">
            @for (a of anios; track a) {
              <option [ngValue]="a">{{ a }} – {{ a + 1 }} (sep–ago)</option>
            }
          </select>
        </div>
      </div>

      <div id="registro-s13" class="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        @if (loading()) {
          <p class="text-sm text-slate-500">Cargando...</p>
        } @else if (error()) {
          <p class="text-sm text-red-600">No se pudo cargar el registro. Intenta de nuevo.</p>
        } @else if (data(); as d) {
          <h2 class="text-base font-bold text-slate-900 dark:text-white mb-1">
            Registro de asignación de territorio · Año de servicio {{ d.anio_servicio }}–{{ d.anio_servicio + 1 }}
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Del {{ d.desde | date:'d MMM yyyy':'':'es' }} al {{ d.hasta | date:'d MMM yyyy':'':'es' }}
          </p>

          @if (d.territorios.length === 0) {
            <p class="text-sm text-slate-500">Aún no hay territorios registrados.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-sm">
                <thead>
                  <tr class="border-b-2 border-slate-300 dark:border-slate-600">
                    <th scope="col" class="py-2 pr-3 font-bold">Territorio</th>
                    <th scope="col" class="py-2 pr-3 font-bold">Última vez completado antes de este año</th>
                    @for (n of columnas(); track n) {
                      <th scope="col" class="py-2 pr-3 font-bold">Vuelta {{ n }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (t of d.territorios; track t.id_territorio) {
                    <tr class="border-b border-slate-200 dark:border-slate-700 align-top">
                      <td class="py-2 pr-3">
                        <p class="font-bold">{{ t.codigo }}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">{{ t.nombre }}</p>
                      </td>
                      <td class="py-2 pr-3">
                        {{ t.completado_antes ? (t.completado_antes | date:'d/M/yy':'':'es') : '—' }}
                      </td>
                      @for (n of columnas(); track n) {
                        <td class="py-2 pr-3">
                          @if (t.ciclos[n - 1]; as c) {
                            <p>Inicio: {{ c.fecha_inicio | date:'d/M/yy':'':'es' }}</p>
                            <p>
                              @if (c.fecha_fin) { Terminó: {{ c.fecha_fin | date:'d/M/yy':'':'es' }} }
                              @else { <span class="font-semibold text-amber-700 dark:text-amber-400">En curso</span> }
                            </p>
                            @if (c.capitanes.length) {
                              <p class="text-xs text-slate-500 dark:text-slate-400">{{ c.capitanes.join(', ') }}</p>
                            }
                          } @else {
                            <span class="text-slate-400">—</span>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class RegistroS13Page implements OnInit {
  private territoriosService = inject(TerritoriosService);

  /** El año de servicio empieza en septiembre. */
  private static anioActual(): number {
    const hoy = new Date();
    return hoy.getMonth() >= 8 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  }

  anios = [0, 1, 2, 3].map(i => RegistroS13Page.anioActual() - i);
  anio = signal(RegistroS13Page.anioActual());
  data = signal<RegistroS13 | null>(null);
  loading = signal(true);
  error = signal(false);

  /** Tantas columnas "Vuelta n" como la mayor cantidad de vueltas de un territorio (mínimo 1). */
  columnas = computed(() => {
    const max = Math.max(1, ...(this.data()?.territorios ?? []).map(t => t.ciclos.length));
    return Array.from({ length: max }, (_, i) => i + 1);
  });

  ngOnInit(): void {
    this.cargar();
  }

  cambiarAnio(a: number): void {
    this.anio.set(a);
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.error.set(false);
    this.territoriosService.getRegistroS13(this.anio()).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  imprimir(): void {
    window.print();
  }
}

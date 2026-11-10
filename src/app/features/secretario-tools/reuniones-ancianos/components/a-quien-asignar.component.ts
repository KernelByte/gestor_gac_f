import { Component, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { ReunionAncianosService } from '../../services/reunion-ancianos.service';
import { RecomendacionOut } from '../../models/reunion-ancianos.model';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LucideAngularModule } from '../../../../shared/icons';

/** Para qué se pide la sugerencia: la categoría, la fecha y quiénes ya tienen parte en la reunión. */
export interface PedidoSugerencia {
  idCategoria: number;
  /** «Responsable de "Perla espiritual"», «Oración inicial». */
  para: string;
  fecha: string | null;
  ocupados: number[];
  actual: number | null;
}

/**
 * ¿A quién asignar?: los hermanos ordenados por a quién le toca en esa
 * categoría, con la razón en palabras. Los tres primeros van como «Sugerido».
 * Abajo, plegados, los que no se consideraron y por qué. Elegir uno lo pone
 * en la parte; quien decide sigue siendo el cuerpo de ancianos.
 */
@Component({
  selector: 'app-a-quien-asignar',
  standalone: true,
  imports: [ModalComponent, EmptyStateComponent, LucideAngularModule],
  template: `
  <app-modal [open]="!!pedido" (closed)="cerrar.emit()" title="¿A quién asignar?" [subtitle]="pedido?.para || ''" variant="sheet" size="md">
    @if (cargando()) {
      <div class="flex flex-col gap-2" aria-busy="true">@for (_ of [1,2,3,4]; track $index) { <div class="skeleton h-16"></div> }</div>
    } @else if (res(); as r) {
      @if (!r.configurada) {
        <app-empty-state [compact]="true" icon="users" title="Primero active la participación"
          description="En Reuniones teocráticas → Participación, ponga la fecha desde la que se cuenta. Después aquí verá a quién le toca." />
      } @else {
        @if (r.categoria; as c) {
          <p class="mb-3 text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
            Categoría: <span class="cat-chip" [attr.data-color]="c.color"><lucide-icon [name]="c.icono"></lucide-icon>{{ c.etiqueta }}</span>
          </p>
        }
        <ol class="flex flex-col gap-2">
          @for (x of r.candidatos; track x.id_publicador; let i = $index) {
            <li>
              <button type="button" class="cand" [class.cand-sug]="x.sugerido" [attr.aria-current]="x.id_publicador === pedido?.actual ? 'true' : null" (click)="elegir.emit(x.id_publicador)">
                <span class="cand-num" aria-hidden="true">{{ i + 1 }}</span>
                <span class="flex-1 min-w-0 text-left">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold text-slate-900 dark:text-slate-100">{{ x.nombre }}</span>
                    @if (x.sugerido) { <span class="badge-active">Sugerido</span> }
                    @if (x.id_publicador === pedido?.actual) { <span class="badge-neutral">Asignado ahora</span> }
                  </span>
                  <span class="block caption mt-0.5">{{ x.razon }}</span>
                </span>
                <span class="cand-elegir">Elegir</span>
              </button>
            </li>
          } @empty {
            <li class="text-sm text-slate-500 dark:text-slate-400">No hay hermanos disponibles para esta categoría.</li>
          }
        </ol>
        @if (r.no_considerados.length) {
          <details class="mt-4">
            <summary class="text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer min-h-10 flex items-center">
              No considerados ({{ r.no_considerados.length }})
            </summary>
            <ul class="mt-1 flex flex-col gap-1">
              @for (x of r.no_considerados; track x.id_publicador) {
                <li class="text-sm"><strong class="text-slate-800 dark:text-slate-200">{{ x.nombre }}</strong> <span class="text-slate-500 dark:text-slate-400">· {{ x.motivo }}</span></li>
              }
            </ul>
          </details>
        }
        <p class="caption mt-4">La cantidad no mide la idoneidad espiritual; es solo una ayuda. Decide el cuerpo de ancianos.</p>
      }
    } @else if (error()) {
      <app-empty-state [compact]="true" variant="error" title="No se pudo cargar la sugerencia" description="Intente de nuevo." />
    }
  </app-modal>
  `,
  styles: [`
    .cand {
      width: 100%; display: flex; align-items: center; gap: 0.75rem; min-height: 3.5rem; padding: 0.625rem 0.75rem;
      border-radius: 0.875rem; border: 1px solid var(--color-slate-200); background: #fff; text-align: left;
      transition: border-color 150ms ease-out, background-color 150ms ease-out, transform 120ms ease-out;
    }
    :host-context(.dark) .cand { border-color: var(--color-slate-800); background: var(--color-slate-900); }
    .cand:hover { border-color: var(--accent); }
    .cand:active { transform: scale(0.99); }
    .cand:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 2px; }
    .cand-sug { background: color-mix(in oklab, var(--color-green-500) 5%, white); border-color: color-mix(in oklab, var(--color-green-500) 35%, white); }
    :host-context(.dark) .cand-sug { background: rgb(34 197 94 / 0.06); border-color: rgb(34 197 94 / 0.3); }
    .cand-num { width: 1.75rem; height: 1.75rem; flex-shrink: 0; border-radius: 9999px; display: grid; place-items: center; font-size: 0.75rem; font-weight: 700;
      color: var(--color-slate-600); background: var(--color-slate-100); }
    :host-context(.dark) .cand-num { color: var(--color-slate-300); background: var(--color-slate-800); }
    .cand-elegir { font-size: 0.875rem; font-weight: 700; color: var(--accent); }
    :host-context(.dark) .cand-elegir { color: color-mix(in oklab, var(--accent) 45%, white); }
    @media (prefers-reduced-motion: reduce) { .cand:active { transform: none; } }
  `],
})
export class AQuienAsignarComponent implements OnChanges {
  private svc = inject(ReunionAncianosService);

  /** null = cerrado. */
  @Input() pedido: PedidoSugerencia | null = null;
  @Input() idCongregacion: number | null = null;
  @Output() elegir = new EventEmitter<number>();
  @Output() cerrar = new EventEmitter<void>();

  res = signal<RecomendacionOut | null>(null);
  cargando = signal(false);
  error = signal(false);

  ngOnChanges(c: SimpleChanges) {
    if (c['pedido'] && this.pedido) {
      const p = this.pedido;
      this.res.set(null);
      this.error.set(false);
      this.cargando.set(true);
      this.svc.recomendar(p.idCategoria, p.fecha, p.ocupados, this.idCongregacion).subscribe({
        next: r => { this.res.set(r); this.cargando.set(false); },
        error: () => { this.error.set(true); this.cargando.set(false); },
      });
    }
  }
}

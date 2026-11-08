import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { TareaDetailPanelComponent } from '../components/tarea-detail-panel.component';
import { AuthStore } from '../../../../core/auth/auth.store';
import { puedeVerActas } from '../../../../core/auth/acceso-modulos';

@Component({
  standalone: true,
  selector: 'app-tarea-detail',
  imports: [TareaDetailPanelComponent],
  template: `
  <div class="page-outer">
    <div class="page-header">
      <button (click)="volver()" class="nav-back" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
        Volver
      </button>
      <h1 class="page-title">Detalle de tarea</h1>
    </div>

    <div class="card-wrap">
      <app-tarea-detail-panel
        [tareaId]="tareaId"
        [modoDrawer]="false"
        (cerrar)="volver()"
      />
    </div>
  </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
      background: #f0f2f5;
    }
    :host-context(.dark) { background: #020618; }

    /* La vista ocupa justo la pantalla: no hay scroll de página, solo el cuerpo de la tarjeta si el contenido no cabe. */
    .page-outer {
      max-width: 700px;
      height: 100%;
      margin: 0 auto;
      padding: 1.25rem 1.25rem 1.25rem;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    @media (max-width: 640px) {
      .page-outer { padding: 0.75rem 0.75rem 0.75rem; }
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      margin-bottom: 0.875rem;
      padding: 0 0.125rem;
      flex-shrink: 0;
    }
    .page-title {
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }
    :host-context(.dark) .page-title { color: #f1f5f9; }

    .nav-back {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #6b7280;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.35rem 0.5rem;
      border-radius: 7px;
      transition: color 150ms ease-out, background 150ms ease-out, transform 100ms ease-out;
    }
    .nav-back:hover { color: #111827; background: rgba(0,0,0,0.05); }
    .nav-back:active { transform: scale(0.96); }
    :host-context(.dark) .nav-back { color: #64748b; }
    :host-context(.dark) .nav-back:hover { color: #f1f5f9; background: rgba(255,255,255,0.06); }

    /* Card wrapper */
    .card-wrap {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      /* clip (no hidden): hidden crea su propio scroll y el pie fijo del panel dejaría de pegarse al borde de la pantalla */
      overflow: clip;
      border: 1px solid rgba(0,0,0,0.07);
      box-shadow: 0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);
      animation: cardIn 220ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    :host-context(.dark) .card-wrap {
      border-color: #1e2d45;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
    }
    .card-wrap app-tarea-detail-panel { flex: 1; min-height: 0; height: auto; display: flex; flex-direction: column; }
    @media (max-width: 480px) {
      .card-wrap { border-radius: 13px; }
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .card-wrap { animation: none; }
    }
  `],
})
export class TareaDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private store = inject(AuthStore);

  tareaId = 0;
  private origenActaId: number | null = null;
  private desde: string | null = null;

  ngOnInit() {
    // Si se pasa de una tarea a otra, Angular reutiliza esta página: hay que releer la dirección.
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => {
        this.tareaId = Number(params.get('id'));
        const origen = query.get('origen_acta');
        this.origenActaId = origen ? Number(origen) : null;
        this.desde = query.get('desde');
      });
  }

  volver() {
    // Agenda y Mis tareas son ya una sola pantalla (Administración → Agenda).
    if (this.desde === 'agenda' || this.desde === 'mi-agenda') {
      this.router.navigate(['/agenda']);
    } else if (this.origenActaId && puedeVerActas(this.store)) {
      this.router.navigate(['/administracion/actas-reunion', this.origenActaId]);
    } else {
      this.router.navigate(['/agenda'], { queryParams: { vista: 'tareas' } });
    }
  }
}

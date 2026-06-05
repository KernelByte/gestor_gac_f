import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TareaDetailPanelComponent } from '../components/tarea-detail-panel.component';

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
      overflow-y: auto;
      background: #f0f2f5;
    }
    :host-context(.dark) { background: #020618; }

    .page-outer {
      max-width: 700px;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 3rem;
    }
    @media (max-width: 640px) {
      .page-outer { padding: 1rem 0.75rem 2rem; }
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      margin-bottom: 1.125rem;
      padding: 0 0.125rem;
    }
    .page-title {
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
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.07);
      box-shadow: 0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);
      animation: cardIn 220ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    :host-context(.dark) .card-wrap {
      border-color: #1e2d45;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
    }
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
  private router = inject(Router);

  tareaId = 0;
  private origenActaId: number | null = null;
  private desde: string | null = null;

  ngOnInit() {
    this.tareaId = Number(this.route.snapshot.paramMap.get('id'));
    const origen = this.route.snapshot.queryParamMap.get('origen_acta');
    const desde = this.route.snapshot.queryParamMap.get('desde');
    if (origen) this.origenActaId = Number(origen);
    if (desde) this.desde = desde;
  }

  volver() {
    if (this.desde === 'mis-tareas') {
      this.router.navigate(['/herramientas/mis-tareas']);
    } else if (this.origenActaId) {
      this.router.navigate(['/secretario-tools/actas-reunion', this.origenActaId]);
    } else {
      this.router.navigate(['/secretario-tools/actas-reunion']);
    }
  }
}

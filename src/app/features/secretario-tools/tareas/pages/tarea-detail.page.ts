import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TareaDetailPanelComponent } from '../components/tarea-detail-panel.component';

@Component({
  standalone: true,
  selector: 'app-tarea-detail',
  imports: [TareaDetailPanelComponent],
  template: `
  <div class="page-outer">
    <header class="page-header">
      <button (click)="volver()" class="nav-back" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
        Volver
      </button>
      <h1 class="page-title">Detalle de tarea</h1>
    </header>

    <app-tarea-detail-panel
      [tareaId]="tareaId"
      [modoDrawer]="false"
      (cerrar)="volver()"
    />
  </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
      background: #f3f4f6;
    }
    :host-context(.dark) { background: #020618; }

    .page-outer {
      max-width: 860px;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 3rem;
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.75rem;
    }
    .page-title {
      font-size: 1.0625rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }
    :host-context(.dark) .page-title { color: #f1f5f9; }

    .nav-back {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: #6b7280;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.25rem 0;
      transition: color 150ms;
    }
    .nav-back:hover { color: #111827; }
    :host-context(.dark) .nav-back { color: #64748b; }
    :host-context(.dark) .nav-back:hover { color: #f1f5f9; }
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

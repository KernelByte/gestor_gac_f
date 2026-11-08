import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import { catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { InformesService } from '../../secretario/informes/services/informes.service';
import { PublicadorHistorial } from '../../secretario/informes/models/informe.model';
import { anoServicioDe, graficoInformes } from '../dashboard-charts';
import { CountUpDirective } from '../count-up.directive';
import { Medida, MedirDirective } from '../medir.directive';
import { recurso } from '../recurso';
import { MESES, escalaUI, fechaLocal } from '../services/dashboard.service';
import { PanelComponent } from './panel.component';
import { PendientesPanelComponent } from './pendientes-panel.component';
import { tamanoQueCabe } from './rejilla';

@Component({
  selector: 'app-vista-secretario',
  standalone: true,
  imports: [RouterModule, NgxEchartsDirective, PanelComponent, PendientesPanelComponent, CountUpDirective, MedirDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- B · Informes del mes: cifras + un punto por publicador -->
    <app-panel [titulo]="'Informes de ' + periodo()" [subtitulo]="estadoEnvio()" icono="informes" color="azul" area="b"
      enlace="/secretario/informes" enlaceTexto="Revisar"
      [estado]="informes.estado()" (reintentar)="informes.cargar()">
      @if (informes.datos(); as d) {
        <div class="cifras">
          <div class="cifra"><span class="cifra-n"><span [countUp]="porcentaje()">0</span><small>%</small></span><span class="cifra-l">recibidos</span></div>
          <div class="cifra" [class.alerta]="faltan() > 0" [class.ok]="faltan() === 0">
            <span class="cifra-n" [countUp]="faltan()">0</span><span class="cifra-l">{{ faltan() === 1 ? 'falta' : 'faltan' }}</span>
          </div>
          <div class="cifra"><span class="cifra-n" [countUp]="d.resumen.total_cursos">0</span><span class="cifra-l">cursos bíblicos</span></div>
        </div>

        <div class="rellena puntos-caja" (medir)="caja.set($event)">
          <div class="puntos" role="img" [style.--s]="punto() + 'px'"
            [attr.aria-label]="d.resumen.informes_recibidos + ' de ' + d.resumen.total_publicadores + ' publicadores ya enviaron su informe'">
            @for (p of puntos(); track p.id; let i = $index) {
              <span class="pt" [class.lleno]="p.enviado" [style.--i]="i" [attr.title]="p.nombre + (p.enviado ? ' · enviado' : ' · falta')"></span>
            }
          </div>
        </div>

        <div class="ley-pts">
          <span><i class="pt lleno fijo"></i>Enviado</span>
          <span><i class="pt fijo"></i>Falta</span>
          @if (faltan() > 0) { <a routerLink="/secretario/informes" class="mas">Ver quién falta y recordarle</a> }
        </div>
      }
    </app-panel>

    <!-- C · Pendientes de la agenda (atrasado y hoy) -->
    <app-pendientes-panel area="c"/>

    <!-- D · Informes por mes -->
    <app-panel titulo="Informes por mes" subtitulo="Últimos seis meses" icono="grafico" color="azul" area="d"
      [estado]="tendencia.estado()" (reintentar)="tendencia.cargar()"
      [vacio]="grafico() ? null : 'Aún no hay meses con informes para comparar.'">
      @if (grafico(); as g) {
        <div class="rellena"><div echarts [options]="g" [autoResize]="true" class="chart" role="img"
          aria-label="Informes recibidos en cada uno de los últimos seis meses"></div></div>
      }
    </app-panel>
  `,
  styleUrls: ['./contenido.css'],
  styles: [`
    .puntos-caja { overflow: hidden; display: flex; align-items: center; }
    .puntos { display: flex; flex-wrap: wrap; gap: 0.25rem; align-content: center; width: 100%; }
    .pt { width: var(--s, 12px); height: var(--s, 12px); border-radius: 999px; flex-shrink: 0;
      background: #eceef2;
      animation: pt-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(min(var(--i), 150) * 5ms + 150ms); }
    .pt.lleno { background: #3b82f6; box-shadow: none; }
    :host-context(.dark) .pt { background: rgb(71 85 105 / 0.45); }
    :host-context(.dark) .pt.lleno { background: #60a5fa; box-shadow: none; }
    .pt.fijo { display: inline-block; width: 0.625rem; height: 0.625rem; margin-right: 0.375rem; vertical-align: -1px; animation: none; }
    .ley-pts { flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 1rem;
      font-size: 0.75rem; color: var(--color-gray-500, #6b7280); }
    .ley-pts .mas { margin-left: auto; padding: 0; }
    :host-context(.dark) .ley-pts { color: var(--color-slate-400, #94a3b8); }
    @keyframes pt-in { from { opacity: 0; transform: scale(0.2); } }
    @media (prefers-reduced-motion: reduce) { .pt { animation: none; } }
  `],
})
export class VistaSecretarioComponent implements OnInit {
  private ctx = inject(CongregacionContextService);
  private informesSrv = inject(InformesService);

  readonly caja = signal<Medida>({ ancho: 0, alto: 0 });
  private cong = () => this.ctx.effectiveCongregacionId();

  readonly informes = recurso(() => this.informesSrv.getPeriodoContext().pipe(
    switchMap(ctx => {
      const p = ctx.periodo_informes;
      const c = this.cong();
      if (!p || !c) return throwError(() => ({ status: 404 }));
      return forkJoin({
        periodo: of(p),
        resumen: this.informesSrv.getResumenMensual(p.id_periodo, c),
        sucursal: this.informesSrv.getResumenSucursal(p.id_periodo, c).pipe(catchError(() => of(null))),
      });
    }),
  ));

  readonly tendencia = recurso(() => {
    const c = this.cong();
    if (!c) return throwError(() => ({ status: 404 }));
    const ano = anoServicioDe();
    return forkJoin([
      this.informesSrv.getHistorialAnual(c, ano - 1).pipe(catchError(() => of({ ano: ano - 1, publicadores: [] }))),
      this.informesSrv.getHistorialAnual(c, ano),
    ]).pipe(map(([a, b]) => contarPorMes([...a.publicadores, ...b.publicadores])));
  });

  readonly periodo = computed(() => {
    const p = this.informes.datos()?.periodo;
    return p ? (MESES[Number(p.codigo_mes) - 1] ?? 'este mes') : 'este mes';
  });
  readonly porcentaje = computed(() => {
    const r = this.informes.datos()?.resumen;
    return r && r.total_publicadores > 0 ? Math.round((r.informes_recibidos / r.total_publicadores) * 100) : 0;
  });
  readonly faltan = computed(() => {
    const r = this.informes.datos()?.resumen;
    return r ? Math.max(0, r.total_publicadores - r.informes_recibidos) : 0;
  });
  readonly estadoEnvio = computed(() => {
    const s = this.informes.datos()?.sucursal;
    if (!s) return null;
    // La app no envía nada a jw.org: «enviado» es la marca del secretario, y el
    // cierre automático solo congela las cifras del mes.
    if (s.cierre?.cerrado_en) {
      const fecha = fechaCorta(s.cierre.cerrado_en);
      return s.cierre.origen === 'automatico' ? `Cerrado solo el ${fecha}` : `Marcado como enviado el ${fecha}`;
    }
    if (s.cierre_automatico_el) return `Se cierra solo el ${fechaCorta(s.cierre_automatico_el)}`;
    return 'Aún sin marcar como enviado';
  });

  /** Enviados primero: los puntos se «llenan» de izquierda a derecha. */
  readonly puntos = computed(() =>
    (this.informes.datos()?.resumen.publicadores_list ?? [])
      .map(p => ({ id: p.id_publicador, nombre: p.nombre_completo, enviado: p.id_informe != null }))
      .sort((a, b) => Number(b.enviado) - Number(a.enviado))
  );
  readonly punto = computed(() => tamanoQueCabe(this.puntos().length, this.caja(), 4 * escalaUI(), 6 * escalaUI(), 44 * escalaUI()));

  readonly grafico = computed(() => {
    const p = this.tendencia.datos();
    return p && p.length >= 2 ? graficoInformes(p) : null;
  });

  ngOnInit() {
    this.informes.cargar();
    this.tendencia.cargar();
  }

}

function fechaCorta(iso: string) {
  return fechaLocal(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

/** Informes recibidos por mes a partir del historial anual (una consulta por año de servicio). */
function contarPorMes(pubs: PublicadorHistorial[]) {
  const cuenta = new Map<number, number>();
  for (const p of pubs) {
    for (const i of p.informes ?? []) {
      if (i.id_informe == null) continue;
      const clave = i.ano * 100 + i.mes_numero;
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }
  }
  return [...cuenta.entries()]
    .sort(([a], [b]) => a - b)
    .slice(-6)
    .map(([clave, recibidos]) => ({ mes: (MESES[(clave % 100) - 1] ?? '').slice(0, 3).toUpperCase(), recibidos }));
}

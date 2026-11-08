import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { forkJoin, map, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { InformesService } from '../../secretario/informes/services/informes.service';
import { TerritoriosService } from '../../territorios/services/territorios.service';
import { CountUpDirective } from '../count-up.directive';
import { MiSemanaStore } from '../mi-semana.store';
import { Medida, MedirDirective } from '../medir.directive';
import { recurso } from '../recurso';
import { MESES, diaLegible, fechaLocal, escalaUI, filasQueCaben, horaLegible, isoLocal, mesCorto } from '../services/dashboard.service';
import { PanelComponent } from './panel.component';
import { tamanoQueCabe } from './rejilla';

const FILA_PX = 52;

type Frescura = 'fresco' | 'reciente' | 'tibio' | 'viejo' | 'nunca';
interface Tarjeta { id: number; codigo: string; dias: number | null; asignado: string | null; f: Frescura; texto: string }

const FRESCURAS: { id: Frescura; texto: string }[] = [
  { id: 'fresco', texto: 'Menos de 1 mes' },
  { id: 'reciente', texto: '1 a 3 meses' },
  { id: 'tibio', texto: '3 a 6 meses' },
  { id: 'viejo', texto: 'Más de 6 meses' },
  { id: 'nunca', texto: 'Nunca' },
];

function frescura(d: number | null): Frescura {
  if (d == null) return 'nunca';
  if (d < 30) return 'fresco';
  if (d < 90) return 'reciente';
  if (d < 180) return 'tibio';
  return 'viejo';
}

@Component({
  selector: 'app-vista-superintendente',
  standalone: true,
  imports: [RouterModule, PanelComponent, CountUpDirective, MedirDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- B · Mosaico: cada tarjeta, del verde (recién trabajada) al rojo (olvidada) -->
    <app-panel titulo="Territorios" [subtitulo]="resumenTerritorios()" icono="mapa" color="verde" area="b"
      enlace="/territorios" enlaceTexto="Abrir"
      [estado]="territorios.estado()" (reintentar)="territorios.cargar()"
      [vacio]="tarjetas().length ? null : 'Todavía no hay territorios registrados.'">
      <div class="rellena mosaico-caja" (medir)="caja.set($event)">
        <div class="mosaico" [style.--t]="tesela() + 'px'" role="list" aria-label="Territorios según el tiempo sin trabajarse">
          @for (t of tarjetas(); track t.id; let i = $index) {
            <a role="listitem" class="tesela" [attr.data-f]="t.f" [style.--i]="i" routerLink="/territorios"
              [attr.title]="t.codigo + ' · ' + t.texto + (t.asignado ? ' · ' + t.asignado : '')"
              [attr.aria-label]="'Territorio ' + t.codigo + ', ' + t.texto">
              @if (tesela() >= 30) { {{ t.codigo }} }
            </a>
          }
        </div>
      </div>
      <ul class="ley">
        @for (f of frescuras; track f.id) {
          @if (conteo()[f.id]) { <li><i [attr.data-f]="f.id"></i>{{ f.texto }} <b>{{ conteo()[f.id] }}</b></li> }
        }
      </ul>
    </app-panel>

    <!-- C · Salidas de los próximos 7 días -->
    <app-panel titulo="Salidas a predicar" [subtitulo]="sinCapitan() ? sinCapitan() + ' sin capitán' : 'Próximos siete días'"
      icono="salidas" color="verde" area="c" enlace="/horarios" enlaceTexto="Abrir"
      [estado]="s.salidas.estado()" (reintentar)="s.salidas.cargar()"
      [vacio]="salidas().length ? null : 'No hay salidas en los próximos siete días.'">
      <div class="rellena" (medir)="altoSalidas.set($event.alto)">
        <ul class="filas">
          @for (x of salidasVisibles(); track x.id_horario; let i = $index) {
            <li>
              <a class="fila" routerLink="/horarios" [style.--i]="i">
                <span class="fecha"><b>{{ diaNum(x.fecha) }}</b><span>{{ mes(x.fecha) }}</span></span>
                <span class="txt">
                  <span class="t1">{{ dia(x.fecha) }}{{ x.hora_inicio ? ' · ' + hora(x.hora_inicio) : '' }}</span>
                  <span class="t2">{{ x.capitanes.length ? x.capitanes[0].nombre : 'Sin capitán' }}{{ (x.punto?.nombre || x.lugar) ? ' · ' + (x.punto?.nombre || x.lugar) : '' }}</span>
                </span>
                @if (!x.capitanes.length) { <span class="chip chip-alerta">Sin capitán</span> }
                @else if (x.codigo_territorio) { <span class="chip chip-neutro">{{ x.codigo_territorio }}</span> }
              </a>
            </li>
          }
        </ul>
        @if (salidasRestantes() > 0) { <a routerLink="/horarios" class="mas">y {{ salidasRestantes() }} más</a> }
      </div>
    </app-panel>

    <!-- D · Informes del alcance -->
    <app-panel [titulo]="'Informes de ' + periodo()" [subtitulo]="porGrupo() ? 'Tu grupo' : 'Toda la congregación'"
      icono="informes" color="azul" area="d" enlace="/secretario/informes" enlaceTexto="Abrir"
      [estado]="informes.estado()" (reintentar)="informes.cargar()">
      @if (informes.datos(); as d) {
        <div class="cifras">
          <div class="cifra"><span class="cifra-n"><span [countUp]="porcentaje()">0</span><small>%</small></span><span class="cifra-l">recibidos</span></div>
          <div class="cifra" [class.alerta]="faltan() > 0" [class.ok]="faltan() === 0"><span class="cifra-n" [countUp]="faltan()">0</span><span class="cifra-l">{{ faltan() === 1 ? 'falta' : 'faltan' }}</span></div>
        </div>
        <div class="rellena" (medir)="altoInformes.set($event.alto)">
          <ul class="filas">
            @for (p of sinInformeVisibles(); track p.id_publicador; let i = $index) {
              <li class="fila" [style.--i]="i">
                <span class="inicial" aria-hidden="true">{{ p.nombre_completo.charAt(0) }}</span>
                <span class="txt"><span class="t1">{{ p.nombre_completo }}</span><span class="t2">{{ p.privilegio_activo || 'Publicador' }}</span></span>
                <span class="chip chip-aviso">Falta</span>
              </li>
            }
          </ul>
          @if (sinInformeRestantes() > 0) { <a routerLink="/secretario/informes" class="mas">y {{ sinInformeRestantes() }} más</a> }
        </div>
      }
    </app-panel>
  `,
  styleUrls: ['./contenido.css'],
  styles: [`
    .mosaico-caja { overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .mosaico { display: flex; flex-wrap: wrap; gap: 0.375rem; align-content: center; justify-content: center; width: 100%; }
    .tesela { width: var(--t, 40px); height: var(--t, 40px); flex-shrink: 0; display: grid; place-items: center;
      border-radius: calc(var(--t, 40px) * 0.22); text-decoration: none;
      font-family: 'JetBrains Mono', monospace; font-size: clamp(0.5625rem, calc(var(--t, 40px) * 0.27), 0.875rem); font-weight: 700;
      transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 160ms ease;
      animation: tesela-in 460ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(min(var(--i, 0), 90) * 10ms + 120ms); }
    a.tesela:focus-visible { outline: 2px solid #16a34a; outline-offset: 2px; }
    @media (hover: hover) and (pointer: fine) { a.tesela:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 2px 8px rgb(15 23 42 / 0.08); } }
    a.tesela:active { transform: scale(0.95); }
    .tesela[data-f="fresco"]   { background: #16a34a; color: white; }
    .tesela[data-f="reciente"] { background: #4ade80; color: #14532d; }
    .tesela[data-f="tibio"]    { background: #facc15; color: #713f12; }
    .tesela[data-f="viejo"]    { background: #f87171; color: #7f1d1d; }
    .tesela[data-f="nunca"]    { background: transparent; color: var(--color-gray-500, #6b7280); box-shadow: inset 0 0 0 1px var(--color-gray-300, #d1d5db); }
    :host-context(.dark) .tesela[data-f="fresco"]   { background: #22c55e; color: #052e16; }
    :host-context(.dark) .tesela[data-f="reciente"] { background: #86efac; color: #14532d; }
    :host-context(.dark) .tesela[data-f="tibio"]    { background: #fde047; }
    :host-context(.dark) .tesela[data-f="viejo"]    { background: #fca5a5; }
    :host-context(.dark) .tesela[data-f="nunca"]    { color: #94a3b8; box-shadow: inset 0 0 0 1px rgb(71 85 105); }

    .ley { flex-shrink: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 0.875rem; font-size: 0.75rem; color: var(--color-gray-500, #6b7280); }
    .ley li { display: inline-flex; align-items: center; gap: 0.375rem; }
    .ley b { color: var(--color-gray-800, #1f2937); font-variant-numeric: tabular-nums; }
    .ley i { width: 0.75rem; height: 0.75rem; border-radius: 0.1875rem; }
    .ley i[data-f="fresco"] { background: #16a34a; } .ley i[data-f="reciente"] { background: #4ade80; }
    .ley i[data-f="tibio"] { background: #facc15; } .ley i[data-f="viejo"] { background: #f87171; }
    .ley i[data-f="nunca"] { box-shadow: inset 0 0 0 1px var(--color-gray-300, #d1d5db); }
    :host-context(.dark) .ley { color: var(--color-slate-400, #94a3b8); }
    :host-context(.dark) .ley b { color: var(--color-slate-100, #f1f5f9); }
    @keyframes tesela-in { from { opacity: 0; transform: scale(0.6); } }
    @media (prefers-reduced-motion: reduce) { .tesela { animation: none; } }
  `],
})
export class VistaSuperintendenteComponent implements OnInit {
  readonly s = inject(MiSemanaStore);
  private auth = inject(AuthStore);
  private ctx = inject(CongregacionContextService);
  private informesSrv = inject(InformesService);
  private territoriosSrv = inject(TerritoriosService);

  readonly frescuras = FRESCURAS;
  readonly caja = signal<Medida>({ ancho: 0, alto: 0 });
  readonly altoSalidas = signal(0);
  readonly altoInformes = signal(0);
  readonly porGrupo = computed(() => !this.auth.isAdministrador() && !this.auth.hasPermission('informes.editar_todos'));

  readonly territorios = recurso(() => forkJoin({
    lista: this.territoriosSrv.getTerritorios(0, 1000),
    resumen: this.territoriosSrv.getResumen(),
  }));

  readonly informes = recurso(() => this.informesSrv.getPeriodoContext().pipe(
    switchMap(ctx => {
      const p = ctx.periodo_informes;
      const c = this.ctx.effectiveCongregacionId();
      if (!p || !c) return throwError(() => ({ status: 404 }));
      return this.informesSrv.getResumenMensual(p.id_periodo, c).pipe(map(resumen => ({ periodo: p, resumen })));
    }),
  ));

  readonly tarjetas = computed<Tarjeta[]>(() => {
    const d = this.territorios.datos();
    if (!d) return [];
    const res = new Map(d.resumen.map(r => [r.id_territorio, r]));
    return d.lista.map(t => {
      const r = res.get(t.id_territorio);
      const dias = r?.dias_sin_trabajar ?? null;
      return {
        id: t.id_territorio, codigo: t.codigo, dias, asignado: r?.asignado_a ?? null, f: frescura(dias),
        texto: dias == null ? 'nunca trabajado' : dias === 0 ? 'trabajado hoy' : `${dias} ${dias === 1 ? 'día' : 'días'} sin trabajar`,
      };
    }).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  });
  readonly tesela = computed(() => tamanoQueCabe(this.tarjetas().length, this.caja(), 6 * escalaUI(), 14 * escalaUI(), 84 * escalaUI()));
  readonly conteo = computed(() => {
    const c: Record<Frescura, number> = { fresco: 0, reciente: 0, tibio: 0, viejo: 0, nunca: 0 };
    for (const t of this.tarjetas()) c[t.f]++;
    return c;
  });
  readonly resumenTerritorios = computed(() => {
    const n = this.tarjetas().length;
    if (!n) return 'Según el tiempo sin trabajarse';
    const atencion = this.conteo().viejo + this.conteo().nunca;
    return atencion ? `${n} tarjetas · ${atencion} necesitan atención` : `${n} tarjetas · todas al día`;
  });

  readonly salidas = computed(() => {
    const tope = new Date();
    tope.setDate(tope.getDate() + 6);
    const t = isoLocal(tope);
    return (this.s.salidas.datos()?.salidas ?? [])
      .filter(x => !x.sin_salida && x.fecha <= t)
      .sort((a, b) => (a.fecha + (a.hora_inicio ?? '')).localeCompare(b.fecha + (b.hora_inicio ?? '')));
  });
  readonly sinCapitan = computed(() => this.salidas().filter(x => !x.capitanes.length).length);
  private readonly cabenSalidas = computed(() => {
    const n = this.salidas().length;
    return n <= filasQueCaben(this.altoSalidas(), FILA_PX, 0) ? n : filasQueCaben(this.altoSalidas() - 26 * escalaUI(), FILA_PX);
  });
  readonly salidasVisibles = computed(() => this.salidas().slice(0, this.cabenSalidas()));
  readonly salidasRestantes = computed(() => this.salidas().length - this.salidasVisibles().length);

  readonly periodo = computed(() => {
    const p = this.informes.datos()?.periodo;
    return p ? (MESES[Number(p.codigo_mes) - 1] ?? 'este mes') : 'este mes';
  });
  readonly porcentaje = computed(() => {
    const r = this.informes.datos()?.resumen;
    return r && r.total_publicadores ? Math.round((r.informes_recibidos / r.total_publicadores) * 100) : 0;
  });
  readonly faltan = computed(() => {
    const r = this.informes.datos()?.resumen;
    return r ? Math.max(0, r.total_publicadores - r.informes_recibidos) : 0;
  });
  private readonly sinInforme = computed(() =>
    (this.informes.datos()?.resumen.publicadores_list ?? []).filter(p => p.id_informe == null));
  private readonly cabenInformes = computed(() => {
    const n = this.sinInforme().length;
    return n <= filasQueCaben(this.altoInformes(), FILA_PX, 0) ? n : filasQueCaben(this.altoInformes() - 26 * escalaUI(), FILA_PX, 0);
  });
  readonly sinInformeVisibles = computed(() => this.sinInforme().slice(0, this.cabenInformes()));
  readonly sinInformeRestantes = computed(() => this.sinInforme().length - this.sinInformeVisibles().length);

  ngOnInit() {
    this.s.asegurarSalidas();
    this.territorios.cargar();
    this.informes.cargar();
  }

  dia(iso: string) { return diaLegible(iso); }
  hora(h: string | null) { return horaLegible(h); }
  diaNum(iso: string) { return fechaLocal(iso).getDate(); }
  mes(iso: string) { return mesCorto(iso); }
}

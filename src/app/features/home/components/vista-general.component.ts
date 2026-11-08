import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MiSemanaStore } from '../mi-semana.store';
import { MedirDirective } from '../medir.directive';
import { recurso } from '../recurso';
import { DashboardService, diaLegible, diasHasta, fechaLocal, filasQueCaben, horaLegible, mesCorto } from '../services/dashboard.service';
import { PanelComponent } from './panel.component';
import { PendientesPanelComponent } from './pendientes-panel.component';

const FILA_PX = 52;

@Component({
  selector: 'app-vista-general',
  standalone: true,
  imports: [RouterModule, PanelComponent, PendientesPanelComponent, MedirDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- B · Lectura de la Biblia: el anillo crece con el espacio -->
    <app-panel titulo="Lectura de la Biblia" [subtitulo]="subLectura()" icono="lectura" color="violeta" area="b"
      [estado]="lectura.estado()" (reintentar)="lectura.cargar()">
      @if (lectura.datos()?.plan && lectura.datos()?.resumen; as r) {
        <div class="lectura rellena">
          <svg class="anillo" viewBox="0 0 120 120" role="img" [attr.aria-label]="'Llevas el ' + pct() + ' % de tu plan de lectura'">
            <defs>
              <linearGradient id="anillo-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#a78bfa" /><stop offset="1" stop-color="#6d28d9" />
              </linearGradient>
            </defs>
            <circle class="fondo" cx="60" cy="60" r="50" />
            <circle class="valor" cx="60" cy="60" r="50" pathLength="100" [attr.stroke-dasharray]="pct() + ' 100'" />
            <text x="60" y="60" class="n">{{ pct() }}<tspan class="pc">%</tspan></text>
            <text x="60" y="78" class="l">del plan</text>
          </svg>
          <div class="datos">
            <p class="racha">
              <svg class="llama" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.6 3.2-1.4 5-3 6.8C7.4 10.6 6 12.3 6 15a6 6 0 0 0 12 0c0-2.4-1.1-4.4-2.6-5.9-.3 1.5-1.1 2.6-2.4 3.1.6-3.6-.4-7.6-1-10.2Z"/></svg>
              <b>{{ r.racha }}</b><span>{{ r.racha === 1 ? 'día seguido' : 'días seguidos' }}</span>
            </p>
            <p class="suave">{{ completadas() }} de {{ lectura.datos()!.plan!.sesiones_total }} lecturas hechas.</p>
            @if (animo(); as m) { <p class="animo">{{ m }}</p> }
          </div>
        </div>
      } @else {
        <div class="lectura rellena">
          <svg class="anillo" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="fondo" cx="60" cy="60" r="50" />
            <text x="60" y="60" class="n">0<tspan class="pc">%</tspan></text>
            <text x="60" y="78" class="l">sin plan</text>
          </svg>
          <div class="datos">
            <p class="plan-titulo">Aún no tienes un plan de lectura.</p>
            <p class="suave">Elige uno en la app GAC de tu teléfono: toda la Biblia en un año, por temas o libro por libro. Aquí verás tu avance.</p>
          </div>
        </div>
      }
    </app-panel>

    <!-- C · Salidas de mi grupo -->
    <app-panel titulo="Salidas a predicar" subtitulo="De tu grupo" icono="salidas" color="verde" area="c"
      [estado]="s.salidas.estado()" (reintentar)="s.salidas.cargar()"
      [vacio]="s.misSalidas().length ? null : 'No hay salidas programadas para tu grupo estos días.'">
      <div class="rellena" (medir)="altoSalidas.set($event.alto)">
        <ul class="filas">
          @for (x of salidasVisibles(); track x.id_horario; let i = $index) {
            <li class="fila" [style.--i]="i">
              <span class="fecha"><b>{{ diaNum(x.fecha) }}</b><span>{{ mes(x.fecha) }}</span></span>
              <span class="txt">
                <span class="t1">{{ dia(x.fecha) }}{{ x.hora_inicio ? ' · ' + hora(x.hora_inicio) : '' }}</span>
                <span class="t2">{{ x.punto?.nombre || x.lugar || 'Punto por confirmar' }}{{ x.capitanes.length ? ' · ' + x.capitanes[0].nombre : '' }}</span>
              </span>
              @if (x.soy_capitan) { <span class="chip chip-info">Eres capitán</span> }
            </li>
          }
        </ul>
      </div>
    </app-panel>

    <!-- D · Pendientes: lo atrasado y lo de hoy (tareas y, si es anciano, su agenda) -->
    <app-pendientes-panel area="d"/>
  `,
  styleUrls: ['./contenido.css'],
  styles: [`
    .lectura { display: flex; align-items: center; justify-content: center; gap: clamp(1rem, 4cqw, 2.5rem); container-type: size; }
    .anillo { flex: 0 0 auto; width: min(48cqw, 92cqh, 15rem); height: auto; aspect-ratio: 1; transform: rotate(-90deg); }
    .anillo text { transform: rotate(90deg); transform-origin: 60px 60px; text-anchor: middle; }
    .fondo { fill: none; stroke: var(--color-gray-100, #f3f4f6); stroke-width: 11; }
    .valor { fill: none; stroke: url(#anillo-g); stroke-width: 11; stroke-linecap: round;
      animation: anillo-in 1.3s cubic-bezier(0.22, 1, 0.36, 1) both 200ms; }
    :host-context(.dark) .fondo { stroke: rgb(51 65 85 / 0.6); }
    .n { font-family: var(--font-display, 'Urbanist', sans-serif); font-weight: 700; font-size: 30px; fill: var(--color-gray-900, #111827); }
    .pc { font-size: 15px; fill: var(--color-gray-400, #9ca3af); }
    .l { font-size: 10.5px; font-weight: 600; fill: var(--color-gray-500, #6b7280); }
    :host-context(.dark) .n { fill: var(--color-slate-50, #f8fafc); }
    :host-context(.dark) .l { fill: var(--color-slate-400, #94a3b8); }
    @keyframes anillo-in { from { stroke-dasharray: 0 100; } }

    .datos { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; max-width: 18rem; }
    .racha { display: flex; align-items: center; gap: 0.375rem; color: var(--color-gray-600, #4b5563); font-size: 0.875rem; }
    .racha b { font-family: var(--font-display, 'Urbanist', sans-serif); font-size: 2rem; line-height: 1; color: var(--color-gray-900, #111827); }
    :host-context(.dark) .racha { color: var(--color-slate-300, #cbd5e1); }
    :host-context(.dark) .racha b { color: var(--color-slate-50, #f8fafc); }
    .llama { width: 1.625rem; height: 1.625rem; color: #f97316; transform-origin: 50% 90%; animation: llama 2.6s ease-in-out infinite; }
    @keyframes llama { 0%, 100% { transform: scale(1) rotate(-3deg); } 50% { transform: scale(1.1) rotate(3deg); } }
    .plan-titulo { font-size: 0.9375rem; font-weight: 600; line-height: 1.3; color: var(--color-gray-900, #111827); text-wrap: balance; }
    :host-context(.dark) .plan-titulo { color: var(--color-slate-50, #f8fafc); }
    .animo { font-size: 0.8125rem; font-weight: 600; color: var(--color-brand-purple); }
    :host-context(.dark) .animo { color: #c4b5fd; }
    @container (max-height: 9rem) { .datos .suave { display: none; } }
    @media (prefers-reduced-motion: reduce) { .valor, .llama { animation: none; } }
  `],
})
export class VistaGeneralComponent implements OnInit {
  readonly s = inject(MiSemanaStore);
  private dash = inject(DashboardService);

  readonly altoSalidas = signal(0);
  readonly lectura = recurso(() => this.dash.planLectura());

  readonly completadas = computed(() => this.lectura.datos()?.sesiones_completadas?.length ?? 0);
  readonly pct = computed(() => Math.min(100, Math.round(this.lectura.datos()?.resumen?.porcentaje ?? 0)));
  readonly subLectura = computed(() => {
    const u = this.lectura.datos()?.resumen?.ultima_lectura;
    return u ? `Última lectura: ${diaLegible(u).toLowerCase()}` : null;
  });
  readonly animo = computed(() => {
    const r = this.lectura.datos()?.resumen;
    if (!r?.ultima_lectura) return null;
    if (-diasHasta(r.ultima_lectura) >= 3) return 'Hoy es buen día para retomarla.';
    if (r.racha >= 7) return '¡Más de una semana leyendo cada día!';
    return null;
  });

  private readonly cabenSalidas = computed(() => filasQueCaben(this.altoSalidas(), FILA_PX));
  readonly salidasVisibles = computed(() => this.s.misSalidas().slice(0, this.cabenSalidas()));

  ngOnInit() {
    this.lectura.cargar();
    this.s.asegurarSalidas();
  }

  dia(iso: string) { return diaLegible(iso); }
  hora(h: string | null) { return horaLegible(h); }
  diaNum(iso: string) { return fechaLocal(iso).getDate(); }
  mes(iso: string) { return mesCorto(iso); }
}

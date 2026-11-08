import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MiSemanaStore, NOMBRE_REUNION } from '../mi-semana.store';
import { MedirDirective } from '../medir.directive';
import { diaLegible, fechaLocal, escalaUI, filasQueCaben, horaLegible, mesCorto } from '../services/dashboard.service';
import { PanelComponent } from './panel.component';

const FILA_PX = 52;

interface FilaSemana { clave: string; fecha: string; t1: string; t2: string; mia: boolean }

/** Lo personal, primero en todas las vistas: la próxima reunión, qué me toca y mi informe. */
@Component({
  selector: 'app-mi-semana',
  standalone: true,
  imports: [RouterModule, PanelComponent, MedirDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-panel titulo="Mi semana" icono="semana" color="violeta" area="a"
      [estado]="s.resumen.estado()" (reintentar)="s.resumen.cargar()"
      [vacio]="s.proxima() ? null : 'Todavía no hay reuniones programadas para tu congregación.'">
      @if (s.proxima(); as r) {
        <div class="reunion">
          <p class="rotulo">Próxima reunión · {{ r.tipo === 'fin_semana' ? 'fin de semana' : 'entre semana' }}</p>
          <p class="cuando">{{ dia(r.fecha!) }}@if (hora(r.hora)) {<span class="hora"> · {{ hora(r.hora) }}</span>}</p>
          @if (s.lugar()) { <p class="lugar">{{ s.lugar() }}</p> }
        </div>

        <div class="toca" (medir)="alto.set($event.alto)">
          @if (filas().length) {
            <p class="rotulo">{{ hayMias() ? 'Lo que te toca' : 'Lo que viene' }}</p>
            <ul class="filas">
              @for (f of visibles(); track f.clave; let i = $index) {
                <li [style.--i]="i" [style.display]="'contents'">
                 @if (f.mia) {
                  <a class="fila" routerLink="/reuniones/resumen" [style.--i]="i">
                  <span class="fecha" [class.mia]="f.mia"><b>{{ diaNum(f.fecha) }}</b><span>{{ mes(f.fecha) }}</span></span>
                  <span class="txt"><span class="t1">{{ f.t1 }}</span><span class="t2">{{ f.t2 }}</span></span>
                  <span class="chip chip-info">Tú</span>
                  </a>
                 } @else {
                  <div class="fila" [style.--i]="i">
                  <span class="fecha" [class.mia]="f.mia"><b>{{ diaNum(f.fecha) }}</b><span>{{ mes(f.fecha) }}</span></span>
                  <span class="txt"><span class="t1">{{ f.t1 }}</span><span class="t2">{{ f.t2 }}</span></span>
                  </div>
                 }
                </li>
              }
            </ul>
            @if (restantes() > 0) { <p class="mas">y {{ restantes() }} más</p> }
          } @else if (alto() >= 64) {
            <p class="suave clamp">No tienes asignaciones en las próximas reuniones.</p>
          }
        </div>
      }

      <!-- Mi informe: una franja al pie, siempre visible (las tareas van en «Pendientes») -->
      @if (s.informe.datos()) {
        <div class="pie">
          @if (s.informe.datos(); as i) {
            <div class="pie-item" [class.ok]="i.enviado" [class.aviso]="!i.enviado && s.plazoDias() >= 0" [class.alerta]="!i.enviado && s.plazoDias() < 0">
              <span class="pie-ic" aria-hidden="true">
                @if (i.enviado) {
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
                } @else {
                  <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-12.25a.75.75 0 0 0-1.5 0v4.5c0 .2.08.39.22.53l2.5 2.5a.75.75 0 1 0 1.06-1.06l-2.28-2.28V5.75Z" clip-rule="evenodd"/></svg>
                }
              </span>
              <span class="txt">
                <span class="t1">Informe de {{ (s.informePeriodo() || 'este mes').toLowerCase() }}</span>
                <span class="t2">{{ textoInforme() }}</span>
              </span>
            </div>
          }
        </div>
      }
    </app-panel>
  `,
  styleUrls: ['./contenido.css'],
  styles: [`
    .rotulo { font-size: 0.75rem; font-weight: 600; color: var(--dash-texto-suave); }
    .reunion { flex-shrink: 0; display: flex; flex-direction: column; gap: 0.25rem; padding-bottom: 0.875rem;
      border-bottom: 1px solid var(--color-gray-100, #f3f4f6); }
    :host-context(.dark) .reunion { border-bottom-color: rgb(51 65 85 / 0.5); }
    .cuando { font-family: var(--font-display, 'Urbanist', sans-serif); font-weight: 700; font-size: var(--cuando, 1.75rem);
      line-height: 1.1; letter-spacing: -0.02em; color: var(--color-gray-900, #111827); }
    .hora { color: var(--estado-info-punto); }
    :host-context(.dark) .cuando { color: var(--color-slate-50, #f8fafc); }
    .lugar { font-size: 0.8125rem; color: var(--dash-texto-suave); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .toca { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.25rem; padding-top: 0.75rem; overflow: hidden; }
    .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .pie { flex-shrink: 0; display: flex; gap: 0.5rem; padding-top: 0.75rem; }
    .pie-item { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.75rem;
      border-radius: 0.75rem; background: var(--color-gray-50, #f9fafb); color: inherit; transition: background-color 150ms ease; }
    :host-context(.dark) .pie-item { background: rgb(30 41 59 / 0.7); }
    .pie-ic { width: 1.75rem; height: 1.75rem; flex-shrink: 0; display: grid; place-items: center; border-radius: 999px; }
    .pie-ic svg { width: 1rem; height: 1rem; }
    .pie-item.ok .pie-ic { background: var(--estado-ok-bg); color: var(--estado-ok-punto); }
    .pie-item.aviso .pie-ic { background: var(--estado-aviso-bg); color: var(--estado-aviso-punto); }
    .pie-item.alerta .pie-ic { background: var(--estado-alerta-bg); color: var(--estado-alerta-punto); }
  `],
})
export class MiSemanaComponent {
  readonly s = inject(MiSemanaStore);
  readonly alto = signal(0);

  /** Primero lo que me toca; si sobra espacio, lo que viene (otra reunión, salidas de mi grupo). */
  readonly filas = computed<FilaSemana[]>(() => {
    const mias: FilaSemana[] = this.s.misAsignaciones().map((a, i) => ({
      clave: 'm' + i, fecha: a.fecha, t1: a.texto, t2: `${diaLegible(a.fecha)} · ${a.detalle}`, mia: true }));
    const extra: FilaSemana[] = [];
    const sig = this.s.siguiente();
    if (sig?.fecha) {
      extra.push({ clave: 'r' + sig.fecha, fecha: sig.fecha, mia: false, t1: NOMBRE_REUNION[sig.tipo] ?? 'Reunión',
        t2: [diaLegible(sig.fecha), horaLegible(sig.hora), sig.discurso_publico?.titulo ? '«' + sig.discurso_publico.titulo + '»' : null].filter(Boolean).join(' · ') });
    }
    for (const x of this.s.misSalidas().filter(x => !x.soy_capitan).slice(0, 4)) {
      extra.push({ clave: 's' + x.id_horario, fecha: x.fecha, mia: false, t1: 'Salida a predicar',
        t2: [diaLegible(x.fecha), horaLegible(x.hora_inicio), x.punto?.nombre || x.lugar].filter(Boolean).join(' · ') });
    }
    return [...mias, ...extra.sort((a, b) => a.fecha.localeCompare(b.fecha))];
  });
  readonly hayMias = computed(() => this.filas().some(f => f.mia));
  private readonly caben = computed(() => {
    const disponible = this.alto() - 34;
    const n = this.filas().length;
    const todas = filasQueCaben(disponible, FILA_PX, 0);
    if (n <= todas) return n;
    // No caben todas: se reserva el alto de «y N más» solo si queda fuera algo propio.
    const quedanMias = this.filas().slice(todas).some(f => f.mia);
    return quedanMias ? filasQueCaben(disponible - 24 * escalaUI(), FILA_PX, 0) : todas;
  });
  readonly visibles = computed(() => this.filas().slice(0, this.caben()));
  readonly restantes = computed(() => this.filas().slice(this.caben()).filter(f => f.mia).length);

  readonly textoInforme = computed(() => {
    const i = this.s.informe.datos();
    if (!i) return '';
    if (i.enviado) {
      if (i.participo === false) return 'Enviado · no participaste';
      return i.requiere_horas && i.horas != null ? `Enviado · ${i.horas} horas` : 'Enviado';
    }
    const d = this.s.plazoDias();
    if (d < 0) return 'Plazo vencido · avísale a tu superintendente';
    if (d === 0) return 'Vence hoy · envíalo desde la app';
    if (d === 1) return 'Vence mañana · envíalo desde la app';
    return `Faltan ${d} días · envíalo desde la app`;
  });

  dia(iso: string) { return diaLegible(iso); }
  hora(h: string | null) { return horaLegible(h); }
  diaNum(iso: string) { return fechaLocal(iso).getDate(); }
  mes(iso: string) { return mesCorto(iso); }
}

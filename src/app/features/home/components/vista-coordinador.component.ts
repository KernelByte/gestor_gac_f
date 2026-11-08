import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, throwError } from 'rxjs';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { ReunionesService } from '../../reuniones/services/reuniones.service';
import { DiscursosService } from '../../reuniones/services/discursos.service';
import { LogisticaService } from '../../reuniones/services/logistica.service';
import { ProgramaSemana } from '../../reuniones/models/reuniones.models';
import { DiscursosMesOut } from '../../reuniones/models/discursos.models';
import { LogisticaMesOut } from '../../reuniones/models/logistica.models';
import { MedirDirective } from '../medir.directive';
import { recurso } from '../recurso';
import { MESES, diaLegible, fechaLocal, escalaUI, filasQueCaben, horaLegible, isoLocal, mesCorto } from '../services/dashboard.service';
import { PanelComponent } from './panel.component';
import { PendientesPanelComponent } from './pendientes-panel.component';

const FILA_PX = 52;

type EstadoCelda = 'ok' | 'borrador' | 'faltan' | 'vacio' | 'nada';
interface Celda { estado: EstadoCelda; texto: string; detalle: string }
interface Fila { id: string; nombre: string; tab: string; celdas: Celda[] }

interface DatosMes {
  entre: ProgramaSemana[] | null;
  fin: ProgramaSemana[] | null;
  discursos: DiscursosMesOut | null;
  logistica: LogisticaMesOut | null;
}

@Component({
  selector: 'app-vista-coordinador',
  standalone: true,
  imports: [RouterModule, PanelComponent, PendientesPanelComponent, MedirDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- B · El mes de un vistazo: secciones × semanas -->
    <app-panel [titulo]="'Programa de ' + nombreMes()" [subtitulo]="resumenMes()" icono="programa" color="violeta" area="b"
      enlace="/reuniones/programacion" enlaceTexto="Abrir"
      [estado]="datosMes.estado()" (reintentar)="datosMes.cargar()"
      [vacio]="semanas().length ? null : 'Aún no hay reuniones configuradas para ' + nombreMes() + '.'">
      <div class="barra-mes">
        <div class="segmented" role="radiogroup" aria-label="Mes que se muestra">
          <button type="button" role="radio" class="segmented-item" [attr.aria-checked]="desfase() === 0" (click)="cambiarMes(0)">Este mes</button>
          <button type="button" role="radio" class="segmented-item" [attr.aria-checked]="desfase() === 1" (click)="cambiarMes(1)">Próximo</button>
        </div>
      </div>

      <div class="matriz rellena" [style.--cols]="semanas().length" role="table" [attr.aria-label]="'Estado del programa de ' + nombreMes()">
        <div class="mf cabeza" role="row">
          <span role="columnheader"><span class="sr-only">Sección</span></span>
          @for (s of semanas(); track s) { <span role="columnheader" class="sem">{{ diaNum(s) }} {{ mes(s) }}</span> }
        </div>
        @for (f of filas(); track f.id; let r = $index) {
          <div class="mf" role="row">
            <span role="rowheader" class="nom">
              <!-- El enlace real vive en el nombre; su ::after lo extiende a toda la fila -->
              <a class="mf-enlace" routerLink="/reuniones/programacion" [queryParams]="{ tab: f.tab }">{{ f.nombre }}</a>
            </span>
            @for (c of f.celdas; track $index; let k = $index) {
              <span role="cell" class="celda" [attr.data-e]="c.estado" [style.--d]="r * 5 + k" [attr.title]="c.detalle">{{ c.texto }}</span>
            }
          </div>
        }
      </div>
      <ul class="ley">
        <li><i data-e="ok"></i>Listo</li><li><i data-e="borrador"></i>Sin publicar</li>
        <li><i data-e="faltan"></i>Cuántos faltan</li><li><i data-e="vacio"></i>Sin generar</li>
      </ul>
    </app-panel>

    <!-- C · Discursos del mes -->
    <app-panel titulo="Discursos públicos" [subtitulo]="nombreMes()" icono="discursos" color="naranja" area="c"
      enlace="/reuniones/programacion" [enlaceParams]="{ tab: 'discursos' }" enlaceTexto="Abrir"
      [estado]="datosMes.estado()" (reintentar)="datosMes.cargar()"
      [vacio]="discursos().length ? null : 'Sin oradores visitantes ni salientes este mes.'">
      <div class="rellena" (medir)="altoDiscursos.set($event.alto)">
        <ul class="filas">
          @for (d of discursosVisibles(); track d.clave; let i = $index) {
            <li class="fila" [style.--i]="i">
              <span class="fecha"><b>{{ diaNum(d.fecha) }}</b><span>{{ mes(d.fecha) }}</span></span>
              <span class="txt"><span class="t1">{{ d.titulo }}</span><span class="t2">{{ d.meta }}</span></span>
              <span [class]="'chip ' + d.clase">{{ d.chip }}</span>
            </li>
          }
        </ul>
        @if (discursosRestantes() > 0) {
          <a routerLink="/reuniones/programacion" [queryParams]="{ tab: 'discursos' }" class="mas">y {{ discursosRestantes() }} más</a>
        }
      </div>
    </app-panel>

    <!-- D · Pendientes de su agenda (atrasado y hoy). La asistencia está en Reuniones → Asistencia. -->
    <app-pendientes-panel area="d"/>
  `,
  styleUrls: ['./contenido.css'],
  styles: [`

    /* La matriz llena el alto del panel: cada fila crece por igual */
    .barra-mes { flex-shrink: 0; display: flex; }
    /* Filas de alto contenido (sin bloques gigantes): la matriz se centra en el espacio que sobra */
    .matriz { display: grid; grid-template-rows: auto repeat(4, minmax(1.75rem, 2.75rem)); gap: 0.4375rem; align-content: center; }
    .mf { display: grid; grid-template-columns: minmax(4.5rem, 7rem) repeat(var(--cols), minmax(0, 1fr)); gap: 0.375rem;
      min-height: 0; border-radius: 0.5rem; color: inherit; position: relative; }
    .mf-enlace { color: inherit; text-decoration: none; }
    .mf-enlace::after { content: ''; position: absolute; inset: 0; border-radius: 0.5rem; }
    .mf-enlace:focus-visible { outline: none; }
    .mf-enlace:focus-visible::after { outline: 2px solid #8b5cf6; outline-offset: 2px; }
    @media (hover: hover) and (pointer: fine) { .mf:hover .nom { color: var(--color-brand-purple); } .mf:hover .celda { filter: saturate(1.25); } }
    .nom { display: flex; align-items: center; font-size: 0.8125rem; font-weight: 600; line-height: 1.15;
      color: var(--color-gray-700, #374151); transition: color 150ms ease; }
    :host-context(.dark) .nom { color: var(--color-slate-300, #cbd5e1); }
    .sem { text-align: center; font-size: 0.75rem; font-weight: 600; color: var(--dash-texto-suave); }

    .celda { display: grid; place-items: center; min-height: 1.75rem; padding: 0.125rem 0.25rem; border-radius: 0.5rem;
      text-align: center; font-size: 0.75rem; font-weight: 600; line-height: 1.1; overflow: hidden;
      animation: celda-in 440ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--d) * 25ms + 120ms); }
    .celda[data-e="ok"] { background: #8b5cf6; color: white; }
    .celda[data-e="borrador"] { background: var(--estado-info-bg); color: var(--estado-info-fg); }
    .celda[data-e="faltan"] { background: var(--estado-alerta-bg); color: var(--estado-alerta-fg); box-shadow: inset 0 0 0 1px var(--estado-alerta-punto); }
    .celda[data-e="vacio"] { color: var(--dash-texto-suave); box-shadow: inset 0 0 0 1px var(--dash-borde); }
    .celda[data-e="nada"] { color: var(--dash-texto-suave); opacity: 0.7; }
    :host-context(.dark) .celda[data-e="ok"] { background: var(--color-brand-purple); }
                
    .ley { flex-shrink: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 0.875rem; font-size: 0.75rem; color: var(--color-gray-500, #6b7280); }
    .ley li { display: inline-flex; align-items: center; gap: 0.375rem; }
    .ley i { width: 0.75rem; height: 0.75rem; border-radius: 0.1875rem; }
    .ley i[data-e="ok"] { background: #8b5cf6; } .ley i[data-e="borrador"] { background: #ddd6fe; }
    .ley i[data-e="faltan"] { background: #fee2e2; box-shadow: inset 0 0 0 1px #fca5a5; }
    .ley i[data-e="vacio"] { box-shadow: inset 0 0 0 1px var(--color-gray-300, #d1d5db); }
    :host-context(.dark) .ley { color: var(--color-slate-400, #94a3b8); }

    @media (pointer: coarse) { .segmented-item { min-height: 2.75rem; padding-inline: 1rem; } }
    @keyframes celda-in { from { opacity: 0; transform: scale(0.9); } }
    @media (prefers-reduced-motion: reduce) { .celda { animation: none; } }
  `],
})
export class VistaCoordinadorComponent implements OnInit {
  private ctx = inject(CongregacionContextService);
  private reunionesSrv = inject(ReunionesService);
  private discursosSrv = inject(DiscursosService);
  private logisticaSrv = inject(LogisticaService);

  readonly altoDiscursos = signal(0);
  /** 0 = este mes, 1 = el próximo. Pasado el día 20 el que se prepara es el siguiente. */
  readonly desfase = signal(new Date().getDate() > 20 ? 1 : 0);
  private readonly anoMes = computed(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + this.desfase());
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });
  readonly nombreMes = computed(() => MESES[this.anoMes().mes - 1]);

  readonly datosMes = recurso<DatosMes>(() => {
    const c = this.ctx.effectiveCongregacionId();
    if (!c) return throwError(() => ({ status: 404 }));
    const { ano, mes } = this.anoMes();
    const suave = <T>(o: Observable<T>) => o.pipe(catchError(() => of(null)));
    return forkJoin({
      entre: suave(this.reunionesSrv.getProgramaMes('entre_semana', ano, mes, c)),
      fin: suave(this.reunionesSrv.getProgramaMes('fin_semana', ano, mes, c)),
      discursos: suave(this.discursosSrv.getMes(ano, mes, c)),
      logistica: suave(this.logisticaSrv.getMes(ano, mes, c)),
    }).pipe(map(d => {
      if (!d.entre && !d.fin && !d.discursos && !d.logistica) throw { status: 403 };
      return d;
    }));
  });


  /** Lunes de cada semana del mes con alguna reunión. */
  readonly semanas = computed(() => {
    const d = this.datosMes.datos();
    if (!d) return [];
    const fechas = [
      ...(d.entre ?? []).map(s => s.fecha), ...(d.fin ?? []).map(s => s.fecha),
      ...(d.discursos?.fechas ?? []), ...(d.logistica?.fechas ?? []).map(f => f.fecha),
    ].filter(Boolean);
    return [...new Set(fechas.map(lunesDe))].sort();
  });

  readonly filas = computed<Fila[]>(() => {
    const d = this.datosMes.datos();
    if (!d) return [];
    const sem = this.semanas();
    const filas: Fila[] = [];
    const porSemana = <T>(lista: T[], fecha: (x: T) => string) => (lunes: string) => lista.filter(x => lunesDe(fecha(x)) === lunes);

    const programa = (id: string, nombre: string, lista: ProgramaSemana[] | null) => {
      if (!lista) return;
      const de = porSemana(lista, s => s.fecha);
      filas.push({ id, nombre, tab: id, celdas: sem.map((l): Celda => {
        const s = de(l)[0];
        if (!s?.partes?.length) return { estado: 'vacio', texto: '·', detalle: 'Aún no se ha generado' };
        const faltan = s.partes.filter(p => p.asignable !== false && p.estado === 'sin_asignar').length;
        if (faltan) return { estado: 'faltan', texto: String(faltan), detalle: `${faltan} partes sin asignar` };
        return s.estado === 'publicado'
          ? { estado: 'ok', texto: '✓', detalle: 'Listo y publicado' }
          : { estado: 'borrador', texto: '✓', detalle: 'Asignado, falta publicar' };
      }) });
    };
    programa('entre_semana', 'Entre semana', d.entre);
    programa('fin_semana', 'Fin de semana', d.fin);

    if (d.discursos) {
      const ent = porSemana(d.discursos.entrantes ?? [], e => e.fecha);
      const sal = porSemana(d.discursos.salientes ?? [], s => s.fecha);
      filas.push({ id: 'discursos', nombre: 'Discursos', tab: 'discursos', celdas: sem.map((l): Celda => {
        const e = ent(l), s = sal(l);
        if (!e.length && !s.length) return { estado: 'nada', texto: '·', detalle: 'Sin visitantes ni salientes' };
        const sinConfirmar = e.filter(x => !x.orador_confirmado).length;
        if (sinConfirmar) return { estado: 'faltan', texto: String(sinConfirmar), detalle: `${sinConfirmar} orador visitante sin confirmar` };
        return d.discursos!.confirmado
          ? { estado: 'ok', texto: '✓', detalle: 'Mes confirmado' }
          : { estado: 'borrador', texto: '✓', detalle: 'Falta confirmar el mes' };
      }) });
    }

    if (d.logistica) {
      const lg = d.logistica;
      const asig = porSemana(lg.asignaciones ?? [], a => a.fecha);
      filas.push({ id: 'logistica', nombre: 'Acomodadores', tab: 'logistica', celdas: sem.map((l): Celda => {
        const a = asig(l);
        if (lg.estado === 'sin_generar' || !a.length) return { estado: 'vacio', texto: '·', detalle: 'Logística sin generar' };
        const faltan = a.filter(x => !x.publicador).length;
        if (faltan) return { estado: 'faltan', texto: String(faltan), detalle: `${faltan} puestos vacíos` };
        return lg.estado === 'publicado'
          ? { estado: 'ok', texto: '✓', detalle: 'Listo y publicado' }
          : { estado: 'borrador', texto: '✓', detalle: 'Falta publicar' };
      }) });
    }
    return filas;
  });

  readonly resumenMes = computed(() => {
    const celdas = this.filas().flatMap(f => f.celdas);
    if (!celdas.length) return null;
    const faltan = celdas.filter(c => c.estado === 'faltan').length;
    const sinGenerar = celdas.filter(c => c.estado === 'vacio').length;
    const sinPublicar = celdas.filter(c => c.estado === 'borrador').length;
    if (faltan) return `${faltan} ${faltan === 1 ? 'semana necesita' : 'semanas necesitan'} atención`;
    if (sinGenerar) return `${sinGenerar} por generar`;
    if (sinPublicar) return `${sinPublicar} por publicar`;
    return 'Todo listo y publicado';
  });

  readonly discursos = computed(() => {
    const d = this.datosMes.datos()?.discursos;
    if (!d) return [];
    const hoy = isoLocal(new Date());
    const ent = (d.entrantes ?? []).map(e => ({
      clave: 'e' + e.id_discurso_entrante, fecha: e.fecha,
      titulo: e.nombre_orador || 'Orador por confirmar',
      meta: `Viene de ${e.congregacion_origen || 'otra congregación'}`,
      chip: e.orador_confirmado ? 'Confirmado' : 'Sin confirmar',
      clase: e.orador_confirmado ? 'chip-ok' : 'chip-aviso',
    }));
    const sal = (d.salientes ?? []).filter(s => !s.cancelado).map(s => ({
      clave: 's' + s.id_discurso_saliente, fecha: s.fecha,
      titulo: s.publicador?.nombre_completo || 'Orador local',
      meta: `Va a ${s.congregacion_destino || 'otra congregación'}`,
      chip: 'Sale', clase: 'chip-neutro',
    }));
    return [...ent, ...sal].filter(x => this.desfase() > 0 || x.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  });
  private readonly cabenDiscursos = computed(() => {
    const alto = this.altoDiscursos();
    const n = this.discursos().length;
    return n <= filasQueCaben(alto, FILA_PX, 0) ? n : filasQueCaben(alto - 26 * escalaUI(), FILA_PX, 0);
  });
  readonly discursosVisibles = computed(() => this.discursos().slice(0, this.cabenDiscursos()));
  readonly discursosRestantes = computed(() => this.discursos().length - this.discursosVisibles().length);

  ngOnInit() {
    this.datosMes.cargar();
  }

  cambiarMes(d: number) {
    if (this.desfase() === d) return;
    this.desfase.set(d);
    this.datosMes.cargar();
  }

  dia(iso: string) { return diaLegible(iso); }
  hora(h: string | null) { return horaLegible(h); }
  diaNum(iso: string) { return fechaLocal(iso).getDate(); }
  mes(iso: string) { return mesCorto(iso); }
}

function lunesDe(iso: string): string {
  const d = fechaLocal(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoLocal(d);
}

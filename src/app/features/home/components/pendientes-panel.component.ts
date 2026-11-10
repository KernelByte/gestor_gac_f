import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterModule, UrlTree } from '@angular/router';
import { Observable, map, throwError } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { modoAgenda } from '../../../core/auth/acceso-modulos';
import { AgendaService } from '../../secretario-tools/services/agenda.service';
import { ActaService } from '../../secretario-tools/services/acta.service';
import { TipoEvento } from '../../secretario-tools/models/agenda.model';
import { MedirDirective } from '../medir.directive';
import { recurso } from '../recurso';
import { diaLegible, fechaLocal, escalaUI, filasQueCaben, isoLocal, mesCorto } from '../services/dashboard.service';
import { PanelComponent } from './panel.component';

const FILA_PX = 52;
const MAX_FILAS = 4;
const ETIQUETA_TIPO: Record<TipoEvento, string> = {
  tarea: 'Tarea', recordatorio: 'Recordatorio', visita: 'Visita del superintendente',
  transferencia: 'Traslado', informes: 'Informes', bautismo: 'Bautismo', consentimiento: 'Consentimiento (S-290a)', reunion_ancianos: 'Reunión de ancianos',
  exhibidor: 'Exhibidor',
};

interface Pendiente {
  id: string;
  titulo: string;
  tipo: TipoEvento;
  fecha: string;
  vencido: boolean;
  /** UrlTree y no texto: las rutas traen ?desde=… y un routerLink de texto codificaría el «?». */
  ruta: UrlTree;
}

/**
 * «Pendientes» del Inicio: lo atrasado y lo de hoy de la Agenda de esta persona
 * (tareas, recordatorios, reuniones…). Es el único sitio del Inicio donde salen
 * las tareas; el detalle completo está en Administración → Agenda.
 */
@Component({
  selector: 'app-pendientes-panel',
  standalone: true,
  imports: [RouterModule, PanelComponent, MedirDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Su propia instancia: la agenda en el modo de esta persona (la raíz se queda en el del secretario).
  providers: [AgendaService],
  template: `
    <app-panel titulo="Pendientes" [subtitulo]="subtitulo()" icono="agenda" color="rosa" [area]="area()"
      enlace="/agenda" enlaceTexto="Abrir Mi Agenda"
      [estado]="fuente.estado()" (reintentar)="fuente.cargar()"
      [vacio]="urgentes().length ? null : textoVacio()">
      <div class="rellena" (medir)="alto.set($event.alto)">
        <ul class="filas">
          @for (p of visibles(); track p.id; let i = $index) {
            <li>
              <a class="fila" [routerLink]="p.ruta" [style.--i]="i">
                <span class="fecha"><b>{{ diaNum(p.fecha) }}</b><span>{{ mes(p.fecha) }}</span></span>
                <span class="txt">
                  <span class="t1">{{ p.titulo }}</span>
                  <span class="t2">{{ etiqueta(p.tipo) }}</span>
                </span>
                @if (p.vencido) { <span class="chip chip-alerta">Atrasado</span> }
                @else { <span class="chip chip-info">Hoy</span> }
              </a>
            </li>
          }
        </ul>
        @if (restantes() > 0) { <a routerLink="/agenda" class="mas">y {{ restantes() }} más en Mi Agenda</a> }
      </div>
    </app-panel>
  `,
  styleUrls: ['./contenido.css'],
})
export class PendientesPanelComponent implements OnInit {
  readonly area = input<string | null>(null);

  private auth = inject(AuthStore);
  private router = inject(Router);
  private agenda = inject(AgendaService);
  private actas = inject(ActaService);
  private readonly modo = modoAgenda(this.auth);

  readonly alto = signal(0);

  readonly fuente = recurso<Pendiente[]>(() => this.cargarPendientes());

  /** Abiertos con fecha hasta hoy, primero lo atrasado. */
  readonly urgentes = computed(() => {
    const hoy = isoLocal(new Date());
    return (this.fuente.datos() ?? [])
      .filter(p => p.vencido || p.fecha <= hoy)
      .sort((a, b) => Number(b.vencido) - Number(a.vencido) || a.fecha.localeCompare(b.fecha));
  });
  /** Lo siguiente que viene, para que «nada para hoy» no se quede en blanco. */
  private readonly proximo = computed(() => {
    const hoy = isoLocal(new Date());
    return (this.fuente.datos() ?? []).filter(p => !p.vencido && p.fecha > hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))[0] ?? null;
  });

  private readonly caben = computed(() => {
    const n = this.urgentes().length;
    const sinMas = Math.min(MAX_FILAS, filasQueCaben(this.alto(), FILA_PX, 0));
    return n <= sinMas ? n : Math.min(MAX_FILAS, filasQueCaben(this.alto() - 26 * escalaUI(), FILA_PX));
  });
  readonly visibles = computed(() => this.urgentes().slice(0, this.caben()));
  readonly restantes = computed(() => this.urgentes().length - this.visibles().length);

  readonly subtitulo = computed(() => {
    const l = this.urgentes();
    if (!l.length) return null;
    const atrasados = l.filter(p => p.vencido).length;
    const hoy = l.length - atrasados;
    const partes: string[] = [];
    if (atrasados) partes.push(`${atrasados} ${atrasados === 1 ? 'atrasado' : 'atrasados'}`);
    if (hoy) partes.push(`${hoy} para hoy`);
    return partes.join(' · ');
  });

  readonly textoVacio = computed(() => {
    const p = this.proximo();
    return p
      ? `Nada atrasado ni para hoy. Lo próximo: ${p.titulo} (${diaLegible(p.fecha).toLowerCase()}).`
      : 'Nada atrasado ni para hoy.';
  });

  ngOnInit() { this.fuente.cargar(); }

  private cargarPendientes(): Observable<Pendiente[]> {
    if (this.modo === 'secretaria' || this.modo === 'personal' || this.modo === 'exhibidor') {
      this.agenda.usarModo(this.modo);
      const hoy = isoLocal(new Date());
      return this.agenda.proximos().pipe(map(lista => lista
        .filter(e => e.estado !== 'hecho' && !!e.fecha)
        .map(e => ({
          // Lo que ya empezó y sigue (la visita del SC) cuenta como de hoy, no del día en que empezó.
          id: e.id, titulo: e.titulo, tipo: e.tipo, vencido: e.estado === 'vencido',
          fecha: e.estado !== 'vencido' && e.fecha! < hoy ? hoy : e.fecha!,
          ruta: this.router.parseUrl(e.ruta || `/agenda?fecha=${e.fecha}`),
        }))));
    }
    if (this.modo === 'tareas') {
      const hoy = isoLocal(new Date());
      return this.actas.listarTareasGlobal().pipe(map(lista => lista
        .filter(t => (t.estado === 'pendiente' || t.estado === 'en_progreso') && !!t.fecha_limite)
        .map(t => ({
          id: `tarea-${t.id_tarea}`, titulo: t.titulo, tipo: 'tarea' as TipoEvento, fecha: t.fecha_limite!,
          vencido: t.fecha_limite! < hoy, ruta: this.router.parseUrl(`/herramientas/tareas/${t.id_tarea}?desde=agenda`),
        }))));
    }
    // Sin Agenda ni Tareas: el panel no se pinta.
    return throwError(() => ({ status: 403 }));
  }

  etiqueta(t: TipoEvento) { return ETIQUETA_TIPO[t] ?? 'Pendiente'; }
  diaNum(iso: string) { return fechaLocal(iso).getDate(); }
  mes(iso: string) { return mesCorto(iso); }
}

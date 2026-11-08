import { Injectable, computed, inject } from '@angular/core';
import { map, of, switchMap } from 'rxjs';
import { CongregacionContextService } from '../../core/congregacion-context/congregacion-context.service';
import { ReunionesService } from '../reuniones/services/reuniones.service';
import { recurso } from './recurso';
import { DashboardService, MESES, diaLegible, horaLegible, isoLocal } from './services/dashboard.service';

export interface MiAsignacion { fecha: string; texto: string; detalle: string }

export type TipoMarca = 'reunion' | 'asignacion' | 'salida' | 'informe';
export interface MarcaSemana { fecha: string; tipo: TipoMarca; texto: string }

export const NOMBRE_REUNION: Record<string, string> = {
  entre_semana: 'Reunión de entre semana',
  fin_semana: 'Reunión del fin de semana',
};

/**
 * Lo personal de quien entra (reuniones, asignaciones, informe, salidas). Las tareas no:
 * en el Inicio solo salen en el panel «Pendientes», junto con el resto de la agenda.
 * Se provee en HomePage: lo leen el encabezado y los paneles con una sola carga.
 */
@Injectable()
export class MiSemanaStore {
  private dash = inject(DashboardService);
  private reunionesSrv = inject(ReunionesService);
  private ctx = inject(CongregacionContextService);

  readonly resumen = recurso(() => this.dash.resumenMovil());
  /** Si no figura en el mes (p. ej. llegó después), ese informe no le corresponde. */
  readonly informe = recurso(() => this.dash.periodoActivo().pipe(
    switchMap(p => this.dash.miInforme(p.id_periodo)),
    map(i => { if (!i.en_lista) throw { status: 404 }; return i; }),
  ));
  readonly salidas = recurso(() => {
    const hoy = new Date();
    const fin = new Date(hoy);
    fin.setDate(hoy.getDate() + 13);
    return this.dash.programaPredicacion(isoLocal(hoy), isoLocal(fin));
  });
  private readonly reunionMia = recurso(() => {
    const id = this.ctx.effectiveCongregacionId();
    return id ? this.reunionesSrv.getMiProximaReunion(id) : of(null);
  });

  private iniciado = false;
  private salidasPedidas = false;

  iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;
    this.resumen.cargar();
    this.informe.cargar();
    this.reunionMia.cargar();
    if (!this.salidasPedidas) this.salidas.cargar();
    this.salidasPedidas = true;
  }

  /** Las vistas que muestran salidas las piden aunque no haya datos personales (Administrador). */
  asegurarSalidas() {
    if (this.salidasPedidas) return;
    this.salidasPedidas = true;
    this.salidas.cargar();
  }

  readonly reuniones = computed(() =>
    (this.resumen.datos()?.reuniones ?? [])
      .filter(r => !!r.fecha)
      .sort((a, b) => a.fecha!.localeCompare(b.fecha!))
  );
  readonly proxima = computed(() => this.reuniones()[0] ?? null);
  readonly siguiente = computed(() => this.reuniones()[1] ?? null);
  readonly lugar = computed(() => this.reunionMia.datos()?.lugar ?? null);

  /** Mis salidas: las de mi grupo o donde soy capitán; si no tengo grupo, todas. */
  readonly misSalidas = computed(() => {
    const todas = (this.salidas.datos()?.salidas ?? []).filter(s => !s.sin_salida);
    const mias = todas.filter(s => s.es_de_mi_grupo || s.soy_capitan);
    return (mias.length ? mias : todas)
      .sort((a, b) => (a.fecha + (a.hora_inicio ?? '')).localeCompare(b.fecha + (b.hora_inicio ?? '')));
  });

  readonly misAsignaciones = computed<MiAsignacion[]>(() => {
    const out: MiAsignacion[] = [];
    for (const r of this.reuniones()) {
      const base = { fecha: r.fecha!, detalle: NOMBRE_REUNION[r.tipo] ?? 'Reunión' };
      for (const sec of r.secciones ?? []) {
        for (const p of sec.partes ?? []) {
          if (p.es_mia || p.es_mia_sala_b) out.push({ ...base, texto: p.nombre + (p.es_mia_sala_b ? ' (Sala B)' : '') });
          if (p.es_mia_ayudante || p.es_mia_ayudante_b) out.push({ ...base, texto: `${p.nombre} · ayudante` });
        }
      }
      if (!(r.secciones ?? []).length) for (const nombre of r.mis_partes ?? []) out.push({ ...base, texto: nombre });
      for (const fila of [...(r.logistica?.apoyo_auditorio ?? []), ...(r.logistica?.tecnica ?? [])]) {
        if (fila.es_mia) out.push({ ...base, texto: fila.rol });
      }
      if (r.logistica?.aseo_es_mio) out.push({ ...base, texto: 'Aseo del Salón del Reino' });
      if (r.mi_discurso_saliente) {
        const d = r.mi_discurso_saliente;
        out.push({ ...base, texto: `Discurso en ${d.congregacion_destino ?? 'otra congregación'}`, detalle: d.tema ?? 'Discurso público' });
      }
    }
    for (const s of this.misSalidas().filter(x => x.soy_capitan)) {
      out.push({ fecha: s.fecha, texto: 'Capitán de la salida a predicar',
        detalle: [horaLegible(s.hora_inicio), s.punto?.nombre || s.lugar].filter(Boolean).join(' · ') || 'Predicación' });
    }
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
  });

  readonly informePeriodo = computed(() => {
    const i = this.informe.datos();
    if (!i?.periodo_mes) return i?.periodo_descripcion ?? null;
    const m = MESES[Number(i.periodo_mes) - 1];
    return `${m.charAt(0).toUpperCase()}${m.slice(1)}`;
  });

  /** Día 7 del mes siguiente al periodo (DIA_LIMITE_INFORME en móvil y en la agenda). */
  readonly plazo = computed(() => {
    const i = this.informe.datos();
    if (!i?.periodo_ano || !i.periodo_mes) return null;
    return new Date(Number(i.periodo_ano), Number(i.periodo_mes), 7);
  });
  readonly plazoDias = computed(() => {
    const p = this.plazo();
    if (!p) return 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((p.getTime() - hoy.getTime()) / 86_400_000);
  });

  /** Marcas para la línea de tiempo de 7 días. */
  readonly marcas = computed<MarcaSemana[]>(() => {
    const out: MarcaSemana[] = [];
    const conAsignacion = new Set(this.misAsignaciones().map(a => a.fecha));
    for (const r of this.reuniones()) {
      const mia = conAsignacion.has(r.fecha!);
      out.push({ fecha: r.fecha!, tipo: mia ? 'asignacion' : 'reunion',
        texto: `${NOMBRE_REUNION[r.tipo]}${horaLegible(r.hora) ? ' · ' + horaLegible(r.hora) : ''}${mia ? ' · tienes asignación' : ''}` });
    }
    for (const s of this.misSalidas()) {
      if (!out.some(m => m.fecha === s.fecha && m.tipo === 'salida')) {
        out.push({ fecha: s.fecha, tipo: 'salida', texto: `Salida a predicar${s.hora_inicio ? ' · ' + horaLegible(s.hora_inicio) : ''}` });
      }
    }
    const i = this.informe.datos();
    const p = this.plazo();
    if (i && !i.enviado && p) out.push({ fecha: isoLocal(p), tipo: 'informe', texto: 'Último día para enviar tu informe' });
    return out;
  });

  dia(iso: string) { return diaLegible(iso); }
}

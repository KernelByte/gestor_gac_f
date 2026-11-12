import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  Component, Input, OnChanges, SimpleChanges, signal, computed,
  inject, ChangeDetectionStrategy, OnInit, OnDestroy, ElementRef,
  Injector, afterNextRender, viewChild, HostListener
} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  EntregaPortalService,
  RegistrosOut, TotalesOut, ContactoPublicador, AsistenciaS88Out,
  DocumentoItem, PublicadorRegistro, GrupoRegistro, AgendaOut, AgendaItemPortal,
  TarjetaTotal, FilaMensualTotal, MesEnCurso, EnlaceAcompanante
} from '../services/entrega-portal.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ThemeService } from '../../../../core/services/theme.service';
import { SECCIONES_CONFIG, SeccionConfig, SeccionGrupo } from './agenda-secciones.config';
import { anoServicioDe } from '../../../../core/utils/fecha.util';
import { Observable, Subject, takeUntil } from 'rxjs';

type Seccion = 'registros' | 'totales' | 'contactos' | 'asistencia' | 'documentos' | 'agenda';

/** Tarjeta cargada en memoria para el visor: se descarga desde el mismo blob. */
interface TarjetaPreview {
  nombre: string;
  blob: Blob;
  /** URL cruda del blob, para el enlace de respaldo y para revocarla. */
  href: string;
  /** La misma URL saneada, que es lo que admite el [src] del iframe. */
  url: SafeResourceUrl;
}

/** Icono de cada sección del formulario en las tarjetas de "Detalles de la
 *  visita". Trazo de 1.75 para que se lean a 14px sin engordar la cabecera. */
const ICONO_SECCION_DEFECTO =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>';

const ICONOS_SECCION: Record<string, string> = {
  hospedaje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>',
  servicio_campo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>',
  estudios_superintendente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>',
  estudios_esposa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>',
  almuerzos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M8 3v8a2 2 0 002 2h0a2 2 0 002-2V3M10 13v8M17 3c-1.105 0-2 1.79-2 4s.895 4 2 4 2-1.79 2-4-.895-4-2-4zm0 8v10"/></svg>',
  asuntos_ancianos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>',
  pastoreo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>',
  recomendaciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  remociones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM17 11h4"/></svg>',
};

@Component({
  standalone: true,
  selector: 'app-entrega-portal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe, NgTemplateOutlet, NgxEchartsDirective, EmptyStateComponent, ModalComponent],
  templateUrl: './entrega-portal.component.html',
  styleUrl: './entrega-portal.component.scss',
})
export class EntregaPortalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() modo: 'publico' | 'interno' = 'publico';
  @Input() token: string = '';
  @Input() idVisita: number = 0;
  /** Metadatos ya pedidos por quien monta el portal (la página pública los
   *  usa para validar el enlace): con ellos no se repite la petición. */
  @Input() metadataInicial: any | null = null;

  private svc = inject(EntregaPortalService);
  private injector = inject(Injector);
  private sanitizer = inject(DomSanitizer);
  theme = inject(ThemeService);

  // ── Nav de secciones: desbordamiento horizontal ─────────────────────────────
  navSecciones = viewChild<ElementRef<HTMLElement>>('navSecciones');
  navPuedeIzq = signal(false);
  navPuedeDer = signal(false);
  private navRO?: ResizeObserver;

  // ── Estado ──────────────────────────────────────────────────────────────────
  seccionActiva = signal<Seccion>('registros');
  subTabRegistros = signal<'activos' | 'prec_reg' | 'inactivos'>('activos');
  vistaResumen = signal<'tablas' | 'graficas'>('tablas');
  anioSel = signal<number>(new Date().getFullYear());
  cargando = signal(false);
  error = signal<string | null>(null);
  errorContactos = signal<string | null>(null);
  errorDocumentos = signal<string | null>(null);
  zipDownloadError = signal(false);
  filtroContactos = signal('');
  filtroPublicadores = signal('');
  descargandoZip = signal(false);
  descargandoS88 = signal(false);
  descargandoContactosPdf = signal(false);
  descargandoTarjeta = signal<number | null>(null);
  /** Nombre del documento que se está bajando en modo interno, o null. */
  docDescargando = signal<string | null>(null);
  /** Tarjeta abierta en el visor; null cuando está cerrado. */
  tarjetaPreview = signal<TarjetaPreview | null>(null);
  descargandoGrupo = signal<number | string | null>(null);
  sortCol = signal<'horas' | 'cursos' | 'nombre' | null>(null);
  sortDir = signal<'asc' | 'desc'>('desc');

  registros = signal<RegistrosOut | null>(null);
  totales = signal<TotalesOut | null>(null);
  contactos = signal<ContactoPublicador[] | null>(null);
  asistencia = signal<any | null>(null);
  documentos = signal<DocumentoItem[] | null>(null);
  agenda = signal<AgendaOut | null>(null);
  metadata = signal<any | null>(null);

  private static readonly DIAS_SEMANA_LARGOS =
    ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  /**
   * "2026-08-04" → { semana: 'Martes', fecha: '4 de agosto del 2026' }.
   *
   * El día es texto libre: el editor guarda ISO, pero hay agendas viejas con la
   * fecha escrita a mano. Si no se encuentra una fecha se devuelve el texto tal
   * cual en vez de inventarse una.
   */
  private formatearDia(dia: string): { semana: string; fecha: string; fechaCorta: string } {
    const texto = (dia ?? '').toString().trim();
    const m = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return { semana: '', fecha: texto, fechaCorta: texto };

    // Constructor numérico, no `new Date('2026-08-04')`: esa forma se interpreta
    // en UTC y en Colombia (UTC-5) retrocede un día al pasar a local.
    const fecha = new Date(+m[1], +m[2] - 1, +m[3]);
    if (Number.isNaN(fecha.getTime())) return { semana: '', fecha: texto, fechaCorta: texto };

    const semana = EntregaPortalComponent.DIAS_SEMANA_LARGOS[fecha.getDay()];
    const dd = fecha.getDate();
    const anio = fecha.getFullYear();
    return {
      semana: semana.charAt(0).toUpperCase() + semana.slice(1),
      fecha: `${dd} de ${EntregaPortalComponent.MESES_LARGOS[fecha.getMonth()]} del ${anio}`,
      // En móvil la forma larga se parte en cuatro líneas y estira la fila.
      fechaCorta: `${dd} ${EntregaPortalComponent.MESES_CORTOS[fecha.getMonth()]} ${anio}`,
    };
  }

  /**
   * Lee una hora en cualquiera de las formas que guarda el editor ("19:00",
   * "7:00 pm", "19:00:00") y la deja en horas y minutos, o null si no la
   * reconoce. Separado del formateo porque el rango necesita comparar los dos
   * extremos antes de decidir cómo se escriben.
   */
  private parsearHora(hora?: string | null): { h: number; m: number } | null {
    const texto = (hora ?? '').toString().trim();
    if (!texto) return null;
    const m = texto.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:([ap])\.?\s*m\.?)?$/i);
    if (!m) return null;

    let h = +m[1];
    const min = +m[2];
    const meridiano = m[3]?.toLowerCase();
    if (meridiano === 'p' && h < 12) h += 12;
    if (meridiano === 'a' && h === 12) h = 0;
    return h > 23 || min > 59 ? null : { h, m: min };
  }

  /** { h: 19, m: 0 } → "7:00 p.m.". Con `conMeridiano` en false, "7:00". */
  private formatearHora12(t: { h: number; m: number }, conMeridiano = true): string {
    const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
    const reloj = `${h12}:${String(t.m).padStart(2, '0')}`;
    return conMeridiano ? `${reloj} ${t.h < 12 ? 'a.m.' : 'p.m.'}` : reloj;
  }

  /** Hora suelta a 12 h; lo que no reconozca lo deja intacto. */
  private horaLegible(hora?: string | null): string {
    const t = this.parsearHora(hora);
    return t ? this.formatearHora12(t) : (hora ?? '').toString().trim();
  }

  /**
   * Une inicio y fin en un solo horario. Cuando ambos caen en la misma mitad
   * del día el a.m./p.m. se dice una sola vez ("7:00 – 8:30 p.m."): repetirlo
   * alarga el chip sin aportar nada.
   */
  private formatearHorario(inicio?: string | null, fin?: string | null): string {
    const crudoIni = (inicio ?? '').toString().trim();
    const crudoFin = (fin ?? '').toString().trim();
    const ini = this.parsearHora(crudoIni);
    const finT = this.parsearHora(crudoFin);

    const mismaMitad = !!ini && !!finT && (ini.h < 12) === (finT.h < 12);
    const textoIni = ini ? this.formatearHora12(ini, !mismaMitad) : crudoIni;
    const textoFin = finT ? this.formatearHora12(finT) : crudoFin;
    return [textoIni, textoFin].filter(Boolean).join(' – ');
  }

  /**
   * Filas de la tabla de agenda ya formateadas. Inicio y fin se juntan en un
   * solo horario: la columna "Fin" estaba vacía en casi todas las agendas y
   * gastaba un quinto de la tabla en pintar guiones.
   */
  agendaItems = computed(() =>
    (this.agenda()?.items ?? []).map(item => {
      const { semana, fecha, fechaCorta } = this.formatearDia(item.dia);
      return {
        semana,
        fecha,
        fechaCorta,
        horario: this.formatearHorario(item.hora_inicio, item.hora_fin),
        actividad: (item.actividad ?? '').trim(),
        lugar: (item.lugar ?? '').trim(),
        notas: (item.notas ?? '').trim(),
        responsable: (item.responsable ?? '').trim(),
        // Fila que solo marca el cambio de día, sin actividad ni hora.
        esSeparadorDia: !item.hora_inicio && !(item.actividad ?? '').trim(),
      };
    })
  );

  /**
   * "Detalles de la visita" listos para pintar: mismas secciones y etiquetas
   * que el editor del secretario, sin campos vacíos.
   *
   * El día y la hora se sacan de la lista de campos y se suben a la cabecera de
   * cada entrada: son lo que convierte una ficha de datos en una agenda, y así
   * el superintendente ubica "cuándo" de un vistazo sin leer etiquetas.
   *
   * El resto de campos se reparte según su `rol` (ver agenda-secciones.config):
   * un título, un subtítulo por contacto, los teléfonos y direcciones como meta
   * con icono, y las notas largas al final. Antes todo era una lista plana de
   * etiqueta + valor y el bloque se leía como un muro de texto.
   */
  detalleSecciones = computed(() => {
    const secciones = this.agenda()?.secciones || {};
    return SECCIONES_CONFIG
      .map(sec => ({
        id: sec.id,
        label: sec.label,
        grupo: sec.grupo,
        icono: this.svgSeguro(ICONOS_SECCION[sec.id] ?? ICONO_SECCION_DEFECTO),
        filas: (secciones[sec.id] || [])
          .map(fila => this.filaDeDetalle(sec, fila))
          .filter(f => f.dia || f.hora || f.titulo || f.subtitulos.length ||
                       f.metas.length || f.notas.length || f.otros.length),
      }))
      .filter(sec => sec.filas.length > 0);
  });

  /**
   * Las nueve secciones agrupadas en las tres familias temáticas, para que el
   * portal las pinte en bloques con encabezado en vez de sueltas en una sola
   * rejilla donde hospedaje, estudios y remociones quedaban intercaladas.
   */
  private static readonly FAMILIAS_DETALLE: { id: SeccionGrupo; label: string; desc: string }[] = [
    { id: 'hospitalidad', label: 'Hospitalidad', desc: 'Dónde se hospeda y con quién come' },
    { id: 'ministerio', label: 'Ministerio', desc: 'Predicación, estudios bíblicos y pastoreo' },
    { id: 'ancianos', label: 'Cuerpo de ancianos', desc: 'Temas para la reunión con el superintendente' },
  ];

  detalleFamilias = computed(() => {
    const secciones = this.detalleSecciones();
    return EntregaPortalComponent.FAMILIAS_DETALLE
      .map(fam => ({ ...fam, secciones: secciones.filter(s => s.grupo === fam.id) }))
      .filter(fam => fam.secciones.length > 0);
  });

  /**
   * Marcadores de "sin dato" que el formulario deja escritos a mano. Pintar
   * "Publicación: N/A" ocupa una línea y no dice nada, así que se descartan.
   */
  private static readonly VALORES_VACIOS = new Set(
    ['n/a', 'n.a.', 'na', '-', '--', 'ninguno', 'ninguna', 'no aplica'],
  );

  private esValorVacio(valor: string): boolean {
    return !valor || EntregaPortalComponent.VALORES_VACIOS.has(valor.toLowerCase());
  }

  /** Reparte los campos de una fila según el `rol` que la config les da. */
  private filaDeDetalle(sec: SeccionConfig, fila: Record<string, string>) {
    const leer = (key: string) => (fila[key] ?? '').toString().trim();
    const detalle = {
      dia: leer('dia'),
      // Mismo formato de 12 horas que la tabla de la agenda.
      hora: this.horaLegible(leer('hora')),
      titulo: '',
      insignia: '',
      subtitulos: [] as { label: string; valor: string }[],
      metas: [] as { tipo: 'tel' | 'dir'; label: string; valor: string; tel: string | null; conEtiqueta: boolean }[],
      notas: [] as { label: string; valor: string }[],
      otros: [] as { label: string; valor: string }[],
      // Mismo criterio que el editor: solo los campos marcados con verTarjeta
      // ofrecen consultar la tarjeta del publicador.
      tarjeta: this.tarjetaDeFila(sec, fila),
    };

    for (const f of sec.fields) {
      if (f.key === 'dia' || f.key === 'hora') continue;
      const valor = leer(f.key);
      if (this.esValorVacio(valor)) continue;

      switch (f.rol) {
        case 'titulo':
          if (!detalle.titulo) detalle.titulo = valor;
          break;
        case 'insignia':
          if (!detalle.insignia) detalle.insignia = valor;
          break;
        case 'subtitulo':
          detalle.subtitulos.push({ label: f.label, valor });
          break;
        case 'tel':
          detalle.metas.push({
            tipo: 'tel', label: f.label, valor,
            tel: valor.replace(/[^+\d]/g, '') || null,
            // "Teléfono del otro contacto" necesita decir cuál es; el teléfono
            // a secas se entiende con el icono.
            conEtiqueta: f.label !== 'Teléfono',
          });
          break;
        case 'dir':
          detalle.metas.push({
            tipo: 'dir', label: f.label, valor, tel: null,
            conEtiqueta: f.label !== 'Dirección',
          });
          break;
        case 'nota':
          detalle.notas.push({ label: f.label, valor });
          break;
        default:
          detalle.otros.push({ label: f.label, valor });
      }
    }

    // Sección sin campo marcado como título: el primer dato hace de encabezado
    // para que la entrada nunca empiece por una etiqueta suelta.
    if (!detalle.titulo && detalle.otros.length) {
      detalle.titulo = detalle.otros.shift()!.valor;
    }
    return detalle;
  }

  /** Publicador cuya tarjeta se puede consultar desde una fila, o null. */
  private tarjetaDeFila(sec: SeccionConfig, fila: Record<string, string>) {
    const campo = sec.fields.find(f => f.verTarjeta);
    if (!campo) return null;
    const id = Number(fila[`${campo.key}_id_publicador`]);
    const nombre = (fila[campo.key] ?? '').toString().trim();
    // Sin id es un nombre escrito a mano: no hay tarjeta que abrir.
    return Number.isFinite(id) && id > 0 ? { id, nombre } : null;
  }

  /** Grupo que se está viendo en «Activos». undefined = aún no se eligió: se
   *  toma el primero, así la pantalla nunca aterriza vacía. */
  grupoSel = signal<number | null | undefined>(undefined);
  /** Fila marcada con un toque: un resalte fijo para no perderla al mirar los
   *  meses de una tabla ancha. */
  filaSel = signal<number | null>(null);
  private pubsExpandidos = signal<Set<number>>(new Set());

  // ── Computed ─────────────────────────────────────────────────────────────────
  private static readonly PRIVS_PREC_REG = ['precursor regular', 'precursor especial', 'misionero'];

  private esPrivPrecReg(priv: string | null): boolean {
    if (!priv) return false;
    const p = priv.toLowerCase();
    return EntregaPortalComponent.PRIVS_PREC_REG.some(x => p.includes(x));
  }

  private filtrarGrupos(grupos: any[], excluirPrecReg: boolean): any[] {
    return grupos
      .map(g => ({ ...g, publicadores: g.publicadores.filter((p: any) => excluirPrecReg ? !this.esPrivPrecReg(p.privilegio_principal) : this.esPrivPrecReg(p.privilegio_principal)) }))
      .filter(g => g.publicadores.length > 0);
  }

  private mergePorGrupo(...listas: any[][]): any[] {
    const merged = new Map<any, any>();
    listas.flat().forEach(g => {
      if (merged.has(g.grupo_id)) {
        merged.get(g.grupo_id).publicadores.push(...g.publicadores);
      } else {
        merged.set(g.grupo_id, { ...g, publicadores: [...g.publicadores] });
      }
    });
    return [...merged.values()].sort(
      (a, b) => (a.grupo_numero ?? 9999) - (b.grupo_numero ?? 9999)
    );
  }

  gruposActivosFiltrados = computed(() => {
    const r = this.registros();
    if (!r) return [];
    const sinPrecReg = this.filtrarGrupos(r.activos.publicadores_por_grupo, true);
    return this.mergePorGrupo(sinPrecReg, r.activos.precursores_auxiliares);
  });

  gruposPrecRegFiltrados = computed(() => {
    const r = this.registros();
    if (!r) return [];
    const desplazados = this.filtrarGrupos(r.activos.publicadores_por_grupo, false);
    return this.mergePorGrupo(r.activos.precursores_regulares, desplazados);
  });

  // Todos los precursores regulares en una sola lista (sin agrupar), ordenados por nombre
  precRegPlanos = computed(() =>
    this.gruposPrecRegFiltrados()
      .flatMap(g => g.publicadores)
      .sort((a: any, b: any) => a.nombre_completo.localeCompare(b.nombre_completo))
  );

  totalActivos = computed(() => this.gruposActivosFiltrados().reduce((s, g) => s + g.publicadores.length, 0));

  totalPrecRegulares = computed(() => this.gruposPrecRegFiltrados().reduce((s, g) => s + g.publicadores.length, 0));

  totalPrecAuxiliares = computed(() =>
    this.registros()?.activos.precursores_auxiliares.reduce((s, g) => s + g.publicadores.length, 0) ?? 0
  );

  contactosFiltrados = computed(() => {
    const q = this.filtroContactos().toLowerCase().trim();
    const list = this.contactos() ?? [];
    // Busca también por el nombre del familiar: a veces se recuerda a quién
    // hay que llamar, no de quién es el contacto.
    return q
      ? list.filter(cp => cp.nombre_publicador.toLowerCase().includes(q)
          || cp.contactos.some(c => (c.nombre ?? '').toLowerCase().includes(q)))
      : list;
  });

  tarjetasTotales = computed(() => {
    const t = this.totales();
    if (!t) return [];
    return [t.total_publicadores, t.total_precursores_regulares, t.total_precursores_auxiliares];
  });

  /** Mes cuyos informes todavía se están recogiendo. Lo marcan las dos
   *  secciones que muestran meses, así que se toma de la que esté cargada. */
  mesEnCurso = computed<MesEnCurso | null>(
    () => this.totales()?.mes_en_curso ?? this.registros()?.mes_en_curso ?? null
  );

  esMesEnCurso(mes: number): boolean {
    return this.mesEnCurso()?.mes === mes;
  }

  tituloMesEnCurso(): string {
    const mec = this.mesEnCurso();
    return mec
      ? `${mec.mes_nombre} es el mes que se está informando: todavía se recogen los informes, así que las cifras pueden estar incompletas.`
      : '';
  }

  /** Cache por tarjeta: el pie llama al promedio una vez por columna en cada
   *  ciclo de detección de cambios y la tarjeta es inmutable. */
  private promediosCache = new WeakMap<TarjetaTotal, {
    cursos: number; participo: number; noParticipo: number; total: number;
  }>();

  /** Promedio de cada columna sobre los meses que ya tienen informe. Se dejan
   *  fuera los meses sin datos y el mes en curso: sus cifras están a medio
   *  recoger y arrastrarían la media hacia abajo. El mes sigue visible en su
   *  fila, marcado, para que el superintendente lo lea con ese contexto. */
  promediosPublicadores(tarjeta: TarjetaTotal) {
    const cacheado = this.promediosCache.get(tarjeta);
    if (cacheado) return cacheado;

    const filas = tarjeta.filas.filter(
      f => f.participaciones > 0 && !this.esMesEnCurso(f.mes)
    );
    const n = filas.length;
    const media = (sel: (f: FilaMensualTotal) => number) =>
      n ? filas.reduce((acc, f) => acc + sel(f), 0) / n : 0;

    const prom = {
      cursos: media(f => f.cursos_biblicos),
      participo: media(f => f.participaciones),
      noParticipo: media(f => f.total_activos - f.participaciones),
      total: media(f => f.total_activos),
    };
    this.promediosCache.set(tarjeta, prom);
    return prom;
  }

  /** Misma idea para las tarjetas de precursores (regulares/auxiliares):
   *  promedio de total activos, cursos y horas, sin el mes en curso. */
  private promediosPrecursoresCache = new WeakMap<TarjetaTotal, {
    total: number; cursos: number; horas: number;
  }>();

  promediosPrecursores(tarjeta: TarjetaTotal) {
    const cacheado = this.promediosPrecursoresCache.get(tarjeta);
    if (cacheado) return cacheado;

    const filas = tarjeta.filas.filter(
      f => f.participaciones > 0 && !this.esMesEnCurso(f.mes)
    );
    const n = filas.length;
    const media = (sel: (f: FilaMensualTotal) => number) =>
      n ? filas.reduce((acc, f) => acc + sel(f), 0) / n : 0;

    const prom = {
      total: media(f => f.total_activos),
      cursos: media(f => f.cursos_biblicos),
      horas: media(f => f.horas || 0),
    };
    this.promediosPrecursoresCache.set(tarjeta, prom);
    return prom;
  }

  // ── Gráficas del resumen ───────────────────────────────────────────────────
  // Cuatro preguntas que se hace un superintendente al llegar, cada una con su
  // respuesta en una cifra arriba y la tendencia mes a mes debajo:
  //   ¿cuántos predican? · ¿cómo van los precursores regulares? ·
  //   ¿cuántos cursos hay? · ¿cuánta asistencia hay?
  // Paleta validada (dataviz): azul y naranja, una sola escala por gráfica.

  /** Meses con datos completos para las gráficas: sin el mes en curso ni los
   *  que tienen muy pocos informes (menos de la cuarta parte del mes más
   *  completo). Un mes a medio informar se leería como una caída. */
  private mesesCompletos = computed<Set<number>>(() => {
    const t = this.totales();
    if (!t) return new Set();
    const filas = t.total_publicadores.filas;
    const max = Math.max(0, ...filas.map(f => f.participaciones));
    return new Set(filas
      .filter(f => !this.esMesEnCurso(f.mes) && f.participaciones >= max * 0.25)
      .map(f => f.mes));
  });

  /** Meses que se dejaron fuera, para decirlo bajo las gráficas. */
  mesesFueraGraficas = computed(() => {
    const t = this.totales();
    if (!t) return '';
    const fuera = t.total_publicadores.filas
      .filter(f => !this.mesesCompletos().has(f.mes))
      .map(f => f.mes_nombre.toLowerCase());
    if (!fuera.length) return '';
    const lista = fuera.length === 1 ? fuera[0] : `${fuera.slice(0, -1).join(', ')} y ${fuera[fuera.length - 1]}`;
    return `No se incluye${fuera.length > 1 ? 'n' : ''} ${lista}: aún no tiene${fuera.length > 1 ? 'n' : ''} los informes completos.`;
  });

  /** Colores por tema. Azul y naranja pasan las comprobaciones de daltonismo
   *  y contraste en claro y oscuro. */
  private paletaGraficas = computed(() => {
    const dark = this.theme.darkMode();
    return {
      azul: dark ? '#3987e5' : '#2a78d6',
      naranja: dark ? '#d95926' : '#eb6834',
      texto: dark ? '#94a3b8' : '#64748b',
      textoFuerte: dark ? '#e2e8f0' : '#334155',
      eje: dark ? '#334155' : '#e2e8f0',
      rejilla: dark ? 'rgba(51,65,85,0.55)' : 'rgba(148,163,184,0.18)',
      superficie: dark ? '#0f172a' : '#ffffff',
    };
  });

  private sinMovimiento = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Base común: ejes discretos, tooltip legible y entrada suave de las barras. */
  private baseGrafica(meses: string[], conLeyenda: boolean, sufijo = ''): EChartsOption {
    const c = this.paletaGraficas();
    return {
      animation: !this.sinMovimiento,
      animationDuration: 500,
      animationEasing: 'cubicOut',
      animationDelay: (i: number) => i * 30,
      textStyle: { fontFamily: 'Manrope, system-ui, sans-serif' },
      grid: { top: 12, right: 12, bottom: conLeyenda ? 44 : 24, left: 44 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: c.rejilla } },
        backgroundColor: c.superficie, borderColor: c.eje, borderWidth: 1,
        textStyle: { color: c.textoFuerte, fontSize: 13 },
        valueFormatter: (v: any) => v == null ? '—' : `${(+v).toLocaleString('es-CO', { maximumFractionDigits: 1 })}${sufijo}`,
      },
      legend: conLeyenda ? {
        bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10, itemGap: 18,
        textStyle: { color: c.texto, fontSize: 12 },
      } : undefined,
      xAxis: {
        type: 'category', data: meses, axisTick: { show: false },
        axisLine: { lineStyle: { color: c.eje } },
        axisLabel: { color: c.texto, fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: c.texto, fontSize: 12 },
        splitLine: { lineStyle: { color: c.rejilla } },
      },
    };
  }

  private media(vals: number[]): number {
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  graficas = computed(() => {
    const t = this.totales();
    if (!t) return null;
    const c = this.paletaGraficas();
    const ok = this.mesesCompletos();
    const corto = (f: FilaMensualTotal) => f.mes_nombre.slice(0, 3);
    const pubs = t.total_publicadores.filas.filter(f => ok.has(f.mes));
    const regs = t.total_precursores_regulares.filas.filter(f => ok.has(f.mes));
    const meses = pubs.map(corto);
    const barra = { barMaxWidth: 28, itemStyle: { borderRadius: [4, 4, 0, 0] } };

    // 1 · ¿Cuántos predican? Barras apiladas: predicó + irregular = total.
    const predico = pubs.map(f => f.participaciones);
    const irregular = pubs.map(f => Math.max(0, f.total_activos - f.participaciones));
    const pPredico = this.media(predico);
    const pTotal = this.media(pubs.map(f => f.total_activos));
    const participacion: EChartsOption = {
      ...this.baseGrafica(meses, true),
      series: [
        { name: 'Predicó', type: 'bar', stack: 'p', data: predico, color: c.azul,
          barMaxWidth: 28, itemStyle: { borderColor: c.superficie, borderWidth: 1 } },
        { name: 'Irregular', type: 'bar', stack: 'p', data: irregular, color: c.naranja,
          barMaxWidth: 28, itemStyle: { borderRadius: [4, 4, 0, 0], borderColor: c.superficie, borderWidth: 1 } },
      ],
    };

    // 2 · Precursores regulares: promedio de horas por persona contra la meta.
    const horasReg = regs.map(f => f.participaciones && f.horas != null ? +(f.horas / f.participaciones).toFixed(1) : null);
    const pHoras = this.media(horasReg.filter((v): v is number => v != null));
    const META = 50;
    const precursores: EChartsOption = {
      ...this.baseGrafica(meses, false, ' h'),
      yAxis: {
        type: 'value', max: (v: any) => Math.max(60, Math.ceil(v.max / 10) * 10),
        axisLabel: { color: c.texto, fontSize: 12, formatter: '{value} h' },
        splitLine: { lineStyle: { color: c.rejilla } },
      },
      series: [{
        name: 'Promedio por precursor', type: 'bar', data: horasReg, color: c.azul, ...barra,
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { color: c.textoFuerte, type: 'dashed', width: 1.5 },
          label: { formatter: `Meta ${META} h`, color: c.textoFuerte, fontSize: 12, position: 'insideEndTop' },
          data: [{ yAxis: META }],
        },
      }],
    };

    // 3 · Cursos bíblicos: el total de la congregación; el desglose, al pasar.
    const tarjetas = [t.total_publicadores, t.total_precursores_regulares, t.total_precursores_auxiliares];
    const nombres = ['Publicadores', 'Precursores regulares', 'Precursores auxiliares'];
    const cursosTotal = pubs.map(f => tarjetas.reduce((s, tj) => s + (tj.filas.find(x => x.mes === f.mes)?.cursos_biblicos ?? 0), 0));
    const pCursos = this.media(cursosTotal);
    const cursos: EChartsOption = {
      ...this.baseGrafica(meses, false),
      tooltip: {
        ...(this.baseGrafica(meses, false).tooltip as object),
        formatter: (ps: any) => {
          const p = Array.isArray(ps) ? ps[0] : ps;
          const mes = pubs[p.dataIndex]?.mes;
          const lineas = tarjetas.map((tj, i) =>
            `<div style="display:flex;justify-content:space-between;gap:16px"><span>${nombres[i]}</span><b>${tj.filas.find(x => x.mes === mes)?.cursos_biblicos ?? 0}</b></div>`);
          return `<div style="font-weight:700;margin-bottom:4px">${p.name} · ${p.value} cursos</div>${lineas.join('')}`;
        },
      },
      series: [{ name: 'Cursos', type: 'bar', data: cursosTotal, color: c.azul, ...barra }],
    };

    return {
      participacion, precursores, cursos,
      resumen: {
        predico: Math.round(pPredico),
        total: Math.round(pTotal),
        pct: pTotal ? Math.round((pPredico / pTotal) * 100) : 0,
        horas: pHoras,
        meta: META,
        cursos: Math.round(pCursos),
      },
    };
  });

  /** 4 · Asistencia: promedio por reunión, entre semana y fin de semana. */
  graficaAsistencia = computed(() => {
    const bloque = this.bloquesS88()[0];
    if (!bloque) return null;
    const c = this.paletaGraficas();
    const meses = bloque.meses.filter((m: any) => m.midweek_promedio || m.weekend_promedio);
    if (!meses.length) return null;
    const entre = meses.map((m: any) => m.midweek_promedio ?? null);
    const fin = meses.map((m: any) => m.weekend_promedio ?? null);
    const linea = (name: string, data: any[], color: string) => ({
      name, type: 'line' as const, data, color, smooth: false, connectNulls: false,
      lineStyle: { width: 2 }, symbol: 'circle', symbolSize: 8,
      itemStyle: { borderColor: c.superficie, borderWidth: 2 },
    });
    const opciones: EChartsOption = {
      ...this.baseGrafica(meses.map((m: any) => m.nombre_mes.slice(0, 3)), true),
      tooltip: { ...(this.baseGrafica([], true).tooltip as object), axisPointer: { type: 'line', lineStyle: { color: c.eje } } },
      yAxis: {
        type: 'value', scale: true,
        axisLabel: { color: c.texto, fontSize: 12 },
        splitLine: { lineStyle: { color: c.rejilla } },
      },
      series: [linea('Fin de semana', fin, c.azul), linea('Entre semana', entre, c.naranja)],
    };
    const num = (v: number[]) => Math.round(this.media(v.filter(x => x != null && x > 0)));
    return { opciones, fin: num(fin), entre: num(entre) };
  });

  /** Al abrir las gráficas se trae la asistencia sin tapar la pantalla de carga. */
  verGraficas() {
    this.vistaResumen.set('graficas');
    if (this.asistencia()) return;
    this.errorAsistenciaGrafica.set(false);
    const anio = this.anioSel();
    const obs = this.modo === 'publico'
      ? this.svc.asistenciaPublico(this.token, anio)
      : this.svc.asistenciaInterno(this.idVisita, anio);
    // Sin marcar el fallo, la tarjeta de asistencia giraba para siempre.
    this.deEstaVisita(obs).subscribe({ next: d => this.asistencia.set(d), error: () => this.errorAsistenciaGrafica.set(true) });
  }

  /** La asistencia de las gráficas no llegó: se dice en vez de girar sin fin. */
  errorAsistenciaGrafica = signal(false);

  mesesHeaders = computed(() => {
    const r = this.registros();
    if (!r) return [];
    const pub = r.activos.publicadores_por_grupo[0]?.publicadores[0]
      ?? r.activos.precursores_regulares[0]?.publicadores[0]
      ?? r.activos.precursores_auxiliares[0]?.publicadores[0]
      ?? r.inactivos[0];
    return pub?.historial.map(h => ({ mes: h.mes, nombre: h.mes_nombre })) ?? [];
  });

  /** Angular sanea `[innerHTML]` y descarta los <svg>, así que hay que marcar
   *  estos iconos (constantes del propio componente) como confiables. */
  private svgSeguro = (markup: string): SafeHtml => this.sanitizer.bypassSecurityTrustHtml(markup);

  private readonly seccionesBase = [
    { id: 'registros' as Seccion, label: 'Registros de predicación', labelCorto: 'Registros', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' },
    { id: 'totales' as Seccion, label: 'Resumen mensual', labelCorto: 'Resumen', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { id: 'contactos' as Seccion, label: 'Contactos de emergencia', labelCorto: 'Contactos', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
    { id: 'asistencia' as Seccion, label: 'Asistencia a reuniones', labelCorto: 'Asistencia', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' },
    { id: 'documentos' as Seccion, label: 'Documentos', labelCorto: 'Documentos', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>' },
  ];

  // ── Enlace para la esposa / acompañante ─────────────────────────────────────

  /** El enlace abierto es el de la esposa: solo ve la agenda. */
  esAcompanante = computed(() => this.metadata()?.alcance === 'acompanante');
  /** La agenda respondió vacía o con error (para el mensaje de la esposa). */
  agendaVacia = signal(false);

  compartirAbierto = signal(false);
  enlaceAcomp = signal<EnlaceAcompanante | null>(null);
  acompCargando = signal(false);
  acompError = signal<string | null>(null);
  acompCopiado = signal(false);
  acompQuitado = signal(false);

  abrirCompartir() {
    this.compartirAbierto.set(true);
    this.acompError.set(null);
    this.acompCopiado.set(false);
    this.acompQuitado.set(false);
    this.acompCargando.set(true);
    this.svc.acompananteObtener(this.token).subscribe({
      next: (e) => { this.enlaceAcomp.set(e); this.acompCargando.set(false); },
      error: () => { this.acompError.set('No se pudo consultar el enlace. Revise su conexión.'); this.acompCargando.set(false); },
    });
  }

  crearEnlaceAcomp() {
    this.acompCargando.set(true);
    this.acompError.set(null);
    this.acompQuitado.set(false);
    this.svc.acompananteCrear(this.token).subscribe({
      next: (e) => { this.enlaceAcomp.set(e); this.acompCargando.set(false); },
      error: () => { this.acompError.set('No se pudo crear el enlace. Inténtelo de nuevo.'); this.acompCargando.set(false); },
    });
  }

  quitarEnlaceAcomp() {
    this.acompCargando.set(true);
    this.acompError.set(null);
    this.svc.acompananteRevocar(this.token).subscribe({
      next: () => {
        this.enlaceAcomp.set(null);
        this.acompQuitado.set(true);
        this.acompCargando.set(false);
      },
      error: () => { this.acompError.set('No se pudo quitar el acceso. Inténtelo de nuevo.'); this.acompCargando.set(false); },
    });
  }

  async copiarEnlaceAcomp() {
    const e = this.enlaceAcomp();
    if (!e) return;
    try {
      await navigator.clipboard.writeText(e.url);
      this.acompCopiado.set(true);
      setTimeout(() => this.acompCopiado.set(false), 2500);
    } catch {
      this.acompError.set('No se pudo copiar. Mantenga presionado el enlace para copiarlo.');
    }
  }

  whatsappAcomp(): string {
    const e = this.enlaceAcomp();
    const nombre = this.metadata()?.nombre_congregacion;
    const texto = `Agenda de la visita${nombre ? ' a ' + nombre : ''}: ${e?.url ?? ''}`;
    return `https://wa.me/?text=${encodeURIComponent(texto)}`;
  }

  secciones = computed(() => {
    // La esposa solo tiene la agenda: el servidor le niega el resto, y aquí ni
    // se le muestran las pestañas.
    const base = this.esAcompanante() ? [] : this.seccionesBase;
    const todas = this.agenda()
      ? [{ id: 'agenda' as Seccion, label: 'Agenda', labelCorto: 'Agenda', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' }, ...base]
      : base;
    return todas.map(s => ({ ...s, icon: this.svgSeguro(s.icon) }));
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit() {
    this.inicializar();
    // El ancho útil de la nav cambia sin que cambie el viewport (sidebar,
    // scrollbar, zoom), así que se observa el elemento directamente.
    afterNextRender(() => {
      const nav = this.navSecciones()?.nativeElement;
      if (!nav || typeof ResizeObserver === 'undefined') return;
      this.navRO = new ResizeObserver(() => this.recalcularNavOverflow());
      this.navRO.observe(nav);
      this.recalcularNavOverflow();
    }, { injector: this.injector });
  }

  /** Se emite al cambiar de visita (y al destruir): corta las cargas de la
   *  visita anterior para que una respuesta tardía no pise los datos nuevos. */
  private cambioVisita$ = new Subject<void>();
  private deEstaVisita<T>(obs: Observable<T>): Observable<T> {
    return obs.pipe(takeUntil(this.cambioVisita$));
  }

  ngOnDestroy() {
    this.cambioVisita$.next();
    this.cambioVisita$.complete();
    this.navRO?.disconnect();
    // El blob de la tarjeta vive hasta que se revoque: sin esto queda retenido
    // si el portal se destruye con el visor abierto.
    this.revocarTarjeta();
  }

  /** Escape cierra el visor: es la vía de salida esperada en un diálogo. */
  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.tarjetaPreview()) this.cerrarTarjeta();
  }

  ngOnChanges(changes: SimpleChanges) {
    const cambio = changes['token'] ?? changes['idVisita'];
    // Angular dispara ngOnChanges con el primer binding justo antes de
    // ngOnInit: sin este filtro la carga inicial (incluido el pesado
    // /registros) se hacía dos veces. Solo se recarga si cambia de visita
    // con el componente ya vivo.
    if (!cambio || cambio.firstChange) return;
    // Lo que aún venía en camino es de la visita anterior: se descarta.
    this.cambioVisita$.next();
    this.cargando.set(false);
    this.errorContactos.set(null);
    this.errorDocumentos.set(null);
    this.errorAsistenciaGrafica.set(false);
    // Los datos cacheados son de la visita anterior: sin vaciarlos,
    // cargarSeccion() los daba por buenos y mostraba la visita equivocada.
    this.registros.set(null);
    this.totales.set(null);
    this.asistencia.set(null);
    this.contactos.set(null);
    this.documentos.set(null);
    this.agenda.set(null);
    this.metadata.set(null);
    this.error.set(null);
    this.grupoSel.set(undefined);
    this.filaSel.set(null);
    this.seccionActiva.set('registros');
    this.inicializar();
  }

  private inicializar() {
    if (this.modo === 'publico' && !this.token) return;
    if (this.modo === 'interno' && !this.idVisita) return;

    // Cargar metadata solo en modo público. Hay que saber el alcance del
    // enlace antes de pedir nada: con el de la esposa solo se pide la agenda.
    if (this.modo === 'publico' && this.metadataInicial) {
      this.metadata.set(this.metadataInicial);
    } else if (this.modo === 'publico') {
      this.deEstaVisita(this.svc.metadataPublico(this.token)).subscribe({
        next: (d) => { this.metadata.set(d); this.cargarSegunAlcance(); },
        error: () => this.cargarSegunAlcance(),
      });
      return;
    }
    this.cargarSegunAlcance();
  }

  private cargarSegunAlcance() {
    if (this.esAcompanante()) {
      this.seccionActiva.set('agenda');
      this.cargarAgenda();
      return;
    }

    // Año de servicio: el de la visita (lo dice el servidor según sus fechas, o la foto
    // congelada). El año de hoy solo sirve de respaldo si no responde; con él, una visita de
    // septiembre o un enlace abierto tras el cambio de año pedía un año que la visita no tiene.
    this.anioSel.set(this.calcularAnioServicio());
    const anios$ = this.modo === 'publico' ? this.svc.aniosPublico(this.token) : this.svc.aniosInterno(this.idVisita!);
    this.deEstaVisita(anios$).subscribe({
      next: ({ anios }) => {
        if (anios?.length) this.anioSel.set(anios[0]);
        this.cargarSeccion(this.seccionActiva());
      },
      error: () => this.cargarSeccion(this.seccionActiva()),
    });
    this.cargarContactos();
    this.cargarDocumentos();
    this.cargarAgenda();
  }

  /** Año de servicio que contiene hoy: Sep(N-1)–Ago(N) → devuelve N. */
  private calcularAnioServicio(): number {
    return anoServicioDe();
  }

  seccionCambio(s: Seccion) {
    this.seccionActiva.set(s);
    this.cargarSeccion(s);
    // Al cambiar de sección la pestaña activa se expande (muestra su etiqueta):
    // hay que asegurarse de que quede visible y recalcular el desbordamiento.
    afterNextRender(() => this.centrarPestanaActiva(), { injector: this.injector });
  }

  // ── Desbordamiento horizontal de las pestañas ────────────────────────────────

  /** Desplaza las pestañas una "página" hacia la izquierda (-1) o derecha (1). */
  desplazarNav(dir: -1 | 1) {
    const nav = this.navSecciones()?.nativeElement;
    if (!nav) return;
    nav.scrollBy({ left: dir * Math.max(160, nav.clientWidth * 0.7), behavior: 'smooth' });
  }

  /** Actualiza los indicadores de scroll según la posición actual. */
  recalcularNavOverflow() {
    const nav = this.navSecciones()?.nativeElement;
    if (!nav) return;
    const max = nav.scrollWidth - nav.clientWidth;
    this.navPuedeIzq.set(nav.scrollLeft > 4);
    this.navPuedeDer.set(nav.scrollLeft < max - 4);
  }

  private centrarPestanaActiva() {
    const nav = this.navSecciones()?.nativeElement;
    const activa = nav?.querySelector<HTMLElement>('.seccion-btn.active');
    activa?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    this.recalcularNavOverflow();
  }

  private cargarSeccion(s: Seccion) {
    const anio = this.anioSel();
    if (s === 'registros' && !this.registros()) this.cargarRegistros(anio);
    if (s === 'totales' && !this.totales()) this.cargarTotales(anio);
    if (s === 'asistencia' && !this.asistencia()) this.cargarAsistencia(anio);
  }

  private cargarRegistros(anio: number) {
    this.cargando.set(true);
    const obs = this.modo === 'publico'
      ? this.svc.registrosPublico(this.token, anio)
      : this.svc.registrosInterno(this.idVisita, anio);
    this.deEstaVisita(obs).subscribe({
      next: (d) => {
        this.registros.set(d);
        this.cargando.set(false);
      },
      error: () => { this.error.set('Error cargando registros.'); this.cargando.set(false); },
    });
  }

  private cargarTotales(anio: number) {
    this.cargando.set(true);
    const obs = this.modo === 'publico'
      ? this.svc.totalesPublico(this.token, anio)
      : this.svc.totalesInterno(this.idVisita, anio);
    this.deEstaVisita(obs).subscribe({
      next: (d) => { this.totales.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error cargando totales.'); this.cargando.set(false); },
    });
  }

  private cargarContactos() {
    this.errorContactos.set(null);
    const obs = this.modo === 'publico'
      ? this.svc.contactosPublico(this.token)
      : this.svc.contactosInterno(this.idVisita);
    this.deEstaVisita(obs).subscribe({
      next: (d) => this.contactos.set(d),
      error: () => this.errorContactos.set('No se pudieron cargar los contactos.'),
    });
  }

  reintentarContactos() {
    this.cargarContactos();
  }

  private cargarAsistencia(anio: number) {
    this.cargando.set(true);
    const obs = this.modo === 'publico'
      ? this.svc.asistenciaPublico(this.token, anio)
      : this.svc.asistenciaInterno(this.idVisita, anio);
    this.deEstaVisita(obs).subscribe({
      next: (d) => { this.asistencia.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error cargando asistencia.'); this.cargando.set(false); },
    });
  }

  private cargarDocumentos() {
    this.errorDocumentos.set(null);
    const obs = this.modo === 'publico'
      ? this.svc.documentosPublico(this.token)
      : this.svc.documentosInterno(this.idVisita);
    this.deEstaVisita(obs).subscribe({
      next: (d) => this.documentos.set(d),
      error: () => this.errorDocumentos.set('No se pudieron cargar los documentos.'),
    });
  }

  reintentarDocumentos() {
    this.cargarDocumentos();
  }

  private cargarAgenda() {
    const obs = this.modo === 'publico'
      ? this.svc.agendaPublico(this.token)
      : this.svc.agendaInterno(this.idVisita);
    this.deEstaVisita(obs).subscribe({
      next: (d) => {
        this.agenda.set(d);
        // Si el usuario no ha navegado aún, mostrar agenda primero
        if (this.seccionActiva() === 'registros') {
          this.seccionActiva.set('agenda');
        }
      },
      error: () => { this.agenda.set(null); this.agendaVacia.set(true); },
    });
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────

  onDescargarZip() {
    this.descargandoZip.set(true);
    const anio = this.anioSel();
    const obs = this.modo === 'publico'
      ? this.svc.zipFielPublico(this.token, anio)
      : this.svc.zipFielInterno(this.idVisita, anio);
    obs.subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `visita_circuito_${anio}.zip`);
        this.descargandoZip.set(false);
      },
      error: () => {
        this.descargandoZip.set(false);
        this.zipDownloadError.set(true);
        setTimeout(() => this.zipDownloadError.set(false), 4000);
      },
    });
  }

  onDescargarS88() {
    this.descargandoS88.set(true);
    const anio = this.anioSel();
    const obs = this.modo === 'publico'
      ? this.svc.s88PdfPublico(this.token, anio)
      : this.svc.s88PdfInterno(this.idVisita, anio);
    obs.subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `S-88_${anio}.pdf`);
        this.descargandoS88.set(false);
      },
      error: () => this.descargandoS88.set(false),
    });
  }

  /** Abre la tarjeta de un publicador recomendado en la agenda. */
  onVerTarjeta(idPublicador: number, nombre: string) {
    this.abrirTarjeta(idPublicador, nombre);
  }

  /**
   * Carga la tarjeta y la muestra en el visor del portal.
   *
   * Antes se abría en una pestaña nueva, pero `window.open` fuera del gesto del
   * usuario (el blob llega después) lo bloquean los navegadores, así que la
   * vista previa fallaba en silencio. Dentro del portal siempre aparece, y el
   * superintendente no pierde el sitio en la tabla.
   */
  private abrirTarjeta(idPublicador: number, nombre: string) {
    if (this.descargandoTarjeta()) return;
    this.descargandoTarjeta.set(idPublicador);
    const anio = this.anioSel();
    const obs = this.modo === 'publico'
      ? this.svc.tarjetaPdfPublico(this.token, idPublicador, anio)
      : this.svc.tarjetaPdfInterno(this.idVisita, anio, { publicadorId: idPublicador });
    obs.subscribe({
      next: (blob) => {
        this.revocarTarjeta();
        const href = URL.createObjectURL(blob);
        this.tarjetaPreview.set({
          nombre,
          blob,
          href,
          // El iframe exige URL saneada; el <a> de respaldo usa la cruda.
          url: this.sanitizer.bypassSecurityTrustResourceUrl(href),
        });
        this.descargandoTarjeta.set(null);
      },
      error: () => this.descargandoTarjeta.set(null),
    });
  }

  cerrarTarjeta() {
    this.revocarTarjeta();
    this.tarjetaPreview.set(null);
  }

  /** Guarda la tarjeta que se está viendo, sin volver a pedirla al servidor. */
  descargarTarjetaPreview() {
    const tp = this.tarjetaPreview();
    if (tp) this.svc.saveBlob(tp.blob, `Tarjeta - ${tp.nombre}.pdf`);
  }

  private revocarTarjeta() {
    const previo = this.tarjetaPreview();
    if (previo) URL.revokeObjectURL(previo.href);
  }

  onDescargarDocumento(doc: DocumentoItem) {
    if (this.docDescargando()) return;
    this.docDescargando.set(doc.nombre);
    this.svc.archivoInterno(this.idVisita, doc.nombre).subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, doc.nombre);
        this.docDescargando.set(null);
      },
      error: () => this.docDescargando.set(null),
    });
  }

  onDescargarContactosPdf() {
    this.descargandoContactosPdf.set(true);
    const obs = this.modo === 'publico'
      ? this.svc.contactosPdfPublico(this.token)
      : this.svc.contactosPdfInterno(this.idVisita);
    obs.subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, 'contactos_emergencia.pdf');
        this.descargandoContactosPdf.set(false);
      },
      error: () => this.descargandoContactosPdf.set(false),
    });
  }

  sortBy(col: 'horas' | 'cursos' | 'nombre') {
    if (this.sortCol() === col) {
      this.sortDir.update(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('desc');
    }
  }

  sortPubs(pubs: any[]): any[] {
    const col = this.sortCol();
    if (!col) return pubs;
    const dir = this.sortDir() === 'desc' ? -1 : 1;
    if (col === 'nombre') {
      return [...pubs].sort((a, b) =>
        a.nombre_completo.localeCompare(b.nombre_completo, 'es') * dir
      );
    }
    // En la pestaña de precursores la columna muestra el total de los meses con
    // el nombramiento vigente: hay que ordenar por ese mismo número, no por el
    // del año, o el orden no coincide con lo que se ve.
    const esPrecReg = this.subTabRegistros() === 'prec_reg';
    const field = col === 'horas'
      ? (esPrecReg ? 'total_horas_preg' : 'total_horas')
      : (esPrecReg ? 'total_cursos_preg' : 'total_cursos');
    return [...pubs].sort((a, b) => ((a[field] ?? -1) - (b[field] ?? -1)) * dir);
  }

  filterAndSortPubs(pubs: any[]): any[] {
    const q = this.filtroPublicadores().toLowerCase().trim();
    const filtered = q ? pubs.filter(p => p.nombre_completo.toLowerCase().includes(q)) : pubs;
    return this.sortPubs(filtered);
  }

  reintentarCarga() {
    this.error.set(null);
    this.cargarSeccion(this.seccionActiva());
  }

  /** Abre la tarjeta de un publicador de la tabla en el visor.
   *  Disponible también en el portal público: el superintendente necesita la
   *  tarjeta individual tanto como el secretario, y el endpoint público ya
   *  acota el PDF a un publicador de la congregación de la visita. */
  onDescargarTarjeta(pub: any) {
    this.abrirTarjeta(pub.id_publicador as number, pub.nombre_completo);
  }

  onDescargarGrupoPrecReg() {
    if (this.modo !== 'interno') return;
    this.descargandoGrupo.set('prec_reg');
    this.svc.tarjetaPdfInterno(this.idVisita, this.anioSel(), { soloPrecursores: true }).subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `Tarjetas - Precursores Regulares - ${this.anioSel()}.pdf`);
        this.descargandoGrupo.set(null);
      },
      error: () => this.descargandoGrupo.set(null),
    });
  }

  onDescargarGrupoActivos(grupo: any) {
    if (this.modo !== 'interno') return;
    const key = grupo.grupo_id ?? 'sin-grupo';
    this.descargandoGrupo.set(key);
    // Se piden los ids de quienes se ven en el grupo: filtrar por grupo_id
    // dejaba entrar a inactivos y precursores y, con «Sin grupo» (id nulo),
    // devolvía las tarjetas de toda la congregación.
    const ids = (grupo.publicadores ?? []).map((p: any) => p.id_publicador as number);
    if (!ids.length) { this.descargandoGrupo.set(null); return; }
    this.svc.tarjetaPdfInterno(this.idVisita, this.anioSel(), { publicadorIds: ids }).subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `Tarjetas - ${grupo.grupo_nombre} - ${this.anioSel()}.pdf`);
        this.descargandoGrupo.set(null);
      },
      error: () => this.descargandoGrupo.set(null),
    });
  }

  onDescargarGrupoInactivos() {
    if (this.modo !== 'interno') return;
    const ids = (this.registros()?.inactivos ?? []).map((p: any) => p.id_publicador as number);
    if (!ids.length) return;
    this.descargandoGrupo.set('inactivos');
    this.svc.tarjetaPdfInterno(this.idVisita, this.anioSel(), { publicadorIds: ids }).subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `Tarjetas - Inactivos - ${this.anioSel()}.pdf`);
        this.descargandoGrupo.set(null);
      },
      error: () => this.descargandoGrupo.set(null),
    });
  }

  // ── Grupo visible y fila marcada ──────────────────────────────────────────

  /** Grupo que se muestra: el elegido, o el primero si aún no se eligió o si
   *  el elegido ya no existe (cambio de visita). */
  grupoActual = computed(() => {
    const grupos = this.gruposActivosFiltrados();
    const sel = this.grupoSel();
    return grupos.find(g => g.grupo_id === sel) ?? grupos[0] ?? null;
  });

  /** Al buscar: solo los grupos donde alguien coincide. */
  gruposConCoincidencias = computed(() => {
    const q = this.filtroPublicadores().toLowerCase().trim();
    const grupos = this.gruposActivosFiltrados();
    if (!q) return grupos;
    return grupos.filter(g => g.publicadores.some((p: any) => p.nombre_completo.toLowerCase().includes(q)));
  });

  /** «Grupo 1», «Sin grupo»: el nombre del servidor trae un «#» de más. */
  etiquetaGrupo(g: any): string {
    return g.grupo_numero ? `Grupo ${g.grupo_numero}` : (g.grupo_nombre || 'Sin grupo');
  }

  elegirGrupo(id: number | null) {
    this.grupoSel.set(id);
    this.filaSel.set(null);
  }

  marcarFila(id: number) {
    this.filaSel.update(actual => actual === id ? null : id);
  }

  togglePub(id: number) {
    this.pubsExpandidos.update(s => {
      const copy = new Set(s);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  pubExpandido(id: number): boolean {
    return this.pubsExpandidos().has(id);
  }

  // ── Helpers privilegios ──────────────────────────────────────────────────────

  esAuxiliar(priv: string | null): boolean {
    return (priv ?? '').toLowerCase().includes('auxiliar');
  }

  privLabel(priv: string | null): string {
    if (!priv) return '';
    const p = priv.toLowerCase();
    // Palabras completas: quien abre el enlace por primera vez no tiene por
    // qué conocer las abreviaturas internas.
    if (p.includes('anciano')) return 'Anciano';
    if (p.includes('siervo')) return 'Siervo ministerial';
    if (p.includes('especial')) return 'Precursor especial';
    if (p.includes('misionero')) return 'Misionero';
    if (p.includes('regular')) return 'Precursor regular';
    if (p.includes('auxiliar')) return 'Precursor auxiliar';
    if (p.includes('precursor')) return 'Precursor';
    return priv;
  }

  // ── Nombramiento de precursor regular a mitad del año de servicio ───────────
  // Quien fue nombrado en, digamos, noviembre arrastra meses previos en los que
  // informó como publicador o como auxiliar. Sin marcarlos, esas horas se leen
  // como horas de precursorado y el total del año mezcla las dos etapas.

  private static readonly MESES_CORTOS = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  private static readonly MESES_LARGOS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  /** Parte 'YYYY-MM-DD' a mano: `new Date('2025-11-01')` se interpreta en UTC
   *  y en husos negativos (el nuestro) retrocede al 31 de octubre. */
  private partesFecha(iso: string | null | undefined): { anio: number; mes: number; dia: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? { anio: +m[1], mes: +m[2], dia: +m[3] } : null;
  }

  /** 'nov 2025' si el nombramiento empezó dentro del año de servicio mostrado
   *  y deja meses previos en la tabla. null en cualquier otro caso: si empezó
   *  antes del año, o justo en su primer mes, todos los meses son de
   *  precursorado y el chip sería ruido en la mayoría de las filas. */
  inicioPregLabel(pub: any): string | null {
    const f = this.partesFecha(pub?.preg_desde);
    if (!f) return null;
    const anioServicio = this.registros()?.anio ?? this.anioSel();
    const esAnterior = f.anio < anioServicio - 1
      || (f.anio === anioServicio - 1 && f.mes < 9);
    if (esAnterior) return null;
    const meses = (pub?.historial ?? []).length;
    if (!meses || (pub?.meses_preg ?? 0) >= meses) return null;
    return `${EntregaPortalComponent.MESES_CORTOS[f.mes - 1]} ${f.anio}`;
  }

  /** Tooltip del chip "desde …" con la fecha exacta del nombramiento. */
  tooltipInicioPreg(pub: any): string {
    const f = this.partesFecha(pub?.preg_desde);
    const priv = pub?.privilegio_principal || 'Precursor regular';
    if (!f) return priv;
    const mes = EntregaPortalComponent.MESES_LARGOS[f.mes - 1];
    const base = `${priv} desde el ${f.dia} de ${mes} de ${f.anio}`;
    return pub?.meses_preg === 0
      ? `${base}. Todavía no hay meses cerrados con el nombramiento.`
      : `${base}. Los meses anteriores no cuentan en sus totales de precursor.`;
  }

  /** Tooltip de la nota de consideración especial: el motivo y desde cuándo. */
  tooltipConsideracion(pub: any): string {
    const motivo = pub?.consideracion_motivo;
    if (!motivo) return '';
    const f = this.partesFecha(pub?.consideracion_desde);
    const desde = f
      ? ` desde el ${f.dia} de ${EntregaPortalComponent.MESES_LARGOS[f.mes - 1]} de ${f.anio}`
      : '';
    return `Consideración especial${desde} (${motivo}): conserva el nombramiento de `
      + 'precursor regular sin tener que cumplir el requisito de horas.';
  }

  /** Mes fuera del nombramiento de precursor regular. Los meses de auxiliar
   *  quedan excluidos a propósito: conservan su ámbar, que es lo que
   *  identifica esas horas como de precursorado auxiliar. */
  esMesFueraNombramiento(pub: any, h: any): boolean {
    return !!pub?.preg_desde && !h?.precursor_regular && !h?.precursor_auxiliar;
  }

  /** Primer mes con el nombramiento vigente: lleva la línea de inicio. */
  esInicioNombramiento(pub: any, h: any): boolean {
    if (!h?.precursor_regular || !this.inicioPregLabel(pub)) return false;
    const primero = (pub?.historial ?? []).find((x: any) => x.precursor_regular);
    return !!primero && primero.mes === h.mes;
  }

  /** «56 h», «56 h + 30 créditos» o «30 créditos»: las horas de crédito
   *  (Betel, Salón de Asambleas) se dicen aparte para que la suma cuadre. */
  private horasTexto(h: any): string {
    const campo = h.horas ? `${h.horas} h` : '';
    const credito = h.horas_credito
      ? `${h.horas_credito} ${h.horas_credito === 1 ? 'crédito' : 'créditos'}`
      : '';
    return [campo, credito].filter(Boolean).join(' + ');
  }

  /** Tooltip de la celda de un mes. */
  tituloMes(h: any, pub?: any): string {
    const horas = this.horasTexto(h);
    const conHoras = (base: string) => horas ? `${base} · ${horas}` : base;

    if (pub && this.esMesFueraNombramiento(pub, h)) {
      const desde = this.inicioPregLabel(pub);
      const detalle = desde ? `antes del nombramiento como precursor (${desde})` : 'antes del nombramiento como precursor';
      return horas
        ? `${h.mes_nombre}: ${detalle} · ${horas} — no cuentan en el total`
        : `${h.mes_nombre}: ${detalle}`;
    }
    if (h.precursor_auxiliar) return conHoras(`${h.mes_nombre}: Precursor auxiliar`);
    // Meses de precursor regular/especial/misionero: nombrar el privilegio en
    // vez de "Participó", para que las horas no se confundan con las de un
    // publicador normal cuando la persona ya no es precursor hoy.
    if (h.precursor_regular) {
      const priv = h.privilegio_mes || 'Precursor regular';
      // En la pestaña de precursores (se pasa `pub`) el privilegio regular ya
      // lo dice la propia fila: repetirlo alargaba el mensaje sin aportar. Los
      // especiales y misioneros sí se nombran, porque difieren de ese caso.
      const esRegular = !!pub && priv.toLowerCase().includes('regular');
      if (esRegular) {
        if (horas) return `${h.mes_nombre}: ${horas}`;
        return this.esMesEnCurso(h.mes)
          ? `${h.mes_nombre}: todavía sin informe (el mes sigue en curso)`
          : `${h.mes_nombre}: sin horas informadas`;
      }
      return conHoras(`${h.mes_nombre}: ${priv}`);
    }
    if (h.participo) return conHoras(`${h.mes_nombre}: Participó`);
    // Sin informe de campo pero con crédito: no se dice «No participó».
    if (h.horas_credito) return conHoras(`${h.mes_nombre}: Horas acreditadas`);
    // Mes que aún se está informando: sin informe todavía no significa que no
    // haya participado, así que no se afirma.
    if (this.esMesEnCurso(h.mes)) return `${h.mes_nombre}: todavía sin informe (el mes sigue en curso)`;
    return `${h.mes_nombre}: No participó`;
  }

  // ── Helpers documentos ───────────────────────────────────────────────────────

  isExcel(doc: DocumentoItem): boolean {
    const ext = (doc.extension ?? '').toLowerCase();
    return ext === 'xlsx' || ext === 'xls' || doc.tipo === 'excel';
  }

  docIconClass(doc: DocumentoItem): string {
    if (doc.tipo === 'pdf') return 'doc-icon doc-icon-pdf';
    if (doc.tipo === 'imagen') return 'doc-icon doc-icon-imagen';
    if (doc.tipo === 'word') return 'doc-icon doc-icon-word';
    if (this.isExcel(doc)) return 'doc-icon doc-icon-excel';
    return 'doc-icon doc-icon-otro';
  }

  // ── Helpers S-88 ─────────────────────────────────────────────────────────────

  /**
   * Bloques de la tabla de asistencia. Con ventana de visita (los 12 meses
   * anteriores) los meses caen en dos años de servicio —p. ej. 9 + 3— y se
   * muestran como un solo periodo continuo. Sin ventana es el S-88 clásico:
   * año anterior y año actual, cada uno en su tabla. Antes la plantilla
   * recorría los índices 0–11 de ambos años y, con la ventana, leía meses
   * inexistentes: la tabla salía cortada y la del fin de semana no se pintaba.
   */
  bloquesS88 = computed<{ titulo: string; meses: any[]; conAnio: boolean }[]>(() => {
    const a = this.asistencia();
    if (!a) return [];
    const ant = a.ano_anterior?.meses ?? [];
    const act = a.ano_actual?.meses ?? [];
    if (a.ventana) {
      return [{ titulo: `${a.ventana.desde} a ${a.ventana.hasta}`, meses: [...ant, ...act], conAnio: true }];
    }
    return [
      { titulo: `Año de servicio ${a.ano_actual?.ano_servicio}`, meses: act, conAnio: false },
      { titulo: `Año de servicio ${a.ano_anterior?.ano_servicio}`, meses: ant, conAnio: false },
    ];
  });

  fmtS88(mes: any, tipo: 'midweek' | 'weekend', campo: 'reun' | 'total' | 'prom'): string {
    if (!mes) return '—';
    const keys = { reun: 'reuniones', total: 'total', prom: 'promedio' } as const;
    const val = mes[`${tipo}_${keys[campo]}`];
    if (val == null || val === 0) return '—';
    return campo === 'prom' ? this.numero(Number(val)) : String(val);
  }

  /** Promedio de los meses que tuvieron reuniones (los vacíos no cuentan). */
  promS88(meses: any[], tipo: 'midweek' | 'weekend'): string {
    const vals = (meses ?? [])
      .map((m: any) => m[`${tipo}_promedio`])
      .filter((v: any) => v != null && v > 0) as number[];
    if (!vals.length) return '—';
    return this.numero(vals.reduce((x, y) => x + y, 0) / vals.length);
  }

  private numero(v: number): string {
    return v.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  }

  /** 1 234 567 → "1,2 MB". El servidor manda bytes; antes se pintaban como KB. */
  tamanoLegible(bytes: number | null | undefined): string {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${this.numero(b / 1024)} KB`;
    return `${this.numero(b / (1024 * 1024))} MB`;
  }
}

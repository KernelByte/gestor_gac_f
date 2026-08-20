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
  TarjetaTotal, FilaMensualTotal, MesEnCurso
} from '../services/entrega-portal.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ThemeService } from '../../../../core/services/theme.service';
import { SECCIONES_CONFIG, SeccionConfig, SeccionGrupo } from './agenda-secciones.config';

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
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe, NgTemplateOutlet, NgxEchartsDirective],
  templateUrl: './entrega-portal.component.html',
  styleUrl: './entrega-portal.component.scss',
})
export class EntregaPortalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() modo: 'publico' | 'interno' = 'publico';
  @Input() token: string = '';
  @Input() idVisita: number = 0;

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

  private gruposExpandidos = signal<Set<number | null>>(new Set());
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

  /** ¿Hay algún precursor con consideración especial? Decide si la clave de la
   *  leyenda aparece: en la mayoría de congregaciones no hay ningún caso. */
  hayConsideraciones = computed(() =>
    this.precRegPlanos().some((p: any) => !!p.consideracion_motivo)
  );

  totalActivos = computed(() => this.gruposActivosFiltrados().reduce((s, g) => s + g.publicadores.length, 0));

  totalPrecRegulares = computed(() => this.gruposPrecRegFiltrados().reduce((s, g) => s + g.publicadores.length, 0));

  totalPrecAuxiliares = computed(() =>
    this.registros()?.activos.precursores_auxiliares.reduce((s, g) => s + g.publicadores.length, 0) ?? 0
  );

  contactosFiltrados = computed(() => {
    const q = this.filtroContactos().toLowerCase().trim();
    const list = this.contactos() ?? [];
    return q ? list.filter(cp => cp.nombre_publicador.toLowerCase().includes(q)) : list;
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

  totalesChartOptions = computed<{ participacion: EChartsOption | null; cursos: EChartsOption | null }>(() => {
    const t = this.totales();
    if (!t) return { participacion: null, cursos: null };

    const tarjetas = [t.total_publicadores, t.total_precursores_regulares, t.total_precursores_auxiliares];
    const colores = ['#6D28D9', '#0EA5E9', '#10B981'];
    const nombres = ['Publicadores', 'Prec. Regulares', 'Prec. Auxiliares'];
    const meses = tarjetas[0].filas.map(f => f.mes_nombre.slice(0, 3));

    const dark = this.theme.darkMode();
    const axisStyle = {
      axisLine: { lineStyle: { color: dark ? '#334155' : '#e2e8f0' } },
      axisLabel: { color: dark ? '#94a3b8' : '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: dark ? 'rgba(51,65,85,0.7)' : 'rgba(148,163,184,0.15)' } },
    };
    const tooltip = {
      trigger: 'axis' as const,
      backgroundColor: dark ? 'rgba(15,23,42,0.96)' : 'rgba(30,41,59,0.92)',
      borderWidth: 0,
      textStyle: { color: '#f1f5f9', fontSize: 12 },
    };
    const legend = {
      bottom: 0,
      textStyle: { color: dark ? '#94a3b8' : '#64748b', fontSize: 10 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    };

    // Solo precursores (índices 1 y 2)
    const precursores = [
      { tarjeta: t.total_precursores_regulares, nombre: 'Prec. Regulares', color: colores[1] },
      { tarjeta: t.total_precursores_auxiliares, nombre: 'Prec. Auxiliares', color: colores[2] },
    ];

    const participacion: EChartsOption = {
      tooltip: {
        ...tooltip,
        valueFormatter: (v: any) => v != null ? `${v} h` : '—',
      },
      legend,
      grid: { top: 8, right: 12, bottom: 50, left: 40 },
      xAxis: { type: 'category', data: meses, ...axisStyle, axisTick: { show: false } },
      yAxis: {
        type: 'value',
        axisLabel: { ...axisStyle.axisLabel, formatter: '{value} h' },
        splitLine: axisStyle.splitLine,
      },
      series: precursores.map(p => ({
        name: p.nombre,
        type: 'bar' as const,
        color: p.color,
        barMaxWidth: 20,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: p.color },
        data: p.tarjeta.filas.map(f =>
          f.participaciones > 0 && f.horas != null
            ? +(f.horas / f.participaciones).toFixed(1)
            : null
        ),
      })),
    };

    const cursos: EChartsOption = {
      tooltip,
      legend,
      grid: { top: 8, right: 12, bottom: 50, left: 36 },
      xAxis: { type: 'category', data: meses, ...axisStyle, axisTick: { show: false } },
      yAxis: { type: 'value', ...axisStyle },
      series: tarjetas.map((tarjeta, i) => ({
        name: nombres[i],
        type: 'bar' as const,
        color: colores[i],
        barMaxWidth: 16,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: colores[i] },
        data: tarjeta.filas.map(f => f.cursos_biblicos),
      })),
    };

    return { participacion, cursos };
  });

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
    { id: 'totales' as Seccion, label: 'Totales por grupo', labelCorto: 'Totales', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { id: 'contactos' as Seccion, label: 'Contactos de emergencia', labelCorto: 'Contactos', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
    { id: 'asistencia' as Seccion, label: 'Asistencia (S-88)', labelCorto: 'Asistencia', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' },
    { id: 'documentos' as Seccion, label: 'Documentos', labelCorto: 'Documentos', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>' },
  ];

  secciones = computed(() => {
    const base = this.seccionesBase;
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

  ngOnDestroy() {
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
    if (changes['token'] || changes['idVisita']) {
      this.inicializar();
    }
  }

  private inicializar() {
    if (this.modo === 'publico' && !this.token) return;
    if (this.modo === 'interno' && !this.idVisita) return;

    // Cargar metadata solo en modo público
    if (this.modo === 'publico') {
      this.svc.metadataPublico(this.token).subscribe({
        next: (d) => this.metadata.set(d),
        error: () => {},
      });
    }

    // Año de servicio implícito (Sep–Ago): no hay selector, se usa el año en curso.
    this.anioSel.set(this.calcularAnioServicio());
    this.cargarSeccion('registros');
    this.cargarContactos();
    this.cargarDocumentos();
    this.cargarAgenda();
  }

  /** Año de servicio que contiene hoy: Sep(N-1)–Ago(N) → devuelve N. */
  private calcularAnioServicio(): number {
    const now = new Date();
    return now.getMonth() + 1 >= 9 ? now.getFullYear() + 1 : now.getFullYear();
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
    obs.subscribe({
      next: (d) => {
        this.registros.set(d);
        this.cargando.set(false);
        // El primer grupo se abre solo: la pantalla nunca aterriza vacía.
        if (this.gruposExpandidos().size === 0) {
          const primero = this.gruposActivosFiltrados()[0];
          if (primero) this.toggleGrupo(primero.grupo_id);
        }
      },
      error: () => { this.error.set('Error cargando registros.'); this.cargando.set(false); },
    });
  }

  private cargarTotales(anio: number) {
    this.cargando.set(true);
    const obs = this.modo === 'publico'
      ? this.svc.totalesPublico(this.token, anio)
      : this.svc.totalesInterno(this.idVisita, anio);
    obs.subscribe({
      next: (d) => { this.totales.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error cargando totales.'); this.cargando.set(false); },
    });
  }

  private cargarContactos() {
    this.errorContactos.set(null);
    const obs = this.modo === 'publico'
      ? this.svc.contactosPublico(this.token)
      : this.svc.contactosInterno(this.idVisita);
    obs.subscribe({
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
    obs.subscribe({
      next: (d) => { this.asistencia.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error cargando asistencia.'); this.cargando.set(false); },
    });
  }

  private cargarDocumentos() {
    this.errorDocumentos.set(null);
    const obs = this.modo === 'publico'
      ? this.svc.documentosPublico(this.token)
      : this.svc.documentosInterno(this.idVisita);
    obs.subscribe({
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
    obs.subscribe({
      next: (d) => {
        this.agenda.set(d);
        // Si el usuario no ha navegado aún, mostrar agenda primero
        if (this.seccionActiva() === 'registros') {
          this.seccionActiva.set('agenda');
        }
      },
      error: () => this.agenda.set(null),
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
    this.svc.tarjetaPdfInterno(this.idVisita, this.anioSel(), { grupoId: grupo.grupo_id }).subscribe({
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

  // ── Expandir/colapsar grupos y publicadores ───────────────────────────────

  toggleGrupo(id: number | null) {
    this.gruposExpandidos.update(s => {
      const copy = new Set(s);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  grupoExpandido(id: number | null): boolean {
    return this.gruposExpandidos().has(id);
  }

  todosExpandidos = computed(() => {
    const grupos = this.gruposActivosFiltrados();
    const abiertos = this.gruposExpandidos();
    return grupos.length > 0 && grupos.every(g => abiertos.has(g.grupo_id));
  });

  toggleTodosGrupos() {
    if (this.todosExpandidos()) {
      this.gruposExpandidos.set(new Set());
    } else {
      this.gruposExpandidos.set(new Set(this.gruposActivosFiltrados().map(g => g.grupo_id)));
    }
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

  privLabel(priv: string | null): string {
    if (!priv) return '';
    const p = priv.toLowerCase();
    if (p.includes('anciano')) return 'Anc.';
    if (p.includes('siervo')) return 'Sie.';
    if (p.includes('especial')) return 'P.Esp.';
    if (p.includes('misionero')) return 'P.Mis.';
    if (p.includes('regular')) return 'P.Reg.';
    if (p.includes('auxiliar')) return 'P.Aux.';
    if (p.includes('precursor')) return 'Prec.';
    return priv.slice(0, 5);
  }

  /** Meses en que el publicador sirvió como precursor auxiliar. */
  mesesAux(pub: any): any[] {
    return (pub?.historial ?? []).filter((h: any) => h.precursor_auxiliar);
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

  /** Tooltip de la celda de un mes. */
  tituloMes(h: any, pub?: any): string {
    if (pub && this.esMesFueraNombramiento(pub, h)) {
      const desde = this.inicioPregLabel(pub);
      const detalle = desde ? `antes del nombramiento como precursor (${desde})` : 'antes del nombramiento como precursor';
      return h.horas
        ? `${h.mes_nombre}: ${detalle} · ${h.horas} h — no cuentan en el total`
        : `${h.mes_nombre}: ${detalle}`;
    }
    if (h.precursor_auxiliar) {
      return h.horas
        ? `${h.mes_nombre}: Precursor auxiliar · ${h.horas} h`
        : `${h.mes_nombre}: Precursor auxiliar`;
    }
    // Meses de precursor regular/especial/misionero: nombrar el privilegio en
    // vez de "Participó", para que las horas no se confundan con las de un
    // publicador normal cuando la persona ya no es precursor hoy.
    if (h.precursor_regular) {
      const priv = h.privilegio_mes || 'Precursor regular';
      return h.horas
        ? `${h.mes_nombre}: ${priv} · ${h.horas} h`
        : `${h.mes_nombre}: ${priv}`;
    }
    if (h.participo && h.horas) return `${h.mes_nombre}: Participó · ${h.horas} h`;
    return `${h.mes_nombre}: ${h.participo ? 'Participó' : 'No participó'}`;
  }

  /** Tooltip de la etiqueta "Aux." con el detalle de meses y horas. */
  tooltipAux(pub: any): string {
    const meses = this.mesesAux(pub)
      .map((h: any) => h.horas ? `${h.mes_nombre} (${h.horas} h)` : h.mes_nombre);
    return `Precursor auxiliar en: ${meses.join(', ')}`;
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

  fmtS88(mes: any, tipo: string, campo: string): string {
    if (!mes) return '';
    const prefix = tipo === 'midweek' ? 'midweek' : 'weekend';
    const keys: Record<string, string> = {
      reun: `${prefix}_reuniones`,
      total: `${prefix}_total`,
      prom: `${prefix}_promedio`,
    };
    const val = mes[keys[campo]];
    if (val == null || val === 0) return '';
    if (campo === 'prom') return Number(val).toFixed(2);
    return String(val);
  }

  promS88(resumen: any, tipo: string): string {
    if (!resumen?.meses) return '';
    const prefix = tipo === 'midweek' ? 'midweek' : 'weekend';
    const key = `${prefix}_promedio`;
    const vals = resumen.meses
      .map((m: any) => m[key])
      .filter((v: any) => v != null && v > 0) as number[];
    if (!vals.length) return '';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
  }
}

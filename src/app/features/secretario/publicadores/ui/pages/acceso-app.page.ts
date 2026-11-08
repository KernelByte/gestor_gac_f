import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { lastValueFrom } from 'rxjs';
import {
  AccesoAppItem, AccesoAppService, EstadoAcceso, InvitacionGenerada,
} from '../../services/acceso-app.service';
import { SelectPickerComponent, PickerOption } from '../../../../../shared/components/select-picker/select-picker.component';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../../../shared/components/toast/toast.service';
import { ConfirmService } from '../../../../../shared/components/confirm-dialog/confirm.service';
import { whatsappUrl } from '../../../../../shared/whatsapp';

interface OpcionEstado {
  id: EstadoAcceso;
  label: string;
  /** Color de la franja de la fila y del chip. */
  tono: string;
}

/**
 * Los estados en el orden en que avanza una persona: desde no tener acceso
 * hasta estar usando la app, y el que la usó pero ya no (sin actividad en 30
 * días, o cerró sesión/desinstaló). "Usuario del sistema" es su propio carril
 * -no un paso más- porque esas personas no usan PIN en absoluto: entran con
 * su cuenta de correo y contraseña. La franja de color por fila permite
 * barrer la lista y ver de un vistazo a quién le falta algo.
 */
const ESTADOS: OpcionEstado[] = [
  { id: 'usuario_sistema',    label: 'Usuario del sistema', tono: 'violet' },
  { id: 'sin_acceso',         label: 'Sin acceso',        tono: 'slate' },
  { id: 'sin_invitacion',     label: 'Sin invitación',    tono: 'amber' },
  { id: 'invitacion_activa',  label: 'Invitación activa', tono: 'sky' },
  { id: 'invitacion_vencida', label: 'Invitación vencida', tono: 'rose' },
  { id: 'activo',             label: 'Usando la app',     tono: 'emerald' },
  { id: 'inactivo_app',       label: 'Dejó de usarla',    tono: 'orange' },
];

/** Un envío de WhatsApp pendiente de que el usuario lo dispare. */
interface PendienteWhatsapp {
  invitacion: InvitacionGenerada;
  enviado: boolean;
}

@Component({
  standalone: true,
  selector: 'app-acceso-app',
  imports: [CommonModule, FormsModule, ModalComponent, ConfirmDialogComponent, SelectPickerComponent],
  templateUrl: './acceso-app.page.html',
  styles: [`
    /* Esta pantalla ya no lleva su propio sistema de superficies/color: usa
       las mismas clases Tailwind literales que el listado de Publicadores
       (bg-white/slate-800/900, border-slate-200/700, bg-brand-orange...)
       para que las dos pantallas se lean como la misma aplicación. Aquí solo
       queda lo que de verdad es específico de esta vista: animaciones de
       entrada y los estados :active/:focus-visible que Tailwind no cubre. */
    :host { display: block; height: 100%; }

    /* Distintivo de estado. Pastilla con borde, igual que los demás "tags"
       de la app (sexo, grupo, privilegio en el listado de Publicadores). */
    .insignia {
      display: inline-flex; align-items: center;
      height: 1.375rem; padding: 0 0.5rem;
      border-radius: 9999px;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    /* Entrada escalonada de las filas, con techo para que una lista larga no
       tarde una eternidad en terminar de aparecer. */
    .fila {
      opacity: 0;
      animation: entrar 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      animation-delay: calc(min(var(--i, 0), 12) * 25ms);
      transition: background-color 150ms ease;
    }
    @keyframes entrar { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    .barra { animation: subir 220ms cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes subir { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

    /* El menú nace del botón que lo abre, no del centro de la nada. */
    .menu { animation: menuEntra 160ms cubic-bezier(0.16, 1, 0.3, 1); transform-origin: bottom right; }
    @keyframes menuEntra { from { opacity: 0; transform: translateY(6px) scale(0.97); } to { opacity: 1; transform: none; } }

    /* Retroalimentación física al pulsar, sin mover el layout. */
    .chip { transition: transform 120ms ease, background-color 150ms ease, border-color 150ms ease, opacity 150ms ease, box-shadow 150ms ease; }
    .chip:active { transform: scale(0.97); }
    .btn-txt, .op { transition: background-color 150ms ease; }

    /* Los hover solo existen donde hay puntero fino. En táctil se quedaban
       "pegados" después de tocar, simulando un estado que no existía. */
    @media (hover: hover) {
      .fila:hover { background-color: rgba(100,116,139,0.06); }
      .btn-txt:hover:not(:disabled), .op:hover { background-color: rgba(100,116,139,0.08); }
    }

    /* Foco visible en todo lo interactivo (WCAG), en el naranja de marca que
       usa el resto de la app. */
    button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
      outline: 2px solid #f97316;
      outline-offset: 2px;
    }

    /* El desplegable de grupo mide lo mismo que los chips de la barra (36 px);
       por defecto el selector de la app es de formulario (44 px). */
    .filtro-grupo ::ng-deep .sp-trigger { min-height: 2.25rem; padding-top: 0; padding-bottom: 0; border-radius: 0.5rem; }

    /* Chips en móvil: ruedan en horizontal sin barra a la vista. */
    .sin-barra { scrollbar-width: none; -ms-overflow-style: none; }
    .sin-barra::-webkit-scrollbar { display: none; }

    @media (prefers-reduced-motion: reduce) {
      .fila, .barra, .menu { animation: none; opacity: 1; transform: none; }
      .chip:active { transform: none; }
    }
  `],
})
export class AccesoAppComponent implements OnInit {
  private api = inject(AccesoAppService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private sanitizer = inject(DomSanitizer);

  readonly estados = ESTADOS;

  items = signal<AccesoAppItem[]>([]);
  codigoSeguridad = signal<string | null>(null);
  cargando = signal(true);
  trabajando = signal(false);

  // Filtros (se aplican en cliente: la lista de una congregación cabe de
  // sobra, y así escribir en el buscador no dispara una petición por tecla).
  busqueda = signal('');
  filtroGrupo = signal<number | null>(null);
  filtroEstado = signal<EstadoAcceso | null>(null);

  seleccion = signal<Set<number>>(new Set());

  // Modal de una invitación concreta (QR + enlace).
  invitacionAbierta = signal<InvitacionGenerada | null>(null);
  // Cola de envíos por WhatsApp: los popups se bloquean en bucle, así que se
  // abren de uno en uno desde una lista visible.
  colaWhatsapp = signal<PendienteWhatsapp[]>([]);

  /** Acciones poco frecuentes de la barra de lote, plegadas en un menú. */
  menuMas = signal(false);
  /** Quitar el acceso a varias personas no se deshace solo: se confirma. */
  confirmarQuitar = signal(false);

  grupos = computed(() => {
    const vistos = new Map<number, string>();
    for (const it of this.items()) {
      if (it.id_grupo != null && it.grupo) vistos.set(it.id_grupo, it.grupo);
    }
    return [...vistos.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  opcionesGrupo = computed<PickerOption[]>(() =>
    this.grupos().map((g) => ({ value: g.id, label: g.nombre })),
  );

  filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const grupo = this.filtroGrupo();
    const estado = this.filtroEstado();
    return this.items().filter((it) => {
      if (grupo != null && it.id_grupo !== grupo) return false;
      // Los publicadores inactivos solo aparecen en "Todos": la app no los
      // deja entrar, así que en un filtro de estado serían ruido.
      if (estado && (it.estado_acceso !== estado || it.publicador_inactivo)) return false;
      if (q && !it.nombre.toLowerCase().includes(q) &&
          !(it.codigo_pin ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  });

  conteos = computed(() => {
    const base: Record<string, number> = {};
    for (const e of ESTADOS) base[e.id] = 0;
    for (const it of this.items()) {
      if (!it.publicador_inactivo) base[it.estado_acceso]++;
    }
    return base;
  });

  /** Versión más nueva de la app vista en la congregación: la referencia para
   *  marcar a quien tiene una vieja sin tener que configurar nada. */
  versionMasNueva = computed(() => {
    let max: number[] | null = null;
    for (const it of this.items()) {
      const v = AccesoAppComponent.partesVersion(it.app_version);
      if (v && (!max || AccesoAppComponent.compararVersion(v, max) > 0)) max = v;
    }
    return max;
  });

  idsSeleccionados = computed(() => [...this.seleccion()]);
  haySeleccion = computed(() => this.seleccion().size > 0);

  todosVisiblesSeleccionados = computed(() => {
    const vis = this.filtrados();
    if (!vis.length) return false;
    const sel = this.seleccion();
    return vis.every((it) => sel.has(it.id_publicador));
  });

  ngOnInit(): void { this.cargar(); }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const data = await lastValueFrom(this.api.listar());
      this.items.set(data.items);
      this.codigoSeguridad.set(data.codigo_seguridad);
      // Soltar de la selección lo que ya no está en la lista.
      const vivos = new Set(data.items.map((i) => i.id_publicador));
      this.seleccion.update((s) => new Set([...s].filter((id) => vivos.has(id))));
    } catch {
      this.toast.error('No se pudo cargar el estado de acceso');
    } finally {
      this.cargando.set(false);
    }
  }

  // ── Selección ───────────────────────────────────────────────────────────

  alternar(id: number): void {
    this.seleccion.update((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  alternarTodosVisibles(): void {
    const vis = this.filtrados().map((i) => i.id_publicador);
    const todos = this.todosVisiblesSeleccionados();
    this.seleccion.update((s) => {
      const n = new Set(s);
      for (const id of vis) todos ? n.delete(id) : n.add(id);
      return n;
    });
  }

  limpiarSeleccion(): void { this.seleccion.set(new Set()); }

  estaSeleccionado(id: number): boolean { return this.seleccion().has(id); }

  // ── Capas que se cierran con Escape ─────────────────────────────────────

  /**
   * Escape cierra siempre la capa más superficial. Sin esto, un modal abierto
   * solo se podía cerrar con el ratón (WCAG 2.1.2, "sin trampas de teclado").
   */
  @HostListener('document:keydown.escape')
  cerrarCapaSuperior(): void {
    if (this.menuMas()) this.menuMas.set(false);
  }

  alternarMenuMas(): void { this.menuMas.update((v) => !v); }

  /** Cierra el menú "Más" antes de ejecutar su acción, para no dejarlo
   *  abierto encima del resultado. */
  private desdeMenuMas(accion: () => void): void {
    this.menuMas.set(false);
    accion();
  }

  masSoloEnlace(): void   { this.desdeMenuMas(() => void this.generarInvitaciones()); }
  masHabilitar(): void    { this.desdeMenuMas(() => void this.habilitar(true)); }
  masNuevoPin(): void     { this.desdeMenuMas(() => void this.regenerarPines()); }
  masQuitarAcceso(): void { this.desdeMenuMas(() => this.confirmarQuitar.set(true)); }

  async confirmarQuitarAcceso(): Promise<void> {
    this.confirmarQuitar.set(false);
    await this.habilitar(false);
  }

  // ── Acciones en lote ────────────────────────────────────────────────────

  async habilitar(valor: boolean): Promise<void> {
    await this.enLote(async (ids) => {
      const r = await lastValueFrom(this.api.habilitar(ids, valor));
      if (r.afectados) {
        this.toast.success(
          valor ? 'Acceso habilitado' : 'Acceso deshabilitado',
          r.afectados === 1 ? '1 publicador' : `${r.afectados} publicadores`,
        );
      }
      if (r.detalle.length) {
        this.toast.info('Sin cambios para algunos', r.detalle.join(' '), 6000);
      }
    });
  }

  async regenerarPines(): Promise<void> {
    await this.enLote(async (ids) => {
      const r = await lastValueFrom(this.api.regenerarPines(ids));
      this.toast.success(
        'PIN regenerado',
        r.length === 1 ? `${r[0].nombre}: ${r[0].codigo_pin}` : `${r.length} publicadores`,
      );
    });
  }

  async generarInvitaciones(): Promise<void> {
    await this.enLote(async (ids) => {
      const { invitaciones, omitidos } = await lastValueFrom(this.api.generarInvitaciones(ids, 7, 'enlace'));
      if (invitaciones.length === 1) {
        this.invitacionAbierta.set(invitaciones[0]);
      } else if (invitaciones.length > 1) {
        this.colaWhatsapp.set(invitaciones.map((inv) => ({ invitacion: inv, enviado: false })));
      }
      if (invitaciones.length) {
        this.toast.success(
          'Invitaciones generadas',
          invitaciones.length === 1 ? invitaciones[0].nombre : `${invitaciones.length} enlaces, válidos 7 días`,
        );
      }
      this.avisarOmitidosPorUsuario(omitidos);
    });
  }

  async prepararWhatsapp(): Promise<void> {
    await this.enLote(async (ids) => {
      const { invitaciones, omitidos } = await lastValueFrom(this.api.generarInvitaciones(ids, 7, 'whatsapp'));
      const sinTelefono = invitaciones.filter((i) => !i.telefono).length;
      if (invitaciones.length) {
        this.colaWhatsapp.set(invitaciones.map((inv) => ({ invitacion: inv, enviado: false })));
      }
      if (sinTelefono) {
        this.toast.warning(
          'Algunos no tienen teléfono',
          `${sinTelefono} de ${invitaciones.length}: usa el enlace o el QR con ellos.`,
        );
      }
      this.avisarOmitidosPorUsuario(omitidos, 'Usa "Correo" con ellos: ya tienen cuenta.');
    });
  }

  async enviarCorreo(): Promise<void> {
    await this.enLote(async (ids) => {
      const r = await lastValueFrom(this.api.enviarCorreo(ids));
      if (r.afectados) {
        this.toast.success(
          'Invitaciones enviadas',
          r.afectados === 1 ? '1 correo' : `${r.afectados} correos`,
        );
      }
      if (r.detalle.length) {
        this.toast.warning('Algunos no se enviaron', r.detalle.join(' '), 8000);
      }
    });
  }

  /** Envuelve una acción de lote: valida selección, marca ocupado y recarga. */
  private async enLote(accion: (ids: number[]) => Promise<void>): Promise<void> {
    const ids = this.idsSeleccionados();
    if (!ids.length || this.trabajando()) return;
    this.trabajando.set(true);
    try {
      await accion(ids);
      await this.cargar();
    } catch (e: any) {
      this.toast.error('No se pudo completar', e?.error?.detail ?? undefined);
    } finally {
      this.trabajando.set(false);
    }
  }

  // ── Acciones por fila ───────────────────────────────────────────────────

  /**
   * El botón de la fila hace lo que le corresponde a esa persona: enlace con
   * PIN si no tiene cuenta, o contraseña temporal por correo si ya la tiene.
   * Así nadie tiene que saber de antemano cuál de los dos caminos usar.
   */
  async invitarUno(item: AccesoAppItem): Promise<void> {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    try {
      if (item.tiene_usuario_sistema) {
        const r = await lastValueFrom(this.api.enviarCorreo([item.id_publicador]));
        if (r.afectados) {
          this.toast.success('Acceso enviado', `Correo con contraseña temporal a ${item.nombre}`);
        } else {
          this.toast.error('No se pudo enviar', r.detalle.join(' ') || undefined);
        }
      } else {
        const { invitaciones } = await lastValueFrom(
          this.api.generarInvitaciones([item.id_publicador], 7, 'enlace'),
        );
        if (invitaciones.length) this.invitacionAbierta.set(invitaciones[0]);
      }
      await this.cargar();
    } catch (e: any) {
      this.toast.error('No se pudo completar', e?.error?.detail ?? undefined);
    } finally {
      this.trabajando.set(false);
    }
  }

  /** Aviso uniforme para los omitidos de una acción de PIN por tener ya cuenta. */
  private avisarOmitidosPorUsuario(omitidos: string[], sugerencia?: string): void {
    if (!omitidos.length) return;
    const nombres = omitidos.length <= 3 ? omitidos.join(', ') : `${omitidos.length} personas`;
    this.toast.info(
      'Ya tienen usuario del sistema',
      `${nombres} no necesitan PIN.${sugerencia ? ' ' + sugerencia : ''}`,
      6000,
    );
  }

  // ── WhatsApp ────────────────────────────────────────────────────────────

  abrirWhatsapp(p: PendienteWhatsapp): void {
    const inv = p.invitacion;
    window.open(whatsappUrl(inv.mensaje_whatsapp, this.telefonoInternacional(inv.telefono)), '_blank', 'noopener,noreferrer');
    this.colaWhatsapp.update((cola) =>
      cola.map((c) => (c.invitacion.id_invitacion === inv.id_invitacion ? { ...c, enviado: true } : c)),
    );
    this.api.marcarEnviada(inv.id_invitacion, 'whatsapp').subscribe({ error: () => {} });
  }

  /**
   * WhatsApp necesita el número en formato internacional. Los teléfonos se
   * guardan como los escribe cada quien, así que se limpia y se le antepone
   * el indicativo de Colombia a los de 10 dígitos, que es el caso normal.
   */
  private telefonoInternacional(tel: string | null): string | null {
    if (!tel) return null;
    const limpio = tel.replace(/\D/g, '');
    if (!limpio) return null;
    return limpio.length === 10 && !limpio.startsWith('57') ? `57${limpio}` : limpio;
  }

  cerrarCola(): void { this.colaWhatsapp.set([]); }

  pendientesRestantes = computed(() => this.colaWhatsapp().filter((c) => !c.enviado).length);

  // ── Modal de invitación ─────────────────────────────────────────────────

  qrSeguro(svg: string): SafeHtml {
    // El QR lo genera el backend; aun así, no se confía si trae script, manejadores o foreignObject.
    const valido = typeof svg === 'string' && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg)
      && !/<script|<foreignObject|\son\w+\s*=|javascript:/i.test(svg);
    return this.sanitizer.bypassSecurityTrustHtml(valido ? svg : '');
  }

  cerrarInvitacion(): void { this.invitacionAbierta.set(null); }

  /** Devuelve si de verdad quedó en el portapapeles. */
  async copiar(texto: string | null | undefined, etiqueta: string): Promise<boolean> {
    if (!texto) return false;
    try {
      await navigator.clipboard.writeText(texto);
      this.toast.success(`${etiqueta} copiado`);
      return true;
    } catch {
      this.toast.error(`No se pudo copiar el ${etiqueta.toLowerCase()}`);
      return false;
    }
  }

  /** Copiar el enlace casi siempre es para pegarlo en algún chat: cuenta como
   *  enviado, o la fila se quedaría en "sin enviar" para siempre. */
  async copiarEnlace(inv: InvitacionGenerada): Promise<void> {
    if (!(await this.copiar(inv.url, 'Enlace'))) return;
    this.api.marcarEnviada(inv.id_invitacion, 'enlace').subscribe({
      next: () => void this.cargar(),
      error: () => {},
    });
  }

  /** Anula un enlace ya repartido (se mandó a otra persona, se perdió el
   *  teléfono...). El PIN sigue sirviendo. */
  async anularEnlace(idInvitacion: number, nombre: string): Promise<void> {
    if (this.trabajando()) return;
    const ok = await this.confirm.ask({
      title: `¿Anular el enlace de ${nombre}?`,
      message: 'El enlace dejará de funcionar. Su PIN sigue sirviendo, y puedes generar otro enlace cuando quieras.',
      confirmLabel: 'Sí, anular',
      cancelLabel: 'Cancelar',
      severity: 'danger',
    });
    if (!ok) return;
    this.trabajando.set(true);
    try {
      await lastValueFrom(this.api.revocar(idInvitacion));
      if (this.invitacionAbierta()?.id_invitacion === idInvitacion) this.invitacionAbierta.set(null);
      this.toast.success('Enlace anulado', nombre);
      await this.cargar();
    } catch (e: any) {
      this.toast.error('No se pudo anular', e?.error?.detail ?? undefined);
    } finally {
      this.trabajando.set(false);
    }
  }

  whatsappDesdeModal(): void {
    const inv = this.invitacionAbierta();
    if (!inv) return;
    window.open(whatsappUrl(inv.mensaje_whatsapp, this.telefonoInternacional(inv.telefono)), '_blank', 'noopener,noreferrer');
    this.api.marcarEnviada(inv.id_invitacion, 'whatsapp').subscribe({ error: () => {} });
  }

  // ── Presentación ────────────────────────────────────────────────────────

  /**
   * Tailwind no ve clases construidas en tiempo de ejecución, así que los
   * cinco tonos se escriben enteros aquí para que sobrevivan al purgado.
   */
  private static readonly FONDO: Record<string, string> = {
    slate: 'bg-slate-300 dark:bg-slate-600',
    amber: 'bg-amber-400',
    sky: 'bg-sky-400',
    rose: 'bg-rose-400',
    emerald: 'bg-emerald-400',
    violet: 'bg-violet-400',
    orange: 'bg-orange-400',
  };

  /**
   * Distintivo de estado: mismo patrón que las etiquetas de sexo/grupo/
   * privilegio del listado de Publicadores (fondo -50/-900/30, texto -700/
   * -300, borde -100/-800/50). El texto viaja siempre dentro del distintivo,
   * así que el estado no depende del color para entenderse (WCAG 1.4.1) y
   * sigue siendo barrible de un vistazo.
   */
  private static readonly BADGE: Record<string, string> = {
    slate: 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800/50',
    sky: 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-800/50',
    rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-800/50',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50',
    violet: 'bg-violet-50 dark:bg-violet-900/30 text-brand-purple dark:text-violet-300 border border-violet-100 dark:border-violet-800/50',
    orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800/50',
  };

  claseFondo(tono: string): string { return AccesoAppComponent.FONDO[tono] ?? AccesoAppComponent.FONDO['slate']; }
  claseBadge(tono: string): string { return AccesoAppComponent.BADGE[tono] ?? AccesoAppComponent.BADGE['slate']; }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroGrupo.set(null);
    this.filtroEstado.set(null);
  }

  etiquetaEstado(id: EstadoAcceso): string {
    return ESTADOS.find((e) => e.id === id)?.label ?? id;
  }

  tonoEstado(id: EstadoAcceso): string {
    return ESTADOS.find((e) => e.id === id)?.tono ?? 'slate';
  }

  /**
   * Segunda línea de la fila: qué le falta o cuándo usó la app por última vez
   * y en qué dispositivo. Es la información que hace falta para decidir la
   * siguiente acción.
   */
  detalleEstado(it: AccesoAppItem): string {
    switch (it.estado_acceso) {
      case 'usuario_sistema': {
        const base = it.correo ? `Entra con ${it.correo}` : 'Entra con su correo y contraseña';
        if (it.ultima_actividad_app) return `${base} · ${this.resumenUso(it)}`;
        return `${base} · aún no ha usado la app`;
      }
      case 'sin_acceso':
        return 'El ingreso por PIN está apagado';
      case 'sin_invitacion':
        return 'Habilitado, pero nunca se le envió el enlace';
      case 'invitacion_activa': {
        const inv = it.invitacion!;
        const vence = this.fechaCorta(inv.fecha_expiracion);
        if (!inv.fecha_envio) return `Enlace listo, sin enviar · vence el ${vence}`;
        if (!inv.fecha_primer_uso) return `Enviado, aún sin abrir · vence el ${vence}`;
        return `Abrió el enlace, aún sin entrar · vence el ${vence}`;
      }
      case 'invitacion_vencida':
        return 'El último enlace venció sin usarse';
      case 'activo':
        return this.resumenUso(it) + this.enlacePendiente(it);
      case 'inactivo_app': {
        const f = it.ultima_actividad_app;
        const desde = f ? ` · última vez el ${this.fechaCorta(f, true)}` : '';
        const motivo = it.app_desinstalada
          ? 'Cerró sesión o desinstaló la app'
          : f ? `Sin usar la app desde hace ${this.diasDesde(f)} días` : 'Hace tiempo que no usa la app';
        return motivo + (it.app_desinstalada ? desde : '') + this.enlacePendiente(it);
      }
    }
  }

  /** "Usó la app hace 3 días · iOS 18.1 · v2.15.0 (desactualizada) · sin avisos" */
  private resumenUso(it: AccesoAppItem): string {
    const f = it.ultima_actividad_app;
    const partes = [f ? `Usó la app ${this.haceCuanto(f)}` : 'Ya entró a la app'];
    const disp = this.dispositivo(it.app_plataforma);
    if (disp) partes.push(disp);
    const v = AccesoAppComponent.partesVersion(it.app_version);
    if (v) {
      const max = this.versionMasNueva();
      const vieja = max && AccesoAppComponent.compararVersion(v, max) < 0;
      partes.push(`v${v.join('.')}${vieja ? ' (desactualizada)' : ''}`);
    }
    if (!it.avisos_activos) partes.push('sin avisos');
    return partes.join(' · ');
  }

  /** Un enlace vivo más nuevo que su última actividad: le mandaron uno (otro
   *  teléfono, se le cerró la sesión...) y todavía no lo ha usado. */
  private enlacePendiente(it: AccesoAppItem): string {
    const inv = it.invitacion;
    if (!inv || inv.estado_invitacion !== 'activa') return '';
    const act = it.ultima_actividad_app ? new Date(it.ultima_actividad_app).getTime() : 0;
    if (new Date(inv.fecha_creacion).getTime() <= act) return '';
    return ` · enlace nuevo sin usar, vence el ${this.fechaCorta(inv.fecha_expiracion)}`;
  }

  private dispositivo(plataforma: string | null): string | null {
    if (!plataforma) return null;
    const [so, ver] = plataforma.trim().split(/\s+/, 2);
    if (so?.toLowerCase() === 'ios') return ver ? `iOS ${ver}` : 'iOS';
    // En Android, Platform.Version es el nivel de API (34), no la versión que
    // la gente reconoce: mejor no mostrarlo.
    if (so?.toLowerCase() === 'android') return 'Android';
    return so || null;
  }

  private haceCuanto(fecha: string): string {
    const ms = Date.now() - new Date(fecha).getTime();
    const min = Math.round(ms / 60000);
    if (min < 60) return 'hace un momento';
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const horas = Math.round(min / 60);
    if (horas < 24) return rtf.format(-horas, 'hour');
    return rtf.format(-Math.round(horas / 24), 'day');
  }

  private diasDesde(fecha: string): number {
    return Math.max(1, Math.round((Date.now() - new Date(fecha).getTime()) / 86400000));
  }

  private fechaCorta(fecha: string, conAnio = false): string {
    return new Date(fecha).toLocaleDateString('es-CO', {
      day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}),
    });
  }

  /** "2.15.0 (77)" → [2, 15, 0]. */
  private static partesVersion(v: string | null): number[] | null {
    const m = v?.match(/^\s*(\d+(?:\.\d+)*)/);
    return m ? m[1].split('.').map(Number) : null;
  }

  private static compararVersion(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0);
      if (d) return d;
    }
    return 0;
  }
}

import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PrivilegiosService } from '../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../privilegios/domain/models/publicador-privilegio';
import { inicialesDe, nombreMostrado } from '../../../../core/utils/nombre.util';
import { LucideAngularModule } from '../../../../shared/icons';

interface Publicador {
   id_publicador: number;
   primer_nombre: string;
   segundo_nombre?: string | null;
   primer_apellido: string;
   segundo_apellido?: string | null;
   id_grupo_publicador?: number | null;
   id_estado_publicador?: number;
   rol?: any;
   selected?: boolean;
}

interface Grupo {
   id_grupo: number;
   nombre_grupo: string;
   capitan_grupo?: string;
}

/** Los dos paneles. Se conservan las claves que ya usaba la pantalla. */
type Panel = 'available' | 'members';

type EstadoCarga = 'cargando' | 'listo' | 'error';

/** Cambio pendiente de una persona respecto de lo guardado. */
type EstadoCambio = 'entra' | 'sale' | null;

interface EtiquetaPrivilegio {
   corto: string;
   largo: string;
   /** Grupo exclusivo del catálogo: decide el color del punto. */
   familia: 'cargo' | 'precursor';
}

/** Etiquetas que se muestran en las filas, en orden de aparición. */
const ETIQUETAS_PRIVILEGIO: Record<string, EtiquetaPrivilegio> = {
   'anciano':            { corto: 'Anciano',        largo: 'Anciano',            familia: 'cargo' },
   'siervo ministerial': { corto: 'Siervo min.',    largo: 'Siervo ministerial', familia: 'cargo' },
   'precursor especial': { corto: 'Prec. especial', largo: 'Precursor especial', familia: 'precursor' },
   'precursor regular':  { corto: 'Prec. regular',  largo: 'Precursor regular',  familia: 'precursor' },
   'precursor auxiliar': { corto: 'Prec. auxiliar', largo: 'Precursor auxiliar', familia: 'precursor' },
};
const ORDEN_ETIQUETAS = Object.keys(ETIQUETAS_PRIVILEGIO);

/** Tope que admite /api/publicador-privilegios/ por página. */
const PAGINA_PRIVILEGIOS = 500;

/** Minúsculas y sin tildes: "José" se encuentra escribiendo "jose". */
function normalizar(texto: string): string {
   return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

@Component({
   standalone: true,
   selector: 'app-formulario-asignacion',
   imports: [NgTemplateOutlet, LucideAngularModule],
   templateUrl: './formulario-asignacion.page.html',
   styleUrls: ['../../../reportes/shared/reportes-tokens.scss', './formulario-asignacion.page.scss'],
})
export class FormularioAsignacionPage implements OnInit, OnDestroy {
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private http = inject(HttpClient);
   private authStore = inject(AuthStore);
   private privilegiosService = inject(PrivilegiosService);

   grupoId: number | null = null;
   grupo = signal<Grupo | null>(null);

   // Listas de trabajo (estado local hasta pulsar Guardar)
   availablePublishers = signal<Publicador[]>([]);
   groupMembers = signal<Publicador[]>([]);

   // Privilegios
   privilegiosCatalogo = signal<Privilegio[]>([]);
   publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map()); // id_publicador -> id_privilegio[]

   // Búsqueda por panel
   busquedaDisponibles = signal('');
   busquedaMiembros = signal('');

   estadoCarga = signal<EstadoCarga>('cargando');
   saving = signal(false);
   showSuccess = signal(false);
   activeTab = signal<Panel>('available');
   liveAnnouncement = signal('');

   /** Mensaje de un guardado que falló total o parcialmente. */
   errorGuardado = signal<string | null>(null);
   /** Aviso de cambios sin guardar al intentar salir. */
   confirmarSalida = signal(false);
   /** Ids recién movidos: su fila destella una vez en el panel de destino. */
   recienMovidos = signal<ReadonlySet<number>>(new Set());

   /** Grupo guardado de cada publicador cargado: base para detectar cambios. */
   initialMap = signal<Map<number, number | null>>(new Map());

   private temporizadores: ReturnType<typeof setTimeout>[] = [];

   // ── Derivados ─────────────────────────────────────────────────────────

   filteredAvailable = computed(() => this.filtrar(this.availablePublishers(), this.busquedaDisponibles()));
   filteredGroupMembers = computed(() => this.filtrar(this.groupMembers(), this.busquedaMiembros()));

   seleccionDisponibles = computed(() => this.availablePublishers().filter(p => p.selected).length);
   seleccionMiembros = computed(() => this.groupMembers().filter(p => p.selected).length);
   hasAvailableSelected = computed(() => this.seleccionDisponibles() > 0);
   hasMembersSelected = computed(() => this.seleccionMiembros() > 0);

   /** Personas cuyo grupo actual difiere del guardado. */
   cambios = computed(() => {
      const inicial = this.initialMap();
      return [...this.availablePublishers(), ...this.groupMembers()].filter(
         p => (inicial.get(p.id_publicador) ?? null) !== (p.id_grupo_publicador ?? null)
      );
   });
   totalCambios = computed(() => this.cambios().length);

   /** Etiquetas de privilegio por publicador, calculadas una sola vez por carga. */
   etiquetasPorPublicador = computed(() => {
      const nombrePorId = new Map(
         this.privilegiosCatalogo().map(pr => [pr.id_privilegio, normalizar(pr.nombre_privilegio)])
      );
      const resultado = new Map<number, EtiquetaPrivilegio[]>();
      for (const [idPublicador, ids] of this.publicadorPrivilegiosMap()) {
         const claves = ids
            .map(id => nombrePorId.get(id))
            .filter((n): n is string => !!n && n in ETIQUETAS_PRIVILEGIO)
            .sort((a, b) => ORDEN_ETIQUETAS.indexOf(a) - ORDEN_ETIQUETAS.indexOf(b));
         if (claves.length) resultado.set(idPublicador, claves.map(c => ETIQUETAS_PRIVILEGIO[c]));
      }
      return resultado;
   });

   // ── Ciclo de vida ─────────────────────────────────────────────────────

   ngOnInit() {
      this.route.paramMap.subscribe(params => {
         const id = params.get('id');
         if (id) {
            this.grupoId = +id;
            this.loadData();
         }
      });
   }

   ngOnDestroy() {
      this.temporizadores.forEach(clearTimeout);
   }

   /** Cerrar la pestaña o recargar con cambios pendientes pide confirmación al navegador. */
   @HostListener('window:beforeunload', ['$event'])
   avisarAntesDeSalir(evento: BeforeUnloadEvent) {
      if (this.totalCambios() > 0 && !this.saving()) {
         evento.preventDefault();
      }
   }

   // ── Carga ─────────────────────────────────────────────────────────────

   async loadData() {
      if (!this.grupoId) return;
      this.estadoCarga.set('cargando');
      this.errorGuardado.set(null);
      try {
         const params: Record<string, string | number> = { skip: 0, limit: 1000 };
         const idCongregacion = this.authStore.user()?.id_congregacion;
         if (idCongregacion) params['id_congregacion'] = idCongregacion;

         const [grupoRes, allPubs, privilegiosData] = await Promise.all([
            lastValueFrom(this.http.get<Grupo>(`/api/grupos/${this.grupoId}`)),
            lastValueFrom(this.http.get<Publicador[]>('/api/publicadores/', { params })),
            lastValueFrom(this.privilegiosService.getPrivilegios()),
         ]);

         this.grupo.set(grupoRes);
         this.privilegiosCatalogo.set(privilegiosData || []);
         await this.loadAllPublicadorPrivilegios(idCongregacion ?? null);

         const inicial = new Map<number, number | null>();
         const members: Publicador[] = [];
         const available: Publicador[] = [];
         for (const p of allPubs || []) {
            const grupoActual = p.id_grupo_publicador != null ? Number(p.id_grupo_publicador) : null;
            inicial.set(p.id_publicador, grupoActual);
            if (grupoActual === Number(this.grupoId)) {
               members.push({ ...p, id_grupo_publicador: grupoActual, selected: false });
            } else if (grupoActual === null) {
               available.push({ ...p, id_grupo_publicador: null, selected: false });
            }
         }

         this.initialMap.set(inicial);
         this.groupMembers.set(members);
         this.availablePublishers.set(available);
         this.estadoCarga.set('listo');
      } catch (err) {
         console.error(err);
         this.estadoCarga.set('error');
      }
   }

   /**
    * Trae todos los privilegios vigentes paginando. Antes se pedía una sola
    * página de 500 filas y, pasado ese número, los publicadores del final se
    * quedaban sin etiquetas. Si falla, la pantalla sigue sin etiquetas.
    */
   async loadAllPublicadorPrivilegios(idCongregacion: number | null) {
      try {
         const mapa = new Map<number, number[]>();
         for (let offset = 0; ; offset += PAGINA_PRIVILEGIOS) {
            const params: Record<string, string | number | boolean> = {
               limit: PAGINA_PRIVILEGIOS, offset, activos: true,
            };
            if (idCongregacion != null) params['id_congregacion'] = idCongregacion;
            const pagina = await lastValueFrom(
               this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/', { params })
            ) || [];
            for (const pp of pagina) {
               const lista = mapa.get(pp.id_publicador) ?? [];
               lista.push(pp.id_privilegio);
               mapa.set(pp.id_publicador, lista);
            }
            if (pagina.length < PAGINA_PRIVILEGIOS) break;
         }
         this.publicadorPrivilegiosMap.set(mapa);
      } catch (err) {
         console.error('Error cargando privilegios de publicadores', err);
      }
   }

   // ── Consultas para la plantilla ───────────────────────────────────────

   listaDe(panel: Panel): Publicador[] {
      return panel === 'available' ? this.filteredAvailable() : this.filteredGroupMembers();
   }

   totalDe(panel: Panel): number {
      return panel === 'available' ? this.availablePublishers().length : this.groupMembers().length;
   }

   seleccionDe(panel: Panel): number {
      return panel === 'available' ? this.seleccionDisponibles() : this.seleccionMiembros();
   }

   busquedaDe(panel: Panel): string {
      return panel === 'available' ? this.busquedaDisponibles() : this.busquedaMiembros();
   }

   setBusqueda(panel: Panel, valor: string) {
      (panel === 'available' ? this.busquedaDisponibles : this.busquedaMiembros).set(valor);
   }

   /** Estado del "seleccionar todos" sobre lo que se ve (respeta la búsqueda). */
   estadoTodos(panel: Panel): 'ninguno' | 'algunos' | 'todos' {
      const visibles = this.listaDe(panel);
      const marcados = visibles.filter(p => p.selected).length;
      if (marcados === 0) return 'ninguno';
      return marcados === visibles.length ? 'todos' : 'algunos';
   }

   estadoCambio(p: Publicador): EstadoCambio {
      const inicial = this.initialMap().get(p.id_publicador) ?? null;
      const actual = p.id_grupo_publicador ?? null;
      if (inicial === actual) return null;
      return actual === this.grupoId ? 'entra' : 'sale';
   }

   etiquetasDe(p: Publicador): EtiquetaPrivilegio[] {
      return this.etiquetasPorPublicador().get(p.id_publicador) ?? [];
   }

   getFullName(p: Publicador): string {
      return nombreMostrado(p);
   }

   getInitials(p: Publicador): string {
      return inicialesDe(p);
   }

   plural(n: number, singular: string, pluralForma: string): string {
      return `${n} ${n === 1 ? singular : pluralForma}`;
   }

   // ── Selección ─────────────────────────────────────────────────────────

   toggleSelection(p: Publicador) {
      const alternar = (lista: Publicador[]) =>
         lista.map(x => x.id_publicador === p.id_publicador ? { ...x, selected: !x.selected } : x);
      if (this.availablePublishers().some(x => x.id_publicador === p.id_publicador)) {
         this.availablePublishers.update(alternar);
      } else {
         this.groupMembers.update(alternar);
      }
   }

   toggleSelectAll(panel: Panel) {
      const visibles = new Set(this.listaDe(panel).map(p => p.id_publicador));
      if (visibles.size === 0) return;
      const nuevoEstado = this.estadoTodos(panel) !== 'todos';
      const aplicar = (lista: Publicador[]) =>
         lista.map(p => visibles.has(p.id_publicador) ? { ...p, selected: nuevoEstado } : p);
      (panel === 'available' ? this.availablePublishers : this.groupMembers).update(aplicar);
   }

   limpiarBusqueda(panel: Panel) {
      this.setBusqueda(panel, '');
   }

   // ── Mover entre paneles ───────────────────────────────────────────────

   moveToGroup() {
      const seleccion = this.availablePublishers().filter(p => p.selected);
      if (!seleccion.length) return;
      const movidos = seleccion.map(p => ({ ...p, selected: false, id_grupo_publicador: this.grupoId }));

      this.availablePublishers.update(lista => lista.filter(p => !p.selected));
      this.groupMembers.update(lista => [...lista, ...movidos]);
      this.marcarRecienMovidos(movidos);

      const n = movidos.length;
      this.liveAnnouncement.set(`${n} publicador${n !== 1 ? 'es' : ''} agregado${n !== 1 ? 's' : ''} al grupo. Falta guardar.`);
   }

   moveToAvailable() {
      const seleccion = this.groupMembers().filter(p => p.selected);
      if (!seleccion.length) return;
      const movidos = seleccion.map(p => ({ ...p, selected: false, id_grupo_publicador: null }));

      this.groupMembers.update(lista => lista.filter(p => !p.selected));
      this.availablePublishers.update(lista => [...lista, ...movidos]);
      this.marcarRecienMovidos(movidos);

      const n = movidos.length;
      this.liveAnnouncement.set(`${n} publicador${n !== 1 ? 'es' : ''} quitado${n !== 1 ? 's' : ''} del grupo. Falta guardar.`);
   }

   /** En móvil, mover lleva al panel de destino para ver el resultado. */
   moverDesdeBarra() {
      if (this.activeTab() === 'available') {
         this.moveToGroup();
         this.activeTab.set('members');
      } else {
         this.moveToAvailable();
         this.activeTab.set('available');
      }
   }

   private marcarRecienMovidos(movidos: Publicador[]) {
      this.recienMovidos.set(new Set(movidos.map(p => p.id_publicador)));
      this.temporizadores.push(setTimeout(() => this.recienMovidos.set(new Set()), 1000));
   }

   /** Devuelve las dos listas a lo que está guardado. */
   descartarCambios() {
      const inicial = this.initialMap();
      const todos = [...this.availablePublishers(), ...this.groupMembers()].map(p => ({
         ...p, selected: false, id_grupo_publicador: inicial.get(p.id_publicador) ?? null,
      }));
      this.groupMembers.set(todos.filter(p => p.id_grupo_publicador === this.grupoId));
      this.availablePublishers.set(todos.filter(p => p.id_grupo_publicador === null));
      this.errorGuardado.set(null);
      this.confirmarSalida.set(false);
      this.liveAnnouncement.set('Cambios descartados.');
   }

   // ── Guardar ───────────────────────────────────────────────────────────

   /**
    * Guarda cada cambio con su PUT. Con allSettled se sabe qué se guardó y qué
    * no: antes, si fallaba uno, los demás ya estaban guardados pero la pantalla
    * solo decía "Error guardando cambios" y los seguía mostrando como pendientes.
    */
   async save() {
      const modificados = this.cambios();
      if (modificados.length === 0 || this.saving()) return;

      this.saving.set(true);
      this.errorGuardado.set(null);
      try {
         const resultados = await Promise.allSettled(modificados.map(p =>
            lastValueFrom(this.http.put(`/api/publicadores/${p.id_publicador}`, {
               id_grupo_publicador: p.id_grupo_publicador ?? null,
            }))
         ));

         // Lo que sí se guardó pasa a ser la nueva base.
         const base = new Map(this.initialMap());
         const fallidos: Publicador[] = [];
         resultados.forEach((r, i) => {
            const p = modificados[i];
            if (r.status === 'fulfilled') base.set(p.id_publicador, p.id_grupo_publicador ?? null);
            else fallidos.push(p);
         });
         this.initialMap.set(base);

         if (fallidos.length === 0) {
            this.confirmarSalida.set(false);
            this.showSuccess.set(true);
            this.liveAnnouncement.set('Asignación guardada.');
            this.temporizadores.push(setTimeout(() => this.goBack(), 1500));
            return;
         }

         const nombres = fallidos.slice(0, 3).map(p => this.getFullName(p)).join(', ');
         const resto = fallidos.length > 3 ? ` y ${fallidos.length - 3} más` : '';
         const guardados = modificados.length - fallidos.length;
         this.errorGuardado.set(
            guardados > 0
               ? `Se guardaron ${guardados} de ${modificados.length} cambios. Faltan: ${nombres}${resto}. Pulsa «Reintentar» para guardarlos.`
               : `No se pudo guardar ningún cambio. Revisa la conexión y pulsa «Reintentar».`
         );
         this.confirmarSalida.set(false);
      } finally {
         this.saving.set(false);
      }
   }

   // ── Navegación ────────────────────────────────────────────────────────

   /** "Volver" con cambios pendientes avisa en vez de descartarlos en silencio. */
   volver() {
      if (this.totalCambios() > 0) {
         this.confirmarSalida.set(true);
         return;
      }
      this.goBack();
   }

   salirSinGuardar() {
      this.confirmarSalida.set(false);
      this.goBack();
   }

   goBack() {
      this.router.navigate(['/secretario/publicadores'], { queryParams: { tab: 'grupos' } });
   }

   // ── Internos ──────────────────────────────────────────────────────────

   /**
    * Filtra por nombre y ordena: primero los cambios sin guardar (así quien
    * acaba de mover a alguien lo ve arriba, con su etiqueta "Se agrega" o
    * "Sale del grupo"), luego alfabético.
    */
   private filtrar(lista: Publicador[], busqueda: string): Publicador[] {
      const termino = normalizar(busqueda);
      const inicial = this.initialMap();
      const pendiente = (p: Publicador) =>
         (inicial.get(p.id_publicador) ?? null) !== (p.id_grupo_publicador ?? null) ? 0 : 1;
      return lista
         .filter(p => !termino || normalizar(this.getFullName(p)).includes(termino))
         .sort((a, b) =>
            pendiente(a) - pendiente(b) ||
            this.getFullName(a).localeCompare(this.getFullName(b), 'es', { sensitivity: 'base' }));
   }
}

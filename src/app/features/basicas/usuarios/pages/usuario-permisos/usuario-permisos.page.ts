import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { trigger, transition, style, animate, state } from '@angular/animations';

import { PermisosService, PermisoConEstado } from '../../services/permisos.service';
import { UsuariosService } from '../../services/usuarios.service';
import { Usuario } from '../../models/usuario.model';
import { AuthStore } from '../../../../../core/auth/auth.store';

// Permisos que Coordinador/Secretario no pueden otorgar
const PERMISOS_RESTRINGIDOS_CONG = new Set(['publicadores.editar']);

type Tema = 'amber' | 'purple' | 'emerald' | 'blue' | 'slate';

// Clases literales por tema para los elementos que llevan el color del módulo.
// Se escriben completas (nada de `bg-${tema}-500`) porque Tailwind rastrea
// texto: una clase compuesta en tiempo de ejecución no genera CSS.
//
// 'segmento', 'panel' y 'panelTitulo' reproducen el panel de alcance que ya
// usaban informes.editar y publicadores.ver, teñido con el color del módulo en
// vez de violeta fijo.
const ACENTOS: Record<Tema, {
   segmento: string; estadoSuave: string; estadoFuerte: string;
   cabecera: string; panel: string; panelTitulo: string;
}> = {
   amber: {
      segmento: 'bg-amber-500 text-white shadow-sm',
      estadoSuave: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-200/70 dark:ring-amber-500/25',
      estadoFuerte: 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100 ring-amber-300/70 dark:ring-amber-500/40',
      cabecera: 'text-amber-700 dark:text-amber-300',
      panel: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30',
      panelTitulo: 'text-amber-700 dark:text-amber-400'
   },
   purple: {
      segmento: 'bg-purple-600 text-white shadow-sm',
      estadoSuave: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-200/70 dark:ring-purple-500/25',
      estadoFuerte: 'bg-purple-100 dark:bg-purple-500/20 text-purple-900 dark:text-purple-100 ring-purple-300/70 dark:ring-purple-500/40',
      cabecera: 'text-purple-700 dark:text-purple-300',
      panel: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/30',
      panelTitulo: 'text-purple-700 dark:text-purple-400'
   },
   emerald: {
      segmento: 'bg-emerald-500 text-white shadow-sm',
      estadoSuave: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200/70 dark:ring-emerald-500/25',
      estadoFuerte: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 ring-emerald-300/70 dark:ring-emerald-500/40',
      cabecera: 'text-emerald-700 dark:text-emerald-300',
      panel: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30',
      panelTitulo: 'text-emerald-700 dark:text-emerald-400'
   },
   blue: {
      segmento: 'bg-blue-500 text-white shadow-sm',
      estadoSuave: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-200/70 dark:ring-blue-500/25',
      estadoFuerte: 'bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-100 ring-blue-300/70 dark:ring-blue-500/40',
      cabecera: 'text-blue-700 dark:text-blue-300',
      panel: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30',
      panelTitulo: 'text-blue-700 dark:text-blue-400'
   },
   slate: {
      segmento: 'bg-slate-600 text-white shadow-sm',
      estadoSuave: 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 ring-slate-200/70 dark:ring-slate-600/50',
      estadoFuerte: 'bg-slate-200 dark:bg-slate-600/50 text-slate-900 dark:text-slate-100 ring-slate-300/70 dark:ring-slate-500/50',
      cabecera: 'text-slate-700 dark:text-slate-300',
      panel: 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700',
      panelTitulo: 'text-slate-600 dark:text-slate-400'
   }
};

// Constante a nivel de modulo: la plantilla llama a getCategoryTheme 70 veces
// por ciclo de deteccion de cambios y antes se construia este objeto entero en
// cada llamada.
const TEMAS_POR_CATEGORIA: Record<string, Tema> = {
   'Publicadores': 'amber',
   'Grupos': 'amber',
   'Informes': 'purple',
   'Territorios': 'emerald',
   'Reuniones': 'purple',
   'Exhibidores': 'blue',
   'Reportes': 'blue',
   'Tareas': 'emerald'
};

// Orden en el que se listan las tarjetas de modulo.
const ORDEN_CATEGORIAS = [
   'Publicadores',
   'Informes',
   'Reportes',
   'Territorios',
   'Reuniones',
   'Exhibidores',
   'Tareas'
];

/**
 * Una pestaña del modulo con sus permisos ya emparejados.
 *
 * 'alcance' no es una capacidad sino el radio de accion de la pantalla: cuando
 * esta otorgado el usuario ve toda la congregacion, y cuando no, solo su propio
 * grupo de predicacion. Por eso se dibuja como selector y no como interruptor.
 */
interface PantallaPermisos {
   nombre: string;
   icono: SafeHtml;
   ver?: PermisoConEstado;
   editar?: PermisoConEstado;
   alcance?: PermisoConEstado;
}

interface CategoriaPermisos {
   categoria: string;
   icono: SafeHtml;
   /** Bloques por pestaña (Publicadores, Informes). */
   pantallas: PantallaPermisos[];
   /** Permisos que no pertenecen a ninguna pantalla: se pintan como interruptores sueltos. */
   sueltos: PermisoConEstado[];
   /** Todos los permisos de la categoria que cuentan para el contador (excluye alcances). */
   contables: PermisoConEstado[];
   expandido: boolean;
}

@Component({
   selector: 'app-usuario-permisos',
   standalone: true,
   imports: [CommonModule, FormsModule, RouterLink],
   animations: [
      trigger('fadeIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(8px)' }),
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
         ])
      ]),
      trigger('expandCollapse', [
         state('collapsed', style({ height: '0', opacity: 0, overflow: 'hidden' })),
         state('expanded', style({ height: '*', opacity: 1 })),
         transition('collapsed <=> expanded', animate('250ms ease-in-out'))
      ]),
      trigger('slideUp', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(20px)' }),
            animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
         ]),
         transition(':leave', [
            animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(20px)' }))
         ])
      ]),
      // El selector de alcance aparece al encender "Ver". Solo transform y
      // opacity para que el navegador no tenga que recalcular el layout.
      trigger('revealScope', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(-4px)' }),
            animate('180ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
         ])
      ])
   ],
   templateUrl: './usuario-permisos.page.html',
   styles: [`
      /* ── Reparto del ancho al desplegar una tarjeta ────────────────────────
         Una tarjeta desplegada ocupa las dos columnas de la rejilla, pero su
         contenido seguía siendo una lista de una sola columna: a 1440px cada
         fila medía 1076px y dejaba 744px muertos entre el nombre del permiso y
         su interruptor, en el borde opuesto de la pantalla.

         Las celdas se reparten ahora en tantas columnas como quepan, sin
         breakpoints: la rejilla se mide a sí misma. Una tarjeta plegada da 1
         columna, desplegada a 1440px da 2 y a 1920px da 3, y cada columna
         conserva el ancho de ~520px con el que la fila se lee bien.

         'min(26rem, 100%)' es lo que evita que en móvil la columna intente
         medir 416px dentro de un contenedor de 335 y se salga. */
      .perm-grid {
         display: grid;
         grid-template-columns: repeat(auto-fit, minmax(min(26rem, 100%), 1fr));
         gap: 1px;
      }

      /* Los separadores son el fondo de la rejilla asomando por el hueco de 1px.
         Así salen líneas perfectas entre filas y entre columnas sin tener que
         saber cuántas columnas hay, que es justo lo que auto-fit no deja saber
         desde CSS. Los colores los pone Tailwind en la plantilla. */

      /* ── Altura de los controles pequeños ─────────────────────────────────
         Por defecto 44px, el mínimo cómodo para el dedo. Se compactan solo si
         el dispositivo tiene puntero fino (ratón o trackpad).

         Antes esto dependía del breakpoint 'sm' (640px), y eso deja fuera justo
         a los dispositivos que más lo necesitan: un iPad en vertical mide 768px
         y es táctil, así que recibía botones de 32px. Al revés también falla:
         un portátil táctil de 1440px se queda sin área cómoda. La consulta
         correcta es la capacidad de entrada, no el ancho. */
      .ctl-compacta, .ctl-media { height: 2.75rem; }

      @media (pointer: fine) {
         .ctl-compacta { height: 2rem; }
         .ctl-media { height: 2.25rem; }
      }

      /* ── Poco alto disponible (móvil en horizontal) ───────────────────────
         Con 390px de alto, la miga de pan + el título + la barra de acciones se
         comían 262px y dejaban la lista de permisos en 128px: menos de dos
         filas. Aquí el encabezado se reduce a lo que aporta contexto —quién es
         el usuario y cómo volver— y el resto cede el sitio a la lista. */
      @media (max-height: 32rem) {
         .nav-volver { display: none; }
         .bloque-titulo { display: none; }

         /* En horizontal sobra ancho y falta alto, así que las dos tarjetas del
            encabezado dejan de apilarse y se reparten la línea. */
         .cabecera-pagina {
            flex-direction: row;
            flex-wrap: wrap;
            align-items: stretch;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
         }
         .cabecera-pagina > .tarjeta-encabezado,
         .cabecera-pagina > .barra-herramientas {
            flex: 1 1 20rem;
            padding: 0.5rem 0.75rem;
            display: flex;
            align-items: center;
         }
         .cabecera-pagina > .tarjeta-encabezado { flex-wrap: wrap; gap: 0 0.75rem; }
         .cabecera-pagina > .barra-herramientas > * { width: 100%; }

         /* El enlace compacto de volver vive dentro de la tarjeta y normalmente
            solo sale en móvil ('sm:hidden'). Al ocultar la miga de pan hay que
            recuperarlo o el usuario se queda sin salida; de ahí el !important,
            que es lo único capaz de ganarle a la utilidad de Tailwind. */
         .volver-compacto { display: flex !important; margin-bottom: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
         .perm-grid, .perm-cell { transition: none !important; }
      }
   `]
})
export class UsuarioPermisosPage implements OnInit {
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private permisosService = inject(PermisosService);
   private usuariosService = inject(UsuariosService);
   private sanitizer = inject(DomSanitizer);
   private authStore = inject(AuthStore);

   /** Coordinador/Secretario tienen restricciones sobre qué permisos pueden otorgar */
   readonly esCongRole = computed(() => {
      const user = this.authStore.user();
      const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
      return roles.some(r => ['coordinador', 'secretario'].includes(r));
   });

   /** Devuelve true si el permiso NO puede ser modificado por el usuario actual */
   isPermisoRestringido(codigo: string): boolean {
      return this.esCongRole() && PERMISOS_RESTRINGIDOS_CONG.has(codigo);
   }

   loading = signal(true);
   saving = signal(false);
   showSuccess = signal(false);
   showError = signal(false);
   searchQuery = '';

   usuario = signal<Usuario | null>(null);
   permisos = signal<PermisoConEstado[]>([]);
   permisosOriginales = signal<Set<number>>(new Set());
   categoriasExpandidas = signal<Set<string>>(new Set());

   categorias = computed<CategoriaPermisos[]>(() => {
      const porCategoria = new Map<string, PermisoConEstado[]>();

      for (const p of this.permisos()) {
         // 'modulo' reúne categorías que en la app son pestañas del mismo sitio
         // (Publicadores + Grupos + Contactos). Si el permiso no lo trae, se
         // cae al nombre derivado del prefijo del código, como antes.
         const catKey = p.modulo || this.getCategoriaNombre(p.codigo);
         const lista = porCategoria.get(catKey);
         if (lista) lista.push(p);
         else porCategoria.set(catKey, [p]);
      }

      const expandidas = this.categoriasExpandidas();

      return Array.from(porCategoria.entries())
         .sort(([a], [b]) => {
            const indexA = ORDEN_CATEGORIAS.indexOf(a);
            const indexB = ORDEN_CATEGORIAS.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
         })
         .map(([cat, permisos]) => {
            const pantallas = this.agruparPorPantalla(permisos);
            return {
               categoria: cat,
               icono: this.getCategoryIcon(cat),
               pantallas,
               sueltos: permisos.filter(p => !p.pantalla),
               // Los alcances no son capacidades: contarlos haría que "3 de 5"
               // no coincidiera con los interruptores que se ven en pantalla.
               contables: permisos.filter(p => p.accion !== 'alcance'),
               expandido: expandidas.has(cat)
            };
         });
   });

   /**
    * Empareja los permisos de una misma pestaña en un solo bloque, conservando
    * el orden en el que llegan del backend (categoria, orden).
    */
   private agruparPorPantalla(permisos: PermisoConEstado[]): PantallaPermisos[] {
      const porPantalla = new Map<string, PantallaPermisos>();

      for (const p of permisos) {
         if (!p.pantalla) continue;

         let bloque = porPantalla.get(p.pantalla);
         if (!bloque) {
            bloque = { nombre: p.pantalla, icono: this.getPantallaIcon(p.pantalla) };
            porPantalla.set(p.pantalla, bloque);
         }

         if (p.accion === 'editar') bloque.editar = p;
         else if (p.accion === 'alcance') bloque.alcance = p;
         else bloque.ver = p;
      }

      return Array.from(porPantalla.values());
   }

   filteredCategorias = computed(() => {
      const query = this.searchQuery.toLowerCase().trim();
      if (!query) return this.categorias();

      const coincide = (p?: PermisoConEstado) => !!p && (
         p.nombre.toLowerCase().includes(query) ||
         (p.descripcion?.toLowerCase().includes(query) ?? false) ||
         p.codigo.toLowerCase().includes(query)
      );

      return this.categorias()
         .map(cat => ({
            ...cat,
            // Una pantalla entra entera si coincide su nombre o cualquiera de
            // sus permisos: partir el bloque dejaría un "Editar" sin su "Ver".
            pantallas: cat.pantallas.filter(pan =>
               pan.nombre.toLowerCase().includes(query) ||
               coincide(pan.ver) || coincide(pan.editar) || coincide(pan.alcance)
            ),
            sueltos: cat.sueltos.filter(coincide),
            expandido: true
         }))
         .filter(cat => cat.pantallas.length > 0 || cat.sueltos.length > 0);
   });

   totalAsignados = computed(() =>
      this.permisos().filter(p => p.asignado && p.accion !== 'alcance').length
   );
   totalPermisos = computed(() => this.permisos().filter(p => p.accion !== 'alcance').length);

   hasChanges = computed(() => {
      const originales = this.permisosOriginales();
      const actuales = this.idsActivos();

      if (originales.size !== actuales.size) return true;
      for (const id of originales) {
         if (!actuales.has(id)) return true;
      }
      return false;
   });

   changesCount = computed(() => {
      const originales = this.permisosOriginales();
      const actuales = this.idsActivos();

      let count = 0;
      for (const id of originales) {
         if (!actuales.has(id)) count++;
      }
      for (const id of actuales) {
         if (!originales.has(id)) count++;
      }
      return count;
   });

   /**
    * Lo que se enviará al guardar. Los alcances viajan como un permiso más: su
    * `asignado` es directamente la opción "toda la congregación" del selector,
    * así que no hace falta reconstruir nada aparte.
    */
   private idsActivos(): Set<number> {
      return new Set(this.permisos().filter(p => p.asignado).map(p => p.id_permiso));
   }

   async ngOnInit() {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (!id) {
         this.router.navigate(['/usuarios']);
         return;
      }

      await this.loadData(id);
   }

   async loadData(idUsuario: number) {
      this.loading.set(true);
      try {
         const [usuarios, permisos] = await Promise.all([
            lastValueFrom(this.usuariosService.getUsuarios()),
            lastValueFrom(this.permisosService.getPermisosUsuario(idUsuario))
         ]);

         const usuario = usuarios.find(u => u.id_usuario === idUsuario);
         if (!usuario) {
            this.router.navigate(['/usuarios']);
            return;
         }

         // Un alcance sin su "Ver" encendido no significa nada: el backend
         // nunca llega a consultarlo. Se normaliza al cargar para que la
         // pantalla no muestre un radio de acción que en realidad no aplica.
         const verPorPantalla = new Map<string, boolean>();
         for (const p of permisos) {
            if (p.accion === 'ver' && p.pantalla) {
               verPorPantalla.set(`${p.modulo}:${p.pantalla}`, p.asignado);
            }
         }
         for (const p of permisos) {
            if (p.accion === 'alcance' && p.pantalla && !verPorPantalla.get(`${p.modulo}:${p.pantalla}`)) {
               p.asignado = false;
            }
         }

         this.usuario.set(usuario);
         this.permisos.set(permisos);
         this.permisosOriginales.set(this.idsActivos());
         this.categoriasExpandidas.set(new Set<string>());
      } catch (err: any) {
         // El backend restringe esta pantalla a los usuarios bajo el alcance de
         // quien la abre: misma congregación y rol bajo su mando. Llegando por
         // URL a cualquier otro responde 403, y sin este caso la pantalla se
         // quedaba en blanco sin explicar nada. Se vuelve al listado, igual que
         // cuando el usuario no existe.
         if (err?.status === 403 || err?.status === 404) {
            this.router.navigate(['/usuarios']);
            return;
         }
         console.error('Error loading data', err);
      } finally {
         this.loading.set(false);
      }
   }

   toggleCategoria(cat: CategoriaPermisos) {
      this.categoriasExpandidas.update(set => {
         const newSet = new Set(set);
         if (newSet.has(cat.categoria)) newSet.delete(cat.categoria);
         else newSet.add(cat.categoria);
         return newSet;
      });
   }

   /** Aplica un cambio de estado a un conjunto de permisos por id. */
   private setAsignado(ids: Set<number>, valor: boolean) {
      this.permisos.update(list =>
         list.map(p => ids.has(p.id_permiso) ? { ...p, asignado: valor } : p)
      );
   }

   togglePermiso(permiso: PermisoConEstado) {
      if (this.isPermisoRestringido(permiso.codigo)) return;
      this.setAsignado(new Set([permiso.id_permiso]), !permiso.asignado);
   }

   /**
    * Un interruptor del bloque está bloqueado si su propio permiso es de los que
    * este rol no puede otorgar, o —en el caso de Ver— si apagarlo dejaría
    * encendido un Editar que tampoco puede volver a encender. Quitar la lectura
    * en ese caso apagaría la edición sin vuelta atrás, y dejarla encendida sin
    * lectura describiría un acceso que la app no concede.
    */
   estaBloqueado(pan: PantallaPermisos, accion: 'ver' | 'editar'): boolean {
      const objetivo = accion === 'ver' ? pan.ver : pan.editar;
      if (!objetivo) return false;
      if (this.isPermisoRestringido(objetivo.codigo)) return true;

      return accion === 'ver'
         && !!objetivo.asignado
         && !!pan.editar?.asignado
         && this.isPermisoRestringido(pan.editar.codigo);
   }

   tituloFila(permiso: PermisoConEstado, pan?: PantallaPermisos, accion?: 'ver' | 'editar'): string {
      if (this.isPermisoRestringido(permiso.codigo)) {
         return 'No tienes permiso para otorgar este acceso';
      }
      if (pan && accion && this.estaBloqueado(pan, accion)) {
         return 'Este usuario tiene un permiso de edición que tú no puedes modificar; quitarle la lectura lo dejaría en un estado que no podrías deshacer';
      }
      return permiso.descripcion || permiso.nombre;
   }

   /**
    * Ver y Editar de una misma pantalla no son independientes: editar sin poder
    * ver no existe, y quitar la lectura tiene que arrastrar todo lo demás. El
    * alcance también se apaga al cerrar la pantalla para no dejar guardado un
    * radio de acción invisible.
    */
   togglePantalla(pan: PantallaPermisos, accion: 'ver' | 'editar') {
      const objetivo = accion === 'ver' ? pan.ver : pan.editar;
      if (!objetivo || this.estaBloqueado(pan, accion)) return;

      const encender = !objetivo.asignado;
      const encendidos = new Set<number>();
      const apagados = new Set<number>();

      if (accion === 'editar') {
         if (encender) {
            encendidos.add(objetivo.id_permiso);
            // Editar implica ver: es la dependencia que antes había que recordar
            // marcando dos casillas sueltas en el orden correcto.
            if (pan.ver) encendidos.add(pan.ver.id_permiso);
         } else {
            apagados.add(objetivo.id_permiso);
         }
      } else if (encender) {
         encendidos.add(objetivo.id_permiso);
      } else {
         apagados.add(objetivo.id_permiso);
         if (pan.editar) apagados.add(pan.editar.id_permiso);
         if (pan.alcance) apagados.add(pan.alcance.id_permiso);
      }

      this.permisos.update(list =>
         list.map(p => {
            if (encendidos.has(p.id_permiso)) return { ...p, asignado: true };
            if (apagados.has(p.id_permiso)) return { ...p, asignado: false };
            return p;
         })
      );
   }

   /** El selector de alcance: true = toda la congregación, false = solo su grupo. */
   setAlcance(pan: PantallaPermisos, todaLaCongregacion: boolean) {
      if (!pan.alcance) return;
      this.setAsignado(new Set([pan.alcance.id_permiso]), todaLaCongregacion);
   }

   /** Ids de una categoría que este usuario sí puede modificar. */
   private idsOtorgables(cat: CategoriaPermisos): Set<number> {
      const ids = new Set<number>();
      const agregar = (p?: PermisoConEstado) => {
         if (p && !this.isPermisoRestringido(p.codigo)) ids.add(p.id_permiso);
      };
      for (const pan of cat.pantallas) {
         agregar(pan.ver);
         agregar(pan.editar);
         agregar(pan.alcance);
      }
      cat.sueltos.forEach(agregar);
      return ids;
   }

   toggleCategoriaTodos(cat: CategoriaPermisos, value: boolean) {
      this.setAsignado(this.idsOtorgables(cat), value);
   }

   /**
    * Los permisos que este usuario no puede otorgar se saltan en vez de
    * marcarse: enviarlos haría que el backend rechazara el guardado entero con
    * un 403, perdiendo también los cambios legítimos.
    */
   toggleTodos(value: boolean) {
      const ids = new Set<number>();
      for (const cat of this.categorias()) {
         for (const id of this.idsOtorgables(cat)) ids.add(id);
      }
      this.setAsignado(ids, value);
   }

   async guardar() {
      if (this.saving() || !this.usuario()) return;

      this.saving.set(true);
      try {
         const activeIds = Array.from(this.idsActivos());

         await lastValueFrom(
            this.permisosService.updatePermisosUsuario(this.usuario()!.id_usuario!, activeIds)
         );

         this.permisosOriginales.set(new Set(activeIds));

         this.showSuccess.set(true);
         setTimeout(() => this.showSuccess.set(false), 4000);
      } catch (err) {
         console.error('Error saving permissions', err);
         this.showError.set(true);
         setTimeout(() => this.showError.set(false), 4000);
      } finally {
         this.saving.set(false);
      }
   }

   // ── Estado legible de una pantalla ────────────────────────────────────────

   /** Resume el bloque en una sola frase para no obligar a leer los interruptores. */
   getEstadoPantalla(pan: PantallaPermisos): 'sin-acceso' | 'lectura' | 'edicion' {
      if (!pan.ver?.asignado) return 'sin-acceso';
      return pan.editar?.asignado ? 'edicion' : 'lectura';
   }

   getEtiquetaEstado(pan: PantallaPermisos): string {
      switch (this.getEstadoPantalla(pan)) {
         case 'edicion': return 'Lectura y edición';
         case 'lectura': return 'Solo lectura';
         default: return 'Sin acceso';
      }
   }

   getAssignedCount(cat: CategoriaPermisos): number {
      return cat.contables.filter(p => p.asignado).length;
   }

   getProgreso(cat: CategoriaPermisos): number {
      if (!cat.contables.length) return 0;
      return (this.getAssignedCount(cat) / cat.contables.length) * 100;
   }

   // ── Presentación ──────────────────────────────────────────────────────────

   getInitials(u: Usuario): string {
      return u.nombre?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
   }

   getRolName(u: Usuario): string {
      if (u.rol) return u.rol;
      if (u.id_rol_usuario === 6) return 'Usuario Publicador';
      return 'Sin Rol';
   }

   getCategoriaNombre(codigo: string): string {
      const prefijo = codigo.split('.')[0];
      const nombres: Record<string, string> = {
         'publicadores': 'Publicadores',
         'grupos': 'Grupos',
         'contactos': 'Contactos',
         'informes': 'Informes',
         'territorios': 'Territorios',
         'reuniones': 'Reuniones',
         'exhibidores': 'Exhibidores',
         'reportes': 'Reportes',
         'tareas': 'Tareas'
      };
      return nombres[prefijo] || prefijo.charAt(0).toUpperCase() + prefijo.slice(1);
   }

   private iconosCategoriaCache = new Map<string, SafeHtml>();

   getCategoryIcon(categoria: string): SafeHtml {
      const enCache = this.iconosCategoriaCache.get(categoria);
      if (enCache) return enCache;

      const iconos: Record<string, string> = {
         'Publicadores': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>',
         'Informes': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>',
         'Territorios': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>',
         'Reuniones': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>',
         'Exhibidores': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>',
         'Reportes': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 3v18h18M7 15l4-4 4 4 6-6" /></svg>',
         'Tareas': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>'
      };

      const svg = iconos[categoria] || '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>';
      const generado = this.sanitizer.bypassSecurityTrustHtml(svg);
      this.iconosCategoriaCache.set(categoria, generado);
      return generado;
   }

   private iconosPantallaCache = new Map<string, SafeHtml>();

   /**
    * El mismo icono que lleva la pestaña en su módulo. Reconocer el dibujo evita
    * tener que traducir "Entrada Mensual" a la pantalla que uno recuerda.
    */
   getPantallaIcon(pantalla: string): SafeHtml {
      const enCache = this.iconosPantallaCache.get(pantalla);
      if (enCache) return enCache;

      const iconos: Record<string, string> = {
         'Listado': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
         'Grupos': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
         'Contactos': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
         'Entrada Mensual': '<path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>',
         'Historial Anual': '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>',
         'Resumen Sucursal': '<path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'
      };

      const paths = iconos[pantalla] || '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>';
      const generado = this.sanitizer.bypassSecurityTrustHtml(
         `<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
      );
      this.iconosPantallaCache.set(pantalla, generado);
      return generado;
   }

   getCategoryTheme(categoria: string): Tema {
      return TEMAS_POR_CATEGORIA[categoria] || 'slate';
   }

   // ── Clases por tema ───────────────────────────────────────────────────────
   //
   // Se resuelven aquí y no con mapas [ngClass] en la plantilla porque cada
   // bloque de pantalla tiene varios elementos que dependen del color del
   // módulo: repetir cinco ramas por elemento haría la plantilla ilegible.
   // Tailwind v4 rastrea también los .ts, así que las clases literales de arriba
   // llegan al CSS compilado.

   /** Segmento activo del selector de alcance. */
   claseSegmento(categoria: string, activo: boolean): string {
      if (!activo) {
         return 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200';
      }
      return ACENTOS[this.getCategoryTheme(categoria)].segmento;
   }

   /** Etiqueta de estado del bloque: sin acceso / solo lectura / lectura y edición. */
   claseEstado(categoria: string, pan: PantallaPermisos): string {
      const estado = this.getEstadoPantalla(pan);
      if (estado === 'sin-acceso') {
         return 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 ring-slate-200/70 dark:ring-slate-600/50';
      }
      const acento = ACENTOS[this.getCategoryTheme(categoria)];
      return estado === 'edicion' ? acento.estadoFuerte : acento.estadoSuave;
   }

   /** Nombre de la pantalla en la tira que encabeza su grupo de filas. */
   claseCabeceraPantalla(categoria: string): string {
      return ACENTOS[this.getCategoryTheme(categoria)].cabecera;
   }

   /** Pastilla del conteo en móvil, donde no cabe la barra de progreso. */
   claseEstadoConteo(categoria: string): string {
      return ACENTOS[this.getCategoryTheme(categoria)].estadoSuave;
   }

   /** Panel del selector de alcance, con el mismo aspecto que ya tenía en informes. */
   clasePanelAlcance(categoria: string): string {
      return ACENTOS[this.getCategoryTheme(categoria)].panel;
   }

   claseTituloAlcance(categoria: string): string {
      return ACENTOS[this.getCategoryTheme(categoria)].panelTitulo;
   }

   // ── Interacción unificada ─────────────────────────────────────────────────
   //
   // Las filas de una pantalla y las sueltas usan la misma plantilla, así que
   // estos dos métodos resuelven a qué comportamiento corresponde cada una:
   // dentro de un bloque hay que arrastrar Ver/Editar/alcance, y fuera basta
   // con conmutar el permiso.

   alternarFila(permiso: PermisoConEstado, pan?: PantallaPermisos, accion?: 'ver' | 'editar') {
      if (pan && accion) this.togglePantalla(pan, accion);
      else this.togglePermiso(permiso);
   }

   filaBloqueada(permiso: PermisoConEstado, pan?: PantallaPermisos, accion?: 'ver' | 'editar'): boolean {
      if (pan && accion) return this.estaBloqueado(pan, accion);
      return this.isPermisoRestringido(permiso.codigo);
   }

   /**
    * Icono de la fila, por orden de preferencia:
    *
    *   1. La acción, dentro de un bloque de pantalla: ojo para Ver, lápiz para
    *      Editar. Es lo que distingue las dos filas de un mismo bloque.
    *   2. El campo 'icono' del permiso, que la tabla ya trae relleno y correcto
    *      para los 43 permisos (calendar, mic, map, cog...) y que esta pantalla
    *      no estaba usando.
    *   3. Deducirlo del código, como último recurso.
    *
    * Sin el paso 2, quince permisos —los de Reuniones, Exhibidores y Reportes—
    * caían al icono por defecto, que es un candado. En el resto de la pantalla
    * el candado significa "no puedes modificar esto", así que comunicaba
    * exactamente lo contrario de lo que pasaba.
    */
   iconoFila(permiso: PermisoConEstado): SafeHtml {
      if (permiso.accion === 'ver' || permiso.accion === 'editar') {
         return this.getPermisoIconSvg(`accion:${permiso.accion}`);
      }
      if (permiso.icono) {
         return this.getPermisoIconSvg(`icono:${permiso.icono}`);
      }
      return this.getPermisoIconSvg(permiso.codigo);
   }

   /**
    * Cache de los iconos ya saneados. bypassSecurityTrustHtml devuelve un objeto
    * nuevo en cada llamada, asi que sin esta cache el binding [innerHTML] veia
    * un valor distinto en cada ciclo y volvia a parsear el SVG.
    */
   private iconosPermisoCache = new Map<string, SafeHtml>();

   getPermisoIconSvg(codigo: string): SafeHtml {
      const enCache = this.iconosPermisoCache.get(codigo);
      if (enCache) return enCache;
      const generado = this.construirIconoPermiso(codigo);
      this.iconosPermisoCache.set(codigo, generado);
      return generado;
   }

   /**
    * Trazos de cada icono, sin el <svg> envolvente: todos comparten el mismo
    * viewBox y grosor, así que solo cambia el interior.
    *
    * Las claves de 'icono:' son los valores de permisos_sistema.icono; las de
    * 'accion:' y el resto, las que se deducen del código del permiso.
    */
   private static readonly TRAZOS_ICONO: Record<string, string> = {
      'accion:ver': '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
      'accion:editar': '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',

      'icono:calendar': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      'icono:chart': '<path d="M3 3v18h18"/><path d="M7 15l4-4 4 4 5-6"/>',
      'icono:check-square': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
      'icono:clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      'icono:cog': '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.9 19.1l1.9-1.9M17.2 6.8l1.9-1.9"/>',
      'icono:edit': '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
      'icono:folder': '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      'icono:globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/>',
      'icono:key': '<circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13L20.5 2.5M17 6l2.5 2.5M14 9l2.5 2.5"/>',
      'icono:map': '<path d="M9 20l-5.4-2.7A1 1 0 0 1 3 16.4V5.6a1 1 0 0 1 1.4-.9L9 7m0 13l6-3m-6 3V7m6 10l5.4 2.7A1 1 0 0 0 21 18.4V7.6a1 1 0 0 0-.6-.9L15 4m0 13V4m0 0L9 7"/>',
      'icono:mic': '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8"/>',
      'icono:monitor': '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
      'icono:phone': '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
      'icono:plug': '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
      'icono:send': '<path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
      'icono:settings': '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
      'icono:users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',

      'crear': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
      // Último recurso: candado. Solo llega aquí un permiso sin 'icono' y con un
      // código que no dice qué hace.
      'default': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>'
   };

   private construirIconoPermiso(clave: string): SafeHtml {
      const trazos = UsuarioPermisosPage.TRAZOS_ICONO;
      let trazo = trazos[clave];

      if (!trazo) {
         // 'clave' es el código del permiso: se deduce por lo que hace.
         if (clave.includes('ver')) trazo = trazos['accion:ver'];
         else if (clave.includes('editar')) trazo = trazos['accion:editar'];
         else if (clave.includes('crear')) trazo = trazos['crear'];
         else if (clave.includes('enviar')) trazo = trazos['icono:send'];
         else if (clave.includes('historial')) trazo = trazos['icono:clock'];
         else trazo = trazos['default'];
      }

      return this.sanitizer.bypassSecurityTrustHtml(
         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${trazo}</svg>`
      );
   }
}

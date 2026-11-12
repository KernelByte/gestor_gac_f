import {
   AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/auth/auth.store';
import { UbicacionSalonMapComponent, UbicacionSalon } from './ubicacion-salon-map.component';
import { CambioHorarioComponent } from './cambio-horario.component';
import { camposHorarioCambiados } from './horarios-reunion.service';
import { ImportPublicadoresModalComponent } from '../../shared/components/import-publicadores/import-publicadores-modal.component';
import { FormatoNombreService } from '../../core/utils/formato-nombre.service';
import {
   ETIQUETA_FORMATO,
   FORMATOS_NOMBRE,
   FormatoNombre,
   formatearNombre,
} from '../../core/utils/nombre.util';

interface Configuracion {
   id_congregacion: number;
   nombre_congregacion: string;
   circuito: string;
   direccion: string;
   codigo_seguridad: string;
   tiene_sala_b: boolean | number;
   usa_zoom: boolean | number;
   id_periodo_informes_activo?: number | null;
   periodo_informes_automatico: number;
   dia_reunion_entre_semana:  string;
   hora_reunion_entre_semana: string;
   dia_reunion_fin_semana:    string;
   hora_reunion_fin_semana:   string;
   correo_congregacion?: string | null;
   numero_congregacion?: string | null;
   enlace_zoom?: string | null;
   /** Enlace de las salidas a predicar por Zoom; vacío = el de las reuniones. */
   enlace_zoom_predicacion?: string | null;
   latitud_salon?: number | null;
   longitud_salon?: number | null;
   formato_nombre_visible?: FormatoNombre;
}

/**
 * Clases compartidas de la pantalla. Viven aquí y no repetidas en cada campo
 * para que todos los controles tengan exactamente el mismo alto, borde y foco.
 * Tailwind v4 escanea también los .ts, así que estas clases se generan.
 */
const CLS = {
   etiqueta: 'block text-sm font-semibold text-slate-700 dark:text-slate-200',
   ayuda:    'text-sm leading-relaxed text-slate-500 dark:text-slate-400',
   campo:    'w-full h-12 px-4 rounded-xl border bg-white dark:bg-slate-800/60 text-base font-medium text-slate-900 dark:text-white ' +
             'border-slate-300 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 ' +
             'hover:border-slate-400 dark:hover:border-slate-600 focus:border-brand-purple dark:focus:border-purple-400 ' +
             'focus:ring-4 focus:ring-brand-purple/15 outline-none transition-[border-color,box-shadow] duration-150 ' +
             'read-only:bg-slate-50 read-only:dark:bg-slate-800/30 read-only:hover:border-slate-300 dark:read-only:hover:border-slate-700',
   btnSecundario: 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 ' +
             'bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 ' +
             'active:scale-[0.98] transition-[background-color,transform] duration-150 disabled:opacity-50 disabled:cursor-not-allowed ' +
             'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-purple/25',
   btnPrimario: 'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-brand-purple text-white text-sm font-semibold ' +
             'hover:bg-[#5b21b6] active:scale-[0.98] transition-[background-color,transform] duration-150 ' +
             'disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-purple/30',
   chip:     'h-11 px-4 rounded-xl border text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 ' +
             'active:scale-[0.97] disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-purple/25',
   chipOn:   'border-brand-purple bg-brand-purple text-white',
   chipOff:  'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 ' +
             'hover:border-slate-400 dark:hover:border-slate-500 disabled:hover:border-slate-300',
} as const;

@Component({
   selector: 'app-configuracion',
   standalone: true,
   imports: [CommonModule, FormsModule, ImportPublicadoresModalComponent, UbicacionSalonMapComponent, CambioHorarioComponent],
   templateUrl: './configuracion.page.html',
   styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .animate-fadeIn { animation: fadeIn 0.35s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    /* El ancla de cada sección no debe quedar pegada al borde al saltar desde el índice. */
    section[id] { scroll-margin-top: 4.25rem; }
    @media (prefers-reduced-motion: reduce) { .animate-fadeIn { animation: none; } }
  `],
   animations: [
      trigger('slideIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateX(100%)' }),
            animate('400ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
         ]),
         transition(':leave', [
            animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(100%)' }))
         ])
      ])
   ]
})
export class ConfiguracionPage implements OnInit, AfterViewInit, OnDestroy {
   readonly cls = CLS;

   /** Índice de la pantalla (columna izquierda en pantallas anchas). */
   readonly secciones = [
      { id: 'cfg-datos',     label: 'Congregación' },
      { id: 'cfg-salon',     label: 'Salón del Reino' },
      { id: 'cfg-reuniones', label: 'Reuniones' },
      { id: 'cfg-nombres',   label: 'Nombres' },
      { id: 'cfg-informes',  label: 'Informes' },
      { id: 'cfg-seguridad', label: 'Seguridad' },
   ];
   seccionActiva = signal('cfg-datos');
   @ViewChild('scroller') private scroller?: ElementRef<HTMLElement>;
   private observador?: IntersectionObserver;
   /** Mientras dura el desplazamiento pedido con un clic, manda la sección pulsada, no lo que va pasando por la franja. */
   private fijadaHasta = 0;

   /** Paso de confirmación antes de cambiar el código que usan todos para entrar. */
   confirmandoCodigo = signal(false);

   readonly formatoNombre = inject(FormatoNombreService);

   /** Las cuatro reglas, cada una con su etiqueta y su ejemplo. */
   readonly formatosNombre = FORMATOS_NOMBRE;
   readonly etiquetaFormato = ETIQUETA_FORMATO;

   /**
    * Publicador de ejemplo para las tarjetas.
    *
    * Se rellena con uno REAL de la congregación en cuanto se carga la lista:
    * ver el efecto sobre un nombre conocido es lo que hace la decisión obvia.
    * Mientras tanto, un ejemplo neutro para que las tarjetas nunca salgan vacías.
    */
   ejemploNombre = signal<Record<string, string>>({
      primer_nombre: 'Ana',
      segundo_nombre: 'Lucía',
      primer_apellido: 'Restrepo',
      segundo_apellido: 'Vélez',
   });

   /** Cómo se vería el ejemplo con una regla dada. */
   ejemploCon(formato: FormatoNombre): string {
      return formatearNombre(this.ejemploNombre() as any, formato);
   }

   elegirFormato(formato: FormatoNombre): void {
      if (!this.canEdit()) return;
      this.config.formato_nombre_visible = formato;
   }

   private http = inject(HttpClient);
   private auth = inject(AuthStore);

   /** Viene del aviso de Inicio ("¿Cambia su horario en enero?"): abrir el formulario. */
   readonly abrirCambioHorario = inject(ActivatedRoute).snapshot.queryParamMap.has('cambio-horario');
   /** Viene de otra pantalla a una sección concreta (p. ej. el aviso de enlace de Zoom en Programa de salidas). */
   private readonly seccionInicial = inject(ActivatedRoute).snapshot.fragment;
   private API_URL = `${environment.apiUrl}/configuracion/`;
   private PERIODOS_URL = `${environment.apiUrl}/periodos/?limit=24`;

   config: Configuracion = {
      id_congregacion: 0,
      nombre_congregacion: '',
      circuito: '',
      direccion: '',
      codigo_seguridad: '',
      tiene_sala_b: false,
      usa_zoom: true,
      id_periodo_informes_activo: null as number | null,
      periodo_informes_automatico: 1,
      dia_reunion_entre_semana:  '',
      hora_reunion_entre_semana: '',
      dia_reunion_fin_semana:    '',
      hora_reunion_fin_semana:   '',
      correo_congregacion:       null,
      numero_congregacion:       null,
      enlace_zoom:               null,
      enlace_zoom_predicacion:   null,
      latitud_salon:             null,
      longitud_salon:            null,
   };

   periodosDisponibles: any[] = [];

   private readonly mesesNombre: Record<number, string> = {
      1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
      5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
      9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
   };

   originalConfig: Configuracion | null = null;

   loading          = signal(true);
   saving           = signal(false);
   showSecurityCode = signal(false);
   generatingCode   = signal(false);
   notification     = signal<{ message: string, type: 'success' | 'error' } | null>(null);

   /** Controla visibilidad del modal de importación. */
   showImportModal = signal(false);

   /** True cuando el rol es global (Administrador) y NO debe importar desde esta pantalla. */
   isGlobalRole = signal(false);

   readonly diasEntreSemana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
   readonly diasFinSemana   = ['Sabado', 'Domingo'];
   readonly diasLabel: Record<string, string> = {
      Lunes: 'Lunes', Martes: 'Martes', Miercoles: 'Miércoles',
      Jueves: 'Jueves', Viernes: 'Viernes', Sabado: 'Sábado', Domingo: 'Domingo'
   };

   elegirDia(tipo: 'entre' | 'fin', dia: string): void {
      if (!this.canEdit()) return;
      if (tipo === 'entre') this.config.dia_reunion_entre_semana = dia;
      else                  this.config.dia_reunion_fin_semana   = dia;
   }

   // ── Periodo de informes ──────────────────────────────────
   /** Automático = siempre el mes anterior al actual. */
   esPeriodoAutomatico(): boolean { return this.config.periodo_informes_automatico === 1; }

   usarPeriodoAutomatico(): void {
      if (!this.canEdit()) return;
      this.config.periodo_informes_automatico = 1;
   }

   /** Al pasar a "un mes fijo" se propone el que ya estaba, o el más reciente. */
   usarPeriodoFijo(): void {
      if (!this.canEdit()) return;
      this.config.periodo_informes_automatico = 0;
      if (!this.config.id_periodo_informes_activo && this.periodosDisponibles.length) {
         this.config.id_periodo_informes_activo = this.periodosDisponibles[0].id_periodo;
      }
   }

   /** "Septiembre 2026": lo que hoy significa "automático", para no tener que deducirlo. */
   mesAnteriorTexto(): string {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return `${this.mesesNombre[d.getMonth() + 1]} ${d.getFullYear()}`;
   }

   ngOnInit() {
      this.loadConfig();
      this.loadPeriodos();
      this.detectGlobalRole();
      this.cargarEjemploNombre();
   }

   /**
    * Marca en el índice la sección que se está leyendo. La franja de
    * detección es el tercio superior del área desplazable: la sección
    * "activa" es la que tiene el título a la vista, no la que asoma abajo.
    */
   ngAfterViewInit(): void {
      const root = this.scroller?.nativeElement;
      if (!root || typeof IntersectionObserver === 'undefined') return;
      this.observador = new IntersectionObserver(entradas => {
         if (Date.now() < this.fijadaHasta) return;
         if (this.alFinal()) { this.marcarActiva(this.secciones[this.secciones.length - 1].id); return; }
         const visible = entradas.find(e => e.isIntersecting);
         if (visible) this.marcarActiva(visible.target.id);
      }, { root, rootMargin: '-72px 0px -60% 0px', threshold: 0 });
      this.secciones.forEach(sec => {
         const el = root.querySelector('#' + sec.id);
         if (el) this.observador!.observe(el);
      });
   }

   ngOnDestroy(): void {
      this.observador?.disconnect();
   }

   /** Al llegar al final, la última sección no alcanza la franja de arriba: se marca a mano. */
   private alFinal(): boolean {
      const el = this.scroller?.nativeElement;
      return !!el && el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
   }

   alDesplazar(): void {
      if (Date.now() < this.fijadaHasta) return;
      if (this.alFinal()) this.marcarActiva(this.secciones[this.secciones.length - 1].id);
   }

   irA(id: string): void {
      const el = this.scroller?.nativeElement.querySelector('#' + id);
      if (!el) return;
      const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.fijadaHasta = Date.now() + (reducido ? 150 : 1100);
      el.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
      this.marcarActiva(id);
   }

   /**
    * Cambia la sección activa y, si la barra se desliza de lado (móvil), centra
    * su botón. Se mueve solo el `scrollLeft` de la barra: un `scrollIntoView`
    * aquí cancelaría el desplazamiento suave de la página que acaba de pedir irA().
    */
   private marcarActiva(id: string): void {
      if (this.seccionActiva() === id) return;
      this.seccionActiva.set(id);
      const chip = document.getElementById('chip-' + id);
      const barra = chip?.closest('ul');
      if (!chip || !barra) return;
      const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      barra.scrollTo({
         left: chip.offsetLeft - (barra.clientWidth - chip.offsetWidth) / 2,
         behavior: reducido ? 'auto' : 'smooth',
      });
   }

   /**
    * Coge un publicador real para las tarjetas de "Nombre para mostrar".
    *
    * Un ejemplo inventado obliga a imaginar el efecto; uno de la propia
    * congregación lo enseña. Si falla, se queda el ejemplo neutro: es una
    * ayuda visual, no debe impedir configurar nada.
    */
   private cargarEjemploNombre(): void {
      this.http
         .get<any[]>(`${environment.apiUrl}/publicadores/`, { params: { limit: 50, offset: 0 } })
         .subscribe({
            next: (lista) => {
               // El que más partes de nombre tenga: es el que mejor distingue
               // unas reglas de otras.
               const mejor = (lista || [])
                  .filter(p => p?.primer_nombre && p?.primer_apellido)
                  .sort((a, b) =>
                     (!!b.segundo_nombre as any) + (!!b.segundo_apellido as any) -
                     ((!!a.segundo_nombre as any) + (!!a.segundo_apellido as any)))[0];
               if (mejor) this.ejemploNombre.set(mejor);
            },
            error: () => {},
         });
   }

   private detectGlobalRole() {
      const user = this.auth.user();
      if (!user) return;
      const rol = (user.rol || '').trim().toLowerCase();
      this.isGlobalRole.set(rol === 'administrador');
   }

   loadPeriodos() {
      this.http.get<any[]>(this.PERIODOS_URL).subscribe({
         next: (data) => {
            this.periodosDisponibles = data
               .map(p => ({
                  ...p,
                  nombre_periodo: `${this.mesesNombre[p.codigo_mes] || p.codigo_mes} ${p.codigo_ano}`
               }))
               .sort((a, b) => {
                  if (b.codigo_ano !== a.codigo_ano) return b.codigo_ano - a.codigo_ano;
                  return b.codigo_mes - a.codigo_mes;
               });
         },
         error: (err) => console.error('Error cargando periodos', err)
      });
   }

   loadConfig() {
      this.loading.set(true);
      this.http.get<Configuracion>(this.API_URL).subscribe({
         next: (data) => {
            this.config = data;
            this.originalConfig = { ...data };
            this.loading.set(false);
            if (this.seccionInicial) setTimeout(() => this.irA(this.seccionInicial!), 60);
         },
         error: (err) => {
            console.error('Error cargando configuración', err);
            this.loading.set(false);
         }
      });
   }

   save() {
      if (!this.canEdit()) return;
      if (this.enlaceZoomInvalido() || this.enlacePredicacionInvalido()) {
         this.showNotification('Revise los enlaces de videoconferencia: deben empezar por https://', 'error');
         this.irA('cfg-reuniones');
         return;
      }
      this.saving.set(true);
      const payload = {
         nombre_congregacion:        this.config.nombre_congregacion,
         circuito:                   this.config.circuito,
         direccion:                  this.config.direccion,
         codigo_seguridad:           this.config.codigo_seguridad,
         tiene_sala_b:               this.config.tiene_sala_b ? 1 : 0,
         usa_zoom:                   this.config.usa_zoom ? 1 : 0,
         id_periodo_informes_activo: this.config.id_periodo_informes_activo,
         periodo_informes_automatico: this.config.periodo_informes_automatico,
         ...camposHorarioCambiados(this.config, this.originalConfig),
         correo_congregacion:        this.config.correo_congregacion       || null,
         numero_congregacion:        this.config.numero_congregacion       || null,
         enlace_zoom:                this.enlaceParaGuardar('enlace_zoom'),
         enlace_zoom_predicacion:    this.enlaceParaGuardar('enlace_zoom_predicacion'),
         latitud_salon:              this.config.latitud_salon  ?? null,
         longitud_salon:             this.config.longitud_salon ?? null,
         formato_nombre_visible:     this.config.formato_nombre_visible    || 'completo',
      };

      this.http.put<Configuracion>(this.API_URL, payload).subscribe({
         next: (data) => {
            this.config = data;
            this.originalConfig = { ...data };
            // El servicio cachea la regla para las vistas previas; sin esto,
            // el formulario de publicador seguiría enseñando la anterior.
            this.formatoNombre.aplicar(data.formato_nombre_visible);
            this.saving.set(false);
            this.showNotification('Cambios guardados', 'success');
         },
         error: (err) => {
            console.error('Error guardando configuración', err);
            this.saving.set(false);
            this.showNotification(err.error?.detail || 'No se pudieron guardar los cambios. Inténtelo otra vez.', 'error');
         }
      });
   }

   showNotification(message: string, type: 'success' | 'error' = 'success') {
      this.notification.set({ message, type });
      setTimeout(() => this.notification.set(null), 4000);
   }

   /** Vuelve todo a como estaba guardado. */
   descartarCambios(): void {
      if (!this.originalConfig) return;
      this.config = { ...this.originalConfig };
      this.confirmandoCodigo.set(false);
   }

   regenerateSecurityCode() {
      if (!this.canEdit()) return;
      this.confirmandoCodigo.set(false);
      this.generatingCode.set(true);
      const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const result = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const oldCode = this.config.codigo_seguridad;
      this.config.codigo_seguridad = result;
      this.showSecurityCode.set(true);

      this.http.put<Configuracion>(this.API_URL, { codigo_seguridad: result }).subscribe({
         next: (data) => {
            // Solo el código: reemplazar `config` entero borraría cualquier
            // otro cambio que la persona tuviera a medio guardar.
            this.config.codigo_seguridad = data.codigo_seguridad;
            if (this.originalConfig) this.originalConfig.codigo_seguridad = data.codigo_seguridad;
            this.generatingCode.set(false);
            this.showNotification('Código nuevo guardado. Compártalo con los publicadores.', 'success');
         },
         error: (err) => {
            console.error('Error actualizando código', err);
            this.config.codigo_seguridad = oldCode;
            this.generatingCode.set(false);
            this.showNotification('No se pudo generar el código nuevo. Inténtelo otra vez.', 'error');
         }
      });
   }

   hasChanges(): boolean {
      if (!this.originalConfig) return false;
      return this.config.nombre_congregacion !== this.originalConfig.nombre_congregacion ||
         this.config.circuito !== this.originalConfig.circuito ||
         this.config.direccion !== this.originalConfig.direccion ||
         this.config.codigo_seguridad !== this.originalConfig.codigo_seguridad ||
         !!this.config.tiene_sala_b !== !!this.originalConfig.tiene_sala_b ||
         !!this.config.usa_zoom !== !!this.originalConfig.usa_zoom ||
         this.config.id_periodo_informes_activo !== this.originalConfig.id_periodo_informes_activo ||
         this.config.periodo_informes_automatico !== this.originalConfig.periodo_informes_automatico ||
         (this.config.dia_reunion_entre_semana  || '') !== (this.originalConfig.dia_reunion_entre_semana  || '') ||
         (this.config.hora_reunion_entre_semana || '') !== (this.originalConfig.hora_reunion_entre_semana || '') ||
         (this.config.dia_reunion_fin_semana    || '') !== (this.originalConfig.dia_reunion_fin_semana    || '') ||
         (this.config.hora_reunion_fin_semana   || '') !== (this.originalConfig.hora_reunion_fin_semana   || '') ||
         (this.config.correo_congregacion       || '') !== (this.originalConfig.correo_congregacion       || '') ||
         (this.config.numero_congregacion       || '') !== (this.originalConfig.numero_congregacion       || '') ||
         (this.config.enlace_zoom               || '') !== (this.originalConfig.enlace_zoom               || '') ||
         (this.config.enlace_zoom_predicacion   || '') !== (this.originalConfig.enlace_zoom_predicacion   || '') ||
         (this.config.latitud_salon  ?? null) !== (this.originalConfig.latitud_salon  ?? null) ||
         (this.config.longitud_salon ?? null) !== (this.originalConfig.longitud_salon ?? null) ||
         // Sin esto, elegir una regla de nombre no habilitaba Guardar: la
         // tarjeta se marcaba como seleccionada y el cambio se perdía al salir.
         (this.config.formato_nombre_visible    || 'completo') !== (this.originalConfig.formato_nombre_visible || 'completo');
   }

   /**
    * El enlace es inútil si no se puede abrir: la app móvil lo pasa a
    * Linking.openURL, que solo entiende http/https. Se valida aquí y no solo
    * en el servidor para que el error se vea junto al campo, no como un toast
    * genérico después de guardar.
    *
    * El host NO se restringe a zoom.us: el ajuste se presenta como "Zoom/Meet".
    */
   enlaceZoomInvalido(): boolean {
      // Con la videoconferencia apagada el campo está oculto: un valor viejo
      // inválido no puede bloquear el guardado sin que se vea por qué.
      if (!this.config.usa_zoom) return false;
      return this.enlaceMalo(this.config.enlace_zoom);
   }

   /** El enlace de las salidas a predicar: mismas reglas que el de las reuniones. */
   enlacePredicacionInvalido(): boolean {
      if (!this.config.usa_zoom) return false;
      return this.enlaceMalo(this.config.enlace_zoom_predicacion);
   }

   private enlaceMalo(valor?: string | null): boolean {
      const v = valor?.trim();
      if (!v) return false;              // vacío = no configurado, es válido
      return !/^https?:\/\/.+/i.test(v);
   }

   /** Con la videoconferencia apagada y un enlace sin https, se conserva el guardado: el servidor lo rechazaría. */
   private enlaceParaGuardar(campo: 'enlace_zoom' | 'enlace_zoom_predicacion'): string | null {
      const v = this.config[campo]?.trim() || null;
      if (v && !/^https?:\/\/.+/i.test(v)) return this.originalConfig?.[campo]?.trim() || null;
      return v;
   }

   /**
    * Un cambio de horario con fecha ya vigente se refleja aquí sin recargar todo:
    * recargar `config` borraría lo que la persona lleve a medio editar.
    */
   refrescarHorario(): void {
      this.http.get<Configuracion>(this.API_URL).subscribe({
         next: (data) => {
            const campos = ['dia_reunion_entre_semana', 'hora_reunion_entre_semana',
                            'dia_reunion_fin_semana', 'hora_reunion_fin_semana'] as const;
            for (const c of campos) {
               this.config[c] = data[c];
               if (this.originalConfig) this.originalConfig[c] = data[c];
            }
         },
         error: (err) => console.error('Error actualizando el horario', err),
      });
   }

   onUbicacionCambio(u: UbicacionSalon | null): void {
      if (!this.canEdit()) return;
      this.config.latitud_salon  = u?.lat ?? null;
      this.config.longitud_salon = u?.lng ?? null;
   }

   canEdit(): boolean {
      const user = this.auth.user();
      if (!user) return false;
      const allowedRoles = ['Administrador', 'Coordinador', 'Secretario'];
      if (user.rol && allowedRoles.includes(user.rol)) return true;
      return this.auth.hasPermission('configuracion.editar');
   }

   // ── Modal importación ─────────────────────────────────────────────────────
   openImportModal()  { this.showImportModal.set(true);  }
   closeImportModal() { this.showImportModal.set(false); }

   onImportDone() {
      this.showImportModal.set(false);
      this.loadConfig();
   }
}

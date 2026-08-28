import { Component, inject, OnInit, signal, computed, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { lastValueFrom, debounceTime, distinctUntilChanged } from 'rxjs';

import { UsuariosService, Rol, Congregacion, Estado, UsuarioCreatePublicador, PublicadorRapidoCreate } from '../services/usuarios.service';
import { Usuario } from '../models/usuario.model';
import { AuthStore } from '../../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { getInitialAvatarStyle } from '../../../../core/utils/avatar-style.util';
import { SelectPickerComponent, PickerOption } from '../../../../shared/components/select-picker/select-picker.component';
import { PasswordStrengthComponent } from '../../../../shared/components/password-strength/password-strength.component';
import { whatsappUrl } from '../../../../shared/whatsapp';

type UserFormTab = 'datos' | 'acceso' | 'seguridad';

@Component({
   standalone: true,
   selector: 'app-usuarios-page',
   imports: [CommonModule, ReactiveFormsModule, SelectPickerComponent, PasswordStrengthComponent],
   animations: [
      trigger('tableAnimation', [
         transition('* => *', [
            query(':enter', [
               style({ opacity: 0, transform: 'translateY(8px)' }),
               stagger(40, [
                  animate('180ms cubic-bezier(0.23, 1, 0.32, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
               ])
            ], { optional: true })
         ])
      ]),
      trigger('fadeIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'scale(0.95)' }),
            animate('180ms cubic-bezier(0.23, 1, 0.32, 1)', style({ opacity: 1, transform: 'scale(1)' }))
         ]),
         transition(':leave', [
            animate('100ms cubic-bezier(0.4, 0, 1, 1)', style({ opacity: 0, transform: 'scale(0.95)' }))
         ])
      ])
   ],
   templateUrl: './usuarios.page.html',
   styles: [`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
    }
    .simple-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
    .simple-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .simple-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .simple-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    /* ── Lista adaptativa: tabla y tarjetas conmutadas por el ancho REAL
       disponible (container query), no por el viewport. Sin esto, abrir el
       panel lateral reduce la columna a ~580px pero la tabla conserva su
       ancho mínimo y recorta Teléfono, Estado y Acciones. ── */
    .list-panel { container-type: inline-size; container-name: listpanel; }

    .list-table  { display: none; }
    .list-cards  { display: block; }
    @container listpanel (min-width: 880px) {
      .list-table { display: table; }
      .list-cards { display: none; }
    }

    /* Barra de filtros: se apila cuando la columna se estrecha (panel abierto
       o móvil) para que ningún control quede aplastado. Al apilarse, el
       selector de congregación conserva su ancho fijo (sm:w-56 es un
       breakpoint de VIEWPORT, no de este contenedor, así que sigue activo en
       escritorio) y el resto de la fila quedaba pegado a la izquierda con un
       hueco vacío enorme a la derecha, descuadrado con el buscador de arriba
       que sí ocupa todo el ancho. Empujar el grupo de botones al extremo
       derecho reproduce esos mismos bordes simétricos. */
    @container listpanel (max-width: 640px) {
      .filters-row     { flex-direction: column; align-items: stretch; }
      .filters-actions { width: 100%; }
      .filters-divider { display: none; }
      .filters-actions-buttons { margin-left: auto; }
    }

    /* Resumen de conteos: se compacta con la columna en lugar de desaparecer. */
    @container listpanel (max-width: 420px) {
      .summary-strip { gap: 0.75rem; }
      .summary-sep   { display: none; }
    }

    /* Tarjeta de usuario: los 3 botones de acción (44px cada uno) más el avatar
       ocupan ~208px fijos. En una columna estrecha —tablet en vertical con el
       panel abierto, que deja la lista en 264px— al nombre y al correo les
       quedaban 16px y desaparecían tras los puntos suspensivos. Por debajo de
       ese umbral las acciones bajan a su propia fila y la identidad recupera
       el ancho completo. */
    @container listpanel (max-width: 400px) {
      .card-main    { flex-wrap: wrap; }
      .card-identity{ flex-basis: calc(100% - 3.25rem); }
      .card-actions { width: 100%; justify-content: flex-end; margin-top: 0.5rem; }
    }

    /* ── Comportamiento del panel según el espacio REAL disponible.
       El patrón maestro-detalle (el panel empuja a la lista) sólo funciona si a
       la lista le queda un ancho usable. Medido: a 768px la lista caía a 264px
       y a 1024px a 168px —con el nombre y el correo truncados— porque a partir
       de lg: aparece además la barra lateral de 293px. Por eso el panel se
       SUPERPONE con fondo oscuro hasta xl: (1280px), donde ya sobra sitio, y
       sólo entonces pasa a empujar. ── */

    /* Tablet (768–1279): cajón lateral superpuesto, anclado a la derecha.
       La lista conserva su ancho completo por detrás. */
    @media (min-width: 768px) and (max-width: 1279px) {
      .user-drawer-open {
        position: fixed; inset: 0 0 0 auto; height: 100%;
        width: 420px; z-index: 50;
      }
    }
    @media (min-width: 1024px) and (max-width: 1279px) {
      .user-drawer-open { width: 480px; }
    }

    /* Escritorio (1280+): empuja. Los escalones van aquí y no como utilidades
       apiladas (lg:w- / mbp:w-) porque Tailwind v4 no ordena los breakpoints
       personalizados después de los suyos: lg ganaba sobre mbp a 1512px y el
       panel se quedaba corto. Aquí el orden en cascada es explícito. */
    @media (min-width: 1280px) { .user-drawer-open { width: 480px; } }
    @media (min-width: 1440px) { .user-drawer-open { width: 560px; } }
    @media (min-width: 1680px) { .user-drawer-open { width: 620px; } }

    /* Pantalla baja (móvil en apaisado): la cabecera, los pasos y el subtítulo
       se comen la altura y al área de campos le quedaban 103px de 390. Aquí se
       comprimen para devolverle sitio al formulario, que es lo que se usa. */
    @media (max-height: 500px) {
      .panel-header { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      .panel-header p { display: none; }
      .panel-steps  { padding-top: 0.375rem; padding-bottom: 0.375rem; }
    }

    /* ── Columnas del formulario: responden al ancho REAL del panel, no al del
       viewport. Con sm:/md: el panel medía 411px pero el viewport de 1512px
       activaba ambos breakpoints, metía 2 columnas de 199px (y un grid anidado
       de 93px) y truncaba placeholders y nombres de congregación. ── */
    .form-shell { container-type: inline-size; container-name: userform; }

    .field-row-2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem; }

    /* 28rem = el panel sólo se parte en varias columnas cuando cada campo queda
       por encima de ~130px. Por debajo compensa una sola columna a ancho
       completo. El reparto lo fija cada fila con --cols, para que el ancho sea
       proporcional al contenido esperado: un correo necesita más sitio que un
       teléfono, y un "C.C." mucho menos que cualquiera de los dos.
       Se bajó de 30rem a 28rem al angostar el panel, para conservar el margen
       de seguridad con el que multi-columna sigue activa a partir de mbp:. */
    @container userform (min-width: 28rem) {
      .field-row-2 { grid-template-columns: var(--cols, minmax(0, 1fr) minmax(0, 1fr)); }
    }

    /* ── Sombra del panel + difuminado en el borde derecho.
       En escritorio el panel sólo redondea el lado izquierdo (rounded-l-3xl);
       el derecho queda a ras del borde de la ventana con una esquina recta a
       90°, que se ve dura al lado de las esquinas redondeadas del resto de la
       tarjeta. Un inset shadow resultaba demasiado sutil para leerse como
       "difuminado" (la esquina seguía notándose); un degradado real superpuesto
       (::after) es mucho más contundente y predecible. En móvil (hoja
       inferior) no aplica: ahí no hay un lado sin redondear que suavizar. ── */
    .panel-inner { position: relative; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.10); }
    :host-context(.dark) .panel-inner { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.50); }

    @media (min-width: 768px) {
      /* Paradas suavizadas, no una rampa lineal: el panel (slate-900) es MÁS
         CLARO que el fondo de la página (#020617), así que una rampa lineal
         deja un cambio de pendiente brusco justo donde arranca y el ojo lo lee
         como una línea vertical clara (banda de Mach). Con las paradas
         escalonadas el arranque es imperceptible.
         El ancho (2.5rem) se ajusta al hueco real: los campos terminan a 32px
         del borde del panel, así que a partir de ahí sólo quedan 8px de solape
         y con alfa casi nula — el difuminado vive en el margen, no encima de
         los campos. Los colores son los EXACTOS del fondo de la página para
         que funda de verdad y no parezca una sombra superpuesta. */
      .panel-inner::after {
        content: '';
        position: absolute; inset: 0 0 0 auto; width: 2.5rem;
        pointer-events: none;
        background: linear-gradient(to left,
          #f3f4f6 0%,
          rgba(243, 244, 246, 0.92) 14%,
          rgba(243, 244, 246, 0.74) 30%,
          rgba(243, 244, 246, 0.50) 48%,
          rgba(243, 244, 246, 0.27) 66%,
          rgba(243, 244, 246, 0.11) 82%,
          rgba(243, 244, 246, 0.03) 92%,
          rgba(243, 244, 246, 0) 100%);
      }
      :host-context(.dark) .panel-inner::after {
        background: linear-gradient(to left,
          #020617 0%,
          rgba(2, 6, 23, 0.92) 14%,
          rgba(2, 6, 23, 0.74) 30%,
          rgba(2, 6, 23, 0.50) 48%,
          rgba(2, 6, 23, 0.27) 66%,
          rgba(2, 6, 23, 0.11) 82%,
          rgba(2, 6, 23, 0.03) 92%,
          rgba(2, 6, 23, 0) 100%);
      }
    }
  `]
})
export class UsuariosPage implements OnInit {

   /** trackBy: evita recrear el DOM de toda la lista en cada cambio. */
   trackByUsuario = (_: number, u: any) => u.id_usuario;

   private service = inject(UsuariosService);
   private fb = inject(FormBuilder);
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private authStore = inject(AuthStore);
   private cdr = inject(ChangeDetectorRef);
   private congregacionContext = inject(CongregacionContextService);

   usuarios = signal<Usuario[]>([]);
   roles = signal<Rol[]>([]);
   congregaciones = signal<Congregacion[]>([]);
   estados = signal<Estado[]>([]);
   publicadores = signal<any[]>([]);

   /** Estados de tipo "Teocratico" (Activo/Inactivo del publicador). Se usan
    *  solo para resolver el estado por defecto del alta rápida de publicador;
    *  `estados` sigue siendo el de tipo "Sistema" de la cuenta de usuario. */
   estadosTeocraticos = signal<Estado[]>([]);

   // Modo restringido para Coordinador/Secretario
   isAdmin = computed(() => {
      const user = this.authStore.user();
      const roles = user?.roles ?? (user?.rol ? [user.rol] : []);
      return roles.map(r => (r || '').toLowerCase()).includes('administrador');
   });

   isGestor = computed(() => {
      const user = this.authStore.user();
      const roles = user?.roles ?? (user?.rol ? [user.rol] : []);
      return roles.map(r => (r || '').toLowerCase()).includes('gestor aplicación');
   });

   isCoordSecretario = computed(() => {
      if (this.isAdmin() || this.isGestor()) return false;
      const user = this.authStore.user();
      const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
      return roles.some(r => ['secretario', 'coordinador'].includes(r));
   });

   isPrivilegedRole = computed(() => {
      if (this.isAdmin()) return true;
      const user = this.authStore.user();
      const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
      return roles.some(r => ['secretario', 'coordinador', 'superintendente de servicio'].includes(r));
   });

   canManagePermisos = computed(() => {
      const user = this.authStore.user();
      const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
      return roles.some(r => ['administrador', 'gestor aplicación', 'coordinador', 'secretario'].includes(r));
   });

   canDeleteUser = computed(() => {
      const user = this.authStore.user();
      const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
      return roles.some(r => ['administrador', 'gestor aplicación', 'coordinador', 'secretario'].includes(r));
   });

   currentUserCongregacion = computed(() => {
      return this.authStore.user()?.id_congregacion ?? null;
   });

   /** Espeja ROLES_ESCRITURA_PUBLICADORES del backend (publicador_router.py):
    *  quién puede dar de alta un publicador. Coordinador queda fuera a
    *  propósito, igual que en el servidor. `hasPermission` ya trata a
    *  Administrador y Gestor Aplicación como autorizados. */
   canCreatePublicador = computed(() => {
      const user = this.authStore.user();
      const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
      if (roles.some(r => ['administrador', 'gestor aplicación', 'gestor', 'secretario'].includes(r))) return true;
      return this.authStore.hasPermission('publicadores.editar');
   });

   /** Congregación a la que se daría de alta el publicador rápido: la elegida
    *  en el formulario (Admin/Gestor) o la propia del usuario (Secretario).
    *  Es un método y no un computed porque depende de un FormControl, que no
    *  es una señal y no invalidaría la caché de un computed. */
   quickPubCongregacionId(): number | null {
      if (this.isAdmin() || this.isGestor()) {
         return this.userForm.get('id_congregacion')?.value ?? null;
      }
      return this.currentUserCongregacion();
   }

   showCongregacionCol = computed(() => {
      const user = this.authStore.user();
      const roles = user?.roles ?? (user?.rol ? [user.rol] : []);
      return roles.map(r => (r || '').toLowerCase()).some(r => r.includes('administrador') || r.includes('gestor'));
   });

   // Nota: aquí había un filtro por IDs fijos [2, 3, 6] documentado como
   // "2=Coordinador, 3=Secretario", pero los IDs reales del seed son
   // 2=Gestor Aplicación, 3=Coordinador, 4=Secretario. El filtro ofrecía por
   // tanto Gestor Aplicación (que el backend rechaza) y escondía Secretario.
   // Para Coordinador/Secretario, `roles` ya viene de /roles/permitidos, que
   // es la lista que el servidor autoriza: volver a filtrarla sobra.

   getCongregacionNameForUser(u: Usuario): string {
      const roles = u.roles ?? (u.rol ? [u.rol] : []);
      const isGlobal = roles.map(r => (r || '').toLowerCase()).some(r => r.includes('administrador') || r.includes('gestor'));
      if (isGlobal) return 'Sistema Central';

      if (!u.id_congregacion) return 'Sin asignación';
      const c = this.congregaciones().find(x => x.id_congregacion === u.id_congregacion);
      return c ? c.nombre_congregacion : 'Desconocida';
   }

   panelOpen = signal(false);
   saving = signal(false);
   showDeleteDialog = signal(false);
   userToDelete = signal<Usuario | null>(null);
   showPassword = signal(false);
   editingUser = signal<Usuario | null>(null);

   // Post-creation credentials dialog (WhatsApp)
   showCredentialsDialog = signal(false);
   lastCreatedCredentials = signal<{ nombre: string; correo: string; contrasena: string; telefono?: string } | null>(null);
   sendingWA = signal(false);

   // Custom Select States

   // ID Types Definition
   readonly idTypes = [
      { code: 'CC', name: 'C.C.' },
      { code: 'CE', name: 'C.E.' },
      { code: 'TI', name: 'T.I.' },
      { code: 'PASSPORT', name: 'Pasaporte' }
   ];

   // Filtering states for dropdowns
   selectedRolFilter = signal<number | null>(null); // Filter by role from query params
   searchQuery = signal(''); // Signal for reactive search

   // Congregation filter dropdown (custom, replaces native select)
   congFilterDropdownOpen = signal(false);
   congFilterDropdownPos = signal({ top: 0, left: 0, width: 224 });

   // Inline error states (replace alert())
   saveError = signal<string | null>(null);
   deleteError = signal<string | null>(null);

   // ── Asistente por pasos ──────────────────────────────────────────────
   // El panel es alto y estrecho; apilar las tres secciones obligaba a un
   // scroll largo. Se recorre paso a paso y cada uno se valida antes de
   // avanzar, para no descubrir los errores al final de todo.
   activeTab = signal<UserFormTab>('datos');

   /** Paso más lejano alcanzado: al crear no se salta hacia delante sin
    *  completar lo anterior, pero sí se puede volver a revisar lo hecho. */
   maxStepReached = signal(0);

   /** Campos de cada pestaña, para saber dónde está un error sin abrirlas. */
   private readonly TAB_FIELDS: Record<UserFormTab, string[]> = {
      datos:     ['nombre', 'correo', 'telefono', 'tipo_identificacion', 'id_identificacion'],
      acceso:    ['id_rol_usuario', 'id_congregacion', 'id_usuario_publicador', 'id_usuario_estado'],
      seguridad: ['contrasena', 'confirmPassword']
   };

   readonly tabs: { id: UserFormTab; label: string }[] = [
      { id: 'datos', label: 'Datos' },
      { id: 'acceso', label: 'Acceso' },
      { id: 'seguridad', label: 'Seguridad' }
   ];

   /** Marca la pestaña que esconde un campo inválido ya tocado. */
   tabHasErrors(tab: UserFormTab): boolean {
      return this.TAB_FIELDS[tab].some(f => {
         const c = this.userForm.get(f);
         return !!c && c.invalid && c.touched;
      });
   }

   /** Primera pestaña con algún campo inválido (tocado o no). */
   private firstInvalidTab(): UserFormTab | null {
      for (const { id } of this.tabs) {
         if (this.TAB_FIELDS[id].some(f => this.userForm.get(f)?.invalid)) return id;
      }
      // Un error de grupo (contraseñas que no coinciden) no cuelga de ningún control.
      return this.userForm.errors ? 'seguridad' : null;
   }

   // ── Navegación del asistente ─────────────────────────────────────────

   currentStepIndex = computed(() => this.tabs.findIndex(t => t.id === this.activeTab()));
   isFirstStep = computed(() => this.currentStepIndex() === 0);
   isLastStep = computed(() => this.currentStepIndex() === this.tabs.length - 1);

   /** Un paso está completo cuando todos sus campos son válidos. Es lo que
    *  enciende el check del indicador: el usuario ve que ya puede avanzar. */
   stepIsValid(tab: UserFormTab): boolean {
      const camposOk = this.TAB_FIELDS[tab].every(f => {
         const c = this.userForm.get(f);
         return !c || c.valid;
      });
      // "No coinciden" es un error del grupo, no de un control suelto.
      if (tab === 'seguridad') return camposOk && !this.userForm.hasError('mismatch');
      return camposOk;
   }

   /** Editando se navega libre; creando, sólo hasta donde ya se ha llegado. */
   stepIsReachable(i: number): boolean {
      return !!this.editingUser() || i <= this.maxStepReached();
   }

   goToStep(i: number) {
      if (!this.stepIsReachable(i)) return;
      this.activeTab.set(this.tabs[i].id);
   }

   goBack() {
      const i = this.currentStepIndex();
      if (i > 0) this.activeTab.set(this.tabs[i - 1].id);
   }

   goNext() {
      const i = this.currentStepIndex();
      const tab = this.tabs[i].id;
      if (!this.stepIsValid(tab)) {
         // El botón no se deshabilita: se pulsa y explica qué falta, en vez
         // de quedarse apagado sin decir por qué.
         this.revealStepErrors(tab);
         return;
      }
      if (i < this.tabs.length - 1) {
         const next = i + 1;
         this.maxStepReached.set(Math.max(this.maxStepReached(), next));
         this.activeTab.set(this.tabs[next].id);
      }
   }

   /** Marca los campos del paso y lleva el foco al primero que falla. */
   private revealStepErrors(tab: UserFormTab) {
      this.TAB_FIELDS[tab].forEach(f => this.userForm.get(f)?.markAsTouched());
      this.cdr.detectChanges();
      const host = document.querySelector('[data-testid="panel-usuario"]');
      host?.querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid')?.focus();
   }

   // Alta rápida de publicador dentro del propio formulario de usuario
   showQuickPubForm = signal(false);
   quickPubError = signal<string | null>(null);
   savingQuickPub = signal(false);

   searchControl = this.fb.control('');

   userForm: FormGroup;
   quickPubForm: FormGroup;

   constructor() {
      this.quickPubForm = this.fb.group({
         primer_nombre: ['', [Validators.required, Validators.maxLength(100)]],
         primer_apellido: ['', [Validators.required, Validators.maxLength(100)]],
         telefono: ['']
      });

      this.userForm = this.fb.group({
         nombre: ['', Validators.required],
         correo: ['', [Validators.required, Validators.email]],
         contrasena: ['', [Validators.required, Validators.minLength(6)]],
         confirmPassword: ['', Validators.required],
         id_rol_usuario: [null, Validators.required],
         id_congregacion: [null],
         id_usuario_publicador: [null],
         id_usuario_estado: [1, Validators.required], // 1 = Activo por defecto
         telefono: [''],
         tipo_identificacion: ['CC'],
         id_identificacion: [''],
         debe_cambiar_contrasena: [true] // Default: true para mayor seguridad
      }, { validators: this.passwordMatchValidator });
   }

   // --- Custom Select Helpers ---



   updateRoleValidators(roleId: number) {
      const selectedRole = this.roles().find(r => r.id_rol === roleId);
      if (!selectedRole) return;

      // Usar nombre_rol o descripcion_rol para identificar si el rol es global
      const roleName = (selectedRole.nombre_rol || selectedRole.descripcion_rol || '').toLowerCase();
      const isGlobal = roleName.includes('administrador') || roleName.includes('gestor');

      const congControl = this.userForm.get('id_congregacion');
      const pubControl = this.userForm.get('id_usuario_publicador');

      if (isGlobal) {
         congControl?.clearValidators();
         pubControl?.clearValidators();
      } else {
         // La congregación solo es obligatoria para el Administrador (que puede elegir entre varias)
         if (this.isAdmin()) {
            congControl?.setValidators(Validators.required);
         } else {
            congControl?.clearValidators();
         }
         pubControl?.setValidators(Validators.required);
      }

      congControl?.updateValueAndValidity();
      pubControl?.updateValueAndValidity();
   }

   isCongregationRequired(): boolean {
      const control = this.userForm.get('id_congregacion');
      return control ? control.hasValidator(Validators.required) : false;
   }





   // --- Publisher Helpers ---


   selectPublicador(id: number) {
      this.userForm.get('id_usuario_publicador')!.setValue(id);
   }


   // --- Alta rápida de publicador ---

   /** Abre/cierra el mini-formulario. Al abrirlo cierra el desplegable de
    *  publicadores para que no queden los dos superpuestos. */
   toggleQuickPubForm() {
      this.showQuickPubForm() ? this.closeQuickPubForm() : this.openQuickPubForm();
   }

   /** Idempotente: la usa tanto el botón "+ Crear publicador nuevo" como la
    *  acción del propio desplegable cuando la congregación no tiene ningún
    *  publicador ("Sin resultados"), para no tener que cerrar el desplegable
    *  y buscar el enlace aparte. */
   openQuickPubForm() {
      this.quickPubForm.reset({ primer_nombre: '', primer_apellido: '', telefono: '' });
      this.quickPubError.set(null);
      this.showQuickPubForm.set(true);
   }

   private closeQuickPubForm() {
      this.quickPubError.set(null);
      this.showQuickPubForm.set(false);
   }

   /** Crea el publicador mínimo y lo deja seleccionado en el formulario de
    *  usuario. El resto de su ficha se completa desde el módulo de
    *  Publicadores; aquí solo se pide lo que el backend exige. */
   async submitQuickPublicador() {
      this.quickPubForm.markAllAsTouched();
      if (this.quickPubForm.invalid) return;

      const congId = this.quickPubCongregacionId();
      if (!congId) {
         this.quickPubError.set('Selecciona primero la congregación del usuario.');
         return;
      }

      const estadoActivo = this.estadosTeocraticos().find(e => e.nombre_estado.includes('Activo'));
      if (!estadoActivo) {
         this.quickPubError.set('No se pudo determinar el estado "Activo" del publicador. Créalo desde el módulo de Publicadores.');
         return;
      }

      this.quickPubError.set(null);
      this.savingQuickPub.set(true);

      try {
         const payload: PublicadorRapidoCreate = {
            primer_nombre: this.quickPubForm.value.primer_nombre.trim(),
            primer_apellido: this.quickPubForm.value.primer_apellido.trim(),
            telefono: this.quickPubForm.value.telefono?.trim() || undefined,
            id_congregacion_publicador: congId,
            id_estado_publicador: estadoActivo.id_estado
         };

         const nuevo = await lastValueFrom(this.service.createPublicadorRapido(payload));

         // Se añade a la lista local en vez de recargar: el nuevo publicador
         // aún no tiene usuario, así que entra igual en el filtro
         // "solo disponibles" que usa el modo creación.
         this.publicadores.update(list => [nuevo, ...list]);
         this.selectPublicador(nuevo.id_publicador);

         this.showQuickPubForm.set(false);
         this.quickPubForm.reset({ primer_nombre: '', primer_apellido: '', telefono: '' });

      } catch (err: any) {
         console.error('Error creando publicador rápido', err);
         const detail = err?.error?.detail;
         const motivo = typeof detail === 'string' ? detail : '';
         if (err?.status === 403) {
            this.quickPubError.set(motivo || 'No tienes permisos para crear publicadores en esta congregación.');
         } else {
            this.quickPubError.set(motivo || 'No se pudo crear el publicador. Intenta de nuevo.');
         }
      } finally {
         this.savingQuickPub.set(false);
      }
   }

   // --- Estado Helpers ---




   // --- ID Type Helpers ---




   // ── Opciones de los selectores ───────────────────────────────────────
   // app-select-picker se encarga del filtrado, el teclado y la presentación
   // (menú anclado en escritorio, hoja inferior en táctil).

   rolOptions = computed<PickerOption[]>(() =>
      this.roles().map(r => ({ value: r.id_rol, label: r.descripcion_rol }))
   );

   congregacionOptions = computed<PickerOption[]>(() =>
      this.congregaciones().map(c => ({ value: c.id_congregacion, label: c.nombre_congregacion }))
   );

   publicadorOptions = computed<PickerOption[]>(() =>
      this.publicadores().map(p => ({
         value: p.id_publicador,
         label: `${p.primer_nombre} ${p.primer_apellido}`,
         hint: p.telefono || undefined
      }))
   );

   estadoOptions = computed<PickerOption[]>(() => {
      const list = this.estados();
      if (list.length) return list.map(e => ({ value: e.id_estado, label: e.nombre_estado }));
      return [
         { value: 1, label: 'Usuario activo' },
         { value: 2, label: 'Usuario desactivado' }
      ];
   });

   idTypeOptions = computed<PickerOption[]>(() =>
      this.idTypes.map(t => ({ value: t.code, label: t.name }))
   );

   getUserStyle(name: string): string {
      return getInitialAvatarStyle(name);
   }

   // -----------------------------

   ngOnInit() {
      // Check for role filter from query params
      this.route.queryParams.subscribe(params => {
         if (params['rol']) {
            this.selectedRolFilter.set(Number(params['rol']));
         }
      });

      // Connect FormControl to signal for reactive filtering (debounced)
      this.searchControl.valueChanges.pipe(
         debounceTime(300),
         distinctUntilChanged(),
      ).subscribe(value => {
         this.searchQuery.set(value || '');
      });

      // Cambiar de congregación invalida el publicador elegido y obliga a
      // recargar la lista. Antes vivía dentro de selectCongregacion(); ahora que
      // el selector escribe directo en el control, se engancha al control.
      // El rol decide qué campos son obligatorios (los globales no llevan
      // congregación ni publicador).
      this.userForm.get('id_rol_usuario')!.valueChanges
         .pipe(distinctUntilChanged())
         .subscribe(id => {
            if (!this.patchingForm && id) this.updateRoleValidators(id);
         });

      // distinctUntilChanged es imprescindible, no una optimización:
      // updateValueAndValidity() (que llama updateRoleValidators) reemite
      // valueChanges con el MISMO valor. Sin este filtro, al abrir un usuario
      // en edición se interpretaba como un cambio de congregación y borraba el
      // publicador que se acababa de asignar, dejando el campo en "Seleccione...".
      this.userForm.get('id_congregacion')!.valueChanges
         .pipe(distinctUntilChanged())
         .subscribe(id => {
         if (this.patchingForm) return;
         this.userForm.get('id_usuario_publicador')!.setValue(null, { emitEvent: false });
         this.quickPubError.set(null);
         if (id) this.loadPublicadores(id, !this.editingUser());
         else this.publicadores.set([]);
      });

      this.loadData();
      this.loadAuxData();
   }

   /** Evita que un patchValue programático (abrir/editar) se confunda con una
    *  elección del usuario y borre el publicador que se acaba de asignar. */
   private patchingForm = false;

   // --- Role Filter Helpers ---
   getSelectedRolFilterName(): string {
      const id = this.selectedRolFilter();
      if (!id) return '';
      const rol = this.roles().find(r => r.id_rol === id);
      return rol ? rol.descripcion_rol : `Rol #${id}`;
   }

   clearRolFilter() {
      this.selectedRolFilter.set(null);
   }

   selectedCongregacionFilter = signal<number | null>(null);

   setCongFilter(event: Event) {
      const val = (event.target as HTMLSelectElement).value;
      this.selectedCongregacionFilter.set(val ? Number(val) : null);
   }

   clearAllFilters() {
      this.searchControl.setValue('');
      this.selectedRolFilter.set(null);
      this.selectedCongregacionFilter.set(null);
      this.congFilterDropdownOpen.set(false);
   }

   toggleCongFilterDropdown(btn: HTMLElement) {
      if (!this.congFilterDropdownOpen()) {
         const rect = btn.getBoundingClientRect();
         this.congFilterDropdownPos.set({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
      this.congFilterDropdownOpen.set(!this.congFilterDropdownOpen());
   }

   selectCongFilter(id: number | null) {
      this.selectedCongregacionFilter.set(id);
      this.congFilterDropdownOpen.set(false);
   }

   getCongFilterName(): string {
      const id = this.selectedCongregacionFilter();
      if (!id) return '';
      const c = this.congregaciones().find(x => x.id_congregacion === id);
      return c ? c.nombre_congregacion : '';
   }

   filteredUsuarios = computed(() => {
      const q = this.searchQuery().toLowerCase();
      const rolFilter = this.selectedRolFilter();
      const pageCongFilter = this.selectedCongregacionFilter();

      return this.usuarios().filter(u => {
         const matchesSearch = u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q);
         const matchesRol = rolFilter === null || u.id_rol_usuario === rolFilter;
         
         // Filtro directo seleccionado en el combo local de la página
         const matchesPageFilter = pageCongFilter === null || u.id_congregacion === pageCongFilter;
         
         return matchesSearch && matchesRol && matchesPageFilter;
      });
   });

   /** Distingue "la lista está vacía" de "los filtros no devuelven nada",
    *  para que el estado vacío ofrezca la salida correcta. */
   hasActiveFilters = computed(() =>
      !!this.searchQuery() || this.selectedRolFilter() !== null || this.selectedCongregacionFilter() !== null
   );

   totalUsuarios = computed(() => this.filteredUsuarios().length);
   usuariosActivos = computed(() => this.filteredUsuarios().filter(u => u.id_usuario_estado === 1).length);
   usuariosInactivos = computed(() => this.filteredUsuarios().filter(u => u.id_usuario_estado !== 1).length);

   async loadData() {
      try {
         // Usar endpoint apropiado según rol del usuario
         let data: Usuario[];
         if (this.isAdmin() || this.isGestor()) {
            // Admin/Gestor: ver todos los usuarios
            data = await lastValueFrom(this.service.getUsuarios());
         } else {
            // Coordinador/Secretario: solo usuarios de su congregación
            data = await lastValueFrom(this.service.getUsuariosMiCongregacion());
         }
         this.usuarios.set(data);
      } catch (err) {
         console.error(err);
      }
   }

   async loadAuxData() {
      // Intentar cargar cada uno por separado para que el fallo de uno no bloquee los demás

      if (this.isAdmin() || this.isGestor()) {
         // Admin/Gestor: cargar todos los roles desde el API
         try {
            const roles = await lastValueFrom(this.service.getRoles());
            this.roles.set(roles || []);
         } catch (err) {
            this.roles.set([]);
         }
      } else if (this.isCoordSecretario()) {
         // Coordinador/Secretario: usar endpoint propio que no requiere rol Admin
         try {
            const roles = await lastValueFrom(this.service.getRolesPermitidos());
            this.roles.set(roles || []);
         } catch (err) {
            // Fallback si el endpoint falla (no debería ocurrir para usuarios autenticados)
            console.warn('No se pudieron cargar los roles permitidos', err);
            this.roles.set([]);
         }
      }

      if (this.showCongregacionCol()) {
         try {
            const congs = await lastValueFrom(this.service.getCongregaciones());
            this.congregaciones.set(congs || []);
         } catch (err) {
            console.warn('Could not load congregaciones', err);
            this.congregaciones.set([]);
         }
      }

      try {
         // Filtrar solo estados de tipo 'Sistema' que corresponden a la cuenta de usuario
         const estados = await lastValueFrom(this.service.getEstados('Sistema'));
         this.estados.set(estados || []);
      } catch (err) {
         console.warn('Could not load estados, using fallbacks', err);
         // Fallback manual si el API de estados falla o no tiene permisos
         this.estados.set([
            { id_estado: 1, nombre_estado: 'Activo', tipo: 'Sistema' },
            { id_estado: 2, nombre_estado: 'Inactivo', tipo: 'Sistema' }
         ]);
      }

      // Estados 'Teocratico': necesarios solo para el alta rápida de publicador.
      // Sin fallback por ID: los ids reales dependen del orden del seed y
      // enviar uno inventado rompería la FK del publicador.
      if (this.canCreatePublicador()) {
         try {
            const estadosPub = await lastValueFrom(this.service.getEstados('Teocratico'));
            this.estadosTeocraticos.set(estadosPub || []);
         } catch (err) {
            console.warn('Could not load estados teocráticos', err);
            this.estadosTeocraticos.set([]);
         }
      }
   }

   async loadPublicadores(congId: number, soloDisponibles: boolean = false) {
      try {
         const pubs = await lastValueFrom(this.service.getPublicadores(congId, soloDisponibles));
         this.publicadores.set(pubs || []);
      } catch (err) {
         console.error('Error loading publicadores', err);
         this.publicadores.set([]);
      }
   }

   /** El desplegable de congregaciones se posiciona con coordenadas fijas
    *  calculadas al abrirlo. Si el panel se abre encima, queda flotando sobre
    *  él con la posición ya obsoleta; hay que cerrarlo antes. */
   private closeFloatingDropdowns() {
      this.congFilterDropdownOpen.set(false);
   }

   /** El alta rápida no debe sobrevivir a un cambio de contexto del panel. */
   private resetQuickPubForm() {
      this.showQuickPubForm.set(false);
      this.quickPubError.set(null);
      this.savingQuickPub.set(false);
      this.quickPubForm.reset({ primer_nombre: '', primer_apellido: '', telefono: '' });
   }

   openCreatePanel() {
      this.closeFloatingDropdowns();
      this.resetQuickPubForm();
      this.activeTab.set('datos');
      this.maxStepReached.set(0);

      this.editingUser.set(null);
      this.userForm.reset({ 
         tipo_identificacion: 'CC',
         id_usuario_estado: 1, // Activo
         debe_cambiar_contrasena: true // Por defecto pedir cambio en primer login
      });

      // Re-enable password validators for new users
      this.userForm.get('contrasena')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('confirmPassword')?.setValidators([Validators.required]);

      try {
         if (this.isAdmin() || this.isGestor()) {
            // Admin/Gestor: opcional hasta que seleccione rol que lo requiera
            this.userForm.get('id_congregacion')?.clearValidators();
            this.userForm.get('id_usuario_publicador')?.clearValidators();
            this.userForm.get('id_rol_usuario')?.setValidators([Validators.required]);
         } else if (this.isCoordSecretario()) {
            // Coordinador/Secretario: publicador y rol requeridos
            // El servidor valida que el rol sea 2, 3 o 6
            this.userForm.get('id_congregacion')?.clearValidators();
            this.userForm.get('id_usuario_publicador')?.setValidators([Validators.required]);
            this.userForm.get('id_rol_usuario')?.setValidators([Validators.required]);

            // Auto-cargar publicadores de su congregación
            const congId = this.currentUserCongregacion();
            if (congId) {
               this.loadPublicadores(congId, true); // Crear: Solo disponibles
            }
         }
      } catch (e) {
         console.error('Error in openCreatePanel logic', e);
      }

      // IMPORTANTE: Forzar actualización de validez de todos los controles
      Object.keys(this.userForm.controls).forEach(key => {
         this.userForm.get(key)?.updateValueAndValidity();
      });

      this.userForm.updateValueAndValidity();
      this.panelOpen.set(true);
   }

   openPermisos(u: Usuario) {
      if (u.id_usuario) {
         this.router.navigate(['/usuarios', u.id_usuario, 'permisos']);
      }
   }

   editUsuario(u: Usuario) {
      this.closeFloatingDropdowns();
      this.resetQuickPubForm();
      this.activeTab.set('datos');
      this.maxStepReached.set(this.tabs.length - 1); // editando se navega libre
      this.editingUser.set(u);
      this.patchingForm = true;
      this.userForm.patchValue({
         nombre: u.nombre,
         correo: u.correo,
         id_rol_usuario: u.id_rol_usuario,
         id_congregacion: u.id_congregacion,
         id_usuario_publicador: u.id_usuario_publicador,
         id_usuario_estado: u.id_usuario_estado,
         telefono: u.telefono,
         tipo_identificacion: u.tipo_identificacion,
         id_identificacion: u.id_identificacion,
         debe_cambiar_contrasena: false
      });
      this.patchingForm = false;

      if (u.id_congregacion) {
         this.loadPublicadores(u.id_congregacion, false); // Editar: Todos (incluyendo asignado actual)
      } else {
         this.publicadores.set([]);
      }

      // Disable password requirements for edit (optional update)
      this.userForm.get('contrasena')?.clearValidators();
      this.userForm.get('confirmPassword')?.clearValidators();
      this.userForm.get('contrasena')?.updateValueAndValidity();
      this.userForm.get('confirmPassword')?.updateValueAndValidity();

      // Update validators based on existing role
      if (u.id_rol_usuario) {
         this.updateRoleValidators(u.id_rol_usuario);
      }

      this.panelOpen.set(true);
   }

   closePanel() {
      this.closeFloatingDropdowns();
      this.resetQuickPubForm();
      this.panelOpen.set(false);
      this.editingUser.set(null);
      this.userForm.reset();
      this.saveError.set(null);
   }

   /** "luis mario" → "Luis Mario". Por palabra (no solo el primer carácter del
    *  campo) porque este input lleva el nombre completo, no un solo nombre.
    *  El reemplazo no cambia la longitud del texto, así que el cursor puede
    *  restaurarse exactamente donde estaba en vez de saltar al final. */
   capitalizeNombre(event: Event) {
      const input = event.target as HTMLInputElement;
      const inicio = input.selectionStart;
      const fin = input.selectionEnd;
      const valor = input.value;
      const normalizado = valor.replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      if (normalizado === valor) return;

      this.userForm.get('nombre')?.setValue(normalizado, { emitEvent: false });
      input.setSelectionRange(inicio, fin);
   }

   async save() {
      this.userForm.markAllAsTouched();
      if (this.userForm.invalid) {
         // Con pestañas el campo que falla puede estar oculto, así que hay que
         // llevar al usuario hasta él: un botón que no responde no explica nada.
         const tab = this.firstInvalidTab();
         if (tab) {
            // El paso al que se salta queda alcanzable, si no se bloquearía.
            this.maxStepReached.set(Math.max(this.maxStepReached(), this.tabs.findIndex(t => t.id === tab)));
            this.activeTab.set(tab);
            // detectChanges y no setTimeout: la pestaña destino tiene que estar
            // ya en el DOM para poder enfocar su primer campo inválido.
            this.cdr.detectChanges();
            const host = document.querySelector('[data-testid="panel-usuario"]');
            host?.querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid')?.focus();
         }
         return;
      }

      this.saveError.set(null);
      this.saving.set(true);

      try {
         const formValue = this.userForm.value;

         if (this.editingUser()) {
            // --- Modo edición ---
            const id = this.editingUser()!.id_usuario;
            if (id === undefined) {
               throw new Error('El usuario no tiene ID válido para editar');
            }

            const updatePayload: any = {
               nombre: formValue.nombre,
               correo: formValue.correo,
               id_usuario_estado: formValue.id_usuario_estado,
               telefono: formValue.telefono,
               tipo_identificacion: formValue.tipo_identificacion,
               id_identificacion: formValue.id_identificacion
            };

            // Admin/Gestor: pueden editar cualquier campo crítico
            // Coordinador/Secretario: pueden cambiar rol entre 2, 3 o 6 (validado en servidor)
            if (this.isAdmin() || this.isGestor()) {
               updatePayload.id_rol_usuario = formValue.id_rol_usuario;
               updatePayload.id_usuario_publicador = formValue.id_usuario_publicador;
            } else if (this.isCoordSecretario()) {
               updatePayload.id_rol_usuario = formValue.id_rol_usuario;
               // No se permite cambiar publicador por seguridad desde este flujo
            }

            if (formValue.contrasena) {
               updatePayload.contrasena = formValue.contrasena;
               updatePayload.debe_cambiar_contrasena = formValue.debe_cambiar_contrasena ?? false;
            }

            await lastValueFrom(this.service.updateUsuario(id, updatePayload));
            this.loadData();

         } else {
            // --- Modo creación ---
            let newUser: Usuario;

            if (this.isAdmin() || this.isGestor()) {
               // Admin/Gestor: crear usuario con cualquier rol
               const createPayload = {
                  nombre: formValue.nombre,
                  correo: formValue.correo,
                  contrasena: formValue.contrasena,
                  id_rol_usuario: formValue.id_rol_usuario,
                  id_usuario_publicador: formValue.id_usuario_publicador,
                  telefono: formValue.telefono,
                  tipo_identificacion: formValue.tipo_identificacion,
                  id_identificacion: formValue.id_identificacion,
                  id_usuario_estado: 1,
                  debe_cambiar_contrasena: formValue.debe_cambiar_contrasena ?? false
               };
               newUser = await lastValueFrom(this.service.createUsuario(createPayload));
            } else {
               // Coordinador/Secretario: usar endpoint restringido
               // El servidor valida que el rol elegido sea 2, 3 o 6
               const restrictedPayload: UsuarioCreatePublicador = {
                  nombre: formValue.nombre,
                  correo: formValue.correo,
                  contrasena: formValue.contrasena,
                  id_usuario_publicador: formValue.id_usuario_publicador,
                  id_rol_usuario: formValue.id_rol_usuario ?? 6,  // 6=Publicador por defecto
                  telefono: formValue.telefono,
                  tipo_identificacion: formValue.tipo_identificacion,
                  id_identificacion: formValue.id_identificacion,
                  debe_cambiar_contrasena: formValue.debe_cambiar_contrasena ?? false
               };
               newUser = await lastValueFrom(this.service.createUsuarioPublicador(restrictedPayload));
            }

            this.usuarios.update(list => [newUser, ...list]);

            // Mostrar diálogo de credenciales para enviar por WhatsApp
            this.lastCreatedCredentials.set({
               nombre: formValue.nombre,
               correo: formValue.correo,
               contrasena: formValue.contrasena,
               telefono: formValue.telefono
            });
            this.showCredentialsDialog.set(true);
         }

         this.closePanel();

      } catch (err: any) {
         console.error('Save error', err);
         const detail = err.error?.detail || 'Error desconocido';

         if (err.status === 403) {
            // El backend explica en 'detail' por qué se rechazó (el rol del
            // usuario objetivo, otra congregación, un campo que este rol no
            // puede tocar...). Antes se descartaba y se mostraba siempre el
            // mismo texto genérico, así que no había forma de saber si faltaba
            // un permiso, si el objetivo estaba fuera de alcance o si el fallo
            // era del formulario.
            const motivo = typeof detail === 'string' ? detail : '';
            this.saveError.set(motivo || 'Sin permisos suficientes para esta acción. Contacta al administrador.');
         } else {
            this.saveError.set('Error al guardar: ' + detail);
         }
      } finally {
         this.saving.set(false);
      }
   }

   passwordMatchValidator(g: AbstractControl) {
      return g.get('contrasena')?.value === g.get('confirmPassword')?.value
         ? null : { mismatch: true };
   }

   getRolName(u: Usuario): string {
      // Priority 1: Direct role name if available
      if (u.rol) return u.rol;
      // Priority 2: Roles array
      if (u.roles && u.roles.length > 0) return u.roles[0];
      // Priority 3: Lookup by ID in loaded roles
      if (u.id_rol_usuario) {
         const r = this.roles().find(r => r.id_rol === u.id_rol_usuario);
         if (r) return r.nombre_rol;

         // Fallback: Si el rol es 6 (Usuario Publicador) y no tenemos roles cargados
         if (u.id_rol_usuario === 6) return 'Usuario Publicador';
      }
      return 'Sin Rol';
   }

   getRolBadgeStyle(u: Usuario): string {
      const rolName = this.getRolName(u).toLowerCase();

      // Specific color mapping based on role name keywords
      if (rolName.includes('admin')) {
         return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50';
      }
      if (rolName.includes('secret')) {
         return 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50';
      }
      if (rolName.includes('super')) {
         return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50';
      }
      if (rolName.includes('coord')) {
         return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50';
      }
      if (rolName.includes('gestor')) {
         return 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50';
      }
      if (rolName.includes('public')) {
         return 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/50';
      }

      // Fallback: Use ID-based color if available
      const id = u.id_rol_usuario || 0;
      const colors = [
         'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50',
         'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800/50',
         'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50',
         'bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800/50',
         'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800/50'
      ];
      return colors[id % colors.length];
   }

   // --- Status Display Helpers ---

   getEstadoName(u: Usuario): string {
      const id = u.id_usuario_estado;
      if (id === 1) return 'Activo';
      if (id === 2) return 'Inactivo';
      return 'Desconocido';
   }

   getEstadoBadgeStyle(u: Usuario): string {
      const id = u.id_usuario_estado;
      if (id === 1) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-800/30';
      if (id === 2) return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/50';
      return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-100 dark:border-slate-700';
   }

   deleteUsuario(u: Usuario) {
      if (!u.id_usuario) return;
      this.userToDelete.set(u);
      this.showDeleteDialog.set(true);
   }

   cancelDelete() {
      this.showDeleteDialog.set(false);
      this.userToDelete.set(null);
      this.deleteError.set(null);
   }

   async confirmDelete() {
      const u = this.userToDelete();
      if (!u?.id_usuario) return;

      try {
         await lastValueFrom(this.service.deleteUsuario(u.id_usuario));
         this.usuarios.update(list => list.filter(item => item.id_usuario !== u.id_usuario));
         this.showDeleteDialog.set(false);
         this.userToDelete.set(null);
         this.deleteError.set(null);
      } catch (err: any) {
         console.error('Delete error', err);
         const detail = err.error?.detail || 'Error desconocido';
         this.deleteError.set('Error al eliminar: ' + detail);
      }
   }

   clearSearch() {
      this.searchControl.setValue('');
   }

   // --- Credentials Dialog (WhatsApp) ---

   closeCredentialsDialog() {
      this.showCredentialsDialog.set(false);
      this.lastCreatedCredentials.set(null);
   }

   /**
    * Envía las credenciales del diálogo post-creación por WhatsApp.
    * Requiere que tengamos la contraseña en texto plano (solo disponible justo después de crear).
    */
   sendCredentialsByWhatsApp() {
      const creds = this.lastCreatedCredentials();
      if (!creds) return;

      const telefono = this.normalizePhone(creds.telefono || '');
      const mensaje = this.buildCredentialMessage(creds.nombre, creds.correo, creds.contrasena);
      this.openWhatsApp(telefono, mensaje);
   }

   /**
    * Envía credenciales básicas (solo correo) por WhatsApp directamente desde la tabla.
    * NO incluye contraseña porque está hasheada en BD.
    */
   sendWhatsApp(u: Usuario) {
      if (!u.telefono) return;
      const telefono = this.normalizePhone(u.telefono);
      const mensaje = `Hola ${u.nombre}, te informamos que ya tienes acceso al Sistema GAC.\n\n📧 *Usuario (correo):* ${u.correo}\n\nPara iniciar sesión, ingresa a la plataforma con tu correo y la contraseña que te fue asignada.\n\n_Si tienes alguna duda, contacta al administrador._`;
      this.openWhatsApp(telefono, mensaje);
   }

   private buildCredentialMessage(nombre: string, correo: string, contrasena: string): string {
      return `Hola ${nombre}, aquí están tus credenciales de acceso al Sistema GAC:\n\n📧 *Usuario (correo):* ${correo}\n🔑 *Contraseña:* ${contrasena}\n\nTe recomendamos cambiar tu contraseña al iniciar sesión por primera vez.\n\n_Accede en: https://gac.kernelbyte.cloud_`;
   }

   private normalizePhone(telefono: string): string {
      // Remover caracteres no numéricos
      let digits = telefono.replace(/\D/g, '');
      // Si no tiene código de país y es un número colombiano de 10 dígitos, agregar 57
      if (digits.length === 10 && digits.startsWith('3')) {
         digits = '57' + digits;
      }
      // Si tiene 7 u 8 dígitos locales, agregar +57 (Colombia)
      if (digits.length <= 8) {
         digits = '57' + digits;
      }
      return digits;
   }

   private openWhatsApp(phone: string, message: string) {
      window.open(whatsappUrl(message, phone), '_blank', 'noopener,noreferrer');
   }
}


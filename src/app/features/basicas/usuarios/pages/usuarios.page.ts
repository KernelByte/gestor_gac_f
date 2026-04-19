import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { lastValueFrom, debounceTime, distinctUntilChanged } from 'rxjs';

import { UsuariosService, Rol, Congregacion, Estado, UsuarioCreatePublicador } from '../services/usuarios.service';
import { Usuario } from '../models/usuario.model';
import { AuthStore } from '../../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { getInitialAvatarStyle } from '../../../../core/utils/avatar-style.util';

@Component({
   standalone: true,
   selector: 'app-usuarios-page',
   imports: [CommonModule, ReactiveFormsModule],
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
  `]
})
export class UsuariosPage implements OnInit {
   private service = inject(UsuariosService);
   private fb = inject(FormBuilder);
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private authStore = inject(AuthStore);
   private congregacionContext = inject(CongregacionContextService);

   usuarios = signal<Usuario[]>([]);
   roles = signal<Rol[]>([]);
   congregaciones = signal<Congregacion[]>([]);
   estados = signal<Estado[]>([]);
   publicadores = signal<any[]>([]);

   // Modo restringido para Coordinador/Secretario
   isAdmin = computed(() => {
      const user = this.authStore.user();
      const roles = user?.roles ?? (user?.rol ? [user.rol] : []);
      return roles.map(r => (r || '').toLowerCase()).includes('administrador');
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

   showCongregacionCol = computed(() => {
      const user = this.authStore.user();
      const roles = user?.roles ?? (user?.rol ? [user.rol] : []);
      return roles.map(r => (r || '').toLowerCase()).some(r => r.includes('administrador') || r.includes('gestor'));
   });

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

   // Custom Select States
   roleDropdownOpen = signal(false);
   congDropdownOpen = signal(false);
   pubDropdownOpen = signal(false); // New
   estadoDropdownOpen = signal(false); // New
   idTypeDropdownOpen = signal(false); // ID Type dropdown

   // ID Types Definition
   readonly idTypes = [
      { code: 'CC', name: 'C.C.' },
      { code: 'CE', name: 'C.E.' },
      { code: 'TI', name: 'T.I.' },
      { code: 'PASSPORT', name: 'Pasaporte' }
   ];

   // Filtering states for dropdowns
   congSearch = signal('');
   pubSearch = signal('');
   selectedRolFilter = signal<number | null>(null); // Filter by role from query params
   searchQuery = signal(''); // Signal for reactive search
   searchExpanded = signal(false); // UI state for search expansion

   searchControl = this.fb.control('');

   userForm: FormGroup;

   constructor() {
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
         id_identificacion: ['']
      }, { validators: this.passwordMatchValidator });
   }

   // --- Custom Select Helpers ---

   getSelectedRoleName(): string | null {
      const id = this.userForm.get('id_rol_usuario')?.value;
      if (!id) return null;
      return this.roles().find(r => r.id_rol === id)?.descripcion_rol || null;
   }

   selectRole(id: number) {
      this.userForm.patchValue({ id_rol_usuario: id });
      this.roleDropdownOpen.set(false);
      this.updateRoleValidators(id);
   }

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

   isRoleSelected(id: number): boolean {
      return this.userForm.get('id_rol_usuario')?.value === id;
   }

   getSelectedCongName(): string | null {
      const id = this.userForm.get('id_congregacion')?.value;
      if (!id) return null;
      return this.congregaciones().find(c => c.id_congregacion === id)?.nombre_congregacion || null;
   }

   selectCongregacion(id: number) {
      this.userForm.patchValue({
         id_congregacion: id,
         id_usuario_publicador: null // Reset publisher when changing congregation
      });
      this.congDropdownOpen.set(false);
      this.loadPublicadores(id, true); // Crear: Solo disponibles
   }

   isCongSelected(id: number): boolean {
      return this.userForm.get('id_congregacion')?.value === id;
   }

   // --- Publisher Helpers ---

   getSelectedPubName(): string | null {
      const id = this.userForm.get('id_usuario_publicador')?.value;
      if (!id) return null;
      const p = this.publicadores().find(p => p.id_publicador === id);
      return p ? `${p.primer_nombre} ${p.primer_apellido}` : null;
   }

   selectPublicador(id: number) {
      this.userForm.patchValue({ id_usuario_publicador: id });
      this.pubDropdownOpen.set(false);
   }

   isPubSelected(id: number): boolean {
      return this.userForm.get('id_usuario_publicador')?.value === id;
   }

   // --- Estado Helpers ---

   getSelectedEstadoName(): string | null {
      const id = this.userForm.get('id_usuario_estado')?.value;
      if (!id) return null;
      
      const estado = this.estados().find(e => e.id_estado == id);
      if (estado) return estado.nombre_estado;

      // Fallback para estados de cuenta de usuario
      if (id == 1) return 'Usuario activo';
      if (id == 2) return 'Usuario desactivado';
      
      return null;
   }

   selectEstado(id: number) {
      this.userForm.patchValue({ id_usuario_estado: id });
      this.estadoDropdownOpen.set(false);
   }

   isEstadoSelected(id: number): boolean {
      return this.userForm.get('id_usuario_estado')?.value == id;
   }

   // --- ID Type Helpers ---

   getSelectedIdTypeName(): string | null {
      const code = this.userForm.get('tipo_identificacion')?.value;
      if (!code) return null;
      return this.idTypes.find(t => t.code === code)?.name || null;
   }

   selectIdType(code: string) {
      this.userForm.patchValue({ tipo_identificacion: code });
      this.idTypeDropdownOpen.set(false);
   }

   isIdTypeSelected(code: string): boolean {
      return this.userForm.get('tipo_identificacion')?.value === code;
   }

   // Filtered lists for dropdowns
   filteredCongregaciones = computed(() => {
      const q = this.congSearch().toLowerCase();
      return this.congregaciones().filter(c => c.nombre_congregacion.toLowerCase().includes(q));
   });

   filteredPublicadores = computed(() => {
      const q = this.pubSearch().toLowerCase();
      return this.publicadores().filter(p =>
         p.primer_nombre.toLowerCase().includes(q) ||
         p.primer_apellido.toLowerCase().includes(q)
      );
   });

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

      this.loadData();
      this.loadAuxData();
   }

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
   }

   filteredUsuarios = computed(() => {
      const q = this.searchQuery().toLowerCase();
      const rolFilter = this.selectedRolFilter();
      const congId = this.congregacionContext.effectiveCongregacionId();
      const pageCongFilter = this.selectedCongregacionFilter();

      return this.usuarios().filter(u => {
         const matchesSearch = u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q);
         const matchesRol = rolFilter === null || u.id_rol_usuario === rolFilter;
         
         // Filtro directo seleccionado en el combo local de la página
         const matchesPageFilter = pageCongFilter === null || u.id_congregacion === pageCongFilter;
         
         // Los administradores o usuarios de sistema (sin congregacion) siempre son visibles
         // para quien tiene los permisos de ver esta lista (en este caso el Administrador)
         // o si no hay congregacion seleccionada en el contexto.
         const isGlobalUser = !u.id_congregacion || 
                              [1, 2].includes(u.id_rol_usuario || 0) || 
                              (u.rol && (u.rol.toLowerCase().includes('administrador') || u.rol.toLowerCase().includes('gestor')));
                              
         const matchesCongContext = congId === null || isGlobalUser || u.id_congregacion === congId;
         
         return matchesSearch && matchesRol && matchesCongContext && matchesPageFilter;
      });
   });

   async loadData() {
      try {
         // Usar endpoint apropiado según rol del usuario
         let data: Usuario[];
         if (this.isAdmin()) {
            // Admin: ver todos los usuarios
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

      if (this.isAdmin()) {
         try {
            const roles = await lastValueFrom(this.service.getRoles());
            this.roles.set(roles || []);
         } catch (err) {
            this.roles.set([]);
         }
      }

      try {
         const congs = await lastValueFrom(this.service.getCongregaciones());
         this.congregaciones.set(congs || []);
      } catch (err) {
         console.warn('Could not load congregaciones', err);
         this.congregaciones.set([]);
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

   openCreatePanel() {
      console.log('openCreatePanel clicked');
      this.editingUser.set(null);
      this.userForm.reset({ 
         tipo_identificacion: 'CC',
         id_usuario_estado: 1 // Activo
      });

      // Re-enable password validators for new users
      this.userForm.get('contrasena')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('confirmPassword')?.setValidators([Validators.required]);

      try {
         if (this.isAdmin()) {
            // Admin: opcional hasta que seleccione rol que lo requiera
            this.userForm.get('id_congregacion')?.clearValidators();
            this.userForm.get('id_usuario_publicador')?.clearValidators();
            this.userForm.get('id_rol_usuario')?.setValidators([Validators.required]);
         } else {
            // Coordinador/Secretario: publicador requerido, rol NO requerido (forzado en servidor)
            this.userForm.get('id_rol_usuario')?.clearValidators();
            this.userForm.get('id_congregacion')?.clearValidators();
            this.userForm.get('id_usuario_publicador')?.setValidators([Validators.required]);

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
      this.editingUser.set(u);
      this.userForm.patchValue({
         nombre: u.nombre,
         correo: u.correo,
         id_rol_usuario: u.id_rol_usuario,
         id_congregacion: u.id_congregacion,
         id_usuario_publicador: u.id_usuario_publicador,
         id_usuario_estado: u.id_usuario_estado,
         telefono: u.telefono,
         tipo_identificacion: u.tipo_identificacion,
         id_identificacion: u.id_identificacion
      });

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
      this.panelOpen.set(false);
      this.editingUser.set(null);
      this.userForm.reset();
   }

   async save() {
      this.userForm.markAllAsTouched();
      if (this.userForm.invalid) return;

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

            // Solo Admin/Gestor pueden editar campos críticos como rol y publicador
            if (this.isAdmin()) {
               updatePayload.id_rol_usuario = formValue.id_rol_usuario;
               updatePayload.id_usuario_publicador = formValue.id_usuario_publicador;
            }

            if (formValue.contrasena) {
               updatePayload.contrasena = formValue.contrasena;
            }

            await lastValueFrom(this.service.updateUsuario(id, updatePayload));
            this.loadData();

         } else {
            // --- Modo creación ---
            let newUser: Usuario;

            if (this.isAdmin()) {
               // Admin: crear usuario con cualquier rol
               const createPayload = {
                  nombre: formValue.nombre,
                  correo: formValue.correo,
                  contrasena: formValue.contrasena,
                  id_rol_usuario: formValue.id_rol_usuario,
                  id_usuario_publicador: formValue.id_usuario_publicador,
                  telefono: formValue.telefono,
                  tipo_identificacion: formValue.tipo_identificacion,
                  id_identificacion: formValue.id_identificacion,
                  id_usuario_estado: 1
               };
               newUser = await lastValueFrom(this.service.createUsuario(createPayload));
            } else {
               // Coordinador/Secretario: usar endpoint restringido
               // El rol se fuerza a 6 (Usuario Publicador) en el servidor
               const restrictedPayload: UsuarioCreatePublicador = {
                  nombre: formValue.nombre,
                  correo: formValue.correo,
                  contrasena: formValue.contrasena,
                  id_usuario_publicador: formValue.id_usuario_publicador,
                  telefono: formValue.telefono,
                  tipo_identificacion: formValue.tipo_identificacion,
                  id_identificacion: formValue.id_identificacion
               };
               newUser = await lastValueFrom(this.service.createUsuarioPublicador(restrictedPayload));
            }

            this.usuarios.update(list => [newUser, ...list]);
         }

         this.closePanel();

      } catch (err: any) {
         console.error('Save error', err);
         const detail = err.error?.detail || 'Error desconocido';
         
         if (err.status === 403) {
            alert(`No tienes permisos suficientes para realizar esta acción. Si crees que esto es un error, por favor contacta al administrador del sistema o al equipo de soporte técnico.`);
         } else {
            alert('Error al guardar: ' + detail);
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
         return 'bg-emerald-50 text-emerald-700 border border-emerald-100/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30';
      }
      if (rolName.includes('secret')) {
         return 'bg-indigo-50 text-indigo-700 border border-indigo-100/50 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/30';
      }
      if (rolName.includes('super')) {
         return 'bg-blue-50 text-blue-700 border border-blue-100/50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30';
      }
      if (rolName.includes('coord')) {
         return 'bg-amber-50 text-amber-700 border border-amber-100/50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30';
      }
      if (rolName.includes('gestor')) {
         return 'bg-purple-50 text-purple-700 border border-purple-100/50 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/30';
      }
      if (rolName.includes('public')) {
         return 'bg-cyan-50 text-cyan-700 border border-cyan-100/50 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/30';
      }

      // Fallback: Use ID-based color if available
      const id = u.id_rol_usuario || 0;
      const colors = [
         'bg-rose-50 text-rose-700 border border-rose-100/50 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/30',
         'bg-teal-50 text-teal-700 border border-teal-100/50 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800/30',
         'bg-orange-50 text-orange-700 border border-orange-100/50 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30',
         'bg-pink-50 text-pink-700 border border-pink-100/50 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800/30',
         'bg-sky-50 text-sky-700 border border-sky-100/50 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800/30'
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
      if (id === 2) return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100/50 dark:border-red-800/30';
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
   }

   async confirmDelete() {
      const u = this.userToDelete();
      if (!u?.id_usuario) return;

      try {
         await lastValueFrom(this.service.deleteUsuario(u.id_usuario));
         this.usuarios.update(list => list.filter(item => item.id_usuario !== u.id_usuario));
      } catch (err: any) {
         console.error('Delete error', err);
         const detail = err.error?.detail || 'Error desconocido';
         alert('Error al eliminar: ' + detail);
      } finally {
         this.showDeleteDialog.set(false);
         this.userToDelete.set(null);
      }
   }

   clearSearch() {
      this.searchControl.setValue('');
   }
}

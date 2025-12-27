import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { lastValueFrom } from 'rxjs';

import { UsuariosService, Rol, Congregacion, UsuarioCreatePublicador } from '../services/usuarios.service';
import { Usuario } from '../models/usuario.model';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
   standalone: true,
   selector: 'app-usuarios-page',
   imports: [CommonModule, ReactiveFormsModule],
   animations: [
      trigger('listAnimation', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(10px)' }),
            animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
         ])
      ]),
      trigger('fadeIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(-5px)' }),
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
         ]),
         transition(':leave', [
            animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-5px)' }))
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

   usuarios = signal<Usuario[]>([]);
   roles = signal<Rol[]>([]);
   congregaciones = signal<Congregacion[]>([]);
   publicadores = signal<any[]>([]);

   // Modo restringido para Coordinador/Secretario
   isAdmin = computed(() => {
      const user = this.authStore.user();
      const roles = user?.roles ?? (user?.rol ? [user.rol] : []);
      return roles.map(r => (r || '').toLowerCase()).includes('administrador');
   });

   currentUserCongregacion = computed(() => {
      return this.authStore.user()?.id_congregacion ?? null;
   });

   panelOpen = signal(false);
   saving = signal(false);
   showPassword = signal(false);
   editingUser = signal<Usuario | null>(null);

   // Custom Select States
   roleDropdownOpen = signal(false);
   congDropdownOpen = signal(false);
   pubDropdownOpen = signal(false); // New
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
         telefono: [''],
         tipo_identificacion: [''],
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

      const roleName = selectedRole.descripcion_rol.toLowerCase().trim();
      const isGlobal = roleName === 'administrador' || roleName === 'gestor aplicación';

      const congControl = this.userForm.get('id_congregacion');
      const pubControl = this.userForm.get('id_usuario_publicador');

      if (isGlobal) {
         congControl?.clearValidators();
         pubControl?.clearValidators();
      } else {
         congControl?.setValidators(Validators.required);
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
      this.loadPublicadores(id);
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
      const n = (name || '').toLowerCase();
      const char = n.charCodeAt(0);

      // Deterministic pastel color mapping based on first char
      if (char % 5 === 0) return 'bg-purple-100 text-purple-700 ring-purple-600/20';
      if (char % 5 === 1) return 'bg-blue-100 text-blue-700 ring-blue-600/20';
      if (char % 5 === 2) return 'bg-emerald-100 text-emerald-700 ring-emerald-600/20';
      if (char % 5 === 3) return 'bg-orange-100 text-orange-700 ring-orange-600/20';
      return 'bg-cyan-100 text-cyan-700 ring-cyan-600/20';
   }

   // -----------------------------

   ngOnInit() {
      // Check for role filter from query params
      this.route.queryParams.subscribe(params => {
         if (params['rol']) {
            this.selectedRolFilter.set(Number(params['rol']));
         }
      });

      // Connect FormControl to signal for reactive filtering
      this.searchControl.valueChanges.subscribe(value => {
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

   clearAllFilters() {
      this.searchControl.setValue('');
      this.selectedRolFilter.set(null);
   }

   filteredUsuarios = computed(() => {
      const q = this.searchQuery().toLowerCase();
      const rolFilter = this.selectedRolFilter();

      return this.usuarios().filter(u => {
         const matchesSearch = u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q);
         const matchesRol = rolFilter === null || u.id_rol_usuario === rolFilter;
         return matchesSearch && matchesRol;
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
      try {
         const roles = await lastValueFrom(this.service.getRoles());
         this.roles.set(roles);
         const congs = await lastValueFrom(this.service.getCongregaciones());
         this.congregaciones.set(congs);
      } catch (err) {
         console.error('Aux data error', err);
      }
   }

   async loadPublicadores(congId: number) {
      try {
         const pubs = await lastValueFrom(this.service.getPublicadores(congId));
         this.publicadores.set(pubs || []);
      } catch (err) {
         console.error('Error loading publicadores', err);
         this.publicadores.set([]);
      }
   }

   openCreatePanel() {
      this.editingUser.set(null);
      this.userForm.reset();

      // Re-enable password validators for new users
      this.userForm.get('contrasena')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('confirmPassword')?.setValidators([Validators.required]);

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
            this.loadPublicadores(congId);
         }
      }

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
         telefono: u.telefono,
         tipo_identificacion: u.tipo_identificacion,
         id_identificacion: u.id_identificacion
      });

      if (u.id_congregacion) {
         this.loadPublicadores(u.id_congregacion);
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
      if (this.userForm.invalid) return;

      this.saving.set(true);

      try {
         const formValue = this.userForm.value;

         if (this.editingUser()) {
            // --- Modo edición (solo Admin puede editar actualmente) ---
            const id = this.editingUser()!.id_usuario;
            if (id === undefined) {
               throw new Error('El usuario no tiene ID válido para editar');
            }

            const updatePayload: any = {
               nombre: formValue.nombre,
               correo: formValue.correo,
               id_rol_usuario: formValue.id_rol_usuario,
               id_usuario_publicador: formValue.id_usuario_publicador,
               telefono: formValue.telefono,
               tipo_identificacion: formValue.tipo_identificacion,
               id_identificacion: formValue.id_identificacion
            };
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
         alert('Error al guardar: ' + (err.error?.detail || 'Desconocido'));
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
         return 'bg-emerald-50 text-emerald-700 border border-emerald-100/50';
      }
      if (rolName.includes('secret')) {
         return 'bg-indigo-50 text-indigo-700 border border-indigo-100/50';
      }
      if (rolName.includes('super')) {
         return 'bg-blue-50 text-blue-700 border border-blue-100/50';
      }
      if (rolName.includes('coord')) {
         return 'bg-amber-50 text-amber-700 border border-amber-100/50';
      }
      if (rolName.includes('gestor')) {
         return 'bg-purple-50 text-purple-700 border border-purple-100/50';
      }
      if (rolName.includes('public')) {
         return 'bg-cyan-50 text-cyan-700 border border-cyan-100/50';
      }

      // Fallback: Use ID-based color if available
      const id = u.id_rol_usuario || 0;
      const colors = [
         'bg-rose-50 text-rose-700 border border-rose-100/50',
         'bg-teal-50 text-teal-700 border border-teal-100/50',
         'bg-orange-50 text-orange-700 border border-orange-100/50',
         'bg-pink-50 text-pink-700 border border-pink-100/50',
         'bg-sky-50 text-sky-700 border border-sky-100/50'
      ];
      return colors[id % colors.length];
   }

   clearSearch() {
      this.searchControl.setValue('');
   }
}

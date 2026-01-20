export interface Usuario {
   id_usuario?: number;
   nombre: string;
   correo: string;
   // Rol info comes joined usually, or we use id_rol_usuario
   rol?: string; // name
   id_rol_usuario?: number;
   id_usuario_estado?: number;
   id_usuario_publicador?: number;
   id_congregacion?: number; // Needed? Maybe not in basic list, but for editing if we support it.
   // Roles array
   roles?: string[];
   telefono?: string;
   tipo_identificacion?: string;
   id_identificacion?: string;
}

export interface UsuarioCreate {
   nombre: string;
   correo: string;
   contrasena: string;
   id_rol_usuario?: number;
   id_usuario_estado?: number;
   id_usuario_publicador?: number;
   telefono?: string;
   tipo_identificacion?: string;
   id_identificacion?: string;
}

export interface UsuarioUpdate {
   nombre?: string;
   correo?: string;
   contrasena?: string;
   id_rol_usuario?: number;
   id_usuario_estado?: number;
   telefono?: string;
   tipo_identificacion?: string;
   id_identificacion?: string;
}

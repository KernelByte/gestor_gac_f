export interface PublicadorPrivilegio {
   id_publicador_privilegio: number;
   id_publicador: number;
   id_privilegio: number;
   fecha_inicio: string;
   fecha_fin?: string | null;

   // Incluye datos del privilegio expandidos si se necesitan en visualización
   // Dependiendo del schema de backend, puede venir anidado o no. 
   // El schema PublicadorPrivilegioOut backend no lo vi en detalle, pero asumiré forma básica.
}

export interface PublicadorPrivilegioCreate {
   id_publicador: number;
   id_privilegio: number;
   fecha_inicio: string;
   fecha_fin?: string | null;
}

export interface PublicadorPrivilegioUpdate {
   id_publicador?: number;
   id_privilegio?: number;
   fecha_inicio?: string;
   fecha_fin?: string | null;
}

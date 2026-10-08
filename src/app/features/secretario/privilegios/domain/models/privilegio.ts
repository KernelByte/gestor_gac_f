export interface Privilegio {
   id_privilegio: number;
   nombre_privilegio: string;
   /** Privilegios con el mismo grupo no pueden cruzarse en fechas. null = sin grupo. */
   grupo_exclusivo?: string | null;
}

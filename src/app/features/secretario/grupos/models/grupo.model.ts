export interface Grupo {
   id_grupo: number;
   nombre_grupo: string;
   capitan_grupo?: string | null;
   auxiliar_grupo?: string | null;
   id_congregacion_grupo: number;
   cantidad_publicadores?: number;
}

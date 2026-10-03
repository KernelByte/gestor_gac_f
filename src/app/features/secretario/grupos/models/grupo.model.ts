export interface Grupo {
   id_grupo: number;
   nombre_grupo: string;
   capitan_grupo?: string | null;
   auxiliar_grupo?: string | null;
   /** Vínculo real al publicador; el texto de arriba se deriva de él al guardar. */
   id_capitan?: number | null;
   id_auxiliar?: number | null;
   id_congregacion_grupo: number;
   cantidad_publicadores?: number;
}

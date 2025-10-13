import { Publicador } from '../../domain/models/publicador';

export function dtoToModel(dto: any): Publicador {
  return {
    id_publicador: dto.id_publicador,
    primer_nombre: dto.primer_nombre,
    segundo_nombre: dto.segundo_nombre,
    primer_apellido: dto.primer_apellido,
    segundo_apellido: dto.segundo_apellido,
    direccion: dto.direccion,
    barrio: dto.barrio,
    telefono: dto.telefono,
    fecha_bautismo: dto.fecha_bautismo,
    ungido: dto.ungido,
    fecha_nacimiento: dto.fecha_nacimiento,
    sexo: dto.sexo,
    consentimiento_datos: dto.consentimiento_datos,
    id_congregacion_publicador: dto.id_congregacion_publicador,
    id_grupo_publicador: dto.id_grupo_publicador,
    id_estado_publicador: dto.id_estado_publicador,
    fecha_creacion: dto.fecha_creacion,
    fecha_actualizacion: dto.fecha_actualizacion,
  };
}

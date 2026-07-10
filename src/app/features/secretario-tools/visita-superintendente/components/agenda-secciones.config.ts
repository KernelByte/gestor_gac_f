/**
 * Secciones adicionales de la agenda de la Visita del Superintendente,
 * espejo del formulario en papel. Compartidas entre la pantalla del
 * secretario y la pantalla del colaborador.
 *
 * Debe mantenerse alineada con SECCIONES_DEF del backend
 * (modules/secretario/visita_superintendente/visita_agenda_service.py).
 */

export interface SeccionField {
  key: string;
  label: string;
  type: 'text' | 'time' | 'tel' | 'select';
  placeholder?: string;
  options?: string[];
}

export interface SeccionConfig {
  id: string;
  label: string;
  desc: string;
  fields: SeccionField[];
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const SECCIONES_CONFIG: SeccionConfig[] = [
  {
    id: 'servicio_campo', label: 'Servicio del campo', desc: 'Puntos de encuentro casa en casa',
    fields: [
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'hora', label: 'Hora', type: 'time' },
      { key: 'lugar', label: 'Lugar de encuentro', type: 'text', placeholder: 'ej. Familia Males' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'ej. 318 3886843' },
      { key: 'direccion', label: 'Dirección', type: 'text', placeholder: 'ej. Calle 19b #13a-77' },
    ],
  },
  {
    id: 'estudios_superintendente', label: 'Estudios bíblicos · Superintendente', desc: 'Estudios que dirigirá el superintendente',
    fields: [
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'hora', label: 'Hora', type: 'time' },
      { key: 'nombre', label: 'Hermano/a', type: 'text', placeholder: 'Nombre del estudiante' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'Teléfono de contacto' },
      { key: 'publicacion', label: 'Publicación', type: 'text', placeholder: 'ej. Libro Disfrute' },
    ],
  },
  {
    id: 'estudios_esposa', label: 'Estudios bíblicos · Esposa', desc: 'Estudios que dirigirá la esposa del superintendente',
    fields: [
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'hora', label: 'Hora', type: 'time' },
      { key: 'nombre', label: 'Hermana', type: 'text', placeholder: 'Nombre de la estudiante' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'Teléfono de contacto' },
      { key: 'publicacion', label: 'Publicación', type: 'text', placeholder: 'ej. Libro Disfrute' },
    ],
  },
  {
    id: 'almuerzos', label: 'Invitaciones a almorzar', desc: 'Familias que hospedarán cada día',
    fields: [
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'familia', label: 'Familia', type: 'text', placeholder: 'ej. Familia Zapata' },
      { key: 'direccion', label: 'Dirección', type: 'text', placeholder: 'Dirección de la casa' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'Teléfono de contacto' },
    ],
  },
  {
    id: 'asuntos_ancianos', label: 'Asuntos para reunión de ancianos', desc: 'Temas para la reunión con el superintendente',
    fields: [
      { key: 'asunto', label: 'Asunto', type: 'text', placeholder: 'Tema a tratar (obligatorio en el formulario)' },
      { key: 'anciano', label: 'Anciano que lo expone', type: 'text', placeholder: 'Nombre del anciano' },
    ],
  },
  {
    id: 'pastoreo', label: 'Visitas de pastoreo', desc: 'Familias que visitará el superintendente',
    fields: [
      { key: 'familia', label: 'Hermano/a o familia', type: 'text', placeholder: 'ej. Familia Gil' },
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'hora', label: 'Hora', type: 'time' },
      { key: 'motivo', label: 'Razón o motivo', type: 'text', placeholder: 'ej. Visita de ánimo' },
      { key: 'anciano', label: 'Anciano que irá', type: 'text', placeholder: 'Nombre del anciano' },
      { key: 'publicacion', label: 'Publicación', type: 'text', placeholder: 'ej. w24 12 Artículo 51' },
    ],
  },
  {
    id: 'recomendaciones', label: 'Recomendaciones', desc: 'Hermanos a recomendar en la visita',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Nombre del hermano' },
      { key: 'rol', label: 'Recomendado como', type: 'select', options: ['Anciano', 'Siervo ministerial'] },
    ],
  },
  {
    id: 'remociones', label: 'Remociones', desc: 'Casos a tratar con el superintendente',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Nombre del hermano' },
      { key: 'rol', label: 'Rol actual', type: 'select', options: ['Anciano', 'Siervo ministerial'] },
    ],
  },
];

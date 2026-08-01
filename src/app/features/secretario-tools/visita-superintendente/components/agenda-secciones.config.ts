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
  type: 'text' | 'textarea' | 'time' | 'tel' | 'select' | 'publicador';
  placeholder?: string;
  options?: string[];
  /**
   * Solo para `type: 'publicador'`. Al elegir a alguien del listado, copia sus
   * datos a otras columnas de la misma fila: { campoDelPublicador: claveDeLaFila }.
   * El usuario puede corregir a mano lo que se rellenó.
   */
  autocompleta?: Partial<Record<'telefono' | 'direccion', string>>;
  /**
   * Solo para `type: 'publicador'`. Muestra el enlace "Ver tarjeta del
   * publicador" bajo el campo (si quien edita tiene permiso). Se reserva para
   * las recomendaciones, donde consultar el historial del hermano es parte de
   * la decisión; en el resto de secciones el selector solo sirve para rellenar.
   */
  verTarjeta?: boolean;
  /**
   * Papel del campo cuando la agenda se *lee* (portal, "Detalles de la visita").
   * No afecta al editor: solo decide cómo se pinta el valor.
   *
   * - `titulo`    — el "quién o dónde" de la entrada; se muestra grande y sin etiqueta.
   * - `subtitulo` — persona de contacto; etiqueta diminuta en línea con el valor.
   * - `tel`/`dir` — dato de contacto; se pinta con icono y la etiqueta queda
   *                 solo para lectores de pantalla.
   * - `insignia`  — valor corto y categórico (un rol), como píldora.
   * - `nota`      — texto libre largo; conserva su etiqueta y ocupa todo el ancho.
   *
   * Sin `rol` el campo se pinta como etiqueta + valor. Repetir "Familia",
   * "Anfitrión", "Dirección" y "Teléfono" en cada entrada era la mitad del
   * texto de la tarjeta y ninguna de su información.
   */
  rol?: 'titulo' | 'subtitulo' | 'tel' | 'dir' | 'insignia' | 'nota';
}

/**
 * Familia temática de la sección. El superintendente lee la agenda buscando
 * tres cosas distintas —dónde come y duerme, qué hace en el ministerio, qué
 * tratará con los ancianos— así que el portal las colorea por grupo en vez de
 * dar un tono distinto a cada sección (nueve colores serían ruido, no ayuda).
 */
export type SeccionGrupo = 'hospitalidad' | 'ministerio' | 'ancianos';

export interface SeccionConfig {
  id: string;
  label: string;
  desc: string;
  grupo: SeccionGrupo;
  fields: SeccionField[];
  /**
   * La sección describe UN solo hecho, no una lista: se muestra una única fila,
   * sin numeración ni botón de agregar. La fila se crea al abrir la sección.
   */
  unica?: boolean;
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const SECCIONES_CONFIG: SeccionConfig[] = [
  {
    id: 'hospedaje', label: 'Hospedaje', desc: 'Dónde se quedará el superintendente y quién lo recibe',
    grupo: 'hospitalidad',
    unica: true,
    fields: [
      { key: 'familia', label: 'Familia', type: 'text', placeholder: 'ej. Familia Zapata', rol: 'titulo' },
      {
        key: 'anfitrion', label: 'Anfitrión', type: 'publicador', placeholder: 'Buscar publicador…',
        autocompleta: { telefono: 'telefono', direccion: 'direccion' }, rol: 'subtitulo',
      },
      { key: 'direccion', label: 'Dirección', type: 'text', placeholder: 'Dirección de la casa', rol: 'dir' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'Teléfono de contacto', rol: 'tel' },
      {
        // Misma casa, otro teléfono: por eso solo autocompleta el teléfono.
        key: 'anfitrion2', label: 'Otro contacto en la casa', type: 'publicador',
        placeholder: 'Opcional', autocompleta: { telefono: 'telefono2' }, rol: 'subtitulo',
      },
      { key: 'telefono2', label: 'Teléfono del otro contacto', type: 'tel', placeholder: 'Opcional', rol: 'tel' },
    ],
  },
  {
    id: 'servicio_campo', label: 'Servicio del campo', desc: 'Puntos de encuentro casa en casa',
    grupo: 'ministerio',
    fields: [
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'hora', label: 'Hora', type: 'time' },
      { key: 'lugar', label: 'Lugar de encuentro', type: 'text', placeholder: 'ej. Familia Males', rol: 'titulo' },
      {
        key: 'anfitrion', label: 'Anfitrión', type: 'publicador', placeholder: 'Buscar publicador…',
        autocompleta: { telefono: 'telefono', direccion: 'direccion' }, rol: 'subtitulo',
      },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'ej. 318 3886843', rol: 'tel' },
      { key: 'direccion', label: 'Dirección', type: 'text', placeholder: 'ej. Calle 19b #13a-77', rol: 'dir' },
    ],
  },
  {
    id: 'estudios_superintendente', label: 'Estudios bíblicos · Superintendente', desc: 'Estudios que dirigirá el superintendente',
    grupo: 'ministerio',
    fields: [
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'hora', label: 'Hora', type: 'time' },
      {
        key: 'nombre', label: 'Hermano/a', type: 'publicador', placeholder: 'Buscar o escribir el nombre…',
        autocompleta: { telefono: 'telefono' }, rol: 'titulo',
      },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'Teléfono de contacto', rol: 'tel' },
      { key: 'publicacion', label: 'Publicación', type: 'text', placeholder: 'ej. Libro Disfrute', rol: 'nota' },
    ],
  },
  {
    id: 'estudios_esposa', label: 'Estudios bíblicos · Esposa', desc: 'Estudios que dirigirá la esposa del superintendente',
    grupo: 'ministerio',
    fields: [
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'hora', label: 'Hora', type: 'time' },
      {
        key: 'nombre', label: 'Hermana', type: 'publicador', placeholder: 'Buscar o escribir el nombre…',
        autocompleta: { telefono: 'telefono' }, rol: 'titulo',
      },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'Teléfono de contacto', rol: 'tel' },
      { key: 'publicacion', label: 'Publicación', type: 'text', placeholder: 'ej. Libro Disfrute', rol: 'nota' },
    ],
  },
  {
    id: 'almuerzos', label: 'Invitaciones a almorzar', desc: 'Familias que hospedarán cada día',
    grupo: 'hospitalidad',
    fields: [
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'familia', label: 'Familia', type: 'text', placeholder: 'ej. Familia Zapata', rol: 'titulo' },
      {
        key: 'anfitrion', label: 'Anfitrión', type: 'publicador', placeholder: 'Buscar publicador…',
        autocompleta: { telefono: 'telefono', direccion: 'direccion' }, rol: 'subtitulo',
      },
      { key: 'direccion', label: 'Dirección', type: 'text', placeholder: 'Dirección de la casa', rol: 'dir' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'Teléfono de contacto', rol: 'tel' },
    ],
  },
  {
    id: 'asuntos_ancianos', label: 'Asuntos para reunión de ancianos', desc: 'Temas para la reunión con el superintendente',
    grupo: 'ancianos',
    fields: [
      // El asunto encabeza la entrada: es lo que el superintendente busca al leer.
      { key: 'asunto', label: 'Asunto', type: 'textarea', placeholder: 'Tema a tratar (obligatorio en el formulario)', rol: 'titulo' },
      { key: 'anciano', label: 'Anciano que lo expone', type: 'publicador', placeholder: 'Buscar o escribir el anciano…', rol: 'subtitulo' },
    ],
  },
  {
    id: 'pastoreo', label: 'Visitas de pastoreo', desc: 'Familias que visitará el superintendente',
    grupo: 'ministerio',
    fields: [
      { key: 'familia', label: 'Hermano/a o familia', type: 'text', placeholder: 'ej. Familia Gil', rol: 'titulo' },
      { key: 'dia', label: 'Día', type: 'select', options: DIAS_SEMANA },
      { key: 'hora', label: 'Hora', type: 'time' },
      { key: 'motivo', label: 'Razón o motivo', type: 'textarea', placeholder: 'ej. Visita de ánimo', rol: 'nota' },
      { key: 'anciano', label: 'Anciano que irá', type: 'publicador', placeholder: 'Buscar o escribir el anciano…', rol: 'subtitulo' },
      { key: 'publicacion', label: 'Publicación', type: 'text', placeholder: 'ej. w24 12 Artículo 51', rol: 'nota' },
    ],
  },
  {
    id: 'recomendaciones', label: 'Recomendaciones', desc: 'Hermanos a recomendar en la visita',
    grupo: 'ancianos',
    fields: [
      {
        key: 'nombre', label: 'Nombre', type: 'publicador', placeholder: 'Buscar publicador…',
        autocompleta: { telefono: 'telefono', direccion: 'direccion' }, verTarjeta: true, rol: 'titulo',
      },
      { key: 'rol', label: 'Recomendado como', type: 'select', options: ['Anciano', 'Siervo ministerial'], rol: 'insignia' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', placeholder: 'Se completa al elegir el publicador', rol: 'tel' },
      { key: 'direccion', label: 'Dirección', type: 'text', placeholder: 'Se completa al elegir el publicador', rol: 'dir' },
    ],
  },
  {
    id: 'remociones', label: 'Remociones', desc: 'Casos a tratar con el superintendente',
    grupo: 'ancianos',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Nombre del hermano', rol: 'titulo' },
      { key: 'rol', label: 'Rol actual', type: 'select', options: ['Anciano', 'Siervo ministerial'], rol: 'insignia' },
    ],
  },
];

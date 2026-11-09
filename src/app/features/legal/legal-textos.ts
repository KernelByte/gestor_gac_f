/**
 * Datos compartidos de las páginas legales (/legal/*) y del aviso de aceptación.
 *
 * VERSION_TERMINOS debe coincidir con la del backend
 * (modules/basicas/legal/legal_service.py). Si se cambia el texto de forma
 * relevante, se suben las dos y todos vuelven a ver el aviso.
 */
export const VERSION_TERMINOS = '2026-11';
export const VIGENTE_DESDE = '12 de junio de 2026';
export const CONTACTO_GAC = 'kernelbyte4ever@gmail.com';
export const URL_POLITICA_JW_COLOMBIA =
  'https://www.jw.org/es/politica-de-privacidad/tratamiento-datos-personales/tratamiento-datos-personales-colombia/';
export const URL_SIC = 'https://www.sic.gov.co/';

export type SeccionLegal = 'privacidad' | 'terminos' | 'seguridad';

export const SECCIONES_LEGALES: { id: SeccionLegal; titulo: string; ruta: string }[] = [
  { id: 'privacidad', titulo: 'Privacidad', ruta: '/legal/privacidad' },
  { id: 'terminos',   titulo: 'Términos de uso', ruta: '/legal/terminos' },
  { id: 'seguridad',  titulo: 'Seguridad', ruta: '/legal/seguridad' },
];

/** Para qué usa GAC cada tipo de dato: las mismas finalidades de la política de la organización para Colombia. */
export const FINALIDADES: { modulo: string; finalidad: string }[] = [
  { modulo: 'Programa de reuniones, discursos y logística', finalidad: 'Organizar las reuniones y las asignaciones de la congregación.' },
  { modulo: 'Informes de predicación y tarjeta de publicador', finalidad: 'Llevar el Registro de Publicador de la Congregación.' },
  { modulo: 'Privilegios y nombramientos', finalidad: 'Determinar quién puede atender cada asignación o responsabilidad.' },
  { modulo: 'Visitas de pastoreo y grupos', finalidad: 'Ayudar a los ancianos a dar atención a los publicadores.' },
  { modulo: 'Contactos de emergencia', finalidad: 'Avisar a un familiar si hay una urgencia.' },
  { modulo: 'Territorios y salidas a predicar', finalidad: 'Organizar la predicación de la congregación.' },
  { modulo: 'Avisos y notificaciones', finalidad: 'Recordarle plazos y asignaciones.' },
];

/**
 * Medidas de seguridad, en lenguaje sencillo y sin detalles que ayuden a un atacante.
 * `icono`: nombre Lucide registrado en shared/icons.ts.
 */
export const MEDIDAS_SEGURIDAD: { titulo: string; texto: string; icono: string }[] = [
  { titulo: 'Conexión cifrada', texto: 'La información que viaja entre su equipo y el servidor va cifrada, de modo que nadie puede leerla en el trayecto.', icono: 'lock' },
  { titulo: 'Contraseñas que nadie puede ver', texto: 'Las contraseñas se guardan con un cifrado irreversible. Ni los administradores ni los desarrolladores pueden conocerlas.', icono: 'key-round' },
  { titulo: 'Verificación en dos pasos', texto: 'Puede activar un código adicional para ingresar. Para los administradores es obligatoria.', icono: 'smartphone' },
  { titulo: 'Cada congregación ve solo lo suyo', texto: 'La información de cada congregación se mantiene separada de la de las demás.', icono: 'building-2' },
  { titulo: 'Cada persona ve solo lo que necesita', texto: 'El acceso depende de la responsabilidad de cada persona. Un publicador solo ve su propia información.', icono: 'users' },
  { titulo: 'Sesiones que caducan', texto: 'La sesión se cierra automáticamente después de un tiempo, y puede cerrarse a distancia si pierde su teléfono.', icono: 'timer-reset' },
  { titulo: 'Copias de seguridad', texto: 'Se hacen copias automáticas para no perder información en caso de falla.', icono: 'database-backup' },
  { titulo: 'Sin publicidad ni rastreadores', texto: 'GAC no muestra anuncios ni usa herramientas de analítica, y no vende datos a nadie.', icono: 'ban' },
];

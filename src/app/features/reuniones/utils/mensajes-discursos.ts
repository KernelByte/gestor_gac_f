/**
 * Textos de WhatsApp de Discursos.
 *
 * Son un ESPEJO de `src/utils/discursos.ts` y `src/utils/programacion-reunion.ts`
 * de la app móvil (gestor-gac-mobile): a quien recibe el mensaje le tiene que
 * llegar el mismo texto sin importar desde qué plataforma se coordinó. Si se
 * cambia una redacción aquí, hay que cambiarla allá (y al revés). Son funciones
 * puras, sin Angular, para poder compararlas con las del móvil.
 */

/** Dónde y cuándo se reúne la congregación (viene con el mes, ver `DiscursosMesOut.salon`). */
export interface SalonCongregacion {
  nombre: string | null;
  direccion: string | null;
  /** 'Sabado' | 'Domingo', sin tilde. */
  dia_reunion: string | null;
  /** "HH:MM" */
  hora_reunion: string | null;
  /** Las dos o ninguna. */
  latitud: number | null;
  longitud: number | null;
}

const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** "16:00" → "4:00 p. m.". */
export function horaLegible(hora: string | null): string {
  if (!hora) return '';
  const [h, m] = hora.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hora;
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/** Enlace que abre el punto exacto en Google Maps (app o web, según el teléfono). */
export function urlGoogleMaps(latitud: number, longitud: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
}

/** "2026-09-12" → "sábado 12 de septiembre". Sin año: es una cita cercana. */
export function fechaParaMensaje(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`;
}

/** "2026-09-21" → "domingo 21 de septiembre de 2026". */
export function fechaLargaEs(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "2026-07-11" → "Sáb 11 jul". */
export function fechaConDia(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return iso;
  const dow = new Date(`${iso}T00:00:00`).getDay();
  return `${DIAS_CORTO[dow] ?? ''} ${d} ${MESES_CORTO[m - 1] ?? ''}`.trim();
}

/**
 * El título en negrita cursiva de WhatsApp (`*_…_*`). Si el propio título
 * trae `*` o `_`, WhatsApp cortaría el formato a medias: entonces va tal cual.
 */
function resaltarWhatsApp(texto: string): string {
  return /[*_]/.test(texto) ? texto : `*_${texto}_*`;
}

/** "110. La verdad" → "N.º 110, *_La verdad_*". El número queda fuera del resaltado. */
function discursoParaMensaje(titulo: string): string {
  const m = /^(\d{1,3})\.\s*(.+)$/.exec(titulo);
  return m ? `N.º ${m[1]}, ${resaltarWhatsApp(m[2])}` : resaltarWhatsApp(titulo);
}

/** "179. Título" (como lo guarda el catálogo) → `179 — “Título”`. Sin número al frente, tal cual. */
export function formatTemaDiscursoMensaje(tema: string): string {
  const m = /^(\d{1,3})\.\s*(.+)$/.exec(tema.trim());
  return m ? `${m[1]} — “${m[2]}”` : tema;
}

/**
 * El texto que se le manda al orador que viene.
 *
 * Forma: saludo, una frase, los datos en líneas cortas con un icono cada una y
 * la ubicación aparte. Lo que la congregación no tenga configurado se omite sin
 * dejar huecos; nada se inventa.
 */
export function mensajeRecordatorioEntrante(datos: {
  nombreOrador: string | null;
  /** "YYYY-MM-DD" */
  fecha: string;
  tituloDiscurso: string | null;
  grupoHospitalidad: string | null;
  salon?: SalonCongregacion | null;
}): string {
  const salon = datos.salon ?? null;
  const nombreOrador = datos.nombreOrador?.trim();
  const congregacion = salon?.nombre?.trim();
  const titulo = datos.tituloDiscurso?.trim();
  const grupo = datos.grupoHospitalidad?.trim();
  const direccion = salon?.direccion?.trim().replace(/\.+$/, '');
  const mapa =
    salon?.latitud != null && salon?.longitud != null
      ? urlGoogleMaps(salon.latitud, salon.longitud)
      : null;
  const hora = horaLegible(salon?.hora_reunion ?? null);

  const fecha = fechaParaMensaje(datos.fecha);

  const datosAsignacion = [`📅 Fecha: ${fecha.charAt(0).toUpperCase()}${fecha.slice(1)}`];
  if (titulo) datosAsignacion.push(`📖 Tema del discurso: ${discursoParaMensaje(titulo)}`);
  if (grupo) {
    // Los grupos suelen llamarse ya "Grupo # 3": no se escribe "grupo Grupo # 3".
    datosAsignacion.push(`🍽️ Hospitalidad: ${/^grupo\b/i.test(grupo) ? grupo : `grupo ${grupo}`}`);
  }

  const datosSalon: string[] = [];
  if (hora) datosSalon.push(`🕒 Hora de la reunión: ${hora}`);
  if (congregacion) datosSalon.push(`🏛️ Congregación: ${congregacion}`);
  if (direccion) datosSalon.push(`📍 Dirección: ${direccion}`);
  if (mapa) datosSalon.push(`🗺️ Ubicación: ${mapa}`);

  const bloques: string[] = [
    '🎤 *RECORDATORIO · DISCURSO PÚBLICO*',
    nombreOrador ? `Hola, hermano ${nombreOrador} 👋` : 'Hola, hermano 👋',
    'Nos alegra mucho contar con tu visita a nuestra congregación. Te recordamos los datos de tu asignación:',
    datosAsignacion.join('\n'),
  ];
  if (datosSalon.length) bloques.push('—', datosSalon.join('\n'));
  bloques.push(
    'Al finalizar la reunión nos gustaría compartir un rato contigo y acompañarte en algo de comer 😊',
    '¿Tienes pensado quedarte después de la reunión?\nY si es así, ¿cuántas personas vendrían contigo?\n¡Será un gusto recibirlos! 🤗',
  );
  return bloques.join('\n\n');
}

/**
 * El aviso al orador de nuestra congregación que sale a dar un discurso a otra.
 *
 * Mismo estilo que `mensajeRecordatorioEntrante`: título, saludo, los datos de
 * la asignación y, aparte, los del salón al que va con el contacto de quien lo
 * recibe allá. Lo que no se tenga se omite sin dejar huecos; nada se inventa.
 */
export function mensajeAvisoSaliente(datos: {
  nombreOrador: string | null;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:MM" */
  hora: string | null;
  congregacionDestino: string | null;
  temaDiscurso: string | null;
  direccionDestino: string | null;
  urlMapa: string | null;
  /** Contacto principal de la congregación destino, si está en el directorio. */
  contactoCoordinador?: { nombre: string | null; telefono: string | null } | null;
}): string {
  const nombreOrador = datos.nombreOrador?.trim();
  const tema = datos.temaDiscurso?.trim();
  const hora = horaLegible(datos.hora);
  const congregacion = datos.congregacionDestino?.trim();
  const direccion = datos.direccionDestino?.trim();
  const mapa = datos.urlMapa?.trim();
  const contacto = [datos.contactoCoordinador?.nombre?.trim(), datos.contactoCoordinador?.telefono?.trim()]
    .filter(Boolean)
    .join(', ');

  const fecha = fechaParaMensaje(datos.fecha);
  const datosAsignacion = [`📅 Fecha: ${fecha.charAt(0).toUpperCase()}${fecha.slice(1)}`];
  if (hora) datosAsignacion.push(`🕒 Hora: ${hora}`);
  if (tema) datosAsignacion.push(`💬 Discurso: ${discursoParaMensaje(tema)}`);

  const datosSalon: string[] = [];
  if (congregacion) datosSalon.push(`🏛️ Congregación: ${congregacion}`);
  if (direccion) datosSalon.push(`📍 Dirección: ${direccion}`);
  if (mapa) datosSalon.push(`🗺️ Ubicación: ${mapa}`);
  if (contacto) datosSalon.push(`📞 Contacto del coordinador: ${contacto}`);

  const bloques: string[] = [
    '🎤 *ASIGNACIÓN DE DISCURSO PÚBLICO*',
    nombreOrador ? `Hola, ${nombreOrador} 👋` : 'Hola 👋',
    'Te compartimos los datos de tu próximo discurso público:',
    datosAsignacion.join('\n'),
  ];
  if (datosSalon.length) bloques.push('—', datosSalon.join('\n'));
  bloques.push('¡Muchas gracias por tu disposición y apoyo! 🙌');
  return bloques.join('\n\n');
}

/** Confirma a la congregación destino la salida ya coordinada. */
export function mensajeWhatsappCongregacionDestino(datos: {
  nombreOrador: string | null;
  nombreContacto: string | null;
  fecha: string;
  hora: string | null;
  congregacionDestino: string | null;
  temaDiscurso: string | null;
}): string {
  const primerNombreContacto = datos.nombreContacto?.trim().split(' ')[0] || 'hermano';
  const nombreOrador = datos.nombreOrador?.trim() || 'nuestro hermano';

  const lineas = [
    `Hola, ${primerNombreContacto} 👋`,
    '',
    `Queremos confirmar la salida de ${nombreOrador} para presentar el discurso:`,
    '',
  ];
  if (datos.temaDiscurso?.trim()) {
    lineas.push(`📖 ${formatTemaDiscursoMensaje(datos.temaDiscurso.trim())}`);
  }
  lineas.push('');
  if (datos.congregacionDestino?.trim()) {
    lineas.push(`📍 Congregación: ${datos.congregacionDestino.trim()}`);
  }
  lineas.push(`📅 Fecha: ${fechaLargaEs(datos.fecha)}`);
  const hora = horaLegible(datos.hora);
  if (hora) lineas.push(`🕕 Hora: ${hora}`);
  lineas.push(
    '',
    '¿Nos confirmas por favor que todo sigue en orden?',
    '',
    'Muchas gracias. Quedamos atentos.',
  );
  return lineas.join('\n');
}

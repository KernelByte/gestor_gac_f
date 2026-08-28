/**
 * Construcción de enlaces para compartir por WhatsApp.
 *
 * ── Por qué NO se usa wa.me ──────────────────────────────────
 * El acortador `wa.me` destruye los emoji. Su redirect 302 hacia
 * `api.whatsapp.com` reescribe el parámetro `text` y, al hacerlo, sustituye
 * toda secuencia UTF-8 de 4 bytes por U+FFFD (el rombo con interrogante).
 * Comprobado:
 *
 *   wa.me/?text=%E2%80%A2  (•,  3 bytes) → %E2%80%A2   intacto
 *   wa.me/?text=%F0%9F%93%85 (📅, 4 bytes) → %EF%BF%BD   destruido
 *
 * Por eso el síntoma es tan desconcertante: las rayas, los bullets y los
 * caracteres acentuados llegan bien -son de 3 bytes o menos- y sólo se
 * rompen los emoji, que son justo los que superan U+FFFF. No es un problema
 * de fuentes en el móvil que recibe ni de cómo codificamos nosotros: el texto
 * sale bien de aquí y llega roto porque lo rompe el salto intermedio.
 *
 * `api.whatsapp.com/send` es el destino final al que wa.me redirige, así que
 * apuntar ahí directamente ahorra el redirect y conserva el mensaje entero.
 */

/**
 * Enlace para redactar un mensaje de WhatsApp.
 *
 * @param mensaje  Texto del mensaje. Puede llevar emoji y saltos de línea.
 * @param telefono Destinatario en formato internacional sin `+` ni espacios.
 *                 Si se omite, WhatsApp pide elegir el contacto — que es lo
 *                 que se quiere cuando el mensaje va a varias personas.
 */
export function whatsappUrl(mensaje: string, telefono?: string | null): string {
  const params = new URLSearchParams();
  const tel = (telefono ?? '').replace(/\D/g, '');
  if (tel) params.set('phone', tel);
  params.set('text', mensaje);
  return `https://api.whatsapp.com/send?${params.toString()}`;
}

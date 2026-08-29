/**
 * Cómo se llama un publicador en la interfaz.
 *
 * Espejo de `backend/.../secretario/publicadores/publicador_utils.py`. Si
 * cambias una regla aquí, cámbiala allí: el backend ya manda `nombre_mostrado`
 * resuelto en casi todas las respuestas, y este archivo es la red de seguridad
 * para las que aún envían los cuatro campos sueltos.
 *
 * Dos niveles de decisión, de más a menos específico:
 *   1. `nombre_visible` — alias propio de la persona; manda siempre.
 *   2. la regla de la congregación (`formato_nombre_visible`).
 *
 * En los componentes usa `nombreMostrado()` o el pipe `| nombrePublicador`.
 * `nombreLegal()` es para cuando hace falta el dato de la ficha y no la
 * presentación: el subtítulo de la pantalla de Publicadores, o cotejar contra
 * un nombre guardado como texto libre.
 */

export type FormatoNombre =
  | 'completo'
  | 'nombre_apellido'
  | 'apellido_nombre'
  | 'nombre_inicial';

export const FORMATOS_NOMBRE: FormatoNombre[] = [
  'completo',
  'nombre_apellido',
  'apellido_nombre',
  'nombre_inicial',
];

/** Etiquetas de la pantalla de Ajustes. */
export const ETIQUETA_FORMATO: Record<FormatoNombre, string> = {
  completo: 'Nombre completo',
  nombre_apellido: 'Nombre y apellido',
  apellido_nombre: 'Apellido, nombre',
  nombre_inicial: 'Nombre e inicial',
};

/** Lo mínimo que necesita este módulo. Cualquier DTO de publicador encaja. */
export interface ConNombre {
  primer_nombre?: string | null;
  segundo_nombre?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  nombre_visible?: string | null;
  /** Ya resuelto por el backend. Si viene, gana: evita recalcular. */
  nombre_mostrado?: string | null;
  /** Nombre ya compuesto en respuestas que no traen los cuatro campos. */
  nombre_completo?: string | null;
}

function limpio(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

/** Los cuatro campos de la ficha. Ignora el alias y la regla. */
export function nombreLegal(p: ConNombre | null | undefined): string {
  if (!p) return '';
  return [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
    .map(limpio)
    .filter(Boolean)
    .join(' ');
}

/**
 * Aplica una regla a los cuatro campos. Ignora el alias.
 *
 * Se expone aparte de `nombreMostrado` porque la ficha necesita enseñar
 * "así te verías sin alias" mientras se escriben los nombres.
 */
export function formatearNombre(
  p: ConNombre | null | undefined,
  formato: FormatoNombre = 'completo',
): string {
  if (!p) return '';
  const nombre = limpio(p.primer_nombre);
  const apellido = limpio(p.primer_apellido);

  switch (formato) {
    case 'nombre_apellido':
      return [nombre, apellido].filter(Boolean).join(' ');
    case 'apellido_nombre':
      // Sin apellido no hay nada que anteponer: la coma quedaría suelta.
      return apellido && nombre ? `${apellido}, ${nombre}` : apellido || nombre;
    case 'nombre_inicial':
      return nombre && apellido ? `${nombre} ${apellido[0].toUpperCase()}.` : nombre || apellido;
    default:
      return nombreLegal(p);
  }
}

/**
 * Cómo se llama esta persona en la app. **Es la que deben usar los componentes.**
 *
 * Prefiere lo que ya resolvió el backend; sólo compone cuando la respuesta trae
 * los campos sueltos. `formato` es para los pocos sitios que aún no reciben
 * `nombre_mostrado` y conocen la regla de la congregación.
 */
export function nombreMostrado(
  p: ConNombre | null | undefined,
  formato: FormatoNombre = 'completo',
): string {
  if (!p) return '';
  return (
    limpio(p.nombre_mostrado) ||
    limpio(p.nombre_visible) ||
    formatearNombre(p, formato) ||
    limpio(p.nombre_completo)
  );
}

/**
 * Iniciales del avatar, derivadas del nombre mostrado.
 *
 * Deriva del nombre mostrado y no de los campos originales a propósito: un
 * avatar "JP" junto al texto "Juan Gómez" se lee como un error de datos.
 * Devuelve "?" cuando no hay nada, igual que `app-avatar`.
 */
export function inicialesDe(
  p: ConNombre | string | null | undefined,
  formato: FormatoNombre = 'completo',
): string {
  const texto = (typeof p === 'string' ? p : nombreMostrado(p, formato)).replace(/,/g, ' ');
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

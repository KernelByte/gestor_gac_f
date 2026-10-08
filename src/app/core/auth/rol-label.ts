/**
 * Texto con el que se MUESTRA un rol. El nombre real del rol (`nombre_rol`) es
 * un identificador: el backend, la web y la app móvil ya publicada lo comparan
 * por texto ('Gestor Aplicación'), así que no se renombra. Solo cambia lo que
 * ve la persona.
 */
const ETIQUETAS: Record<string, string> = {
  'gestor aplicación': 'Gestor de Aplicación',
};

export function etiquetaRol(rol: string | null | undefined): string {
  const r = (rol ?? '').trim();
  return ETIQUETAS[r.toLowerCase()] ?? r;
}

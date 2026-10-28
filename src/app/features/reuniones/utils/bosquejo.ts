/**
 * Lectura del número de bosquejo en un texto de discurso ("120. Razones…",
 * "120 - Razones…", "120 Razones…" o solo "120").
 *
 * Es la misma regla que `_NUMERO_PREFIJO_RE` en el backend
 * (discursos_service.py), que es la que decide el aviso de discurso repetido:
 * hasta tres cifras al inicio, con o sin separador. Antes cada componente
 * tenía su propia expresión y no coincidían entre sí ni con el backend
 * ("120 Razones" o "120" a secas valían como el 120 en un sitio y no en otro).
 */
const NUMERO_PREFIJO = /^\s*(\d{1,3})\s*[.\-–:)]?\s*(.*)$/s;

/** Número y título de un texto de discurso; sin número, el texto tal cual. */
export function partirBosquejo(texto: string): { numero: number | null; titulo: string } {
  const m = NUMERO_PREFIJO.exec(texto ?? '');
  return m ? { numero: +m[1], titulo: m[2].trim() } : { numero: null, titulo: (texto ?? '').trim() };
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Si dos textos son el mismo bosquejo: por número cuando los dos lo llevan
 * ("120" y "120. Razones…"), y si no, por el texto sin tildes ni mayúsculas.
 */
export function mismoBosquejo(a: string, b: string): boolean {
  const na = partirBosquejo(a).numero;
  const nb = partirBosquejo(b).numero;
  if (na !== null && nb !== null) return na === nb;
  return normalizar(a) === normalizar(b);
}

/** "120. Razones…" → "Nº 120"; `null` si el texto no lleva número. */
export function etiquetaNumeroBosquejo(texto: string): string | null {
  const { numero } = partirBosquejo(texto);
  return numero === null ? null : `Nº ${numero}`;
}

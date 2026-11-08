/**
 * Texto legible del error de una petición al backend (FastAPI).
 *
 * `detail` puede ser un texto, una lista de errores de validación (422:
 * `[{ msg, loc, … }]`) o un objeto con `message`. Mostrarlo tal cual daba
 * «[object Object]» en los avisos.
 */
export function mensajeError(err: unknown, porDefecto: string): string {
  const d = (err as { error?: { detail?: unknown } } | null)?.error?.detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (Array.isArray(d) && d.length) {
    const msg = (d[0] as { msg?: unknown })?.msg;
    // Pydantic antepone «Value error, » a los mensajes propios.
    if (typeof msg === 'string' && msg.trim()) return msg.replace(/^Value error,\s*/i, '');
  }
  if (d && typeof d === 'object' && typeof (d as { message?: unknown }).message === 'string') {
    return (d as { message: string }).message;
  }
  return porDefecto;
}

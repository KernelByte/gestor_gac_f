/** Una celda de texto lista para CSV; si parece una fórmula de Excel (=, +, -, @) se neutraliza. */
function celda(valor: string | number | null | undefined): string {
  let t = valor == null ? '' : String(valor);
  if (/^[=+\-@]/.test(t) && Number.isNaN(Number(t))) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}

/**
 * Descarga una tabla como .csv. Separador «;» y marca UTF-8 (BOM): así Excel en español
 * abre las columnas y las tildes bien con doble clic.
 */
export function descargarCsv(nombreArchivo: string, filas: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): void {
  const csv = filas.map(f => f.map(celda).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

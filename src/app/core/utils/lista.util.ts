/** ['Ana', 'Luz', 'Eva'] → 'Ana, Luz y Eva'. */
export function unirLista(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

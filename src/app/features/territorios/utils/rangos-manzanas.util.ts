/**
 * «35, 36, 37, 40» → «35–37, 40». Los números de manzana son texto; solo se agrupan los enteros seguidos,
 * lo demás (p. ej. «12A») se deja tal cual.
 */
export function rangosDe(numeros: string[]): string {
  const enteros = [...new Set(numeros)].filter(n => /^\d+$/.test(n)).map(Number).sort((a, b) => a - b);
  const otros = [...new Set(numeros)].filter(n => !/^\d+$/.test(n));
  const partes: string[] = [];
  for (let i = 0; i < enteros.length; ) {
    let j = i;
    while (j + 1 < enteros.length && enteros[j + 1] === enteros[j] + 1) j++;
    partes.push(j - i >= 2 ? `${enteros[i]}–${enteros[j]}` : enteros.slice(i, j + 1).join(', '));
    i = j + 1;
  }
  return [...partes, ...otros].join(', ');
}

/** «manzana 5» / «manzanas 35–40»: con el sustantivo en singular o plural según cuántas sean. */
export function textoManzanas(numeros: string[]): string {
  const n = new Set(numeros).size;
  return n === 0 ? '' : `${n === 1 ? 'manzana' : 'manzanas'} ${rangosDe(numeros)}`;
}

/** Las tarjetas de una lista de manzanas, sin repetir y en orden: «T09, T10». */
export function codigosDe(manzanas: Array<{ codigo: string }>): string {
  return [...new Set(manzanas.map(m => m.codigo))].join(', ');
}

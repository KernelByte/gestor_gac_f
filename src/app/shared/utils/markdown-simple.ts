/**
 * Markdown mínimo para notas que escribe la gente (no documentos): negrita,
 * cursiva, listas, títulos cortos y enlaces. Todo el texto se escapa antes de
 * aplicar las reglas, y los enlaces solo aceptan http(s), así que el HTML que
 * sale es seguro para `[innerHTML]` (Angular además lo sanea).
 *
 *   **negrita**   *cursiva*   - viñeta   1. numerada   ## Título
 *   > cita   ---   [texto](https://…)   y cualquier https://… suelto
 *   ![pie](imagen:12)  solo si se pasa `imagen`, que da la dirección (blob:) de cada una
 */
export interface OpcionesMarkdown {
  /** id → dirección de la imagen ya cargada; null mientras carga o si falló. */
  imagen?: (id: number) => string | null;
}

export function markdownSimpleAHtml(texto: string, opciones: OpcionesMarkdown = {}): string {
  if (!texto?.trim()) return '';
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const enlace = (url: string, etiqueta: string) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${etiqueta}</a>`;

  let html = esc(texto)
    // Imagen sola en su renglón: figura con pie. Sin resolutor, se omite.
    .replace(/^!\[([^\]\n]*)\]\(imagen:(\d+)\)$/gm, (_m, pie: string, id: string) => {
      if (!opciones.imagen) return '';
      const src = opciones.imagen(Number(id));
      const cuerpo = src
        ? `<img src="${src}" alt="${pie}" loading="lazy">`
        : `<span class="img-cargando" aria-label="Cargando imagen"></span>`;
      return `<figure>${cuerpo}${pie ? `<figcaption>${pie}</figcaption>` : ''}</figure>`;
    })
    .replace(/^---+$/gm, '<hr>')
    .replace(/((?:^&gt; ?.*\n?)+)/gm, bloque =>
      `<blockquote>${bloque.trim().split('\n').map(l => l.replace(/^&gt; ?/, '')).join('<br>')}</blockquote>`)
    .replace(/^#{1,3} (.+)$/gm, '<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, '$1<em>$2</em>')
    // [texto](https://…) antes que las direcciones sueltas, para no enlazar dos veces.
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, etq: string, url: string) => enlace(url, etq))
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (_m, antes: string, url: string) => antes + enlace(url, url))
    .replace(/((?:^[ \t]*[-*•] .+\n?)+)/gm, bloque =>
      `<ul>${bloque.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*[-*•] /, '')}</li>`).join('')}</ul>`)
    .replace(/((?:^[ \t]*\d+[.)] .+\n?)+)/gm, bloque =>
      `<ol>${bloque.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*\d+[.)] /, '')}</li>`).join('')}</ol>`);

  html = html.split(/\n{2,}/).map(b => {
    const t = b.trim();
    if (!t) return '';
    if (/^<(h4|ul|ol|figure|hr|blockquote)/.test(t)) return t;
    return `<p>${t.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  return html;
}

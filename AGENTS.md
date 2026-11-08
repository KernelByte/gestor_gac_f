# Portal web (Angular) — instrucciones para agentes

Angular 20 standalone + signals + Tailwind v4. Responde y escribe la interfaz en español.

## Antes de crear o cambiar UI

Lee **[DESIGN.md](DESIGN.md)**: es la guía del sistema de diseño (color por módulo, tipografía, botones, acciones de fila, pestañas, formularios, modales, avisos, iconos, accesibilidad y cómo verificar). El catálogo vivo está en la ruta `/design-system`.

Reglas que no se negocian:

1. **No escribas a mano lo que ya existe.** Usa las recetas de `src/styles.scss` (`.btn-*`, `.btn-icon-sm`, `.row-actions`, `.tab-nav`, `.form-control`, `.card`, `.badge-*`…) y los componentes de `src/app/shared/components/` (`app-modal`, `app-confirm-dialog`, `ConfirmService`, `ToastService`, `app-aviso`, `app-empty-state`, pickers).
2. **El color lo da el tema del módulo** (`.tema-publicadores | -territorios | -exhibidores | -agenda | -reuniones` en el contenedor raíz; violeta por defecto). Informes es violeta.
3. **Una escala tipográfica:** `.page-title` 24 · `.section-title` 18 · `.card-title` 16 · `text-sm` 14 · `text-xs` 12 (mínimo). Nada de `text-[13px]` ni `font-black`.
4. **Iconos:** solo los registrados en `src/app/shared/icons.ts`. Editar = `square-pen`, eliminar = `trash-2`. Botones de icono siempre con `aria-label`.
5. **Prohibido:** `fixed inset-0`, `confirm()`/`alert()`, `animate-spin` propio, `violet-*`/`purple-*`, hex de superficie, `gray-*`, vidrio decorativo, franjas laterales de color, texto con degradado.
6. **Pensado para personas mayores:** texto ≥ 12 px, objetivos táctiles ≥ 40 px, etiquetas visibles, sin jerga.

## Verificar

- Compilación: el dev server está en Docker (`gac-frontend`). Fuerza un rebuild tocando un archivo y mira `docker logs --since 30s gac-frontend 2>&1 | grep -E "✘|NG[0-9]+:|TS[0-9]+" | grep -v "NG8107\|NG8102"` (vacío = bien). `ng build` en el host falla por dependencias ausentes; no es tu cambio.
- Patrones prohibidos: `scripts/ds-check.sh <módulo>` desde la raíz del repo.
- No corras la suite `e2e/` sin permiso: siembra usuarios y borra filas de prueba.
- Si añades un patrón nuevo al sistema, documéntalo en `/design-system` y en `DESIGN.md`.

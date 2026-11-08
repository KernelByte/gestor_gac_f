# Sistema de diseño del portal web — guía para agentes

Esta guía dice **cómo construir UI en el portal Angular** (`frontend/gestor_gac_f`) para que una pantalla nueva se vea y se comporte como las que ya existen. Léela antes de escribir una plantilla.

**Fuentes de verdad (en este orden):**
1. `src/styles.scss` — tokens y recetas (`@layer components`). Si una clase está aquí, úsala; no la copies.
2. Catálogo vivo `/design-system` — `src/app/features/design-system/design-system.page.ts`. Cada receta con ejemplo y nota «Usar / No usar».
3. `src/app/shared/components/` — componentes con comportamiento (modal, confirmación, aviso, vacío, pickers…).
4. `src/app/shared/icons.ts` — los únicos iconos Lucide disponibles.
5. `/.impeccable.md` (raíz del repo) — usuarios, tono de marca y principios.

Regla de oro: **antes de escribir algo a mano, búscalo en el catálogo.** Si no existe y lo vas a necesitar en más de un sitio, créalo en el sistema (ver «Extender el sistema») en vez de dentro de la pantalla.

---

## 1. Para quién diseñamos

- **Ancianos y siervos** administran desde escritorio (densidad media, precisión).
- **Publicadores** consultan desde el móvil, a menudo personas mayores: texto nunca menor a 12 px, objetivos táctiles de 40 px o más (44 px en móvil), etiquetas visibles, sin jerga ni abreviaturas, pasos numerados cuando haya un proceso.
- Todo el texto de la interfaz en **español claro**. Una pantalla = un propósito.
- Claro y oscuro tienen la misma calidad: todo componente se revisa en ambos.

---

## 2. Estructura de una pantalla

El shell (`layout/shell.page.ts`) ya pone el margen exterior (`px-4 md:px-8 pt-4 md:pt-6`). **La página no añade padding propio.**

```html
<!-- Contenedor raíz: el tema del módulo da el color a todo lo interactivo -->
<div class="tema-publicadores flex flex-col gap-3 h-full">

  <app-page-header title="Publicadores" subtitle="Lista de la congregación">
    <button type="button" class="btn-primary">Nuevo publicador</button>
  </app-page-header>

  <div class="tab-nav tab-compact shrink-0" role="tablist" aria-label="Secciones">…</div>

  <div class="card"> … contenido … </div>
</div>
```

- Título de pantalla: siempre `<app-page-header>` (o un `<h1 class="page-title">`). Nunca un `h1` con tamaño propio.
- Un solo botón primario por pantalla. El resto, secundario, fantasma o tonal.

---

## 3. Color

### Acento por módulo
El color de un módulo **no se escribe en los componentes**: se pone la clase de tema en el contenedor raíz y botón primario, pestaña activa, interruptor, foco y casillas leen `--accent`.

| Módulo | Clase | Color |
|---|---|---|
| App general, **Informes**, Reuniones, Herramientas, Administración, Configuración | ninguna (por defecto) o `.tema-reuniones` | violeta `brand-purple` `#6d28d9` |
| Publicadores (y Grupos, Contactos, Acceso app) | `.tema-publicadores` | naranja `brand-orange` `#f97316` |
| Territorios | `.tema-territorios` | verde `green-600` |
| Exhibidores | `.tema-exhibidores` | azul `exh-600` |
| Mi Agenda | `.tema-agenda` | rosa `#e11d48` |

- Informes es **violeta**, aunque esté junto a Publicadores.
- Para forzar un color fuera de su módulo: `.btn-primary-violet | -orange | -green | -blue`.
- Violeta: solo `brand-purple`. Prohibido `violet-600/700`, `purple-*` o `#6D28D9` literal.

### Color con significado
Verde = correcto/confirmado, ámbar = aviso/pendiente, rojo = error/eliminar, azul/sky = información. Úsalos solo con ese significado, nunca como decoración.

Excepción aprobada: la tarjeta de discursos **entrantes** usa sky = congregación, teal = orador, violeta = hospitalidad/presentado, emerald = confirmado. No la recolores.

### Superficies
- Tarjetas, modales y paneles: `bg-white dark:bg-slate-900` + `border-slate-200 dark:border-slate-800`.
- Fondo interior (bloques dentro de una tarjeta): `bg-slate-50 dark:bg-slate-950/40` (`.card-section`).
- Neutros: siempre `slate-*`, no `gray-*`. Nada de hex sueltos (`#1a1b26`, `#161d2c`…).
- Sin vidrio decorativo: `backdrop-blur` solo en el velo de los modales y en cabeceras fijas de tabla.
- Sin degradados de texto ni franjas laterales de color (`border-left` de más de 1 px).

---

## 4. Tipografía

Una sola escala para todo el portal. Rem fijos (es una app, no una web de marketing).

| Uso | Tamaño | Clase |
|---|---|---|
| Portada y pantallas de acceso | 48 | `.display-hero` |
| Título de cada pantalla (`h1`) | 24 | `.page-title` (vía `app-page-header`) |
| Título de bloque (`h2`) | 18 | `.section-title` |
| Título de tarjeta, panel o diálogo (`h3`) | 16 | `.card-title` |
| Texto destacado o de lectura larga | 16 | `.body-lg` |
| Texto base de la interfaz | 14 | `text-sm` |
| Ayudas, fechas, contadores, insignias | 12 | `.caption` / `text-xs` (mínimo absoluto) |
| Rótulo en mayúsculas sobre un título | 12 | `.eyebrow` |
| Cifras tabulares (fechas, totales, IDs) | — | `.data-num` |

- Familias: **Urbanist** (`font-display`) solo en títulos y cifras grandes; **Manrope** en todo lo demás; **JetBrains Mono** en `.data-num`.
- Pesos: títulos `font-bold`; énfasis `font-semibold`; texto `font-medium`/normal. **Nunca `font-black`.**
- **Nunca** tamaños sueltos: `text-[13px]`, `text-[15px]`, `text-[0.8125rem]`… usa la escala.
- Párrafos explicativos: limita la línea (`max-w-prose`).

---

## 5. Forma, espacio y movimiento

- Radios: controles (botón, input, select, pestaña) `rounded-xl` (12 px); tarjetas, modales y paneles `rounded-2xl` (16 px); insignias `rounded-full`.
- Espaciado en escala de 4 px (8, 12, 16, 24, 32, 48). Separa hermanos con `gap-*`, no con márgenes. Agrupa apretado lo relacionado y separa con más aire las secciones.
- No anides tarjetas dentro de tarjetas; usa `.card-section` o un divisor.
- Movimiento: entradas de 200–280 ms con `var(--ease-out-strong)`, solo `transform` y `opacity`. Presión `scale(0.97)`. Sin rebotes. Todo respeta `prefers-reduced-motion`.

---

## 6. Botones

| Clase | Uso |
|---|---|
| `.btn-primary` | La acción principal de la pantalla o del diálogo (color del tema) |
| `.btn-secondary` | Acciones secundarias con texto (borde neutro) |
| `.btn-ghost` | Acciones terciarias, «Cancelar» |
| `.btn-tonal` | Acción principal **con texto** dentro de una fila o tarjeta («Ver», «Marcar») |
| `.btn-danger` / `.btn-ghost-danger` | Eliminar con texto |
| `.btn-link` | Enlace dentro de un texto |
| `.btn-sm` (32 px) · `.btn-lg` (48 px, CTA móvil) | Tamaños; por defecto 40 px |

- Nada de `bg-brand-orange rounded-xl px-4 py-2…` a mano ni clases locales tipo `.btn-sec`, `.btn-primario`.
- Botón con carga: deshabilítalo y pon `<span class="spinner-sm"></span>` antes del texto.

### Botones de icono

| Clase | Tamaño | Dónde |
|---|---|---|
| `.btn-icon` | 40 px | Barras de herramientas, cabeceras |
| `.btn-icon-sm` | 36 px (44 en táctil) | **Acciones de fila** de listados |
| `.btn-icon-lg` | 44 px | Barras móviles |

Siempre con `aria-label` (y `title` si ayuda). El CSS ya fija el icono a 18 px y el trazo a 1.75: **no pongas `[size]`, `w-4 h-4` ni color al icono.** Neutros en reposo; al apuntar toman el acento del módulo.

---

## 7. Acciones de fila (listados)

Referencia: `features/basicas/usuarios/pages/usuarios.page.html`.

```html
<td>
  <div class="row-actions">
    <button type="button" class="btn-icon-sm" aria-label="Enviar acceso por correo" title="Enviar acceso por correo"><lucide-icon name="mail"></lucide-icon></button>
    <button type="button" class="btn-icon-sm tone-warning" aria-label="Permisos" title="Permisos"><lucide-icon name="lock"></lucide-icon></button>
    <button type="button" class="btn-icon-sm" aria-label="Editar" title="Editar"><lucide-icon name="square-pen"></lucide-icon></button>
    <button type="button" class="btn-icon-sm tone-danger" aria-label="Eliminar" title="Eliminar"><lucide-icon name="trash-2"></lucide-icon></button>
  </div>
</td>
```

- Contenedor: `.row-actions`. Iconos: `.btn-icon-sm`.
- Tonos al apuntar: `.tone-success` (WhatsApp, aprobar, confirmar), `.tone-warning` (permisos, rotar, advertencia), `.tone-danger` (eliminar, quitar, rechazar, revocar). Sin tono = acento del módulo.
- En filas clicables, cada botón lleva `$event.stopPropagation()`.
- Las acciones son siempre visibles (en táctil no hay hover).

### Vocabulario de iconos (un significado = un icono)

| Acción | Icono Lucide |
|---|---|
| Editar | `square-pen` (cuadrado con lápiz) |
| Eliminar | `trash-2` (papelera con dos rayas) |
| Permisos / bloquear | `lock` |
| Enviar por correo | `mail` |
| WhatsApp | `message-circle`, o el logo de WhatsApp en SVG relleno (única excepción al contorno) |
| Asignar personas | `user-plus` |
| Ver detalle | `eye` |
| Descargar / exportar | `download` |
| Copiar | `copy` |
| Abrir fuera | `external-link` |
| Más opciones | `more-vertical` |

Si usas SVG en línea: de contorno (`fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`), sin clases de tamaño, con el mismo dibujo que el icono Lucide de la tabla.

---

## 8. Pestañas

Un solo diseño: **canal hundido** (pista con borde y sombra interior) y la pestaña activa rellena con el acento del módulo. El relleno se desliza solo entre pestañas (`shared/utils/tab-indicator.ts`, global): no hay que programar nada.

```html
<div class="tab-nav tab-compact shrink-0" role="tablist" aria-label="Secciones de informes">
  @for (tab of tabs; track tab.id) {
    <button type="button" role="tab" class="tab-item"
            [attr.aria-selected]="activa() === tab.id" (click)="activa.set(tab.id)">
      <svg class="w-3.5 h-3.5 shrink-0" …></svg>
      <span class="truncate">{{ tab.label }}</span>
      <span class="tab-count">3</span>  <!-- opcional -->
    </button>
  }
</div>
```

- `.tab-nav` + `.tab-item`: secciones de una página o de un modal.
- `.tab-nav.tab-compact`: **barra de módulo** (Publicadores, Informes, Exhibidores, Agenda): pista `p-1.5`, pestañas de 36 px, texto de 12 px en negrita, icono de 14 px.
- `.segmented` + `.segmented-item`: el mismo diseño, compacto, para cambiar de vista o elegir opción dentro de un panel o formulario (`role="radiogroup"` + `aria-checked` si es una elección).
- `.w-full` en la pista reparte las pestañas a partes iguales.
- La activa se marca con `aria-selected="true"` (o `.is-active` / `.tab-item-active`). Nunca con colores a mano.
- **Sin `title`/tooltip** en las pestañas: ya muestran su texto.
- **El ancho de la barra no cambia al cambiar de pestaña.** Si la barra se pinta en varios sitios (por ejemplo, en una columna lateral en una pestaña y en la cabecera en otra), los contenedores deben tener el mismo ancho.
- Con muchas pestañas en móvil, la pista desplaza en horizontal; no encojas el texto.
- **Pestañas en la misma fila que una barra de herramientas** (Reuniones: pestañas + bandeja del mes): la pista no cede nunca (`shrink-0 max-w-full`). Pon `barraAdaptable` (`shared/directives/barra-adaptable.directive.ts`) en la fila y `data-bandeja` en la barra. Cuando falta ancho, primero se ocultan los `.barra-cede-1` (datos de apoyo que también estén en un `title`), luego los `.barra-cede-2` (rótulos de botones con icono y `aria-label`). Si ni así cabe, la barra baja a su propia línea bajo las pestañas. La acción principal y el estado no llevan esas clases: siempre muestran su texto.
- Prohibido: pestañas subrayadas, pills sueltas `bg-brand-purple shadow-md`, colores por pestaña.

---

## 9. Formularios

```html
<label class="form-label" for="nombre">Nombre</label>
<input id="nombre" class="form-control" />

<select class="form-select">…</select>

<label class="search-field">
  <lucide-icon name="search"></lucide-icon>
  <input class="search-input" placeholder="Buscar publicador" aria-label="Buscar publicador" />
</label>

<button type="button" class="switch" role="switch" [attr.aria-checked]="activo()" aria-label="Recordatorios"
        (click)="activo.set(!activo())"><span class="toggle-thumb"></span></button>
```

- Selectores ricos: `<app-select-picker>`, `<app-date-picker>`, `<app-time-picker>`, `<app-month-picker>`, `<app-publicador-picker>`. No los rehagas.
- Etiqueta siempre visible (el placeholder no es una etiqueta). Ayuda debajo con `.caption`.
- Errores: junto al campo, en rojo, diciendo cómo arreglarlo.
- Prohibido: inputs con anillos de color propios (`ring-brand-orange`), interruptores con `peer-checked`.

---

## 10. Insignias, tarjetas y tablas

- Insignias: `.badge-role`, `.badge-active`, `.badge-inactive`, `.badge-warning`, `.badge-info`, `.badge-neutral`, `.badge-live`. Un solo tamaño.
- Tarjetas: `.card`, `.card-padded`, `.card-interactive` (pulsable: cambia borde y sombra, no se eleva), `.card-elevated`, `.card-selected`, `.card-section`.
- Tablas: `.table-wrapper` > `table` con `.table-header-cell`, `.table-row`, `.table-cell`. Cabecera fija si la lista es larga. En móvil, la tabla se convierte en tarjetas de fila con las mismas `.row-actions`.

---

## 11. Superpuestos y avisos

| Necesidad | Usa |
|---|---|
| Diálogo centrado | `<app-modal variant="dialog">` |
| Hoja inferior en móvil, centrado en escritorio | `<app-modal variant="sheet">` |
| Detalle o edición lateral | `<app-modal variant="drawer">` |
| Confirmar una acción (con su propio estado) | `<app-confirm-dialog [busy]>` |
| Confirmar desde código | `await confirmService.ask({ title, message, severity })` |
| Sustituto de `alert()` | `await confirmService.notify({ title, message })` |
| Resultado de una acción («Guardado») | `ToastService.success / error / warning / info(título, descripción?)` |
| Mensaje dentro de la pantalla | `<app-aviso tone="info|success|warning|danger" [dense]>` |

```html
<app-modal [open]="abierto()" (openChange)="abierto.set($event)" title="Editar publicador"
           variant="sheet" size="md" [hasFooter]="true">
  @if (seleccionado(); as p) { … }   <!-- el contenido se evalúa aunque esté cerrado -->
  <div slot="footer">
    <button class="btn-ghost" (click)="abierto.set(false)">Cancelar</button>
    <button class="btn-primary" (click)="guardar()">Guardar</button>
  </div>
</app-modal>
```

- Velo: por defecto suave (2 px, el fondo se sigue leyendo). `velo="enfocado"` lo oscurece y desenfoca fuerte; úsalo en fichas de consulta abiertas sobre listas densas (vista rápida del publicador), no en formularios.
- `app-modal` ya trae velo, foco atrapado, Esc (cierra solo el de arriba), foco devuelto y z-index por token. `[controlled]="true"` si el padre debe poder rechazar el cierre («cambios sin guardar»); `[closeOnBackdrop]="false"` en formularios largos.
- `app-confirm-dialog` asíncrono: en `(confirmed)` pon `busy` a `true` **en el mismo tick**, y limpia el estado con `(openChange)="$event || estado.set(null)"`.
- Prohibido: `fixed inset-0` a mano, z-index sueltos (usa `--z-*`), `confirm()`/`alert()` nativos, sistemas de toast propios. Y no abuses del modal: si cabe en la pantalla, no lo pongas en un modal.

---

## 12. Carga, vacíos y errores

- Carga corta: `.spinner` (`-xs`, `-sm`, `-lg`), toma `currentColor`. Carga de lista o tarjeta: `.skeleton` con la forma del contenido.
- Vacío: `<app-empty-state title description actionLabel (action)>`; dentro de listas y tablas `[compact]="true"`. El vacío enseña qué hacer después, no solo «no hay datos».
- Error de carga: `<app-empty-state variant="error" actionLabel="Reintentar">`.
- Prohibido: `animate-spin` con un SVG propio, textos sueltos «No hay resultados» sin componente.

---

## 13. Iconos

- Solo Lucide registrados en `src/app/shared/icons.ts`. Para usar uno nuevo, impórtalo y añádelo a `APP_ICONS` (dos listas en el mismo archivo); si no, el icono no se pinta.
- Uso: `<lucide-icon name="square-pen"></lucide-icon>` (nombre en kebab-case).
- Dentro de `.btn-icon*` no indiques tamaño. Fuera, usa `[size]="16"` o `18` como máximo en texto, y nunca iconos grandes redondeados encima de cada título.

---

## 14. Accesibilidad (obligatorio)

- Todo botón solo-icono con `aria-label`. Pestañas con `role="tab"` + `aria-selected`; interruptores con `role="switch"` + `aria-checked`.
- Foco visible: las recetas ya lo traen (`focus-visible` con el acento); no lo quites con `outline-none`.
- Contraste ≥ 4.5:1 para texto. Nunca texto gris sobre fondo de color.
- Información nunca solo por color: acompaña con texto o icono.

---

## 15. Lista de prohibidos (resumen)

`fixed inset-0` · `confirm(` / `alert(` · `animate-spin` · `violet-600/700`, `purple-*`, `#6D28D9` · `#1a1b26` y hex de superficie · `backdrop-blur` decorativo · `text-[13px]` y tamaños sueltos · `font-black` · texto < 12 px · clases locales de botón (`btn-sec`, `btn-primario`, `btn-peligro`…) · botones de icono `w-8 h-8 …` a mano · `gray-*` · franjas laterales de color · texto con degradado · pestañas subrayadas o con tooltip · color de acento escrito a mano en vez de `.tema-*`.

---

## 16. Verificar antes de terminar

1. **Compila.** El dev server corre en Docker (`gac-frontend`) y recompila solo. Fuerza un rebuild (añade y quita una línea en blanco en un archivo tocado) y revisa:
   `docker logs --since 30s gac-frontend 2>&1 | grep -E "✘|NG[0-9]+:|TS[0-9]+" | grep -v "NG8107\|NG8102"` → debe salir vacío. (`ng build` local falla por dependencias que faltan en el host; no es tu cambio.)
2. **Medidor del sistema:** `scripts/ds-check.sh <módulo>` (desde la raíz del repo) lista archivo y línea de cada patrón prohibido. Lo que añadas no debe subir el contador.
3. **A ojo:** claro y oscuro, a 1440 px y a 390 px. Modales: Esc, clic en el velo, Tab atrapado.
4. **Sin e2e por defecto:** la suite de `e2e/` siembra usuarios de prueba y borra filas de test; pide permiso antes de correrla.

---

## 17. Extender el sistema

Cuando un patrón nuevo se repite (o se va a repetir):
1. Añade la receta en `src/styles.scss` dentro de `@layer components` (o un componente en `shared/components/` si tiene comportamiento), leyendo `--accent` en vez de un color fijo.
2. Documéntala en `/design-system` con un ejemplo vivo y su nota «Usar / No usar».
3. Añádela a esta guía.
4. Si es un patrón prohibido nuevo, súmalo a `scripts/ds-check.sh`.

import {
  AfterViewInit, Component, ElementRef, Injector, NgZone, OnDestroy, afterNextRender, effect,
  inject, signal, viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';
// Directo del paquete, no del reexport de shared/icons: con el reexport el
// compilador emitía rutas profundas a lucide-angular/lib/... en toda la app y
// el build fallaba (2026-11-08). Los iconos se registran igual en app.config.
import { LucideAngularModule } from 'lucide-angular';
import {
  CONTACTO_GAC, FINALIDADES, MEDIDAS_SEGURIDAD, SECCIONES_LEGALES,
  SeccionLegal, URL_POLITICA_JW_COLOMBIA, URL_SIC, VERSION_TERMINOS, VIGENTE_DESDE,
} from './legal-textos';

interface EntradaIndice { id: string; num: string; titulo: string; }

/**
 * Privacidad, Términos de uso y Seguridad: páginas públicas (sin sesión) que
 * enlazan el login, el aviso de aceptación y la app móvil.
 *
 * Escritas para personas mayores: frases cortas, sin siglas sin explicar,
 * texto de 16-17px y lo importante arriba. La política sigue el contenido
 * mínimo del art. 13 del Decreto 1377 de 2013 y las finalidades de la política
 * de la organización para Colombia.
 *
 * Composición de documento: cabecera fija con las tres pestañas, portada con el
 * resumen como entradilla, índice lateral que sigue la lectura (en móvil, un
 * desplegable) y el cuerpo a ~68 caracteres por línea. El índice se construye
 * leyendo los <h2> ya pintados, así el texto vive solo en la plantilla.
 *
 * Movimiento: una sola entrada escalonada al cargar o cambiar de documento
 * (fill backwards: al terminar no queda transform en ningún ancestro) y la
 * barra de progreso de lectura. El scroll (progreso e índice activo) corre fuera de
 * la zona de Angular para no disparar detección de cambios en cada evento.
 */
@Component({
  standalone: true,
  selector: 'app-legal-page',
  imports: [NgTemplateOutlet, RouterLink, LucideAngularModule],
  template: `
<div class="legal min-h-dvh">
  <div class="progreso" aria-hidden="true"><span #barra></span></div>

  <!-- ── Cabecera ─────────────────────────────────────────── -->
  <header class="barra">
    <div class="barra__fila envoltura">
      <a routerLink="/login" class="marca" aria-label="Suite GAC, ir a iniciar sesión">
        <img src="images/logo-gac-96.webp" alt="" width="28" height="28" />
        <span>Suite GAC</span>
      </a>

      <nav class="tab-nav segmentos segmentos--ancho" aria-label="Documentos legales">
        @for (s of secciones; track s.id) {
          <a [routerLink]="s.ruta" class="tab-item" [class.is-active]="s.id === seccion()"
             [attr.aria-current]="s.id === seccion() ? 'page' : null">{{ s.titulo }}</a>
        }
      </nav>

      <button type="button" class="btn-icon" (click)="theme.toggleTheme()"
              [attr.aria-label]="theme.darkMode() ? 'Usar tema claro' : 'Usar tema oscuro'"
              [title]="theme.darkMode() ? 'Tema claro' : 'Tema oscuro'">
        <lucide-icon [name]="theme.darkMode() ? 'sun' : 'moon'"></lucide-icon>
      </button>
    </div>

  </header>

    <nav class="segmentos-movil envoltura" aria-label="Documentos legales">
      <div class="tab-nav w-full">
        @for (s of secciones; track s.id) {
          <a [routerLink]="s.ruta" class="tab-item" [class.is-active]="s.id === seccion()"
             [attr.aria-current]="s.id === seccion() ? 'page' : null">{{ s.tituloCorto }}</a>
        }
      </div>
    </nav>

  <main>
    @switch (seccion()) {

      <!-- ═════════════ PRIVACIDAD ═════════════ -->
      @case ('privacidad') {
        <section class="portada envoltura">
          <div class="portada__texto">
            <p class="sobretitulo entra" style="--i:0"><lucide-icon name="scale" [size]="16"></lucide-icon>Documento legal</p>
            <h1 class="titular entra" style="--i:1">Política de privacidad</h1>
            <p class="entradilla entra" style="--i:2">
              La Suite GAC es una herramienta de trabajo al servicio de su congregación. Sus datos solo pueden
              consultarlos las personas de su congregación que están autorizadas. No se comercializan, no se usan
              con fines publicitarios y no se comparten con nadie ajeno a la congregación.
            </p>
            <ng-container *ngTemplateOutlet="meta; context: { conVersion: true }"></ng-container>
          </div>
          <ng-container *ngTemplateOutlet="emblema; context: { icono: 'file-text' }"></ng-container>
        </section>

        <div class="cuerpo envoltura" [class.cuerpo--sin-indice]="indice().length < 3">
          <ng-container *ngTemplateOutlet="indiceTpl"></ng-container>

          <article #doc class="doc entra" style="--i:4">
            <section>
              <h2><span class="num">1</span><span class="tit">Quién es responsable de sus datos</span></h2>
              <p>
                <strong>Su congregación</strong> decide qué datos se guardan y quién puede consultarlos. Es la
                responsable del tratamiento, tal como lo es de la tarjeta de publicador en papel.
              </p>
              <p>
                <strong>La Suite GAC</strong> es la herramienta con la que la congregación lleva esos registros. La
                desarrolla y mantiene un voluntario independiente (KernelByte, Candelaria, Valle del Cauca, Colombia),
                que actúa únicamente como encargado del tratamiento, por cuenta de la congregación. Contacto: <a [href]="'mailto:' + contactoGac">{{ contactoGac }}</a>.
              </p>
            </section>

            <section>
              <h2><span class="num">2</span><span class="tit">Su autorización</span></h2>
              <p>
                El tratamiento se basa en la autorización que cada publicador firma ante su congregación en el formulario
                <strong>“Notificación y consentimiento de uso de datos personales”</strong>. En el caso de los menores
                de edad, lo firma su padre, madre o representante legal. GAC conserva la constancia de esa firma.
              </p>
              <p>
                Además, la primera vez que usted ingresa, GAC le pide aceptar esta política y deja constancia de la
                fecha en que la aceptó.
              </p>
            </section>

            <section>
              <h2><span class="num">3</span><span class="tit">Para qué se usan sus datos</span></h2>
              <p>
                GAC utiliza sus datos exclusivamente para las finalidades descritas en la
                <a [href]="urlJw" target="_blank" rel="noopener">política de tratamiento de datos personales para Colombia<lucide-icon name="arrow-up-right" [size]="14" class="externo"></lucide-icon></a>
                de la organización:
              </p>
              <div class="finalidades" role="table" aria-label="Para qué se usa cada parte de GAC">
                <div class="finalidades__cabecera" role="row">
                  <span role="columnheader">Parte de GAC</span>
                  <span role="columnheader">Para qué sirve</span>
                </div>
                @for (f of finalidades; track f.modulo) {
                  <div class="finalidades__fila" role="row">
                    <span class="finalidades__modulo" role="cell">{{ f.modulo }}</span>
                    <span class="finalidades__fin" role="cell">{{ f.finalidad }}</span>
                  </div>
                }
              </div>
            </section>

            <section>
              <h2><span class="num">4</span><span class="tit">Qué datos se guardan</span></h2>
              <ul class="lista">
                <li><strong>Identificación y contacto:</strong> nombre, teléfono, correo, dirección, fecha de nacimiento y sexo.</li>
                <li><strong>Datos de la congregación:</strong> grupo, fecha de bautismo, privilegios y asignaciones.</li>
                <li><strong>Actividad:</strong> informes de predicación, asistencia a las reuniones y lectura de la Biblia.</li>
                <li><strong>Contacto de emergencia:</strong> nombre, teléfono y parentesco del contacto de emergencia.</li>
                <li><strong>Acceso:</strong> correo y contraseña (cifrada), o código PIN, y datos técnicos de la sesión.</li>
              </ul>
            </section>

            <section>
              <h2><span class="num">5</span><span class="tit">Datos sensibles y menores de edad</span></h2>
              <p>
                Según la ley colombiana, los datos que revelan una creencia religiosa son <strong>datos sensibles</strong>.
                Usted no está obligado a autorizar su tratamiento, y responder preguntas sobre ellos es facultativo.
              </p>
              <p>
                Los datos de menores de edad solo se guardan con la autorización de su padre, madre o representante
                legal, y siempre en atención al interés superior del menor.
              </p>
            </section>

            <section>
              <h2><span class="num">6</span><span class="tit">Otros servicios que intervienen</span></h2>
              <ul class="lista">
                <li><strong>Alojamiento:</strong> la información se guarda en un servidor contratado en Canadá. El proveedor solo presta el espacio de almacenamiento y no utiliza los datos.</li>
                <li><strong>Correo electrónico:</strong> se usa para enviar enlaces de acceso y avisos.</li>
                <li><strong>Notificaciones del teléfono:</strong> los servicios de Apple y Google entregan los avisos de la app.</li>
                <li>
                  <strong>Inteligencia artificial en Territorios:</strong> se usa para trazar las manzanas a partir de
                  imágenes del mapa. Solo recibe imágenes y nombres de calles, <strong>nunca datos de personas</strong>.
                </li>
              </ul>
            </section>

            <section>
              <h2><span class="num">7</span><span class="tit">Cuánto tiempo se guardan</span></h2>
              <p>
                Los datos se conservan solo mientras sean necesarios para esas finalidades. Si usted se traslada, su
                congregación puede enviar su información a la nueva congregación y eliminarla de sus registros.
              </p>
            </section>

            <section>
              <h2><span class="num">8</span><span class="tit">Sus derechos y cómo pedirlos</span></h2>
              <p>Conforme a la Ley 1581 de 2012, usted tiene derecho a:</p>
              <ul class="lista lista--check">
                <li>Conocer qué datos suyos se guardan y para qué se usan.</li>
                <li>Pedir que se corrijan o actualicen.</li>
                <li>Pedir que se eliminen, o retirar su autorización.</li>
                <li>Pedir prueba de la autorización que otorgó.</li>
              </ul>
              <ol class="pasos">
                <li><strong>Diríjase al secretario de su congregación.</strong> Él puede mostrarle sus datos, corregirlos o eliminar toda su información.</li>
                <li>Si lo prefiere, puede escribir primero al equipo de soporte de GAC: <a [href]="'mailto:' + contactoGac">{{ contactoGac }}</a>.</li>
                <li>Si no recibe respuesta, puede presentar una queja ante la <a [href]="urlSic" target="_blank" rel="noopener">Superintendencia de Industria y Comercio<lucide-icon name="arrow-up-right" [size]="14" class="externo"></lucide-icon></a>.</li>
              </ol>
              <p class="nota">
                <lucide-icon name="clock" [size]="16"></lucide-icon>
                <span>Las consultas se responden en un plazo máximo de diez (10) días hábiles, y los reclamos en uno de quince (15) días hábiles.</span>
              </p>
            </section>

            <section>
              <h2><span class="num">9</span><span class="tit">Cambios a esta política</span></h2>
              <p>
                Si esta política cambia de manera sustancial, GAC se la mostrará de nuevo al ingresar para que usted
                la acepte.
              </p>
            </section>
          </article>
        </div>
      }

      <!-- ═════════════ TÉRMINOS ═════════════ -->
      @case ('terminos') {
        <section class="portada envoltura">
          <div class="portada__texto">
            <p class="sobretitulo entra" style="--i:0"><lucide-icon name="scale" [size]="16"></lucide-icon>Documento legal</p>
            <h1 class="titular entra" style="--i:1">Términos de uso</h1>
            <p class="entradilla entra" style="--i:2">
              La Suite GAC es una herramienta independiente, desarrollada por voluntarios para apoyar el trabajo de
              las congregaciones. <strong>No es una aplicación desarrollada por la organización de Watch Tower Bible
              and Tract Society.</strong>
            </p>
            <ng-container *ngTemplateOutlet="meta; context: { conVersion: true }"></ng-container>
          </div>
          <ng-container *ngTemplateOutlet="emblema; context: { icono: 'scale' }"></ng-container>
        </section>

        <div class="cuerpo envoltura" [class.cuerpo--sin-indice]="indice().length < 3">
          <ng-container *ngTemplateOutlet="indiceTpl"></ng-container>

          <article #doc class="doc entra" style="--i:4">
            <section>
              <h2><span class="num">1</span><span class="tit">Quién puede usarla</span></h2>
              <p>
                Para entrar con una cuenta, la congregación debe haberle dado acceso. Cada congregación decide, por
                medio de su cuerpo de ancianos, si usa GAC. No existe un registro abierto al público.
              </p>
              <p>
                La app móvil también puede usarse <strong>sin cuenta</strong>, solo para llevar de forma personal su
                informe, sus revisitas y su lectura de la Biblia. En ese caso la información se guarda únicamente en
                su teléfono y no se envía a ningún servidor.
              </p>
            </section>

            <section>
              <h2><span class="num">2</span><span class="tit">Para qué se puede usar</span></h2>
              <p>
                Con una cuenta de su congregación, GAC debe usarse únicamente para sus labores: reuniones, informes,
                asignaciones, territorios y comunicación entre hermanos. No está permitido usarla con fines
                comerciales ni extraer datos fuera de la congregación.
              </p>
            </section>

            <section>
              <h2><span class="num">3</span><span class="tit">Su cuenta</span></h2>
              <ul class="lista">
                <li>Su contraseña y su PIN son personales e intransferibles. No los comparta con nadie.</li>
                <li>Si sospecha que otra persona ingresó con su cuenta, avise de inmediato al secretario de su congregación.</li>
                <li>
                  Guarde reserva sobre la información de otras personas que vea en GAC y úsela únicamente para cumplir
                  su responsabilidad. Por respeto a ellas, no la comparta con quien no esté autorizado.
                </li>
              </ul>
            </section>

            <section>
              <h2><span class="num">4</span><span class="tit">Lo que GAC no hace</span></h2>
              <ul class="lista lista--no">
                <li>No muestra publicidad.</li>
                <li>No vende ni comparte datos con empresas.</li>
                <li>No reemplaza los formularios ni las instrucciones de la organización.</li>
              </ul>
            </section>

            <section>
              <h2><span class="num">5</span><span class="tit">Disponibilidad</span></h2>
              <p>
                Procuramos que GAC esté disponible en todo momento. Aun así, puede haber interrupciones por
                mantenimiento o por fallas ajenas a nuestro control; por esa razón se hacen copias de seguridad
                automáticas.
              </p>
            </section>

            <section>
              <h2><span class="num">6</span><span class="tit">Privacidad</span></h2>
              <p>
                El tratamiento de sus datos se explica en la <a routerLink="/legal/privacidad">política de privacidad</a>.
              </p>
            </section>

            <section>
              <h2><span class="num">7</span><span class="tit">Contacto</span></h2>
              <p>
                Si tiene preguntas sobre GAC, escriba a <a [href]="'mailto:' + contactoGac">{{ contactoGac }}</a>.
                Si se refieren a sus datos personales, consulte primero al secretario de su congregación.
              </p>
            </section>
          </article>
        </div>
      }

      <!-- ═════════════ SEGURIDAD ═════════════ -->
      @case ('seguridad') {
        <section class="portada envoltura">
          <div class="portada__texto">
            <p class="sobretitulo sobretitulo--ok entra" style="--i:0"><lucide-icon name="shield-check" [size]="16"></lucide-icon>Seguridad</p>
            <h1 class="titular entra" style="--i:1">Cómo cuidamos su información</h1>
            <p class="entradilla entra" style="--i:2">
              Sus datos solo los consulta su congregación y, dentro de ella, únicamente las personas autorizadas.
              Estas son las principales medidas con las que GAC los protege.
            </p>
            <ng-container *ngTemplateOutlet="meta; context: { conVersion: false }"></ng-container>
          </div>
          <ng-container *ngTemplateOutlet="emblema; context: { icono: 'shield-check', ok: true }"></ng-container>
        </section>

        <div class="cuerpo envoltura cuerpo--sin-indice">
          <article #doc class="doc doc--ancho">
            <ul class="medidas" aria-label="Protecciones de GAC">
              @for (m of medidas; track m.titulo; let i = $index) {
                <li class="medida entra" [style]="'--i:' + (4 + i * 0.6)">
                  <span class="medida__icono" aria-hidden="true"><lucide-icon [name]="m.icono" [size]="20"></lucide-icon></span>
                  <span class="medida__cuerpo">
                    <strong class="medida__titulo">{{ m.titulo }}</strong>
                    <span class="medida__texto">{{ m.texto }}</span>
                  </span>
                </li>
              }
            </ul>

            <div class="consejos entra" style="--i:9">
              <section>
                <h2><span class="tit">Lo que usted puede hacer</span></h2>
                <ol class="pasos">
                  <li>Use una contraseña distinta de las que usa en otros sitios.</li>
                  <li>Active la verificación en dos pasos en su perfil.</li>
                  <li>No comparta su PIN ni su contraseña, ni siquiera con familiares.</li>
                  <li>Si pierde su teléfono, avise al secretario para que cierre su sesión.</li>
                </ol>
              </section>

              <p class="nota nota--suelta">
                <lucide-icon name="info" [size]="16"></lucide-icon>
                <span>
                  Ningún sistema es completamente infalible; por eso revisamos y mejoramos estas medidas con regularidad.
                  Si nota algo inusual, avise al secretario de su congregación o escriba a
                  <a [href]="'mailto:' + contactoGac">{{ contactoGac }}</a>.
                </span>
              </p>
            </div>
          </article>
        </div>
      }
    }

    <!-- ── Otros documentos ─────────────────────────────────── -->
    <footer class="pie envoltura">
      <p class="pie__rotulo">Otros documentos</p>
      <div class="pie__docs">
        @for (s of otrasSecciones(); track s.id) {
          <a [routerLink]="s.ruta" class="doc-enlace">
            <span class="doc-enlace__icono" aria-hidden="true"><lucide-icon [name]="s.icono" [size]="18"></lucide-icon></span>
            <span class="doc-enlace__texto">
              <span class="doc-enlace__titulo">{{ s.titulo }}</span>
              <span class="doc-enlace__desc">{{ s.descripcion }}</span>
            </span>
            <lucide-icon name="arrow-right" [size]="18" class="doc-enlace__flecha"></lucide-icon>
          </a>
        }
      </div>
      <div class="pie__base">
        <a routerLink="/login" class="btn-secondary"><lucide-icon name="arrow-left" [size]="16"></lucide-icon>Volver a iniciar sesión</a>
        <span class="pie__firma">© {{ anio }} Suite GAC</span>
      </div>
    </footer>
  </main>
</div>

<!-- ── Plantillas compartidas ───────────────────────────────── -->
<ng-template #meta let-conVersion="conVersion">
  <div class="meta entra" style="--i:3">
    <span class="meta__dato"><lucide-icon name="calendar" [size]="15"></lucide-icon>Vigente desde el {{ vigente }}</span>
    @if (conVersion) {
      <span class="meta__dato"><lucide-icon name="file-text" [size]="15"></lucide-icon>Versión {{ version }}</span>
    }
  </div>
</ng-template>

<ng-template #emblema let-icono="icono" let-ok="ok">
  <div class="emblema" [class.emblema--ok]="ok" aria-hidden="true">
    <svg viewBox="0 0 200 200" class="emblema__trazo">
      <rect x="20" y="20" width="160" height="160" rx="44" pathLength="1" />
      <rect x="44" y="44" width="112" height="112" rx="30" pathLength="1" />
    </svg>
    <span class="emblema__icono"><lucide-icon [name]="icono" [size]="44"></lucide-icon></span>
  </div>
</ng-template>

<ng-template #indiceTpl>
  @if (indice().length >= 3) {
    <aside class="indice entra" style="--i:3" aria-label="Contenido de la página">
      <p class="indice__rotulo">En esta página</p>
      <ol class="indice__lista">
        @for (e of indice(); track e.id) {
          <li>
            <button type="button" class="indice__item" [class.is-active]="e.id === activo()"
                    [attr.aria-current]="e.id === activo() ? 'true' : null" (click)="irA(e.id)">
              <span class="indice__num">{{ e.num }}</span>
              <span class="indice__tit">{{ e.titulo }}</span>
            </button>
          </li>
        }
      </ol>
    </aside>

    <details class="indice-movil entra" style="--i:3">
      <summary>
        <span>Contenido de la página</span>
        <span class="indice-movil__cuenta">{{ indice().length }}</span>
        <lucide-icon name="chevron-down" [size]="18" class="indice-movil__chevron"></lucide-icon>
      </summary>
      <ol class="indice__lista">
        @for (e of indice(); track e.id) {
          <li>
            <button type="button" class="indice__item" (click)="irA(e.id, $any($event.target).closest('details'))">
              <span class="indice__num">{{ e.num }}</span>
              <span class="indice__tit">{{ e.titulo }}</span>
            </button>
          </li>
        }
      </ol>
    </details>
  }
</ng-template>
  `,
  styles: [`
    /* ── Tokens locales (leen la paleta del sistema) ─────────── */
    :host {
      display: block;
      --l-lienzo: var(--color-slate-50);
      --l-papel: var(--color-white);
      --l-fuerte: var(--color-slate-900);
      --l-texto: var(--color-slate-700);
      --l-suave: var(--color-slate-600);
      --l-linea: var(--color-slate-200);
      --l-linea-suave: color-mix(in oklab, var(--color-slate-200) 60%, transparent);
      --l-tinte: color-mix(in oklab, var(--accent) 7%, var(--color-white));
      --l-tinte-borde: color-mix(in oklab, var(--accent) 18%, var(--color-white));
      --l-acento-tx: var(--accent);
      --l-ok: var(--color-emerald-600);
      --l-ok-bg: var(--color-emerald-50);
      --l-no: var(--color-rose-600);
      --l-enlace: var(--accent);
      --l-ease: var(--ease-out-strong, cubic-bezier(0.23, 1, 0.32, 1));
    }
    :host-context(.dark) {
      --l-lienzo: var(--color-slate-950);
      --l-papel: var(--color-slate-900);
      --l-fuerte: var(--color-slate-50);
      --l-texto: var(--color-slate-300);
      --l-suave: var(--color-slate-400);
      --l-linea: var(--color-slate-800);
      --l-linea-suave: color-mix(in oklab, var(--color-slate-800) 70%, transparent);
      --l-tinte: color-mix(in oklab, var(--accent) 14%, var(--color-slate-950));
      --l-tinte-borde: color-mix(in oklab, var(--accent) 30%, var(--color-slate-950));
      /* El violeta de marca no llega a 4.5:1 sobre el fondo oscuro. */
      --l-acento-tx: color-mix(in oklab, var(--accent) 45%, white);
      --l-ok: var(--color-emerald-400);
      --l-ok-bg: color-mix(in oklab, var(--color-emerald-500) 12%, transparent);
      --l-no: var(--color-rose-400);
      --l-enlace: color-mix(in oklab, var(--accent) 45%, white);
    }

    .legal { background: var(--l-lienzo); color: var(--l-texto); }
    .envoltura { width: 100%; max-width: 72rem; margin-inline: auto; padding-inline: clamp(1rem, 4vw, 2.5rem); }

    /* ── Progreso de lectura ─────────────────────────────────── */
    .progreso { position: fixed; inset: 0 0 auto 0; height: 3px; z-index: calc(var(--z-sticky) + 1); pointer-events: none; }
    .progreso span {
      display: block; height: 100%; background: var(--accent);
      transform: scaleX(0); transform-origin: 0 50%; will-change: transform;
    }

    /* ── Cabecera ─────────────────────────────────────────────── */
    .barra {
      position: sticky; top: 0; z-index: var(--z-sticky);
      background: var(--l-lienzo);
      border-bottom: 1px solid var(--l-linea);
    }
    .barra__fila { display: flex; align-items: center; gap: 1rem; height: 4rem; }
    .marca { display: inline-flex; align-items: center; gap: 0.625rem; min-height: 2.75rem; margin-right: auto;
             font-family: var(--font-display); font-weight: 700; font-size: 1rem; color: var(--l-fuerte); }
    .marca img { width: 1.75rem; height: 1.75rem; object-fit: contain; }
    .segmentos { display: none; }
    .segmentos-movil { padding-top: 1rem; }
    .segmentos-movil .tab-item { justify-content: center; }
    @media (min-width: 768px) {
      .segmentos { display: flex; }
      .segmentos-movil { display: none; }
    }

    /* ── Portada ──────────────────────────────────────────────── */
    .portada {
      display: grid; gap: 2rem; align-items: center;
      padding-top: clamp(2.5rem, 7vw, 5.5rem); padding-bottom: clamp(2rem, 5vw, 3.5rem);
    }
    @media (min-width: 1024px) { .portada { grid-template-columns: minmax(0, 1fr) 15rem; gap: 4rem; } }
    .portada__texto { max-width: 46rem; }
    .sobretitulo {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--l-acento-tx);
    }
    .sobretitulo--ok { color: var(--l-ok); }
    .titular {
      margin-top: 1rem; font-family: var(--font-display); font-weight: 800;
      font-size: clamp(2.125rem, 1.4rem + 3.2vw, 3.75rem); line-height: 1.04; letter-spacing: -0.03em;
      color: var(--l-fuerte); text-wrap: balance;
    }
    .entradilla {
      margin-top: 1.25rem; max-width: 40rem;
      font-size: clamp(1.0625rem, 1rem + 0.35vw, 1.25rem); line-height: 1.65; color: var(--l-texto); text-wrap: pretty;
    }
    .entradilla strong { color: var(--l-fuerte); font-weight: 700; }

    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.25rem; margin-top: 1.75rem; }
    .meta__dato { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; color: var(--l-suave); }

    /* Emblema: dos marcos que se dibujan una sola vez al llegar. */
    .emblema { display: none; position: relative; width: 15rem; aspect-ratio: 1; color: var(--l-acento-tx); }
    .emblema--ok { color: var(--l-ok); }
    @media (min-width: 1024px) { .emblema { display: grid; place-items: center; } }
    .emblema__trazo { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .emblema__trazo rect {
      fill: none; stroke: currentColor; stroke-width: 1.25; stroke-dasharray: 1; stroke-dashoffset: 0;
      animation: trazar 1100ms var(--l-ease) backwards;
    }
    .emblema__trazo rect:first-child { opacity: 0.35; }
    .emblema__trazo rect:last-child { opacity: 0.6; animation-delay: 160ms; }
    .emblema__icono {
      position: relative; display: grid; place-items: center; width: 5.5rem; height: 5.5rem; border-radius: 1.5rem;
      background: color-mix(in oklab, currentColor 12%, transparent);
      animation: asentar 520ms var(--l-ease) 380ms backwards;
    }
    @keyframes trazar { from { stroke-dashoffset: 1; } }
    @keyframes asentar { from { opacity: 0; transform: scale(0.9); } }

    /* ── Cuerpo con índice ────────────────────────────────────── */
    .cuerpo {
      display: grid; gap: 1.5rem; padding-bottom: clamp(3rem, 8vw, 6rem);
      border-top: 1px solid var(--l-linea); padding-top: clamp(1.75rem, 4vw, 3rem);
    }
    @media (min-width: 1024px) {
      .cuerpo { grid-template-columns: 15rem minmax(0, 1fr); gap: 4rem; }
      .cuerpo--sin-indice { grid-template-columns: minmax(0, 1fr); }
    }

    .indice { display: none; }
    @media (min-width: 1024px) {
      .indice { display: block; position: sticky; top: 5.5rem; align-self: start; max-height: calc(100dvh - 7rem); overflow-y: auto; }
      .indice-movil { display: none; }
    }
    .indice__rotulo, .pie__rotulo {
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--l-suave);
    }
    .indice__lista { margin-top: 0.75rem; display: grid; gap: 0.125rem; list-style: none; padding: 0; }
    .indice__item {
      display: flex; align-items: baseline; gap: 0.625rem; width: 100%; min-height: 2.5rem; padding: 0.5rem 0.75rem;
      border-radius: 0.75rem; text-align: left; font-size: 0.875rem; line-height: 1.4; color: var(--l-suave);
      transition: background-color 160ms ease, color 160ms ease;
    }
    .indice__num { font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.75rem; font-variant-numeric: tabular-nums; opacity: 0.7; min-width: 1rem; }
    @media (hover: hover) and (pointer: fine) {
      .indice__item:hover { color: var(--l-fuerte); background: var(--l-linea-suave); }
    }
    .indice__item.is-active { color: var(--l-acento-tx); background: var(--l-tinte); font-weight: 600; }
    .indice__item.is-active .indice__num { opacity: 1; }
    .indice__item:focus-visible { outline: 2px solid var(--accent-focus, var(--accent)); outline-offset: 2px; }

    .indice-movil {
      border: 1px solid var(--l-linea); border-radius: 1rem; background: var(--l-papel);
    }
    .indice-movil summary {
      display: flex; align-items: center; gap: 0.625rem; min-height: 3.25rem; padding: 0 1rem;
      font-weight: 600; color: var(--l-fuerte); cursor: pointer; list-style: none;
    }
    .indice-movil summary::-webkit-details-marker { display: none; }
    .indice-movil__cuenta {
      font-size: 0.75rem; font-weight: 700; padding: 0.125rem 0.5rem; border-radius: 999px;
      background: var(--l-tinte); color: var(--l-acento-tx);
    }
    .indice-movil__chevron { margin-left: auto; color: var(--l-suave); transition: transform 200ms var(--l-ease); }
    .indice-movil[open] .indice-movil__chevron { transform: rotate(180deg); }
    .indice-movil .indice__lista { margin: 0; padding: 0 0.5rem 0.5rem; }

    /* ── Documento ────────────────────────────────────────────── */
    .doc { min-width: 0; max-width: 42.5rem; font-size: 1.0625rem; line-height: 1.75; }
    .doc--ancho { max-width: none; }
    .doc > section + section { margin-top: clamp(2.5rem, 5vw, 3.5rem); }
    .doc h2 {
      display: flex; align-items: baseline; gap: 0.875rem; scroll-margin-top: 6.5rem;
      font-family: var(--font-display); font-weight: 700; font-size: clamp(1.25rem, 1.1rem + 0.5vw, 1.5rem);
      line-height: 1.25; letter-spacing: -0.015em; color: var(--l-fuerte); text-wrap: balance;
    }
    .doc h2 .num {
      flex: none; display: inline-grid; place-items: center; width: 2rem; height: 2rem; border-radius: 0.625rem;
      font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.875rem; font-weight: 600;
      font-variant-numeric: tabular-nums; letter-spacing: 0;
      background: var(--l-tinte); color: var(--l-acento-tx); transform: translateY(-0.1em);
    }
    .doc p, .doc .lista, .doc .pasos, .doc .finalidades { margin-top: 1rem; }
    .doc h2 + p, .doc h2 + .lista { margin-top: 1.125rem; }
    .doc p { text-wrap: pretty; }
    .doc strong { font-weight: 650; color: var(--l-fuerte); }
    .doc a:not(.btn-secondary):not(.doc-enlace) {
      color: var(--l-enlace); font-weight: 600; text-decoration: underline;
      text-decoration-color: color-mix(in oklab, currentColor 35%, transparent);
      text-decoration-thickness: 1.5px; text-underline-offset: 4px; overflow-wrap: anywhere;
      transition: text-decoration-color 160ms ease;
    }
    .doc a:not(.btn-secondary):hover { text-decoration-color: currentColor; }
    .externo { display: inline-block; margin-left: 0.15em; vertical-align: -0.1em; }

    /* Viñetas propias: un punto del acento, alineado con la primera línea. */
    .lista { list-style: none; padding: 0; display: grid; gap: 0.625rem; }
    .lista li { position: relative; padding-left: 1.5rem; }
    .lista li::before {
      content: ''; position: absolute; left: 0.25rem; top: 0.72em; width: 0.4rem; height: 0.4rem; border-radius: 999px;
      background: var(--accent);
    }
    .lista--check li, .lista--no li { padding-left: 2rem; }
    .lista--check li::before, .lista--no li::before {
      left: 0; top: 0.3em; width: 1.25rem; height: 1.25rem; background: none;
      mask: var(--l-marca) center / contain no-repeat; -webkit-mask: var(--l-marca) center / contain no-repeat;
    }
    .lista--check li::before {
      background: var(--l-ok);
      --l-marca: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E");
    }
    .lista--no li::before {
      background: var(--l-no);
      --l-marca: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 6 6 18M6 6l12 12'/%3E%3C/svg%3E");
    }

    /* Pasos: números unidos por un hilo vertical (ruta a seguir). */
    .pasos { list-style: none; padding: 0; counter-reset: paso; display: grid; gap: 1.125rem; }
    .pasos li { position: relative; padding-left: 3rem; min-height: 2.25rem; counter-increment: paso; }
    .pasos li::before {
      content: counter(paso); position: absolute; left: 0; top: 0.05rem; width: 2.125rem; height: 2.125rem;
      display: grid; place-items: center; border-radius: 999px; font-size: 0.875rem; font-weight: 700;
      background: var(--l-papel); color: var(--l-acento-tx); border: 1.5px solid var(--l-tinte-borde);
      font-variant-numeric: tabular-nums;
    }
    .pasos li:not(:last-child)::after {
      content: ''; position: absolute; left: 1.0625rem; top: 2.4rem; bottom: -1rem; width: 1px;
      background: var(--l-tinte-borde); transform: translateX(-50%);
    }

    .nota {
      display: flex; gap: 0.625rem; align-items: flex-start; padding: 0.875rem 1rem; border-radius: 0.875rem;
      font-size: 0.9375rem; line-height: 1.6; color: var(--l-texto);
      background: var(--l-papel); border: 1px solid var(--l-linea);
    }
    .nota lucide-icon { flex: none; margin-top: 0.2rem; color: var(--l-suave); }
    .doc .nota--suelta { margin-top: 2rem; }

    /* Finalidades: tabla tipográfica, sin cajas dentro de cajas. */
    .finalidades { border: 1px solid var(--l-linea); border-radius: 1rem; background: var(--l-papel); overflow: hidden; }
    .finalidades__cabecera { display: none; }
    .finalidades__fila { display: grid; gap: 0.125rem; padding: 0.875rem 1.125rem; line-height: 1.55; }
    .finalidades__fila + .finalidades__fila { border-top: 1px solid var(--l-linea-suave); }
    .finalidades__modulo { font-weight: 650; color: var(--l-fuerte); }
    .finalidades__fin { font-size: 1rem; color: var(--l-suave); }
    @media (min-width: 640px) {
      .finalidades__cabecera {
        display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 1.5rem; padding: 0.75rem 1.125rem;
        font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--l-suave);
        background: var(--l-tinte); border-bottom: 1px solid var(--l-linea);
      }
      .finalidades__fila { grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 1.5rem; }
      .finalidades__fin { color: var(--l-texto); }
    }

    /* ── Seguridad: medidas en dos columnas separadas por filetes ─ */
    .medidas { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: minmax(0, 1fr); }
    .medida { display: flex; gap: 1rem; align-items: flex-start; padding: 1.5rem 0; }
    .medida + .medida { border-top: 1px solid var(--l-linea); }
    .doc .medidas { margin-top: 0; }
    /* Varias columnas: el filete separa filas, no cada elemento. */
    @media (min-width: 768px) {
      .medidas { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 3rem; }
      .medida + .medida { border-top: 0; }
      .medida:nth-child(n + 3) { border-top: 1px solid var(--l-linea); }
      .medida:first-child, .medida:nth-child(2) { padding-top: 0.5rem; }
    }
    @media (min-width: 1280px) {
      .medidas { grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 2rem; }
      .medida { flex-direction: column; gap: 1rem; padding: 2rem 0; }
      .medida:nth-child(n + 3) { border-top: 0; }
      .medida:nth-child(n + 5) { border-top: 1px solid var(--l-linea); }
      .medida:nth-child(-n + 4) { padding-top: 0.5rem; }
    }
    .medida__icono {
      flex: none; display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: 0.875rem;
      background: var(--l-ok-bg); color: var(--l-ok);
    }
    .medida__cuerpo { display: grid; gap: 0.25rem; }
    .medida__titulo { font-family: var(--font-display); font-size: 1.125rem; font-weight: 700; line-height: 1.3; color: var(--l-fuerte); }
    .medida__texto { font-size: 1rem; line-height: 1.6; color: var(--l-suave); }

    .consejos { display: grid; gap: 0; margin-top: clamp(2.5rem, 6vw, 4rem); max-width: 42.5rem; }

    /* ── Pie: otros documentos ────────────────────────────────── */
    .pie { padding-top: clamp(2rem, 5vw, 3rem); padding-bottom: clamp(2rem, 5vw, 3rem); border-top: 1px solid var(--l-linea); }
    .pie__docs { margin-top: 1rem; display: grid; gap: 0.75rem; }
    @media (min-width: 768px) { .pie__docs { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .doc-enlace {
      display: flex; align-items: center; gap: 1rem; padding: 1.125rem 1.25rem; min-height: 4.5rem;
      border: 1px solid var(--l-linea); border-radius: 1rem; background: var(--l-papel);
      transition: border-color 180ms ease, transform 160ms var(--l-ease);
    }
    .doc-enlace:active { transform: scale(0.98); }
    .doc-enlace:focus-visible { outline: 2px solid var(--accent-focus, var(--accent)); outline-offset: 2px; }
    .doc-enlace__icono {
      flex: none; display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 0.75rem;
      background: var(--l-tinte); color: var(--l-acento-tx);
    }
    .doc-enlace__texto { display: grid; gap: 0.125rem; min-width: 0; }
    .doc-enlace__titulo { font-family: var(--font-display); font-weight: 700; color: var(--l-fuerte); }
    .doc-enlace__desc { font-size: 0.875rem; color: var(--l-suave); }
    .doc-enlace__flecha { margin-left: auto; flex: none; color: var(--l-suave); transition: transform 200ms var(--l-ease), color 160ms ease; }
    @media (hover: hover) and (pointer: fine) {
      .doc-enlace:hover { border-color: var(--l-tinte-borde); }
      .doc-enlace:hover .doc-enlace__flecha { transform: translateX(3px); color: var(--l-acento-tx); }
    }
    .pie__base { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 2rem; }
    .pie__firma { font-size: 0.875rem; color: var(--l-suave); }

    /* ── Entrada escalonada (una vez por documento) ───────────── */
    .entra { animation: entrar 560ms var(--l-ease) backwards; animation-delay: calc(var(--i, 0) * 60ms); }
    @keyframes entrar { from { opacity: 0; transform: translateY(14px); } }

    @media (prefers-reduced-motion: reduce) {
      .entra, .emblema__icono { animation: aparecer 200ms ease backwards; animation-delay: 0ms; }
      .emblema__trazo rect { animation: none; }
      .progreso { display: none; }
      @keyframes aparecer { from { opacity: 0; } }
    }

    /* ── Impresión: solo el documento ─────────────────────────── */
    @media print {
      .barra, .progreso, .indice, .indice-movil, .emblema, .pie { display: none !important; }
      .legal { background: white; color: black; }
      .cuerpo { display: block; border: 0; padding: 0; }
      .portada { padding: 0 0 1rem; display: block; }
      .titular { font-size: 2rem; }
      .doc { max-width: none; font-size: 11pt; }
      .doc > section { break-inside: avoid; }
      .entra { animation: none; }
    }
  `],
})
export class LegalPage implements AfterViewInit, OnDestroy {
  readonly theme = inject(ThemeService);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);
  private injector = inject(Injector);
  private host: ElementRef<HTMLElement> = inject(ElementRef);

  private barra = viewChild<ElementRef<HTMLSpanElement>>('barra');

  seccion = toSignal(
    this.route.paramMap.pipe(map(p => {
      const s = p.get('seccion');
      return SECCIONES_LEGALES.some(x => x.id === s) ? (s as SeccionLegal) : 'privacidad';
    })),
    { initialValue: 'privacidad' as SeccionLegal },
  );

  indice = signal<EntradaIndice[]>([]);
  activo = signal<string | null>(null);

  readonly secciones = SECCIONES_LEGALES.map(s => ({
    ...s, tituloCorto: s.id === 'terminos' ? 'Términos' : s.titulo,
  }));
  private readonly extra: Record<SeccionLegal, { icono: string; descripcion: string }> = {
    privacidad: { icono: 'file-text', descripcion: 'Qué datos se guardan y para qué' },
    terminos: { icono: 'scale', descripcion: 'Quién puede usar GAC y cómo' },
    seguridad: { icono: 'shield-check', descripcion: 'Cómo cuidamos su información' },
  };
  otrasSecciones = () => SECCIONES_LEGALES
    .filter(s => s.id !== this.seccion())
    .map(s => ({ ...s, ...this.extra[s.id] }));

  readonly finalidades = FINALIDADES;
  readonly medidas = MEDIDAS_SEGURIDAD;
  readonly version = VERSION_TERMINOS;
  readonly vigente = VIGENTE_DESDE;
  readonly contactoGac = CONTACTO_GAC;
  readonly urlJw = URL_POLITICA_JW_COLOMBIA;
  readonly urlSic = URL_SIC;
  readonly anio = new Date().getFullYear();

  private alDesplazar = () => this.pintarProgreso();
  private rafProgreso = 0;

  constructor() {
    // Cada documento nuevo: arriba del todo y el índice se rehace con sus <h2>.
    effect(() => {
      this.seccion();
      afterNextRender(() => {
        window.scrollTo({ top: 0 });
        this.construirIndice();
        this.pintarProgreso();
      }, { injector: this.injector });
    });
  }

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.alDesplazar, { passive: true });
      window.addEventListener('resize', this.alDesplazar, { passive: true });
    });
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.alDesplazar);
    window.removeEventListener('resize', this.alDesplazar);
    cancelAnimationFrame(this.rafProgreso);
  }

  irA(id: string, desplegable?: HTMLDetailsElement | null) {
    const destino = document.getElementById(id);
    if (!destino) return;
    if (desplegable) desplegable.open = false;
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    destino.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
    this.activo.set(id);
    // Lleva el foco al título para lectores de pantalla y teclado.
    destino.setAttribute('tabindex', '-1');
    destino.focus({ preventScroll: true });
  }

  private construirIndice() {
    const titulos = Array.from(
      (this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('article.doc h2'),
    );
    const s = this.seccion();
    const entradas = titulos.map((h, i) => {
      h.id = `${s}-${i + 1}`;
      return {
        id: h.id,
        num: h.querySelector('.num')?.textContent?.trim() ?? String(i + 1),
        titulo: h.querySelector('.tit')?.textContent?.trim() ?? h.textContent?.trim() ?? '',
      };
    });
    this.indice.set(entradas);
    this.activo.set(entradas[0]?.id ?? null);

  }

  private pintarProgreso() {
    cancelAnimationFrame(this.rafProgreso);
    this.rafProgreso = requestAnimationFrame(() => {
      const el = this.barra()?.nativeElement;
      if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${p})`;
      this.marcarActivo();
    });
  }

  /** Sección activa del índice: la última cuyo título ya pasó el tercio superior. */
  private marcarActivo() {
    const entradas = this.indice();
    if (entradas.length < 3) return;
    const linea = window.innerHeight * 0.3;
    let actual = entradas[0].id;
    for (const e of entradas) {
      const el = document.getElementById(e.id);
      if (el && el.getBoundingClientRect().top <= linea) actual = e.id;
    }
    // Al final de la página el último título puede no llegar nunca arriba.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      actual = entradas[entradas.length - 1].id;
    }
    if (actual !== this.activo()) this.zone.run(() => this.activo.set(actual));
  }
}

import {
  Component, inject, signal, OnInit, OnDestroy,
  AfterViewInit, ElementRef, ViewChild, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthPieComponent } from './auth-pie.component';
import { environment } from '../../../environments/environment';

/** Estado del campo de corrientes: refleja lo que pasa en el formulario. */
export type ModoCampo = 'libre' | 'atento' | 'pensando' | 'error' | 'exito';

/** Una partícula del campo de corrientes: un trazo que sigue el flujo. */
interface Corriente {
  x: number; y: number; edad: number; vida: number; tono: 0 | 1 | 2;
  /** Cuando la corriente es una «persona» que va al núcleo: su turno (−1 = libre). */
  slot: number;
  /** Ya llegó al núcleo y se quedó en él. */
  llego: boolean;
}


/** Onda de lectura: frente circular que recorre las corrientes desde `x, y`. */
interface Onda { x: number; y: number; t0: number; fuerza: number; fin: number; }

/** Tecla pendiente de convertirse en onda (la lanza el bucle de dibujo). */
interface Tecla { el: HTMLElement; }

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthPieComponent],
  templateUrl: './login.page.html',
  styleUrl: './acceso.scss'
})
export class LoginPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('raiz', { static: false }) raizRef?: ElementRef<HTMLElement>;
  @ViewChild('visual', { static: false }) visualRef?: ElementRef<HTMLElement>;
  @ViewChild('lado', { static: false }) ladoRef?: ElementRef<HTMLElement>;
  /** Hueco sobre el formulario donde vive el núcleo en móvil y tablet vertical. */
  @ViewChild('hueco', { static: false }) huecoRef?: ElementRef<HTMLElement>;
  @ViewChild('flow', { static: false }) flowRef?: ElementRef<HTMLCanvasElement>;
  /** Con «reducir movimiento» no hay bucle: el círculo se pinta al cambiar algo. */
  private refrescarGrupo: (() => void) | null = null;

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  loading = signal(false);
  error = signal<string | null>(null);
  /** Desafío del segundo paso (verificación en dos pasos); null = primer paso. */
  desafio = signal<string | null>(null);
  codigo = signal('');
  usarRecuperacion = signal(false);
  /** El servidor permite marcar este navegador como de confianza (no al Administrador). */
  puedeRecordar = signal(false);
  recordarDispositivo = signal(false);
  showPassword = signal(false);
  /** Bloq Mayús encendido mientras se escribe la contraseña. */
  mayusActivas = signal(false);
  /** Sacude el formulario un instante cuando algo falla. */
  sacudir = signal(false);
  /** ¿Responde el servidor? Se avisa antes de que el usuario escriba. */
  servicio = signal<'comprobando' | 'ok' | 'caido'>('comprobando');
  readonly conexionCifrada = typeof location !== 'undefined' && location.protocol === 'https:';
  private servicioTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * El campo de corrientes acompaña al formulario: libre en reposo, converge al
   * escribir, gira mientras se comprueba, se dispersa en rosa si falla y sale
   * hacia adelante al entrar. `modo` y lo demás lo lee el bucle de dibujo
   * (fuera de Angular); la señal solo pinta la línea de estado.
   */
  estadoCampo = signal<ModoCampo>('libre');
  readonly textoEstado: Record<ModoCampo, string> = {
    libre: 'Gestión de congregaciones',
    atento: 'Escribiendo',
    pensando: 'Comprobando tus datos',
    error: 'Los datos no coinciden',
    exito: 'Bienvenido',
  };
  private modo: ModoCampo = 'libre';
  private enFoco = false;
  private modoTimer: ReturnType<typeof setTimeout> | null = null;
  /** Largo de la contraseña o del código: lo único que sabe el fondo. */
  private estrellasObjetivo = 0;
  /** Al entrar: el grupo se reúne en el núcleo un instante antes de la cortina. */
  private uniendo = false;
  /** Qué parte del grupo ya llegó al núcleo (0 a 1): la escribe el motor del fondo. */
  private avanceGrupo = 0;
  /** Teclas pulsadas que aún no salieron como onda. */
  private teclas: Tecla[] = [];

  /** «Buenos días / Buenas tardes / Buenas noches» según la hora del equipo. */
  readonly saludo = (() => {
    const h = new Date().getHours();
    // De medianoche al amanecer es «noches»: antes de las 5 no es «días».
    return h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches';
  })();
  /** «Martes, 10 de noviembre». */
  readonly fechaHoy = (() => {
    const t = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    remember: [false]
  });

  private readonly EMAIL_KEY = 'app_login_email_v1';
  private readonly EMAIL_TTL_MS = 1000 * 60 * 60 * 24 * 30;

  /** El usuario pidió al sistema reducir animaciones: el campo se pinta quieto. */
  private readonly prefiereMenosMovimiento =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private sacudirTimer: ReturnType<typeof setTimeout> | null = null;
  private detenerCampo: (() => void) | null = null;
  /** Centro del núcleo en pantalla (lo calcula el motor; lo usa la cortina). */
  private nucleo = { x: 0, y: 0, r: 40 };

  ngOnInit(): void {
    // Solo importa el largo: el fondo nunca conoce los caracteres.
    this.form.controls.password.valueChanges.subscribe(v => {
      if (!this.desafio()) this.estrellasObjetivo = v.length;
    });

    try {
      const raw = localStorage.getItem(this.EMAIL_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj?.email && obj?.ts && (Date.now() - obj.ts) <= this.EMAIL_TTL_MS) {
        this.form.patchValue({ username: obj.email, remember: true });
      } else {
        localStorage.removeItem(this.EMAIL_KEY);
      }
    } catch {
      try { localStorage.removeItem(this.EMAIL_KEY); } catch { }
    }
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => this.iniciarCampo());
    this.comprobarServicio();
    // Cada minuto con la pestaña visible, y al volver la red.
    this.servicioTimer = setInterval(() => { if (!document.hidden) this.comprobarServicio(); }, 60_000);
    window.addEventListener('online', this.alCambiarRed);
    window.addEventListener('offline', this.alCambiarRed);
  }

  private alCambiarRed = () => this.comprobarServicio();

  /** Pregunta al servidor si está en pie (fetch directo: sin interceptores). */
  private async comprobarServicio(): Promise<void> {
    if (!navigator.onLine) { this.servicio.set('caido'); return; }
    const ctrl = new AbortController();
    const corte = setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(`${environment.apiUrl}/health`, { cache: 'no-store', signal: ctrl.signal });
      this.servicio.set(r.ok ? 'ok' : 'caido');
    } catch {
      this.servicio.set('caido');
    } finally {
      clearTimeout(corte);
    }
  }

  ngOnDestroy(): void {
    this.detenerCampo?.();
    if (this.sacudirTimer) clearTimeout(this.sacudirTimer);
    if (this.modoTimer) clearTimeout(this.modoTimer);
    if (this.servicioTimer) clearInterval(this.servicioTimer);
    window.removeEventListener('online', this.alCambiarRed);
    window.removeEventListener('offline', this.alCambiarRed);
  }

  private ponerModo(m: ModoCampo): void {
    if (this.modoTimer) { clearTimeout(this.modoTimer); this.modoTimer = null; }
    this.modo = m;
    this.estadoCampo.set(m);
    this.refrescarGrupo?.();
  }

  /** Vuelve al reposo (o a «atento» si sigue un campo enfocado). */
  private reposo(): void {
    this.ponerModo(this.enFoco ? 'atento' : 'libre');
  }

  /** Error: el campo se dispersa un momento y luego vuelve a la calma. */
  private modoError(): void {
    this.ponerModo('error');
    this.modoTimer = setTimeout(() => this.reposo(), 1400);
  }

  alEnfocar(): void {
    this.enFoco = true;
    if (this.modo === 'libre') this.ponerModo('atento');
    this.refrescarGrupo?.();
  }

  alDesenfocar(): void {
    this.enFoco = false;
    // focusout llega antes que el focusin del siguiente campo: se espera un tick.
    setTimeout(() => {
      if (!this.enFoco && this.modo === 'atento') this.ponerModo('libre');
      this.refrescarGrupo?.();
    });
  }

  /** El correo lanza una onda de lectura; cada carácter de la contraseña manda unas corrientes al núcleo (solo su largo). */
  alEscribir(e: Event): void {
    const el = e.target as HTMLElement | null;
    if (!el || el.tagName !== 'INPUT' || (el as HTMLInputElement).type === 'checkbox') return;
    if (this.desafio()) this.estrellasObjetivo = this.codigo().length;
    // Borrar no lanza onda.
    this.refrescarGrupo?.();
    if ((e as InputEvent).inputType?.startsWith('delete')) return;
    if (this.teclas.length < 8) this.teclas.push({ el });
  }

  campoInvalido(campo: 'username' | 'password'): boolean {
    const c = this.form.controls[campo];
    return c.touched && c.invalid;
  }

  revisarMayus(e: Event): void {
    const ev = e as KeyboardEvent;
    if (typeof ev.getModifierState === 'function') this.mayusActivas.set(ev.getModifierState('CapsLock'));
  }

  /** La cortina de entrada nace en el núcleo y cubre la pantalla. */
  private abrirCortina(): void {
    const raiz = this.raizRef?.nativeElement;
    if (!raiz) return;
    raiz.style.setProperty('--cx', `${Math.round(this.nucleo.x)}px`);
    raiz.style.setProperty('--cy', `${Math.round(this.nucleo.y)}px`);
  }

  private sacudirFormulario(): void {
    if (this.prefiereMenosMovimiento) return;
    this.sacudir.set(false);
    if (this.sacudirTimer) clearTimeout(this.sacudirTimer);
    // Un fotograma para que la clase vuelva a aplicarse aunque ya estuviera puesta.
    requestAnimationFrame(() => {
      this.sacudir.set(true);
      this.sacudirTimer = setTimeout(() => this.sacudir.set(false), 450);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     Campo de corrientes (toda la pantalla)
     - Corrientes: trazos finos que siguen un campo de ángulos que
       cambia despacio; cerca del puntero se arremolinan.
     - Onda de lectura: cada tecla lanza un frente circular desde el
       campo; las corrientes que toca se iluminan y se apartan un poco.
       No se dibuja nada nuevo: el propio fondo «lee».
     - Hacia un mismo lugar: cada corriente es una persona. Con cada
       carácter de la contraseña (o del código) tres corrientes dejan de
       fluir solas y viajan despacio hacia el núcleo, donde se funden y lo
       iluminan un poco más. Con 12 caracteres todas llegaron: el grupo
       está completo. Desde el núcleo el acceso se completa (se abre) o se
       anula (todas vuelven al flujo). Si se borra, las últimas se sueltan.
       Es todo: sin figuras ni giros, para no distraer. Solo cuenta el largo.
     Rendimiento: un trazo por color y fotograma, densidad de píxel
     ≤ 1,5, pausa con la pestaña oculta, bucle fuera de Angular.
     ═══════════════════════════════════════════════════════════ */
  private iniciarCampo(): void {
    const visual = this.visualRef?.nativeElement;
    const lado = this.ladoRef?.nativeElement;
    const hueco = this.huecoRef?.nativeElement;
    const canvas = this.flowRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!visual || !lado || !hueco || !canvas || !ctx) return;

    const PALETAS: Record<ModoCampo, string[]> = {
      libre:    ['rgba(167, 139, 250, 0.40)', 'rgba(196, 181, 253, 0.22)', 'rgba(251, 191, 36, 0.38)'],
      atento:   ['rgba(167, 139, 250, 0.48)', 'rgba(196, 181, 253, 0.26)', 'rgba(251, 191, 36, 0.42)'],
      pensando: ['rgba(196, 181, 253, 0.46)', 'rgba(240, 236, 255, 0.32)', 'rgba(251, 191, 36, 0.42)'],
      error:    ['rgba(251, 113, 133, 0.50)', 'rgba(255, 228, 230, 0.34)', 'rgba(251, 191, 36, 0.40)'],
      exito:    ['rgba(196, 181, 253, 0.60)', 'rgba(255, 255, 255, 0.50)', 'rgba(221, 214, 254, 0.55)'],
    };
    // Cuánto pesa la dirección del modo frente al flujo libre, cuánto gira
    // alrededor del núcleo (0 = directo, π/2 = órbita) y a qué velocidad.
    const AJUSTE: Record<ModoCampo, { peso: number; giro: number; vel: number }> = {
      libre:    { peso: 0,    giro: 0,    vel: 1 },
      atento:   { peso: 0.3,  giro: 0.95, vel: 1.1 },
      pensando: { peso: 0.7,  giro: 1.4,  vel: 1.35 },
      error:    { peso: 0.6,  giro: 0,    vel: 2.2 },
      exito:    { peso: 0.88, giro: 0,    vel: 3.2 },
    };

    let w = 0, h = 0, escala = 1;
    // El lienzo de corrientes empieza en `ox`: en escritorio no se pinta bajo
    // el formulario (el velo lo tapaba casi entero y era trabajo perdido).
    let ox = 0;
    // Calidad adaptativa: baja resolución y corrientes si el equipo no llega
    // a ~40 fps. `muestras` acumula la duración de los últimos fotogramas.
    let calidad = 1, muestras = 0, sumaDt = 0, bajadas = 0;
    let bordeIzq: CanvasGradient | null = null;
    let corrientes: Corriente[] = [];
    let raf = 0, t = Math.random() * 1e4, ultimo = 0;
    // Puntero (objetivo y posición suavizada), en píxeles de pantalla.
    let pxT = -1e4, pyT = -1e4, px = -1e4, py = -1e4;

    const nueva = (c?: Corriente): Corriente => {
      const r = Math.random();
      const n = c ?? { x: 0, y: 0, edad: 0, vida: 0, tono: 0, slot: -1, llego: false };
      n.slot = -1; n.llego = false;
      n.x = ox + Math.random() * (w - ox);
      n.y = Math.random() * h;
      n.edad = 0;
      n.vida = 260 + Math.random() * 420;
      n.tono = r < 0.04 ? 2 : r < 0.3 ? 1 : 0;
      return n;
    };

    /** Dónde vive el núcleo: centro del espacio libre a la derecha (escritorio)
        o del hueco sobre el formulario (móvil). */
    const ubicarNucleo = () => {
      if (window.innerWidth >= 1024) {
        const borde = lado.getBoundingClientRect().right;
        const libre = Math.max(200, w - borde);
        this.nucleo.x = borde + libre * 0.52;
        this.nucleo.y = h * 0.5;
        this.nucleo.r = Math.max(30, Math.min(78, Math.min(libre, h) * 0.12));
      } else {
        const g = hueco.getBoundingClientRect();
        this.nucleo.x = w / 2;
        this.nucleo.y = g.top + g.height / 2;
        this.nucleo.r = Math.max(16, Math.min(56, Math.min(g.height, w) * 0.3));
      }
      visual.style.setProperty('--nx', `${Math.round(this.nucleo.x)}px`);
      visual.style.setProperty('--ny', `${Math.round(this.nucleo.y)}px`);
      // El círculo exterior de personas mide ~`radioMax`.
      if (window.innerWidth >= 1024) {
        const libre = Math.max(200, w - lado.getBoundingClientRect().right);
        radioMax = Math.max(110, Math.min(270, libre * 0.33, h * 0.33));
      } else {
        const g = hueco.getBoundingClientRect();
        radioMax = Math.max(36, Math.min(g.height * 0.46, w * 0.4));
      }
    };

    /** `conservar`: al bajar la calidad se mantienen la imagen y las corrientes
        (redimensionar el lienzo lo borra y las estelas volvían a empezar). */
    const medir = (conservar = false) => {
      let copia: HTMLCanvasElement | null = null;
      if (conservar && canvas.width) {
        copia = document.createElement('canvas');
        copia.width = canvas.width; copia.height = canvas.height;
        copia.getContext('2d')?.drawImage(canvas, 0, 0);
      }
      w = Math.max(1, visual.offsetWidth);
      h = Math.max(1, visual.offsetHeight);
      ox = window.innerWidth >= 1024 ? Math.max(0, lado.offsetWidth - 160) : 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      // Pintar es lo caro (no el cálculo): el lienzo de corrientes se limita a
      // ~1,6 millones de píxeles internos y el CSS lo escala. Las líneas finas
      // no pierden calidad visible.
      escala = Math.min(dpr, Math.sqrt(1.6e6 / ((w - ox) * h))) * calidad;
      canvas.style.left = `${ox}px`;
      canvas.style.width = `${w - ox}px`;
      canvas.width = Math.round((w - ox) * escala);
      canvas.height = Math.round(h * escala);
      ctx.setTransform(escala, 0, 0, escala, -ox * escala, 0);
      bordeIzq = null;
      if (ox > 0) {
        // Progresivo: las estelas crecen mucho cuando el borrado es pequeño,
        // así que la caída va concentrada al principio para que no se vea corte.
        bordeIzq = ctx.createLinearGradient(ox, 0, ox + 320, 0);
        bordeIzq.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
        bordeIzq.addColorStop(0.3, 'rgba(0, 0, 0, 0.14)');
        bordeIzq.addColorStop(0.65, 'rgba(0, 0, 0, 0.03)');
        bordeIzq.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      const cuantas = Math.max(140, Math.min(800, Math.round(((w - ox) * h) / 2000 * calidad)));
      if (copia) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(copia, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        corrientes.length = Math.min(corrientes.length, cuantas);
      } else {
        corrientes = Array.from({ length: cuantas }, () => nueva());
        // Arrancan a distintas edades para no nacer todas a la vez.
        for (const c of corrientes) c.edad = Math.random() * c.vida;
      }
      vaciarGrupo();
      ubicarNucleo();
    };

    /** Diferencia de ángulo hacia `b`. Si son casi opuestos se gira siempre en
        el mismo sentido: elegir el lado más corto cambiaba de un fotograma a
        otro y dejaba una franja dentada donde se encontraban los flujos. */
    const hacia = (a: number, b: number) => {
      const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
      return Math.abs(d) > 2.7 ? Math.abs(d) : d;
    };

    // Suma de ondas lentas: curvas amplias que se van deformando con el
    // tiempo, con una deriva suave hacia arriba a la derecha.
    const angulo = (x: number, y: number) =>
      (Math.sin(x * 0.0034 + t * 0.00016) + Math.cos(y * 0.0041 - t * 0.00012) +
       Math.sin((x - y) * 0.0019 + t * 0.00009) * 0.8) * 1.15 - 0.3;

    /* ── Hacia el núcleo ── */
    let radioMax = 120;
    const TOTAL = 36;                  // 3 corrientes por carácter (12 caracteres)
    const grupo: (Corriente | null)[] = new Array(TOTAL).fill(null);
    let reclutadas = 0, dentro = 0, unionPrevia = -1;

    /** Cuántas deberían ir: tres por carácter; todas al comprobar o entrar. */
    const personasMeta = () => {
      const modo = this.modo;
      if (this.uniendo || modo === 'exito') return TOTAL;
      if (modo === 'error') return 0;
      if (modo === 'pensando') return this.estrellasObjetivo ? TOTAL : 0;
      const total = this.desafio() ? 6 : 12;
      return Math.min(TOTAL, Math.round(this.estrellasObjetivo * TOTAL / total));
    };
    const vaciarGrupo = () => { grupo.fill(null); reclutadas = 0; dentro = 0; };
    const liberar = (i: number) => {
      const c = grupo[i];
      if (!c) return;
      if (c.llego) dentro--;
      c.slot = -1; c.llego = false; grupo[i] = null; reclutadas--;
    };
    /** Recluta una corriente a media distancia del núcleo: ni pegada (no se
        notaría el viaje) ni en el otro extremo de la pantalla. */
    const reclutar = (i: number) => {
      let mejor: Corriente | null = null, dm = Infinity;
      for (let k = 0; k < 10; k++) {
        const c = corrientes[Math.floor(Math.random() * corrientes.length)];
        if (!c || c.slot >= 0) continue;
        const d = Math.abs(Math.hypot(c.x - this.nucleo.x, c.y - this.nucleo.y) - radioMax * (this.uniendo ? 0.9 : 1.5));
        if (d < dm) { dm = d; mejor = c; }
      }
      if (mejor) { mejor.slot = i; mejor.llego = false; grupo[i] = mejor; reclutadas++; }
    };

    const actualizarGrupo = () => {
      const n = personasMeta();
      for (let i = TOTAL - 1; i >= n; i--) liberar(i);          // al borrar o fallar, vuelven al flujo
      for (let i = 0; i < n; i++) if (!grupo[i]) reclutar(i);
      // El núcleo gana luz con cada corriente que llega.
      this.avanceGrupo = dentro / TOTAL;
      const union = Math.round(dentro / TOTAL * 20) / 20;
      if (union !== unionPrevia) { unionPrevia = union; visual.style.setProperty('--union', String(union)); }
    };
    let rafQuieto = 0;
    this.refrescarGrupo = () => {
      if (!this.prefiereMenosMovimiento) { arrancar(); return; }
      cancelAnimationFrame(rafQuieto);
      rafQuieto = requestAnimationFrame(() => pintarQuieto());
    };

    const ondas: Onda[] = [];
    const VEL_ONDA = 1.05;           // px por ms
    const BANDA = 30;                // grosor del frente
    let modoPrevio: ModoCampo = 'libre';
    const iluminadas: number[] = [];  // segmentos tocados por una onda: x0, y0, x1, y1, luz
    const gente: number[] = [];       // corrientes en viaje: x, y, brillo

    const paso = (dt: number, desvanecer: boolean) => {
      t += dt;
      px += (pxT - px) * 0.1;
      py += (pyT - py) * 0.1;

      const modo = this.modo;
      const { peso, giro, vel } = AJUSTE[modo];
      const colores = PALETAS[modo];
      const cx = this.nucleo.x, cy = this.nucleo.y;

      // Ondas nuevas: desde el campo (borde derecho en escritorio, arriba en móvil).
      while (this.teclas.length) {
        const el = this.teclas.shift()!.el;
        if (el.id !== 'username') continue;   // la contraseña manda corrientes al núcleo
        const r = el.getBoundingClientRect();
        const ancho = window.innerWidth >= 1024;
        if (ondas.length >= 4) ondas.shift();
        const x = ancho ? r.right - 16 : r.left + r.width / 2, y = ancho ? r.top + r.height / 2 : r.top;
        // Llega un poco más allá del núcleo y se apaga: no recorre toda la pantalla.
        ondas.push({ x, y, t0: t, fuerza: 1, fin: Math.hypot(cx - x, cy - y) + this.nucleo.r * 3 });
      }
      // Error y entrada: una onda sale del propio núcleo.
      if (modo !== modoPrevio) {
        if (modo === 'error' || modo === 'exito') ondas.push({ x: cx, y: cy, t0: t, fuerza: 1.3, fin: Math.min(w, h) * 0.7 });
        modoPrevio = modo;
      }
      for (let i = ondas.length - 1; i >= 0; i--) {
        if ((t - ondas[i].t0) * VEL_ONDA > ondas[i].fin) ondas.splice(i, 1);
      }
      actualizarGrupo();
      iluminadas.length = 0;
      gente.length = 0;
      const fr = dt / 16.7;
      const rapido = modo === 'exito' || this.uniendo;

      if (desvanecer) {
        // Borra un poco del fotograma anterior: deja estelas que se apagan.
        ctx.globalCompositeOperation = 'destination-out';
        // 0,045: estelas cortas; con menos, el violeta se acumulaba en un gris.
        ctx.fillStyle = modo === 'exito' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(0, 0, 0, 0.045)';
        ctx.fillRect(ox, 0, w - ox, h);
        // Borde izquierdo (escritorio): se borra más fuerte para que funda con
        // el velo. Antes era un mask-image en CSS, que costaba ~4 fps.
        if (ox > 0 && bordeIzq) {
          ctx.fillStyle = bordeIzq;
          ctx.fillRect(ox, 0, 320, h);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1;

      const v = 0.85 * (dt / 16.7) * vel;
      const R = Math.min(190, w * 0.3);
      // Sin puntero en la ventana (táctil o fuera): R2 = 0 y no se calcula.
      const R2 = px > -5000 ? R * R : 0;
      for (let tono = 0; tono < 3; tono++) {
        ctx.strokeStyle = colores[tono];
        ctx.beginPath();
        for (const c of corrientes) {
          if (c.tono !== tono) continue;

          // Persona que va al núcleo: sigue el MISMO flujo que las demás y solo
          // se inclina hacia él, así dibuja la misma estela curva. Al llegar se
          // queda dentro (no se dibuja) y lo ilumina.
          const viaja = c.slot >= 0;
          if (viaja && c.llego) { c.x = cx; c.y = cy; continue; }

          let a = angulo(c.x, c.y);

          if (viaja) {
            const kx = cx - c.x, ky = cy - c.y;
            const kd = Math.sqrt(kx * kx + ky * ky);
            if (kd < 20 || !desvanecer) { c.llego = true; dentro++; c.x = cx; c.y = cy; continue; }
            // Mismo remolino que el resto de corrientes cerca del núcleo.
            a += hacia(a, Math.atan2(ky, kx) + (giro ? giro * 0.5 : 0.45)) * (rapido ? 0.95 : 0.85);
          } else if (peso > 0) {
            // Se gira el ángulo hacia la dirección del modo por el camino más
            // corto (sumar vectores opuestos daba casi cero y trazos en zigzag).
            const kx = cx - c.x, ky = cy - c.y;
            const kd = Math.sqrt(kx * kx + ky * ky);
            let objetivo: number;
            let fuerza = peso;
            if (modo === 'exito') objetivo = -0.18;
            else if (modo === 'error') objetivo = Math.atan2(-ky, -kx);
            else {
              // Llegó al núcleo: renace en otro sitio para que el flujo no se agote.
              if (kd < 16) { nueva(c); continue; }
              objetivo = Math.atan2(ky, kx) + giro;
              // La atracción solo actúa cerca del núcleo: si toda la pantalla
              // convergía a la vez, las corrientes se apilaban en una lámina.
              fuerza *= Math.max(0, 1 - kd / (this.nucleo.r * (modo === 'atento' ? 6 : 9)));
            }
            a += hacia(a, objetivo) * fuerza;
          }

          // Onda de lectura: el frente ilumina la corriente y la empuja hacia fuera.
          let luz = 0;
          for (const o of ondas) {
            const ox2 = c.x - o.x, oy2 = c.y - o.y;
            const od = Math.sqrt(ox2 * ox2 + oy2 * oy2);
            const radio = (t - o.t0) * VEL_ONDA;
            const cerca = 1 - Math.abs(od - radio) / BANDA;
            if (cerca <= 0) continue;
            const resta = 1 - radio / o.fin;
            const l = cerca * o.fuerza * resta * resta;
            if (l > luz) {
              luz = l;
              // Solo las ondas de tecla empujan; las del núcleo (error, entrada) solo iluminan.
              if (o.fuerza <= 1) a += hacia(a, Math.atan2(oy2, ox2)) * l * 0.25;
            }
          }

          const dx = c.x - px, dy = c.y - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2);
            // Remolino alrededor del puntero, más fuerte cuanto más cerca.
            const f = (1 - d / R) * 0.9;
            const ta = Math.atan2(dy, dx) + Math.PI / 2;
            a += hacia(a, ta) * f;
          }

          const k = v * (tono === 2 ? 1.3 : 1) * (1 + luz * 1.2);
          const nx = c.x + Math.cos(a) * k * (viaja ? (rapido ? 3.2 : 1.9) : 1);
          const ny = c.y + Math.sin(a) * k * (viaja ? (rapido ? 3.2 : 1.9) : 1);
          if (viaja) {
            // Su trazo es un poco más claro que el resto y se apaga al acercarse.
            const d = Math.hypot(cx - nx, cy - ny);
            gente.push(nx, ny, Math.min(1, d / (radioMax * 0.6)));
            iluminadas.push(c.x, c.y, nx, ny, Math.max(luz, 0.5 * Math.min(1, d / (radioMax * 0.6)) + 0.12));
            c.x = nx; c.y = ny;
            continue;   // sin envejecer: no renace hasta llegar o soltarse
          }
          if (luz > 0.12) iluminadas.push(c.x, c.y, nx, ny, luz);
          else { ctx.moveTo(c.x, c.y); ctx.lineTo(nx, ny); }
          c.x = nx; c.y = ny; c.edad++;
          if (c.edad > c.vida || nx < ox - 10 || ny < -10 || nx > w + 10 || ny > h + 10) nueva(c);
        }
        ctx.stroke();
      }

      // Lo que tocó la onda de lectura: más claro un instante.
      if (iluminadas.length) {
        const claro = modo === 'error' ? '255, 205, 213' : modo === 'exito' ? '245, 243, 255' : '237, 233, 254';
        for (const [min, max, alfa, grueso] of [[0.12, 0.45, 0.2, 1], [0.45, 0.85, 0.4, 1], [0.85, 9, 0.65, 1.2]]) {
          ctx.strokeStyle = `rgba(${claro}, ${alfa})`;
          ctx.lineWidth = grueso;
          ctx.beginPath();
          for (let k = 0; k < iluminadas.length; k += 5) {
            const l = iluminadas[k + 4];
            if (l < min || l >= max) continue;
            ctx.moveTo(iluminadas[k], iluminadas[k + 1]);
            ctx.lineTo(iluminadas[k + 2], iluminadas[k + 3]);
          }
          ctx.stroke();
        }
        ctx.lineWidth = 1;
      }

      // Una cabeza tenue en cada corriente que viaja. El lienzo conserva lo
      // dibujado y lo borra un 4,5 % por fotograma: con la opacidad baja
      // (0,09) el punto queda en un lavanda suave, sin saturarse a blanco.
      if (gente.length) {
        const color = modo === 'error' ? '251, 146, 160' : modo === 'exito' ? '221, 214, 254' : '196, 181, 253';
        ctx.globalCompositeOperation = 'source-over';
        for (let k = 0; k < gente.length; k += 3) {
          ctx.fillStyle = `rgba(${color}, ${0.09 * gente[k + 2] * fr})`;
          ctx.beginPath(); ctx.arc(gente[k], gente[k + 1], 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    };

    /** Cada 90 fotogramas: si la media pasa de 24 ms (< ~40 fps), baja la
        resolución y las corrientes un 15 %. Como mucho dos veces (72 %):
        más abajo las líneas se notaban borrosas. */
    const ajustarCalidad = (dt: number) => {
      if (bajadas >= 2) return;
      sumaDt += dt; muestras++;
      if (muestras < 90) return;
      const media = sumaDt / muestras;
      sumaDt = 0; muestras = 0;
      if (media > 24) {
        calidad *= 0.85;
        bajadas++;
        medir(true);
      }
    };

    // Móvil en reposo (nada enfocado, sin personas ni ondas): tras unos
    // segundos el fondo se queda quieto y el bucle se apaga para no gastar
    // batería. Vuelve en cuanto se toca un campo.
    let reposoDesde = 0;
    const enReposo = () => window.innerWidth < 1024 && this.modo === 'libre' &&
      !this.estrellasObjetivo && !reclutadas && !ondas.length && !this.teclas.length;

    const bucle = (ahora: number) => {
      const dt = ultimo ? Math.min(40, ahora - ultimo) : 16.7;
      ultimo = ahora;
      paso(dt, true);
      ajustarCalidad(dt);
      if (enReposo()) {
        reposoDesde ||= ahora;
        if (ahora - reposoDesde > 3000) { raf = 0; reposoDesde = 0; return; }
      } else reposoDesde = 0;
      raf = requestAnimationFrame(bucle);
    };
    const arrancar = () => {
      if (raf || document.hidden || this.prefiereMenosMovimiento) return;
      ultimo = 0; sumaDt = 0; muestras = 0;
      raf = requestAnimationFrame(bucle);
    };
    const parar = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

    const pintarQuieto = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) paso(16.7, false);
      actualizarGrupo();
    };

    medir();
    if (this.prefiereMenosMovimiento) pintarQuieto(); else arrancar();

    // Se mide en el fotograma siguiente (redimensionar dentro del aviso
    // provocaba «ResizeObserver loop»). Si cambió el tamaño de la pantalla se
    // rehace todo; si solo cambió el formulario, se reubica el núcleo.
    let rafMedir = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafMedir);
      rafMedir = requestAnimationFrame(() => {
        if (visual.offsetWidth !== w || visual.offsetHeight !== h) {
          medir();
          if (this.prefiereMenosMovimiento) pintarQuieto();
        } else {
          ubicarNucleo();
        }
      });
    });
    ro.observe(visual);
    ro.observe(lado);
    ro.observe(hueco);

    const alCambiarPestana = () => (document.hidden ? parar() : arrancar());
    document.addEventListener('visibilitychange', alCambiarPestana);

    // El fondo está detrás del contenido: el puntero se sigue en toda la ventana.
    const mover = (e: PointerEvent) => { pxT = e.clientX; pyT = e.clientY; };
    const salir = () => { pxT = -1e4; pyT = -1e4; };
    window.addEventListener('pointermove', mover, { passive: true });
    document.addEventListener('pointerleave', salir);

    this.detenerCampo = () => {
      parar();
      cancelAnimationFrame(rafMedir);
      ro.disconnect();
      document.removeEventListener('visibilitychange', alCambiarPestana);
      window.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerleave', salir);
    };
  }

  onSubmit() {
    if (this.form.invalid) {
      // El botón no se deshabilita: un botón apagado parece roto. Al pulsarlo
      // se marcan los campos que faltan y se dice cuál.
      this.form.markAllAsTouched();
      this.sacudirFormulario();
      this.modoError();
      return;
    }
    this.loading.set(true); this.error.set(null);
    this.ponerModo('pensando');
    const { username, password, remember } = this.form.getRawValue() as { username: string; password: string; remember: boolean };
    this.auth.login({ username, password }).subscribe({
      next: (res) => {
        this.recordarCorreo(username, remember);
        if (res.requiere_2fa && res.desafio) {
          this.loading.set(false);
          this.estrellasObjetivo = 0;
          this.reposo();
          this.desafio.set(res.desafio);
          this.puedeRecordar.set(!!res.puede_recordar);
          this.recordarDispositivo.set(false);
          this.codigo.set('');
          return;
        }
        this.entrar();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'No se pudo iniciar sesión');
        this.sacudirFormulario();
        this.modoError();
      }
    });
  }

  onVerificar() {
    const desafio = this.desafio();
    if (!desafio || this.codigo().trim().length < 6) return;
    this.loading.set(true); this.error.set(null);
    const recordar = this.puedeRecordar() && this.recordarDispositivo();
    this.ponerModo('pensando');
    this.auth.verificarDosPasos(desafio, this.codigo().trim(), recordar).subscribe({
      next: () => this.entrar(),
      error: (err) => {
        this.loading.set(false);
        this.codigo.set('');
        this.estrellasObjetivo = 0;
        this.error.set(err?.error?.detail ?? 'No se pudo verificar el código');
        this.sacudirFormulario();
        this.modoError();
        // Desafío vencido o agotado: de vuelta al primer paso.
        if (err?.status === 401 || err?.status === 423) this.cancelarDosPasos(err?.error?.detail);
      }
    });
  }

  /** Cambia entre código del teléfono y de recuperación: el fondo se entera de que el campo quedó vacío. */
  alternarRecuperacion() {
    this.usarRecuperacion.set(!this.usarRecuperacion());
    this.codigo.set('');
    this.estrellasObjetivo = 0;
    this.refrescarGrupo?.();
  }

  cancelarDosPasos(mensaje?: string) {
    this.estrellasObjetivo = this.form.controls.password.value.length;
    this.desafio.set(null);
    this.codigo.set('');
    this.usarRecuperacion.set(false);
    this.error.set(mensaje ?? null);
  }

  private entrar() {
    // Las corrientes salen hacia adelante un instante antes de cambiar de pantalla.
    const ir = () => {
      this.loading.set(false);
      this.uniendo = true;
      this.refrescarGrupo?.();
      // Una sola secuencia: las corrientes llegan al núcleo, él se enciende y
      // de ese mismo punto nace la cortina. Se espera a que llegue casi todo el
      // grupo (con un tope, para no demorar el acceso).
      const abrir = () => {
        this.abrirCortina();
        this.ponerModo('exito');
        setTimeout(() => this.router.navigateByUrl('/'), this.prefiereMenosMovimiento ? 0 : 900);
      };
      if (this.prefiereMenosMovimiento) { abrir(); return; }
      const inicio = performance.now();
      const esperar = () => {
        if (this.avanceGrupo >= 0.85 || performance.now() - inicio > 750) setTimeout(abrir, 140);
        else setTimeout(esperar, 40);
      };
      esperar();
    };
    this.auth.me().subscribe({ next: ir, error: ir });
  }

  private recordarCorreo(username: string, remember: boolean) {
    try {
      if (remember) {
        localStorage.setItem(this.EMAIL_KEY, JSON.stringify({ email: username, ts: Date.now() }));
      } else {
        localStorage.removeItem(this.EMAIL_KEY);
      }
    } catch { }
  }
}

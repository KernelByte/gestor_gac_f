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
  /** Acomodada en la cerradura: aro (−1 = libre), ranura y cuándo llegó. */
  aro: number; ranura: number; llego: number;
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
  /** Capa limpia (sin estelas) para las corrientes ya acomodadas en la cerradura. */
  @ViewChild('capa', { static: false }) capaRef?: ElementRef<HTMLCanvasElement>;
  /** Con «reducir movimiento» no hay bucle: la cerradura se pinta al cambiar algo. */
  private refrescarCerradura: (() => void) | null = null;

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
    this.refrescarCerradura?.();
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
    this.refrescarCerradura?.();
  }

  alDesenfocar(): void {
    this.enFoco = false;
    // focusout llega antes que el focusin del siguiente campo: se espera un tick.
    setTimeout(() => {
      if (!this.enFoco && this.modo === 'atento') this.ponerModo('libre');
      this.refrescarCerradura?.();
    });
  }

  /** El correo lanza una onda de lectura; la contraseña gira la cerradura (solo su largo). */
  alEscribir(e: Event): void {
    const el = e.target as HTMLElement | null;
    if (!el || el.tagName !== 'INPUT' || (el as HTMLInputElement).type === 'checkbox') return;
    if (this.desafio()) this.estrellasObjetivo = this.codigo().length;
    // Borrar no lanza onda.
    this.refrescarCerradura?.();
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
     - Cerradura: al escribir la contraseña las propias corrientes se
       juntan en tres aros alrededor del núcleo. Cada aro tiene una
       muesca (un hueco que las corrientes saltan sin dibujarse) y gira
       libre; cada carácter (o del código) lo gira un paso hacia su
       sitio. Con 12 las muescas quedan alineadas hacia el formulario y
       por el canal sale un haz de corrientes. Solo cuenta el largo.
     Rendimiento: un trazo por color y fotograma, densidad de píxel
     ≤ 1,5, pausa con la pestaña oculta, bucle fuera de Angular.
     ═══════════════════════════════════════════════════════════ */
  private iniciarCampo(): void {
    const visual = this.visualRef?.nativeElement;
    const lado = this.ladoRef?.nativeElement;
    const hueco = this.huecoRef?.nativeElement;
    const canvas = this.flowRef?.nativeElement;
    const capa = this.capaRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    const sx = capa?.getContext('2d');
    if (!visual || !lado || !hueco || !canvas || !capa || !ctx || !sx) return;

    const PALETAS: Record<ModoCampo, string[]> = {
      libre:    ['rgba(167, 139, 250, 0.40)', 'rgba(196, 181, 253, 0.22)', 'rgba(251, 191, 36, 0.38)'],
      atento:   ['rgba(167, 139, 250, 0.48)', 'rgba(196, 181, 253, 0.26)', 'rgba(251, 191, 36, 0.42)'],
      pensando: ['rgba(196, 181, 253, 0.46)', 'rgba(240, 236, 255, 0.32)', 'rgba(251, 191, 36, 0.42)'],
      error:    ['rgba(251, 113, 133, 0.50)', 'rgba(255, 228, 230, 0.34)', 'rgba(251, 191, 36, 0.40)'],
      exito:    ['rgba(196, 181, 253, 0.60)', 'rgba(255, 255, 255, 0.50)', 'rgba(110, 231, 183, 0.55)'],
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
    // Reserva: corrientes que solo despiertan con la cerradura a la vista y
    // nacen sobre los aros. Dormidas no cuestan nada.
    let reserva: Corriente[] = [];
    let reservaActiva = false;
    let raf = 0, t = Math.random() * 1e4, ultimo = 0;
    // Puntero (objetivo y posición suavizada), en píxeles de pantalla.
    let pxT = -1e4, pyT = -1e4, px = -1e4, py = -1e4;

    const nueva = (c?: Corriente, enAro = false): Corriente => {
      const r = Math.random();
      const n = c ?? { x: 0, y: 0, edad: 0, vida: 0, tono: 0, aro: -1, ranura: 0, llego: 0 };
      n.aro = -1;
      if (enAro || (presencia > 0.3 && Math.random() < 0.5)) {
        // Con la cerradura a la vista, casi la mitad renace sobre un aro:
        // así las bandas se llenan deprisa.
        const k = Math.floor(Math.random() * 3);
        const th = ang[k] + MUESCA_RAD + 0.2 + Math.random() * (Math.PI * 2 - MUESCA_RAD * 2 - 0.4);
        const rr = RADIOS[k] * radioMax + (Math.random() - 0.5) * radioMax * ANCHO[k] * 2;
        n.x = this.nucleo.x + Math.cos(th) * rr;
        n.y = this.nucleo.y + Math.sin(th) * rr;
      } else {
        n.x = ox + Math.random() * (w - ox);
        n.y = Math.random() * h;
      }
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
      // Cerradura: el aro exterior mide `radioMax`; las muescas apuntan al formulario.
      if (window.innerWidth >= 1024) {
        const libre = Math.max(200, w - lado.getBoundingClientRect().right);
        radioMax = Math.max(110, Math.min(270, libre * 0.33, h * 0.33));
        alineado = Math.PI;
      } else {
        const g = hueco.getBoundingClientRect();
        radioMax = Math.max(36, Math.min(g.height * 0.46, w * 0.4));
        alineado = Math.PI / 2;
      }
      ajustarCapa();
    };

    /** La capa del dial es un cuadrado alrededor del núcleo, no la pantalla
        entera: menos píxeles que borrar, pintar y componer en cada fotograma. */
    const ajustarCapa = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      capaL = Math.ceil(radioMax * 2.6);
      capaX = Math.round(this.nucleo.x - capaL / 2);
      capaY = Math.round(this.nucleo.y - capaL / 2);
      capa.style.cssText = `display:${capaSucia ? '' : 'none'};right:auto;bottom:auto;left:${capaX}px;top:${capaY}px;width:${capaL}px;height:${capaL}px`;
      const px = Math.round(capaL * dpr);
      if (capa.width !== px) { capa.width = px; capa.height = px; }
      sx.setTransform(dpr, 0, 0, dpr, -capaX * dpr, -capaY * dpr);
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
      reserva = Array.from({ length: Math.round(cuantas * 0.5) }, () => {
        const c = nueva(); c.edad = c.vida + 1; return c;   // nace al despertar
      });
      vaciarRanuras();
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

    /* ── Cerradura (la forman las corrientes) ── */
    let radioMax = 120, alineado = Math.PI;
    const RADIOS = [0.5, 0.75, 1];
    const ANCHO = [0.03, 0.045, 0.062];           // grosor de cada banda (× radioMax)
    const MUESCA_RAD = 0.2;                        // media muesca (~11°)
    const OMEGA = [0.00042, -0.0003, 0.00022];   // giro libre (rad/ms): sentidos alternos
    const ang = [0.9, 2.6, 4.4], velAng = [0, 0, 0];
    const paso3 = [0, 0, 0], velPaso = [0, 0, 0];  // 0 libre · 1 en su sitio
    let presencia = 0, giroComun = 0, abierta = false;
    let modoCerr: ModoCampo = 'libre';
    const corto = (d: number) => Math.atan2(Math.sin(d), Math.cos(d));
    const lim = (v: number) => Math.max(0, Math.min(1, v));
    // Ranuras del dial: puntos en el aro interior, marcas de bisel en el del
    // medio y doble fila en el exterior. Una corriente que llega a la banda
    // ocupa la ranura libre más cercana y desde ahí gira con el aro.
    const RANURAS = [30, 48, 72];   // pocas: el dial se insinúa, no grita
    const ocupado = RANURAS.map(n => new Uint8Array(n));
    const llenos = [0, 0, 0];
    const anguloRanura = (n: number, i: number) => n === 2 ? (i >> 1) * (Math.PI / 18) : i * (Math.PI * 2 / RANURAS[n]);
    const radioRanura = (n: number, i: number) =>
      RADIOS[n] * radioMax + (n === 2 ? ((i & 1) ? 1 : -1) * radioMax * ANCHO[2] * 0.55 : 0);
    const enMuesca = (n: number, i: number) => Math.abs(corto(anguloRanura(n, i))) < MUESCA_RAD + 0.03;
    const capacidad = RANURAS.map((m, n) => { let k = 0; for (let i = 0; i < m; i++) if (!enMuesca(n, i)) k++; return k; });
    const liberar = (c: Corriente) => {
      ocupado[c.aro][c.ranura] = 0; llenos[c.aro]--;
      c.aro = -1; c.edad = 0; c.vida = 300 + Math.random() * 300;
    };
    const vaciarRanuras = () => {
      for (const o of ocupado) o.fill(0);
      llenos.fill(0);
      for (const c of corrientes) c.aro = -1;
    };
    const fijas: number[] = [];      // acomodadas: x, y, aro, ranura, llegada
    let capaSucia = false, capaX = 0, capaY = 0, capaL = 0;

    const actualizarCerradura = (dt: number, quieto = false) => {
      const modo = this.modo, f = dt / 16.7;
      const id = document.activeElement?.id;
      const total = this.desafio() ? 6 : 12, porAro = total / 3;
      const largo = this.estrellasObjetivo;
      const presMeta = modo === 'exito' ? 0
        : modo === 'pensando' || largo > 0 || id === 'password' || id === 'codigo2fa' ? 1 : 0;
      presencia = quieto ? presMeta : presencia + (presMeta - presencia) * Math.min(1, 0.05 * f);
      if (modo === 'error' && modoCerr !== 'error') {
        // Al fallar los aros se sueltan de golpe.
        for (let i = 0; i < 3; i++) velAng[i] += (i % 2 ? -1 : 1) * (0.1 + Math.random() * 0.08);
      }
      modoCerr = modo;
      giroComun = modo === 'pensando' ? giroComun + dt * 0.0009 : 0;

      for (let i = 0; i < 3; i++) {
        const meta = modo === 'error' ? 0 : modo === 'pensando' || modo === 'exito' ? 1
          : lim((largo - i * porAro) / porAro);
        if (quieto) { paso3[i] = meta; velPaso[i] = 0; }
        else {
          // Muelle con un rebote leve: cada carácter se siente como un clic.
          velPaso[i] = (velPaso[i] + (meta - paso3[i]) * 0.16 * f) * Math.pow(0.68, f);
          paso3[i] += velPaso[i] * f;
        }
        const sentido = Math.sign(OMEGA[i]);
        if (meta === 0 && paso3[i] < 0.03) {
          // Libre: gira solo, a su ritmo.
          velAng[i] += (OMEGA[i] * 16.7 * (modo === 'error' ? 5 : 1) - velAng[i]) * 0.04 * f;
        } else {
          // En camino: le falta (1 - paso) de un cuarto de vuelta para llegar.
          const objetivo = alineado + giroComun + sentido * (1 - paso3[i]) * 1.6;
          if (quieto) { ang[i] = objetivo; velAng[i] = 0; }
          else velAng[i] = (velAng[i] + corto(objetivo - ang[i]) * 0.09 * f) * Math.pow(0.7, f);
        }
        if (!quieto) ang[i] += velAng[i] * f;
      }
      abierta = modo !== 'error' && presencia > 0.5 && paso3.every(p => p > 0.97) &&
        Math.abs(corto(ang[2] - alineado - giroComun)) < 0.05;
      const activa = presencia > 0.05;
      if (activa !== reservaActiva) {
        reservaActiva = activa;
        // Al dormirse se dan por muertas: la próxima vez nacen sobre los aros.
        if (!activa) for (const c of reserva) c.edad = c.vida + 1;
      }
    };
    let rafQuieto = 0;
    this.refrescarCerradura = () => {
      if (!this.prefiereMenosMovimiento) { arrancar(); return; }
      cancelAnimationFrame(rafQuieto);
      rafQuieto = requestAnimationFrame(() => pintarQuieto());
    };

    const ondas: Onda[] = [];
    const VEL_ONDA = 1.05;           // px por ms
    const BANDA = 30;                // grosor del frente
    let modoPrevio: ModoCampo = 'libre';
    const iluminadas: number[] = [];  // segmentos tocados por una onda: x0, y0, x1, y1, luz

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
        if (el.id !== 'username') continue;   // la contraseña mueve la cerradura
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
      actualizarCerradura(dt);
      const fr = dt / 16.7;
      // Con error, al entrar o sin la cerradura a la vista, las acomodadas se sueltan.
      const soltar = modo === 'error' || modo === 'exito' || presencia < 0.3;
      fijas.length = 0;
      iluminadas.length = 0;

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
      const grupos = reservaActiva ? [corrientes, reserva] : [corrientes];
      for (let tono = 0; tono < 3; tono++) {
        ctx.strokeStyle = colores[tono];
        ctx.beginPath();
        for (const grupo of grupos) for (const c of grupo) {
          if (c.tono !== tono) continue;
          const deReserva = grupo === reserva;

          // Acomodada: ya no fluye ni deja estela; gira con su aro.
          if (c.aro >= 0) {
            if (soltar) liberar(c);
            else {
              const g = ang[c.aro] + anguloRanura(c.aro, c.ranura), rr = radioRanura(c.aro, c.ranura);
              const tx = cx + Math.cos(g) * rr, ty = cy + Math.sin(g) * rr;
              c.x += (tx - c.x) * Math.min(1, 0.22 * fr);
              c.y += (ty - c.y) * Math.min(1, 0.22 * fr);
              fijas.push(c.x, c.y, c.aro, c.ranura, Math.min(1, (t - c.llego) / 350));
              continue;
            }
          }
          let a = angulo(c.x, c.y);

          if (peso > 0) {
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

          // Cerradura: las corrientes cercanas se juntan en la banda del aro
          // más próximo y giran con él. La muesca la saltan sin dibujarse
          // (hueco limpio que gira con el aro); a sus lados brillan más (bisagras).
          let luzOrden = 0, velMul = 1, ocultar = false;
          if (presencia > 0.004) {
            const kx = c.x - cx, ky = c.y - cy;
            const kd = Math.sqrt(kx * kx + ky * ky);
            const th = Math.atan2(ky, kx);
            const relHaz = abierta && kd > radioMax * 0.42 && kd < radioMax * 2.4 ? corto(th - ang[1]) : 9;
            if (Math.abs(relHaz) < 0.3) {
              // Canal libre: las corrientes de alrededor se suman al haz y salen
              // disparadas por él. Apuntan a un punto más adelante del rayo: convergen.
              const mx = cx + Math.cos(ang[1]) * (kd + 70), my = cy + Math.sin(ang[1]) * (kd + 70);
              a += hacia(a, Math.atan2(my - c.y, mx - c.x)) * 0.9;
              const centrado = 1 - Math.abs(relHaz) / 0.3;
              velMul = 1.3 + 0.8 * centrado; luzOrden = 0.25 + 0.4 * centrado;
            } else if (kd > radioMax * 0.36 && kd < radioMax * 1.16) {
              let n = 0;
              for (let k = 1; k < 3; k++) if (Math.abs(kd - RADIOS[k] * radioMax) < Math.abs(kd - RADIOS[n] * radioMax)) n = k;
              const grosor = radioMax * ANCHO[n];
              // Cada corriente tiene su carril: el aro exterior va en dos filas.
              let off = (c.vida % 1) * 2 - 1;
              if (n === 2) off = Math.sign(off) * (0.5 + 0.5 * Math.abs(off));
              const desv = (kd - (RADIOS[n] * radioMax + off * grosor)) / (grosor * 2.5);
              const listo = lim(paso3[n]);
              const lleno = llenos[n] >= capacidad[n];
              // Con el aro completo las demás pasan casi de largo: el dial queda nítido.
              const s = presencia * (0.35 + 0.65 * listo) * (lleno ? 0.25 : 1);
              const rel = corto(th - ang[n]);
              const sentido = Math.sign(OMEGA[n]);
              const enBanda = Math.max(0, 1 - Math.abs(desv));
              if (!lleno && presencia > 0.5 && enBanda > 0.45 && Math.abs(rel) > MUESCA_RAD + 0.03) {
                // Llegó a la banda: ocupa la ranura libre más cercana.
                const i = n === 2
                  ? ((Math.round(rel / (Math.PI / 18)) + 36) % 36) * 2 + (off > 0 ? 1 : 0)
                  : (Math.round(rel / (Math.PI * 2 / RANURAS[n])) + RANURAS[n]) % RANURAS[n];
                if (!enMuesca(n, i) && !ocupado[n][i]) {
                  ocupado[n][i] = 1; llenos[n]++;
                  c.aro = n; c.ranura = i; c.llego = t;
                  continue;
                }
              }
              if (Math.abs(rel) < MUESCA_RAD) {
                // Muesca: la salta sin dibujarse.
                ocultar = s > 0.3; velMul = 2.2;
                a += hacia(a, th + sentido * Math.PI / 2) * s;
              } else {
                // Lejos de la banda entra casi recta; dentro gira tangente.
                const corr = Math.max(-1.1, Math.min(1.1, desv * 0.9));
                a += hacia(a, th + sentido * (Math.PI / 2 + corr)) * s * 0.95;
                velMul = 1 - 0.4 * s * enBanda;
                luzOrden = lleno ? 0 : s * enBanda * 0.2;
              }
            }
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

          const k = v * (tono === 2 ? 1.3 : 1) * (1 + luz * 1.2) * velMul;
          const nx = c.x + Math.cos(a) * k;
          const ny = c.y + Math.sin(a) * k;
          const brillo = Math.max(luz, luzOrden);
          if (ocultar) { /* salta la muesca */ }
          else if (brillo > 0.12) iluminadas.push(c.x, c.y, nx, ny, brillo);
          else { ctx.moveTo(c.x, c.y); ctx.lineTo(nx, ny); }
          c.x = nx; c.y = ny; c.edad++;
          if (c.edad > c.vida || nx < ox - 10 || ny < -10 || nx > w + 10 || ny > h + 10) nueva(c, deReserva);
        }
        ctx.stroke();
      }

      // Lo que tocó la onda o ya está en órbita: más claro (deja estela de luz).
      if (iluminadas.length) {
        const claro = modo === 'error' ? '255, 205, 213' : modo === 'exito' ? '220, 252, 231' : '237, 233, 254';
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

      // Capa limpia: el dial. Se borra entera cada fotograma (sin estelas) y
      // se oculta cuando no hay nada, que es casi siempre.
      if (!fijas.length) {
        if (capaSucia) { sx.clearRect(capaX, capaY, capaL, capaL); capa.style.display = 'none'; capaSucia = false; }
        return;
      }
      if (!capaSucia) { capa.style.display = ''; capaSucia = true; }
      sx.clearRect(capaX, capaY, capaL, capaL);
      sx.globalCompositeOperation = 'lighter';
      sx.lineCap = 'round';
      // Lavanda, no blanco: el dial acompaña al fondo en vez de competir con el texto.
      const claroDial = modo === 'pensando' ? '221, 214, 254' : '196, 181, 253';
      const grosorMedio = radioMax * ANCHO[1];
      for (let n = 0; n < 3; n++) {
        const listo = lim(paso3[n]);
        const alfa = 0.28 + 0.34 * listo;
        sx.strokeStyle = sx.fillStyle = `rgba(${claroDial}, ${alfa})`;
        sx.lineWidth = 0.9;
        sx.beginPath();
        const bisagras: number[] = [], nuevas: number[] = [];
        for (let k = 0; k < fijas.length; k += 5) {
          if (fijas[k + 2] !== n) continue;
          const x = fijas[k], y = fijas[k + 1], i = fijas[k + 3], lleg = fijas[k + 4];
          const relR = corto(anguloRanura(n, i));
          if (Math.abs(relR) < MUESCA_RAD + 0.2) { bisagras.push(x, y); continue; }
          if (lleg < 1) nuevas.push(x, y, lleg);
          if (n === 1) {
            // Bisel: marca radial, más larga cada cinco.
            const g = ang[1] + relR, L = (i % 4 === 0 ? 0.9 : 0.45) * grosorMedio;
            const dx = Math.cos(g), dy = Math.sin(g);
            sx.moveTo(x - dx * L, y - dy * L); sx.lineTo(x + dx * L, y + dy * L);
          } else {
            const r = n === 0 ? 1.2 : 1;
            sx.moveTo(x + r, y); sx.arc(x, y, r, 0, Math.PI * 2);
          }
        }
        if (n === 1) sx.stroke(); else sx.fill();
        // Bisagras: a los lados de la muesca, más gruesas y con halo.
        if (bisagras.length) {
          sx.fillStyle = `rgba(${claroDial}, ${Math.min(1, alfa + 0.2)})`;
          sx.beginPath();
          for (let k = 0; k < bisagras.length; k += 2) { sx.moveTo(bisagras[k] + 1.8, bisagras[k + 1]); sx.arc(bisagras[k], bisagras[k + 1], 1.8, 0, Math.PI * 2); }
          sx.fill();
        }
        // Recién llegadas: destello que se apaga en un tercio de segundo.
        if (nuevas.length) {
          sx.fillStyle = `rgba(${claroDial}, 0.18)`;
          sx.beginPath();
          for (let k = 0; k < nuevas.length; k += 3) { const r = 1.5 + 3 * (1 - nuevas[k + 2]); sx.moveTo(nuevas[k] + r, nuevas[k + 1]); sx.arc(nuevas[k], nuevas[k + 1], r, 0, Math.PI * 2); }
          sx.fill();
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

    // Móvil en reposo (nada enfocado, sin cerradura ni ondas): tras unos
    // segundos el fondo se queda quieto y el bucle se apaga para no gastar
    // batería. Vuelve en cuanto se toca un campo.
    let reposoDesde = 0;
    const enReposo = () => window.innerWidth < 1024 && this.modo === 'libre' &&
      !this.estrellasObjetivo && presencia < 0.01 && !ondas.length && !this.teclas.length;

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
      actualizarCerradura(0, true);
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
    this.refrescarCerradura?.();
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
      this.abrirCortina();
      this.ponerModo('exito');
      setTimeout(() => this.router.navigateByUrl('/'), this.prefiereMenosMovimiento ? 0 : 900);
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

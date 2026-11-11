import {
  Component, inject, signal, OnInit, OnDestroy,
  AfterViewInit, ElementRef, ViewChild, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthPieComponent } from './auth-pie.component';

/** Estado del campo de corrientes: refleja lo que pasa en el formulario. */
export type ModoCampo = 'libre' | 'atento' | 'pensando' | 'error' | 'exito';

/** Una partícula del campo de corrientes: un trazo que sigue el flujo. */
interface Corriente { x: number; y: number; edad: number; vida: number; tono: 0 | 1 | 2; }

/** Estrella del anillo: una por carácter escrito (nunca el carácter). */
interface Estrella { x: number; y: number; vx: number; vy: number; nace: number; }

/** Onda que sale del núcleo cuando llega una chispa. */
interface Onda { r: number; a: number; }

/** Chispa que viaja desde el campo donde se escribe hasta el núcleo. */
interface Chispa { x0: number; y0: number; qx: number; qy: number; t0: number; dur: number; estrella: boolean; }

/** Tecla pendiente de convertirse en chispa (la lanza el bucle de dibujo). */
interface Tecla { el: HTMLElement; estrella: boolean; }


@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthPieComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('raiz', { static: false }) raizRef?: ElementRef<HTMLElement>;
  @ViewChild('visual', { static: false }) visualRef?: ElementRef<HTMLElement>;
  @ViewChild('lado', { static: false }) ladoRef?: ElementRef<HTMLElement>;
  /** Hueco sobre el formulario donde vive el núcleo en móvil y tablet vertical. */
  @ViewChild('hueco', { static: false }) huecoRef?: ElementRef<HTMLElement>;
  @ViewChild('flow', { static: false }) flowRef?: ElementRef<HTMLCanvasElement>;
  /** Lienzo aparte para chispas, ondas y anillo: se limpia cada fotograma (sin estelas). */
  @ViewChild('stars', { static: false }) starsRef?: ElementRef<HTMLCanvasElement>;

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
  private energia = 0;
  private enFoco = false;
  private modoTimer: ReturnType<typeof setTimeout> | null = null;
  /** Cuántas estrellas debe tener el anillo: largo de la contraseña o del código. */
  private estrellasObjetivo = 0;
  /** Teclas pulsadas que aún no salieron como chispa. */
  private teclas: Tecla[] = [];

  /** «Buenos días / Buenas tardes / Buenas noches» según la hora del equipo. */
  readonly saludo = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
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
    // Solo importa el largo: el anillo nunca conoce los caracteres.
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
  }

  ngOnDestroy(): void {
    this.detenerCampo?.();
    if (this.sacudirTimer) clearTimeout(this.sacudirTimer);
    if (this.modoTimer) clearTimeout(this.modoTimer);
  }

  private ponerModo(m: ModoCampo): void {
    if (this.modoTimer) { clearTimeout(this.modoTimer); this.modoTimer = null; }
    this.modo = m;
    this.estadoCampo.set(m);
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
  }

  alDesenfocar(): void {
    this.enFoco = false;
    // focusout llega antes que el focusin del siguiente campo: se espera un tick.
    setTimeout(() => { if (!this.enFoco && this.modo === 'atento') this.ponerModo('libre'); });
  }

  /** Cada tecla da un impulso al flujo y lanza una chispa desde el campo. */
  alEscribir(e: Event): void {
    this.energia = Math.min(2.2, this.energia + 0.7);
    const el = e.target as HTMLElement | null;
    if (!el || el.tagName !== 'INPUT' || (el as HTMLInputElement).type === 'checkbox') return;
    const esClave = el.id === 'password' || el.id === 'codigo2fa';
    if (this.desafio()) this.estrellasObjetivo = this.codigo().length;
    // Borrar no lanza chispa: el anillo pierde la estrella al instante.
    if ((e as InputEvent).inputType?.startsWith('delete')) return;
    if (this.teclas.length < 24) this.teclas.push({ el, estrella: esClave });
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
     - Chispas: cada tecla sale del campo donde se escribe y viaja
       en curva hasta el núcleo.
     - Anillo: cada carácter de la contraseña (o del código) es una
       estrella en un círculo alrededor del núcleo; un arco las une.
     Rendimiento: un trazo por color y fotograma, densidad de píxel
     ≤ 1,5, pausa con la pestaña oculta, bucle fuera de Angular.
     ═══════════════════════════════════════════════════════════ */
  private iniciarCampo(): void {
    const visual = this.visualRef?.nativeElement;
    const lado = this.ladoRef?.nativeElement;
    const hueco = this.huecoRef?.nativeElement;
    const canvas = this.flowRef?.nativeElement;
    const capa = this.starsRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    const sx = capa?.getContext('2d');
    if (!visual || !lado || !hueco || !canvas || !capa || !ctx || !sx) return;

    const PALETAS: Record<ModoCampo, string[]> = {
      libre:    ['rgba(167, 139, 250, 0.40)', 'rgba(233, 225, 255, 0.28)', 'rgba(251, 191, 36, 0.38)'],
      atento:   ['rgba(167, 139, 250, 0.48)', 'rgba(233, 225, 255, 0.34)', 'rgba(251, 191, 36, 0.42)'],
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
    let raf = 0, t = Math.random() * 1e4, ultimo = 0;
    // Puntero (objetivo y posición suavizada), en píxeles de pantalla.
    let pxT = -1e4, pyT = -1e4, px = -1e4, py = -1e4;

    const nueva = (c?: Corriente): Corriente => {
      const r = Math.random();
      const n = c ?? { x: 0, y: 0, edad: 0, vida: 0, tono: 0 };
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
      // La capa de chispas y anillo sí va a resolución completa (son pocos
      // trazos y deben verse nítidos), pero solo se pinta cuando hay algo.
      capa.width = Math.round(w * dpr);
      capa.height = Math.round(h * dpr);
      sx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    const paso = (dt: number, desvanecer: boolean) => {
      t += dt;
      px += (pxT - px) * 0.1;
      py += (pyT - py) * 0.1;

      const modo = this.modo;
      const { peso, giro, vel } = AJUSTE[modo];
      const colores = PALETAS[modo];
      const cx = this.nucleo.x, cy = this.nucleo.y;

      if (desvanecer) {
        // Borra un poco del fotograma anterior: deja estelas que se apagan.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = modo === 'exito' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(0, 0, 0, 0.028)';
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

      this.energia *= 0.94;
      const v = 0.85 * (dt / 16.7) * vel * (1 + this.energia);
      const R = Math.min(190, w * 0.3);
      // Sin puntero en la ventana (táctil o fuera): R2 = 0 y no se calcula.
      const R2 = px > -5000 ? R * R : 0;
      for (let tono = 0; tono < 3; tono++) {
        ctx.strokeStyle = colores[tono];
        ctx.beginPath();
        for (const c of corrientes) {
          if (c.tono !== tono) continue;
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

          const dx = c.x - px, dy = c.y - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2);
            // Remolino alrededor del puntero, más fuerte cuanto más cerca.
            const f = (1 - d / R) * 0.9;
            const ta = Math.atan2(dy, dx) + Math.PI / 2;
            a += hacia(a, ta) * f;
          }

          const k = v * (tono === 2 ? 1.3 : 1);
          const nx = c.x + Math.cos(a) * k;
          const ny = c.y + Math.sin(a) * k;
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(nx, ny);
          c.x = nx; c.y = ny; c.edad++;
          if (c.edad > c.vida || nx < ox - 10 || ny < -10 || nx > w + 10 || ny > h + 10) nueva(c);
        }
        ctx.stroke();
      }
    };

    /* Capa superior: chispas, ondas y anillo (se limpia cada fotograma). */
    const estrellas: Estrella[] = [];
    const ondas: Onda[] = [];
    const chispas: Chispa[] = [];
    let llegadas = 0;
    let modoPrevio: ModoCampo = 'libre';
    let crecer = 1;

    const curva = (c: Chispa, p: number) => {
      const u = 1 - p;
      return {
        x: u * u * c.x0 + 2 * u * p * c.qx + p * p * this.nucleo.x,
        y: u * u * c.y0 + 2 * u * p * c.qy + p * p * this.nucleo.y,
      };
    };
    const suave = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

    let capaSucia = false;
    const dibujarCapa = (dt: number) => {
      const modo = this.modo;
      const { x: cx, y: cy, r: R } = this.nucleo;
      const f = dt / 16.7;
      // Casi todo el tiempo no hay chispas, ondas ni anillo: entonces la capa
      // ni se borra ni se dibuja. Además se oculta: una capa a pantalla
      // completa, aunque esté vacía, se compone en cada fotograma (medido: de
      // 30 a 44 fps sin ella).
      const vacia = !this.teclas.length && !chispas.length && !ondas.length &&
        !estrellas.length && !(this.estrellasObjetivo && llegadas);
      if (vacia) {
        if (capaSucia) { sx.clearRect(0, 0, w, h); capa.style.display = 'none'; capaSucia = false; }
        crecer = 1;
        modoPrevio = modo;
        return;
      }
      if (!capaSucia) capa.style.display = '';
      capaSucia = true;
      sx.clearRect(0, 0, w, h);
      sx.globalCompositeOperation = 'lighter';
      const color = modo === 'error' ? '251, 113, 133' : modo === 'exito' ? '220, 252, 231' : '221, 214, 254';

      // Nuevas chispas: salen del borde derecho del campo (o de arriba en móvil).
      while (this.teclas.length) {
        const { el, estrella } = this.teclas.shift()!;
        const r = el.getBoundingClientRect();
        const ancho = window.innerWidth >= 1024;
        const x0 = ancho ? r.right - 18 : r.left + r.width * (0.35 + Math.random() * 0.3);
        const y0 = ancho ? r.top + r.height / 2 : r.top;
        const lado = Math.random() < 0.5 ? -1 : 1;
        chispas.push({
          x0, y0,
          qx: (x0 + cx) / 2 + (ancho ? 0 : lado * (40 + Math.random() * 60)),
          qy: ancho ? Math.min(y0, cy) - 40 - Math.random() * 90 * lado : (y0 + cy) / 2,
          t0: t, dur: 620 + Math.random() * 220, estrella,
        });
      }

      // Chispas en vuelo: cabeza brillante y cola corta que se apaga.
      sx.lineCap = 'round';
      for (let i = chispas.length - 1; i >= 0; i--) {
        const c = chispas[i];
        const p = Math.min(1, (t - c.t0) / c.dur);
        const e = suave(p);
        for (let k = 0; k < 7; k++) {
          const a0 = Math.max(0, e - k * 0.03), a1 = Math.max(0, e - (k + 1) * 0.03);
          if (a0 === a1) break;
          const q0 = curva(c, a0), q1 = curva(c, a1);
          sx.strokeStyle = `rgba(${color}, ${0.8 * (1 - k / 7)})`;
          sx.lineWidth = 2 * (1 - k / 7) + 0.4;
          sx.beginPath(); sx.moveTo(q0.x, q0.y); sx.lineTo(q1.x, q1.y); sx.stroke();
        }
        const cab = curva(c, e);
        sx.fillStyle = `rgba(${color}, 0.18)`;
        sx.beginPath(); sx.arc(cab.x, cab.y, 6, 0, Math.PI * 2); sx.fill();
        sx.fillStyle = `rgba(${color}, 1)`;
        sx.beginPath(); sx.arc(cab.x, cab.y, 1.8, 0, Math.PI * 2); sx.fill();
        if (p >= 1) {
          chispas.splice(i, 1);
          ondas.push({ r: R * 0.35, a: 0.45 });
          if (c.estrella) llegadas++;
        }
      }

      // Ondas que salen del núcleo al llegar cada chispa.
      sx.lineWidth = 1.25;
      for (let i = ondas.length - 1; i >= 0; i--) {
        const o = ondas[i];
        o.r += 2.6 * f;
        o.a *= Math.pow(0.95, f);
        if (o.a < 0.02) { ondas.splice(i, 1); continue; }
        sx.strokeStyle = `rgba(${color}, ${o.a})`;
        sx.beginPath(); sx.arc(cx, cy, o.r, 0, Math.PI * 2); sx.stroke();
      }

      // Anillo: estrellas = caracteres que ya llegaron (y que siguen escritos).
      llegadas = Math.min(llegadas, this.estrellasObjetivo);
      const cuantas = Math.min(llegadas, 36);
      if (modo !== 'error') {
        while (estrellas.length < cuantas) estrellas.push({ x: cx, y: cy, vx: 0, vy: 0, nace: t });
        if (estrellas.length > cuantas) estrellas.length = cuantas;
      }
      // Al fallar, cada estrella sale despedida y cae.
      if (modo === 'error' && modoPrevio !== 'error') {
        for (const e of estrellas) {
          const ang = Math.random() * Math.PI * 2;
          const vel = 1.5 + Math.random() * 2.5;
          e.vx = Math.cos(ang) * vel;
          e.vy = Math.sin(ang) * vel - 1.5;
        }
      }
      if (modoPrevio === 'error' && modo !== 'error') {
        // Pasado el error, el anillo se rehace desde el núcleo.
        for (const e of estrellas) { e.x = cx; e.y = cy; e.nace = t; }
      }
      crecer = modo === 'exito' ? crecer + (7 - crecer) * 0.05 * f : 1;
      modoPrevio = modo;
      if (!estrellas.length) return;

      // 12 estrellas por vuelta (6 en el código de dos pasos: lo cierra entero).
      const porVuelta = this.desafio() ? 6 : 12;
      const pasoAng = (Math.PI * 2) / porVuelta;
      const giro = t * 0.00018;
      const radio = (vuelta: number) => (R + vuelta * R * 0.42) * crecer;
      const alfa = modo === 'exito' ? Math.max(0, 1.5 - crecer * 0.25) : 1;

      if (modo !== 'error') {
        // Guía tenue de cada vuelta y arco brillante con lo ya escrito.
        const vueltas = Math.ceil(estrellas.length / porVuelta);
        for (let v = 0; v < vueltas; v++) {
          const enVuelta = Math.min(porVuelta, estrellas.length - v * porVuelta);
          const sentido = v % 2 ? -1 : 1;
          const a0 = -Math.PI / 2 + giro * sentido;
          sx.lineWidth = 1;
          sx.strokeStyle = `rgba(${color}, ${0.07 * alfa})`;
          sx.beginPath(); sx.arc(cx, cy, radio(v), 0, Math.PI * 2); sx.stroke();
          if (enVuelta > 1) {
            sx.lineWidth = 1.5;
            sx.strokeStyle = `rgba(${color}, ${0.45 * alfa})`;
            sx.beginPath();
            if (enVuelta === porVuelta) sx.arc(cx, cy, radio(v), 0, Math.PI * 2);
            else sx.arc(cx, cy, radio(v), a0, a0 + (enVuelta - 1) * pasoAng * sentido, sentido < 0);
            sx.stroke();
          }
        }
      }

      estrellas.forEach((e, i) => {
        if (modo === 'error') {
          e.x += e.vx * f; e.y += e.vy * f; e.vy += 0.16 * f;
          return;
        }
        const v = Math.floor(i / porVuelta);
        const sentido = v % 2 ? -1 : 1;
        const ang = -Math.PI / 2 + giro * sentido + (i % porVuelta) * pasoAng * sentido;
        const tx = cx + Math.cos(ang) * radio(v), ty = cy + Math.sin(ang) * radio(v);
        e.x += (tx - e.x) * 0.2 * f;
        e.y += (ty - e.y) * 0.2 * f;
      });

      // Estrellas: halo y punto brillante; las nuevas nacen con destello.
      for (const e of estrellas) {
        const edad = Math.min(1, (t - e.nace) / 400);
        const brillo = 1 + (1 - edad) * 1.6;
        sx.fillStyle = `rgba(${color}, ${0.12 * alfa * brillo})`;
        sx.beginPath(); sx.arc(e.x, e.y, 6 * brillo, 0, Math.PI * 2); sx.fill();
        sx.fillStyle = `rgba(${color}, ${0.95 * alfa})`;
        sx.beginPath(); sx.arc(e.x, e.y, 2, 0, Math.PI * 2); sx.fill();
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

    const bucle = (ahora: number) => {
      const dt = ultimo ? Math.min(40, ahora - ultimo) : 16.7;
      ultimo = ahora;
      paso(dt, true);
      dibujarCapa(dt);
      ajustarCalidad(dt);
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

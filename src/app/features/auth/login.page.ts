import {
  Component, inject, signal, OnInit, OnDestroy,
  AfterViewInit, ElementRef, ViewChild, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import * as THREE from 'three';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html'
})
export class LoginPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('neuralCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sphereContainer', { static: false }) sphereContainerRef!: ElementRef<HTMLDivElement>;

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);

  // Hacker / AI text animation
  displayTitle    = signal('·······');
  displayGAC      = signal('···');
  displaySubtitle = signal('··············');
  private hackerInterval: any = null;

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    remember: [false]
  });

  private readonly EMAIL_KEY = 'app_login_email_v1';
  private readonly EMAIL_TTL_MS = 1000 * 60 * 60 * 24 * 30;

  // Canvas state
  private neuralAnimId = 0;
  private neuralCtx: CanvasRenderingContext2D | null = null;
  private resizeObs: ResizeObserver | null = null;
 
  // Three.js state
  private threeScene: THREE.Scene | null = null;
  private threeCamera: THREE.PerspectiveCamera | null = null;
  private threeRenderer: THREE.WebGLRenderer | null = null;
  private threeAnimId = 0;
  private mainGroup: THREE.Group | null = null;
  private plasmaMat: THREE.ShaderMaterial | null = null;
  private pMat: THREE.ShaderMaterial | null = null;
  private threeClock = new THREE.Clock();

  ngOnInit(): void {
    const raw = localStorage.getItem(this.EMAIL_KEY);
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj?.email && obj?.ts && (Date.now() - obj.ts) <= this.EMAIL_TTL_MS) {
          this.form.patchValue({ username: obj.email, remember: true });
        } else {
          localStorage.removeItem(this.EMAIL_KEY);
        }
      } catch (e) {
        localStorage.removeItem(this.EMAIL_KEY);
      }
    }
  }

  ngAfterViewInit(): void {
    this.initNeuralCanvas();
    this.initPlasmaSphere();
    // Auto-trigger cinematic decrypt on load
    setTimeout(() => this.triggerHackerText(), 400);
  }

  ngOnDestroy(): void {
    if (this.neuralAnimId) cancelAnimationFrame(this.neuralAnimId);
    if (this.threeAnimId) cancelAnimationFrame(this.threeAnimId);
    if (this.resizeObs) this.resizeObs.disconnect();
    if (this.hackerInterval) clearInterval(this.hackerInterval);
  }

  /* ═══════════════════════════════════════════ */
  /* Hacker Text: Minimal Futuristic Reveal      */
  /* ═══════════════════════════════════════════ */
  private readonly HEX = '0123456789ABCDEF';

  triggerHackerText(): void {
    if (this.hackerInterval) return;

    const title = 'Sistema';
    const gac   = 'GAC';
    const sub   = 'Administración';

    // Frames × 45ms:
    // F1-12  : reveal title left-to-right (540ms)
    // F13-18 : reveal GAC (270ms)
    // F19+   : typewriter subtitle (sub.length × 45ms ≈ 630ms)
    const FLASH = 0, TITLE = 12, GAC = 18, TOTAL = GAC + sub.length + 2;
    let f = 0;
    const ease = (t: number) => t < 0.5 ? 2*t*t : -1 + (4-2*t)*t;
    const hex  = (len: number) => Array.from({length: len}, () => this.HEX[Math.floor(Math.random()*16)]).join('');
    const lock = (word: string, rev: number) =>
      word.slice(0, rev) + hex(word.length - rev);

    this.displaySubtitle.set('·'.repeat(sub.length));

    this.hackerInterval = setInterval(() => {
      this.ngZone.run(() => {
        f++;

        if (f <= TITLE) {
          const t = ease(f / TITLE);
          this.displayTitle.set(lock(title, Math.floor(t * title.length)));
          this.displayGAC.set('···');

        } else if (f <= GAC) {
          const t = ease((f - TITLE) / (GAC - TITLE));
          this.displayTitle.set(title);
          this.displayGAC.set(lock(gac, Math.floor(t * gac.length)));

        } else {
          const rev = Math.min(f - GAC, sub.length);
          this.displayTitle.set(title);
          this.displayGAC.set(gac);
          this.displaySubtitle.set(
            sub.slice(0, rev) + '·'.repeat(sub.length - rev)
          );
        }

        if (f >= TOTAL) {
          this.displayTitle.set(title);
          this.displayGAC.set(gac);
          this.displaySubtitle.set(sub);
          clearInterval(this.hackerInterval);
          this.hackerInterval = null;
        }
      });
    }, 45);
  }

  /* ═══════════════════════════════════════════ */
  /* Neural Canvas (minimal organic neurons)     */
  /* ═══════════════════════════════════════════ */
  private initNeuralCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    this.neuralCtx = canvas.getContext('2d');
    if (!this.neuralCtx) return;

    const setSize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      this.neuralCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();

    this.resizeObs = new ResizeObserver(() => setSize());
    this.resizeObs.observe(document.body);

    this.animateNeural();
  }

  private animateNeural = (): void => {
    if (!this.neuralCtx) return;
    const ctx = this.neuralCtx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const t = Date.now() * 0.0002;

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.max(w, h) * 0.6;

    // Organic Branching Neurons
    for (let i = 0; i < 15; i++) {
      const seed = i * 23.4;
      // Posición del soma (cuerpo celular)
      const nx = cx + Math.sin(seed * 0.7 + t * 0.3) * Math.cos(seed * 0.3) * w * 0.45;
      const ny = cy + Math.sin(seed * 0.5 + t * 0.25) * Math.cos(seed * 0.8 + t * 0.2) * h * 0.45;

      const dist = Math.sqrt((nx - cx)**2 + (ny - cy)**2);
      const fade = Math.max(0, 1 - dist / maxR);
      if (fade < 0.1) continue;

      const pulse = (Math.sin(t * 4 + seed) + 1) / 2;
      const alpha = fade * 0.15;

      // Dibujar dendritas (ramas) saliendo del soma
      const branches = 4;
      for (let b = 0; b < branches; b++) {
        const bSeed = seed + b * 5.7;
        ctx.beginPath();
        ctx.moveTo(nx, ny);

        let lx = nx;
        let ly = ny;
        const steps = 40;
        for (let s = 1; s <= steps; s++) {
          const angle = (b / branches) * Math.PI * 2 + Math.sin(bSeed * 1.3 + s * 0.15 + t) * 0.8;
          const length = 4;
          const targetX = lx + Math.cos(angle) * length;
          const targetY = ly + Math.sin(angle) * length;

          ctx.lineTo(targetX, targetY);
          lx = targetX;
          ly = targetY;
        }
        ctx.strokeStyle = `rgba(139, 92, 246, ${alpha * 0.4})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Dibujar Soma
      ctx.beginPath();
      ctx.arc(nx, ny, 2 + pulse * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167, 139, 250, ${alpha * (1 + pulse)})`;
      ctx.fill();

      // Soma Glow
      ctx.beginPath();
      ctx.arc(nx, ny, 6, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, 8);
      grad.addColorStop(0, `rgba(139, 92, 246, ${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    this.neuralAnimId = requestAnimationFrame(this.animateNeural);
  };

  /* ═══════════════════════════════════════════ */
  /* Three.js Plasma Sphere                      */
  /* ═══════════════════════════════════════════ */
  private initPlasmaSphere(): void {
    const container = this.sphereContainerRef?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const size = Math.round(rect.width) || 160;
    const scene = new THREE.Scene();
    this.threeScene = scene;

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 2.6;
    this.threeCamera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const canvasEl = renderer.domElement;
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.borderRadius = '50%';
    container.appendChild(canvasEl);
    this.threeRenderer = renderer;

    const group = new THREE.Group();
    scene.add(group);
    this.mainGroup = group;

    scene.add(new THREE.AmbientLight(0xfdf4ff, 0.9));
    const pl = new THREE.PointLight(0xe879f9, 8, 20);
    pl.position.set(0, 0, 1);
    scene.add(pl);

    const shellVert = `
      varying vec3 vNormal; varying vec3 vViewPos;
      void main(){
        vNormal=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        vViewPos=-mv.xyz;
        gl_Position=projectionMatrix*mv;
      }`;
    const shellFrag = `
      varying vec3 vNormal; varying vec3 vViewPos;
      uniform vec3 uColor; uniform float uOpacity;
      void main(){
        float f=pow(1.0-dot(normalize(vNormal),normalize(vViewPos)),2.5);
        gl_FragColor=vec4(uColor,f*uOpacity);
      }`;

    const shellGeo = new THREE.SphereGeometry(1.0, 64, 64);
    group.add(new THREE.Mesh(shellGeo, new THREE.ShaderMaterial({
      vertexShader: shellVert, fragmentShader: shellFrag,
      uniforms: { uColor: { value: new THREE.Color(0x4c1d95) }, uOpacity: { value: 0.15 } },
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false
    })));

    const plasmaGeo = new THREE.SphereGeometry(0.94, 64, 64);
    this.plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 0.13 },
        uBrightness: { value: 1.7 },
        uThreshold: { value: 0.04 },
        uColorDeep: { value: new THREE.Color(0x170c2e) },
        uColorMid: { value: new THREE.Color(0x9333ea) },
        uColorBright: { value: new THREE.Color(0xe879f9) },
      },
      vertexShader: `
        varying vec3 vPosition; varying vec3 vNormal; varying vec3 vViewPos;
        void main(){
          vPosition=position;
          vNormal=normalize(normalMatrix*normal);
          vec4 mv=modelViewMatrix*vec4(position,1.0);
          vViewPos=-mv.xyz;
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: `
        uniform float uTime,uScale,uBrightness,uThreshold;
        uniform vec3 uColorDeep,uColorMid,uColorBright;
        varying vec3 vPosition,vNormal,vViewPos;
        ${GLSL_NOISE}
        void main(){
          float n=fbm(vPosition*uScale*10.0+uTime*0.5);
          float a=smoothstep(uThreshold,uThreshold+0.3,n);
          vec3 c=mix(uColorDeep,uColorMid,a);
          c=mix(c,uColorBright,smoothstep(0.6,1.0,n));
          float d=dot(normalize(vNormal),vec3(0.0,0.0,1.0));
          d=smoothstep(-0.2,0.6,d);
          float fa=a*(0.02+0.98*d);
          gl_FragColor=vec4(c*uBrightness,fa);
        }`,
      transparent: true, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false
    });
    group.add(new THREE.Mesh(plasmaGeo, this.plasmaMat));

    const pCount = 200;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const r = 0.95 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i*3+2] = r * Math.cos(phi);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    this.pMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xfae8ff) } },
      vertexShader: `
        uniform float uTime;
        void main(){
          vec3 pos=position;
          pos.y+=sin(uTime*0.2+pos.x)*0.02;
          vec4 mv=modelViewMatrix*vec4(pos,1.0);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=4.0 * (1.0/-mv.z);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        void main(){
          if(length(gl_PointCoord-0.5)>0.5)discard;
          gl_FragColor=vec4(uColor,0.8);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    group.add(new THREE.Points(pGeo, this.pMat));

    this.animateSphere();
  }

  private animateSphere = (): void => {
    this.threeAnimId = requestAnimationFrame(this.animateSphere);
    const t = this.threeClock.getElapsedTime() * 0.78;
    if (this.plasmaMat) this.plasmaMat.uniforms['uTime'].value = t;
    if (this.pMat) this.pMat.uniforms['uTime'].value = t;
    if (this.mainGroup) {
      this.mainGroup.rotation.x += 0.002;
      this.mainGroup.rotation.y += 0.004;
    }
    if (this.threeRenderer && this.threeScene && this.threeCamera) {
      this.threeRenderer.render(this.threeScene, this.threeCamera);
    }
  };

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true); this.error.set(null);
    const { username, password, remember } = this.form.getRawValue() as { username: string; password: string; remember: boolean };
    this.auth.login({ username, password }).subscribe({
      next: () => {
        try {
          if (remember) {
            localStorage.setItem(this.EMAIL_KEY, JSON.stringify({ email: username, ts: Date.now() }));
          } else {
            localStorage.removeItem(this.EMAIL_KEY);
          }
        } catch { }
        this.auth.me().subscribe({
          next: () => { this.loading.set(false); this.router.navigateByUrl('/'); },
          error: () => { this.loading.set(false); this.router.navigateByUrl('/'); }
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'No se pudo iniciar sesión');
      }
    });
  }
}
 
const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];
const P = new Uint8Array(512);
const PERM = new Uint8Array(512);
(() => {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) {
    P[i] = p[i & 255];
    PERM[i] = P[i];
  }
})();
 
function simplex3(x: number, y: number, z: number): number {
  const s = (x + y + z) * (1 / 3);
  const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
  const t = (i + j + k) * (1 / 6);
  const x0 = x - i + t, y0 = y - j + t, z0 = z - k + t;
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }
  const x1 = x0 - i1 + 1 / 6, y1 = y0 - j1 + 1 / 6, z1 = z0 - k1 + 1 / 6;
  const x2 = x0 - i2 + 1 / 3, y2 = y0 - j2 + 1 / 3, z2 = z0 - k2 + 1 / 3;
  const x3 = x0 - 1 / 2, y3 = y0 - 1 / 2, z3 = z0 - 1 / 2;
  const ii = i & 255, jj = j & 255, kk = k & 255;
  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 > 0) {
    const gi = (PERM[ii + PERM[jj + PERM[kk]]] % 12);
    t0 *= t0; n0 = t0 * t0 * (GRAD3[gi][0] * x0 + GRAD3[gi][1] * y0 + GRAD3[gi][2] * z0);
  }
  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 > 0) {
    const gi = (PERM[ii + i1 + PERM[jj + j1 + PERM[kk + k1]]] % 12);
    t1 *= t1; n1 = t1 * t1 * (GRAD3[gi][0] * x1 + GRAD3[gi][1] * y1 + GRAD3[gi][2] * z1);
  }
  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 > 0) {
    const gi = (PERM[ii + i2 + PERM[jj + j2 + PERM[kk + k2]]] % 12);
    t2 *= t2; n2 = t2 * t2 * (GRAD3[gi][0] * x2 + GRAD3[gi][1] * y2 + GRAD3[gi][2] * z2);
  }
  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 > 0) {
    const gi = (PERM[ii + 1 + PERM[jj + 1 + PERM[kk + 1]]] % 12);
    t3 *= t3; n3 = t3 * t3 * (GRAD3[gi][0] * x3 + GRAD3[gi][1] * y3 + GRAD3[gi][2] * z3);
  }
  return 32 * (n0 + n1 + n2 + n3);
}
 
const GLSL_NOISE = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
  }
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * snoise(p); p *= 2.0; a *= 0.5; }
    return v;
  }
`;
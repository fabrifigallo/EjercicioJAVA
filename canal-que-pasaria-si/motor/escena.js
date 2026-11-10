// Motor de escena 3D: "¿Qué pasaría si...?"
// Render determinista: el script de render llama a window.cargar(datos) una vez
// y después a window.dibujar(t) para cada cuadro (t en segundos).
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const suave = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const lerpLog = (a, b, k) => (a > 0 && b > 0) ? Math.exp(lerp(Math.log(a), Math.log(b), k)) : lerp(a, b, k);

function azar(semilla) { // PRNG determinista (mulberry32)
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Ambientes (paletas de cielo, niebla, suelo y luz)
// ---------------------------------------------------------------------------
const AMBIENTES = {
  dia:       { arriba: '#3b7fd6', abajo: '#cfe9ff', niebla: '#d6ecff', suelo: '#5f9e3a', luz: 1.0, solAlt: 45, estrellas: 0 },
  atardecer: { arriba: '#28396f', abajo: '#ff9a4d', niebla: '#f0a070', suelo: '#46652a', luz: 0.7, solAlt: 4,  estrellas: 0.1 },
  noche:     { arriba: '#01030a', abajo: '#0e1b36', niebla: '#0b1426', suelo: '#0f1f0e', luz: 0.18, solAlt: -25, estrellas: 1 },
  tormenta:  { arriba: '#383e46', abajo: '#7b838a', niebla: '#6c747b', suelo: '#3c532e', luz: 0.45, solAlt: 35, estrellas: 0 },
  desierto:  { arriba: '#3f86d4', abajo: '#f4dcae', niebla: '#ebd3a3', suelo: '#c9a463', luz: 1.1, solAlt: 60, estrellas: 0 },
  nieve:     { arriba: '#6d93c4', abajo: '#eaf2fb', niebla: '#e6eff8', suelo: '#eef3f8', luz: 1.0, solAlt: 25, estrellas: 0 },
  espacio:   { arriba: '#000000', abajo: '#03050d', niebla: '#000000', suelo: '#000000', luz: 1.2, solAlt: 20, estrellas: 1 },
  crepusculo:{ arriba: '#34598e', abajo: '#a3b9cc', niebla: '#93a9bd', suelo: '#4a7434', luz: 0.75, solAlt: 25, estrellas: 0.12 },
  marte:     { arriba: '#6b3a26', abajo: '#d99a6c', niebla: '#c98a5e', suelo: '#a4512b', luz: 0.9, solAlt: 35, estrellas: 0 },
};

function paleta(nombre) {
  const p = AMBIENTES[nombre] || AMBIENTES.dia;
  return {
    arriba: new THREE.Color(p.arriba), abajo: new THREE.Color(p.abajo),
    niebla: new THREE.Color(p.niebla), suelo: new THREE.Color(p.suelo),
    luz: p.luz, solAlt: p.solAlt, estrellas: p.estrellas,
  };
}
function mezclarPaletas(a, b, k) {
  return {
    arriba: a.arriba.clone().lerp(b.arriba, k), abajo: a.abajo.clone().lerp(b.abajo, k),
    niebla: a.niebla.clone().lerp(b.niebla, k), suelo: a.suelo.clone().lerp(b.suelo, k),
    luz: lerp(a.luz, b.luz, k), solAlt: lerp(a.solAlt, b.solAlt, k), estrellas: lerp(a.estrellas, b.estrellas, k),
  };
}

// Parámetros de escena por defecto (cada etapa hereda de la anterior)
const ESCENA_BASE = {
  ambiente: 'dia',
  velocidad: 15,     // m/s visuales de avance de la cámara (no tiene que ser el valor real)
  altura: 1.6,       // metros sobre el suelo
  mirar: -2,         // inclinación de la cámara en grados (negativo = hacia abajo)
  fov: 62,
  temblor: 0,        // 0..1
  lineas: 0,         // 0..1 líneas de velocidad
  sol: 0,            // ciclos día/noche por segundo real (0 = sol fijo según ambiente)
  estaciones: 0,     // años por segundo real (cambia el color del suelo)
  calor: 0,          // 0..1 resplandor de calor/plasma en los bordes
  viento: 6,         // m/s de las nubes (en time-lapse se acelera)
  faseSol: 0.2,      // posición inicial del sol en el ciclo (0.25 = mediodía)
  objetos: ['carretera', 'arboles', 'postes', 'montanas', 'nubes'],
};
const NUMERICOS = ['velocidad', 'altura', 'mirar', 'fov', 'temblor', 'lineas', 'sol', 'estaciones', 'calor', 'viento'];
const LOGARITMICOS = new Set(['velocidad', 'altura', 'sol', 'estaciones', 'viento']);
const TRANSICION = 2.5; // segundos de fundido entre etapas

// ---------------------------------------------------------------------------
// Renderer, cámara y escena
// ---------------------------------------------------------------------------
const lienzo = document.getElementById('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 5e10);
escena.fog = new THREE.Fog(0xd6ecff, 50, 1500);

const luzHemi = new THREE.HemisphereLight(0xffffff, 0x445533, 0.9);
const luzSol = new THREE.DirectionalLight(0xffffff, 2.2);
escena.add(luzHemi, luzSol);

// Cielo: esfera con degradé (sigue a la cámara)
const cieloMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { arriba: { value: new THREE.Color() }, abajo: { value: new THREE.Color() }, alt: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }`,
  fragmentShader: `uniform vec3 arriba; uniform vec3 abajo; uniform float alt; varying vec3 vDir;
    void main(){ float h = clamp(vDir.y * 1.6 + 0.08 + alt, 0.0, 1.0); gl_FragColor = vec4(mix(abajo, arriba, pow(h, 0.7)), 1.0); }`,
});
const cielo = new THREE.Mesh(new THREE.SphereGeometry(1e9, 32, 16), cieloMat);
cielo.renderOrder = -10;
escena.add(cielo);

// Estrellas
const estrellasGeo = new THREE.BufferGeometry();
{
  const r = azar(7), pos = [];
  for (let i = 0; i < 4000; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.push(Math.cos(th) * s * 5e8, u * 5e8, Math.sin(th) * s * 5e8);
  }
  estrellasGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
}
const estrellasMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false });
const estrellas = new THREE.Points(estrellasGeo, estrellasMat);
escena.add(estrellas);

// Sol (sprite brillante)
function texturaBrillo(c1, c2) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, c1); gr.addColorStop(0.18, c1); gr.addColorStop(0.35, c2); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sol = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrillo('#fffbe8', 'rgba(255,220,150,0.35)'), fog: false, depthWrite: false, transparent: true }));
sol.scale.set(9e7, 9e7, 1);
escena.add(sol);

// Texturas procedurales
function texturaRuido(base, variacion, semilla, tam = 256) {
  const c = document.createElement('canvas'); c.width = c.height = tam;
  const g = c.getContext('2d'), r = azar(semilla);
  g.fillStyle = base; g.fillRect(0, 0, tam, tam);
  for (let i = 0; i < tam * 6; i++) {
    const v = (r() - 0.5) * variacion;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    const s = 2 + r() * 10; g.fillRect(r() * tam, r() * tam, s, s);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; return t;
}

// Suelo
const sueloTex = texturaRuido('#ffffff', 0.35, 3);
sueloTex.repeat.set(4000, 4000);
const sueloMat = new THREE.MeshLambertMaterial({ color: 0x5f9e3a, map: sueloTex });
const suelo = new THREE.Mesh(new THREE.PlaneGeometry(4e5, 4e5, 201, 201), sueloMat);
suelo.rotation.x = -Math.PI / 2;
// el mundo es plano: suelo y carretera se dibujan primero y no tapan nada
sueloMat.depthWrite = false; suelo.renderOrder = -5;
escena.add(suelo);

// Carretera (la textura se desplaza para dar sensación de avance)
const carreteraTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d'), r = azar(11);
  g.fillStyle = '#3a3b3e'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.06})`; g.fillRect(r() * 256, r() * 512, 2, 2); }
  g.fillStyle = '#f2f2f2'; g.fillRect(8, 0, 8, 512); g.fillRect(240, 0, 8, 512);
  g.fillStyle = '#ffd23f'; g.fillRect(124, 0, 8, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
})();
const LARGO_RUTA = 8000, PERIODO_RAYA = 12;
carreteraTex.repeat.set(1, LARGO_RUTA / PERIODO_RAYA);
const carretera = new THREE.Mesh(new THREE.PlaneGeometry(12, LARGO_RUTA, 1, 800), new THREE.MeshLambertMaterial({ map: carreteraTex }));
carretera.rotation.x = -Math.PI / 2;
carretera.material.depthWrite = false; carretera.renderOrder = -4;
carretera.position.set(0, 0.02, -LARGO_RUTA / 2 + 30);
escena.add(carretera);

// Objetos repetidos en mosaico a lo largo del eje Z. El grupo se desplaza (dist mod L).
function crearMosaico(L, geometria, material, generar, semilla) {
  const r = azar(semilla), base = [];
  generar(r, base, L);
  const n = base.length * 3;
  const malla = new THREE.InstancedMesh(geometria, material, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let i = 0;
  for (const copia of [-1, 0, 1]) {
    for (const o of base) {
      e.set(0, o.rot || 0, 0); q.setFromEuler(e);
      m.compose(new THREE.Vector3(o.x, o.y || 0, o.z - copia * L), q, new THREE.Vector3(o.sx, o.sy, o.sz));
      malla.setMatrixAt(i, m);
      if (o.color) malla.setColorAt(i, o.color);
      i++;
    }
  }
  malla.frustumCulled = false;
  const grupo = new THREE.Group(); grupo.add(malla); grupo.userData.L = L;
  escena.add(grupo);
  return grupo;
}

const geoCopa = new THREE.ConeGeometry(1, 2.2, 7); geoCopa.translate(0, 2.1, 0);
const geoTronco = new THREE.CylinderGeometry(0.18, 0.25, 1.2, 5); geoTronco.translate(0, 0.6, 0);
const L_ARB = 1200;
function generarArboles(r, lista, L) {
  for (let k = 0; k < 900; k++) {
    const lado = r() < 0.5 ? -1 : 1, x = lado * (11 + Math.pow(r(), 1.6) * 600), s = 2.5 + r() * 4;
    lista.push({ x, z: -r() * L, sx: s, sy: s * (0.8 + r() * 0.6), sz: s, rot: r() * 6,
      color: new THREE.Color().setHSL(0.25 + r() * 0.08, 0.45, 0.22 + r() * 0.12) });
  }
}
const arboles = new THREE.Group();
arboles.add(crearMosaico(L_ARB, geoCopa, new THREE.MeshLambertMaterial({ color: 0xffffff }), generarArboles, 21));
arboles.add(crearMosaico(L_ARB, geoTronco, new THREE.MeshLambertMaterial({ color: 0x5a3d26 }), (r, l, L) => {
  const r2 = azar(21); const tmp = []; generarArboles(r2, tmp, L);
  for (const o of tmp) l.push({ x: o.x, z: o.z, sx: o.sx * 0.6, sy: o.sx * 0.8, sz: o.sx * 0.6 });
}, 21));
escena.add(arboles);

const postes = crearMosaico(L_ARB, new THREE.BoxGeometry(0.15, 7, 0.15).translate(0, 3.5, 0), new THREE.MeshLambertMaterial({ color: 0xb8bcc2 }),
  (r, l, L) => { for (let z = 0; z < L; z += 40) { l.push({ x: 7.5, z: -z, sx: 1, sy: 1, sz: 1 }); l.push({ x: -7.5, z: -z - 20, sx: 1, sy: 1, sz: 1 }); } }, 31);

const edificios = crearMosaico(L_ARB, new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }),
  (r, l, L) => {
    for (let k = 0; k < 420; k++) {
      const lado = r() < 0.5 ? -1 : 1, x = lado * (22 + r() * 380), h = 10 + Math.pow(r(), 2.2) * 180, w = 12 + r() * 22;
      const gris = 0.45 + r() * 0.35;
      l.push({ x, z: -r() * L, sx: w, sy: h, sz: w, color: new THREE.Color(gris, gris, gris * 1.05) });
    }
  }, 41);

const nubes = crearMosaico(9000, new THREE.SphereGeometry(1, 9, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false }),
  (r, l, L) => {
    for (let k = 0; k < 70; k++) {
      const x = (r() - 0.5) * 14000, z = -r() * L, y = 1400 + r() * 900, s = 120 + r() * 260;
      for (let j = 0; j < 4; j++) l.push({ x: x + (r() - 0.5) * s * 2, y: y + r() * s * 0.3, z: z + (r() - 0.5) * s, sx: s * (0.8 + r()), sy: s * 0.35, sz: s * (0.6 + r() * 0.6) });
    }
  }, 51);

// Montañas: anillo lejano (con paralaje lento)
const montanas = new THREE.Group();
{
  const r = azar(61), geo = new THREE.ConeGeometry(1, 1, 6);
  const mat = new THREE.MeshLambertMaterial({ color: 0x6b7d8f, fog: false });
  montanas.userData.mat = mat;
  const n = 70, malla = new THREE.InstancedMesh(geo, mat, n), m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + r() * 0.05, d = 22000 + r() * 9000, h = 1200 + r() * 2600, w = 4000 + r() * 4000;
    m.compose(new THREE.Vector3(Math.cos(ang) * d, h / 2, Math.sin(ang) * d), new THREE.Quaternion(), new THREE.Vector3(w, h, w));
    malla.setMatrixAt(i, m);
  }
  montanas.add(malla);
}
escena.add(montanas);

// Planeta Tierra (procedural) para escenas a gran altura
const RADIO_TIERRA = 6.371e6;
const tierra = new THREE.Group();
{
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const g = c.getContext('2d'), r = azar(71);
  g.fillStyle = '#1d4f91'; g.fillRect(0, 0, 2048, 1024);
  for (let k = 0; k < 42; k++) { // continentes
    const cx = r() * 2048, cy = 200 + r() * 620, rad = 60 + r() * 180;
    for (let j = 0; j < 140; j++) {
      const a = r() * 6.28, d = Math.pow(r(), 0.6) * rad;
      g.fillStyle = r() < 0.75 ? `hsl(${95 + r() * 30},38%,${28 + r() * 10}%)` : `hsl(${35 + r() * 10},40%,${45 + r() * 10}%)`;
      g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 10 + r() * 40, 0, 6.28); g.fill();
    }
  }
  g.fillStyle = '#f3f6fa'; g.fillRect(0, 0, 2048, 60); g.fillRect(0, 964, 2048, 60);
  for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.35})`; g.beginPath(); g.ellipse(r() * 2048, r() * 1024, 3 + r() * 16, 1.5 + r() * 4, 0, 0, 6.28); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const geoGlobo = new THREE.SphereGeometry(RADIO_TIERRA, 128, 64); geoGlobo.rotateZ(Math.PI / 2);
  const globo = new THREE.Mesh(geoGlobo, new THREE.MeshLambertMaterial({ map: tex, fog: false }));
  const atm = new THREE.Mesh(new THREE.SphereGeometry(RADIO_TIERRA * 1.025, 96, 48), new THREE.MeshBasicMaterial({ color: 0x4f9dff, transparent: true, opacity: 0.35, side: THREE.BackSide, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  tierra.add(globo, atm);
  tierra.position.set(0, -RADIO_TIERRA, 0);
  tierra.userData.globo = globo;
}
escena.add(tierra);

// Luna (a su distancia real, en el cielo)
const luna = new THREE.Mesh(new THREE.SphereGeometry(1.737e6, 48, 24), new THREE.MeshLambertMaterial({ map: texturaRuido('#9a9a9a', 0.5, 91, 512), fog: false }));
luna.position.set(-1.6e8, 1.9e8, -2.9e8);

// Galaxia espiral (va pegada a la cámara, delante y abajo)
const galaxia = new THREE.Group();
{
  const r = azar(101), pos = [], col = [], c = new THREE.Color();
  for (let i = 0; i < 9000; i++) {
    const brazo = i % 2, d = Math.pow(r(), 0.7), ang = brazo * Math.PI + d * 9 + (r() - 0.5) * 0.7 / (d + 0.2);
    const rad = d * 900 + (r() - 0.5) * 40;
    pos.push(Math.cos(ang) * rad, (r() - 0.5) * 30 * (1 - d), Math.sin(ang) * rad);
    c.setHSL(lerp(0.1, 0.62, Math.min(1, d * 1.6)), 0.7, lerp(0.85, 0.65, d)); col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const puntos = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  const nucleo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrillo('#fff4d6', 'rgba(255,200,120,0.4)'), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
  nucleo.scale.set(700, 700, 1);
  galaxia.add(puntos, nucleo);
  galaxia.position.set(0, -260, -2300);
  galaxia.rotation.x = 0.55;
  galaxia.frustumCulled = false; puntos.frustumCulled = false;
}

// Líneas de velocidad alrededor de la cámara
const N_LINEAS = 260;
const lineasPos = new Float32Array(N_LINEAS * 6);
const lineasBase = [];
{ const r = azar(81); for (let i = 0; i < N_LINEAS; i++) { const a = r() * 6.28, d = 2.5 + r() * 18; lineasBase.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, z: r() }); } }
const lineasGeo = new THREE.BufferGeometry(); lineasGeo.setAttribute('position', new THREE.BufferAttribute(lineasPos, 3));
const lineasMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false });
const lineas = new THREE.LineSegments(lineasGeo, lineasMat);
lineas.frustumCulled = false;
camara.add(lineas);
camara.add(galaxia);
escena.add(camara, luna);

const OBJETOS = { carretera, arboles, postes, edificios, nubes, montanas, tierra, luna, galaxia };

// ---------------------------------------------------------------------------
// Línea de tiempo
// ---------------------------------------------------------------------------
let D = null;        // datos cargados
let tablaDist = [];  // distancia recorrida integrada (paso fijo)
let tablaSol = [];   // ángulo del sol integrado
let tablaEst = [];   // fase de estaciones integrada
let tablaViento = [];
const PASO = 0.05;

function etapaEn(t) {
  const L = D.linea;
  let i = 0;
  while (i < L.length - 1 && t >= L[i + 1].inicio) i++;
  return i;
}

function parametrosEn(t) {
  const i = etapaEn(t), e = D.linea[i], u = t - e.inicio;
  const prev = i > 0 ? D.linea[i - 1].escena : e.escena;
  const k = suave(0, TRANSICION, u);
  const p = { objetos: e.escena.objetos, ambienteA: prev.ambiente, ambienteB: e.escena.ambiente, k };
  for (const n of NUMERICOS) p[n] = (LOGARITMICOS.has(n) ? lerpLog : lerp)(prev[n], e.escena[n], k);
  return p;
}

function integrar() {
  tablaDist = [0]; tablaSol = [0]; tablaEst = [0]; tablaViento = [0];
  let d = 0, s = 0, es = 0, vi = 0;
  for (let t = 0; t < D.total + 1; t += PASO) {
    const p = parametrosEn(t);
    d += p.velocidad * PASO; s += p.sol * PASO; es += p.estaciones * PASO; vi += p.viento * PASO;
    tablaDist.push(d); tablaSol.push(s); tablaEst.push(es); tablaViento.push(vi);
  }
}
function tabla(T, t) {
  const x = t / PASO, i = Math.floor(x), f = x - i;
  if (i >= T.length - 1) return T[T.length - 1];
  return lerp(T[i], T[i + 1], f);
}

// ---------------------------------------------------------------------------
// Formato de números en español
// ---------------------------------------------------------------------------
function agrupar(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function decimal(n, d = 1) { return n.toFixed(d).replace('.', ',').replace(/,0+$/, ''); }
function numero(v, completo = false) {
  if (completo && v >= 100) return [agrupar(v), ''];
  if (v >= 1e12) return [decimal(v / 1e12, 1), 'billones'];
  if (v >= 1e9) return [decimal(v / 1e9, 1), 'mil millones'];
  if (v >= 1e6) return [decimal(v / 1e6, 1), v < 2e6 ? 'millón' : 'millones'];
  if (v >= 100) return [agrupar(v), ''];
  if (v >= 10) return [decimal(v, 1), ''];
  return [decimal(v, 2), ''];
}
function conUnidad(v, singular, plural) {
  const [n, escala] = numero(v);
  const uno = n === '1';
  const unidad = escala ? `${escala} de ${plural}` : (uno ? singular : plural);
  return [n, unidad];
}
const FORMATOS = {
  numero: (v, u, completo) => { const [n, e] = numero(v, completo); return [n, [e, u].filter(Boolean).join(' ')]; },
  tiempo: (v) => {
    const U = [[31557600, 'año', 'años'], [2629800, 'mes', 'meses'], [604800, 'semana', 'semanas'], [86400, 'día', 'días'], [3600, 'hora', 'horas'], [60, 'minuto', 'minutos'], [1, 'segundo', 'segundos']];
    for (const [s, a, b] of U) if (v >= s * 0.999) return conUnidad(v / s, a, b);
    return [decimal(v, 2), 'segundos'];
  },
  distancia: (v) => v >= 9.4607e14 ? conUnidad(v / 9.4607e15, 'año luz', 'años luz')
    : v >= 1000 ? conUnidad(v / 1000, 'km', 'km') : [decimal(v, v < 10 ? 2 : 0), 'm'],
  masa: (v) => v >= 1000 ? conUnidad(v / 1000, 'tonelada', 'toneladas') : [decimal(v, v < 10 ? 1 : 0), 'kg'],
};

function valorEn(t) {
  const i = etapaEn(t), e = D.linea[i];
  const p = clamp((t - e.inicio) / e.dur);
  return lerpLog(e.valor, e.hasta, p);
}

// ---------------------------------------------------------------------------
// Capa de textos (HTML)
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function prepararCapa() {
  const ep = D.episodio, canal = D.canal;
  document.documentElement.style.setProperty('--acento', canal.color || '#ffcc00');
  const partes = (canal.nombre || '').split(' ');
  $('marca').innerHTML = partes.length > 1 ? `${partes.slice(0, -1).join(' ')} <b>${partes.at(-1)}</b>` : `<b>${canal.nombre || ''}</b>`;
  $('contador-etiqueta').textContent = ep.etiqueta || '';
  $('contador-sub').textContent = ep.subtitulo || '';
  const marcas = $('progreso-marcas'); marcas.innerHTML = '';
  for (const e of D.linea) { const s = document.createElement('span'); s.style.left = `${(e.inicio / D.total) * 100}%`; marcas.appendChild(s); }
  document.body.classList.toggle('vertical', D.modo === 'vertical');
  document.body.classList.toggle('modo-miniatura', D.modo === 'miniatura');
  if (D.modo === 'miniatura') {
    $('mini-titulo').innerHTML = (ep.miniatura && ep.miniatura.texto) || ep.titulo;
  }
}

function actualizarCapa(t) {
  const i = etapaEn(t), e = D.linea[i], u = t - e.inicio, ep = D.episodio;
  const fmt = FORMATOS[e.formato] || FORMATOS.numero;
  const [n, unidad] = fmt(valorEn(t), e.unidad, e.completo ?? ep.completo);
  $('valor').textContent = n;
  $('unidad').textContent = unidad;
  if (e.etiqueta) $('contador-etiqueta').textContent = e.etiqueta;
  else $('contador-etiqueta').textContent = ep.etiqueta || '';

  // Rótulo de etapa: entra, se queda ~5 s y sale
  const chip = $('etapa');
  if (e.titulo) {
    $('etapa-num').textContent = String(i + 1).padStart(2, '0');
    $('etapa-txt').textContent = e.titulo;
    const op = suave(0.2, 0.7, u) * (1 - suave(5.5, 6.2, u));
    chip.style.opacity = op; chip.style.transform = `translateX(${(1 - op) * -2}vh)`;
  } else chip.style.opacity = 0;

  // Progreso
  $('progreso-barra').style.width = `${clamp(t / D.total) * 100}%`;
  const marcas = $('progreso-marcas').children;
  for (let j = 0; j < marcas.length; j++) marcas[j].classList.toggle('hecha', j <= i);

  // Subtítulos
  let sub = '';
  if (D.subtitulos && e.trozos) {
    const uv = u - e.inicioVoz;
    for (const tr of e.trozos) if (uv >= tr.desde && uv < tr.hasta) { sub = tr.texto; break; }
  }
  const s = $('subtitulo'); if (s.textContent !== sub) s.textContent = sub;
}

// ---------------------------------------------------------------------------
// Dibujo de un cuadro
// ---------------------------------------------------------------------------
const colorTmp = new THREE.Color();
function dibujar(t) {
  const p = parametrosEn(t);
  const dist = tabla(tablaDist, t), faseSol = tabla(tablaSol, t) + (D.linea[0].escena.faseSol ?? 0.2), faseEst = tabla(tablaEst, t), viento = tabla(tablaViento, t);

  // Paleta
  let pal = mezclarPaletas(paleta(p.ambienteA), paleta(p.ambienteB), p.k);
  let solAlt = pal.solAlt;
  if (p.sol > 0) { // ciclo día/noche
    const ang = faseSol * Math.PI * 2;
    solAlt = Math.sin(ang) * 60;
    const dia = paleta('dia'), noche = paleta('noche'), tarde = paleta('atardecer');
    const kd = suave(-12, 15, solAlt);
    let c = mezclarPaletas(noche, dia, kd);
    const kt = (1 - Math.abs(solAlt) / 14); if (kt > 0) c = mezclarPaletas(c, tarde, kt * 0.8);
    // a gran velocidad el ciclo se vuelve un parpadeo: promediamos
    // a gran velocidad el ciclo es un parpadeo: se ve el ambiente de la etapa (usar 'crepusculo' como promedio)
    const kp = suave(0.35, 1.5, p.sol);
    pal = mezclarPaletas(c, pal, kp);
    if (kp > 0.5) solAlt = lerp(solAlt, 30, (kp - 0.5) * 2);
  }
  if (p.estaciones > 0) { // primavera, verano, otoño, invierno
    const f = (faseEst % 1) * 4, cols = ['#6bb04a', '#4f8f2f', '#c08a3a', '#e9eef3'];
    const a = new THREE.Color(cols[Math.floor(f) % 4]), b = new THREE.Color(cols[(Math.floor(f) + 1) % 4]);
    const est = a.lerp(b, f - Math.floor(f));
    const kp = suave(0.3, 1.5, p.estaciones);
    est.lerp(new THREE.Color('#8a9a70'), kp);
    pal.suelo.lerp(est, 0.85 * (1 - suave(1, 6, p.estaciones)));
  }

  // Altura: más alto = el cielo se oscurece (atmósfera)
  const h = p.altura;
  const kEsp = suave(15000, 90000, h);
  pal = mezclarPaletas(pal, paleta('espacio'), kEsp * (p.ambienteB === 'espacio' ? 0 : 1));

  cieloMat.uniforms.arriba.value.copy(pal.arriba);
  cieloMat.uniforms.abajo.value.copy(pal.abajo);
  escena.fog.color.copy(pal.niebla);
  const espacio = Math.max(kEsp, p.ambienteB === 'espacio' ? p.k : 0, p.ambienteA === 'espacio' ? 1 - p.k : 0);
  escena.fog.near = Math.max(60, h * 8);
  escena.fog.far = lerp(Math.max(1600, h * 60), 1e12, espacio);
  sueloMat.color.copy(pal.suelo);
  // montañas y nubes sin niebla, pero teñidas con el color del aire
  montanas.userData.mat.color.set(0x5d6f80).lerp(pal.niebla, 0.55).multiplyScalar(0.55 + pal.luz * 0.45);
  nubes.children[0].material.color.set(0xffffff).lerp(pal.niebla, 0.25).multiplyScalar(Math.min(1, 0.3 + pal.luz * 0.8));
  estrellasMat.opacity = clamp(Math.max(pal.estrellas, espacio));
  luzHemi.intensity = 0.35 + pal.luz * 0.7;
  luzSol.intensity = 0.5 + pal.luz * 2;

  // Cámara
  const tiembla = p.temblor * (0.04 + 0.002 * Math.min(h, 100));
  const ruido = (f, s) => Math.sin(t * f + s) * 0.5 + Math.sin(t * f * 2.3 + s * 3) * 0.3 + Math.sin(t * f * 5.1 + s * 7) * 0.2;
  camara.position.set(2.6 + ruido(17, 1) * tiembla, h + ruido(19, 2) * tiembla, 0);
  camara.rotation.set(THREE.MathUtils.degToRad(p.mirar) + ruido(13, 4) * p.temblor * 0.004, 0, ruido(11, 5) * p.temblor * 0.004, 'YXZ');
  camara.fov = p.fov;
  camara.near = 0.2; // con buffer logarítmico no hace falta escalarlo
  camara.updateProjectionMatrix();

  // Cielo, estrellas y sol siguen a la cámara
  cielo.position.copy(camara.position);
  estrellas.position.copy(camara.position);
  cieloMat.uniforms.alt.value = 0;
  const az = THREE.MathUtils.degToRad(-25), el = THREE.MathUtils.degToRad(solAlt);
  const dirSol = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  sol.position.copy(camara.position).addScaledVector(dirSol, 4e8);
  sol.visible = solAlt > -6 && !(p.sol > 1.5);
  luzSol.position.copy(dirSol).multiplyScalar(1000);

  // Objetos visibles
  const activos = new Set(p.objetos);
  const alto = h > 30000; // a gran altura solo se ve el planeta
  const SIEMPRE = new Set(['tierra', 'luna', 'galaxia']);
  for (const [nombre, obj] of Object.entries(OBJETOS)) obj.visible = activos.has(nombre) && (SIEMPRE.has(nombre) || !alto);
  galaxia.rotation.y = t * 0.02;
  suelo.visible = !activos.has('tierra') || h < 30000;
  if (activos.has('tierra')) tierra.userData.globo.rotation.x = -dist / RADIO_TIERRA;

  // Movimiento: desplazar mosaicos y texturas
  const desplazar = (g) => { if (g.userData.L) g.position.z = dist % g.userData.L; };
  arboles.children.forEach(desplazar); desplazar(postes); desplazar(edificios);
  nubes.position.z = (dist * 0.6 + viento) % nubes.userData.L;
  montanas.position.z = (dist * 0.002) % 3000;
  carreteraTex.offset.y = (dist / PERIODO_RAYA) % 1;
  sueloTex.offset.y = (dist / (4e5 / 4000)) % 1;
  suelo.scale.setScalar(Math.max(1, h / 300));
  // a mucha altura, la carretera sigue siendo visible mejor como franja
  carretera.scale.x = Math.max(1, h / 400);

  // Líneas de velocidad
  const kl = p.lineas;
  lineasMat.opacity = kl * 0.75;
  if (kl > 0.01) {
    const largo = 2 + kl * 30, tramo = 220;
    for (let i = 0; i < N_LINEAS; i++) {
      const b = lineasBase[i];
      const z = -(((b.z * tramo + Math.min(dist, 1e12) * 1.5) % tramo)) + 20;
      const o = i * 6;
      lineasPos[o] = b.x; lineasPos[o + 1] = b.y; lineasPos[o + 2] = z;
      lineasPos[o + 3] = b.x; lineasPos[o + 4] = b.y; lineasPos[o + 5] = z + largo;
    }
    lineasGeo.attributes.position.needsUpdate = true;
  }

  const calor = p.calor * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3));
  $('calor').style.opacity = calor.toFixed(3);
  renderer.render(escena, camara);
  actualizarCapa(t);
}

// ---------------------------------------------------------------------------
// API para el script de render
// ---------------------------------------------------------------------------
window.cargar = async (datos) => {
  D = datos;
  // herencia de parámetros de escena entre etapas
  let anterior = { ...ESCENA_BASE, ...(D.episodio.escena || {}) };
  for (let i = 0; i < D.linea.length; i++) {
    const e = D.linea[i];
    e.escena = { ...anterior, ...(e.escena || {}) };
    anterior = e.escena;
    e.formato = e.formato || D.episodio.formato || 'numero';
    e.unidad = e.unidad ?? D.episodio.unidad ?? '';
    e.hasta = e.hasta ?? (D.linea[i + 1] ? D.linea[i + 1].valor : e.valor);
  }
  const w = window.innerWidth, hgt = window.innerHeight;
  renderer.setSize(w, hgt, false);
  camara.aspect = w / hgt;
  prepararCapa();
  integrar();
  // primer render + recompilar materiales (evita texturas sin subir en el primer programa)
  dibujar(0);
  escena.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  await Promise.all(['600', '700', '800', '900'].map((w) => document.fonts.load(`${w} 20px Montserrat`)));
  dibujar(0);
  await document.fonts.ready;
  return true;
};
window.dibujar = dibujar;

// Vista previa en el navegador: abrir /motor/escena.html?episodio=velocidad
const qs = new URLSearchParams(location.search);
if (qs.get('episodio')) {
  const res = await fetch(`/vista-previa/${qs.get('episodio')}?modo=${qs.get('modo') || 'normal'}`);
  const datos = await res.json();
  await window.cargar(datos);
  const t0 = performance.now(), desde = Number(qs.get('t') || 0);
  const bucle = () => { const t = desde + (performance.now() - t0) / 1000; dibujar(t % datos.total); requestAnimationFrame(bucle); };
  bucle();
}
window.listo = true;

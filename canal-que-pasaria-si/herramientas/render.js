#!/usr/bin/env node
// Render de un episodio completo: voz → línea de tiempo → cuadros 3D → MP4 + subtítulos + descripción.
//
//   node herramientas/render.js velocidad                 video 1080p completo
//   node herramientas/render.js velocidad --prueba        540p, 24 fps (rápido, para revisar)
//   node herramientas/render.js velocidad --desde 60 --hasta 90
//   node herramientas/render.js velocidad --short 7-9     Short vertical con las etapas 7 a 9
//   node herramientas/render.js velocidad --miniatura     solo la miniatura (1280x720)
//   node herramientas/render.js velocidad --sin-voz       sin narración (duraciones estimadas)
//   node herramientas/render.js velocidad --solo-textos   solo descripción + subtítulos
//   node herramientas/render.js velocidad --muestras      hoja de contacto (un cuadro por etapa)
//   Opciones extra: --gpu  --trabajos N  --fps N
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { iniciarServidor } from './servidor.js';
import { generarVoces } from './voz.js';
import { RAIZ, leerCanal, leerJSON, rutaEpisodio, datosEscena, formatoReloj, formatoSRT } from './linea.js';

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opcion = (n, def = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def; };
const nombre = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['desde', 'hasta', 'short', 'trabajos', 'fps'].includes(args[i - 1].slice(2))));
if (!nombre) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(1);
}

const prueba = !!opcion('prueba');
const short = opcion('short');
const miniatura = !!opcion('miniatura');
const soloTextos = !!opcion('solo-textos');
const sinVoz = !!opcion('sin-voz');
const fps = Number(opcion('fps', prueba ? 24 : 30));
const trabajos = Number(opcion('trabajos', Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)))));

const canal = leerCanal();
const episodio = leerJSON(rutaEpisodio(nombre));
const slug = episodio.slug || path.basename(rutaEpisodio(nombre), '.json');
const SALIDA = path.join(RAIZ, 'salida', slug);
const TMP = path.join(SALIDA, '.tmp');
fs.mkdirSync(TMP, { recursive: true });

const ffmpeg = (a) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });

// ---------------------------------------------------------------------------
// 1. Voz y línea de tiempo
// ---------------------------------------------------------------------------
const voces = await generarVoces(episodio, canal, { silencio: sinVoz });
const duraciones = voces.map((v) => v.duracion);
const modo = miniatura ? 'miniatura' : short ? 'vertical' : 'normal';
const datos = datosEscena(episodio, canal, duraciones, { modo });
console.log(`⏱️  Duración total: ${formatoReloj(datos.total)} (${datos.linea.length} etapas)`);

// ---------------------------------------------------------------------------
// 2. Textos: subtítulos .srt y descripción para YouTube
// ---------------------------------------------------------------------------
function escribirTextos() {
  let srt = '', n = 1;
  for (const e of datos.linea) for (const tr of e.trozos) {
    const a = e.inicio + e.inicioVoz + tr.desde, b = e.inicio + e.inicioVoz + tr.hasta;
    srt += `${n++}\n${formatoSRT(a)} --> ${formatoSRT(b)}\n${tr.texto}\n\n`;
  }
  fs.writeFileSync(path.join(SALIDA, 'subtitulos.srt'), srt);

  const capitulos = datos.linea.filter((e) => e.titulo || e.indice === 0)
    .map((e) => `${formatoReloj(e.inicio)} ${e.titulo || 'Introducción'}`).join('\n');
  const etiquetas = [...(episodio.etiquetas || []), ...(canal.etiquetas || [])];
  const desc = [
    `# ${episodio.titulo}`,
    '',
    '## Descripción',
    episodio.descripcion || '',
    '',
    capitulos ? `Capítulos:\n${capitulos}` : '',
    '',
    canal.pieDescripcion || '',
    '',
    (canal.hashtags || []).join(' '),
    '',
    '## Etiquetas',
    etiquetas.join(', '),
    '',
    '## Títulos alternativos (para pruebas A/B)',
    ...(episodio.titulosAlternativos || []).map((t) => `- ${t}`),
  ].join('\n');
  fs.writeFileSync(path.join(SALIDA, 'descripcion.md'), desc);
  console.log(`📝 Textos en salida/${slug}/ (descripcion.md, subtitulos.srt)`);
}
escribirTextos();
if (soloTextos) process.exit(0);

// ---------------------------------------------------------------------------
// 3. Pista de audio completa (narración + música opcional con ducking)
// ---------------------------------------------------------------------------
function construirAudio() {
  const destino = path.join(TMP, 'audio.m4a');
  const entradas = [], filtros = [], etiquetas = [];
  datos.linea.forEach((e, i) => {
    const v = voces[i];
    if (!v.archivo) return;
    entradas.push('-i', v.archivo);
    const ms = Math.round((e.inicio + e.inicioVoz) * 1000);
    filtros.push(`[${etiquetas.length}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${etiquetas.length}]`);
    etiquetas.push(`[v${etiquetas.length}]`);
  });
  const total = datos.total.toFixed(3);
  let voz;
  if (etiquetas.length) {
    filtros.push(`${etiquetas.join('')}amix=inputs=${etiquetas.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total}[voz]`);
    voz = '[voz]';
  } else {
    entradas.push('-f', 'lavfi', '-t', total, '-i', 'anullsrc=r=44100:cl=stereo');
    voz = `[${entradas.filter((x) => x === '-i').length - 1}:a]`;
  }
  const musica = buscarMusica();
  let salidaFiltro = voz;
  if (musica) {
    const im = entradas.filter((x) => x === '-i').length;
    entradas.push('-stream_loop', '-1', '-i', musica);
    const vol = canal.musica?.volumen ?? 0.22;
    filtros.push(`${voz}asplit[vz1][vz2]`);
    filtros.push(`[${im}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${vol},atrim=0:${total},afade=t=in:d=2,afade=t=out:st=${Math.max(0, datos.total - 4).toFixed(2)}:d=4[mus]`);
    filtros.push('[mus][vz2]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=400[musd]');
    filtros.push('[vz1][musd]amix=inputs=2:normalize=0[mezcla]');
    salidaFiltro = '[mezcla]';
    console.log(`🎵 Música: ${path.relative(RAIZ, musica)}`);
  }
  const args = [...entradas];
  if (filtros.length) args.push('-filter_complex', filtros.join(';'), '-map', salidaFiltro);
  else args.push('-map', '0:a');
  args.push('-c:a', 'aac', '-b:a', '192k', '-t', total, destino);
  ffmpeg(args);
  return destino;
}
function buscarMusica() {
  const r = episodio.musica || canal.musica?.archivo;
  if (r && fs.existsSync(path.resolve(RAIZ, r))) return path.resolve(RAIZ, r);
  const dir = path.join(RAIZ, 'musica');
  if (!fs.existsSync(dir)) return null;
  const pistas = fs.readdirSync(dir).filter((f) => /\.(mp3|m4a|wav|ogg)$/i.test(f)).sort();
  if (!pistas.length) return null;
  let h = 0; for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0; // misma pista para el mismo episodio
  return path.join(dir, pistas[h % pistas.length]);
}

// ---------------------------------------------------------------------------
// 4. Cuadros 3D con Chromium (en paralelo)
// ---------------------------------------------------------------------------
const servidor = await iniciarServidor(0, datos);
const URL_ESCENA = `http://127.0.0.1:${servidor.address().port}/motor/escena.html`;
// --gpu: usar la placa de video (mucho más rápido en una PC). Sin GPU se usa SwiftShader (render por software).
const ARGS_CHROMIUM = opcion('gpu') ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-gpu-vsync']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'];

async function abrirPagina(ancho, alto) {
  const navegador = await chromium.launch({ args: ARGS_CHROMIUM });
  const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto } });
  pagina.on('pageerror', (e) => console.error('Error en la escena:', e.message));
  await pagina.goto(URL_ESCENA);
  await pagina.waitForFunction(() => window.listo === true);
  await pagina.evaluate(async () => { const d = await (await fetch('/datos')).json(); await window.cargar(d); });
  const cdp = await pagina.context().newCDPSession(pagina);
  return { navegador, pagina, cdp };
}

async function capturar({ pagina, cdp }, t, calidad = 92) {
  await pagina.evaluate((x) => window.dibujar(x), t);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: calidad, optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

if (miniatura) {
  const p = await abrirPagina(1280, 720);
  const m = episodio.miniatura || {};
  const t = m.t ?? (m.etapa != null ? datos.linea[m.etapa].inicio + 2.6 : datos.total * 0.6);
  const img = await capturar(p, t, 95);
  fs.writeFileSync(path.join(SALIDA, 'miniatura.jpg'), img);
  await p.navegador.close(); servidor.close();
  console.log(`🖼️  Miniatura: salida/${slug}/miniatura.jpg`);
  process.exit(0);
}

if (opcion('muestras')) { // hoja de contacto: un cuadro a mitad de cada etapa
  const p = await abrirPagina(640, 360);
  const dir = path.join(TMP, 'muestras'); fs.mkdirSync(dir, { recursive: true });
  for (const e of datos.linea) fs.writeFileSync(path.join(dir, `${String(e.indice).padStart(3, '0')}.jpg`), await capturar(p, e.inicio + Math.min(e.dur * 0.6, 8), 85));
  await p.navegador.close(); servidor.close();
  const cols = 4, filas = Math.ceil(datos.linea.length / cols);
  ffmpeg(['-pattern_type', 'glob', '-i', path.join(dir, '*.jpg'), '-vf', `tile=${cols}x${filas}:padding=4`, '-frames:v', '1', path.join(SALIDA, 'muestras.jpg')]);
  fs.rmSync(dir, { recursive: true });
  console.log(`🧩 Hoja de contacto: salida/${slug}/muestras.jpg`);
  process.exit(0);
}

let desde = Number(opcion('desde', 0)), hasta = Number(opcion('hasta', datos.total));
if (short) {
  const [a, b] = String(short).split('-').map(Number);
  const ea = datos.linea[a - 1], eb = datos.linea[(b || a) - 1];
  if (!ea || !eb) throw new Error(`--short ${short}: etapas fuera de rango (1-${datos.linea.length})`);
  desde = ea.inicio; hasta = eb.inicio + eb.dur;
  if (hasta - desde > 180) console.warn('⚠️  El Short dura más de 3 minutos: YouTube no lo tratará como Short.');
}
hasta = Math.min(hasta, datos.total);
const [ancho, alto] = short ? (prueba ? [540, 960] : [1080, 1920]) : (prueba ? [960, 540] : [1920, 1080]);
const nCuadros = Math.ceil((hasta - desde) * fps);
console.log(`🎬 ${nCuadros} cuadros ${ancho}x${alto} @${fps}fps con ${trabajos} proceso(s)…`);

const progreso = new Array(trabajos).fill(0);
const t0 = Date.now();
const reloj = setInterval(() => {
  const hechos = progreso.reduce((a, b) => a + b, 0), seg = (Date.now() - t0) / 1000;
  const resta = hechos ? (seg / hechos) * (nCuadros - hechos) : 0;
  process.stdout.write(`\r   ${hechos}/${nCuadros} (${((hechos / nCuadros) * 100).toFixed(1)}%) · ${(hechos / seg).toFixed(1)} cuadros/s · faltan ~${formatoReloj(resta)}   `);
}, 2000);

async function renderTramo(k, c0, c1, archivo) {
  const p = await abrirPagina(ancho, alto);
  const enc = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', prueba ? 'veryfast' : 'medium', '-crf', prueba ? '26' : '18', '-pix_fmt', 'yuv420p', archivo],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const fin = new Promise((ok, mal) => enc.on('close', (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg salió con ${c}`)))));
  for (let c = c0; c < c1; c++) {
    const img = await capturar(p, desde + c / fps);
    if (!enc.stdin.write(img)) await new Promise((ok) => enc.stdin.once('drain', ok));
    progreso[k] = c - c0 + 1;
  }
  enc.stdin.end();
  await fin;
  await p.navegador.close();
}

const tramos = [];
const porTramo = Math.ceil(nCuadros / trabajos);
for (let k = 0; k < trabajos; k++) {
  const c0 = k * porTramo, c1 = Math.min(nCuadros, c0 + porTramo);
  if (c0 >= c1) break;
  tramos.push({ archivo: path.join(TMP, `tramo-${k}.mp4`), promesa: renderTramo(k, c0, c1, path.join(TMP, `tramo-${k}.mp4`)) });
}
await Promise.all(tramos.map((t) => t.promesa));
clearInterval(reloj);
servidor.close();
console.log(`\n✅ Cuadros listos en ${formatoReloj((Date.now() - t0) / 1000)}`);

// ---------------------------------------------------------------------------
// 5. Unir tramos + audio
// ---------------------------------------------------------------------------
const lista = path.join(TMP, 'tramos.txt');
fs.writeFileSync(lista, tramos.map((t) => `file '${t.archivo}'`).join('\n'));
const video = path.join(TMP, 'video.mp4');
ffmpeg(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', video]);

const audio = construirAudio();
const sufijo = short ? `-short-${String(short).replace(/[^0-9-]/g, '')}` : (desde > 0 || hasta < datos.total) ? `-${Math.round(desde)}-${Math.round(hasta)}` : '';
const final = path.join(SALIDA, `${slug}${sufijo}${prueba ? '-prueba' : ''}.mp4`);
ffmpeg(['-i', video, '-ss', desde.toFixed(3), '-t', (hasta - desde).toFixed(3), '-i', audio,
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
for (const t of tramos) fs.unlinkSync(t.archivo);
console.log(`🎉 Video: ${path.relative(RAIZ, final)}`);

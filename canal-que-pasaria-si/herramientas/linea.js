// Construye la línea de tiempo de un episodio a partir de la duración de cada narración.
import fs from 'node:fs';
import path from 'node:path';

export const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export const INICIO_VOZ = 0.6;   // silencio al comenzar cada etapa
export const PAUSA_FINAL = 0.9;  // silencio después de la narración
export const DURACION_MINIMA = 4;
export const PALABRAS_POR_SEGUNDO = 2.6; // estimación cuando no hay audio

export function leerJSON(ruta) {
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

export function leerCanal() {
  return leerJSON(path.join(RAIZ, 'canal.json'));
}

export function rutaEpisodio(nombre) {
  if (fs.existsSync(nombre)) return path.resolve(nombre);
  const p = path.join(RAIZ, 'episodios', nombre.endsWith('.json') ? nombre : `${nombre}.json`);
  if (!fs.existsSync(p)) throw new Error(`No encuentro el episodio "${nombre}"`);
  return p;
}

export function estimarDuracion(texto) {
  return texto.trim().split(/\s+/).filter(Boolean).length / PALABRAS_POR_SEGUNDO;
}

// Divide la narración en trozos cortos para subtítulos, repartidos según la longitud del texto.
export function trozosSubtitulo(texto, duracion, maxPalabras = 8) {
  const frases = texto.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…;:,])\s+/);
  const trozos = [];
  for (const f of frases) {
    const pal = f.split(' ');
    const n = Math.ceil(pal.length / maxPalabras);
    const tam = Math.ceil(pal.length / n);
    for (let i = 0; i < pal.length; i += tam) trozos.push(pal.slice(i, i + tam).join(' '));
  }
  const total = trozos.reduce((a, t) => a + t.length + 4, 0);
  let t = 0;
  return trozos.map((texto) => {
    const d = ((texto.length + 4) / total) * duracion;
    const tr = { texto, desde: t, hasta: t + d };
    t += d;
    return tr;
  });
}

// duraciones: array con la duración (s) del audio de cada etapa, o null para estimar.
export function construirLinea(episodio, duraciones = null) {
  let t = 0;
  const linea = episodio.etapas.map((e, i) => {
    const voz = duraciones?.[i] ?? estimarDuracion(e.texto || '');
    const dur = Math.max(e.duracionMinima ?? DURACION_MINIMA, INICIO_VOZ + voz + PAUSA_FINAL);
    const item = {
      ...e, indice: i, inicio: t, dur, voz, inicioVoz: INICIO_VOZ,
      trozos: trozosSubtitulo(e.texto || '', voz),
    };
    t += dur;
    return item;
  });
  return { linea, total: t };
}

export function datosEscena(episodio, canal, duraciones, opciones = {}) {
  const { linea, total } = construirLinea(episodio, duraciones);
  return {
    canal, episodio: { ...episodio, etapas: undefined }, linea, total,
    modo: opciones.modo || 'normal',
    subtitulos: opciones.subtitulos ?? canal.subtitulos ?? true,
  };
}

export function formatoReloj(seg, conHoras = false) {
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = Math.floor(seg % 60);
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return conHoras || h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatoSRT(seg) {
  const ms = Math.round(seg * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`;
}

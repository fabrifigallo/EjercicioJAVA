// Narración: ElevenLabs (si hay clave) o espeak-ng (voz robótica, solo para pruebas).
// Los audios se guardan en cache/voz/ para no pagar dos veces el mismo texto.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { RAIZ } from './linea.js';

const CACHE = path.join(RAIZ, 'cache', 'voz');

export function duracionAudio(archivo) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo]).toString().trim();
  return Number(out);
}

function proveedorElegido(canal) {
  const pedido = process.env.VOZ_PROVEEDOR || canal.voz?.proveedor || 'auto';
  if (pedido !== 'auto') return pedido;
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  return 'espeak';
}

async function elevenlabs(texto, destino, canal) {
  const clave = process.env.ELEVENLABS_API_KEY;
  if (!clave) throw new Error('Falta la variable de entorno ELEVENLABS_API_KEY');
  const v = canal.voz?.elevenlabs || {};
  const idVoz = process.env.ELEVENLABS_VOICE_ID || v.idVoz;
  if (!idVoz) throw new Error('Falta el id de voz de ElevenLabs (canal.json → voz.elevenlabs.idVoz o ELEVENLABS_VOICE_ID)');
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${idVoz}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': clave, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: texto,
      model_id: v.modelo || 'eleven_multilingual_v2',
      language_code: 'es',
      voice_settings: { stability: v.estabilidad ?? 0.45, similarity_boost: v.similitud ?? 0.8, style: v.estilo ?? 0.15, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs respondió ${res.status}: ${await res.text()}`);
  fs.writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
}

function espeak(texto, destino, canal) {
  const v = canal.voz?.espeak || {};
  const wav = destino.replace(/\.mp3$/, '.wav');
  execFileSync('espeak-ng', ['-v', v.voz || 'es-419', '-s', String(v.velocidad || 160), '-p', String(v.tono || 42), '-w', wav, texto]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-ar', '44100', '-ac', '1', '-b:a', '128k', destino]);
  fs.unlinkSync(wav);
}

// Devuelve [{ archivo, duracion }] por etapa.
export async function generarVoces(episodio, canal, { silencio = false } = {}) {
  const proveedor = silencio ? 'silencio' : proveedorElegido(canal);
  fs.mkdirSync(CACHE, { recursive: true });
  console.log(`🎙️  Narración con: ${proveedor}`);
  const resultado = [];
  for (const [i, etapa] of episodio.etapas.entries()) {
    const texto = (etapa.texto || '').trim();
    if (!texto || proveedor === 'silencio') { resultado.push({ archivo: null, duracion: null }); continue; }
    const ajustes = JSON.stringify(canal.voz?.[proveedor] || {});
    const hash = crypto.createHash('sha1').update(`${proveedor}|${ajustes}|${texto}`).digest('hex').slice(0, 16);
    const archivo = path.join(CACHE, `${proveedor}-${hash}.mp3`);
    if (!fs.existsSync(archivo)) {
      process.stdout.write(`   etapa ${i + 1}/${episodio.etapas.length}… `);
      if (proveedor === 'elevenlabs') await elevenlabs(texto, archivo, canal);
      else if (proveedor === 'espeak') espeak(texto, archivo, canal);
      else throw new Error(`Proveedor de voz desconocido: ${proveedor}`);
      console.log('ok');
    }
    resultado.push({ archivo, duracion: duracionAudio(archivo) });
  }
  return resultado;
}

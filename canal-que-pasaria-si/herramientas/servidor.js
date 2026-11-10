// Servidor estático mínimo para el motor 3D (+ vista previa en vivo en el navegador).
//   node herramientas/servidor.js            → http://localhost:5173/motor/escena.html?episodio=velocidad
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, leerCanal, leerJSON, rutaEpisodio, datosEscena } from './linea.js';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg',
};

export function iniciarServidor(puerto = 0, datosRender = null) {
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/datos' && datosRender) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(datosRender));
      }
      if (url.pathname.startsWith('/vista-previa/')) {
        const nombre = decodeURIComponent(url.pathname.split('/').pop());
        const ep = leerJSON(rutaEpisodio(nombre));
        const modo = url.searchParams.get('modo') || 'normal';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(datosEscena(ep, leerCanal(), null, { modo })));
      }
      const archivo = path.normalize(path.join(RAIZ, decodeURIComponent(url.pathname)));
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
        res.writeHead(404); return res.end('no encontrado');
      }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
      fs.createReadStream(archivo).pipe(res);
    } catch (err) {
      res.writeHead(500); res.end(String(err));
    }
  });
  return new Promise((ok) => servidor.listen(puerto, '127.0.0.1', () => ok(servidor)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const puerto = Number(process.env.PUERTO || 5173);
  await iniciarServidor(puerto);
  console.log(`Vista previa: http://localhost:${puerto}/motor/escena.html?episodio=velocidad`);
  console.log('Parámetros: &t=120 (empezar en el segundo 120)');
}

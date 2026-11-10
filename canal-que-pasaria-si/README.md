# Hasta Dónde 3D — fábrica de videos «¿Qué pasaría si…?»

Canal: [@HastaDonde3D](https://www.youtube.com/@HastaDonde3D)

Motor para producir videos animados en 3D, en español, del género «¿qué pasaría si… y no pudieras parar?»:
una idea imposible que escala etapa por etapa, con un contador gigante en pantalla, narración y datos reales.

**Cada episodio es un solo archivo JSON.** El motor hace el resto: narración, escena 3D, contador,
subtítulos, capítulos, descripción para YouTube, miniatura y Shorts.

```
episodios/velocidad.json  ──►  voz (ElevenLabs)  ──►  escena 3D (Three.js)  ──►  MP4 1080p
                                                              │
                                                              ├─► subtitulos.srt
                                                              ├─► descripcion.md (con capítulos)
                                                              ├─► miniatura.jpg
                                                              └─► Shorts verticales
```

## Episodios incluidos

| Archivo | Título | Etapas | Duración aprox. |
|---|---|---|---|
| `episodios/velocidad.json` | ¿Qué pasaría si aceleraras y no pudieras frenar? | 20 | 8 min |
| `episodios/tiempo.json` | ¿Qué pasaría si el tiempo se acelerara y no pudieras detenerlo? | 19 | 7 min |
| `episodios/crecer.json` | ¿Qué pasaría si crecieras y no pudieras parar? | 18 | 7 min |

`tiempo.json` y `crecer.json` se generan desde `herramientas/fuentes/*.py`: allí los parámetros de cámara
se calculan a partir de los valores reales (ciclo del sol, estaciones, altura de los ojos, ángulo del horizonte).
Si editas esos guiones, edita el `.py` y vuelve a ejecutarlo.

## Instalación

Necesitas Node.js 20 o superior y ffmpeg.

```bash
npm install
npx playwright install chromium
```

### Voz (ElevenLabs)

```bash
export ELEVENLABS_API_KEY="tu_clave"
export ELEVENLABS_VOICE_ID="id_de_la_voz"   # o ponlo en canal.json → voz.elevenlabs.idVoz
```

Elige en ElevenLabs una voz grave y calma en español (en la Voice Library hay muchas). El modelo por defecto es
`eleven_multilingual_v2`. Los audios se guardan en `cache/voz/`, así que cada texto se paga una sola vez:
si cambias una etapa, solo se vuelve a generar esa.

Sin clave se usa **espeak-ng** (`sudo apt install espeak-ng`): suena robótica, pero sirve para revisar los
tiempos antes de gastar créditos.

## Uso

```bash
# Revisión rápida
node herramientas/render.js velocidad --muestras        # hoja de contacto: un cuadro por etapa
node herramientas/render.js velocidad --prueba          # video completo en 540p a 24 fps
node herramientas/servidor.js                           # vista previa en vivo en el navegador
#   → http://localhost:5173/motor/escena.html?episodio=velocidad&t=120

# Producción
node herramientas/render.js velocidad --gpu             # video final 1080p 30 fps
node herramientas/render.js velocidad --miniatura       # miniatura 1280x720
node herramientas/render.js velocidad --short 9-11      # Short vertical con las etapas 9 a 11
node herramientas/render.js velocidad --solo-textos     # descripción + subtítulos (sin renderizar)
```

Todo queda en `salida/<episodio>/`.

| Opción | Qué hace |
|---|---|
| `--gpu` | Usa la placa de video. **Úsala en tu PC**: es mucho más rápida que el render por software. |
| `--trabajos N` | Cuántos navegadores renderizan en paralelo (por defecto: la mitad de los núcleos, máximo 4). |
| `--fps N` | Cuadros por segundo (30 por defecto, 24 en `--prueba`). |
| `--desde S --hasta S` | Renderiza solo un tramo, en segundos. |
| `--sin-voz` | Sin narración; las duraciones se estiman a 2,6 palabras por segundo. |

Como referencia: sin GPU, en un servidor de 4 núcleos, el modo `--prueba` va a unos 10 cuadros por segundo
(un video de 8 minutos tarda unos 20 minutos). El 1080p por software es unas 3 o 4 veces más lento.

## Subir a YouTube

1. `salida/<ep>/<ep>.mp4` → el video.
2. `salida/<ep>/descripcion.md` → título, descripción con capítulos, etiquetas y títulos alternativos para la prueba A/B.
3. `salida/<ep>/subtitulos.srt` → en YouTube Studio, *Subtítulos → Subir archivo* (mejora el alcance y la accesibilidad).
4. `salida/<ep>/miniatura.jpg` → la miniatura.
5. Recorta 2 o 3 Shorts con `--short` usando las etapas más impactantes, y súbelos durante la semana con un enlace al video largo.

## Crear un episodio nuevo

1. Copia el prompt de [`docs/PROMPT_GUION.md`](docs/PROMPT_GUION.md) en Claude con tu idea («¿y si te volvieras cada vez más pequeño?»).
2. Guarda el JSON en `episodios/<nombre>.json`.
3. **Verifica cada dato** (ver más abajo), revisa con `--muestras` y `--prueba`, y después renderiza.

### Formato del episodio

```jsonc
{
  "slug": "velocidad",
  "titulo": "¿Qué pasaría si aceleraras y no pudieras frenar?",
  "titulosAlternativos": ["…"],
  "descripcion": "Texto para YouTube",
  "etiquetas": ["velocidad", "…"],
  "etiqueta": "Tu velocidad",          // texto sobre el contador
  "subtitulo": "y sigue aumentando",   // texto bajo el contador
  "formato": "numero",                 // numero | tiempo | distancia | masa
  "unidad": "km/h",                    // solo para formato numero
  "completo": true,                    // mostrar todos los dígitos (1.079.252.849) en vez de "1,1 mil millones"
  "miniatura": { "etapa": 8, "texto": "Aceleras y <em>no puedes frenar</em>" },
  "etapas": [
    {
      "titulo": "La barrera del sonido",   // rótulo de la etapa y capítulo de YouTube
      "valor": 1235,                       // el contador sube desde aquí hasta el valor de la etapa siguiente
      "hasta": 1300,                       // (opcional) valor final de esta etapa
      "duracionMinima": 6,                 // (opcional) segundos
      "escena": { … },                     // solo lo que cambia: se hereda de la etapa anterior
      "texto": "Narración de la etapa…"
    }
  ]
}
```

### Parámetros de escena

Cada etapa hereda la escena de la anterior y solo indica lo que cambia. Los cambios se funden en 2,5 segundos.

| Parámetro | Valores | Efecto |
|---|---|---|
| `ambiente` | `dia`, `atardecer`, `noche`, `crepusculo`, `tormenta`, `desierto`, `nieve`, `marte`, `espacio` | Cielo, niebla, color del suelo y luz |
| `objetos` | lista de `carretera`, `arboles`, `postes`, `edificios`, `montanas`, `nubes`, `tierra`, `luna`, `galaxia` | Qué hay en la escena |
| `velocidad` | m/s | Avance de la cámara (visual, no tiene que ser el valor real) |
| `altura` | metros | Altura de la cámara. Por encima de 30 km se ve el planeta (si `tierra` está en `objetos`) |
| `mirar` | grados | Inclinación de la cámara (negativo = hacia abajo) |
| `fov` | grados | Campo de visión (más alto = más sensación de velocidad) |
| `temblor` | 0 a 1 | Vibración de la cámara |
| `lineas` | 0 a 1 | Líneas de velocidad |
| `calor` | 0 a 1 | Resplandor de calor o plasma en los bordes |
| `sol` | ciclos por segundo | Ciclo día/noche (para *time-lapse*) |
| `estaciones` | años por segundo | Color del suelo según la estación |
| `viento` | m/s | Velocidad de las nubes |

## Canal

`canal.json` define el nombre, el color de acento, la voz, la música, el pie de la descripción y los hashtags.
La música va en `musica/` (ver [musica/LEEME.md](musica/LEEME.md)).

## Antes de publicar: calidad y políticas

- **Verifica los datos.** Los guiones incluidos usan cifras de fuentes conocidas (récords oficiales, NASA, etc.),
  pero revísalos igual y pon las fuentes en un comentario fijado. Un error en los comentarios mata la credibilidad.
- **YouTube no monetiza el contenido «masivo y repetitivo»** (política de contenido no auténtico). Para estar del
  lado correcto: cada episodio con una idea distinta y un guion propio, investigación real, y que se note la mano
  humana (revisión, voz o estilo propio). No publiques diez variaciones de la misma plantilla.
- **Indica el contenido sintético** si YouTube lo pide al subir (la voz generada por IA puede requerirlo).
- **La música tiene que ser libre de derechos.** La Biblioteca de audio de YouTube Studio es la opción más segura.

## Estructura

```
canal.json                 configuración del canal
episodios/*.json           un archivo por video
motor/                     escena 3D (Three.js) y capa de textos (HTML/CSS)
herramientas/render.js     render completo (voz → cuadros → MP4)
herramientas/voz.js        ElevenLabs / espeak-ng, con caché
herramientas/linea.js      línea de tiempo, subtítulos, formatos
herramientas/servidor.js   servidor local y vista previa
herramientas/fuentes/      generadores de episodios (Python)
docs/PROMPT_GUION.md       prompt para escribir episodios nuevos con Claude
docs/IDEAS.md              ideas para próximos videos
```

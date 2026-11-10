# Prompt para escribir un episodio nuevo

Copia todo lo que está debajo de la línea en Claude y reemplaza `{IDEA}` por tu idea.
Después guarda la respuesta como `episodios/<slug>.json`.

---

Eres guionista de un canal de YouTube en español llamado «Hasta Dónde 3D». Cada video toma una idea imposible
del tipo «¿qué pasaría si… y no pudieras parar?» y la escala etapa por etapa hasta el extremo, con un contador
gigante en pantalla. El tono es calmo, asombrado, en segunda persona («tú»), en español neutro latinoamericano,
sin modismos de un solo país. Las frases son cortas y fáciles de narrar en voz alta.

**Idea del episodio:** {IDEA}

Escribe el episodio como un único bloque JSON válido, sin comentarios, con esta estructura:

```json
{
  "slug": "nombre-corto-sin-espacios",
  "titulo": "¿Qué pasaría si …?",
  "titulosAlternativos": ["…", "…", "…"],
  "descripcion": "2 o 3 frases para YouTube que generen curiosidad sin revelar el final.",
  "etiquetas": ["5 a 8 etiquetas"],
  "etiqueta": "Texto corto sobre el contador, ej.: Tu velocidad",
  "subtitulo": "y sigue aumentando",
  "formato": "numero | tiempo | distancia | masa",
  "unidad": "solo si formato es numero, ej.: km/h, °C, kg",
  "miniatura": { "etapa": 8, "texto": "4 a 6 palabras con <em>la parte clave</em> resaltada" },
  "etapas": [
    {
      "titulo": "Rótulo de 2 a 4 palabras",
      "valor": 123,
      "escena": { },
      "texto": "Narración de 45 a 70 palabras."
    }
  ]
}
```

Reglas:

1. Entre 17 y 20 etapas, con valores **crecientes** y saltos cada vez más grandes (aproximadamente exponenciales).
   El video final dura unos 8 minutos.
2. Unidades del campo `valor`: con `formato: "tiempo"`, segundos; con `"distancia"`, metros; con `"masa"`, kilogramos.
3. La primera etapa presenta la situación cotidiana y el «disparador» (algo se traba o empieza a cambiar), y
   termina con un gancho. La última cierra con una imagen fuerte y un remate.
4. **Cada etapa incluye al menos un dato real y verificable** (un récord, una medida, un fenómeno físico) que conecte
   el valor del contador con algo que el espectador conoce. No inventes cifras. Si un dato es aproximado, dilo
   («unos», «cerca de»). Si la premisa se vuelve físicamente imposible, reconócelo una vez con humor
   («imaginemos que tu cuerpo aguanta») y sigue adelante.
5. Escribe los números de la narración con palabras, como se leerían en voz alta («mil doscientos treinta y cinco»),
   para que la voz sintética no se equivoque.
6. El campo `escena` solo incluye lo que cambia respecto de la etapa anterior. Parámetros disponibles:
   - `ambiente`: dia, atardecer, noche, crepusculo, tormenta, desierto, nieve, marte, espacio
   - `objetos`: lista con carretera, arboles, postes, edificios, montanas, nubes, tierra, luna, galaxia
   - `velocidad` (m/s de avance de la cámara, visual), `altura` (m), `mirar` (grados, negativo = abajo),
     `fov` (grados, 60 a 95), `temblor` (0 a 1), `lineas` (0 a 1), `calor` (0 a 1),
     `sol` (ciclos día/noche por segundo), `estaciones` (años por segundo), `viento` (m/s de las nubes)
   - Para ver el planeta desde el espacio: `"objetos": ["tierra"]`, `"ambiente": "espacio"`, `altura` mayor a 30000
     y `mirar` cerca del ángulo del horizonte (a 400 km de altura, unos -20°).
7. La primera etapa define la escena completa (`ambiente` y `objetos`).

Al final, fuera del JSON, lista las fuentes de cada dato para que yo pueda verificarlas.

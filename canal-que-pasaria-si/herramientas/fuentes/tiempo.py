# Genera episodios/tiempo.json (los parámetros de escena se calculan a partir del valor).
import json, os
DIA, ANIO = 86400, 31557600
E = [
 ("Todo normal", 1, {"objetos": ["carretera", "arboles", "postes", "montanas", "nubes"]},
  "Estás parado en medio del campo, un día cualquiera. Miras tu reloj y el segundero avanza como siempre. Pero de pronto notas algo raro: las nubes se mueven un poco más rápido. El segundero empieza a acelerar. El tiempo se está acelerando, y no hay forma de detenerlo. Tú no vas a envejecer. Lo único que puedes hacer es mirar."),
 ("Un minuto por segundo", 60, {},
  "Ahora, cada segundo que vives equivale a un minuto para el resto del mundo. Las nubes cruzan el cielo como si hubiera un vendaval. Una conversación entera dura lo que un parpadeo. Y para ti, nada cambió: respiras igual y piensas igual. Es el mundo el que corre."),
 ("El Sol se mueve", 3600, {},
  "Una hora por segundo. Ahora puedes ver al Sol moverse: cruza el cielo entero en unos doce segundos. Las sombras de los árboles giran a tu alrededor como las agujas de un reloj. Las personas son manchas borrosas, y una jornada de trabajo completa termina en ocho segundos."),
 ("Día y noche", DIA, {"ambiente": "crepusculo"},
  "Un día por segundo. El cielo empieza a parpadear: día, noche, día, noche, una vez por segundo. Tus ojos ya no pueden seguirlo, y todo se ve como un crepúsculo eterno, una mezcla entre la luz y la oscuridad. Si tuvieras un celular en la mano, la batería se agotaría en un par de segundos."),
 ("Una semana", 604800, {},
  "Una semana por segundo. En lo que dura una canción, pasan cuatro años. Ahora puedes ver a las plantas crecer y girar buscando el sol. Las flores se abren y se cierran como si respiraran. Todo lo vivo a tu alrededor parece moverse con intención."),
 ("Las estaciones", 2629800, {},
  "Un mes por segundo. Ahora ves pasar las estaciones: el campo reverdece en primavera, se tuesta en verano, se vuelve dorado en otoño y se cubre de escarcha en invierno. Un año entero dura doce segundos. La Luna completa todas sus fases en apenas un segundo."),
 ("Un año por segundo", ANIO, {},
  "Un año por segundo. Las estaciones se funden en un parpadeo de colores. Un bebé que nace ahora sería adulto en dieciocho segundos. Los árboles jóvenes se convierten en gigantes en menos de un minuto. Y la carretera, sin que puedas ver a nadie repararla, se gasta y se renueva una y otra vez."),
 ("Una vida en ocho segundos", 10 * ANIO, {},
  "Diez años por segundo. Una vida humana entera, unos ochenta años, dura ocho segundos. Las personas que conociste ya no están. Aparecen tecnologías que hoy no podemos ni imaginar. Pero no ves a nadie: la gente vive y muere más rápido de lo que tus ojos pueden registrar."),
 ("Una ciudad brota", 100 * ANIO, {"objetos": ["carretera", "edificios", "postes", "montanas", "nubes"]},
  "Cien años por segundo. A tu alrededor se levanta una ciudad. Los edificios brotan del suelo, envejecen y son reemplazados por otros más altos. Toda la historia escrita de la humanidad, desde las primeras tablillas de Mesopotamia hasta hoy, unos cinco mil años, cabría en cincuenta segundos."),
 ("La ciudad desaparece", 1000 * ANIO, {"objetos": ["arboles", "montanas", "nubes"]},
  "Mil años por segundo. Y entonces, la ciudad desaparece. Quizás la abandonaron, quizás la humanidad se mudó a otro lugar. Sin nadie que la cuide, el concreto se agrieta, el acero se oxida y el bosque lo cubre todo. En unos miles de años, casi no queda rastro de que alguna vez estuvimos aquí."),
 ("Eras de hielo", 10000 * ANIO, {"ambiente": "nieve"},
  "Diez mil años por segundo. El clima empieza a oscilar. La Tierra tiene ciclos naturales, causados por pequeños cambios en su órbita, que traen eras de hielo más o menos cada cien mil años. Ahora ves cómo los glaciares avanzan, cubren todo de blanco y se retiran, una y otra vez."),
 ("Toda nuestra especie", 100000 * ANIO, {"ambiente": "crepusculo"},
  "Cien mil años por segundo. Nuestra especie, el Homo sapiens, existe desde hace unos trescientos mil años. A esta velocidad, toda nuestra historia como especie, desde las primeras herramientas hasta los cohetes, duraría tres segundos. Las eras de hielo ahora parpadean como antes lo hacían los días."),
 ("Se mueven los continentes", 1e6 * ANIO, {},
  "Un millón de años por segundo. Ahora se mueve el propio suelo. Los continentes se desplazan unos pocos centímetros por año, más o menos lo que crecen tus uñas. Pero en un millón de años son decenas de kilómetros. Las montañas se elevan en el horizonte y la erosión las desgasta."),
 ("Más allá de los dinosaurios", 1e7 * ANIO, {},
  "Diez millones de años por segundo. Los dinosaurios desaparecieron hace sesenta y seis millones de años. A esta velocidad, eso sería hace apenas siete segundos. Nuevas especies aparecen y se extinguen. Lo que camine por este campo ya no se parece a nada que conozcas."),
 ("Pangea Última", 1e8 * ANIO, {"ambiente": "desierto", "objetos": ["montanas", "nubes"]},
  "Cien millones de años por segundo. Dentro de unos doscientos cincuenta millones de años, según algunos modelos, los continentes volverán a unirse en un supercontinente, como la antigua Pangea. Los científicos ya le pusieron nombre: Pangea Última. Y tú estás, quizás, en medio de un desierto gigantesco."),
 ("Los océanos se evaporan", 1e9 * ANIO, {"objetos": ["montanas"]},
  "Mil millones de años por segundo. El Sol se vuelve más brillante poco a poco: alrededor de un diez por ciento cada mil millones de años. Eso alcanza para cambiarlo todo. El calor evapora los océanos, el agua escapa al espacio y la Tierra se convierte en un desierto. La vida compleja ya no puede sobrevivir aquí."),
 ("Gigante roja", 5e9 * ANIO, {"ambiente": "marte", "calor": 0.5},
  "Cinco mil millones de años. El Sol agota el hidrógeno de su núcleo y empieza a hincharse. Se convierte en una gigante roja, cientos de veces más grande que ahora. El cielo se tiñe de rojo. Es posible que el Sol llegue a tragarse a la Tierra, y si no lo hace, la dejará convertida en una roca calcinada."),
 ("Oscuridad", 1e11 * ANIO, {"ambiente": "noche", "calor": 0, "objetos": ["montanas"]},
  "Cien mil millones de años por segundo. El Sol se apagó hace mucho y quedó una enana blanca, una brasa del tamaño de la Tierra que se enfría lentamente. El universo sigue expandiéndose, y las demás galaxias se alejan tanto que su luz ya no puede llegar hasta aquí. El cielo se vacía."),
 ("Las últimas estrellas", 1e14 * ANIO, {"ambiente": "espacio", "objetos": []},
  "Cien billones de años. Las últimas estrellas se apagan. Ya no queda gas para formar estrellas nuevas, y el universo se queda a oscuras, poblado solo por restos fríos y agujeros negros. Y tú sigues aquí, mirando un universo que ya terminó. Todo lo que conociste duró menos que un parpadeo. Y el tiempo sigue sin detenerse."),
]
etapas = []
for i, (tit, v, esc, txt) in enumerate(E):
    e = {"titulo": tit, "valor": v, "texto": txt}
    escena = dict(esc)
    escena["sol"] = v / DIA
    escena["estaciones"] = v / ANIO
    escena["viento"] = min(6 * v, 3000)
    escena.setdefault("velocidad", 0.6)
    e["escena"] = escena
    etapas.append(e)
etapas[-1]["duracionMinima"] = 14
ep = {
  "slug": "tiempo",
  "titulo": "¿Qué pasaría si el tiempo se acelerara y no pudieras detenerlo?",
  "titulosAlternativos": ["El tiempo se acelera y no para: esto verías", "De 1 segundo al fin del universo", "Cada segundo pasa más tiempo… hasta el final de todo"],
  "descripcion": "Estás parado en un campo y el tiempo empieza a acelerarse. Primero un minuto por segundo, después un día, un año, un millón de años… Ves pasar las estaciones, nacer y morir ciudades, moverse los continentes, morir al Sol y apagarse las últimas estrellas.",
  "etiquetas": ["tiempo", "fin del universo", "futuro de la Tierra", "time lapse", "geología", "astronomía"],
  "etiqueta": "1 segundo real equivale a",
  "subtitulo": "y sigue aumentando",
  "formato": "tiempo",
  "miniatura": {"etapa": 9, "texto": "El tiempo se acelera <em>y no para</em>"},
  "escena": {"faseSol": 0.2},
  "etapas": etapas,
}
dst = os.path.join(os.path.dirname(__file__), "..", "..", "episodios", "tiempo.json")
json.dump(ep, open(dst, "w"), ensure_ascii=False, indent=2)
print("ok", len(etapas), "etapas")

# Genera episodios/crecer.json. La cámara está a la altura de tus ojos (93 % de tu altura).
import json, os, math
R = 6.371e6
def mirar(h):
    ojo = h * 0.93
    if ojo < 20000:  # en el suelo: miras cada vez más hacia abajo
        return -(4 + 30 * min(1, math.log10(max(ojo, 1.6) / 1.6) / 4))
    caida = math.degrees(math.acos(R / (R + ojo)))  # ángulo del horizonte
    return -min(80, caida + 3)
CIUDAD = ["carretera", "edificios", "postes", "arboles", "montanas", "nubes"]
E = [
 ("Algo no cuadra", 1.70, {"objetos": CIUDAD},
  "Te despiertas una mañana cualquiera, te paras frente al espejo y algo no cuadra. La ropa te queda un poco justa. Sales a la calle y las puertas parecen más bajas. Mides un metro setenta, y unos centímetros más que ayer. Estás creciendo. Y no puedes parar."),
 ("Récord humano", 2.72, {},
  "Dos metros setenta y dos. Acabas de igualar a Robert Wadlow, el hombre más alto de la historia registrada. Ya no entras por ninguna puerta, tienes que agacharte para mirar dentro de un autobús y la gente se detiene en la calle para sacarte fotos."),
 ("Tan alto como una jirafa", 5.5, {},
  "Cinco metros y medio, la altura de una jirafa. Y aparece un problema que la física conoce muy bien: la ley del cuadrado y el cubo. Si duplicas tu altura, tu peso se multiplica por ocho, pero la fuerza de tus huesos solo por cuatro. A esta escala, tus piernas deberían estar crujiendo."),
 ("Cuarto piso", 12, {},
  "Doce metros. Tus ojos están a la altura de un cuarto piso y pesas unas veinticinco toneladas. Para seguir con el experimento, imaginemos que tu cuerpo se adapta mágicamente y aguanta. Los autos parecen juguetes a tus pies, y la gente te mira desde las ventanas."),
 ("Ballena azul", 30, {},
  "Treinta metros. Mides lo mismo que una ballena azul, el animal más grande que ha existido jamás, más grande que cualquier dinosaurio conocido. Y tu corazón late cada vez más lento: en los animales grandes, el pulso es mucho más pausado. El de una ballena azul puede bajar a dos latidos por minuto."),
 ("El árbol más alto", 116, {},
  "Ciento dieciséis metros. Eres más alto que Hyperion, una secuoya roja de California y el árbol vivo más alto que se conoce. Cada paso tuyo mide casi cincuenta metros. Cruzas una manzana entera de una zancada, y los edificios te llegan a la cintura."),
 ("Torre Eiffel", 330, {},
  "Trescientos treinta metros. La altura de la Torre Eiffel. Pesas alrededor de medio millón de toneladas, como cinco portaaviones juntos. Cada paso que das hace temblar el suelo, y los sismógrafos de la zona lo registran como un pequeño terremoto."),
 ("Burj Khalifa", 828, {"objetos": ["carretera", "edificios", "arboles", "montanas", "nubes"]},
  "Ochocientos veintiocho metros. Eres tan alto como el Burj Khalifa, en Dubái, el edificio terminado más alto del mundo. Desde aquí arriba ves a más de cien kilómetros a la redonda. Y el aire alrededor de tu cabeza ya está unos cinco grados más frío que en tus pies."),
 ("Entre las nubes", 2000, {},
  "Dos kilómetros. Tu cabeza atraviesa las nubes bajas. Cuando llueve, ves la tormenta desde arriba. Los aviones que despegan del aeropuerto pasan a la altura de tu pecho, y los controladores aéreos tienen un problema nuevo: tú."),
 ("Everest", 8849, {"objetos": ["carretera", "montanas", "nubes"]},
  "Ocho mil ochocientos cuarenta y nueve metros, la altura del Everest. Aquí arriba el aire tiene solo un tercio del oxígeno que hay al nivel del mar: los montañistas lo llaman la zona de la muerte. Alrededor de tu cabeza hace cuarenta grados bajo cero, y los aviones comerciales vuelan a la altura de tus ojos."),
 ("Línea de Kármán", 100000, {"objetos": ["carretera", "tierra"]},
  "Cien kilómetros. La línea de Kármán, la frontera donde muchos consideran que empieza el espacio. Tu cabeza está, oficialmente, fuera de la Tierra. Desde aquí ya se nota que el planeta es curvo, y el cielo sobre ti es completamente negro, aunque abajo sea de día."),
 ("Estación Espacial", 400000, {},
  "Cuatrocientos kilómetros. La Estación Espacial Internacional pasa zumbando alrededor de tu cabeza, a veintiocho mil kilómetros por hora. Y hay un problema curioso: si alguien te pisa un pie, la señal nerviosa, que viaja a unos cien metros por segundo, tardaría más de una hora en llegar a tu cerebro."),
 ("Como el planeta", 12742000, {"objetos": ["tierra", "luna"]},
  "Doce mil setecientos cuarenta y dos kilómetros. Eres tan alto como el diámetro de la Tierra. Ya no estás parado sobre el planeta: el planeta es una pelota a tus pies. Tu masa sería casi la mitad de la de la Luna, y tu propia gravedad empezaría a deformar la Tierra. Seguimos imaginando que nada de eso pasa."),
 ("Hasta la Luna", 384400000, {},
  "Trescientos ochenta y cuatro mil kilómetros. La distancia a la Luna. Podrías apoyar los pies en la Tierra y la cabeza en la Luna. La luz tarda más de un segundo en recorrer tu cuerpo: si alguien te mira los pies y después la cabeza, está viendo dos momentos distintos."),
 ("Tan grande como el Sol", 1.392e9, {"objetos": []},
  "Un millón trescientos noventa y dos mil kilómetros. Eres tan alto como el diámetro del Sol. Dentro del Sol cabrían más de un millón de Tierras. Y aun así, el Sol es una estrella bastante común, ni de las más grandes ni de las más pequeñas."),
 ("Una unidad astronómica", 1.496e11, {},
  "Ciento cincuenta millones de kilómetros. La distancia entre la Tierra y el Sol. La luz tarda ocho minutos y veinte segundos en ir de tus pies a tu cabeza. Toda la órbita de la Tierra cabría entre tus brazos abiertos."),
 ("Un año luz", 9.4607e15, {},
  "Un año luz: nueve billones y medio de kilómetros. La estrella más cercana, Próxima Centauri, todavía está a más de cuatro veces tu altura. Si movieras un dedo, la luz tardaría un año entero en avisarle a tu cabeza que lo hiciste."),
 ("La galaxia a tus pies", 9.4607e20, {"objetos": ["galaxia"]},
  "Cien mil años luz. El tamaño de la Vía Láctea. Tu cuerpo abarca la galaxia entera, con sus cientos de miles de millones de estrellas, y cada una de ellas podría tener planetas, y quizás alguien mirando hacia arriba. Y aun así, el universo observable es casi un millón de veces más grande. Y tú… sigues creciendo."),
]
etapas = []
for tit, v, esc, txt in E:
    escena = dict(esc)
    ojo = v * 0.93
    escena["altura"] = min(ojo, 2e9)  # más allá, la escena es solo espacio
    escena.setdefault("mirar", round(mirar(v), 1))
    escena["velocidad"] = 1.4 * v / 1.7 if ojo < 20000 else 1000
    if ojo > 1e8:
        escena["ambiente"] = "espacio"
        if "mirar" not in esc: escena["mirar"] = -8
    etapas.append({"titulo": tit, "valor": v, "escena": escena, "texto": txt})
etapas[-1]["duracionMinima"] = 14
ep = {
  "slug": "crecer",
  "titulo": "¿Qué pasaría si crecieras y no pudieras parar?",
  "titulosAlternativos": ["Creces sin parar: del espejo a la galaxia", "Te despiertas creciendo y no puedes parar", "Más alto que el Everest, que la Tierra y que el Sol"],
  "descripcion": "Te despiertas y mides un poco más que ayer. Y al día siguiente, más. Creces hasta superar al hombre más alto de la historia, a la ballena azul, a la Torre Eiffel, al Everest, a la Tierra, al Sol… y a la galaxia entera.",
  "etiquetas": ["escala", "tamaño del universo", "ley del cuadrado cubo", "gigante", "comparación de tamaños"],
  "etiqueta": "Tu altura",
  "subtitulo": "y sigues creciendo",
  "formato": "distancia",
  "miniatura": {"etapa": 8, "texto": "Creces y <em>no puedes parar</em>"},
  "etapas": etapas,
}
dst = os.path.join(os.path.dirname(__file__), "..", "..", "episodios", "crecer.json")
json.dump(ep, open(dst, "w"), ensure_ascii=False, indent=2)
print("ok", len(etapas), "etapas")

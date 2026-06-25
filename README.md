# Test de Perfil de Uso de IA

Aplicación estática en HTML, CSS y JavaScript vanilla para evaluar el perfil de uso de IA de una persona, capturar leads y mostrar un resultado personalizado con exportación a PDF.

## Estructura

- `index.html`: flujo principal del test.
- `result.html`: página de resultado tokenizada.
- `assets/css/styles.css`: estilos globales.
- `assets/js/`: módulos de frontend.
- `data/`: contenido editable en JSON.
- `worker/`: backend para Cloudflare Worker.

## Configuración editable

Todo el contenido principal del negocio se edita sin tocar el código:

- `data/questions.json`
- `data/profiles.json`
- `data/tieBreakers.json`
- `data/cta.json`
- `data/email.json`
- `data/app.json`

## Frontend

La app está pensada para hosting estático, por ejemplo GitHub Pages. El frontend:

- carga preguntas, perfiles, desempates y CTA desde JSON
- randomiza respuestas al comenzar cada intento
- permite avanzar, volver y cambiar respuestas
- resuelve empates exactos entre dos perfiles con una pantalla de desempate
- captura nombre, email y ciudad antes de mostrar el resultado
- redirige a `result.html?t=TOKEN`
- genera el PDF en el navegador con `jsPDF`

## Backend

El Worker:

- recibe envíos en `POST /api/submissions`
- genera un token único
- guarda la ejecución en Google Sheets
- envía el link por Resend
- expone `GET /api/results/:token`

Más detalles en [worker/README.md](/d:/workspace/cursos-ia-test/worker/README.md).

## Test de perfiles

El test consiste en 10 preguntas que se presentarán al usuario, cada una con 5 respuestas posibles que se muestran en orden aleatorio. Cada respuesta se asocia a un perfil y por cada selección del usuario se suma un punto al perfil correspondiente.

Las preguntas se encuentran en el archivo `data/questions.json`.

En caso de empate, se mostrará una nueva pregunta, únicamente con las opciones correspondientes a los perfiles que participan del empate. Esta pregunta se encuentra en el archivo `data/tieBreakers.json`.

Las descripciones de los perfiles se encuentran en el archivo `data/profiles.json`.

Cada modificación de las preguntas o de la forma en que se calcula el resultado debe hacer variar la versión del test. Esa versión es la que se encuentra en el archivo `data/app.json` en:

```json
"storage": {
    "progressKey": "perfil-ia-progress-v1",
    "version": 1
  },
```

(en caso de cambio, se deben cambiar tanto "v1" en "progressKey" como el número de versión).

Esto permite que los resultados queden marcados con el número de versión del test correspondiente y además evita que se intente restaurar un progreso viejo desde localStorage en caso de haber cambiado la versión (si el usuario había empezado el test con una versión y se publica otra, automáticamente se ignora el progreso viejo y empieza un test nuevo).

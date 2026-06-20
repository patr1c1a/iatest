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

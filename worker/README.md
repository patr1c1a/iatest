# Cloudflare Worker

Backend para persistir respuestas, generar tokens y devolver resultados históricos por URL.

## Endpoints

- `POST /api/submissions`
- `GET /api/results/:token`
- `GET /api/results?t=TOKEN`

## Variables de entorno requeridas

- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_NAME`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `RESEND_API_KEY`
- `SITE_DOMAIN`

## Variables opcionales

- `ALLOWED_ORIGINS`: lista separada por comas para CORS. Si no se define, responde con `*`.

## Formato esperado en Google Sheets

El Worker garantiza una fila de encabezados con estas columnas:

- `timestamp`
- `token`
- `name`
- `email`
- `city`
- `country`
- `result`
- `answers`

## Ejemplo de despliegue

1. Configurar `data/app.json` con la URL real del Worker.
2. Instalar Wrangler (con npm).
3. Login (debe haber una cuenta de Cloudflare y autorizar el servicio).
4. Crear las variables secretas del Worker que aparecen abajo.
5. Desplegar con Wrangler.

`wrangler.toml` incluido:

```bash
npm install -g wrangler
wrangler login
cd worker
wrangler secret put GOOGLE_PRIVATE_KEY
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
wrangler secret put GOOGLE_SHEET_ID
wrangler secret put GOOGLE_SHEET_NAME
wrangler secret put RESEND_API_KEY
wrangler secret put SITE_DOMAIN
wrangler deploy
```

Aclaraciones:

- Debe existir una cuenta de CloudFlare.
- Debe existir una cuenta de Google Cloud y un proyecto creado, con una Service Account creada y autorizada para ese proyecto.
- En la Service Account de Google Cloud debe haberse creado una API Key y descargado un json con esa key.
- El proyecto en Google Cloud debe tener habilitada la API de Google Sheets.
- Debe existir una planilla de Google Sheets creada en GDrive, vacía.
- La planilla de Google Sheets debe estar compartida con permisos de edición al email de la Service Account de Google Cloud.
- GOOGLE_PRIVATE_KEY: aparece como "private key" en el json. Se coloca todo lo que está entre comillas (exceptuando a éstas).
- GOOGLE_SERVICE_ACCOUNT_EMAIL: es el email de la service account autorizada en Google Cloud (aparece como "client_email" en el json).
- GOOGLE_SHEET_ID: el ID tomado de la URL de la plantilla (ejemplo: en https://docs.google.com/spreadsheets/d/1ABCDEF123456XYZ/edit sería "1ABCDEF123456XYZ").
- GOOGLE_SHEET_NAME: el nombre de la pestaña dentro de la plantilla (respetando mayúsculas y minúsculas).

Si wrangler pide un subdominio para workers.dev, crear uno.

Al finalizar el despliegue, dará la url donde se desplegó, ejemplo: https://perfil-ia-worker.xxxxx.workers.dev (donde "xxxxx" es el subdominio). Este es el valor a colocar en `app.json` como "baseUrl" de api:

```json
{
  "api": {
    "baseUrl": ""
  }
}
```

## Prueba

En Postman hacer un POST a `https://perfil-ia-worker.patriciaemiguel.workers.dev/api/submissions`

En el body:

{
  "name": "TestUser",
  "email": "testuser@test.com",
  "city": "Ciudad",
  "answers": {
    "q1":"explorador",
    "q2":"prudente",
    "q3":"jefe",
    "q4":"minimalista",
    "q5":"desconfiado",
    "q6":"explorador",
    "q7":"explorador",
    "q8":"prudente",
    "q9":"jefe",
    "q10":"minimalista"
  },
  "result":"explorador"
}

Si funciona correctamente, debería responder con el token y en la planilla debe insertarse una fila con los datos.

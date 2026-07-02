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
- `testVersion`
- `name`
- `email`
- `city`
- `country`
- `result`
- `q1` a `q11`

## Precondiciones

**Google Cloud:** (1) Debe existir una cuenta de Google Cloud y un proyecto creado, con una Service Account creada y autorizada para ese proyecto. (2) En esa Service Account debe haberse creado una API Key y descargado un json con esa key. (3) El proyecto en Google Cloud debe tener habilitada la API de Google Sheets.

**Google Sheets:** Debe existir una planilla de Google Sheets creada en Google Drive, vacía. La planilla debe estar compartida con permisos de edición al email de la Service Account de Google Cloud. Se puede renombrar la pestaña por defecto ("Sheet1") y ese nombre será importante en la configuración.

**Cloudflare:** Debe existir una cuenta de CloudFlare. Para conectar con Cloudflare es necesario instalar y configurar Wrangler:

1. Configurar `data/app.json` con la URL real del Worker.
2. Instalar Wrangler (con npm).
3. Login (en la cuenta de Cloudflare se debe autorizar el servicio).

```bash
npm install -g wrangler
wrangler login
```

Si wrangler pide un subdominio para workers.dev, crear uno.

**Turnstile**: Dentro de Cloudflare se debe crear un widget de Turnstile. Es recomendable crear uno para producción y uno para desarrollo. En el widget de producción, como host habilitado se colocará la url de producción. En el widget de desarrollo se agregarán "localhost" y "127.0.0.1". Luego se configurarán los valores de "site key" y "secret key" que correspondan a cada widget: cuando se necesita probar en desarrollo se colocarán los del widget de desarrollo y cuando esté listo, se colocarán los de producción.

Para cargar los valores de las variables secretas que necesita el Worker (que están en `.dev.vars`):

```bash
cd worker
wrangler dev
```

**Resend**: (1) Debe existir una cuenta de resend.com. En los dominios se debe agregar el que se usará con el sitio web y, administrando la zona DNS de ese dominio, agregar los registros que proporciona resend, y esperar a que resend los valide. (2) Generar una API key en resend, con "sending access" (no full).

## Variables del Worker

- GOOGLE_PRIVATE_KEY: se obtiene del json descargado de la service account de Google. Se coloca todo lo que está entre comillas (exceptuando a éstas) en "private key".
- GOOGLE_SERVICE_ACCOUNT_EMAIL: es el email de la service account autorizada en Google Cloud (aparece como "client_email" en el json).
- GOOGLE_SHEET_ID: el ID tomado de la URL de la planilla de Google Sheet (ejemplo: en https://docs.google.com/spreadsheets/d/1ABCDEF123456XYZ/edit sería "1ABCDEF123456XYZ").
- GOOGLE_SHEET_NAME: el nombre de la pestaña dentro de la planilla de Google Sheet (respetando mayúsculas y minúsculas). Por defecto, Google Sheets la llama "Sheet1".
- TURNSTILE_SITE_KEY: site key del widget de Turnstile en CloudFlare.
- TURNSTILE_SECRET_KEY: secret key del widget de Turnstile en Cloudflare.
- RESEND_API_KEY: api key generada en Resend.
- SITE_DOMAIN: se configura en `wrangler.toml` (no se guarda como secreto).

## Ejemplo de despliegue

```bash
cd worker
wrangler secret put GOOGLE_PRIVATE_KEY
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
wrangler secret put GOOGLE_SHEET_ID
wrangler secret put GOOGLE_SHEET_NAME
wrangler secret put TURNSTILE_SITE_KEY
wrangler secret put TURNSTILE_SECRET_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put SITE_DOMAIN
wrangler deploy
```

Al finalizar el despliegue, dará la url donde se desplegó, ejemplo: https://perfil-ia-worker.xxxxx.workers.dev (donde "xxxxx" es el subdominio). Este es el valor a colocar en `app.json` como "baseUrl" de api:

```json
{
  "api": {
    "baseUrl": ""
  }
}
```

Ante cualquier cambio en el worker, se debe volver a hacer deploy (`cd worker` y luego `wrangler deploy`).

## Prueba

En Postman hacer un POST a `https://perfil-ia-worker.patriciaemiguel.workers.dev/api/submissions`

En el body:

```txt
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
  "testVersion": 1
}
```

Si funciona correctamente, debería responder con el token y en la planilla debe insertarse una fila con los datos.

Para ver logs, dejar corriendo el comando `wrangler tail` mientras se hace el POST.

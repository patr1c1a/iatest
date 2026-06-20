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

1. Configura `data/app.json` con la URL real del Worker.
2. Crea las variables secretas del Worker.
3. Despliega con Wrangler.

`wrangler.toml` incluido:

```bash
cd worker
wrangler secret put GOOGLE_PRIVATE_KEY
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
wrangler secret put GOOGLE_SHEET_ID
wrangler secret put GOOGLE_SHEET_NAME
wrangler secret put RESEND_API_KEY
wrangler secret put SITE_DOMAIN
wrangler deploy
```

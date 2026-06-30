# Polla Mundial Automation v2

## Archivos clave

- `apps_script/Code.gs`: pegar completo en Google Apps Script.
- `.github/workflows/update-polla.yml`: GitHub Action obligatorio.
- `scripts/update_from_email.py`: procesa el Excel y actualiza `assets/js/data.js`.
- `inbox/`: carpeta donde Apps Script sube el Excel y el cuerpo del correo.

## Flujo

1. Apps Script revisa Gmail cada 10 minutos.
2. Si encuentra un correo nuevo con Excel, sube `inbox/latest.xlsx` e `inbox/email.json` a GitHub.
3. Lanza el workflow `update-polla.yml`.
4. GitHub Action ejecuta Python y actualiza `assets/js/data.js`.
5. Netlify redeploya automáticamente por el commit.
6. Apps Script envía un correo al remitente con asunto `web actualizada`.

## Configuración en Apps Script

Editar en `Code.gs`:

```js
githubToken: 'PEGA_AQUI_TU_TOKEN',
```

Opcionalmente ajustar:

```js
gmailQuery: '(beto OR vete OR puntajes OR polla) has:attachment filename:xlsx newer_than:10d',
confirmationTo: 'AUTO_SENDER',
```

## Test

1. Ejecutar `installTrigger()` una vez.
2. Ejecutar `checkPollaEmail()` una vez.
3. Verificar GitHub > Actions > `Update Polla from Gmail`.

# Polla Mundial - V3 revisada

## Archivos críticos que deben existir en GitHub

- `.github/workflows/update-polla.yml`
- `apps_script/Code.gs`
- `scripts/update_from_email.py`
- `assets/js/data.js`
- `inbox/latest.xlsx`
- `inbox/email.json`

## Instalación recomendada en GitHub web

1. Descomprime este ZIP.
2. Sube todo el contenido a la raíz del repo.
3. Verifica que exista `.github/workflows/update-polla.yml`.
4. Si no aparece `.github`, crea el workflow manualmente:
   - Add file → Create new file
   - Nombre: `.github/workflows/update-polla.yml`
   - Copia el contenido de `GITHUB_WORKFLOW_update-polla.yml`
   - Commit changes
5. En Apps Script, reemplaza todo `Code.gs` por `apps_script/Code.gs`.
6. En Apps Script cambia `githubToken: 'PEGA_AQUI_TU_TOKEN'` por tu token.
7. Ejecuta `installTrigger` una vez.
8. Ejecuta `checkPollaEmail` para test.

## Notas

- La GitHub Action se ejecuta solo por `workflow_dispatch`; esto evita carreras por commits parciales.
- Apps Script sube el Excel + email, luego dispara el workflow.
- Si el workflow termina OK, Apps Script envía el correo `web actualizada` solo al remitente del correo procesado.

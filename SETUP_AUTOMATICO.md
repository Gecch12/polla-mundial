# Automatización full: Gmail → GitHub → Netlify

Objetivo: que la web se actualice sola 10-15 minutos después de que Beto/Vete mande el correo con el Excel.

## 1) Subir la web a GitHub

Crea un repo, por ejemplo:

`polla-mundial-2026`

Sube todo el contenido de esta carpeta al repo, incluyendo:

- `.github/workflows/update-polla.yml`
- `scripts/update_from_email.py`
- `apps_script/Code.gs`
- `assets/js/data.js`
- `inbox/email.json`
- `inbox/processed_message_ids.txt`

No hace falta subir `inbox/latest.xlsx`; lo va a crear Apps Script cuando llegue el correo.

## 2) Conectar Netlify a GitHub

En Netlify:

1. Add new site → Import an existing project.
2. Conecta el repo de GitHub.
3. Build command: dejar vacío.
4. Publish directory: `/`.
5. Deploy.

Cada commit nuevo en GitHub va a publicar la web.

## 3) Crear token de GitHub

En GitHub:

Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.

Permisos mínimos para este repo:

- Contents: Read and Write
- Actions: Read and Write

Copia el token.

## 4) Crear Apps Script

Ve a `script.google.com` y crea un nuevo proyecto.

Pega el contenido de:

`apps_script/Code.gs`

Luego reemplaza estos valores:

```js
const CONFIG = {
  githubOwner: 'TU_USUARIO_O_ORG',
  githubRepo: 'TU_REPO',
  githubBranch: 'main',
  githubToken: 'TU_GITHUB_TOKEN',
  ...
};
```

Ajusta también la búsqueda de Gmail si hace falta:

```js
gmailQuery: 'has:attachment filename:xlsx newer_than:3d (from:beto OR from:vete OR "Beto Ramos" OR "PUNTAJES")'
```

## 5) Instalar el trigger

En Apps Script:

1. Ejecuta `installTrigger()` una vez.
2. Autoriza Gmail + UrlFetch.
3. Ejecuta `checkPollaEmail()` una vez para probar.

Después correrá solo cada 10 minutos.

## 6) Verificar el primer update

Después de recibir/procesar un correo:

1. En GitHub, revisa Actions → `Update Polla from Gmail`.
2. Debe crear un commit automático modificando `assets/js/data.js`.
3. Netlify debe publicar ese commit.
4. En la web, revisa:
   - Ranking
   - Race
   - Movements
   - Información general

## Importante

El archivo `scripts/update_from_email.py` tiene un parser flexible para el Excel, pero depende del formato real del archivo de Beto. Si Beto cambia columnas o layout, probablemente solo haya que ajustar la función `find_ranking_table()`.

Para el primer día, conviene probar con un correo real y revisar el resultado antes de dejarlo 100% automático.

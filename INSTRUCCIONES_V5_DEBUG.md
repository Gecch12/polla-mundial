# V5 Debuggable Parser

Cambios:
- No cambia la arquitectura.
- `scripts/update_from_email.py` ahora imprime logs `[polla-debug]` en cada etapa.
- El workflow ejecuta Python con `-u` para que los logs aparezcan en vivo.
- El job tiene `timeout-minutes: 8` para evitar runs colgados por 35 minutos.
- El parser limita el escaneo del Excel y busca solo la tabla oficial derecha de `PUNTAJES`.

Instalación:
1. Sube/reemplaza todo el contenido del ZIP en GitHub.
2. Verifica que `.github/workflows/update-polla.yml` tenga varias líneas.
3. Verifica que `scripts/update_from_email.py` tenga varias líneas.
4. Ejecuta GitHub Actions manualmente con `Run workflow`.
5. Si falla, abre el paso `Update data.js from Gmail Excel` y copia los logs `[polla-debug]`.

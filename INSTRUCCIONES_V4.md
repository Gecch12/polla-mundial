# V4 - Parser corregido para PUNTAJES

Esta versión mantiene la arquitectura actual. Solo corrige el extractor del Excel para leer la tabla oficial del extremo derecho de la hoja PUNTAJES:

TOTAL | Posición | Participante

Validaciones antes de publicar:
- mínimo 70 participantes;
- líder con más de 150 puntos;
- el líder no puede ser un placeholder como TERCEROS;
- ranking ordenado correctamente.

## Para corregir producción

1. Subir todo el contenido de este ZIP al repo y hacer commit.
2. Ejecutar manualmente GitHub Actions > Update Polla from Gmail > Run workflow.
3. Validar que la web muestre el ranking correcto.
4. Luego dejar el trigger automático activo.


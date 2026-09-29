# Snippets

| Fichero | Qué es |
|---|---|
| [blog-automatico.n8n.json](blog-automatico.n8n.json) | **Plantilla importable de n8n** del flujo principal: los 37 nodos del flujo real y una nota «Léeme». No tiene credenciales asignadas, las URLs son de `example.com`, no hay tokens ni IDs de página, cuenta, chat o tabla, y todos los identificadores son nuevos |
| [prompt-articulo.md](prompt-articulo.md) | El prompt de generación del artículo, reescrito de forma genérica, con el porqué de cada parte |
| [deduplicar-temas.js](deduplicar-temas.js) | Filtro de temas nuevos frente al catálogo: título, keyword y parecido de palabras |
| [validacion-y-reintentos.js](validacion-y-reintentos.js) | Validación del artículo antes de publicar y lógica de hasta 3 intentos |

## Importar la plantilla

1. En n8n, ve a **Workflows → Import from File** y elige `blog-automatico.n8n.json`.
2. Sigue la nota **Léeme** del lienzo:
   - crea la tabla de temas;
   - asigna las credenciales (modelo, banco de imágenes, API del blog, Meta, Telegram y SMTP);
   - sustituye `example.com`, `PAGE_ID`, `IG_USER_ID` y `TU_CHAT_ID`;
   - personaliza el prompt.
3. Carga unos cuantos temas en la tabla con `estado = pendiente`, prueba a mano con **Execute workflow** y actívalo.

El nodo «Aplicar marca IG» llama a un endpoint propio que da un estilo de marca a la foto. Si no tienes uno, conecta «Preparar foto IG» directamente con «Crear contenedor IG» y cambia `$json.url` por `$json.imageUrl`.

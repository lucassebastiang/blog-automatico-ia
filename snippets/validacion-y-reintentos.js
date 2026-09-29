// Validación del artículo y reintentos (tres nodos Code del flujo principal, juntos aquí).
//
// Idea: el modelo a veces devuelve JSON roto, se deja campos, se queda corto o suelta frases
// de «asistente». Nada de eso se publica. Se valida en código y, si no pasa, se vuelve a generar
// el MISMO tema (sigue el primero «pendiente» de la cola) hasta 3 intentos en total.
// Si tampoco sale, aviso por Telegram con el motivo y el tema sigue en la cola.

// ── 1 · «Reset intentos» (justo después del disparador programado) ─────────────────────────────
// El contador vive en la static data del flujo: sobrevive entre vueltas del bucle de reintento
// dentro de la misma ejecución, y se pone a 1 al empezar cada ejecución programada.
{
  const sd = $getWorkflowStaticData('global');
  sd.intentosBlog = 1;
  return $input.all();
}

// ── 2 · «Validar y parsear» (tras la llamada al modelo) ─────────────────────────────────────────
{
  const r = $input.first().json;
  let post = null;
  let motivo = '';

  try {
    // Se pide response_format: json_object, pero se valida igual.
    post = JSON.parse(r.choices[0].message.content);
  } catch (e) {
    motivo = 'JSON no parseable';
  }

  const OBLIGATORIOS = ['titulo', 'slug', 'meta_title', 'meta_description', 'categoria', 'extracto',
    'cuerpo_html', 'imagen_query', 'imagen_alt', 'servicio_relacionado'];
  if (post) {
    const falta = OBLIGATORIOS.find((k) => !post[k] || String(post[k]).trim() === '');
    if (falta) motivo = 'Falta el campo ' + falta;
  }
  if (post && !motivo && (!Array.isArray(post.faqs) || post.faqs.length < 1)) motivo = 'Faltan las FAQs';

  // Longitud: se cuentan palabras del texto sin etiquetas. El prompt pide más de 1200 y aquí se exige
  // un mínimo de 900, para no descartar artículos buenos que se quedan algo cortos.
  const palabras = post && post.cuerpo_html
    ? String(post.cuerpo_html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
    : 0;
  if (post && !motivo && palabras < 900) motivo = 'Artículo demasiado corto: ' + palabras + ' palabras';

  // Frases que delatan una respuesta de «asistente» en vez de un artículo.
  const PROHIBIDAS = ['como modelo de lenguaje', 'no puedo', 'lo siento', 'as an ai', 'language model'];
  if (post && !motivo) {
    const texto = (post.titulo + ' ' + post.cuerpo_html).toLowerCase();
    const hallada = PROHIBIDAS.find((f) => texto.includes(f));
    if (hallada) motivo = 'Frase prohibida: ' + hallada;
  }

  return [{ json: { valid: Boolean(post) && !motivo, reason: motivo, post, topic: $('Coger tema pendiente').item.json } }];
}

// ── 3 · «Preparar reintento» (rama «no válido») → IF «¿Reintentar?» ─────────────────────────────
// Sí: vuelve a «Coger tema pendiente» (mismo tema). No: «Avisar no válido» por Telegram.
{
  const sd = $getWorkflowStaticData('global');
  const MAX = 3; // intentos totales, incluido el primero
  const actual = sd.intentosBlog || 1;
  let reintentar = false;
  if (actual < MAX) {
    sd.intentosBlog = actual + 1;
    reintentar = true;
  }
  return $input.all().map((it) => ({ json: { ...it.json, reintentar, intentoNum: actual } }));
}

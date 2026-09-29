// Deduplicación de temas nuevos frente al catálogo (nodo Code de n8n).
//
// El modelo propone temas, pero no se puede confiar en que no repita: reformula
// («facturación automática» y «envío automático de facturas» son la misma búsqueda),
// cambia solo la ciudad o el año, o repite un tema de hace meses. Por eso el filtro está
// en código, con tres capas de menos a más difusa:
//   1. título normalizado idéntico;
//   2. misma keyword principal;
//   3. parecido de palabras (índice de Jaccard ≥ 0,72 sobre palabras de más de 3 letras).
// Además se valida cada tema: campos obligatorios, categoría conocida y ruta coherente,
// longitudes razonables y nada de promesas del tipo «en 5 minutos».

const historial = $('Leer catálogo de temas').all().map((i) => i.json).filter((t) => t.tema);

const normalizar = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const palabras = (s) => new Set(normalizar(s).split(' ').filter((w) => w.length > 3));

const parecido = (a, b) => {
  const comunes = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size || 1;
  return comunes / union >= 0.72;
};

// Única fuente de verdad para categoría → servicio (y así la IA no inventa rutas).
const RUTAS = {
  'Diseño web': '/servicios/diseno-web/',
  SEO: '/servicios/diseno-web/',
  'Automatización e IA': '/servicios/automatizacion-ia/',
  Branding: '/servicios/branding/',
  Mantenimiento: '/servicios/mantenimiento-web/',
};
const CAMPOS = ['tema', 'categoria', 'keyword_principal', 'keywords_secundarias', 'servicio_relacionado'];

const titulos = new Set(historial.map((t) => normalizar(t.tema)));
const keywords = new Set(historial.map((t) => normalizar(t.keyword_principal)).filter(Boolean));
const anteriores = historial.map((t) => palabras(t.tema));

let propuesta;
try {
  propuesta = JSON.parse($input.first().json.choices[0].message.content);
} catch {
  // Lanzar error dispara el flujo de alertas; la cola existente no se toca.
  throw new Error('Reposición: respuesta del generador no válida. La cola existente se conserva.');
}
if (!Array.isArray(propuesta.temas)) throw new Error('Reposición: falta la lista de temas.');

const aceptados = [];
for (const t of propuesta.temas.slice(0, 24)) {
  if (!t || !CAMPOS.every((k) => typeof t[k] === 'string' && t[k].trim())) continue;
  if (!Object.hasOwn(RUTAS, t.categoria) || t.servicio_relacionado !== RUTAS[t.categoria]) continue;
  if (t.tema.length < 20 || t.tema.length > 180) continue;
  if (/\ben\s+\d+\s+(minutos?|horas?|d[ií]as?)\b/i.test(t.tema)) continue; // sin promesas de tiempo

  const titulo = normalizar(t.tema);
  const keyword = normalizar(t.keyword_principal);
  const tokens = palabras(t.tema);
  if (titulos.has(titulo) || keywords.has(keyword) || anteriores.some((a) => parecido(a, tokens))) continue;

  // También frente a los aceptados en esta misma tanda.
  titulos.add(titulo);
  keywords.add(keyword);
  anteriores.push(tokens);

  aceptados.push({
    json: {
      tema: t.tema.trim(),
      categoria: t.categoria,
      keyword_principal: t.keyword_principal.trim(),
      keywords_secundarias: t.keywords_secundarias.trim(),
      servicio_relacionado: RUTAS[t.categoria],
      estado: 'pendiente',
      url_publicada: '',
      fecha: '',
    },
  });
}

// Mejor fallar y avisar que llenar la cola con pocos temas o con repetidos.
if (aceptados.length < 6) {
  throw new Error('Reposición: menos de 6 temas nuevos válidos; se reintentará en la siguiente revisión diaria.');
}

const necesarios = $('Preparar reposición').first().json.temasNecesarios;
return aceptados.slice(0, necesarios);

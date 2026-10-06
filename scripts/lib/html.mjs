/* ============================================================================
 * lib/html.mjs - utilidades compartidas por los validadores del sitio
 *
 * Un tokenizador mínimo (sin dependencias) que entiende lo justo del HTML del
 * portfolio: etiquetas de apertura, atributos entrecomillados y el contenido
 * de los bloques <script>. Lo usan `check-links.mjs` (recursos y enlaces) y
 * `check-content.mjs` (metadatos, textos alternativos y consistencia).
 * ==========================================================================*/

/** Decodifica las entidades que aparecen en atributos (&amp;, &quot;, &#39;...). */
export function decodeHtmlEntities(value) {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|(amp|quot|apos|lt|gt));/gi,
    (entity, decimal, hex, named) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[named.toLowerCase()] ?? entity;
    }
  );
}

/** Tokenizador HTML mínimo que respeta comillas y evita depender de paquetes. */
export function parseStartTags(html) {
  const tags = [];
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start === -1) break;
    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      cursor = end === -1 ? html.length : end + 3;
      continue;
    }

    let index = start + 1;
    if (!/[A-Za-z]/.test(html[index] || "")) {
      cursor = index;
      continue;
    }
    const nameStart = index;
    while (/[\w:-]/.test(html[index] || "")) index += 1;
    const name = html.slice(nameStart, index).toLowerCase();
    let quote = null;
    let end = index;
    for (; end < html.length; end += 1) {
      const char = html[end];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === ">") break;
    }
    if (end >= html.length) break;

    const attributes = new Map();
    const rawAttributes = html.slice(index, end);
    const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const match of rawAttributes.matchAll(attributePattern)) {
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      attributes.set(match[1].toLowerCase(), decodeHtmlEntities(value));
    }
    tags.push({ name, attributes, start });
    cursor = end + 1;
  }
  return tags;
}

/** Devuelve el contenido en crudo de un <script> a partir de su etiqueta. */
export function scriptContent(html, tag) {
  const openEnd = html.indexOf(">", tag.start);
  const closeStart = html.indexOf("</script", openEnd + 1);
  if (openEnd === -1 || closeStart === -1) return null;
  return html.slice(openEnd + 1, closeStart);
}

/** Texto plano del primer elemento con ese id (sirve para leer contadores). */
export function textOfElement(html, id) {
  const pattern = new RegExp(`<([a-z0-9]+)[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1>`, "i");
  const match = html.match(pattern);
  if (!match) return null;
  return decodeHtmlEntities(match[2].replace(/<[^>]*>/g, "")).trim();
}

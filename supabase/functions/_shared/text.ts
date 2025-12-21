export function chunkText(text: string, opts?: { chunkSize?: number; overlap?: number }) {
  const chunkSize = opts?.chunkSize ?? 1000;
  const overlap = opts?.overlap ?? 200;

  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    const slice = clean.slice(start, end);
    chunks.push(slice);
    start = end - overlap;
    if (start < 0) start = 0;
    if (start >= clean.length) break;
  }

  return chunks;
}

export function stripHtmlToText(html: string) {
  // Very lightweight HTML → text conversion (MVP).
  // TODO: replace with a robust HTML parser + boilerplate removal.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

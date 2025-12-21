/**
 * CTF (Compact Table Format) – JSON/CSV on a diet.
 *
 * Goal: reduce repeated keys when sending large structured data to an LLM.
 *
 * This is intentionally simple (MVP). It works best for arrays of objects with
 * stable keys (catalogs, records, events). For small payloads, JSON is fine.
 */

export type CTFOptions = {
  maxRows?: number;
  maxCols?: number;
  delimiter?: string;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function objectsToCTF(rows: Array<Record<string, unknown>>, opts: CTFOptions = {}): string {
  const maxRows = opts.maxRows ?? 5000;
  const maxCols = opts.maxCols ?? 40;
  const delim = opts.delimiter ?? '\t';
  const safeRows = rows.slice(0, maxRows);

  // Determine columns by frequency and first-appearance order
  const counts = new Map<string, number>();
  for (const r of safeRows) {
    for (const k of Object.keys(r)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const cols = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCols)
    .map(([k]) => k);

  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(new RegExp(delim, 'g'), ' ');
  };

  const lines: string[] = [];
  lines.push(`CTF v1`);
  lines.push(`COLUMNS${delim}${cols.join(delim)}`);
  for (const r of safeRows) {
    const vals = cols.map((c) => esc((r as any)[c]));
    lines.push(`ROW${delim}${vals.join(delim)}`);
  }
  return lines.join('\n');
}

export function shouldUseCTF(payloadText: string, thresholdChars = 2500): boolean {
  // Rough heuristic: larger payloads benefit; this approximates token count.
  return payloadText.length >= thresholdChars;
}

export function tryParseJsonArray(text: string): Array<Record<string, unknown>> | null {
  try {
    const v = JSON.parse(text);
    if (!Array.isArray(v)) return null;
    const rows = v.filter(isPlainObject) as Array<Record<string, unknown>>;
    if (!rows.length) return null;
    return rows;
  } catch {
    return null;
  }
}

export function autoFormatStructured(text: string): { kind: 'json' | 'ctf' | 'text'; output: string } {
  const rows = tryParseJsonArray(text);
  if (!rows) return { kind: 'text', output: text };
  if (!shouldUseCTF(text)) return { kind: 'json', output: JSON.stringify(rows) };
  return { kind: 'ctf', output: objectsToCTF(rows) };
}

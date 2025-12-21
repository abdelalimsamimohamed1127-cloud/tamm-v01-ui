export type CatalogRow = Record<string, any>;

/**
 * Minimal CSV parser for SaaS onboarding.
 * - Assumes first row is headers
 * - Supports comma-separated values + basic quotes
 * - Good enough for MVP; replace with a robust parser later.
 */
export function parseCsv(text: string): CatalogRow[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const lines = clean
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // Handle escaped quotes ""
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]).map((h, i) => (h ? h : `col_${i + 1}`));

  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: CatalogRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    return row;
  });
}

export function parseJsonArray(text: string): CatalogRow[] {
  const clean = text.trim();
  if (!clean) return [];
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed)) return [];
  const rows = parsed.filter((x) => x && typeof x === 'object');
  return rows as CatalogRow[];
}

export function detectCatalogInput(text: string): 'json' | 'csv' | 'unknown' {
  const clean = text.trim();
  if (!clean) return 'unknown';
  if (clean.startsWith('[') || clean.startsWith('{')) return 'json';
  if (clean.includes(',') && clean.includes('\n')) return 'csv';
  return 'unknown';
}

/**
 * Lightweight token-cost reducer for structured records.
 * We call it CTF (Compact Table Format).
 */
export function toCTF(rows: CatalogRow[], opts?: { maxColumns?: number; maxRows?: number }) {
  const maxColumns = opts?.maxColumns ?? 20;
  const maxRows = opts?.maxRows ?? 2000;

  const slice = rows.slice(0, maxRows);
  if (slice.length === 0) return '';

  // Collect columns (stable: first row keys first)
  const colSet = new Set<string>();
  Object.keys(slice[0]).forEach((k) => colSet.add(k));
  for (const r of slice.slice(1)) {
    Object.keys(r).forEach((k) => colSet.add(k));
    if (colSet.size >= maxColumns) break;
  }
  const cols = Array.from(colSet).slice(0, maxColumns);

  const esc = (v: any) =>
    String(v ?? '')
      .replace(/\s+/g, ' ')
      .replace(/\|/g, '\\|')
      .trim();

  const lines: string[] = [];
  lines.push('CTF:v1');
  lines.push(`COLUMNS|${cols.map(esc).join('|')}`);
  for (const r of slice) {
    lines.push(`ROW|${cols.map((c) => esc(r[c])).join('|')}`);
  }
  if (rows.length > slice.length) {
    lines.push(`NOTE|truncated_rows|${rows.length - slice.length}`);
  }
  return lines.join('\n');
}

export function autoStructuredFormat(params: {
  raw: string;
  tokenBudgetHint?: number;
}): { format: 'json' | 'ctf' | 'text'; content: string } {
  const raw = params.raw.trim();
  if (!raw) return { format: 'text', content: '' };

  // Very simple heuristic: if long + looks structured → CTF
  const looksJson = raw.startsWith('[') || raw.startsWith('{');
  const looksCsv = raw.includes(',') && raw.includes('\n');
  const isLarge = raw.length > 2500; // ~ token-ish

  if ((looksJson || looksCsv) && isLarge) {
    try {
      const rows = looksJson ? parseJsonArray(raw) : parseCsv(raw);
      if (rows.length) return { format: 'ctf', content: toCTF(rows) };
    } catch {
      // fall back
    }
  }

  return { format: looksJson ? 'json' : 'text', content: raw };
}

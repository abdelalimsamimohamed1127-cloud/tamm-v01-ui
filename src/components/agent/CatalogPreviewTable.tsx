import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function CatalogPreviewTable({ rows }: { rows: Record<string, any>[] }) {
  const cols = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rows) {
      Object.keys(r || {}).forEach((k) => keys.add(k));
      if (keys.size >= 6) break;
    }
    return Array.from(keys).slice(0, 6);
  }, [rows]);

  if (!rows?.length) return null;

  return (
    <div className="border rounded-md overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 10).map((r, idx) => (
            <TableRow key={idx}>
              {cols.map((c) => (
                <TableCell key={c} className="max-w-[200px] truncate">
                  {String((r as any)?.[c] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

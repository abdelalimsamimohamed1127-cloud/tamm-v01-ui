import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="w-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 text-left font-medium ${c.className ?? ""}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                    {empty ?? "No data"}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={(row.id ?? String(idx))} className="border-b last:border-b-0">
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 align-top ${c.className ?? ""}`}>
                        {c.render ? c.render(row) : (row as any)[c.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

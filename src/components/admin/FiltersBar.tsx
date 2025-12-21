import { Input } from "@/components/ui/input";

export function FiltersBar({
  query,
  setQuery,
  placeholder = "Search…",
}: {
  query: string;
  setQuery: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="max-w-sm"
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { addChannelDocLanguage, fetchChannelDocLanguages, ChannelDocLanguage } from "@/services/channelDocLanguages";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useChannelDocLanguages(channelKey: string | null) {
  const { workspace } = useWorkspace();
  const [languages, setLanguages] = useState<ChannelDocLanguage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspace || !channelKey) {
      setLanguages([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChannelDocLanguages(workspace.id, channelKey);
      setLanguages(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load languages");
    } finally {
      setLoading(false);
    }
  }, [workspace, channelKey]);

  useEffect(() => {
    load();
  }, [load]);

  const addLanguage = useCallback(
    async (langCode: string) => {
      if (!workspace || !channelKey) return;
      await addChannelDocLanguage(workspace.id, channelKey, langCode);
      await load();
    },
    [workspace, channelKey, load]
  );

  return { languages, loading, error, refresh: load, addLanguage };
}

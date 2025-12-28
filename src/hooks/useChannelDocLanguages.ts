import { useCallback, useEffect, useState } from "react";
import { addChannelDocLanguage, fetchChannelDocLanguages, ChannelDocLanguage } from "@/services/channelDocLanguages";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useChannelDocLanguages(channelKey: string | null) {
  const { workspaceId } = useWorkspace(); // Changed to workspaceId
  const [languages, setLanguages] = useState<ChannelDocLanguage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!channelKey || !workspaceId) { // Added check for workspaceId
      setLanguages([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChannelDocLanguages(workspaceId, channelKey); // Used workspaceId
      setLanguages(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load languages");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, channelKey]); // Dependency changed

  useEffect(() => {
    load();
  }, [load]);

  const addLanguage = useCallback(
    async (langCode: string) => {
      if (!channelKey || !workspaceId) return; // Added check for workspaceId
      await addChannelDocLanguage(workspaceId, channelKey, langCode); // Used workspaceId
      await load();
    },
    [workspaceId, channelKey, load] // Dependency changed
  );

  return { languages, loading, error, refresh: load, addLanguage };
}

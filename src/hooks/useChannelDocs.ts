import { useEffect, useState, useCallback } from "react";
import { fetchPublishedChannelDoc, ChannelDocPayload } from "@/services/channelDocs";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useChannelDocs(channelKey: string | null, langCode: string | null) {
  const { workspace } = useWorkspace();
  const [doc, setDoc] = useState<ChannelDocPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspace || !channelKey || !langCode) {
      setDoc(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPublishedChannelDoc(workspace.id, channelKey, langCode);
      setDoc(res);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load docs");
      setDoc(null);
    } finally {
      setIsLoading(false);
    }
  }, [workspace, channelKey, langCode]);

  useEffect(() => {
    load();
  }, [load]);

  return { doc, isLoading, error, reload: load };
}

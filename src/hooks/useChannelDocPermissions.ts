import { useCallback, useEffect, useState } from "react";
import {
  ChannelPermission,
  ChannelLanguagePermission,
  fetchChannelPermissions,
  fetchChannelLanguagePermissions,
  upsertChannelPermission,
  upsertChannelLanguagePermission,
} from "@/services/channelDocPermissions";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useChannelDocPermissions(channelKey: string | null) {
  const { workspace } = useWorkspace();
  const [permissions, setPermissions] = useState<ChannelPermission[]>([]);
  const [languagePermissions, setLanguagePermissions] = useState<ChannelLanguagePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspace || !channelKey) {
      setPermissions([]);
      setLanguagePermissions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, lp] = await Promise.all([
        fetchChannelPermissions(workspace.id, channelKey),
        fetchChannelLanguagePermissions(workspace.id, channelKey),
      ]);
      setPermissions(p);
      setLanguagePermissions(lp);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [workspace, channelKey]);

  useEffect(() => {
    load();
  }, [load]);

  const updatePermission = useCallback(
    async (entry: ChannelPermission) => {
      await upsertChannelPermission(entry);
      await load();
    },
    [load]
  );

  const updateLanguagePermission = useCallback(
    async (entry: ChannelLanguagePermission) => {
      await upsertChannelLanguagePermission(entry);
      await load();
    },
    [load]
  );

  return {
    permissions,
    languagePermissions,
    loading,
    error,
    refresh: load,
    updatePermission,
    updateLanguagePermission,
  };
}

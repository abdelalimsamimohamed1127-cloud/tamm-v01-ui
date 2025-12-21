import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { sb } from "@/lib/admin/sb";

/**
 * Checks if the current user is an admin.
 *
 * Sources of truth (in order):
 * 1) VITE_ADMIN_EMAILS (comma-separated list) - dev override
 * 2) public.user_roles table (recommended)
 *
 * NOTE: Client-side checks are NOT sufficient. You must also enforce RLS on admin tables.
 */
export function useAdminGuard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminEmails = useMemo(() => {
    const raw = import.meta.env.VITE_ADMIN_EMAILS as string | undefined;
    return (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);

      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Dev override
      const email = (user.email ?? "").toLowerCase();
      if (adminEmails.length > 0 && adminEmails.includes(email)) {
        setIsAdmin(true);
        setIsLoading(false);
        return;
      }

      try {
        // Recommended: user_roles table
        const { data, error } = await sb
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          // If table doesn't exist yet, this will error in dev.
          // Keep admin = false unless env override is set.
          if (!cancelled) {
            setIsAdmin(false);
            setError(error.message);
          }
        } else {
          const role = (data?.role ?? "").toLowerCase();
          if (!cancelled) setIsAdmin(role === "admin" || role === "owner");
        }
      } catch (e: any) {
        if (!cancelled) {
          setIsAdmin(false);
          setError(e?.message ?? String(e));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, adminEmails]);

  return { isLoading, isAdmin, error };
}

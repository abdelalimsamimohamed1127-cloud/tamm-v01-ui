import { Outlet, Navigate } from "react-router-dom";
import { SettingsShell } from "@/components/SettingsShell";

export default function Settings() {
  return (
    <SettingsShell>
      <Outlet />
    </SettingsShell>
  );
}

export function SettingsIndexRedirect() {
  return <Navigate to="general" replace />;
}

import { Outlet, Navigate } from "react-router-dom";

export default function Settings() {
  return <Outlet />;
}

// ✅ تعريف واحد فقط
export function SettingsIndexRedirect() {
  return <Navigate to="general" replace />;
}

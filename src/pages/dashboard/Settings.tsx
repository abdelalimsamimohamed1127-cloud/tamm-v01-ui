import { Outlet, Navigate } from "react-router-dom";

export default function Settings() {
  return <Outlet />;
}

export function SettingsIndexRedirect() {
  return <Navigate to="general" replace />;
}

export function SettingsIndexRedirect() {
  return <Navigate to="general" replace />;
}

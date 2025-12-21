import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Overview from "@/pages/dashboard/Overview";
import Channels from "@/pages/dashboard/Channels";
import Settings from "@/pages/dashboard/Settings";
import AIAgent from "@/pages/dashboard/AIAgent";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard/*" element={<Dashboard />}>
        <Route index element={<Overview />} />
        <Route path="channels" element={<Channels />} />
        <Route path="settings" element={<Settings />} />
        <Route path="ai-agent" element={<AIAgent />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

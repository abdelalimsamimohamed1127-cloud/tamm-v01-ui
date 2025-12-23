// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Channels from "@/pages/dashboard/Channels";
import Settings, { SettingsIndexRedirect } from "@/pages/dashboard/Settings";
import SettingsGeneral from "@/pages/dashboard/SettingsGeneral";
import SettingsSecurity from "@/pages/dashboard/SettingsSecurity";
import AIAgent from "@/pages/dashboard/AIAgent";
import Inbox from "@/pages/dashboard/Inbox";
import Orders from "@/pages/dashboard/Orders";
import Tickets from "@/pages/dashboard/Tickets";
import Automations from "@/pages/dashboard/Automations";
import Evals from "@/pages/dashboard/Evals";
import Insights from "@/pages/dashboard/Insights";
import Analytics from "@/pages/dashboard/Analytics";
import Account from "@/pages/dashboard/Account";
import ManageAgents from "@/pages/dashboard/ManageAgents";
import WorkspaceSettings from "@/pages/dashboard/WorkspaceSettings";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/admin/Admin";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import AdminOverview from "@/pages/admin/Overview";
import AdminCustomers from "@/pages/admin/Customers";
import AdminWorkspaces from "@/pages/admin/Workspaces";
import AdminAgents from "@/pages/admin/Agents";
import AdminUsage from "@/pages/admin/Usage";
import AdminBilling from "@/pages/admin/Billing";
import AdminAuditLogs from "@/pages/admin/AuditLogs";
import AdminDocs from "@/pages/admin/Docs";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Landing from "@/pages/Landing";
import ChatWindow from "@/pages/public/ChatWindow";



export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
        <div className="max-w-md space-y-3 text-center">
          <p className="text-lg font-semibold">Supabase is not configured.</p>
          <p className="text-sm text-muted-foreground">
            Please set <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in your environment to enable authentication and data features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/chat/:agentId" element={<ChatWindow />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      {/* Keep legacy /account entry, but render the same in-dashboard page */}
      <Route path="/account" element={<Navigate to="/dashboard/account" replace />} />


      <Route path="/dashboard/*" element={<Dashboard />}>
        <Route index element={<Navigate to="analytics/general" replace />} />
        <Route path="overview" element={<Navigate to="analytics/general" replace />} />
        <Route path="channels" element={<Channels />} />
        <Route path="ai-agent" element={<AIAgent />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="orders" element={<Orders />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="automations" element={<Automations />} />
        <Route path="evals" element={<Navigate to="analytics/evals" replace />} />
        <Route path="insights" element={<Navigate to="analytics/insights" replace />} />
        <Route path="analytics" element={<Navigate to="analytics/general" replace />} />
        <Route path="analytics/general" element={<Analytics />} />
        <Route path="analytics/evals" element={<Evals />} />
        <Route path="analytics/insights" element={<Insights />} />

        {/* Profile menu destinations */}
        <Route path="account" element={<Navigate to="/dashboard?dialog=account" replace />} />
        <Route path="manage-agents" element={<Navigate to="/dashboard?dialog=agents" replace />} />
        <Route path="workspace-settings" element={<Navigate to="/dashboard?dialog=workspace" replace />} />
        <Route path="settings/*" element={<Settings />}>
          <Route index element={<SettingsIndexRedirect />} />
          <Route path="general" element={<SettingsGeneral />} />
          <Route path="security" element={<SettingsSecurity />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/admin/*" element={<Admin />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<AdminOverview />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="workspaces" element={<AdminWorkspaces />} />
        <Route path="agents" element={<AdminAgents />} />
        <Route path="usage" element={<AdminUsage />} />
        <Route path="billing" element={<AdminBilling />} />
        <Route path="audit" element={<AdminAuditLogs />} />
        <Route path="docs" element={<AdminDocs />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/dashboard/admin/*" element={<Admin />}>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

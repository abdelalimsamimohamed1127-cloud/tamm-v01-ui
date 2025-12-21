import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import Overview from "./Overview";
import Customers from "./Customers";
import Workspaces from "./Workspaces";
import Agents from "./Agents";
import Usage from "./Usage";
import Billing from "./Billing";
import AuditLogs from "./AuditLogs";
import Docs from "./Docs";

export default function Admin() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="customers" element={<Customers />} />
        <Route path="workspaces" element={<Workspaces />} />
        <Route path="agents" element={<Agents />} />
        <Route path="usage" element={<Usage />} />
        <Route path="billing" element={<Billing />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route path="docs" element={<Docs />} />
      </Routes>
    </AdminLayout>
  );
}

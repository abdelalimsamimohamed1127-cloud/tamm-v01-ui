import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Overview from '@/pages/dashboard/Overview';
import Channels from '@/pages/dashboard/Channels';
import AIAgent from '@/pages/dashboard/AIAgent';
import Inbox from '@/pages/dashboard/Inbox';
import Orders from '@/pages/dashboard/Orders';
import Tickets from '@/pages/dashboard/Tickets';
import Automations from '@/pages/dashboard/Automations';
import Analytics from '@/pages/dashboard/Analytics';
import Evals from '@/pages/dashboard/Evals';
import Insights from '@/pages/dashboard/Insights';
import Settings from '@/pages/dashboard/Settings';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="channels" element={<Channels />} />
        <Route path="ai-agent" element={<AIAgent />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="orders" element={<Orders />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="automations" element={<Automations />} />
        <Route path="evals" element={<Evals />} />
        <Route path="insights" element={<Insights />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </DashboardLayout>
  );
}

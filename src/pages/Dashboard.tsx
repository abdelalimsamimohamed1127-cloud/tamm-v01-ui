// src/pages/Dashboard.tsx
import { Outlet } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

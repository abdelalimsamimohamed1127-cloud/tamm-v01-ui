import { Outlet, useLocation } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatePresence, motion } from 'framer-motion';

export default function Dashboard() {
  const location = useLocation();

  return (
    <DashboardLayout>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
}

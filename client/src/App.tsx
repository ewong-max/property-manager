import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Companies from '@/pages/Companies';
import Properties from '@/pages/Properties';
import PropertyDetail from '@/pages/PropertyDetail';
import Tenancies from '@/pages/Tenancies';
import Expenses from '@/pages/Expenses';
import Reports from '@/pages/Reports';
import Backup from '@/pages/Backup';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('pm_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/companies" element={<AppLayout><Companies /></AppLayout>} />
        <Route path="/companies/:id" element={<AppLayout><Companies /></AppLayout>} />
        <Route path="/properties" element={<AppLayout><Properties /></AppLayout>} />
        <Route path="/properties/:id" element={<AppLayout><PropertyDetail /></AppLayout>} />
        <Route path="/tenancies" element={<AppLayout><Tenancies /></AppLayout>} />
        <Route path="/tenancies/:id" element={<AppLayout><Tenancies /></AppLayout>} />
        <Route path="/expenses" element={<AppLayout><Expenses /></AppLayout>} />
        <Route path="/reports" element={<AppLayout><Reports /></AppLayout>} />
        <Route path="/backup" element={<AppLayout><Backup /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

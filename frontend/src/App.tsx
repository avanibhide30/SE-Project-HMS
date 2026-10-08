import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { useAuth } from './context/AuthContext';
import { UserRole } from './types';

// Student pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { ApplicationPage } from './pages/student/ApplicationPage';
import { RoomViewPage } from './pages/student/RoomViewPage';
import { FeesPage } from './pages/student/FeesPage';
import { VisitorPage } from './pages/student/VisitorPage';
import { OutpassPage } from './pages/student/OutpassPage';
import { NoticesPage } from './pages/student/NoticesPage';
import { CurfewPage } from './pages/student/CurfewPage';
import { StaffPage } from './pages/staff/StaffPages';

const roleHome: Record<UserRole, string> = {
  STUDENT: '/dashboard',
  WARDEN: '/warden/dashboard',
  ACCOUNTS: '/accounts/dashboard',
  SECURITY: '/security/gate-console',
  ADMIN: '/admin/dashboard',
};

const RequireRole: React.FC<{ roles: UserRole[] }> = ({ roles }) => {
  const { user } = useAuth();
  return user && roles.includes(user.role)
    ? <Outlet />
    : <Navigate to={user ? roleHome[user.role] : '/login'} replace />;
};

const LoginRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? <Navigate to={roleHome[user.role]} replace /> : <LoginPage />;
};

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      {/* Redirect root to the dashboard (or login when signed out). */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Wrap all pages with the common layout */}
      <Route element={<AppLayout />}>
        {/* Student routes */}
        <Route element={<RequireRole roles={['STUDENT']} />}>
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/application" element={<ApplicationPage />} />
          <Route path="/room" element={<RoomViewPage />} />
          <Route path="/fees" element={<FeesPage />} />
          <Route path="/visitors" element={<VisitorPage />} />
          <Route path="/outpass" element={<OutpassPage />} />
          <Route path="/notices" element={<NoticesPage />} />
          <Route path="/curfew" element={<CurfewPage />} />
        </Route>

        <Route element={<RequireRole roles={['WARDEN']} />}>
          <Route path="/warden/dashboard" element={<StaffPage />} />
          <Route path="/warden/applications" element={<StaffPage />} />
          <Route path="/warden/rooms" element={<StaffPage />} />
          <Route path="/warden/outpasses" element={<StaffPage />} />
          <Route path="/warden/curfew" element={<StaffPage />} />
          <Route path="/warden/notices" element={<StaffPage />} />
          <Route path="/warden/visitors" element={<StaffPage />} />
          <Route path="/warden/fees" element={<StaffPage />} />
          <Route path="/warden/defaulters" element={<StaffPage />} />
        </Route>
        <Route element={<RequireRole roles={['ACCOUNTS', 'ADMIN']} />}>
          <Route path="/accounts/dashboard" element={<StaffPage />} />
          <Route path="/accounts/fee-heads" element={<StaffPage />} />
          <Route path="/accounts/defaulters" element={<StaffPage />} />
        </Route>
        <Route element={<RequireRole roles={['SECURITY']} />}>
          <Route path="/security/gate-console" element={<StaffPage />} />
          <Route path="/security/visitors" element={<StaffPage />} />
          <Route path="/security/curfew" element={<StaffPage />} />
          <Route path="/security/outpasses" element={<StaffPage />} />
        </Route>
        <Route element={<RequireRole roles={['ADMIN']} />}>
          <Route path="/admin/dashboard" element={<StaffPage />} />
          <Route path="/admin/users" element={<StaffPage />} />
          <Route path="/admin/settings" element={<StaffPage />} />
          <Route path="/admin/audit-logs" element={<StaffPage />} />
          <Route path="/admin/applications" element={<StaffPage />} />
          <Route path="/admin/rooms" element={<StaffPage />} />
          <Route path="/admin/notices" element={<StaffPage />} />
        </Route>
        <Route element={<RequireRole roles={['WARDEN', 'ACCOUNTS', 'ADMIN']} />}>
          <Route path="/reports" element={<StaffPage />} />
        </Route>

      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
